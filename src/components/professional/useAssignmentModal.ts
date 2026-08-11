// src/components/professional/useAssignmentModal.ts
import { useState, useEffect } from 'react';
import {
  collection,
  getDocs,
  doc,
  getDoc,
  writeBatch,
  serverTimestamp,
  setDoc,
  increment,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { MISSION_TIERS } from '../../utils/gameRules';
import type { Assignment } from '../../utils/ClinicalEngine';

export function useAssignmentModal(
  isOpen: boolean,
  onClose: () => void,
  patientId: string,
  professionalId: string,
  userProfessionId?: string,
  taskToEdit?: Assignment
) {
  // --- ESTADOS UI Y FORMULARIO ---
  const [activeTab, setActiveTab] = useState<'custom' | 'catalog'>('custom');
  const [missionType, setMissionType] = useState<'one-off' | 'daily'>(
    'one-off'
  );
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('EASY');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [durationWeeks, setDurationWeeks] = useState<number>(1);

  // --- DATOS DE CATÁLOGO ---
  const [profNameDisplay, setProfNameDisplay] = useState('');
  const [cats, setCats] = useState<any[]>([]);
  const [subCats, setSubCats] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [selCat, setSelCat] = useState('');
  const [selSubCat, setSelSubCat] = useState('');
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(
    null
  );
  const [currentStats, setCurrentStats] = useState<any | null>(null);

  // --- CARGA INICIAL Y MODO EDICIÓN ---
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        setTitle(taskToEdit.title || '');
        setDesc((taskToEdit as any)?.customInstructions || '');
        setMissionType(taskToEdit.type === 'routine' ? 'daily' : 'one-off');
        setSelectedDays(
          taskToEdit.frequency ? Object.keys(taskToEdit.frequency) : []
        );
        setDurationWeeks(
          taskToEdit.totalVolumeExpected && taskToEdit.frequency
            ? Math.ceil(
                taskToEdit.totalVolumeExpected /
                  Object.keys(taskToEdit.frequency).length
              )
            : 1
        );
        setSelectedTier(taskToEdit.staticTaskData?.difficulty || 'EASY');
        setActiveTab('custom');
        setSelectedCatalogId(taskToEdit.catalogId || null);
        setCurrentStats(null);
      } else {
        resetForm();
      }
    }
  }, [isOpen, taskToEdit]);

  const resetForm = () => {
    setTitle('');
    setDesc('');
    setMissionType('one-off');
    setSelectedDays([]);
    setDurationWeeks(1);
    setSelectedTier('EASY');
    setActiveTab('custom');
    setSelectedCatalogId(null);
    setCurrentStats(null);
  };

  // --- EFECTOS DE CATÁLOGO ---
  useEffect(() => {
    if (isOpen && activeTab === 'catalog' && userProfessionId) {
      getDoc(doc(db, 'professions', userProfessionId)).then((d) =>
        setProfNameDisplay(d.exists() ? d.data().name : userProfessionId)
      );
      getDocs(
        collection(db, 'professions', userProfessionId, 'categories')
      ).then((s) => setCats(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    }
  }, [isOpen, activeTab, userProfessionId]);

  useEffect(() => {
    if (selCat && userProfessionId) {
      getDocs(
        collection(
          db,
          'professions',
          userProfessionId,
          'categories',
          selCat,
          'subcategories'
        )
      ).then((s) => setSubCats(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
      setSelSubCat('');
      setTasks([]);
    }
  }, [selCat, userProfessionId]);

  useEffect(() => {
    if (selSubCat && userProfessionId) {
      const colName =
        missionType === 'daily' ? 'catalog_routines' : 'catalog_missions';
      getDocs(
        collection(
          db,
          'professions',
          userProfessionId,
          'categories',
          selCat,
          'subcategories',
          selSubCat,
          colName
        )
      ).then((s) => setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() }))));
    }
  }, [selSubCat, missionType, userProfessionId]);

  const handleSelectCatalogTask = async (taskId: string) => {
    const t = tasks.find((x) => x.id === taskId);
    if (!t) return;
    setTitle(t.title || '');
    setDesc(t.description || '');
    if (missionType !== 'daily') setSelectedTier(t.tier || 'EASY');
    setSelectedCatalogId(taskId);

    try {
      const myStatsSnap = await getDoc(
        doc(db, 'professionals', professionalId, 'personal_task_stats', taskId)
      );
      setCurrentStats({
        personalAssigned: myStatsSnap.exists()
          ? myStatsSnap.data().assigned
          : 0,
        personalVolume: myStatsSnap.exists()
          ? myStatsSnap.data().volumeAssigned
          : 0,
        personalCompleted: myStatsSnap.exists()
          ? myStatsSnap.data().completed
          : 0,
        globalAssigned: t.stats?.globalAssigned || 0,
      });
    } catch (e) {
      console.error(e);
    }
  };

  // --- NUEVA LÓGICA DE GUARDADO ---
  const handleAssign = async () => {
    if (!title) return alert('Falta título');
    if (missionType === 'daily' && selectedDays.length === 0)
      return alert('Elige días');

    setSaving(true);
    try {
      const batch = writeBatch(db);
      const tierData = MISSION_TIERS[selectedTier] || MISSION_TIERS['EASY'];
      const currentVolume =
        missionType === 'daily' ? selectedDays.length * durationWeeks : 1;

      const frequencyMap: { [key: string]: number } = {};
      selectedDays.forEach((d) => (frequencyMap[d] = 1));

      const categoryName =
        activeTab === 'catalog'
          ? cats.find((c) => c.id === selCat)?.name || 'Catálogo'
          : 'Personalizado';

      // Generamos un ID único si es una tarea nueva
      const taskId = taskToEdit
        ? taskToEdit.id
        : doc(collection(db, 'temp')).id;
      const planRef = doc(db, 'active_plans', patientId);

      const taskPayload = {
        id: taskId,
        patientId,
        professionalId,
        title,
        customInstructions: desc,
        type: missionType === 'daily' ? 'routine' : 'one_time',
        status: 'in_progress', // En la nueva arquitectura iniciamos en progreso
        catalogId: activeTab === 'catalog' ? selectedCatalogId || null : null,
        durationWeeks: missionType === 'daily' ? durationWeeks : null,
        totalVolumeExpected: currentVolume,
        repsCompleted: taskToEdit ? (taskToEdit as any).repsCompleted || 0 : 0, // Mantenemos el progreso si es edición
        historyChecks: taskToEdit
          ? (taskToEdit as any).historyChecks || []
          : [],
        frequency: missionType === 'daily' ? frequencyMap : null,
        staticTaskData: {
          originalTitle: title,
          category: categoryName,
          difficulty: selectedTier,
          estimatedLoad: tierData.stats || 3,
        },
        rewards: { xp: tierData.xp, gold: tierData.gold },
        assignedAt: taskToEdit ? taskToEdit.assignedAt : serverTimestamp(),
      };

      // 1. Guardar en el Plan Activo usando setDoc con merge
      // Esto crea el documento si no existe, o actualiza solo esta tarea si ya existe.
      batch.set(
        planRef,
        { activeTasks: { [taskId]: taskPayload } },
        { merge: true }
      );

      // 2. Si es una tarea manual NUEVA, enviarla a revisión (Curación)
      if (activeTab === 'custom' && !taskToEdit) {
        const templateRef = doc(collection(db, 'proposed_templates'));
        batch.set(templateRef, {
          title,
          instructions: desc,
          type: missionType === 'daily' ? 'routine' : 'one_time',
          authorId: professionalId,
          status: 'pending_review',
          createdAt: serverTimestamp(),
        });
      }

      // 3. Actualizar Contadores Locales si es de catálogo (Opcional, pero lo mantenemos para tus stats)
      if (selectedCatalogId && activeTab === 'catalog' && !taskToEdit) {
        const personalStatsRef = doc(
          db,
          'professionals',
          professionalId,
          'personal_task_stats',
          selectedCatalogId
        );
        batch.set(
          personalStatsRef,
          {
            title: title,
            assigned: increment(1),
            volumeAssigned: increment(currentVolume),
            lastAssignedAt: serverTimestamp(),
          },
          { merge: true }
        );
      }

      await batch.commit();
      onClose();
      resetForm();
    } catch (e: any) {
      console.error(e);
      alert('Error guardando: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  return {
    state: {
      activeTab,
      missionType,
      saving,
      title,
      desc,
      selectedTier,
      selectedDays,
      durationWeeks,
      profNameDisplay,
      cats,
      subCats,
      tasks,
      selCat,
      selSubCat,
      currentStats,
    },
    actions: {
      setActiveTab,
      setMissionType,
      setTitle,
      setDesc,
      setSelectedTier,
      setSelectedDays,
      setDurationWeeks,
      setSelCat,
      setSelSubCat,
      handleSelectCatalogTask,
      handleAssign,
    },
  };
}
