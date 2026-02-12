// src/components/Login.tsx
import { useState, useRef } from 'react'; // CORREGIDO: Se eliminó useEffect
import { auth, googleProvider } from '../services/firebase';
import { signInWithPopup, signInWithEmailAndPassword } from 'firebase/auth';
// Importación del sistema de diseño (Asegúrate de que la ruta ./design/AtlasDesignSystem sea correcta)
import { AtlasCard, AtlasButton, AtlasIcons, AtlasText } from './design/AtlasDesignSystem';

export default function Login() {
  // --- ESTADOS DE LA INTERFAZ ---
  // 'waiting': Pantalla negra esperando click (para desbloquear audio)
  // 'playing': Reproduciendo video intro
  // 'login': Formulario de acceso visible
  const [viewState, setViewState] = useState<'waiting' | 'playing' | 'login'>('waiting');
  
  // --- ESTADOS DEL FORMULARIO ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Referencia al reproductor de video para controlarlo
  const videoRef = useRef<HTMLVideoElement>(null);

  // --- MANEJO DEL VIDEO INTRO ---

  const startSystem = () => {
    setViewState('playing');
    // Pequeño timeout para asegurar que el renderizado cambió a 'playing' antes de dar play
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch(e => console.error("Error reproduciendo video:", e));
        videoRef.current.volume = 1.0; // Volumen al máximo
      }
    }, 100);
  };

  const handleVideoEnd = () => {
    // Efecto de transición suave al login
    setViewState('login');
  };

  // --- LÓGICA DE LOGIN ---

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') setError('Credenciales inválidas.');
      else if (err.code === 'auth/wrong-password') setError('Contraseña incorrecta.');
      else setError('Error de conexión.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error(err);
      setError('Error al autenticar con Google.');
    } finally {
      setLoading(false);
    }
  };

  // ===========================================================================
  // RENDERIZADO
  // ===========================================================================

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center relative overflow-hidden font-sans text-slate-200">
      
      {/* -----------------------------------------------------
          ESCENA 1: BOTÓN "INICIAR SISTEMA" (WAITING)
      ----------------------------------------------------- */}
      {viewState === 'waiting' && (
        <div className="z-50 text-center animate-pulse cursor-pointer" onClick={startSystem}>
            <div className="w-24 h-24 mx-auto mb-6 rounded-full border border-cyan-500/50 flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.5)] bg-slate-900/50 backdrop-blur-sm group hover:scale-110 transition-transform duration-500">
                <span className="text-4xl">⚡</span>
            </div>
            <h1 className="text-2xl font-bold text-cyan-500 tracking-[0.3em] uppercase mb-2">
                MENTAL NEXUS
            </h1>
            <button 
                className="mt-8 px-8 py-3 border border-slate-400 text-slate-400 text-sm hover:bg-slate-200 hover:text-slate-900 transition-all duration-300 tracking-widest uppercase font-mono"
            >
                INICIAR SISTEMA
            </button>
        </div>
      )}

      {/* -----------------------------------------------------
          ESCENA 2: VIDEO PLAYER (PLAYING)
      ----------------------------------------------------- */}
      <div className={`absolute inset-0 z-40 bg-black transition-opacity duration-1000 ${viewState === 'playing' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <video 
            ref={videoRef}
            className="w-full h-full object-contain md:object-cover"
            onEnded={handleVideoEnd}
            playsInline
            src="/assets/intro_nexus.mp4" 
        />
        {/* Botón para saltar intro */}
        {viewState === 'playing' && (
            <button 
                onClick={handleVideoEnd}
                className="absolute bottom-8 right-8 text-slate-500 text-xs uppercase tracking-widest hover:text-white border-b border-transparent hover:border-white transition-all opacity-50 hover:opacity-100"
            >
                Saltar Secuencia ⏭
            </button>
        )}
      </div>

      {/* -----------------------------------------------------
          ESCENA 3: LOGIN FORM (LOGIN)
      ----------------------------------------------------- */}
      
      {/* Fondo ambiental */}
      <div className={`absolute inset-0 transition-opacity duration-2000 ${viewState === 'login' ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none"></div>
          <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-blue-600/10 rounded-full blur-[100px] pointer-events-none"></div>
      </div>

      {/* Tarjeta de Login */}
      <div className={`w-full max-w-md z-30 transition-all duration-1000 transform ${viewState === 'login' ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-95 pointer-events-none'}`}>
        
        <AtlasCard className="border-t-4 border-t-cyan-500">
            
            {/* Cabecera */}
            <div className="flex flex-col items-center mb-8">
                <div className="w-20 h-20 mb-4 relative group">
                    <div className="absolute inset-0 bg-cyan-500/50 blur-xl opacity-0 group-hover:opacity-50 transition-opacity duration-500"></div>
                    <img 
                        src="/assets/logo_nexus.png" 
                        alt="Logo" 
                        className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                        onError={(e) => {
                            // Fallback si la imagen no existe
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).parentElement!.innerHTML = '<span class="text-4xl">🧠</span>';
                        }}
                    />
                </div>
                <h1 className="text-3xl font-bold text-white tracking-widest uppercase font-mono">
                    MENTAL <span className="text-cyan-500">NEXUS</span>
                </h1>
                <AtlasText variant="code" className="mt-1 opacity-70">
                    ACCESO SEGURO
                </AtlasText>
            </div>

            {/* Formulario */}
            <form onSubmit={handleEmailLogin} className="space-y-5">
                
                {/* Email */}
                <div className="group">
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors">
                            <AtlasIcons.User />
                        </div>
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all"
                            placeholder="IDENTIFICADOR (EMAIL)"
                        />
                    </div>
                </div>

                {/* Password */}
                <div className="group">
                    <div className="relative">
                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-cyan-500 transition-colors">
                            <AtlasIcons.Lock />
                        </div>
                        <input
                            type="password"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-lg py-3 pl-10 pr-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_10px_rgba(6,182,212,0.3)] transition-all"
                            placeholder="CÓDIGO DE ACCESO"
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-red-900/20 border border-red-500/50 text-red-200 text-xs p-2 rounded flex items-center gap-2 animate-pulse">
                        <AtlasIcons.Shield className="w-4 h-4 text-red-500" />
                        {error}
                    </div>
                )}

                <div className="space-y-3 pt-2">
                    <AtlasButton type="submit" variant="primary" className="w-full py-3 shadow-lg" isLoading={loading}>
                        {loading ? 'VERIFICANDO...' : 'ACCEDER'}
                    </AtlasButton>

                    <div className="relative flex py-2 items-center">
                        <div className="flex-grow border-t border-slate-700"></div>
                        <span className="flex-shrink-0 mx-4 text-slate-500 text-[10px] uppercase">Protocolos Alternativos</span>
                        <div className="flex-grow border-t border-slate-700"></div>
                    </div>

                    <AtlasButton 
                        type="button" 
                        onClick={handleGoogleLogin} 
                        variant="secondary" 
                        className="w-full"
                        disabled={loading}
                    >
                        <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 mr-2" alt="G" />
                        ACCEDER CON GOOGLE
                    </AtlasButton>
                </div>
            </form>

        </AtlasCard>
      </div>
      
      {/* Footer Status */}
      <div className={`absolute bottom-4 text-[10px] text-slate-500 font-mono flex items-center gap-2 transition-opacity duration-1000 ${viewState === 'login' ? 'opacity-100' : 'opacity-0'}`}>
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          SYSTEM READY v2.1
      </div>

    </div>
  );
}