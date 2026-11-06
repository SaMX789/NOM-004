import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { preAnalizarEquipo } from '../services/n8nService';
import { comprimirImagen } from '../utils/imageCompressor';
import { subirImagenSupabase } from '../services/storageService';
import { dbService, EQUIPO_STATUS } from '../services/dbService';
import { useAuth } from '../context/AuthContext';

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 2;

const EQUIPO_VACIO = {
  id: null,
  status: null,
  equipo: '',
  descripcion_manual: '',
  identificacion: '',
  departamento: ''
};

const TOAST_OCULTO = { show: false, message: '', type: 'success' };

const liberarPreview = (img) => {
  if (img?.file && img.preview?.startsWith('blob:')) URL.revokeObjectURL(img.preview);
};

// Convierte un equipo guardado (Supabase) al estado del formulario
const equipoAFormulario = (eq) => ({
  id: eq.id,
  status: eq.status || EQUIPO_STATUS.BORRADOR,
  equipo: eq.equipo || '',
  descripcion_manual: eq.descripcion_manual || '',
  identificacion: eq.identificacion || '',
  departamento: eq.departamento || ''
});

const urlsAImagenes = (urls) =>
  (Array.isArray(urls) ? urls : []).slice(0, MAX_IMAGENES).map((url, index) => ({
    id: `img_loaded_${index}`,
    name: `Imagen ${index + 1}`,
    file: null,
    preview: url,
    url
  }));

