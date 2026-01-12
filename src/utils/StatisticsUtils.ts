import {
  differenceInHours,
  isWithinInterval,
  addDays,
  getDay,
  startOfDay,
  differenceInWeeks,
  differenceInDays
} from 'date-fns';

// ============================================================================
// 1. DEFINICIONES DE TIPOS (INTERFACES DE DATOS)
// ============================================================================

export type TaskType = 'one_time' | 'recurring';
export type ValidationRating = 1 | 2 | 3 | 4 | 5; // Escala Likert 1-5
export type TimeBlock = 'morning' | 'afternoon' | 'night';
export type PauseCategory = 'physical_health' | 'mental_health' | 'work_load' | 'vacation' | 'other';
export type DayKey = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

/**
 * Snapshot del contexto del paciente al momento de la asignación.
 */
export interface PatientContextSnapshot {
  archetypes: string[];      // ej. ["low_energy", "anxious"]
  workloadLoad: number;      // Tareas activas en ese momento
  energyLevel?: number;      // 1-100
}

/**
 * Registro individual de cumplimiento.
 * ACTUALIZADO: Soporte para estado y motivo de escape.
 */
export interface CompletionRecord {
  completedAt: Date;       // Fecha real de ejecución (ej. Lunes)
  loggedAt: Date;          // Fecha de registro en app (ej. Jueves -> Check Tardío)
  timeBlock: TimeBlock;
  selfRating?: ValidationRating;
  note?: string;           // Reflexión privada (o motivo de escape)
  
  // Nuevos campos para Core Loop avanzado
  status?: 'completed' | 'escaped'; 
  motive?: string;         // ID del motivo de escape (ej. 'anxiety')
}

/**
 * Periodo de Pausa Justificada.
 */
export interface PausePeriod {
  startDate: Date;
  endDate?: Date;          // undefined = Pausa activa actualmente
  pausedBy: 'patient' | 'professional';
  reasonCategory: PauseCategory;
  reasonNote?: string;
}

/**
 * Estructura Principal: ASSIGNMENT
 * (Se asume que las fechas ya son objetos Date nativos de JS)
 */
export interface Assignment {
  id: string;
  professionalId: string;
  patientId: string;
  type: TaskType;
  isCustomTask: boolean;   // true = Tarea manual (fuera de estadística clínica)

  staticTaskData: {
    title: string;
    category: string;      // ej. "Físico", "Cognitivo"
    difficulty: 'easy' | 'medium' | 'hard';
  };

  contextSnapshot: PatientContextSnapshot;

  assignedAt: Date;
  // Frecuencia Estandarizada: { "mon": 1, "wed": 2 }
  frequency?: { [key in DayKey]?: number };

  completionHistory: CompletionRecord[];
  pauses: PausePeriod[];

  // Validación del Terapeuta
  therapistValidation?: {
    rating: ValidationRating;
    notes?: string;
    validatedAt: Date;
  };
}

/**
 * Resultado del análisis individual para UI/Dashboards
 */
export interface AssignmentAnalysis {
  successScore: number;        // 0-100 (KPI Principal)
  intensityPercentage: number; // >100% = Sobrecarga
  perceptionGap?: number;      // Diferencia Paciente vs Terapeuta
  consistencyFlag?: 'stable' | 'erratic' | 'cramming';
  insightMessage: string;
  pauseImpact?: 'adjusted' | 'none';
}

/**
 * NUEVA INTERFAZ: Estadísticas de Supervivencia y Abandono
 */
export interface SurvivalStats {
  lastActiveDate: Date | null;
  survivalWeeks: number; // Semanas que el paciente "sobrevivió" activo
  status: 'active' | 'abandoned' | 'completed';
  daysSinceLastAction: number;
}

// --- INTERFACES PARA LA AGREGACIÓN (CACHE) ---

export interface CategoryStat {
  assignedCount: number;
  completedCount: number;      // Tareas finalizadas o con >80% de avance
  totalSuccessScoreSum: number; // Para calcular promedio (Sum / Count)
  // Mapa de calor: ¿Qué arquetipo completa más esta categoría?
  // ej. { "night_owl": 15, "anxious": 2 }
  archetypeCompletionMap: { [archetypeTag: string]: number };
}

