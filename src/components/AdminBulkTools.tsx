// src/components/AdminBulkTools.tsx

import { useState } from 'react';
import { collection, writeBatch, doc, getDocs, serverTimestamp } from "firebase/firestore";
import { db } from '../services/firebase';
import type { CsvTagRow, CsvTaskRow } from '../types/BulkTypes';

export default function AdminBulkTools() {
  const [activeTab, setActiveTab] = useState<'tags' | 'tasks'>('tags');
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  // --- UTILS ---
  const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toLocaleTimeString()} - ${msg}`]);
  
  const normalizeKey = (text: string) => 
    text.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "_");

  // --- LÓGICA DE CARGA DE ARCHIVO ---
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      if (activeTab === 'tags') {
        await processTagsCsv(text);
      } else {
        await processTasksCsv(text);
      }
    };
    reader.readAsText(file);
  };

  // --- PROCESADOR 1: TAGS ---
  const processTagsCsv = async (csvText: string) => {
    setLoading(true);
    setLogs([]);
    addLog("Iniciando carga de Tags...");
    console.log("=== INICIO PROCESO DE TAGS ===");
    
    try {
      // FIX: Remover BOM y manejar saltos de línea universales
      const cleanText = csvText.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
      console.log(`[CSV] Total de líneas detectadas: ${lines.length}`);

      // CORRECCIÓN 1: Usamos ';' como delimitador para evitar romper descripciones con comas
      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      console.log("[CSV] Cabeceras detectadas:", headers);
      
      if (!headers.includes('etiqueta') || !headers.includes('categoria')) {
        throw new Error(`El CSV debe tener cabeceras: categoria; etiqueta; sinonimos. Encontradas: ${headers.join(', ')}`);
      }

      addLog("Descargando mapa de tags existentes...");
      const existingTagsMap = new Map<string, boolean>();
      const querySnap = await getDocs(collection(db, "tags"));
      querySnap.forEach(doc => {
        const data = doc.data();
        const key = normalizeKey(`${data.category}_${data.label}`);
        existingTagsMap.set(key, true);
      });

      let batch = writeBatch(db);
      let opCount = 0;
      let addedCount = 0;

      for (let i = 1; i < lines.length; i++) {
        // CORRECCIÓN 1: Split por punto y coma
        const row = lines[i].split(';');
        if (row.length < 2) {
          console.warn(`[CSV] Fila ${i + 1} ignorada (menos de 2 columnas):`, lines[i]);
          continue;
        }

        const tagData: CsvTagRow = {
          categoria: row[0]?.trim() || '',
          etiqueta: row[1]?.trim() || '',
          sinonimos: row[2]?.trim() || ''
        };

        const uniqueKey = normalizeKey(`${tagData.categoria}_${tagData.etiqueta}`);

        if (existingTagsMap.has(uniqueKey)) {
          addLog(`⏭️ Saltando duplicado: ${tagData.etiqueta}`);
          continue;
        }

        const newTagRef = doc(collection(db, "tags"));
        batch.set(newTagRef, {
          category: tagData.categoria,
          label: tagData.etiqueta,
          // FIX: Validación segura para evitar fallos si sinónimos viene vacío
          keywords: tagData.sinonimos ? tagData.sinonimos.split(',').map(s => s.trim().toLowerCase()).filter(s => s) : [],
          createdAt: serverTimestamp()
        });

        existingTagsMap.set(uniqueKey, true);
        opCount++;
        addedCount++;

        if (opCount >= 450) {
          console.log(`[FIREBASE] Ejecutando commit intermedio. Operaciones en lote: ${opCount}`);
          addLog("💾 Guardando lote intermedio...");
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
        }
        setProgress(Math.round((i / lines.length) * 100));
      }

      console.log(`[FIREBASE] Proceso terminado. Documentos nuevos listos para subir: ${addedCount}`);
      if (opCount > 0) {
        await batch.commit();
      } else if (addedCount === 0) {
        addLog("⚠️ No se subió ningún tag nuevo (todos eran duplicados o vacíos).");
      }
      
      if (addedCount > 0) {
        addLog(`✅ Finalizado: ${addedCount} tags nuevos.`);
      }

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      console.error("=== ERROR CRÍTICO EN TAGS ===", error);
    } finally {
      setLoading(false);
    }
  };

  // --- PROCESADOR 2: TAREAS (CORREGIDO) ---
  const processTasksCsv = async (csvText: string) => {
    setLoading(true);
    setLogs([]);
    addLog("Iniciando carga de Tareas y Estructura...");
    console.log("=== INICIO PROCESO DE TAREAS ===");

    try {
      // FIX: Remover BOM y manejar saltos de línea universales
      const cleanText = csvText.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
      console.log(`[CSV] Total de líneas detectadas: ${lines.length}`);
      
      addLog("Analizando estructura actual...");
      const structureMap = new Map<string, string>(); 

      // Cargar estructura existente (Profesiones -> Categorias -> Subcategorias)
      const profSnap = await getDocs(collection(db, "professions"));
      for (const pDoc of profSnap.docs) {
        structureMap.set(normalizeKey(pDoc.data().name), pDoc.id);
        const catSnap = await getDocs(collection(db, "professions", pDoc.id, "categories"));
        for (const cDoc of catSnap.docs) {
          const catKey = normalizeKey(`${pDoc.data().name}_${cDoc.data().name}`);
          structureMap.set(catKey, cDoc.id);
          const subSnap = await getDocs(collection(db, "professions", pDoc.id, "categories", cDoc.id, "subcategories"));
          for (const sDoc of subSnap.docs) {
             const subKey = normalizeKey(`${pDoc.data().name}_${cDoc.data().name}_${sDoc.data().name}`);
             structureMap.set(subKey, sDoc.id);
          }
        }
      }
      
      addLog("Estructura cargada. Procesando filas...");

      let batch = writeBatch(db);
      let opCount = 0;
      let addedTasksCount = 0;

      const checkBatch = async () => {
        opCount++;
        if (opCount >= 450) {
          console.log(`[FIREBASE] Ejecutando commit intermedio. Operaciones en lote: ${opCount}`);
          await batch.commit();
          batch = writeBatch(db);
          opCount = 0;
          addLog("...Guardando progreso...");
        }
      };

      for (let i = 1; i < lines.length; i++) {
        // CORRECCIÓN 1: Split por Punto y Coma (;)
        const cols = lines[i].split(';');
        if (cols.length < 4) {
          console.warn(`[CSV] Fila ${i + 1} ignorada (menos de 4 columnas):`, lines[i]);
          continue;
        }

        // Mapeo ajustado. Asumimos orden: 
        // 0: tipo, 1: profesion, 2: categoria, 3: subcat, 4: tarea, 5: desc, 6: tags, 7: edades
        const row: CsvTaskRow = {
          tipo: cols[0]?.trim() || '',         // Ej: "rutina" o vacío
          profesion: cols[1]?.trim() || '',
          categoria: cols[2]?.trim() || '',
          subcategoria: cols[3]?.trim() || '',
          tarea: cols[4]?.trim() || '',
          descripcion: cols[5]?.trim() || '',
          tags: cols[6]?.trim() || '',
          edades: cols[7]?.trim() || ''
        };

        // --- NIVEL 1: PROFESIÓN ---
        const profKey = normalizeKey(row.profesion);
        let profId = structureMap.get(profKey);

        if (!profId) {
          const newProfRef = doc(collection(db, "professions"));
          profId = newProfRef.id;
          batch.set(newProfRef, { name: row.profesion, createdAt: serverTimestamp() });
          structureMap.set(profKey, profId);
          await checkBatch();
          addLog(`➕ Nueva Profesión: ${row.profesion}`);
        }

        // --- NIVEL 2: CATEGORÍA ---
        const catKey = normalizeKey(`${row.profesion}_${row.categoria}`);
        let catId = structureMap.get(catKey);
        if (!catId) {
          const newCatRef = doc(collection(db, "professions", profId, "categories"));
          catId = newCatRef.id;
          batch.set(newCatRef, { name: row.categoria });
          structureMap.set(catKey, catId);
          await checkBatch();
        }

        // --- NIVEL 3: SUBCATEGORÍA ---
        const subKey = normalizeKey(`${row.profesion}_${row.categoria}_${row.subcategoria}`);
        let subId = structureMap.get(subKey);
        if (!subId) {
          const newSubRef = doc(collection(db, "professions", profId, "categories", catId, "subcategories"));
          subId = newSubRef.id;
          batch.set(newSubRef, { name: row.subcategoria });
          structureMap.set(subKey, subId);
          await checkBatch();
        }

        // --- NIVEL 4: TAREA (CORRECCIONES APLICADAS) ---
        
        // Determinar colección basada en columna 'tipo'
        const isRoutine = row.tipo?.toLowerCase() === 'rutina' || row.tipo?.toLowerCase() === 'routine';
        const taskCollection = isRoutine ? "catalog_routines" : "catalog_missions";
        const typeLabel = isRoutine ? "Rutina" : "Misión";

        const newTaskRef = doc(collection(db, "professions", profId, "categories", catId, "subcategories", subId, taskCollection));
        
        batch.set(newTaskRef, {
          title: row.tarea,
          description: row.descripcion,
          
          // CORRECCIÓN 2: Nombres de campos compatibles con AdminCatalogTree
          // CORRECCIÓN 3: Conversión a Array usando pipe '|' (FIX: validación segura si viene vacío)
          targetAge: row.edades ? row.edades.split('|').map(s => s.trim()) : [], 
          tags: row.tags ? row.tags.split('|').map(s => s.trim()) : [],

          createdAt: serverTimestamp(),
          tier: 'EASY', // Valor por defecto
          
          // Campos META para el Árbol
          typeLabel: typeLabel,
          _collection: taskCollection
        });
        await checkBatch();
        addedTasksCount++;
        
        setProgress(Math.round((i / lines.length) * 100));
      }

      console.log(`[FIREBASE] Proceso terminado. Tareas listas para subir: ${addedTasksCount}`);
      if (opCount > 0) {
        await batch.commit();
      } else if (addedTasksCount === 0) {
        addLog("⚠️ No se subió ninguna tarea (archivo vacío o filas inválidas).");
      }

      if (addedTasksCount > 0) {
        addLog("✅ Carga completada con éxito.");
      }

    } catch (e: any) {
      addLog(`❌ Error Crítico: ${e.message}`);
      console.error("=== ERROR CRÍTICO EN TAREAS ===", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', background: '#f5f5f5', borderRadius: '8px' }}>
      <h3>📦 Herramienta de Carga Masiva (v2.0)</h3>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button onClick={() => setActiveTab('tags')} style={{ padding: '10px 20px', background: activeTab === 'tags' ? '#2196F3' : '#ddd', color: activeTab === 'tags' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          1. Importar Tags
        </button>
        <button onClick={() => setActiveTab('tasks')} style={{ padding: '10px 20px', background: activeTab === 'tasks' ? '#2196F3' : '#ddd', color: activeTab === 'tasks' ? 'white' : 'black', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          2. Importar Tareas
        </button>
      </div>

      <div style={{ background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #ccc' }}>
        <div style={{marginBottom: '15px', padding: '10px', background: '#fff3cd', borderLeft: '4px solid #ffc107', fontSize: '14px'}}>
            <strong>⚠️ IMPORTANTE: Formato CSV</strong><br/>
            Debido a que las descripciones pueden contener comas, el archivo <strong>DEBE</strong> estar delimitado por <strong>PUNTOS Y COMA (;)</strong>.<br/>
            <br/>
            <strong>Cabeceras Tasks:</strong> tipo; profesion; categoria; subcategoria; tarea; descripcion; tags; edades
        </div>
        
        <input 
          type="file" 
          accept=".csv" 
          onChange={handleFileUpload} 
          disabled={loading}
          style={{ marginBottom: '20px', display: 'block' }} 
        />

        {loading && (
          <div style={{ width: '100%', background: '#eee', height: '10px', borderRadius: '5px', marginBottom: '15px' }}>
            <div style={{ width: `${progress}%`, background: '#4CAF50', height: '100%', borderRadius: '5px', transition: 'width 0.3s' }}></div>
          </div>
        )}

        <div style={{ background: '#222', color: '#0f0', padding: '15px', borderRadius: '4px', height: '200px', overflowY: 'auto', fontFamily: 'monospace', fontSize: '12px' }}>
          {logs.length === 0 ? '> Esperando archivo CSV (Delimitado por ;)...' : logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}