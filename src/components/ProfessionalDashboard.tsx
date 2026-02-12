// src/components/ProfessionalDashboard.tsx
import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, doc, updateDoc,
  arrayRemove, getDoc, increment, deleteDoc, arrayUnion, writeBatch, serverTimestamp, documentId
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

// --- COMPONENTES UI ADAPTADOS A TAILWIND (V2 STYLE) ---

const DoughnutChart = ({ percent, color, size = 80, label }: any) => {
  return (
    <div className="relative flex justify-center items-center" style={{ width: size, height: size }}>
      <div
        className="absolute inset-0 rounded-full"
        style={{ background: `conic-gradient(${color} ${percent}%, #334155 0)` }}
      ></div>
      <div className="absolute inset-2 rounded-full bg-slate-800 flex flex-col justify-center items-center">
        <span className="text-lg font-bold text-white">{percent}%</span>
        {label && <span className="text-[9px] text-slate-400 uppercase tracking-wide">{label}</span>}
      </div>
    </div>
  );
};

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

  let statusColor = 'bg-green-500';
  let statusText = 'A tiempo';
  let statusTextColor = 'text-green-400';

  if (percent >= 100) { statusColor = 'bg-green-600'; statusText = 'Completada'; statusTextColor = 'text-green-500'; }
  else if (percent < (timePercent - 15)) { statusColor = 'bg-red-500'; statusText = 'Atrasado'; statusTextColor = 'text-red-400'; }
  else if (percent > timePercent + 10) { statusColor = 'bg-blue-500'; statusText = 'Adelantado'; statusTextColor = 'text-blue-400'; }

  return (
    <div className="mt-3">
      <div className="flex justify-between text-xs mb-1 text-slate-400">
        <span>{completed}/{total} reps</span>
        <span className={`font-bold ${statusTextColor}`}>{statusText}</span>
      </div>
      <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden relative">
        <div
          className={`h-full ${statusColor} transition-all duration-500 rounded-full`}
          style={{ width: `${percent}%` }}
        ></div>
        {percent < 100 && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-white/30 z-10"
            style={{ left: `${timePercent}%` }}
            title="Meta hoy"
          />
        )}
      </div>
    </div>
  );
};

