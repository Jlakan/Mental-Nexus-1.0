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
import AgendaView from './components/agenda';

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

  // --- CORRECCIÓN AQUÍ: Lectura Doble (Users + Patients) ---
  const fetchUserRole = async (uid: string) => {
    try {
      // 1. Buscamos en la colección base de usuarios (Auth)
      const userRef = doc(db, "users", uid);
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        let finalData = userSnap.data();

        // 2. SI ES PACIENTE: Buscamos también en la colección 'patients'
        // Esto corrige el bug: si el expediente existe, lo detectamos aquí.
        if (finalData.role === 'patient') {
          const patientRef = doc(db, "patients", uid);
          const patientSnap = await getDoc(patientRef);
          
          if (patientSnap.exists()) {
            const patientDetails = patientSnap.data();
            // Combinamos los datos. Si existe en 'patients', asumimos perfil completado.
            finalData = { 
              ...finalData, 
              ...patientDetails,
              profileCompleted: true // Forzamos true si ya tiene expediente
            };
          }
        }

        setUserData(finalData);
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

  // --- ROL PACIENTE (LÓGICA CORREGIDA) ---
  if (userData.role === 'patient') {
    // Ahora userData incluye los datos de la colección 'patients' si existen.
    // Usamos profileCompleted (que forzamos en fetchUserRole) o fullName como fallback.
    if (userData.profileCompleted || userData.fullName || userData.dateOfBirth) {
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

  return (
    <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{color: '#D32F2F'}}>⚠️ Rol Desconocido</h1>
      <p>Tu usuario tiene guardado el rol: <strong>"{userData?.role || 'Ninguno'}"</strong></p>
      <p>El sistema no reconoce este rol. Pulsa el botón para volver a elegir.</p>
      
      <button 
        onClick={async () => {
          await setDoc(doc(db, "users", user.uid), { role: null }, { merge: true });
          window.location.reload();
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