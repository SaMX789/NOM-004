import { useState } from 'react';
import { Link } from 'react-router-dom';
import logoImg from '../img/logo.png';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="bg-white shadow-md w-full sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo y Título (Sin saltos de línea ni deformación) */}
          <div className="flex items-center gap-3 shrink-0">
            <img 
              src={logoImg} 
              alt="Logo ASCI" 
              className="h-10 lg:h-12 w-auto object-contain shrink-0"
            />
            <span className="font-extrabold text-lg lg:text-xl xl:text-2xl text-[#002060] tracking-tight whitespace-nowrap">
              ASCI NORMA 004
            </span>
          </div>

          {/* Enlaces de Navegación (Solo en pantallas grandes 'lg') */}
          <div className="hidden lg:flex items-center gap-4 xl:gap-8 font-semibold text-gray-600 text-sm xl:text-base">
            <Link to="/" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Inicio
            </Link>
            <Link to="/sobre-nom004" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Sobre la NOM-004
            </Link>
            <Link to="/formulario" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Datos empresariales
            </Link>
            <Link to="/analisis-datos" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Análisis de Riesgo de Maquinaria
            </Link>
            <Link to="/mis-equipos" className="hover:text-blue-600 transition-colors whitespace-nowrap">
              Mis Equipos
            </Link>
          </div>

          {/* Botón Hamburguesa (Móvil y Pantallas Medias menores a 'lg') */}
          <div className="lg:hidden flex items-center">
            <button
              onClick={toggleMenu}
              type="button"
              className="text-[#002060] hover:text-blue-600 focus:outline-none p-2 rounded-md"
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

      {/* Menú Desplegable Móvil */}
      {isOpen && (
        <div className="lg:hidden bg-white border-t border-gray-100 shadow-lg px-4 pt-2 pb-6 space-y-2 font-semibold text-gray-700">
          <Link 
            to="/" 
            onClick={closeMenu}
            className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
          >
            Inicio
          </Link>
          <Link 
            to="/sobre-nom004" 
            onClick={closeMenu}
            className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
          >
            Sobre la NOM-004
          </Link>
          <Link 
            to="/formulario" 
            onClick={closeMenu}
            className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
          >
            Datos empresariales
          </Link>
          <Link 
            to="/analisis-datos" 
            onClick={closeMenu}
            className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
          >
            Análisis de Riesgo de Maquinaria
          </Link>
          <Link 
            to="/mis-equipos" 
            onClick={closeMenu}
            className="block py-2.5 px-3 rounded-lg hover:bg-slate-100 hover:text-[#002060] transition"
          >
            Mis Equipos
          </Link>
        </div>
      )}
    </nav>
  );
}