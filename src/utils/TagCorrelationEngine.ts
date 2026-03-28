// src/utils/TagCorrelationEngine.ts

export const calculateTagCorrelations = (patientsList: any[]) => {
    const correlations: Record<string, number> = {};
  
    patientsList.forEach(patient => {
      const tags = patient.globalTags || [];
      
      // Solo correlacionamos si el paciente tiene 2 o más tags
      if (tags.length < 2) return;
  
      // Generar todas las combinaciones posibles de pares de tags
      for (let i = 0; i < tags.length; i++) {
        for (let j = i + 1; j < tags.length; j++) {
          
          // Ordenamos alfabéticamente para que (A+B) sea idéntico a (B+A)
          const pair = [tags[i], tags[j]].sort();
          
          // Al quitar la restricción de profesión, guardamos TODOS los cruces
          const key = `${pair[0]} 🔗 ${pair[1]}`;
          correlations[key] = (correlations[key] || 0) + 1;
        }
      }
    });
  
    // Convertimos el diccionario en un arreglo ordenado por mayor frecuencia
    return Object.entries(correlations)
      .map(([pairName, count]) => ({ pairName, count }))
      .sort((a, b) => b.count - a.count);
  };