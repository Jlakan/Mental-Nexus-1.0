// src/components/PatientDashboard.tsx
import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs,
  updateDoc, increment, deleteField, serverTimestamp,
  writeBatch // <--- 1. AGREGADO: Importamos writeBatch
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
  const [patientData, setPatientData] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<{ task: Assignment, dateStr: string } | null>(null);
  const [weekDates] = useState(getCurrentWeekDates());
  const [linkedProfessionals, setLinkedProfessionals] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadData = async () => {
      setLoading(true);
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setPatientData(userSnap.data());
          if (userSnap.data().permissions) {
            const perms = userSnap.data().permissions;
            const proIds = Object.keys(perms);
            const proPromises = proIds.map(pid => getDoc(doc(db, "users", pid)));
            const proSnaps = await Promise.all(proPromises);
            const pros = proSnaps.map(s => ({ id: s.id, ...s.data() }));
            setLinkedProfessionals(pros);
          }
        }
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

  const handleTaskClick = (task: Assignment, date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    const history = (task.completionHistory as any) || {};
    
    if (history[dateStr]) {
      alert("¡Ya completaste esta misión hoy!");
      return;
    }
    setSelectedTask({ task, dateStr });
  };

  const handleDecision = async (decision: { type: 'success' | 'escape', payload?: any }) => {
    if (!selectedTask || !user) return;

    const { task, dateStr } = selectedTask;
    const taskRef = doc(db, "users", user.uid, "assignments", task.id);
    const userRef = doc(db, "users", user.uid);

    try {
      // 2. CORREGIDO: Usamos writeBatch(db) en lugar de db.batch()
      const batch = writeBatch(db); 

      if (decision.type === 'success') {
        batch.update(taskRef, {
          [`completionHistory.${dateStr}`]: {
            completedAt: new Date().toISOString(),
            rating: decision.payload.rating,
            reflection: decision.payload.reflection,
            status: 'completed'
          },
          lastCompletedAt: serverTimestamp()
        });

        const xpReward = task.staticTaskData?.xp || 10;
        const goldReward = task.staticTaskData?.gold || 5;

        batch.update(userRef, {
          "gamification.xp": increment(xpReward),
          "gamification.gold": increment(goldReward),
          "gamification.completedMissions": increment(1)
        });

        if (task.staticTaskData?.stats) {
             const statKey = `gamification.stats.${task.staticTaskData.stats}`; 
             batch.update(userRef, { [statKey]: increment(1) });
        }

      } else {
        console.log("Escape usado:", decision.payload.motive);
      }

      await batch.commit();
      
      setPatientData((prev: any) => ({
        ...prev,
        gamification: {
            ...prev?.gamification,
            xp: (prev?.gamification?.xp || 0) + (decision.type === 'success' ? (task.staticTaskData?.xp || 10) : 0)
        }
      }));

      setSelectedTask(null);
      window.location.reload(); 

    } catch (error) {
      console.error("Error guardando progreso:", error);
      alert("Error guardando progreso");
    }
  };

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
        console.error(e);
        alert("Error al revocar");
    }
  };

  const currentXp = patientData?.gamification?.xp || 0;
  const levelInfo = calculateLevel(currentXp);
  const currentStats = patientData?.gamification?.stats || { STR: 0, INT: 0, STA: 0, DEX: 0 };

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando tu aventura...</div>;

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-20">
      
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center mb-6">
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
        
        <PlayerStatusCard 
            level={levelInfo.level}
            currentXp={levelInfo.currentLevelXp}
            requiredXp={levelInfo.requiredXp}
            progressPercent={levelInfo.progressPercent}
            stats={currentStats}
        />

        <h3 className="text-lg font-bold text-gray-700 mb-4 flex items-center gap-2">
            <span>📅</span> Misiones de la Semana
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
                                    <div className="text-xs text-gray-400 truncate max-w-[150px]">
                                        {isRoutine ? 'Rutina Diaria' : 'Misión Única'}
                                    </div>
                                </td>
                                
                                {weekDates.map((date, i) => {
                                    const dayKey = getDayKey(date);
                                    const isScheduled = isRoutine ? frequency[dayKey] : true; 
                                    
                                    const dateStr = date.toISOString().split('T')[0];
                                    const completedData = (task.completionHistory as any)?.[dateStr];
                                    const isCompleted = !!completedData;

                                    if (!isScheduled) {
                                        return <td key={i} className="bg-gray-50"></td>;
                                    }

                                    return (
                                        <td key={i} className="p-1 text-center align-middle">
                                            <button
                                                onClick={() => handleTaskClick(task, date)}
                                                disabled={isCompleted}
                                                className={`
                                                    w-8 h-8 rounded-full flex items-center justify-center text-sm transition-all shadow-sm
                                                    ${isCompleted 
                                                        ? 'bg-green-100 text-green-600 border border-green-200 cursor-default' 
                                                        : 'bg-white border-2 border-gray-300 text-gray-300 hover:border-purple-500 hover:text-purple-500 hover:shadow-md cursor-pointer'
                                                    }
                                                `}
                                                title={isCompleted ? '¡Completada!' : 'Click para completar'}
                                            >
                                                {isCompleted ? '✓' : ''}
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
                                No tienes misiones activas por ahora. ¡Descansa! 💤
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        <div className="mt-10 mb-10 border-t border-gray-200 pt-6">
            <h4 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Tu Equipo de Salud</h4>
            <div className="grid gap-4 sm:grid-cols-2">
                {linkedProfessionals.map((prof) => (
                    <div key={prof.id} className="flex justify-between items-center p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                        <div>
                            <p className="font-bold text-gray-700 text-sm">{prof.fullName || 'Profesional'}</p>
                            <p className="text-xs text-purple-600 font-medium">Psicólogo / Terapeuta</p>
                        </div>
                        <button 
                            onClick={() => handleRevokeAccess(prof.id, prof.fullName)}
                            className="text-xs text-red-500 hover:bg-red-50 px-3 py-1 rounded border border-transparent hover:border-red-100 transition-all"
                        >
                            Desvincular
                        </button>
                    </div>
                ))}
                {linkedProfessionals.length === 0 && (
                    <p className="text-sm text-gray-400">No estás vinculado a ningún profesional aún.</p>
                )}
            </div>
        </div>

      </div>

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