export default function Analisisdatos() {
  const location = useLocation();
  const { userId } = useAuth();

  // Si se llega desde "Mis Equipos" con un equipo a editar, se precarga en el estado inicial
  const equipoEditar = location.state?.equipoEditar;

  const [equipoData, setEquipoData] = useState(() =>
    equipoEditar ? equipoAFormulario(equipoEditar) : EQUIPO_VACIO
  );
  const [imagenesCargadas, setImagenesCargadas] = useState(() =>
    urlsAImagenes(equipoEditar?.imagenes_urls)
  );
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState(() =>
    equipoEditar
      ? { show: true, message: `Equipo "${equipoEditar.equipo || 'Sin nombre'}" cargado para edición`, type: 'success' }
      : TOAST_OCULTO
  );

  const isBusy = isAnalyzing || isSaving;

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
  };

  // Oculta el toast 4 s después de mostrarse (se reinicia si llega otro mensaje)
  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast(TOAST_OCULTO), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEquipoData(prev => ({ ...prev, [name]: value }));
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
          preview: URL.createObjectURL(compressedFile),
          url: ''
        });
      } catch (error) {
        console.error('Error al comprimir la imagen:', error);
        showToast(`Error al procesar "${file.name}"`, 'error');
      }
    }

    setImagenesCargadas(prev => [...prev, ...nuevasImagenes]);
    if (nuevasImagenes.length > 0) {
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
    setEquipoData(EQUIPO_VACIO);
    setImagenesCargadas([]);
    showToast('Formulario listo para un nuevo equipo', 'success');
  };

  // Sube a Supabase Storage ('equipos-fotos') solo las imágenes que aún no tienen URL
  const subirImagenesPendientes = async () => {
    const actualizadas = await Promise.all(
      imagenesCargadas.map(async (img) => {
        if (img.url) return img;
        const url = await subirImagenSupabase(img.file, userId, 'imagenes');
        return { ...img, url };
      })
    );
    setImagenesCargadas(actualizadas);
    return actualizadas.map(img => img.url);
  };

  const persistirBorrador = async (datos) => {
    const guardado = await dbService.guardarBorrador(userId, { id: equipoData.id, ...datos });
    setEquipoData(prev => ({ ...prev, id: guardado.id, status: guardado.status }));
    return guardado;
  };

  const validarImagenes = () => {
    if (imagenesCargadas.length < MIN_IMAGENES) {
      showToast(`Agrega al menos ${MIN_IMAGENES} fotografía del equipo (máximo ${MAX_IMAGENES}).`, 'error');
      return false;
    }
    if (imagenesCargadas.length > MAX_IMAGENES) {
      showToast(`Solo se permiten máximo ${MAX_IMAGENES} fotografías por equipo.`, 'error');
      return false;
    }
    return true;
  };

  // --- FASE 1: PRE-ANÁLISIS VISUAL CON IA + GUARDADO COMO BORRADOR ---
  const handlePreAnalisis = async () => {
    if (!validarImagenes()) return;

    setIsAnalyzing(true);
    try {
      const imagenesUrls = await subirImagenesPendientes();

      const resultado = await preAnalizarEquipo({
        user_id: userId,
        equipo_id: equipoData.id,
        identificacion: equipoData.identificacion,
        departamento: equipoData.departamento,
        imagenes_urls: imagenesUrls
      });

      const nombre = resultado.nombre_equipo || equipoData.equipo;
      const descripcion = resultado.descripcion || equipoData.descripcion_manual;

      setEquipoData(prev => ({ ...prev, equipo: nombre, descripcion_manual: descripcion }));

      await persistirBorrador({
        equipo: nombre,
        descripcion_manual: descripcion,
        identificacion: equipoData.identificacion,
        departamento: equipoData.departamento,
        imagenes_urls: imagenesUrls
      });

      showToast('Pre-análisis completado. Equipo guardado como borrador en Mis Equipos', 'success');
    } catch (error) {
      showToast(error?.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Guarda correcciones manuales sin volver a llamar a la IA
  const handleGuardarCambios = async () => {
    if (!validarImagenes()) return;
    if (!equipoData.equipo.trim()) {
      showToast('Ingresa el nombre del equipo o ejecuta el pre-análisis con IA.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const imagenesUrls = await subirImagenesPendientes();
      await persistirBorrador({
        equipo: equipoData.equipo.trim(),
        descripcion_manual: equipoData.descripcion_manual,
        identificacion: equipoData.identificacion,
        departamento: equipoData.departamento,
        imagenes_urls: imagenesUrls
      });
      showToast('Borrador guardado correctamente', 'success');
    } catch (error) {
      showToast(error?.message || 'Ocurrió un error inesperado.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-10 font-body text-slate-800">

      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 max-w-md px-6 py-4 rounded-xl shadow-2xl text-white font-bold transition-all flex items-center gap-3 ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? (
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

      {isBusy && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-title text-xl font-bold text-[#002060] mb-2">
              {isAnalyzing ? 'Pre-analizando con IA...' : 'Guardando borrador...'}
            </p>
            <p className="text-sm text-slate-500">
              {isAnalyzing
                ? 'Comprimiendo fotos, subiendo a Supabase e identificando el equipo...'
                : 'Sincronizando imágenes y datos del equipo...'}
            </p>
          </div>
        </div>
      )}

      <div className="bg-[#002060] text-white p-8 rounded-2xl shadow-lg mb-10 text-center">
        <p className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-2">Fase 1 · Pre-análisis visual</p>
        <h1 className="font-title text-3xl md:text-5xl font-black uppercase tracking-wide mb-2">
          Registro de Equipo
        </h1>
        <p className="text-blue-200 text-base md:text-lg max-w-3xl mx-auto">
          Sube de 1 a 2 fotografías: la IA identificará el equipo y redactará su descripción técnica.
          La evaluación de riesgos NOM-004 se realiza después, en lote, desde <span className="font-bold text-white">Mis Equipos</span>.
        </p>
      </div>

      {equipoData.status === EQUIPO_STATUS.COMPLETADO && (
        <div className="mb-8 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-md text-amber-800 text-sm font-medium">
          Este equipo ya cuenta con análisis de riesgos completo. Si guardas cambios o repites el pre-análisis,
          volverá a estado <strong>borrador</strong> y deberá analizarse de nuevo.
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 space-y-10">

        {/* 1. EVIDENCIA FOTOGRÁFICA */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-100 pb-3 mb-6">
            <h2 className="font-title text-2xl font-black text-[#002060] uppercase">
              1. Evidencia Fotográfica <span className="text-red-500">*</span>
            </h2>
            {equipoData.status && (
              <span className={`text-xs px-2.5 py-1 rounded-md font-bold ${
                equipoData.status === EQUIPO_STATUS.COMPLETADO
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-amber-100 text-amber-800'
              }`}>
                {equipoData.status === EQUIPO_STATUS.COMPLETADO ? 'Completado' : 'Borrador'}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 mb-4">
            Formatos JPG, JPEG o PNG · <span className="font-bold text-blue-700">Mínimo {MIN_IMAGENES}, máximo {MAX_IMAGENES} fotos</span> (comprimidas automáticamente a ≤ 500 KB).
            Incluye una vista general del equipo y, si es posible, su placa de datos.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <label className={`text-sm font-bold py-2.5 px-5 rounded-lg transition ${
              imagenesCargadas.length >= MAX_IMAGENES
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                : 'bg-[#002060] hover:bg-[#003087] text-white cursor-pointer'
            }`}>
              + Agregar Imágenes
              <input
                type="file"
                multiple
                accept="image/jpeg,image/jpg,image/png"
                onChange={handleImagenesChange}
                disabled={imagenesCargadas.length >= MAX_IMAGENES || isBusy}
                className="hidden"
              />
            </label>
            <span className="text-xs text-slate-500 font-medium">
              {imagenesCargadas.length > 0
                ? `${imagenesCargadas.length} / ${MAX_IMAGENES} foto(s) optimizada(s)`
                : `Ninguna imagen seleccionada (mín. ${MIN_IMAGENES}, máx. ${MAX_IMAGENES})`}
            </span>
          </div>

          {imagenesCargadas.length > 0 && (
            <div className="flex flex-wrap gap-4 mt-5">
              {imagenesCargadas.map((img) => (
                <div key={img.id} className="relative group w-28 h-28 border border-slate-200 rounded-lg overflow-hidden bg-slate-100 shadow-sm">
                  <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                  {img.url && (
                    <span className="absolute bottom-1 left-1 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                      En la nube
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeImagen(img.id)}
                    disabled={isBusy}
                    className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-700 transition"
                    aria-label={`Quitar ${img.name}`}
                  >
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 2. DATOS DE REFERENCIA (OPCIONALES) */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            2. Datos de Referencia <span className="text-sm font-semibold text-slate-400 normal-case">(opcionales)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="identificacion" className="block font-bold text-slate-800 text-sm mb-1">No. de Identificación / Tag</label>
              <input
                id="identificacion"
                type="text"
                name="identificacion"
                value={equipoData.identificacion}
                onChange={handleInputChange}
                placeholder="Número interno de inventario"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div>
              <label htmlFor="departamento" className="block font-bold text-slate-800 text-sm mb-1">Departamento / Área</label>
              <input
                id="departamento"
                type="text"
                name="departamento"
                value={equipoData.departamento}
                onChange={handleInputChange}
                placeholder="Ubicación física"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>
          </div>

          <div className="mt-8 bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-600 max-w-xl">
              La IA analizará únicamente las fotografías para proponer el <strong>nombre</strong> y la <strong>descripción técnica</strong>.
              El equipo se guardará como <strong>borrador</strong>.
            </p>
            <button
              type="button"
              onClick={handlePreAnalisis}
              disabled={isBusy || imagenesCargadas.length < MIN_IMAGENES}
              className="w-full md:w-auto shrink-0 bg-[#003087] hover:bg-[#002060] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3 px-8 rounded-xl shadow-md transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
              </svg>
              Pre-análisis con IA (Guarda borrador)
            </button>
          </div>
        </div>

        {/* 3. RESULTADO DEL PRE-ANÁLISIS (EDITABLE) */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            3. Resultado del Pre-análisis
          </h2>

          <div className="space-y-6">
            <div>
              <label htmlFor="equipo" className="block font-bold text-slate-800 text-sm mb-1">
                Nombre del Equipo (Marca y Modelo)
              </label>
              <input
                id="equipo"
                type="text"
                name="equipo"
                value={equipoData.equipo}
                onChange={handleInputChange}
                placeholder="La IA propondrá el nombre a partir de las fotografías..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div>
              <label htmlFor="descripcion_manual" className="block font-bold text-slate-800 text-sm mb-1">
                Descripción técnica del equipo
              </label>
              <textarea
                id="descripcion_manual"
                name="descripcion_manual"
                rows={5}
                value={equipoData.descripcion_manual}
                onChange={handleInputChange}
                placeholder="La IA redactará la descripción técnica a partir de las fotografías..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
              <p className="text-xs text-slate-500 mt-1.5 italic">
                Puedes corregir el nombre y la descripción antes del análisis profundo. Esta información será la base para evaluar los riesgos.
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGuardarCambios}
                disabled={isBusy}
                className="w-full md:w-auto bg-white border-2 border-[#002060] text-[#002060] hover:bg-slate-50 disabled:opacity-50 font-bold py-3 px-6 rounded-xl transition"
              >
                Guardar cambios del borrador
              </button>
            </div>
          </div>
        </div>

        {/* ACCIONES DEL PIE DE PÁGINA */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <Link className="w-full md:w-auto bg-slate-600 hover:bg-slate-700 text-white font-bold py-3.5 px-8 rounded-xl text-center transition flex items-center justify-center gap-2" to="/formulario">
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Atrás (Datos Empresa)
          </Link>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={handleLimpiarFormulario}
              disabled={isBusy}
              className="w-full md:w-auto bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Limpiar / Capturar Otro
            </button>

            <Link
              to="/mis-equipos"
              className="w-full md:w-auto bg-[#002060] hover:bg-[#001040] text-white font-bold py-3.5 px-8 rounded-xl shadow transition flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
              Ver Mis Equipos
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
