import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const DATOS_CONSULTORIA = "AS CONSULTORIA INTEGRAL Paseo de los cafetos 2830 Fraccionamiento C.P. 45188 Tabachines Zapopan Jalisco México";

/* ============================================================
 * MOCKS (solo visual) — se reemplazarán por datos de Supabase
 * ============================================================ */

// Genera un logotipo SVG de ejemplo (data URI) para previsualizar el diseño
const mockLogo = (texto, fondo) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
      <rect width="96" height="96" rx="18" fill="${fondo}"/>
      <text x="48" y="58" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="#fff" text-anchor="middle">${texto}</text>
    </svg>`
  )}`;

const FORM_VACIO = {
  company_name: '',
  company_address: '',
  company_rfc: '',
  company_activity: '',
  total_workers: '',
  work_schedule: '',
  elaborated_by: DATOS_CONSULTORIA,
  specialist_name: '',
  stps_register: '',
  company_logo: null
};

const CLIENTES_MOCK = [
  {
    id: 'cli-001',
    company_name: 'VITAE LABORATORIOS S.A. DE C.V.',
    company_address: 'Av. Industrial No. 105, Col. Parque Industrial, C.P. 44100, Guadalajara, Jalisco.',
    company_rfc: 'VLA920415H88',
    company_activity: 'Fabricación y empaque de productos farmacéuticos.',
    total_workers: '45',
    work_schedule: '2 turnos de 8 horas (Lunes a Sábado de 06:00 a 22:00 hrs)',
    elaborated_by: DATOS_CONSULTORIA,
    specialist_name: 'Ing. Carlos Mendoza Reyes',
    stps_register: 'STPS-AS-0199/18',
    company_logo: mockLogo('VL', '#0f766e'),
    estudios: [
      { id: 'est-001', fecha: '2026-11-10', estado: 'borrador' },
      { id: 'est-002', fecha: '2026-03-18', estado: 'completado' }
    ]
  },
  {
    id: 'cli-002',
    company_name: 'METALMECÁNICA DEL BAJÍO S.A. DE C.V.',
    company_address: 'Blvd. Aeropuerto Km 4.5, C.P. 37545, León, Guanajuato.',
    company_rfc: 'MBA050912KT3',
    company_activity: 'Maquinado y soldadura de piezas metálicas industriales.',
    total_workers: '120',
    work_schedule: '3 turnos de 8 horas (Lunes a Viernes)',
    elaborated_by: DATOS_CONSULTORIA,
    specialist_name: 'Ing. Laura Beltrán Soto',
    stps_register: 'STPS-AS-0245/20',
    company_logo: mockLogo('MB', '#b45309'),
    estudios: [
      { id: 'est-003', fecha: '2026-10-22', estado: 'completado' },
      { id: 'est-004', fecha: '2026-09-05', estado: 'completado' },
      { id: 'est-005', fecha: '2026-11-12', estado: 'borrador' }
    ]
  },
  {
    id: 'cli-003',
    company_name: 'ALIMENTOS LA CAMPIÑA S.A.',
    company_address: 'Carretera a Nogales Km 12, C.P. 45200, Zapopan, Jalisco.',
    company_rfc: 'ACA110203QW9',
    company_activity: 'Procesamiento y envasado de alimentos.',
    total_workers: '78',
    work_schedule: '2 turnos de 10 horas',
    elaborated_by: DATOS_CONSULTORIA,
    specialist_name: 'Ing. Carlos Mendoza Reyes',
    stps_register: 'STPS-AS-0199/18',
    company_logo: null,
    estudios: [{ id: 'est-006', fecha: '2026-11-01', estado: 'borrador' }]
  },
  {
    id: 'cli-004',
    company_name: 'PLÁSTICOS TÉCNICOS DE OCCIDENTE S.A. DE C.V.',
    company_address: 'Calle Acueducto 880, C.P. 45050, Zapopan, Jalisco.',
    company_rfc: 'PTO000718LM2',
    company_activity: 'Inyección y extrusión de plásticos.',
    total_workers: '60',
    work_schedule: '1 turno de 9 horas',
    elaborated_by: DATOS_CONSULTORIA,
    specialist_name: 'Ing. Laura Beltrán Soto',
    stps_register: 'STPS-AS-0245/20',
    company_logo: mockLogo('PT', '#1d4ed8'),
    estudios: []
  }
];

/* ============================================================
 * Utilidades de presentación
 * ============================================================ */

const formatearFecha = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });

const iniciales = (nombre) =>
  nombre
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

const ESTADO_ESTUDIO = {
  borrador: {
    label: 'En borrador',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    accion: 'Continuar'
  },
  completado: {
    label: 'Completado',
    badge: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    dot: 'bg-emerald-500',
    accion: 'Entrar'
  }
};

