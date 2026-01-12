// src/utils/GamificationUtils.ts

// 1. Definición de los Niveles de Misión (Tiers)
[cite_start]// Esto centraliza cuánto XP y Oro da cada tipo de tarea. [cite: 3]
export const MISSION_TIERS = {
  EASY: {
    id: 'easy',
    label: 'Rutina (Fácil)',
    xp: 50,
    gold: 10,
    nexus: 0, // Moneda premium
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

[cite_start]// 2. Definición de Stats Base (Atributos del Personaje) [cite: 38]
export const BASE_STATS = {
  STR: { code: 'str', label: 'Fuerza (Voluntad)', value: 10 },
  INT: { code: 'int', label: 'Intelecto (Cognición)', value: 10 },
  STA: { code: 'sta', label: 'Resistencia (Emocional)', value: 10 },
  CHA: { code: 'cha', label: 'Carisma (Social)', value: 10 },
};

[cite_start]// 3. Constantes Iniciales para nuevos jugadores [cite: 47]
export const INITIAL_PLAYER_PROFILE = {
  level: 1,
  currentXp: 0,
  gold: 0, // Billetera común
  nexus: 0, // Billetera premium
  stats: {
    str: 10,
    int: 10,
    sta: 10,
    cha: 10,
  },
};

[cite_start]// 4. Fórmula para calcular el Nivel basado en la XP acumulada [cite: 61]
export const calculateLevel = (xp: number): number => {
  if (xp === 0) return 1;
  // Esta fórmula hace que subir de nivel sea progresivamente más difícil
  return Math.floor(1 + Math.sqrt(xp) * 0.1);
};

[cite_start]// 5. Fórmula para saber cuánta XP falta para el siguiente nivel [cite: 68]
export const xpForNextLevel = (currentLevel: number): number => {
  return Math.pow(currentLevel / 0.1, 2);
};

// --- NUEVO: Configuración Dinámica de Economía (God Mode) ---

export interface GameConfig {
  baseXpOneTime: number;      // XP base para misiones únicas
  baseXpRoutine: number;      // XP base para rutinas
  goldPerTask: number;        // Oro base estándar
  reflectionBonusXp: number;  // XP extra por reflexionar
  streakBonusMultiplier: number; // Multiplicador por racha (ej: 1.1)
}

// Valores de Respaldo (Default) - "Semilla" inicial
export const DEFAULT_GAME_CONFIG: GameConfig = {
  baseXpOneTime: 50,         // Equivalente a Tier EASY actual
  baseXpRoutine: 30,         // Un poco menos que una misión única
  goldPerTask: 10,           // Oro estándar actual
  reflectionBonusXp: 15,     // Incentivo por escribir
  streakBonusMultiplier: 1.05, // 5% extra por mantener racha
};