import { useState, useEffect } from 'react';
import { 
  doc, getDoc, collection, query, where, getDocs, 
  updateDoc, increment 
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
[cite_start]// [cite: 1] Usamos las utilidades tal como están definidas en tu archivo subido
import { calculateLevel, xpForNextLevel } from '../utils/GamificationUtils';
import TaskValidationModal from './TaskValidationModal';

[cite_start]// [cite: 940] Helper original para obtener fechas de la semana
const getCurrentWeekDates = () => {
  const current = new Date();
  const day = current.getDay(); 
  const diffToMonday = current.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(current.setDate(diffToMonday));
  const week = [];
  
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    week.push(d);
  }
  return week;
};

[cite_start]// [cite: 953] Constantes originales críticas para el mapeo de días
const DAY_IDS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  user?: any;
}

export default function PatientDashboard({ user }: Props) {
  const [patientData, setPatientData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para el nuevo Modal
  const [selectedTask, setSelectedTask] = useState<{ task: any, dateObj?: Date } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUser = user || auth.currentUser;
  const currentWeekDates = getCurrentWeekDates();

  [cite_start]// [cite: 966] Carga de datos restaurada como en el original para evitar errores de carga
  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Cargar Perfil
      const docRef = doc(db, "patients", currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPatientData(docSnap.data());
      } else {
        console.error("No se encontró el perfil del paciente");
      }

      // 2. Cargar Tareas (Misiones y Rutinas)
      // Usamos la lógica original de queries separadas
      const qMissions = query(collection(db, "assigned_missions"), where("patientId", "==", currentUser.uid));
      const qRoutines = query(collection(db, "assigned_routines"), where("patientId", "==", currentUser.uid));

      const [snapM, snapR] = await Promise.all([getDocs(qMissions), getDocs(qRoutines)]);

      // Mapeamos agregando el tipo para diferenciar en la UI
      const missions = snapM.docs.map(d => ({ id: d.id, ...d.data(), type: 'one_time' }));
      const routines = snapR.docs.map(d => ({ id: d.id, ...d.data(), type: 'daily' }));

      // Filtramos misiones ya completadas para limpiar la vista (opcional, como en el original)
      const activeMissions = missions.filter((m: any) => m.status !== 'completed' && m.status !== 'escaped');
      
      setTasks([...activeMissions, ...routines]);

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  // --- LÓGICA DEL NUEVO MODAL (Objective 1 & 2) ---

  const openTaskDecision = (task: any, dateObj?: Date) => {
    // Validar tiempo (Solo para rutinas)
    if (dateObj) {
      const windowStart = new Date(dateObj); windowStart.setHours(5,0,0,0);
      const windowEnd = new Date(dateObj); windowEnd.setDate(windowEnd.getDate()+1); windowEnd.setHours(23,59,59,999);
      const now = new Date();
      
      if (now < windowStart || now > windowEnd) {
        alert("⚠️ Fuera de tiempo. Solo puedes completar tareas del día actual (o hasta la noche del siguiente).");
        return;
      }
    }
    setSelectedTask({ task, dateObj });
  };

  const handleDecision = async (result: { type: 'success' | 'escape', payload: any }) => {
    if (!currentUser || !selectedTask) return;
    
    const { task, dateObj } = selectedTask;
    const isRoutine = task.type === 'daily';
    const dateKey = dateObj ? dateObj.toISOString().split('T')[0] : null;
    
    setProcessingId(task.id);
    setSelectedTask(null); // Cerrar modal

    try {
      const patientRef = doc(db, "patients", currentUser.uid);
      const taskRef = isRoutine 
        ? doc(db, "assigned_routines", task.id) 
        : doc(db, "assigned_missions", task.id);

      const timestamp = new Date();
      
      // Datos a guardar
      const recordData = {
        completedAt: timestamp,
        status: result.type, // 'success' o 'escape' (interno)
        ...result.payload // { rating, reflection } o { motive }
      };

      // 1. ACTUALIZAR TAREA
      if (isRoutine && dateKey) {
        // Guardamos OBJETO en lugar de boolean, como pide el nuevo requerimiento
        await updateDoc(taskRef, {
          [`completionHistory.${dateKey}`]: {
             ...recordData,
             // Mapeamos status interno a status de UI si es necesario, 
             // pero aquí guardamos el objeto completo para analítica.
             status: result.type 
          },
          lastUpdated: timestamp
        });
      } else {
        // One-time mission
        await updateDoc(taskRef, {
          status: result.type === 'success' ? 'completed' : 'escaped',
          completionData: recordData,
          completedAt: timestamp
        });
      }

      // 2. ACTUALIZAR PERFIL (GAMIFICACIÓN)
      // Solo sumamos si es ÉXITO
      if (result.type === 'success') {
        const xpBase = task.rewards?.xp || 50;
        const xpBonus = recordData.reflection ? 10 : 0; 
        const totalXp = xpBase + xpBonus;
        const goldGain = task.rewards?.gold || 10;
        
        // Update simple
        await updateDoc(patientRef, {
          "gamificationProfile.currentXp": increment(totalXp),
          "gamificationProfile.wallet.gold": increment(goldGain)
        });
        
        // Si hay stat específico
        if (task.targetStat && task.rewards?.statValue) {
           await updateDoc(patientRef, {
             [`gamificationProfile.stats.${task.targetStat}`]: increment(task.rewards.statValue)
           });
        }
      } 

      await loadData(); // Recargar UI

    } catch (e) {
      console.error("Error guardando progreso:", e);
      alert("Error de conexión.");
    } finally {
      setProcessingId(null);
    }
  };


  // --- RENDERIZADO ---

  if (loading) return <div style={{padding: '20px', textAlign:'center'}}>Cargando tu aventura...</div>;
  if (!patientData) return <div style={{padding: '20px', textAlign:'center'}}>Perfil no encontrado.</div>;

  [cite_start]// [cite: 1070] LÓGICA ORIGINAL DE NIVEL (Compatible con Source 1)
  const currentXp = patientData.gamificationProfile?.currentXp || 0;
  // calculateLevel devuelve un NÚMERO en tu archivo GamificationUtils actual
  const level = calculateLevel(currentXp); 
  const nextLevelXp = xpForNextLevel(level);
  const prevLevelXp = xpForNextLevel(level - 1);
  const progressPercent = Math.min(100, Math.max(0, ((currentXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
      
      {/* HEADER DEL PERSONAJE (Estilo Original mejorado) */}
      <div style={{ background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)', color: 'white', padding: '25px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
        <div style={{display:'flex', justifyContent:'space-between'}}>
          <div>
            <h1 style={{margin:0, fontSize:'24px'}}>{patientData.fullName}</h1>
            <p style={{margin:'5px 0 0 0', opacity:0.9}}>Nivel {level} • Héroe</p>
          </div>
          <div style={{textAlign:'right'}}>
             <div style={{fontSize:'14px', background:'rgba(0,0,0,0.2)', padding:'5px 10px', borderRadius:'20px', marginBottom:'5px'}}>
               💰 {patientData.gamificationProfile?.wallet?.gold || 0} Oro
             </div>
          </div>
        </div>
        <div style={{marginTop:'20px'}}>
           <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'5px'}}>
              <span>XP: {currentXp}</span>
              <span>Meta: {nextLevelXp}</span>
           </div>
           <div style={{height:'10px', background:'rgba(0,0,0,0.2)', borderRadius:'5px', overflow:'hidden'}}>
              <div style={{width: `${progressPercent}%`, height:'100%', background:'#FFCA28', transition:'width 0.5s ease'}}></div>
           </div>
        </div>
      </div>

      <h2 style={{color:'#333', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>📜 Misiones Activas</h2>

      {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            No tienes misiones asignadas hoy. ¡Relájate! 🍃
          </div>
      ) : (
        <div style={{display:'grid', gap:'15px'}}>
        {tasks.map(task => {
          const isRoutine = task.type === 'daily';
          
          return (
            <div key={task.id} style={{ background: 'white', borderRadius: '12px', padding: '15px', borderLeft: `5px solid ${task.themeColor || '#ccc'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '4px', color: 'white', background: isRoutine ? '#9C27B0' : '#E65100', marginRight:'8px' }}>
                    {isRoutine ? 'RUTINA' : 'MISIÓN'}
                  </span>
                  <h3 style={{ margin: '5px 0', fontSize: '18px', color: '#333', display:'inline-block' }}>{task.staticTaskData?.title || task.title}</h3>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#667eea' }}>
                  +{task.rewards?.xp || 50} XP
                </div>
              </div>

              {/* CUERPO: Misión Única */}
              {!isRoutine && (
                 <div style={{ marginTop: '10px' }}>
                      <button 
                        onClick={() => openTaskDecision(task)}
                        disabled={!!processingId}
                        style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Completar Misión
                      </button>
                 </div>
              )}

              [cite_start]{/* [cite: 1134] CUERPO: Rutina (Grid Semanal) - USANDO LÓGICA ORIGINAL */}
              {isRoutine && (
                <div style={{background:'#F5F5F5', padding:'10px', borderRadius:'8px', marginTop:'5px'}}>
                   <div style={{fontSize:'12px', fontWeight:'bold', marginBottom:'8px', color:'#555', textAlign:'center'}}>SEMANA ACTUAL</div>
                   <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                   {currentWeekDates.map((dateObj, index) => {
                      // Usamos DAY_IDS original para asegurar el match
                      const dayId = DAY_IDS[index];
                      const label = DAY_LABELS[index];
                      const dateKey = dateObj.toISOString().split('T')[0];
                      
                      // Buscamos el registro (ahora puede ser objeto o boolean legacy)
                      const record = task.completionHistory?.[dateKey];
                      
                      // Compatibilidad: Si es 'true' (legacy) o status 'success'/'completed'
                      const isSuccess = record === true || record?.status === 'success' || record?.status === 'completed';
                      const isEscaped = record?.status === 'escape' || record?.status === 'escaped';
                      
                      // Verificación de asignación original
                      const isAssigned = task.frequency && task.frequency.includes(dayId);

                      // Lógica de fechas
                      const windowStart = new Date(dateObj); windowStart.setHours(5,0,0,0);
                      const windowEnd = new Date(dateObj); windowEnd.setDate(windowEnd.getDate()+1); windowEnd.setHours(23,59,59,999);
                      const now = new Date();
                      const isTimeOpen = now >= windowStart && now <= windowEnd;

                      // Estilos visuales
                      let bgColor = 'white'; 
                      let borderColor = 'transparent';
                      let cursor = 'default';
                      let opacity = 0.5;
                      let content = label;

                      if (isAssigned) {
                        opacity = 1;
                        borderColor = task.themeColor || '#9C27B0';
                        if (isSuccess) {
                            bgColor = task.themeColor || '#4CAF50';
                            borderColor = bgColor;
                            content = '✓';
                        } else if (isEscaped) {
                            bgColor = '#FF9800';
                            borderColor = bgColor;
                            content = '🛡️';
                        }
                      }

                      // Habilitar click si es hoy/abierto y está asignado
                      // Y NO está completado/escapado (para editar, deben contactar soporte o resetear logic aparte)
                      if (isTimeOpen && isAssigned && !isSuccess && !isEscaped) {
                          cursor = 'pointer';
                      }
                      
                      // Días pasados o no asignados se ven tenues
                      if (!isTimeOpen && !isSuccess && !isEscaped) opacity = 0.4;

                      return (
                        <div key={dayId} style={{textAlign:'center', flex:1}}>
                          <div 
                            onClick={() => {
                                // Aquí llamamos al NUEVO modal en lugar del check directo
                                if (isTimeOpen && isAssigned && !isSuccess && !isEscaped) {
                                    openTaskDecision(task, dateObj);
                                }
                            }}
                            style={{ 
                                width:'35px', height:'35px', borderRadius:'50%', margin:'0 auto',
                                display:'flex', alignItems:'center', justifyContent:'center',
                                background: bgColor, border: `2px solid ${borderColor}`,
                                color: (isSuccess || isEscaped) ? 'white' : '#555',
                                fontWeight: 'bold', cursor: cursor, opacity: opacity, transition: 'all 0.2s'
                            }}
                            title={!isTimeOpen ? "Fuera de horario" : "Click para reportar"}
                          >
                            {content}
                          </div>
                        </div>
                      );
                   })}
                   </div>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* MODAL DE DECISIÓN (Nueva UI) */}
      <TaskValidationModal
        isOpen={!!selectedTask}
        taskTitle={selectedTask?.task?.staticTaskData?.title || selectedTask?.task?.title || "Misión"}
        onClose={() => setSelectedTask(null)}
        onConfirmSuccess={(rating, reflection) => handleDecision({ type: 'success', payload: { rating, reflection } })}
        onConfirmEscape={(reasonId) => handleDecision({ type: 'escape', payload: { motive: reasonId } })}
      />

      <div style={{ marginTop: '30px', textAlign: 'center', paddingBottom: '30px' }}>
         <button onClick={() => auth.signOut()} style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
           Cerrar Sesión
         </button>
      </div>

    </div>
  );
}