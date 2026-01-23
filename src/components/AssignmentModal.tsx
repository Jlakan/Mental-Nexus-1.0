// src/components/AssignmentModal.tsx
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, getDoc, 
  writeBatch, serverTimestamp, increment, Timestamp
} from "firebase/firestore";
import { db } from '../services/firebase';
import { MISSION_TIERS } from '../utils/gameRules';

// ✅ CORRECCIÓN: Usamos 'import type' para evitar el error de exportación en tiempo de ejecución
import type { Assignment } from '../utils/ClinicalEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  professionalId: string;
  patientName: string;
  userProfessionId?: string;
  // CAMBIO: Tipado estricto
  taskToEdit?: Assignment;
}

interface CatalogItem { id: string; name?: string; title?: string; [key:string]: any }

interface TaskStats {
  personalAssigned: number;
  personalCompleted: number;
  personalVolume: number;
  globalAssigned: number;
}

const WEEKDAYS = [
  { id: 'lun', label: 'L' },
  { id: 'mar', label: 'M' },
  { id: 'mie', label: 'X' },
  { id: 'jue', label: 'J' },
  { id: 'vie', label: 'V' },
  { id: 'sab', label: 'S' },
  { id: 'dom', label: 'D' },
];

export default function AssignmentModal({
  isOpen, onClose, patientId, professionalId,
  patientName, userProfessionId, taskToEdit
}: Props) {
  // --- ESTADOS UI ---
  const [activeTab, setActiveTab] = useState<'custom' | 'catalog'>('custom');
  const [missionType, setMissionType] = useState<'one-off' | 'daily'>('one-off');
  const [saving, setSaving] = useState(false);

  // --- FORM DATA ---
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('EASY');
  // Eliminado: const [targetStat, setTargetStat] = useState<string>('str'); (No se usaba)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  // Duración del Sprint (Semanas)
  const [durationWeeks, setDurationWeeks] = useState<number>(1);
  
  // --- CATALOG DATA ---
  const [profNameDisplay, setProfNameDisplay] = useState('');
  const [cats, setCats] = useState<CatalogItem[]>([]);
  const [subCats, setSubCats] = useState<CatalogItem[]>([]);
  const [tasks, setTasks] = useState<CatalogItem[]>([]);
  const [selCat, setSelCat] = useState('');
  const [selSubCat, setSelSubCat] = useState('');
  // ID original del catálogo y estadísticas
  const [selectedCatalogId, setSelectedCatalogId] = useState<string | null>(null);
  const [currentStats, setCurrentStats] = useState<TaskStats | null>(null);

  // ---------------------------------------------------------
  // 1. CARGA INICIAL
  // ---------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      if (taskToEdit) {
        // MODO EDICIÓN
        setTitle(taskToEdit.title || '');
        // CORRECCIÓN: Usar customInstructions en lugar de description
        setDesc((taskToEdit as any)?.customInstructions || '');
        
        const type = taskToEdit.type === 'routine' ? 'daily' : 'one-off';
        setMissionType(type);
        setSelectedDays(taskToEdit.frequency ? Object.keys(taskToEdit.frequency) : []);
        setDurationWeeks(taskToEdit.totalVolumeExpected && taskToEdit.frequency 
            ? Math.ceil(taskToEdit.totalVolumeExpected / Object.keys(taskToEdit.frequency).length) 
            : 1);
        
        // Ajuste defensivo para el Tier
        const diff = taskToEdit.staticTaskData?.difficulty || 'EASY';
        setSelectedTier(diff);

        setActiveTab('custom');
        // No cargamos stats en edición para no confundir visualmente
        setSelectedCatalogId(taskToEdit.catalogId || null);
        setCurrentStats(null);
      } else {
        // MODO CREACIÓN (Reset)
        resetForm();
      }
    }
  }, [isOpen, taskToEdit]);

  const resetForm = () => {
    setTitle(''); setDesc(''); setMissionType('one-off');
    setSelectedDays([]); setDurationWeeks(1);
    setSelectedTier('EASY'); 
    // setTargetStat('str'); // Eliminado
    setActiveTab('custom');
    setSelectedCatalogId(null); setCurrentStats(null);
  };

  // ---------------------------------------------------------
  // 2. EFECTOS DE CATÁLOGO
  // ---------------------------------------------------------
  useEffect(() => {
    if (isOpen && activeTab === 'catalog' && userProfessionId) {
      const loadProf = async () => {
        const d = await getDoc(doc(db, "professions", userProfessionId));
        setProfNameDisplay(d.exists() ? d.data().name : userProfessionId);
      };
      loadProf();
      getDocs(collection(db, "professions", userProfessionId, "categories"))
        .then(s => setCats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [isOpen, activeTab, userProfessionId]);

  useEffect(() => {
    if (selCat && userProfessionId) {
      getDocs(collection(db, "professions", userProfessionId, "categories", selCat, "subcategories"))
        .then(s => setSubCats(s.docs.map(d => ({ id: d.id, ...d.data() }))));
      setSelSubCat(''); setTasks([]);
    }
  }, [selCat, userProfessionId]);

  useEffect(() => {
    if (selSubCat && userProfessionId) {
      const colName = missionType === 'daily' ? 'catalog_routines' : 'catalog_missions';
      getDocs(collection(db, "professions", userProfessionId, "categories", selCat, "subcategories", selSubCat, colName))
        .then(s => setTasks(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    }
  }, [selSubCat, missionType, userProfessionId]);

  // ---------------------------------------------------------
  // 3. SELECCIÓN DE TAREA Y STATS
  // ---------------------------------------------------------
  const handleSelectCatalogTask = async (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (!t) return;

    setTitle(t.title || '');
    // Nota: El catálogo sí suele tener 'description', aquí está bien leerlo de 't' (CatalogItem)
    setDesc(t.description || '');
    if (missionType !== 'daily') setSelectedTier(t.tier || 'EASY');
    setSelectedCatalogId(taskId);

    try {
      // Stats Globales
      const globalAssigned = t.stats?.globalAssigned || 0;

      // Stats Personales
      const myStatsRef = doc(db, "professionals", professionalId, "personal_task_stats", taskId);
      const myStatsSnap = await getDoc(myStatsRef);

      let pAssigned = 0, pVolume = 0, pCompleted = 0;
      if (myStatsSnap.exists()) {
        const d = myStatsSnap.data();
        pAssigned = d.assigned || 0;
        pVolume = d.volumeAssigned || 0;
        pCompleted = d.completed || 0;
      }

      setCurrentStats({
        personalAssigned: pAssigned,
        personalVolume: pVolume,
        personalCompleted: pCompleted,
        globalAssigned: globalAssigned
      });

    } catch (error) {
      console.error("Error cargando stats", error);
    }
  };

  // ---------------------------------------------------------
  // 4. LÓGICA DE GUARDADO (BATCH & DELTAS)
  // ---------------------------------------------------------
  const handleAssign = async () => {
    if (!title) return alert("Falta título");
    if (missionType === 'daily' && selectedDays.length === 0) return alert("Elige días");

    setSaving(true);
    try {
      // @ts-ignore
      const tierData = MISSION_TIERS[selectedTier] || MISSION_TIERS['EASY'];
      const targetCol = missionType === 'daily' ? "assigned_routines" : "assigned_missions";

      // Cálculo de Volumen Esperado
      const currentVolume = missionType === 'daily' ? (selectedDays.length * durationWeeks) : 1;

      // Cálculo Fecha Fin (End Date)
      const startDate = new Date();
      const endDate = new Date(startDate);
      if (missionType === 'daily') {
        endDate.setDate(endDate.getDate() + (durationWeeks * 7));
      } else {
        endDate.setDate(endDate.getDate() + 7); 
      }

      // Generar mapa de frecuencias
      const frequencyMap: {[key:string]: number} = {};
      selectedDays.forEach(d => frequencyMap[d] = 1);

      // --- CORRECCIÓN INTEGRIDAD DE DATOS ---
      const categoryName = activeTab === 'catalog' 
        ? (cats.find(c => c.id === selCat)?.name || "Catálogo") 
        : "Personalizado";

      const commonData = {
        title, 
        // CORRECCIÓN: Guardamos como customInstructions para cumplir con la interfaz Assignment
        customInstructions: desc, 
        staticTaskData: {
            originalTitle: title,
            category: categoryName,
            difficulty: selectedTier,
            estimatedLoad: tierData.stats || 3
        },
        rewards: { xp: tierData.xp, gold: tierData.gold }, 
        type: missionType === 'daily' ? 'routine' : 'one_time',
        
        catalogId: activeTab === 'catalog' ? (selectedCatalogId || null) : null,
        
        durationWeeks: missionType === 'daily' ? durationWeeks : null,
        totalVolumeExpected: currentVolume,
        // Usamos any para evitar conflicto de tipos con Timestamp vs Date en la interfaz estricta
        endDate: Timestamp.fromDate(endDate) as any
      };

      if (taskToEdit) {
        // --- EDICIÓN ---
        const batch = writeBatch(db);
        const taskRef = doc(db, targetCol, taskToEdit.id);

        batch.update(taskRef, {
          ...commonData,
          frequency: missionType === 'daily' ? frequencyMap : null,
          updatedAt: serverTimestamp(),
        });

        await batch.commit();
        alert("Tarea actualizada correctamente.");

      } else {
        // --- CREACIÓN NUEVA (BATCH) ---
        const batch = writeBatch(db);
        const newDocRef = doc(collection(db, targetCol));

        const createPayload = {
          ...commonData,
          id: newDocRef.id,
          patientId, professionalId,
          frequency: missionType === 'daily' ? frequencyMap : null,
          status: 'pending', 
          createdAt: serverTimestamp(),
          completionHistory: [], // Requerido por la interfaz Assignment
          
          // 🔥🔥🔥 AQUÍ ESTÁ EL CAMBIO CLAVE 🔥🔥🔥
          // Usamos new Date() para asegurar compatibilidad inmediata con el motor clínico
          assignedAt: new Date() 
        };

        batch.set(newDocRef, createPayload);

        // Actualizar Contadores si viene de Catálogo
        if (selectedCatalogId && activeTab === 'catalog') {
          // 1. Globales
          const catalogRef = doc(db,
            "professions", userProfessionId!,
            "categories", selCat,
            "subcategories", selSubCat,
            (missionType === 'daily' ? 'catalog_routines' : 'catalog_missions'),
            selectedCatalogId
          );

          batch.update(catalogRef, {
            "stats.globalAssigned": increment(1),
            "stats.globalVolume": increment(currentVolume)
          });

          // 2. Personales
          const personalStatsRef = doc(db, "professionals", professionalId, "personal_task_stats", selectedCatalogId);
          batch.set(personalStatsRef, {
            title: title,
            assigned: increment(1),
            volumeAssigned: increment(currentVolume),
            lastAssignedAt: serverTimestamp()
          }, { merge: true });
        }

        await batch.commit();
        alert("Asignada correctamente.");
      }

      onClose();
      resetForm();

    } catch (e: any) {
      console.error(e);
      alert("Error guardando: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:2000}}>
      <div style={{backgroundColor:'white', width:'650px', borderRadius:'12px', padding:'25px', maxHeight:'90vh', overflowY:'auto'}}>

        <h2 style={{marginTop:0, color:'#333'}}>
          {taskToEdit ? 'Editar Tarea' : `Asignar a ${patientName}`}
        </h2>

        {/* SELECTOR TIPO */}
        <div style={{display:'flex', gap:'10px', marginBottom:'20px', background:'#f5f5f5', padding:'5px', borderRadius:'8px'}}>
          <button onClick={() => !taskToEdit && setMissionType('one-off')} disabled={!!taskToEdit}
            style={{flex:1, padding:'10px', borderRadius:'6px', border:'none', cursor:taskToEdit?'default':'pointer', fontWeight:'bold',
            background: missionType==='one-off'?'white':'transparent', color: missionType==='one-off'?'#E65100':'#666', boxShadow: missionType==='one-off'?'0 2px 4px rgba(0,0,0,0.1)': 'none'}}>🎯 Misión Única</button>

          <button onClick={() => !taskToEdit && setMissionType('daily')} disabled={!!taskToEdit}
            style={{flex:1, padding:'10px', borderRadius:'6px', border:'none', cursor:taskToEdit?'default':'pointer', fontWeight:'bold',
            background: missionType==='daily'?'#9C27B0':'transparent', color: missionType==='daily'?'white':'#666', boxShadow: missionType==='daily'?'0 2px 4px rgba(0,0,0,0.1)': 'none'}}>📅 Rutina Diaria</button>
        </div>

        {/* TABS */}
        {!taskToEdit && (
          <div style={{display:'flex', gap:'15px', marginBottom:'15px', borderBottom:'1px solid #eee'}}>
            <button onClick={()=>setActiveTab('custom')} style={{padding:'8px', borderBottom:activeTab==='custom'?'3px solid #333':'none', fontWeight:'bold', background:'none', border:'none', cursor:'pointer'}}>Manual</button>
            <button onClick={()=>setActiveTab('catalog')} style={{padding:'8px', borderBottom:activeTab==='catalog'?'3px solid #333':'none', fontWeight:'bold', background:'none', border:'none', cursor:'pointer'}}>Catálogo</button>
          </div>
        )}

        {/* PANEL CATÁLOGO */}
        {activeTab === 'catalog' && !taskToEdit && (
          <div style={{background:'#E3F2FD', padding:'15px', borderRadius:'8px', marginBottom:'20px', border:'1px solid #BBDEFB'}}>
            <div style={{fontSize:'12px', color:'#555', marginBottom:'5px'}}>Profesión: <strong>{profNameDisplay}</strong></div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
              <select onChange={e=>setSelCat(e.target.value)} value={selCat} style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}}>
                <option value="">📂 Categoría...</option>
                {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select onChange={e=>setSelSubCat(e.target.value)} value={selSubCat} disabled={!selCat} style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}}>
                <option value="">📂 Subcategoría...</option>
                {subCats.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <select onChange={e=>handleSelectCatalogTask(e.target.value)} disabled={!selSubCat}
              style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #2196F3', fontWeight:'bold'}}>
              <option value="">👇 Seleccionar {missionType==='daily'?'Rutina':'Misión'}</option>
              {tasks.map(t=><option key={t.id} value={t.id}>{t.title} ({t.tier})</option>)}
            </select>

            {/* STATS VISUALES */}
            {currentStats && (
              <div style={{marginTop:'15px', padding:'10px', background:'white', borderRadius:'6px', display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #90CAF9'}}>
                <div>
                  <div style={{fontSize:'12px', color:'#1565C0', fontWeight:'bold', marginBottom:'2px'}}>TU HISTORIAL</div>
                  <div style={{fontSize:'11px', color:'#555'}}>
                    Asignada: <strong>{currentStats.personalAssigned} veces</strong><br/>
                    Volumen Total: <strong>{currentStats.personalVolume} reps</strong>
                    {currentStats.personalVolume > 0 && (
                      <div style={{color:'#2E7D32', fontWeight:'bold', marginTop:'2px'}}>
                        Efectividad: {Math.round((currentStats.personalCompleted/currentStats.personalVolume)*100)}%
                      </div>
                    )}
                  </div>
                </div>
                <div style={{height:'40px', width:'1px', background:'#eee'}}></div>
                <div style={{textAlign:'right'}}>
                  <div style={{fontSize:'12px', color:'#E65100', fontWeight:'bold', marginBottom:'2px'}}>GLOBAL</div>
                  <div style={{fontSize:'11px', color:'#555'}}>
                    {currentStats.globalAssigned} usos totales
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FORMULARIO FINAL */}
        <div style={{marginTop:'20px'}}>
          <label style={{display:'block', fontWeight:'bold', fontSize:'14px'}}>Título:</label>
          <input value={title} onChange={e=>setTitle(e.target.value)} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #ccc', marginBottom:'10px'}} />

          <label style={{display:'block', fontWeight:'bold', fontSize:'14px'}}>Instrucciones:</label>
          <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={2} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #ccc', marginBottom:'10px'}} />

          {/* CONFIGURACIÓN RUTINA (Días + Semanas) */}
          {missionType === 'daily' && (
            <div style={{background:'#F3E5F5', padding:'15px', borderRadius:'8px', marginBottom:'15px'}}>
              <div style={{marginBottom:'15px'}}>
                <label style={{fontWeight:'bold', color:'#7B1FA2', display:'block', marginBottom:'5px'}}>1. Frecuencia Semanal:</label>
                <div style={{display:'flex', gap:'5px'}}>
                  {WEEKDAYS.map(d => {
                    const active = selectedDays.includes(d.id);
                    return (
                      <button key={d.id} onClick={()=>{
                        setSelectedDays(prev => active ? prev.filter(x=>x!==d.id) : [...prev, d.id]);
                      }}
                      style={{width:'35px', height:'35px', borderRadius:'50%', border:active?'none':'1px solid #ccc',
                      background:active?'#9C27B0':'white', color:active?'white':'#666', cursor:'pointer', fontWeight:'bold'}}>
                        {d.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label style={{fontWeight:'bold', color:'#7B1FA2', display:'block', marginBottom:'5px'}}>2. Duración del Ciclo:</label>
                <select value={durationWeeks} onChange={e=>setDurationWeeks(Number(e.target.value))} style={{padding:'8px', borderRadius:'4px', border:'1px solid #9C27B0', width:'50%'}}>
                  <option value={1}>1 Semana (Sprint Corto)</option>
                  <option value={2}>2 Semanas</option>
                  <option value={3}>3 Semanas</option>
                  <option value={4}>4 Semanas (Hábito)</option>
                </select>
              </div>

              <div style={{marginTop:'10px', textAlign:'right', fontSize:'12px', color:'#555'}}>
                Volumen Total Esperado: <strong>{selectedDays.length * durationWeeks} repeticiones</strong>
              </div>
            </div>
          )}

          <div style={{display:'flex', justifyContent:'flex-end', gap:'10px', marginTop:'20px', borderTop:'1px solid #eee', paddingTop:'15px'}}>
            <button onClick={onClose} style={{padding:'10px 20px', background:'#eee', border:'none', borderRadius:'6px', cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleAssign} disabled={saving}
              style={{padding:'10px 20px', background:missionType==='daily'?'#9C27B0':'#E65100', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
              {saving ? 'Guardando...' : (taskToEdit ? 'Guardar Cambios' : 'Confirmar Asignación')}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}