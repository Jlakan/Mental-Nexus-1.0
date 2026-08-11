import { useState, useEffect, useCallback } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { WorkConfig } from '../../utils/agendaTypes';

// Temas definidos para la atmósfera Solarpunk/Medical
export const THEME_STYLES = {
  'nexus-original': {
    '--bg-main': '#0f172a',
    '--bg-card': '#1e293b',
    '--text-main': '#f8fafc',
    '--accent': '#22d3ee', // Cian
    '--highlight': '#f59e0b', // Ámbar
  },
  'soft-medical': {
    '--bg-main': '#f3f4f6',
    '--bg-card': '#ffffff',
    '--text-main': '#1f2937',
    '--accent': '#673AB7', // Violeta
    '--highlight': '#ec4899',
  },
};

interface UseAgendaContextProps {
  currentUserId: string;
  userRole: 'professional' | 'assistant' | string;
  initialDoctorId?: string;
}

export const useAgendaContext = ({
  currentUserId,
  userRole,
  initialDoctorId,
}: UseAgendaContextProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState(
    localStorage.getItem('agenda-theme') || 'nexus-original'
  );
  const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(
    initialDoctorId || currentUserId
  );
  const [workConfig, setWorkConfig] = useState<WorkConfig | null>(null);

  // 1. Detección de dispositivo (Responsive)
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Inyección de Temas
  useEffect(() => {
    const styles =
      THEME_STYLES[theme as keyof typeof THEME_STYLES] ||
      THEME_STYLES['nexus-original'];
    const root = document.documentElement;
    Object.entries(styles).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
    localStorage.setItem('agenda-theme', theme);
  }, [theme]);

  // 3. Carga de Contexto (Lógica Firestore)
  const loadContext = useCallback(async () => {
    if (!currentUserId) return;

    try {
      setLoading(true);
      setError(null);

      if (userRole === 'professional') {
        const docRef = doc(db, 'professionals', currentUserId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setWorkConfig(data.workConfig || data.agendaSettings);
          setMyProfessionals([{ id: currentUserId, ...data }]);
          setSelectedDoctorId(currentUserId);
        }
      } else {
        // Lógica para Asistentes
        const q = query(
          collection(db, 'professionals'),
          where('authorizedAssistants', 'array-contains', currentUserId)
        );
        const querySnap = await getDocs(q);
        const docs = querySnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMyProfessionals(docs);

        const activeId = selectedDoctorId || docs[0]?.id;
        if (activeId) {
          const docRef = doc(db, 'professionals', activeId);
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const data = snap.data();
            setWorkConfig(data.workConfig || data.agendaSettings);
          }
        }
      }
    } catch (err) {
      console.error('Error en useAgendaContext:', err);
      setError('No se pudo cargar la configuración de la agenda.');
    } finally {
      setLoading(false);
    }
  }, [currentUserId, userRole, selectedDoctorId]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return {
    loading,
    error,
    isMobile,
    theme,
    setTheme,
    myProfessionals,
    selectedDoctorId,
    setSelectedDoctorId,
    workConfig,
    setWorkConfig,
    reloadContext: loadContext,
  };
};

export default useAgendaContext;
