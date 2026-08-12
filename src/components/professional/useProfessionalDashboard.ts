// src/components/professional/useProfessionalDashboard.ts
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  documentId,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { ProfessionalData } from './DashboardHeader';

// Importamos el motor centralizado
import { usePatientsIndex } from './usePatientsIndex';

export function useProfessionalDashboard(user: any) {
  // ESTADOS DE DATOS
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [assistants, setAssistants] = useState<any[]>([]);
  const [profData, setProfData] = useState<ProfessionalData | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientTasks, setPatientTasks] = useState<any[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // ESTADOS DE INTERFAZ (UI) QUE FALTABAN
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFinancePanelOpen, setIsFinancePanelOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<any>(null);
  const [taskForHistory, setTaskForHistory] = useState<any>(null);

  // INYECCIÓN DEL ÍNDICE
  const indexManager = usePatientsIndex(user?.uid);

  const loadDashboardConfig = useCallback(async () => {
    if (!user?.uid) return;
    setLoadingConfig(true);
    try {
      const profRef = doc(db, 'professionals', user.uid);
      const profSnap = await getDoc(profRef);

      if (profSnap.exists()) {
        const data = profSnap.data() as ProfessionalData;
        setProfData(data);

        if (data.authorizedAssistants && data.authorizedAssistants.length > 0) {
          const qAssist = query(
            collection(db, 'assistants'),
            where(documentId(), 'in', data.authorizedAssistants)
          );
          const snapAssist = await getDocs(qAssist);
          setAssistants(
            snapAssist.docs.map((d) => ({ uid: d.id, ...d.data() }))
          );
        }
      }
    } catch (e) {
      console.error('Error cargando configuración del dashboard:', e);
    } finally {
      setLoadingConfig(false);
    }
  }, [user?.uid]);

  useEffect(() => {
    loadDashboardConfig();
  }, [loadDashboardConfig]);

  const loadPatientTasks = async (patientId: string) => {
    try {
      const planRef = doc(db, 'active_plans', patientId);
      const planSnap = await getDoc(planRef);

      if (planSnap.exists()) {
        const planData = planSnap.data();
        const tasksObj = planData.activeTasks || {};
        const tasksArray = Object.keys(tasksObj)
          .map((taskId) => ({ id: taskId, ...tasksObj[taskId] }))
          .filter((t) => t.professionalId === user.uid);

        setPatientTasks(
          tasksArray.sort(
            (a, b) =>
              (b.assignedAt?.toMillis?.() || 0) -
              (a.assignedAt?.toMillis?.() || 0)
          )
        );
      } else {
        setPatientTasks([]);
      }
    } catch (e) {
      console.error('Error cargando tareas del plan:', e);
      setPatientTasks([]);
    }
  };

  const handleNavigate = (view: View) => {
    setActiveView(view);
    if (view === 'patients_manage') setSelectedPatient(null);
  };

  const handleOpenPatient = async (patientIndexData: any) => {
    try {
      const fullPatientDoc = await getDoc(
        doc(db, 'patients', patientIndexData.id)
      );

      let patientData: any = { id: patientIndexData.id };

      if (fullPatientDoc.exists()) {
        patientData = { ...patientData, ...fullPatientDoc.data() };
      } else {
        patientData = { ...patientData, ...patientIndexData };
      }

      // --- NUEVA LECTURA DE TAGS BLINDADOS ---
      // Consultamos el documento privado del profesional en la subcolección
      if (user?.uid) {
        const tagsDocRef = doc(
          db,
          'patients',
          patientIndexData.id,
          'professionalTags',
          user.uid
        );
        const tagsSnap = await getDoc(tagsDocRef);

        if (tagsSnap.exists()) {
          // Si el documento existe (porque migramos o creamos tags nuevos), lo inyectamos
          patientData.clinicalTags = tagsSnap.data().tags || [];
        } else {
          // Si el paciente es nuevo o el profesional no le ha asignado tags
          patientData.clinicalTags = [];
        }
      }
      // ---------------------------------------

      setSelectedPatient(patientData);
      setActiveView('patient_detail');
      await loadPatientTasks(patientIndexData.id);
    } catch (e) {
      console.error('Error abriendo expediente completo:', e);
      alert('Hubo un error al abrir el expediente completo del paciente.');
    }
  };

  return {
    state: {
      activeView,
      assistants,
      activePatients: indexManager.patients,
      profData,
      selectedPatient,
      patientTasks,
      loading: loadingConfig || indexManager.loading,
      isSidebarOpen,
      isFinancePanelOpen,
      isAssignmentModalOpen,
      isHistoryOpen,
      taskToEdit,
      taskForHistory,
    },
    actions: {
      setActiveView,
      setSelectedPatient,
      setIsSidebarOpen,
      setIsFinancePanelOpen,
      setIsAssignmentModalOpen,
      setIsHistoryOpen,
      setTaskToEdit,
      setTaskForHistory,
      handleNavigate,
      handleOpenPatient,
      loadPatientTasks,
      setProfData,
      handleManualMergeProfiles: indexManager.handleManualMergeProfiles,
    },
  };
}