const PatientVisualStats = ({ tasks, indicators, onAddTag, onDeleteTag }: any) => {
  const [newTag, setNewTag] = useState('');

  const activeTasks = tasks.filter((t:any) => t.status !== 'completed');
  const completedTasks = tasks.filter((t:any) => t.status === 'completed');

  let totalExpected = 0;
  let totalDone = 0;
  activeTasks.forEach((t:any) => {
    totalExpected += (t.totalVolumeExpected || 1);
    totalDone += (t.completionHistory?.length || 0);
  });
  const globalAdherence = totalExpected > 0 ? Math.round((totalDone / totalExpected) * 100) : 0;
  const routinesCount = activeTasks.filter((t:any) => t.type === 'routine').length;
  const missionsCount = activeTasks.filter((t:any) => t.type !== 'routine').length;

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row overflow-hidden border border-slate-700">
      {/* 1. IZQUIERDA: ADHERENCIA */}
      <div className="p-4 bg-slate-800/50 border-b sm:border-b-0 sm:border-r border-slate-700 flex flex-col items-center justify-center min-w-[140px]">
        <DoughnutChart percent={globalAdherence} color="#3b82f6" size={70} label="Adherencia" />
        <div className="mt-3 text-center w-full">
          <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">Carga Activa ({activeTasks.length})</div>
          <div className="flex justify-center gap-2 text-[10px]">
            <span className="bg-purple-900/40 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">🟣 {routinesCount} Rut</span>
            <span className="bg-orange-900/40 text-orange-300 px-2 py-0.5 rounded border border-orange-500/30">🟠 {missionsCount} Mis</span>
          </div>
        </div>
      </div>

      {/* 2. CENTRO: TAGS */}
      <div className="flex-1 p-4 flex flex-col bg-slate-800">
        <div className="flex justify-between items-center mb-2">
          <h4 className="m-0 text-slate-300 text-xs uppercase font-bold tracking-wider">🏷️ Vocabulario Clínico</h4>
          <span className="text-[10px] text-slate-500">{indicators.length} activos</span>
        </div>

        <div className="flex-1 min-h-[50px] max-h-[80px] overflow-y-auto flex flex-wrap gap-2 content-start mb-2 custom-scrollbar">
          {indicators.length === 0 && (
            <div className="text-xs text-slate-600 italic mt-1 w-full text-center">Sin observaciones clínicas...</div>
          )}
          {indicators.map((tag: string, i: number) => (
            <span key={i} className="bg-yellow-900/20 border border-yellow-600/30 text-yellow-200 px-2 py-1 rounded-full text-[10px] flex items-center gap-1">
              {tag}
              <button
                onClick={() => onDeleteTag(tag)}
                className="text-red-400 hover:text-red-300 font-bold ml-1"
              >×</button>
            </span>
          ))}
        </div>

        <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1">
          <input
            className="flex-1 bg-transparent border-none text-xs text-white outline-none px-2 py-1 placeholder-slate-600"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { onAddTag(newTag); setNewTag(''); }}}
            placeholder="+ Agregar (ej. 'ansiedad')..."
          />
          <button
            onClick={() => { onAddTag(newTag); setNewTag(''); }}
            className="text-nexus-cyan text-[10px] font-bold uppercase px-2 hover:bg-white/5 rounded"
          >
            Guardar
          </button>
        </div>
      </div>

      {/* 3. DERECHA: HISTÓRICO */}
      <div className="p-4 bg-slate-800/50 border-t sm:border-t-0 sm:border-l border-slate-700 flex flex-col items-center justify-center min-w-[100px]">
        <div className="text-2xl font-bold text-green-500 leading-none">{completedTasks.length}</div>
        <div className="text-[9px] text-slate-500 uppercase text-center mt-1">Completadas</div>
        <div className="text-xl mt-1">🏆</div>
      </div>
    </div>
  );
};


// --- COMPONENTE PRINCIPAL ---

