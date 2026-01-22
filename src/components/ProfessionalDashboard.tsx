import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc,
  arrayRemove, getDoc, increment, deleteDoc, arrayUnion, writeBatch, serverTimestamp
} from "firebase/firestore";
import { auth, db } from '../services/firebase';

// Importamos componentes locales
import AgendaView from './agenda';
import AssignmentModal from './AssignmentModal';
import HistoryModal from './HistoryModal';
import DashboardMenu from './DashboardMenu';
import { analyzeCatalogBatch } from '../utils/ClinicalEngine';

interface Props {
  user: any;
}

// --- COMPONENTE: GRÁFICO DE DONA CSS ---
const DoughnutChart = ({ percent, color, size = 100, label }: any) => {
  return (
    <div style={{position:'relative', width: size, height: size, display:'flex', justifyContent:'center', alignItems:'center'}}>
      <div style={{
         position:'absolute', inset:0, borderRadius:'50%',
         background: `conic-gradient(${color} ${percent}%, #E0E0E0 0)`
      }}></div>
      <div style={{
         position:'absolute', inset:'8px', borderRadius:'50%', background:'white',
         display:'flex', flexDirection:'column', justifyContent:'center', alignItems:'center'
      }}>
         <span style={{fontSize:'18px', fontWeight:'bold', color: '#333'}}>{percent}%</span>
         {label && <span style={{fontSize:'9px', color:'#666', textTransform:'uppercase'}}>{label}</span>}
      </div>
    </div>
  );
};

// --- COMPONENTE: BARRA DE PROGRESO DE TAREA ---
const TaskProgressBar = ({ task }: { task: any }) => {
  const completed = task.completionHistory?.length || 0;
  const total = task.totalVolumeExpected || 1;
  const percent = Math.min(100, Math.round((completed / total) * 100));

  const createdAt = task.createdAt?.toDate ? task.createdAt.toDate() : new Date();
  const now = new Date();
  let durationDays = 7; 
  if (task.durationWeeks) durationDays = task.durationWeeks * 7;
  const endDate = new Date(createdAt);
  endDate.setDate(endDate.getDate() + durationDays);
  const totalTime = endDate.getTime() - createdAt.getTime();
  const elapsedTime = now.getTime() - createdAt.getTime();
  const timePercent = Math.min(100, Math.max(0, (elapsedTime / totalTime) * 100));

  let statusColor = '#4CAF50'; 
  let statusText = 'A tiempo';
  if (percent >= 100) { statusColor = '#2E7D32'; statusText = 'Completada'; }
  else if (percent < (timePercent - 15)) { statusColor = '#F44336'; statusText = 'Atrasado'; }
  else if (percent > timePercent + 10) { statusColor = '#2196F3'; statusText = 'Adelantado'; }

  return (
    <div style={{marginTop:'10px'}}>
      <div style={{display:'flex', justifyContent:'space-between', fontSize:'11px', marginBottom:'3px', color:'#666'}}>
        <span>{completed}/{total} reps</span>
        <span style={{color: statusColor, fontWeight:'bold'}}>{statusText}</span>
      </div>
      <div style={{width:'100%', height:'6px', background:'#eee', borderRadius:'3px', overflow:'hidden', position:'relative'}}>
        <div style={{width:`${percent}%`, height:'100%', background: statusColor, transition:'width 0.5s ease', borderRadius:'3px'}}></div>
        {percent < 100 && <div style={{position:'absolute', top:0, bottom:0, width:'2px', background:'rgba(0,0,0,0.3)', left:`${timePercent}%`, zIndex:2}} title="Meta hoy" />}
      </div>
    </div>
  );
};

