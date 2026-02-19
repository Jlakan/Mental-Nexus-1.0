import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs,
  setDoc, updateDoc, writeBatch, arrayUnion, orderBy, deleteDoc, addDoc, serverTimestamp, deleteField, increment
} from "firebase/firestore";
// Ajuste de ruta: subimos dos niveles para llegar a services
import { db } from '../../services/firebase';

// Ajuste de ruta: subimos un nivel para componentes hermanos
import PatientSelector from '../PatientSelector';
import AgendaConfigModal from '../AgendaConfigModal';

// Ajuste de ruta: subimos dos niveles para utils
import { generateMonthSkeleton } from '../../utils/agendaGenerator';
import type { MonthlySlotMap, WorkConfig, AgendaSlot } from '../../utils/agendaTypes';

// Importamos los NUEVOS sub-componentes
import AgendaSidebar from './AgendaSidebar';
import AppointmentForm from './AppointmentForm';

import dayjs from 'dayjs';
import 'dayjs/locale/es';
import updateLocale from 'dayjs/plugin/updateLocale';

// CONFIGURACIÓN DAYJS
dayjs.extend(updateLocale);
dayjs.locale('es');
dayjs.updateLocale('es', { weekStart: 0 });

interface Props {
  userRole: 'professional' | 'assistant';
  currentUserId: string;
  onBack?: () => void;
  doctorId?: string;
}

interface AnnualEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: any;
}

interface ConflictItem {
  slotKey: string;
  date: Date;
  slotData: AgendaSlot;
  monthDocId: string;
}

const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];
const MONTHS_LIST = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const currentYear = new Date().getFullYear();
const YEARS_LIST = Array.from({length: 7}, (_, i) => currentYear - 1 + i);

const DEFAULT_CONFIG: WorkConfig = {
  durationMinutes: 50,
  defaultPrice: 500,
  schedule: {
    1: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    2: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    3: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    4: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    5: { active: true, ranges: [{ start: "09:00", end: "14:00" }] },
    6: { active: true, ranges: [{ start: "10:00", end: "14:00" }] },
    0: { active: false, ranges: [] }
  }
};

const getCalendarGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayIndex = firstDay.getDay();

  const grid = [];
  for (let i = 0; i < startDayIndex; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
  return grid;
};

const getDateFromSlotKey = (slotKey: string, year: number, month: number): Date => {
  const [dayStr, timeStr] = slotKey.split('_');
  const day = parseInt(dayStr);
  const h = parseInt(timeStr.substring(0, 2));
  const m = parseInt(timeStr.substring(2));
  return new Date(year, month, day, h, m);
};