export interface ProfessionalStatsCache {
  lastUpdated: Date;
  totalActivePatients: number; // Recalculado al vuelo
  totalTasksAssigned: number;
  // Estadísticas desglosadas por categoría
  byCategory: {
    [categoryName: string]: CategoryStat;
  };
}

// ============================================================================
// 2. CONSTANTES & CONFIGURACIÓN
// ============================================================================

const DECAY_LAMBDA = 0.025;   // Factor de decaimiento para tareas únicas
const MANIA_THRESHOLD = 150;  // % de intensidad para alerta de manía
const DAY_KEYS: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

// ============================================================================
// 3. HELPERS INTERNOS (FUNCIONES PURAS)
// ============================================================================

/** Convierte fecha JS a Key estandarizada ('mon', 'tue'...) */
const getDayKey = (date: Date): DayKey => {
  return DAY_KEYS[getDay(date)];
};

/** Verifica si una fecha cae dentro de un periodo de pausa */
const isDatePaused = (date: Date, pauses: PausePeriod[]): boolean => {
  if (!pauses || pauses.length === 0) return false;
  return pauses.some(pause => {
    const end = pause.endDate || new Date(); // Si no tiene fin, es hasta hoy
    return isWithinInterval(date, { start: pause.startDate, end });
  });
};

/** Calcula cuántos checks se esperaban teóricamente en un rango de fechas */
const calculateExpectedCompletions = (
  start: Date,
  end: Date,
  frequency: { [key in DayKey]?: number },
  pauses: PausePeriod[]
): number => {
  let expected = 0;
  let current = startOfDay(start);
  const endLimit = startOfDay(end);

  while (current <= endLimit) {
    // 1. Si el día está pausado, no exigimos nada
    if (!isDatePaused(current, pauses)) {
      // 2. Si no está pausado, sumamos la carga de ese día
      const dayKey = getDayKey(current);
      const dailyTarget = frequency[dayKey] || 0;
      expected += dailyTarget;
    }
    current = addDays(current, 1);
  }
  return Math.max(1, expected); // Evitar división por cero
};

// ============================================================================
// 4. MOTORES MATEMÁTICOS (CORE LÓGICO)
// ============================================================================

/**
 * NUEVO MOTOR DE SUPERVIVENCIA
 * Analiza la "Curva de Supervivencia" del paciente en esta tarea.
 * Detecta abandono silencioso (>7 días inactivo).
 */
export const calculateSurvival = (
  assignment: Assignment,
  now: Date = new Date()
): SurvivalStats => {
  const history = assignment.completionHistory || [];
  
  // 1. Encontrar la última interacción (sea Éxito o Escape)
  let lastDate: Date | null = null;
  
  if (history.length > 0) {
    // Ordenamos descendente para tomar la más reciente
    // Copiamos el array para no mutar el original
    const sorted = [...history].sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());
    lastDate = sorted[0].completedAt;
  } else {
    // Si no hay historial, la última "actividad" fue la asignación misma
    lastDate = assignment.assignedAt;
  }

  // 2. Calcular Métricas Temporales
  const daysSince = differenceInDays(now, lastDate);
  const survivalWeeks = differenceInWeeks(lastDate, assignment.assignedAt);
  
  // 3. Determinar Estado
  let status: 'active' | 'abandoned' | 'completed' = 'active';

  // CASO A: Tarea Única (One-Time)
  if (assignment.type === 'one_time') {
    const isCompleted = history.some(h => h.status === 'completed' || (!h.status && h.completedAt));
    if (isCompleted) {
      status = 'completed';
    }
    // Si no está completada y pasó mucho tiempo, podría considerarse abandonada,
    // pero mantenemos lógica simple por ahora.
  } 
  // CASO B: Recurrente (Routine)
  else {
    // Lógica de Abandono: Más de 7 días sin actividad
    // Nota: Si existiera endDate, verificaríamos (lastActiveDate < endDate)
    if (daysSince > 7) {
      status = 'abandoned';
    }
  }

  return {
    lastActiveDate: lastDate,
    survivalWeeks: Math.max(0, survivalWeeks),
    status,
    daysSinceLastAction: daysSince
  };
};

