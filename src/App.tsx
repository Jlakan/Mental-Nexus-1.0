import { useState, useEffect } from 'react';

// --- FIREBASE IMPORTS ---
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

// --- COMPONENTES ---
import Login from './components/Login';
import RoleSelection from './components/RoleSelection';

// Componentes de Paciente
import PatientRegister from './components/PatientRegister';
import PatientDashboard from './components/PatientDashboard';

// Componentes de Profesional
import ProfessionalRegister from './components/ProfessionalRegister';
import ProfessionalDashboard from './components/ProfessionalDashboard';

// Componentes de Admin
import AdminPanel from './components/AdminPanel';

// Componentes de Asistente
import AssistantRegister from './components/AssistantRegister';
import AssistantPanel from './components/AssistantPanel';
import AgendaView from './components/agenda';

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. ESTADOS
  // ---------------------------------------------------------------------------
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null); // Aquí viene el campo isAdmin
  const [loading, setLoading] = useState(true);

  // Estados de Verificación de Perfil
  const [profileCompleted, setProfileCompleted] = useState(false);
  const [isRegisteredPro, setIsRegisteredPro] = useState(false);
  const [isRegisteredAssistant, setIsRegisteredAssistant] = useState(false);

  // Estados de Navegación / Desarrollo
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'professional'>('admin');
  
  // Persistencia del doctor seleccionado (LocalStorage) para Asistentes
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(() => {
    return localStorage.getItem('nexus_assistant_selected_doc');
  });

  // ---------------------------------------------------------------------------
  // 2. EFECTO DE CARGA Y AUTENTICACIÓN
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true);
      if (currentUser) {
        setUser(currentUser);
        // Buscar datos maestros en users/{UID}
        const userRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(userRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setUserData(data);

          // Verificar sub-perfiles según el rol
          if (data.role === 'patient') {
            setProfileCompleted(data.profileCompleted === true);
          } 
          else if (data.role === 'professional') {
            const proRef = doc(db, 'professionals', currentUser.uid);
            const proSnap = await getDoc(proRef);
            setIsRegisteredPro(proSnap.exists());
          } 
          else if (data.role === 'assistant') {
            const assistantRef = doc(db, 'assistants', currentUser.uid);
            const assistantSnap = await getDoc(assistantRef);
            setIsRegisteredAssistant(assistantSnap.exists());
          }
        }
      } else {
        setUser(null);
        setUserData(null);
        localStorage.removeItem('nexus_assistant_selected_doc');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // ---------------------------------------------------------------------------
  // 3. HANDLERS
  // ---------------------------------------------------------------------------
  
  const handleRoleSelect = async (role: 'patient' | 'professional' | 'assistant') => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.uid), {
        role: role,
        email: user.email,
        updatedAt: new Date()
      }, { merge: true });
      window.location.reload();
    } catch (error) {
      console.error("Error asignando rol:", error);
    }
  };

  const handleSelectDoctor = (profId: string | null) => {
    setSelectedDoctorId(profId);
    if (profId) {
        localStorage.setItem('nexus_assistant_selected_doc', profId);
    } else {
        localStorage.removeItem('nexus_assistant_selected_doc');
    }
  };

  // ---------------------------------------------------------------------------
  // 4. RENDERIZADO
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-cyan-400">
        <div className="animate-spin text-4xl mb-4">⚛️</div>
        <p className="tracking-widest animate-pulse">CARGANDO NEXUS...</p>
      </div>
    );
  }

  if (!user) return <Login />;
  
  if (!userData?.role) {
    return <RoleSelection userName={user.displayName || 'Usuario'} onSelect={handleRoleSelect} />;
  }

  // Si hay un rol simulado (Dev Mode), úsalo. Si no, usa el real.
  const activeRole = simulatedRole || userData.role;

  // --- ROL: PACIENTE ---
  if (activeRole === 'patient') {
      return (
        <>
            {profileCompleted ? (
                <PatientDashboard user={user} />
            ) : (
                <PatientRegister onComplete={() => setProfileCompleted(true)} />
            )}
            
            {/* SOLO SI ES ADMIN MUESTRA EL SWITCHER */}
            {userData?.isAdmin && <DevRoleSwitcher onSwitch={setSimulatedRole} />}
        </>
      );
  }

  // --- ROL: PROFESIONAL ---
  if (activeRole === 'professional') {
      return (
        <>
            {isRegisteredPro ? <ProfessionalDashboard user={user} /> : <ProfessionalRegister />}
            
            {/* SOLO SI ES ADMIN MUESTRA EL SWITCHER */}
            {userData?.isAdmin && <DevRoleSwitcher onSwitch={setSimulatedRole} />}
        </>
      );
  }

  // --- ROL: ASISTENTE ---
  if (activeRole === 'assistant') {
      return (
        <>
            {!isRegisteredAssistant ? (
                <AssistantRegister />
            ) : (
                <div className="flex flex-col h-screen bg-slate-950">
                    {selectedDoctorId && (
                    <div className="fixed top-4 left-4 z-50">
                        <button 
                        onClick={() => handleSelectDoctor(null)}
                        className="bg-slate-800/80 backdrop-blur text-purple-300 border border-purple-500/30 px-4 py-2 rounded-lg hover:bg-slate-700 transition-all flex items-center gap-2 shadow-lg"
                        >
                        <span>⬅</span> Volver a mis Doctores
                        </button>
                    </div>
                    )}

                    {selectedDoctorId ? (
                    <AgendaView 
                        userRole="assistant"
                        currentUserId={user.uid}
                        doctorId={selectedDoctorId}
                        onBack={() => handleSelectDoctor(null)} 
                    />
                    ) : (
                    <AssistantPanel onSelectProfessional={handleSelectDoctor} />
                    )}
                </div>
            )}
            
            {/* SOLO SI ES ADMIN MUESTRA EL SWITCHER */}
            {userData?.isAdmin && <DevRoleSwitcher onSwitch={setSimulatedRole} />}
        </>
      );
  }

  // --- ROL: ADMIN ---
  if (activeRole === 'admin') {
      return (
        <div className="relative min-h-screen">
            {userData?.isAdmin === true && (
                <div className="fixed bottom-6 right-20 z-40">
                    <button 
                        onClick={() => setAdminViewMode(prev => prev === 'admin' ? 'professional' : 'admin')}
                        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl flex items-center justify-center text-2xl border-2 border-white transition-transform hover:scale-110"
                        title={adminViewMode === 'admin' ? "Ver como Profesional" : "Volver a Admin"}
                    >
                        {adminViewMode === 'admin' ? '👨‍⚕️' : '🛠'}
                    </button>
                </div>
            )}
            {adminViewMode === 'admin' ? <AdminPanel /> : <ProfessionalDashboard user={user} />}
            
            {/* SOLO SI ES ADMIN MUESTRA EL SWITCHER */}
            {userData?.isAdmin && <DevRoleSwitcher onSwitch={setSimulatedRole} />}
        </div>
      );
  }

  // --- FALLBACK (Rol Desconocido) ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center">
      <h1 className="text-3xl text-red-500 font-bold mb-4">⚠️ Rol Desconocido</h1>
      <p className="mb-6 text-slate-400">Rol detectado: <strong>"{activeRole}"</strong></p>
      
      <button
        onClick={async () => {
          if(!window.confirm("¿Seguro que deseas restablecer tu rol?")) return;
          await setDoc(doc(db, "users", user.uid), { role: null }, { merge: true });
          window.location.reload();
        }}
        className="px-6 py-2 bg-red-600 rounded font-bold mb-4 hover:bg-red-500 transition"
      >
        🔄 Restablecer Cuenta
      </button>

      {/* Botón de Cerrar Sesión conservado */}
      <button onClick={() => auth.signOut()} className="underline text-slate-500 hover:text-white mt-4">
        Cerrar Sesión
      </button>
    </div>
  );
}

