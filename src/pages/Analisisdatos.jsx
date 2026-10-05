import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { analizarEquipoConIA, generarDocumentoWord } from '../services/n8nService';
import { comprimirImagen } from '../utils/imageCompressor';
import { subirArchivoSupabase } from '../services/storageService';
import { guardarBorradorLocal, cargarBorradorLocal } from '../services/dbService';
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
  const navigate = useNavigate();

  const [equipoData, setEquipoData] = useState({
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
    manual_url: '' // URL en Supabase
  });

  const [riesgosState, setRiesgosState] = useState(
    RIESGOS_BASE.reduce((acc, curr) => {
      acc[curr.code] = { presente: false, ausente: false, observacion: '' };
      return acc;
    }, {})
  );

  const [matrizState, setMatrizState] = useState([]);
  const [imagenesCargadas, setImagenesCargadas] = useState([]); // Guarda { id, file, preview, url }
  const [equiposGuardados, setEquiposGuardados] = useState([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const editorRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  // Cargar borrador guardado en IndexedDB al entrar a la página
  useEffect(() => {
    async function initIndexedDB() {
      try {
        const borradores = await cargarBorradorLocal();
        if (borradores && borradores.length > 0) {
          setEquiposGuardados(borradores);
          showToast(`Borrador recuperado: ${borradores.length} equipo(s) en memoria`, 'success');
        }
      } catch (err) {
        console.error("Error al cargar borrador local:", err);
      }
    }
    initIndexedDB();
  }, []);

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

  // Carga de PDF
  const handleArchivoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setEquipoData(prev => ({
        ...prev,
        archivo_adjunto: file,
        archivo_nombre: file.name,
        manual_url: '' // Se obtendrá al presionar Analizar
      }));
      showToast(`Manual "${file.name}" seleccionado`, 'success');
    }
  };

  // Carga y compresión automática de imágenes
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

        setElements(prev => [
          ...prev,
          { id, type: 'image', src: previewUrl, x: 20, y: 20, width: 180, height: 130 }
        ]);
      } catch (error) {
        showToast(`Error comprimiendo ${file.name}: ${error.message}`, 'error');
      }
    }
  };

  const removeImagen = (id) => {
    setImagenesCargadas(prev => prev.filter(img => img.id !== id));
    setElements(prev => prev.filter(el => el.id !== id));
  };

  // --- ANALIZAR CON IA USANDO SUPABASE STORAGE ---
  const handleAnalizarConIA = async () => {
    if (!equipoData.equipo.trim()) {
      showToast('Por favor ingrese el nombre del equipo antes de analizar', 'error');
      return;
    }

    setIsAnalyzing(true);

    try {
      let manualPublicUrl = equipoData.manual_url;

      // 1. Subir PDF a Supabase si no se ha subido
      if (equipoData.archivo_adjunto && !manualPublicUrl) {
        showToast('Subiendo manual PDF a la nube...', 'success');
        manualPublicUrl = await subirArchivoSupabase(equipoData.archivo_adjunto, 'manuales');
        setEquipoData(prev => ({ ...prev, manual_url: manualPublicUrl }));
      }

      // 2. Subir imágenes de evidencia a Supabase
      const imagenesConUrls = await Promise.all(
        imagenesCargadas.map(async (img) => {
          if (img.url) return img.url;
          const url = await subirArchivoSupabase(img.file, 'imagenes');
          img.url = url;
          return url;
        })
      );

      // 3. Enviar payload ultra ligero a n8n con URLs
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

      if (response?.descripcion) {
        setEquipoData(prev => ({ ...prev, descripcion_manual: response.descripcion }));
      }

      if (response?.riesgos) {
        setRiesgosState(prev => {
          const updated = { ...prev };
          Object.keys(response.riesgos).forEach(key => {
            if (updated[key]) {
              const rIA = response.riesgos[key];
              updated[key] = {
                presente: rIA.presente === true,
                ausente: rIA.presente === false,
                observacion: rIA.observacion || (rIA.presente === false ? 'No aplica' : '')
              };
            }
          });
          return updated;
        });
      }

      if (response?.matriz && Array.isArray(response.matriz)) {
        setMatrizState(response.matriz);
      }

      showToast('Análisis técnico completado con exito', 'success');
    } catch (error) {
      showToast('Error en el proceso: ' + error.message, 'error');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Guardar en IndexedDB localmente ("+ Nuevo Equipo")
  const handleNuevoEquipo = async () => {
    if (!equipoData.equipo.trim()) {
      showToast('No hay datos para guardar', 'error');
      return;
    }

    const equipoAInsertar = {
      id: Date.now(),
      fecha: new Date().toLocaleString(),
      ...equipoData,
      archivo_adjunto: null, // No guardamos el archivo binario pesado en local
      riesgos: riesgosState,
      matriz: matrizState,
      imagenes_urls: imagenesCargadas.map(i => i.url)
    };

    const nuevaLista = [...equiposGuardados, equipoAInsertar];
    setEquiposGuardados(nuevaLista);

    // Persistir en IndexedDB
    await guardarBorradorLocal(nuevaLista);

    showToast(`Equipo "${equipoData.equipo}" guardado en borrador local.`, 'success');

    // Limpiar vista
    setEquipoData({
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
    setElements([]);
  };

  // Generar el archivo Word consolidado enviando solo URLs a n8n
  const handleGenerarDocumento = async () => {
    let listaFinalEquipos = [...equiposGuardados];

    if (equipoData.equipo.trim()) {
      const equipoActual = {
        id: Date.now(),
        fecha: new Date().toLocaleString(),
        ...equipoData,
        archivo_adjunto: null,
        riesgos: riesgosState,
        matriz: matrizState,
        imagenes_urls: imagenesCargadas.map(i => i.url)
      };
      listaFinalEquipos.push(equipoActual);
    }

    if (listaFinalEquipos.length === 0) {
      showToast('No hay equipos capturados.', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      const datosEmpresaRaw = localStorage.getItem('programa_seguridad_todos_datos');
      const datosEmpresa = datosEmpresaRaw ? JSON.parse(datosEmpresaRaw) : {};
      const logoEmpresa = localStorage.getItem('company_logo') || null;

      const payloadConsolidado = {
        device_id: getDeviceId(),
        empresa: datosEmpresa.company_name || '',
        direccion: datosEmpresa.company_address || '',
        rfc: datosEmpresa.company_rfc || '',
        actividad: datosEmpresa.company_activity || '',
        total_trabajadores: datosEmpresa.total_workers || '',
        horarios: datosEmpresa.work_schedule || '',
        especialista: datosEmpresa.specialist_name || '',
        registro_stps: datosEmpresa.stps_register || '',
        logo: logoEmpresa,
        equipos: listaFinalEquipos
      };

      const blob = await generarDocumentoWord(payloadConsolidado);

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Programa_Seguridad_Maquinaria_NOM004.doc`;
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
          <span>{toast.type === 'error' ? '⚠' : '✓'}</span>
          <span>{toast.message}</span>
        </div>
      )}

      {(isAnalyzing || isGenerating) && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-title text-xl font-bold text-[#002060] mb-2">
              {isAnalyzing ? 'Procesando con IA...' : 'Generando Documento...'}
            </p>
            <p className="text-sm text-slate-500">
              {isAnalyzing ? 'Subiendo archivos a la nube y evaluando manual...' : 'Consolidando tablas e imágenes...'}
            </p>
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
                className="w-full md:w-auto bg-[#003087] hover:bg-[#002060] text-white font-bold py-3 px-8 rounded-xl shadow-md transition"
              >
                ⚡ Analizar con IA
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
                        ✕
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
              <div className="w-12 h-12 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center font-bold mb-3">
                🖼️
              </div>
              <p className="font-title text-sm font-bold text-slate-700 uppercase mb-1">
                Espacio Reservado para Diagrama / Matriz
              </p>
            </div>
          </div>
        </div>

        {/* ACCIONES */}
        <div className="pt-8 border-t border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4">
          <Link
            to="/formulario"
            className="w-full md:w-auto bg-slate-600 hover:bg-slate-700 text-white font-bold py-3.5 px-8 rounded-xl text-center transition"
          >
            ⬅ Atrás (Datos Empresa)
          </Link>

          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <button
              type="button"
              onClick={handleNuevoEquipo}
              className="w-full md:w-auto bg-[#003087] hover:bg-[#002060] text-white font-bold py-3.5 px-8 rounded-xl shadow transition"
            >
              + Nuevo Equipo (Guardar Borrador)
            </button>

            <button
              type="button"
              onClick={handleGenerarDocumento}
              disabled={isGenerating}
              className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 px-8 rounded-xl shadow-lg transition"
            >
              📄 Generar Archivo (.DOC)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}