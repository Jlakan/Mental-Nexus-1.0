// src/components/AssignmentModal.tsx
import { useState, useEffect } from 'react';
import { addDoc, collection, getDocs, doc, getDoc } from "firebase/firestore";
import { db } from '../services/firebase';
import { MISSION_TIERS } from '../utils/gameRules';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  professionalId: string;
  patientName: string;
  userProfessionId?: string;
}

// Interfaz para los items del catálogo
interface CatalogItem { id: string; name?: string; title?: string; [key:string]: any }

// Días de la semana para el selector visual
const WEEKDAYS = [
  { id: 'lun', label: 'L' },
  { id: 'mar', label: 'M' },
  { id: 'mie', label: 'X' },
  { id: 'jue', label: 'J' },
  { id: 'vie', label: 'V' },
  { id: 'sab', label: 'S' },
  { id: 'dom', label: 'D' },
];

export default function AssignmentModal({ isOpen, onClose, patientId, professionalId, patientName, userProfessionId }: Props) {
  // --- ESTADOS DE UI ---
  const [activeTab, setActiveTab] = useState<'custom' | 'catalog'>('custom');
  const [missionType, setMissionType] = useState<'one-off' | 'daily'>('one-off');
  
  // --- FORMULARIO DE TAREA ---
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('EASY');
  const [targetStat, setTargetStat] = useState<string>('str');
  // Estado para los DÍAS (Array de strings)
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // --- ESTADOS DEL CATÁLOGO (CASCADA) ---
  const [profNameDisplay, setProfNameDisplay] = useState('');
  const [cats, setCats] = useState<CatalogItem[]>([]);
  const [subCats, setSubCats] = useState<CatalogItem[]>([]);
  const [tasks, setTasks] = useState<CatalogItem[]>([]);

  const [selCat, setSelCat] = useState('');
  const [selSubCat, setSelSubCat] = useState('');

  // ---------------------------------------------------------
  // 1. EFECTO: TIPO DE MISIÓN Y BLOQUEO DE TIER
  // ---------------------------------------------------------
  useEffect(() => {
    if (missionType === 'daily') {
      setSelectedTier('DAILY'); // Forzar Tier Rutina
    } else {
      setSelectedTier('MEDIUM'); // Default para misiones
    }
  }, [missionType]);

  // ---------------------------------------------------------
  // 2. LOGICA DEL CATÁLOGO
  // ---------------------------------------------------------
  // A. Carga Inicial (Profesión y Categorías)
  useEffect(() => {
    if (isOpen && activeTab === 'catalog' && userProfessionId) {
      // Obtener nombre bonito de la profesión
      const loadProfName = async () => {
        try {
          const d = await getDoc(doc(db, "professions", userProfessionId));
          if (d.exists()) setProfNameDisplay(d.data().name);
          else setProfNameDisplay(userProfessionId);
        } catch (e) {
          console.error("Error loading profession name:", e);
        }
      };
      loadProfName();

      // Cargar Categorías Raíz
      getDocs(collection(db, "professions", userProfessionId, "categories")).then(snap => {
        setCats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSelCat(''); setSelSubCat(''); setTasks([]);
      }).catch(e => console.error("Error loading categories:", e));
    }
  }, [isOpen, activeTab, userProfessionId]);

  // B. Carga Subcategorías (Cascada Nivel 2)
  useEffect(() => {
    if (userProfessionId && selCat) {
      getDocs(collection(db, "professions", userProfessionId, "categories", selCat, "subcategories")).then(snap => {
        setSubCats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setSelSubCat(''); setTasks([]);
      }).catch(e => console.error("Error loading subcategories:", e));
    }
  }, [selCat, userProfessionId]);

  // C. Carga Tareas (Cascada Nivel 3)
  useEffect(() => {
    if (userProfessionId && selCat && selSubCat) {
      // Determinamos qué colección del catálogo leer según el tipo de misión seleccionado en el Switch
      const collectionName = missionType === 'daily' ? 'catalog_routines' : 'catalog_missions';

      setTasks([]); // Limpiar para evitar confusión visual

      getDocs(collection(db, "professions", userProfessionId, "categories", selCat, "subcategories", selSubCat, collectionName)).then(snap => {
        setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }).catch(e => console.error("Error loading tasks:", e));
    }
  }, [selSubCat, userProfessionId, missionType]); 

  // D. Selección de Tarea (Auto-rellenado)
  const handleSelectCatalogTask = (taskId: string) => {
    const t = tasks.find(x => x.id === taskId);
    if (t) {
      setTitle(t.title || '');
      setDesc(t.description || '');

      // Si la tarea del catálogo tiene un tier definido y NO es diaria, lo usamos.
      if (missionType !== 'daily') {
        setSelectedTier(t.tier || 'EASY');
      }
    }
  };

  // ---------------------------------------------------------
  // 3. HANDLERS AUXILIARES
  // ---------------------------------------------------------
  const toggleDay = (dayId: string) => {
    if (selectedDays.includes(dayId)) {
      setSelectedDays(selectedDays.filter(d => d !== dayId));
    } else {
      setSelectedDays([...selectedDays, dayId]);
    }
  };

  const handleAssign = async () => {
    if (!title) return alert("Falta el título.");
    if (missionType === 'daily' && selectedDays.length === 0) return alert("Selecciona al menos un día para la rutina.");

    setSaving(true);
    try {
      // @ts-ignore
      const tierData = MISSION_TIERS[selectedTier];

      const assignmentData = {
        patientId,
        professionalId,
        title,
        description: desc,
        type: missionType,
        // Guardamos el array de días solo si es rutina
        frequency: missionType === 'daily' ? selectedDays : null,
        status: 'pending',
        createdAt: new Date(),

        // Snapshot de reglas RPG
        tierId: tierData.id,
        rewards: {
          xp: tierData.xp,
          gold: tierData.gold,
          nexus: tierData.nexus || 0,
          statValue: tierData.stats || 0 
        },
        targetStat: selectedTier === 'LEGENDARY' ? targetStat : null,
        themeColor: tierData.color
      };

      // --- SELECCIÓN DE COLECCIÓN DE DESTINO ---
      const targetCollection = missionType === 'daily' ? "assigned_routines" : "assigned_missions";

      await addDoc(collection(db, targetCollection), assignmentData);

      alert(missionType === 'daily' ? "Rutina asignada correctamente." : "Misión asignada correctamente.");
      onClose();

      // Reset
      setTitle(''); setDesc(''); setSelectedDays([]); setSelectedTier('EASY');
    } catch (error) {
      console.error(error);
      alert("Error al asignar.");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000
    }}>
      <div style={{ backgroundColor: 'white', width: '600px', borderRadius: '12px', padding: '25px', maxHeight: '90vh', overflowY: 'auto' }}>

        <h2 style={{marginTop:0, color:'#333'}}>Asignar a {patientName}</h2>

        {/* SWITCH TIPO DE MISIÓN */}
        <div style={{display:'flex', gap:'10px', marginBottom:'20px', background:'#f5f5f5', padding:'5px', borderRadius:'8px'}}>
          <button
            onClick={() => setMissionType('one-off')}
            style={{
              flex:1, padding:'10px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'bold',
              background: missionType === 'one-off' ? 'white' : 'transparent',
              boxShadow: missionType === 'one-off' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
              color: missionType === 'one-off' ? '#E65100' : '#666'
            }}
          >
            🎯 Misión Única
          </button>
          <button
            onClick={() => setMissionType('daily')}
            style={{
              flex:1, padding:'10px', borderRadius:'6px', border:'none', cursor:'pointer', fontWeight:'bold',
              background: missionType === 'daily' ? '#9C27B0' : 'transparent',
              boxShadow: missionType === 'daily' ? '0 2px 4px rgba(0,0,0,0.2)' : 'none',
              color: missionType === 'daily' ? 'white' : '#666'
            }}
          >
            📅 Rutina Diaria
          </button>
        </div>

        {/* TABS DE ORIGEN */}
        <div style={{display:'flex', gap:'15px', marginBottom:'15px', borderBottom:'1px solid #eee'}}>
          <button onClick={() => setActiveTab('custom')} style={{padding:'8px 0', background:'none', border:'none', borderBottom: activeTab==='custom'?'3px solid #333':'none', fontWeight:'bold', cursor:'pointer'}}>  ✍ Crear Manual  </button>
          <button onClick={() => setActiveTab('catalog')} style={{padding:'8px 0', background:'none', border:'none', borderBottom: activeTab==='catalog'?'3px solid #333':'none', fontWeight:'bold', cursor:'pointer', color: activeTab==='catalog'?'black':'#666'}}>📚 Desde Catálogo</button>
        </div>

        {/* --- SECCIÓN CATÁLOGO --- */}
        {activeTab === 'catalog' && (
          <div style={{background:'#E3F2FD', padding:'15px', borderRadius:'8px', marginBottom:'20px', border:'1px solid #BBDEFB'}}>
            <h4 style={{marginTop:0, color:'#1565C0'}}>Explorar Árbol Clínico</h4>

            <div style={{marginBottom:'10px'}}>
              <label style={{fontSize:'12px', color:'#555', display:'block', marginBottom:'4px'}}>Profesión:</label>
              <input value={profNameDisplay} disabled style={{width:'100%', padding:'8px', background:'#fff', border:'1px solid #ccc', borderRadius:'4px', color:'#333'}} />
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'10px'}}>
              <select style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} onChange={e => setSelCat(e.target.value)} value={selCat}>
                <option value="">📂 Categoría...</option>
                {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>

              <select style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} onChange={e => setSelSubCat(e.target.value)} value={selSubCat} disabled={!selCat}>
                <option value="">📂 Subcategoría...</option>
                {subCats.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <select
              style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #2196F3', fontWeight:'bold'}}
              onChange={e => handleSelectCatalogTask(e.target.value)}
              disabled={!selSubCat}
            >
              <option value="">
                {missionType === 'daily' ? "👇 Seleccionar Rutina Sugerida" : "👇 Seleccionar Misión Sugerida"}
              </option>
              {tasks.map(t => <option key={t.id} value={t.id}>{t.title} ({t.tier || 'Sin Tier'})</option>)}
            </select>
          </div>
        )}

        {/* --- FORMULARIO FINAL --- */}
        <div>
          <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Título:</label>
          <input value={title} onChange={e => setTitle(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'15px', borderRadius:'6px', border:'1px solid #ccc'}} placeholder="Ej: Beber 2L de agua" />

          <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Instrucciones:</label>
          <textarea value={desc} onChange={e => setDesc(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'15px', borderRadius:'6px', border:'1px solid #ccc'}} placeholder="Detalles..." rows={2} />

          {/* SELECTOR DE DÍAS (Solo para Rutinas) */}
          {missionType === 'daily' && (
            <div style={{marginBottom:'20px', padding:'15px', background:'#F3E5F5', borderRadius:'8px', border:'1px solid #E1BEE7'}}>
              <label style={{display:'block', fontWeight:'bold', color:'#7B1FA2', marginBottom:'10px'}}>Frecuencia (Días):</label>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                {WEEKDAYS.map(day => {
                  const isSelected = selectedDays.includes(day.id);
                  return (
                    <button
                      key={day.id}
                      onClick={() => toggleDay(day.id)}
                      style={{
                        width:'40px', height:'40px', borderRadius:'50%', cursor:'pointer', fontWeight:'bold',
                        background: isSelected ? '#9C27B0' : 'white',
                        color: isSelected ? 'white' : '#666',
                        border: isSelected ? 'none' : '1px solid #ccc',
                        boxShadow: isSelected ? '0 2px 5px rgba(156, 39, 176, 0.4)' : 'none'
                      }}
                    >
                      {day.label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* SELECTOR DE RECOMPENSA */}
          <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Nivel de Recompensa:</label>

          {missionType === 'daily' ? (
            // VISUALIZACIÓN BLOQUEADA PARA RUTINAS
            <div style={{padding:'12px', background:'#eee', borderRadius:'6px', border:'1px solid #ccc', color:'#555', marginBottom:'15px', display:'flex', alignItems:'center', gap:'10px'}}>
              <span>🔒 <strong>Fijo por día:</strong></span>
              <span style={{background:'#9C27B0', color:'white', padding:'2px 8px', borderRadius:'4px', fontSize:'12px'}}>+5 XP | +5 Oro</span>
            </div>
          ) : (
            // SELECTOR EDITABLE PARA MISIONES ÚNICAS
            <select value={selectedTier} onChange={e => setSelectedTier(e.target.value)} style={{width:'100%', padding:'10px', marginBottom:'15px', borderRadius:'6px', border:'1px solid #ccc', background:'white'}}>
              {Object.values(MISSION_TIERS).map((tier: any) => (
                <option key={tier.id} value={tier.id}>{tier.label} (+{tier.xp} XP | {tier.gold} Oro)</option>
              ))}
            </select>
          )}

          {/* OPCIONES LEGENDARIAS */}
          {selectedTier === 'LEGENDARY' && missionType !== 'daily' && (
            <div style={{background:'#FCE4EC', padding:'10px', borderRadius:'8px', marginBottom:'15px', border:'1px solid #E91E63'}}>
              <strong style={{color:'#C2185B'}}>🔥 Elige el Stat Legendario:</strong>
              <select value={targetStat} onChange={e => setTargetStat(e.target.value)} style={{width:'100%', padding:'8px', marginTop:'5px', borderRadius:'4px', border:'1px solid #C2185B'}}>
                <option value="str">Fuerza (Voluntad)</option>
                <option value="int">Intelecto (Cognición)</option>
                <option value="sta">Resistencia (Emocional)</option>
                <option value="cha">Carisma (Social)</option>
              </select>
            </div>
          )}

          {/* BOTONES FINALES */}
          <div style={{display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'10px'}}>
            <button onClick={onClose} style={{padding:'10px 20px', background:'#eee', border:'none', borderRadius:'6px', cursor:'pointer'}}>Cancelar</button>
            <button
              onClick={handleAssign}
              disabled={saving}
              style={{
                padding:'10px 20px', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', color:'white',
                background: missionType==='daily'?'#9C27B0':'#E65100'
              }}
            >
              {saving ? 'Guardando...' : missionType==='daily' ? 'Crear Rutina' : 'Asignar Misión'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}