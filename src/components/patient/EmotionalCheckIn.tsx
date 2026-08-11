// src/components/patient/EmotionalCheckIn.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AtlasCard } from './AtlasDesignSystem';

interface EmotionalCheckInProps {
  patientId: string;
}

export default function EmotionalCheckIn({ patientId }: EmotionalCheckInProps) {
  const [savingMood, setSavingMood] = useState(false);
  const [hasCheckedInToday, setHasCheckedInToday] = useState(false);

  // Mantenemos la indexación del 1 al 5 como en tu código original
  const emojis = ['😫', '😕', '😐', '🙂', '🤩'];

  useEffect(() => {
    if (!patientId) return;

    const logsRef = collection(db, 'patients', patientId, 'emotional_logs');
    // Solo traemos el último registro para saber si es de hoy
    const q = query(logsRef, orderBy('createdAt', 'desc'), limit(1));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const lastLog = snapshot.docs[0].data();
        const dateObj = lastLog.createdAt?.toDate() || new Date();
        const logDate = new Date(dateObj).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);

        setHasCheckedInToday(logDate === today);
      } else {
        setHasCheckedInToday(false);
      }
    });

    return () => unsubscribe();
  }, [patientId]);

  const handleEmotionalCheckIn = async (moodValue: number) => {
    if (!patientId || savingMood) return;
    setSavingMood(true);

    try {
      const logsRef = collection(db, 'patients', patientId, 'emotional_logs');
      await addDoc(logsRef, {
        mood: moodValue,
        note: 'Check-in rápido',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error al registrar estado emocional:', error);
      alert('Error de conexión al sincronizar métricas neurales.');
    } finally {
      setSavingMood(false);
    }
  };

  // Si ya hizo check-in, no mostramos las opciones
  if (hasCheckedInToday) {
    return (
      <AtlasCard className="border-cyan-900/30 bg-slate-800/50 flex justify-center items-center py-6">
        <p className="text-cyan-500 font-mono text-xs uppercase tracking-widest animate-pulse">
          Sincronización emocional completada por hoy
        </p>
      </AtlasCard>
    );
  }

  return (
    <AtlasCard className="border-cyan-900/30 bg-gradient-to-b from-slate-800 to-slate-900">
      <h3 className="text-sm text-slate-400 font-mono uppercase mb-4 text-center tracking-widest">
        Check-in Emocional
      </h3>
      <div className="flex justify-between px-4 sm:px-10">
        {emojis.map((emoji, index) => {
          const moodValue = index + 1;
          return (
            <button
              key={moodValue}
              disabled={savingMood}
              className="text-2xl md:text-3xl hover:scale-125 transition-transform p-2 grayscale hover:grayscale-0 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
              onClick={() => handleEmotionalCheckIn(moodValue)}
            >
              {emoji}
            </button>
          );
        })}
      </div>
    </AtlasCard>
  );
}
