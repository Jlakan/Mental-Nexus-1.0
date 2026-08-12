// src/components/agenda/usePatientsManager.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../../services/firebase';
import { usePatientsIndex } from '../professional/usePatientsIndex';

const SHARD_LIMIT = 1500;

interface UsePatientsManagerProps {
  selectedProfId: string;
  myProfessionals?: any[];
  setLoading: (loading: boolean) => void;
  setConfirmModal: (modalData: any) => void;
  getDateFromSlotKey: (slotKey: string, year: number, month: number) => Date;
  isPausedSidebarOpen: boolean;
}

export const usePatientsManager = ({
  selectedProfId,
  setLoading,
  setConfirmModal,
  getDateFromSlotKey,
}: UsePatientsManagerProps) => {
  // Consumimos el motor de índices unificado
  const indexManager = usePatientsIndex(selectedProfId);

  const handleArchivePatient = (patientId: string, patientName: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Pausar Paciente',
      message: `¿Deseas pausar el seguimiento de ${patientName}?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          const patientData = indexManager.patients.find(
            (p) => p.id === patientId
          );
          if (!patientData)
            throw new Error('Paciente no encontrado en memoria');
          const batch = writeBatch(db);

          batch.update(doc(db, 'patients', patientId), {
            [`careTeam.${selectedProfId}.status`]: 'inactive',
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString(),
          });

          const shardRef = doc(
            db,
            'professionals',
            selectedProfId,
            'indices',
            patientData.shardId
          );
          batch.update(shardRef, {
            [`patients.${patientId}.status`]: 'paused',
          });

          await batch.commit();
          indexManager.loadPatients();
        } catch (e) {
          console.error('Error al pausar:', e);
          alert('Hubo un error al pausar al paciente.');
        } finally {
          setLoading(false);
          setConfirmModal((prev: any) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleSyncPatients = async () => {
    if (
      !window.confirm(
        '¿Auditar y reconstruir directorio completo?\n\nEsto actualizará datos de contacto, calculará fragmentos y sincronizará citas futuras.'
      )
    )
      return;

    setLoading(true);
    try {
      const profDoc = await getDoc(doc(db, 'professionals', selectedProfId));
      const profCode = profDoc.data()?.professionalCode;
      const allPatientsMap = new Map();

      const qManual = query(
        collection(db, 'patients'),
        where('linkedProfessionalId', '==', selectedProfId)
      );
      const snapManual = await getDocs(qManual);
      snapManual.forEach((d) => allPatientsMap.set(d.id, d.data()));

      if (profCode) {
        const qApp = query(
          collection(db, 'patients'),
          where('linkedProfessionalCode', '==', profCode)
        );
        const snapApp = await getDocs(qApp);
        snapApp.forEach((d) => allPatientsMap.set(d.id, d.data()));
      }

      if (allPatientsMap.size === 0) {
        alert('No se encontraron pacientes en la base de datos.');
        setLoading(false);
        return;
      }

      const now = new Date();
      const currentRealYear = now.getFullYear();
      const currentRealMonth = now.getMonth();
      const monthsToCheck = [];
      for (let i = 0; i < 6; i++) {
        const d = new Date(currentRealYear, currentRealMonth + i, 1);
        monthsToCheck.push(
          `${d.getFullYear()}_${d.getMonth().toString().padStart(2, '0')}`
        );
      }

      const futureAppointments = new Map<string, Date>();
      for (const mId of monthsToCheck) {
        const docSnap = await getDoc(
          doc(db, 'professionals', selectedProfId, 'availability', mId)
        );
        if (docSnap.exists()) {
          const slots = docSnap.data().slots || {};
          Object.entries(slots).forEach(([key, slot]: [string, any]) => {
            if (slot.status === 'booked' && slot.patientId) {
              const [yStr, mStr] = mId.split('_');
              const slotDate = getDateFromSlotKey(
                key,
                parseInt(yStr),
                parseInt(mStr)
              );
              if (slotDate >= now) {
                const existingDate = futureAppointments.get(slot.patientId);
                if (!existingDate || slotDate < existingDate)
                  futureAppointments.set(slot.patientId, slotDate);
              }
            }
          });
        }
      }

      const batch = writeBatch(db);
      const indicesRef = collection(
        db,
        'professionals',
        selectedProfId,
        'indices'
      );

      let currentShardIndex = 0;
      let currentShardCount = 0;
      let newIndexData: Record<string, any> = {};

      allPatientsMap.forEach((val, id) => {
        let baseStatus = 'active_no_appt';
        const teamData = val.careTeam?.[selectedProfId];
        if (teamData?.status === 'inactive') {
          baseStatus = 'paused';
        } else if (futureAppointments.has(id)) {
          baseStatus = 'active_with_appt';
        }

        newIndexData[id] = {
          fullName: val.fullName || 'Sin Nombre',
          contactNumber: val.contactNumber || '',
          email: val.email || '',
          status: baseStatus,
          attentionType: val.attentionType || '',
          consultationReason: (
            val.sessionHistory?.[0]?.topic ||
            val.consultationReason ||
            ''
          ).substring(0, 50),
          nextTopics: '',
          isIncomplete: !val.contactNumber || !val.email,
          birthDate: val.birthDate || '',
          tutorName: val.tutorName || '',
          emergencyContact: val.emergencyContact || { name: '', phone: '' },
          totalDebt: teamData?.totalDebt || 0,
          modalityPreference: val.modalityPreference || 'presencial',
          consentSigned: val.consentSigned || false,
          nextAppointmentDate:
            futureAppointments.get(id)?.toISOString() || null,
          lastAppointmentDate: teamData?.lastAppointmentDate || null,
        };

        if (futureAppointments.has(id)) {
          batch.update(doc(db, 'patients', id), {
            [`careTeam.${selectedProfId}.nextAppointment`]: futureAppointments
              .get(id)!
              .toISOString(),
            [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString(),
          });
        }

        currentShardCount++;

        if (currentShardCount >= SHARD_LIMIT) {
          batch.set(doc(indicesRef, `patients_index_${currentShardIndex}`), {
            patients: newIndexData,
          });
          currentShardIndex++;
          currentShardCount = 0;
          newIndexData = {};
        }
      });

      if (currentShardCount > 0) {
        batch.set(doc(indicesRef, `patients_index_${currentShardIndex}`), {
          patients: newIndexData,
        });
      }

      const finalTotalShards =
        currentShardCount > 0 ? currentShardIndex + 1 : currentShardIndex;

      batch.set(doc(indicesRef, 'patients_index_metadata'), {
        totalShards: finalTotalShards,
        lastUpdated: new Date().toISOString(),
        totalPatients: allPatientsMap.size,
      });

      await batch.commit();
      await indexManager.loadPatients();
      alert(
        `✅ Directorio Reconstruido.\nSe indexaron ${allPatientsMap.size} pacientes en ${finalTotalShards} bloque(s).`
      );
    } catch (error) {
      console.error(error);
      alert('Error al reconstruir el directorio.');
    } finally {
      setLoading(false);
    }
  };

  return {
    patients: indexManager.patients,
    patientsNeedingAppt: indexManager.patientsNeedingAppt,
    pausedList: indexManager.pausedList,
    incompleteProfiles: indexManager.incompleteProfiles,
    loadPatients: indexManager.loadPatients,
    fetchPausedPatients: () => {},
    handleReactivatePatient: indexManager.handleReactivatePatient,
    handleArchivePatient,
    handleSyncPatients,
    createNewPatient: indexManager.createNewPatient,
    updatePatientContact: indexManager.updatePatientContact,
  };
};
