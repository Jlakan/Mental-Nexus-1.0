import React, { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs,
  setDoc, updateDoc, writeBatch, arrayUnion, orderBy, deleteDoc, addDoc, serverTimestamp, deleteField, increment
} from "firebase/firestore";
import { db } from '../../services/firebase'; 

// Componentes externos (mantenidos)
import AppointmentForm from './AppointmentForm';
import AgendaConfigModal from '../AgendaConfigModal';

// Utils
import { generateMonthSkeleton } from '../../utils/agendaGenerator';
import type { MonthlySlotMap, WorkConfig, AgendaSlot } from '../../utils/agendaTypes';

import dayjs from 'dayjs';
import 'dayjs/locale/es';
import updateLocale from 'dayjs/plugin/updateLocale';

// CONFIGURACIÓN DAYJS
dayjs.extend(updateLocale);
dayjs.locale('es');
dayjs.updateLocale('es', { weekStart: 0 });

// --- INTERFACES ---
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

// --- CONSTANTES ---
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

// --- HELPERS ---
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

export default function AgendaMain({ userRole, currentUserId, onBack }: Props) {
  // ----------------------------------------------------------------------
  // 1. ESTADO GLOBAL
  // ----------------------------------------------------------------------
  
  // Responsive
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  // Contexto
  const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>('');

  // Agenda Data
  const [currentMonthData, setCurrentMonthData] = useState<MonthlySlotMap | null>(null);
  const [isMonthInitialized, setIsMonthInitialized] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  const [monthGoal, setMonthGoal] = useState<string>('');
  const [isEditingGoal, setIsEditingGoal] = useState(false);

  // Listas Auxiliares
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [patientsNeedingAppt, setPatientsNeedingAppt] = useState<any[]>([]);
  const [annualEvents, setAnnualEvents] = useState<AnnualEvent[]>([]);
  const [pausedList, setPausedList] = useState<any[]>([]);

  // UI State & Config
  const [workConfig, setWorkConfig] = useState<WorkConfig>(DEFAULT_CONFIG);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  
  // Modales
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDayViewOpen, setIsDayViewOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isWaitlistFormOpen, setIsWaitlistFormOpen] = useState(false);
  const [isWaitlistSelectorOpen, setIsWaitlistSelectorOpen] = useState(false);
  
  // Gestión de Eventos (Restaurado)
  const [isEventsManagerOpen, setIsEventsManagerOpen] = useState(false);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [originalEventData, setOriginalEventData] = useState<AnnualEvent | null>(null);
  const [newEventData, setNewEventData] = useState<{start: dayjs.Dayjs, end: dayjs.Dayjs, title: string}>({
    start: dayjs(), end: dayjs(), title: ''
  });

  // Conflictos (Restaurado)
  const [conflictList, setConflictList] = useState<ConflictItem[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingEventSave, setPendingEventSave] = useState<{start: dayjs.Dayjs, end: dayjs.Dayjs, title: string, isEdit: boolean} | null>(null);

  // Helpers de Cita
  const [slotToReassign, setSlotToReassign] = useState<string | null>(null);
  const [targetSlotKey, setTargetSlotKey] = useState<string | null>(null);
  const [savePricePreference, setSavePricePreference] = useState(false);
  const [selectedPatientNoShows, setSelectedPatientNoShows] = useState<number>(0);
  
  const [formData, setFormData] = useState({
    patientId: '', patientName: '', patientExternalPhone: '', patientExternalEmail: '',
    price: 500, adminNotes: '', paymentStatus: 'pending', paymentMethod: 'cash'
  });

  // --- EFECTOS ---

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if(isNewEventModalOpen && !editingEventId) {
      setNewEventData(prev => ({ ...prev, start: dayjs(selectedDate).startOf('month'), end: dayjs(selectedDate).endOf('month'), title: '' }));
    }
  }, [isNewEventModalOpen, editingEventId]);

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
            setSelectedProfId(pros[0].id);
            if ((pros[0] as any).agendaSettings) setWorkConfig((pros[0] as any).agendaSettings);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadContext();
  }, [currentUserId, userRole]);

  useEffect(() => {
    if (!selectedProfId) return;
    loadMonthDoc();
    loadPatients();
    loadWaitlist();
    loadAnnualEvents();
  }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

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
      const paused = patients.filter(p => p.careTeam?.[selectedProfId]?.status === 'inactive');
      setPausedList(paused);
    }
  }, [patients, selectedProfId]);

  // --- LOGICA DE DATOS ---

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
    const q = query(collection(db, "waitlist"), where("professionalId", "==", selectedProfId), orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    setWaitlist(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  const handleInitializeMonth = async () => {
    if (!window.confirm(`¿Generar agenda para ${MONTHS_LIST[selectedDate.getMonth()]}?`)) return;
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
      setCurrentMonthData(emptySlots); setIsMonthInitialized(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
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

  const handleReactivatePatient = async (patientId: string, patientName: string) => {
    if (!window.confirm(`¿Reactivar a ${patientName}?`)) return;
    setLoading(true);
    try {
        await updateDoc(doc(db, "patients", patientId), {
            [`careTeam.${selectedProfId}.status`]: 'active',
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
        });
        await loadPatients();
        setPausedList(prev => prev.filter(p => p.id !== patientId));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LOGICA GESTIÓN DE EVENTOS (Complex Logic V1) ---

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
                status: 'available', time: slot.time, duration: workConfig.durationMinutes, price: workConfig.defaultPrice
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
         if(window.confirm(`Se bloqueará la agenda del ${startD.format('DD/MM')} al ${endD.format('DD/MM')}.\n¿Continuar?`)) {
             await finalizeEventSave();
         }
        setLoading(false);
      }
    } catch (e) { console.error(e); setLoading(false); }
  };

  const handleDeleteEvent = async (event: AnnualEvent) => {
      if(!window.confirm(`¿Eliminar "${event.title}" y liberar sus horarios?`)) return;
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
      } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LOGICA DE CITAS Y EDICIÓN ---

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
      }
      
      const slotPayload: Partial<AgendaSlot> = { 
        status: 'booked', patientId: finalPatientId, patientName: formData.patientName, 
        price: Number(formData.price), adminNotes: formData.adminNotes, paymentStatus: formData.paymentStatus as any, updatedAt: new Date().toISOString() 
      };
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      batch.update(agendaRef, { [`slots.${targetSlotKey}`]: { ...currentMonthData[targetSlotKey], ...slotPayload } });

      if (finalPatientId) {
        const appointmentDate = getDateFromSlotKey(targetSlotKey, year, month);
        batch.update(doc(db, "patients", finalPatientId), { [`careTeam.${selectedProfId}.nextAppointment`]: appointmentDate.toISOString(), [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString() });
        batch.set(doc(db, "patients", finalPatientId, "gamification", "history"), { lastUpdate: new Date(), appointments: arrayUnion({ date: appointmentDate.toISOString(), slotKey: targetSlotKey, professionalId: selectedProfId, status: 'booked' }) }, { merge: true });
      }
      await batch.commit();
      setCurrentMonthData({ ...currentMonthData, [targetSlotKey]: { ...currentMonthData[targetSlotKey], ...slotPayload as AgendaSlot } });
      loadPatients(); setIsFormOpen(false); setTargetSlotKey(null);
    } catch (e) { console.error(e); alert("Error al guardar."); } finally { setLoading(false); }
  };

  const handleQuickPay = async (slotKey: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotKey}.paymentStatus`]: newStatus });
      if (currentMonthData) setCurrentMonthData({ ...currentMonthData, [slotKey]: { ...currentMonthData[slotKey], paymentStatus: newStatus as any } });
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleMarkNoShow = async (slotKey: string, patientId: string | undefined) => {
    if (!window.confirm("¿Marcar NO SHOW?")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const batch = writeBatch(db);
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      batch.update(agendaRef, { [`slots.${slotKey}.status`]: 'cancelled', [`slots.${slotKey}.adminNotes`]: '[AUSENCIA] El paciente no se presentó.', [`slots.${slotKey}.paymentStatus`]: deleteField() });
      if (patientId) {
        const patRef = doc(db, "patients", patientId);
        batch.update(patRef, { [`careTeam.${selectedProfId}.noShowCount`]: increment(1) });
      }
      await batch.commit();
      if (currentMonthData) { setCurrentMonthData({ ...currentMonthData, [slotKey]: { ...currentMonthData[slotKey], status: 'cancelled', adminNotes: '[AUSENCIA] El paciente no se presentó.' } as any }); }
      loadPatients();
    } catch(e) { console.error(e); } finally { setLoading(false); }
  };

  const handleReopenSlot = async (slotKey: string) => {
    if (!window.confirm("¿Reabrir este horario?")) return; 
    setLoading(true);
    try { 
        const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
        const monthDocId = `${year}_${month.toString().padStart(2, '0')}`; 
        const originalTime = currentMonthData![slotKey].time; 
        const cleanSlotLocal: AgendaSlot = { status: 'available', time: originalTime, duration: workConfig.durationMinutes, price: workConfig.defaultPrice };
        const batch = writeBatch(db); 
        const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
        batch.update(agendaRef, { 
            [`slots.${slotKey}.status`]: 'available', [`slots.${slotKey}.price`]: workConfig.defaultPrice, [`slots.${slotKey}.duration`]: workConfig.durationMinutes, 
            [`slots.${slotKey}.patientId`]: deleteField(), [`slots.${slotKey}.patientName`]: deleteField(), [`slots.${slotKey}.paymentStatus`]: deleteField() 
        });
        if (currentMonthData![slotKey].patientId) { batch.update(doc(db, "patients", currentMonthData![slotKey].patientId!), { [`careTeam.${selectedProfId}.nextAppointment`]: null }); } 
        await batch.commit();
        setCurrentMonthData({ ...currentMonthData!, [slotKey]: cleanSlotLocal }); 
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // --- LOGICA DAY VIEW EXTRA ---
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

  // --- RENDER HELPERS ---
  const DateSelectorRow = ({ label, dateValue, onChange }: { label: string, dateValue: dayjs.Dayjs, onChange: (d: dayjs.Dayjs) => void }) => {
    const daysInMonth = dateValue.daysInMonth();
    const days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    return (
      <div className="mb-4">
        <label className="block text-xs text-slate-400 mb-1">{label}</label>
        <div className="flex gap-2">
          <select value={dateValue.date()} onChange={(e) => onChange(dateValue.date(parseInt(e.target.value)))} className="bg-slate-800 border border-slate-700 text-white rounded p-1 flex-1">{days.map(d => <option key={d} value={d}>{d}</option>)}</select>
          <select value={dateValue.month()} onChange={(e) => onChange(dateValue.month(parseInt(e.target.value)))} className="bg-slate-800 border border-slate-700 text-white rounded p-1 flex-[2]">{MONTHS_LIST.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
          <select value={dateValue.year()} onChange={(e) => onChange(dateValue.year(parseInt(e.target.value)))} className="bg-slate-800 border border-slate-700 text-white rounded p-1 flex-1">{YEARS_LIST.map(y => <option key={y} value={y}>{y}</option>)}</select>
        </div>
      </div>
    );
  };

  const renderDaySlots = () => {
    if (!currentMonthData) return <div>Cargando...</div>;
    const dayStr = selectedDate.getDate().toString().padStart(2, '0');
    const daySlots = Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`)).sort((a, b) => a[0].localeCompare(b[0]));
    if (daySlots.length === 0) return <div className="p-8 text-center text-slate-500">No hay turnos hoy.</div>;
    return (
      <div className="space-y-2">
        {daySlots.map(([key, slot]) => (
            <div key={key} className="flex items-center gap-3 p-3 bg-slate-800 rounded border border-slate-700">
                <div className="font-bold text-cyan-400 w-12">{slot.time}</div>
                <div className="flex-1">
                    {slot.status === 'booked' ? (
                        <div className="flex justify-between items-center">
                            <div>
                                <div className="font-bold text-white">{slot.patientName}</div>
                                <div className="text-xs text-slate-400">{slot.adminNotes}</div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => handleQuickPay(key, slot.paymentStatus)} className={`px-2 py-1 rounded text-xs ${slot.paymentStatus === 'paid' ? 'bg-green-600' : 'bg-slate-600'}`}>$</button>
                                <button onClick={() => handleReopenSlot(key)} className="px-2 py-1 rounded text-xs bg-red-900/50 text-red-300">Lib</button>
                            </div>
                        </div>
                    ) : slot.status === 'blocked' ? (
                        <div className="flex justify-between items-center text-red-400 bg-red-900/20 p-2 rounded">
                            <span>🚫 {slot.adminNotes}</span>
                            <button onClick={() => handleReopenSlot(key)} className="text-xs border border-red-500 rounded px-2">X</button>
                        </div>
                    ) : (
                        <div onClick={() => handleOpenForm(key, slot)} className="text-green-400 cursor-pointer hover:underline">+ Disponible</div>
                    )}
                </div>
            </div>
        ))}
      </div>
    );
  };

  const handleOpenForm = (slotKey: string, slot: any) => {
      setTargetSlotKey(slotKey);
      setFormData({
          patientId: slot.patientId || '', patientName: slot.patientName || '',
          patientExternalPhone: slot.patientExternalPhone || '', patientExternalEmail: slot.patientExternalEmail || '',
          price: slot.price || workConfig.defaultPrice, adminNotes: slot.adminNotes || '',
          paymentStatus: slot.paymentStatus || 'pending', paymentMethod: slot.paymentMethod || 'cash'
      });
      setIsFormOpen(true);
  };

  const handleAssignFromWaitlist = async (waitlistItem: any) => {
    if (!slotToReassign || !currentMonthData) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const batch = writeBatch(db);
      
      const slotPayload: Partial<AgendaSlot> = { 
        status: 'booked', patientId: waitlistItem.patientId || undefined, patientName: waitlistItem.patientName, 
        adminNotes: `[Desde Espera] ${waitlistItem.notes || ''}`, paymentStatus: 'pending', updatedAt: new Date().toISOString() 
      };
      
      batch.update(doc(db, "professionals", selectedProfId, "availability", monthDocId), { [`slots.${slotToReassign}`]: { ...currentMonthData[slotToReassign], ...slotPayload } });
      if (waitlistItem.patientId) { 
        const apptDate = getDateFromSlotKey(slotToReassign, year, month); 
        batch.update(doc(db, "patients", waitlistItem.patientId), { [`careTeam.${selectedProfId}.nextAppointment`]: apptDate.toISOString() }); 
      }
      batch.delete(doc(db, "waitlist", waitlistItem.id));
      await batch.commit();
      
      setCurrentMonthData({ ...currentMonthData, [slotToReassign]: { ...currentMonthData[slotToReassign], ...slotPayload as AgendaSlot } });
      loadWaitlist(); loadPatients(); setIsWaitlistSelectorOpen(false); setSlotToReassign(null);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // ----------------------------------------------------------------------
  // RENDER PRINCIPAL
  // ----------------------------------------------------------------------

  const calendarDays = getCalendarGrid(selectedDate);

  return (
    <div className="flex flex-col h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      
      {/* HEADER */}
      <header className="h-16 flex items-center justify-between px-6 bg-slate-800/50 border-b border-slate-700 backdrop-blur-sm z-20">
        <div className="flex items-center gap-4">
          {onBack && <button onClick={onBack} className="text-slate-400 hover:text-white">⬅</button>}
          <h2 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-400 uppercase">
            {MONTHS_LIST[selectedDate.getMonth()]} {selectedDate.getFullYear()}
          </h2>
          {isMonthInitialized && (
             <div className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-400 flex items-center gap-2">
                 <span>META:</span>
                 {isEditingGoal ? (
                     <input autoFocus value={monthGoal} onChange={e => setMonthGoal(e.target.value)} onBlur={() => { handleInitializeMonth(); setIsEditingGoal(false); }} className="bg-transparent text-white w-20 outline-none border-b border-cyan-500" />
                 ) : ( <span onClick={() => setIsEditingGoal(true)} className="cursor-pointer hover:text-white">{monthGoal || 'Definir $'} ✎</span> )}
             </div>
          )}
        </div>

        <div className="flex items-center gap-3">
            <button onClick={() => setIsEventsManagerOpen(true)} className="bg-purple-900/50 hover:bg-purple-800 text-purple-200 px-3 py-1 rounded text-sm border border-purple-500/30">📅 Eventos</button>
            <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()-1)))} className="px-3 hover:bg-slate-700 rounded text-slate-300">◀</button>
                <button onClick={() => setSelectedDate(new Date())} className="px-3 text-sm font-bold text-cyan-500">HOY</button>
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()+1)))} className="px-3 hover:bg-slate-700 rounded text-slate-300">▶</button>
            </div>
            {!isMonthInitialized && !loading && (
                 <button onClick={handleInitializeMonth} className="bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-lg shadow-purple-900/50 animate-pulse">⚡ Inicializar</button>
            )}
            <button onClick={() => setIsConfigOpen(true)} className="p-2 text-slate-400 hover:text-white transition bg-slate-800 rounded-full">⚙️</button>
            <button className="md:hidden p-2" onClick={() => setShowMobileSidebar(!showMobileSidebar)}>☰</button>
        </div>
      </header>

      {/* BODY */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* SIDEBAR */}
        <div className={`absolute md:relative z-10 h-full w-80 bg-slate-900 border-r border-slate-700 p-4 overflow-y-auto transition-transform duration-300 ${isMobile ? (showMobileSidebar ? 'translate-x-0' : '-translate-x-full') : 'translate-x-0'}`}>
             <div className="mb-6">
                <div className="flex justify-between items-center mb-3">
                    <h3 className="text-xs font-bold text-orange-400 uppercase tracking-widest">Lista de Espera <span className="text-slate-500">({waitlist.length})</span></h3>
                    <button onClick={() => setIsWaitlistFormOpen(true)} className="text-xs bg-slate-800 px-2 py-1 rounded hover:bg-slate-700">+</button>
                </div>
                <div className="space-y-2">
                    {waitlist.map(w => (
                        <div key={w.id} className="p-3 bg-slate-800/50 rounded border border-slate-700/50 hover:border-orange-500/30 transition group relative">
                            <div className="font-bold text-slate-200 text-sm">{w.patientName}</div>
                            <div className="text-xs text-slate-500 mt-1 truncate">{w.notes}</div>
                            <button onClick={() => { if(window.confirm("¿Borrar?")) { deleteDoc(doc(db, "waitlist", w.id)); loadWaitlist(); } }} className="absolute top-2 right-2 text-red-500 opacity-0 group-hover:opacity-100">✕</button>
                        </div>
                    ))}
                </div>
             </div>
             <div className="mb-6">
                <h3 className="text-xs font-bold text-green-400 uppercase tracking-widest mb-3">Requieren Cita</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                    {patientsNeedingAppt.map(p => (
                        <div key={p.id} onClick={() => { setFormData({...formData, patientId: p.id, patientName: p.fullName}); alert(`Seleccionado: ${p.fullName}.`); if(isMobile) setShowMobileSidebar(false); }} className="p-2 bg-slate-800/30 rounded flex justify-between items-center border border-slate-700/30 cursor-pointer hover:bg-slate-800">
                            <span className="text-xs text-slate-300">{p.fullName}</span>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        </div>
                    ))}
                </div>
             </div>
             <div className="mb-6">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Pausados</h3>
                 <div className="space-y-1">
                    {pausedList.map(p => (
                        <div key={p.id} className="flex justify-between items-center text-xs text-slate-500 p-1 hover:bg-slate-800 rounded">
                            <span>{p.fullName}</span>
                            <button onClick={() => handleReactivatePatient(p.id, p.fullName)} className="text-blue-400 hover:text-blue-300">↻</button>
                        </div>
                    ))}
                </div>
             </div>
        </div>

        {/* CALENDARIO */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-950/50 relative">
            {loading && <div className="absolute inset-0 bg-slate-900/80 z-50 flex items-center justify-center"><div className="animate-spin text-4xl">💠</div></div>}
            
            <div className="grid grid-cols-7 gap-2 mb-2">
                {['DOM','LUN','MAR','MIE','JUE','VIE','SAB'].map(d => <div key={d} className="text-center py-2 font-bold text-slate-600 text-xs tracking-wider">{d}</div>)}
            </div>

            <div className="grid grid-cols-7 gap-2 auto-rows-min pb-20">
                {calendarDays.map((dateObj, i) => {
                    if (!dateObj) return <div key={i} className="bg-transparent" />;
                    const isToday = dateObj.toDateString() === new Date().toDateString();
                    const dayStr = dateObj.getDate().toString().padStart(2, '0');
                    const daySlots = currentMonthData ? Object.entries(currentMonthData).filter(([k]) => k.startsWith(`${dayStr}_`)).sort((a, b) => a[0].localeCompare(b[0])) : [];
                    
                    return (
                        <div key={i} 
                             onClick={() => { setSelectedDate(dateObj); setIsDayViewOpen(true); }}
                             className={`min-h-[120px] p-2 border rounded-lg transition-all flex flex-col cursor-pointer hover:border-slate-600 ${isToday ? 'bg-slate-800/80 border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'bg-slate-900 border-slate-800'}`}>
                             <div className={`text-right font-bold mb-2 text-sm ${isToday ? 'text-cyan-400' : 'text-slate-600'}`}>{dateObj.getDate()}</div>
                             <div className="space-y-1 flex-1">
                                {daySlots.map(([key, slot]) => {
                                    const isBooked = slot.status === 'booked';
                                    const isBlocked = slot.status === 'blocked';
                                    const isCancelled = slot.status === 'cancelled';
                                    return (
                                        <div key={key} className={`text-[10px] px-2 py-1.5 rounded truncate border-l-2 ${isBooked ? (slot.paymentStatus === 'paid' ? 'bg-emerald-900/20 text-emerald-300 border-emerald-500' : 'bg-blue-900/20 text-blue-300 border-blue-500') : isBlocked ? 'bg-red-900/10 text-red-400 border-red-500/50 opacity-60' : isCancelled ? 'bg-slate-800 text-slate-500 line-through' : 'bg-emerald-900/5 text-emerald-400/70'}`}>
                                            <span className="font-bold mr-1">{slot.time}</span> {isBooked ? slot.patientName : (isBlocked ? '🚫' : 'LIBRE')}
                                        </div>
                                    );
                                })}
                             </div>
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* --- MODALES --- */}

      {/* 1. APPOINTMENT FORM */}
      <AppointmentForm
        isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} onSave={handleSaveAppointment} formData={formData} setFormData={setFormData} patients={patients}
        savePricePreference={savePricePreference} setSavePricePreference={setSavePricePreference} selectedPatientNoShows={selectedPatientNoShows}
        onPatientSelect={(id, name) => setFormData({...formData, patientId: id, patientName: name})}
      />

      {/* 2. CONFIG MODAL */}
      <AgendaConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} currentConfig={workConfig} onSave={async (cfg) => { await updateDoc(doc(db, "professionals", selectedProfId), { agendaSettings: cfg }); setWorkConfig(cfg); setIsConfigOpen(false); }} />

      {/* 3. DAY VIEW MODAL */}
      {isDayViewOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end">
              <div className="w-full md:w-[450px] bg-slate-900 h-full border-l border-slate-700 p-6 flex flex-col shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h2 className="text-xl font-bold text-white">{selectedDate.toLocaleDateString('es-ES', { weekday:'long', day:'numeric', month:'long'})}</h2>
                      <button onClick={() => setIsDayViewOpen(false)} className="text-slate-400 hover:text-white text-xl">✕</button>
                  </div>
                  <div className="flex gap-2 mb-4">
                      <button onClick={handleBlockDay} className="flex-1 bg-red-900/30 text-red-300 border border-red-500/30 py-2 rounded text-sm hover:bg-red-900/50">🚫 Bloquear Día</button>
                      <button onClick={handleAddExtraSlot} className="flex-1 bg-blue-900/30 text-blue-300 border border-blue-500/30 py-2 rounded text-sm hover:bg-blue-900/50">➕ Turno Extra</button>
                  </div>
                  <div className="flex-1 overflow-y-auto">{renderDaySlots()}</div>
              </div>
          </div>
      )}

      {/* 4. EVENTS MANAGER MODAL */}
      {isEventsManagerOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
                  <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                      <h3 className="font-bold text-lg text-white">📅 Gestión de Eventos</h3>
                      <button onClick={() => setIsNewEventModalOpen(true)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm font-bold hover:bg-green-500">+ Nuevo Evento</button>
                  </div>
                  <div className="flex border-b border-slate-700">
                      <button onClick={() => setEventsTab('upcoming')} className={`flex-1 py-3 text-sm font-bold ${eventsTab==='upcoming' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500'}`}>🚀 Próximos</button>
                      <button onClick={() => setEventsTab('past')} className={`flex-1 py-3 text-sm font-bold ${eventsTab==='past' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-slate-500'}`}>📜 Historial</button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                      {annualEvents.filter(e => { const end = dayjs(e.endDate); return eventsTab === 'upcoming' ? end.isAfter(dayjs().subtract(1, 'day')) : end.isBefore(dayjs().subtract(1, 'day')); }).map(e => (
                          <div key={e.id} className="p-3 border border-slate-700 rounded bg-slate-800/50 flex justify-between items-center">
                              <div><div className="font-bold text-white">{e.title}</div><div className="text-xs text-slate-400">{dayjs(e.startDate).format('DD MMM')} - {dayjs(e.endDate).format('DD MMM YYYY')}</div></div>
                              <button onClick={() => handleDeleteEvent(e)} className="text-red-400 hover:text-red-300">🗑️</button>
                          </div>
                      ))}
                  </div>
                  <div className="p-4 border-t border-slate-700 text-right"><button onClick={() => setIsEventsManagerOpen(false)} className="px-4 py-2 bg-slate-800 rounded text-slate-300 hover:text-white">Cerrar</button></div>
              </div>
          </div>
      )}

      {/* 5. NEW EVENT MODAL */}
      {isNewEventModalOpen && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm">
            <h3 className="text-lg font-bold text-white mb-4">{editingEventId ? '✏️ Editar' : '➕ Nuevo Evento'}</h3>
            <DateSelectorRow label="Desde:" dateValue={newEventData.start} onChange={(d) => setNewEventData({...newEventData, start: d})} />
            <DateSelectorRow label="Hasta:" dateValue={newEventData.end} onChange={(d) => setNewEventData({...newEventData, end: d})} />
            <div className="mb-4"><label className="block text-xs text-slate-400 mb-1">Título</label><input type="text" value={newEventData.title} onChange={e => setNewEventData({...newEventData, title: e.target.value})} className="w-full bg-slate-800 border border-slate-700 text-white rounded p-2" /></div>
            <div className="flex justify-end gap-2">
                <button onClick={() => setIsNewEventModalOpen(false)} className="px-3 py-2 bg-slate-800 rounded text-slate-300">Cancelar</button>
                <button onClick={handleSaveEvent} className="px-3 py-2 bg-green-600 rounded text-white font-bold">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CONFLICT MODAL */}
      {isConflictModalOpen && (
          <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-red-900 p-6 rounded-xl w-full max-w-lg">
                  <h3 className="text-xl font-bold text-red-400 mb-2">⚠️ Conflictos Detectados</h3>
                  <p className="text-sm text-slate-400 mb-4">Las siguientes citas chocan con tus vacaciones:</p>
                  <div className="max-h-60 overflow-y-auto mb-4 bg-red-900/10 border border-red-900/30 rounded p-2 space-y-2">
                      {conflictList.map(c => (
                          <div key={c.slotKey} className="flex justify-between items-center p-2 bg-slate-800 rounded">
                              <div><div className="font-bold text-white">{c.slotData.patientName}</div><div className="text-xs text-slate-400">{dayjs(c.date).format('DD MMM')} - {c.slotData.time}</div></div>
                              <span className="text-xs bg-red-900 text-red-200 px-2 py-1 rounded">Ocupado</span>
                          </div>
                      ))}
                  </div>
                  <div className="flex justify-end gap-2">
                      <button onClick={() => setIsConflictModalOpen(false)} className="px-4 py-2 bg-slate-800 rounded">Cancelar</button>
                      <button onClick={finalizeEventSave} className="px-4 py-2 bg-red-600 text-white rounded font-bold">Guardar de todos modos</button>
                  </div>
              </div>
          </div>
      )}

      {/* 7. WAITLIST SELECTOR MODAL */}
      {isWaitlistSelectorOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-md shadow-2xl">
                  <h3 className="text-lg font-bold mb-4 text-green-400">♻️ Reasignar Turno</h3>
                  <div className="max-h-60 overflow-y-auto mb-4 border border-slate-700 rounded-lg bg-slate-950/50">
                      {waitlist.length === 0 && <div className="p-4 text-center text-slate-500 text-sm">Lista vacía.</div>}
                      {waitlist.map(w => (
                          <div key={w.id} onClick={() => handleAssignFromWaitlist(w)} className="p-3 border-b border-slate-800 hover:bg-green-900/20 cursor-pointer transition-colors flex justify-between items-center group">
                              <div><div className="font-bold text-slate-200 group-hover:text-green-300">{w.patientName}</div><div className="text-xs text-slate-500">{w.notes}</div></div>
                              <span className="text-xl opacity-0 group-hover:opacity-100 transition">👉</span>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => setIsWaitlistSelectorOpen(false)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-lg font-bold transition">Cancelar</button>
              </div>
          </div>
      )}

      {/* 8. ADD WAITLIST FORM */}
      {isWaitlistFormOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-sm">
                <h3 className="text-lg font-bold text-white mb-4">Agregar a Lista de Espera</h3>
                <input placeholder="Nombre del paciente" className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded mb-2" value={formData.patientName} onChange={e => setFormData({...formData, patientName: e.target.value})} />
                <textarea placeholder="Notas (Horario preferido...)" className="w-full bg-slate-800 border border-slate-700 text-white p-2 rounded mb-4" value={formData.adminNotes} onChange={e => setFormData({...formData, adminNotes: e.target.value})} />
                <div className="flex justify-end gap-2">
                    <button onClick={() => setIsWaitlistFormOpen(false)} className="px-3 py-2 bg-slate-800 rounded text-slate-300">Cancelar</button>
                    <button onClick={async () => { 
                        if(!formData.patientName) return alert("Nombre requerido");
                        await addDoc(collection(db, "waitlist"), { professionalId: selectedProfId, patientId: null, patientName: formData.patientName, notes: formData.adminNotes, createdAt: serverTimestamp() });
                        loadWaitlist(); setIsWaitlistFormOpen(false); setFormData({...formData, patientName:'', adminNotes:''});
                    }} className="px-3 py-2 bg-blue-600 rounded text-white font-bold">Agregar</button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}