import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';

const DATOS_CONSULTORIA = "AS CONSULTORIA INTEGRAL Paseo de los cafetos 2830 Fraccionamiento C.P. 45188 Tabachines Zapopan Jalisco México";

// Los logotipos se guardan en el bucket público existente, dentro de la carpeta del usuario
// (las políticas RLS del bucket exigen que el primer segmento de la ruta sea el user_id)
const BUCKET_LOGOS = 'equipos-fotos';
const MAX_LOGO_BYTES = 2 * 1024 * 1024;

const FORM_VACIO = {
  razon_social: '',
  domicilio: '',
  rfc: '',
  rama_industrial: '',
  num_trabajadores: '',
  turnos_horarios: '',
  elaborado_por: DATOS_CONSULTORIA,
  especialista_ing: '',
  registro_stps: '',
  logo_url: null
};

/* ============================================================
 * Acceso a Supabase
 * ============================================================ */

const obtenerUsuarioId = async () => {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    throw new Error('Tu sesión no es válida. Vuelve a iniciar sesión.', { cause: error });
  }
  return data.user.id;
};

// Traduce errores de Supabase / Postgres a mensajes entendibles
const mensajeError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === '23505') {
    const detalle = `${error.message ?? ''} ${error.details ?? ''}`.toLowerCase();
    return detalle.includes('rfc')
      ? 'Ya existe un cliente registrado con ese RFC.'
      : 'Ya existe un registro con esos datos.';
  }
  if (error.code === '23503') return 'El cliente relacionado ya no existe.';
  if (error.code === '23514') return 'Alguno de los valores no cumple las reglas de la base de datos.';
  if (error.code === '42501') return 'No tienes permisos para realizar esta acción (revisa las políticas RLS).';
  if (/failed to fetch|networkerror/i.test(error.message ?? '')) {
    return 'No hay conexión con Supabase. Revisa tu internet e inténtalo de nuevo.';
  }
  return error.message || 'Ocurrió un error inesperado.';
};

// Sube el logotipo original (sin recomprimir, para conservar la transparencia) y devuelve su URL pública
const subirLogo = async (file, userId) => {
  const extension = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
  const ruta = `${userId}/logos/${Date.now()}_${crypto.randomUUID().slice(0, 8)}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET_LOGOS)
    .upload(ruta, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;

  return supabase.storage.from(BUCKET_LOGOS).getPublicUrl(ruta).data.publicUrl;
};

/* ============================================================
 * Utilidades de presentación
 * ============================================================ */

const formatearFecha = (iso) =>
  iso
    ? new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

const iniciales = (nombre = '') =>
  nombre
    .split(' ')
    .filter((p) => p.length > 2)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?';

// Claves = valores reales de evaluaciones_norma04.estado
const ESTADO_ESTUDIO = {
  'En Borrador': {
    label: 'En borrador',
    badge: 'bg-amber-50 text-amber-700 ring-amber-200',
    dot: 'bg-amber-500',
    accion: 'Continuar'
  },
  Analizando: {
    label: 'Analizando',
    badge: 'bg-sky-50 text-sky-700 ring-sky-200',
    dot: 'bg-sky-500 animate-pulse',
    accion: 'Continuar'
  },
  Completado: {
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
  return cliente.logo_url ? (
    <img
      src={cliente.logo_url}
      alt={`Logotipo de ${cliente.razon_social}`}
      className="w-12 h-12 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
    />
  ) : (
    <div
      className="w-12 h-12 rounded-lg bg-[#002060]/10 text-[#002060] font-title font-black text-sm flex items-center justify-center shrink-0"
      aria-hidden="true"
    >
      {iniciales(cliente.razon_social)}
    </div>
  );
}

function TarjetaCliente({ cliente, anadiendo, onEditar, onEntrarEstudio, onAnadirEstudio }) {
  const estudios = cliente.evaluaciones_norma04 ?? [];

  return (
    <article className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col">
      {/* Cabecera: logotipo + razón social + editar */}
      <header className="flex items-start gap-3 p-5 border-b border-slate-100">
        <LogoCliente cliente={cliente} />
        <h3 className="flex-1 min-w-0 font-bold text-[#002060] text-sm leading-snug line-clamp-3 pt-0.5">
          {cliente.razon_social}
        </h3>
        <button
          type="button"
          onClick={() => onEditar(cliente)}
          title="Editar datos del cliente"
          aria-label={`Editar datos de ${cliente.razon_social}`}
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

        {estudios.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-2">Aún no hay estudios registrados.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {estudios.map((estudio) => {
              const estado = ESTADO_ESTUDIO[estudio.estado] ?? ESTADO_ESTUDIO['En Borrador'];
              return (
                <li key={estudio.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="flex flex-col items-start gap-1 min-w-0">
                    <span
                      className="text-sm font-semibold text-slate-700 truncate max-w-full"
                      title={estudio.titulo_proyecto}
                    >
                      {estudio.titulo_proyecto || 'Estudio sin título'}
                    </span>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ring-inset ${estado.badge}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${estado.dot}`} />
                        {estado.label}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatearFecha(estudio.fecha_creacion)}</span>
                    </div>
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
          disabled={anadiendo}
          className="group w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-[#002060]/25 bg-[#002060]/[0.04] text-[#002060]/70 text-sm font-semibold backdrop-blur-sm transition-all duration-200 hover:border-[#002060]/60 hover:bg-[#002060]/10 hover:text-[#002060] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#002060]/40 active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
        >
          {anadiendo ? (
            <span className="w-5 h-5 border-2 border-[#002060]/30 border-t-[#002060] rounded-full animate-spin" />
          ) : (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-[#002060]/10 group-hover:bg-[#002060] group-hover:text-white transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
              </svg>
            </span>
          )}
          {anadiendo ? 'Creando estudio...' : 'Añadir estudio'}
        </button>
      </footer>
    </article>
  );
}

