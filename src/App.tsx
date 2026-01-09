// src/App.tsx
import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore'; // Agregamos onSnapshot
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
  
  // userData: Datos de la colección 'users' (rol, email, etc.)
  const [userData, setUserData] = useState<any>(null);
  
  // patientProfile: Datos específicos de la colección 'patients'
  const [patientProfile, setPatientProfile] = useState<any>(null);
  
  const [loading, setLoading] = useState(true);

  // Modos de vista
  const [adminViewMode, setAdminViewMode] = useState<'admin' | 'professional'>('admin');
  const [assistantMode, setAssistantMode] = useState<'agenda' | 'register'>('agenda');

  useEffect(() => {
    // Escucha cambios en la autenticación (Login/Logout)
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 1. ESCUCHAR EN TIEMPO REAL LA COLECCIÓN 'USERS'
        // Usamos onSnapshot en vez de getDoc para detectar cambios de ROL al instante
        const unsubscribeUser = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserData(data);

            // 2. SI ES PACIENTE, ESCUCHAR TAMBIÉN LA COLECCIÓN 'PATIENTS'
            // Esto es crítico: App.tsx debe saber si ya existe el perfil médico
            if (data.role === 'patient') {
              onSnapshot(doc(db, "patients", currentUser.uid), (patientSnap) => {
                if (patientSnap.exists()) {
                  setPatientProfile(patientSnap.data());
                } else {
                  setPatientProfile(null);
                }
              });
            }
          } else {
            setUserData(null);
          }
          setLoading(false); // Datos cargados
        }, (error) => {
          console.error("Error escuchando usuario:", error);
          setLoading(false);
        });

        // Cleanup del listener de usuario si el componente se desmonta (raro en App)
        return () => unsubscribeUser();

      } else {
        // Usuario deslogueado
        setUserData(null);
        setPatientProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

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
      // No necesitamos reload() porque onSnapshot detectará el cambio y actualizará la UI
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

  // --- ROL PACIENTE (CORREGIDO) ---
  if (userData.role === 'patient') {
    // AHORA VERIFICAMOS SI EXISTE EL PERFIL EN LA COLECCIÓN 'PATIENTS'
    // patientProfile se llena automáticamente gracias al onSnapshot de arriba
    if (patientProfile) {
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
            onBack={() => auth.signOut()}
          />
        ) : (
          <AssistantRegister />
        )}
      </div>
    );
  }

  // --- ROL DESCONOCIDO ---
  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{color: '#D32F2F'}}>⚠️ Rol Desconocido</h1>
      <p>Tu usuario tiene guardado el rol: <strong>"{userData?.role || 'Ninguno'}"</strong></p>
      <p>El sistema no reconoce este rol. Pulsa el botón para volver a elegir.</p>

      <button
        onClick={async () => {
          await setDoc(doc(db, "users", user.uid), { role: null }, { merge: true });
          // No necesitamos reload, el onSnapshot detectará el cambio a role: null
        }}
        style={{
          marginTop: '20px', padding: '15px 30px', background: '#2196F3',
          color: 'white', border: 'none', borderRadius: '8px',
          fontSize: '16px', cursor: 'pointer', fontWeight: 'bold'
        }}
      >
        🔄 Restablecer y Elegir Rol Nuevamente
      </button>

      <div style={{marginTop: '30px'}}>
        <button onClick={() => auth.signOut()} style={{textDecoration:'underline', border:'none', background:'none', cursor:'pointer', color:'#666'}}>
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}