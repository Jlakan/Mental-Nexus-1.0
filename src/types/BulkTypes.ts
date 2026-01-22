// src/types/BulkTypes.ts

export interface CsvTagRow {
    categoria: string; 
    etiqueta: string;  
    sinonimos: string; 
  }
  
  export interface CsvTaskRow {
    tipo?: string;       // NUEVO: "mision" o "rutina" (Opcional, default: mision)
    profesion: string;
    categoria: string;
    subcategoria: string;
    tarea: string;
    descripcion?: string;
    tags?: string;       // Separados por pipe '|'
    edades?: string;     // Separados por pipe '|' (Ej: "4-6y|6-10y")
  }