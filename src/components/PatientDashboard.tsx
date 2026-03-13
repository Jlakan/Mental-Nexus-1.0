// src/components/PatientDashboard.tsx

import { useState, useEffect } from 'react';
import { 
  doc, 
  collection, 
  query, 
  where, 
  updateDoc, 
  increment, 
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import PatientDiary from './PatientDiary';
import { AtlasCard, AtlasButton, AtlasIcons } from './design/AtlasDesignSystem';

// --- DICCIONARIO DE ASSETS (FIREBASE STORAGE) ---
const NEXUS_ASSETS = {
  misionAsignada: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Mision%20asignada.jpg?alt=media&token=bfd4bd7e-882a-4d5c-9a9b-f591ef50cddb",
  misionCompletada: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/missio%CC%81n%20Succes.jpg?alt=media&token=a6fa6232-e8f9-4f02-be3f-a69b25ad2bcc",
  protocoloIniciado: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Protocolo%20iniciado.jpg?alt=media&token=aa9a902c-bce7-46b1-a8fd-1bb87287a70e",
  protocoloCompletado: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Protocolo%20completado.jpg?alt=media&token=20246441-f073-430e-b3cf-9719916fc26c",
  atlas1: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_1.jpg?alt=media&token=c3e77e91-9518-4bae-adb1-f3febc1d0b76",
  atlas2: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_2.jpg?alt=media&token=54340bcb-4775-4282-9b1c-14ccc9c586e7",
  atlas3: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_3.jpg?alt=media&token=ade68626-9a61-4a18-9b48-e00480c289ec",
  atlas4: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_4.jpg?alt=media&token=e92af5f4-a586-4bec-9025-98c643d4cd1d",
  atlasVideo: "https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Animacio%CC%81n%20Atlas%20Vance%20primera%20etapa.mp4?alt=media&token=8bbfd688-a3c5-4be0-a71b-bec7898b26da"
};

// --- INTERFACES ---
interface PatientDashboardProps {
  user: any;
}

// --- HELPERS ---
const isSameDay = (d1: Date, d2: Date) => {
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
};

export default function PatientDashboard({ user }: PatientDashboardProps) {
  // ---------------------------------------------------------------------------
  // 1. ESTADOS
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  
  // Modal y Tareas
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reflection, setReflection] = useState('');
  const [rating, setRating] = useState(5);
  const [submittingTask, setSubmittingTask] = useState(false);

  // Sistema Cinemático, Avatar y Notificaciones
  const [showAtlasVideo, setShowAtlasVideo] = useState(false);
  const [showAtlasModal, setShowAtlasModal] = useState(false); // NUEVO: Estado para el modal del video con sonido
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingTaskToOpen, setPendingTaskToOpen] = useState<any>(null);

  // ---------------------------------------------------------------------------
  // 2. EFECTOS Y TIEMPO REAL
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (NEXUS_ASSETS.atlasVideo) {
      // Temporizador ajustado a 80 segundos (80000 ms)
      const interval = setInterval(() => {
        setShowAtlasVideo(true);
      }, 80000); 
      return () => clearInterval(interval);
    }
  }, []);

  const triggerOverlay = (imageUrl: string) => {
    setOverlayImage(imageUrl);
    setPendingTaskToOpen(null);
    setTimeout(() => {
      setOverlayImage(current => current === imageUrl ? null : current);
    }, 10000); // 10 segundos
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleCloseOverlay = () => {
    setOverlayImage(null);
    if (pendingTaskToOpen) {
      setSelectedTask(pendingTaskToOpen);
      setPendingTaskToOpen(null);
    }
  };

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    const userRef = doc(db, 'patients', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setPatientData(docSnap.data());
      }
      setLoading(false);
    });

    const handleTaskSnapshots = (snap: any, type: string) => {
      snap.docChanges().forEach((change: any) => {
        const data = change.doc.data();
        const id = change.doc.id;

        if (change.type === 'added') {
          if (!data.notifiedAssigned) {
            const msg = type === 'routine' ? 'Nuevos protocolos asignados' : 'Nueva misión asignada';
            showToast(msg);
            updateDoc(change.doc.ref, { notifiedAssigned: true }).catch(console.error);
          }
          
          setTasks(prev => {
            if (!prev.find(t => t.id === id)) return [...prev, { id, type, ...data }];
            return prev.map(t => t.id === id ? { id, type, ...data } : t);
          });
        }
        
        if (change.type === 'modified') {
          setTasks(prev => prev.map(t => t.id === id ? { id, type, ...data } : t));
        }
        
        if (change.type === 'removed') {
          setTasks(prev => prev.filter(t => t.id !== id));
        }
      });
    };

    const qRoutines = query(collection(db, 'assigned_routines'), where('patientId', '==', user.uid));
    const unsubRoutines = onSnapshot(qRoutines, (snap) => handleTaskSnapshots(snap, 'routine'));

    const qMissions = query(collection(db, 'assigned_missions'), where('patientId', '==', user.uid));
    const unsubMissions = onSnapshot(qMissions, (snap) => handleTaskSnapshots(snap, 'mission'));

    return () => {
      unsubUser();
      unsubRoutines();
      unsubMissions();
    };
  }, [user]);

  // ---------------------------------------------------------------------------
  // 3. LÓGICA DE NEGOCIO Y GAMIFICACIÓN
  // ---------------------------------------------------------------------------

  const currentXP = patientData?.gamification?.xp || patientData?.gamificationProfile?.currentXp || 0;
  const currentLevel = Math.floor(currentXP / 100) + 1;
  const xpProgress = currentXP % 100;
  
  const currentGold = patientData?.gamification?.gold || patientData?.gamificationProfile?.wallet?.gold || 0;
  const currentNexus = patientData?.gamification?.nexus || patientData?.gamificationProfile?.wallet?.nexus || 0;
  
  const dbStats = patientData?.gamification?.stats || {};
  const uiStats = {
    psique: dbStats.INT || dbStats.intellect || 0,
    vitalidad: dbStats.STR || dbStats.strength || 0,
    resiliencia: dbStats.STA || dbStats.stamina || 0
  };

  const getAtlasImage = (level: number) => {
    if (level <= 5) return NEXUS_ASSETS.atlas1;
    if (level <= 10) return NEXUS_ASSETS.atlas2;
    if (level <= 15) return NEXUS_ASSETS.atlas3;
    return NEXUS_ASSETS.atlas4;
  };

  const getTodaysTasks = () => {
    const today = new Date();
    const daysSpanish = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const dayKey = daysSpanish[today.getDay()]; 

    return tasks.filter((task: any) => {
      if (task.status === 'inactive' || task.status === 'completed') return false;
      if (task.frequency) {
        if (Array.isArray(task.frequency)) {
            return task.frequency.includes(dayKey);
        } else if (typeof task.frequency === 'object') {
            return task.frequency[dayKey] === 1 || task.frequency[dayKey] === true; 
        }
      }
      return true;
    });
  };

  const todaysTasks = getTodaysTasks();

  const handleTaskClick = async (task: any) => {
    if (!task.hasSeenArt) {
      const imgToDisplay = task.type === 'routine' ? NEXUS_ASSETS.protocoloIniciado : NEXUS_ASSETS.misionAsignada;
      setOverlayImage(imgToDisplay);
      setPendingTaskToOpen(task);

      const collectionName = task.type === 'routine' ? 'assigned_routines' : 'assigned_missions';
      try {
        await updateDoc(doc(db, collectionName, task.id), { hasSeenArt: true });
      } catch (error) {
        console.error("Error actualizando vista de arte:", error);
      }

      setTimeout(() => {
        setOverlayImage((current) => {
          if (current) {
            setSelectedTask(task);
            setPendingTaskToOpen(null);
            return null;
          }
          return current;
        });
      }, 10000); // Auto-cierre después de 10 segundos
    } else {
      setSelectedTask(task);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !user) return;
    setSubmittingTask(true);

    try {
      const collectionName = selectedTask.type === 'routine' ? 'assigned_routines' : 'assigned_missions';
      const taskRef = doc(db, collectionName, selectedTask.id);
      const userRef = doc(db, 'patients', user.uid);
      
      const xpReward = (selectedTask.rewards?.xp || selectedTask.staticTaskData?.xp || 10);
      const goldReward = (selectedTask.rewards?.gold || 5);
      const dateStr = new Date().toISOString().split('T')[0];

      const total = selectedTask.totalVolumeExpected || 1;
      const currentCompleted = selectedTask.completionHistory ? Object.keys(selectedTask.completionHistory).length : 0;
      const newCompleted = currentCompleted + 1;
      const percent = Math.min(100, Math.round((newCompleted / total) * 100));

      let taskUpdatePayload: any = {
        [`completionHistory.${dateStr}`]: {
            completedAt: new Date().toISOString(),
            rating: rating,
            reflection: reflection,
            status: 'completed'
        },
        lastCompletedAt: serverTimestamp()
      };

      if (selectedTask.type === 'routine') {
        if (percent >= 80 && !selectedTask.notified80) {
           triggerOverlay(NEXUS_ASSETS.protocoloCompletado);
           taskUpdatePayload.notified80 = true;
        }
      } else {
        triggerOverlay(NEXUS_ASSETS.misionCompletada);
        taskUpdatePayload.status = 'completed';
      }

      await updateDoc(taskRef, taskUpdatePayload);

      await updateDoc(userRef, {
        'gamification.xp': increment(xpReward),
        'gamification.gold': increment(goldReward),
        'gamification.completedMissions': increment(1)
      });

      setSelectedTask(null);
      setReflection('');
      setRating(5);

    } catch (error) {
      console.error("Error completando misión:", error);
      alert("Error de conexión al servidor neural.");
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUnlinkProfessional = async (profId: string) => {
      if(!window.confirm("¿Seguro que deseas cortar el enlace con este especialista?")) return;
      try {
          const userRef = doc(db, 'patients', user.uid);
          await updateDoc(userRef, {
            [`careTeam.${profId}.active`]: false
          });
      } catch (e) {
          console.error(e);
          alert("Error al desvincular. Verifica tu conexión.");
      }
  };

  // ---------------------------------------------------------------------------
  // 4. RENDERIZADO
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-cyan-500 gap-4">
        <AtlasIcons.Zap className="animate-spin w-12 h-12" />
        <span className="font-mono animate-pulse tracking-widest text-sm">SINCRONIZANDO NEXUS...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans selection:bg-cyan-500/30">
      
      {/* --- NOTIFICACIÓN SUTIL (TOAST) --- */}
      {toastMessage && (
        <div className="fixed top-20 right-4 md:right-10 z-[9999] bg-slate-900/95 border border-cyan-500 text-cyan-400 px-5 py-3 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300">
          <div className="bg-cyan-900/50 p-1.5 rounded-full">
            <AtlasIcons.Zap size={16} className="animate-pulse" />
          </div>
          <span className="font-bold text-sm tracking-wide uppercase">{toastMessage}</span>
        </div>
      )}

      {/* --- OVERLAY CINEMÁTICO DE ARTE (PANTALLA COMPLETA) --- */}
      {overlayImage && (
        <div 
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300 cursor-pointer"
          onClick={handleCloseOverlay}
        >
           <img 
             src={overlayImage} 
             alt="Arte de Misión" 
             className="w-full h-full p-4 md:p-12 object-contain drop-shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-transform transform scale-100" 
           />
           <div className="absolute bottom-8 text-cyan-500 text-xs md:text-sm font-mono tracking-widest animate-pulse bg-slate-900/50 px-4 py-2 rounded-full border border-cyan-500/30">
              [ CLIC PARA CONTINUAR ]
           </div>
        </div>
      )}

      {/* --- MODAL DEL AVATAR CON SONIDO --- */}
      {showAtlasModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className="relative w-full max-w-md md:max-w-2xl bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] overflow-hidden flex flex-col items-center">
            
            <div className="w-full bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <AtlasIcons.Zap className="text-cyan-400" />
                    ENLACE NEURAL: ATLAS VANCE
                </h3>
                <button onClick={() => setShowAtlasModal(false)} className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors">
                    <AtlasIcons.Close />
                </button>
            </div>

            <div className="w-full bg-black aspect-square md:aspect-video relative flex justify-center items-center">
               <video 
                 src={NEXUS_ASSETS.atlasVideo} 
                 autoPlay 
                 controls
                 className="w-full h-full object-contain"
               />
            </div>
            
            <div className="w-full p-3 text-center bg-slate-900 border-t border-slate-700">
                <p className="text-cyan-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">Transmisión Activa...</p>
            </div>
          </div>
        </div>
      )}

      {/* --- HEADER & NEXUS PROGRESS --- */}
      <section className="relative z-30 mb-8 p-4 bg-slate-900/90 border-b border-cyan-500/30 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)]">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-transparent pointer-events-none"></div>

        <div className="max-w-3xl mx-auto flex items-center gap-6 relative">
          
          {/* AVATAR DINÁMICO E INTERACTIVO */}
          <div 
            onClick={() => setShowAtlasModal(true)}
            className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-cyan-400 p-1 shadow-[0_0_15px_rgba(6,182,212,0.4)] bg-slate-800 cursor-pointer hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] hover:scale-105 hover:border-white transition-all duration-300"
            title="Abrir enlace neural con Atlas"
          >
            <div className="w-full h-full rounded-full overflow-hidden relative bg-black pointer-events-none">
              {showAtlasVideo && NEXUS_ASSETS.atlasVideo ? (
                <video 
                  src={NEXUS_ASSETS.atlasVideo} 
                  autoPlay 
                  muted 
                  playsInline
                  onEnded={() => setShowAtlasVideo(false)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img 
                  src={getAtlasImage(currentLevel)} 
                  alt="Avatar" 
                  className="w-full h-full object-cover animate-pulse-slow"
                />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
          </div>

          {/* DATOS DEL PACIENTE Y BARRAS DE ESTADO */}
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
                  {patientData?.fullName || 'Sujeto 01'}
                  <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/50">
                    NIVEL {currentLevel}
                  </span>
                </h2>
                <span className="text-xs text-slate-400 font-mono tracking-widest uppercase">
                  Rango: {patientData?.gamification?.title || "INICIADO"}
                </span>
              </div>
              
              {/* CONTADORES (ORO Y NEXUS) */}
              <div className="flex gap-2">
                <div className="flex items-center gap-1.5 bg-yellow-900/20 border border-yellow-700/50 px-2 py-1 rounded shadow-[0_0_10px_rgba(234,179,8,0.1)]">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 border border-yellow-200"></div>
                  <span className="font-mono text-xs font-bold text-yellow-400">{currentGold}</span>
                </div>
                <div className="flex items-center gap-1.5 bg-emerald-900/20 border border-emerald-500/50 px-2 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.1)]">
                  <span className="text-xs">💎</span>
                  <span className="font-mono text-xs font-bold text-emerald-400">{currentNexus}</span>
                </div>
              </div>
            </div>

            {/* BARRA DE SINCRONIZACIÓN (XP) */}
            <div className="relative">
              <div className="flex justify-between text-[10px] font-mono mb-1 text-cyan-500">
                <span>SINCRONIZACIÓN NEXUS</span>
                <span>{Math.floor(xpProgress)}% / Siguiente Nivel</span>
              </div>
              
              <div className="h-4 bg-slate-950 rounded-sm border border-slate-700 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#fff_2px,#fff_4px)]"></div>
                
                <div 
                    className="h-full bg-cyan-500 relative transition-all duration-1000 ease-out shadow-[0_0_10px_#06b6d4]"
                    style={{ width: `${xpProgress}%` }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/40"></div>
                    <div className="absolute right-0 top-0 bottom-0 w-1 bg-white animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          
          <button 
              onClick={() => auth.signOut()} 
              className="absolute top-0 right-0 md:relative p-2 text-slate-500 hover:text-red-400 transition-colors"
              title="Desconectar Nexus"
          >
              <AtlasIcons.Lock size={20} />
          </button>

        </div>
      </section>

      <main className="max-w-3xl mx-auto p-4 space-y-6">

        {/* --- SECCIÓN 2: HUD STATS --- */}
        <div className="grid grid-cols-3 gap-3">
            <AtlasCard noPadding className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-purple-500 transition-all">
                <div className="p-3 text-center flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-900 text-purple-400"><AtlasIcons.Brain /></div>
                    <div>
                        <div className="text-xl font-bold text-white">{uiStats.psique}</div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">PSIQUE</div>
                    </div>
                </div>
            </AtlasCard>
            <AtlasCard noPadding className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-red-500 transition-all">
                <div className="p-3 text-center flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-900 text-red-400"><AtlasIcons.Heart /></div>
                    <div>
                        <div className="text-xl font-bold text-white">{uiStats.vitalidad}</div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">VITALIDAD</div>
                    </div>
                </div>
            </AtlasCard>
            <AtlasCard noPadding className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-blue-500 transition-all">
                <div className="p-3 text-center flex flex-col items-center gap-2">
                    <div className="p-2 rounded-lg bg-slate-900 text-blue-400"><AtlasIcons.Shield /></div>
                    <div>
                        <div className="text-xl font-bold text-white">{uiStats.resiliencia}</div>
                        <div className="text-[9px] text-slate-500 font-mono uppercase">RESILIENCIA</div>
                    </div>
                </div>
            </AtlasCard>
        </div>

        {/* --- SECCIÓN 3: MISIONES DEL DÍA --- */}
        <section>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <AtlasIcons.Target className="text-cyan-500" />
                    PROTOCOLOS ACTIVOS
                </h3>
                <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-cyan-400 border border-slate-700">
                    HOY: {new Date().toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}
                </span>
            </div>

            <div className="space-y-3">
                {todaysTasks.length === 0 && (
                    <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-800/30">
                        <p>No hay misiones asignadas para hoy.</p>
                        <p className="text-xs mt-1">Recarga tu energía para mañana.</p>
                    </div>
                )}

                {todaysTasks.map((task) => {
                    let isCompletedToday = false;
                    if (task.lastCompletedAt) {
                        const lastDate = task.lastCompletedAt.toDate ? task.lastCompletedAt.toDate() : new Date(task.lastCompletedAt);
                        isCompletedToday = isSameDay(lastDate, new Date());
                    }

                    const title = task.staticTaskData?.title || task.title || "Misión Desconocida";
                    const xpVal = task.rewards?.xp || task.staticTaskData?.xp || 10;
                    const type = task.type === 'routine' ? 'Rutina' : 'Reto';

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => !isCompletedToday && handleTaskClick(task)}
                            className={`
                                relative overflow-hidden group transition-all duration-300
                                border rounded-xl p-4 flex items-center gap-4
                                ${isCompletedToday 
                                    ? 'bg-slate-900/40 border-slate-800 opacity-60 grayscale cursor-default' 
                                    : 'bg-slate-800 border-slate-600 cursor-pointer hover:border-cyan-500 hover:shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:-translate-y-1'
                                }
                            `}
                        >
                            <div className={`
                                w-10 h-10 rounded-full flex items-center justify-center border transition-colors
                                ${isCompletedToday 
                                    ? 'bg-green-900/20 border-green-600 text-green-500' 
                                    : 'bg-slate-900 border-slate-700 text-cyan-500 group-hover:bg-cyan-600 group-hover:text-white group-hover:border-cyan-400'
                                }
                            `}>
                                {isCompletedToday ? <AtlasIcons.Check size={20} /> : <AtlasIcons.Zap size={20} />}
                            </div>

                            <div className="flex-1">
                                <h4 className={`font-bold transition-colors ${isCompletedToday ? 'text-slate-500 line-through' : 'text-slate-200 group-hover:text-white'}`}>
                                    {title}
                                </h4>
                                <span className="text-xs text-slate-500 font-mono uppercase">
                                  {type} {task.hasSeenArt ? '' : '• NUEVO'}
                                </span>
                            </div>

                            <div className={`text-xs font-bold font-mono px-2 py-1 rounded border ${
                                isCompletedToday 
                                ? 'text-slate-600 border-transparent' 
                                : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20'
                            }`}>
                                +{xpVal} XP
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>

        {/* --- SECCIÓN 4: ALIADOS --- */}
        <section>
            <h3 className="text-sm text-slate-400 font-mono uppercase mb-3 mt-8 tracking-widest border-b border-slate-800 pb-2">
                Red de Soporte
            </h3>
            {(!patientData?.careTeam || Object.values(patientData.careTeam).filter((pro: any) => pro.active).length === 0) ? (
                <p className="text-sm text-slate-600 italic">No tienes especialistas vinculados.</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.values(patientData.careTeam)
                        .filter((pro: any) => pro.active)
                        .map((pro: any) => (
                        <AtlasCard key={pro.professionalId} className="flex items-center gap-4 border-slate-700 bg-slate-800/50">
                            <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                                👨‍⚕️
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <h4 className="font-bold text-white text-sm truncate">
                                    {pro.professionalName || 'Especialista'}
                                </h4>
                                <p className="text-xs text-slate-500 capitalize truncate">
                                    {pro.professionType || 'Salud Mental'}
                                </p>
                            </div>
                            <button 
                                onClick={(e) => { e.stopPropagation(); handleUnlinkProfessional(pro.professionalId); }}
                                className="text-red-400 hover:text-white hover:bg-red-600 text-[10px] uppercase border border-red-900/50 bg-red-900/10 px-2 py-1 rounded transition-all"
                            >
                                Desvincular
                            </button>
                        </AtlasCard>
                    ))}
                </div>
            )}
        </section>
        
        {/* --- SECCIÓN 5: CHECK EMOCIONAL RÁPIDO --- */}
       {/* --- SECCIÓN 5: CHECK EMOCIONAL RÁPIDO --- */}
       <AtlasCard className="mt-8 border-cyan-900/30 bg-gradient-to-b from-slate-800 to-slate-900">
            <h3 className="text-sm text-slate-400 font-mono uppercase mb-4 text-center tracking-widest">
                Check-in Emocional
            </h3>
            <div className="flex justify-between px-4 sm:px-10">
                {['😫', '😕', '😐', '🙂', '🤩'].map((emoji, i) => (
                    <button 
                        key={i} 
                        className="text-2xl md:text-3xl hover:scale-125 transition-transform p-2 grayscale hover:grayscale-0 cursor-pointer"
                        onClick={() => alert("Registro emocional guardado (Simulación)")}
                    >
                        {emoji}
                    </button>
                ))}
            </div>
        </AtlasCard>

        {/* --- SECCIÓN 6: BITÁCORA DEL PACIENTE (NUEVO) --- */}
        <PatientDiary 
           patientId={user.uid} 
           careTeam={patientData?.careTeam} 
        />

      </main>

      {/* --- MODAL DE VALIDACIÓN DE TAREA --- */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden">
                
                <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-bold text-white flex items-center gap-2">
                        <AtlasIcons.Zap className="text-cyan-400" />
                        VALIDAR PROTOCOLO
                    </h3>
                    <button onClick={() => setSelectedTask(null)} className="text-slate-400 hover:text-white">
                        <AtlasIcons.Close />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    <div>
                        <h4 className="text-xl font-bold text-white mb-1">
                            {selectedTask.staticTaskData?.title || selectedTask.title}
                        </h4>
                        <p className="text-sm text-slate-400">
                            {selectedTask.description || "Completa este ejercicio y registra tu experiencia para ganar XP."}
                        </p>
                    </div>

                    <div>
                        <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">Bitácora (Opcional)</label>
                        <textarea 
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none h-24 resize-none"
                            placeholder="¿Cómo te sentiste?..."
                        />
                    </div>

                    <div>
                        <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">Autoevaluación (1-5)</label>
                        <div className="flex justify-between bg-slate-950 p-2 rounded-lg border border-slate-700">
                            {[1, 2, 3, 4, 5].map(num => (
                                <button
                                    key={num}
                                    onClick={() => setRating(num)}
                                    className={`w-10 h-10 rounded-md font-bold transition-all ${
                                        rating === num ? 'bg-cyan-600 text-white shadow-lg scale-110' : 'text-slate-500 hover:text-white'
                                    }`}
                                >
                                    {num}
                                </button>
                            ))}
                        </div>
                    </div>

                    <AtlasButton 
                        onClick={handleCompleteTask} 
                        isLoading={submittingTask} 
                        className="w-full"
                    >
                        COMPLETAR Y RECLAMAR XP
                    </AtlasButton>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}