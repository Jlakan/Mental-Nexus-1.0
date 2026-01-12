// src/components/PatientDashboard.tsx
import { useState, useEffect } from 'react'; // Eliminado 'React' (ya no es necesario importarlo en React 17+)
import { 
  doc, getDoc, collection, query, where, getDocs, 
  updateDoc, increment 
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { calculateLevel } from '../utils/GamificationUtils'; // Eliminados xpForNextLevel, BASE_STATS
import TaskValidationModal from './TaskValidationModal';

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

// Eliminado DAY_IDS que no se usaba
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  user?: any;
}

export default function PatientDashboard({ user }: Props) {
  const [patientData, setPatientData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<{ task: any, dateObj?: Date } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUser = user || auth.currentUser;
  const currentWeekDates = getCurrentWeekDates();

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const pDoc = await getDoc(doc(db, "patients", currentUser.uid));
      if (pDoc.exists()) {
        setPatientData(pDoc.data());
      }

      const q1 = query(collection(db, "assigned_missions"), where("patientId", "==", currentUser.uid));
      const q2 = query(collection(db, "assigned_routines"), where("patientId", "==", currentUser.uid));
      
      const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
      
      const missions = snap1.docs.map(d => ({ id: d.id, ...d.data(), type: 'one_time' }));
      const routines = snap2.docs.map(d => ({ id: d.id, ...d.data(), type: 'daily' }));
      
      setTasks([...missions, ...routines]);
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

  const openTaskDecision = (task: any, dateObj?: Date) => {
    if (dateObj) {
      const today = new Date();
      today.setHours(0,0,0,0);
      const target = new Date(dateObj);
      target.setHours(0,0,0,0);
      
      if (target > today) {
        alert("🚫 No puedes completar tareas del futuro.");
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
    setSelectedTask(null); 

    try {
      const patientRef = doc(db, "patients", currentUser.uid);
      const taskRef = isRoutine 
        ? doc(db, "assigned_routines", task.id) 
        : doc(db, "assigned_missions", task.id);

      const timestamp = new Date();
      
      const recordData = {
        completedAt: timestamp,
        status: result.type, 
        ...result.payload 
      };

      if (isRoutine && dateKey) {
        await updateDoc(taskRef, {
          [`completionHistory.${dateKey}`]: {
             ...recordData,
             status: result.type 
          },
          lastUpdated: timestamp
        });
      } else {
        await updateDoc(taskRef, {
          status: result.type === 'success' ? 'completed' : 'escaped',
          completionData: recordData,
          completedAt: timestamp
        });
      }

      if (result.type === 'success') {
        const xpBase = task.rewards?.xp || 50;
        const xpBonus = recordData.reflection ? 10 : 0; 
        const totalXp = xpBase + xpBonus;
        const goldGain = task.rewards?.gold || 10;
        const targetStat = task.targetStat || 'str'; 

        const updates: any = {
          "gamificationProfile.currentXp": increment(totalXp),
          "gamificationProfile.wallet.gold": increment(goldGain)
        };
        
        if (task.rewards?.statValue) {
           updates[`gamificationProfile.stats.${targetStat}`] = increment(task.rewards.statValue);
        }

        await updateDoc(patientRef, updates);
      } 

      await loadData(); 

    } catch (e) {
      console.error("Error guardando progreso:", e);
      alert("Error de conexión. Intenta de nuevo.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <div style={{padding: '20px'}}>Cargando tu progreso...</div>;
  if (!patientData) return <div style={{padding: '20px'}}>Perfil no encontrado.</div>;

  const { level, requiredXp } = calculateLevel(patientData.gamificationProfile?.currentXp || 0);
  const currentXp = patientData.gamificationProfile?.currentXp || 0;
  const progressPercent = Math.min(100, (currentXp / requiredXp) * 100); 

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', background: '#fcfcfc', minHeight: '100vh' }}>
      
      <div style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', padding: '20px', borderRadius: '0 0 20px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px' }}>Nivel {level}</h1>
            <span style={{ fontSize: '14px', opacity: 0.9 }}>{patientData.name || 'Héroe'}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>💰 {patientData.gamificationProfile?.wallet?.gold || 0}</div>
            <div style={{ fontSize: '12px' }}>Monedas</div>
          </div>
        </div>
        
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, background: '#4CAF50', height: '100%', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '11px', marginTop: '5px', textAlign: 'right' }}>
           XP para Nivel {level + 1}
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', color: '#444' }}>
          Misiones Activas
        </h3>

        {tasks.map(task => {
          const isRoutine = task.type === 'daily';
          
          return (
            <div key={task.id} style={{ background: 'white', borderRadius: '12px', padding: '15px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#333' }}>{task.staticTaskData?.title || task.title}</h4>
                  <span style={{ fontSize: '12px', color: '#888', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
                    {isRoutine ? 'Rutina Diaria' : 'Misión Única'}
                  </span>
                </div>
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#667eea' }}>
                  +{task.rewards?.xp || 50} XP
                </div>
              </div>

              {!isRoutine && (
                 <div style={{ marginTop: '10px' }}>
                    {task.status === 'completed' ? (
                      <div style={{ padding: '10px', background: '#E8F5E9', color: '#2E7D32', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                        ✓ Misión Completada
                      </div>
                    ) : task.status === 'escaped' ? (
                      <div style={{ padding: '10px', background: '#FFF3E0', color: '#E65100', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold' }}>
                        🛡️ Runa Usada
                      </div>
                    ) : (
                      <button 
                        onClick={() => openTaskDecision(task)}
                        disabled={!!processingId}
                        style={{ width: '100%', padding: '12px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Comenzar Misión
                      </button>
                    )}
                 </div>
              )}

              {isRoutine && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                   {/* Eliminado el 'index' que no se usaba */}
                   {currentWeekDates.map((dateObj) => {
                      const dateKey = dateObj.toISOString().split('T')[0];
                      const dayLabel = DAY_LABELS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]; 
                      
                      const record = task.completionHistory?.[dateKey];
                      const isSuccess = record?.status === 'success' || record?.status === 'completed';
                      const isEscaped = record?.status === 'escape' || record?.status === 'escaped';
                      
                      let bgColor = '#f0f0f0'; 
                      let borderColor = '#ddd';
                      let content = dayLabel;
                      // Definimos el cursor, y AHORA SÍ lo usaremos abajo
                      let cursor = 'pointer';

                      if (isSuccess) {
                        bgColor = '#4CAF50'; 
                        borderColor = '#4CAF50';
                        content = '✓';
                        cursor = 'default';
                      } else if (isEscaped) {
                        bgColor = '#FF9800'; 
                        borderColor = '#FF9800';
                        content = '🛡️';
                        cursor = 'default';
                      } else if (dateObj.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]) {
                        borderColor = '#2196F3'; 
                        bgColor = '#white';
                      }

                      return (
                        <div 
                          key={dateKey} 
                          onClick={() => {
                            if (!isSuccess && !isEscaped) openTaskDecision(task, dateObj);
                          }}
                          style={{ 
                            display: 'flex', flexDirection: 'column', alignItems: 'center', 
                            // AQUÍ ESTABA EL ERROR: Usamos la variable 'cursor' que calculamos arriba
                            cursor: cursor, 
                            opacity: (dateObj > new Date()) ? 0.5 : 1 
                          }}
                        >
                          <div style={{ 
                            width: '32px', height: '32px', borderRadius: '50%', 
                            background: bgColor, border: `2px solid ${borderColor}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: (isSuccess || isEscaped) ? 'white' : '#555',
                            fontWeight: 'bold', fontSize: '14px', transition: 'all 0.2s'
                          }}>
                            {content}
                          </div>
                          <span style={{ fontSize: '10px', color: '#999', marginTop: '4px' }}>{dayLabel}</span>
                        </div>
                      );
                   })}
                </div>
              )}
            </div>
          );
        })}
        
        {tasks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
            No tienes misiones asignadas hoy. ¡Relájate! 🍃
          </div>
        )}
      </div>

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