/* ============================================================
 * Vista principal: Dashboard de clientes
 * ============================================================ */

function LogoCliente({ cliente }) {
  return cliente.company_logo ? (
    <img
      src={cliente.company_logo}
      alt={`Logotipo de ${cliente.company_name}`}
      className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
    />
  ) : (
    <div
      className="w-12 h-12 rounded-lg bg-[#002060]/10 text-[#002060] font-title font-black text-sm flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      {iniciales(cliente.company_name)}
    </div>
  );
}

function TarjetaCliente({ cliente, onEditar, onEntrarEstudio, onAnadirEstudio }) {
  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Cabecera: logotipo + razón social + editar */}
      <header className="flex items-start gap-3 p-5 border-b border-slate-100">
        <LogoCliente cliente={cliente} />
        <h3 className="flex-1 min-w-0 font-bold text-[#002060] text-sm leading-snug line-clamp-3 pt-0.5">
          {cliente.company_name}
        </h3>
        <button
          type="button"
          onClick={() => onEditar(cliente)}
          title="Editar datos del cliente"
          aria-label={`Editar datos de ${cliente.company_name}`}
          className="p-2 -mr-1 -mt-1 rounded-lg text-slate-400 hover:text-[#002060] hover:bg-slate-100 transition shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
          </svg>
        </button>
      </header>

      {/* Estudios */}
      <section className="p-5 flex-1">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-3">
          Estudios
        </h4>

        {cliente.estudios.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">Aún no hay estudios registrados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cliente.estudios.map((estudio) => {
              const estado = ESTADO_ESTUDIO[estudio.estado];
              return (
                <li key={estudio.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-col items-start gap-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-700">
                      {formatearFecha(estudio.fecha)}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${estado.badge}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />
                      {estado.label}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEntrarEstudio(cliente, estudio)}
                    className="text-sm font-bold text-[#002060] hover:text-white hover:bg-[#002060] border border-[#002060]/20 hover:border-[#002060] px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                  >
                    {estado.accion} <span aria-hidden="true">&rarr;</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Añadir estudio */}
      <footer className="px-5 pb-5">
        <button
          type="button"
          onClick={() => onAnadirEstudio(cliente)}
          className="group w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#002060]/25 bg-[#002060]/[0.04] text-[#002060]/70 text-sm font-semibold backdrop-blur-sm transition-all duration-200 hover:border-[#002060]/60 hover:bg-[#002060]/10 hover:text-[#002060] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002060]/40 active:scale-[0.99]"
        >
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#002060]/10 group-hover:bg-[#002060] group-hover:text-white transition-colors">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Añadir estudio
        </button>
      </footer>
    </article>
  );
}

