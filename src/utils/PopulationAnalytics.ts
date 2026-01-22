import { Assignment } from '../types';
import { analyzeAssignment } from './ClinicalEngine';

// ============================================================================
// 1. INTERFACES DE POBLACIÓN (Big Data)
// ============================================================================

export interface CategoryStat {
  assignedCount: number;
  completedCount: number;
  totalSuccessScoreSum: number;
  archetypeCompletionMap: { [archetypeTag: string]: number };
  dayDistribution: { [key: string]: number }; // sun, mon, tue...
}

export interface PopulationStatsCache {
  lastUpdated: Date;
  totalActivePatients: number;
  totalTasksAssigned: number;
  byCategory: { [categoryName: string]: CategoryStat };
  
  // Curvas para predecir la carga óptima
  workloadCurve: {
    [taskCount: number]: { count: number; totalScore: number }
  };
  
  // Análisis de Factores (Para recomendaciones clínicas)
  factorImpact: {
    [factorTag: string]: { count: number; totalScore: number }
  };
  
  // Rendimiento por Especialidad 
  specialtyPerformance: {
    [specialty: string]: { count: number; totalScore: number }
  };

  // Co-ocurrencia 
  tagCorrelations: { [tagPair: string]: number };

  // Optimización de Horarios (Heatmaps)
  timeOfDayStats: {
    morning: { completed: number; totalScore: number };
    afternoon: { completed: number; totalScore: number };
    night: { completed: number; totalScore: number };
  };

  // Segmentación Demográfica
  segmentedWorkload: {
    [ageBucket: string]: {
      [taskCount: number]: { count: number; totalScore: number }
    }
  };
}

// ============================================================================
// 2. HELPERS DE SEGMENTACIÓN
// ============================================================================

const DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const getDayKey = (date: Date): string => DAY_KEYS[date.getDay()];

export const getAgeBucket = (age: number): string => {
  if (age === undefined || age === null) return 'unknown';
  // Pediatría
  if (age <= 0.5) return '0-6m';      
  if (age <= 1)   return '6m-1y';     
  if (age <= 3)   return '1-3y';      
  if (age <= 6)   return '3-6y';      

  // Escolar y Adolescencia
  if (age <= 10)  return '6-10y';     
  if (age <= 13)  return '10-13y';    
  if (age <= 16)  return '13-16y';    
  if (age <= 18)  return '16-18y';    

  // Adultez
  if (age <= 25)  return '18-25y';    
  if (age <= 40)  return '26-40y';    
  if (age <= 60)  return '41-60y';    

  return '60+y';                      
};

// ============================================================================
// 3. MOTOR DE AGREGACIÓN
// ============================================================================

/**
 * Calcula estadísticas poblacionales cruzando datos de usuarios y asignaciones.
 * @param users Lista completa de usuarios (para datos demográficos).
 * @param allAssignments Lista completa de tareas (para datos de rendimiento).
 */
