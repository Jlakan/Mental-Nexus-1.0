import { useState, useEffect } from 'react';
import { 
  doc, getDoc, collection, query, where, getDocs, 
  updateDoc, increment, deleteField 
} from "firebase/firestore"; 
import { auth, db } from '../services/firebase';
import { calculateLevel } from '../utils/GamificationUtils';
import TaskValidationModal from './TaskValidationModal';

import type { Assignment } from '../utils/ClinicalEngine';

// --- HELPER NUEVO: Obtener clave del día para el objeto frequency ---
// AJUSTE: Asegúrate de que estas claves coincidan con tu BD ('mon' vs 'lun')
const getDayKey = (date: Date): string => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[date.getDay()];
};

// Helper para obtener fechas de la semana actual (Lunes a Domingo)
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

const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

interface Props { user?: any; }

export default function PatientDashboard({ user }: Props) {
  // --- ESTADOS ---
  const [patientData, setPatientData] = useState<any>(null);
  const [missions, setMissions] = useState<Assignment[]>([]); 
  const [routines, setRoutines] = useState<Assignment[]>([]); 
  
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<{ task: any, type: 'mission' | 'routine', dateObj?: Date } | null>(null);
  
  // Seguridad
  const [showPin, setShowPin] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  const currentUser = user || auth.currentUser;
  const currentWeekDates = getCurrentWeekDates();

  // 1. CARGA DE DATOS
  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    try {
      const docRef = doc(db, "patients", currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPatientData(docSnap.data());
      }

      // Misiones Únicas
      const missionsQ = query(
        collection(db, "assigned_missions"),
        where("patientId", "==", currentUser.uid),
        where("status", "==", "active")
      );
      const missionsSnap = await getDocs(missionsQ);
      const missionsData = missionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Assignment[];
      setMissions(missionsData);

      // Rutinas/Hábitos
      const routinesQ = query(
        collection(db, "assigned_routines"),
        where("patientId", "==", currentUser.uid),
        where("active", "==", true)
      );
      const routinesSnap = await getDocs(routinesQ);
      const routinesData = routinesSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Assignment[];
      setRoutines(routinesData);

    } catch (error) {
      console.error("Error cargando dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentUser]);

  // 2. MANEJO DE DECISIONES
  const handleDecision = async (decision: { type: 'success' | 'escape', payload?: any }) => {
    if (!selectedTask || !currentUser) return;
    
    const { task, type, dateObj } = selectedTask;
    const patientRef = doc(db, "patients", currentUser.uid);
    const collectionName = type === 'mission' ? "assigned_missions" : "assigned_routines";
    const taskRef = doc(db, collectionName, task.id);

    const xpReward = task.rewards?.xp || 10;
    const goldReward = task.rewards?.gold || 5;

    setSelectedTask(null);

    try {
      if (decision.type === 'success') {
        if (type === 'mission') {
          await updateDoc(taskRef, {
            status: 'completed',
            completedAt: new Date(),
            reflection: decision.payload.reflection || '',
            rating: decision.payload.rating
          });
        } else {
          const dateKey = dateObj!.toISOString().split('T')[0];
          await updateDoc(taskRef, {
            [`history.${dateKey}`]: {
              status: 'completed',
              completedAt: new Date(),
              rating: decision.payload.rating,
              reflection: decision.payload.reflection || ''
            },
            currentStreak: increment(1),
            totalCompletions: increment(1)
          });
        }

        await updateDoc(patientRef, {
          "gamificationProfile.currentXp": increment(xpReward),
          "gamificationProfile.gold": increment(goldReward),
          "gamificationProfile.missionsCompleted": increment(1)
        });

      } else {
        if (type !== 'mission') {
           const dateKey = dateObj!.toISOString().split('T')[0];
           await updateDoc(taskRef, {
             [`history.${dateKey}`]: {
               status: 'escaped',
               escapedAt: new Date(),
               motive: decision.payload.motive
             },
             currentStreak: 0 
           });
        }
      }
      await loadData(); 
    } catch (error) {
      console.error("Error guardando progreso:", error);
      alert("Error al guardar. Intenta de nuevo.");
    }
  };

  // --- FUNCIONES V2 (Seguridad) ---
  const handleRevokeAccess = async (professionalId: string, professionalName: string) => {
    if (!currentUser) return;
    if (!window.confirm(`¿Estás seguro de que quieres revocar el acceso a ${professionalName}?`)) return;

    try {
      const patientRef = doc(db, "patients", currentUser.uid);
      await updateDoc(patientRef, {
        [`careTeam.${professionalId}`]: deleteField()
      });
      alert(`Acceso revocado a ${professionalName}.`);
      await loadData();
    } catch (e) {
      console.error("Error revocando:", e);
      alert("Hubo un error al revocar el acceso.");
    }
  };

  const handleUpdatePin = async () => {
    if (!currentUser || newPin.length !== 4) return alert("El PIN debe tener 4 dígitos.");
    try {
      const patientRef = doc(db, "patients", currentUser.uid);
      await updateDoc(patientRef, { securityPin: newPin });
      setPatientData({ ...patientData, securityPin: newPin });
      setEditingPin(false);
      setNewPin('');
      alert("PIN actualizado correctamente.");
    } catch (e) {
      alert("Error actualizando PIN.");
    }
  };

  if (loading) return <div style={{padding:'20px'}}>Cargando aventura...</div>;
  if (!patientData) return <div>No se encontró el perfil.</div>;

  const levelInfo = calculateLevel(patientData.gamificationProfile?.currentXp || 0);

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', background: '#fcfcfc', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* HEADER */}
      <div style={{ background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)', color: 'white', padding: '20px', borderRadius: '0 0 20px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '22px' }}>Hola, {patientData.fullName.split(' ')[0]}</h1>
            <p style={{ margin: '5px 0 0 0', opacity: 0.9 }}>Nivel {levelInfo.level}: {levelInfo.title}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
             <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{patientData.gamificationProfile?.currentXp} XP</div>
             <div style={{ fontSize: '14px', color: '#FFD700' }}>🪙 {patientData.gamificationProfile?.gold || 0} Oro</div>
          </div>
        </div>
      </div>

      <div style={{ padding: '20px' }}>
        
        {/* SECCIÓN 1: MISIONES ÚNICAS */}
        {missions.length > 0 && (
          <div style={{ marginBottom: '30px' }}>
            <h2 style={{ color: '#333', fontSize: '18px' }}>Misiones Activas</h2>
            {missions.map(mission => (
              <div 
                key={mission.id}
                onClick={() => setSelectedTask({ task: mission, type: 'mission' })}
                style={{ 
                  background: 'white', padding: '15px', borderRadius: '12px', marginBottom: '10px',
                  border: '1px solid #ddd', borderLeft: '5px solid #FF9800', cursor: 'pointer',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.05)'
                }}
              >
                <div style={{ fontWeight: 'bold' }}>{mission.staticTaskData?.title || mission.title}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>Recompensa: {mission.rewards?.xp} XP</div>
              </div>
            ))}
          </div>
        )}

        {/* SECCIÓN 2: RUTINAS DIARIAS (FIX APLICADO) */}
        <div>
          <h2 style={{ color: '#333', fontSize: '18px' }}>Hábitos Diarios</h2>
          {routines.map(routine => (
            <div key={routine.id} style={{ marginBottom: '20px', background: 'white', borderRadius: '12px', padding: '15px', border: '1px solid #eee' }}>
              <div style={{ fontWeight: 'bold', marginBottom: '10px' }}>{routine.staticTaskData?.title || routine.title}</div>
              
              {/* Grid de Días */}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                {currentWeekDates.map((dateObj, idx) => {
                   const dateKeyISO = dateObj.toISOString().split('T')[0]; // Para historial
                   const dayKeyFreq = getDayKey(dateObj); // Para frecuencia (ej: 'mon')
                   
                   // --- FIX APLICADO AQUÍ ---
                   // Verificamos si existe en el objeto (no array includes)
                   const isScheduled = routine.frequency && routine.frequency[dayKeyFreq] !== undefined;

                   // Si no está programado para hoy, renderizamos un espacio vacío o indicador inactivo
                   if (!isScheduled) {
                     return (
                        <div key={idx} style={{ width: '32px', textAlign: 'center', opacity: 0.3, fontSize: '12px' }}>
                            -
                        </div>
                     );
                   }

                   // Si está programado, buscamos su estado en el historial
                   const historyItem = routine.history?.[dateKeyISO];
                   const isCompleted = historyItem?.status === 'completed';
                   
                   return (
                     <div 
                       key={idx} 
                       onClick={() => {
                         if(!historyItem) setSelectedTask({ task: routine, type: 'routine', dateObj });
                       }}
                       style={{ textAlign: 'center', cursor: historyItem ? 'default' : 'pointer' }}
                     >
                       <div style={{ 
                         width: '32px', height: '32px', borderRadius: '50%', 
                         background: isCompleted ? '#4CAF50' : '#f0f0f0',
                         color: isCompleted ? 'white' : '#555',
                         display: 'flex', alignItems: 'center', justifyContent: 'center',
                         fontSize: '12px', fontWeight: 'bold',
                         border: historyItem ? 'none' : '1px solid #ccc'
                       }}>
                         {isCompleted ? '✓' : DAY_LABELS[idx]}
                       </div>
                     </div>
                   );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN V2 (Seguridad) */}
      <div style={{ margin: '20px', padding: '20px', background: 'white', borderRadius: '12px', border: '1px solid #eee', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <h3 style={{ borderBottom: '2px solid #eee', paddingBottom: '10px', color: '#444', marginTop: 0 }}>
          🛡️ Seguridad y Accesos
        </h3>
        {/* ... (Código de seguridad igual que antes) ... */}
        <div style={{ marginBottom: '20px' }}>
          <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Mi PIN de Seguridad</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#f9f9f9', padding: '10px', borderRadius: '8px' }}>
            {editingPin ? (
              <>
                <input 
                  type="password" maxLength={4} placeholder="Nuevo PIN"
                  value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  style={{ padding: '5px', borderRadius: '4px', border: '1px solid #ccc', width: '80px', textAlign: 'center' }}
                />
                <button onClick={handleUpdatePin} style={{ background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>Guardar</button>
                <button onClick={() => setEditingPin(false)} style={{ background: '#999', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', cursor: 'pointer' }}>Cancelar</button>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 'bold', fontSize: '18px', letterSpacing: '2px' }}>
                  {showPin ? (patientData.securityPin || '****') : '••••'}
                </div>
                <button onClick={() => setShowPin(!showPin)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#2196F3', textDecoration: 'underline' }}>{showPin ? 'Ocultar' : 'Mostrar'}</button>
                <button onClick={() => setEditingPin(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#666', textDecoration: 'underline' }}>Cambiar</button>
              </>
            )}
          </div>
        </div>

        <div>
          <h4 style={{ fontSize: '14px', color: '#666', marginBottom: '8px' }}>Profesionales con Acceso</h4>
          {(!patientData.careTeam || Object.keys(patientData.careTeam).length === 0) ? (
            <div style={{ fontSize: '13px', color: '#999', fontStyle: 'italic' }}>No has vinculado profesionales aún.</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {Object.entries(patientData.careTeam).map(([profId, info]: [string, any]) => (
                <li key={profId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px dashed #eee' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#333' }}>{info.professionalName}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{info.professionType}</div>
                  </div>
                  <button onClick={() => handleRevokeAccess(profId, info.professionalName)} style={{ padding: '5px 10px', fontSize: '11px', color: '#d32f2f', background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: '4px', cursor: 'pointer' }}>Revocar</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <TaskValidationModal 
        isOpen={!!selectedTask}
        taskTitle={selectedTask?.task?.staticTaskData?.title || selectedTask?.task?.title || "Misión"}
        onClose={() => setSelectedTask(null)}
        onConfirmSuccess={(rating, reflection) => handleDecision({ type: 'success', payload: { rating, reflection } })}
        onConfirmEscape={(reasonId) => handleDecision({ type: 'escape', payload: { motive: reasonId } })}
      />

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button onClick={() => auth.signOut()} style={{ color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          Cerrar Sesión
        </button>
      </div>

    </div>
  );
}