function DashboardClientes({ clientes, onNuevo, onEditar, onEntrarEstudio, onAnadirEstudio }) {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Encabezado + acción principal */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-title text-3xl md:text-4xl font-black text-[#002060] uppercase tracking-wide mb-2">
            Datos Empresariales
          </h1>
          <p className="text-slate-600 max-w-2xl">
            Administre sus clientes y los estudios de la NOM-004-STPS-1999 de cada uno.
          </p>
        </div>
        <button
          type="button"
          onClick={onNuevo}
          className="self-start sm:self-auto bg-[#002060] hover:bg-[#003087] text-white font-bold text-sm py-3 px-5 rounded-lg shadow-md hover:shadow-lg transition flex items-center gap-2 whitespace-nowrap"
        >
          <span className="text-lg leading-none">+</span>
          Nuevo Cliente
        </button>
      </div>

      {/* Grid de clientes */}
      {clientes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
          Aún no hay clientes. Presione <strong>+ Nuevo Cliente</strong> para comenzar.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clientes.map((cliente) => (
            <TarjetaCliente
              key={cliente.id}
              cliente={cliente}
              onEditar={onEditar}
              onEntrarEstudio={onEntrarEstudio}
              onAnadirEstudio={onAnadirEstudio}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ============================================================
 * Vista secundaria: Formulario de cliente (diseño existente)
 * ============================================================ */

function FormularioCliente({ clienteInicial, onCancelar, onGuardar }) {
  const esEdicion = Boolean(clienteInicial);

  const [formData, setFormData] = useState(() => ({
    ...FORM_VACIO,
    ...(clienteInicial || {}),
    elaborated_by: DATOS_CONSULTORIA
  }));
  const [errors, setErrors] = useState({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Carga del logo (Base64 en memoria; sin persistencia por ahora)
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert('El archivo es demasiado grande. Por favor selecciona un logotipo menor a 2MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData((prev) => ({ ...prev, company_logo: event.target.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveLogo = () => {
    setFormData((prev) => ({ ...prev, company_logo: null }));
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

    setSaveSuccess(true);
    setTimeout(() => onGuardar(formData), 600);
  };

  const inputClass = (campo, extra = '') =>
    `w-full p-3 border rounded-lg focus:ring-2 focus:ring-[#002060] outline-none transition ${extra} ${
      errors[campo] ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
    }`;

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      {/* Volver al dashboard */}
      <button
        type="button"
        onClick={onCancelar}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#002060] transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver al Dashboard
      </button>

      {/* Encabezado Principal */}
      <div className="mb-10 text-center">
        <h1 className="font-title text-3xl md:text-4xl font-black text-[#002060] uppercase tracking-wide mb-3">
          {esEdicion ? 'Editar Cliente' : 'Nuevo Cliente'}
        </h1>
        <p className="text-slate-600 max-w-2xl mx-auto">
          Ingrese la información general de la empresa requerida para la carátula y expediente técnico de la NOM-004-STPS-1999.
        </p>
      </div>

      {/* Alerta de errores */}
      {Object.values(errors).some(Boolean) && (
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 text-sm font-medium">
          Por favor complete todos los campos obligatorios marcados en rojo antes de continuar.
        </div>
      )}

      {/* Alerta de éxito */}
      {saveSuccess && (
        <div className="mb-8 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-md text-green-700 text-sm font-semibold">
          ✓ Datos guardados correctamente. Regresando al Dashboard...
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
              className={inputClass('company_name')}
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
              className={inputClass('company_address')}
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
              className={inputClass('company_rfc', 'uppercase')}
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
              className={inputClass('company_activity')}
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
              className={inputClass('total_workers')}
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
              className={inputClass('work_schedule')}
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
              className={inputClass('specialist_name')}
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
              className={inputClass('stps_register')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: STPS-AS-0199/18
            </p>
            {errors.stps_register && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.stps_register}</span>}
          </div>

        </div>

        {/* Acciones del formulario */}
        <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-base py-3.5 px-8 rounded-lg border border-slate-300 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="bg-[#002060] hover:bg-[#003087] text-white font-bold text-base py-3.5 px-8 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
          >
            <span>{esEdicion ? 'Guardar Cambios' : 'Guardar Cliente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
 * Contenedor: alterna entre Dashboard y Formulario
 * ============================================================ */

export default function Formulario() {
  const navigate = useNavigate();

  // MOCK: estado local; se sustituirá por Supabase más adelante
  const [clientes, setClientes] = useState(CLIENTES_MOCK);
  const [vista, setVista] = useState('dashboard'); // 'dashboard' | 'formulario'
  const [clienteEnEdicion, setClienteEnEdicion] = useState(null);

  const abrirNuevo = () => {
    setClienteEnEdicion(null);
    setVista('formulario');
  };

  const abrirEdicion = (cliente) => {
    setClienteEnEdicion(cliente);
    setVista('formulario');
  };

  const volverAlDashboard = () => {
    setClienteEnEdicion(null);
    setVista('dashboard');
  };

  const guardarCliente = (datos) => {
    if (clienteEnEdicion) {
      setClientes((prev) =>
        prev.map((c) => (c.id === clienteEnEdicion.id ? { ...c, ...datos } : c))
      );
    } else {
      setClientes((prev) => [
        ...prev,
        { ...datos, id: `cli-${Date.now()}`, estudios: [] }
      ]);
    }
    volverAlDashboard();
  };

  // MOCK: agrega un estudio en borrador con la fecha de hoy
  const anadirEstudio = (cliente) => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
    const nuevo = { id: `est-${Date.now()}`, fecha, estado: 'borrador' };

    setClientes((prev) =>
      prev.map((c) =>
        c.id === cliente.id ? { ...c, estudios: [...c.estudios, nuevo] } : c
      )
    );
  };

  // MOCK: mantiene compatibilidad con las pantallas siguientes (leen localStorage)
  const entrarAEstudio = (cliente) => {
    localStorage.setItem('company_name', cliente.company_name);
    localStorage.setItem('company_address', cliente.company_address);
    navigate('/analisis-datos');
  };

  if (vista === 'formulario') {
    return (
      <FormularioCliente
        key={clienteEnEdicion?.id ?? 'nuevo'}
        clienteInicial={clienteEnEdicion}
        onCancelar={volverAlDashboard}
        onGuardar={guardarCliente}
      />
    );
  }

  return (
    <DashboardClientes
      clientes={clientes}
      onNuevo={abrirNuevo}
      onEditar={abrirEdicion}
      onEntrarEstudio={entrarAEstudio}
      onAnadirEstudio={anadirEstudio}
    />
  );
}
