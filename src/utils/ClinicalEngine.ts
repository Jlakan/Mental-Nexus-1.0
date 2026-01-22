// src/utils/ClinicalEngine.ts

import { 
  doc, 
  getDoc, 
  setDoc, 
  addDoc, 
  collection, 
  serverTimestamp,
  arrayUnion 
} from "firebase/firestore";
import { 
  differenceInHours, 
  isWithinInterval, 
  addDays, 
  getDay, 
  startOfWeek, 
  endOfWeek, 
  eachWeekOfInterval, 
  differenceInDays, 
  startOfDay,
  isSameDay
} from 'date-fns';
import { db } from '../services/firebase';

// ============================================================================
// 1. INTERFACES DE DOMINIO
// ============================================================================

export type SecurityAction = 'access_granted' | 'access_revoked' | 'access_denied' | 'view_sensitive';
export type TreatmentModality = 'monotherapy_pharma' | 'monotherapy_psych' | 'combined';
export type StabilityTrend = 'stable' | 'performance_drop' | 'unsustainable_spike' | 'insufficient_data';
export type UserClinicalStatus = 'active' | 'toxic_churn' | 'positive_disengagement' | 'at_risk';

interface LogData {
  patientId: string;
  professionalId: string;
  category: string;
  action: SecurityAction;
  details?: string;
}

export interface PatientContextSnapshot {
  archetypes: string[];
  workloadLoad: number;
  age: number; 
  treatment?: { modality: TreatmentModality; isIntegrated: boolean; complexityIndex: number; };
  phenotype?: { mobilityEntropy: number; screenTimeNightMinutes: number; appSessionLatencyHours: number; };
  currentPHQ9?: number;
  history?: { 
      previousTherapyHistory?: string; 
      historicalPDC?: number;
      priorTreatmentAttempts?: number;
  }; 
}

export interface CompletionRecord {
  completedAt: Date | any; // Soporte para Timestamp de Firebase y Date nativo
  selfRating?: number; 
  timeBlock?: 'morning' | 'afternoon' | 'night';
}

export interface Assignment {
  id: string;
  professionalId: string;
  patientId: string;
  type: 'one_time' | 'recurring' | 'routine';
  
  // Datos de Identificación Resiliente
  title?: string;
  catalogId?: string | null; 
  staticTaskData?: {
    category: string;
    title: string; 
    difficulty: 'easy' | 'medium' | 'hard';
    originalTitle?: string;
    estimatedLoad?: number;
  };

  // Datos Operativos
  completionHistory: CompletionRecord[];
  pauses?: Array<{ start: Date; end: Date }>; 
  frequency?: { [key: string]: number }; 
  assignedAt: Date | any; // Puede venir como Timestamp, Date o undefined (en datos legacy)
  totalVolumeExpected?: number;
  
  // Datos Clínicos
  contextSnapshot?: PatientContextSnapshot;
  therapistValidation?: { rating: number; };
  authorSpecialty?: string; // Para analytics
  
  status?: string;
  progress?: { completedCount: number };
  lastCompletedAt?: any;
  createdAt?: any;
  updatedAt?: any;
}

export interface AssignmentAnalysis {
  successScore: number;
  consistencyScore: number;
  intensityPercentage: number;
  streakDays: number;
  clinicalStatus: UserClinicalStatus;
  adjustedScore: number;
  stabilityTrend: StabilityTrend;
  algoConfidence: number;
  insightMessage: string;
  weeklyPulse?: number[]; 
}

export interface CatalogPerformance {
  catalogId: string;
  title: string;
  usageCount: number;
  globalSuccessRate: number;
  dropoutRate: number;
  workloadImpact: number;
}

// ============================================================================
// 2. MÓDULO DE SEGURIDAD
// ============================================================================

export const logClinicalAccess = async (data: LogData) => {
  try {
    await addDoc(collection(db, "audit_logs"), {
      ...data,
      timestamp: serverTimestamp(),
      userAgent: window.navigator.userAgent
    });
  } catch (error) {
    console.error("Fallo auditoría:", error);
  }
};

