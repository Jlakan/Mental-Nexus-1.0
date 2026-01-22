// src/types.ts

export interface Assignment {
    id: string;
    type: 'mission' | 'routine';
    title: string;
    description?: string;
    catalogId?: string; // ID_Referencia para el CSV
    
    // Métricas analíticas (opcionales porque vienen del cálculo)
    usageCount?: number;
    globalSuccessRate?: number;
    dropoutRate?: number;
    workloadImpact?: string | number;
    
    // Permitir otras propiedades dinámicas de Firestore
    [key: string]: any; 
  }
  
  export interface UserProfile {
    uid: string;
    email: string;
    displayName: string;
    role: 'admin' | 'pro' | 'patient' | 'user';
    [key: string]: any;
  }