import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';

// Componentes temporales (los crearemos después)
const InstruccionesTemp = () => <div className="p-12 text-center text-2xl min-h-[500px]">Pantalla de Datos Empresariales en construcción...</div>;
const FormularioTemp = () => <div className="p-12 text-center text-2xl min-h-[500px]">Pantalla de Formulario en construcción...</div>;

export default function App() {
  return (
    <BrowserRouter>
      {/* El contenedor principal usa flexbox para asegurar que el footer siempre baje al final */}
      <div className="min-h-screen flex flex-col bg-slate-50 font-body">
        
        <Navbar />

        {/* Contenido dinámico de las páginas */}
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/instrucciones" element={<InstruccionesTemp />} />
            <Route path="/formulario" element={<FormularioTemp />} />
          </Routes>
        </main>

        <Footer />
        
      </div>
    </BrowserRouter>
  );
}