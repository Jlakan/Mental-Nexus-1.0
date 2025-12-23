// src/utils/GamificationUtils.ts

// 1. Definición de los Niveles de Misión (Tiers)
// Esto centraliza cuánto XP y Oro da cada tipo de tarea.
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
// 2. Definición de Stats Base (Atributos del Personaje)
// Puedes cambiar estos nombres según el enfoque clínico (ej: Resiliencia, Enfoque)
// o dejarlos estilo RPG clásico.
export const BASE_STATS = {
  STR: { code: 'str', label: 'Fuerza (Voluntad)', value: 10 },
  INT: { code: 'int', label: 'Intelecto (Cognición)', value: 10 },
  STA: { code: 'sta', label: 'Resistencia (Emocional)', value: 10 },
  CHA: { code: 'cha', label: 'Carisma (Social)', value: 10 },
};
// 3. Constantes Iniciales para nuevos jugadores
export const INITIAL_PLAYER_PROFILE = {
  level: 1,
  currentXp: 0,
  gold: 0, // Billetera común
  nexus: 0, // Billetera premium
  // Copiamos los valores base
  stats: {
    str: 10,
    int: 10,
    sta: 10,
    cha: 10,
  },
};
// 4. Fórmula para calcular el Nivel basado en la XP acumulada
// Nivel = 1 + raíz cuadrada(XP) * factor (ajustable)
export const calculateLevel = (xp: number): number => {
  if (xp === 0) return 1;
  // Esta fórmula hace que subir de nivel sea progresivamente más difícil
  return Math.floor(1 + Math.sqrt(xp) * 0.1);
};
// 5. Fórmula para saber cuánta XP falta para el siguiente nivel
export const xpForNextLevel = (currentLevel: number): number => {
  // Inversa de la fórmula anterior
  // XP = ((Nivel - 1) / 0.1) ^ 2
  return Math.pow(currentLevel / 0.1, 2);
};