export const verifyPin = async (patientId: string, inputPin: string): Promise<boolean> => {
  try {
    const userDoc = await getDoc(doc(db, "users", patientId));
    if (!userDoc.exists()) return false;
    const realPin = userDoc.data().privacyPin;
    return String(realPin).trim() === String(inputPin).trim();
  } catch (error) {
    return false;
  }
};

export const grantCategoryAccess = async (patientId: string, professionalId: string, category: string) => {
  const permissionRef = doc(db, "users", patientId, "permissions", professionalId);
  await setDoc(permissionRef, {
    professionalId,
    grantedAt: serverTimestamp(),
    categories: arrayUnion(category)
  }, { merge: true });
  await logClinicalAccess({ patientId, professionalId, category, action: 'access_granted' });
};

export const checkPermission = async (patientId: string, professionalId: string, category: string): Promise<boolean> => {
  try {
    const permissionRef = doc(db, "users", patientId, "permissions", professionalId);
    const snap = await getDoc(permissionRef);
    if (!snap.exists()) return false;
    const data = snap.data();
    return (data.categories || []).includes(category) || (data.categories || []).includes('GLOBAL');
  } catch (error) {
    return false;
  }
};

// ============================================================================
// 3. HELPERS Y UTILIDADES MATEMÁTICAS
// ============================================================================

const DECAY_LAMBDA = 0.025;
const TRUST_THRESHOLD_DAYS = 30;

const isDatePaused = (date: Date, pauses: Array<{ start: Date; end: Date }>): boolean => {
  if (!pauses || pauses.length === 0) return false;
  return pauses.some(pause => {
      // Conversión defensiva
      const s = (pause.start as any).toDate ? (pause.start as any).toDate() : new Date(pause.start);
      const e = (pause.end as any).toDate ? (pause.end as any).toDate() : new Date(pause.end);
      return isWithinInterval(date, { start: s, end: e });
  });
};

const calculateStreak = (history: CompletionRecord[], referenceDate: Date): number => {
  if (history.length === 0) return 0;
  const getJsDate = (d: any) => d.toDate ? d.toDate() : new Date(d);
  
  const sorted = [...history].sort((a, b) => getJsDate(b.completedAt).getTime() - getJsDate(a.completedAt).getTime());
  let streak = 0;
  let currentDate = startOfDay(referenceDate);
  
  for (const record of sorted) {
    const recordDay = startOfDay(getJsDate(record.completedAt));
    const diff = differenceInDays(currentDate, recordDay);
    if (diff <= 1) { 
      if (!isSameDay(currentDate, recordDay)) streak++; 
      currentDate = recordDay;
    } else {
      break;
    }
  }
  return streak;
};

// ============================================================================
// 4. MODELOS PREDICTIVOS
// ============================================================================

export const classifyUserStatus = (snapshot: PatientContextSnapshot): UserClinicalStatus => {
  const latency = snapshot.phenotype?.appSessionLatencyHours || 0;
  const phq9 = snapshot.currentPHQ9 ?? 99;

  if (latency < 48) return 'active';
  if (latency > 168) {
    if (phq9 < 5) return 'positive_disengagement'; 
    return 'toxic_churn'; 
  }
  return 'at_risk';
};

export const calculateRegimenAdjustedScore = (rawScore: number, complexityIndex: number): number => {
  if (complexityIndex > 7 && rawScore > 70) return Math.min(100, rawScore * 1.15);
  return rawScore;
};

// ============================================================================
// 5. MOTOR DE ANÁLISIS HÍBRIDO (DOBLE MOTOR)
// ============================================================================

