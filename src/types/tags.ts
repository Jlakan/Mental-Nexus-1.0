// src/types/tags.ts

export interface TagEntry {
    masterTag: string;
    category: string;
    synonyms: string[];
  }
  
  export interface TagsCache {
    version: number;
    data: TagEntry[];
  }
  
  export interface SystemTagsMetadata {
    [key: string]: number; // ej: { psicologia_version: 2, nutricion_version: 1 }
  }