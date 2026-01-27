// src/components/Login.tsx
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";

export default function Login() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error al entrar:", error);
      alert("Error de conexión. Revisa la consola.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      {/* Usamos la clase maestra 'nexus-card' que creamos */}
      <div className="nexus-card max-w-md w-full text-center py-12 px-8 border-t-4 border-nexus-cyan">
        
        {/* Efecto de Logo (Círculo brillante) */}
        <div className="mx-auto w-20 h-20 bg-nexus-dark rounded-full flex items-center justify-center mb-6 shadow-glow-cyan border border-nexus-cyan">
          <span className="text-3xl">🧠</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2 tracking-wider">
          MENTAL <span className="text-nexus-cyan">NEXUS</span>
        </h1>
        
        <p className="text-nexus-muted mb-8 text-sm uppercase tracking-widest">
          Mind. Connected. Evolve.
        </p>

        <button onClick={handleLogin} className="btn-primary w-full shadow-glow-cyan">
          <span className="text-xl">G</span>
          Acceder con Google
        </button>

        <p className="mt-6 text-xs text-slate-500">
          Sistema Clínico & Gamificación Avanzada
        </p>
      </div>
    </div>
  );
}