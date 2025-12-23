// src/App.tsx
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

// Importamos todos los componentes
import Login from './components/Login';
import RoleSelection from './components/RoleSelection';
import PatientRegister from './components/PatientRegister';
import PatientDashboard from './components/PatientDashboard';
import ProfessionalRegister from './components/ProfessionalRegister';
import ProfessionalDashboard from './components/ProfessionalDashboard';
import AdminPanel from './components/AdminPanel';

// NUEVOS COMPONENTES
import AssistantRegister from './components/AssistantRegister';
import AgendaView from './components/AgendaView';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [userData, setUserData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // Modos de vista
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'professional'>('admin');
  const [assistantMode, setAssistantMode] = useState<'agenda' | 'register'>('agenda');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchUserRole(currentUser.uid);
      } else {
        setUserData(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchUserRole = async (uid: string) => {
    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserData(docSnap.data());
      } else {
        setUserData(null);
      }
    } catch (error) {
      console.error("Error cargando usuario:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = async (selectedRole: 'patient' | 'professional' | 'assistant') => {
    if (!user) return;
    try {
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        role: selectedRole,
        createdAt: new Date()
      }, { merge: true });
      window.location.reload();
    } catch (error) {
      console.error("Error guardando el rol:", error);
      alert("Hubo un error al guardar tu selección.");
    }
  };

  if (loading) return <div style={{height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', fontFamily:'sans-serif'}}>Cargando Mental Nexus...</div>;
  if (!user) return <Login />;

  // Selector de Rol si no existe
  if (!userData || !userData.role) {
    return <RoleSelection userName={user.displayName || 'Usuario'} onSelect={handleRoleSelect} />;
  }

  // --- MODO SUPER USUARIO (ADMIN) ---
  const isSuperUser = userData.role === 'admin' || userData.isAdmin === true;
  if (isSuperUser) {
    return (
      <>
        <div style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 9999,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px'
        }}>
          <button
            onClick={() => setAdminViewMode(prev => prev === 'admin' ? 'professional' : 'admin')}
            style={{
              background: adminViewMode === 'admin' ? '#2196F3' : '#333',
              color: 'white', border: '2px solid white', borderRadius: '50%',
              width: '60px', height: '60px', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
              fontSize: '24px', display:'flex', alignItems:'center', justifyContent:'center'
            }}
          >
            {adminViewMode === 'admin' ? '👨‍⚕️' : '🛠'}
          </button>
        </div>
        {adminViewMode === 'admin' ? <AdminPanel /> : (!userData.professionalCode ? <ProfessionalRegister /> : <ProfessionalDashboard user={user} />)}
      </>
    );
  }

  // --- ROL PROFESIONAL ---
  if (userData.role === 'professional') {
    if (!userData.professionalCode) return <ProfessionalRegister />;
    return <ProfessionalDashboard user={user} />;
  }

  // --- ROL PACIENTE ---
  if (userData.role === 'patient') {
    if (userData.fullName || userData.profileCompleted) {
      return <PatientDashboard user={user} />;
    } else {
      return <PatientRegister />;
    }
  }

  // --- ROL ASISTENTE ---
  if (userData.role === 'assistant') {
    return (
      <div style={{fontFamily:'sans-serif'}}>
        {/* Botón Flotante para cambiar entre Agenda y Vincular */}
        <div style={{position:'fixed', bottom:'20px', right:'20px', zIndex:1000}}>
          <button
            onClick={() => setAssistantMode(prev => prev === 'agenda' ? 'register' : 'agenda')}
            style={{
              background: assistantMode === 'agenda' ? '#9C27B0' : '#4CAF50',
              color: 'white', padding: '15px 20px', borderRadius: '30px', border: 'none',
              boxShadow: '0 4px 10px rgba(0,0,0,0.3)', cursor: 'pointer', fontWeight: 'bold'
            }}
          >
            {assistantMode === 'agenda' ? '🔗 Vincular Médico' : '📅 Ver Agenda'}
          </button>
        </div>

        {assistantMode === 'agenda' ? (
          <AgendaView
            userRole="assistant"
            currentUserId={user.uid}
            onBack={() => auth.signOut()} // Salir cierra sesión
          />
        ) : (
          <AssistantRegister />
        )}
      </div>
    );
  }

  return <div>Rol desconocido.</div>;
}