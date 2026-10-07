import { Link } from 'react-router-dom';

// --- CONFIGURACIÓN DE ENLACES ---
const URLS = {
  // Enlaces reales con URL activa
  paginaPrincipal: "https://www.asconsultoriaintegral.com/",
  consultoria: "https://www.asconsultoriaintegral.com/",
  capacitacion: "https://www.ascapacitacionlaboral.com/",
  redProfesionistas: "https://www.asconsultoriaintegral.com/comunidades",
  facebook: "https://www.facebook.com/ConsultoriaIntegralAs",
  instagram: "https://www.instagram.com/as_consultoria_integral/",
  linkedin: "https://www.linkedin.com/company/as-consultoria-integral/home/",

  // Enlaces preparados para asignar en el futuro
  reclutamiento: "", 
  whatsapp: "",
  email: "",
  telefono: ""
};

// Componente auxiliar que abre URL reales en nueva pestaña o bloquea el clic si la URL está vacía
const SafeAnchor = ({ url, children, className = "" }) => {
  const isValid = Boolean(url && url.trim() !== "" && url !== "#");

  return (
    <a
      href={isValid ? url : "#"}
      target={isValid ? "_blank" : undefined}
      rel={isValid ? "noopener noreferrer" : undefined}
      onClick={(e) => {
        if (!isValid) e.preventDefault();
      }}
      className={`${className} ${!isValid ? "cursor-default opacity-85" : ""}`}
    >
      {children}
    </a>
  );
};

// --- ICONOS SVG (Redes Sociales e Icono de Inicio) ---
const IconFacebook = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const IconInstagram = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const IconLinkedin = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.239-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
  </svg>
);

const IconHome = () => (
  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
  </svg>
);

export default function Footer() {
  return (
    <footer className="bg-[#111827] text-gray-300 py-12 border-t-4 border-[#002060]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10 text-sm">
        
        {/* Columna 1: Enlaces útiles */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Enlaces útiles</h3>
          <ul className="space-y-2.5">
            <li>
              <SafeAnchor 
                url={URLS.consultoria} 
                className="hover:text-white hover:underline transition flex items-center gap-1.5"
              >
                <span>›</span> Consultoría
              </SafeAnchor>
            </li>
            <li>
              <SafeAnchor 
                url={URLS.reclutamiento} 
                className="hover:text-white hover:underline transition flex items-center gap-1.5"
              >
                <span>›</span> Reclutamiento y Selección
              </SafeAnchor>
            </li>
            <li>
              <SafeAnchor 
                url={URLS.capacitacion} 
                className="hover:text-white hover:underline transition flex items-center gap-1.5"
              >
                <span>›</span> Capacitación
              </SafeAnchor>
            </li>
            <li>
              <SafeAnchor 
                url={URLS.redProfesionistas} 
                className="hover:text-white hover:underline transition flex items-center gap-1.5"
              >
                <span>›</span> Red de profesionistas
              </SafeAnchor>
            </li>
            <li>
              <Link 
                to="/analisis-datos" 
                className="hover:text-white hover:underline transition flex items-center gap-1.5 text-blue-400 font-semibold"
              >
                <span>›</span> Plataforma NOM-004
              </Link>
            </li>
          </ul>
        </div>

        {/* Columna 2: Sobre nosotros */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Sobre nosotros</h3>
          <p className="mb-4 leading-relaxed text-gray-300">
            AS Consultoría Integral (ASCI) es un ecosistema empresarial enfocado en consultoría, capacitación y gestión operativa, que integra personas, procesos y tecnología para el cumplimiento normativo y la mejora continua.
          </p>
          <p className="leading-relaxed text-gray-300">
            Este portal forma parte del <strong className="text-white">modelo operativo ASCI 5.0</strong> y funciona como punto de acceso al ecosistema, permitiendo la interacción entre colaboradores, consultores y clientes según su rol.
          </p>
        </div>

        {/* Columna 3: Contacto y Redes Sociales */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Contáctenos</h3>
          <ul className="space-y-3">
            <li>
              <SafeAnchor 
                url={URLS.whatsapp} 
                className="hover:text-white transition flex items-center gap-2"
              >
                💬 <span>Contáctanos por WhatsApp</span>
              </SafeAnchor>
            </li>
            <li>
              <SafeAnchor 
                url={URLS.email} 
                className="hover:text-white transition flex items-center gap-2"
              >
                ✉️ <span>hola@asconsultoriaintegral.com</span>
              </SafeAnchor>
            </li>
            <li>
              <SafeAnchor 
                url={URLS.telefono} 
                className="hover:text-white transition flex items-center gap-2"
              >
                📞 <span>(33) 3458 9378</span>
              </SafeAnchor>
            </li>
          </ul>
          
          {/* Botones de Redes Sociales y Página Principal */}
          <div className="flex items-center gap-3 mt-6">
            <SafeAnchor 
              url={URLS.facebook} 
              className="w-9 h-9 bg-slate-800 text-gray-200 rounded-full flex items-center justify-center hover:bg-blue-600 hover:text-white transition shadow-md"
            >
              <IconFacebook />
            </SafeAnchor>

            <SafeAnchor 
              url={URLS.instagram} 
              className="w-9 h-9 bg-slate-800 text-gray-200 rounded-full flex items-center justify-center hover:bg-pink-600 hover:text-white transition shadow-md"
            >
              <IconInstagram />
            </SafeAnchor>

            <SafeAnchor 
              url={URLS.linkedin} 
              className="w-9 h-9 bg-slate-800 text-gray-200 rounded-full flex items-center justify-center hover:bg-blue-700 hover:text-white transition shadow-md"
            >
              <IconLinkedin />
            </SafeAnchor>

            {/* Ícono de Casa para la Página Principal */}
            <SafeAnchor 
              url={URLS.paginaPrincipal} 
              className="w-9 h-9 bg-slate-800 text-gray-200 rounded-full flex items-center justify-center hover:bg-[#003087] hover:text-white transition shadow-md"
            >
              <IconHome />
            </SafeAnchor>
          </div>
        </div>

      </div>

      <div className="max-w-7xl mx-auto px-6 mt-10 pt-6 border-t border-slate-800 text-center text-xs text-gray-500">
        © {new Date().getFullYear()} AS Consultoría Integral (ASCI). Todos los derechos reservados.
      </div>
    </footer>
  );
}