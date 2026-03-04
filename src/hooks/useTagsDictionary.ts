import { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore'; // <-- Corrección: Se eliminaron 'collection' y 'getDocs'
import { db } from '../services/firebase';
import type { TagEntry, TagsCache, SystemTagsMetadata } from '../types/tags'; // <-- Corrección: Se agregó 'type'

export const useTagsDictionary = (professionType: string) => {
  const [dictionary, setDictionary] = useState<TagEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDictionary = async () => {
      if (!professionType) return;
      
      setLoading(true);
      setError(null);
      
      // Normalizamos el professionType para evitar problemas con mayúsculas/acentos en el caché
      const normalizedProfession = professionType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const cacheKey = `mental_nexus_tags_${normalizedProfession}`;

      try {
        // 1. Leer la versión actual en Firestore (1 sola lectura)
        const metadataRef = doc(db, 'system', 'tagsMetadata');
        const metadataSnap = await getDoc(metadataRef);
        
        if (!metadataSnap.exists()) {
          throw new Error("No se encontró el documento de metadatos de tags.");
        }

        const metadata = metadataSnap.data() as SystemTagsMetadata;
        const currentCloudVersion = metadata[`${normalizedProfession}_version`] || 1;

        // 2. Revisar el caché local
        const localCacheStr = localStorage.getItem(cacheKey);
        let localCache: TagsCache | null = localCacheStr ? JSON.parse(localCacheStr) : null;

        // 3. Evaluar si necesitamos descargar de Firestore
        if (localCache && localCache.version === currentCloudVersion) {
          // El caché está actualizado, lo cargamos en memoria RAM
          setDictionary(localCache.data);
          setLoading(false);
          return;
        }

        // 4. Descargar el diccionario si no hay caché o está desactualizado
        const dictionaryRef = doc(db, 'tagsDictionaries', normalizedProfession);
        const dictionarySnap = await getDoc(dictionaryRef);

        if (!dictionarySnap.exists()) {
          throw new Error(`No existe el diccionario para la profesión: ${normalizedProfession}`);
        }

        const dictionaryData = dictionarySnap.data().tags as TagEntry[];

        // 5. Guardar en localStorage y actualizar estado
        const newCache: TagsCache = {
          version: currentCloudVersion,
          data: dictionaryData,
        };
        
        localStorage.setItem(cacheKey, JSON.stringify(newCache));
        setDictionary(dictionaryData);

      } catch (err: any) {
        console.error("Error cargando el diccionario de tags:", err);
        setError(err.message || "Error desconocido al cargar tags");
      } finally {
        setLoading(false);
      }
    };

    fetchDictionary();
  }, [professionType]);

  return { dictionary, loading, error };
};