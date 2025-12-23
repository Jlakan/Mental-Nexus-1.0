import React, { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, increment, deleteField } from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { calculateLevel, xpForNextLevel } from '../utils/GamificationUtils';




// Helper para obtener las fechas de la semana actual (Lunes a Domingo)
const getCurrentWeekDates = () => {
const current = new Date();
const day = current.getDay(); // 0 es Domingo, 1 es Lunes...
// Ajustar para que la semana empiece en Lunes (1) y termine en Domingo (7)
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




// IDs de días para mapear con lo que guardamos en 'frequency' (ej: 'lun', 'mar')
const DAY_IDS = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
const DAY_LABELS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];




export default function PatientDashboard() {
const [patientData, setPatientData] = useState<any>(null);
const [tasks, setTasks] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [processingId, setProcessingId] = useState<string | null>(null); // Bloqueo anti-spam click




const user = auth.currentUser;
const currentWeekDates = getCurrentWeekDates(); // Calculamos la semana una vez al renderizar




// 1. CARGA DE DATOS
const loadData = async () => {
  if (!user) return;
  setLoading(true);
  try {
    // A. Perfil
    const docRef = doc(db, "patients", user.uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) setPatientData(docSnap.data());




    // B. Cargar Tareas (Misiones y Rutinas)
    // Nota: Las rutinas ahora siempre están "pending" visualmente, pero filtramos igual.
    const qMissions = query(collection(db, "assigned_missions"), where("patientId", "==", user.uid), where("status", "==", "pending"));
    const qRoutines = query(collection(db, "assigned_routines"), where("patientId", "==", user.uid));
    // Rutinas: Traemos todas las activas (no filtramos por pending porque son perpetuas,
    // a menos que uses un campo 'isActive' o borres las rutinas viejas).
    // Asumiremos que si está en assigned_routines es válida.




    const [snapMissions, snapRoutines] = await Promise.all([getDocs(qMissions), getDocs(qRoutines)]);




    const loadedMissions = snapMissions.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'assigned_missions' }));
    // Filtramos rutinas solo si explícitamente se marcaron como "archivadas" o algo así. Por ahora traemos todo.
    const loadedRoutines = snapRoutines.docs.map(d => ({ id: d.id, ...d.data(), _collection: 'assigned_routines' }));




    setTasks([...loadedMissions, ...loadedRoutines]);




  } catch (error) {
    console.error("Error cargando dashboard:", error);
  } finally {
    setLoading(false);
  }
};




useEffect(() => { loadData(); }, [user]);




// 2. COMPLETAR MISIÓN ÚNICA (Lógica original)
const handleCompleteOneOff = async (task: any) => {
  if (!user || processingId) return;
  if (!window.confirm(`¿Completaste "${task.title}"?`)) return;




  setProcessingId(task.id);
  try {
    const patientRef = doc(db, "patients", user.uid);
    // Actualizar stats si aplica
    const statUpdate: any = {};
    if (task.targetStat && task.rewards.statValue) {
       statUpdate[`gamificationProfile.stats.${task.targetStat}`] = increment(task.rewards.statValue);
    }




    await updateDoc(patientRef, {
      "gamificationProfile.currentXp": increment(task.rewards.xp),
      "gamificationProfile.wallet.gold": increment(task.rewards.gold),
      "gamificationProfile.wallet.nexus": increment(task.rewards.nexus || 0),
      ...statUpdate
    });




    await updateDoc(doc(db, "assigned_missions", task.id), {
      status: 'completed',
      completedAt: new Date()
    });




    alert(`¡Misión Cumplida! +${task.rewards.xp} XP`);
    loadData();
  } catch (e) { console.error(e); } finally { setProcessingId(null); }
};




