import React from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Si el error persiste, deberás ajustar esta ruta al archivo real
import { useTagsDictionary } from '../hooks/useTagsDictionary';
import { PredictiveTagSearch } from './PredictiveTagSearch';
import type { TagEntry } from '../types/tags'; // <-- Corrección: Se agregó 'type'

interface PatientTagsManagerProps {
  patientId: string;
  professionType: string;
}

export const PatientTagsManager: React.FC<PatientTagsManagerProps> = ({ patientId, professionType }) => {
  // 1. Inicializamos el hook
  const { dictionary, loading, error } = useTagsDictionary(professionType);

  // 2. Función para manejar la selección del tag y guardar en Firestore
  const handleTagSelection = async (tagData: TagEntry) => {
    try {
      const patientRef = doc(db, 'patients', patientId);
      
      await updateDoc(patientRef, {
        clinicalIndicators: arrayUnion({
          tag: tagData.masterTag,
          category: tagData.category,
          addedAt: new Date().toISOString() // Puedes cambiar esto por dayjs().toISOString() si lo usas en el proyecto
        })
      });
      
      console.log(`Tag "${tagData.masterTag}" añadido exitosamente al paciente ${patientId}`);
    } catch (err) {
      console.error("Error al actualizar los tags del paciente:", err);
    }
  };

  if (loading) return <div>Cargando diccionario clínico...</div>;
  if (error) return <div>Error cargando el diccionario: {error}</div>;

  return (
    <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', background: '#fff' }}>
      <h3 style={{ marginTop: 0 }}>Asignar Indicador Clínico</h3>
      <p style={{ color: '#555', fontSize: '0.9em' }}>Busca por síntoma, diagnóstico o palabra clave.</p>
      
      {/* 3. Renderizamos el buscador predictivo inyectándole el diccionario en caché */}
      <PredictiveTagSearch 
        dictionary={dictionary} 
        onSelectTag={handleTagSelection} 
      />
    </div>
  );
};