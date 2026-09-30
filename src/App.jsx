import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import About004 from './pages/About004';
import Formulario from './pages/Formulario';

// Componente temporal para evitar el ReferenceError mientras creamos el archivo real
const Analisisdatos = () => (
  <div className="max-w-4xl mx-auto p-12 text-center font-title text-2xl font-bold text-slate-700">
    Pantalla de Análisis de Riesgo de Maquinaria
  </div>
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-slate-50 font-body">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sobre-nom004" element={<About004 />} />
            <Route path="/formulario" element={<Formulario />} />
            <Route path="/analisis-datos" element={<Analisisdatos />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}