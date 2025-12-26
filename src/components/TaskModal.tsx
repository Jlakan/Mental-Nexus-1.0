import { useState, useEffect } from 'react';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../services/firebase';

// Esta es la parte clave que soluciona el error.
// Definimos que el componente ACEPTA todas estas propiedades.
interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;        // <--- Faltaba esto
  professionalId: string;
  patientName?: string;     // <--- Faltaba esto
  userProfessionId?: string; // <--- Faltaba esto (a veces se usa duplicado, lo definimos para evitar error)
  taskToEdit?: any;         // <--- Faltaba esto (para cuando editas en lugar de crear)
}

const ATTRIBUTES = ['fuerza', 'inteligencia', 'resistencia', 'carisma', 'disciplina', 'creatividad'];

export default function TaskModal({ 
    isOpen, 
    onClose, 
    patientId, 
    professionalId, 
    patientName,
    taskToEdit 
}: Props) {
  
  // Estado del formulario
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'habit' | 'daily' | 'todo'>('daily');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [attribute, setAttribute] = useState('disciplina');
  
  const [loading, setLoading] = useState(false);

  // Si viene una tarea para editar, llenamos el formulario
  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setType(taskToEdit.type || 'daily');
      setDifficulty(taskToEdit.difficulty || 'medium');
      setAttribute(taskToEdit.attribute || 'disciplina');
    } else {
      // Reset si es nueva
      setTitle('');
      setDescription('');
      setType('daily');
      setDifficulty('medium');
      setAttribute('disciplina');
    }
  }, [taskToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !patientId) return;

    setLoading(true);
    try {
      // 1. Calculamos recompensas base según dificultad
      let xpReward = 10;
      let goldReward = 5;
      
      if (difficulty === 'medium') { xpReward = 20; goldReward = 10; }
      if (difficulty === 'hard') { xpReward = 40; goldReward = 25; }

      // 2. Objeto de la nueva tarea
      const newTask = {
        id: taskToEdit?.id || Date.now().toString(), // Si editamos mantenemos ID, si no, nuevo
        title,
        description,
        type,
        difficulty,
        attribute,
        xpReward,
        goldReward,
        assignedBy: professionalId,
        assignedByName: 'Profesional', // Podrías pasar tu nombre como prop si quisieras
        status: 'active', // active, completed, failed
        createdAt: new Date().toISOString(),
        completedAt: null
      };

      // 3. Guardar en el documento del paciente
      // Guardamos dentro de la colección 'gamification' -> documento 'tasks' (o donde tengas tu estructura)
      // O directamente en el array 'activeTasks' del perfil del paciente, depende de tu arquitectura.
      // Aquí asumiré que guardas en un array dentro del documento del paciente para simplificar:
      
      const patientRef = doc(db, "patients", patientId);
      
      // Nota: Lo ideal es tener una subcolección, pero arrayUnion sirve para listas cortas
      await updateDoc(patientRef, {
        activeTasks: arrayUnion(newTask),
        [`careTeam.${professionalId}.lastTaskDate`]: new Date().toISOString() // Actualizamos el radar
      });

      alert("Tarea asignada correctamente");
      onClose();
    } catch (error) {
      console.error("Error al guardar tarea:", error);
      alert("Error al asignar tarea");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', padding: '25px', borderRadius: '12px', 
        width: '500px', maxWidth: '95%', maxHeight: '90vh', overflowY: 'auto'
      }}>
        <h2 style={{marginTop:0}}>
            {taskToEdit ? 'Editar Tarea' : 'Nueva Tarea RPG'}
        </h2>
        
        {patientName && (
            <div style={{marginBottom:'15px', fontSize:'14px', color:'#666', background:'#f5f5f5', padding:'8px', borderRadius:'4px'}}>
                Asignando a: <strong>{patientName}</strong>
            </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* TÍTULO */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Título de la Misión</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej: Caminar 30 minutos"
              style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
              required
            />
          </div>

          {/* DESCRIPCIÓN */}
          <div style={{marginBottom: '15px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Descripción</label>
            <textarea 
              value={description} 
              onChange={e => setDescription(e.target.value)}
              placeholder="Detalles de la tarea..."
              style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', minHeight:'60px'}}
            />
          </div>

          {/* SELECTORES EN FILA */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'15px', marginBottom:'15px'}}>
            <div>
                <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Tipo</label>
                <select 
                    value={type} 
                    onChange={e => setType(e.target.value as any)}
                    style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                >
                    <option value="daily">📅 Diaria</option>
                    <option value="habit">🔄 Hábito</option>
                    <option value="todo">✅ Una vez</option>
                </select>
            </div>
            <div>
                <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Dificultad</label>
                <select 
                    value={difficulty} 
                    onChange={e => setDifficulty(e.target.value as any)}
                    style={{width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc'}}
                >
                    <option value="easy">🟢 Fácil (+10 XP)</option>
                    <option value="medium">🟡 Media (+20 XP)</option>
                    <option value="hard">🔴 Difícil (+40 XP)</option>
                </select>
            </div>
          </div>

          {/* ATRIBUTO RPG */}
          <div style={{marginBottom: '20px'}}>
            <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Stat que mejora:</label>
            <div style={{display:'flex', gap:'5px', flexWrap:'wrap', marginTop:'5px'}}>
                {ATTRIBUTES.map(attr => (
                    <button
                        key={attr}
                        type="button"
                        onClick={() => setAttribute(attr)}
                        style={{
                            padding:'5px 10px', borderRadius:'15px', border:'1px solid #ddd',
                            background: attribute === attr ? '#2196F3' : 'white',
                            color: attribute === attr ? 'white' : '#555',
                            cursor:'pointer', fontSize:'12px', textTransform:'capitalize'
                        }}
                    >
                        {attr}
                    </button>
                ))}
            </div>
          </div>

          <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop:'15px', borderTop:'1px solid #eee'}}>
            <button type="button" onClick={onClose} style={{padding: '10px 20px', background: '#eee', border: 'none', borderRadius: '6px', cursor:'pointer'}}>Cancelar</button>
            <button type="submit" disabled={loading} style={{padding: '10px 20px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '6px', cursor:'pointer', fontWeight:'bold'}}>
              {loading ? 'Guardando...' : 'Asignar Misión'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}