// Componente auxiliar para desarrollo con estilos detallados conservados
function DevRoleSwitcher({ onSwitch }: { onSwitch: (r: string | null) => void }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] group">
      <div className="bg-slate-900/90 border border-cyan-500/30 p-2 rounded-lg backdrop-blur-md shadow-2xl opacity-60 hover:opacity-100 transition-all">
        <div className="text-[10px] text-cyan-400 font-bold mb-1 text-center hidden group-hover:block">DEV MODE</div>
        <div className="flex flex-col gap-1 h-0 group-hover:h-auto overflow-hidden transition-all">
          <button onClick={() => onSwitch(null)} className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-red-500">Reset</button>
          <div className="h-[1px] bg-slate-700 my-1"></div>
          <button onClick={() => onSwitch('admin')} className="px-2 py-1 text-xs bg-slate-800 text-cyan-400 rounded border border-cyan-900">Admin</button>
          <button onClick={() => onSwitch('professional')} className="px-2 py-1 text-xs bg-slate-800 text-blue-400 rounded border border-blue-900">Pro</button>
          <button onClick={() => onSwitch('patient')} className="px-2 py-1 text-xs bg-slate-800 text-green-400 rounded border border-green-900">User</button>
          <button onClick={() => onSwitch('assistant')} className="px-2 py-1 text-xs bg-slate-800 text-purple-400 rounded border border-purple-900">Asist</button>
        </div>
        <div className="w-8 h-8 rounded-full bg-cyan-900/50 flex items-center justify-center text-cyan-400 border border-cyan-500 cursor-pointer">⚡</div>
      </div>
    </div>
  );
}