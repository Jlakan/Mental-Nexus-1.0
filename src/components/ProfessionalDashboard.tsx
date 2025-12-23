// src/components/ProfessionalDashboard.tsx
import { useState, useEffect } from 'react';
import { collection, query, where, getDocs, doc, updateDoc, arrayRemove, getDoc } from "firebase/firestore";
import { auth, db } from '../services/firebase';
import AgendaView from './AgendaView';

interface Props {
  user: any;
}

export default function ProfessionalDashboard({ user }: Props) {
  // Estados de Navegación
  const [view, setView] = useState<'dashboard' | 'agenda' | 'team'>('dashboard');
  // Estados de Datos
  const [patients, setPatients] = useState<any[]>([]);
  const [assistants, setAssistants] = useState<any[]>([]);
  
  // CORRECCIÓN: Ignoramos la variable loading
  const [, setLoading] = useState(true);
  
  const [profData, setProfData] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Cargar datos del perfil profesional
      const profRef = doc(db, "professionals", user.uid);
      const profSnap = await getDoc(profRef);
      if (profSnap.exists()) {
        const data = profSnap.data();
        setProfData(data);

        // 2. Cargar Asistentes Autorizados (Si existen)
        if (data.authorizedAssistants && data.authorizedAssistants.length > 0) {
          const qAssist = query(collection(db, "users"), where("uid", "in", data.authorizedAssistants));
          const snapAssist = await getDocs(qAssist);
          setAssistants(snapAssist.docs.map(d => ({uid: d.id, ...d.data()})));
        } else {
          setAssistants([]);
        }

        // 3. Cargar Pacientes
        if (data.professionalCode) {
          const qPats = query(collection(db, "patients"), where("linkedProfessionalCode", "==", data.professionalCode));
          const snapPats = await getDocs(qPats);
          setPatients(snapPats.docs.map(d => ({id: d.id, ...d.data()})));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE SEGURIDAD (REVOCAR ACCESO) ---
  const revokeAccess = async (assistantUid: string, name: string) => {
    if (!window.confirm(`⛔ ALERTA DE SEGURIDAD\n\n¿Estás seguro de que deseas REVOCAR EL ACCESO a ${name || 'esta persona'}?\n\nDejará de ver tu agenda inmediatamente.`)) return;

    try {
      await updateDoc(doc(db, "professionals", user.uid), {
        authorizedAssistants: arrayRemove(assistantUid)
      });
      alert("Acceso revocado correctamente.");
      loadData(); 
    } catch (error) {
      console.error(error);
      alert("Error al revocar acceso.");
    }
  };

  // --- VISTA DE AGENDA ---
  if (view === 'agenda') {
    return (
      <AgendaView
        userRole="professional"
        currentUserId={user.uid}
        onBack={() => setView('dashboard')}
      />
    );
  }

  // --- VISTA PRINCIPAL (DASHBOARD) ---
  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px', borderBottom:'1px solid #eee', paddingBottom:'20px' }}>
        <div>
          <h1 style={{ margin: 0, color: '#1565C0' }}>Panel Profesional</h1>
          <p style={{ margin: '5px 0', color: '#666' }}>Bienvenido, Dr(a). {profData?.fullName}</p>
          {profData?.professionalCode && (
            <span style={{ background: '#E3F2FD', padding: '5px 10px', borderRadius: '15px', fontSize: '12px', color: '#1565C0', fontWeight:'bold' }}>
              CÓDIGO: {profData.professionalCode}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('agenda')} style={{ padding: '10px 20px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', boxShadow:'0 2px 5px rgba(0,0,0,0.2)' }}>
            📅 Ver Mi Agenda
          </button>
          <button onClick={() => setView('team')} style={{ padding: '10px 20px', background: '#607D8B', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            🛡️ Equipo y Seguridad
          </button>
          <button onClick={() => auth.signOut()} style={{ padding: '10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
            Salir
          </button>
        </div>
      </div>

      {view === 'team' ? (
        <div>
          <button onClick={() => setView('dashboard')} style={{marginBottom:'20px', background:'none', border:'none', color:'#666', cursor:'pointer'}}> ← Volver al resumen </button>
          <h2 style={{color:'#455A64'}}>Gestión de Acceso a mi Agenda</h2>
          <p style={{fontSize:'14px', color:'#777'}}>Las siguientes personas tienen permiso para ver y editar tu agenda médica.</p>

          <div style={{marginTop:'20px'}}>
            {assistants.length === 0 ? (
              <div style={{padding:'30px', background:'#f9f9f9', borderRadius:'8px', textAlign:'center', color:'#999'}}>
                No tienes asistentes vinculados.<br/>
                Comparte tu código <strong>{profData?.professionalCode}</strong> para que se vinculen.
              </div>
            ) : (
              <div style={{display:'grid', gap:'15px'}}>
                {assistants.map(asst => (
                  <div key={asst.uid} style={{padding:'20px', border:'1px solid #ddd', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', background:'white'}}>
                    <div>
                      <strong style={{fontSize:'18px'}}>{asst.displayName || asst.email}</strong>
                      <div style={{fontSize:'12px', color:'#999'}}>{asst.email}</div>
                      <div style={{fontSize:'12px', color:'#4CAF50', marginTop:'5px'}}> ✅ Acceso Activo </div>
                    </div>
                    <button onClick={() => revokeAccess(asst.uid, asst.displayName)} style={{padding:'10px 15px', background:'#FFEBEE', color:'#D32F2F', border:'1px solid #FFCDD2', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
                      🚫 Revocar Acceso
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px', marginBottom:'40px'}}>
            <div style={{padding:'20px', background:'white', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', textAlign:'center'}}>
              <div style={{fontSize:'30px', fontWeight:'bold', color:'#2196F3'}}>{patients.length}</div>
              <div style={{color:'#666'}}>Pacientes Totales</div>
            </div>
            <div style={{padding:'20px', background:'white', borderRadius:'12px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', textAlign:'center'}}>
              <div style={{fontSize:'30px', fontWeight:'bold', color:'#4CAF50'}}>-</div>
              <div style={{color:'#666'}}>Citas Hoy</div>
            </div>
          </div>

          <h3>Mis Pacientes Recientes</h3>
          <div style={{background:'white', borderRadius:'12px', overflow:'hidden', border:'1px solid #eee'}}>
            {patients.length === 0 ? (
              <div style={{padding:'20px', textAlign:'center', color:'#999'}}>Aún no hay pacientes registrados con tu código.</div>
            ) : (
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead style={{background:'#f5f5f5'}}>
                  <tr>
                    <th style={{padding:'15px', textAlign:'left'}}>Nombre</th>
                    <th style={{padding:'15px', textAlign:'left'}}>Email</th>
                    <th style={{padding:'15px', textAlign:'left'}}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid #eee'}}>
                      <td style={{padding:'15px'}}>{p.fullName}</td>
                      <td style={{padding:'15px'}}>{p.email}</td>
                      <td style={{padding:'15px'}}>
                        <button style={{marginRight:'10px', padding:'5px 10px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:'4px', cursor:'pointer'}}>Ver Perfil</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}