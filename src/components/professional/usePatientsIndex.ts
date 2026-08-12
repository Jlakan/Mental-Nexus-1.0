// src/components/professional/usePatientsIndex.ts
import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  getDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { db } from '../../services/firebase';

const SHARD_LIMIT = 1500;

export const usePatientsIndex = (professionalId: string) => {
  const [patients, setPatients] = useState<any[]>([]);
  const [patientsNeedingAppt, setPatientsNeedingAppt] = useState<any[]>([]);
  const [pausedList, setPausedList] = useState<any[]>([]);
  const [incompleteProfiles, setIncompleteProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPatients = useCallback(async () => {
    if (!professionalId) return;
    try {
      const indicesRef = collection(
        db,
        'professionals',
        professionalId,
        'indices'
      );
      const metadataDoc = await getDoc(
        doc(indicesRef, 'patients_index_metadata')
      );

      let totalShards = 1;
      if (metadataDoc.exists()) {
        totalShards = metadataDoc.data().totalShards || 1;
      }

      const shardPromises = [];
      for (let i = 0; i < totalShards; i++) {
        shardPromises.push(getDoc(doc(indicesRef, `patients_index_${i}`)));
      }
      const shardsSnaps = await Promise.all(shardPromises);

      const allPatients: any[] = [];
      const needing: any[] = [];
      const paused: any[] = [];
      const incomplete: any[] = [];

      shardsSnaps.forEach((snap, index) => {
        if (snap.exists()) {
          const data = snap.data().patients || {};
          const shardId = `patients_index_${index}`;

          Object.entries(data).forEach(([id, val]: [string, any]) => {
            const patientObj = {
              id,
              fullName: val.fullName || 'Sin Nombre',
              contactNumber: val.contactNumber || '',
              email: val.email || '',
              status: val.status || 'active_no_appt',
              attentionType: val.attentionType || '',
              consultationReason: val.consultationReason || '',
              nextTopics: val.nextTopics || '',
              isIncomplete: val.isIncomplete || false,
              birthDate: val.birthDate || '',
              tutorName: val.tutorName || '',
              emergencyContact: val.emergencyContact || { name: '', phone: '' },
              totalDebt: val.totalDebt || 0,
              modalityPreference: val.modalityPreference || 'presencial',
              consentSigned: val.consentSigned || false,
              nextAppointmentDate: val.nextAppointmentDate || null,
              lastAppointmentDate: val.lastAppointmentDate || null,
              shardId,
              // Mapeo de compatibilidad para las tarjetas de UI
              gamificationProfile: { level: 1 },
              careTeam: {
                [professionalId]: {
                  nextAppointment: val.nextAppointmentDate || null,
                },
              },
            };

            allPatients.push(patientObj);

            if (patientObj.status === 'paused') {
              paused.push(patientObj);
            } else {
              if (patientObj.status === 'active_no_appt')
                needing.push(patientObj);
            }
            if (patientObj.isIncomplete) incomplete.push(patientObj);
          });
        }
      });

      setPatients(allPatients);
      setPatientsNeedingAppt(needing);
      setPausedList(paused);
      setIncompleteProfiles(incomplete);
    } catch (e) {
      console.error('Error al cargar índices centralizados:', e);
    }
  }, [professionalId]);

  useEffect(() => {
    loadPatients();
  }, [loadPatients]);

  const handleReactivatePatient = async (
    patientId: string,
    patientName: string
  ) => {
    if (!window.confirm(`¿Reactivar a ${patientName}?`)) return;
    setLoading(true);
    try {
      const patientData = patients.find((p) => p.id === patientId);
      if (!patientData) throw new Error('Paciente no encontrado en memoria');
      const batch = writeBatch(db);

      batch.update(doc(db, 'patients', patientId), {
        [`careTeam.${professionalId}.status`]: 'active',
        [`careTeam.${professionalId}.lastUpdate`]: new Date().toISOString(),
      });

      const shardRef = doc(
        db,
        'professionals',
        professionalId,
        'indices',
        patientData.shardId
      );
      batch.update(shardRef, {
        [`patients.${patientId}.status`]: 'active_no_appt',
      });

      await batch.commit();
      await loadPatients();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const createNewPatient = async (patientData: any) => {
    setLoading(true);
    try {
      const indicesRef = collection(
        db,
        'professionals',
        professionalId,
        'indices'
      );
      const metadataDoc = await getDoc(
        doc(indicesRef, 'patients_index_metadata')
      );

      let totalPatients = 0;
      let totalShards = 1;

      if (metadataDoc.exists()) {
        totalPatients = metadataDoc.data().totalPatients || 0;
        totalShards = metadataDoc.data().totalShards || 1;
      }

      let targetShardIndex = totalShards - 1;

      if (totalPatients > 0 && totalPatients % SHARD_LIMIT === 0) {
        targetShardIndex++;
        totalShards++;
      }

      const targetShard = `patients_index_${targetShardIndex}`;
      const shardRef = doc(indicesRef, targetShard);

      const batch = writeBatch(db);
      const newPatientRef = doc(collection(db, 'patients'));
      const newPatientId = newPatientRef.id;
      const now = new Date().toISOString();

      const profileData = {
        fullName: patientData.fullName,
        contactNumber: patientData.contactNumber,
        email: patientData.email,
        birthDate: patientData.birthDate || '',
        tutorName: patientData.tutorName || '',
        emergencyContact: patientData.emergencyContact || {
          name: '',
          phone: '',
        },
        modalityPreference: patientData.modalityPreference || 'presencial',
        consentSigned: false,
        isManual: true,
        linkedProfessionalId: professionalId,
        createdAt: now,
        attentionType: patientData.attentionType,
        sessionHistory: patientData.consultationReason
          ? [
              {
                date: now,
                topic: patientData.consultationReason,
                professionalId,
              },
            ]
          : [],
        careTeam: {
          [professionalId]: {
            status: 'active',
            joinedAt: now,
            nextAppointment: null,
            lastAppointmentDate: null,
            totalDebt: 0,
            lastUpdate: now,
          },
        },
      };
      batch.set(newPatientRef, profileData);

      const indexData = {
        fullName: patientData.fullName,
        contactNumber: patientData.contactNumber,
        email: patientData.email,
        status: 'active_no_appt',
        attentionType: patientData.attentionType,
        consultationReason: patientData.consultationReason.substring(0, 50),
        nextTopics: '',
        isIncomplete: !patientData.contactNumber || !patientData.email,
        birthDate: patientData.birthDate || '',
        tutorName: patientData.tutorName || '',
        emergencyContact: patientData.emergencyContact || {
          name: '',
          phone: '',
        },
        totalDebt: 0,
        modalityPreference: patientData.modalityPreference || 'presencial',
        consentSigned: false,
        nextAppointmentDate: null,
        lastAppointmentDate: null,
      };

      batch.set(
        shardRef,
        { patients: { [newPatientId]: indexData } },
        { merge: true }
      );

      batch.set(
        doc(indicesRef, 'patients_index_metadata'),
        {
          totalPatients: totalPatients + 1,
          totalShards: totalShards,
          lastUpdated: now,
        },
        { merge: true }
      );

      await batch.commit();
      await loadPatients();
      return { success: true, patientId: newPatientId };
    } catch (error) {
      console.error(error);
      return { success: false, patientId: null };
    } finally {
      setLoading(false);
    }
  };

  const updatePatientContact = async (patientId: string, updatedData: any) => {
    setLoading(true);
    try {
      const patientData = patients.find((p) => p.id === patientId);
      if (!patientData) throw new Error('Paciente no encontrado en memoria');

      const finalName =
        updatedData.fullName ||
        updatedData.name ||
        patientData.fullName ||
        'Sin Nombre';
      const finalPhone =
        updatedData.contactNumber ||
        updatedData.phone ||
        patientData.contactNumber ||
        '';
      const finalEmail =
        updatedData.email !== undefined
          ? updatedData.email
          : patientData.email || '';
      const finalTutor =
        updatedData.tutorName !== undefined
          ? updatedData.tutorName
          : patientData.tutorName || '';

      const batch = writeBatch(db);
      batch.update(doc(db, 'patients', patientId), {
        fullName: finalName,
        contactNumber: finalPhone,
        email: finalEmail,
        tutorName: finalTutor,
        [`careTeam.${professionalId}.lastUpdate`]: new Date().toISOString(),
      });

      const shardRef = doc(
        db,
        'professionals',
        professionalId,
        'indices',
        patientData.shardId
      );
      const hasIncompleteData = !finalPhone || !finalEmail;

      batch.update(shardRef, {
        [`patients.${patientId}.fullName`]: finalName,
        [`patients.${patientId}.contactNumber`]: finalPhone,
        [`patients.${patientId}.email`]: finalEmail,
        [`patients.${patientId}.tutorName`]: finalTutor,
        [`patients.${patientId}.isIncomplete`]: hasIncompleteData,
      });

      await batch.commit();
      await loadPatients();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // FUNCIÓN DE FUSIÓN DE PERFILES (Con migración de notas seguras)
  const handleManualMergeProfiles = async (
    manualPatientId: string,
    appPatientId: string,
    manualShardId: string
  ) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Obtener los expedientes globales
      const manualRef = doc(db, 'patients', manualPatientId);
      const appRef = doc(db, 'patients', appPatientId);
      const [manualSnap, appSnap] = await Promise.all([
        getDoc(manualRef),
        getDoc(appRef),
      ]);

      if (!manualSnap.exists() || !appSnap.exists()) {
        alert('Uno de los expedientes ya no existe en la base de datos.');
        return false;
      }

      const manualData = manualSnap.data();
      const appData = appSnap.data();

      // 2. Consolidar historiales y etiquetas
      const consolidatedHistory = [
        ...(appData.sessionHistory || []),
        ...(manualData.sessionHistory || []),
      ];
      const consolidatedIndicators = [
        ...(appData.clinicalIndicators?.[professionalId] || []),
        ...(manualData.clinicalIndicators?.[professionalId] || []),
      ];

      batch.update(appRef, {
        sessionHistory: consolidatedHistory,
        [`clinicalIndicators.${professionalId}`]: Array.from(
          new Set(consolidatedIndicators)
        ),
        [`careTeam.${professionalId}.status`]: 'active',
        [`careTeam.${professionalId}.lastUpdate`]: new Date().toISOString(),
      });

      // 3. Archivar el perfil manual global
      batch.update(manualRef, {
        isMergedInto: appPatientId,
        isArchived: true,
        [`careTeam.${professionalId}.status`]: 'archived',
      });

      // 4. MUDAR LAS NOTAS CLÍNICAS PRIVADAS
      const oldNotesRef = doc(
        db,
        'professionals',
        professionalId,
        'clinical_notes',
        manualPatientId
      );
      const newNotesRef = doc(
        db,
        'professionals',
        professionalId,
        'clinical_notes',
        appPatientId
      );
      const [oldNotesSnap, newNotesSnap] = await Promise.all([
        getDoc(oldNotesRef),
        getDoc(newNotesRef),
      ]);

      let mergedNotes = {};
      if (newNotesSnap.exists()) mergedNotes = { ...newNotesSnap.data().notas };
      if (oldNotesSnap.exists())
        mergedNotes = { ...mergedNotes, ...oldNotesSnap.data().notas };

      if (Object.keys(mergedNotes).length > 0) {
        batch.set(
          newNotesRef,
          {
            patientId: appPatientId,
            notas: mergedNotes,
            lastUpdated: new Date().toISOString(),
          },
          { merge: true }
        );

        // Destruimos el documento viejo de notas para no dejar basura
        batch.delete(oldNotesRef);
      }

      // 5. Eliminar el registro manual de tu Índice visual
      const shardRef = doc(
        db,
        'professionals',
        professionalId,
        'indices',
        manualShardId
      );
      batch.update(shardRef, {
        [`patients.${manualPatientId}`]: deleteField(),
      });

      await batch.commit();
      await loadPatients();
      alert(
        '🎉 ¡Fusión exitosa! El historial y tus notas han sido trasladados al perfil de la aplicación.'
      );
      return true;
    } catch (error) {
      console.error('Error en la fusión:', error);
      alert('Ocurrió un error al intentar fusionar los perfiles.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    patients,
    patientsNeedingAppt,
    pausedList,
    incompleteProfiles,
    loading,
    loadPatients,
    handleReactivatePatient,
    createNewPatient,
    updatePatientContact,
    handleManualMergeProfiles,
    setLoading,
  };
};
