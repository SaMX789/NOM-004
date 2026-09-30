import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-white shadow-md w-full sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo y Título */}
          <div className="flex items-center gap-4">
            {/* Reemplaza este div con tu etiqueta <img src="/logo.png" /> cuando tengas el logo */}
            <div className="w-12 h-12 bg-[#002060] text-white flex items-center justify-center font-bold text-xs rounded-md">
              LOGO
            </div>
            <span className="font-extrabold text-3xl text-[#002060] tracking-tight">
              ASCI NORMA 004
            </span>
          </div>

          {/* Enlaces de Navegación */}
          <div className="hidden md:flex gap-8 font-semibold text-gray-600">
            <Link to="/" className="hover:text-[#002060] transition-colors">
              Inicio
            </Link>
            <Link to="/sobre-nom004" className="hover:text-[#002060] transition-colors">
              Sobre la NOM-004
            </Link>
            <Link to="/formulario" className="hover:text-[#002060] transition-colors">
              Datos empresariales
            </Link>
            <Link to="/analisis-datos" className="hover:text-[#002060] transition-colors">
              Análisis de Riesgo de Maquinaria
            </Link>
          </div>

        </div>
      </div>
    </nav>
  );
}