// 3. CHECKBOX DE RUTINA DIARIA (Lógica Nueva)
const handleCheckRoutineDay = async (task: any, dateObj: Date, dayId: string) => {
  if (!user || processingId) return;
   // Formato de fecha para la llave del mapa: YYYY-MM-DD
  const dateKey = dateObj.toISOString().split('T')[0];
  const isCompleted = task.completionHistory?.[dateKey] === true;
   // VALIDACIÓN DE TIEMPO (Regla de 48 horas: 5am hoy hasta 11:59pm mañana)
  // -----------------------------------------------------------------------
  // Inicio: Día objetivo a las 05:00 AM
  const windowStart = new Date(dateObj);
  windowStart.setHours(5, 0, 0, 0);
   // Fin: Día siguiente al objetivo a las 23:59:59
  const windowEnd = new Date(dateObj);
  windowEnd.setDate(windowEnd.getDate() + 1); // Mañana
  windowEnd.setHours(23, 59, 59, 999);




  const now = new Date();
   if (now < windowStart || now > windowEnd) {
    alert("⚠️ Fuera de tiempo.\nSolo puedes marcar esta casilla desde las 5:00 AM del día correspondiente hasta las 11:59 PM del día siguiente.");
    return;
  }
  // -----------------------------------------------------------------------




  setProcessingId(`${task.id}-${dateKey}`); // Bloqueo específico
   try {
    const patientRef = doc(db, "patients", user.uid);
    const taskRef = doc(db, "assigned_routines", task.id);




    // Si NO estaba completado -> Marcamos (Suma XP)
    if (!isCompleted) {
      await updateDoc(taskRef, {
        [`completionHistory.${dateKey}`]: true,
        lastUpdated: new Date()
      });
    
      // Damos la recompensa (Podemos dar la completa o una fracción. Aquí damos la completa definida en el Tier)
      await updateDoc(patientRef, {
        "gamificationProfile.currentXp": increment(task.rewards.xp),
        "gamificationProfile.wallet.gold": increment(task.rewards.gold)
      });
    }
    // Si YA estaba completado -> Desmarcamos (Resta XP para corregir)
    else {
      if(!window.confirm("¿Desmarcar? Se retirará la experiencia ganada.")) {
          setProcessingId(null); return;
      }
      await updateDoc(taskRef, {
        [`completionHistory.${dateKey}`]: deleteField()
      });




      // Retiramos la recompensa
      await updateDoc(patientRef, {
        "gamificationProfile.currentXp": increment(-task.rewards.xp),
        "gamificationProfile.wallet.gold": increment(-task.rewards.gold)
      });
    }




    // Actualizamos estado local rápido para feedback inmediato
    const newTasks = tasks.map(t => {
      if (t.id === task.id) {
        const newHistory = { ...t.completionHistory };
        if (!isCompleted) newHistory[dateKey] = true;
        else delete newHistory[dateKey];
        return { ...t, completionHistory: newHistory };
      }
      return t;
    });
    setTasks(newTasks);




  } catch (error) {
    console.error(error);
    alert("Error al actualizar rutina.");
  } finally {
    setProcessingId(null);
  }
};




// --- RENDERIZADO ---
 if (loading) return <div style={{padding:'20px', textAlign:'center'}}>Cargando...</div>;
if (!patientData) return <div style={{padding:'20px'}}>Error de perfil.</div>;