const calculateWeeklyPulse = (assignment: Assignment): number[] => {
  if (assignment.type === 'one_time') return [];

  // --- FIX: Validación de seguridad para tareas antiguas sin fecha ---
  if (!assignment.assignedAt) {
      // console.warn(`⚠️ Tarea sin fecha asignada (ID: ${assignment.id}). Se omite pulso semanal.`);
      return [];
  }
  // -----------------------------------------------------------------

  const history = assignment.completionHistory || [];
  const pauses = assignment.pauses || [];
  const frequency = assignment.frequency || { lun:1, mar:1, mie:1, jue:1, vie:1, sab:1, dom:1 };
  const originalTarget = Object.keys(frequency).length; 
  if (originalTarget === 0) return [];

  // FIX: Uso seguro de fecha (Timestamp vs Date)
  const assignedDate = (assignment.assignedAt as any).toDate 
      ? (assignment.assignedAt as any).toDate() 
      : new Date(assignment.assignedAt);

  const start = startOfWeek(assignedDate);
  const end = endOfWeek(new Date());
  
  if (start > end) return [0];

  const weeks = eachWeekOfInterval({ start, end });
  const weeklyScores: number[] = [];

  for (const weekStart of weeks) {
    const weekEnd = endOfWeek(weekStart);
    let pausedDaysCount = 0;
    let currentDay = weekStart;
    
    while(currentDay <= weekEnd) {
      if(isDatePaused(currentDay, pauses)) pausedDaysCount++;
      currentDay = addDays(currentDay, 1);
    }
    
    const activeDaysInWeek = 7 - pausedDaysCount;
    if (activeDaysInWeek <= 0) { weeklyScores.push(-1); continue; }

    const adjustedTarget = Math.ceil(originalTarget * (activeDaysInWeek / 7));
    if (adjustedTarget === 0) { weeklyScores.push(0); continue; }

    const uniqueDaysCompleted = new Set();
    history.forEach(record => {
      // FIX: Validación de fecha en historial también
      if (record.completedAt) {
        const d = (record.completedAt as any).toDate 
          ? (record.completedAt as any).toDate() 
          : new Date(record.completedAt);
        if (isWithinInterval(d, { start: weekStart, end: weekEnd })) uniqueDaysCompleted.add(getDay(d));
      }
    });
    
    const score = Math.min(100, (uniqueDaysCompleted.size / adjustedTarget) * 100);
    weeklyScores.push(Math.round(score));
  }
  return weeklyScores;
};

