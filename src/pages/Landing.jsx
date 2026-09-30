import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="relative w-full h-[600px] flex items-center justify-center bg-slate-900 overflow-hidden">
      
      {/* Imagen de fondo con filtro oscuro */}
      <div 
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-overlay"
        style={{ backgroundImage: "url('/hero-bg.jpg')" }}
      ></div>
      
      {/* Contenido Central */}
      <div className="relative z-10 text-center px-4 max-w-5xl flex flex-col items-center">
        
        <h1 className="font-title text-5xl md:text-6xl lg:text-7xl font-black text-white mb-6 tracking-wide uppercase drop-shadow-xl">
          Evaluación conforme a la NOM-004
        </h1>
        
        <p className="text-lg md:text-xl text-gray-200 font-medium mb-10 drop-shadow-md max-w-3xl leading-relaxed">
          Plataforma para el análisis de condiciones de seguridad en maquinaria y equipo, conforme a la NOM-004-STPS-1999.
        </p>
        
        <Link 
          to="/sobre-nom004" 
          className="bg-[#003087] hover:bg-[#002060] text-white font-bold text-lg py-4 px-12 rounded-md shadow-[0_10px_20px_rgba(0,0,0,0.3)] transition-all transform hover:-translate-y-1 hover:shadow-[0_15px_25px_rgba(0,0,0,0.4)]"
        >
          Comenzar 
        </Link>
      </div>

    </div>
  );
}