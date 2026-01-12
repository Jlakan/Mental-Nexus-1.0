// src/utils/GamificationUtils.ts

// 1. Definición de los Niveles de Misión (Tiers)
export const MISSION_TIERS = {
  EASY: {
    id: 'easy',
    label: 'Rutina (Fácil)',
    xp: 50,
    gold: 10,
    nexus: 0,
    color: '#81C784',
  },
  MEDIUM: {
    id: 'medium',
    label: 'Desafío (Medio)',
    xp: 150,
    gold: 35,
    nexus: 0,
    color: '#2196F3',
  },
  HARD: {
    id: 'hard',
    label: 'Reto Mayor (Difícil)',
    xp: 400,
    gold: 100,
    nexus: 1,
    color: '#FF9800',
  },
  LEGENDARY: {
    id: 'legendary',
    label: 'Jefe / Hito (Legendario)',
    xp: 1500,
    gold: 500,
    nexus: 5,
    color: '#E91E63',
  },
};

// 2. Definición de Stats Base
export const BASE_STATS = {
  STR: { code: 'str', label: 'Fuerza (Voluntad)', value: 10 },
  INT: { code: 'int', label: 'Intelecto (Cognición)', value: 10 },
  STA: { code: 'sta', label: 'Resistencia (Emocional)', value: 10 },
  CHA: { code: 'cha', label: 'Carisma (Social)', value: 10 },
};

// 3. Constantes Iniciales
export const INITIAL_PLAYER_PROFILE = {
  level: 1,
  currentXp: 0,
  gold: 0,
  nexus: 0,
  stats: {
    str: 10,
    int: 10,
    sta: 10,
    cha: 10,
  },
};

// 4. Constantes de UI y Lógica (RESTAURADAS)
export const ESCAPE_REASONS = [
  { id: 'too_hard', label: 'Muy difícil' },
  { id: 'boring', label: 'Aburrido / Repetitivo' },
  { id: 'tired', label: 'Cansancio / Baja energía' },
  { id: 'anxiety', label: 'Me genera ansiedad' },
  { id: 'external', label: 'Interrupción externa' }
];

export const VALIDATION_LABELS: Record<number, string> = {
  1: 'Muy insatisfecho',
  2: 'Poco satisfecho',
  3: 'Neutral',
  4: 'Satisfecho',
  5: 'Muy satisfecho'
};

// 5. Fórmulas de Nivel (CORREGIDAS para PatientDashboard)
// Devuelve un objeto completo en lugar de solo el número para evitar errores en Dashboard
export const calculateLevel = (totalXp: number) => {
  if (totalXp < 0) totalXp = 0;
  
  // Fórmula inversa: XP = ((Nivel - 1) * 10)^2
  // Nivel = 1 + sqrt(XP)/10
  const rawLevel = 1 + Math.sqrt(totalXp) * 0.1;
  const level = Math.floor(rawLevel);

  // Calcular XP límites para este nivel
  // Nivel 1 empieza en 0 XP. Nivel 2 empieza en 100 XP (1+sqrt(100)*0.1 = 2).
  const xpStartCurrent = Math.pow((level - 1) * 10, 2);
  const xpStartNext = Math.pow((level) * 10, 2);

  const requiredXp = xpStartNext - xpStartCurrent;
  const currentLevelXp = totalXp - xpStartCurrent;

  return {
    level,
    currentLevelXp, // XP acumulada dentro del nivel actual
    requiredXp,     // XP necesaria para completar este nivel
    progressPercent: requiredXp > 0 ? (currentLevelXp / requiredXp) * 100 : 0
  };
};

export const xpForNextLevel = (currentLevel: number): number => {
  // Retorna la XP TOTAL necesaria para alcanzar el siguiente nivel
  return Math.pow(currentLevel * 10, 2);
};

// --- Configuración Dinámica de Economía ---

export interface GameConfig {
  baseXpOneTime: number;
  baseXpRoutine: number;
  goldPerTask: number;
  reflectionBonusXp: number;
  streakBonusMultiplier: number;
}

export const DEFAULT_GAME_CONFIG: GameConfig = {
  baseXpOneTime: 50,
  baseXpRoutine: 30,
  goldPerTask: 10,
  reflectionBonusXp: 15,
  streakBonusMultiplier: 1.05,
};