// src/App.tsx
import { useState, useEffect } from 'react';

// --- FIREBASE IMPORTS ---
import { onAuthStateChanged } from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  where, 
  getDocs 
} from 'firebase/firestore';
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
import AssistantPanel from './components/AssistantPanel'; 
import AgendaView from './components/agenda';

export default function App() {
  // ---------------------------------------------------------------------------
  // 1. ESTADOS
  // ---------------------------------------------------------------------------
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Estados de Navegación / Desarrollo
  const [simulatedRole, setSimulatedRole] = useState<string | null>(null);
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'professional'>('admin');
  
  // Persistencia del doctor seleccionado (Asistente)
  const [selectedDoctorId, setSelectedDoctorId] = useState<string | null>(() => {
    return localStorage.getItem('nexus_assistant_selected_doc');
  });

  // ---------------------------------------------------------------------------
  // 2. INICIO DE SESIÓN Y CARGA DE DATOS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        await fetchUserRole(currentUser.uid);
      } else {
        setUserData(null);
        setLoading(false);
        localStorage.removeItem('nexus_assistant_selected_doc');
      }
    });

    return () => unsubscribe();
  }, []);

  // Lógica de recuperación de datos (Robustez V1)
  const fetchUserRole = async (uid: string) => {
    try {
      setLoading(true);

      // 1. Buscar usuario base
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const baseData = userSnap.data();
        let finalData = { ...baseData };

        // 2. Buscar datos extendidos según el rol
        if (baseData.role === 'patient') {
          const patientRef = doc(db, "patients", uid);
          const patientSnap = await getDoc(patientRef);
          
          if (patientSnap.exists()) {
            finalData = { 
              ...finalData, 
              ...patientSnap.data(),
              profileCompleted: true 
            };
          } else {
            finalData.profileCompleted = false;
          }
        } 
        else if (baseData.role === 'professional') {
           const proRef = doc(db, "professionals", uid);
           const proSnap = await getDoc(proRef);
           
           if (proSnap.exists()) {
              finalData = { 
                ...finalData, 
                ...proSnap.data(),
                isRegisteredPro: true 
              };
           }
        }
        // Nota: Asistente carga sus datos dinámicamente en su propio componente

        setUserData(finalData);
      } else {
        setUserData(null);
      }

    } catch (error) {
      console.error("Error fatal cargando usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. HANDLERS (Manejadores de Eventos)
  // ---------------------------------------------------------------------------
  
  // Asistente selecciona un doctor de su lista
  const handleSelectDoctor = (doctorId: string) => {
    setSelectedDoctorId(doctorId);
    localStorage.setItem('nexus_assistant_selected_doc', doctorId);
  };

  // Asistente sale de la agenda para volver a la lista
  const handleClearDoctor = () => {
    // Si estamos simulando, limpiamos la simulación para volver al "Lobby real" si se desea,
    // o simplemente deseleccionamos el doctor.
    setSelectedDoctorId(null);
    localStorage.removeItem('nexus_assistant_selected_doc');
    
    // Opcional: Si quieres que el botón "Atrás" también apague el modo dios, descomenta esto:
    // if (simulatedRole) setSimulatedRole(null);
  };

  // ---------------------------------------------------------------------------
  // 4. PANTALLAS PREVIAS (Loading / Login / Selección)
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-cyan-400 font-mono gap-4">
         <div className="animate-spin h-10 w-10 border-4 border-cyan-500 border-t-transparent rounded-full"></div>
         <p>CARGANDO SISTEMA NEXUS...</p>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  // Selección de Rol Inicial (Si es usuario nuevo y no estamos probando roles)
  if ((!userData || !userData.role) && !simulatedRole) {
    return (
      <RoleSelection 
        userName={user.displayName || 'Usuario'} 
        onSelect={async (role) => {
           try {
             await setDoc(doc(db, "users", user.uid), { 
               uid: user.uid,
               email: user.email,
               role: role,
               createdAt: new Date()
             }, { merge: true });
             window.location.reload();
           } catch (e) {
             console.error("Error guardando rol:", e);
             alert("Error al guardar la selección.");
           }
        }} 
      />
    );
  }

  // ---------------------------------------------------------------------------
  // 5. RENDERIZADO PRINCIPAL POR ROL
  // ---------------------------------------------------------------------------

  const activeRole = simulatedRole || userData?.role;
  const isRealAdmin = userData?.role === 'admin'; // Para lógica interna si se requiere

  // --- VISTA: ADMIN ---
  if (activeRole === 'admin') {
    return (
      <div className="relative min-h-screen">
        {/* Botón Flotante: Alternar Vista Admin/Doctor (ABAJO DERECHA) */}
        <div className="fixed bottom-6 right-6 z-50">
           <button 
             onClick={() => setAdminViewMode(prev => prev === 'admin' ? 'professional' : 'admin')}
             className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-xl flex items-center justify-center text-2xl border-2 border-white transition-transform hover:scale-110"
             title={adminViewMode === 'admin' ? "Ver mi perfil médico" : "Volver al panel Admin"}
           >
             {adminViewMode === 'admin' ? '👨‍⚕️' : '🛠'}
           </button>
        </div>

        {adminViewMode === 'admin' ? (
           <AdminPanel />
        ) : (
           (userData?.professionalCode || simulatedRole) ? <ProfessionalDashboard user={user} /> : <ProfessionalRegister />
        )}
        
        <DevRoleSwitcher currentRole={activeRole} onSwitch={setSimulatedRole} />
      </div>
    );
  }

  // --- VISTA: PROFESIONAL ---
  if (activeRole === 'professional') {
    const canEnterDashboard = simulatedRole ? true : userData?.isRegisteredPro;
    return (
      <>
        {canEnterDashboard ? <ProfessionalDashboard user={user} /> : <ProfessionalRegister />}
        <DevRoleSwitcher currentRole={activeRole} onSwitch={setSimulatedRole} />
      </>
    );
  }

  // --- VISTA: PACIENTE ---
  if (activeRole === 'patient') {
    const canEnterDashboard = simulatedRole ? true : userData?.profileCompleted;
    return (
      <>
        {canEnterDashboard ? <PatientDashboard user={user} /> : <PatientRegister />}
        <DevRoleSwitcher currentRole={activeRole} onSwitch={setSimulatedRole} />
      </>
    );
  }

  // --- VISTA: ASISTENTE ---
  if (activeRole === 'assistant') {
    // CORRECCIÓN CRÍTICA:
    // Solo mostramos la Agenda si hay un doctor explícitamente seleccionado.
    // Quitamos la condición `|| (simulatedRole && user)` para permitir
    // ver el AssistantPanel y probar la vinculación manual en modo Dios.
    const showAgenda = selectedDoctorId; 

    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', flexDirection: 'column' }}>
         {showAgenda ? (
            <AgendaView 
              userRole="assistant"
              currentUserId={selectedDoctorId!} 
              onBack={handleClearDoctor}
            />
         ) : (
            // Ahora siempre verás esto primero, incluso en simulación
            <AssistantPanel onSelectProfessional={handleSelectDoctor} />
         )}

         <DevRoleSwitcher currentRole={activeRole} onSwitch={setSimulatedRole} />
      </div>
    );
  }

  // --- VISTA: FALLBACK / ERROR ---
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-6 text-center">
      <h1 className="text-3xl text-red-500 font-bold mb-4">⚠️ Rol Desconocido</h1>
      <p className="mb-6 text-slate-400">
        Rol detectado: <strong>"{userData?.role || 'Indefinido'}"</strong>.
      </p>
    
      <button
        onClick={async () => {
          if(!window.confirm("¿Restablecer rol?")) return;
          await setDoc(doc(db, "users", user.uid), { role: null }, { merge: true });
          window.location.reload();
        }}
        className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-bold mb-4"
      >
        🔄 Restablecer Rol
      </button>

      <button onClick={() => auth.signOut()} className="underline text-slate-500">
        Cerrar Sesión
      </button>
      
      <DevRoleSwitcher currentRole={activeRole} onSwitch={setSimulatedRole} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// COMPONENTE: DEV ROLE SWITCHER (ABAJO IZQUIERDA)
// ---------------------------------------------------------------------------
function DevRoleSwitcher({ currentRole, onSwitch }: { currentRole: string, onSwitch: (r: string | null) => void }) {
  // Sin restricción de Admin para facilitar el desarrollo
  return (
    <div className="fixed bottom-4 right-4 z-[9999] group">
      <div className="bg-slate-900/90 border border-cyan-500/30 p-2 rounded-lg backdrop-blur-md shadow-2xl opacity-60 hover:opacity-100 transition-all">
        <div className="text-[10px] text-cyan-400 font-bold mb-1 text-center hidden group-hover:block">
           DEV MODE
        </div>
        <div className="flex flex-col gap-1 h-0 group-hover:h-auto overflow-hidden transition-all">
          <button onClick={() => onSwitch(null)} className="px-2 py-1 text-xs bg-slate-700 text-white rounded hover:bg-red-500">Reset</button>
          <div className="h-[1px] bg-slate-700 my-1"></div>
          <button onClick={() => onSwitch('admin')} className="px-2 py-1 text-xs bg-slate-800 text-cyan-400 rounded border border-cyan-900">Admin</button>
          <button onClick={() => onSwitch('professional')} className="px-2 py-1 text-xs bg-slate-800 text-blue-400 rounded border border-blue-900">Pro</button>
          <button onClick={() => onSwitch('patient')} className="px-2 py-1 text-xs bg-slate-800 text-green-400 rounded border border-green-900">Pac</button>
          <button onClick={() => onSwitch('assistant')} className="px-2 py-1 text-xs bg-slate-800 text-purple-400 rounded border border-purple-900">Asis</button>
        </div>
        <div className="text-xl text-center cursor-pointer group-hover:hidden animate-pulse">⚙️</div>
      </div>
    </div>
  );
}