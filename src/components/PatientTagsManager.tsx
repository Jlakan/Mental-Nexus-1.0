import React from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';
import { useTagsDictionary } from '../hooks/useTagsDictionary';
import { PredictiveTagSearch } from './PredictiveTagSearch';
import type { TagEntry } from '../types/tags';

interface PatientTagsManagerProps {
  patientId: string;
  professionType: string;
}

export const PatientTagsManager: React.FC<PatientTagsManagerProps> = ({ patientId, professionType }) => {
  const { dictionary, loading, error } = useTagsDictionary(professionType);

  const handleTagSelection = async (tagData: TagEntry) => {
    try {
      const patientRef = doc(db, 'patients', patientId);
      
      // Construimos el identificador global usando el dominio (profesión)
      const globalTagString = `${professionType}:${tagData.masterTag}`;
      
      await updateDoc(patientRef, {
        clinicalIndicators: arrayUnion({
          tag: tagData.masterTag,
          category: tagData.category,
          addedAt: new Date().toISOString() 
        }),
        // Inyectamos el string plano en el pasaporte clínico unificado
        globalTags: arrayUnion(globalTagString)
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
      
      <PredictiveTagSearch 
        dictionary={dictionary} 
        onSelectTag={handleTagSelection} 
      />
    </div>
  );
};