import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const DATOS_CONSULTORIA = "AS CONSULTORIA INTEGRAL Paseo de los cafetos 2830 Fraccionamiento C.P. 45188 Tabachines Zapopan Jalisco México";

export default function Formulario() {
  const navigate = useNavigate();

  // Estado del formulario preparado para backend / BD
  const [formData, setFormData] = useState({
    company_name: '',
    company_address: '',
    company_rfc: '',
    company_activity: '',
    total_workers: '',
    work_schedule: '',
    elaborated_by: DATOS_CONSULTORIA,
    specialist_name: '',
    stps_register: '',
    company_logo: null // Almacena el Base64 de la imagen
  });

  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Cargar datos y logo previamente guardados en localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('programa_seguridad_todos_datos');
    const savedLogo = localStorage.getItem('company_logo');

    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        setFormData(prev => ({
          ...prev,
          ...parsed,
          elaborated_by: DATOS_CONSULTORIA
        }));
      } catch (e) {
        console.error("Error al cargar datos locales:", e);
      }
    }

    if (savedLogo) {
      setFormData(prev => ({ ...prev, company_logo: savedLogo }));
    }
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  };

  // Manejo de la carga de la imagen del logo
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Por favor selecciona un logotipo menor a 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Image = event.target.result;
        setFormData(prev => ({ ...prev, company_logo: base64Image }));
        localStorage.setItem('company_logo', base64Image); // Compatible con n8n
      };
      reader.readAsDataURL(file);
    }
  };

  // Eliminar el logo guardado
  const handleRemoveLogo = () => {
    setFormData(prev => ({ ...prev, company_logo: null }));
    localStorage.removeItem('company_logo');
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.company_name.trim()) newErrors.company_name = 'La razón social es obligatoria';
    if (!formData.company_address.trim()) newErrors.company_address = 'El domicilio completo es obligatorio';
    if (!formData.company_rfc.trim()) newErrors.company_rfc = 'El RFC es obligatorio';
    if (!formData.company_activity.trim()) newErrors.company_activity = 'La actividad económica es obligatoria';
    if (!formData.total_workers.toString().trim()) newErrors.total_workers = 'Especifique el número de trabajadores';
    if (!formData.work_schedule.trim()) newErrors.work_schedule = 'Indique la cantidad y horarios de trabajo';
    if (!formData.specialist_name.trim()) newErrors.specialist_name = 'El nombre del especialista es obligatorio';
    if (!formData.stps_register.trim()) newErrors.stps_register = 'El registro STPS es obligatorio';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Persistir conjunto completo en memoria local
    localStorage.setItem('programa_seguridad_todos_datos', JSON.stringify(formData));
    localStorage.setItem('company_name', formData.company_name);
    localStorage.setItem('company_address', formData.company_address);

    setSaveSuccess(true);
    setTimeout(() => {
      navigate('/analisis-datos');
    }, 800);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      
      {/* Encabezado Principal */}
      <div className="mb-10 text-center">
        <h1 className="font-title text-3xl md:text-4xl font-black text-[#002060] uppercase tracking-wide mb-3">
          Datos del Centro de Trabajo
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Ingrese la información general de la empresa requerida para la carátula y expediente técnico de la NOM-004-STPS-1999.
        </p>
      </div>

      {/* Alerta de errores */}
      {Object.keys(errors).length > 0 && (
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 text-sm font-medium">
          Por favor complete todos los campos obligatorios marcados en rojo antes de continuar.
        </div>
      )}

      {/* Alerta de éxito */}
      {saveSuccess && (
        <div className="mb-8 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-md text-green-700 text-sm font-semibold">
          ✓ Datos guardados correctamente. Redirigiendo al Análisis de Riesgo de Maquinaria...
        </div>
      )}

      {/* Formulario */}
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 md:p-10 space-y-8">
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* CARGA DEL LOGOTIPO DE LA EMPRESA */}
          <div className="md:col-span-2 bg-slate-50 p-6 rounded-xl border border-slate-200">
            <label className="block text-slate-800 font-bold text-sm mb-2">
              Logotipo de la Empresa (Opcional)
            </label>
            
            {formData.company_logo ? (
              <div className="flex items-center gap-6 bg-white p-4 rounded-lg border border-slate-300 w-fit">
                <img 
                  src={formData.company_logo} 
                  alt="Logo de la empresa" 
                  className="h-20 max-w-[200px] object-contain rounded border border-slate-100 p-1 bg-white"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    ✓ Logotipo cargado
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="text-xs text-red-600 hover:text-red-800 font-bold underline text-left"
                  >
                    Eliminar logotipo
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <label className="cursor-pointer bg-[#002060] hover:bg-[#003087] text-white text-sm font-bold py-2.5 px-5 rounded-lg transition shadow-sm flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Seleccionar logotipo</span>
                  <input
                    type="file"
                    accept="image/png, image/jpeg, image/webp"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
                <span className="text-xs text-slate-500">Ningún archivo seleccionado</span>
              </div>
            )}

            <p className="text-xs text-slate-500 mt-2 italic">
              Ejemplo: Imagen en formato PNG o JPG con fondo transparente. Este logotipo aparecerá impreso en la esquina superior de los reportes Word generados.
            </p>
          </div>

          {/* a) Nombre o Razón Social */}
          <div className="md:col-span-2">
            <label className="block text-slate-800 font-bold text-sm mb-1">
              a) Nombre, denominación o razón social <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="company_name"
              value={formData.company_name}
              onChange={handleChange}
              placeholder="Razón Social completa de la empresa"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.company_name ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: VITAE LABORATORIOS S.A. DE C.V.
            </p>
            {errors.company_name && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.company_name}</span>}
          </div>

          {/* b) Domicilio */}
          <div className="md:col-span-2">
            <label className="block text-slate-800 font-bold text-sm mb-1">
              b) Domicilio completo <span className="text-red-500">*</span>
            </label>
            <textarea
              name="company_address"
              rows={2}
              value={formData.company_address}
              onChange={handleChange}
              placeholder="Calle, Número, Colonia, Municipio/Alcaldía, C.P., Estado"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.company_address ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Av. Industrial No. 105, Col. Parque Industrial, C.P. 44100, Guadalajara, Jalisco.
            </p>
            {errors.company_address && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.company_address}</span>}
          </div>

          {/* c) RFC */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              c) Registro Federal de Contribuyentes (RFC) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="company_rfc"
              value={formData.company_rfc}
              onChange={handleChange}
              placeholder="RFC con homoclave"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none uppercase transition ${
                errors.company_rfc ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: VLA920415H88
            </p>
            {errors.company_rfc && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.company_rfc}</span>}
          </div>

          {/* d) Rama industrial */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              d) Rama industrial o actividad económica <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="company_activity"
              value={formData.company_activity}
              onChange={handleChange}
              placeholder="Giro principal de la empresa"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.company_activity ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Fabricación y empaque de productos farmacéuticos.
            </p>
            {errors.company_activity && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.company_activity}</span>}
          </div>

          {/* e) Número de trabajadores */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              e) Número de trabajadores en el centro de trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="total_workers"
              value={formData.total_workers}
              onChange={handleChange}
              placeholder="Total de personal laboral"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.total_workers ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: 45
            </p>
            {errors.total_workers && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.total_workers}</span>}
          </div>

          {/* f) Cantidad y horarios */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              f) Cantidad de turnos y horarios de trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="work_schedule"
              value={formData.work_schedule}
              onChange={handleChange}
              placeholder="Especifique turnos y horas"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.work_schedule ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: 2 turnos de 8 horas (Lunes a Sábado de 06:00 a 22:00 hrs)
            </p>
            {errors.work_schedule && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.work_schedule}</span>}
          </div>

          {/* g) Estudios elaborado por (READ ONLY / NO EDITABLE) */}
          <div className="md:col-span-2">
            <label className="block text-slate-800 font-bold text-sm mb-1 flex items-center justify-between">
              <span>g) Estudios elaborado por</span>
              <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-normal">
                No editable (Fijo)
              </span>
            </label>
            <textarea
              readOnly
              value={formData.elaborated_by}
              rows={2}
              className="w-full p-3 bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-not-allowed resize-none outline-none font-medium select-none"
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Este dato corresponde a la firma consultora acreditada y no requiere modificación.
            </p>
          </div>

          {/* h) Especialista Ing. */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              h) Especialista Ing. <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="specialist_name"
              value={formData.specialist_name}
              onChange={handleChange}
              placeholder="Nombre del ingeniero responsable"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.specialist_name ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Ing. Carlos Mendoza Reyes
            </p>
            {errors.specialist_name && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.specialist_name}</span>}
          </div>

          {/* i) Registro STPS */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              i) Registro STPS <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="stps_register"
              value={formData.stps_register}
              onChange={handleChange}
              placeholder="Clave de registro ante la STPS"
              className={`w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${
                errors.stps_register ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
              }`}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: STPS-AS-0199/18
            </p>
            {errors.stps_register && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.stps_register}</span>}
          </div>

        </div>

        {/* Acciones del formulario */}
        <div className="pt-6 border-t border-slate-200 flex justify-end">
          <button
            type="submit"
            className="bg-[#002060] hover:bg-[#003087] text-white font-bold text-base py-3.5 px-8 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center gap-2"
          >
            <span>Guardar y Continuar a Análisis de Datos</span>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </div>

      </form>
    </div>
  );
}