import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { dbService } from '../services/dbService';
import { generarDocumentoWord } from '../services/n8nService';
import { getDeviceId } from '../utils/deviceId';

// Convertidor asíncrono de imágenes de Supabase a Base64 en el navegador
const urlToBase64Navegador = async (url) => {
  if (!url) return null;
  if (typeof url === 'string' && url.startsWith('data:image')) return url;

  try {
    const cleanUrl = String(url).replace(/[\r\n\t\s]/g, "").trim();
    const res = await fetch(cleanUrl);
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => resolve(cleanUrl);
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.error("Error convirtiendo imagen en el navegador:", e);
    return url;
  }
};

export default function MisEquipos() {
  const [equipos, setEquipos] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const navigate = useNavigate();

  useEffect(() => {
    cargarEquipos();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 4000);
  };

  const cargarEquipos = async () => {
    const lista = await dbService.obtenerTodos();
    setEquipos(lista);
  };

  const handleEliminar = async (id) => {
    if (confirm('¿Estás seguro de eliminar este equipo del borrador?')) {
      await dbService.eliminarEquipo(id);
      await cargarEquipos();
      showToast('Equipo eliminado del borrador', 'success');
    }
  };

  const handleVerDetalle = (equipo) => {
    navigate('/analisis-datos', { state: { equipoEditar: equipo } });
  };

  const handleGenerarDocumento = async () => {
    if (equipos.length === 0) {
      showToast('No hay equipos guardados para generar el reporte.', 'error');
      return;
    }

    setIsGenerating(true);

    try {
      showToast('Procesando imágenes para el documento...', 'success');

      // 1. Convertir imágenes de cada equipo a Base64 en el cliente
      const equiposProcesados = await Promise.all(
        equipos.map(async (eq) => {
          const rawImgs = eq.imagenes_urls || eq.imagenes || [];
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

      // 2. Extraer datos de la empresa guardados en localStorage
      const datosEmpresaRaw = localStorage.getItem('programa_seguridad_todos_datos');
      const datosEmpresa = datosEmpresaRaw ? JSON.parse(datosEmpresaRaw) : {};
      const logoEmpresa = localStorage.getItem('company_logo') || null;

      // 3. Construir el payload consolidado
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
        equipos: equiposProcesados
      };

      // 4. Enviar a n8n
      const blob = await generarDocumentoWord(payloadConsolidado);

      // 5. Descargar el archivo Word resultante
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

  return (
    <div className="p-6 max-w-6xl mx-auto font-body text-slate-800">
      
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

      {isGenerating && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-sm border border-slate-100">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin mx-auto mb-4"></div>
            <p className="font-title text-xl font-bold text-[#002060] mb-2">Generando Documento Word...</p>
            <p className="text-sm text-slate-500">Consolidando tablas y análisis de riesgo...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className="text-3xl font-black text-[#002060] uppercase">Mis Equipos Guardados ({equipos.length})</h2>
          <p className="text-slate-600 text-sm">Gestiona los equipos analizados antes de compilar el informe final.</p>
        </div>

        <div className="flex gap-3">
          <Link
            to="/analisis-datos"
            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-sm"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Agregar Equipo
          </Link>

          {equipos.length > 0 && (
            <button 
              onClick={handleGenerarDocumento}
              disabled={isGenerating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg transition flex items-center gap-2 text-sm"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
              Generar Reporte Word ({equipos.length})
            </button>
          )}
        </div>
      </div>

      {equipos.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
          <svg className="w-12 h-12 text-slate-400 fill-current mx-auto mb-3" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
          </svg>
          <p className="font-bold text-slate-700 mb-1">No hay equipos guardados en el borrador.</p>
          <p className="text-sm">Realiza el análisis de un equipo para guardarlo automáticamente en esta sección.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {equipos.map((item) => (
            <div key={item.id} className="border border-slate-200 p-5 rounded-xl shadow-sm bg-white flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-slate-300 transition">
              <div>
                <h3 className="font-bold text-lg text-[#002060]">{item.equipo || 'Sin Nombre'}</h3>
                <p className="text-sm text-slate-600">
                  Dpto: <span className="font-semibold text-slate-800">{item.departamento || 'N/A'}</span> | Tag: <span className="font-semibold text-slate-800">{item.identificacion || 'N/A'}</span>
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className={`text-xs px-2.5 py-1 rounded-md font-bold flex items-center gap-1 ${item.matriz ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    {item.matriz ? 'Analizado con IA' : 'Pendiente de Análisis'}
                  </span>

                  {item.manual_url && (
                    <span className="text-xs px-2.5 py-1 bg-blue-100 text-blue-800 rounded-md font-bold flex items-center gap-1">
                      <svg className="w-3 h-3 fill-current" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8 4a3 3 0 00-3 3v4a5 5 0 0010 0V7a1 1 0 112 0v4a7 7 0 11-14 0V7a5 5 0 0110 0v4a3 3 0 11-6 0V7a1 1 0 012 0v4a1 1 0 102 0V7a3 3 0 00-3-3z" clipRule="evenodd" />
                      </svg>
                      PDF Adjunto
                    </span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 w-full md:w-auto justify-end">
                <button
                  onClick={() => handleVerDetalle(item)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                  Ver / Editar
                </button>

                <button
                  onClick={() => handleEliminar(item.id)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}