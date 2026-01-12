// src/components/PatientDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  doc, getDoc, collection, query, where, getDocs, 
  updateDoc, increment 
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { calculateLevel, xpForNextLevel, BASE_STATS } from '../utils/GamificationUtils';
import TaskValidationModal from './TaskValidationModal';

// --- HELPERS DE FECHAS ---
const getCurrentWeekDates = () => {
  const current = new Date();
  const day = current.getDay(); // 0=Dom, 1=Lun
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

const DAY_IDS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props {
  user?: any;
}

export default function PatientDashboard({ user }: Props) {
  // --- ESTADOS ---
  const [patientData, setPatientData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para controlar qué tarea se está "jugando"
  const [selectedTask, setSelectedTask] = useState<{ task: any, dateObj?: Date } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const currentUser = user || auth.currentUser;
  const currentWeekDates = getCurrentWeekDates();

  // --- CARGA DE DATOS ---
  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      // 1. Perfil del Paciente (Gamificación)
      const pDoc = await getDoc(doc(db, "patients", currentUser.uid));
      if (pDoc.exists()) {
        setPatientData(pDoc.data());
      }

      // 2. Tareas (Misiones y Rutinas)
      // Nota: En producción, usar índices compuestos para ordenar por fecha
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
  }, [currentUser]);

  // --- LÓGICA DE INTERACCIÓN ---

  // 1. Abrir Modal de Decisión
  const openTaskDecision = (task: any, dateObj?: Date) => {
    // Validar si es fecha futura (opcional)
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

  // 2. Procesar la Decisión (Motor Central)
  const handleDecision = async (result: { type: 'success' | 'escape', payload: any }) => {
    if (!currentUser || !selectedTask) return;
    
    const { task, dateObj } = selectedTask;
    const isRoutine = task.type === 'daily';
    const dateKey = dateObj ? dateObj.toISOString().split('T')[0] : null;
    
    // Bloquear UI
    setProcessingId(task.id);
    setSelectedTask(null); // Cerrar modal

    try {
      const patientRef = doc(db, "patients", currentUser.uid);
      const taskRef = isRoutine 
        ? doc(db, "assigned_routines", task.id) 
        : doc(db, "assigned_missions", task.id);

      const timestamp = new Date();
      
      // Construir el registro de actividad
      const recordData = {
        completedAt: timestamp,
        status: result.type, // 'completed' o 'escaped' manejado abajo
        ...result.payload // { rating, reflection } OR { motive }
      };

      // --- A. ACTUALIZAR LA TAREA ---
      if (isRoutine && dateKey) {
        // En rutinas, usamos un Mapa por fecha para acceso rápido O(1)
        await updateDoc(taskRef, {
          [`completionHistory.${dateKey}`]: {
             ...recordData,
             status: result.type // 'success' -> 'completed' mapping si es necesario, pero usaremos 'success'/'escape' interno
          },
          lastUpdated: timestamp
        });
      } else {
        // En misiones únicas
        await updateDoc(taskRef, {
          status: result.type === 'success' ? 'completed' : 'escaped',
          completionData: recordData,
          completedAt: timestamp
        });
      }

      // --- B. GAMIFICACIÓN (Solo si hubo Éxito) ---
      if (result.type === 'success') {
        const xpBase = task.rewards?.xp || 50;
        const xpBonus = recordData.reflection ? 10 : 0; // Bonus por reflexión
        const totalXp = xpBase + xpBonus;
        
        const goldGain = task.rewards?.gold || 10;
        const targetStat = task.targetStat || 'str'; // Default Fuerza

        // Construir update dinámico para stats
        const updates: any = {
          "gamificationProfile.currentXp": increment(totalXp),
          "gamificationProfile.wallet.gold": increment(goldGain)
        };
        
        // Sumar al stat específico si existe
        if (task.rewards?.statValue) {
           updates[`gamificationProfile.stats.${targetStat}`] = increment(task.rewards.statValue);
        }

        await updateDoc(patientRef, updates);
        
        // (Opcional) Feedback visual tipo "Toast"
        // alert(`¡Genial! +${totalXp} XP`);
      } else {
        // Feedback Escape
        // alert("Racha salvada. ¡Descansa y vuelve con fuerza!");
      }

      await loadData(); // Recargar UI

    } catch (e) {
      console.error("Error guardando progreso:", e);
      alert("Error de conexión. Intenta de nuevo.");
    } finally {
      setProcessingId(null);
    }
  };

  // --- RENDERIZADO ---
  
  if (loading) return <div style={{padding: '20px'}}>Cargando tu progreso...</div>;
  if (!patientData) return <div style={{padding: '20px'}}>Perfil no encontrado.</div>;

  const { level, requiredXp } = calculateLevel(patientData.gamificationProfile?.currentXp || 0);
  const currentXp = patientData.gamificationProfile?.currentXp || 0;
  const progressPercent = Math.min(100, (currentXp / requiredXp) * 100); // Simplificado para visualización

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', background: '#fcfcfc', minHeight: '100vh' }}>
      
      {/* 1. HEADER DEL JUGADOR */}
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
        
        {/* Barra de XP */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '10px', height: '12px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, background: '#4CAF50', height: '100%', transition: 'width 0.5s' }} />
        </div>
        <div style={{ fontSize: '11px', marginTop: '5px', textAlign: 'right' }}>
           XP para Nivel {level + 1}
        </div>
      </div>

      {/* 2. LISTA DE TAREAS */}
      <div style={{ padding: '20px' }}>
        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', color: '#444' }}>
          Misiones Activas
        </h3>

        {tasks.map(task => {
          const isRoutine = task.type === 'daily';
          
          return (
            <div key={task.id} style={{ background: 'white', borderRadius: '12px', padding: '15px', marginBottom: '20px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #eee' }}>
              
              {/* Cabecera de la Tarea */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px', color: '#333' }}>{task.staticTaskData?.title || task.title}</h4>
                  <span style={{ fontSize: '12px', color: '#888', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>
                    {isRoutine ? 'Rutina Diaria' : 'Misión Única'}
                  </span>
                </div>
                {/* Recompensa Visual */}
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#667eea' }}>
                  +{task.rewards?.xp || 50} XP
                </div>
              </div>

              {/* CUERPO: Misión Única */}
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

              {/* CUERPO: Rutina (Grid Semanal) */}
              {isRoutine && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '15px' }}>
                   {currentWeekDates.map((dateObj, index) => {
                      const dateKey = dateObj.toISOString().split('T')[0];
                      const dayLabel = DAY_LABELS[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1]; // Ajuste L-D
                      
                      // Buscar historial
                      const record = task.completionHistory?.[dateKey];
                      const isSuccess = record?.status === 'success' || record?.status === 'completed';
                      const isEscaped = record?.status === 'escape' || record?.status === 'escaped';
                      
                      // Determinar Color
                      let bgColor = '#f0f0f0'; // Pendiente
                      let borderColor = '#ddd';
                      let content = dayLabel;
                      let cursor = 'pointer';

                      if (isSuccess) {
                        bgColor = '#4CAF50'; // Verde Éxito
                        borderColor = '#4CAF50';
                        content = '✓';
                        cursor = 'default';
                      } else if (isEscaped) {
                        bgColor = '#FF9800'; // Naranja Escape
                        borderColor = '#FF9800';
                        content = '🛡️';
                        cursor = 'default';
                      } else if (dateObj.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]) {
                        borderColor = '#2196F3'; // Hoy (resaltado)
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
                            cursor: (!isSuccess && !isEscaped) ? 'pointer' : 'default',
                            opacity: (dateObj > new Date()) ? 0.5 : 1 // Fechas futuras semitransparentes
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

      {/* 3. MODAL DE DECISIÓN (Se renderiza condicionalmente) */}
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