// Ruta: src/components/register/professionals/useProfessionalRegister.ts

import { useState, useEffect } from 'react';
import {
  doc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../../../services/firebase';

const SHARD_LIMIT = 1000;

interface ProfessionalFormData {
  // Paso 1: Datos Personales/Legales
  fullName: string;
  license: string;
  phone: string;
  professionId: string;

  // Paso 2: Datos Clínicos Públicos (Para el Índice)
  clinicName: string;
  clinicCity: string;
  clinicAddress: string;
  publicPhone: string;
  mapsUrl: string;
  facebookUrl: string;
  instagramUrl: string;
}

export const useProfessionalRegister = () => {
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [professions, setProfessions] = useState<any[]>([]);

  const [formData, setFormData] = useState<ProfessionalFormData>({
    fullName: '',
    license: '',
    phone: '',
    professionId: '',
    clinicName: '',
    clinicCity: '',
    clinicAddress: '',
    publicPhone: '',
    mapsUrl: '',
    facebookUrl: '',
    instagramUrl: '',
  });

  // Cargar profesiones activas al montar el hook
  useEffect(() => {
    const fetchProfessions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'professions'));
        const lista = querySnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((p: any) => p.active !== false); // Ignora soft deletes

        setProfessions(lista);
      } catch (error) {
        console.error('Error cargando profesiones:', error);
        setErrorMsg('Error al cargar las áreas de especialidad.');
      }
    };
    fetchProfessions();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!formData.professionId) {
      setErrorMsg('Debes seleccionar una especialidad clínica.');
      return;
    }
    setStep(2);
  };

  const handleBack = () => setStep(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    if (!auth.currentUser) {
      setErrorMsg('No hay sesión activa.');
      setSaving(false);
      return;
    }

    try {
      const newCode = generateCode();
      const uid = auth.currentUser.uid;
      const batch = writeBatch(db);

      // --- 1. PREPARACIÓN DEL ÍNDICE PÚBLICO ---
      // Leemos los metadatos de la profesión elegida para saber en qué fragmento (shard) guardarlo
      const professionMetaRef = doc(db, 'professions', formData.professionId);
      const metaSnap = await getDoc(professionMetaRef);

      let totalProfessionals = 0;
      let totalShards = 1;

      if (metaSnap.exists()) {
        const metaData = metaSnap.data();
        totalProfessionals = metaData.totalProfessionals || 0;
        totalShards = metaData.totalShards || 1;
      }

      // Lógica de fragmentación (Sharding)
      let targetShardIndex = totalShards - 1;
      if (totalProfessionals > 0 && totalProfessionals % SHARD_LIMIT === 0) {
        targetShardIndex++;
        totalShards++;
      }

      const targetShard = `shard_${targetShardIndex}`;
      const shardRef = doc(
        collection(professionMetaRef, 'directory_shards'),
        targetShard
      );

      // --- 2. CONSTRUCCIÓN DE OBJETOS ---
      // A. Expediente Maestro (Privado)
      const masterProfile = {
        fullName: formData.fullName,
        licenseNumber: formData.license,
        contactNumber: formData.phone,
        professionType: formData.professionId,
        professionalCode: newCode,
        isAuthorized: false,
        email: auth.currentUser.email,
        nexusBalance: 50,
        metrics: { nexusDistributed: 0 },
        createdAt: new Date().toISOString(),
      };

      // B. Tarjeta Pública (Para el Índice)
      const indexProfile = {
        fullName: formData.fullName,
        clinicName: formData.clinicName,
        clinicCity: formData.clinicCity,
        clinicAddress: formData.clinicAddress,
        publicPhone: formData.publicPhone,
        links: {
          maps: formData.mapsUrl || null,
          facebook: formData.facebookUrl || null,
          instagram: formData.instagramUrl || null,
        },
      };

      // --- 3. EJECUCIÓN ATÓMICA DEL LOTE (BATCH) ---
      batch.set(doc(db, 'professionals', uid), masterProfile);

      batch.set(
        doc(db, 'users', uid),
        {
          role: 'professional',
          professionalCode: newCode,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      batch.set(
        shardRef,
        {
          professionals: { [uid]: indexProfile },
        },
        { merge: true }
      );

      batch.set(
        professionMetaRef,
        {
          totalProfessionals: totalProfessionals + 1,
          totalShards: totalShards,
          name: metaSnap.exists()
            ? metaSnap.data().name
            : formData.professionId,
        },
        { merge: true }
      );

      await batch.commit();

      // Recarga forzada para inyectar el nuevo rol y entrar al Dashboard
      window.location.reload();
    } catch (error: any) {
      console.error('Error en registro de profesional:', error);
      setErrorMsg(
        'Hubo un error al crear tu perfil. Por favor, intenta de nuevo.'
      );
      setSaving(false);
    }
  };

  return {
    step,
    saving,
    errorMsg,
    formData,
    professions,
    handleChange,
    handleNextStep,
    handleBack,
    handleSubmit,
  };
};
