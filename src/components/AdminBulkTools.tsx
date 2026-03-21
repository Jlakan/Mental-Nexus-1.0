// src/components/AdminBulkTools.tsx

import { useState } from 'react';
import { collection, writeBatch, doc, getDocs, getDoc, serverTimestamp } from "firebase/firestore"; 
import { db } from '../services/firebase';
import type { CsvTaskRow } from '../types/BulkTypes';

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
    setProgress(0);
    addLog("Iniciando generación de paquete de Tags...");
    console.log("=== INICIO PROCESO DE TAGS ===");
    
    try {
      const cleanText = csvText.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
      console.log(`[CSV] Total de líneas detectadas: ${lines.length}`);

      const headers = lines[0].split(';').map(h => h.trim().toLowerCase());
      console.log("[CSV] Cabeceras detectadas:", headers);
      
      if (!headers.includes('etiqueta') || !headers.includes('categoria')) {
        throw new Error(`El CSV debe tener cabeceras: categoria; etiqueta; sinonimos. Encontradas: ${headers.join(', ')}`);
      }

      const professionInput = window.prompt("Ingresa la profesión para este diccionario (ej. psicologia, nutricion):", "psicologia");
      if (!professionInput) {
        addLog("⚠️ Carga cancelada: Se requiere una profesión.");
        setLoading(false);
        return;
      }
      const normalizedProf = normalizeKey(professionInput);

      const tagsArray = [];

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(';');
        if (row.length < 2) {
          console.warn(`[CSV] Fila ${i + 1} ignorada (menos de 2 columnas):`, lines[i]);
          continue;
        }

        const tagData = {
          category: row[0]?.trim() || 'General',
          masterTag: row[1]?.trim() || '',
          synonyms: row[2]?.trim() ? row[2].split(',').map(s => s.trim().toLowerCase()).filter(s => s) : []
        };

        if (tagData.masterTag) {
          tagsArray.push(tagData);
        }
        
        setProgress(Math.round((i / lines.length) * 50));
      }

      addLog(`📦 Paquete preparado con ${tagsArray.length} etiquetas.`);

      const batch = writeBatch(db);

      const dictionaryRef = doc(db, 'tagsDictionaries', normalizedProf);
      batch.set(dictionaryRef, { 
        tags: tagsArray,
        updatedAt: serverTimestamp() 
      });

      const metadataRef = doc(db, 'system', 'tagsMetadata');
      const metaSnap = await getDoc(metadataRef);
      const currentVersion = metaSnap.exists() ? (metaSnap.data()[`${normalizedProf}_version`] || 0) : 0;
      const newVersion = currentVersion + 1;

      batch.set(metadataRef, { 
        [`${normalizedProf}_version`]: newVersion 
      }, { merge: true });

      addLog(`💾 Subiendo a Firestore y actualizando a v${newVersion}...`);
      await batch.commit();
      
      setProgress(100);
      addLog(`✅ ¡Éxito! Diccionario "${normalizedProf}" guardado con ${tagsArray.length} tags.`);

    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
      console.error("=== ERROR CRÍTICO EN TAGS ===", error);
    } finally {
      setLoading(false);
    }
  };

  // --- PROCESADOR 2: TAREAS ---
  const processTasksCsv = async (csvText: string) => {
    setLoading(true);
    setLogs([]);
    addLog("Iniciando carga de Tareas y Estructura...");
    console.log("=== INICIO PROCESO DE TAREAS ===");

    try {
      const cleanText = csvText.replace(/^\uFEFF/, '');
      const lines = cleanText.split(/\r?\n/).filter(l => l.trim() !== '');
      console.log(`[CSV] Total de líneas detectadas: ${lines.length}`);
      
      addLog("Analizando estructura actual...");
      const structureMap = new Map<string, string>(); 

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
        const cols = lines[i].split(';');
        if (cols.length < 4) {
          console.warn(`[CSV] Fila ${i + 1} ignorada (menos de 4 columnas):`, lines[i]);
          continue;
        }

        const row: CsvTaskRow = {
          tipo: cols[0]?.trim() || '',         
          profesion: cols[1]?.trim() || '',
          categoria: cols[2]?.trim() || '',
          subcategoria: cols[3]?.trim() || '',
          tarea: cols[4]?.trim() || '',
          descripcion: cols[5]?.trim() || '',
          tags: cols[6]?.trim() || '',
          edades: cols[7]?.trim() || ''
        };

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

        const catKey = normalizeKey(`${row.profesion}_${row.categoria}`);
        let catId = structureMap.get(catKey);
        if (!catId) {
          const newCatRef = doc(collection(db, "professions", profId, "categories"));
          catId = newCatRef.id;
          batch.set(newCatRef, { name: row.categoria });
          structureMap.set(catKey, catId);
          await checkBatch();
        }

        const subKey = normalizeKey(`${row.profesion}_${row.categoria}_${row.subcategoria}`);
        let subId = structureMap.get(subKey);
        if (!subId) {
          const newSubRef = doc(collection(db, "professions", profId, "categories", catId, "subcategories"));
          subId = newSubRef.id;
          batch.set(newSubRef, { name: row.subcategoria });
          structureMap.set(subKey, subId);
          await checkBatch();
        }

        const isRoutine = row.tipo?.toLowerCase() === 'rutina' || row.tipo?.toLowerCase() === 'routine';
        const taskCollection = isRoutine ? "catalog_routines" : "catalog_missions";
        const typeLabel = isRoutine ? "Rutina" : "Misión";

        const newTaskRef = doc(collection(db, "professions", profId, "categories", catId, "subcategories", subId, taskCollection));
        
        batch.set(newTaskRef, {
          title: row.tarea,
          description: row.descripcion,
          targetAge: row.edades ? row.edades.split('|').map(s => s.trim()) : [], 
          tags: row.tags ? row.tags.split('|').map(s => s.trim()) : [],
          createdAt: serverTimestamp(),
          tier: 'EASY', 
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
    <div style={{ padding: '25px', background: '#0B1121', borderRadius: '12px', color: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
        <h3 style={{ margin: 0, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '1px' }}>
          📦 Herramienta de Carga Masiva (v2.0)
        </h3>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px' }}>
        <button 
          onClick={() => setActiveTab('tags')} 
          style={{ 
            padding: '12px 25px', 
            background: activeTab === 'tags' ? '#00E5FF' : '#151E32', 
            color: activeTab === 'tags' ? '#0B1121' : '#94A3B8', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: activeTab === 'tags' ? '0 4px 10px rgba(0, 229, 255, 0.2)' : 'none'
          }}
        >
          1. Importar Tags
        </button>
        <button 
          onClick={() => setActiveTab('tasks')} 
          style={{ 
            padding: '12px 25px', 
            background: activeTab === 'tasks' ? '#00E5FF' : '#151E32', 
            color: activeTab === 'tasks' ? '#0B1121' : '#94A3B8', 
            border: 'none', 
            borderRadius: '6px', 
            cursor: 'pointer',
            fontWeight: 'bold',
            fontSize: '14px',
            boxShadow: activeTab === 'tasks' ? '0 4px 10px rgba(0, 229, 255, 0.2)' : 'none'
          }}
        >
          2. Importar Tareas
        </button>
      </div>

      <div style={{ background: '#151E32', padding: '25px', borderRadius: '12px', border: '1px solid #334155' }}>
        {/* ALERTA REDISEÑADA TEMA OSCURO */}
        <div style={{
            marginBottom: '20px', 
            padding: '15px', 
            background: 'rgba(255, 152, 0, 0.1)', 
            borderLeft: '4px solid #FF9800', 
            borderRadius: '4px',
            fontSize: '14px',
            color: '#FFCC80',
            lineHeight: '1.5'
        }}>
            <strong style={{ color: '#FF9800', display: 'block', marginBottom: '5px' }}>⚠️ IMPORTANTE: Formato CSV</strong>
            Debido a que las descripciones pueden contener comas, el archivo <strong style={{color: '#fff'}}>DEBE</strong> estar delimitado por <strong style={{color: '#fff'}}>PUNTOS Y COMA (;)</strong>.<br/>
            <br/>
            <span style={{ color: '#FF9800', fontWeight: 'bold' }}>Cabeceras Tasks:</span> <span style={{ fontFamily: 'monospace', color: '#fff' }}>tipo; profesion; categoria; subcategoria; tarea; descripcion; tags; edades</span>
        </div>
        
        {/* INPUT DE ARCHIVO REDISEÑADO */}
        <div style={{ marginBottom: '25px' }}>
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              disabled={loading}
              style={{ 
                display: 'block',
                width: '100%',
                padding: '12px',
                background: '#0B1121',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#94A3B8',
                cursor: loading ? 'not-allowed' : 'pointer'
              }} 
            />
        </div>

        {loading && (
          <div style={{ width: '100%', background: '#0B1121', height: '12px', borderRadius: '6px', marginBottom: '20px', overflow: 'hidden', border: '1px solid #334155' }}>
            <div style={{ width: `${progress}%`, background: '#00E5FF', height: '100%', borderRadius: '6px', transition: 'width 0.3s ease-out', boxShadow: '0 0 10px rgba(0, 229, 255, 0.5)' }}></div>
          </div>
        )}

        {/* CONSOLA DE LOGS ESTILO TERMINAL */}
        <div style={{ 
            background: '#000', 
            color: '#00FF41', // Verde terminal clásico
            padding: '20px', 
            borderRadius: '8px', 
            height: '250px', 
            overflowY: 'auto', 
            fontFamily: '"Courier New", Courier, monospace', 
            fontSize: '13px',
            border: '1px solid #334155',
            lineHeight: '1.6'
        }}>
          {logs.length === 0 ? '> Esperando archivo CSV (Delimitado por ;)...' : logs.map((l, i) => <div key={i}>{l}</div>)}
        </div>
      </div>
    </div>
  );
}