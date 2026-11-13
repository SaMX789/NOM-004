import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService, EQUIPO_STATUS } from '../services/dbService';
import { analizarEquipoProfundo, generarDocumentoWord } from '../services/n8nService';
import { useAuth } from '../context/AuthContext';

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

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
  const navigate = useNavigate();

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

  const [isLoading, setIsLoading] = useState(true);
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

  // Carga inicial desde Supabase Database
  useEffect(() => {
    if (!userId) return;
    let cancelado = false;

    dbService.obtenerTodos(userId)
      .then((lista) => { if (!cancelado) setEquipos(lista); })
      .catch((error) => { if (!cancelado) showToast(error.message, 'error'); })
      .finally(() => { if (!cancelado) setIsLoading(false); });

    return () => { cancelado = true; };
  }, [userId, showToast]);

  const borradores = equipos.filter(eq => eq.status !== EQUIPO_STATUS.COMPLETADO);
  const completados = equipos.filter(eq => eq.status === EQUIPO_STATUS.COMPLETADO);

  // --- EDICIÓN EN LÍNEA DE BORRADORES (FASE 2) ---
  const actualizarCampoLocal = (id, campo, valor) => {
    if (campo === 'horas' && valor !== '') {
      const num = parseFloat(valor);
      if (num > 24) {
        showToast('Las horas al día no pueden ser mayores a 24', 'warning');
        valor = 24;
      } else if (num < 0) {
        valor = 0;
      }
    }
    if (campo === 'operadores' && valor !== '') {
      const num = parseInt(valor, 10);
      if (num < 0) valor = 0;
    }

    setEquipos(prev => prev.map(eq => (eq.id === id ? { ...eq, [campo]: valor } : eq)));
    setDirtyIds(prev => ({ ...prev, [id]: true }));
  };

  const toggleDiaLocal = (id, dia) => {
    setEquipos(prev => prev.map(eq => {
      if (eq.id !== id) return eq;
      const diasActuales = Array.isArray(eq.dias) ? eq.dias : [];
      const existe = diasActuales.includes(dia);
      const nuevosDias = existe
        ? diasActuales.filter(d => d !== dia)
        : [...diasActuales, dia];
      return { ...eq, dias: nuevosDias };
    }));
    setDirtyIds(prev => ({ ...prev, [id]: true }));
  };

  const handleGuardarBorrador = async (equipo) => {
    setSavingId(equipo.id);
    try {
      const actualizado = await dbService.guardarBorrador(userId, equipo);
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

  // Permite reabrir un equipo completado como borrador si el usuario desea corregir exposición y re-analizar
  const handleReabrirComoBorrador = async (equipo) => {
    setSavingId(equipo.id);
    try {
      const actualizado = await dbService.guardarBorrador(userId, equipo);
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
      await dbService.eliminarEquipo(userId, id);
      setEquipos(prev => prev.filter(eq => eq.id !== id));
      showToast('Equipo eliminado', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  const handleCambiarFotos = (equipo) => {
    navigate('/analisis-datos', { state: { equipoEditar: equipo } });
  };

  // --- LÓGICA UNITARIA DE ANÁLISIS PROFUNDO (WEBHOOK 2 · SOLO TEXTO) ---
  const procesarUnEquipoProfundo = async (equipoActual) => {
    const nombre = (equipoActual.equipo || '').trim();
    const descripcion = (equipoActual.descripcion_manual || '').trim();

    if (!nombre || !descripcion) {
      throw new Error('Falta capturar el Nombre del Equipo o la Descripción técnica.');
    }

    // 1. Si tenía cambios locales en los inputs, primero los persistimos en Supabase
    let equipoSincronizado = equipoActual;
    if (dirtyIds[equipoActual.id]) {
      equipoSincronizado = await dbService.guardarBorrador(userId, equipoActual);
      setDirtyIds(prev => {
        const copia = { ...prev };
        delete copia[equipoActual.id];
        return copia;
      });
    }

    // 2. Enviar ÚNICAMENTE TEXTO al Webhook 2 (sin imágenes)
    const payloadTexto = {
      user_id: userId,
      equipo_id: equipoSincronizado.id,
      equipo: nombre,
      identificacion: equipoSincronizado.identificacion || '',
      departamento: equipoSincronizado.departamento || '',
      descripcion,
      operadores:
        equipoSincronizado.operadores === '' || equipoSincronizado.operadores === null
          ? null
          : Number(equipoSincronizado.operadores),
      dias: Array.isArray(equipoSincronizado.dias) ? equipoSincronizado.dias : [],
      horas:
        equipoSincronizado.horas === '' || equipoSincronizado.horas === null
          ? null
          : Number(equipoSincronizado.horas)
    };

    const { riesgos, matriz } = await analizarEquipoProfundo(payloadTexto);

    // 3. Checkpoint inmediato en Supabase: cambia status a 'completado' y guarda riesgos + matriz
    const completadoEnDb = await dbService.marcarCompletado(userId, equipoSincronizado.id, {
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

    // Validar cuáles están listos (tienen nombre y descripción) y cuáles no
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

    // Marcar los equipos listos como 'en cola'
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

        // Si fue caída de internet o del servidor (Failed to fetch / SSL), detenemos la cola
        // para no disparar fallos en cascada. Los equipos previos ya quedaron en 'completado'
        // en Supabase, por lo que al reconectar se reanudará desde este equipo.
        if (error?.isNetworkError) {
          detenidoPorRed = true;
          break;
        }
      }
    }

    setQueueProgress({ running: false, current: 0, total: 0, currentName: '' });

    if (detenidoPorRed) {
      showToast(
        `Se completaron ${exitosos} de ${listos.length} equipo(s). La cola se pausó por fallo de conexión con n8n; presiona "Analizar Todos" para reanudar donde se quedó.`,
        'warning'
      );
    } else if (cancelQueueRef.current) {
      showToast(`Cola pausada por el usuario (${exitosos} completado(s)).`, 'warning');
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

  return (
    <div className="p-6 max-w-6xl mx-auto font-body text-slate-800 space-y-10">

      {/* Toast de notificaciones */}
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl text-white font-bold transition-all flex items-center gap-3 ${toastBgClass}`}>
          {toast.type === 'error' || toast.type === 'warning' ? (
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current shrink-0" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modal de Generación de Word */}
      {isGenerating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-title text-xl font-bold text-[#002060] mb-2">Generando Documento Word...</p>
            <p className="text-sm text-slate-500">Consolidando tablas y análisis de riesgo...</p>
          </div>
        </div>
      )}

      {/* Encabezado Principal y Botones Maestros */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-200 pb-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-[#003087] mb-1">
            Fase 2 y 3 · Revisión Humana, Análisis en Lote y Reporte
          </p>
          <h1 className="text-3xl font-black text-[#002060] uppercase">
            Mis Equipos ({equipos.length})
          </h1>
          <p className="text-slate-600 text-sm mt-1">
            <span className="font-bold text-amber-700">{borradores.length} en borrador</span>
            {' · '}
            <span className="font-bold text-emerald-700">{completados.length} completado(s)</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-3 w-full lg:w-auto">
          <Link
            to="/analisis-datos"
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Agregar Equipo
          </Link>

          {borradores.length > 0 && (
            <button
              type="button"
              onClick={handleAnalizarTodos}
              disabled={queueProgress.running || isGenerating}
              className="bg-[#002060] hover:bg-[#003087] disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-bold shadow-md transition flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
              </svg>
              {queueProgress.running
                ? `Analizando (${queueProgress.current}/${queueProgress.total})...`
                : `Analizar Todos (${borradores.length})`}
            </button>
          )}

          {completados.length > 0 && (
            <button
              type="button"
              onClick={handleGenerarDocumento}
              disabled={isGenerating || queueProgress.running}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Generar Reporte Word ({completados.length})
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso de la Cola Secuencial (Queue 1 a 1) */}
      {queueProgress.running && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin shrink-0"></div>
            <div className="w-full">
              <div className="flex justify-between text-xs font-bold text-[#002060] uppercase mb-1">
                <span>Procesando cola secuencial (solo texto · Webhook 2)</span>
                <span>{queueProgress.current} de {queueProgress.total}</span>
              </div>
              <p className="text-sm font-semibold text-slate-700 truncate mb-2">
                Analizando: {queueProgress.currentName}
              </p>
              <div className="w-full bg-blue-100 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#002060] h-full transition-all duration-300"
                  style={{ width: `${Math.round((queueProgress.current / queueProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePausarCola}
            className="shrink-0 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs px-4 py-2 rounded-lg transition"
          >
            Pausar al terminar actual
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin"></div>
        </div>
      ) : equipos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
          <svg className="w-12 h-12 text-slate-400 fill-current mx-auto mb-3" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <p className="font-bold text-slate-700 mb-1">Aún no tienes equipos registrados.</p>
          <p className="text-sm">Sube las fotografías de un equipo en la Fase 1 para guardarlo aquí como borrador.</p>
        </div>
      ) : (
        <div className="space-y-12">

          {/* =====================================================================
              SECCIÓN 1: EQUIPOS EN BORRADOR (TARJETAS EDITABLES · FASE 2)
             ===================================================================== */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-title text-xl font-black text-[#002060] uppercase">
                1. Equipos en Borrador · Revisión y Condiciones de Operación ({borradores.length})
              </h2>
            </div>

            {borradores.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                No tienes borradores pendientes. Todos tus equipos registrados ya fueron analizados.
              </div>
            ) : (
              <div className="grid gap-6">
                {borradores.map((item) => {
                  const fotos = Array.isArray(item.imagenes_urls) ? item.imagenes_urls : [];
                  const diasSeleccionados = Array.isArray(item.dias) ? item.dias : [];
                  const estadoCola = itemStatus[item.id];
                  const estaAnalizandoEste = estadoCola?.state === 'analyzing';
                  const tieneCambios = Boolean(dirtyIds[item.id]);

                  return (
                    <div
                      key={item.id}
                      className={`border-2 rounded-2xl p-6 bg-white shadow-sm transition space-y-6 ${
                        estaAnalizandoEste
                          ? 'border-blue-500 ring-2 ring-blue-100'
                          : estadoCola?.state === 'error'
                            ? 'border-red-300'
                            : 'border-slate-200'
                      }`}
                    >
                      {/* Cabecera de la tarjeta */}
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-amber-100 text-amber-800">
                            Borrador
                          </span>
                          {tieneCambios && (
                            <span className="text-xs px-2.5 py-1 rounded-md font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Cambios sin guardar
                            </span>
                          )}
                          {estadoCola?.state === 'queued' && (
                            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-slate-100 text-slate-600">
                              En cola...
                            </span>
                          )}
                          {estaAnalizandoEste && (
                            <span className="text-xs px-2.5 py-1 rounded-md font-bold bg-blue-600 text-white flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                              Analizando con IA...
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleCambiarFotos(item)}
                            disabled={queueProgress.running}
                            className="text-xs font-bold text-slate-600 hover:text-[#002060] border border-slate-300 px-3 py-1.5 rounded-lg transition"
                          >
                            Cambiar fotos
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminar(item.id)}
                            disabled={queueProgress.running}
                            className="text-xs font-bold text-red-600 hover:bg-red-50 border border-red-200 px-3 py-1.5 rounded-lg transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Aviso de error individual si falló en la cola */}
                      {estadoCola?.state === 'error' && estadoCola.error && (
                        <div className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-lg text-xs text-red-700 font-semibold">
                          {estadoCola.error}
                        </div>
                      )}

                      {/* Cuerpo editable: Fotos + Identificación y Descripción */}
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* Miniaturas de referencia */}
                        <div className="lg:col-span-3 flex lg:flex-col gap-3">
                          {fotos.length > 0 ? (
                            fotos.map((url, idx) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Foto ${idx + 1}`}
                                className="w-28 h-28 lg:w-full lg:h-32 object-cover rounded-xl border border-slate-200 bg-slate-100"
                              />
                            ))
                          ) : (
                            <div className="w-full h-32 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                              Sin fotos
                            </div>
                          )}
                        </div>

                        {/* Campos editables de Nombre, Tag, Departamento y Descripción */}
                        <div className="lg:col-span-9 space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="md:col-span-1">
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Nombre del Equipo <span className="text-red-500">*</span>
                              </label>
                              <input
                                type="text"
                                value={item.equipo || ''}
                                onChange={(e) => actualizarCampoLocal(item.id, 'equipo', e.target.value)}
                                disabled={queueProgress.running}
                                placeholder="Marca / Modelo / Tipo"
                                className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Identificación / Tag
                              </label>
                              <input
                                type="text"
                                value={item.identificacion || ''}
                                onChange={(e) => actualizarCampoLocal(item.id, 'identificacion', e.target.value)}
                                disabled={queueProgress.running}
                                placeholder="No. de inventario"
                                className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-700 mb-1">
                                Departamento / Área
                              </label>
                              <input
                                type="text"
                                value={item.departamento || ''}
                                onChange={(e) => actualizarCampoLocal(item.id, 'departamento', e.target.value)}
                                disabled={queueProgress.running}
                                placeholder="Ubicación física"
                                className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">
                              Descripción técnica del equipo <span className="text-red-500">*</span>
                            </label>
                            <textarea
                              rows={3}
                              value={item.descripcion_manual || ''}
                              onChange={(e) => actualizarCampoLocal(item.id, 'descripcion_manual', e.target.value)}
                              disabled={queueProgress.running}
                              placeholder="Descripción técnica que se enviará en texto al análisis de riesgos NOM-004..."
                              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
                            />
                          </div>

                          {/* Condiciones de Operación (Sin checkboxes de turnos) */}
                          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <p className="text-xs font-extrabold uppercase text-[#002060] mb-3">
                              Condiciones de Operación (Exposición)
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                              <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  No. Operadores
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  value={item.operadores ?? ''}
                                  onChange={(e) => actualizarCampoLocal(item.id, 'operadores', e.target.value)}
                                  disabled={queueProgress.running}
                                  placeholder="Ej. 2"
                                  className="w-full p-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#002060] outline-none"
                                />
                              </div>

                              <div className="md:col-span-6">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Días de operación
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                  {DIAS_SEMANA.map((dia) => {
                                    const activo = diasSeleccionados.includes(dia);
                                    return (
                                      <button
                                        key={dia}
                                        type="button"
                                        disabled={queueProgress.running}
                                        onClick={() => toggleDiaLocal(item.id, dia)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition ${
                                          activo
                                            ? 'bg-[#002060] text-white border-[#002060]'
                                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                                        }`}
                                      >
                                        {dia}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="md:col-span-3">
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                  Horas al día (Máx 24)
                                </label>
                                <input
                                  type="number"
                                  min="0"
                                  max="24"
                                  step="0.5"
                                  value={item.horas ?? ''}
                                  onChange={(e) => actualizarCampoLocal(item.id, 'horas', e.target.value)}
                                  disabled={queueProgress.running}
                                  placeholder="Ej. 8"
                                  className="w-full p-2 text-sm border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-[#002060] outline-none"
                                />
                              </div>
                            </div>
                          </div>

                          {/* Acciones de la tarjeta */}
                          <div className="flex flex-wrap justify-end gap-3 pt-2">
                            <button
                              type="button"
                              onClick={() => handleGuardarBorrador(item)}
                              disabled={queueProgress.running || savingId === item.id}
                              className="bg-white border-2 border-[#002060] text-[#002060] hover:bg-slate-50 disabled:opacity-50 font-bold text-xs px-4 py-2 rounded-xl transition"
                            >
                              {savingId === item.id ? 'Guardando...' : 'Guardar cambios'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAnalizarUno(item)}
                              disabled={queueProgress.running || savingId === item.id}
                              className="bg-[#003087] hover:bg-[#002060] disabled:bg-slate-300 text-white font-bold text-xs px-5 py-2 rounded-xl shadow-sm transition flex items-center gap-1.5"
                            >
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                              </svg>
                              Analizar este equipo
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* =====================================================================
              SECCIÓN 2: EQUIPOS COMPLETADOS (LISTOS PARA REPORTE WORD · FASE 3)
             ===================================================================== */}
          <section className="space-y-4">
            <h2 className="font-title text-xl font-black text-[#002060] uppercase">
              2. Equipos Completados · Listos para Reporte Word ({completados.length})
            </h2>

            {completados.length === 0 ? (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-sm text-slate-500">
                Aún no hay equipos con análisis profundo completado. Presiona <strong>Analizar Todos</strong> arriba cuando termines de revisar tus borradores.
              </div>
            ) : (
              <div className="grid gap-4">
                {completados.map((item) => {
                  const miniatura = Array.isArray(item.imagenes_urls) ? item.imagenes_urls[0] : null;
                  const matriz = Array.isArray(item.matriz) ? item.matriz : [];
                  const riesgos = item.riesgos && typeof item.riesgos === 'object' ? item.riesgos : {};
                  const abierto = expandedId === item.id;

                  return (
                    <div
                      key={item.id}
                      className="border border-emerald-200 rounded-2xl p-5 bg-white shadow-sm space-y-4"
                    >
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-start gap-4 min-w-0">
                          {miniatura && (
                            <img
                              src={miniatura}
                              alt={item.equipo || 'Equipo'}
                              className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                            />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-bold text-lg text-[#002060] truncate">
                                {item.equipo || 'Sin Nombre'}
                              </h3>
                              <span className="text-xs px-2.5 py-0.5 rounded-md font-bold bg-emerald-100 text-emerald-800">
                                Completado
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 mt-0.5">
                              Dpto: <span className="font-semibold text-slate-800">{item.departamento || 'N/A'}</span>
                              {' | '}
                              Tag: <span className="font-semibold text-slate-800">{item.identificacion || 'N/A'}</span>
                              {' | '}
                              Operadores: <span className="font-semibold text-slate-800">{item.operadores ?? 'N/A'}</span>
                              {' | '}
                              Días: <span className="font-semibold text-slate-800">{(item.dias || []).join(', ') || 'N/A'}</span>
                              {' | '}
                              Horas/día: <span className="font-semibold text-slate-800">{item.horas ?? 'N/A'}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 w-full md:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedId(abierto ? null : item.id)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-3.5 py-2 rounded-lg font-bold text-xs transition"
                          >
                            {abierto ? 'Ocultar Matriz NOM-004' : `Ver Matriz NOM-004 (${matriz.length})`}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleReabrirComoBorrador(item)}
                            disabled={queueProgress.running || savingId === item.id}
                            className="bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 px-3.5 py-2 rounded-lg font-bold text-xs transition"
                          >
                            Editar en Borrador
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEliminar(item.id)}
                            disabled={queueProgress.running}
                            className="bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-3.5 py-2 rounded-lg font-bold text-xs transition"
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>

                      {/* Vista desplegable de Riesgos y Matriz NOM-004 */}
                      {abierto && (
                        <div className="pt-4 border-t border-slate-100 space-y-6">
                          <div>
                            <p className="text-xs font-extrabold uppercase text-[#002060] mb-2">
                              Riesgos por Tipo Evaluados
                            </p>
                            <div className="overflow-x-auto rounded-lg border border-slate-200">
                              <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                  <tr className="bg-slate-100 text-slate-800 font-bold">
                                    <th className="p-2.5">Riesgo Potencial</th>
                                    <th className="p-2.5 w-24 text-center">Estado</th>
                                    <th className="p-2.5">Observaciones / Medidas de Control</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                  {CATALOGO_RIESGOS.map(({ code, label }) => {
                                    const r = riesgos[code] || {};
                                    const presente = Boolean(r.presente);
                                    return (
                                      <tr key={code}>
                                        <td className="p-2.5 font-semibold text-slate-800">{label}</td>
                                        <td className="p-2.5 text-center">
                                          <span className={`px-2 py-0.5 rounded font-bold ${
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
                            <div className="overflow-x-auto rounded-lg border border-slate-300">
                              <table className="w-full text-xs border-collapse text-center">
                                <thead>
                                  <tr className="bg-[#002060] text-white">
                                    <th className="p-2 border border-slate-300">Riesgo</th>
                                    <th className="p-2 border border-slate-300">Tipo de Daño</th>
                                    <th className="p-2 border border-slate-300">Gravedad</th>
                                    <th className="p-2 border border-slate-300">Probabilidad</th>
                                    <th className="p-2 border border-slate-300">Valor</th>
                                    <th className="p-2 border border-slate-300">Nivel</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {matriz.length > 0 ? (
                                    matriz.map((row, idx) => (
                                      <tr key={idx} className="border-t border-slate-200">
                                        <td className="p-2 border border-slate-200 font-bold uppercase">{row.riesgo}</td>
                                        <td className="p-2 border border-slate-200 text-left">{row.tipo_daño || row.tipo_danio}</td>
                                        <td className="p-2 border border-slate-200 font-bold">{row.gravedad}</td>
                                        <td className="p-2 border border-slate-200 font-bold">{row.probabilidad}</td>
                                        <td className="p-2 border border-slate-200 font-extrabold">{row.valor}</td>
                                        <td className={`p-2 border border-slate-200 ${getNivelBadgeClass(row.valor)}`}>
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
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      )}
    </div>
  );
}
