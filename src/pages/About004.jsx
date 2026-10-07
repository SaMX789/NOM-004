import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// 1. Importación de imágenes de fondo desde src/img/
import heroBg from '../img/bg-hero.jpg';
import jerarquiaBg from '../img/bg-jerarquia.jpg';
import responsabilidadesBg from '../img/bg-responsabilidades.jpg'; 
import ctaBg from '../img/bg-cta.jpg'; 

// --- COMPONENTE ENVOLVENTE PARA ANIMACIÓN AL HACER SCROLL ---
function AnimatedSection({ children, className = "", delay = 0 }) {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.15 } // Se activa cuando el 15% del elemento entra en pantalla
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => {
      if (sectionRef.current) observer.disconnect();
    };
  }, []);

  return (
    <div
      ref={sectionRef}
      style={{ transitionDelay: `${delay}ms` }}
      className={`transition-all duration-1000 ease-out transform ${
        isVisible 
          ? 'opacity-100 translate-y-0 scale-100' 
          : 'opacity-0 translate-y-12 scale-95 pointer-events-none'
      } ${className}`}
    >
      {children}
    </div>
  );
}

// --- ICONOS SVG (Estilo Microsoft Fluent / Industrial) ---
const IconSearch = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>;
const IconSettings = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>;
const IconAlert = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>;
const IconClipboard = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>;
const IconLightning = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>;
const IconTool = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 10-4.243-4.243 3 3 0 004.243 4.243z" /></svg>;
const IconUsers = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>;
const IconMap = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
const IconShield = () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>;

