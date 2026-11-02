import { useState } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../img/logo.png';
import { useAuth } from '../context/AuthContext';

// "corto" se usa cuando el espacio es reducido (xl); "label" en pantallas muy anchas (2xl)
const NAV_LINKS = [
  { to: '/', label: 'Inicio' },
  { to: '/sobre-nom004', label: 'Sobre la NOM-004' },
  { to: '/formulario', label: 'Datos empresariales' },
  { to: '/analisis-datos', label: 'Análisis de Riesgo de Maquinaria', corto: 'Análisis de Riesgo' },
  { to: '/mis-equipos', label: 'Mis Equipos' },
];

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const { user, loading, loginWithGoogle, logout } = useAuth();
  const nombreUsuario = user?.user_metadata?.full_name || user?.email;
  const avatar = user?.user_metadata?.avatar_url;

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  return (
    <nav className="bg-white shadow-md w-full sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Grid: logo | enlaces centrados | perfil */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-6 h-20">

          {/* IZQUIERDA: Logo y título */}
          <Link to="/" className="flex items-center gap-3 shrink-0" onClick={closeMenu}>
            <img
              src={logoImg}
              alt="Logo ASCI"
              className="h-10 xl:h-12 w-auto object-contain shrink-0"
            />
            <span className="font-extrabold text-lg xl:text-xl text-[#002060] tracking-tight whitespace-nowrap">
              ASCI NORMA 004
            </span>
          </Link>

          {/* CENTRO: Enlaces (solo desde xl; debajo se usa el menú hamburguesa) */}
          <div className="hidden xl:flex items-center justify-center gap-x-6 2xl:gap-x-8 font-semibold text-gray-600 text-sm min-w-0">
            {NAV_LINKS.map(({ to, label, corto }) => (
              <Link
                key={to}
                to={to}
                className="hover:text-blue-600 transition-colors whitespace-nowrap"
              >
                {corto ? (
                  <>
                    <span className="2xl:hidden">{corto}</span>
                    <span className="hidden 2xl:inline">{label}</span>
                  </>
                ) : (
                  label
                )}
              </Link>
            ))}
          </div>

          {/* DERECHA: Perfil / sesión (siempre pegado a la derecha) */}
          <div className="col-start-3 flex items-center justify-end gap-3 min-w-0">
            {/* Escritorio */}
            <div className="hidden xl:flex items-center gap-3 min-w-0">
              {!loading && (user ? (
                <>
                  <div className="flex items-center gap-2 min-w-0" title={nombreUsuario}>
                    {avatar && (
                      <img
                        src={avatar}
                        alt="Avatar"
                        referrerPolicy="no-referrer"
                        className="w-9 h-9 rounded-full border border-slate-200 shrink-0"
                      />
                    )}
                    <span className="hidden 2xl:block text-sm font-semibold text-slate-700 max-w-[160px] truncate">
                      {nombreUsuario}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={logout}
                    className="shrink-0 text-sm font-bold text-red-600 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition whitespace-nowrap"
                  >
                    Salir
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={loginWithGoogle}
                  className="bg-[#002060] hover:bg-[#003087] text-white text-sm font-bold py-2 px-4 rounded-lg transition whitespace-nowrap"
                >
                  Iniciar sesión con Google
                </button>
              ))}
            </div>

            {/* Avatar visible en móvil/tablet junto a la hamburguesa */}
            {!loading && user && avatar && (
              <img
                src={avatar}
                alt="Avatar"
                referrerPolicy="no-referrer"
                className="xl:hidden w-8 h-8 rounded-full border border-slate-200 shrink-0"
              />
            )}

            {/* Botón hamburguesa (menor a 'xl') */}
            <button
              onClick={toggleMenu}
              type="button"
              className="xl:hidden text-[#002060] hover:text-blue-600 focus:outline-none p-2 rounded-md"
              aria-label="Toggle menu"
            >
              {isOpen ? (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>

        </div>
      </div>

      {/* Menú desplegable móvil / tablet */}
      {isOpen && (
        <div className="xl:hidden bg-white border-t border-gray-100 shadow-lg px-4 pt-2 pb-6 space-y-2 font-semibold text-gray-700">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              onClick={closeMenu}
              className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
            >
              {label}
            </Link>
          ))}
          {!loading && (
            <div className="pt-3 mt-2 border-t border-gray-100">
              {user ? (
                <button
                  type="button"
                  onClick={() => { logout(); closeMenu(); }}
                  className="block w-full text-left py-2.5 px-3 rounded-lg text-red-600 hover:bg-red-50 transition truncate"
                >
                  Cerrar sesión ({nombreUsuario})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => { loginWithGoogle(); closeMenu(); }}
                  className="block w-full text-left py-2.5 px-3 rounded-lg bg-[#002060] text-white hover:bg-[#003087] transition"
                >
                  Iniciar sesión con Google
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </nav>
  );
}
