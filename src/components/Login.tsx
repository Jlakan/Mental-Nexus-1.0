// src/components/Login.tsx
import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../services/firebase";

export default function Login() {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Error al entrar:", error);
      alert("Hubo un error al conectar con Google. Revisa tu consola.");
    }
  };

  return (
    <div style={{ textAlign: 'center', marginTop: '100px', fontFamily: 'sans-serif' }}>
      <h1>Bienvenido a Mental Nexus</h1>
      <p>Plataforma de gestión clínica y tareas terapéuticas</p>

      <button
        onClick={handleLogin}
        style={{
          padding: '12px 24px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#4285F4',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        Ingresar con Google
      </button>
    </div>
  );
}