import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { dbService, EQUIPO_STATUS } from '../services/dbService';
import { obtenerProyectoActivo } from '../services/equiposService';
import { analizarEquipoProfundo, generarDocumentoWord } from '../services/n8nService';
import { useAuth } from '../context/AuthContext';

const CATALOGO_RIESGOS = [
  { code: 'a1', label: 'a1) Partes en movimiento' },
  { code: 'a2', label: 'a2) Generación de calor' },
  { code: 'a3', label: 'a3) Electricidad estática' },
  { code: 'b1', label: 'b1) Superficies cortantes' },
  { code: 'b2', label: 'b2) Proyección de material' },
  { code: 'b3', label: 'b3) Calentamiento de material' },
  { code: 'c1', label: 'c1) Manejo de herramientas' },
  { code: 'c2', label: 'c2) Condiciones de operación' }
];

// Convertidor asíncrono de imágenes de Supabase Storage a Base64 en el navegador (para Fase 3: Word)
const urlToBase64Navegador = async (url) => {
  if (!url) return null;
  if (typeof url === 'string' && url.startsWith('data:image')) return url;

  try {
    const cleanUrl = String(url).replace(/[\r\n\t\s]/g, '').trim();
    const res = await fetch(cleanUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(cleanUrl);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error('Error convirtiendo imagen en el navegador:', e);
    return url;
  }
};

const getNivelBadgeClass = (valor) => {
  const v = parseInt(valor, 10) || 0;
  if (v >= 15) return 'bg-red-600 text-white font-bold';
  if (v >= 9) return 'bg-yellow-400 text-slate-900 font-bold';
  if (v >= 4) return 'bg-emerald-500 text-white font-bold';
  return 'bg-slate-200 text-slate-700 font-bold';
};

export default function MisEquipos() {
  const { userId } = useAuth();

  // Estudio activo (lo define Datos Empresariales al presionar "Continuar / Entrar")
  const [proyecto] = useState(() => obtenerProyectoActivo());
  const fkEvaluacion = proyecto?.evaluacion_id ?? null;

  const [equipos, setEquipos] = useState([]);
  const [dirtyIds, setDirtyIds] = useState({});       // { [id]: true } cuando hay ediciones locales sin guardar
  const [savingId, setSavingId] = useState(null);     // ID del borrador que se está guardando manualmente
  const [itemStatus, setItemStatus] = useState({});   // { [id]: { state: 'queued'|'analyzing'|'done'|'error', error?: string } }
  const [expandedId, setExpandedId] = useState(null); // ID del equipo completado cuya matriz está desplegada

  // Estado de la Cola Secuencial (Fase 2)
  const [queueProgress, setQueueProgress] = useState({
    running: false,
    current: 0,
    total: 0,
    currentName: ''
  });
  const cancelQueueRef = useRef(false);

  const [isLoading, setIsLoading] = useState(Boolean(fkEvaluacion));
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
  }, []);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Carga inicial desde Supabase: equipos del estudio activo (con sus imágenes y análisis)
  useEffect(() => {
    if (!fkEvaluacion) return;
    let cancelado = false;

    dbService.obtenerPorEvaluacion(fkEvaluacion)
      .then((lista) => { if (!cancelado) setEquipos(lista); })
      .catch((error) => { if (!cancelado) showToast(error.message, 'error'); })
      .finally(() => { if (!cancelado) setIsLoading(false); });

    return () => { cancelado = true; };
  }, [fkEvaluacion, showToast]);

  const borradores = equipos.filter(eq => eq.status !== EQUIPO_STATUS.COMPLETADO);
  const completados = equipos.filter(eq => eq.status === EQUIPO_STATUS.COMPLETADO);

  // --- EDICIÓN EN LÍNEA DE BORRADORES (FASE 2 · SIN EXPOSICIÓN) ---
  const actualizarCampoLocal = (id, campo, valor) => {
    setEquipos(prev => prev.map(eq => (eq.id === id ? { ...eq, [campo]: valor } : eq)));
    setDirtyIds(prev => ({ ...prev, [id]: true }));
  };

  const handleGuardarBorrador = async (equipo) => {
    setSavingId(equipo.id);
    try {
      const actualizado = await dbService.guardarBorrador(equipo);
      setEquipos(prev => prev.map(eq => (eq.id === equipo.id ? actualizado : eq)));
      setDirtyIds(prev => {
        const copia = { ...prev };
        delete copia[equipo.id];
        return copia;
      });
      showToast(`Cambios guardados en "${actualizado.equipo || 'Borrador'}"`, 'success');
      return actualizado;
    } catch (error) {
      showToast(error.message, 'error');
      throw error;
    } finally {
      setSavingId(null);
    }
  };

  // Permite reabrir un equipo completado como borrador si el usuario desea corregir datos y re-analizar
  const handleReabrirComoBorrador = async (equipo) => {
    setSavingId(equipo.id);
    try {
      const actualizado = await dbService.reabrirComoBorrador(equipo.id);
      setEquipos(prev => prev.map(eq => (eq.id === equipo.id ? actualizado : eq)));
      showToast(`"${actualizado.equipo}" regresó a borrador para edición`, 'success');
    } catch (error) {
      showToast(error.message, 'error');
    } finally {
      setSavingId(null);
    }
  };

  const handleEliminar = async (id) => {
    if (!confirm('¿Estás seguro de eliminar este equipo permanentemente?')) return;
    try {
      await dbService.eliminarEquipo(id);
      setEquipos(prev => prev.filter(eq => eq.id !== id));
      showToast('Equipo eliminado', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  // --- LÓGICA UNITARIA DE ANÁLISIS PROFUNDO (WEBHOOK 2 · SOLO TEXTO) ---
  const procesarUnEquipoProfundo = async (equipoActual) => {
    const nombre = (equipoActual.equipo || '').trim();
    const descripcion = (equipoActual.descripcion_manual || '').trim();

    if (!nombre || !descripcion) {
      throw new Error('Falta capturar el Nombre del Equipo o la Descripción técnica.');
    }

    // 1. Si tenía cambios locales en los inputs, primero los persistimos
    let equipoSincronizado = equipoActual;
    if (dirtyIds[equipoActual.id]) {
      equipoSincronizado = await dbService.guardarBorrador(equipoActual);
      setDirtyIds(prev => {
        const copia = { ...prev };
        delete copia[equipoActual.id];
        return copia;
      });
    }

    // 2. Enviar ÚNICAMENTE TEXTO al Webhook 2 (sin imágenes ni campos de exposición)
    const payloadTexto = {
      user_id: userId,
      equipo_id: equipoSincronizado.id,
      equipo: nombre,
      identificacion: equipoSincronizado.identificacion || '',
      departamento: equipoSincronizado.departamento || '',
      descripcion
    };

    const { riesgos, matriz } = await analizarEquipoProfundo(payloadTexto);

    // 3. Checkpoint inmediato en Supabase: guarda en analisis_equipos y pasa a 'completado'
    const completadoEnDb = await dbService.marcarCompletado(equipoSincronizado.id, {
      riesgos,
      matriz
    });

    setEquipos(prev => prev.map(eq => (eq.id === completadoEnDb.id ? completadoEnDb : eq)));
    return completadoEnDb;
  };

  // --- COLA SECUENCIAL (QUEUE 1 POR 1) PARA "ANALIZAR TODOS" ---
  const ejecutarColaSecuencial = async (listaBorradores) => {
    if (listaBorradores.length === 0) {
      showToast('No hay equipos en borrador pendientes de analizar.', 'warning');
      return;
    }

    const listos = [];
    const incompletos = [];

    for (const eq of listaBorradores) {
      if ((eq.equipo || '').trim() && (eq.descripcion_manual || '').trim()) {
        listos.push(eq);
      } else {
        incompletos.push(eq);
      }
    }

    if (incompletos.length > 0) {
      setItemStatus(prev => {
        const next = { ...prev };
        incompletos.forEach(eq => {
          next[eq.id] = {
            state: 'error',
            error: 'Completa el Nombre del Equipo y la Descripción técnica antes de analizar.'
          };
        });
        return next;
      });
    }

    if (listos.length === 0) {
      showToast('Completa el Nombre y la Descripción técnica en los borradores antes de analizar.', 'error');
      return;
    }

    cancelQueueRef.current = false;

    setItemStatus(prev => {
      const next = { ...prev };
      listos.forEach(eq => {
        next[eq.id] = { state: 'queued' };
      });
      return next;
    });

    setQueueProgress({
      running: true,
      current: 0,
      total: listos.length,
      currentName: listos[0].equipo || 'Equipo 1'
    });

    let exitosos = 0;
    let fallidos = 0;
    let detenidoPorRed = false;

    for (let i = 0; i < listos.length; i++) {
      if (cancelQueueRef.current) {
        break;
      }

      const equipoActual = listos[i];
      setQueueProgress({
        running: true,
        current: i + 1,
        total: listos.length,
        currentName: equipoActual.equipo || `Equipo ${i + 1}`
      });

      setItemStatus(prev => ({
        ...prev,
        [equipoActual.id]: { state: 'analyzing' }
      }));

      try {
        await procesarUnEquipoProfundo(equipoActual);
        exitosos++;
        setItemStatus(prev => ({
          ...prev,
          [equipoActual.id]: { state: 'done' }
        }));
      } catch (error) {
        fallidos++;
        setItemStatus(prev => ({
          ...prev,
          [equipoActual.id]: {
            state: 'error',
            error: error?.message || 'Error al analizar este equipo.'
          }
        }));

        if (error?.isNetworkError) {
          detenidoPorRed = true;
          break;
        }
      }
    }

    setQueueProgress({ running: false, current: 0, total: 0, currentName: '' });

    if (detenidoPorRed) {
      showToast(
        `Se completaron ${exitosos} de ${listos.length} equipo(s). La cola se pausó por fallo de conexión; presiona "Analizar Todos" para reanudar.`,
        'warning'
      );
    } else if (cancelQueueRef.current) {
      showToast(`Cola pausada (${exitosos} completado(s)).`, 'warning');
    } else if (fallidos > 0) {
      showToast(
        `Proceso finalizado: ${exitosos} completado(s) y ${fallidos} con observaciones.`,
        'warning'
      );
    } else {
      showToast(`¡Análisis profundo completado para ${exitosos} equipo(s)!`, 'success');
    }
  };

  const handleAnalizarTodos = () => {
    ejecutarColaSecuencial(borradores);
  };

  const handleAnalizarUno = (equipo) => {
    ejecutarColaSecuencial([equipo]);
  };

  const handlePausarCola = () => {
    cancelQueueRef.current = true;
  };

  // --- FASE 3: GENERAR REPORTE WORD (WEBHOOK 3) ---
  const handleGenerarDocumento = async () => {
    if (completados.length === 0) {
      showToast('No hay equipos con análisis completo para generar el reporte.', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      showToast('Procesando imágenes para el documento...', 'success');

      const equiposProcesados = await Promise.all(
        completados.map(async (eq) => {
          const rawImgs = eq.imagenes_urls || [];
          const imgsArray = Array.isArray(rawImgs) ? rawImgs : [rawImgs];

          const imagenesB64 = await Promise.all(
            imgsArray.map(async (item) => {
              const urlStr = typeof item === 'string' ? item : (item?.url || item?.src || item?.base64);
              if (!urlStr) return null;
              return await urlToBase64Navegador(urlStr);
            })
          );

          return {
            ...eq,
            imagenes_base64: imagenesB64.filter(Boolean)
          };
        })
      );

      const datosEmpresaRaw = localStorage.getItem('programa_seguridad_todos_datos');
      const datosEmpresa = datosEmpresaRaw ? JSON.parse(datosEmpresaRaw) : {};
      const logoEmpresa = localStorage.getItem('company_logo') || null;

      const payloadConsolidado = {
        user_id: userId,
        empresa: datosEmpresa.company_name || '',
        direccion: datosEmpresa.company_address || '',
        rfc: datosEmpresa.company_rfc || '',
        actividad: datosEmpresa.company_activity || '',
        total_trabajadores: datosEmpresa.total_workers || '',
        horarios: datosEmpresa.work_schedule || '',
        especialista: datosEmpresa.specialist_name || '',
        registro_stps: datosEmpresa.stps_register || '',
        logo: logoEmpresa,
        equipos: equiposProcesados
      };

      const blob = await generarDocumentoWord(payloadConsolidado);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Programa_Seguridad_Maquinaria_NOM004.doc';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      showToast('Documento Word generado correctamente', 'success');
    } catch (error) {
      showToast('Error al generar el archivo: ' + error.message, 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const toastBgClass =
    toast.type === 'error'
      ? 'bg-red-600'
      : toast.type === 'warning'
        ? 'bg-amber-600'
        : 'bg-emerald-600';

  // Estilos "glass" reutilizables (tomados de Analisisdatos.jsx)
  const glassCard =
    'rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,32,96,0.08)]';
  const glassInput =
    'w-full rounded-xl border border-slate-200/80 bg-white/60 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 backdrop-blur transition outline-none focus:bg-white/90 focus:border-[#002060]/40 focus:ring-2 focus:ring-[#002060]/20 disabled:opacity-60';

  return (
    <div className="relative isolate overflow-hidden font-body text-slate-800">

      {/* Fondo decorativo para superficies translúcidas */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50 via-blue-50/70 to-indigo-100/60" />
      <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 w-96 h-96 rounded-full bg-[#002060]/15 blur-3xl" />
      <div aria-hidden="true" className="absolute top-1/3 -right-28 -z-10 w-[28rem] h-[28rem] rounded-full bg-sky-400/25 blur-3xl" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/4 -z-10 w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl" />

      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* Toast de notificaciones */}
        {toast.show && (
          <div className={`fixed top-5 right-5 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl text-white font-bold transition-all flex items-center gap-3 ${toastBgClass}`}>
            <Icon
              className="w-5 h-5 shrink-0"
              d={
                toast.type === 'error' || toast.type === 'warning'
                  ? 'M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'
                  : 'M4.5 12.75l6 6 9-13.5'
              }
            />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Modal de Generación de Word */}
        {isGenerating && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-50 flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center max-w-xs border border-white/60">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-title text-xl font-bold text-[#002060] mb-1">Generando Word...</p>
              <p className="text-xs text-slate-500">Consolidando tablas y matrices NOM-004</p>
            </div>
          </div>
        )}

        {/* Encabezado Principal estilo Glass (idéntico a Analisisdatos.jsx) */}
        <header className="relative overflow-hidden rounded-3xl bg-[#002060]/90 backdrop-blur-xl text-white px-6 py-8 md:px-10 shadow-lg mb-8">
          <div aria-hidden="true" className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div>
              <p className="text-blue-200 text-[11px] font-bold uppercase tracking-widest mb-1">
                Fase 2 y 3 · Revisión y Reporte
              </p>
              <h1 className="font-title text-3xl md:text-4xl font-black uppercase tracking-wide">
                Mis Equipos
              </h1>
              <p className="text-blue-100/80 text-sm mt-1">
                {proyecto ? (
                  <>
                    Estudio: <span className="font-semibold text-white">{proyecto.titulo_proyecto}</span>
                    {proyecto.razon_social ? ` · ${proyecto.razon_social}` : ''}
                  </>
                ) : (
                  'Revisa tus borradores y genera el análisis NOM-004.'
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <span className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-xs font-bold border bg-amber-400/20 border-amber-300/40 text-amber-100 backdrop-blur">
                <span className="w-5 h-5 rounded-full bg-amber-400 text-[#002060] flex items-center justify-center text-[10px] font-black">
                  {borradores.length}
                </span>
                Borradores
              </span>

              <span className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full text-xs font-bold border bg-emerald-400/20 border-emerald-300/40 text-emerald-100 backdrop-blur">
                <span className="w-5 h-5 rounded-full bg-emerald-400 text-[#002060] flex items-center justify-center text-[10px] font-black">
                  {completados.length}
                </span>
                Completados
              </span>

              {borradores.length > 0 && (
                <button
                  type="button"
                  onClick={handleAnalizarTodos}
                  disabled={queueProgress.running || isGenerating}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white text-[#002060] hover:bg-blue-50 disabled:opacity-50 font-bold text-xs shadow-md transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  {queueProgress.running
                    ? `${queueProgress.current}/${queueProgress.total}...`
                    : 'Analizar todos'}
                </button>
              )}

              {completados.length > 0 && (
                <button
                  type="button"
                  onClick={handleGenerarDocumento}
                  disabled={isGenerating || queueProgress.running}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-400 text-[#002060] hover:bg-emerald-300 disabled:opacity-50 font-bold text-xs shadow-md transition cursor-pointer disabled:cursor-not-allowed"
                >
                  <Icon className="w-4 h-4" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  Exportar Word
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Barra de progreso de la Cola Secuencial (Queue 1 a 1) */}
        {queueProgress.running && (
          <div className={`${glassCard} mb-6 p-5 flex flex-col md:flex-row items-center justify-between gap-4`}>
            <div className="flex items-center gap-4 w-full">
              <div className="w-8 h-8 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin shrink-0"></div>
              <div className="w-full">
                <div className="flex justify-between text-xs font-bold text-[#002060] uppercase mb-1">
                  <span>Analizando en cola secuencial</span>
                  <span>{queueProgress.current} de {queueProgress.total}</span>
                </div>
                <p className="text-sm font-semibold text-slate-700 truncate mb-2">
                  {queueProgress.currentName}
                </p>
                <div className="w-full bg-blue-100/80 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-linear-to-r from-[#002060] to-[#1d4ed8] h-full transition-all duration-300"
                    style={{ width: `${Math.round((queueProgress.current / queueProgress.total) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePausarCola}
              className="shrink-0 px-4 py-2 rounded-xl border border-slate-300/80 bg-white/70 hover:bg-white text-slate-700 font-bold text-xs transition"
            >
              Pausar
            </button>
          </div>
        )}

        {!fkEvaluacion ? (
          <section className={`${glassCard} p-10 text-center`}>
            <p className="font-title text-xl font-black text-[#002060] uppercase mb-1">No hay un estudio activo</p>
            <p className="text-sm text-slate-600 mb-5">Entra a un estudio desde Datos Empresariales para ver sus equipos.</p>
            <Link
              to="/formulario"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#002060] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:bg-[#001040]"
            >
              Ir a Datos Empresariales
            </Link>
          </section>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin"></div>
          </div>
        ) : equipos.length === 0 ? (
          <section className={`${glassCard} p-12 text-center text-slate-500`}>
            <Icon className="w-12 h-12 text-slate-400 mx-auto mb-3" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            <p className="font-bold text-slate-700 mb-1">Aún no tienes equipos registrados</p>
            <p className="text-sm mb-5">Registra el primer equipo en la Fase 1 para revisarlo aquí.</p>
            <Link
              to="/analisis-datos"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#002060] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:bg-[#001040]"
            >
              <Icon className="w-4 h-4" d="M12 4.5v15m7.5-7.5h-15" />
              Registrar equipo
            </Link>
          </section>
        ) : (
          <div>

            {/* =====================================================================
                ZONA A · BORRADORES (Equipo a la izquierda/centro · Referencia a la derecha)
               ===================================================================== */}
            <div className="rounded-[2rem] border border-white/60 bg-white/25 backdrop-blur-sm p-4 md:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#002060] bg-[#002060]/10 border border-[#002060]/15 px-3 py-1 rounded-full">
                    <Icon className="w-3.5 h-3.5" strokeWidth={2.25} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    Borradores · {borradores.length}
                  </span>
                  <span className="text-xs text-slate-500">Revisa antes de analizar</span>
                </div>
              </div>

              {borradores.length === 0 ? (
                <div className={`${glassCard} p-6 text-center text-sm text-slate-500`}>
                  No hay borradores pendientes. Todos tus equipos ya fueron analizados.
                </div>
              ) : (
                <div className="space-y-5">
                  {borradores.map((item, index) => {
                    const fotos = Array.isArray(item.imagenes_urls) ? item.imagenes_urls : [];
                    const estadoCola = itemStatus[item.id];
                    const estaAnalizandoEste = estadoCola?.state === 'analyzing';
                    const tieneCambios = Boolean(dirtyIds[item.id]);

                    return (
                      <article
                        key={item.id}
                        className={`${glassCard} p-5 md:p-6 transition ${
                          estaAnalizandoEste
                            ? 'ring-2 ring-blue-400/80'
                            : estadoCola?.state === 'error'
                              ? 'ring-2 ring-red-300/80'
                              : ''
                        }`}
                      >
                        {/* Barra superior minimalista */}
                        <div className="flex items-center justify-between gap-3 mb-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#002060] bg-[#002060]/10 px-2.5 py-1 rounded-full">
                              Equipo #{index + 1}
                            </span>
                            {tieneCambios && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full font-semibold bg-amber-100/80 text-amber-800">
                                Sin guardar
                              </span>
                            )}
                            {estadoCola?.state === 'queued' && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-slate-200/70 text-slate-700">
                                En cola
                              </span>
                            )}
                            {estaAnalizandoEste && (
                              <span className="text-[11px] px-2.5 py-1 rounded-full font-bold bg-[#002060] text-white flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Analizando...
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleEliminar(item.id)}
                            disabled={queueProgress.running}
                            title="Eliminar equipo"
                            aria-label="Eliminar equipo"
                            className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-red-600 hover:bg-red-50/70 px-2.5 py-1.5 rounded-xl transition disabled:opacity-50"
                          >
                            <Icon className="w-4 h-4" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                            <span className="hidden sm:inline">Eliminar</span>
                          </button>
                        </div>

                        {/* Error individual si falló en la cola */}
                        {estadoCola?.state === 'error' && estadoCola.error && (
                          <div className="mb-4 px-4 py-3 rounded-2xl bg-red-100/60 border border-red-300/50 text-xs text-red-900 font-medium">
                            {estadoCola.error}
                          </div>
                        )}

                        {/* Distribución en 3 columnas (igual de limpia que Analisisdatos):
                            Izquierda: Fotos · Centro: Nombre y Descripción · Derecha: Identificación, Área y Acciones */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">

                          {/* 1. Fotos (Izquierda) */}
                          <div className="lg:col-span-3 flex flex-col">
                            <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-1.5">
                              Fotos ({fotos.length})
                            </span>
                            {fotos.length > 0 ? (
                              <div className={`grid gap-2.5 flex-1 ${fotos.length > 1 ? 'grid-cols-2 lg:grid-cols-1' : 'grid-cols-1'}`}>
                                {fotos.map((url, idx) => (
                                  <div
                                    key={idx}
                                    className="relative rounded-2xl overflow-hidden border border-white/80 bg-slate-100/70 shadow-sm aspect-[4/3] lg:aspect-auto lg:min-h-[6.5rem]"
                                  >
                                    <img
                                      src={url}
                                      alt={`Foto ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="flex-1 min-h-[9rem] rounded-2xl border-2 border-dashed border-slate-300/80 bg-white/40 flex items-center justify-center text-xs text-slate-400">
                                Sin fotos
                              </div>
                            )}
                          </div>

                          {/* 2. Nombre y Descripción del Equipo (Centro) */}
                          <div className="lg:col-span-5 flex flex-col gap-3.5">
                            <div>
                              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                                Nombre del Equipo <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={item.equipo || ''}
                                onChange={(e) => actualizarCampoLocal(item.id, 'equipo', e.target.value)}
                                disabled={queueProgress.running}
                                placeholder="Marca y modelo · Ej. Torno Paralelo"
                                className={`${glassInput} px-4`}
                              />
                            </div>

                            <div className="flex-1 flex flex-col">
                              <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1.5">
                                Descripción técnica <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                rows={4}
                                value={item.descripcion_manual || ''}
                                onChange={(e) => actualizarCampoLocal(item.id, 'descripcion_manual', e.target.value)}
                                disabled={queueProgress.running}
                                placeholder="Funcionamiento, partes móviles, fuentes de energía..."
                                className={`${glassInput} px-4 resize-none flex-1`}
                              />
                            </div>
                          </div>

                          {/* 3. Lado Derecho del Cuadro: Identificación, Área y Acciones */}
                          <div className="lg:col-span-4 rounded-2xl border border-white/80 bg-white/45 backdrop-blur-md p-4 flex flex-col justify-between gap-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#002060]">
                                  <Icon className="w-4 h-4 text-[#002060]/70" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
                                  Referencia
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">opcional</span>
                              </div>

                              <div className="relative">
                                <label className="sr-only">Identificación</label>
                                <Icon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
                                <input
                                  type="text"
                                  value={item.identificacion || ''}
                                  onChange={(e) => actualizarCampoLocal(item.id, 'identificacion', e.target.value)}
                                  disabled={queueProgress.running}
                                  placeholder="Identificación"
                                  className={`${glassInput} pl-10 pr-3`}
                                />
                              </div>

                              <div className="relative">
                                <label className="sr-only">Área</label>
                                <Icon className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                <input
                                  type="text"
                                  value={item.departamento || ''}
                                  onChange={(e) => actualizarCampoLocal(item.id, 'departamento', e.target.value)}
                                  disabled={queueProgress.running}
                                  placeholder="Área"
                                  className={`${glassInput} pl-10 pr-3`}
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/60">
                              <button
                                type="button"
                                onClick={() => handleGuardarBorrador(item)}
                                disabled={queueProgress.running || savingId === item.id}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-[#002060]/25 bg-white/70 hover:bg-white text-[#002060] font-bold text-xs transition disabled:opacity-50"
                              >
                                <Icon className="w-4 h-4" d="M4.5 12.75l6 6 9-13.5" />
                                {savingId === item.id ? 'Guardando...' : 'Guardar'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleAnalizarUno(item)}
                                disabled={queueProgress.running || savingId === item.id}
                                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-linear-to-r from-[#002060] to-[#1d4ed8] text-white font-bold text-xs shadow-md shadow-[#002060]/20 hover:shadow-lg transition disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none"
                              >
                                <Icon className="w-4 h-4" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                                Analizar IA
                              </button>
                            </div>
                          </div>

                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Separador sutil (como en Analisisdatos.jsx) */}
            <div className="flex items-center gap-4 my-5 px-4" aria-hidden="true">
              <span className="flex-1 h-px bg-linear-to-r from-transparent via-slate-300/70 to-slate-300/70" />
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">NOM-004</span>
              <span className="flex-1 h-px bg-linear-to-l from-transparent via-slate-300/70 to-slate-300/70" />
            </div>

            {/* =====================================================================
                ZONA B · EQUIPOS COMPLETADOS (LISTOS PARA REPORTE WORD · FASE 3)
               ===================================================================== */}
            <div className="rounded-[2rem] border border-emerald-200/60 bg-emerald-100/20 backdrop-blur-sm p-4 md:p-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 px-1">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-emerald-800 bg-emerald-100/80 border border-emerald-200/80 px-3 py-1 rounded-full">
                  <Icon className="w-3.5 h-3.5" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
                  Completados · {completados.length}
                </span>
                <span className="text-xs text-slate-500">Listos para exportar a Word</span>
              </div>

              {completados.length === 0 ? (
                <div className={`${glassCard} p-6 text-center text-sm text-slate-500`}>
                  Aún no hay equipos con análisis completo.
                </div>
              ) : (
                <div className="space-y-4">
                  {completados.map((item) => {
                    const miniatura = Array.isArray(item.imagenes_urls) ? item.imagenes_urls[0] : null;
                    const matriz = Array.isArray(item.matriz) ? item.matriz : [];
                    const riesgos = item.riesgos && typeof item.riesgos === 'object' ? item.riesgos : {};
                    const abierto = expandedId === item.id;

                    return (
                      <article key={item.id} className={`${glassCard} p-5 space-y-4`}>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                          {/* Izquierda/Centro: Foto + Nombre y Descripción */}
                          <div className="lg:col-span-7 flex items-center gap-4 min-w-0">
                            {miniatura && (
                              <img
                                src={miniatura}
                                alt={item.equipo || 'Equipo'}
                                className="w-16 h-16 rounded-2xl object-cover border border-white/80 shadow-sm shrink-0"
                              />
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-base text-[#002060] truncate">
                                  {item.equipo || 'Sin nombre'}
                                </h3>
                                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100/80 text-emerald-800">
                                  Completado
                                </span>
                              </div>
                              {item.descripcion_manual && (
                                <p className="text-xs text-slate-500 line-clamp-1 mt-1">
                                  {item.descripcion_manual}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Lado Derecho: Identificación, Área y Acciones */}
                          <div className="lg:col-span-5 flex flex-wrap items-center justify-between lg:justify-end gap-2">
                            {(item.identificacion || item.departamento) && (
                              <div className="flex flex-wrap items-center gap-1.5 mr-1">
                                {item.identificacion && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white/70 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                                    <Icon className="w-3.5 h-3.5 text-slate-400" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
                                    {item.identificacion}
                                  </span>
                                )}
                                {item.departamento && (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-white/70 border border-slate-200/80 px-2.5 py-1 rounded-xl">
                                    <Icon className="w-3.5 h-3.5 text-slate-400" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                                    {item.departamento}
                                  </span>
                                )}
                              </div>
                            )}

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setExpandedId(abierto ? null : item.id)}
                                className="px-3.5 py-2 rounded-xl border border-slate-200/80 bg-white/70 hover:bg-white text-[#002060] font-bold text-xs transition"
                              >
                                {abierto ? 'Ocultar matriz' : `Matriz (${matriz.length})`}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleReabrirComoBorrador(item)}
                                disabled={queueProgress.running || savingId === item.id}
                                className="px-3 py-2 rounded-xl border border-amber-200/80 bg-amber-50/70 hover:bg-amber-100/80 text-amber-800 font-bold text-xs transition disabled:opacity-50"
                              >
                                Editar
                              </button>

                              <button
                                type="button"
                                onClick={() => handleEliminar(item.id)}
                                disabled={queueProgress.running}
                                title="Eliminar equipo"
                                aria-label="Eliminar equipo"
                                className="p-2 rounded-xl border border-red-200/70 bg-red-50/60 hover:bg-red-100/80 text-red-600 transition disabled:opacity-50"
                              >
                                <Icon className="w-4 h-4" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Vista desplegable de Riesgos y Matriz NOM-004 */}
                        {abierto && (
                          <div className="pt-4 border-t border-slate-200/60 space-y-5">
                            <div>
                              <p className="text-xs font-extrabold uppercase text-[#002060] mb-2">
                                Riesgos por Tipo Evaluados
                              </p>
                              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70">
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="bg-slate-100/80 text-slate-800 font-bold">
                                      <th className="p-2.5">Riesgo Potencial</th>
                                      <th className="p-2.5 w-24 text-center">Estado</th>
                                      <th className="p-2.5">Observaciones / Medidas de Control</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/70">
                                    {CATALOGO_RIESGOS.map(({ code, label }) => {
                                      const r = riesgos[code] || {};
                                      const presente = Boolean(r.presente);
                                      return (
                                        <tr key={code}>
                                          <td className="p-2.5 font-semibold text-slate-800">{label}</td>
                                          <td className="p-2.5 text-center">
                                            <span className={`px-2 py-0.5 rounded-full font-bold ${
                                              presente ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                              {presente ? 'Presente' : 'Ausente'}
                                            </span>
                                          </td>
                                          <td className="p-2.5 text-slate-600">
                                            {r.observacion || (presente ? '-' : 'No aplica')}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>

                            <div>
                              <p className="text-xs font-extrabold uppercase text-[#002060] mb-2">
                                Matriz de Valoración NOM-004
                              </p>
                              <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/70">
                                <table className="w-full text-xs border-collapse text-center">
                                  <thead>
                                    <tr className="bg-[#002060] text-white">
                                      <th className="p-2.5">Riesgo</th>
                                      <th className="p-2.5">Tipo de Daño</th>
                                      <th className="p-2.5">Gravedad</th>
                                      <th className="p-2.5">Probabilidad</th>
                                      <th className="p-2.5">Valor</th>
                                      <th className="p-2.5">Nivel</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-200/70">
                                    {matriz.length > 0 ? (
                                      matriz.map((row, idx) => (
                                        <tr key={idx}>
                                          <td className="p-2.5 font-bold uppercase">{row.riesgo}</td>
                                          <td className="p-2.5 text-left">{row.tipo_daño || row.tipo_danio}</td>
                                          <td className="p-2.5 font-bold">{row.gravedad}</td>
                                          <td className="p-2.5 font-bold">{row.probabilidad}</td>
                                          <td className="p-2.5 font-extrabold">{row.valor}</td>
                                          <td className={`p-2.5 ${getNivelBadgeClass(row.valor)}`}>
                                            {row.nivel}
                                          </td>
                                        </tr>
                                      ))
                                    ) : (
                                      <tr>
                                        <td colSpan="6" className="p-3 text-slate-400 italic">
                                          Sin riesgos presentes registrados en la matriz.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* Pie de navegación idéntico a Analisisdatos.jsx */}
        <footer className="mt-8 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <Link
            to="/analisis-datos"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/70 bg-white/50 backdrop-blur text-slate-700 font-bold transition hover:bg-white/90"
          >
            <Icon className="w-5 h-5" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            Registrar equipo
          </Link>

          <div className="flex flex-col md:flex-row gap-3">
            {borradores.length > 0 && (
              <button
                type="button"
                onClick={handleAnalizarTodos}
                disabled={queueProgress.running || isGenerating}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#002060] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:bg-[#001040] hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Icon className="w-5 h-5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                Analizar todos ({borradores.length})
              </button>
            )}

            {completados.length > 0 && (
              <button
                type="button"
                onClick={handleGenerarDocumento}
                disabled={isGenerating || queueProgress.running}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold shadow-lg shadow-emerald-900/20 transition hover:bg-emerald-700 hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Icon className="w-5 h-5" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m.75 12l3 3m0 0l3-3m-3 3v-6m-1.5-9H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                Exportar Word ({completados.length})
              </button>
            )}
          </div>
        </footer>

      </div>
    </div>
  );
}

// Ícono de trazo (estilo Heroicons outline)
function Icon({ d, className = 'w-5 h-5', strokeWidth = 1.75 }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  );
}
