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
import DashboardMenu from './DashboardMenu'; // Asegúrate de haber creado este archivo

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

        // Cargar Asistentes
        if (data.authorizedAssistants && data.authorizedAssistants.length > 0) {
          const qAssist = query(collection(db, "users"), where("uid", "in", data.authorizedAssistants));
          const snapAssist = await getDocs(qAssist);
          setAssistants(snapAssist.docs.map(d => ({ uid: d.id, ...d.data() })));
        } else {
          setAssistants([]);
        }

        // Cargar Pacientes
        if (data.professionalCode) {
          const qPats = query(collection(db, "patients"), where("linkedProfessionalCode", "==", data.professionalCode));
          const snapPats = await getDocs(qPats);
          
          const pending: any[] = [];
          const active: any[] = [];

          snapPats.docs.forEach(d => {
            const pData = d.data();
            const pId = d.id;
            
            // Verificar si soy el médico activo en su CareTeam
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
      
      setSelectedPatient((prev: any) => ({
        ...prev,
        lastAttendance: { ...prev.lastAttendance, [user.uid]: new Date() },
        gamificationProfile: {
          ...prev.gamificationProfile,
          wallet: { ...prev.gamificationProfile.wallet, nexus: (prev.gamificationProfile.wallet.nexus||0) + 1 }
        }
      }));

      // Abrir modal directamente
      setTaskToEdit(null);
      setIsAssignmentModalOpen(true);

    } catch (e) {
      console.error(e);
      alert("Error en la transacción.");
    }
  };

  const handleOpenCreateTask = () => {
    if (!hasValidAttendance(selectedPatient)) {
      return handleRegisterAttendance();
    }
    setTaskToEdit(null);
    setIsAssignmentModalOpen(true);
  };

  const handleOpenEditTask = (task: any) => {
    setTaskToEdit(task);
    setIsAssignmentModalOpen(true);
  };

  // --- RESTO DE FUNCIONES ---
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

  // =================================================================
  // >>> RENDERIZADO PRINCIPAL (NUEVA ESTRUCTURA CON SIDEBAR) <<<
  // =================================================================
  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: '#F4F6F8' }}>
      
      {/* BARRA LATERAL IZQUIERDA */}
      <DashboardMenu 
        activeView={view} 
        onNavigate={setView} 
        onLogout={() => auth.signOut()} 
      />

      {/* ÁREA DE CONTENIDO PRINCIPAL (Derecha) */}
      <div style={{ flex: 1, padding: '30px', maxWidth: '1200px', margin: '0 auto', overflowY: 'auto' }}>
        
        {/* HEADER SUPERIOR */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', borderBottom:'1px solid #E0E0E0', paddingBottom:'20px' }}>
          <div>
            <h1 style={{ margin: 0, color: '#37474F', fontSize: '24px' }}>
               {view === 'dashboard' && 'Resumen General'}
               {view === 'patients_manage' && 'Gestión de Pacientes'}
               {view === 'agenda' && 'Mi Agenda'}
               {view === 'team' && 'Equipo Clínico'}
               {view === 'patient_detail' && 'Expediente del Paciente'}
            </h1>
            <p style={{ margin: '5px 0', color: '#78909C' }}>Dr(a). {profData?.fullName}</p>
          </div>

          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
             {profData?.professionalCode && (
              <span style={{ background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#1565C0', fontWeight:'bold', border:'1px solid #BBDEFB', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' }}>
                🔑 {profData.professionalCode}
              </span>
            )}
            <span style={{ background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#00695C', fontWeight:'bold', border:'1px solid #B2DFDB', boxShadow:'0 2px 5px rgba(0,0,0,0.05)' }}>
              💎 {profData?.nexusBalance || 0} Nexus
            </span>
          </div>
        </div>

        {/* --- VISTA: AGENDA --- */}
        {view === 'agenda' ? (
          <AgendaView userRole="professional" currentUserId={user.uid} onBack={() => setView('dashboard')} />
        
        // --- VISTA: GESTIÓN DE PACIENTES ---
        ) : view === 'patients_manage' ? (
          <div>
             {/* SOLICITUDES PENDIENTES */}
            {pendingPatients.length > 0 && (
              <div style={{marginBottom:'30px', background:'#FFF3E0', padding:'20px', borderRadius:'10px', border:'1px solid #FFE0B2'}}>
                <h3 style={{marginTop:0, color:'#E65100'}}>🔔 Solicitudes ({pendingPatients.length})</h3>
                <div style={{display:'grid', gap:'10px', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))'}}>
                  {pendingPatients.map(p => (
                    <div key={p.id} style={{background:'white', padding:'15px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
                      <div><strong>{p.fullName}</strong><div style={{fontSize:'12px', color:'#666'}}>{p.email}</div></div>
                      <button onClick={() => handleApprovePatient(p)} style={{background:'#4CAF50', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer'}}>Aprobar</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* LISTA ACTIVOS */}
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
              <h3 style={{color:'#455A64', margin:0}}>Pacientes Activos ({activePatients.length})</h3>
              <input type="text" placeholder="🔍 Buscar paciente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{padding:'10px', borderRadius:'6px', border:'1px solid #CFD8DC', width:'250px'}} />
            </div>

            <div style={{background:'white', borderRadius:'10px', boxShadow:'0 2px 10px rgba(0,0,0,0.03)', overflow:'hidden'}}>
              <table style={{width:'100%', borderCollapse:'collapse'}}>
                <thead style={{background:'#ECEFF1', color:'#455A64'}}>
                    <tr>
                        <th style={{padding:'15px', textAlign:'left', fontSize:'13px', textTransform:'uppercase'}}>Nombre</th>
                        <th style={{padding:'15px', textAlign:'left', fontSize:'13px', textTransform:'uppercase'}}>Contacto</th>
                        <th style={{padding:'15px', textAlign:'center', fontSize:'13px', textTransform:'uppercase'}}>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr key={p.id} style={{borderBottom:'1px solid #eee'}}>
                      <td style={{padding:'15px', fontWeight:'bold', color:'#37474F'}}>{p.fullName}</td>
                      <td style={{padding:'15px', color:'#546E7A'}}>{p.email}</td>
                      <td style={{padding:'15px', textAlign:'center'}}>
                          <button onClick={() => handleOpenPatient(p)} style={{padding:'6px 15px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>
                            📂 Ver Expediente
                          </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && (
                      <tr><td colSpan={3} style={{padding:'20px', textAlign:'center', color:'#999'}}>No se encontraron pacientes.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        // --- VISTA: DASHBOARD INICIAL ---
        ) : view === 'dashboard' ? (
          <div style={{textAlign:'center', padding:'40px'}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:'20px'}}>
              <div style={{padding:'30px', background:'white', borderRadius:'12px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', borderBottom:'4px solid #2196F3'}}>
                <div style={{fontSize:'36px', fontWeight:'bold', color:'#2196F3', marginBottom:'5px'}}>{activePatients.length}</div>
                <div style={{color:'#546E7A', fontWeight:'bold'}}>Pacientes Activos</div>
              </div>
              <div style={{padding:'30px', background:'white', borderRadius:'12px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', borderBottom:'4px solid #00BCD4'}}>
                <div style={{fontSize:'36px', fontWeight:'bold', color:'#00838F', marginBottom:'5px'}}>{profData?.nexusBalance || 0}</div>
                <div style={{color:'#546E7A', fontWeight:'bold'}}>Nexus Disponibles</div>
              </div>
            </div>
             <div style={{marginTop:'50px', color:'#90A4AE'}}>
                 <p>Selecciona una opción del menú lateral para comenzar.</p>
             </div>
          </div>

        // --- VISTA: EQUIPO ---
        ) : view === 'team' ? (
          <div>
              <h2>Equipo de Trabajo</h2>
              {assistants.length === 0 ? <p style={{color:'#666'}}>No hay asistentes registrados.</p> : assistants.map(a => <div key={a.uid} style={{padding:'10px', borderBottom:'1px solid #eee'}}>{a.displayName}</div>)}
          </div>
        
        // --- VISTA: DETALLE DE PACIENTE (Ahora integrada en el layout) ---
        ) : view === 'patient_detail' && selectedPatient ? (
           <div style={{ paddingBottom: '50px' }}>
                
                {/* SUB-NAV VOLVER */}
                <button onClick={() => setView('patients_manage')} style={{marginBottom:'20px', background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', gap:'5px'}}> 
                  ⬅ Volver a la lista 
                </button>

                {/* HEADER PACIENTE */}
                <div style={{background:'white', padding:'25px', borderRadius:'12px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                        <h1 style={{margin:'0 0 5px 0', color:'#1565C0', fontSize:'22px'}}>{selectedPatient.fullName}</h1>
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
                                onClick={hasValidAttendance(selectedPatient) ? handleOpenCreateTask : handleRegisterAttendance}
                                style={{
                                    padding:'10px 20px',
                                    background: hasValidAttendance(selectedPatient) ? '#2196F3' : '#E0E0E0',
                                    color: hasValidAttendance(selectedPatient) ? 'white' : '#757575',
                                    border: hasValidAttendance(selectedPatient) ? 'none' : '1px solid #ccc',
                                    borderRadius:'6px', cursor:'pointer', fontWeight:'bold',
                                    display:'flex', alignItems:'center', gap:'8px'
                                }}
                            >
                                {hasValidAttendance(selectedPatient) ? (
                                    <>+ Asignar Tarea</>
                                ) : (
                                    <>🔒 Registrar Asistencia (-1 Nexus)</>
                                )}
                            </button>
                        </div>
                        {!hasValidAttendance(selectedPatient) && (
                            <small style={{color:'#D32F2F', fontSize:'11px'}}>
                                * Requiere asistencia reciente (72h) para asignar.
                            </small>
                        )}
                    </div>
                </div>

                {/* NOTAS CLÍNICAS */}
                <div style={{background:'#FFFDE7', padding:'20px', borderRadius:'8px', border:'1px solid #FFF59D', marginBottom:'25px'}}>
                    <h3 style={{marginTop:0, color:'#F57F17', fontSize:'16px'}}>🔓 Notas Clínicas (Privadas)</h3>
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
                        {(selectedPatient.clinicalIndicators?.[user.uid] || []).map((item: string, idx: number) => (
                            <div key={idx} style={{background:'white', border:'1px solid #FFF176', padding:'5px 12px', borderRadius:'20px', fontSize:'14px', color:'#555', display:'flex', alignItems:'center', gap:'8px'}}>
                                • {item} <button onClick={() => handleDeleteIndicator(item)} style={{border:'none', background:'none', cursor:'pointer', color:'#D32F2F', fontWeight:'bold'}}>✕</button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* LISTA TAREAS */}
                <h3 style={{color:'#455A64'}}>Misiones y Rutinas Activas</h3>
                {patientTasks.filter(t => t.status !== 'completed').length === 0 ? (
                    <p style={{color:'#999', fontStyle:'italic'}}>No hay tareas activas.</p>
                ) : (
                    <div style={{display:'grid', gap:'10px'}}>
                        {patientTasks.filter(t => t.status !== 'completed').map(t => {
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
                                        <button onClick={() => handleDeleteTask(t.id, isRoutine)} style={{color:'#D32F2F', background:'none', border:'none', cursor:'pointer', fontSize:'18px'}}>🗑️</button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* MODALES DEL DETALLE */}
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
        ) : null}

      </div>
    </div>
  );
}