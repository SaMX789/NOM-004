import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Landing from './pages/Landing';
import About004 from './pages/About004';
import Formulario from './pages/Formulario';
import Analisisdatos from './pages/Analisisdatos';
import MisEquipos from './pages/MisEquipos'; // 👈 1. Importar la nueva página

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <div className="min-h-screen flex flex-col bg-slate-50 font-body">
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/sobre-nom004" element={<About004 />} />
            <Route path="/formulario" element={<Formulario />} />
            <Route path="/analisis-datos" element={<Analisisdatos />} />
            <Route path="/mis-equipos" element={<MisEquipos />} /> {/* 👈 2. Nueva ruta */}
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
}