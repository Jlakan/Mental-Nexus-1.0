// src/components/PatientDashboard.tsx
import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, getDocs,
  updateDoc, increment, deleteField, serverTimestamp, writeBatch
} from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { calculateLevel } from '../utils/GamificationUtils';
import TaskValidationModal from './TaskValidationModal';
import PlayerStatusCard from './PlayerStatusCard';
import type { Assignment } from '../utils/ClinicalEngine';

// --- HELPERS DE FECHA ---
const getDayKey = (date: Date): string => {
  const days = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  return days[date.getDay()];
};

const getCurrentWeekDates = () => {
  const current = new Date();
  const day = current.getDay();
  // Lunes como primer día
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
  // --- ESTADOS DE DATOS (V2) ---
  const [patientData, setPatientData] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [linkedProfessionals, setLinkedProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- ESTADOS DE UI/LÓGICA ---
  const [selectedTask, setSelectedTask] = useState<{ task: Assignment, dateStr: string } | null>(null);
  const [weekDates] = useState(getCurrentWeekDates());

  // --- ESTADOS DE SEGURIDAD (Restaurados de V1) ---
  const [showPin, setShowPin] = useState(false);
  const [editingPin, setEditingPin] = useState(false);
  const [newPin, setNewPin] = useState('');

  // 1. CARGA DE DATOS (Arquitectura V2: Colección 'users')
  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        // A. Datos del Usuario
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          const data = userSnap.data();
          setPatientData(data);
          
          // Cargar profesionales vinculados
          if (data.permissions) {
            const proIds = Object.keys(data.permissions);
            const proPromises = proIds.map(pid => getDoc(doc(db, "users", pid)));
            const proSnaps = await Promise.all(proPromises);
            const pros = proSnaps.map(s => ({ id: s.id, ...s.data() }));
            setLinkedProfessionals(pros);
          }
        }

        // B. Assignments (Misiones/Rutinas)
        const q = query(collection(db, "users", user.uid, "assignments"));
        const tasksSnap = await getDocs(q);
        const tasksList = tasksSnap.docs.map(d => ({ id: d.id, ...d.data() } as Assignment));
        setAssignments(tasksList);

      } catch (error) {
        console.error("Error cargando dashboard:", error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user]);

  // 2. MANEJO DE TAREAS
  const handleTaskClick = (task: Assignment, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const history = (task.completionHistory as any) || {};
    
    if (history[dateStr]) {
      // Si ya tiene estado (completado O escapado), avisar
      alert(`Esta actividad ya fue registrada como: ${history[dateStr].status}`);
      return;
    }
    setSelectedTask({ task, dateStr });
  };

  // 3. LÓGICA DE DECISIÓN (Híbrido V1 + V2)
  const handleDecision = async (decision: { type: 'success' | 'escape', payload?: any }) => {
    if (!selectedTask || !user) return;

    const { task, dateStr } = selectedTask;
    const taskRef = doc(db, "users", user.uid, "assignments", task.id);
    const userRef = doc(db, "users", user.uid);

    try {
      const batch = db.batch(); // Usamos Batch para atomicidad (V2)

      if (decision.type === 'success') {
        // --- CASO ÉXITO ---
        
        // A. Actualizar Historial
        batch.update(taskRef, {
          [`completionHistory.${dateStr}`]: {
            status: 'completed',
            completedAt: new Date().toISOString(),
            rating: decision.payload.rating,
            reflection: decision.payload.reflection || ''
          },
          lastCompletedAt: serverTimestamp(),
          // RESTAURADO DE V1: Contadores de racha
          currentStreak: increment(1),
          totalCompletions: increment(1)
        });

        // B. Recompensas (V2 Logic)
        const xpReward = task.staticTaskData?.xp || 10;
        const goldReward = task.staticTaskData?.gold || 5;

        batch.update(userRef, {
          "gamification.xp": increment(xpReward),
          "gamification.gold": increment(goldReward),
          "gamification.completedMissions": increment(1)
        });

        // Stats adicionales
        if (task.staticTaskData?.stats) {
             const statKey = `gamification.stats.${task.staticTaskData.stats}`; 
             batch.update(userRef, { [statKey]: increment(1) });
        }

      } else {
        // --- CASO ESCAPE (RESTAURADO DE V1) ---
        // Ahora sí guardamos en BD que el usuario escapó
        batch.update(taskRef, {
             [`completionHistory.${dateStr}`]: {
               status: 'escaped',
               escapedAt: new Date().toISOString(),
               motive: decision.payload.motive
             },
             // RESTAURADO DE V1: Romper la racha
             currentStreak: 0 
        });
      }

      await batch.commit();
      
      // Actualización optimista de UI simple (para evitar recarga total si no se desea)
      // O simplemente recargamos para asegurar sincronización:
      window.location.reload(); 

    } catch (error) {
      console.error("Error guardando progreso:", error);
      alert("Error guardando progreso");
    }
  };

  // 4. GESTIÓN DE PIN (RESTAURADO DE V1 - Adaptado a Tailwind)
  const handleUpdatePin = async () => {
    if (!user || newPin.length !== 4) return alert("El PIN debe tener 4 dígitos.");
    try {
      // Nota: V2 usa 'users', V1 usaba 'patients'. Mantenemos arquitectura V2.
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, { securityPin: newPin });
      
      setPatientData({ ...patientData, securityPin: newPin });
      setEditingPin(false);
      setNewPin('');
      alert("PIN actualizado correctamente.");
    } catch (e) {
      console.error(e);
      alert("Error actualizando PIN.");
    }
  };

  // 5. GESTIÓN DE ACCESO
  const handleRevokeAccess = async (profId: string, profName: string) => {
    if (!window.confirm(`¿Seguro que quieres desconectar a ${profName}?`)) return;
    try {
        const userRef = doc(db, "users", user.uid);
        await updateDoc(userRef, {
            [`permissions.${profId}`]: deleteField()
        });
        alert("Acceso revocado correctamente.");
        window.location.reload();
    } catch (e) {
        alert("Error al revocar");
    }
  };

  // --- CÁLCULOS UI ---
  const currentXp = patientData?.gamification?.xp || 0;
  const levelInfo = calculateLevel(currentXp);
  const currentStats = patientData?.gamification?.stats || { STR: 0, INT: 0, STA: 0, DEX: 0 };

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando Nexus...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      {/* HEADER (Estilo V2) */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center mb-6 sticky top-0 z-10">
         <div>
            <h1 className="text-xl font-bold text-gray-800">
                Hola, {patientData?.fullName?.split(' ')[0] || 'Viajero'}
            </h1>
            <p className="text-xs text-gray-500">
                {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long'})}
            </p>
         </div>
         <button onClick={() => auth.signOut()} className="text-sm text-red-500 font-semibold hover:bg-red-50 px-3 py-1 rounded-lg transition-colors">
            Salir
         </button>
      </div>

      <div className="max-w-3xl mx-auto px-4">
        
        {/* STATUS CARD (Estilo V2) */}
        <PlayerStatusCard 
            level={levelInfo.level}
            currentXp={levelInfo.currentLevelXp}
            requiredXp={levelInfo.requiredXp}
            progressPercent={levelInfo.progressPercent}
            stats={currentStats}
        />

        {/* TABLA DE MISIONES (Estilo V2 con lógica V1 integrada) */}
        <h3 className="text-lg font-bold text-gray-700 mb-4 mt-8 flex items-center gap-2">
            <span>📅</span> Matriz de Tareas
        </h3>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 text-gray-500 font-medium border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3">Misión</th>
                        {weekDates.map((d, i) => (
                            <th key={i} className="px-2 py-3 text-center min-w-[40px]">
                                {DAY_LABELS[i]}
                                <div className="text-[10px] font-normal">{d.getDate()}</div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {assignments.map(task => {
                        const isRoutine = task.type === 'routine';
                        const frequency = (task.frequency as any) || {};

                        return (
                            <tr key={task.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-gray-800">
                                        {task.staticTaskData?.title || task.title}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span>{isRoutine ? 'Rutina' : 'Misión'}</span>
                                        {/* Mostramos Racha si existe (Feature V1) */}
                                        {(task as any).currentStreak > 1 && (
                                            <span className="text-orange-500 font-bold">
                                                🔥 {(task as any).currentStreak}
                                            </span>
                                        )}
                                    </div>
                                </td>
                                
                                {weekDates.map((date, i) => {
                                    const dayKey = getDayKey(date);
                                    // Si es rutina, checkear frecuencia. Si es misión, siempre visible hasta completar.
                                    const isScheduled = isRoutine ? frequency[dayKey] : true;
                                    
                                    const dateStr = date.toISOString().split('T')[0];
                                    const historyEntry = (task.completionHistory as any)?.[dateStr];
                                    
                                    const isCompleted = historyEntry?.status === 'completed';
                                    const isEscaped = historyEntry?.status === 'escaped'; // Feature V1 logic

                                    if (!isScheduled) return <td key={i} className="bg-gray-50/50"></td>;

                                    return (
                                        <td key={i} className="p-1 text-center align-middle">
                                            <button
                                                onClick={() => handleTaskClick(task, date)}
                                                disabled={!!historyEntry}
                                                className={`
                                                    w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all shadow-sm
                                                    ${isCompleted 
                                                        ? 'bg-green-100 text-green-600 border border-green-200 cursor-default' 
                                                        : isEscaped
                                                            ? 'bg-gray-200 text-gray-500 border border-gray-300 cursor-default'
                                                            : 'bg-white border-2 border-gray-300 text-gray-300 hover:border-purple-500 hover:text-purple-500 hover:shadow-md cursor-pointer'
                                                    }
                                                `}
                                                title={isCompleted ? 'Completada' : isEscaped ? 'Saltada' : 'Realizar'}
                                            >
                                                {isCompleted ? '✓' : isEscaped ? '-' : ''}
                                            </button>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                    {assignments.length === 0 && (
                        <tr>
                            <td colSpan={8} className="p-8 text-center text-gray-400 italic">
                                No tienes misiones activas.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* --- SECCIÓN SEGURIDAD (Restaurada de V1 con estilo Tailwind) --- */}
        <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-bold text-gray-700 border-b pb-2 mb-4">
                🛡️ Seguridad y Accesos
            </h3>

            {/* Gestión de PIN */}
            <div className="mb-6">
                <h4 className="text-sm font-semibold text-gray-500 mb-2">Mi PIN de Seguridad</h4>
                <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    {editingPin ? (
                        <>
                            <input 
                                type="password" maxLength={4} placeholder="PIN"
                                value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                                className="w-20 text-center p-1 border rounded focus:ring-2 focus:ring-purple-200 outline-none"
                            />
                            <button onClick={handleUpdatePin} className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600">
                                Guardar
                            </button>
                            <button onClick={() => setEditingPin(false)} className="bg-gray-300 text-gray-700 px-3 py-1 rounded text-sm hover:bg-gray-400">
                                Cancelar
                            </button>
                        </>
                    ) : (
                        <>
                            <div className="font-mono text-xl tracking-widest text-gray-800">
                                {showPin ? (patientData?.securityPin || 'Sin PIN') : '••••'}
                            </div>
                            <button onClick={() => setShowPin(!showPin)} className="text-sm text-blue-500 hover:underline">
                                {showPin ? 'Ocultar' : 'Mostrar'}
                            </button>
                            <button onClick={() => setEditingPin(true)} className="text-sm text-gray-500 hover:text-gray-700 underline">
                                Cambiar
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Lista de Profesionales */}
            <div>
                <h4 className="text-sm font-semibold text-gray-500 mb-3">Equipo de Salud Vinculado</h4>
                <div className="grid gap-3 sm:grid-cols-2">
                    {linkedProfessionals.map((prof) => (
                        <div key={prof.id} className="flex justify-between items-center p-3 bg-white rounded border border-gray-200">
                            <div>
                                <p className="font-bold text-gray-700 text-sm">{prof.fullName || 'Profesional'}</p>
                                <p className="text-xs text-purple-600">Terapeuta</p>
                            </div>
                            <button 
                                onClick={() => handleRevokeAccess(prof.id, prof.fullName)}
                                className="text-xs text-red-500 bg-red-50 hover:bg-red-100 px-2 py-1 rounded border border-red-100 transition-colors"
                            >
                                Desvincular
                            </button>
                        </div>
                    ))}
                    {linkedProfessionals.length === 0 && (
                        <p className="text-sm text-gray-400 italic">No hay profesionales vinculados.</p>
                    )}
                </div>
            </div>
        </div>

      </div>

      {/* MODAL (Sin cambios, funcional) */}
      <TaskValidationModal
        isOpen={!!selectedTask}
        taskTitle={selectedTask?.task?.staticTaskData?.title || selectedTask?.task?.title || "Misión"}
        onClose={() => setSelectedTask(null)}
        onConfirmSuccess={(rating, reflection) => handleDecision({ type: 'success', payload: { rating, reflection } })}
        onConfirmEscape={(reasonId) => handleDecision({ type: 'escape', payload: { motive: reasonId } })}
      />

    </div>
  );
}