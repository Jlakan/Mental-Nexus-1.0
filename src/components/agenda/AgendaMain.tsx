// src/components/agenda/AgendaMain.tsx
import { useState, useEffect } from 'react';
import {
 doc,
 getDoc,
 setDoc,
 updateDoc,
 writeBatch,
 arrayUnion,
 deleteField,
 increment,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import GlobalConfirmModal from './GlobalConfirmModal';
import AgendaConfigModal from './AgendaConfigModal';
import ConflictModal from './ConflictModal';
import WaitlistSelectorModal from './WaitlistSelectorModal';
import WaitlistFormModal from './WaitlistFormModal';
import NewEventModal from './NewEventModal';
import EventsManagerModal from './EventsManagerModal';
import DayViewSidebar from './DayViewSidebar';
import CalendarGrid from './CalendarGrid';
import AgendaHeader from './AgendaHeader';
import { generateMonthSkeleton } from '../../utils/agendaGenerator';
import type {
 MonthlySlotMap,
 WorkConfig,
 AgendaSlot,
} from '../../utils/agendaTypes';
import AgendaSidebar from './AgendaSidebar';
import AppointmentForm from './AppointmentForm';
import ModalPortal from '../ModalPortal';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import updateLocale from 'dayjs/plugin/updateLocale';

// --- IMPORTS DE CONTEXTO Y COMPONENTES ---
import { useAgendaContext } from './useAgendaContext';
import SchedulingBanner from './SchedulingBanner';
import { useAnnualEvents } from './useAnnualEvents';
import { useWaitlistManager } from './useWaitlistManager';
import { usePatientsManager } from './usePatientsManager';
import PatientManagerModal from './PatientManagerModal';
import PatientHubModal from './PatientHubModal';
import AgendaMenuModal from './AgendaMenuModal';
import PatientsMenuModal from './PatientsMenuModal';
import PatientCardsModal from './PatientCardsModal';

dayjs.extend(updateLocale);
dayjs.locale('es');
dayjs.updateLocale('es', { weekStart: 0 });

interface Props {
 userRole: 'professional' | 'assistant';
 currentUserId: string;
 onBack?: () => void;
 doctorId?: string;
}

const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

const MONTHS_LIST = [
 'Enero',
 'Febrero',
 'Marzo',
 'Abril',
 'Mayo',
 'Junio',
 'Julio',
 'Agosto',
 'Septiembre',
 'Octubre',
 'Noviembre',
 'Diciembre',
];

const currentYear = new Date().getFullYear();
const YEARS_LIST = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);

