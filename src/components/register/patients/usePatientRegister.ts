// Ruta: src/components/register/patients/usePatientRegister.ts

import { useState, useEffect } from 'react';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';
import { INITIAL_PLAYER_PROFILE } from '../../../utils/GamificationUtils';

interface FormData {
  fullName: string;
  dob: string;
  contactNumber: string;
  phone: string
}

export const usePatientRegister = (onComplete: () => void) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    dob: '',
    contactNumber: '',
    phone: '',
  });

  const [professions, setProfessions] = useState<any[]>([]);
  const [selectedProfession, setSelectedProfession] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (step === 2) {
      const loadProfessions = async () => {
        try {
          const querySnapshot = await getDocs(collection(db, 'professions'));
          const list: any[] = [];
          querySnapshot.forEach((doc) => {
            list.push({ id: doc.id, name: doc.data().name || doc.id });
          });
          setProfessions(list);
          if (list.length > 0) {
            setSelectedProfession(list[0].id);
          }
        } catch (error) {
          console.error('Error al cargar las áreas de atención:', error);
          setErrorMsg('No se pudieron cargar las áreas de atención.');
        }
      };
      loadProfessions();
    }
  }, [step]);

  const handleDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegisterData = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    if (!auth.currentUser) {
      setSaving(false);
      return;
    }
    
    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email;

    try {
      await setDoc(doc(db, 'patients', uid), {
        uid: uid,
        fullName: formData.fullName,
        email: email,
        dob: formData.dob,
        contactNumber: formData.contactNumber,
        createdAt: new Date().toISOString(),
        gamificationProfile: INITIAL_PLAYER_PROFILE,
        careTeam: {},
        isManual: false,
      });

      await setDoc(
        doc(db, 'users', uid),
        {
          profileCompleted: true,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      setStep(2);
    } catch (error: any) {
      console.error(error);
      setErrorMsg('Error al guardar datos: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');
    setHasSearched(true);

    try {
      const shardsRef = collection(
        db,
        'professions',
        selectedProfession,
        'directory_shards'
      );
      const shardsSnap = await getDocs(shardsRef);

      let allProfessionalsFromShards: any[] = [];

      shardsSnap.forEach((shardDoc) => {
        const shardData = shardDoc.data();
        if (shardData && shardData.professionals) {
          Object.entries(shardData.professionals).forEach(
            ([profId, profInfo]: [string, any]) => {
              allProfessionalsFromShards.push({ id: profId, ...profInfo });
            }
          );
        }
      });

      const filtered = allProfessionalsFromShards.filter(
        (prof) =>
          searchName.trim() === '' ||
          prof.fullName.toLowerCase().includes(searchName.toLowerCase())
      );

      setSearchResults(filtered);
    } catch (error: any) {
      console.error(error);
      setErrorMsg('Error al consultar el directorio de especialistas.');
    } finally {
      setSaving(false);
    }
  };

  const handleLinkProfessional = async (profData: any) => {
    if (!window.confirm(`¿Solicitar vinculación con ${profData.fullName}?`))
      return;
      
    setSaving(true);

    if (!auth.currentUser) {
      setSaving(false);
      return;
    }
    
    const uid = auth.currentUser.uid;

    try {
      const professionalId = profData.id;
      const batch = writeBatch(db);

      // 1. Actualización en el paciente
      const patientRef = doc(db, 'patients', uid);
      batch.update(patientRef, {
        [`careTeam.${professionalId}`]: {
          status: 'pending',
          joinedAt: new Date().toISOString(),
          professionalName: profData.fullName,
          professionType: selectedProfession,
          noShowCount: 0,
          customPrice: profData.defaultPrice || 500,
          totalDebt: 0,
        },
      });

      // 2. Creación en la bandeja del profesional
      const requestRef = doc(
        db,
        'professionals',
        professionalId,
        'link_requests',
        uid
      );
      batch.set(requestRef, {
        patientId: uid,
        patientName: formData.fullName,
        professionType: selectedProfession,
        status: 'pending',
        requestedAt: new Date().toISOString(),
      });

      await batch.commit();
      onComplete();
    } catch (error: any) {
      console.error(error);
      setErrorMsg('Error al establecer la vinculación.');
      setSaving(false);
    }
  };

  return {
    step,
    saving,
    errorMsg,
    formData,
    professions,
    selectedProfession,
    setSelectedProfession,
    searchName,
    setSearchName,
    searchResults,
    hasSearched,
    handleDataChange,
    handleRegisterData,
    handleSearchProfessional,
    handleLinkProfessional,
    handleSkip: onComplete,
  };
};