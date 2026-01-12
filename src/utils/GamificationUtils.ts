// src/utils/GamificationUtils.ts

// ============================================================================
// 1. DEFINICIÓN DE NIVELES DE MISIÓN (TIERS)
// Centraliza XP, Oro y Moneda Premium por dificultad
// ============================================================================
export const MISSION_TIERS = {
  EASY: {
    id: 'easy',
    label: 'Rutina (Fácil)',
    xp: 50,
    gold: 10,
    nexus: 0, 
    color: '#81C784', // Verde claro
  },
  MEDIUM: {
    id: 'medium',
    label: 'Desafío (Medio)',
    xp: 150,
    gold: 35,
    nexus: 0,
    color: '#2196F3', // Azul
  },
  HARD: {
    id: 'hard',
    label: 'Reto Mayor (Difícil)',
    xp: 400,
    gold: 100,
    nexus: 1, // Da 1 Nexus
    color: '#FF9800', // Naranja
  },
  LEGENDARY: {
    id: 'legendary',
    label: 'Jefe / Hito (Legendario)',
    xp: 1500,
    gold: 500,
    nexus: 5,
    color: '#E91E63', // Rosa/Rojo
  },
};

// ============================================================================
// 2. STATS BASE (ATRIBUTOS DEL PERSONAJE)
// ============================================================================
export const BASE_STATS = {
  STR: { code: 'str', label: 'Fuerza (Voluntad)', value: 10 },
  INT: { code: 'int', label: 'Intelecto (Cognición)', value: 10 },
  STA: { code: 'sta', label: 'Resistencia (Emocional)', value: 10 },
  CHA: { code: 'cha', label: 'Carisma (Social)', value: 10 },
};

// ============================================================================
// 3. PERFIL INICIAL (NUEVOS JUGADORES)
// ============================================================================
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

// ============================================================================
// 4. MOTORES DE CÁLCULO (LEVEL UP)
// ============================================================================

/**
 * Calcula la XP necesaria para alcanzar el siguiente nivel.
 * Fórmula cuadrática simple: Base * (Nivel ^ Exponente)
 */
export const xpForNextLevel = (level: number) => {
  const baseXP = 100;
  const exponent = 1.5;
  return Math.floor(baseXP * Math.pow(level, exponent));
};

/**
 * Calcula el nivel actual basado en la XP total acumulada.
 * Retorna objeto con nivel actual y progreso hacia el siguiente.
 */
export const calculateLevel = (totalXp: number) => {
  let level = 1;
  while (totalXp >= xpForNextLevel(level)) {
    totalXp -= xpForNextLevel(level);
    level++;
  }
  return {
    level,
    currentLevelXp: totalXp,
    requiredXp: xpForNextLevel(level)
  };
};

// ============================================================================
// 5. CONSTANTES PARA EL SISTEMA DE ESCAPE (NUEVO)
// Estandariza los motivos para permitir análisis de datos posteriores
// ============================================================================
export const ESCAPE_REASONS = [
  { id: 'fatigue', label: 'Fatiga Física Extrema' },
  { id: 'anxiety', label: 'Parálisis por Ansiedad / Miedo' },
  { id: 'time', label: 'Conflicto de Horario (Fuerza Mayor)' },
  { id: 'pain', label: 'Dolor o Malestar Físico' },
  { id: 'mood', label: 'Bajo Estado de Ánimo / Depresión' },
  { id: 'boredom', label: 'Falta de Interés / Aburrimiento' }
];

// ============================================================================
// 6. CONFIGURACIÓN DE VALIDACIÓN (FEEDBACK) (NUEVO)
// Etiquetas visuales para la escala de esfuerzo 1-5
// ============================================================================
export const VALIDATION_LABELS: Record<number, string> = {
  1: "Muy Difícil / Agotador",
  2: "Difícil pero posible",
  3: "Moderado / Normal",
  4: "Llevadero",
  5: "¡Salió genial / Fácil!"
};