/**
 * ALGORITMO A: CURVA DE DECAIMIENTO (Latencia)
 * Para tareas de una sola vez. Penaliza la tardanza.
 */
export const calculateAttachmentScore = (
  assignedAt: Date,
  record?: CompletionRecord
): number => {
  if (!record) return 0;
  // Usamos completedAt (hecho real) para medir disciplina clínica.
  const latencyHours = Math.abs(differenceInHours(record.completedAt, assignedAt));
  const rawScore = 100 * Math.exp(-DECAY_LAMBDA * latencyHours);
  return Math.round(Math.max(0, Math.min(100, rawScore)));
};

/**
 * ALGORITMO B: CONSISTENCIA & VOLUMEN (Rutinas)
 * Maneja sobrecarga, pausas y variabilidad.
 */
export const calculateRoutineStats = (
  assignment: Assignment
): { score: number; intensity: number; flag: 'stable' | 'erratic' | 'cramming' } => {
  const history = assignment.completionHistory || [];
  const pauses = assignment.pauses || [];
  const frequency = assignment.frequency || {};

  // Solo contamos éxitos reales para el score clínico (status !== 'escaped')
  // Aunque 'escaped' mantiene la racha visual, no suma al "score de eficacia".
  const effectiveHistory = history.filter(h => h.status !== 'escaped');

  if (effectiveHistory.length === 0) return { score: 0, intensity: 0, flag: 'stable' };

  // 1. Calcular Intensidad (Volumen Real vs Esperado - Pausas)
  const now = new Date();
  const expectedTotal = calculateExpectedCompletions(
    assignment.assignedAt,
    now,
    frequency,
    pauses
  );
  const totalCompleted = effectiveHistory.length;
  const intensity = Math.round((totalCompleted / expectedTotal) * 100);

  // 2. Calcular Desviación Estándar de Intervalos (Estabilidad del Hábito)
  const sortedRecords = [...effectiveHistory].sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime());
  const validIntervals: number[] = [];
  for (let i = 1; i < sortedRecords.length; i++) {
    const current = sortedRecords[i].completedAt;
    const prev = sortedRecords[i-1].completedAt;

    const midPoint = addDays(prev, 1);
    if (!isDatePaused(midPoint, pauses)) {
      validIntervals.push(differenceInHours(current, prev));
    }
  }

  // 3. Análisis de Varianza
  let flag: 'stable' | 'erratic' | 'cramming' = 'stable';
  let scoreBase = 100;

  if (validIntervals.length > 1) {
    const mean = validIntervals.reduce((a, b) => a + b, 0) / validIntervals.length;
    const variance = validIntervals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / validIntervals.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / (mean + 0.001);

    if (cv > 1.5) {
      flag = 'cramming';
      scoreBase = 60;
    } else if (cv > 0.6) {
      flag = 'erratic';
      scoreBase = 80;
    }
  }

  if (intensity < 100) {
    scoreBase = (scoreBase + Math.min(100, intensity)) / 2;
  }

  return { score: Math.round(scoreBase), intensity, flag };
};

// ============================================================================
// 5. ANÁLISIS INDIVIDUAL (API PÚBLICA)
// ============================================================================

/**
 * Función principal llamada por el Frontend o Cloud Functions para ver una tarea.
 */
