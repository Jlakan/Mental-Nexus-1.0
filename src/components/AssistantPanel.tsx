import React, { useState, useEffect } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, arrayUnion, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // IMPORTANTE: Agregamos esto
import { auth, db } from '../services/firebase';

interface Props {
  onSelectProfessional: (profId: string) => void;
}

export default function AssistantPanel({ onSelectProfessional }: Props) {
  // Estado para la lista de doctores vinculados
  const [myDoctors, setMyDoctors] = useState<any[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Estado para el formulario de vincular nuevo
  const [code, setCode] = useState('');
  const [isLinking, setIsLinking] = useState(false);
  const [msg, setMsg] = useState('');
  
  // Estado local del usuario para asegurar sincronización
  const [currentUser, setCurrentUser] = useState<any>(null);

  // 1. EFECTO DE CARGA BLINDADO
  useEffect(() => {
    // Usamos el listener oficial para estar 100% seguros de que el usuario existe
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser(user);
        fetchMyDoctors(user.uid);
      } else {
        // Si no hay usuario, quitamos el loading para no bloquear la pantalla
        setLoadingList(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchMyDoctors = async (uid: string) => {
    try {
      // Buscamos profesionales donde mi UID esté en su lista 'authorizedAssistants'
      const q = query(
        collection(db, "professionals"), 
        where("authorizedAssistants", "array-contains", uid)
      );
      const snap = await getDocs(q);
      
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setMyDoctors(list);
    } catch (error) {
      console.error("Error cargando lista:", error);
    } finally {
      // ESTO AHORA SIEMPRE SE EJECUTA
      setLoadingList(false);
    }
  };

  // 2. Lógica de Vinculación
  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return; // Usamos el estado local seguro
    
    setIsLinking(true);
    setMsg('📡 Buscando señal...');

    try {
      // A. Buscar código (Normalizamos a mayúsculas y sin espacios)
      const cleanCode = code.trim().toUpperCase();
      const q = query(collection(db, "professionals"), where("professionalCode", "==", cleanCode));
      const snap = await getDocs(q);

      if (snap.empty) {
        setMsg('❌ Código no encontrado o incorrecto.');
        setIsLinking(false);
        return;
      }
      
      const profDoc = snap.docs[0];
      
      // B. Validar duplicados
      if (myDoctors.find(d => d.id === profDoc.id)) {
        setMsg('⚠️ Ya estás vinculado a este profesional.');
        setIsLinking(false);
        return;
      }

      // C. Escribir en la BD (Vincular)
      await updateDoc(doc(db, "professionals", profDoc.id), {
        authorizedAssistants: arrayUnion(currentUser.uid)
      });
      
      // Asegurar que el usuario tenga rol 'assistant' en su perfil
      await setDoc(doc(db, "users", currentUser.uid), { role: 'assistant' }, { merge: true });

      setMsg('✅ ¡Vinculado correctamente!');
      setCode('');
      
      // D. Recargar la lista visualmente
      await fetchMyDoctors(currentUser.uid);

    } catch (error) {
      console.error(error);
      setMsg('❌ Error del sistema.');
    } finally {
      setIsLinking(false);
    }
  };

  if (loadingList) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-cyan-400 animate-pulse font-mono flex flex-col items-center gap-2">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        CARGANDO DOCTORES...
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white p-6 md:p-12 font-sans w-full">
      
      <header className="max-w-6xl mx-auto mb-12 border-b border-slate-800 pb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            Panel de Asistencia <span className="text-cyan-400">.NEXUS</span>
          </h1>
          <p className="text-slate-400">Gestión centralizada de agendas médicas.</p>
        </div>
        <button onClick={() => auth.signOut()} className="text-red-400 hover:text-red-300 text-xs font-bold uppercase tracking-widest border border-red-900/50 px-4 py-2 rounded hover:bg-red-900/20 transition-all">
          Cerrar Sesión
        </button>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA (2/3): LISTA DE DOCTORES */}
        <div className="lg:col-span-2 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
            <span>🥼</span> Profesionales Asignados
          </h2>

          {myDoctors.length === 0 ? (
            <div className="border-2 border-dashed border-slate-700 bg-slate-800/30 rounded-xl p-12 text-center">
              <div className="text-5xl mb-4 grayscale opacity-50">📭</div>
              <p className="text-slate-300 font-bold mb-2">No tienes agendas vinculadas.</p>
              <p className="text-sm text-slate-500">Pide el "Código de Profesional" a tu médico e ingrésalo a la derecha.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {myDoctors.map(doc => (
                <div 
                  key={doc.id}
                  onClick={() => onSelectProfessional(doc.id)}
                  className="bg-slate-800 border border-slate-700 p-6 rounded-xl cursor-pointer hover:border-cyan-400 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] group transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-100 transition-opacity text-cyan-400">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-12 h-12">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0h18M5.25 12h13.5h-13.5zm0 0l-2.25 2.25M5.25 12l-2.25-2.25" />
                    </svg>
                  </div>
                  
                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {doc.fullName || 'Dr. Sin Nombre'}
                  </h3>
                  <div className="text-sm text-slate-400 mb-6">{doc.professionType || 'Especialista'}</div>
                  
                  <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 uppercase tracking-wider font-bold">
                    <span>Acceder a Agenda</span>
                    <span className="group-hover:translate-x-2 transition-transform">→</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA (1/3): FORMULARIO DE REGISTRO */}
        <div className="lg:col-span-1">
          <div className="bg-slate-800/50 border border-slate-700 p-6 rounded-xl sticky top-6 backdrop-blur-sm">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-2">
              <span>🔗</span> Nueva Vinculación
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Ingresa el código único del médico (ej: <span className="text-purple-400 font-mono">X9P2Z1</span>) para gestionar sus pacientes.
            </p>

            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label className="text-[10px] text-purple-400 font-bold uppercase tracking-widest mb-1 block">Código de Acceso</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="EJ: X9P2Z1"
                  maxLength={10}
                  className="w-full bg-slate-900 border border-slate-700 text-center text-xl py-3 rounded-lg text-white placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 font-mono uppercase tracking-widest transition-all"
                />
              </div>

              <button 
                type="submit"
                disabled={isLinking || !code}
                className="w-full py-3 rounded-lg font-bold uppercase tracking-wider text-sm transition-all bg-purple-600 hover:bg-purple-500 text-white shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
              >
                {isLinking ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    Conectando...
                  </>
                ) : (
                  'Vincular Agenda'
                )}
              </button>
            </form>

            {msg && (
              <div className={`mt-4 p-3 rounded-lg text-xs font-bold text-center border animate-in fade-in slide-in-from-top-2 ${msg.includes('✅') ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
                {msg}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}