export const calculateAggregatedStats = (
  users: any[], 
  allAssignments: Assignment[]
): PopulationStatsCache => {
  
  // A. Inicializar Caché
  const cache: PopulationStatsCache = {
    lastUpdated: new Date(),
    totalActivePatients: 0,
    totalTasksAssigned: allAssignments.length,
    byCategory: {},
    workloadCurve: {},
    factorImpact: {},
    specialtyPerformance: {},
    tagCorrelations: {},
    timeOfDayStats: {
      morning: { completed: 0, totalScore: 0 },
      afternoon: { completed: 0, totalScore: 0 },
      night: { completed: 0, totalScore: 0 }
    },
    segmentedWorkload: {}
  };

  // B. Crear Mapa de Usuarios para búsqueda rápida (Optimización)
  const userMap = new Map<string, any>();
  const uniquePatients = new Set<string>();
  
  users.forEach(u => {
      userMap.set(u.uid, u);
      if (u.role === 'patient') uniquePatients.add(u.uid);
  });
  
  cache.totalActivePatients = uniquePatients.size;

  // C. Iteración Principal (Big Data Loop)
  for (const task of allAssignments) {
    if(!task) continue;

    // USAMOS EL MOTOR HÍBRIDO DEL OTRO ARCHIVO
    // Nota: Si analyzeAssignment falla o no existe, usamos un objeto default seguro.
    let analysis;
    try {
        analysis = analyzeAssignment(task);
    } catch (e) {
        analysis = { adjustedScore: 0 }; // Fallback seguro
    }
    
    const score = analysis.adjustedScore || 0;

    // --- 1. Análisis de Categorías ---
    // Intentamos sacar la categoría de varios lugares posibles
    const catName = task.category || (task as any).staticTaskData?.category || "General";

    if (!cache.byCategory[catName]) {
      cache.byCategory[catName] = {
        assignedCount: 0,
        completedCount: 0,
        totalSuccessScoreSum: 0,
        archetypeCompletionMap: {},
        dayDistribution: { sun: 0, mon: 0, tue: 0, wed: 0, thu: 0, fri: 0, sat: 0 }
      };
    }
    const catStats = cache.byCategory[catName];
    catStats.assignedCount++;

    // --- 2. Análisis Temporal (Heatmaps) ---
    // Usamos completionHistory si existe, si no, intentamos con completedAt directo
    const history = (task as any).completionHistory || (task.completedAt ? [{ completedAt: task.completedAt, selfRating: task.rating }] : []);

    history.forEach((record: any) => {
        // Manejo seguro de fechas (Firestore Timestamp vs JS Date)
        const d = record.completedAt?.toDate ? record.completedAt.toDate() : new Date(record.completedAt);
        
        if (!isNaN(d.getTime())) {
            catStats.dayDistribution[getDayKey(d)]++;

            let timeBlock = record.timeBlock;
            if (!timeBlock) {
                const hour = d.getHours();
                if (hour < 12) timeBlock = 'morning';
                else if (hour < 19) timeBlock = 'afternoon';
                else timeBlock = 'night';
            }

            if (cache.timeOfDayStats[timeBlock as 'morning']) {
            const stats = cache.timeOfDayStats[timeBlock as 'morning'];
            stats.completed++;
            const ratingScore = record.selfRating ? (record.selfRating / 5) * 100 : 100;
            stats.totalScore += ratingScore;
            }
        }
    });

    if (score > 0) {
      catStats.completedCount++;
      catStats.totalSuccessScoreSum += score;

      // --- 3. Correlaciones (Arquetipos) ---
      // Buscamos etiquetas en el snapshot o directamente en la tarea
      const tags = (task as any).contextSnapshot?.archetypes || (task as any).tags || [];

      if (Array.isArray(tags)) {
        tags.forEach((tag: string) => {
          if (!catStats.archetypeCompletionMap[tag]) catStats.archetypeCompletionMap[tag] = 0;
          catStats.archetypeCompletionMap[tag]++;
        });

        const sortedTags = [...tags].sort();
        for (let i = 0; i < sortedTags.length; i++) {
          for (let j = i + 1; j < sortedTags.length; j++) {
            const pairKey = `${sortedTags[i]}::${sortedTags[j]}`;
            if (!cache.tagCorrelations[pairKey]) cache.tagCorrelations[pairKey] = 0;
            cache.tagCorrelations[pairKey]++;
          }
        }
      }

      // --- 4. Rendimiento por Especialidad ---
      const specialty = (task as any).authorSpecialty || 'general';
      if (!cache.specialtyPerformance[specialty]) {
        cache.specialtyPerformance[specialty] = { count: 0, totalScore: 0 };
      }
      cache.specialtyPerformance[specialty].count++;
      cache.specialtyPerformance[specialty].totalScore += score;
    }

    // --- 5. Curvas Globales y Segmentación ---
    const context = (task as any).contextSnapshot || {};
    const load = Math.round(context.workloadLoad || (task as any).difficultyLevel || 0);

    // Curva de Carga General 
    if (!cache.workloadCurve[load]) cache.workloadCurve[load] = { count: 0, totalScore: 0 };
    cache.workloadCurve[load].count++;
    cache.workloadCurve[load].totalScore += score;

    // Curva Segmentada por Edad
    // Intentamos obtener la edad del snapshot, si no, del mapa de usuarios
    let patientAge = context.age;
    if (patientAge === undefined && task.patientId && userMap.has(task.patientId)) {
        // Asumiendo que el usuario tiene fecha de nacimiento o campo de edad
        const user = userMap.get(task.patientId);
        if (user.age) patientAge = user.age;
        else if (user.birthDate) {
             // Cálculo rápido de edad si hay fecha de nacimiento
             const birth = user.birthDate.toDate ? user.birthDate.toDate() : new Date(user.birthDate);
             patientAge = new Date().getFullYear() - birth.getFullYear();
        }
    }

    if (patientAge !== undefined) {
        const ageBucket = getAgeBucket(patientAge);

        if (!cache.segmentedWorkload[ageBucket]) {
            cache.segmentedWorkload[ageBucket] = {};
        }
        if (!cache.segmentedWorkload[ageBucket][load]) {
            cache.segmentedWorkload[ageBucket][load] = { count: 0, totalScore: 0 };
        }

        cache.segmentedWorkload[ageBucket][load].count++;
        cache.segmentedWorkload[ageBucket][load].totalScore += score;
    }

    // Factores Externos
    const prevHistory = context.history?.previousTherapyHistory;
    if (prevHistory) {
        const k = `hist_${prevHistory}`;
        if (!cache.factorImpact[k]) cache.factorImpact[k] = { count: 0, totalScore: 0 };
        cache.factorImpact[k].count++;
        cache.factorImpact[k].totalScore += score;
    }
    
  }

  return cache;
};