// src/utils/gameRules.ts




export const MISSION_TIERS = {
  DAILY: { // <--- ESTE ES EL QUE USAREMOS AUTOMÁTICAMENTE
    id: 'daily',
    label: 'Rutina Diaria',
    xp: 5,
    gold: 5,
    nexus: 0,
    stats: 0.15, // Pequeña mejora de stat por constancia
    color: '#9C27B0' // Morado
  },
  EASY: {
    id: 'easy',
    label: 'Fácil',
    xp: 15,
    gold: 15,
    nexus: 0,
    stats: 0.25,
    color: '#81C784'
  },
  MEDIUM: {
    id: 'medium',
    label: 'Medio',
    xp: 30,
    gold: 30,
    nexus: 0,
    stats: 1.0,
    color: '#2196F3'
  },
  HARD: {
    id: 'hard',
    label: 'Difícil',
    xp: 50,
    gold: 50,
    nexus: 0,
    stats: 1.5,
    color: '#FF9800'
  },
  LEGENDARY: {
    id: 'legendary',
    label: 'Legendaria',
    xp: 150,
    gold: 250,
    nexus: 0,
    stats: 4.0,
    color: '#E91E63'
  }
};
