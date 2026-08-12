//src/components/agenda/useAnnualEvents.ts
import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  writeBatch,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import dayjs from 'dayjs';
import type { AgendaSlot, WorkConfig } from '../../utils/agendaTypes';

export interface AnnualEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: any;
}

export interface ConflictItem {
  slotKey: string;
  date: Date;
  slotData: AgendaSlot;
  monthDocId: string;
}

interface UseAnnualEventsProps {
  selectedProfId: string;
  selectedDate: Date;
  setLoading: (val: boolean) => void;
  setConfirmModal: (val: any) => void;
  loadMonthDoc: () => Promise<void>;
  getDateFromSlotKey: (slotKey: string, year: number, month: number) => Date;
  workConfig?: WorkConfig | null;
}

export const useAnnualEvents = ({
  selectedProfId,
  selectedDate,
  setLoading,
  setConfirmModal,
  loadMonthDoc,
  getDateFromSlotKey,
  workConfig,
}: UseAnnualEventsProps) => {
  const [annualEvents, setAnnualEvents] = useState<AnnualEvent[]>([]);
  const [isNewEventModalOpen, setIsNewEventModalOpen] = useState(false);
  const [conflictList, setConflictList] = useState<ConflictItem[]>([]);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [pendingEventSave, setPendingEventSave] = useState<{
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
    title: string;
    isEdit: boolean;
  } | null>(null);

  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [originalEventData, setOriginalEventData] =
    useState<AnnualEvent | null>(null);
  const [newEventData, setNewEventData] = useState<{
    start: dayjs.Dayjs;
    end: dayjs.Dayjs;
    title: string;
  }>({
    start: dayjs(),
    end: dayjs(),
    title: '',
  });

  // Carga inicial y reactiva de eventos
  useEffect(() => {
    if (!selectedProfId) return;
    loadAnnualEvents();
  }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

  // Limpieza del modal de nuevo evento
  useEffect(() => {
    if (isNewEventModalOpen && !editingEventId) {
      setNewEventData((prev) => ({
        ...prev,
        start: dayjs(selectedDate).startOf('month'),
        end: dayjs(selectedDate).endOf('month'),
        title: '',
      }));
    }
  }, [isNewEventModalOpen, editingEventId, selectedDate]);

  const loadAnnualEvents = async () => {
    try {
      const q = query(
        collection(db, 'professionals', selectedProfId, 'annualEvents'),
        orderBy('startDate', 'asc')
      );
      const snap = await getDocs(q);
      setAnnualEvents(
        snap.docs.map((d) => ({ id: d.id, ...d.data() } as AnnualEvent))
      );
    } catch (e) {
      console.error('Error loading events', e);
    }
  };

  const detectConflicts = async (
    start: dayjs.Dayjs,
    end: dayjs.Dayjs
  ): Promise<ConflictItem[]> => {
    const startMs = start.toDate().getTime();
    const endMs = end.toDate().getTime();
    const conflicts: ConflictItem[] = [];
    let currentIter = start.clone().startOf('month');
    const endIter = end.clone().startOf('month');

    while (
      currentIter.isBefore(endIter) ||
      currentIter.isSame(endIter, 'month')
    ) {
      const year = currentIter.year();
      const month = currentIter.month();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const docSnap = await getDoc(
        doc(db, 'professionals', selectedProfId, 'availability', monthDocId)
      );
      if (docSnap.exists()) {
        const slots = docSnap.data().slots || {};
        Object.entries(slots).forEach(([key, slot]: [string, any]) => {
          const slotDate = getDateFromSlotKey(key, year, month);
          const slotMs = slotDate.getTime();
          if (slotMs >= startMs && slotMs <= endMs) {
            if (slot.status === 'booked') {
              conflicts.push({
                slotKey: key,
                date: slotDate,
                slotData: slot,
                monthDocId,
              });
            }
          }
        });
      }
      currentIter = currentIter.add(1, 'month');
    }
    return conflicts;
  };

  const updateSlotsForEvent = async (
    batch: any,
    start: dayjs.Dayjs,
    end: dayjs.Dayjs,
    type: 'block' | 'release',
    reason?: string
  ) => {
    const startMs = start.toDate().getTime();
    const endMs = end.toDate().getTime();
    let currentIter = start.clone().startOf('month');
    const endIter = end.clone().startOf('month');

    while (
      currentIter.isBefore(endIter) ||
      currentIter.isSame(endIter, 'month')
    ) {
      const year = currentIter.year();
      const month = currentIter.month();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const agendaRef = doc(
        db,
        'professionals',
        selectedProfId,
        'availability',
        monthDocId
      );
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
              updates[`slots.${key}`] = {
                ...slot,
                status: 'blocked',
                adminNotes: reason,
                price: 0,
              };
              hasUpdates = true;
            } else if (
              type === 'release' &&
              (slot.status === 'blocked' || slot.status === 'available')
            ) {
              updates[`slots.${key}`] = {
                status: 'available',
                time: slot.time,
                duration: workConfig?.durationMinutes || 50,
                price: workConfig?.defaultPrice || 500,
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
        batch.update(
          doc(
            db,
            'professionals',
            selectedProfId,
            'annualEvents',
            editingEventId!
          ),
          {
            title: title,
            startDate: start.startOf('day').toISOString(),
            endDate: end.endOf('day').toISOString(),
          }
        );
      } else {
        const newRef = doc(
          collection(db, 'professionals', selectedProfId, 'annualEvents')
        );
        batch.set(newRef, {
          title: title,
          startDate: start.startOf('day').toISOString(),
          endDate: end.endOf('day').toISOString(),
          createdAt: serverTimestamp(),
        });
      }
      await updateSlotsForEvent(
        batch,
        start.startOf('day'),
        end.endOf('day'),
        'block',
        title
      );
      await batch.commit();
      await loadAnnualEvents();
      await loadMonthDoc();
      setIsNewEventModalOpen(false);
      setIsConflictModalOpen(false);
      setEditingEventId(null);
      setPendingEventSave(null);
      setConflictList([]);
    } catch (e: any) {
      console.error(e);
      alert('Error: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveEvent = async () => {
    if (!newEventData.title) return alert('Falta el título');
    const startD = newEventData.start.startOf('day');
    const endD = newEventData.end.endOf('day');
    setLoading(true);
    try {
      const conflicts = await detectConflicts(startD, endD);
      setPendingEventSave({
        start: startD,
        end: endD,
        title: newEventData.title,
        isEdit: !!editingEventId,
      });
      if (conflicts.length > 0) {
        setConflictList(conflicts);
        setIsConflictModalOpen(true);
        setLoading(false);
      } else {
        setConfirmModal({
          isOpen: true,
          title: editingEventId ? 'Guardar Cambios' : 'Crear Evento',
          message: `Se bloqueará la agenda del ${startD.format(
            'DD/MM'
          )} al ${endD.format('DD/MM')}.\n¿Continuar?`,
          onConfirm: async () => {
            setConfirmModal((prev: any) => ({ ...prev, isOpen: false }));
            await finalizeEventSave();
          },
        });
        setLoading(false);
      }
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  };

  const handleResolveConflictToWaitlist = async (conflict: ConflictItem) => {
    if (
      !window.confirm(
        `¿Mover a ${conflict.slotData.patientName} a lista de espera?`
      )
    )
      return;
    try {
      alert('Movido a espera (Simulado)');
      setConflictList((prev) =>
        prev.filter((c) => c.slotKey !== conflict.slotKey)
      );
    } catch (e) {
      console.error(e);
    }
  };

  const handleKeepConflict = (conflict: ConflictItem) => {
    setConflictList((prev) =>
      prev.filter((c) => c.slotKey !== conflict.slotKey)
    );
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
          batch.delete(
            doc(db, 'professionals', selectedProfId, 'annualEvents', event.id)
          );
          await updateSlotsForEvent(batch, startD, endD, 'release');
          await batch.commit();
          await loadAnnualEvents();
          await loadMonthDoc();
          setConfirmModal((prev: any) => ({ ...prev, isOpen: false }));
        } catch (e: any) {
          console.error(e);
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const openEditEvent = (event: AnnualEvent) => {
    setEditingEventId(event.id);
    setOriginalEventData(event);
    setNewEventData({
      start: dayjs(event.startDate),
      end: dayjs(event.endDate),
      title: event.title,
    });
    setIsNewEventModalOpen(true);
  };

  return {
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
  };
};
