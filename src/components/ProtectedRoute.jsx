import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading, loginWithGoogle } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-[#002060] rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto my-20 bg-white border border-slate-200 rounded-2xl shadow-xl p-8 text-center">
        <h2 className="font-title text-2xl font-black text-[#002060] uppercase mb-3">
          Inicia sesión para continuar
        </h2>
        <p className="text-slate-600 text-sm mb-6">
          Para guardar tus estudios y usar el análisis con IA necesitas acceder con tu cuenta de Google.
        </p>
        <button
          type="button"
          onClick={loginWithGoogle}
          className="w-full bg-[#002060] hover:bg-[#003087] text-white font-bold py-3 px-6 rounded-xl transition"
        >
          Iniciar sesión con Google
        </button>
      </div>
    );
  }

  return children;
}

