import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { comprimirImagen } from '../utils/imageCompressor';
import {
  FASES,
  guardarBorrador,
  obtenerProyectoActivo,
  registrarConIA
} from '../services/equiposService';
import { useAuth } from '../context/AuthContext';

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 2;

const ENLACE_DRIVE_REGEX = /^https:\/\/(drive|docs)\.google\.com\/(drive\/(u\/\d+\/)?folders\/|folders\/|file\/d\/|open\?id=)[\w-]+/i;

const TOAST_OCULTO = { show: false, message: '', type: 'success' };

const TEXTO_FASE = {
  [FASES.SUBIENDO]: 'Subiendo imágenes...',
  [FASES.ANALIZANDO]: 'Analizando con IA...',
  [FASES.GUARDANDO]: 'Guardando equipo...'
};

const liberarPreview = (img) => {
  if (img?.preview?.startsWith('blob:')) URL.revokeObjectURL(img.preview);
};

export default function Analisisdatos() {
  const { userId } = useAuth();

  // Estudio activo: de aquí sale el fk_evaluacion con el que se guardan los equipos
  const [proyecto] = useState(() => obtenerProyectoActivo());

  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [identificacion, setIdentificacion] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [imagenesCargadas, setImagenesCargadas] = useState([]);
  const [driveLink, setDriveLink] = useState('');

  const [fase, setFase] = useState(null); // null | 'subiendo' | 'analizando' | 'guardando'
  const [errorRegistro, setErrorRegistro] = useState(null);
  const [ultimoRegistro, setUltimoRegistro] = useState(null); // { nombre, modo } tras un registro exitoso
  const [toast, setToast] = useState(TOAST_OCULTO);

  const isBusy = fase !== null;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Oculta el toast 4.5 s después de mostrarse (se reinicia si llega otro mensaje)
  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast(TOAST_OCULTO), 4500);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleNombreChange = (e) => {
    setNombre(e.target.value);
    setUltimoRegistro(null);
  };

  const handleDescripcionChange = (e) => {
    setDescripcion(e.target.value);
    setUltimoRegistro(null);
  };

  const handleImagenesChange = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length === 0) return;

    const espacioDisponible = MAX_IMAGENES - imagenesCargadas.length;
    if (espacioDisponible <= 0) {
      showToast(`Ya alcanzaste el límite máximo de ${MAX_IMAGENES} imágenes por equipo.`, 'error');
      return;
    }

    // Validación flexible de formatos
    let imagenesValidas = files.filter(file => {
      const type = file.type ? file.type.toLowerCase() : '';
      const name = file.name ? file.name.toLowerCase() : '';
      return type.startsWith('image/jpeg') ||
             type.startsWith('image/png') ||
             type.startsWith('image/jpg') ||
             /\.(jpg|jpeg|png)$/i.test(name);
    });

    if (imagenesValidas.length < files.length) {
      showToast('Algunos archivos se ignoraron. Solo se permiten formatos JPG, JPEG o PNG.', 'error');
    }
    if (imagenesValidas.length === 0) return;

    if (imagenesValidas.length > espacioDisponible) {
      showToast(`Solo se procesarán las primeras ${espacioDisponible} foto(s) para no exceder el máximo de ${MAX_IMAGENES}.`, 'error');
      imagenesValidas = imagenesValidas.slice(0, espacioDisponible);
    }

    const nuevasImagenes = [];
    for (const file of imagenesValidas) {
      try {
        const compressedFile = await comprimirImagen(file);
        nuevasImagenes.push({
          id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
          name: compressedFile.name || file.name,
          file: compressedFile,
          preview: URL.createObjectURL(compressedFile)
        });
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        showToast(`Error al procesar "${file.name}"`, 'error');
      }
    }

    setImagenesCargadas(prev => [...prev, ...nuevasImagenes]);
    if (nuevasImagenes.length > 0) {
      setUltimoRegistro(null);
      showToast(`${nuevasImagenes.length} imagen(es) comprimida(s) (≤ 500 KB)`, 'success');
    }
  };

  const removeImagen = (id) => {
    setImagenesCargadas(prev => {
      liberarPreview(prev.find(img => img.id === id));
      return prev.filter(img => img.id !== id);
    });
  };

  const handleLimpiarFormulario = () => {
    imagenesCargadas.forEach(liberarPreview);
    setNombre('');
    setDescripcion('');
    setIdentificacion('');
    setDepartamento('');
    setImagenesCargadas([]);
    setErrorRegistro(null);
    setUltimoRegistro(null);
    showToast('Formulario listo para un nuevo equipo', 'success');
  };

  // Validaciones de cada flujo
  const hayFotos = imagenesCargadas.length >= MIN_IMAGENES;
  const tieneNombre = nombre.trim().length > 0;
  const tieneDescripcion = descripcion.trim().length > 0;

  const puedeAnalizarConIA = Boolean(proyecto) && hayFotos && !isBusy;
  const puedeGuardarBorrador = puedeAnalizarConIA && tieneNombre && tieneDescripcion;

  const faltantesBorrador = [
    !hayFotos && 'fotos',
    !tieneNombre && 'nombre',
    !tieneDescripcion && 'descripción'
  ].filter(Boolean);

  // Ejecuta un flujo de registro (con IA o manual) con manejo común de fases, errores y reinicio
  const ejecutarRegistro = async (flujo, modo) => {
    setErrorRegistro(null);
    setFase(FASES.SUBIENDO);

    try {
      const resultado = await flujo({
        archivos: imagenesCargadas.map(img => img.file),
        userId,
        fkEvaluacion: proyecto.evaluacion_id,
        nombre,
        descripcion,
        identificacion,
        departamento,
        onFase: setFase
      });

      // Éxito: reinicia el formulario (Mis Equipos lee de Supabase cada vez que se abre)
      imagenesCargadas.forEach(liberarPreview);
      setImagenesCargadas([]);
      setNombre('');
      setDescripcion('');
      setIdentificacion('');
      setDepartamento('');
      setUltimoRegistro({ nombre: resultado.nombre, modo });
      showToast(
        modo === 'ia'
          ? 'Equipo analizado con IA y registrado.'
          : 'Borrador guardado correctamente.',
        'success'
      );
    } catch (error) {
      // Error: el servicio ya borró del bucket los archivos de esta operación.
      // Se conserva lo escrito y las fotos seleccionadas para reintentar.
      console.error('Error en el registro del equipo:', error);
      setErrorRegistro(error.message || 'Ocurrió un error inesperado.');
      showToast(error.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
      setFase(null);
    }
  };

  const handleAnalizarConIA = () => {
    if (!puedeAnalizarConIA) return;
    ejecutarRegistro(registrarConIA, 'ia');
  };

  const handleGuardarBorrador = () => {
    if (!puedeGuardarBorrador) return;
    ejecutarRegistro(guardarBorrador, 'manual');
  };

  // Importación masiva desde Drive: por ahora solo valida el enlace (la lógica de importación aún no está conectada)
  const handleImportarDrive = (e) => {
    e.preventDefault();
    if (!ENLACE_DRIVE_REGEX.test(driveLink.trim())) {
      showToast('El enlace no parece ser de Google Drive.', 'error');
      return;
    }
    showToast('Enlace válido. La importación desde Drive estará disponible pronto.', 'info');
  };

  const toastBgClass =
    toast.type === 'error'
      ? 'bg-red-600'
      : toast.type === 'warning'
        ? 'bg-amber-600'
        : toast.type === 'info'
          ? 'bg-[#002060]'
          : 'bg-emerald-600';

  // Estilos "glass" reutilizables
  const glassCard =
    'rounded-3xl border border-white/60 bg-white/55 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,32,96,0.08)]';
  const glassInput =
    'w-full rounded-xl border border-slate-200/80 bg-white/60 py-3 text-sm text-slate-800 placeholder:text-slate-400 backdrop-blur transition outline-none focus:bg-white/90 focus:border-[#002060]/40 focus:ring-2 focus:ring-[#002060]/20 disabled:opacity-60';

  const pasos = [
    { label: 'Fotos', hecho: hayFotos },
    { label: 'Datos', hecho: tieneNombre && tieneDescripcion },
    { label: 'Guardado', hecho: Boolean(ultimoRegistro) }
  ];

  const ranurasVacias = Math.max(0, MAX_IMAGENES - imagenesCargadas.length);
  const etiquetasRanura = ['Vista general', 'Detalle'];

  return (
    <div className="relative isolate overflow-hidden font-body text-slate-800">

      {/* Fondo decorativo para que las superficies translúcidas tengan algo que difuminar */}
      <div aria-hidden="true" className="absolute inset-0 -z-10 bg-linear-to-br from-slate-50 via-blue-50/70 to-indigo-100/60" />
      <div aria-hidden="true" className="absolute -top-24 -left-24 -z-10 w-96 h-96 rounded-full bg-[#002060]/15 blur-3xl" />
      <div aria-hidden="true" className="absolute top-1/3 -right-28 -z-10 w-[28rem] h-[28rem] rounded-full bg-sky-400/25 blur-3xl" />
      <div aria-hidden="true" className="absolute bottom-0 left-1/4 -z-10 w-96 h-96 rounded-full bg-indigo-400/20 blur-3xl" />

      <div className="max-w-5xl mx-auto px-4 py-10">

        {toast.show && (
          <div className={`fixed top-5 right-5 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl text-white font-bold transition-all flex items-center gap-3 ${toastBgClass}`}>
            <Icon
              className="w-5 h-5 shrink-0"
              d={toast.type === 'success' ? 'M4.5 12.75l6 6 9-13.5' : toast.type === 'info' ? 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z' : 'M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z'}
            />
            <span>{toast.message}</span>
          </div>
        )}

        {isBusy && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-md z-50 flex items-center justify-center">
            <div className="bg-white/80 backdrop-blur-xl p-8 rounded-3xl shadow-2xl text-center max-w-xs border border-white/60">
              <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
              <p className="font-title text-xl font-bold text-[#002060]">{TEXTO_FASE[fase]}</p>
            </div>
          </div>
        )}

        {/* Encabezado + progreso */}
        <header className="relative overflow-hidden rounded-3xl bg-[#002060]/90 backdrop-blur-xl text-white px-6 py-8 md:px-10 shadow-lg mb-8">
          <div aria-hidden="true" className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <p className="text-blue-200 text-[11px] font-bold uppercase tracking-widest mb-1">Fase 1 · Pre-análisis</p>
              <h1 className="font-title text-3xl md:text-4xl font-black uppercase tracking-wide">Registro de Equipo</h1>
              <p className="text-blue-100/80 text-sm mt-1">
                {proyecto ? (
                  <>
                    Estudio: <span className="font-semibold text-white">{proyecto.titulo_proyecto}</span>
                    {proyecto.razon_social ? ` · ${proyecto.razon_social}` : ''}
                  </>
                ) : (
                  'Sube las fotos y la IA identifica el equipo.'
                )}
              </p>
            </div>

            <ol className="flex items-center gap-2 self-start md:self-auto">
              {pasos.map((paso, i) => (
                <li key={paso.label} className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full text-xs font-bold border backdrop-blur transition ${
                      paso.hecho
                        ? 'bg-emerald-400/20 border-emerald-300/40 text-emerald-100'
                        : 'bg-white/10 border-white/20 text-blue-100/80'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${paso.hecho ? 'bg-emerald-400 text-[#002060]' : 'bg-white/20'}`}>
                      {paso.hecho ? <Icon className="w-3 h-3" strokeWidth={3} d="M4.5 12.75l6 6 9-13.5" /> : i + 1}
                    </span>
                    {paso.label}
                  </span>
                  {i < pasos.length - 1 && <span className="w-4 h-px bg-white/30 hidden sm:block" />}
                </li>
              ))}
            </ol>
          </div>
        </header>

        {/* Sin estudio activo: no hay fk_evaluacion con el cual guardar */}
        {!proyecto && (
          <section className={`${glassCard} p-8 text-center mb-6`}>
            <p className="font-title text-xl font-black text-[#002060] uppercase mb-1">No hay un estudio activo</p>
            <p className="text-sm text-slate-600 mb-5">Entra a un estudio desde Datos Empresariales para registrar equipos.</p>
            <Link
              to="/formulario"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#002060] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:bg-[#001040]"
            >
              Ir a Datos Empresariales
            </Link>
          </section>
        )}

        {/* Resultado del último registro */}
        {ultimoRegistro && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 px-5 py-4 rounded-2xl bg-emerald-100/60 backdrop-blur border border-emerald-300/50 text-emerald-900">
            <div className="flex items-center gap-3 min-w-0">
              <Icon className="w-5 h-5 text-emerald-600 shrink-0" strokeWidth={2.5} d="M4.5 12.75l6 6 9-13.5" />
              <p className="text-sm font-medium truncate">
                {ultimoRegistro.modo === 'ia' ? 'Registrado con IA' : 'Borrador guardado'}:{' '}
                <span className="font-bold">{ultimoRegistro.nombre}</span>
              </p>
            </div>
            <Link to="/mis-equipos" className="text-sm font-bold text-emerald-800 underline hover:text-emerald-950 whitespace-nowrap">
              Ver en Mis equipos
            </Link>
          </div>
        )}

        {/* Error del último intento */}
        {errorRegistro && (
          <div role="alert" className="mb-6 flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-100/60 backdrop-blur border border-red-300/50 text-red-900 text-sm">
            <Icon className="w-5 h-5 text-red-600 shrink-0 mt-0.5" d="M12 9v3.75m0 3.75h.008M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <p className="flex-1">
              <span className="font-bold">{errorRegistro}</span>{' '}
              <span className="opacity-80">No se guardó nada; tus fotos y textos se conservaron para reintentar.</span>
            </p>
            <button type="button" onClick={() => setErrorRegistro(null)} aria-label="Cerrar aviso" className="font-bold hover:text-red-950">✕</button>
          </div>
        )}

        {/* ZONA A · SUBIDA RÁPIDA (lote desde Drive) */}
        <div className="rounded-[2rem] border border-sky-200/60 bg-sky-100/30 backdrop-blur-sm p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-sky-700 bg-sky-100/80 border border-sky-200/70 px-3 py-1 rounded-full">
              <Icon className="w-3.5 h-3.5" strokeWidth={2.25} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              Subida rápida
            </span>
            <span className="text-xs text-slate-500">Muchos equipos a la vez</span>
          </div>

          <section className={`${glassCard} p-6`}>
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
              <h2 className="flex items-center gap-2.5 font-title text-lg font-black text-[#002060] uppercase tracking-wide shrink-0">
                <Icon className="w-6 h-6 text-[#002060]/70" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                Importar desde Drive
              </h2>

              <form onSubmit={handleImportarDrive} className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
                <div className="relative flex-1 min-w-0">
                  <label htmlFor="drive_link" className="sr-only">Enlace de Google Drive</label>
                  <Icon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  <input
                    id="drive_link"
                    type="url"
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    placeholder="Pega el enlace de la carpeta de Drive"
                    className={`${glassInput} pl-11 pr-4`}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isBusy || !driveLink.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#002060] text-white text-sm font-bold shadow-md shadow-[#002060]/20 transition hover:bg-[#001040] disabled:bg-slate-300 disabled:shadow-none disabled:cursor-not-allowed whitespace-nowrap"
                >
                  <Icon className="w-5 h-5" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  Importar
                </button>
              </form>
            </div>
          </section>
        </div>

        {/* Separador */}
        <div className="flex items-center gap-4 my-5 px-4" aria-hidden="true">
          <span className="flex-1 h-px bg-linear-to-r from-transparent via-slate-300/70 to-slate-300/70" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">o</span>
          <span className="flex-1 h-px bg-linear-to-l from-transparent via-slate-300/70 to-slate-300/70" />
        </div>

        {/* ZONA B · REGISTRO 1 POR 1 */}
        <div className="rounded-[2rem] border border-white/60 bg-white/25 backdrop-blur-sm p-4 md:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-4 px-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-[#002060] bg-[#002060]/10 border border-[#002060]/15 px-3 py-1 rounded-full">
              <Icon className="w-3.5 h-3.5" strokeWidth={2.25} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              1 por 1
            </span>
            <span className="text-xs text-slate-500">Un equipo a la vez</span>
          </div>

          <div className="space-y-5">

            {/* 1. FOTOS + ANALIZAR CON IA */}
            <section className={`${glassCard} p-6`}>
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="flex items-center gap-2.5 font-title text-lg font-black text-[#002060] uppercase tracking-wide">
                  <Icon className="w-6 h-6 text-[#002060]/70" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316zM16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  Fotos <span className="text-red-500">*</span>
                </h2>
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#002060]/10 text-[#002060]">
                  {imagenesCargadas.length}/{MAX_IMAGENES}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {imagenesCargadas.map((img, i) => (
                  <div key={img.id} className="relative group aspect-[4/3] rounded-2xl overflow-hidden border border-white/70 bg-slate-100/60 shadow-sm">
                    <img src={img.preview} alt={img.name} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" />
                    <div className="absolute inset-x-0 bottom-0 p-2.5 bg-linear-to-t from-slate-900/60 to-transparent">
                      <span className="text-[11px] font-semibold text-white">{etiquetasRanura[i]}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeImagen(img.id)}
                      disabled={isBusy}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/80 backdrop-blur text-slate-700 hover:bg-red-600 hover:text-white flex items-center justify-center shadow transition"
                      aria-label={`Quitar ${img.name}`}
                    >
                      <Icon className="w-4 h-4" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                    </button>
                  </div>
                ))}

                {Array.from({ length: ranurasVacias }).map((_, k) => {
                  const indice = imagenesCargadas.length + k;
                  return (
                    <label
                      key={`vacia-${indice}`}
                      className={`aspect-[4/3] rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-2 text-center transition ${
                        isBusy
                          ? 'border-slate-200 bg-white/30 text-slate-300 cursor-not-allowed'
                          : 'border-[#002060]/25 bg-white/40 text-[#002060]/60 cursor-pointer hover:border-[#002060]/60 hover:bg-white/70 hover:text-[#002060]'
                      }`}
                    >
                      <span className="w-11 h-11 rounded-full bg-[#002060]/10 flex items-center justify-center">
                        <Icon className="w-6 h-6" d="M12 4.5v15m7.5-7.5h-15" />
                      </span>
                      <span className="text-xs font-bold">{etiquetasRanura[indice]}</span>
                      <span className="text-[10px] font-medium opacity-70">{indice === 0 ? 'Requerida' : 'Opcional'}</span>
                      <input
                        type="file"
                        multiple
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleImagenesChange}
                        disabled={isBusy}
                        className="hidden"
                      />
                    </label>
                  );
                })}
              </div>

              <p className="mt-4 text-[11px] text-slate-500 text-center">JPG · PNG · se optimizan automáticamente</p>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={handleAnalizarConIA}
                  disabled={!puedeAnalizarConIA}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-linear-to-r from-[#002060] to-[#1d4ed8] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:shadow-xl hover:-translate-y-0.5 disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed"
                >
                  <Icon className="w-5 h-5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
                  Analizar con IA
                </button>
                <p className="mt-2 text-[11px] text-slate-500 text-center">
                  Si escribes nombre o descripción abajo, la IA los toma en cuenta
                </p>
              </div>
            </section>

            {/* 2. REFERENCIA (OPCIONAL) */}
            <section className={`${glassCard} p-6`}>
              <h2 className="flex items-center gap-2.5 font-title text-lg font-black text-[#002060] uppercase tracking-wide mb-5">
                <Icon className="w-6 h-6 text-[#002060]/70" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
                Referencia
                <span className="text-[11px] font-semibold text-slate-400 normal-case tracking-normal">opcional</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="relative">
                  <label htmlFor="identificacion" className="sr-only">Identificación</label>
                  <Icon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3zM6 6h.008v.008H6V6z" />
                  <input
                    id="identificacion"
                    type="text"
                    value={identificacion}
                    onChange={(e) => setIdentificacion(e.target.value)}
                    disabled={isBusy}
                    placeholder="Identificación (Opcional)"
                    className={`${glassInput} pl-11 pr-4`}
                  />
                </div>

                <div className="relative">
                  <label htmlFor="departamento" className="sr-only">Área</label>
                  <Icon className="w-5 h-5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0zM19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  <input
                    id="departamento"
                    type="text"
                    value={departamento}
                    onChange={(e) => setDepartamento(e.target.value)}
                    disabled={isBusy}
                    placeholder="Área (Opcional)"
                    className={`${glassInput} pl-11 pr-4`}
                  />
                </div>
              </div>
            </section>

            {/* 3. NOMBRE Y DESCRIPCIÓN */}
            <section className={`${glassCard} p-6`}>
              <h2 className="flex items-center gap-2.5 font-title text-lg font-black text-[#002060] uppercase tracking-wide mb-5">
                <Icon className="w-6 h-6 text-[#002060]/70" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                Equipo
                <span className="text-[11px] font-semibold text-slate-400 normal-case tracking-normal">opcional con IA</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label htmlFor="equipo" className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Nombre del Equipo</label>
                  <input
                    id="equipo"
                    type="text"
                    name="equipo"
                    value={nombre}
                    onChange={handleNombreChange}
                    disabled={isBusy}
                    placeholder="Marca y modelo · Ej. Torno Paralelo"
                    className={`${glassInput} px-4`}
                  />
                  {!tieneNombre && (
                    <p className="mt-1 text-[11px] text-amber-700">Requerido solo para guardar sin IA</p>
                  )}
                </div>

                <div>
                  <label htmlFor="descripcion_manual" className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Descripción técnica del equipo</label>
                  <textarea
                    id="descripcion_manual"
                    name="descripcion_manual"
                    rows={4}
                    value={descripcion}
                    onChange={handleDescripcionChange}
                    disabled={isBusy}
                    placeholder="Funcionamiento, partes móviles, fuentes de energía..."
                    className={`${glassInput} px-4 resize-none`}
                  />
                  {!tieneDescripcion && (
                    <p className="mt-1 text-[11px] text-amber-700">Requerido solo para guardar sin IA</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    onClick={handleGuardarBorrador}
                    disabled={!puedeGuardarBorrador}
                    className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-[#002060]/30 bg-white/50 backdrop-blur text-[#002060] font-bold transition hover:bg-white/90 hover:border-[#002060]/60 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Icon className="w-5 h-5" d="M4.5 12.75l6 6 9-13.5" />
                    Guardar borrador
                  </button>
                  {faltantesBorrador.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      Sin IA falta: {faltantesBorrador.join(', ')}
                    </p>
                  )}
                </div>
              </div>
            </section>

          </div>
        </div>

        {/* ACCIONES */}
        <footer className="mt-8 flex flex-col-reverse md:flex-row md:items-center md:justify-between gap-3">
          <Link
            to="/formulario"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/70 bg-white/50 backdrop-blur text-slate-700 font-bold transition hover:bg-white/90"
          >
            <Icon className="w-5 h-5" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            Atrás
          </Link>

          <div className="flex flex-col md:flex-row gap-3">
            <button
              type="button"
              onClick={handleLimpiarFormulario}
              disabled={isBusy}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl border border-white/70 bg-white/50 backdrop-blur text-slate-700 font-bold transition hover:bg-white/90 disabled:opacity-50"
            >
              <Icon className="w-5 h-5" d="M12 4.5v15m7.5-7.5h-15" />
              Nuevo equipo
            </button>

            <Link
              to="/mis-equipos"
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-[#002060] text-white font-bold shadow-lg shadow-[#002060]/25 transition hover:bg-[#001040] hover:-translate-y-0.5"
            >
              <Icon className="w-5 h-5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              Mis equipos
            </Link>
          </div>
        </footer>

      </div>
    </div>
  );
}

// Ícono de trazo (estilo Heroicons outline) para no depender de librerías externas
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