// Cálculos de Nivel (igual que antes)
const currentXp = patientData.gamificationProfile?.currentXp || 0;
const level = calculateLevel(currentXp);
const nextLevelXp = xpForNextLevel(level);
const prevLevelXp = xpForNextLevel(level - 1);
const progressPercent = Math.min(100, Math.max(0, ((currentXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100));




return (
  <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'sans-serif' }}>
  
    {/* 1. HEADER (Igual que antes) */}
    <div style={{ background: 'linear-gradient(135deg, #1565C0 0%, #42A5F5 100%)', color: 'white', padding: '25px', borderRadius: '15px', marginBottom: '25px', boxShadow: '0 4px 15px rgba(0,0,0,0.2)' }}>
      <div style={{display:'flex', justifyContent:'space-between'}}>
        <div>
          <h1 style={{margin:0, fontSize:'24px'}}>{patientData.fullName}</h1>
          <p style={{margin:'5px 0 0 0', opacity:0.9}}>Nivel {level} • Aventurero</p>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'14px', background:'rgba(0,0,0,0.2)', padding:'5px 10px', borderRadius:'20px', marginBottom:'5px'}}>
            🟡 {patientData.gamificationProfile?.wallet?.gold || 0} Oro
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




    {/* 2. LISTA DE MISIONES */}
    <h2 style={{color:'#333', borderBottom:'2px solid #eee', paddingBottom:'10px'}}>📜 Tablón de Misiones</h2>




    {tasks.length === 0 ? (
      <div style={{textAlign:'center', padding:'40px', color:'#777'}}>¡Todo al día!</div>
    ) : (
      <div style={{display:'grid', gap:'15px'}}>
        {tasks.map(task => {
          const isRoutine = task.type === 'daily';




          return (
            <div key={task.id} style={{
              background:'white', borderRadius:'10px', padding:'15px',
              borderLeft:`5px solid ${task.themeColor || '#ccc'}`,
              boxShadow:'0 2px 8px rgba(0,0,0,0.05)'
            }}>
              <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <span style={{fontSize:'10px', padding:'2px 8px', borderRadius:'4px', color:'white', background: isRoutine ? '#9C27B0' : '#E65100'}}>
                    {isRoutine ? 'RUTINA' : 'MISIÓN'}
                  </span>
                  <h3 style={{margin:'5px 0', fontSize:'18px', color:'#333'}}>{task.title}</h3>
                  <p style={{margin:'0 0 10px 0', fontSize:'14px', color:'#666'}}>{task.description}</p>
                
                  {/* --- RECOMPENSAS --- */}
                  <div style={{display:'flex', gap:'10px', fontSize:'12px', color:'#555', marginBottom: isRoutine?'15px':'0'}}>
                    <span>⚡ +{task.rewards.xp} XP</span>
                    <span>💰 +{task.rewards.gold} Oro</span>
                  </div>
                </div>




                {/* BOTÓN SOLO PARA MISIONES ÚNICAS */}
                {!isRoutine && (
                  <button
                    onClick={() => handleCompleteOneOff(task)}
                    disabled={!!processingId}
                    style={{
                      background: '#4CAF50', color:'white', border:'none', padding:'10px 20px',
                      borderRadius:'8px', cursor:'pointer', fontWeight:'bold'
                    }}
                  >
                    Completar
                  </button>
                )}
              </div>




              {/* --- SECCIÓN SEMANAL (SOLO RUTINAS) --- */}
              {isRoutine && (
                <div style={{background:'#F5F5F5', padding:'10px', borderRadius:'8px', marginTop:'5px'}}>
                  <div style={{fontSize:'12px', fontWeight:'bold', marginBottom:'8px', color:'#555', textAlign:'center'}}>
                    SEMANA ACTUAL
                  </div>
                  <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    {currentWeekDates.map((dateObj, index) => {
                      const dayId = DAY_IDS[index]; // 'lun', 'mar'...
                      const label = DAY_LABELS[index]; // 'L', 'M'...
                      const dateKey = dateObj.toISOString().split('T')[0];
                    
                      // Estado visual
                      const isAssigned = task.frequency && task.frequency.includes(dayId);
                      const isCompleted = task.completionHistory?.[dateKey] === true;
                    
                      // Lógica de Tiempo (5am hoy -> 11:59pm mañana)
                      const windowStart = new Date(dateObj); windowStart.setHours(5,0,0,0);
                      const windowEnd = new Date(dateObj); windowEnd.setDate(windowEnd.getDate()+1); windowEnd.setHours(23,59,59,999);
                      const now = new Date();
                      const isTimeOpen = now >= windowStart && now <= windowEnd;
                    
                      // Estilos dinámicos
                      let bgColor = '#e0e0e0'; // Default gris
                      let borderColor = 'transparent';
                      let cursor = 'default';
                      let opacity = 0.5;




                      // Si es un día asignado por el profesional
                      if (isAssigned) {
                        opacity = 1;
                        borderColor = task.themeColor || '#9C27B0';
                        if (isCompleted) bgColor = task.themeColor || '#9C27B0'; // Relleno si completó
                        else bgColor = 'white'; // Hueco si falta
                      }




                      // Si es accesible por tiempo, lo hacemos interactivo
                      if (isTimeOpen && isAssigned) {
                        cursor = 'pointer';
                      } else if (!isTimeOpen) {
                         opacity = 0.4; // Bloqueado por tiempo
                      }




                      return (
                        <div key={dayId} style={{textAlign:'center', flex:1}}>
                          <div
                            onClick={() => isTimeOpen && isAssigned ? handleCheckRoutineDay(task, dateObj, dayId) : null}
                            style={{
                              width:'35px', height:'35px', borderRadius:'50%', margin:'0 auto',
                              display:'flex', alignItems:'center', justifyContent:'center',
                              background: bgColor,
                              border: `2px solid ${borderColor}`,
                              color: isCompleted && isAssigned ? 'white' : '#555',
                              fontWeight:'bold', cursor: cursor, opacity: opacity,
                              transition: 'all 0.2s'
                            }}
                            title={!isTimeOpen ? `Cerrado. Abre 5am de ${label}` : isAssigned ? "Click para marcar/desmarcar" : "Día libre"}
                          >
                            {isCompleted ? '✓' : label}
                          </div>
                          {/* Indicador de hoy */}
                          {dateKey === new Date().toISOString().split('T')[0] && (
                            <div style={{fontSize:'9px', color:'#2196F3', marginTop:'2px', fontWeight:'bold'}}>HOY</div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}




    <div style={{marginTop:'30px', textAlign:'center'}}>
      <button onClick={() => auth.signOut()} style={{color:'#d32f2f', background:'none', border:'none', cursor:'pointer', textDecoration:'underline'}}>
        Cerrar Sesión
      </button>
    </div>
  </div>
);
}
