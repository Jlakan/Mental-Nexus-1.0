// src/components/patient/PatientDashboard.tsx
import { useState, useEffect, useRef } from 'react';
import {
  doc,
  writeBatch,
  increment,
  serverTimestamp,
  onSnapshot,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';

import PatientDiary from './PatientDiary';
import EmotionalHistoryChart from './EmotionalHistoryChart';
import NextAppointments from './NextAppointments';
import ToastNotification from './ui/ToastNotification';
import PatientHeader from './PatientHeader';
import ActiveProtocolsList from './ActiveProtocolsList';
import TaskCompletionModal from './TaskCompletionModal';
import SupportNetwork from './SupportNetwork';

// Componentes extraídos
import DashboardLoading from './DashboardLoading';
import MissionOverlay from './MissionOverlay';
import AtlasVideoModal from './AtlasVideoModal';
import GamificationStats from './GamificationStats';
import EmotionalCheckIn from './EmotionalCheckIn';

const NEXUS_ASSETS = {
  misionAsignada:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Mision%20asignada.jpg?alt=media&token=bfd4bd7e-882a-4d5c-9a9b-f591ef50cddb',
  misionCompletada:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/missio%CC%81n%20Succes.jpg?alt=media&token=a6fa6232-e8f9-4f02-be3f-a69b25ad2bcc',
  protocoloIniciado:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Protocolo%20iniciado.jpg?alt=media&token=aa9a902c-bce7-46b1-a8fd-1bb87287a70e',
  protocoloCompletado:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Protocolo%20completado.jpg?alt=media&token=20246441-f073-430e-b3cf-9719916fc26c',
  atlas1:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_1.jpg?alt=media&token=c3e77e91-9518-4bae-adb1-f3febc1d0b76',
  atlas2:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_2.jpg?alt=media&token=54340bcb-4775-4282-9b1c-14ccc9c586e7',
  atlas3:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_3.jpg?alt=media&token=ade68626-9a61-4a18-9b48-e00480c289ec',
  atlas4:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/atlas_4.jpg?alt=media&token=e92af5f4-a586-4bec-9025-98c643d4cd1d',
  atlasVideo:
    'https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Animacio%CC%81n%20Atlas%20Vance%20primera%20etapa.mp4?alt=media&token=8bbfd688-a3c5-4be0-a71b-bec7898b26da',
};

const getWeekId = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

interface PatientDashboardProps {
  user: any;
}

export default function PatientDashboard({ user }: PatientDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [patientData, setPatientData] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [reflection, setReflection] = useState('');
  const [rating, setRating] = useState(5);
  const [submittingTask, setSubmittingTask] = useState(false);
  const [showAtlasVideo, setShowAtlasVideo] = useState(false);
  const [showAtlasModal, setShowAtlasModal] = useState(false);
  const [overlayImage, setOverlayImage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pendingTaskToOpen, setPendingTaskToOpen] = useState<any>(null);

  const overlayTimeoutRef = useRef<number | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const notifiedTasks = useRef<Set<string>>(new Set());

  // Limpieza de timeouts
  useEffect(() => {
    return () => {
      if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  // Animación del Atlas
  useEffect(() => {
    if (NEXUS_ASSETS.atlasVideo) {
      const interval = setInterval(() => {
        setShowAtlasVideo(true);
      }, 80000);
      return () => clearInterval(interval);
    }
  }, []);

  const triggerOverlay = (imageUrl: string) => {
    setOverlayImage(imageUrl);
    setPendingTaskToOpen(null);
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    overlayTimeoutRef.current = setTimeout(() => {
      setOverlayImage((current) => (current === imageUrl ? null : current));
    }, 10000);
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleCloseOverlay = () => {
    setOverlayImage(null);
    if (overlayTimeoutRef.current) clearTimeout(overlayTimeoutRef.current);
    if (pendingTaskToOpen) {
      setSelectedTask(pendingTaskToOpen);
      setPendingTaskToOpen(null);
    }
  };

  // 1. OYENTE DE DATOS DEL PACIENTE (Perfil Gamificado)
  useEffect(() => {
    if (!user) return;
    const userRef = doc(db, 'patients', user.uid);
    const unsubUser = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setPatientData(docSnap.data());
      }
    });
    return () => unsubUser();
  }, [user]);

  // 2. NUEVO OYENTE: PLAN ACTIVO (active_plans)
  useEffect(() => {
    if (!user) return;

    const planRef = doc(db, 'active_plans', user.uid);
    const unsubPlan = onSnapshot(planRef, (docSnap) => {
      if (docSnap.exists()) {
        const planData = docSnap.data();
        const tasksObj = planData.activeTasks || {};

        const parsedTasks = Object.keys(tasksObj).map((taskId) => {
          const taskData = tasksObj[taskId];

          // Notificación de tareas nuevas
          if (!taskData.hasSeenArt && !notifiedTasks.current.has(taskId)) {
            const msg =
              taskData.type === 'routine'
                ? 'Nuevos protocolos asignados'
                : 'Nueva misión asignada';
            showToast(msg);
            notifiedTasks.current.add(taskId);
          }

          return { id: taskId, ...taskData };
        });

        setTasks(parsedTasks);
      } else {
        setTasks([]);
      }
      setLoading(false);
    });

    return () => unsubPlan();
  }, [user]);

  // --- DERIVACIÓN DE ESTADÍSTICAS ---
  const currentXP =
    patientData?.gamification?.xp ||
    patientData?.gamificationProfile?.currentXp ||
    0;
  const currentLevel = Math.floor(currentXP / 100) + 1;
  const xpProgress = currentXP % 100;
  const currentGold =
    patientData?.gamification?.gold ||
    patientData?.gamificationProfile?.wallet?.gold ||
    0;
  const currentNexus =
    patientData?.gamification?.nexus ||
    patientData?.gamificationProfile?.wallet?.nexus ||
    0;
  const dbStats = patientData?.gamification?.stats || {};
  const uiStats = {
    psique: dbStats.INT || dbStats.intellect || 0,
    vitalidad: dbStats.STR || dbStats.strength || 0,
    resiliencia: dbStats.STA || dbStats.stamina || 0,
  };

  const getAtlasImage = (level: number) => {
    if (level <= 5) return NEXUS_ASSETS.atlas1;
    if (level <= 10) return NEXUS_ASSETS.atlas2;
    if (level <= 15) return NEXUS_ASSETS.atlas3;
    return NEXUS_ASSETS.atlas4;
  };

  const getTodaysTasks = () => {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // Fecha en formato YYYY-MM-DD
    const daysSpanish = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'];
    const dayKey = daysSpanish[today.getDay()];

    return tasks.filter((task: any) => {
      // 1. Filtrar completadas o inactivas
      if (task.status === 'inactive' || task.status === 'completed')
        return false;

      // 2. Si ya hizo check-in hoy, no la mostramos como pendiente
      if (task.historyChecks && task.historyChecks.includes(dateStr))
        return false;

      // 3. Filtrar por frecuencia (día de la semana) si aplica
      if (task.frequency) {
        if (Array.isArray(task.frequency)) {
          return task.frequency.includes(dayKey);
        } else if (typeof task.frequency === 'object') {
          return (
            task.frequency[dayKey] === 1 || task.frequency[dayKey] === true
          );
        }
      }
      return true;
    });
  };

  const todaysTasks = getTodaysTasks();

  // --- INTERACCIÓN CON TAREAS ---
  const handleTaskClick = async (task: any) => {
    if (!task.hasSeenArt) {
      const imgToDisplay =
        task.type === 'routine'
          ? NEXUS_ASSETS.protocoloIniciado
          : NEXUS_ASSETS.misionAsignada;
      triggerOverlay(imgToDisplay);
      setPendingTaskToOpen(task);

      try {
        const planRef = doc(db, 'active_plans', user.uid);
        await updateDoc(planRef, {
          [`activeTasks.${task.id}.hasSeenArt`]: true,
        });
      } catch (error) {
        console.error('Error actualizando vista de arte:', error);
      }
    } else {
      setSelectedTask(task);
    }
  };

  const handleCompleteTask = async () => {
    if (!selectedTask || !user) return;
    setSubmittingTask(true);

    try {
      const batch = writeBatch(db);
      const dateStr = new Date().toISOString().split('T')[0];
      const xpReward =
        selectedTask.rewards?.xp || selectedTask.staticTaskData?.xp || 10;
      const goldReward = selectedTask.rewards?.gold || 5;
      const weekId = getWeekId();

      const userRef = doc(db, 'patients', user.uid);
      const planRef = doc(db, 'active_plans', user.uid);

      // Evaluamos si con este check la tarea llega al 100%
      const newReps = (selectedTask.repsCompleted || 0) + 1;
      const isFinished =
        selectedTask.totalVolumeExpected &&
        newReps >= selectedTask.totalVolumeExpected;

      // 1. Actualizar la tarea dentro del Plan Activo
      batch.update(planRef, {
        [`activeTasks.${selectedTask.id}.repsCompleted`]: increment(1),
        [`activeTasks.${selectedTask.id}.historyChecks`]: arrayUnion(dateStr),
        // Si ya completó todas las repeticiones esperadas, cambiamos el status para que desaparezca
        [`activeTasks.${selectedTask.id}.status`]: isFinished
          ? 'completed'
          : 'in_progress',
        [`activeTasks.${selectedTask.id}.lastCompletedAt`]: serverTimestamp(),
      });

      // 2. Recompensas del Jugador
      batch.update(userRef, {
        'gamification.xp': increment(xpReward),
        'gamification.gold': increment(goldReward),
        'gamification.completedMissions': increment(1),
      });

      // 3. Bitácora Cualitativa (Para revisión del profesional en el historial clínico)
      const completionId = `${selectedTask.id}_${dateStr}`;
      const completionRef = doc(
        db,
        'patients',
        user.uid,
        'completions',
        completionId
      );
      batch.set(
        completionRef,
        {
          taskId: selectedTask.id,
          therapistId:
            selectedTask.professionalId ||
            patientData?.careTeam?.primary ||
            null,
          rating: rating,
          reflection: reflection,
          weekId: weekId,
          createdAt: serverTimestamp(),
        },
        { merge: true }
      );

      await batch.commit();

      triggerOverlay(
        selectedTask.type === 'routine'
          ? NEXUS_ASSETS.protocoloCompletado
          : NEXUS_ASSETS.misionCompletada
      );

      setSelectedTask(null);
      setReflection('');
      setRating(5);
    } catch (error) {
      console.error('Error al guardar progreso:', error);
      alert('Error de conexión al servidor neural.');
    } finally {
      setSubmittingTask(false);
    }
  };

  const handleUnlinkProfessional = async (profId: string) => {
    if (
      !window.confirm(
        '¿Seguro que deseas cortar el enlace con este especialista?'
      )
    )
      return;
    try {
      const userRef = doc(db, 'patients', user.uid);
      await updateDoc(userRef, {
        [`careTeam.${profId}.active`]: false,
      });
    } catch (e) {
      console.error(e);
      alert('Error al desvincular. Verifica tu conexión.');
    }
  };

  if (loading) return <DashboardLoading />;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 pb-20 font-sans selection:bg-cyan-500/30">
      <ToastNotification message={toastMessage} />

      {overlayImage && (
        <MissionOverlay imageUrl={overlayImage} onClose={handleCloseOverlay} />
      )}

      {showAtlasModal && (
        <AtlasVideoModal
          videoUrl={NEXUS_ASSETS.atlasVideo}
          onClose={() => setShowAtlasModal(false)}
        />
      )}

      <PatientHeader
        playerName={patientData?.fullName || 'Sujeto 01'}
        playerTitle={patientData?.gamification?.title || 'INICIADO'}
        level={currentLevel}
        xpProgress={xpProgress}
        gold={currentGold}
        nexus={currentNexus}
        avatarImage={getAtlasImage(currentLevel)}
        showVideo={showAtlasVideo && !!NEXUS_ASSETS.atlasVideo}
        videoUrl={NEXUS_ASSETS.atlasVideo}
        onAvatarClick={() => setShowAtlasModal(true)}
        onVideoEnd={() => setShowAtlasVideo(false)}
        onSignOut={() => auth.signOut()}
      />

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-3 space-y-6">
          <EmotionalHistoryChart patientId={user.uid} />
          <NextAppointments careTeam={patientData?.careTeam} />
        </div>
        <div className="xl:col-span-5 space-y-6">
          <GamificationStats stats={uiStats} />
          <EmotionalCheckIn patientId={user.uid} />
          <ActiveProtocolsList
            tasks={todaysTasks}
            onTaskClick={handleTaskClick}
          />
        </div>
        <div className="xl:col-span-4 space-y-6">
          <PatientDiary patientId={user.uid} careTeam={patientData?.careTeam} />
          <SupportNetwork
            careTeam={patientData?.careTeam}
            onUnlink={handleUnlinkProfessional}
          />
        </div>
      </main>

      <TaskCompletionModal
        task={selectedTask}
        reflection={reflection}
        rating={rating}
        isSubmitting={submittingTask}
        onClose={() => setSelectedTask(null)}
        onReflectionChange={setReflection}
        onRatingChange={setRating}
        onSubmit={handleCompleteTask}
      />
    </div>
  );
}
