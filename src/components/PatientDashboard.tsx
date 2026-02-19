// src/components/PatientDashboard.tsx

import { useState, useEffect } from 'react';
import { 
  doc, 
  getDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
 
  arrayRemove, // <--- CRÍTICO: Necesario para desvincular (ya no lo usaremos para el profesional, pero lo dejo por si lo necesitas)
  increment, 
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { AtlasCard, AtlasButton, AtlasIcons } from './design/AtlasDesignSystem';

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
  // ---> CORRECCIÓN: Eliminamos el estado professionals porque usaremos patientData.careTeam
  
  // Modal State
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reflection, setReflection] = useState('');
  const [rating, setRating] = useState(5);
  const [submittingTask, setSubmittingTask] = useState(false);

  // ---------------------------------------------------------------------------
  // 2. CARGA DE DATOS (Data Fetching)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      setLoading(true);

      try {
        // A) Perfil del Usuario
        // ---> CORRECCIÓN: Apuntar a la colección 'patients' en lugar de 'users'
        const userRef = doc(db, 'patients', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setPatientData(userSnap.data());
        }

        // B) Tareas (Assignments)
        // ---> CORRECCIÓN: Apuntar a la colección raíz 'assigned_routines' y filtrar por patientId
        const tasksRef = collection(db, 'assigned_routines');
        const q = query(tasksRef, where('patientId', '==', user.uid));
        const tasksSnap = await getDocs(q);
        const loadedTasks = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        setTasks(loadedTasks);

        // C) Profesionales Vinculados
        // ---> CORRECCIÓN: Eliminamos la consulta a la base de datos porque los especialistas ya vienen en userSnap.data().careTeam

      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  // ---------------------------------------------------------------------------
  // 3. LÓGICA DE NEGOCIO
  // ---------------------------------------------------------------------------

  // A. Gamificación
  const currentXP = patientData?.gamification?.xp || 0;
  const currentLevel = Math.floor(currentXP / 100) + 1;
  const xpProgress = currentXP % 100;
  
  // Mapeo seguro de Stats (V1 DB -> V2 UI)
  const dbStats = patientData?.gamification?.stats || {};
  const uiStats = {
    psique: dbStats.INT || dbStats.intellect || 0,      // Inteligencia
    vitalidad: dbStats.STR || dbStats.strength || 0,    // Fuerza
    resiliencia: dbStats.STA || dbStats.stamina || 0    // Aguante
  };

  // B. Filtrado de Tareas (Lógica Híbrida V1/V2)
  const getTodaysTasks = () => {
    const today = new Date();
    // ---> CORRECCIÓN: Cambiar al formato de días en español de tu base de datos
    const daysSpanish = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const dayKey = daysSpanish[today.getDay()]; 

    return tasks.filter((task: any) => {
      // 1. Verificar si está activa (opcional, si tienes campo isActive)
      if (task.status === 'inactive') return false;

      // 2. Verificar frecuencia
      if (task.frequency) {
        if (Array.isArray(task.frequency)) {
            return task.frequency.includes(dayKey); // Nuevo formato
        } else if (typeof task.frequency === 'object') {
            // ---> CORRECCIÓN: Verificar si el valor es 1 (tu formato) o true (formato anterior)
            return task.frequency[dayKey] === 1 || task.frequency[dayKey] === true; 
        }
      }
      return true; // Si no hay frecuencia, se asume diario
    });
  };

  const todaysTasks = getTodaysTasks();

  // C. Completar Tarea
  const handleCompleteTask = async () => {
    if (!selectedTask || !user) return;
    setSubmittingTask(true);

    try {
      // ---> CORRECCIÓN: Apuntar a 'assigned_routines' y 'patients'
      const taskRef = doc(db, 'assigned_routines', selectedTask.id);
      const userRef = doc(db, 'patients', user.uid);
      
      // ---> CORRECCIÓN: Obtener XP y Oro desde el mapa 'rewards' que tienes en tu BD
      const xpReward = (selectedTask.rewards?.xp || selectedTask.staticTaskData?.xp || 10);
      const goldReward = (selectedTask.rewards?.gold || 5);
      
      const dateStr = new Date().toISOString().split('T')[0];

      // 1. Actualizar Tarea
      await updateDoc(taskRef, {
        [`completionHistory.${dateStr}`]: {
            completedAt: new Date().toISOString(),
            rating: rating,
            reflection: reflection,
            status: 'completed'
        },
        lastCompletedAt: serverTimestamp() // Importante para la validación de fecha
      });

      // 2. Actualizar Usuario (XP, Oro, Stats)
      // ---> CORRECCIÓN: Usar la variable goldReward dinámica
      await updateDoc(userRef, {
        'gamification.xp': increment(xpReward),
        'gamification.gold': increment(goldReward),
        'gamification.completedMissions': increment(1)
        // Aquí podrías agregar lógica para subir stats específicos según el tipo de tarea
      });

      // 3. Actualización Optimista (UI Local)
      setPatientData((prev: any) => ({
        ...prev,
        gamification: {
          ...prev.gamification,
          xp: (prev.gamification?.xp || 0) + xpReward
        }
      }));

      // 4. Actualizar la tarea localmente para bloquearla inmediatamente
      setTasks(prev => prev.map(t => {
        if (t.id === selectedTask.id) {
            return { ...t, lastCompletedAt: Timestamp.now() }; // Simulamos el timestamp
        }
        return t;
      }));

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

  // D. Desvincular Profesional
  const handleUnlinkProfessional = async (profId: string) => {
      if(!window.confirm("¿Seguro que deseas cortar el enlace con este especialista?")) return;
      try {
          // ---> CORRECCIÓN: Actualizar el mapa careTeam en el documento del paciente
          const userRef = doc(db, 'patients', user.uid);
          
          // Cambiamos el status a inactive dentro del mapa careTeam
          await updateDoc(userRef, {
            [`careTeam.${profId}.active`]: false
          });

          // Actualizamos la UI localmente para que desaparezca al instante
          setPatientData((prev: any) => {
              const newCareTeam = { ...prev.careTeam };
              if(newCareTeam[profId]) newCareTeam[profId].active = false;
              return { ...prev, careTeam: newCareTeam };
          });
          
          alert("Enlace neural cortado correctamente.");
      } catch (e) {
          console.error(e);
          alert("Error al desvincular. Verifica tu conexión.");
      }
  };

  // ---------------------------------------------------------------------------
  // 4. RENDERIZADO (DISEÑO ATLAS V2)
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
      
      {/* --- HEADER --- */}
      <header className="sticky top-0 z-30 bg-slate-900/80 backdrop-blur-md border-b border-slate-700 px-4 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center border-2 border-slate-800 shadow-lg relative">
                <span className="text-lg font-bold text-white uppercase">
                    {patientData?.fullName ? patientData.fullName[0] : user.email[0]}
                </span>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border border-slate-900"></div>
            </div>
            <div>
                <h2 className="text-sm font-bold text-white leading-none">
                    {patientData?.fullName || 'Sujeto 01'}
                </h2>
                <span className="text-[10px] text-cyan-400 font-mono tracking-wider">ESTADO: ONLINE</span>
            </div>
        </div>
        <button 
            onClick={() => auth.signOut()} 
            className="p-2 rounded-lg hover:bg-red-900/20 text-slate-500 hover:text-red-400 transition-colors"
            title="Desconectar"
        >
            <AtlasIcons.Lock size={18} />
        </button>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-6">

        {/* --- SECCIÓN 1: PROGRESO --- */}
        <section className="relative mt-2">
            <div className="flex justify-between items-end mb-2">
                <div>
                    <span className="text-xs text-slate-400 uppercase tracking-widest">Nivel de Sincronización</span>
                    <div className="text-3xl font-black text-white flex items-baseline gap-1">
                        {currentLevel} <span className="text-sm text-slate-500 font-normal">/ {patientData?.gamification?.title || "INICIADO"}</span>
                    </div>
                </div>
                <div className="text-right">
                    <span className="text-xs text-cyan-400 font-mono">XP: {Math.floor(xpProgress)}%</span>
                </div>
            </div>
            <div className="h-4 bg-slate-800 rounded-full overflow-hidden border border-slate-700 relative shadow-inner">
                <div 
                    className="h-full bg-gradient-to-r from-cyan-600 to-blue-500 transition-all duration-1000 ease-out relative"
                    style={{ width: `${xpProgress}%` }}
                >
                    <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
            </div>
        </section>

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
                    // Verificación de fecha
                    let isCompletedToday = false;
                    if (task.lastCompletedAt) {
                        // Maneja tanto Timestamp de Firestore como Date de JS (si acabamos de actualizar localmente)
                        const lastDate = task.lastCompletedAt.toDate ? task.lastCompletedAt.toDate() : task.lastCompletedAt;
                        isCompletedToday = isSameDay(lastDate, new Date());
                    }

                    const title = task.staticTaskData?.title || task.title || "Misión Desconocida";
                    // ---> CORRECCIÓN: Mostrar la recompensa correcta en la UI
                    const xpVal = task.rewards?.xp || task.staticTaskData?.xp || 10;
                    const type = task.type === 'routine' ? 'Rutina' : 'Reto';

                    return (
                        <div 
                            key={task.id} 
                            onClick={() => !isCompletedToday && setSelectedTask(task)}
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
                                <span className="text-xs text-slate-500 font-mono uppercase">{type}</span>
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
            {/* ---> CORRECCIÓN: Renderizar directamente desde patientData.careTeam y filtrar los activos */}
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

      </main>

      {/* --- MODAL DE VALIDACIÓN --- */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden">
                
                {/* Header Modal */}
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

                    {/* Reflexión */}
                    <div>
                        <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">Bitácora (Opcional)</label>
                        <textarea 
                            value={reflection}
                            onChange={(e) => setReflection(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none h-24 resize-none"
                            placeholder="¿Cómo te sentiste?..."
                        />
                    </div>

                    {/* Rating */}
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