const DEFAULT_CONFIG: WorkConfig = {
 durationMinutes: 50,
 defaultPrice: 500,
 schedule: {
   1: {
     active: true,
     ranges: [
       { start: '09:00', end: '14:00' },
       { start: '16:00', end: '20:00' },
     ],
   },
   2: {
     active: true,
     ranges: [
       { start: '09:00', end: '14:00' },
       { start: '16:00', end: '20:00' },
     ],
   },
   3: {
     active: true,
     ranges: [
       { start: '09:00', end: '14:00' },
       { start: '16:00', end: '20:00' },
     ],
   },
   4: {
     active: true,
     ranges: [
       { start: '09:00', end: '14:00' },
       { start: '16:00', end: '20:00' },
     ],
   },
   5: { active: true, ranges: [{ start: '09:00', end: '14:00' }] },
   6: { active: true, ranges: [{ start: '10:00', end: '14:00' }] },
   0: { active: false, ranges: [] },
 },
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

const getDateFromSlotKey = (
 slotKey: string,
 year: number,
 month: number
): Date => {
 const [dayStr, timeStr] = slotKey.split('_');
 const day = parseInt(dayStr);
 const h = parseInt(timeStr.substring(0, 2));
 const m = parseInt(timeStr.substring(2));
 return new Date(year, month, day, h, m);
};

export default function AgendaMain({
 userRole,
 currentUserId,
 onBack,
 doctorId,
}: Props) {
 // --- INTEGRACIÓN DEL CONTEXTO ---
 const {
   loading: isContextLoading,
   isMobile,
   myProfessionals,
   selectedDoctorId: selectedProfId,
   setSelectedDoctorId: setSelectedProfId,
   workConfig,
   setWorkConfig,
 } = useAgendaContext({ currentUserId, userRole, initialDoctorId: doctorId });

 const [showMobileSidebar, setShowMobileSidebar] = useState(false);
 const [isWaitlistFormOpen, setIsWaitlistFormOpen] = useState(false);
 const [isWaitlistSelectorOpen, setIsWaitlistSelectorOpen] = useState(false);

 const [currentMonthData, setCurrentMonthData] = useState<MonthlySlotMap | null>(null);
 const [isMonthInitialized, setIsMonthInitialized] = useState(false);
 const [monthGoal, setMonthGoal] = useState<string>('');
 const [isEditingGoal, setIsEditingGoal] = useState(false);
 const [selectedDate, setSelectedDate] = useState(new Date());

 const [loading, setLoading] = useState(true);

 useEffect(() => {
   setLoading(isContextLoading);
 }, [isContextLoading]);

 const [cardsModalConfig, setCardsModalConfig] = useState<{
   isOpen: boolean;
   type: 'needing' | 'waitlist' | 'paused';
 }>({ isOpen: false, type: 'needing' });

 // --- MODALES ---
 const [isConfigOpen, setIsConfigOpen] = useState(false);
 const [isDayViewOpen, setIsDayViewOpen] = useState(false);
 const [isFormOpen, setIsFormOpen] = useState(false);
 const [isEventsManagerOpen, setIsEventsManagerOpen] = useState(false);
 const [isPatientHubOpen, setIsPatientHubOpen] = useState(false);
 const [isPatientManagerOpen, setIsPatientManagerOpen] = useState(false);
 const [editingPatient, setEditingPatient] = useState<any>(null);

 const [isAgendaMenuOpen, setIsAgendaMenuOpen] = useState(false);
 const [isPatientsMenuOpen, setIsPatientsMenuOpen] = useState(false);

 const [confirmModal, setConfirmModal] = useState<{
   isOpen: boolean;
   title: string;
   message: string;
   onConfirm: () => void;
 }>({
   isOpen: false,
   title: '',
   message: '',
   onConfirm: () => {},
 });

 const [targetSlotKey, setTargetSlotKey] = useState<string | null>(null);

 const [formData, setFormData] = useState({
   patientId: '',
   patientName: '',
   patientExternalPhone: '',
   patientExternalEmail: '',
   price: 500,
   adminNotes: '',
   paymentStatus: 'pending',
   paymentMethod: 'cash',
 });

 const [savePricePreference, setSavePricePreference] = useState(false);
 const [selectedPatientNoShows, setSelectedPatientNoShows] = useState<number>(0);

 useEffect(() => {
   if (!isMobile) setShowMobileSidebar(false);
 }, [isMobile]);

 // --- HOOK DE PACIENTES ---
 const {
   patients,
   patientsNeedingAppt,
   pausedList,
   loadPatients,
   fetchPausedPatients,
   handleReactivatePatient,
   handleArchivePatient,
   handleSyncPatients,
   createNewPatient,
   updatePatientContact,
 } = usePatientsManager({
   selectedProfId,
   myProfessionals,
   setLoading,
   setConfirmModal,
   getDateFromSlotKey,
   isPausedSidebarOpen:
     cardsModalConfig.isOpen && cardsModalConfig.type === 'paused',
 });

 // --- HOOK DE WAITLIST ---
 const {
   waitlist,
   slotToReassign,
   setSlotToReassign,
   loadWaitlist,
   handleDeleteWaitlistItem,
   handleAddToWaitlist,
   handleAssignFromWaitlist,
   handleSmartReleaseCheck,
 } = useWaitlistManager({
   selectedProfId,
   selectedDate,
   currentMonthData,
   setCurrentMonthData,
   loadPatients: () => loadPatients(),
   setLoading,
   handleSoftCancel: (key) => handleSoftCancel(key),
   getDateFromSlotKey,
   onOpenWaitlistSelector: () => setIsWaitlistSelectorOpen(true),
   onCloseWaitlistSelector: () => setIsWaitlistSelectorOpen(false),
   onCloseWaitlistForm: () => setIsWaitlistFormOpen(false),
 });

 // --- HOOK DE EVENTOS ANUALES Y CONFLICTOS ---
 const {
   annualEvents,
   conflictList,
   isConflictModalOpen,
   setIsConflictModalOpen,
   isNewEventModalOpen,
   setIsNewEventModalOpen,
   newEventData,
   setNewEventData,
   editingEventId,
   setEditingEventId,
   handleSaveEvent,
   handleDeleteEvent,
   openEditEvent,
   finalizeEventSave,
   handleResolveConflictToWaitlist,
   handleKeepConflict,
 } = useAnnualEvents({
   selectedProfId,
   selectedDate,
   setLoading,
   setConfirmModal,
   loadMonthDoc,
   getDateFromSlotKey,
   workConfig,
 });

 useEffect(() => {
   if (!selectedProfId) return;
   loadMonthDoc();
   loadWaitlist();
 }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

 async function loadMonthDoc() {
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const docSnap = await getDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId)
     );
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
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 }

 const handleSaveGoal = async () => {
   if (!selectedProfId || !isMonthInitialized) return;
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       { monthGoal: monthGoal }
     );
     setIsEditingGoal(false);
   } catch (e) {
     console.error(e);
   }
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

 const handlePrevMonth = () =>
   setSelectedDate(
     new Date(selectedDate.setMonth(selectedDate.getMonth() - 1))
   );
 const handleNextMonth = () =>
   setSelectedDate(
     new Date(selectedDate.setMonth(selectedDate.getMonth() + 1))
   );

 const handleInitializeMonth = async () => {
   if (
     !window.confirm(
       `¿Generar agenda para ${selectedDate.toLocaleDateString('es-ES', {
         month: 'long',
       })}?`
     )
   )
     return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const emptySlots = generateMonthSkeleton(year, month, workConfig!);
     await setDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       {
         id: monthDocId,
         professionalId: selectedProfId,
         year,
         month,
         slots: emptySlots,
         createdAt: new Date(),
         monthGoal: '',
       }
     );
     setCurrentMonthData(emptySlots);
     setMonthGoal('');
     setIsMonthInitialized(true);
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 };

 const handleRegenerateMonth = async () => {
   if (!currentMonthData || !workConfig) return;
   if (
     !window.confirm('⚠️ ¿Actualizar horarios conservando citas existentes?')
   )
     return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const newSkeleton = generateMonthSkeleton(year, month, workConfig);
     const mergedSlots = { ...newSkeleton };
     Object.entries(currentMonthData).forEach(([key, oldSlot]) => {
       if (oldSlot.status !== 'available') mergedSlots[key] = oldSlot;
     });
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       { slots: mergedSlots, updatedAt: new Date() }
     );
     setCurrentMonthData(mergedSlots);
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 };

 const handleSaveConfig = async (newConfig: WorkConfig) => {
   setLoading(true);
   try {
     await updateDoc(doc(db, 'professionals', selectedProfId), {
       agendaSettings: newConfig,
     });
     setWorkConfig(newConfig);
     setIsConfigOpen(false);
     alert('Configuración guardada.');
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 };

 const handleAddExtraSlot = async () => {
   const timeStr = window.prompt('Hora del turno extra (HH:MM):', '18:00');
   if (!timeStr) return;
   const [h, m] = timeStr.split(':').map(Number);
   const day = selectedDate.getDate();
   const slotKey = `${day.toString().padStart(2, '0')}_${h
     .toString()
     .padStart(2, '0')}${m.toString().padStart(2, '0')}`;
   if (currentMonthData && currentMonthData[slotKey])
     return alert('Ya existe ese turno.');
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const newSlot: AgendaSlot = {
       status: 'available',
       time: `${h.toString().padStart(2, '0')}:${m
         .toString()
         .padStart(2, '0')}`,
       price: workConfig?.defaultPrice || 500,
       duration: workConfig?.durationMinutes || 50,
     };
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       { [`slots.${slotKey}`]: newSlot }
     );
     setCurrentMonthData({ ...currentMonthData, [slotKey]: newSlot });
   } catch (e) {
     console.error(e);
   }
 };

 const handleBlockDay = async () => {
   const reason = window.prompt('Motivo del bloqueo:');
   if (!reason) return;
   if (!window.confirm('¿Bloquear día completo?')) return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const prefix = `${selectedDate.getDate().toString().padStart(2, '0')}_`;
     const updates: any = {};
     const updatedLocal = { ...currentMonthData };
     Object.entries(currentMonthData || {}).forEach(([key, slot]) => {
       if (key.startsWith(prefix) && slot.status === 'available') {
         const blocked: AgendaSlot = {
           ...slot,
           status: 'blocked',
           adminNotes: reason,
           price: 0,
         };
         updates[`slots.${key}`] = blocked;
         updatedLocal[key] = blocked;
       }
     });
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       updates
     );
     setCurrentMonthData(updatedLocal);
     setIsDayViewOpen(false);
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 };

 const handlePatientSelect = (id: string, name: string) => {
   const fullPatient = patients.find((p) => p.id === id);
   let detectedPrice = workConfig?.defaultPrice || 500;
   let noShowCount = 0;
   if (
     fullPatient &&
     fullPatient.careTeam &&
     fullPatient.careTeam[selectedProfId]
   ) {
     const teamData = fullPatient.careTeam[selectedProfId];
     if (teamData.customPrice) detectedPrice = teamData.customPrice;
     if (teamData.noShowCount) noShowCount = teamData.noShowCount;
   }
   setFormData({
     ...formData,
     patientId: id,
     patientName: name,
     price: detectedPrice,
   });
   setSelectedPatientNoShows(noShowCount);
 };

 const handleQuickPay = async (
   slotKey: string,
   currentStatus: string | undefined
 ) => {
   const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
   if (currentStatus === 'paid' && !window.confirm('¿Marcar como NO PAGADO?'))
     return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       { [`slots.${slotKey}.paymentStatus`]: newStatus }
     );
     if (currentMonthData) {
       const updatedSlots = { ...currentMonthData };
       updatedSlots[slotKey] = {
         ...updatedSlots[slotKey],
         paymentStatus: newStatus as any,
       };
       setCurrentMonthData(updatedSlots);
     }
   } catch (e) {
     console.error(e);
   } finally {
     setLoading(false);
   }
 };

 const handleMarkNoShow = async (
   slotKey: string,
   patientId: string | undefined
 ) => {
   if (!window.confirm('¿Marcar NO SHOW?')) return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const slotPayload = {
       status: 'cancelled',
       adminNotes: '[AUSENCIA] El paciente no se presentó.',
       updatedAt: new Date().toISOString(),
     };
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       {
         [`slots.${slotKey}.status`]: 'cancelled',
         [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes,
         [`slots.${slotKey}.updatedAt`]: slotPayload.updatedAt,
       }
     );
     setCurrentMonthData({
       ...currentMonthData!,
       [slotKey]: { ...currentMonthData![slotKey], ...slotPayload } as any,
     });
     if (patientId) {
       try {
         await updateDoc(doc(db, 'patients', patientId), {
           [`careTeam.${selectedProfId}.noShowCount`]: increment(1),
           [`careTeam.${selectedProfId}.nextAppointment`]: null,
           [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString(),
         });
         loadPatients();
       } catch (err) {
         console.warn(
           'Aviso: Agenda cancelada, pero sin permisos para poner la falta.',
           err
         );
       }
     }
   } catch (e: any) {
     console.error(e);
     alert('Error al marcar Ausencia: ' + e.message);
   } finally {
     setLoading(false);
   }
 };

 const handleSaveAppointment = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!targetSlotKey || !currentMonthData || !formData.patientId || !formData.patientName)
     return alert('Datos incompletos. Debes seleccionar un paciente.');
     
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const batch = writeBatch(db);
     
     const finalPatientId = formData.patientId;

     if (savePricePreference) {
       batch.update(doc(db, 'patients', finalPatientId), {
         [`careTeam.${selectedProfId}.customPrice`]: Number(formData.price),
       });
     }

     const slotPayload: Partial<AgendaSlot> = {
       status: 'booked',
       patientId: finalPatientId,
       patientName: formData.patientName,
       price: Number(formData.price),
       adminNotes: formData.adminNotes,
       paymentStatus: formData.paymentStatus as any,
       updatedAt: new Date().toISOString(),
     };

     batch.update(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       {
         [`slots.${targetSlotKey}`]: {
           ...currentMonthData[targetSlotKey],
           ...slotPayload,
         },
       }
     );

     if (finalPatientId) {
       const appointmentDate = getDateFromSlotKey(targetSlotKey, year, month);
       batch.update(doc(db, 'patients', finalPatientId), {
         [`careTeam.${selectedProfId}.nextAppointment`]:
           appointmentDate.toISOString(),
         [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString(),
       });
       batch.set(
         doc(db, 'patients', finalPatientId, 'gamification', 'history'),
         {
           lastUpdate: new Date(),
           appointments: arrayUnion({
             date: appointmentDate.toISOString(),
             slotKey: targetSlotKey,
             professionalId: selectedProfId,
             status: 'booked',
           }),
         },
         { merge: true }
       );
     }
     await batch.commit();
     setCurrentMonthData({
       ...currentMonthData,
       [targetSlotKey]: {
         ...currentMonthData[targetSlotKey],
         ...(slotPayload as AgendaSlot),
       },
     });
     loadPatients();
     setIsFormOpen(false);
     setSavePricePreference(false);
     setSelectedPatientNoShows(0);
   } catch (e) {
     console.error(e);
     alert('Error al guardar.');
   } finally {
     setLoading(false);
   }
 };

 const handleSoftCancel = async (slotKey: string) => {
   const reason = window.prompt(
     '¿Motivo de cancelación?',
     'Cancelación del paciente'
   );
   if (reason === null) return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const slotPayload = {
       status: 'cancelled',
       adminNotes: `[CANCELADO] ${reason}`,
       updatedAt: new Date().toISOString(),
     };
     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       {
         [`slots.${slotKey}.status`]: 'cancelled',
         [`slots.${slotKey}.adminNotes`]: slotPayload.adminNotes,
       }
     );
     setCurrentMonthData({
       ...currentMonthData!,
       [slotKey]: { ...currentMonthData![slotKey], ...slotPayload } as any,
     });

     if (currentMonthData![slotKey].patientId) {
       try {
         await updateDoc(
           doc(db, 'patients', currentMonthData![slotKey].patientId!),
           {
             [`careTeam.${selectedProfId}.nextAppointment`]: null,
             [`careTeam.${selectedProfId}.lastUpdate`]:
               new Date().toISOString(),
           }
         );
         loadPatients();
       } catch (err) {
         console.warn(
           'Aviso: No se pudo actualizar el expediente del paciente por permisos.',
           err
         );
       }
     }
   } catch (e: any) {
     console.error(e);
     alert('Error al cancelar: ' + e.message);
   } finally {
     setLoading(false);
   }
 };

 const handleReopenSlot = async (slotKey: string) => {
   if (!window.confirm('¿Reabrir este horario?')) return;
   setLoading(true);
   try {
     const year = selectedDate.getFullYear();
     const month = selectedDate.getMonth();
     const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
     const originalTime = currentMonthData![slotKey].time;
     const patientIdToUpdate = currentMonthData![slotKey].patientId;
     const cleanSlotLocal: AgendaSlot = {
       status: 'available',
       time: originalTime,
       duration: workConfig?.durationMinutes || 50,
       price: workConfig?.defaultPrice || 500,
     };

     await updateDoc(
       doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
       {
         [`slots.${slotKey}.status`]: 'available',
         [`slots.${slotKey}.price`]: workConfig?.defaultPrice || 500,
         [`slots.${slotKey}.duration`]: workConfig?.durationMinutes || 50,
         [`slots.${slotKey}.patientId`]: deleteField(),
         [`slots.${slotKey}.patientName`]: deleteField(),
         [`slots.${slotKey}.patientExternalPhone`]: deleteField(),
         [`slots.${slotKey}.patientExternalEmail`]: deleteField(),
         [`slots.${slotKey}.adminNotes`]: deleteField(),
         [`slots.${slotKey}.paymentStatus`]: deleteField(),
       }
     );
     setCurrentMonthData({ ...currentMonthData!, [slotKey]: cleanSlotLocal });
     if (patientIdToUpdate) {
       try {
         await updateDoc(doc(db, 'patients', patientIdToUpdate), {
           [`careTeam.${selectedProfId}.nextAppointment`]: null,
         });
         loadPatients();
       } catch (err) {
         console.warn(
           'Aviso: El espacio se abrió pero el expediente no se actualizó.',
           err
         );
       }
     }
   } catch (e: any) {
     console.error(e);
     alert('Error al reabrir: ' + e.message);
   } finally {
     setLoading(false);
   }
 };

 const openForm = (slotKey: string, slot: AgendaSlot) => {
   setTargetSlotKey(slotKey);
   setFormData({
     patientId: slot.patientId || '',
     patientName:
       slot.patientName || (slot.status === 'blocked' ? 'BLOQUEADO' : ''),
     patientExternalPhone: slot.patientExternalPhone || '',
     patientExternalEmail: slot.patientExternalEmail || '',
     price: slot.price,
     adminNotes: slot.adminNotes || '',
     paymentStatus: slot.paymentStatus || 'pending',
     paymentMethod: slot.paymentMethod || 'cash',
   });
   setSavePricePreference(false);
   setSelectedPatientNoShows(0);
   setIsDayViewOpen(false);
   setIsFormOpen(true);
 };

 const handleScheduleNeedingPatient = (p: any) => {
   let price = workConfig?.defaultPrice || 500;
   let ns = 0;
   if (p.careTeam?.[selectedProfId]?.customPrice)
     price = p.careTeam[selectedProfId].customPrice;
   if (p.careTeam?.[selectedProfId]?.noShowCount)
     ns = p.careTeam[selectedProfId].noShowCount;
   setFormData({
     patientId: p.id,
     patientName: p.fullName,
     patientExternalPhone: p.contactNumber || '',
     patientExternalEmail: p.email || '',
     price: price,
     adminNotes: '',
     paymentStatus: 'pending',
     paymentMethod: 'cash',
   });
   setSelectedPatientNoShows(ns);
   alert(`Has seleccionado a ${p.fullName}. Click en un espacio disponible.`);
   if (isMobile) setShowMobileSidebar(false);
 };

 const handleCancelSelection = () => {
   setFormData({
     patientId: '',
     patientName: '',
     patientExternalPhone: '',
     patientExternalEmail: '',
     price: workConfig?.defaultPrice || 500,
     adminNotes: '',
     paymentStatus: 'pending',
     paymentMethod: 'cash',
   });
   setSelectedPatientNoShows(0);
 };

 const calendarDays = getCalendarGrid(selectedDate);

 if (loading && !currentMonthData && !isMonthInitialized)
   return (
     <div style={{ padding: '50px', textAlign: 'center' }}>Cargando...</div>
   );

 return (
   <div
     style={{
       display: 'flex',
       height: '100vh',
       fontFamily: 'sans-serif',
       background: '#f5f5f5',
       overflow: 'hidden',
       position: 'relative',
     }}
   >
     {/* SIDEBAR */}
     <div
       style={{
         position: isMobile ? 'absolute' : 'relative',
         zIndex: 99,
         height: '100%',
         background: 'white',
         width: isMobile ? '280px' : 'auto',
         transform: isMobile
           ? showMobileSidebar
             ? 'translateX(0)'
             : 'translateX(-100%)'
           : 'none',
         transition: 'transform 0.3s ease',
         boxShadow: showMobileSidebar ? '2px 0 10px rgba(0,0,0,0.2)' : 'none',
       }}
     >
       <AgendaSidebar
         onBack={onBack}
         patientsNeedingAppt={patientsNeedingAppt}
         waitlist={waitlist}
         isMobile={isMobile}
         onOpenAgendaMenu={() => setIsAgendaMenuOpen(true)}
         onOpenPatientsMenu={() => setIsPatientsMenuOpen(true)}
       />
       {isMobile && showMobileSidebar && (
         <button
           onClick={() => setShowMobileSidebar(false)}
           style={{
             position: 'absolute',
             top: '10px',
             right: '10px',
             background: '#f5f5f5',
             border: '1px solid #ccc',
             borderRadius: '4px',
             padding: '5px',
           }}
         >
           ✕
         </button>
       )}
     </div>

     {isMobile && showMobileSidebar && (
       <div
         onClick={() => setShowMobileSidebar(false)}
         style={{
           position: 'absolute',
           inset: 0,
           background: 'rgba(0,0,0,0.5)',
           zIndex: 90,
         }}
       />
     )}

     <div
       style={{
         flex: 1,
         display: 'flex',
         flexDirection: 'column',
         position: 'relative',
         minWidth: 0,
       }}
     >
       <AgendaHeader
         isMobile={isMobile}
         onToggleSidebar={() => setShowMobileSidebar(true)}
         selectedDate={selectedDate}
         onPrevMonth={handlePrevMonth}
         onNextMonth={handleNextMonth}
         onMonthChange={(month) =>
           handleMonthChange({ target: { value: month.toString() } } as any)
         }
         onYearChange={(year) =>
           handleYearChange({ target: { value: year.toString() } } as any)
         }
         isMonthInitialized={isMonthInitialized}
         monthGoal={monthGoal}
         setMonthGoal={setMonthGoal}
         isEditingGoal={isEditingGoal}
         setIsEditingGoal={setIsEditingGoal}
         onSaveGoal={handleSaveGoal}
       />
       <CalendarGrid
         calendarDays={calendarDays}
         selectedDate={selectedDate}
         currentMonthData={currentMonthData}
         isMobile={isMobile}
         onDayClick={(date) => {
           setSelectedDate(date);
           setIsDayViewOpen(true);
         }}
       />
       <SchedulingBanner
         isVisible={
           !isFormOpen && !!formData.patientId && !!formData.patientName
         }
         patientName={formData.patientName}
         isMobile={isMobile}
         onCancel={handleCancelSelection}
       />
     </div>

     <DayViewSidebar
       isOpen={isDayViewOpen}
       onClose={() => setIsDayViewOpen(false)}
       selectedDate={selectedDate}
       currentMonthData={currentMonthData}
       isMobile={isMobile}
       workConfig={workConfig!}
       formData={formData}
       onAddExtraSlot={handleAddExtraSlot}
       onBlockDay={handleBlockDay}
       onQuickPay={handleQuickPay}
       onMarkNoShow={handleMarkNoShow}
       onReopenSlot={handleReopenSlot}
       onSmartReleaseCheck={handleSmartReleaseCheck}
       openForm={openForm}
       onDirectSchedule={(slotKey) => {
         setTargetSlotKey(slotKey);
         setIsDayViewOpen(false);
         setIsFormOpen(true);
       }}
     />

     <EventsManagerModal
       isOpen={isEventsManagerOpen}
       onClose={() => setIsEventsManagerOpen(false)}
       annualEvents={annualEvents}
       onOpenNewEvent={() => {
         setIsEventsManagerOpen(false);
         setIsNewEventModalOpen(true);
       }}
       onEditEvent={(e) => {
         setIsEventsManagerOpen(false);
         openEditEvent(e);
       }}
       onDeleteEvent={handleDeleteEvent}
     />

     <NewEventModal
       isOpen={isNewEventModalOpen}
       editingEventId={editingEventId}
       newEventData={newEventData}
       setNewEventData={setNewEventData}
       onClose={() => {
         setIsNewEventModalOpen(false);
         setEditingEventId(null);
         setIsConflictModalOpen(false);
       }}
       onSave={handleSaveEvent}
     />

     <ConflictModal
       isOpen={isConflictModalOpen}
       conflictList={conflictList}
       onResolveWaitlist={handleResolveConflictToWaitlist}
       onKeep={handleKeepConflict}
       onCancel={() => setIsConflictModalOpen(false)}
       onFinalize={finalizeEventSave}
     />

     <AppointmentForm
       isOpen={isFormOpen}
       onClose={() => setIsFormOpen(false)}
       onSave={handleSaveAppointment}
       selectedDate={selectedDate}
       slotTime={targetSlotKey ? targetSlotKey.split('_')[1] : ''}
       formData={formData}
       setFormData={setFormData}
       patients={patients}
       savePricePreference={savePricePreference}
       setSavePricePreference={setSavePricePreference}
       selectedPatientNoShows={selectedPatientNoShows}
       onPatientSelect={handlePatientSelect}
     />

     <WaitlistFormModal
       isOpen={isWaitlistFormOpen}
       onClose={() => setIsWaitlistFormOpen(false)}
       onSubmit={(e) => handleAddToWaitlist(e, formData)}
       formData={formData}
       setFormData={setFormData}
       patients={patients}
     />
     
     <WaitlistSelectorModal
       isOpen={isWaitlistSelectorOpen}
       waitlist={waitlist}
       onAssign={handleAssignFromWaitlist}
       onCancel={() => {
         setIsWaitlistSelectorOpen(false);
         setSlotToReassign(null);
       }}
     />

     <AgendaConfigModal
       isOpen={isConfigOpen}
       onClose={() => setIsConfigOpen(false)}
       currentConfig={workConfig!}
       onSave={handleSaveConfig}
     />
     
     <GlobalConfirmModal
       isOpen={confirmModal.isOpen}
       title={confirmModal.title}
       message={confirmModal.message}
       onConfirm={confirmModal.onConfirm}
       onCancel={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
       type={confirmModal.title.includes('Eliminar') ? 'danger' : 'default'}
     />

     <AgendaMenuModal
       isOpen={isAgendaMenuOpen}
       onClose={() => setIsAgendaMenuOpen(false)}
       onOpenConfig={() => setIsConfigOpen(true)}
       onOpenEvents={() => setIsEventsManagerOpen(true)}
       isMonthInitialized={isMonthInitialized}
       onRegenerate={handleRegenerateMonth}
       onInitialize={handleInitializeMonth}
       onSyncPatients={handleSyncPatients}
     />

     <PatientsMenuModal
       isOpen={isPatientsMenuOpen}
       onClose={() => setIsPatientsMenuOpen(false)}
       onOpenDirectory={() => setIsPatientHubOpen(true)}
       onOpenNeeding={() =>
         setCardsModalConfig({ isOpen: true, type: 'needing' })
       }
       onOpenWaitlist={() =>
         setCardsModalConfig({ isOpen: true, type: 'waitlist' })
       }
       onOpenPaused={() => {
         fetchPausedPatients();
         setCardsModalConfig({ isOpen: true, type: 'paused' });
       }}
       counts={{
         needing: patientsNeedingAppt.length,
         waitlist: waitlist.length,
         paused: pausedList.length,
       }}
     />

     {/* --- HUB DE PACIENTES --- */}
     <PatientHubModal
       isOpen={isPatientHubOpen}
       onClose={() => setIsPatientHubOpen(false)}
       onOpenNewPatient={() => setIsPatientManagerOpen(true)}
       onEditPatient={setEditingPatient}
       patients={patients}
     />

     {/* --- MODAL UNIFICADO DE PACIENTES --- */}
     <PatientManagerModal
       isOpen={isPatientManagerOpen || !!editingPatient}
       onClose={() => {
         setIsPatientManagerOpen(false);
         setEditingPatient(null);
       }}
       onSubmit={(data) => {
         if (editingPatient) {
           return updatePatientContact(editingPatient.id, editingPatient.shardId, data);
         } else {
           return createNewPatient(data);
         }
       }}
       patientToEdit={editingPatient}
     />

     {/* --- NUEVO MODAL DE TARJETAS DE PACIENTES --- */}
     <PatientCardsModal
       isOpen={cardsModalConfig.isOpen}
       onClose={() =>
         setCardsModalConfig({ ...cardsModalConfig, isOpen: false })
       }
       listType={cardsModalConfig.type}
       patients={
         cardsModalConfig.type === 'needing'
           ? patientsNeedingAppt
           : cardsModalConfig.type === 'waitlist'
           ? waitlist
           : pausedList
       }
       onSchedule={(p) => {
         handleScheduleNeedingPatient(p);
         setCardsModalConfig({ ...cardsModalConfig, isOpen: false });
       }}
       onArchive={(id, name) => {
         handleArchivePatient(id, name);
       }}
       onReactivate={(id, name) => {
         handleReactivatePatient(id, name);
         setCardsModalConfig({ ...cardsModalConfig, isOpen: false });
       }}
       onDeleteWaitlist={handleDeleteWaitlistItem}
     />
   </div>
 );
}