function SkeletonTarjeta() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
      <div className="flex items-center gap-3 pb-5 border-b border-slate-100">
        <div className="w-12 h-12 rounded-lg bg-slate-200" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-slate-200 rounded w-3/4" />
          <div className="h-3 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
      <div className="pt-5 space-y-3">
        <div className="h-3 bg-slate-200 rounded w-1/4" />
        <div className="h-8 bg-slate-100 rounded" />
        <div className="h-8 bg-slate-100 rounded" />
      </div>
    </div>
  );
}

function BannerError({ mensaje, onCerrar, onReintentar }) {
  return (
    <div role="alert" className="mb-6 flex items-start gap-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 text-sm font-medium">
      <span className="flex-1">{mensaje}</span>
      {onReintentar && (
        <button type="button" onClick={onReintentar} className="font-bold underline hover:text-red-900">
          Reintentar
        </button>
      )}
      {onCerrar && (
        <button type="button" onClick={onCerrar} aria-label="Cerrar aviso" className="font-bold hover:text-red-900">
          ✕
        </button>
      )}
    </div>
  );
}

function DashboardClientes({
  clientes,
  loading,
  errorCarga,
  errorAccion,
  anadiendoA,
  onNuevo,
  onEditar,
  onEntrarEstudio,
  onAnadirEstudio,
  onReintentar,
  onCerrarErrorAccion
}) {
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

      {errorAccion && <BannerError mensaje={errorAccion} onCerrar={onCerrarErrorAccion} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" aria-busy="true" aria-label="Cargando clientes">
          <SkeletonTarjeta />
          <SkeletonTarjeta />
          <SkeletonTarjeta />
        </div>
      ) : errorCarga ? (
        <BannerError mensaje={`No se pudieron cargar tus clientes: ${errorCarga}`} onReintentar={onReintentar} />
      ) : clientes.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center text-slate-500">
          <p className="font-semibold text-slate-600 mb-1">Aún no tienes clientes registrados</p>
          <p className="text-sm">
            Presiona <strong>+ Nuevo Cliente</strong> para comenzar.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {clientes.map((cliente) => (
            <TarjetaCliente
              key={cliente.id}
              cliente={cliente}
              anadiendo={anadiendoA === cliente.id}
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
 * Vista secundaria: Formulario de cliente
 * ============================================================ */

function FormularioCliente({ clienteInicial, guardando, errorServidor, onCancelar, onGuardar }) {
  const esEdicion = Boolean(clienteInicial);

  const [formData, setFormData] = useState(() => ({
    ...FORM_VACIO,
    ...(clienteInicial || {}),
    num_trabajadores: clienteInicial?.num_trabajadores?.toString() ?? '',
    elaborado_por: DATOS_CONSULTORIA
  }));
  // Logotipo recién seleccionado (aún no subido): archivo + vista previa
  const [logoLocal, setLogoLocal] = useState(null);
  const [errors, setErrors] = useState({});

  const logoVisible = logoLocal?.preview ?? formData.logo_url;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > MAX_LOGO_BYTES) {
      alert('El archivo es demasiado grande. Por favor selecciona un logotipo menor a 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => setLogoLocal({ file, preview: event.target.result });
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoLocal(null);
    setFormData((prev) => ({ ...prev, logo_url: null }));
  };

  const validateForm = () => {
    const newErrors = {};
    const trabajadores = formData.num_trabajadores.toString().trim();

    if (!formData.razon_social.trim()) newErrors.razon_social = 'La razón social es obligatoria';
    if (!formData.domicilio.trim()) newErrors.domicilio = 'El domicilio completo es obligatorio';
    if (!formData.rfc.trim()) newErrors.rfc = 'El RFC es obligatorio';
    if (!formData.rama_industrial.trim()) newErrors.rama_industrial = 'La actividad económica es obligatoria';
    if (!trabajadores) newErrors.num_trabajadores = 'Especifique el número de trabajadores';
    else if (!/^\d+$/.test(trabajadores)) newErrors.num_trabajadores = 'Debe ser un número entero';
    if (!formData.turnos_horarios.trim()) newErrors.turnos_horarios = 'Indique la cantidad y horarios de trabajo';
    if (!formData.especialista_ing.trim()) newErrors.especialista_ing = 'El nombre del especialista es obligatorio';
    if (!formData.registro_stps.trim()) newErrors.registro_stps = 'El registro STPS es obligatorio';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (guardando) return;

    if (!validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    onGuardar(formData, logoLocal?.file ?? null);
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
        disabled={guardando}
        className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-[#002060] transition disabled:opacity-50"
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

      {/* Alerta de errores de validación */}
      {Object.values(errors).some(Boolean) && (
        <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 text-sm font-medium">
          Por favor complete todos los campos obligatorios marcados en rojo antes de continuar.
        </div>
      )}

      {/* Error devuelto por Supabase (RFC duplicado, permisos, red, etc.) */}
      {errorServidor && (
        <div role="alert" className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md text-red-700 text-sm font-semibold">
          {errorServidor}
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

            {logoVisible ? (
              <div className="flex items-center gap-6 bg-white p-4 rounded-lg border border-slate-300 w-fit">
                <img
                  src={logoVisible}
                  alt="Logo de la empresa"
                  className="h-20 max-w-[200px] object-contain rounded border border-slate-100 p-1 bg-white"
                />
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-green-600 flex items-center gap-1">
                    {logoLocal ? '✓ Se subirá al guardar' : '✓ Logotipo cargado'}
                  </span>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={guardando}
                    className="text-xs text-red-600 hover:text-red-800 font-bold underline text-left disabled:opacity-50"
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
              name="razon_social"
              value={formData.razon_social}
              onChange={handleChange}
              placeholder="Razón Social completa de la empresa"
              className={inputClass('razon_social')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: VITAE LABORATORIOS S.A. DE C.V.
            </p>
            {errors.razon_social && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.razon_social}</span>}
          </div>

          {/* b) Domicilio */}
          <div className="md:col-span-2">
            <label className="block text-slate-800 font-bold text-sm mb-1">
              b) Domicilio completo <span className="text-red-500">*</span>
            </label>
            <textarea
              name="domicilio"
              rows={2}
              value={formData.domicilio}
              onChange={handleChange}
              placeholder="Calle, Número, Colonia, Municipio/Alcaldía, C.P., Estado"
              className={inputClass('domicilio')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Av. Industrial No. 105, Col. Parque Industrial, C.P. 44100, Guadalajara, Jalisco.
            </p>
            {errors.domicilio && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.domicilio}</span>}
          </div>

          {/* c) RFC */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              c) Registro Federal de Contribuyentes (RFC) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="rfc"
              value={formData.rfc}
              onChange={handleChange}
              placeholder="RFC con homoclave"
              className={inputClass('rfc', 'uppercase')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: VLA920415H88
            </p>
            {errors.rfc && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.rfc}</span>}
          </div>

          {/* d) Rama industrial */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              d) Rama industrial o actividad económica <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="rama_industrial"
              value={formData.rama_industrial}
              onChange={handleChange}
              placeholder="Giro principal de la empresa"
              className={inputClass('rama_industrial')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Fabricación y empaque de productos farmacéuticos.
            </p>
            {errors.rama_industrial && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.rama_industrial}</span>}
          </div>

          {/* e) Número de trabajadores */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              e) Número de trabajadores en el centro de trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              step="1"
              name="num_trabajadores"
              value={formData.num_trabajadores}
              onChange={handleChange}
              placeholder="Total de personal laboral"
              className={inputClass('num_trabajadores')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: 45
            </p>
            {errors.num_trabajadores && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.num_trabajadores}</span>}
          </div>

          {/* f) Cantidad y horarios */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              f) Cantidad de turnos y horarios de trabajo <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="turnos_horarios"
              value={formData.turnos_horarios}
              onChange={handleChange}
              placeholder="Especifique turnos y horas"
              className={inputClass('turnos_horarios')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: 2 turnos de 8 horas (Lunes a Sábado de 06:00 a 22:00 hrs)
            </p>
            {errors.turnos_horarios && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.turnos_horarios}</span>}
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
              value={formData.elaborado_por}
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
              name="especialista_ing"
              value={formData.especialista_ing}
              onChange={handleChange}
              placeholder="Nombre del ingeniero responsable"
              className={inputClass('especialista_ing')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: Ing. Carlos Mendoza Reyes
            </p>
            {errors.especialista_ing && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.especialista_ing}</span>}
          </div>

          {/* i) Registro STPS */}
          <div>
            <label className="block text-slate-800 font-bold text-sm mb-1">
              i) Registro STPS <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="registro_stps"
              value={formData.registro_stps}
              onChange={handleChange}
              placeholder="Clave de registro ante la STPS"
              className={inputClass('registro_stps')}
            />
            <p className="text-xs text-slate-500 mt-1.5 italic">
              Ejemplo: STPS-AS-0199/18
            </p>
            {errors.registro_stps && <span className="text-xs text-red-500 mt-1 block font-medium">{errors.registro_stps}</span>}
          </div>

        </div>

        {/* Acciones del formulario */}
        <div className="pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="bg-white hover:bg-slate-50 text-slate-700 font-bold text-base py-3.5 px-8 rounded-lg border border-slate-300 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="bg-[#002060] hover:bg-[#003087] text-white font-bold text-base py-3.5 px-8 rounded-lg shadow-md hover:shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait disabled:transform-none"
          >
            {guardando && (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            )}
            <span>{guardando ? 'Guardando...' : esEdicion ? 'Guardar Cambios' : 'Guardar Cliente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

/* ============================================================
 * Contenedor: datos reales de Supabase + alterna Dashboard / Formulario
 * ============================================================ */

export default function Formulario() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [vista, setVista] = useState('dashboard'); // 'dashboard' | 'formulario'
  const [clienteEnEdicion, setClienteEnEdicion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(null);

  const [anadiendoA, setAnadiendoA] = useState(null); // id del cliente al que se le crea un estudio
  const [errorAccion, setErrorAccion] = useState(null);

  // Carga clientes del usuario autenticado + sus estudios (relación evaluaciones_norma04.fk_cliente)
  useEffect(() => {
    let cancelado = false;

    (async () => {
      try {
        const userId = await obtenerUsuarioId();

        const { data, error } = await supabase
          .from('clientes')
          .select('*, evaluaciones_norma04(*)')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .order('fecha_creacion', { referencedTable: 'evaluaciones_norma04', ascending: true });

        if (error) throw error;
        if (cancelado) return;

        setClientes(data ?? []);
        setErrorCarga(null);
      } catch (error) {
        console.error('Error al cargar clientes:', error);
        if (!cancelado) setErrorCarga(mensajeError(error));
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [reloadKey]);

  const recargar = () => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  };

  const abrirNuevo = () => {
    setClienteEnEdicion(null);
    setErrorGuardado(null);
    setVista('formulario');
  };

  const abrirEdicion = (cliente) => {
    setClienteEnEdicion(cliente);
    setErrorGuardado(null);
    setVista('formulario');
  };

  const volverAlDashboard = () => {
    setClienteEnEdicion(null);
    setErrorGuardado(null);
    setVista('dashboard');
  };

  // INSERT (nuevo) o UPDATE (edición) en `clientes`, subiendo antes el logotipo si se eligió uno
  const guardarCliente = async (datos, logoFile) => {
    setGuardando(true);
    setErrorGuardado(null);

    try {
      const userId = await obtenerUsuarioId();

      let logoUrl = datos.logo_url ?? null;
      if (logoFile) logoUrl = await subirLogo(logoFile, userId);

      const payload = {
        logo_url: logoUrl,
        razon_social: datos.razon_social.trim(),
        domicilio: datos.domicilio.trim(),
        rfc: datos.rfc.trim().toUpperCase(),
        rama_industrial: datos.rama_industrial.trim(),
        num_trabajadores: parseInt(datos.num_trabajadores, 10),
        turnos_horarios: datos.turnos_horarios.trim(),
        elaborado_por: DATOS_CONSULTORIA,
        especialista_ing: datos.especialista_ing.trim(),
        registro_stps: datos.registro_stps.trim()
      };

      if (clienteEnEdicion) {
        const { error } = await supabase
          .from('clientes')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', clienteEnEdicion.id)
          .eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('clientes').insert({ ...payload, user_id: userId });
        if (error) throw error;
      }

      volverAlDashboard();
      recargar();
    } catch (error) {
      console.error('Error al guardar el cliente:', error);
      setErrorGuardado(mensajeError(error));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setGuardando(false);
    }
  };

  // INSERT en `evaluaciones_norma04` con el título capturado
  const anadirEstudio = async (cliente) => {
    const titulo = window.prompt(`Título del Proyecto / Estudio para "${cliente.razon_social}":`);
    if (titulo === null) return; // canceló

    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) {
      setErrorAccion('El título del proyecto no puede estar vacío.');
      return;
    }

    setAnadiendoA(cliente.id);
    setErrorAccion(null);

    try {
      const { error } = await supabase
        .from('evaluaciones_norma04')
        .insert({ fk_cliente: cliente.id, titulo_proyecto: tituloLimpio, estado: 'En Borrador' });
      if (error) throw error;

      recargar();
    } catch (error) {
      console.error('Error al crear el estudio:', error);
      setErrorAccion(`No se pudo crear el estudio: ${mensajeError(error)}`);
    } finally {
      setAnadiendoA(null);
    }
  };

  // Guarda el proyecto activo y pasa al Análisis de Riesgo de Maquinaria
  const entrarAEstudio = (cliente, estudio) => {
    localStorage.setItem(
      'proyecto_activo',
      JSON.stringify({
        cliente_id: cliente.id,
        evaluacion_id: estudio.id,
        titulo_proyecto: estudio.titulo_proyecto,
        razon_social: cliente.razon_social
      })
    );

    // Puente temporal: el exportador Word de "Mis Equipos" aún lee estas llaves antiguas
    localStorage.setItem(
      'programa_seguridad_todos_datos',
      JSON.stringify({
        company_name: cliente.razon_social,
        company_address: cliente.domicilio,
        company_rfc: cliente.rfc,
        company_activity: cliente.rama_industrial,
        total_workers: cliente.num_trabajadores,
        work_schedule: cliente.turnos_horarios,
        elaborated_by: cliente.elaborado_por,
        specialist_name: cliente.especialista_ing,
        stps_register: cliente.registro_stps
      })
    );
    localStorage.setItem('company_name', cliente.razon_social);
    localStorage.setItem('company_address', cliente.domicilio);

    navigate('/analisis-datos');
  };

  if (vista === 'formulario') {
    return (
      <FormularioCliente
        key={clienteEnEdicion?.id ?? 'nuevo'}
        clienteInicial={clienteEnEdicion}
        guardando={guardando}
        errorServidor={errorGuardado}
        onCancelar={volverAlDashboard}
        onGuardar={guardarCliente}
      />
    );
  }

  return (
    <DashboardClientes
      clientes={clientes}
      loading={loading}
      errorCarga={errorCarga}
      errorAccion={errorAccion}
      anadiendoA={anadiendoA}
      onNuevo={abrirNuevo}
      onEditar={abrirEdicion}
      onEntrarEstudio={entrarAEstudio}
      onAnadirEstudio={anadirEstudio}
      onReintentar={recargar}
      onCerrarErrorAccion={() => setErrorAccion(null)}
    />
  );
}
