import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import bgImg from '../img/fondo.jpg'; // Importa tu imagen (cambia la extensión a .png o .jpeg si corresponde)

export default function Landing() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Activa la animación suave justo al cargar el landing
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative w-full h-[600px] flex items-center justify-center bg-slate-900 overflow-hidden">
      
      {/* 1. Imagen de Fondo con Transición de Desvanecido */}
      <div 
        className={`absolute inset-0 z-0 bg-cover bg-center bg-no-repeat transition-all duration-1000 ease-out transform ${
          isVisible ? 'opacity-35 scale-100' : 'opacity-0 scale-105'
        }`}
        style={{ backgroundImage: `url(${bgImg})` }}
      ></div>

      {/* Capa de Sombra/Degradado Oscuro para asegurar legibilidad del texto */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/80 via-slate-900/60 to-slate-900/90 z-0"></div>
      
      {/* 2. Contenido Central con Transición de Entrada (Aparecer + Subida Suave) */}
      <div 
        className={`relative z-10 text-center px-4 max-w-5xl flex flex-col items-center transition-all duration-1000 ease-out transform ${
          isVisible 
            ? 'opacity-100 translate-y-0 scale-100' 
            : 'opacity-0 translate-y-8 scale-95'
        }`}
      >
        
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