export const analyzeAssignment = (assignment: Assignment): AssignmentAnalysis => {
  const safeHistory = assignment.completionHistory || [];
  const safePauses = assignment.pauses || [];
  
  // --- A. TAREAS CUSTOM (Saltar lógica clínica) ---
  if (assignment.isCustomTask) {
    const count = safeHistory.length;
    return {
      successScore: count > 0 ? 100 : 0,
      intensityPercentage: 100,
      insightMessage: `Tarea personalizada. Completada ${count} veces.`,
      consistencyFlag: 'stable'
    };
  }

  // --- B. TAREAS CATALOGADAS ---
  let score = 0;
  let intensity = 0;
  let consistencyFlag: any = 'stable';
  let insights: string[] = [];

  // 1. Cálculo Matemático
  if (assignment.type === 'one_time') {
    const lastRecord = safeHistory[safeHistory.length - 1];
    score = calculateAttachmentScore(assignment.assignedAt, lastRecord);
    intensity = score > 0 ? 100 : 0;
  } else {
    const stats = calculateRoutineStats(assignment);
    score = stats.score;
    intensity = stats.intensity;
    consistencyFlag = stats.flag;
  }

  // 2. Alertas de Contexto
  if (intensity > MANIA_THRESHOLD) insights.push("⚠️ ALERTA: Sobrecarga/Riesgo Maníaco.");
  else if (intensity > 100) insights.push("🔥 Flow: Superó la meta.");

  if (consistencyFlag === 'cramming') insights.push("📉 Patrón de acumulación (Cramming).");

  // 3. Gap de Percepción (Validación Humana)
  let perceptionGap: number | undefined;
  // Buscamos el último record que NO sea escapado y tenga rating
  const validRecords = safeHistory.filter(h => h.status !== 'escaped' && h.selfRating);
  const lastRecord = validRecords[validRecords.length - 1];

  if (assignment.therapistValidation && lastRecord?.selfRating) {
    const tVal = assignment.therapistValidation.rating;
    const pVal = lastRecord.selfRating;
    perceptionGap = Math.abs(pVal - tVal);

    const validationScore = (tVal / 5) * 100;
    score = (score * 0.4) + (validationScore * 0.6);

    if (perceptionGap >= 2) {
      const type = pVal > tVal ? "Sobreestimación" : "Subestimación";
      insights.push(`👁️ Discrepancia: ${type} (Gap: ${perceptionGap}).`);
    }
  }

  // 4. Pausas
  const hasActivePause = safePauses.some(p => !p.endDate);
  if (hasActivePause) insights.push("⏸️ En Pausa Activa.");
  
  // 5. NUEVO: Alerta de Abandono (Supervivencia)
  const survival = calculateSurvival(assignment);
  if (survival.status === 'abandoned') {
    insights.push(`⚠️ Abandono detectado (Semana ${survival.survivalWeeks}).`);
  }

  return {
    successScore: Math.round(Math.min(100, score)),
    intensityPercentage: intensity,
    perceptionGap,
    consistencyFlag,
    insightMessage: `Score: ${Math.round(score)}. ${insights.join(" ")}`,
    pauseImpact: safePauses.length > 0 ? 'adjusted' : 'none'
  };
};

// ============================================================================
// 6. AGREGADOR GLOBAL (STATS CACHE)
// ============================================================================

export const calculateTherapistGlobalStats = (
  allAssignments: Assignment[]
): ProfessionalStatsCache => {
  const cache: ProfessionalStatsCache = {
    lastUpdated: new Date(),
    totalTasksAssigned: allAssignments.length,
    totalActivePatients: 0,
    byCategory: {}
  };

  const uniquePatients = new Set<string>();

  for (const task of allAssignments) {
    if(!task) continue;

    uniquePatients.add(task.patientId);
    const catName = task.staticTaskData?.category || "General";

    if (!cache.byCategory[catName]) {
      cache.byCategory[catName] = {
        assignedCount: 0,
        completedCount: 0,
        totalSuccessScoreSum: 0,
        archetypeCompletionMap: {}
      };
    }

    const catStats = cache.byCategory[catName];
    catStats.assignedCount++;

    const analysis = analyzeAssignment(task);
    const isCompletedOrActive = analysis.intensityPercentage > 0;

    if (isCompletedOrActive) {
      catStats.completedCount++;

      if (!task.isCustomTask) {
        catStats.totalSuccessScoreSum += analysis.successScore;
      }

      if (task.contextSnapshot?.archetypes) {
        task.contextSnapshot.archetypes.forEach(tag => {
          if (!catStats.archetypeCompletionMap[tag]) {
            catStats.archetypeCompletionMap[tag] = 0;
          }
          catStats.archetypeCompletionMap[tag]++;
        });
      }
    }
  }

  cache.totalActivePatients = uniquePatients.size;
  return cache;
};