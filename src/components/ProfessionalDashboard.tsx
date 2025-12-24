// src/components/ProfessionalDashboard.tsx
import { useState, useEffect } from 'react';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  arrayRemove, getDoc, increment, deleteDoc, arrayUnion, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
import AgendaView from './AgendaView';
import AssignmentModal from './AssignmentModal';
import HistoryModal from './HistoryModal';

interface Props {
  user: any;
}

export default function ProfessionalDashboard({ user }: Props) {
  // --- ESTADOS NAVEGACIÓN ---
  const [view, setView] = useState<'dashboard' | 'agenda' | 'team' | 'patients_manage' | 'patient_detail'>('dashboard');
  
  // --- ESTADOS DATA ---
  const [assistants, setAssistants] = useState<any[]>([]);
  const [activePatients, setActivePatients] = useState<any[]>([]);
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  const [profData, setProfData] = useState<any>(null);

  // --- ESTADOS PACIENTE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientTasks, setPatientTasks] = useState<any[]>([]);
  
  // --- MODALS ---
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [newIndicator, setNewIndicator] = useState('');

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const profRef = doc(db, "professionals", user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data();
        setProfData(data); 

        if (data.authorizedAssistants && data.authorizedAssistants.length > 0) {
          const qAssist = query(collection(db, "users"), where("uid", "in", data.authorizedAssistants));
          const snapAssist = await getDocs(qAssist);
          setAssistants(snapAssist.docs.map(d => ({uid: d.id, ...d.data()})));
        } else {
          setAssistants([]);
        }

        if (data.professionalCode) {
          const qPats = query(collection(db, "patients"), where("linkedProfessionalCode", "==", data.professionalCode));
          const snapPats = await getDocs(qPats);
          const pending: any[] = [];
          const active: any[] = [];
          
          snapPats.docs.forEach(d => {
            const pData = d.data();
            const pId = d.id;
            let isMyPatientActive = false;
            if (pData.careTeam) {
              const myEntry = Object.values(pData.careTeam).find((entry: any) => entry.professionalId === user.uid);
              if (myEntry && (myEntry as any).active) isMyPatientActive = true;
            }
            if (pData.isAuthorized === false || !isMyPatientActive) {
              pending.push({ id: pId, ...pData });
            } else {
              active.push({ id: pId, ...pData });
            }
          });
          setPendingPatients(pending);
          setActivePatients(active);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- LÓGICA DE ASIGNACIÓN (El Candado) ---
  
  const hasValidAttendance = (patient: any): boolean => {
      if (!patient.lastAttendance) return false;
      const myLastDate = patient.lastAttendance[user.uid]; 
      if (!myLastDate) return false;

      // Soporte híbrido: Timestamp de Firestore o Date de JS (Optimista)
      const dateObj = myLastDate.toDate ? myLastDate.toDate() : new Date(myLastDate);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - dateObj.getTime());
      const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

      return diffHours <= 72; // Ventana de 3 días
  };

  const handleRegisterAttendance = async () => {
      if (!selectedPatient) return;
      const currentBalance = profData?.nexusBalance || 0;

      if (currentBalance < 1) {
          return alert("❌ No tienes Nexus suficientes. Mejora tu suscripción para premiar asistencias.");
      }

      // Confirmación
      if (!window.confirm(`¿Registrar asistencia de HOY y desbloquear asignación?\n\nCosto: 1 Nexus de tu saldo.\nPremio: +1 Nexus al paciente.`)) return;

      try {
          const batch = writeBatch(db);
          
          // 1. Cobrar al Profesional
          const profRef = doc(db, "professionals", user.uid);
          batch.update(profRef, {
              nexusBalance: increment(-1),
              "metrics.nexusDistributed": increment(1)
          });

          // 2. Premiar y Registrar Fecha en Paciente
          const patRef = doc(db, "patients", selectedPatient.id);
          batch.update(patRef, {
              [`lastAttendance.${user.uid}`]: serverTimestamp(), 
              "gamificationProfile.currentXp": increment(50), 
              "gamificationProfile.wallet.nexus": increment(1)
          });

          await batch.commit();
          
          alert("✅ Asistencia registrada. ¡Asignación desbloqueada!");
          
          // --- ACTUALIZACIÓN OPTIMISTA ---
          setProfData((prev: any) => ({...prev, nexusBalance: prev.nexusBalance - 1}));
          
          // Actualizamos el paciente localmente para que el botón se ponga AZUL (sin recargar)
          setSelectedPatient((prev: any) => ({
              ...prev,
              lastAttendance: { ...prev.lastAttendance, [user.uid]: new Date() }, // Usamos Date normal para local
              gamificationProfile: {
                  ...prev.gamificationProfile,
                  wallet: { ...prev.gamificationProfile.wallet, nexus: (prev.gamificationProfile.wallet.nexus||0) + 1 }
              }
          }));

          // --- CORRECCIÓN CLAVE ---
          // NO llamamos a handleOpenCreateTask() porque volvería a verificar el estado viejo.
          // Abrimos el modal DIRECTAMENTE porque acabamos de pagar.
          setTaskToEdit(null);
          setIsAssignmentModalOpen(true);

      } catch (e) {
          console.error(e);
          alert("Error en la transacción.");
      }
  };

  const handleOpenCreateTask = () => {
    // Esta función se usa SOLO cuando el usuario hace clic en el botón AZUL.
    // Si el usuario hace clic en el botón gris, se dispara handleRegisterAttendance directamente desde el onClick del botón.
    
    if (!hasValidAttendance(selectedPatient)) {
        // Doble seguridad, pero el botón UI ya debería manejar esto visualmente
        return handleRegisterAttendance(); 
    }
    setTaskToEdit(null);
    setIsAssignmentModalOpen(true);
  };

  const handleOpenEditTask = (task: any) => {
    setTaskToEdit(task);
    setIsAssignmentModalOpen(true);
  };

  // --- RESTO DE FUNCIONES (Sin cambios) ---
  const handleOpenPatient = async (patient: any) => {
    setSelectedPatient(patient);
    setView('patient_detail');
    await loadPatientTasks(patient.id);
  };

  const loadPatientTasks = async (patientId: string) => {
    try {
      const qM = query(collection(db, "assigned_missions"), where("patientId", "==", patientId));
      const qR = query(collection(db, "assigned_routines"), where("patientId", "==", patientId));
      const [snapM, snapR] = await Promise.all([getDocs(qM), getDocs(qR)]);
      
      const missions = snapM.docs.map(d => ({ id: d.id, ...d.data(), type: 'mission' }));
      const routines = snapR.docs.map(d => ({ id: d.id, ...d.data(), type: 'routine' }));
      
      const all = [...missions, ...routines].sort((a: any, b: any) => {
         const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date();
         const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date();
         return dateB - dateA;
      });
      setPatientTasks(all);
    } catch (e) { console.error(e); }
  };

  const handleDeleteTask = async (taskId: string, isRoutine: boolean) => {
    if(!window.confirm("¿Eliminar tarea?")) return;
    try {
      await deleteDoc(doc(db, isRoutine ? "assigned_routines" : "assigned_missions", taskId));
      loadPatientTasks(selectedPatient.id);
    } catch (e) { console.error(e); }
  };

  const handleAddIndicator = async () => {
    if (!newIndicator.trim() || !selectedPatient) return;
    try {
      await updateDoc(doc(db, "patients", selectedPatient.id), { [`clinicalIndicators.${user.uid}`]: arrayUnion(newIndicator.trim()) });
      const currentMap = selectedPatient.clinicalIndicators || {};
      const myList = currentMap[user.uid] || [];
      setSelectedPatient({ ...selectedPatient, clinicalIndicators: { ...currentMap, [user.uid]: [...myList, newIndicator.trim()] } });
      setNewIndicator('');
    } catch (e) { console.error(e); }
  };

  const handleDeleteIndicator = async (text: string) => {
      try {
        await updateDoc(doc(db, "patients", selectedPatient.id), { [`clinicalIndicators.${user.uid}`]: arrayRemove(text) });
        const currentMap = selectedPatient.clinicalIndicators || {};
        const myList = currentMap[user.uid] || [];
        setSelectedPatient({ ...selectedPatient, clinicalIndicators: { ...currentMap, [user.uid]: myList.filter((t: string) => t !== text) } });
      } catch (e) { console.error(e); }
  };

  const handleApprovePatient = async (patient: any) => {
      if (!window.confirm(`¿Aprobar acceso?`)) return;
      try {
        let targetKey = 'general';
        if (patient.careTeam) {
            const foundKey = Object.keys(patient.careTeam).find(key => patient.careTeam[key].professionalId === user.uid);
            if (foundKey) targetKey = foundKey;
        }
        await updateDoc(doc(db, "patients", patient.id), {
            isAuthorized: true,
            [`careTeam.${targetKey}.active`]: true,
            [`careTeam.${targetKey}.status`]: 'active',
            [`careTeam.${targetKey}.joinedAt`]: new Date().toISOString()
        });
        alert("Paciente aprobado.");
        loadData();
      } catch (e) { console.error(e); }
  };

  const filteredPatients = activePatients.filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  // --- RENDER ---
  if (view === 'agenda') {
    return <AgendaView userRole="professional" currentUserId={user.uid} onBack={() => setView('dashboard')} />;
  }

  // >>> VISTA DETALLE <<<
  if (view === 'patient_detail' && selectedPatient) {
    const myIndicators = selectedPatient.clinicalIndicators?.[user.uid] || [];
    const activeTasks = patientTasks.filter(t => t.status !== 'completed');
    
    // Validar Candado (Usa el estado actualizado optimisticamente)
    const canAssign = hasValidAttendance(selectedPatient);

    return (
      <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto' }}>
        <button onClick={() => setView('patients_manage')} style={{marginBottom:'20px', background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'16px'}}>   ⬅ Volver a la lista  </button>
        
        {/* ENCABEZADO PACIENTE */}
        <div style={{background:'white', padding:'25px', borderRadius:'12px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <h1 style={{margin:'0 0 5px 0', color:'#1565C0'}}>{selectedPatient.fullName}</h1>
            <div style={{color:'#666', fontSize:'14px'}}>
              {selectedPatient.email} • {selectedPatient.contactNumber}
            </div>
            {/* STATS PACIENTE */}
            <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
              <span style={{background:'#E1BEE7', color:'#4A148C', padding:'4px 10px', borderRadius:'15px', fontWeight:'bold', fontSize:'12px'}}>
                Nivel {selectedPatient.gamificationProfile?.level || 1}
              </span>
              <span style={{background:'#B3E5FC', color:'#0277BD', padding:'4px 10px', borderRadius:'15px', fontWeight:'bold', fontSize:'12px'}}>
                💎 {selectedPatient.gamificationProfile?.wallet?.nexus || 0} Nexus
              </span>
            </div>
          </div>
          
          <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'flex-end'}}>
             <div style={{display:'flex', gap:'10px'}}>
                <button onClick={() => setIsHistoryOpen(true)} style={{padding:'10px 15px', background:'#607D8B', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
                  📜 Historial
                </button>
                {/* Botón Asignar con Lógica de Candado */}
                <button 
                   onClick={canAssign ? handleOpenCreateTask : handleRegisterAttendance}
                   style={{
                       padding:'10px 20px', 
                       background: canAssign ? '#2196F3' : '#E0E0E0', 
                       color: canAssign ? 'white' : '#757575',
                       border: canAssign ? 'none' : '1px solid #ccc',
                       borderRadius:'6px', cursor:'pointer', fontWeight:'bold', 
                       display:'flex', alignItems:'center', gap:'8px'
                   }}
                >
                   {canAssign ? (
                       <>+ Asignar Tarea</>
                   ) : (
                       <>🔒 Registrar Asistencia (-1 Nexus)</>
                   )}
                </button>
             </div>
             {!canAssign && (
                 <small style={{color:'#D32F2F', fontSize:'11px'}}>
                     * Requiere asistencia reciente (72h) para asignar.
                 </small>
             )}
          </div>
        </div>

        {/* NOTAS CLÍNICAS */}
        <div style={{background:'#FFFDE7', padding:'20px', borderRadius:'8px', border:'1px solid #FFF59D', marginBottom:'25px'}}>
          <h3 style={{marginTop:0, color:'#F57F17', fontSize:'16px'}}>🔒 Notas Clínicas (Privadas)</h3>
          <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
             <input 
               value={newIndicator} 
               onChange={(e) => setNewIndicator(e.target.value)} 
               onKeyDown={(e) => e.key === 'Enter' && handleAddIndicator()}
               placeholder="Nota rápida..."
               style={{flex:1, padding:'10px', borderRadius:'4px', border:'1px solid #FBC02D'}}
             />
             <button onClick={handleAddIndicator} style={{background:'#FBC02D', color:'#333', border:'none', padding:'0 20px', borderRadius:'4px', cursor:'pointer'}}>Agregar</button>
          </div>
          <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
             {myIndicators.map((item: string, idx: number) => (
                <div key={idx} style={{background:'white', border:'1px solid #FFF176', padding:'5px 12px', borderRadius:'20px', fontSize:'14px', color:'#555', display:'flex', alignItems:'center', gap:'8px'}}>
                   • {item} <button onClick={() => handleDeleteIndicator(item)} style={{border:'none', background:'none', cursor:'pointer', color:'#D32F2F', fontWeight:'bold'}}>✕</button>
                </div>
             ))}
          </div>
        </div>

        {/* LISTA TAREAS */}
        <h3 style={{color:'#455A64'}}>Misiones y Rutinas Activas</h3>
        {activeTasks.length === 0 ? (
          <p style={{color:'#999', fontStyle:'italic'}}>No hay tareas activas.</p>
        ) : (
          <div style={{display:'grid', gap:'10px'}}>
            {activeTasks.map(t => {
              const isRoutine = t.type === 'routine';
              return (
                <div key={t.id} style={{background:'white', padding:'15px', borderRadius:'8px', borderLeft:`5px solid ${t.themeColor || '#ccc'}`, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                  <div>
                    <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                      <span style={{fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white', background: isRoutine ? '#9C27B0' : '#E65100'}}>
                        {isRoutine ? 'RUTINA' : 'MISIÓN'}
                      </span>
                      <strong style={{color:'#333'}}>{t.title}</strong>
                    </div>
                    <div style={{fontSize:'13px', color:'#666', marginTop:'2px'}}>{t.description}</div>
                  </div>
                  <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => handleOpenEditTask(t)} style={{border:'none', background:'none', cursor:'pointer', fontSize:'18px'}}>✏️</button>
                    <button onClick={() => handleDeleteTask(t.id, isRoutine)} style={{color:'#D32F2F', background:'none', border:'none', cursor:'pointer', fontSize:'18px'}}>🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* MODALES */}
        <AssignmentModal 
          isOpen={isAssignmentModalOpen}
          onClose={() => { setIsAssignmentModalOpen(false); setTaskToEdit(null); loadPatientTasks(selectedPatient.id); }}
          patientId={selectedPatient.id}
          professionalId={user.uid}
          patientName={selectedPatient.fullName}
          userProfessionId={profData?.professionType || 'psychologist'}
          taskToEdit={taskToEdit}
        />
        <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} patientId={selectedPatient.id} patientName={selectedPatient.fullName} />
      </div>
    );
  }

  // >>> DASHBOARD PRINCIPAL <<<
  return (
    <div style={{ padding: '30px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* HEADER con Saldo Nexus */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom:'1px solid #eee', paddingBottom:'20px' }}>
        <div>
           <h1 style={{ margin: 0, color: '#1565C0' }}>Panel Médico</h1>
           <p style={{ margin: '5px 0', color: '#666' }}>Dr(a). {profData?.fullName}</p>
           <div style={{display:'flex', gap:'10px', marginTop:'5px'}}>
             {profData?.professionalCode && (
               <span style={{ background: '#E3F2FD', padding: '5px 12px', borderRadius: '15px', fontSize: '13px', color: '#1565C0', fontWeight:'bold', border:'1px solid #BBDEFB' }}>
                 🔑 {profData.professionalCode}
               </span>
             )}
             {/* SALDO DE NEXUS DEL DOCTOR */}
             <span style={{ background: '#E0F7FA', padding: '5px 12px', borderRadius: '15px', fontSize: '13px', color: '#006064', fontWeight:'bold', border:'1px solid #B2EBF2' }}>
                 💎 {profData?.nexusBalance || 0} Nexus Disp.
             </span>
           </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => setView('dashboard')} style={{ padding: '10px 15px', background: view==='dashboard'?'#333':'white', color: view==='dashboard'?'white':'#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>📊 Resumen</button>
          <button onClick={() => setView('patients_manage')} style={{ padding: '10px 15px', background: (view==='patients_manage' || view==='patient_detail')?'#333':'white', color: (view==='patients_manage' || view==='patient_detail')?'white':'#333', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer' }}>👥 Pacientes</button>
          <button onClick={() => setView('agenda')} style={{ padding: '10px 15px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>📅 Agenda</button>
          <button onClick={() => setView('team')} style={{ padding: '10px 15px', background: '#607D8B', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>🛡️ Equipo</button>
          <button onClick={() => auth.signOut()} style={{ padding: '10px', background: '#f44336', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Salir</button>
        </div>
      </div>

      {/* VISTAS DE CONTENIDO */}
      {view === 'patients_manage' && (
        <div>
           <h2 style={{color:'#333', borderBottom:'2px solid #2196F3', display:'inline-block', paddingBottom:'5px'}}>Gestión de Pacientes</h2>
           {/* SOLICITUDES PENDIENTES */}
           {pendingPatients.length > 0 && (
              <div style={{marginBottom:'40px', background:'#FFF3E0', padding:'20px', borderRadius:'10px', border:'1px solid #FFE0B2'}}>
                 <h3 style={{marginTop:0, color:'#E65100'}}>🔔 Solicitudes ({pendingPatients.length})</h3>
                 <div style={{display:'grid', gap:'10px', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))'}}>
                    {pendingPatients.map(p => (
                       <div key={p.id} style={{background:'white', padding:'15px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                          <div><strong>{p.fullName}</strong><div style={{fontSize:'12px'}}>{p.email}</div></div>
                          <button onClick={() => handleApprovePatient(p)} style={{background:'#4CAF50', color:'white', border:'none', padding:'5px 10px', borderRadius:'4px', cursor:'pointer'}}>Aprobar</button>
                       </div>
                    ))}
                 </div>
              </div>
           )}
           
           {/* LISTA ACTIVOS */}
           <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
               <h3 style={{color:'#1565C0', margin:0}}>🟢 Pacientes Activos ({activePatients.length})</h3>
               <input type="text" placeholder="🔍 Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} />
           </div>
           
           <div style={{background:'white', borderRadius:'8px', boxShadow:'0 2px 10px rgba(0,0,0,0.05)', overflowX:'auto'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                 <thead style={{background:'#f5f5f5'}}><tr><th style={{padding:'15px', textAlign:'left'}}>Nombre</th><th style={{padding:'15px', textAlign:'left'}}>Contacto</th><th style={{padding:'15px', textAlign:'center'}}>Acciones</th></tr></thead>
                 <tbody>
                    {filteredPatients.map(p => (
                      <tr key={p.id} style={{borderBottom:'1px solid #eee'}}>
                         <td style={{padding:'15px', fontWeight:'bold'}}>{p.fullName}</td>
                         <td style={{padding:'15px'}}>{p.email}</td>
                         <td style={{padding:'15px', textAlign:'center'}}><button onClick={() => handleOpenPatient(p)} style={{padding:'5px 10px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>📂 Abrir</button></td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {view === 'dashboard' && (
        <div style={{textAlign:'center', padding:'40px'}}>
           <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px'}}>
              <div style={{padding:'20px', background:'white', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}>
                 <div style={{fontSize:'24px', fontWeight:'bold', color:'#2196F3'}}>{activePatients.length}</div>
                 <div>Pacientes Activos</div>
              </div>
              <div style={{padding:'20px', background:'white', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}>
                 <div style={{fontSize:'24px', fontWeight:'bold', color:'#006064'}}>{profData?.nexusBalance || 0}</div>
                 <div>Nexus Disponibles</div>
              </div>
           </div>
        </div>
      )}

      {view === 'team' && (
        <div><h2>Equipo</h2>{assistants.length === 0 ? <p>Sin asistentes.</p> : assistants.map(a => <div key={a.uid}>{a.displayName}</div>)}</div>
      )}
    </div>
  );
}