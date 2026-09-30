export default function Footer() {
  return (
    <footer className="bg-[#111827] text-gray-300 py-12 border-t-4 border-[#002060]">
      <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-10 text-sm">
        
        {/* Columna 1: Enlaces */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Enlaces útiles</h3>
          <ul className="space-y-2">
            <li className="hover:text-white cursor-pointer transition">Consultoría</li>
            <li className="hover:text-white cursor-pointer transition">Reclutamiento y Selección</li>
            <li className="hover:text-white cursor-pointer transition">Capacitacion</li>
            <li className="hover:text-white cursor-pointer transition">Red de profesionistas</li>
          </ul>
        </div>

        {/* Columna 2: Sobre nosotros */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Sobre nosotros</h3>
          <p className="mb-4 leading-relaxed">
            AS Consultoría Integral (ASCI) es un ecosistema empresarial enfocado en consultoría, capacitación y gestión operativa, que integra personas, procesos y tecnología para el cumplimiento normativo y la mejora continua.
          </p>
          <p className="leading-relaxed">
            Este portal forma parte del <strong className="text-white">modelo operativo ASCI 5.0</strong> y funciona como punto de acceso al ecosistema, permitiendo la interacción entre colaboradores, consultores y clientes según su rol.
          </p>
        </div>

        {/* Columna 3: Contacto */}
        <div>
          <h3 className="text-white font-bold text-base mb-4">Contáctenos</h3>
          <ul className="space-y-3">
            <li className="flex items-center gap-2">💬 Contáctanos</li>
            <li className="flex items-center gap-2">✉️ hola@asconsultoriaintegral.com</li>
            <li className="flex items-center gap-2">📞 (33) 3458 9378</li>
          </ul>
          
          {/* Iconos Redes Sociales */}
          <div className="flex gap-3 mt-6">
            <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-gray-200">f</div>
            <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-gray-200">ig</div>
            <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-gray-200">in</div>
            <div className="w-8 h-8 bg-white text-slate-900 rounded-full flex items-center justify-center font-bold cursor-pointer hover:bg-gray-200">🌐</div>
          </div>
        </div>

      </div>
    </footer>
  );
}