export const analyzeAssignment = (assignment: Assignment): AssignmentAnalysis & { weeklyPulse: number[] } => {
  const history = assignment.completionHistory || [];
  const now = new Date();
  const clinicalStatus = assignment.contextSnapshot ? classifyUserStatus(assignment.contextSnapshot) : 'active';

  // MOTOR 1: RÁPIDO 
  let completionRate = 0;
  if (assignment.totalVolumeExpected && assignment.totalVolumeExpected > 0) {
      completionRate = Math.min(100, (history.length / assignment.totalVolumeExpected) * 100);
  } else {
      // --- FIX: Manejo seguro de fecha nula (Fallback a hoy) ---
      let assignedDate = new Date(); 
      if (assignment.assignedAt) {
          assignedDate = (assignment.assignedAt as any).toDate 
            ? (assignment.assignedAt as any).toDate() 
            : new Date(assignment.assignedAt);
      }
      // --------------------------------------------------------

      const daysSince = Math.max(1, differenceInDays(now, assignedDate));
      completionRate = Math.min(100, (history.length / daysSince) * 100);
  }

  // MOTOR 2: PROFUNDO
  const weeklyPulse = calculateWeeklyPulse(assignment);

  // TENDENCIAS
  let trend: StabilityTrend = 'insufficient_data';
  if (weeklyPulse.length >= 2) {
      const validWeeks = weeklyPulse.filter(w => w >= 0); 
      const recent = validWeeks.slice(-2);
      if (recent.length === 2) {
          if (recent[1] < recent[0] - 15) trend = 'performance_drop';
          else if (recent[1] > recent[0] + 20) trend = 'unsustainable_spike';
          else trend = 'stable';
      }
  }

  // SCORE FINAL
  let algoScore = 0;
  if (history.length > 0) {
      const last = history[history.length -1];
      
      // FIX: Validación si last.completedAt existe
      if (last && last.completedAt) {
        const lastDate = (last.completedAt as any).toDate 
            ? (last.completedAt as any).toDate() 
            : new Date(last.completedAt);
        const latencyHours = Math.abs(differenceInHours(now, lastDate));
        const freshness = 100 * Math.exp(-DECAY_LAMBDA * (latencyHours / 24)); 
        algoScore = (completionRate * 0.7) + (freshness * 0.3);
      }
  }

  // FIX: Validación en mapeo de fechas únicas para evitar crash
  const uniqueDays = new Set(history
    .filter(r => r.completedAt) // Filtramos registros corruptos
    .map(r => ((r.completedAt as any).toDate 
        ? (r.completedAt as any).toDate() 
        : new Date(r.completedAt)).toISOString().split('T')[0])
  ).size;
  
  const alpha = Math.min(0.8, uniqueDays / TRUST_THRESHOLD_DAYS);

  let finalScore = algoScore;
  if (assignment.therapistValidation) {
    const tVal = (assignment.therapistValidation.rating / 5) * 100;
    finalScore = (alpha * algoScore) + ((1 - alpha) * tVal);
  }

  const complexity = assignment.contextSnapshot?.treatment?.complexityIndex || 1;
  const adjustedScore = Math.round(calculateRegimenAdjustedScore(finalScore, complexity));

  return {
    successScore: Math.round(finalScore),
    adjustedScore,
    algoConfidence: parseFloat(alpha.toFixed(2)),
    consistencyScore: 85, 
    intensityPercentage: Math.round(completionRate), 
    weeklyPulse, 
    streakDays: calculateStreak(history, now),
    clinicalStatus,
    stabilityTrend: trend, 
    insightMessage: trend === 'performance_drop' ? '📉 Caída de rendimiento reciente' : 'Comportamiento nominal'
  };
};

// ============================================================================
// 6. ANÁLISIS POR LOTES
// ============================================================================

export const analyzeCatalogBatch = (allAssignments: Assignment[]): CatalogPerformance[] => {
  const accumulatorMap: Record<string, {
    count: number;
    scoreSum: number;
    dropoutCount: number;
    title: string;
    workloadSum: number;
  }> = {};

  allAssignments.forEach(assignment => {
    // Identificación resiliente
    const rawId = assignment.catalogId || assignment.staticTaskData?.originalTitle || assignment.title || assignment.id;
    const key = rawId ? String(rawId).trim().toLowerCase() : "unknown"; 

    const displayTitle = assignment.staticTaskData?.title || assignment.title || "Tarea Desconocida";

    if (!accumulatorMap[key]) {
      accumulatorMap[key] = {
        count: 0,
        scoreSum: 0,
        dropoutCount: 0,
        title: displayTitle,
        workloadSum: 0
      };
    }

    const analysis = analyzeAssignment(assignment);
    const stats = accumulatorMap[key];

    stats.count++;
    stats.scoreSum += analysis.adjustedScore;
    stats.workloadSum += (assignment.staticTaskData?.estimatedLoad || 3);

    if (analysis.clinicalStatus === 'toxic_churn') {
      stats.dropoutCount++;
    }
  });

  return Object.keys(accumulatorMap).map(key => {
    const acc = accumulatorMap[key];
    return {
      catalogId: key,
      title: acc.title,
      usageCount: acc.count,
      globalSuccessRate: acc.count > 0 ? Math.round(acc.scoreSum / acc.count) : 0,
      dropoutRate: acc.count > 0 ? parseFloat(((acc.dropoutCount / acc.count) * 100).toFixed(1)) : 0,
      workloadImpact: acc.count > 0 ? parseFloat((acc.workloadSum / acc.count).toFixed(1)) : 0
    };
  }).sort((a, b) => b.usageCount - a.usageCount);
};