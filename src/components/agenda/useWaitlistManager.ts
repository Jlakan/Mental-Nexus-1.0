import { useState, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import type { MonthlySlotMap, AgendaSlot } from '../../utils/agendaTypes';

interface UseWaitlistManagerProps {
  selectedProfId: string;
  selectedDate: Date;
  currentMonthData: MonthlySlotMap | null;
  setCurrentMonthData: (data: MonthlySlotMap) => void;
  loadPatients: () => Promise<void>;
  setLoading: (loading: boolean) => void;
  handleSoftCancel: (slotKey: string) => Promise<void>;
  getDateFromSlotKey: (slotKey: string, year: number, month: number) => Date;
  // Callbacks para controlar la UI desde el orquestador
  onOpenWaitlistSelector: () => void;
  onCloseWaitlistSelector: () => void;
  onCloseWaitlistForm: () => void;
}

export const useWaitlistManager = ({
  selectedProfId,
  selectedDate,
  currentMonthData,
  setCurrentMonthData,
  loadPatients,
  setLoading,
  handleSoftCancel,
  getDateFromSlotKey,
  onOpenWaitlistSelector,
  onCloseWaitlistSelector,
  onCloseWaitlistForm,
}: UseWaitlistManagerProps) => {
  const [waitlist, setWaitlist] = useState<any[]>([]);
  const [slotToReassign, setSlotToReassign] = useState<string | null>(null);

  const loadWaitlist = useCallback(async () => {
    if (!selectedProfId) return;
    try {
      const q = query(
        collection(db, 'waitlist'),
        where('professionalId', '==', selectedProfId),
        orderBy('createdAt', 'asc')
      );
      const snap = await getDocs(q);
      setWaitlist(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  }, [selectedProfId]);

  const handleDeleteWaitlistItem = async (id: string) => {
    if (!window.confirm('¿Borrar de la lista?')) return;
    try {
      await deleteDoc(doc(db, 'waitlist', id));
      loadWaitlist();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddToWaitlist = async (e: React.FormEvent, formData: any) => {
    e.preventDefault();
    if (!formData.patientName) return alert('Nombre requerido');

    setLoading(true);
    try {
      await addDoc(collection(db, 'waitlist'), {
        professionalId: selectedProfId,
        patientId: formData.patientId || null,
        patientName: formData.patientName,
        notes: formData.adminNotes,
        createdAt: serverTimestamp(),
      });
      alert('Agregado a lista de espera.');
      onCloseWaitlistForm();
      loadWaitlist();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignFromWaitlist = async (waitlistItem: any) => {
    if (!slotToReassign || !currentMonthData) return;

    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const batch = writeBatch(db);

      const slotPayload: Partial<AgendaSlot> = {
        status: 'booked',
        patientId: waitlistItem.patientId || undefined,
        patientName: waitlistItem.patientName,
        patientExternalPhone: waitlistItem.patientExternalPhone,
        adminNotes: `[Desde Espera] ${waitlistItem.notes || ''}`,
        paymentStatus: 'pending',
        updatedAt: new Date().toISOString(),
      };

      batch.update(
        doc(db, 'professionals', selectedProfId, 'availability', monthDocId),
        {
          [`slots.${slotToReassign}`]: {
            ...currentMonthData[slotToReassign],
            ...slotPayload,
          },
        }
      );

      if (waitlistItem.patientId) {
        const apptDate = getDateFromSlotKey(slotToReassign, year, month);
        batch.update(doc(db, 'patients', waitlistItem.patientId), {
          [`careTeam.${selectedProfId}.nextAppointment`]:
            apptDate.toISOString(),
        });
      }

      batch.delete(doc(db, 'waitlist', waitlistItem.id));
      await batch.commit();

      setCurrentMonthData({
        ...currentMonthData,
        [slotToReassign]: {
          ...currentMonthData[slotToReassign],
          ...(slotPayload as AgendaSlot),
        },
      });

      loadWaitlist();
      loadPatients();
      onCloseWaitlistSelector();
      setSlotToReassign(null);
      alert(`✅ Reasignado a ${waitlistItem.patientName}`);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleSmartReleaseCheck = async (slotKey: string) => {
    if (waitlist.length > 0) {
      if (
        window.confirm(
          `⚠️ Hay ${waitlist.length} personas en espera. ¿ASIGNAR espacio a la lista?`
        )
      ) {
        setSlotToReassign(slotKey);
        onOpenWaitlistSelector();
        return;
      }
    }
    if (window.confirm('¿CANCELAR la cita actual?')) {
      handleSoftCancel(slotKey);
    }
  };

  return {
    waitlist,
    slotToReassign,
    setSlotToReassign,
    loadWaitlist,
    handleDeleteWaitlistItem,
    handleAddToWaitlist,
    handleAssignFromWaitlist,
    handleSmartReleaseCheck,
  };
};