export default function AgendaMain({ userRole, currentUserId, onBack, doctorId }: Props) {
  // --- RESPONSIVE STATE ---
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // --- CONTEXTO ---
  const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>(doctorId || '');

  // --- DATOS AGENDA ---
  const [currentMonthData, setCurrentMonthData] = useState<MonthlySlotMap | null>(null);
  const [isMonthInitialized, setIsMonthInitialized] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);

  // --- META MENSUAL ---
  const [monthGoal, setMonthGoal] = useState<string>('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // --- LISTAS AUXILIARES ---
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [patientsNeedingAppt, setPatientsNeedingAppt] = useState<any[]>([]);
  const [annualEvents, setAnnualEvents] = useState<AnnualEvent[]>([]);

  // --- UI STATE & CONFIG ---
  const [workConfig, setWorkConfig] = useState<WorkConfig>(DEFAULT_CONFIG);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [activeSidePanel, setActiveSidePanel] = useState<'none' | 'needing' | 'waitlist'>('none');

  // --- NUEVOS ESTADOS: PAUSADOS ---
  const [isPausedSidebarOpen, setIsPausedSidebarOpen] = useState(false);
  const [pausedList, setPausedList] = useState<any[]>([]);

  // --- MODALES ---
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDayViewOpen, setIsDayViewOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWaitlistFormOpen, setIsWaitlistFormOpen] = useState(false);
  const [isWaitlistSelectorOpen, setIsWaitlistSelectorOpen] = useState(false);
  const [isEventsManagerOpen, setIsEventsManagerOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);

  // --- CONFLICT RESOLUTION STATE ---
  const [conflictList, setConflictList] = useState<ConflictItem[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingEventSave, setPendingEventSave] = useState<{start: dayjs.Dayjs, end: dayjs.Dayjs, title: string, isEdit: boolean} | null>(null);

  // Modal de Confirmación
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
    isOpen: false, title: '', message: '', onConfirm: () => {}
  });

  const [slotToReassign, setSlotToReassign] = useState<string | null>(null);
  const [targetSlotKey, setTargetSlotKey] = useState<string | null>(null);

  // Edit Event State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [originalEventData, setOriginalEventData] = useState<AnnualEvent | null>(null);
  const [newEventData, setNewEventData] = useState<{start: dayjs.Dayjs, end: dayjs.Dayjs, title: string}>({
    start: dayjs(), end: dayjs(), title: ''
  });

  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    patientExternalPhone: '',
    patientExternalEmail: '',
    price: 500,
    adminNotes: '',
    paymentStatus: 'pending',
    paymentMethod: 'cash'
  });

  const [savePricePreference, setSavePricePreference] = useState(false);
  const [selectedPatientNoShows, setSelectedPatientNoShows] = useState<number>(0);

  // --- DETECTOR DE MÓVIL (HOOK) ---
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setShowMobileSidebar(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if(isNewEventModalOpen && !editingEventId) {
      setNewEventData(prev => ({
        ...prev,
        start: dayjs(selectedDate).startOf('month'),
        end: dayjs(selectedDate).endOf('month'),
        title: ''
      }));
    }
  }, [isNewEventModalOpen, editingEventId]);

  // CARGA INICIAL
  useEffect(() => {
    const loadContext = async () => {
      try {
        if (userRole === 'professional') {
          const docSnap = await getDoc(doc(db, "professionals", currentUserId));
          const selfData = { id: currentUserId, ...docSnap.data() };
          if ((selfData as any).agendaSettings) setWorkConfig((selfData as any).agendaSettings);
          setMyProfessionals([selfData]);
          setSelectedProfId(currentUserId);
        } else {
          const q = query(collection(db, "professionals"), where("authorizedAssistants", "array-contains", currentUserId));
          const snap = await getDocs(q);
          const pros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setMyProfessionals(pros);
          if (pros.length > 0) {
            if (doctorId && pros.some(p => p.id === doctorId)) {
                setSelectedProfId(doctorId);
                const targetPro = pros.find(p => p.id === doctorId);
                if ((targetPro as any).agendaSettings) setWorkConfig((targetPro as any).agendaSettings);
            } else {
                setSelectedProfId(pros[0].id);
                if ((pros[0] as any).agendaSettings) setWorkConfig((pros[0] as any).agendaSettings);
            }
          }
        }
      } catch (e) { console.error(e); }
    };
    loadContext();
  }, [currentUserId, userRole, doctorId]);

  // 1. Cargar datos de la agenda (mes, espera, eventos) - SEPARADO
  useEffect(() => {
    if (!selectedProfId) return;
    loadMonthDoc();
    loadWaitlist();
    loadAnnualEvents();
  }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

  // 2. Cargar pacientes - SEPARADO para arreglar el bug de los Asistentes
  useEffect(() => {
    if (!selectedProfId || myProfessionals.length === 0) return;
    loadPatients();
  }, [selectedProfId, myProfessionals]);

  useEffect(() => {
    if (patients.length > 0 && selectedProfId) {
      const now = new Date();
      const pending = patients.filter(p => {
        const teamData = p.careTeam?.[selectedProfId];
        if (!teamData || teamData.status !== 'active') return false;
        if (!teamData.nextAppointment) return true;
        const apptDate = new Date(teamData.nextAppointment);
        return apptDate < now;
      });
      setPatientsNeedingAppt(pending);
      if (isPausedSidebarOpen) { fetchPausedPatients(); }
    }
  }, [patients, selectedProfId]);

  // --- LÓGICA DE DATOS ---

  const fetchPausedPatients = async () => {
      if (patients.length > 0 && selectedProfId) {
          const paused = patients.filter(p => {
              const teamData = p.careTeam?.[selectedProfId];
              return teamData && teamData.status === 'inactive';
          });
          setPausedList(paused);
      } else { setPausedList([]); }
  };

  const handleOpenPausedSidebar = () => {
      setActiveSidePanel('none');
      setIsPausedSidebarOpen(true);
      fetchPausedPatients();
      if (isMobile) setShowMobileSidebar(true);
  };

  const handleReactivatePatient = async (patientId: string, patientName: string) => {
      if (!window.confirm(`¿Reactivar a ${patientName}?\n\nEl paciente volverá a estar activo y podrás agendarle citas.`)) return;
      setLoading(true);
      try {
          const patientRef = doc(db, "patients", patientId);
          await updateDoc(patientRef, {
              [`careTeam.${selectedProfId}.status`]: 'active',
              [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
          });
          alert(`✅ ${patientName} ha sido reactivado.`);
          await loadPatients();
          setPausedList(prev => prev.filter(p => p.id !== patientId));
      } catch (e) { console.error("Error reactivando:", e); alert("Error al reactivar el paciente."); } finally { setLoading(false); }
  };

  const loadMonthDoc = async () => {
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const docSnap = await getDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId));
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentMonthData(data.slots);
        setMonthGoal(data.monthGoal || '');
        setIsMonthInitialized(true);
      } else {
        setCurrentMonthData(null);
        setMonthGoal('');
        setIsMonthInitialized(false);
      }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const loadAnnualEvents = async () => {
    try {
      const q = query(collection(db, "professionals", selectedProfId, "annualEvents"), orderBy("startDate", "asc"));
      const snap = await getDocs(q);
      setAnnualEvents(snap.docs.map(d => ({ id: d.id, ...d.data() } as AnnualEvent)));
    } catch(e) { console.error("Error loading events", e); }
  };

  const loadPatients = async () => {
    const profRef = myProfessionals.find(p => p.id === selectedProfId);
    if(profRef?.professionalCode) {
      const qLinked = query(collection(db, "patients"), where("linkedProfessionalCode", "==", profRef.professionalCode));
      const snapLinked = await getDocs(qLinked);
      const qManual = query(collection(db, "patients"), where("linkedProfessionalId", "==", selectedProfId), where("isManual", "==", true));
      const snapManual = await getDocs(qManual);
      const allPats = [...snapLinked.docs.map(d => ({id: d.id, ...d.data()})), ...snapManual.docs.map(d => ({id: d.id, ...d.data()}))];
      const uniquePats = Array.from(new Map(allPats.map(item => [item.id, item])).values());
      setPatients(uniquePats);
    }
  };

  const loadWaitlist = async () => {
    try {
      const q = query(collection(db, "waitlist"), where("professionalId", "==", selectedProfId), orderBy("createdAt", "asc"));
      const snap = await getDocs(q);
      setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const handleDeleteWaitlistItem = async (id: string) => {
    if(!window.confirm("¿Borrar de la lista?")) return;
    try {
        await deleteDoc(doc(db, "waitlist", id));
        loadWaitlist();
    } catch(e) { console.error(e); }
  };

  const handleSaveGoal = async () => {
    if(!selectedProfId || !isMonthInitialized) return;
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { monthGoal: monthGoal });
      setIsEditingGoal(false);
    } catch(e) { console.error(e); }
  };

  const handleArchivePatient = (patientId: string, patientName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Pausar Paciente',
      message: `¿Deseas pausar el seguimiento de ${patientName}?\nDejará de aparecer en las alertas.`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateDoc(doc(db, "patients", patientId), {
            [`careTeam.${selectedProfId}.status`]: 'inactive',
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
          });
          loadPatients();
          setConfirmModal(prev => ({...prev, isOpen: false}));
        } catch(e) { console.error(e); } finally { setLoading(false); }
      }
    });
  };

  // --- GESTIÓN DE EVENTOS (Simplificado) ---
  const detectConflicts = async (start: dayjs.Dayjs, end: dayjs.Dayjs): Promise<ConflictItem[]> => {
    const startMs = start.toDate().getTime();
    const endMs = end.toDate().getTime();
    const conflicts: ConflictItem[] = [];
    let currentIter = start.clone().startOf('month');
    const endIter = end.clone().startOf('month');
    while (currentIter.isBefore(endIter) || currentIter.isSame(endIter, 'month')) {
      const year = currentIter.year();
      const month = currentIter.month();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const docSnap = await getDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId));
      if (docSnap.exists()) {
        const slots = docSnap.data().slots || {};
        Object.entries(slots).forEach(([key, slot]: [string, any]) => {
          const slotDate = getDateFromSlotKey(key, year, month);
          const slotMs = slotDate.getTime();
          if (slotMs >= startMs && slotMs <= endMs) {
            if (slot.status === 'booked') {
              conflicts.push({ slotKey: key, date: slotDate, slotData: slot, monthDocId });
            }
          }
        });
      }
      currentIter = currentIter.add(1, 'month');
    }
    return conflicts;
  };

  const updateSlotsForEvent = async (batch: any, start: dayjs.Dayjs, end: dayjs.Dayjs, type: 'block' | 'release', reason?: string) => {
    const startMs = start.toDate().getTime();
    const endMs = end.toDate().getTime();
    let currentIter = start.clone().startOf('month');
    const endIter = end.clone().startOf('month');
    while (currentIter.isBefore(endIter) || currentIter.isSame(endIter, 'month')) {
      const year = currentIter.year();
      const month = currentIter.month();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      const docSnap = await getDoc(agendaRef);
      if (docSnap.exists()) {
        const slots = docSnap.data().slots || {};
        const updates: any = {};
        let hasUpdates = false;
        Object.entries(slots).forEach(([key, slot]: [string, any]) => {
          const slotDate = getDateFromSlotKey(key, year, month);
          const slotMs = slotDate.getTime();
          const isInside = slotMs >= startMs && slotMs <= endMs;
          if (isInside) {
            if (type === 'block' && slot.status === 'available') {
              updates[`slots.${key}`] = { ...slot, status: 'blocked', adminNotes: reason, price: 0 };
              hasUpdates = true;
            } else if (type === 'release' && (slot.status === 'blocked' || slot.status === 'available')) {
              updates[`slots.${key}`] = {
                status: 'available',
                time: slot.time,
                duration: workConfig.durationMinutes,
                price: workConfig.defaultPrice
              };
              hasUpdates = true;
            }
          }
        });
        if (hasUpdates) batch.update(agendaRef, updates);
      }
      currentIter = currentIter.add(1, 'month');
    }
  };

  const finalizeEventSave = async () => {
    if (!pendingEventSave) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const { start, end, title, isEdit } = pendingEventSave;
      if (isEdit && originalEventData) {
        const oldStart = dayjs(originalEventData.startDate);
        const oldEnd = dayjs(originalEventData.endDate);
        await updateSlotsForEvent(batch, oldStart, oldEnd, 'release');
        batch.update(doc(db, "professionals", selectedProfId, "annualEvents", editingEventId!), {
          title: title, startDate: start.startOf('day').toISOString(), endDate: end.endOf('day').toISOString()
        });
      } else {
        const newRef = doc(collection(db, "professionals", selectedProfId, "annualEvents"));
        batch.set(newRef, {
          title: title, startDate: start.startOf('day').toISOString(), endDate: end.endOf('day').toISOString(), createdAt: serverTimestamp()
        });
      }
      await updateSlotsForEvent(batch, start.startOf('day'), end.endOf('day'), 'block', title);
      await batch.commit();
      loadAnnualEvents();
      loadMonthDoc();
      setIsNewEventModalOpen(false);
      setIsConflictModalOpen(false);
      setEditingEventId(null);
      setPendingEventSave(null);
      setConflictList([]);
    } catch(e: any) { console.error(e); alert("Error: " + e.message); } finally { setLoading(false); }
  };

  const handleSaveEvent = async () => {
    if (!newEventData.title) return alert("Falta el título");
    const startD = newEventData.start.startOf('day');
    const endD = newEventData.end.endOf('day');
    setLoading(true);
    try {
      const conflicts = await detectConflicts(startD, endD);
      setPendingEventSave({ start: startD, end: endD, title: newEventData.title, isEdit: !!editingEventId });
      if (conflicts.length > 0) {
        setConflictList(conflicts);
        setIsConflictModalOpen(true);
        setLoading(false);
      } else {
        setConfirmModal({
          isOpen: true,
          title: editingEventId ? 'Guardar Cambios' : 'Crear Evento',
          message: `Se bloqueará la agenda del ${startD.format('DD/MM')} al ${endD.format('DD/MM')}.\n¿Continuar?`,
          onConfirm: async () => {
            setConfirmModal(prev => ({...prev, isOpen: false}));
            await finalizeEventSave();
          }
        });
        setLoading(false);
      }
    } catch (e) { console.error(e); setLoading(false); }
  };

  const handleResolveConflictToWaitlist = async (conflict: ConflictItem) => {
    if(!window.confirm(`¿Mover a ${conflict.slotData.patientName} a lista de espera?`)) return;
    try { alert("Movido a espera (Simulado)"); setConflictList(prev => prev.filter(c => c.slotKey !== conflict.slotKey)); } catch(e) { console.error(e); }
  };

  const handleKeepConflict = (conflict: ConflictItem) => {
    setConflictList(prev => prev.filter(c => c.slotKey !== conflict.slotKey));
  };

  const handleDeleteEvent = (event: AnnualEvent) => {
    setConfirmModal({
      isOpen: true,
      title: 'Eliminar Evento',
      message: `¿Eliminar "${event.title}" y liberar sus horarios?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const startD = dayjs(event.startDate);
          const endD = dayjs(event.endDate);
          const batch = writeBatch(db);
          batch.delete(doc(db, "professionals", selectedProfId, "annualEvents", event.id));
          await updateSlotsForEvent(batch, startD, endD, 'release');
          await batch.commit();
          loadAnnualEvents();
          loadMonthDoc();
          setConfirmModal(prev => ({...prev, isOpen: false}));
        } catch(e: any) { console.error(e); } finally { setLoading(false); }
      }
    });
  };

  const openEditEvent = (event: AnnualEvent) => {
    setEditingEventId(event.id);
    setOriginalEventData(event);
    setNewEventData({
      start: dayjs(event.startDate),
      end: dayjs(event.endDate),
      title: event.title
    });
    setIsNewEventModalOpen(true);
  };

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = parseInt(e.target.value);
    const newDate = new Date(selectedDate);
    newDate.setMonth(newMonth);
    setSelectedDate(newDate);
  };

  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newYear = parseInt(e.target.value);
    const newDate = new Date(selectedDate);
    newDate.setFullYear(newYear);
    setSelectedDate(newDate);
  };

  const handlePrevMonth = () => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()-1)));
  const handleNextMonth = () => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()+1)));

  // --- ACTIONS AGENDA ---
  const handleInitializeMonth = async () => {
    if (!window.confirm(`¿Generar agenda para ${selectedDate.toLocaleDateString('es-ES', {month:'long'})}?`)) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const emptySlots = generateMonthSkeleton(year, month, workConfig);
      await setDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), {
        id: monthDocId, professionalId: selectedProfId, year, month,
        slots: emptySlots, createdAt: new Date(), monthGoal: ''
      });
      setCurrentMonthData(emptySlots); setMonthGoal(''); setIsMonthInitialized(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- FUNCIÓN AUDITORA: SINCRONIZAR PACIENTES VS AGENDA ---
  const handleSyncPatients = async () => {
    if (!window.confirm("¿Sincronizar expedientes?\n\nEsto escaneará la agenda actual para detectar citas y sacará a los pacientes correctos de la lista 'Sin Cita'.")) return;
    setLoading(true);
    try {
      const now = new Date();
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      
      const monthsToCheck = [
        `${year}_${month.toString().padStart(2, '0')}`,
        `${month === 11 ? year + 1 : year}_${((month + 1) % 12).toString().padStart(2, '0')}`
      ];

      const futureAppointments = new Map<string, Date>(); 

      for (const mId of monthsToCheck) {
        const docSnap = await getDoc(doc(db, "professionals", selectedProfId, "availability", mId));
        if (docSnap.exists()) {
          const slots = docSnap.data().slots || {};
          Object.entries(slots).forEach(([key, slot]: [string, any]) => {
            if (slot.status === 'booked' && slot.patientId) {
              const [yStr, mStr] = mId.split('_');
              const slotDate = getDateFromSlotKey(key, parseInt(yStr), parseInt(mStr));
              if (slotDate >= now) {
                const existingDate = futureAppointments.get(slot.patientId);
                if (!existingDate || slotDate < existingDate) {
                  futureAppointments.set(slot.patientId, slotDate);
                }
              }
            }
          });
        }
      }

      const batch = writeBatch(db);
      let updatesCount = 0;

      patients.forEach(p => {
        const teamData = p.careTeam?.[selectedProfId];
        if (!teamData) return;

        const correctNextAppt = futureAppointments.get(p.id);
        const currentNextAppt = teamData.nextAppointment ? new Date(teamData.nextAppointment) : null;

        if (correctNextAppt) {
          if (!currentNextAppt || currentNextAppt.getTime() !== correctNextAppt.getTime()) {
            batch.update(doc(db, "patients", p.id), {
              [`careTeam.${selectedProfId}.nextAppointment`]: correctNextAppt.toISOString(),
              [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
            });
            updatesCount++;
          }
        } 
        else if (currentNextAppt && currentNextAppt > now) {
           batch.update(doc(db, "patients", p.id), {
              [`careTeam.${selectedProfId}.nextAppointment`]: null,
              [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
            });
            updatesCount++;
        }
      });

      if (updatesCount > 0) {
        await batch.commit();
        await loadPatients(); 
        alert(`✅ Auditoría completa. Se corrigió el estado de ${updatesCount} paciente(s).`);
      } else {
        alert("✅ Todo está en orden. No se encontraron desincronizaciones.");
      }

    } catch (error) {
      console.error(error);
      alert("Error al sincronizar datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateMonth = async () => {
    if (!currentMonthData) return;
    if (!window.confirm("⚠️ ¿Actualizar horarios conservando citas existentes?")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const newSkeleton = generateMonthSkeleton(year, month, workConfig);
      const mergedSlots = { ...newSkeleton };
      Object.entries(currentMonthData).forEach(([key, oldSlot]) => { if (oldSlot.status !== 'available') mergedSlots[key] = oldSlot; });
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { slots: mergedSlots, updatedAt: new Date() });
      setCurrentMonthData(mergedSlots);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const handleSaveConfig = async (newConfig: WorkConfig) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "professionals", selectedProfId), { agendaSettings: newConfig });
      setWorkConfig(newConfig); setIsConfigOpen(false); alert("Configuración guardada.");
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };
  const handleAddExtraSlot = async () => {
    const timeStr = window.prompt("Hora del turno extra (HH:MM):", "18:00"); if (!timeStr) return;
    const [h, m] = timeStr.split(':').map(Number);
    const day = selectedDate.getDate();
    const slotKey = `${day.toString().padStart(2,'0')}_${h.toString().padStart(2,'0')}${m.toString().padStart(2,'0')}`;
    if (currentMonthData && currentMonthData[slotKey]) return alert("Ya existe ese turno.");
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const newSlot: AgendaSlot = { status: 'available', time: `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`, price: workConfig.defaultPrice, duration: workConfig.durationMinutes };
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotKey}`]: newSlot });
      setCurrentMonthData({ ...currentMonthData, [slotKey]: newSlot });
    } catch (e) { console.error(e); }
  };
  const handleBlockDay = async () => {
    const reason = window.prompt("Motivo del bloqueo:"); if (!reason) return;
    if (!window.confirm("¿Bloquear día completo?")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const prefix = `${selectedDate.getDate().toString().padStart(2,'0')}_`;
      const updates: any = {}; const updatedLocal = { ...currentMonthData };
      Object.entries(currentMonthData || {}).forEach(([key, slot]) => {
        if (key.startsWith(prefix) && slot.status === 'available') {
          const blocked: AgendaSlot = { ...slot, status: 'blocked', adminNotes: reason, price: 0 };
          updates[`slots.${key}`] = blocked; updatedLocal[key] = blocked;
        }
      });
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), updates);
      setCurrentMonthData(updatedLocal); setIsDayViewOpen(false);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handlePatientSelect = (id: string, name: string) => {
    const fullPatient = patients.find(p => p.id === id);
    let detectedPrice = workConfig.defaultPrice;
    let noShowCount = 0;
    if (fullPatient && fullPatient.careTeam && fullPatient.careTeam[selectedProfId]) {
      const teamData = fullPatient.careTeam[selectedProfId];
      if (teamData.customPrice) detectedPrice = teamData.customPrice;
      if (teamData.noShowCount) noShowCount = teamData.noShowCount;
    }
    setFormData({ ...formData, patientId: id, patientName: name, price: detectedPrice });
    setSelectedPatientNoShows(noShowCount);
  };

  const handleQuickPay = async (slotKey: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    if (currentStatus === 'paid' && !window.confirm("¿Marcar como NO PAGADO?")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotKey}.paymentStatus`]: newStatus });
      if (currentMonthData) {
        const updatedSlots = { ...currentMonthData };
        updatedSlots[slotKey] = { ...updatedSlots[slotKey], paymentStatus: newStatus as any };
        setCurrentMonthData(updatedSlots);
      }
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleMarkNoShow = async (slotKey: string, patientId: string | undefined) => {
    if (!window.confirm("¿Marcar NO SHOW?")) return;
    
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const slotPayload = { status: 'cancelled', adminNotes: '[AUSENCIA] El paciente no se presentó.', updatedAt: new Date().toISOString() };
      
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      await updateDoc(agendaRef, { 
        [`slots.${slotKey}.status`]: 'cancelled', 
        [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes, 
        [`slots.${slotKey}.updatedAt`]: slotPayload.updatedAt 
      });
      setCurrentMonthData({ ...currentMonthData!, [slotKey]: { ...currentMonthData![slotKey], ...slotPayload } as any });

      if (patientId) {
        try {
          await updateDoc(doc(db, "patients", patientId), { 
            [`careTeam.${selectedProfId}.noShowCount`]: increment(1), 
            [`careTeam.${selectedProfId}.nextAppointment`]: null,
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString() 
          });
          loadPatients();
        } catch (err) { console.warn("Aviso: Agenda cancelada, pero sin permisos para poner la falta.", err); }
      }
    } catch(e: any) { 
      console.error(e); 
      alert("Error al marcar Ausencia: " + e.message);
    } finally { 
      setLoading(false); 
    }
  };

  const handleSaveAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlotKey || !currentMonthData || !formData.patientName) return alert("Datos incompletos.");
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const batch = writeBatch(db);
      let finalPatientId = formData.patientId;

      if (!finalPatientId && formData.patientName) {
        const newPatRef = doc(collection(db, "patients")); finalPatientId = newPatRef.id;
        batch.set(newPatRef, {
          fullName: formData.patientName, contactNumber: formData.patientExternalPhone || '', email: formData.patientExternalEmail || '', isManual: true, linkedProfessionalId: selectedProfId, createdAt: serverTimestamp(),
          careTeam: { [selectedProfId]: { status: 'active', joinedAt: new Date().toISOString(), customPrice: savePricePreference ? Number(formData.price) : null } }
        });
      } else if (finalPatientId && savePricePreference) {
        batch.update(doc(db, "patients", finalPatientId), { [`careTeam.${selectedProfId}.customPrice`]: Number(formData.price) });
      }

      const slotPayload: Partial<AgendaSlot> = { status: 'booked', patientId: finalPatientId, patientName: formData.patientName, price: Number(formData.price), adminNotes: formData.adminNotes, paymentStatus: formData.paymentStatus as any, updatedAt: new Date().toISOString() };
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      batch.update(agendaRef, { [`slots.${targetSlotKey}`]: { ...currentMonthData[targetSlotKey], ...slotPayload } });

      if (finalPatientId) {
        const appointmentDate = getDateFromSlotKey(targetSlotKey, year, month);
        batch.update(doc(db, "patients", finalPatientId), { [`careTeam.${selectedProfId}.nextAppointment`]: appointmentDate.toISOString(), [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString() });
        batch.set(doc(db, "patients", finalPatientId, "gamification", "history"), { lastUpdate: new Date(), appointments: arrayUnion({ date: appointmentDate.toISOString(), slotKey: targetSlotKey, professionalId: selectedProfId, status: 'booked' }) }, { merge: true });
      }
      await batch.commit();
      setCurrentMonthData({ ...currentMonthData, [targetSlotKey]: { ...currentMonthData[targetSlotKey], ...slotPayload as AgendaSlot } });
      loadPatients(); setIsFormOpen(false); setSavePricePreference(false); setSelectedPatientNoShows(0);
    } catch (e) { console.error(e); alert("Error al guardar."); } finally { setLoading(false); }
  };

  const handleSoftCancel = async (slotKey: string) => {
    const reason = window.prompt("¿Motivo de cancelación?", "Cancelación del paciente"); 
    if (reason === null) return;
    
    setLoading(true); 
    try { 
      const year = selectedDate.getFullYear(); 
      const month = selectedDate.getMonth(); 
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const slotPayload = { status: 'cancelled', adminNotes: `[CANCELADO] ${reason}`, updatedAt: new Date().toISOString() };
      
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { 
        [`slots.${slotKey}.status`]: 'cancelled', 
        [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes 
      });
      setCurrentMonthData({ ...currentMonthData!, [slotKey]: { ...currentMonthData![slotKey], ...slotPayload } as any }); 

      if (currentMonthData![slotKey].patientId) {
        try {
          await updateDoc(doc(db, "patients", currentMonthData![slotKey].patientId!), {
            [`careTeam.${selectedProfId}.nextAppointment`]: null,
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
          });
          loadPatients();
        } catch (err) { console.warn("Aviso: No se pudo actualizar el expediente del paciente por permisos.", err); }
      }
    } catch (e: any) { 
      console.error(e); 
      alert("Error al cancelar: " + e.message); 
    } finally { 
      setLoading(false); 
    }
  };

  const handleReopenSlot = async (slotKey: string) => {
    if (!window.confirm("¿Reabrir este horario?")) return; 
    
    setLoading(true); 
    try { 
      const year = selectedDate.getFullYear(); 
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; 
      const originalTime = currentMonthData![slotKey].time; 
      const patientIdToUpdate = currentMonthData![slotKey].patientId;
      
      const cleanSlotLocal: AgendaSlot = { status: 'available', time: originalTime, duration: workConfig.durationMinutes, price: workConfig.defaultPrice };
      
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      await updateDoc(agendaRef, { 
        [`slots.${slotKey}.status`]: 'available', 
        [`slots.${slotKey}.price`]: workConfig.defaultPrice, 
        [`slots.${slotKey}.duration`]: workConfig.durationMinutes, 
        [`slots.${slotKey}.patientId`]: deleteField(), 
        [`slots.${slotKey}.patientName`]: deleteField(), 
        [`slots.${slotKey}.patientExternalPhone`]: deleteField(), 
        [`slots.${slotKey}.patientExternalEmail`]: deleteField(), 
        [`slots.${slotKey}.adminNotes`]: deleteField(), 
        [`slots.${slotKey}.paymentStatus`]: deleteField() 
      });
      setCurrentMonthData({ ...currentMonthData!, [slotKey]: cleanSlotLocal }); 

      if (patientIdToUpdate) { 
        try {
          await updateDoc(doc(db, "patients", patientIdToUpdate), { 
            [`careTeam.${selectedProfId}.nextAppointment`]: null 
          }); 
          loadPatients();
        } catch (err) { console.warn("Aviso: El espacio se abrió pero el expediente no se actualizó.", err); }
      } 
    } catch (e: any) { 
      console.error(e); 
      alert("Error al reabrir: " + e.message);
    } finally { 
      setLoading(false); 
    }
  };

  const handleSmartReleaseCheck = async (slotKey: string) => {
    if (waitlist.length > 0) { if (window.confirm(`⚠️ Hay ${waitlist.length} personas en espera. ¿ASIGNAR espacio a la lista?`)) { setSlotToReassign(slotKey); setIsWaitlistSelectorOpen(true); return; } }
    if(window.confirm("¿CANCELAR la cita actual?")) { handleSoftCancel(slotKey); }
  };
  const handleAssignFromWaitlist = async (waitlistItem: any) => { if (!slotToReassign || !currentMonthData) return; setLoading(true); try { const year = selectedDate.getFullYear();
  const month = selectedDate.getMonth(); const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; const batch = writeBatch(db);
  const slotPayload: Partial<AgendaSlot> = { status: 'booked', patientId: waitlistItem.patientId || undefined, patientName: waitlistItem.patientName, patientExternalPhone: waitlistItem.patientExternalPhone, adminNotes: `[Desde Espera] ${waitlistItem.notes || ''}`, paymentStatus: 'pending', updatedAt: new Date().toISOString() };
  batch.update(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotToReassign}`]: { ...currentMonthData[slotToReassign], ...slotPayload } });
  if (waitlistItem.patientId) { const apptDate = getDateFromSlotKey(slotToReassign, year, month); batch.update(doc(db, "patients", waitlistItem.patientId), { [`careTeam.${selectedProfId}.nextAppointment`]: apptDate.toISOString() }); } batch.delete(doc(db, "waitlist", waitlistItem.id));
  await batch.commit(); setCurrentMonthData({ ...currentMonthData, [slotToReassign]: { ...currentMonthData[slotToReassign], ...slotPayload as AgendaSlot } }); loadWaitlist(); loadPatients(); setIsWaitlistSelectorOpen(false); setSlotToReassign(null);
  alert( `✅ Reasignado a ${waitlistItem.patientName}`); } catch (e) { console.error(e); } finally { setLoading(false); } };

  const handleAddToWaitlist = async (e: React.FormEvent) => {
    e.preventDefault(); if (!formData.patientName) return alert("Nombre requerido"); setLoading(true); try {
    await addDoc(collection(db, "waitlist"), { professionalId: selectedProfId, patientId: formData.patientId || null, patientName: formData.patientName, notes: formData.adminNotes, createdAt: serverTimestamp() });
    alert("Agregado a lista de espera."); setIsWaitlistFormOpen(false); loadWaitlist(); } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const openForm = (slotKey: string, slot: AgendaSlot) => {
    setTargetSlotKey(slotKey);
    setFormData({ patientId: slot.patientId || '', patientName: slot.patientName || (slot.status === 'blocked' ? 'BLOQUEADO' : ''), patientExternalPhone: slot.patientExternalPhone || '', patientExternalEmail: slot.patientExternalEmail || '', price: slot.price, adminNotes: slot.adminNotes || '', paymentStatus: slot.paymentStatus || 'pending', paymentMethod: slot.paymentMethod || 'cash' });
    setSavePricePreference(false); setSelectedPatientNoShows(0); 
    // --- CORRECCIÓN: CERRAR VISTA DE DÍA ---
    setIsDayViewOpen(false);
    setIsFormOpen(true);
  };

  const handleScheduleNeedingPatient = (p: any) => {
    let price = workConfig.defaultPrice; let ns = 0;
    if (p.careTeam?.[selectedProfId]?.customPrice) price = p.careTeam[selectedProfId].customPrice;
    if (p.careTeam?.[selectedProfId]?.noShowCount) ns = p.careTeam[selectedProfId].noShowCount;
    setFormData({ patientId: p.id, patientName: p.fullName, patientExternalPhone: p.contactNumber || '', patientExternalEmail: p.email || '', price: price, adminNotes: '', paymentStatus: 'pending', paymentMethod: 'cash' });
    setSelectedPatientNoShows(ns);
    alert(`Has seleccionado a ${p.fullName}. Click en un espacio disponible.`);
    if (isMobile) setShowMobileSidebar(false);
  };

  // NUEVA FUNCIÓN AÑADIDA PARA CANCELAR LA SELECCIÓN
  const handleCancelSelection = () => {
    setFormData({
      patientId: '',
      patientName: '',
      patientExternalPhone: '',
      patientExternalEmail: '',
      price: workConfig.defaultPrice,
      adminNotes: '',
      paymentStatus: 'pending',
      paymentMethod: 'cash'
    });
    setSelectedPatientNoShows(0);
  };

  const DateSelectorRow = ({ label, dateValue, onChange }: { label: string, dateValue: dayjs.Dayjs, onChange: (d: dayjs.Dayjs) => void }) => {
    const daysInMonth = dateValue.daysInMonth();
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    return (
      <div style={{marginBottom:'10px'}}>
        <label style={{display:'block', fontSize:'12px', color:'#666', marginBottom:'2px'}}>{label}</label>
        <div style={{display:'flex', gap:'5px'}}>
          <select value={dateValue.date()} onChange={(e) => onChange(dateValue.date(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:1}}>{days.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select value={dateValue.month()} onChange={(e) => onChange(dateValue.month(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:2}}>{MONTHS_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          <select value={dateValue.year()} onChange={(e) => onChange(dateValue.year(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:1}}>{YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>
    );
  };

  const renderDaySlots = () => {
    if (!currentMonthData) return <div>Cargando...</div>;
    const dayStr = selectedDate.getDate().toString().padStart(2, '0');
    const daySlots = Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`)).sort((a, b) => a[0].localeCompare(b[0]));
    if (daySlots.length === 0) return ( <div style={{padding:'20px', textAlign:'center', color:'#777'}}> <p>No hay turnos hoy.</p> <button onClick={handleAddExtraSlot} style={{background:'#2196F3', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>+ Agregar Turno</button> </div> );
    return (
      <div>
        {daySlots.map(([key, slot]) => {
          const [dStr, tStr] = key.split('_'); const sH = parseInt(tStr.substring(0, 2)); const sM = parseInt(tStr.substring(2));
          const slotDateObj = dayjs(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), parseInt(dStr), sH, sM));
          const isPast = slotDateObj.isBefore(dayjs());

          return (
            <div key={key} style={{borderBottom:'1px solid #eee', padding:'12px', display:'flex', alignItems:'center', gap:'15px'}}>
              <div style={{fontWeight:'bold', color:'#555', minWidth:'50px'}}>{slot.time}</div>
              <div style={{flex:1}}>
                {slot.status === 'available' ? (
                  <div onClick={() => { 
                      if (isPast) { alert("Fecha pasada."); return; } 
                      if (formData.patientId && formData.patientName) { 
                          setTargetSlotKey(key); 
                          // --- CORRECCIÓN: CERRAR VISTA DE DÍA ---
                          setIsDayViewOpen(false);
                          setIsFormOpen(true); 
                      } else { openForm(key, slot); } 
                    }}
                    style={{ background: isPast ? '#f5f5f5' : '#F1F8E9', color: isPast ? '#aaa' : '#4CAF50', border: isPast ? '1px solid #ddd' : '1px dashed #4CAF50', padding:'8px', borderRadius:'6px', textAlign:'center', cursor: isPast ? 'not-allowed' : 'pointer' }}
                  > {isPast ? 'Tiempo transcurrido' : `+ Disponible ${formData.patientId && formData.patientName ? `(Agendar a ${formData.patientName})` : ''}`} </div>
                ) : slot.status === 'blocked' ? (
                  <div onClick={() => handleReopenSlot(key)} style={{background:'#FFEBEE', color:'#D32F2F', padding:'10px', borderRadius:'6px', display:'flex', justifyContent:'space-between', cursor:'pointer'}}> <span>🚫 {slot.adminNotes}</span><span> ✕ </span> </div>
                ) : slot.status === 'cancelled' ? (
                  <div style={{background: '#f5f5f5', border: '1px solid #ccc', color: '#777', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div> <div style={{textDecoration: 'line-through', fontWeight: 'bold'}}>{slot.patientName}</div> <div style={{fontSize: '11px', fontStyle: 'italic', color: slot.adminNotes?.includes('AUSENCIA') ? '#D32F2F' : '#666'}}> {slot.adminNotes} </div> </div>
                    <button onClick={() => handleReopenSlot(key)} style={{background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'}}>↻ Reabrir</button>
                  </div>
                ) : (
                  <div onClick={() => openForm(key, slot)} style={{background: slot.paymentStatus==='paid'?'#E8F5E9':'#E3F2FD', borderLeft:`4px solid ${slot.paymentStatus==='paid'?'#4CAF50':'#2196F3'}`, padding:'10px', borderRadius:'6px', position:'relative', cursor:'pointer'}}>
                    {/* AQUÍ ESTÁ EL ARREGLO DE COLOR (color: '#222' y color: '#555') */}
                    <div style={{fontWeight:'bold', paddingRight:'65px', color: '#222'}}>{slot.patientName}</div> 
                    <div style={{fontSize:'12px', color:'#555', marginTop: '2px'}}>{slot.adminNotes || 'Sin notas'}</div> 
                    <div style={{fontSize:'11px', fontWeight:'bold', marginTop:'4px', color:'#1565C0'}}>${slot.price}</div>
                    
                    <div onClick={(e) => { e.stopPropagation(); handleQuickPay(key, slot.paymentStatus); }} style={{ position:'absolute', right:'40px', top:'10px', width:'24px', height:'24px', borderRadius:'50%', background: slot.paymentStatus === 'paid' ? '#4CAF50' : '#E0E0E0', color: slot.paymentStatus === 'paid' ? 'white' : '#757575', display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'12px', border: '1px solid #ccc', zIndex:5 }}> $ </div>
                    <button onClick={(e) => { e.stopPropagation(); handleMarkNoShow(key, slot.patientId); }} style={{ position:'absolute', right:'70px', top:'10px', width:'24px', height:'24px', borderRadius:'50%', background:'#FFEBEE', color:'#D32F2F', border:'1px solid #FFCDD2', display:'flex', justifyContent:'center', alignItems:'center', cursor:'pointer', fontSize:'12px', zIndex:5 }}> 🚫 </button>
                    <button onClick={(e)=>{e.stopPropagation(); handleSmartReleaseCheck(key)}} style={{position:'absolute', right:'10px', top:'10px', border:'none', background:'none', color:'#D32F2F', cursor:'pointer', fontSize:'16px'}}>🗑</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    );
  };

  const calendarDays = getCalendarGrid(selectedDate);
  if (loading && !currentMonthData && !isMonthInitialized) return <div style={{padding:'50px', textAlign:'center'}}>Cargando...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background:'#f5f5f5', overflow:'hidden', position: 'relative' }}>

      {/* --- SIDEBAR COMPONETIZADO (MÓVIL FRIENDLY) --- */}
      <div style={{
          position: isMobile ? 'absolute' : 'relative',
          zIndex: 99,
          height: '100%',
          background: 'white',
          width: isMobile ? '280px' : 'auto',
          transform: isMobile ? (showMobileSidebar ? 'translateX(0)' : 'translateX(-100%)') : 'none',
          transition: 'transform 0.3s ease',
          boxShadow: showMobileSidebar ? '2px 0 10px rgba(0,0,0,0.2)' : 'none'
      }}>
        <AgendaSidebar
          onBack={onBack}
          onOpenConfig={() => setIsConfigOpen(true)}
          onOpenEvents={() => setIsEventsManagerOpen(true)}
          isMonthInitialized={isMonthInitialized}
          onRegenerate={handleRegenerateMonth}
          onInitialize={handleInitializeMonth}
          activeSidePanel={activeSidePanel}
          setActiveSidePanel={setActiveSidePanel}
          isPausedSidebarOpen={isPausedSidebarOpen}
          setIsPausedSidebarOpen={setIsPausedSidebarOpen}
          patientsNeedingAppt={patientsNeedingAppt}
          waitlist={waitlist}
          pausedList={pausedList}
          onOpenPausedSidebar={handleOpenPausedSidebar}
          onScheduleNeeding={handleScheduleNeedingPatient}
          onArchivePatient={handleArchivePatient}
          onAddWaitlist={() => { setFormData({ ...formData, patientId: '', patientName: '', adminNotes: '' }); setIsWaitlistFormOpen(true); }}
          onDeleteWaitlist={handleDeleteWaitlistItem}
          onReactivatePatient={handleReactivatePatient}
          isMobile={isMobile}
          onSyncPatients={handleSyncPatients}
        />
        {isMobile && showMobileSidebar && (
           <button 
             onClick={() => setShowMobileSidebar(false)}
             style={{
               position:'absolute', top:'10px', right:'10px', 
               background:'#f5f5f5', border:'1px solid #ccc', borderRadius:'4px', padding:'5px'
             }}
           >
             ✕
           </button>
        )}
      </div>

      {/* OVERLAY PARA CERRAR EN MÓVIL AL TOCAR AFUERA */}
      {isMobile && showMobileSidebar && (
        <div 
          onClick={() => setShowMobileSidebar(false)}
          style={{position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 90}}
        />
      )}

      {/* --- ÁREA PRINCIPAL (CALENDARIO) --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position:'relative', minWidth: 0 }}>
        
        {/* HEADER MORADO CON BOTÓN DE MENÚ */}
        <div style={{background: '#673AB7', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'}}>
          
          {isMobile && (
            <button 
              onClick={() => setShowMobileSidebar(true)}
              style={{background:'none', border:'none', color:'white', fontSize:'20px', cursor:'pointer', marginRight:'5px'}}
            >
              ☰
            </button>
          )}

          <span style={{fontWeight: 'bold', fontSize: '14px', background:'rgba(255,255,255,0.2)', padding:'2px 8px', borderRadius:'4px'}}>{MONTHS_LIST[selectedDate.getMonth()].toUpperCase()} - PROYECTO:</span>
          {isMonthInitialized ? ( isEditingGoal ? ( <input autoFocus value={monthGoal} onChange={(e) => setMonthGoal(e.target.value)} onBlur={handleSaveGoal} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); }} style={{flex: 1, border: 'none', borderRadius: '4px', padding: '5px', color: '#333'}} /> ) : ( <div onClick={() => setIsEditingGoal(true)} style={{flex: 1, cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.5)', paddingBottom: '2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}} title="Click para editar"> {monthGoal || "Click meta..."} ✎ </div> ) ) : ( <div style={{flex: 1, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize:'13px'}}> (Inicializa mes) </div> )}
        </div>

        <div style={{ padding: '20px', background: 'white', display:'flex', justifyContent:'center', alignItems:'center', borderBottom:'1px solid #eee', gap:'15px' }}>
          <button onClick={handlePrevMonth} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#555'}}> ◀ </button>
          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select value={selectedDate.getMonth()} onChange={handleMonthChange} style={{padding:'8px 12px', fontSize:'16px', fontWeight:'bold', textTransform:'uppercase', border:'1px solid #ccc', borderRadius:'6px', background:'#fff', color:'#333'}}> {MONTHS_LIST.map((m, i) => ( <option key={i} value={i}>{m}</option> ))} </select>
            <select value={selectedDate.getFullYear()} onChange={handleYearChange} style={{padding:'8px 12px', fontSize:'16px', fontWeight:'bold', border:'1px solid #ccc', borderRadius:'6px', background:'#fff', color:'#333'}}> {YEARS_LIST.map(y => ( <option key={y} value={y}>{y}</option> ))} </select>
          </div>
          <button onClick={handleNextMonth} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#555'}}> ▶ </button>
        </div>

        <div style={{flex:1, padding:'10px', overflowY:'auto'}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', textAlign:'center', marginBottom:'10px', color:'#777', fontWeight:'bold', fontSize: isMobile ? '10px' : '14px'}}> {DAYS_HEADER.map(d => <div key={d}>{isMobile ? d.charAt(0) : d}</div>)} </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'minmax(80px, 1fr)', gap:'5px'}}>
            {calendarDays.map((dateObj, i) => {
              if (!dateObj) return <div key={i} />;
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const isPastDay = dayjs(dateObj).isBefore(dayjs(), 'day');
              const dayStr = dateObj.getDate().toString().padStart(2, '0');
              let available = 0; let hasSlots = false;
              if (currentMonthData) {
                const slots = Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`));
                if (slots.length > 0) { hasSlots = true; available = slots.filter(([,v]) => { if(v.status !== 'available') return false; if(isPastDay) return false; if(isToday) { const [h, m] = v.time.split(':').map(Number); return dayjs().hour(h).minute(m).isAfter(dayjs()); } return true; }).length; }
              }
              let bg = 'white'; let status = ''; let statusCol = '#999';
              if (isPastDay) { bg = '#f9f9f9'; } else if (hasSlots) { if (available === 0) { bg = '#FFEBEE'; status = isMobile ? '0' : 'Agotado'; statusCol = '#D32F2F'; } else { bg = '#E8F5E9'; status = isMobile ? `${available}` : `${available} Libres`; statusCol = '#2E7D32'; } }
              return (
                <div key={i} onClick={() => { setSelectedDate(dateObj); setIsDayViewOpen(true); }} style={{ background: isToday ? '#E3F2FD' : bg, border: isToday ? '2px solid #2196F3' : '1px solid #ddd', borderRadius: '4px', padding:'5px', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between', minHeight: isMobile ? '60px' : '100px' }}>
                  <span style={{fontWeight:'bold', color: isToday ? '#1565C0' : '#333', fontSize: isMobile ? '14px' : '18px'}}>{dateObj.getDate()}</span>
                  {status && <div style={{alignSelf:'flex-end', fontSize:'10px', fontWeight:'bold', color: statusCol, background:'rgba(255,255,255,0.7)', padding:'2px 4px', borderRadius:'10px'}}>{status}</div>}
                </div>
              )
            })}
          </div>
        </div>

        {/* --- BANNER FLOTANTE DE PACIENTE SELECCIONADO (OPCIÓN C) --- */}
        {!isFormOpen && formData.patientId && formData.patientName && (
          <div style={{
            position: 'absolute',
            bottom: '30px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#323232',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '30px',
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.3)',
            zIndex: 90
          }}>
            <span style={{ fontSize: isMobile ? '12px' : '14px' }}>
              Agendando a: <b>{formData.patientName}</b>. Haz clic en un espacio libre.
            </span>
            <button
              onClick={handleCancelSelection}
              style={{
                background: '#FF5252',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '6px 12px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '12px',
                transition: 'background 0.2s'
              }}
            >
              Cancelar ✕
            </button>
          </div>
        )}

      </div>

      {/* --- MODALES INLINE --- */}
      {isDayViewOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'end', zIndex:100}}>
          <div style={{width: isMobile ? '100%' : '400px', background:'white', height:'100%', padding:'20px', display:'flex', flexDirection:'column', boxShadow:'-5px 0 20px rgba(0,0,0,0.1)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
              <div> <h2 style={{margin:0}}>{selectedDate.toLocaleDateString('es-ES', {weekday:'long', day:'numeric'})}</h2> <div style={{display:'flex', gap:'10px', marginTop:'10px'}}> <button onClick={handleBlockDay} style={{fontSize:'12px', padding:'5px 12px', background:'#FFEBEE', color:'#D32F2F', border:'1px solid #FFCDD2', borderRadius:'20px', cursor:'pointer', fontWeight:'bold'}}>🚫 Bloquear día</button> <button onClick={handleAddExtraSlot} style={{fontSize:'12px', padding:'5px 12px', background:'#E3F2FD', color:'#1565C0', border:'1px solid #BBDEFB', borderRadius:'20px', cursor:'pointer', fontWeight:'bold'}}>➕ Turno Extra</button> </div> </div>
              <button onClick={() => setIsDayViewOpen(false)} style={{border:'none', background:'none', fontSize:'24px', cursor:'pointer'}}> ✕ </button>
            </div>
            <div style={{flex:1, overflowY:'auto'}}>{renderDaySlots()}</div>
          </div>
        </div>
      )}

      {/* MODAL EVENTS MANAGER */}
      {isEventsManagerOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:50}}>
          <div style={{background:'white', padding:'0', borderRadius:'12px', width:'500px', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column'}}>
            <div style={{padding:'20px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f9f9f9'}}>
              <h3 style={{margin:0}}>📅 Eventos del Año</h3> <button onClick={() => setIsNewEventModalOpen(true)} style={{background:'#4CAF50', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>+ Nuevo Evento</button>
            </div>
            <div style={{display:'flex', borderBottom:'1px solid #eee'}}>
              <div onClick={() => setEventsTab('upcoming')} style={{flex:1, padding:'15px', textAlign:'center', cursor:'pointer', background: eventsTab==='upcoming' ? 'white' : '#f0f0f0', borderBottom: eventsTab==='upcoming' ? '2px solid #2196F3' : 'none', fontWeight: eventsTab==='upcoming' ? 'bold' : 'normal'}}>🚀 Próximos</div>
              <div onClick={() => setEventsTab('past')} style={{flex:1, padding:'15px', textAlign:'center', cursor:'pointer', background: eventsTab==='past' ? 'white' : '#f0f0f0', borderBottom: eventsTab==='past' ? '2px solid #2196F3' : 'none', fontWeight: eventsTab==='past' ? 'bold' : 'normal'}}>📜 Historial</div>
            </div>
            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
              {annualEvents.filter(e => { const end = dayjs(e.endDate); return eventsTab === 'upcoming' ? end.isAfter(dayjs().subtract(1, 'day')) : end.isBefore(dayjs().subtract(1, 'day')); }).map(e => (
                <div key={e.id} style={{border:'1px solid #eee', borderRadius:'8px', padding:'15px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div> <div style={{fontWeight:'bold', fontSize:'16px'}}>{e.title}</div> <div style={{fontSize:'12px', color:'#666'}}> {dayjs(e.startDate).format('DD MMM')} - {dayjs(e.endDate).format('DD MMM YYYY')} </div> </div>
                  <div style={{display:'flex', gap:'5px'}}> <button onClick={() => openEditEvent(e)} title="Editar" style={{border:'none', background:'#E3F2FD', color:'#1565C0', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>✏️</button> <button onClick={() => handleDeleteEvent(e)} title="Eliminar y Liberar" style={{border:'none', background:'#FFEBEE', color:'#D32F2F', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>🗑️</button> </div>
                </div>
              ))}
            </div>
            <div style={{padding:'15px', borderTop:'1px solid #eee', textAlign:'right'}}> <button onClick={() => setIsEventsManagerOpen(false)} style={{padding:'8px 20px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>Cerrar</button> </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR EVENTO */}
      {isNewEventModalOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:60}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px'}}>
            <h3>{editingEventId ? '✏️ Editar Evento' : '➕ Nuevo Evento'}</h3> <DateSelectorRow label="Desde:" dateValue={newEventData.start} onChange={(d) => setNewEventData({...newEventData, start: d})} /> <DateSelectorRow label="Hasta:" dateValue={newEventData.end} onChange={(d) => setNewEventData({...newEventData, end: d})} />
            <label style={{display:'block', marginTop:'15px'}}> <span style={{fontSize:'12px', fontWeight:'bold', color:'#666'}}>Título:</span> <input type="text" value={newEventData.title} onChange={e => setNewEventData({...newEventData, title: e.target.value})} style={{width:'100%', padding:'8px', marginTop:'5px', borderRadius:'4px', border:'1px solid #ccc'}} /> </label>
            <div style={{marginTop:'20px', textAlign:'right'}}> <button onClick={() => { setIsNewEventModalOpen(false); setEditingEventId(null); setConflictList([]); }} style={{marginRight:'10px', padding:'8px 15px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>Cancelar</button> <button onClick={handleSaveEvent} style={{background:'#4CAF50', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>Guardar</button> </div>
          </div>
        </div>
      )}

      {/* MODAL CONFLICTOS */}
      {isConflictModalOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:100}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'500px'}}>
            <h3 style={{margin:0, color:'#D32F2F'}}>⚠️ Conflicto Detectado</h3>
            <div style={{maxHeight:'300px', overflowY:'auto', background:'#FFF8F8', border:'1px solid #FFCDD2', borderRadius:'8px', padding:'10px', margin:'15px 0'}}>
              {conflictList.map((c) => ( <div key={c.slotKey} style={{background:'white', padding:'10px', marginBottom:'10px', borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center'}}> <div> <div style={{fontWeight:'bold'}}>{c.slotData.patientName}</div> <div style={{fontSize:'12px'}}>{dayjs(c.date).format('DD MMM')} - {c.slotData.time}</div> </div> <div style={{display:'flex', gap:'5px'}}> <button onClick={() => handleResolveConflictToWaitlist(c)} style={{background:'#7B1FA2', color:'white', border:'none', borderRadius:'4px', padding:'5px', fontSize:'11px'}}>⏳ Espera</button> <button onClick={() => handleKeepConflict(c)} style={{background:'#eee', padding:'5px', fontSize:'11px'}}>Mantener</button> </div> </div> ))}
            </div>
            <div style={{textAlign:'right'}}> <button onClick={() => setIsConflictModalOpen(false)} style={{marginRight:'10px'}}>Cancelar</button> <button onClick={finalizeEventSave} style={{background:'#D32F2F', color:'white', padding:'10px 20px', border:'none', borderRadius:'4px'}}>Finalizar</button> </div>
          </div>
        </div>
      )}

      {/* --- FORMULARIO DE CITA COMPONETIZADO --- */}
      <AppointmentForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveAppointment}
        formData={formData}
        setFormData={setFormData}
        patients={patients}
        savePricePreference={savePricePreference}
        setSavePricePreference={setSavePricePreference}
        selectedPatientNoShows={selectedPatientNoShows}
        onPatientSelect={handlePatientSelect}
      />

      {/* MODAL ADD WAITLIST */}
      {isWaitlistFormOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:30}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px'}}>
            <h3>Agregar a Lista de Espera</h3>
            <form onSubmit={handleAddToWaitlist}>
              <PatientSelector patients={patients} selectedPatientId={formData.patientId} manualNameValue={formData.patientName} onSelect={(id, name) => setFormData({...formData, patientId: id, patientName: name})} />
              <textarea placeholder="Preferencia (Ej: Solo tardes)..." value={formData.adminNotes} onChange={e => setFormData({...formData, adminNotes: e.target.value})} style={{width:'100%', marginTop:'15px', padding:'8px'}} />
              <div style={{marginTop:'20px', textAlign:'right'}}> <button type="button" onClick={() => setIsWaitlistFormOpen(false)} style={{marginRight:'10px', padding:'8px'}}>Cancelar</button> <button type="submit" style={{padding:'8px 15px', background:'#9C27B0', color:'white', border:'none'}}>Encolar</button> </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL WAITLIST SELECTOR */}
      {isWaitlistSelectorOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:40}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'400px', maxHeight:'80vh', overflowY:'auto'}}>
            <h3 style={{color:'#2E7D32', marginTop:0}}>♻️ Reasignar Espacio</h3>
            {waitlist.map(w => ( <div key={w.id} onClick={() => handleAssignFromWaitlist(w)} style={{padding:'10px', border:'1px solid #eee', marginBottom:'8px', borderRadius:'6px', cursor:'pointer', background:'#f9f9f9'}}> <div style={{fontWeight:'bold'}}>{w.patientName}</div> <div style={{fontSize:'12px', color:'#555'}}>{w.notes}</div> </div> ))}
            <button onClick={() => { setIsWaitlistSelectorOpen(false); setSlotToReassign(null); }} style={{marginTop:'10px', padding:'8px'}}>Cancelar</button>
          </div>
        </div>
      )}

      <AgendaConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} currentConfig={workConfig} onSave={handleSaveConfig} />
      
      {confirmModal.isOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:100}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px'}}>
            <h3>{confirmModal.title}</h3> <p>{confirmModal.message}</p>
            <div style={{textAlign:'right'}}> <button onClick={() => setConfirmModal({...confirmModal, isOpen:false})} style={{marginRight:'10px'}}>Cancelar</button> <button onClick={confirmModal.onConfirm} style={{background:'#2196F3', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px'}}>Confirmar</button> </div>
          </div>
        </div>
      )}
    </div>
  );
}