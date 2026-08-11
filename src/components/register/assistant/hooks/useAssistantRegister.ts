import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  arrayUnion,
} from 'firebase/firestore';
import { auth, db } from '../../../../services/firebase';
import type { IndexedProfessional } from '../steps/Step3ProfessionalSearch';

interface StatusMessage {
  type: 'info' | 'success' | 'error' | null;
  text: string;
}

// Nueva interfaz para las especialidades dinámicas
export interface SpecialtyData {
  id: string;
  name: string;
}

export function useAssistantRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusMessage>({ type: null, text: '' });

  // Estados Paso 1
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');

  // Estados Paso 2
  const [specialty, setSpecialty] = useState('');
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [availableSpecialties, setAvailableSpecialties] = useState<
    SpecialtyData[]
  >([]);
  const [loadingSpecialties, setLoadingSpecialties] = useState(false);

  // EFECTO: Descargar especialidades disponibles desde Firestore
  useEffect(() => {
    const fetchSpecialties = async () => {
      setLoadingSpecialties(true);
      try {
        const specRef = collection(db, 'professions');
        const snap = await getDocs(specRef);

        const loadedSpecs: SpecialtyData[] = [];
        snap.forEach((doc) => {
          const data = doc.data();
          // Aseguramos que solo cargamos especialidades activas (opcional pero recomendado)
          if (data.active !== false) {
            loadedSpecs.push({
              id: doc.id,
              name: data.name || doc.id, // Fallback por si no tiene el campo name
            });
          }
        });
        setAvailableSpecialties(loadedSpecs);
      } catch (error) {
        console.error('Error al cargar especialidades:', error);
      } finally {
        setLoadingSpecialties(false);
      }
    };

    fetchSpecialties();
  }, []);

  // Estados Paso 3
  const [professionalsIndex, setProfessionalsIndex] = useState<
    IndexedProfessional[]
  >([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProfUID, setSelectedProfUID] = useState<string | null>(null);

  // Efecto: Descarga de los shards (Se mantiene idéntico)
  useEffect(() => {
    const fetchIndex = async () => {
      if (!specialty) return;

      setProfessionalsIndex([]);
      setLoading(true);
      setStatus({
        type: 'info',
        text: 'Descargando directorio de profesionales...',
      });

      try {
        const shardsRef = collection(
          db,
          'professions',
          specialty,
          'directory_shards'
        );
        const shardsSnap = await getDocs(shardsRef);

        if (!shardsSnap.empty) {
          const uniqueProfessionals = new Map<string, IndexedProfessional>();

          shardsSnap.forEach((shardDoc) => {
            const data = shardDoc.data();
            const rawValues = Object.values(data);
            const validProfessionals = rawValues.filter(
              (item: any) => item && typeof item === 'object' && item.UID
            ) as IndexedProfessional[];

            validProfessionals.forEach((p) =>
              uniqueProfessionals.set(p.UID, p)
            );
          });

          setProfessionalsIndex([...uniqueProfessionals.values()]);
          setStatus({ type: null, text: '' });
          setStep(3);
        } else {
          setStatus({
            type: 'error',
            text: 'No se encontraron registros para esta especialidad.',
          });
        }
      } catch (error) {
        console.error('Error al descargar índice:', error);
        setStatus({
          type: 'error',
          text: 'Hubo un error al cargar los profesionales.',
        });
      } finally {
        setLoading(false);
      }
    };

    if (step === 2) {
      fetchIndex();
    }
  }, [specialty, step]);

  // Manejador final del registro (Se mantiene idéntico)
  const handleFinalSubmit = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setStatus({ type: 'info', text: 'Enviando solicitud de vinculación...' });

    try {
      const uid = auth.currentUser.uid;
      const email = auth.currentUser.email;
      const batch = writeBatch(db);

      const assistantRef = doc(db, 'assistants', uid);
      batch.set(assistantRef, {
        name: name.trim(),
        birthDate: birthDate,
        phone: phone.trim(),
        specialty: specialty,
        email: email,
        uid: uid,
        createdAt: serverTimestamp(),
        pendingRequests: selectedProfUID ? [selectedProfUID] : [],
        linkedProfessionals: [],
      });

      if (selectedProfUID) {
        const profRef = doc(db, 'professionals', selectedProfUID);
        batch.set(
          profRef,
          {
            pendingAssistants: arrayUnion(uid),
          },
          { merge: true }
        );
      }

      const userRef = doc(db, 'users', uid);
      batch.update(userRef, {
        role: 'assistant',
        profileCompleted: true,
      });

      await batch.commit();

      setStatus({
        type: 'success',
        text: '✅ ¡Perfil creado! Solicitud enviada al profesional.',
      });
      setTimeout(() => navigate('/panel'), 1500);
    } catch (error: any) {
      console.error(error);
      setStatus({ type: 'error', text: `❌ Error: ${error.message}` });
      setLoading(false);
    }
  };

  return {
    step,
    setStep,
    loading,
    status,
    name,
    setName,
    birthDate,
    setBirthDate,
    phone,
    setPhone,
    specialtySearch,
    setSpecialtySearch,
    setSpecialty,
    availableSpecialties,
    loadingSpecialties,
    professionalsIndex,
    searchTerm,
    setSearchTerm,
    selectedProfUID,
    setSelectedProfUID,
    handleFinalSubmit,
  };
}
