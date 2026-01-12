import { useState, useEffect } from 'react';
import { 
  collection, query, where, getDocs, doc, updateDoc, 
  arrayRemove, getDoc, increment, deleteDoc, arrayUnion, writeBatch, serverTimestamp 
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
// Importamos la nueva agenda modular (Asegúrate de que este archivo exista)
import AgendaView from './agenda';
import AssignmentModal from './AssignmentModal';
import HistoryModal from './HistoryModal';
import DashboardMenu from './DashboardMenu';

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
  const [loading, setLoading] = useState(true);
  const [profData, setProfData] = useState<any>(null);

  // --- ESTADOS PACIENTE ---
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientTasks, setPatientTasks] = useState<any[]>([]);

  // --- ESTADOS DE FUSIÓN (MERGE) ---
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [patientToApprove, setPatientToApprove] = useState<any>(null); // El usuario de la App
  const [manualCandidates, setManualCandidates] = useState<any[]>([]); // Posibles duplicados manuales
  const [manualIdToMerge, setManualIdToMerge] = useState<string>(''); // ID seleccionado para fusionar
  const [processingMerge, setProcessingMerge] = useState(false);

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

          // Cargar pacientes manuales activos
          const qManual = query(collection(db, "patients"), where("linkedProfessionalId", "==", user.uid), where("isManual", "==", true));
          const snapManual = await getDocs(qManual);
          snapManual.docs.forEach(d => {
            if(!active.find(p => p.id === d.id)) {
              active.push({id: d.id, ...d.data()});
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

  // =================================================================
  // LÓGICA DE FUSIÓN (MERGE)
  // =================================================================

  const handleOpenApproveModal = (patientApp: any) => {
    setPatientToApprove(patientApp);
    const candidates = activePatients.filter(p => p.isManual === true);
    setManualCandidates(candidates);
    setManualIdToMerge(''); 
    setIsMergeModalOpen(true);
  };

  const handleExecuteMerge = async (shouldMerge: boolean) => {
    if (!patientToApprove) return;
    setProcessingMerge(true);

    try {
      const batch = writeBatch(db);
      const appPatientRef = doc(db, "patients", patientToApprove.id);

      let appTeamKey = 'general';
      if (patientToApprove.careTeam) {
        const found = Object.keys(patientToApprove.careTeam).find(k => patientToApprove.careTeam[k].professionalId === user.uid);
        if (found) appTeamKey = found;
      }

      // 1. CASO FUSIÓN
      if (shouldMerge && manualIdToMerge) {
        const manualPatient = manualCandidates.find(p => p.id === manualIdToMerge);
        if (!manualPatient) throw new Error("Paciente manual no encontrado");

        const manualRef = doc(db, "patients", manualIdToMerge);

        // A. Migrar Notas
        const manualIndicators = manualPatient.clinicalIndicators?.[user.uid] || [];
        if (manualIndicators.length > 0) {
          batch.update(appPatientRef, {
            [`clinicalIndicators.${user.uid}`]: arrayUnion(...manualIndicators)
          });
        }

        // B. Migrar Datos de CareTeam
        const manualTeamData = manualPatient.careTeam?.[user.uid];
        if (manualTeamData) {
           if(manualTeamData.customPrice) {
             batch.update(appPatientRef, { [`careTeam.${appTeamKey}.customPrice`]: manualTeamData.customPrice });
           }
           if(manualTeamData.noShowCount) {
             batch.update(appPatientRef, { [`careTeam.${appTeamKey}.noShowCount`]: manualTeamData.noShowCount });
           }
        }

        // C. Actualizar Tareas
        const qMissions = query(collection(db, "assigned_missions"), where("patientId", "==", manualIdToMerge));
        const qRoutines = query(collection(db, "assigned_routines"), where("patientId", "==", manualIdToMerge));
        const [snapM, snapR] = await Promise.all([getDocs(qMissions), getDocs(qRoutines)]);

        snapM.docs.forEach(docSnap => {
          batch.update(doc(db, "assigned_missions", docSnap.id), { patientId: patientToApprove.id });
        });
        snapR.docs.forEach(docSnap => {
          batch.update(doc(db, "assigned_routines", docSnap.id), { patientId: patientToApprove.id });
        });

        // D. Eliminar Manual
        batch.delete(manualRef);
      }

      // 2. ACTIVACIÓN
      batch.update(appPatientRef, {
        isAuthorized: true,
        [`careTeam.${appTeamKey}.active`]: true,
        [`careTeam.${appTeamKey}.status`]: 'active',
        [`careTeam.${appTeamKey}.joinedAt`]: new Date().toISOString()
      });

      await batch.commit();

      alert(shouldMerge ? "✅ Pacientes fusionados y acceso aprobado." : "✅ Acceso aprobado (Nuevo expediente).");
      setIsMergeModalOpen(false);
      loadData(); 

    } catch (e: any) {
      console.error(e);
      alert("Error en el proceso: " + e.message);
    } finally {
      setProcessingMerge(false);
    }
  };

  // =================================================================
  // LÓGICA DE ASIGNACIÓN (CANDADO)
  // =================================================================
  const hasValidAttendance = (patient: any): boolean => {
    if (!patient.lastAttendance) return false;
    const myLastDate = patient.lastAttendance[user.uid];
    if (!myLastDate) return false;

    const dateObj = myLastDate.toDate ? myLastDate.toDate() : new Date(myLastDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - dateObj.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));

    return diffHours <= 72; // 3 días
  };

  const handleRegisterAttendance = async () => {
    if (!selectedPatient) return;
    const currentBalance = profData?.nexusBalance || 0;
    if (currentBalance < 1) return alert("❌ Sin saldo suficiente.");

    if (!window.confirm(`¿Registrar asistencia de HOY?\nCosto: 1 Nexus.\nPremio: +1 Nexus al paciente.`)) return;

    try {
      const batch = writeBatch(db);
      const profRef = doc(db, "professionals", user.uid);
      batch.update(profRef, { nexusBalance: increment(-1), "metrics.nexusDistributed": increment(1) });

      const patRef = doc(db, "patients", selectedPatient.id);
      batch.update(patRef, {
        [`lastAttendance.${user.uid}`]: serverTimestamp(),
        "gamificationProfile.currentXp": increment(50),
        "gamificationProfile.wallet.nexus": increment(1)
      });

      await batch.commit();
      alert("✅ Asistencia registrada.");

      setProfData((prev: any) => ({...prev, nexusBalance: prev.nexusBalance - 1}));
      setSelectedPatient((prev: any) => ({
        ...prev,
        lastAttendance: { ...prev.lastAttendance, [user.uid]: new Date() }
      }));
      setTaskToEdit(null);
      setIsAssignmentModalOpen(true);

    } catch (e) { console.error(e); }
  };

  const handleOpenCreateTask = () => {
    if (!hasValidAttendance(selectedPatient)) return handleRegisterAttendance();
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
      const all = [...missions, ...routines].sort((a: any, b: any) => (b.createdAt?.toDate?.() || 0) - (a.createdAt?.toDate?.() || 0));
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

  const filteredPatients = activePatients.filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

  // =================================================================
  // RENDERIZADO
  // =================================================================
  
  // FIX: Usamos la variable loading para mostrar pantalla de carga
  if (loading) return <div style={{padding:'50px', textAlign:'center', color:'#666', fontFamily:'sans-serif'}}>Cargando panel profesional...</div>;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', fontFamily: 'sans-serif', background: '#F4F6F8' }}>

      <DashboardMenu activeView={view} onNavigate={setView} onLogout={() => auth.signOut()} />

      <div style={{ flex: 1, padding: '30px', maxWidth: '1200px', margin: '0 auto', overflowY: 'auto' }}>

        {/* HEADER */}
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

        ) : view === 'patients_manage' ? (
          <div>
            {/* SOLICITUDES PENDIENTES */}
            {pendingPatients.length > 0 && (
              <div style={{marginBottom:'30px', background:'#FFF3E0', padding:'20px', borderRadius:'10px', border:'1px solid #FFE0B2'}}>
                <h3 style={{marginTop:0, color:'#E65100'}}>🔔 Solicitudes ({pendingPatients.length})</h3>
                <div style={{display:'grid', gap:'10px', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))'}}>
                  {pendingPatients.map(p => (
                    <div key={p.id} style={{background:'white', padding:'15px', borderRadius:'8px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 4px rgba(0,0,0,0.05)'}}>
                      <div>
                        <strong>{p.fullName}</strong>
                        <div style={{fontSize:'12px', color:'#666'}}>{p.email}</div>
                      </div>
                      <button 
                        onClick={() => handleOpenApproveModal(p)}
                        style={{background:'#FF9800', color:'white', border:'none', padding:'6px 12px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}
                      >
                        Revisar
                      </button>
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
                      <td style={{padding:'15px', fontWeight:'bold', color:'#37474F'}}>
                        {p.fullName} {p.isManual && <span style={{fontSize:'10px', background:'#eee', padding:'2px 4px', borderRadius:'4px', color:'#666'}}>MANUAL</span>}
                      </td>
                      <td style={{padding:'15px', color:'#546E7A'}}>{p.email}</td>
                      <td style={{padding:'15px', textAlign:'center'}}>
                        <button onClick={() => handleOpenPatient(p)} style={{padding:'6px 15px', background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:'20px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>
                          📂 Expediente
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredPatients.length === 0 && <tr><td colSpan={3} style={{padding:'20px', textAlign:'center', color:'#999'}}>No se encontraron pacientes.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>

        ) : view === 'dashboard' ? (
          <div style={{textAlign:'center', padding:'40px'}}>
             {/* ... contenido del dashboard dashboard ... */}
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
          </div>

        ) : view === 'team' ? (
          <div>
            <h2>Equipo de Trabajo</h2>
            {assistants.length === 0 ? <p style={{color:'#666'}}>No hay asistentes.</p> : assistants.map(a => <div key={a.uid} style={{padding:'10px', borderBottom:'1px solid #eee'}}>{a.displayName}</div>)}
          </div>

        ) : view === 'patient_detail' && selectedPatient ? (
          <div style={{ paddingBottom: '50px' }}>
            <button onClick={() => setView('patients_manage')} style={{marginBottom:'20px', background:'none', border:'none', color:'#666', cursor:'pointer', fontSize:'14px', display:'flex', alignItems:'center', gap:'5px'}}> ⬅ Volver </button>
            <div style={{background:'white', padding:'25px', borderRadius:'12px', boxShadow:'0 4px 15px rgba(0,0,0,0.05)', marginBottom:'20px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
              <div>
                <h1 style={{margin:'0 0 5px 0', color:'#1565C0', fontSize:'22px'}}>{selectedPatient.fullName}</h1>
                <div style={{color:'#666', fontSize:'14px'}}>{selectedPatient.email} • {selectedPatient.contactNumber}</div>
                <div style={{marginTop:'10px', display:'flex', gap:'10px'}}>
                  <span style={{background:'#E1BEE7', color:'#4A148C', padding:'4px 10px', borderRadius:'15px', fontWeight:'bold', fontSize:'12px'}}>Nivel {selectedPatient.gamificationProfile?.level || 1}</span>
                  <span style={{background:'#B3E5FC', color:'#0277BD', padding:'4px 10px', borderRadius:'15px', fontWeight:'bold', fontSize:'12px'}}>💎 {selectedPatient.gamificationProfile?.wallet?.nexus || 0} Nexus</span>
                </div>
              </div>
              <div style={{display:'flex', flexDirection:'column', gap:'10px', alignItems:'flex-end'}}>
                 <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => setIsHistoryOpen(true)} style={{padding:'10px 15px', background:'#607D8B', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>📜 Historial</button>
                    <button onClick={hasValidAttendance(selectedPatient) ? handleOpenCreateTask : handleRegisterAttendance} style={{padding:'10px 20px', background: hasValidAttendance(selectedPatient) ? '#2196F3' : '#E0E0E0', color: hasValidAttendance(selectedPatient) ? 
                      'white' : '#757575', border: hasValidAttendance(selectedPatient) ? 'none' : '1px solid #ccc', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', display:'flex', alignItems:'center', gap:'8px'}}>
                      {hasValidAttendance(selectedPatient) ? <>+ Asignar Tarea</> : <>🔒 Registrar Asistencia</>}
                    </button>
                 </div>
              </div>
            </div>

            {/* NOTAS */}
            <div style={{background:'#FFFDE7', padding:'20px', borderRadius:'8px', border:'1px solid #FFF59D', marginBottom:'25px'}}>
              <h3 style={{marginTop:0, color:'#F57F17', fontSize:'16px'}}>🔓 Notas Clínicas</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                <input value={newIndicator} onChange={(e) => setNewIndicator(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddIndicator()} placeholder="Nota rápida..." style={{flex:1, padding:'10px', borderRadius:'4px', border:'1px solid #FBC02D'}} />
                <button onClick={handleAddIndicator} style={{background:'#FBC02D', color:'#333', border:'none', padding:'0 20px', borderRadius:'4px', cursor:'pointer'}}>Agregar</button>
              </div>
              <div style={{display:'flex', flexWrap:'wrap', gap:'8px'}}>
                {(selectedPatient.clinicalIndicators?.[user.uid] || []).map((item: string, idx: number) => (
                  <div key={idx} style={{background:'white', border:'1px solid #FFF176', padding:'5px 12px', borderRadius:'20px', fontSize:'14px', color:'#555', display:'flex', alignItems:'center', gap:'8px'}}>
                    • {item} <button onClick={() => handleDeleteIndicator(item)} style={{border:'none', background:'none', cursor:'pointer', color:'#D32F2F', fontWeight:'bold'}}> ✕ </button>
                  </div>
                ))}
              </div>
            </div>

            {/* TAREAS */}
            <h3 style={{color:'#455A64'}}>Misiones y Rutinas</h3>
            {patientTasks.filter(t => t.status !== 'completed').length === 0 ? <p style={{color:'#999'}}>No hay tareas activas.</p> : (
              <div style={{display:'grid', gap:'10px'}}>
                {patientTasks.filter(t => t.status !== 'completed').map(t => (
                  <div key={t.id} style={{background:'white', padding:'15px', borderRadius:'8px', borderLeft:`5px solid ${t.themeColor || '#ccc'}`, display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                    <div>
                      <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
                        <span style={{fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white', background: t.type === 'routine' ? '#9C27B0' : '#E65100'}}>{t.type === 'routine' ? 'RUTINA' : 'MISIÓN'}</span>
                        <strong style={{color:'#333'}}>{t.title}</strong>
                      </div>
                      <div style={{fontSize:'13px', color:'#666'}}>{t.description}</div>
                    </div>
                    <div style={{display:'flex', gap:'10px'}}>
                      <button onClick={() => handleOpenEditTask(t)} style={{border:'none', background:'none', cursor:'pointer', fontSize:'18px'}}>✏️</button>
                      <button onClick={() => handleDeleteTask(t.id, t.type === 'routine')} style={{color:'#D32F2F', background:'none', border:'none', cursor:'pointer', fontSize:'18px'}}>🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <AssignmentModal isOpen={isAssignmentModalOpen} onClose={() => { setIsAssignmentModalOpen(false); setTaskToEdit(null); loadPatientTasks(selectedPatient.id); }} patientId={selectedPatient.id} professionalId={user.uid} patientName={selectedPatient.fullName} userProfessionId={profData?.professionType || 'psychologist'} taskToEdit={taskToEdit} />
            <HistoryModal isOpen={isHistoryOpen} onClose={() => setIsHistoryOpen(false)} patientId={selectedPatient.id} patientName={selectedPatient.fullName} />
          </div>
        ) : null}

      </div>

      {/* --- MODAL DE FUSIÓN DE PACIENTES --- */}
      {isMergeModalOpen && patientToApprove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '500px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)' }}>
            <h2 style={{ marginTop: 0, color: '#1565C0' }}>🔗 Fusión de Expedientes</h2>
            <p style={{ color: '#555', lineHeight: '1.5' }}>
              El usuario <strong>{patientToApprove.fullName}</strong> ({patientToApprove.email}) ha solicitado acceso a través de la App.
              <br /><br />
              ¿Este usuario corresponde a algún paciente que ya tenías registrado manualmente?
            </p>

            {manualCandidates.length > 0 ? (
              <div style={{ marginBottom: '20px', background: '#F5F5F5', padding: '15px', borderRadius: '8px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 'bold', color: '#666' }}>Selecciona el expediente manual a fusionar:</label>
                <select 
                  value={manualIdToMerge} 
                  onChange={(e) => setManualIdToMerge(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '4px', border: '1px solid #ccc' }}
                >
                  <option value="">-- No, es un paciente nuevo --</option>
                  {manualCandidates.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} (Manual)
                    </option>
                  ))}
                </select>
                {manualIdToMerge && (
                  <p style={{fontSize:'12px', color:'#E65100', marginTop:'10px'}}>
                    ⚠️ Al fusionar, se moverán las notas, misiones y rutinas del paciente manual al nuevo usuario, y <b>se eliminará el registro manual duplicado.</b>
                  </p>
                )}
              </div>
            ) : (
              <div style={{ padding: '15px', background: '#E3F2FD', borderRadius: '8px', marginBottom: '20px', color: '#0277BD', fontSize: '13px' }}>
                ℹ️ No se encontraron pacientes manuales activos para sugerir, pero puedes aprobarlo como nuevo.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button 
                onClick={() => setIsMergeModalOpen(false)}
                disabled={processingMerge}
                style={{ padding: '10px 20px', background: '#ECEFF1', border: 'none', borderRadius: '4px', color: '#546E7A', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              
              {manualIdToMerge ? (
                <button 
                  onClick={() => handleExecuteMerge(true)}
                  disabled={processingMerge}
                  style={{ padding: '10px 20px', background: '#FF9800', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {processingMerge ? 'Procesando...' : '🔄 Fusionar y Aprobar'}
                </button>
              ) : (
                <button 
                  onClick={() => handleExecuteMerge(false)}
                  disabled={processingMerge}
                  style={{ padding: '10px 20px', background: '#4CAF50', border: 'none', borderRadius: '4px', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  {processingMerge ? 'Procesando...' : '✅ Aprobar como Nuevo'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}