import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs,
  setDoc, updateDoc, writeBatch, arrayUnion, orderBy, deleteDoc, addDoc, serverTimestamp, deleteField, increment
} from "firebase/firestore";
import { db } from '../services/firebase';
import PatientSelector from './PatientSelector';
import AgendaConfigModal from './AgendaConfigModal';
import { generateMonthSkeleton } from '../utils/agendaGenerator';
import type { MonthlySlotMap, WorkConfig, AgendaSlot } from '../utils/agendaTypes';

// --- IMPORTACIONES MUI & DAYJS ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
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

export default function AgendaView({ userRole, currentUserId, onBack }: Props) {
  // --- CONTEXTO ---
  const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>('');

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

  // NUEVO: Estado para guardar las faltas del paciente seleccionado en el formulario
  const [selectedPatientNoShows, setSelectedPatientNoShows] = useState<number>(0);

  // Inicializar modal nuevo evento
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
          if (selfData.agendaSettings) setWorkConfig(selfData.agendaSettings);
          setMyProfessionals([selfData]);
          setSelectedProfId(currentUserId);
        } else {
          const q = query(collection(db, "professionals"), where("authorizedAssistants", "array-contains", currentUserId));
          const snap = await getDocs(q);
          const pros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setMyProfessionals(pros);
          if (pros.length > 0) {
            setSelectedProfId(pros[0].id);
            if (pros[0].agendaSettings) setWorkConfig(pros[0].agendaSettings);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadContext();
  }, [currentUserId, userRole]);

  // CARGA DATOS
  useEffect(() => {
    if (!selectedProfId) return;
    loadMonthDoc();
    loadPatients();
    loadWaitlist();
    loadAnnualEvents();
  }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

  // FILTRO PACIENTES
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
    }
  }, [patients, selectedProfId]);

  // --- HELPERS CARGA ---
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

  // --- ACTIONS ---
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

  // --- GESTIÓN DE EVENTOS Y CONFLICTOS ---
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
    if(!window.confirm(`¿Mover a ${conflict.slotData.patientName} a lista de espera y cancelar cita?`)) return;
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const waitlistRef = doc(collection(db, "waitlist"));
      batch.set(waitlistRef, {
        professionalId: selectedProfId,
        patientId: conflict.slotData.patientId,
        patientName: conflict.slotData.patientName,
        notes: `Desplazado por evento: ${pendingEventSave?.title}. Cita original: ${dayjs(conflict.date).format('DD/MM HH:mm')}`,
        createdAt: serverTimestamp()
      });
      const slotRef = doc(db, "professionals", selectedProfId, "availability", conflict.monthDocId);
      batch.update(slotRef, {
        [`slots.${conflict.slotKey}`]: {
          status: 'blocked',
          time: conflict.slotData.time,
          duration: conflict.slotData.duration,
          price: 0,
          adminNotes: pendingEventSave?.title || 'Bloqueado por Evento'
        }
      });
      if (conflict.slotData.patientId) {
        batch.update(doc(db, "patients", conflict.slotData.patientId), {
          [`careTeam.${selectedProfId}.nextAppointment`]: null,
          [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
        });
      }
      await batch.commit();
      setConflictList(prev => prev.filter(c => c.slotKey !== conflict.slotKey));
      alert("Paciente movido a espera.");
    } catch(e) { console.error(e); alert("Error al mover."); }
    finally { setLoading(false); }
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
        } catch(e: any) { console.error(e); alert("Error al eliminar: " + e.message); }
        finally { setLoading(false); }
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

  // --- NAVEGACIÓN ---
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

  // --- HELPER COMPONENT ---
  const DateSelectorRow = ({ label, dateValue, onChange }: { label: string, dateValue: dayjs.Dayjs, onChange: (d: dayjs.Dayjs) => void }) => {
    const daysInMonth = dateValue.daysInMonth();
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    return (
      <div style={{marginBottom:'10px'}}>
        <label style={{display:'block', fontSize:'12px', color:'#666', marginBottom:'2px'}}>{label}</label>
        <div style={{display:'flex', gap:'5px'}}>
          <select value={dateValue.date()} onChange={(e) => onChange(dateValue.date(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:1}}>
            {days.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={dateValue.month()} onChange={(e) => onChange(dateValue.month(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:2}}>
            {MONTHS_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={dateValue.year()} onChange={(e) => onChange(dateValue.year(parseInt(e.target.value)))} style={{padding:'5px', borderRadius:'4px', border:'1px solid #ccc', flex:1}}>
            {YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>
    );
  };

  // ... (INITIALIZE, REGENERATE, CONFIG) ...
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
      alert("Mes inicializado.");
    } catch (e) { console.error(e); alert("Error al inicializar"); } finally { setLoading(false); }
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
      setCurrentMonthData(mergedSlots); alert("Horarios actualizados.");
    } catch (e) { console.error(e); alert("Error al actualizar."); } finally { setLoading(false); }
  };
  const handleSaveConfig = async (newConfig: WorkConfig) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "professionals", selectedProfId), { agendaSettings: newConfig });
      setWorkConfig(newConfig); setIsConfigOpen(false); alert("Configuración guardada.");
    } catch (e) { console.error(e); alert("Error guardando configuración."); } finally { setLoading(false); }
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
    } catch (e) { console.error(e); alert("Error al crear turno."); }
  };
  const handleBlockDay = async () => {
    const reason = window.prompt("Motivo del bloqueo (Ej: Enfermedad, Feriado):"); if (!reason) return;
    if (!window.confirm("¿Seguro que deseas bloquear TODOS los espacios libres de este día?")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const prefix = `${selectedDate.getDate().toString().padStart(2,'0')}_`;
      const updates: any = {}; const updatedLocal = { ...currentMonthData }; let count = 0;
      Object.entries(currentMonthData || {}).forEach(([key, slot]) => {
        if (key.startsWith(prefix) && slot.status === 'available') {
          const blocked: AgendaSlot = { ...slot, status: 'blocked', adminNotes: reason, price: 0 };
          updates[`slots.${key}`] = blocked; updatedLocal[key] = blocked; count++;
        }
      });
      if (count > 0) { await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), updates); setCurrentMonthData(updatedLocal); alert( `✅ Se bloquearon ${count} espacios.`); setIsDayViewOpen(false);
      } else { alert("⚠️ No había espacios libres para bloquear."); }
    } catch (e) { console.error(e); alert("Error al bloquear."); } finally { setLoading(false); }
  };

  // --- SELECCIÓN DE PACIENTE (Carga precios y FALTAS) ---
  const handlePatientSelect = (id: string, name: string) => {
    const fullPatient = patients.find(p => p.id === id);
    let detectedPrice = workConfig.defaultPrice;
    let noShowCount = 0;

    if (fullPatient && fullPatient.careTeam && fullPatient.careTeam[selectedProfId]) {
      const teamData = fullPatient.careTeam[selectedProfId];
      if (teamData.customPrice) detectedPrice = teamData.customPrice;
      if (teamData.noShowCount) noShowCount = teamData.noShowCount;
    }

    setFormData({
      ...formData,
      patientId: id,
      patientName: name,
      price: detectedPrice
    });

    // Guardar el estado de faltas para mostrar alerta
    setSelectedPatientNoShows(noShowCount);
  };

  // --- FUNCIÓN: COBRO RÁPIDO ---
  const handleQuickPay = async (slotKey: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    if (currentStatus === 'paid' && !window.confirm("¿Marcar este turno como NO PAGADO?")) return;

    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;

      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), {
        [`slots.${slotKey}.paymentStatus`]: newStatus
      });

      if (currentMonthData) {
        const updatedSlots = { ...currentMonthData };
        updatedSlots[slotKey] = { ...updatedSlots[slotKey], paymentStatus: newStatus as any };
        setCurrentMonthData(updatedSlots);
      }

    } catch(e) { console.error(e); alert("Error al actualizar pago."); }
    finally { setLoading(false); }
  };

  // --- FUNCIÓN: MARCAR NO SHOW (FALTA) ---
  const handleMarkNoShow = async (slotKey: string, patientId: string | undefined) => {
    if (!window.confirm("¿Marcar que el paciente NO ASISTIÓ? \n\nEsto:\n1. Cancelará la cita.\n2. Sumará +1 falta a su expediente.")) return;

    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const batch = writeBatch(db);

      // 1. Actualizar Slot a cancelado con nota especial
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      const slotPayload = {
        status: 'cancelled',
        adminNotes: '[AUSENCIA] El paciente no se presentó.',
        updatedAt: new Date().toISOString()
      };

      batch.update(agendaRef, {
        [`slots.${slotKey}.status`]: 'cancelled',
        [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes,
        [`slots.${slotKey}.updatedAt`]: slotPayload.updatedAt
      });

      // 2. Incrementar contador en el paciente
      if (patientId) {
        const patRef = doc(db, "patients", patientId);
        batch.update(patRef, {
          [`careTeam.${selectedProfId}.noShowCount`]: increment(1),
          [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
        });
      }

      await batch.commit();

      // Actualizar UI Local
      if (currentMonthData) {
        const updatedSlots = { ...currentMonthData };
        updatedSlots[slotKey] = { ...updatedSlots[slotKey], ...slotPayload as any };
        setCurrentMonthData(updatedSlots);
      }

      // Recargar pacientes para que el contador se actualice en memoria
      loadPatients();

    } catch(e) { console.error(e); alert("Error al registrar falta."); }
    finally { setLoading(false); }
  };

  // --- CORE: AGENDAR ---
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
          fullName: formData.patientName,
          contactNumber: formData.patientExternalPhone || '',
          email: formData.patientExternalEmail || '',
          isManual: true,
          linkedProfessionalId: selectedProfId,
          createdAt: serverTimestamp(),
          careTeam: {
            [selectedProfId]: {
              status: 'active',
              joinedAt: new Date().toISOString(),
              customPrice: savePricePreference ? Number(formData.price) : null
            }
          }
        });
      }
      else if (finalPatientId && savePricePreference) {
        const patRef = doc(db, "patients", finalPatientId);
        batch.update(patRef, {
          [`careTeam.${selectedProfId}.customPrice`]: Number(formData.price)
        });
      }

      const slotPayload: Partial<AgendaSlot> = { status: 'booked', patientId: finalPatientId, patientName: formData.patientName, price: Number(formData.price), adminNotes: formData.adminNotes, paymentStatus: formData.paymentStatus as any, updatedAt: new Date().toISOString() };
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      batch.update(agendaRef, { [`slots.${targetSlotKey}`]: { ...currentMonthData[targetSlotKey], ...slotPayload } });

      if (finalPatientId) {
        const patientRef = doc(db, "patients", finalPatientId); const historyRef = doc(db, "patients", finalPatientId, "gamification", "history"); const appointmentDate = getDateFromSlotKey(targetSlotKey, year, month);
        batch.update(patientRef, { [`careTeam.${selectedProfId}.nextAppointment`]: appointmentDate.toISOString(), [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString() });
        batch.set(historyRef, { lastUpdate: new Date(), appointments: arrayUnion({ date: appointmentDate.toISOString(), slotKey: targetSlotKey, professionalId: selectedProfId, status: 'booked' }) }, { merge: true });
      }

      await batch.commit();
      setCurrentMonthData({ ...currentMonthData, [targetSlotKey]: { ...currentMonthData[targetSlotKey], ...slotPayload as AgendaSlot } });
      loadPatients(); setIsFormOpen(false); setSavePricePreference(false); setSelectedPatientNoShows(0);
    } catch (e) { console.error(e); alert("Error al guardar: " + (e as any).message); } finally { setLoading(false); }
  };

  const handleSoftCancel = async (slotKey: string) => {
    const reason = window.prompt("¿Motivo de la cancelación?", "Cancelación del paciente"); if (reason === null) return;
    setLoading(true); try { const year = selectedDate.getFullYear(); const month = selectedDate.getMonth(); const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; const batch = writeBatch(db);
    const slotPayload = { status: 'cancelled', adminNotes: `[CANCELADO] ${reason}`, updatedAt: new Date().toISOString() };
    const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId); batch.update(agendaRef, { [`slots.${slotKey}.status`]: 'cancelled', [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes, [`slots.${slotKey}.updatedAt`]: slotPayload.updatedAt }); await batch.commit();
    setCurrentMonthData({ ...currentMonthData!, [slotKey]: { ...currentMonthData![slotKey], ...slotPayload } as any }); } catch (e) { console.error(e); alert("Error al cancelar.");
    } finally { setLoading(false); }
  };
  const handleReopenSlot = async (slotKey: string) => {
    if (!window.confirm("¿Reabrir este horario?")) return; setLoading(true); try { const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
    const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; const originalTime = currentMonthData![slotKey].time; const cleanSlotLocal: AgendaSlot = { status: 'available', time: originalTime, duration: workConfig.durationMinutes, price: workConfig.defaultPrice };
    const batch = writeBatch(db); const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
    batch.update(agendaRef, { [`slots.${slotKey}.status`]: 'available', [`slots.${slotKey}.price`]: workConfig.defaultPrice, [`slots.${slotKey}.duration`]: workConfig.durationMinutes, [`slots.${slotKey}.patientId`]: deleteField(), [`slots.${slotKey}.patientName`]: deleteField(), [`slots.${slotKey}.patientExternalPhone`]: deleteField(), [`slots.${slotKey}.patientExternalEmail`]: deleteField(), [`slots.${slotKey}.adminNotes`]: deleteField(), [`slots.${slotKey}.paymentStatus`]: deleteField() });
    const oldPatientId = currentMonthData![slotKey].patientId; if (oldPatientId) { batch.update(doc(db, "patients", oldPatientId), { [`careTeam.${selectedProfId}.nextAppointment`]: null }); } await batch.commit();
    setCurrentMonthData({ ...currentMonthData!, [slotKey]: cleanSlotLocal }); } catch (e) { console.error(e); alert("Error al reabrir."); } finally { setLoading(false); }
  };
  const handleSmartReleaseCheck = async (slotKey: string) => {
    if (waitlist.length > 0) { if (window.confirm(`⚠️ Hay ${waitlist.length} personas en espera. ¿ASIGNAR espacio a la lista?`)) { setSlotToReassign(slotKey); setIsWaitlistSelectorOpen(true);
    return; } }
    if(window.confirm("¿CANCELAR la cita actual?")) { handleSoftCancel(slotKey); }
  };
  const handleAssignFromWaitlist = async (waitlistItem: any) => { if (!slotToReassign || !currentMonthData) return; setLoading(true); try { const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth(); const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; const batch = writeBatch(db);
    const slotPayload: Partial<AgendaSlot> = { status: 'booked', patientId: waitlistItem.patientId || undefined, patientName: waitlistItem.patientName, patientExternalPhone: waitlistItem.patientExternalPhone, adminNotes: `[Desde Espera] ${waitlistItem.notes ||
    ''}`, paymentStatus: 'pending', updatedAt: new Date().toISOString() }; batch.update(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotToReassign}`]: { ...currentMonthData[slotToReassign], ...slotPayload } });
    if (waitlistItem.patientId) { const apptDate = getDateFromSlotKey(slotToReassign, year, month); batch.update(doc(db, "patients", waitlistItem.patientId), { [`careTeam.${selectedProfId}.nextAppointment`]: apptDate.toISOString() }); } batch.delete(doc(db, "waitlist", waitlistItem.id));
    await batch.commit(); setCurrentMonthData({ ...currentMonthData, [slotToReassign]: { ...currentMonthData[slotToReassign], ...slotPayload as AgendaSlot } }); loadWaitlist(); loadPatients(); setIsWaitlistSelectorOpen(false); setSlotToReassign(null);
    alert( `✅ Reasignado a ${waitlistItem.patientName}`); } catch (e) { console.error(e); alert("Error al reasignar."); } finally { setLoading(false); } };

  const handleAddToWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patientName) return alert("Nombre requerido");
    setLoading(true);
    try {
      await addDoc(collection(db, "waitlist"), {
        professionalId: selectedProfId,
        patientId: formData.patientId || null,
        patientName: formData.patientName,
        notes: formData.adminNotes,
        createdAt: serverTimestamp()
      });
      alert("Agregado a lista de espera.");
      setIsWaitlistFormOpen(false);
      loadWaitlist();
    } catch (e) {
      console.error(e);
      alert("Error al guardar.");
    } finally {
      setLoading(false);
    }
  };

  const openForm = (slotKey: string, slot: AgendaSlot) => {
    setTargetSlotKey(slotKey);
    setFormData({ patientId: slot.patientId || '', patientName: slot.patientName || (slot.status === 'blocked' ? 'BLOQUEADO' : ''), patientExternalPhone: slot.patientExternalPhone || '', patientExternalEmail: slot.patientExternalEmail || '', price: slot.price, adminNotes: slot.adminNotes || '', paymentStatus: slot.paymentStatus || 'pending', paymentMethod: slot.paymentMethod || 'cash' });
    setSavePricePreference(false);
    setSelectedPatientNoShows(0); // Resetear contador al abrir
    setIsFormOpen(true);
  };

  const handleScheduleNeedingPatient = (p: any) => {
    let price = workConfig.defaultPrice;
    let ns = 0;
    if (p.careTeam?.[selectedProfId]?.customPrice) price = p.careTeam[selectedProfId].customPrice;
    if (p.careTeam?.[selectedProfId]?.noShowCount) ns = p.careTeam[selectedProfId].noShowCount;

    setFormData({ patientId: p.id, patientName: p.fullName, patientExternalPhone: p.contactNumber || '', patientExternalEmail: p.email || '', price: price, adminNotes: '', paymentStatus: 'pending', paymentMethod: 'cash' });
    setSelectedPatientNoShows(ns);
    alert(`Has seleccionado a ${p.fullName}. ${ns > 0 ? `⚠️ TIENE ${ns} FALTAS.` : ''} Click en un espacio disponible para agendar.`);
  };

  const renderDaySlots = () => {
    if (!currentMonthData) return <div>Cargando...</div>;
    const dayStr = selectedDate.getDate().toString().padStart(2, '0');
    const daySlots = Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`)).sort((a, b) => a[0].localeCompare(b[0]));
    if (daySlots.length === 0) return ( <div style={{padding:'20px', textAlign:'center', color:'#777'}}> <p>No hay turnos hoy.</p> <button onClick={handleAddExtraSlot} style={{background:'#2196F3', color:'white', border:'none', padding:'8px', borderRadius:'4px', cursor:'pointer'}}>+ Agregar Turno</button> </div> );
    return (
      <div>
        {daySlots.map(([key, slot]) => {
          // --- LOGICA DE TIEMPO PASADO ---
          const [dStr, tStr] = key.split('_');
          const sH = parseInt(tStr.substring(0, 2));
          const sM = parseInt(tStr.substring(2));
          
          // Construimos fecha exacta del slot
          const slotDateObj = dayjs(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), parseInt(dStr), sH, sM));
          
          // Evaluamos si es pasado
          const isPast = slotDateObj.isBefore(dayjs());

          return (
            <div key={key} style={{borderBottom:'1px solid #eee', padding:'12px', display:'flex', alignItems:'center', gap:'15px'}}>
              <div style={{fontWeight:'bold', color:'#555', minWidth:'50px'}}>{slot.time}</div>
              <div style={{flex:1}}>
                {slot.status === 'available' ? (
                  <div 
                    onClick={() => {
                        // --- BLOQUEO FUNCIONAL ---
                        if (isPast) {
                            alert("No puedes agendar citas en una fecha u hora que ya pasó.");
                            return;
                        }
                        
                        if (formData.patientId && formData.patientName) { 
                            setTargetSlotKey(key); 
                            setIsFormOpen(true); 
                        } else { 
                            openForm(key, slot);
                        } 
                    }} 
                    style={{
                        // --- CAMBIO VISUAL ---
                        background: isPast ? '#f5f5f5' : '#F1F8E9', 
                        color: isPast ? '#aaa' : '#4CAF50', 
                        border: isPast ? '1px solid #ddd' : '1px dashed #4CAF50', 
                        padding:'8px', 
                        borderRadius:'6px', 
                        textAlign:'center', 
                        cursor: isPast ? 'not-allowed' : 'pointer'
                    }}
                  > 
                    {isPast ? 'Tiempo transcurrido' : `+ Disponible ${formData.patientId && formData.patientName ? `(Agendar a ${formData.patientName})` : ''}`}
                  </div>
                ) : slot.status === 'blocked' ? (
                  <div onClick={() => handleReopenSlot(key)} style={{background:'#FFEBEE', color:'#D32F2F', padding:'10px', borderRadius:'6px', display:'flex', justifyContent:'space-between', cursor:'pointer'}}> <span>🚫 {slot.adminNotes}</span><span> ✕ </span> </div>
                ) : slot.status === 'cancelled' ? (
                  <div style={{background: '#f5f5f5', border: '1px solid #ccc', color: '#777', padding: '10px', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    <div>
                      <div style={{textDecoration: 'line-through', fontWeight: 'bold'}}>{slot.patientName}</div>
                      <div style={{fontSize: '11px', fontStyle: 'italic', color: slot.adminNotes?.includes('AUSENCIA') ? '#D32F2F' : '#666'}}>
                        {slot.adminNotes}
                      </div>
                    </div>
                    <button onClick={() => handleReopenSlot(key)} style={{background: '#4CAF50', color: 'white', border: 'none', borderRadius: '4px', padding: '5px 10px', fontSize: '11px', cursor: 'pointer', fontWeight: 'bold'}}>↻ Reabrir</button>
                  </div>
                ) : (
                  /* --- TARJETA DE CITA ACTIVA --- */
                  <div onClick={() => openForm(key, slot)} style={{background: slot.paymentStatus==='paid'?'#E8F5E9':'#E3F2FD', borderLeft:`4px solid ${slot.paymentStatus==='paid'?'#4CAF50':'#2196F3'}`, padding:'10px', borderRadius:'6px', position:'relative', cursor:'pointer'}}>
                    <div style={{fontWeight:'bold', paddingRight:'65px'}}>{slot.patientName}</div>
                    <div style={{fontSize:'12px', color:'#666'}}>{slot.adminNotes || 'Sin notas'}</div>
                    <div style={{fontSize:'10px', fontWeight:'bold', marginTop:'3px', color:'#1565C0'}}>${slot.price}</div>

                    {/* BOTÓN DE COBRO RÁPIDO */}
                    <div
                      onClick={(e) => { e.stopPropagation(); handleQuickPay(key, slot.paymentStatus); }}
                      title={slot.paymentStatus === 'paid' ? 'Pagado (Click para deshacer)' : 'Pendiente (Click para marcar Pagado)'}
                      style={{
                        position:'absolute', right:'40px', top:'10px',
                        width:'24px', height:'24px', borderRadius:'50%',
                        background: slot.paymentStatus === 'paid' ? '#4CAF50' : '#E0E0E0',
                        color: slot.paymentStatus === 'paid' ? 'white' : '#757575',
                        display:'flex', justifyContent:'center', alignItems:'center',
                        fontWeight:'bold', fontSize:'12px', border: '1px solid #ccc', zIndex:5
                      }}
                    >
                      $
                    </div>

                    {/* NUEVO: BOTÓN DE NO SHOW (FALTA) */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleMarkNoShow(key, slot.patientId); }}
                      title="Marcar Falta (No Show)"
                      style={{
                        position:'absolute', right:'70px', top:'10px',
                        width:'24px', height:'24px', borderRadius:'50%',
                        background:'#FFEBEE', color:'#D32F2F', border:'1px solid #FFCDD2',
                        display:'flex', justifyContent:'center', alignItems:'center', cursor:'pointer', fontSize:'12px', zIndex:5
                      }}
                    >
                      🚫
                    </button>

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
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background:'#f5f5f5' }}>

      {/* SIDEBAR */}
      <div style={{ width: '280px', background: 'white', borderRight: '1px solid #ddd', padding:'20px', display:'flex', flexDirection:'column', overflowY:'auto' }}>
        <h3 style={{marginTop:0}}>Opciones</h3>
        {onBack && <button onClick={onBack} style={{marginBottom:'20px', width:'100%', padding:'10px'}}> ⬅ Volver </button>}

        <button onClick={() => setIsConfigOpen(true)} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'white', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer'}}>⚙️ Configurar</button>

        {/* BOTÓN UNIFICADO DE EVENTOS */}
        <button onClick={() => setIsEventsManagerOpen(true)} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'#E1BEE7', border:'1px solid #BA68C8', color:'#7B1FA2', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>📅 Mis Eventos</button>

        {isMonthInitialized ? (
          <button onClick={handleRegenerateMonth} style={{width:'100%', marginBottom:'15px', padding:'10px', background:'#FFF3E0', border:'1px solid #FFB74D', color:'#E65100', borderRadius:'4px', cursor:'pointer'}}>🔄 Actualizar Espacios Disponibles</button>
        ) : (
          <button onClick={handleInitializeMonth} style={{width:'100%', marginBottom:'15px', padding:'10px', background:'#FF9800', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>⚡ Inicializar Mes</button>
        )}

        <div style={{marginBottom:'20px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
          <h4 style={{margin:'0 0 10px 0', color:'#D32F2F'}}>⚠️ Requieren Cita ({patientsNeedingAppt.length})</h4>
          <div style={{maxHeight:'200px', overflowY:'auto', background:'#FFEBEE', borderRadius:'8px', padding:'5px'}}>
            {patientsNeedingAppt.length === 0 ? <div style={{fontSize:'12px', padding:'10px', color:'#D32F2F'}}>¡Agenda al día! 🎉</div> : patientsNeedingAppt.map(p => (
              <div key={p.id} style={{background:'white', marginBottom:'5px', padding:'8px', borderRadius:'4px', fontSize:'12px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                  <strong>{p.fullName}</strong>
                  <div style={{fontSize:'10px', color:'#666'}}>
                    {p.careTeam?.[selectedProfId]?.nextAppointment
                      ? `Última: ${new Date(p.careTeam[selectedProfId].nextAppointment).toLocaleDateString('es-ES', {day:'2-digit', month:'short'})}`
                      : 'Sin fecha'}
                  </div>
                </div>
                <div style={{display:'flex', gap:'5px'}}>
                  <button onClick={() => handleScheduleNeedingPatient(p)} title="Agendar" style={{border:'none', background:'#2196F3', color:'white', borderRadius:'4px', cursor:'pointer', fontSize:'14px', padding:'4px 6px'}}>📅</button>
                  <button onClick={() => handleArchivePatient(p.id, p.fullName)} title="Pausar Seguimiento" style={{border:'none', background:'#9E9E9E', color:'white', borderRadius:'4px', cursor:'pointer', fontSize:'14px', padding:'4px 6px'}}>⏸️</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginTop:'auto', borderTop:'1px solid #eee', paddingTop:'15px'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px'}}>
            <h4 style={{margin:0, color:'#666'}}> ⏳ Espera ( {waitlist.length})</h4>
            <button onClick={() => { setFormData({ ...formData, patientId: '', patientName: '', adminNotes: '' }); setIsWaitlistFormOpen(true);
            }} style={{background:'#E3F2FD', color:'#1976D2', border:'none', borderRadius:'50%', width:'24px', height:'24px', cursor:'pointer', fontWeight:'bold'}}>+</button>
          </div>
          <div style={{maxHeight:'150px', overflowY:'auto'}}>
            {waitlist.map(w => (
              <div key={w.id} style={{fontSize:'12px', padding:'5px', borderBottom:'1px solid #f0f0f0'}}>
                <div style={{fontWeight:'bold'}}>{w.patientName}</div>
                <div style={{color:'#888', fontSize:'10px'}}>{w.notes}</div>
                <button onClick={async () => { if(window.confirm("¿Borrar?")) { await deleteDoc(doc(db, "waitlist", w.id)); loadWaitlist(); }}} style={{border:'none', background:'none', color:'#D32F2F', cursor:'pointer', fontSize:'10px'}}>Borrar</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

        {/* BANNER META MENSUAL */}
        <div style={{background: '#673AB7', color: 'white', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)'}}>
          <span style={{fontWeight: 'bold', fontSize: '14px', background:'rgba(255,255,255,0.2)', padding:'2px 8px', borderRadius:'4px'}}>
            {MONTHS_LIST[selectedDate.getMonth()].toUpperCase()} - PROYECTO:
          </span>
          {isMonthInitialized ? (
            isEditingGoal ? (
              <input
                autoFocus value={monthGoal} onChange={(e) => setMonthGoal(e.target.value)} onBlur={handleSaveGoal} onKeyDown={(e) => { if (e.key === 'Enter') handleSaveGoal(); }}
                style={{flex: 1, border: 'none', borderRadius: '4px', padding: '5px', color: '#333'}}
                placeholder={`Meta para ${MONTHS_LIST[selectedDate.getMonth()]}...`}
              />
            ) : (
              <div onClick={() => setIsEditingGoal(true)} style={{flex: 1, cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.5)', paddingBottom: '2px'}} title="Click para editar">
                {monthGoal || "Click aquí para definir la meta de este mes..."} ✎
              </div>
            )
          ) : (
            <div style={{flex: 1, color: 'rgba(255,255,255,0.7)', fontStyle: 'italic', fontSize:'13px'}}> (Inicializa este mes para agregar un proyecto) </div>
          )}
        </div>

        {/* HEADER CON NAVEGACIÓN SIMPLE (Flechas + Dropdowns) */}
        <div style={{ padding: '20px', background: 'white', display:'flex', justifyContent:'center', alignItems:'center', borderBottom:'1px solid #eee', gap:'15px' }}>

          <button onClick={handlePrevMonth} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#555'}}> ◀ </button>

          <div style={{display:'flex', gap:'10px', alignItems:'center'}}>
            <select
              value={selectedDate.getMonth()}
              onChange={handleMonthChange}
              style={{padding:'8px 12px', fontSize:'18px', fontWeight:'bold', textTransform:'uppercase', border:'1px solid #ccc', borderRadius:'6px', background:'#fff', color:'#333'}}
            >
              {MONTHS_LIST.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selectedDate.getFullYear()}
              onChange={handleYearChange}
              style={{padding:'8px 12px', fontSize:'18px', fontWeight:'bold', border:'1px solid #ccc', borderRadius:'6px', background:'#fff', color:'#333'}}
            >
              {YEARS_LIST.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <button onClick={handleNextMonth} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#555'}}> ▶ </button>

        </div>

        <div style={{flex:1, padding:'20px', overflowY:'auto'}}>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', textAlign:'center', marginBottom:'10px', color:'#777', fontWeight:'bold'}}>
            {DAYS_HEADER.map(d => <div key={d}>{d}</div>)}
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'minmax(100px, 1fr)', gap:'10px'}}>
            {calendarDays.map((dateObj, i) => {
              if (!dateObj) return <div key={i} />;
              
              const isToday = dateObj.toDateString() === new Date().toDateString();
              const isPastDay = dayjs(dateObj).isBefore(dayjs(), 'day'); // VALIDACIÓN NUEVA

              const dayStr = dateObj.getDate().toString().padStart(2, '0');
              let available = 0; let hasSlots = false;
              if (currentMonthData) {
                const slots = Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`));
                if (slots.length > 0) { 
                  hasSlots = true; 
                  // FILTRO INTELIGENTE: Si es hoy, filtra por hora. Si es pasado, disponible = 0.
                  available = slots.filter(([k,v]) => {
                    if(v.status !== 'available') return false;
                    if(isPastDay) return false;
                    if(isToday) {
                      const [h, m] = v.time.split(':').map(Number);
                      const slotTime = dayjs().hour(h).minute(m);
                      return slotTime.isAfter(dayjs());
                    }
                    return true;
                  }).length;
                }
              }

              let bg = 'white'; let status = ''; let statusCol = '#999';
              
              if (isPastDay) {
                bg = '#f9f9f9'; // Gris para días pasados
                // Sin texto de status
              } else if (hasSlots) {
                if (available === 0) { bg = '#FFEBEE'; status = 'Agotado'; statusCol = '#D32F2F'; }
                else { bg = '#E8F5E9'; status = `${available} Espacios Disponibles`; statusCol = '#2E7D32'; }
              }

              return (
                <div key={i} onClick={() => { setSelectedDate(dateObj); setIsDayViewOpen(true); }}
                  style={{
                    background: isToday ? '#E3F2FD' : bg, border: isToday ? '2px solid #2196F3' : '1px solid #ddd',
                    borderRadius: '8px', padding:'10px', cursor:'pointer', display:'flex', flexDirection:'column', justifyContent:'space-between'
                  }}>
                  <span style={{fontWeight:'bold', color: isToday ? '#1565C0' : '#333', fontSize:'18px'}}>{dateObj.getDate()}</span>
                  {status && <div style={{alignSelf:'flex-end', fontSize:'11px', fontWeight:'bold', color: statusCol, background:'rgba(255,255,255,0.7)', padding:'2px 6px', borderRadius:'10px'}}>{status}</div>}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {isDayViewOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'end', zIndex:10}}>
          <div style={{width:'400px', background:'white', height:'100%', padding:'20px', display:'flex', flexDirection:'column', boxShadow:'-5px 0 20px rgba(0,0,0,0.1)'}}>
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
              <div>
                <h2 style={{margin:0}}>{selectedDate.toLocaleDateString('es-ES', {weekday:'long', day:'numeric'})}</h2>
                <div style={{display:'flex', gap:'10px', marginTop:'10px'}}>
                  <button onClick={handleBlockDay} style={{fontSize:'12px', padding:'5px 12px', background:'#FFEBEE', color:'#D32F2F', border:'1px solid #FFCDD2', borderRadius:'20px', cursor:'pointer', fontWeight:'bold'}}>🚫 Bloquear día</button>
                  <button onClick={handleAddExtraSlot} style={{fontSize:'12px', padding:'5px 12px', background:'#E3F2FD', color:'#1565C0', border:'1px solid #BBDEFB', borderRadius:'20px', cursor:'pointer', fontWeight:'bold'}}>➕ Turno Extra</button>
                </div>
              </div>
              <button onClick={() => setIsDayViewOpen(false)} style={{border:'none', background:'none', fontSize:'24px', cursor:'pointer'}}> ✕ </button>
            </div>
            <div style={{flex:1, overflowY:'auto'}}>{renderDaySlots()}</div>
          </div>
        </div>
      )}

      {/* MODAL GESTOR DE EVENTOS */}
      {isEventsManagerOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:50}}>
          <div style={{background:'white', padding:'0', borderRadius:'12px', width:'500px', maxHeight:'80vh', overflow:'hidden', display:'flex', flexDirection:'column'}}>
            <div style={{padding:'20px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f9f9f9'}}>
              <h3 style={{margin:0}}>📅 Eventos del Año</h3>
              <button onClick={() => setIsNewEventModalOpen(true)} style={{background:'#4CAF50', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>+ Nuevo Evento</button>
            </div>

            <div style={{display:'flex', borderBottom:'1px solid #eee'}}>
              <div onClick={() => setEventsTab('upcoming')} style={{flex:1, padding:'15px', textAlign:'center', cursor:'pointer', background: eventsTab==='upcoming' ? 'white' : '#f0f0f0', borderBottom: eventsTab==='upcoming' ?
                '2px solid #2196F3' : 'none', fontWeight: eventsTab==='upcoming' ? 'bold' : 'normal'}}>🚀 Próximos</div>
              <div onClick={() => setEventsTab('past')} style={{flex:1, padding:'15px', textAlign:'center', cursor:'pointer', background: eventsTab==='past' ? 'white' : '#f0f0f0', borderBottom: eventsTab==='past' ?
                '2px solid #2196F3' : 'none', fontWeight: eventsTab==='past' ? 'bold' : 'normal'}}>📜 Historial</div>
            </div>

            <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
              {annualEvents.filter(e => {
                const end = dayjs(e.endDate);
                return eventsTab === 'upcoming' ? end.isAfter(dayjs().subtract(1, 'day')) : end.isBefore(dayjs().subtract(1, 'day'));
              }).length === 0 && <div style={{textAlign:'center', color:'#999', marginTop:'20px'}}>No hay eventos en esta lista.</div>}

              {annualEvents.filter(e => {
                const end = dayjs(e.endDate);
                return eventsTab === 'upcoming' ? end.isAfter(dayjs().subtract(1, 'day')) : end.isBefore(dayjs().subtract(1, 'day'));
              }).map(e => (
                <div key={e.id} style={{border:'1px solid #eee', borderRadius:'8px', padding:'15px', marginBottom:'10px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                  <div>
                    <div style={{fontWeight:'bold', fontSize:'16px'}}>{e.title}</div>
                    <div style={{fontSize:'12px', color:'#666'}}>
                      {dayjs(e.startDate).format('DD MMM')} - {dayjs(e.endDate).format('DD MMM YYYY')}
                    </div>
                  </div>
                  <div style={{display:'flex', gap:'5px'}}>
                    <button onClick={() => openEditEvent(e)} title="Editar" style={{border:'none', background:'#E3F2FD', color:'#1565C0', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>✏️</button>
                    <button onClick={() => handleDeleteEvent(e)} title="Eliminar y Liberar" style={{border:'none', background:'#FFEBEE', color:'#D32F2F', borderRadius:'4px', padding:'5px 10px', cursor:'pointer'}}>🗑️</button>
                  </div>
                </div>
              ))}
            </div>

            <div style={{padding:'15px', borderTop:'1px solid #eee', textAlign:'right'}}>
              <button onClick={() => setIsEventsManagerOpen(false)} style={{padding:'8px 20px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NUEVO/EDITAR EVENTO */}
      {isNewEventModalOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:60}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px'}}>
            <h3>{editingEventId ? '✏️ Editar Evento' : '➕ Nuevo Evento'}</h3>
            <p style={{fontSize:'13px', color:'#666', marginBottom:'20px'}}>
              Esto bloqueará la agenda automáticamente.
            </p>

            <DateSelectorRow label="Desde:" dateValue={newEventData.start} onChange={(d) => setNewEventData({...newEventData, start: d})} />
            <DateSelectorRow label="Hasta:" dateValue={newEventData.end} onChange={(d) => setNewEventData({...newEventData, end: d})} />

            <label style={{display:'block', marginTop:'15px'}}>
              <span style={{fontSize:'12px', fontWeight:'bold', color:'#666'}}>Título del Evento:</span>
              <input type="text" value={newEventData.title} onChange={e => setNewEventData({...newEventData, title: e.target.value})} style={{width:'100%', padding:'8px', boxSizing:'border-box', marginTop:'5px', borderRadius:'4px', border:'1px solid #ccc'}} placeholder="Ej: Congreso, Vacaciones..." />
            </label>

            <div style={{marginTop:'20px', textAlign:'right'}}>
              <button onClick={() => { setIsNewEventModalOpen(false); setEditingEventId(null); setConflictList([]); }} style={{marginRight:'10px', padding:'8px 15px', background:'#eee', border:'none', borderRadius:'4px', cursor:'pointer'}}>Cancelar</button>
              <button onClick={handleSaveEvent} style={{background:'#4CAF50', color:'white', border:'none', padding:'8px 15px', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* NUEVO MODAL: RESOLUCIÓN DE CONFLICTOS */}
      {isConflictModalOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:100}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'500px', boxShadow:'0 0 30px rgba(0,0,0,0.3)'}}>
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
              <span style={{fontSize:'30px'}}>⚠️</span>
              <div>
                <h3 style={{margin:0, color:'#D32F2F'}}>Conflicto Detectado</h3>
                <p style={{margin:0, color:'#666', fontSize:'14px'}}>Hay {conflictList.length} citas en las fechas del evento.</p>
              </div>
            </div>

            <div style={{maxHeight:'300px', overflowY:'auto', background:'#FFF8F8', border:'1px solid #FFCDD2', borderRadius:'8px', padding:'10px'}}>
              {conflictList.length === 0 ? <div style={{padding:'20px', textAlign:'center', color:'#2E7D32', fontWeight:'bold'}}>✅ Todos los conflictos resueltos.</div> :
                conflictList.map((c) => (
                  <div key={c.slotKey} style={{background:'white', padding:'10px', marginBottom:'10px', borderRadius:'6px', border:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                    <div>
                      <div style={{fontWeight:'bold'}}>{c.slotData.patientName}</div>
                      <div style={{fontSize:'12px', color:'#555'}}>
                        📅 {dayjs(c.date).format('DD MMM')} - 🕒 {c.slotData.time}
                      </div>
                    </div>
                    <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                      <button onClick={() => handleResolveConflictToWaitlist(c)} style={{background:'#7B1FA2', color:'white', border:'none', borderRadius:'4px', padding:'5px 10px', fontSize:'11px', cursor:'pointer'}}>⏳ Mover a Espera</button>
                      <button onClick={() => handleKeepConflict(c)} style={{background:'#eee', color:'#333', border:'none', borderRadius:'4px', padding:'5px 10px', fontSize:'11px', cursor:'pointer'}}>Mantener Cita</button>
                    </div>
                  </div>
                ))}
            </div>

            <div style={{marginTop:'20px', textAlign:'right', display:'flex', justifyContent:'space-between'}}>
              <button onClick={() => { setIsConflictModalOpen(false); setPendingEventSave(null); }} style={{background:'none', border:'none', color:'#666', cursor:'pointer', textDecoration:'underline'}}>Cancelar Evento</button>

              <button onClick={finalizeEventSave} style={{padding:'10px 20px', background:'#D32F2F', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold', opacity: conflictList.length > 0 ? 0.7 : 1}}>
                {conflictList.length > 0 ? 'Ignorar Restantes y Bloquear' : 'Finalizar y Bloquear'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN GENÉRICO */}
      {confirmModal.isOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:100}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px', boxShadow:'0 10px 25px rgba(0,0,0,0.2)'}}>
            <h3 style={{marginTop:0}}>{confirmModal.title}</h3>
            <p style={{color:'#666', whiteSpace:'pre-line'}}>{confirmModal.message}</p>
            <div style={{textAlign:'right', marginTop:'20px'}}>
              <button onClick={() => setConfirmModal({...confirmModal, isOpen:false})} style={{marginRight:'10px', padding:'8px 15px', border:'none', background:'#eee', borderRadius:'4px', cursor:'pointer'}}>Cancelar</button>
              <button onClick={confirmModal.onConfirm} style={{padding:'8px 15px', border:'none', background:'#2196F3', color:'white', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* FORMULARIO DE CITA */}
      {isFormOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:20}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'400px', maxHeight:'90vh', overflowY:'auto'}}>
            <h3>{formData.patientName ? 'Editar Cita' : 'Nueva Cita'}</h3>

            {/* ALERTA DE FALTAS EN EL FORMULARIO */}
            {selectedPatientNoShows > 0 && (
              <div style={{background:'#FFEBEE', color:'#D32F2F', padding:'10px', borderRadius:'6px', marginBottom:'15px', border:'1px solid #FFCDD2', fontSize:'13px', display:'flex', alignItems:'center', gap:'10px'}}>
                <span style={{fontSize:'20px'}}>⚠️</span>
                <div>
                  <strong>Cuidado:</strong> Este paciente tiene <b>{selectedPatientNoShows} faltas</b> registradas.
                </div>
              </div>
            )}

            <form onSubmit={handleSaveAppointment}>
              {/* Pasamos handlePatientSelect personalizado */}
              <PatientSelector
                patients={patients}
                selectedPatientId={formData.patientId}
                manualNameValue={formData.patientName}
                onSelect={handlePatientSelect}
              />

              <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:'12px', color:'#666'}}>Precio Consulta</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                    style={{width:'100%', padding:'8px', boxSizing:'border-box', border:'1px solid #ccc', borderRadius:'4px'}}
                  />
                </div>
                <div style={{flex:1}}>
                  <label style={{fontSize:'12px', color:'#666'}}>Método Pago</label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                    style={{width:'100%', padding:'8px', boxSizing:'border-box', border:'1px solid #ccc', borderRadius:'4px'}}
                  >
                    <option value="cash">Efectivo</option>
                    <option value="transfer">Transferencia</option>
                    <option value="card">Tarjeta</option>
                  </select>
                </div>
              </div>

              {/* CHECKBOX PARA FIJAR PRECIO */}
              <div style={{marginTop:'10px', background:'#f9f9f9', padding:'8px', borderRadius:'4px', display:'flex', alignItems:'center'}}>
                <input
                  type="checkbox"
                  id="savePriceCheck"
                  checked={savePricePreference}
                  onChange={(e) => setSavePricePreference(e.target.checked)}
                  style={{marginRight:'8px', cursor:'pointer'}}
                />
                <label htmlFor="savePriceCheck" style={{fontSize:'12px', cursor:'pointer', userSelect:'none'}}>
                  Fijar <b>${formData.price}</b> como precio para futuras citas de este paciente.
                </label>
              </div>

              <textarea placeholder="Notas..." value={formData.adminNotes} onChange={e => setFormData({...formData, adminNotes: e.target.value})} style={{width:'100%', marginTop:'15px', padding:'8px', minHeight:'60px'}} />

              <div style={{marginTop:'20px', textAlign:'right'}}>
                <button type="button" onClick={() => setIsFormOpen(false)} style={{marginRight:'10px', padding:'8px 15px', border:'none', background:'#eee', borderRadius:'4px', cursor:'pointer'}}>Cancelar</button>
                <button type="submit" style={{padding:'8px 15px', background:'#2196F3', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isWaitlistFormOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:30}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'350px'}}>
            <h3>Agregar a Lista de Espera</h3>
            <form onSubmit={handleAddToWaitlist}>
              <PatientSelector patients={patients} selectedPatientId={formData.patientId} manualNameValue={formData.patientName} onSelect={(id, name) => setFormData({...formData, patientId: id, patientName: name})} />
              <textarea placeholder="Preferencia (Ej: Solo tardes)..." value={formData.adminNotes} onChange={e => setFormData({...formData, adminNotes: e.target.value})} style={{width:'100%', marginTop:'15px', padding:'8px'}} />
              <div style={{marginTop:'20px', textAlign:'right'}}>
                <button type="button" onClick={() => setIsWaitlistFormOpen(false)} style={{marginRight:'10px', padding:'8px'}}>Cancelar</button>
                <button type="submit" style={{padding:'8px 15px', background:'#9C27B0', color:'white', border:'none'}}>Encolar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isWaitlistSelectorOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:40}}>
          <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'400px', maxHeight:'80vh', overflowY:'auto'}}>
            <h3 style={{color:'#2E7D32', marginTop:0}}>♻️ Reasignar Espacio</h3>
            <p style={{fontSize:'13px', color:'#666'}}>Selecciona al paciente que tomará este lugar:</p>
            {waitlist.map(w => (
              <div key={w.id} onClick={() => handleAssignFromWaitlist(w)} style={{padding:'10px', border:'1px solid #eee', marginBottom:'8px', borderRadius:'6px', cursor:'pointer', background:'#f9f9f9', transition:'0.2s'}}>
                <div style={{fontWeight:'bold'}}>{w.patientName}</div>
                <div style={{fontSize:'12px', color:'#555'}}>Nota: {w.notes}</div>
                <div style={{fontSize:'10px', color:'#999', marginTop:'4px'}}>Click para asignar</div>
              </div>
            ))}
            <div style={{marginTop:'20px', textAlign:'right'}}>
              <button onClick={() => { setIsWaitlistSelectorOpen(false); setSlotToReassign(null); }} style={{padding:'8px'}}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <AgendaConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} currentConfig={workConfig} onSave={handleSaveConfig} />
    </div>
  );
}