export default function ProfessionalDashboard({ user }: Props) {
  // --- ESTADOS DE V1 (LÓGICA) ---
  const [activeView, setActiveView] = useState('dashboard');
  const [assistants, setAssistants] = useState<any[]>([]);
  const [activePatients, setActivePatients] = useState<any[]>([]);
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
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

  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [taskForHistory, setTaskForHistory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE V2 (UI) ---
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [tagsCatalog, setTagsCatalog] = useState<Record<string, string>>({});

  // --- EFECTOS (CARGA DE DATOS V1) ---
  useEffect(() => {
    loadData();
    const LOCAL_DICTIONARY = {
      "desvelo": "Insomnio", "no duermo": "Insomnio", "triste": "Bajo Estado de Ánimo",
      "tristeza": "Bajo Estado de Ánimo", "llanto": "Labilidad Emocional", "nervioso": "Ansiedad",
      "nervios": "Ansiedad", "panico": "Crisis de Pánico", "miedo": "Temor", "cansado": "Fatiga", "agotado": "Fatiga"
    };
    setTagsCatalog(LOCAL_DICTIONARY);
  }, [user]);

  const normalizeTag = (rawText: string): string => {
    const lower = rawText.toLowerCase().trim();
    return tagsCatalog[lower] ? tagsCatalog[lower] : lower.charAt(0).toUpperCase() + lower.slice(1);
  };

  const loadData = async () => {
    try {
      const profRef = doc(db, "professionals", user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data();
        setProfData(data);
        
        // --- CORRECCIÓN AQUÍ: Usar documentId() en lugar de "uid" ---
        if (data.authorizedAssistants?.length > 0) {
          // Buscamos documentos cuyo ID esté en el array de autorizados
          const qAssist = query(collection(db, "users"), where(documentId(), "in", data.authorizedAssistants));
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

  // --- FUNCIONES DE NEGOCIO (V1) ---

  const handleNavigate = (view: string) => {
    setActiveView(view);
    if (view === 'patients_manage') setSelectedPatient(null);
    setIsSidebarOpen(false);
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
    } catch (e) { console.error(e); alert("Error al generar reporte"); } finally { setLoadingAnalytics(false); }
  };

  const topPerformer = interventionStats.length > 0 ? interventionStats[0] : null;
  const mostAbandoned = [...interventionStats].sort((a,b) => b.dropoutRate - a.dropoutRate)[0];

  const handleOpenApproveModal = (p: any) => { setPatientToApprove(p); setManualCandidates(activePatients.filter(x=>x.isManual)); setManualIdToMerge(''); setIsMergeModalOpen(true); };

  const handleExecuteMerge = async (shouldMerge: boolean) => {
    if (!patientToApprove) return;
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
      await batch.commit(); alert( "✅ Paciente autorizado correctamente" ); setIsMergeModalOpen(false); loadData();
    } catch(e:any){ console.error(e); alert(e.message); }
  };

  const hasValidAttendance = (patient: any) => {
    if (!patient?.lastAttendance?.[user.uid]) return false;
    const d = patient.lastAttendance[user.uid].toDate ? patient.lastAttendance[user.uid].toDate() : new Date(patient.lastAttendance[user.uid]);
    return Math.ceil(Math.abs(new Date().getTime()-d.getTime())/36e5) <= 72;
  };

  const handleRegisterAttendance = async () => {
    if(!selectedPatient || (profData?.nexusBalance||0)<1) return alert( "❌ Saldo Nexus insuficiente" );
    if(!window.confirm("¿Registrar asistencia y descontar 1 Nexus?")) return;
    try {
      const batch = writeBatch(db);
      batch.update(doc(db,"professionals",user.uid),{nexusBalance:increment(-1),"metrics.nexusDistributed":increment(1)});
      batch.update(doc(db,"patients",selectedPatient.id),{[`lastAttendance.${user.uid}`]:serverTimestamp(),"gamificationProfile.currentXp":increment(50),"gamificationProfile.wallet.nexus":increment(1)});
      await batch.commit(); alert( "✅ Asistencia registrada. +50 XP al paciente." );
      setProfData((p:any)=>({...p, nexusBalance: p.nexusBalance-1}));
      setSelectedPatient((p:any)=>({...p, lastAttendance:{...p.lastAttendance,[user.uid]:new Date()}}));
      setTaskToEdit(null); setIsAssignmentModalOpen(true);
    } catch(e){console.error(e);}
  };

  const handleOpenCreateTask = () => { if(!hasValidAttendance(selectedPatient)) return handleRegisterAttendance(); setTaskToEdit(null); setIsAssignmentModalOpen(true); };
  const handleOpenEditTask = (t:any) => { setTaskToEdit(t); setIsAssignmentModalOpen(true); };
  const handleViewProgress = (t:any) => { setTaskForHistory(t); setIsHistoryOpen(true); };
  const handleOpenPatient = async (p:any) => { setSelectedPatient(p); setActiveView('patient_detail'); await loadPatientTasks(p.id); setIsSidebarOpen(false); };
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
    if(!window.confirm("¿Eliminar esta tarea del plan?")) return;
    await deleteDoc(doc(db, isR?"assigned_routines":"assigned_missions", tid));
    loadPatientTasks(selectedPatient.id);
  };

  const handleAddIndicator = async (text: string) => {
    if (!text.trim() || !selectedPatient) return;
    const cleanTag = normalizeTag(text);
    try {
      await updateDoc(doc(db, "patients", selectedPatient.id), { [`clinicalIndicators.${user.uid}`]: arrayUnion(cleanTag) });
      const current = selectedPatient.clinicalIndicators?.[user.uid] || [];
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

  // --- RENDER (UI ESTILO V2 CON DATOS V1) ---

  if (loading) return <div className="min-h-screen bg-nexus-dark flex items-center justify-center text-nexus-cyan animate-pulse">CARGANDO SISTEMA CLÍNICO...</div>;

  // --- NUEVA VALIDACIÓN DE SEGURIDAD (OPCIÓN B) ---
  if (profData && profData.isAuthorized === false) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-900 text-white p-4">
        <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl max-w-md text-center border border-slate-700">
          <div className="text-6xl mb-6">⏳</div>
          <h1 className="text-2xl font-bold text-nexus-cyan mb-4">Cuenta en Revisión</h1>
          <p className="text-slate-400 mb-6">
            Tu perfil profesional ha sido registrado, pero requiere validación administrativa antes de acceder a la plataforma y gestionar pacientes.
          </p>
          <div className="bg-slate-900/50 p-4 rounded-lg mb-6 border border-slate-700/50">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Tu Código de Referencia</div>
            <div className="font-mono text-xl font-bold text-white tracking-widest">
              {profData.professionalCode || '---'}
            </div>
          </div>
          <button
            onClick={() => auth.signOut()}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium text-sm w-full"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }
  // ------------------------------------------------

  return (
    <div className="flex h-screen bg-nexus-dark text-slate-200 font-sans overflow-hidden">

      {/* 1. MENU LATERAL RESPONSIVO */}
      <DashboardMenu
        activeView={activeView}
        onNavigate={handleNavigate}
        onLogout={() => auth.signOut()}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      {/* 2. ÁREA PRINCIPAL */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative w-full">

        {/* ENCABEZADO */}
        <header className="p-6 border-b border-slate-800 bg-nexus-dark/95 backdrop-blur flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 text-white bg-slate-800 rounded-lg hover:bg-nexus-cyan hover:text-black transition-colors"
            >
              ☰
            </button>
            <div>
              <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight leading-none">
                {activeView === 'dashboard' && 'Panel de Control'}
                {activeView === 'patients_manage' && 'Gestión de Pacientes'}
                {activeView === 'agenda' && 'Agenda'}
                {activeView === 'team' && 'Equipo Clínico'}
                {activeView === 'patient_detail' && 'Expediente'}
                {activeView === 'analytics' && 'Analítica'}
                <span className="text-nexus-cyan hidden md:inline"> .PRO</span>
              </h1>
              <p className="text-nexus-muted text-xs md:text-sm hidden md:block mt-1">
                Dr(a). {profData?.fullName || 'Usuario'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm md:text-lg">💎 {profData?.nexusBalance || 0}</span>
            </div>
            <div className="hidden sm:flex bg-purple-900/20 border border-purple-500/50 rounded-lg px-3 py-1 flex-col items-end">
              <span className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">Cód. Vinculación</span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-mono text-white font-black">{profData?.professionalCode || '---'}</span>
                <button onClick={() => navigator.clipboard.writeText(profData?.professionalCode)} className="text-purple-400 hover:text-white">📋</button>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENIDO SCROLLEABLE (Con corrección de Padding para Agenda) */}
        <div className={`flex-1 overflow-y-auto custom-scrollbar ${activeView === 'agenda' ? 'p-0' : 'p-4 md:p-8'}`}>

          {/* VISTA: DASHBOARD */}
          {activeView === 'dashboard' && (
            <div className="space-y-6 animate-fadeIn pb-20">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="nexus-card flex items-center gap-4">
                  <div className="p-4 bg-blue-900/30 rounded-lg text-blue-400 text-3xl">👥</div>
                  <div>
                    <div className="text-2xl font-bold text-white">{activePatients.length}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Pacientes Activos</div>
                  </div>
                </div>
                <div className="nexus-card flex items-center gap-4">
                  <div className="p-4 bg-emerald-900/30 rounded-lg text-emerald-400 text-3xl">💎</div>
                  <div>
                    <div className="text-2xl font-bold text-white">{profData?.nexusBalance || 0}</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Saldo Disponible</div>
                  </div>
                </div>
                <div onClick={()=>setActiveView('analytics')} className="nexus-card flex items-center gap-4 cursor-pointer hover:border-purple-500 transition-colors">
                  <div className="p-4 bg-purple-900/30 rounded-lg text-purple-400 text-3xl">📊</div>
                  <div>
                    <div className="text-lg font-bold text-white">Ver Métricas</div>
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Rendimiento</div>
                  </div>
                </div>
              </div>

              {pendingPatients.length > 0 && (
                <div className="bg-orange-900/20 border border-orange-500/50 p-4 rounded-xl">
                  <h3 className="text-orange-400 font-bold mb-2">⚠️ Solicitudes Pendientes ({pendingPatients.length})</h3>
                  <p className="text-sm text-slate-300 mb-2">Tienes pacientes esperando autorización para vincularse.</p>
                  <button onClick={() => setActiveView('patients_manage')} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded text-sm font-bold">Gestionar Ahora</button>
                </div>
              )}
            </div>
          )}

          {/* VISTA: GESTIÓN DE PACIENTES */}
          {activeView === 'patients_manage' && (
            <div className="max-w-4xl mx-auto space-y-6">
              {pendingPatients.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm uppercase text-orange-400 font-bold tracking-wider">Solicitudes de Ingreso</h3>
                  {pendingPatients.map(p => (
                    <div key={p.id} className="bg-orange-900/10 border border-orange-500/30 p-4 rounded-lg flex justify-between items-center">
                      <div>
                        <div className="font-bold text-white">{p.fullName}</div>
                        <div className="text-xs text-orange-300">{p.email}</div>
                      </div>
                      <button onClick={() => handleOpenApproveModal(p)} className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-bold hover:bg-orange-500">Revisar</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-end">
                  <h3 className="text-sm uppercase text-nexus-cyan font-bold tracking-wider">Directorio ({activePatients.length})</h3>
                </div>
                <input
                  type="text"
                  placeholder="🔍 Buscar paciente..."
                  value={searchTerm}
                  onChange={e=>setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-nexus-cyan outline-none"
                />

                <div className="grid gap-3">
                  {filteredPatients.map(p => (
                    <div key={p.id} className="nexus-card hover:bg-slate-800/80 transition-colors p-4 flex justify-between items-center group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-lg font-bold text-slate-400">
                          {p.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-white group-hover:text-nexus-cyan transition-colors">{p.fullName}</div>
                          <div className="text-xs text-slate-500">{p.email}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleOpenPatient(p)}
                        className="px-4 py-2 bg-slate-700 hover:bg-nexus-cyan hover:text-black rounded-full text-xs font-bold transition-all"
                      >
                        Expediente →
                      </button>
                    </div>
                  ))}
                  {filteredPatients.length === 0 && <div className="text-center py-10 text-slate-500">No se encontraron pacientes.</div>}
                </div>
              </div>
            </div>
          )}

          {/* VISTA: AGENDA (FULL SCREEN FIX) */}
          {activeView === 'agenda' && (
            <div className="w-full min-h-full bg-white text-slate-900 relative">
              <AgendaView userRole="professional" currentUserId={user.uid} onBack={() => setActiveView('dashboard')} />
            </div>
          )}

          {/* VISTA: ANALÍTICA */}
          {activeView === 'analytics' && (
            <div className="space-y-6">
              {!analyticsLoaded && (
                <div className="text-center py-10">
                  <p className="text-slate-400 mb-4">Analiza el rendimiento global de tus intervenciones clínicas.</p>
                  <button onClick={handleGenerateAnalytics} className="btn-primary py-3 px-8 text-lg w-full md:w-auto">Generar Reporte de Inteligencia</button>
                </div>
              )}
              {loadingAnalytics && <p className="text-nexus-cyan text-center animate-pulse">Procesando datos del sistema...</p>}

              {analyticsLoaded && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {topPerformer && (
                      <div className="bg-green-900/20 border border-green-500/50 p-4 rounded-xl">
                        <div className="text-xs uppercase text-green-400 font-bold mb-1">🌟 Mejor Adherencia</div>
                        <div className="text-lg font-bold text-white">{topPerformer.title}</div>
                        <div className="text-2xl font-bold text-green-400 mt-2">{topPerformer.globalSuccessRate.toFixed(0)}% <span className="text-xs text-slate-400 font-normal">de éxito</span></div>
                      </div>
                    )}
                    {mostAbandoned && (
                      <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl">
                        <div className="text-xs uppercase text-red-400 font-bold mb-1">⚠️ Mayor Abandono</div>
                        <div className="text-lg font-bold text-white">{mostAbandoned.title}</div>
                        <div className="text-2xl font-bold text-red-400 mt-2">{mostAbandoned.dropoutRate.toFixed(0)}% <span className="text-xs text-slate-400 font-normal">abandono</span></div>
                      </div>
                    )}
                  </div>

                  <div className="nexus-card overflow-hidden">
                    <h3 className="text-lg font-bold text-white mb-4">Detalle de Intervenciones</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left text-slate-300">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-800">
                          <tr>
                            <th className="px-4 py-3">Tarea</th>
                            <th className="px-4 py-3 text-center">Uso Total</th>
                            <th className="px-4 py-3 text-center">Tasa Éxito</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700">
                          {interventionStats.map((s,i) => (
                            <tr key={i} className="hover:bg-slate-800/50">
                              <td className="px-4 py-3 font-medium text-white">{s.title}</td>
                              <td className="px-4 py-3 text-center">{s.usageCount}</td>
                              <td className="px-4 py-3 text-center text-nexus-cyan">{s.globalSuccessRate.toFixed(0)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VISTA: EQUIPO */}
          {activeView === 'team' && (
            <div className="nexus-card">
              <h2 className="text-xl font-bold text-white mb-4">Equipo Clínico Autorizado</h2>
              {assistants.length === 0 ? <p className="text-slate-500">No hay asistentes vinculados.</p> : (
                <div className="space-y-2">
                  {assistants.map(a=>(<div key={a.uid} className="p-3 bg-slate-800 rounded text-white">{a.displayName}</div>))}
                </div>
              )}
            </div>
          )}

          {/* VISTA: DETALLE PACIENTE */}
          {activeView === 'patient_detail' && selectedPatient && (
            <div className="space-y-6 pb-20 animate-fadeIn">
              <button onClick={() => setActiveView('patients_manage')} className="text-slate-400 hover:text-white flex items-center gap-2 mb-2 text-sm">
                ← Volver al directorio
              </button>

              <div className="nexus-card flex flex-col md:flex-row justify-between md:items-start gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-white">{selectedPatient.fullName}</h1>
                  <div className="text-slate-400 text-sm mt-1">{selectedPatient.email} • {selectedPatient.contactNumber}</div>

                  <div className="flex gap-2 mt-3">
                    <span className="bg-purple-900/40 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold">
                      Nivel {selectedPatient.gamificationProfile?.level || 1}
                    </span>
                    <span className="bg-blue-900/40 text-blue-300 border border-blue-500/30 px-3 py-1 rounded-full text-xs font-bold">
                      💎 {selectedPatient.gamificationProfile?.wallet?.nexus || 0}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setTaskForHistory(null); setIsHistoryOpen(true); }} className="btn-secondary text-xs px-3 py-2">📜 Historial</button>
                  <button
                    onClick={hasValidAttendance(selectedPatient) ? handleOpenCreateTask : handleRegisterAttendance}
                    className={`text-xs px-3 py-2 rounded-lg font-bold transition-all shadow-lg ${hasValidAttendance(selectedPatient) ? 'bg-nexus-cyan text-black hover:bg-cyan-300' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                  >
                    {hasValidAttendance(selectedPatient) ? '+ Asignar Tarea' : '🔓 Habilitar (1 Nexus)'}
                  </button>
                </div>
              </div>

              <PatientVisualStats
                tasks={patientTasks}
                indicators={selectedPatient.clinicalIndicators?.[user.uid] || []}
                onAddTag={handleAddIndicator}
                onDeleteTag={handleDeleteIndicator}
              />

              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white border-b border-slate-700 pb-2">Plan Activo</h3>

                {patientTasks.filter(t => t.status !== 'completed').length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-slate-700 rounded-xl">
                    <p className="text-slate-500">No hay tareas activas.</p>
                    <p className="text-xs text-slate-600 mt-1">Registra asistencia para asignar nuevas misiones.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {patientTasks.filter(t => t.status !== 'completed').map(t => {
                      const isRoutine = t.type === 'routine';
                      const borderColorClass = isRoutine ? 'border-purple-500' : 'border-orange-500';
                      const badgeClass = isRoutine ? 'text-purple-400 bg-purple-900/20' : 'text-orange-400 bg-orange-900/20';

                      return (
                        <div key={t.id} className={`bg-slate-800 rounded-lg p-4 shadow-lg border-t-4 ${borderColorClass} relative group`}>
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${badgeClass}`}>
                                {isRoutine ? 'Rutina' : 'Misión'}
                              </span>
                              <div className="font-bold text-white mt-1 leading-tight">{t.title}</div>
                            </div>
                            <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => handleViewProgress(t)} className="p-1.5 hover:bg-slate-700 rounded text-blue-400" title="Ver Bitácora">👁️</button>
                              <button onClick={() => handleOpenEditTask(t)} className="p-1.5 hover:bg-slate-700 rounded text-slate-400" title="Editar">✏️</button>
                              <button onClick={() => handleDeleteTask(t.id, isRoutine)} className="p-1.5 hover:bg-slate-700 rounded text-red-400" title="Eliminar">🗑️</button>
                            </div>
                          </div>
                          <div className="text-xs text-slate-400 mb-3 truncate">{t.description || "Sin instrucciones."}</div>
                          <TaskProgressBar task={t} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <AssignmentModal isOpen={isAssignmentModalOpen} onClose={() => { setIsAssignmentModalOpen(false); setTaskToEdit(null); loadPatientTasks(selectedPatient.id); }} patientId={selectedPatient.id} professionalId={user.uid} patientName={selectedPatient.fullName} userProfessionId={profData?.professionType || 'psychologist'} taskToEdit={taskToEdit} />
              <HistoryModal isOpen={isHistoryOpen} onClose={() => { setIsHistoryOpen(false); setTaskForHistory(null); }} patientId={selectedPatient.id} patientName={selectedPatient.fullName} specificTask={taskForHistory} />
            </div>
          )}

        </div>
      </main>

      {/* MODAL DE FUSIÓN */}
      {isMergeModalOpen && patientToApprove && (
        <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[9999] p-4">
          <div className="bg-slate-800 p-6 rounded-xl w-full max-w-md border border-slate-700 shadow-2xl animate-scaleIn">
            <h3 className="text-xl font-bold text-white mb-2">Fusión de Expediente</h3>
            <p className="text-slate-300 mb-4 text-sm">
              El usuario <b>{patientToApprove.fullName}</b> solicita acceso.
              ¿Deseas vincularlo a un expediente manual existente para no perder datos previos?
            </p>

            <div className="mb-4">
              <label className="text-xs text-slate-500 uppercase font-bold block mb-1">Seleccionar Expediente Manual (Opcional)</label>
              <select
                value={manualIdToMerge}
                onChange={e=>setManualIdToMerge(e.target.value)}
                className="w-full p-2 bg-slate-900 border border-slate-600 rounded text-white text-sm outline-none focus:border-nexus-cyan"
              >
                <option value="">No fusionar (Crear nuevo limpio)</option>
                {manualCandidates.map(c=><option key={c.id} value={c.id}>{c.fullName} (Manual)</option>)}
              </select>
            </div>

            <div className="flex gap-3 justify-end">
              <button onClick={() => setIsMergeModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white text-sm">Cancelar</button>
              <button onClick={()=>handleExecuteMerge(!!manualIdToMerge)} className="px-4 py-2 bg-nexus-cyan text-black font-bold rounded hover:bg-cyan-300 text-sm">
                {manualIdToMerge ? 'Fusionar y Aprobar' : 'Aprobar como Nuevo'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}