// --- COMPONENTE VISUAL STATS (INTEGRADO: TAGS + CARGA COGNITIVA) ---
const PatientVisualStats = ({ tasks, indicators, onAddTag, onDeleteTag }: any) => {
    const [newTag, setNewTag] = useState('');

    const activeTasks = tasks.filter((t:any) => t.status !== 'completed');
    const completedTasks = tasks.filter((t:any) => t.status === 'completed');
    
    // Cálculos de Adherencia
    let totalExpected = 0;
    let totalDone = 0;
    activeTasks.forEach((t:any) => {
        totalExpected += (t.totalVolumeExpected || 1);
        totalDone += (t.completionHistory?.length || 0);
    });
    const globalAdherence = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;

    // Cálculos de Carga Cognitiva
    const routinesCount = activeTasks.filter((t:any) => t.type === 'routine').length;
    const missionsCount = activeTasks.filter((t:any) => t.type !== 'routine').length;

    return (
        <div style={{
            background:'white', borderRadius:'12px', padding:'0', 
            boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:'20px', 
            display:'flex', overflow:'hidden', minHeight:'160px'
        }}>
            
            {/* 1. IZQUIERDA: ADHERENCIA + CARGA COGNITIVA */}
            <div style={{
                padding:'15px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', 
                minWidth:'160px', borderRight:'1px solid #f0f0f0', background:'#FAFAFA'
            }}>
               <DoughnutChart percent={globalAdherence} color="#2196F3" size={70} label="Adherencia" />
               
               {/* Sección de Carga Cognitiva Visual (Solicitada en V3) */}
               <div style={{marginTop:'12px', width:'100%', textAlign:'center'}}>
                   <div style={{fontSize:'10px', fontWeight:'bold', color:'#555', marginBottom:'4px', textTransform:'uppercase'}}>
                       Carga Activa ({activeTasks.length})
                   </div>
                   <div style={{display:'flex', justifyContent:'center', gap:'8px', fontSize:'11px'}}>
                       <span style={{color:'#9C27B0', fontWeight:'bold', background:'#F3E5F5', padding:'2px 6px', borderRadius:'4px'}}>
                           🟣 {routinesCount} Rut
                       </span>
                       <span style={{color:'#E65100', fontWeight:'bold', background:'#FFF3E0', padding:'2px 6px', borderRadius:'4px'}}>
                           🟠 {missionsCount} Mis
                       </span>
                   </div>
               </div>
            </div>

            {/* 2. CENTRO: PANEL DE TAGS (CON VISIBILIDAD GARANTIZADA) */}
            <div style={{flex: 1, padding:'20px', display:'flex', flexDirection:'column', background:'white'}}>
               <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
                  <h4 style={{margin:0, color:'#37474F', fontSize:'12px', textTransform:'uppercase', fontWeight:'bold'}}>
                      🏷️ Vocabulario Clínico (Tags)
                  </h4>
                  <span style={{fontSize:'10px', color:'#999'}}>{indicators.length} activos</span>
               </div>
               
               {/* Área de Scroll de Tags con Altura Mínima Reservada */}
               <div style={{
                   flex:1, 
                   minHeight:'60px', /* Garantiza espacio aunque esté vacío */
                   maxHeight:'90px', 
                   overflowY:'auto', 
                   display:'flex', 
                   flexWrap:'wrap', 
                   gap:'6px', 
                   alignContent:'flex-start', 
                   marginBottom:'10px'
               }}>
                   {indicators.length === 0 && (
                       <div style={{fontSize:'11px', color:'#ccc', fontStyle:'italic', width:'100%', marginTop:'5px'}}>
                           Sin observaciones. Escribe abajo para agregar...
                       </div>
                   )}
                   {indicators.map((tag: string, i: number) => (
                       <span key={i} style={{background:'#FFF9C4', border:'1px solid #FFF59D', padding:'3px 8px', borderRadius:'12px', fontSize:'11px', color:'#444', display:'flex', alignItems:'center', gap:'5px'}}>
                          {tag}
                          <button 
                            onClick={() => onDeleteTag(tag)}
                            style={{border:'none', background:'none', color:'#D32F2F', cursor:'pointer', fontWeight:'bold', fontSize:'14px', lineHeight:1, padding:0}}
                          >×</button>
                       </span>
                   ))}
               </div>

               {/* Input Integrado */}
               <div style={{display:'flex', background:'white', border:'1px solid #e0e0e0', borderRadius:'6px', padding:'2px 5px'}}>
                  <input 
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') { onAddTag(newTag); setNewTag(''); }
                    }}
                    placeholder="+ Agregar observación (ej. 'ansiedad')..." 
                    style={{border:'none', flex:1, fontSize:'12px', outline:'none', padding:'6px'}}
                  />
                  <button 
                    onClick={() => { onAddTag(newTag); setNewTag(''); }}
                    style={{background:'none', border:'none', color:'#2196F3', fontWeight:'bold', cursor:'pointer', fontSize:'11px', textTransform:'uppercase'}}
                  >
                    Guardar
                  </button>
               </div>
            </div>

            {/* 3. DERECHA: HISTÓRICO */}
            <div style={{
                padding:'20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', 
                minWidth:'100px', borderLeft:'1px solid #f0f0f0'
            }}>
               <div style={{fontSize:'24px', fontWeight:'bold', color:'#4CAF50', lineHeight:1}}>{completedTasks.length}</div>
               <div style={{fontSize:'10px', color:'#666', textTransform:'uppercase', textAlign:'center', marginTop:'5px'}}>Completadas</div>
               <div style={{fontSize:'24px', marginTop:'5px'}}>🏆</div>
            </div>
        </div>
    );
};

