import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { analizarEquipoConIA } from '../services/n8nService';
import { comprimirImagen } from '../utils/imageCompressor';
import { subirArchivoSupabase } from '../services/storageService';
import { dbService } from '../services/dbService';
import { getDeviceId } from '../utils/deviceId';

const RIESGOS_BASE = [
  { group: 'a', code: 'a1', name: '1.- Partes en movimiento' },
  { group: 'a', code: 'a2', name: '2.- Generación de calor' },
  { group: 'a', code: 'a3', name: '3.- Generación de electricidad estática' },
  { group: 'b', code: 'b1', name: '1.- Superficies cortantes' },
  { group: 'b', code: 'b2', name: '2.- Proyección de materia prima, subproducto y producto terminado' },
  { group: 'b', code: 'b3', name: '3.- Calentamiento de materia prima, subproducto y producto terminado' },
  { group: 'c', code: 'c1', name: '1.- Manejo de herramientas' },
  { group: 'c', code: 'c2', name: '2.- Condiciones de operación' },
];

export default function Analisisdatos() {
  const location = useLocation();
  const navigate = useNavigate();

  const [equipoData, setEquipoData] = useState({
    id: null,
    equipo: '',
    identificacion: '',
    departamento: '',
    operadores: '',
    horas: '',
    dias: [],
    turnos: [],
    descripcion_manual: '',
    archivo_adjunto: null,
    archivo_nombre: '',
    manual_url: ''
  });

  const [riesgosState, setRiesgosState] = useState(
    RIESGOS_BASE.reduce((acc, curr) => {
      acc[curr.code] = { presente: false, ausente: false, observacion: '' };
      return acc;
    }, {})
  );

  const [matrizState, setMatrizState] = useState([]);
  const [imagenesCargadas, setImagenesCargadas] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Cargar datos cuando se accede para editar desde "Mis Equipos"
  useEffect(() => {
    if (location.state?.equipoEditar) {
      const eq = location.state.equipoEditar;
      
      setEquipoData({
        id: eq.id,
        equipo: eq.equipo || '',
        identificacion: eq.identificacion || '',
        departamento: eq.departamento || '',
        operadores: eq.operadores || '',
        horas: eq.horas || '',
        dias: eq.dias || [],
        turnos: eq.turnos || [],
        descripcion_manual: eq.descripcion_manual || eq.descripcion || '',
        archivo_adjunto: null,
        archivo_nombre: eq.archivo_nombre || '',
        manual_url: eq.manual_url || ''
      });

      if (eq.riesgos) setRiesgosState(eq.riesgos);
      if (eq.matriz) setMatrizState(eq.matriz);

      if (eq.imagenes_urls && Array.isArray(eq.imagenes_urls)) {
        setImagenesCargadas(eq.imagenes_urls.map((url, index) => ({
          id: `img_loaded_${index}`,
          name: `Imagen ${index + 1}`,
          file: null,
          preview: url,
          url: url
        })));
      }

      showToast(`Equipo "${eq.equipo}" cargado para edición`, 'success');
    }
  }, [location.state]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name === 'horas') {
      const numVal = parseFloat(value);
      if (numVal > 24) {
        showToast('Las horas por turno no pueden ser mayores a 24', 'error');
        setEquipoData(prev => ({ ...prev, horas: 24 }));
        return;
      }
    }
    setEquipoData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxArray = (field, val) => {
    setEquipoData(prev => {
      const exists = prev[field].includes(val);
      const updated = exists ? prev[field].filter(item => item !== val) : [...prev[field], val];
      return { ...prev, [field]: updated };
    });
  };

  const handleRiesgoChange = (code, field, val) => {
    setRiesgosState(prev => {
      const current = prev[code];
      let updated = { ...current };

      if (field === 'presente') {
        updated.presente = val;
        if (val) updated.ausente = false;
      } else if (field === 'ausente') {
        updated.ausente = val;
        if (val) {
          updated.presente = false;
          updated.observacion = 'No aplica';
        }
      } else if (field === 'observacion') {
        updated.observacion = val;
      }

      return { ...prev, [code]: updated };
    });
  };

  const handleArchivoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEquipoData(prev => ({
        ...prev,
        archivo_adjunto: file,
        archivo_nombre: file.name,
        manual_url: ''
      }));
      showToast(`Manual "${file.name}" seleccionado`, 'success');
    }
  };

  const handleImagenesChange = async (e) => {
    const files = Array.from(e.target.files);
    showToast("Comprimiendo imágenes...", "success");

    for (const file of files) {
      try {
        const compressedFile = await comprimirImagen(file);
        const previewUrl = URL.createObjectURL(compressedFile);
        const id = 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5);

        const newImgObj = {
          id,
          name: compressedFile.name,
          file: compressedFile,
          preview: previewUrl,
          url: ''
        };

        setImagenesCargadas(prev => [...prev, newImgObj]);
      } catch (error) {
        showToast(`Error comprimiendo ${file.name}: ${error.message}`, 'error');
      }
    }
  };

  const removeImagen = (id) => {
    setImagenesCargadas(prev => prev.filter(img => img.id !== id));
  };

  const handleLimpiarFormulario = () => {
    setEquipoData({
      id: null,
      equipo: '',
      identificacion: '',
      departamento: '',
      operadores: '',
      horas: '',
      dias: [],
      turnos: [],
      descripcion_manual: '',
      archivo_adjunto: null,
      archivo_nombre: '',
      manual_url: ''
    });

    setRiesgosState(
      RIESGOS_BASE.reduce((acc, curr) => {
        acc[curr.code] = { presente: false, ausente: false, observacion: '' };
        return acc;
      }, {})
    );

    setMatrizState([]);
    setImagenesCargadas([]);
    showToast('Formulario listo para un nuevo equipo', 'success');
  };

  // --- ANALIZAR CON IA Y GUARDAR AUTOMÁTICAMENTE EN MIS EQUIPOS ---
  const handleAnalizarConIA = async () => {
    if (!equipoData.equipo.trim()) {
      showToast('Por favor ingrese el nombre del equipo antes de analizar', 'error');
      return;
    }

    setIsAnalyzing(true);

    try {
      let manualPublicUrl = equipoData.manual_url;

      if (equipoData.archivo_adjunto && !manualPublicUrl) {
        showToast('Subiendo manual PDF a la nube...', 'success');
        manualPublicUrl = await subirArchivoSupabase(equipoData.archivo_adjunto, 'manuales');
      }

      const imagenesConUrls = await Promise.all(
        imagenesCargadas.map(async (img) => {
          if (img.url) return img.url;
          const url = await subirArchivoSupabase(img.file, 'imagenes');
          img.url = url;
          return url;
        })
      );

      const payload = {
        device_id: getDeviceId(),
        equipo: equipoData.equipo,
        identificacion: equipoData.identificacion,
        departamento: equipoData.departamento,
        operadores: equipoData.operadores,
        horas: equipoData.horas,
        dias: equipoData.dias,
        turnos: equipoData.turnos,
        descripcion_manual: equipoData.descripcion_manual,
        nombre_manual: equipoData.archivo_nombre,
        manual_url: manualPublicUrl || null,
        imagenes_urls: imagenesConUrls
      };

      const response = await analizarEquipoConIA(payload);

      // Calcular estados actualizados
      const nuevaDescripcion = response?.descripcion || equipoData.descripcion_manual;
      
      let nuevosRiesgos = { ...riesgosState };
      if (response?.riesgos) {
        Object.keys(response.riesgos).forEach(key => {
          if (nuevosRiesgos[key]) {
            const rIA = response.riesgos[key];
            nuevosRiesgos[key] = {
              presente: rIA.presente === true,
              ausente: rIA.presente === false,
              observacion: rIA.observacion || (rIA.presente === false ? 'No aplica' : '')
            };
          }
        });
      }

      const nuevaMatriz = response?.matriz || matrizState;

      // Actualizar interfaz
      setEquipoData(prev => ({
        ...prev,
        descripcion_manual: nuevaDescripcion,
        manual_url: manualPublicUrl
      }));
      setRiesgosState(nuevosRiesgos);
      setMatrizState(nuevaMatriz);

      // AUTO-GUARDADO EN INDEXEDDB (MIS EQUIPOS)
      const idDefinitivo = equipoData.id || `eq_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const equipoAutoGuardado = {
        id: idDefinitivo,
        device_id: getDeviceId(),
        fecha: new Date().toLocaleString(),
        ...equipoData,
        id: idDefinitivo,
        descripcion_manual: nuevaDescripcion,
        manual_url: manualPublicUrl,
        archivo_adjunto: null,
        riesgos: nuevosRiesgos,
        matriz: nuevaMatriz,
        imagenes_urls: imagenesConUrls
      };

      await dbService.guardarEquipo(equipoAutoGuardado);
      setEquipoData(prev => ({ ...prev, id: idDefinitivo }));

      showToast('Análisis técnico completado y guardado en Mis Equipos', 'success');
    } catch (error) {
      showToast('Error en el proceso: ' + error.message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getNivelBadgeClass = (valor) => {
    const v = parseInt(valor) || 0;
    if (v >= 15) return 'bg-red-600 text-white font-bold';
    if (v >= 9) return 'bg-yellow-400 text-slate-900 font-bold';
    if (v >= 4) return 'bg-emerald-500 text-white font-bold';
    return 'bg-slate-200 text-slate-700 font-bold';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 font-body text-slate-800">
      
      {toast.show && (
        <div className={`fixed top-5 right-5 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold transition-all flex items-center gap-3 ${
          toast.type === 'error' ? 'bg-red-600' : 'bg-emerald-600'
        }`}>
          {toast.type === 'error' ? (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {isAnalyzing && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-title text-xl font-bold text-[#002060] mb-2">Procesando con IA...</p>
            <p className="text-sm text-slate-500">Subiendo archivos a la nube y evaluando manual...</p>
          </div>
        </div>
      )}

      <div className="bg-[#002060] text-white p-8 rounded-2xl shadow-lg mb-10 text-center">
        <h1 className="font-title text-3xl md:text-5xl font-black uppercase tracking-wide mb-2">
          Análisis de Riesgo de Maquinaria
        </h1>
        <p className="text-blue-200 text-base md:text-lg max-w-3xl mx-auto">
          Captura técnica optimizada con almacenamiento en nube e IndexedDB.
        </p>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 space-y-10">

        {/* 1. SECCIÓN EQUIPO */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            Identificación del Equipo
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block font-bold text-slate-800 text-sm mb-1">
                Nombre del Equipo (Marca y Modelo) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="equipo"
                value={equipoData.equipo}
                onChange={handleInputChange}
                placeholder="Indique marca, modelo o tipo técnico específico"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1">No. de Identificación / Tag</label>
              <input
                type="text"
                name="identificacion"
                value={equipoData.identificacion}
                onChange={handleInputChange}
                placeholder="Número interno de inventario"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1">Departamento / Área</label>
              <input
                type="text"
                name="departamento"
                value={equipoData.departamento}
                onChange={handleInputChange}
                placeholder="Ubicación física"
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>
          </div>
        </div>

        {/* 2. OPERACIÓN */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            Condiciones de Operación
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1">No. Operadores expuestos</label>
              <input
                type="number"
                name="operadores"
                value={equipoData.operadores}
                onChange={handleInputChange}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block font-bold text-slate-800 text-sm mb-1">Días de operación a la semana</label>
              <div className="flex flex-wrap gap-2 mt-2">
                {['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map((dia) => (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => handleCheckboxArray('dias', dia)}
                    className={`px-3.5 py-2 rounded-lg text-sm font-bold border transition ${
                      equipoData.dias.includes(dia)
                        ? 'bg-[#002060] text-white border-[#002060]'
                        : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {dia}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1">Horas por turno (Máx 24)</label>
              <input
                type="number"
                name="horas"
                max="24"
                value={equipoData.horas}
                onChange={handleInputChange}
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block font-bold text-slate-800 text-sm mb-1">Turnos en que opera</label>
              <div className="flex gap-4 mt-2">
                {['1', '2', '3'].map((turno) => (
                  <label key={turno} className="flex items-center gap-2 cursor-pointer bg-slate-50 px-4 py-2 rounded-lg border border-slate-200">
                    <input
                      type="checkbox"
                      checked={equipoData.turnos.includes(turno)}
                      onChange={() => handleCheckboxArray('turnos', turno)}
                      className="w-4 h-4 accent-[#002060]"
                    />
                    <span className="font-bold text-sm text-slate-800">Turno {turno}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 3. DESCRIPCIÓN Y DOCUMENTOS */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            Descripción y Documentos
          </h2>

          <div className="space-y-6">
            <div>
              <label className="block font-bold text-slate-800 text-sm mb-1">Descripción técnica del equipo</label>
              <textarea
                name="descripcion_manual"
                rows={4}
                value={equipoData.descripcion_manual}
                onChange={handleInputChange}
                placeholder="La IA redactará la descripción técnica a partir del manual PDF..."
                className="w-full p-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002060] outline-none"
              />
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
              <div>
                <label className="block font-bold text-slate-800 text-sm mb-1">Manual / Ficha Técnica (PDF)</label>
                <div className="flex items-center gap-3 mt-1">
                  <label className="cursor-pointer bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold py-2.5 px-4 rounded-lg transition">
                    Seleccionar Archivo
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleArchivoChange}
                      className="hidden"
                    />
                  </label>
                  <span className="text-xs font-medium text-slate-600 truncate max-w-[250px]">
                    {equipoData.archivo_nombre || 'Ningún archivo seleccionado'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAnalizarConIA}
                disabled={isAnalyzing}
                className="w-full md:w-auto bg-[#003087] hover:bg-[#002060] text-white font-bold py-3 px-8 rounded-xl shadow-md transition flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.381z" clipRule="evenodd" />
                </svg>
                Analizar con IA (Guardar Auto)
              </button>
            </div>

            <div>
              <label className="block font-bold text-slate-800 text-sm mb-2">Evidencia Fotográfica (Se comprime automáticamente)</label>
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold py-2 px-4 rounded-lg transition">
                  + Agregar Imágenes
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImagenesChange}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">
                  {imagenesCargadas.length > 0 ? `${imagenesCargadas.length} foto(s) optimizada(s)` : 'Ninguna imagen seleccionada'}
                </span>
              </div>

              {imagenesCargadas.length > 0 && (
                <div className="flex flex-wrap gap-4 mt-4">
                  {imagenesCargadas.map((img) => (
                    <div key={img.id} className="relative group w-24 h-24 border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
                      <img src={img.preview} alt={img.name} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImagen(img.id)}
                        className="absolute top-1 right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-bold"
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
          </div>
        </div>

        {/* 4. TABLA DE RIESGOS POTENCIALES */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            Riesgo Potencial por Tipo
          </h2>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="bg-[#002060] text-white font-title uppercase">
                  <th className="p-3 w-12 text-center">Inciso</th>
                  <th className="p-3">Riesgos Potenciales por:</th>
                  <th className="p-3 w-20 text-center">Presente</th>
                  <th className="p-3 w-20 text-center">Ausente</th>
                  <th className="p-3">Observaciones / Medidas de Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {RIESGOS_BASE.map((item) => {
                  const state = riesgosState[item.code] || {};
                  return (
                    <tr key={item.code} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-center text-[#002060] bg-blue-50/50">
                        {item.code.charAt(0)})
                      </td>
                      <td className="p-3 font-bold text-slate-800">{item.name}</td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={state.presente || false}
                          onChange={(e) => handleRiesgoChange(item.code, 'presente', e.target.checked)}
                          className="w-5 h-5 accent-[#002060] cursor-pointer"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={state.ausente || false}
                          onChange={(e) => handleRiesgoChange(item.code, 'ausente', e.target.checked)}
                          className="w-5 h-5 accent-slate-400 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <input
                          type="text"
                          value={state.observacion || ''}
                          onChange={(e) => handleRiesgoChange(item.code, 'observacion', e.target.value)}
                          placeholder={state.ausente ? 'No aplica' : 'Medida de seguridad...'}
                          className="w-full p-2 border border-slate-200 rounded bg-slate-50 focus:bg-white outline-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. MATRICES DE RIESGO */}
        <div>
          <h2 className="font-title text-2xl font-black text-[#002060] uppercase border-b-2 border-slate-100 pb-3 mb-6">
            Valoración del Riesgo Potencial (Matriz NOM-004)
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 overflow-x-auto">
              <table className="w-full text-xs border-collapse border border-slate-800 text-center">
                <thead>
                  <tr className="bg-[#002060] text-white font-title">
                    <th colSpan="6" className="p-2 border border-slate-800 uppercase font-bold text-sm">
                      Matriz de Valoración
                    </th>
                  </tr>
                  <tr className="bg-slate-100 text-slate-800 font-bold">
                    <th className="p-2 border border-slate-800">Riesgo</th>
                    <th className="p-2 border border-slate-800">Tipo de Daño</th>
                    <th className="p-2 border border-slate-800">Gravedad</th>
                    <th className="p-2 border border-slate-800">Probabilidad</th>
                    <th className="p-2 border border-slate-800">Valor</th>
                    <th className="p-2 border border-slate-800">Nivel</th>
                  </tr>
                </thead>
                <tbody>
                  {matrizState.length > 0 ? (
                    matrizState.map((row, idx) => (
                      <tr key={idx} className="border border-slate-800">
                        <td className="p-2 border border-slate-800 font-bold uppercase">{row.riesgo}</td>
                        <td className="p-2 border border-slate-800 text-left font-medium">{row.tipo_daño || row.tipo_danio}</td>
                        <td className="p-2 border border-slate-800 font-bold">{row.gravedad}</td>
                        <td className="p-2 border border-slate-800 font-bold">{row.probabilidad}</td>
                        <td className="p-2 border border-slate-800 font-extrabold">{row.valor}</td>
                        <td className={`p-2 border border-slate-800 ${getNivelBadgeClass(row.valor)}`}>
                          {row.nivel}
                        </td>
                      </tr>
                    ))
                  ) : (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <tr key={idx} className="border border-slate-300">
                        <td colSpan="6" className="p-3 text-slate-400 italic text-center">
                          {idx === 0 ? 'Sin riesgos presentes registrados' : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-5 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-6 text-center flex flex-col items-center justify-center min-h-[250px]">
              <svg className="w-10 h-10 text-slate-400 fill-current mb-2" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
              </svg>
              <p className="font-title text-sm font-bold text-slate-700 uppercase mb-1">
                Espacio Reservado para Diagrama / Matriz
              </p>
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