export default function About004() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [activeSecurity, setActiveSecurity] = useState(0);

  const responsabilidades = [
    { titulo: "Evaluación y Análisis", desc: "Aplicación de métodos de evaluación y análisis de los peligros inherentes al uso de maquinarias.", icon: <IconSearch /> },
    { titulo: "Mantenimiento y Prevención", desc: "Establecer mantenimiento preventivo y procedimientos seguros con dispositivos de seguridad.", icon: <IconSettings /> },
    { titulo: "Investigación de Incidentes", desc: "Actuar e investigar causas de accidentes y enfermedades profesionales para evitar que se repitan.", icon: <IconClipboard /> },
    { titulo: "Capacitación Continua", desc: "Capacitar y adiestrar al personal en la aplicación de procedimientos estándar seguros.", icon: <IconUsers /> }
  ];

  const seguridadSalud = [
    { titulo: "Evaluación de Peligros", desc: "La aplicación de métodos de evaluación y análisis de los peligros inherentes al uso de maquinarias y herramientas.", icon: <IconSearch /> },
    { titulo: "Mantenimiento y Dispositivos", desc: "Establecer el mantenimiento preventivo en el ciclo de vida, incluyendo que los protectores y dispositivos se instalen.", icon: <IconSettings /> },
    { titulo: "Atención de Accidentes", desc: "El actuar con accidentes relacionados con el uso y mantenimiento de maquinaria y herramientas.", icon: <IconAlert /> },
    { titulo: "Investigación de Causas", desc: "La investigación de las causas de los accidentes y enfermedades profesionales, y medidas para evitar que se repitan.", icon: <IconClipboard /> },
    { titulo: "Protección Eléctrica", desc: "Que las conexiones de la maquinaria y equipo y sus contactos eléctricos estén protegidas y no sean un factor de riesgo.", icon: <IconLightning /> },
    { titulo: "Cambio de Herramientas", desc: "Establecer y controlar los procedimientos de cambio de herramientas que representen un riesgo potencial.", icon: <IconTool /> },
    { titulo: "Capacitación y Adiestramiento", desc: "Capacitar al personal en procedimientos estándar seguros, así como en actividades de mantenimiento.", icon: <IconUsers /> },
    { titulo: "Señalización de Áreas", desc: "Señalar las áreas de tránsito y operación según las NOM-001-STPS-1993 y NOM-026-STPS-1998.", icon: <IconMap /> },
    { titulo: "Equipo de Protección", desc: "Dotar a los trabajadores del equipo de protección personal (EPP) según lo establecido en la NOM-017-STPS-1993.", icon: <IconShield /> }
  ];

  return (
    <div className="bg-[#0a0f16] text-slate-300 min-h-screen font-body selection:bg-[#003087] selection:text-white pb-32 overflow-hidden">
      
      {/* 1. HERO PRINCIPAL */}
      <AnimatedSection>
        <div className="relative h-[85vh] flex items-center justify-center overflow-hidden">
          <div 
            className="absolute inset-0 bg-fixed bg-center bg-cover opacity-80"
            style={{ backgroundImage: `url(${heroBg})` }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f16]/80 via-[#0a0f16]/60 to-[#0a0f16]"></div>
          
          <div className="relative z-10 text-center px-6 max-w-5xl mx-auto mt-20">
            <p className="font-title text-blue-500 font-bold tracking-[0.3em] uppercase mb-4 text-sm md:text-base">
              Marco Normativo STPS
            </p>
            <h1 className="font-title text-5xl md:text-7xl font-black text-white uppercase tracking-tight mb-8 leading-tight">
              Anatomía de la <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-blue-700">Seguridad</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-300 font-light max-w-3xl mx-auto leading-relaxed border-l-4 border-blue-600 pl-6 text-left">
              La protección no es opcional. Descubre los principios internacionales y lineamientos de la NOM-004-STPS-1999 para blindar la operación de tu maquinaria.
            </p>
          </div>
        </div>
      </AnimatedSection>

      {/* 2. OBJETIVOS */}
      <AnimatedSection>
        <div className="max-w-7xl mx-auto px-6 py-24 border-b border-white/5">
          <div className="flex flex-col lg:flex-row gap-16 items-start">
            <div className="lg:w-1/3 lg:sticky lg:top-32">
              <h2 className="font-title text-4xl md:text-5xl font-black text-white uppercase mb-4 leading-tight">
                Objetivos de la Norma
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed">
                El objetivo principal es proteger a los trabajadores de los peligros, previniendo incidentes desde el diseño hasta la operación.
              </p>
            </div>

            <div className="lg:w-2/3 space-y-6">
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 md:p-10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1">
                <h3 className="font-title text-2xl text-blue-400 font-bold uppercase mb-3">01. Protección Integral</h3>
                <p className="text-lg">Proteger a los trabajadores de los peligros de la maquinaria, y prevenir accidentes, incidentes y problemas de salud derivados de su uso en el trabajo.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 md:p-10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1">
                <h3 className="font-title text-2xl text-blue-400 font-bold uppercase mb-3">02. Diseño Seguro</h3>
                <p className="text-lg">Asegurarse de que toda la maquinaria destinada a ser utilizada esté diseñada y construida para eliminar o reducir al mínimo los peligros asociados.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 md:p-10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1">
                <h3 className="font-title text-2xl text-blue-400 font-bold uppercase mb-3">03. Capacitación Efectiva</h3>
                <p className="text-lg">Asegurarse de que los empleadores dispongan de capacitación y adiestramiento prioritario, basado en la información sobre seguridad proporcionada por el proveedor.</p>
              </div>
              <div className="bg-white/5 backdrop-blur-lg border border-white/10 p-8 md:p-10 rounded-2xl hover:bg-white/10 hover:border-blue-500/30 transition-all duration-500 hover:-translate-y-1">
                <h3 className="font-title text-2xl text-blue-400 font-bold uppercase mb-3">04. Control del Entorno</h3>
                <p className="text-lg">Asegurarse de que se aplican las medidas de seguridad y salud apropiadas en el lugar de trabajo con el fin de identificar, eliminar, prevenir y controlar los riesgos.</p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* 3. JERARQUÍA DE CONTROLES */}
      <AnimatedSection>
        <div className="relative py-24 overflow-hidden border-b border-white/10">
          <div 
            className="absolute inset-0 bg-fixed bg-center bg-cover"
            style={{ backgroundImage: `url(${jerarquiaBg})` }}
          ></div>
          <div className="absolute inset-0 bg-[#00102a]/95 mix-blend-multiply"></div>
          
          <div className="relative z-10 max-w-7xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="font-title text-4xl md:text-5xl font-black text-white uppercase tracking-wide">Jerarquía de Controles</h2>
              <p className="mt-4 text-xl text-blue-200">El riesgo nunca se elimina al 100%, pero se neutraliza por orden de prioridad.</p>
            </div>
            <div className="flex flex-col items-center gap-3 w-full max-w-4xl mx-auto font-title font-bold uppercase tracking-widest text-sm md:text-base">
              <div className="w-full bg-green-500/10 border border-green-500/50 text-green-400 py-4 text-center rounded-t-xl hover:scale-105 transition-transform cursor-default shadow-lg">1. Eliminación</div>
              <div className="w-11/12 bg-lime-500/10 border border-lime-500/50 text-lime-400 py-4 text-center hover:scale-105 transition-transform cursor-default shadow-lg">2. Sustitución</div>
              <div className="w-10/12 bg-yellow-500/10 border border-yellow-500/50 text-yellow-400 py-4 text-center hover:scale-105 transition-transform cursor-default shadow-lg">3. Controles Técnicos</div>
              <div className="w-9/12 bg-orange-500/10 border border-orange-500/50 text-orange-400 py-4 text-center hover:scale-105 transition-transform cursor-default shadow-lg">4. Controles Administrativos</div>
              <div className="w-8/12 bg-red-500/10 border border-red-500/50 text-red-400 py-4 text-center rounded-b-xl hover:scale-105 transition-transform cursor-default shadow-lg">5. Equipo de Protección Personal</div>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* 4. PROCESO ITERATIVO */}
      <AnimatedSection>
        <div className="max-w-7xl mx-auto px-6 py-24 border-b border-white/5">
          <div className="text-center mb-16">
            <h2 className="font-title text-3xl md:text-4xl font-black text-white uppercase mb-4">Proceso Iterativo de Evaluación</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">Metodología sistemática para la reducción de riesgos en la maquinaria.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
            <div className="hidden lg:block absolute top-1/2 left-0 w-full h-0.5 bg-blue-900/50 -z-10"></div>
            {[
              { num: "A", title: "Determinar Usos", desc: "Identificar todos los posibles usos de la maquinaria, tanto previstos como el uso indebido razonablemente previsible." },
              { num: "B", title: "Identificar Peligros", desc: "Detectar situaciones peligrosas que pudiera ocasionar el uso, previsto o indebido, de tal maquinaria." },
              { num: "C", title: "Eliminar", desc: "Erradicar todos los peligros identificados siempre que sea razonablemente factible desde el diseño." },
              { num: "D", title: "Estimar Riesgos", desc: "Evaluar teniendo en cuenta la gravedad de una posible lesión para la salud y la probabilidad de que ocurra." },
              { num: "E", title: "Evaluar Nivel", desc: "Determinar si el nivel de riesgo se controla de manera adecuada o si es preciso aplicar más controles." },
              { num: "F", title: "Reducir Riesgos", desc: "Minimizar los riesgos identificados mediante la aplicación estricta de medidas de protección y barreras." }
            ].map((paso, index) => (
              <div key={index} className="bg-white/5 border border-white/10 p-8 rounded-2xl hover:bg-white/10 hover:border-blue-500/50 transition-all duration-300 hover:-translate-y-1 group">
                <div className="text-5xl font-title font-black text-blue-900/50 group-hover:text-blue-500 transition-colors mb-4">{paso.num}</div>
                <h3 className="font-title text-xl font-bold text-white uppercase mb-3">{paso.title}</h3>
                <p className="text-gray-400 text-sm leading-relaxed">{paso.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </AnimatedSection>

      {/* 5. RESPONSABILIDADES DEL EMPLEADOR (CON IMAGEN MÁS CLARA Y VISIBLE) */}
      <AnimatedSection>
        <div className="relative py-24 overflow-hidden border-b border-white/5">
          {/* Imagen de fondo ajustada al 65% de opacidad sin blend oscuro */}
          <div 
            className="absolute inset-0 bg-fixed bg-center bg-cover opacity-65"
            style={{ backgroundImage: `url(${responsabilidadesBg})` }}
          ></div>

          {/* Degradado suavizado para equilibrar contraste y legibilidad */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f16]/75 via-[#0a0f16]/50 to-[#0a0f16]/80"></div>

          <div className="relative z-10 max-w-7xl mx-auto px-6">
            <h2 className="font-title text-3xl md:text-4xl font-black text-white uppercase text-center mb-16 drop-shadow-lg">
              RESPONSABILIDADES DEL EMPLEADOR
            </h2>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row">
              <div className="w-full md:w-1/3 bg-[#0a0f16]/70 p-6 flex flex-col justify-center border-b md:border-b-0 md:border-r border-white/10">
                {responsabilidades.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveSlide(index)}
                    className={`text-left px-6 py-4 rounded-xl font-title uppercase font-bold text-sm transition-all duration-300 mb-2 flex items-center gap-3 ${
                      activeSlide === index 
                        ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]' 
                        : 'text-gray-400 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <span className={`${activeSlide === index ? 'text-white' : 'text-gray-400'}`}>{item.icon}</span>
                    {item.titulo}
                  </button>
                ))}
              </div>

              <div className="w-full md:w-2/3 p-10 md:p-16 flex flex-col justify-center min-h-[300px]">
                <div className="text-blue-400 mb-6 transition-all duration-500">{responsabilidades[activeSlide].icon}</div>
                <h3 className="font-title text-3xl font-bold text-white mb-4 transition-all duration-500">
                  {responsabilidades[activeSlide].titulo}
                </h3>
                <p className="text-xl text-gray-200 leading-relaxed font-light transition-all duration-500">
                  {responsabilidades[activeSlide].desc}
                </p>
              </div>
            </div>
          </div>
        </div>
      </AnimatedSection>
      {/* 6. SEGURIDAD Y SALUD EN LA MAQUINARIA */}
      <AnimatedSection>
        <div className="max-w-7xl mx-auto px-6 py-24">
          <h2 className="font-title text-3xl md:text-4xl font-black text-white uppercase text-center mb-6">
            Seguridad y Salud en la Maquinaria
          </h2>
          <p className="text-center text-gray-400 mb-16 max-w-3xl mx-auto">
            La empresa es responsable de designar a personas competentes para controlar los riesgos mediante las siguientes tareas operativas:
          </p>
          
          <div className="bg-white/5 border border-white/10 rounded-3xl overflow-hidden relative shadow-2xl flex flex-col lg:flex-row h-auto lg:h-[500px]">
            <div className="w-full lg:w-2/5 bg-[#0a0f16]/50 p-4 border-b lg:border-b-0 lg:border-r border-white/10 overflow-y-auto max-h-[300px] lg:max-h-full scrollbar-thin scrollbar-thumb-blue-600 scrollbar-track-transparent">
              {seguridadSalud.map((item, index) => (
                <button
                  key={index}
                  onClick={() => setActiveSecurity(index)}
                  className={`w-full text-left px-6 py-4 rounded-xl font-title uppercase font-bold text-sm transition-all duration-300 mb-2 flex items-center gap-3 ${
                    activeSecurity === index 
                      ? 'bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.2)]' 
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                  }`}
                >
                  <span className="opacity-70">{item.icon}</span>
                  <span className="truncate">{item.titulo}</span>
                </button>
              ))}
            </div>

            <div className="w-full lg:w-3/5 p-8 md:p-16 flex flex-col justify-center bg-gradient-to-br from-transparent to-blue-900/10">
              <div className="text-blue-500 mb-8 bg-blue-500/10 w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-500">
                {seguridadSalud[activeSecurity].icon}
              </div>
              <h3 className="font-title text-3xl md:text-4xl font-bold text-white mb-6 uppercase transition-all duration-500">
                {seguridadSalud[activeSecurity].titulo}
              </h3>
              <p className="text-lg md:text-xl text-gray-300 leading-relaxed font-light transition-all duration-500">
                {seguridadSalud[activeSecurity].desc}
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>

      {/* 7. CALL TO ACTION FINAL (LA TEORÍA TERMINA AQUÍ - CON NUEVO FONDO) */}
      <AnimatedSection>
        <div className="relative w-full py-24 text-center px-6 mt-10 overflow-hidden border-t border-blue-500/30">
          {/* Imagen de Fondo con mezcla suave */}
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40 mix-blend-overlay"
            style={{ backgroundImage: `url(${ctaBg})` }}
          ></div>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-950/90 via-blue-900/85 to-blue-950/90"></div>

          <div className="relative z-10 max-w-4xl mx-auto">
            <h2 className="font-title text-4xl md:text-5xl font-black text-white uppercase tracking-tight mb-6 drop-shadow-lg">
              La Teoría Termina Aquí.
            </h2>
            <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto font-light drop-shadow-md">
              Es momento de llevar estos lineamientos a la práctica. Inicia la evaluación interactiva de tu maquinaria ahora mismo.
            </p>
            <Link 
              to="/formulario" 
              className="inline-block bg-[#0a0f16] text-white font-title font-bold text-lg uppercase tracking-wider py-4 px-10 rounded-full hover:bg-black transition-all hover:scale-105 shadow-[0_10px_30px_rgba(0,0,0,0.6)] border border-white/20"
            >
              Iniciar Análisis NOM-004
            </Link>
          </div>
        </div>
      </AnimatedSection>

    </div>
  );
}