export default function ProfessionalDashboard({ user }: Props) {
  // --- ESTADOS ---
  const [view, setView] = useState<'dashboard' | 'agenda' | 'team' | 'patients_manage' | 'patient_detail' | 'analytics'>('dashboard');
  const [assistants, setAssistants] = useState<any[]>([]);
  const [activePatients, setActivePatients] = useState<any[]>([]);
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [profData, setProfData] = useState<any>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientTasks, setPatientTasks] = useState<any[]>([]);
  
  const [interventionStats, setInterventionStats] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false);
  const [patientToApprove, setPatientToApprove] = useState<any>(null);
  const [manualCandidates, setManualCandidates] = useState<any[]>([]);
  const [manualIdToMerge, setManualIdToMerge] = useState<string>('');
  const [processingMerge, setProcessingMerge] = useState(false);

  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [taskForHistory, setTaskForHistory] = useState<any>(null);

  // --- 1. LÓGICA DE VOCABULARIO CONTROLADO ---
  const [tagsCatalog, setTagsCatalog] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
    
    // Simulación de carga de catálogo (Diccionario local)
    // En producción esto vendría de una colección "tags_dictionary" en Firestore
    const LOCAL_DICTIONARY = {
        "desvelo": "Insomnio",
        "no duermo": "Insomnio",
        "triste": "Bajo Estado de Ánimo",
        "tristeza": "Bajo Estado de Ánimo",
        "llanto": "Labilidad Emocional",
        "nervioso": "Ansiedad",
        "nervios": "Ansiedad",
        "panico": "Crisis de Pánico",
        "miedo": "Temor",
        "cansado": "Fatiga",
        "agotado": "Fatiga"
    };
    setTagsCatalog(LOCAL_DICTIONARY);

  }, [user]);

  // Función Normalizadora (El "Cerebro" de los Tags)
  const normalizeTag = (rawText: string): string => {
      const lower = rawText.toLowerCase().trim();
      // Si existe en el diccionario, devuelve el término oficial. Si no, devuelve el original formateado.
      if (tagsCatalog[lower]) {
          return tagsCatalog[lower];
      }
      // Capitalizar primera letra si es nuevo
      return lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const profRef = doc(db, "professionals", user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data();
        setProfData(data);
        if (data.authorizedAssistants?.length > 0) {
          const qAssist = query(collection(db, "users"), where("uid", "in", data.authorizedAssistants));
          const snapAssist = await getDocs(qAssist);
          setAssistants(snapAssist.docs.map(d => ({ uid: d.id, ...d.data() })));
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
            if (pData.isAuthorized === false || !isMyPatientActive) pending.push({ id: pId, ...pData });
            else active.push({ id: pId, ...pData });
          });
          const qManual = query(collection(db, "patients"), where("linkedProfessionalId", "==", user.uid), where("isManual", "==", true));
          const snapManual = await getDocs(qManual);
          snapManual.docs.forEach(d => {
            if(!active.find(p => p.id === d.id)) active.push({id: d.id, ...d.data()});
          });
          setPendingPatients(pending);
          setActivePatients(active);
        }
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleGenerateAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
        const qM = query(collection(db, 'assigned_missions'), where('professionalId', '==', user.uid));
        const qR = query(collection(db, 'assigned_routines'), where('professionalId', '==', user.uid));
        const [snapM, snapR] = await Promise.all([getDocs(qM), getDocs(qR)]);
        const extract = (d:any, t:string) => {
            const da = d.data(); if(!da.catalogId) return null;
            return { ...da, id: d.id, type: t, catalogId: da.catalogId, title: da.title||"S/T", completionHistory: da.completionHistory||[]};
        };
        const tasks = [...snapM.docs.map(d=>extract(d,'mission')), ...snapR.docs.map(d=>extract(d,'routine'))].filter(Boolean);
        let stats: any = analyzeCatalogBatch(tasks);
        if(!Array.isArray(stats)) stats = Object.values(stats);
        stats.sort((a:any,b:any)=>b.globalSuccessRate-a.globalSuccessRate);
        setInterventionStats(stats); setAnalyticsLoaded(true);
    } catch (e) { console.error(e); alert("Error reporte"); } finally { setLoadingAnalytics(false); }
  };
  const topPerformer = interventionStats.length > 0 ? interventionStats[0] : null;
  const mostAbandoned = [...interventionStats].sort((a,b) => b.dropoutRate - a.dropoutRate)[0];

  const handleOpenApproveModal = (p: any) => { setPatientToApprove(p); setManualCandidates(activePatients.filter(x=>x.isManual)); setManualIdToMerge(''); setIsMergeModalOpen(true); };

  const handleExecuteMerge = async (shouldMerge: boolean) => {
    if (!patientToApprove) return;
    setProcessingMerge(true);
    try {
      const batch = writeBatch(db);
      const patRef = doc(db, "patients", patientToApprove.id);
      let teamKey = 'general';
      if (patientToApprove.careTeam) {
        const k = Object.keys(patientToApprove.careTeam).find(k => patientToApprove.careTeam[k].professionalId === user.uid);
        if(k) teamKey = k;
      }
      if (shouldMerge && manualIdToMerge) {
        const man = manualCandidates.find(x=>x.id===manualIdToMerge);
        if(!man) throw new Error("Manual no encontrado");
        const indics = man.clinicalIndicators?.[user.uid]||[];
        if(indics.length) batch.update(patRef, {[`clinicalIndicators.${user.uid}`]: arrayUnion(...indics)});
        const manTeam = man.careTeam?.[user.uid];
        if(manTeam?.customPrice) batch.update(patRef, {[`careTeam.${teamKey}.customPrice`]: manTeam.customPrice});
        if(manTeam?.noShowCount) batch.update(patRef, {[`careTeam.${teamKey}.noShowCount`]: manTeam.noShowCount});

        const [qM, qR] = await Promise.all([
             getDocs(query(collection(db,"assigned_missions"), where("patientId","==",manualIdToMerge))),
             getDocs(query(collection(db,"assigned_routines"), where("patientId","==",manualIdToMerge)))
        ]);
        qM.forEach(d=>batch.update(doc(db,"assigned_missions",d.id),{patientId:patientToApprove.id}));
        qR.forEach(d=>batch.update(doc(db,"assigned_routines",d.id),{patientId:patientToApprove.id}));
        batch.delete(doc(db,"patients",manualIdToMerge));
      }
      batch.update(patRef, {isAuthorized:true, [`careTeam.${teamKey}.active`]:true, [`careTeam.${teamKey}.status`]:'active', [`careTeam.${teamKey}.joinedAt`]:new Date().toISOString()});
      await batch.commit(); alert("✅ Listo"); setIsMergeModalOpen(false); loadData();
    } catch(e:any){ console.error(e); alert(e.message); } finally { setProcessingMerge(false); }
  };

  const hasValidAttendance = (patient: any) => {
    if (!patient?.lastAttendance?.[user.uid]) return false;
    const d = patient.lastAttendance[user.uid].toDate ? patient.lastAttendance[user.uid].toDate() : new Date(patient.lastAttendance[user.uid]);
    return Math.ceil(Math.abs(new Date().getTime()-d.getTime())/36e5) <= 72;
  };

  const handleRegisterAttendance = async () => {
    if(!selectedPatient || (profData?.nexusBalance||0)<1) return alert("❌ Saldo insuficiente");
    if(!window.confirm("¿Registrar asistencia? (-1 Nexus)")) return;
    try {
       const batch = writeBatch(db);
       batch.update(doc(db,"professionals",user.uid),{nexusBalance:increment(-1),"metrics.nexusDistributed":increment(1)});
       batch.update(doc(db,"patients",selectedPatient.id),{[`lastAttendance.${user.uid}`]:serverTimestamp(),"gamificationProfile.currentXp":increment(50),"gamificationProfile.wallet.nexus":increment(1)});
       await batch.commit(); alert("✅ Asistencia OK");
       setProfData((p:any)=>({...p, nexusBalance: p.nexusBalance-1}));
       setSelectedPatient((p:any)=>({...p, lastAttendance:{...p.lastAttendance,[user.uid]:new Date()}}));
       setTaskToEdit(null); setIsAssignmentModalOpen(true);
    } catch(e){console.error(e);}
  };

  const handleOpenCreateTask = () => { if(!hasValidAttendance(selectedPatient)) return handleRegisterAttendance(); setTaskToEdit(null); setIsAssignmentModalOpen(true); };
  const handleOpenEditTask = (t:any) => { setTaskToEdit(t); setIsAssignmentModalOpen(true); };
  const handleViewProgress = (t:any) => { setTaskForHistory(t); setIsHistoryOpen(true); };
  const handleOpenPatient = async (p:any) => { setSelectedPatient(p); setView('patient_detail'); await loadPatientTasks(p.id); };
  
  const loadPatientTasks = async (pid:string) => {
     try {
        const [sM, sR] = await Promise.all([
            getDocs(query(collection(db,"assigned_missions"),where("patientId","==",pid))),
            getDocs(query(collection(db,"assigned_routines"),where("patientId","==",pid)))
        ]);
        const tasks = [...sM.docs.map(d=>({id:d.id,...d.data(),type:'mission'})), ...sR.docs.map(d=>({id:d.id,...d.data(),type:'routine'}))];
        setPatientTasks(tasks.sort((a:any,b:any)=>(b.createdAt?.toDate?.()||0)-(a.createdAt?.toDate?.()||0)));
     } catch(e){console.error(e);}
  };
  const handleDeleteTask = async (tid:string, isR:boolean) => {
     if(!window.confirm("¿Eliminar?")) return;
     await deleteDoc(doc(db, isR?"assigned_routines":"assigned_missions", tid));
     loadPatientTasks(selectedPatient.id);
  };

  // --- LOGICA TAGS INTEGRADA CON NORMALIZACIÓN ---
  const handleAddIndicator = async (text: string) => {
    if (!text.trim() || !selectedPatient) return;
    
    // Aplicamos la normalización antes de guardar
    const cleanTag = normalizeTag(text);

    try {
      await updateDoc(doc(db, "patients", selectedPatient.id), { [`clinicalIndicators.${user.uid}`]: arrayUnion(cleanTag) });
      const current = selectedPatient.clinicalIndicators?.[user.uid] || [];
      // Evitar duplicados visuales si el tag normalizado ya existe
      if (!current.includes(cleanTag)) {
          setSelectedPatient({ ...selectedPatient, clinicalIndicators: { ...(selectedPatient.clinicalIndicators||{}), [user.uid]: [...current, cleanTag] } });
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteIndicator = async (text: string) => {
    try {
      await updateDoc(doc(db, "patients", selectedPatient.id), { [`clinicalIndicators.${user.uid}`]: arrayRemove(text) });
      const current = selectedPatient.clinicalIndicators?.[user.uid] || [];
      setSelectedPatient({ ...selectedPatient, clinicalIndicators: { ...(selectedPatient.clinicalIndicators||{}), [user.uid]: current.filter((t:string)=>t!==text) } });
    } catch (e) { console.error(e); }
  };

  const filteredPatients = activePatients.filter(p => p.fullName.toLowerCase().includes(searchTerm.toLowerCase()));

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
              {view === 'patient_detail' && 'Expediente Clínico'}
              {view === 'analytics' && 'Analítica de Intervención'}
             </h1>
             <p style={{ margin: '5px 0', color: '#78909C' }}>Dr(a). {profData?.fullName}</p>
          </div>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
             {profData?.professionalCode && <span style={{ background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#1565C0', fontWeight:'bold', border:'1px solid #BBDEFB' }}>🔑 {profData.professionalCode}</span>}
             <span style={{ background: 'white', padding: '6px 12px', borderRadius: '20px', fontSize: '13px', color: '#00695C', fontWeight:'bold', border:'1px solid #B2DFDB' }}>💎 {profData?.nexusBalance || 0} Nexus</span>
          </div>
        </div>

        {view === 'agenda' ? <AgendaView userRole="professional" currentUserId={user.uid} onBack={() => setView('dashboard')} /> :
         view === 'patients_manage' ? (
           <div>
             {pendingPatients.map(p=><div key={p.id} style={{background:'#FFF3E0', padding:'15px', marginBottom:'10px', borderRadius:'8px', display:'flex', justifyContent:'space-between'}}><div>{p.fullName}</div><button onClick={()=>handleOpenApproveModal(p)}>Revisar</button></div>)}
             <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}><h3 style={{margin:0}}>Activos ({activePatients.length})</h3><input placeholder="Buscar..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)} style={{padding:'8px'}}/></div>
             <div style={{background:'white', borderRadius:'8px', overflow:'hidden'}}>
               {filteredPatients.map(p=>(
                 <div key={p.id} style={{padding:'15px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between'}}>
                    <div><strong>{p.fullName}</strong><div style={{fontSize:'12px', color:'#666'}}>{p.email}</div></div>
                    <button onClick={()=>handleOpenPatient(p)} style={{padding:'5px 15px', borderRadius:'15px', border:'none', background:'#E3F2FD', color:'#1565C0', cursor:'pointer'}}>Expediente</button>
                 </div>
               ))}
             </div>
           </div>
         ) : view === 'dashboard' ? (
            <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(200px, 1fr))', gap:'20px', textAlign:'center'}}>
               <div style={{padding:'30px', background:'white', borderRadius:'12px', borderBottom:'4px solid #2196F3'}}><h1>{activePatients.length}</h1>Pacientes</div>
               <div style={{padding:'30px', background:'white', borderRadius:'12px', borderBottom:'4px solid #00BCD4'}}><h1>{profData?.nexusBalance||0}</h1>Nexus</div>
               <div onClick={()=>setView('analytics')} style={{padding:'30px', background:'white', borderRadius:'12px', borderBottom:'4px solid #673AB7', cursor:'pointer'}}><h1>📊</h1>Analítica</div>
            </div>
         ) : view === 'analytics' ? (
             <div>
                {!analyticsLoaded && <button onClick={handleGenerateAnalytics} style={{padding:'15px', background:'#673AB7', color:'white', border:'none', borderRadius:'8px', cursor:'pointer', width:'100%'}}>Generar Reporte Global</button>}
                {loadingAnalytics && <p>Cargando...</p>}
                {analyticsLoaded && (
                   <div style={{background:'white', padding:'20px', borderRadius:'10px'}}>
                      <h3>Top Rendimiento</h3>
                      {topPerformer && <div style={{color:'#4CAF50'}}>🌟 {topPerformer.title} ({topPerformer.globalSuccessRate.toFixed(0)}% éxito)</div>}
                      {mostAbandoned && <div style={{color:'#F44336'}}>⚠️ {mostAbandoned.title} ({mostAbandoned.dropoutRate.toFixed(0)}% abandono)</div>}
                      <table style={{width:'100%', marginTop:'15px'}}>
                         <thead><tr><th align="left">Tarea</th><th>Uso</th><th>Éxito</th></tr></thead>
                         <tbody>{interventionStats.map((s,i)=><tr key={i}><td>{s.title}</td><td align="center">{s.usageCount}</td><td align="center">{s.globalSuccessRate.toFixed(0)}%</td></tr>)}</tbody>
                      </table>
                   </div>
                )}
             </div>
         ) : view === 'team' ? (
           <div><h2>Equipo</h2>{assistants.map(a=><div key={a.uid}>{a.displayName}</div>)}</div>
         ) : view === 'patient_detail' && selectedPatient ? (
           
           <div style={{ paddingBottom: '50px' }}>
             <button onClick={() => setView('patients_manage')} style={{marginBottom:'15px', background:'none', border:'none', color:'#666', cursor:'pointer'}}>⬅ Volver</button>
             
             {/* HEADER DETALLE PACIENTE */}
             <div style={{background:'white', padding:'20px', borderRadius:'10px', boxShadow:'0 2px 8px rgba(0,0,0,0.05)', marginBottom:'15px', display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div>
                   <h1 style={{margin:'0', color:'#1565C0', fontSize:'20px'}}>{selectedPatient.fullName}</h1>
                   <div style={{color:'#666', fontSize:'13px', marginTop:'2px'}}>{selectedPatient.email} • {selectedPatient.contactNumber}</div>
                   
                   <div style={{marginTop:'8px', display:'flex', gap:'8px'}}>
                      <span style={{background:'#E1BEE7', color:'#4A148C', padding:'3px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'bold'}}>
                         Nivel {selectedPatient.gamificationProfile?.level || 1}
                      </span>
                      <span style={{background:'#B3E5FC', color:'#0277BD', padding:'3px 8px', borderRadius:'12px', fontSize:'11px', fontWeight:'bold'}}>
                         💎 {selectedPatient.gamificationProfile?.wallet?.nexus || 0}
                      </span>
                   </div>
                </div>
             </div>

             {/* DASHBOARD VISUAL (Con Tags Normalizados y Carga Cognitiva) */}
             <PatientVisualStats 
                tasks={patientTasks} 
                indicators={selectedPatient.clinicalIndicators?.[user.uid] || []}
                onAddTag={handleAddIndicator}
                onDeleteTag={handleDeleteIndicator}
             />

             <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px'}}>
                 <h3 style={{color:'#455A64', margin:0, fontSize:'16px'}}>Plan Activo</h3>
                 <div style={{display:'flex', gap:'10px'}}>
                    <button onClick={() => { setTaskForHistory(null); setIsHistoryOpen(true); }} style={{padding:'8px 15px', background:'#607D8B', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>📜 Historial</button>
                    <button onClick={hasValidAttendance(selectedPatient) ? handleOpenCreateTask : handleRegisterAttendance} style={{padding:'8px 15px', background: hasValidAttendance(selectedPatient) ? '#2196F3' : '#E0E0E0', color: hasValidAttendance(selectedPatient) ? 'white' : '#757575', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'12px'}}>
                       {hasValidAttendance(selectedPatient) ? '+ Asignar' : '🔒 Asistencia'}
                    </button>
                 </div>
             </div>

             {/* LISTA DE TAREAS */}
             {patientTasks.filter(t => t.status !== 'completed').length === 0 ? 
               <div style={{textAlign:'center', padding:'30px', background:'white', borderRadius:'8px', color:'#999'}}>Sin tareas activas.</div> 
               : (
               <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'15px'}}>
                 {patientTasks.filter(t => t.status !== 'completed').map(t => {
                    const borderColor = t.themeColor || (t.type === 'routine' ? '#9C27B0' : '#E65100');
                    return (
                      <div key={t.id} style={{background:'white', padding:'15px', borderRadius:'8px', borderTop:`4px solid ${borderColor}`, boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                         <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px'}}>
                            <div>
                               <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
                                  <span style={{fontSize:'10px', fontWeight:'bold', color: borderColor, textTransform:'uppercase'}}>
                                     {t.type === 'routine' ? 'Rutina' : 'Misión'}
                                  </span>
                               </div>
                               <div style={{fontWeight:'bold', color:'#333', fontSize:'14px', lineHeight:'1.3'}}>{t.title}</div>
                            </div>
                            <div style={{display:'flex', gap:'5px'}}>
                                <button onClick={() => handleViewProgress(t)} title="Ver Bitácora" style={{border:'1px solid #BBDEFB', background:'#E3F2FD', color:'#1565C0', borderRadius:'4px', fontSize:'10px', fontWeight:'bold', padding:'4px 8px', cursor:'pointer', display:'flex', alignItems:'center', gap:'3px'}}>👁️ Bitácora</button>
                                <button onClick={() => handleOpenEditTask(t)} style={{border:'none', background:'#F5F5F5', color:'#555', borderRadius:'4px', width:'24px', height:'24px', cursor:'pointer'}}>✏️</button>
                                <button onClick={() => handleDeleteTask(t.id, t.type === 'routine')} style={{border:'none', background:'#FFEBEE', color:'#D32F2F', borderRadius:'4px', width:'24px', height:'24px', cursor:'pointer'}}>🗑️</button>
                            </div>
                         </div>
                         <div style={{fontSize:'12px', color:'#666', marginBottom:'12px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{t.description || "Sin instrucciones."}</div>
                         <TaskProgressBar task={t} />
                      </div>
                    );
                 })}
               </div>
             )}

             <AssignmentModal isOpen={isAssignmentModalOpen} onClose={() => { setIsAssignmentModalOpen(false); setTaskToEdit(null); loadPatientTasks(selectedPatient.id); }} patientId={selectedPatient.id} professionalId={user.uid} patientName={selectedPatient.fullName} userProfessionId={profData?.professionType || 'psychologist'} taskToEdit={taskToEdit} />
             <HistoryModal isOpen={isHistoryOpen} onClose={() => { setIsHistoryOpen(false); setTaskForHistory(null); }} patientId={selectedPatient.id} patientName={selectedPatient.fullName} specificTask={taskForHistory} />
           </div>
         ) : null}
      </div>

      {isMergeModalOpen && patientToApprove && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999 }}>
           <div style={{ background: 'white', padding: '30px', borderRadius: '12px', width: '400px' }}>
              <h3>Fusión de Expediente</h3>
              <p>¿Fusionar a <b>{patientToApprove.fullName}</b> con un manual?</p>
              <select value={manualIdToMerge} onChange={e=>setManualIdToMerge(e.target.value)} style={{width:'100%', marginBottom:'10px', padding:'8px'}}>
                 <option value="">No, crear nuevo</option>
                 {manualCandidates.map(c=><option key={c.id} value={c.id}>{c.fullName} (Manual)</option>)}
              </select>
              <button onClick={()=>handleExecuteMerge(!!manualIdToMerge)}>Confirmar</button>
           </div>
        </div>
      )}
    </div>
  );
}