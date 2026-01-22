import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../services/firebase';

// CAMBIO: Importamos la lógica de análisis clínico desde el nuevo motor
import { analyzeAssignment } from '../utils/ClinicalEngine';
import type { Assignment } from '../utils/ClinicalEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  specificTask?: Assignment | null; 
}

// --- HELPER ROBUSTO PARA FECHAS ---
const parseFirestoreDate = (value: any): Date => {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && 'seconds' in value) return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

// --- HELPER PARA NORMALIZAR HISTORIAL (Map vs Array) ---
const normalizeHistory = (historyData: any): any[] => {
  if (!historyData) return [];
  
  // Caso 1: Ya es un Array
  if (Array.isArray(historyData)) {
    return [...historyData];
  }
  
  // Caso 2: Es un Objeto/Mapa (ej: { "2024-01-01": {...} })
  if (typeof historyData === 'object') {
    return Object.values(historyData);
  }
  
  return [];
};

export default function HistoryModal({ isOpen, onClose, patientId, patientName, specificTask }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSingleTaskMode = !!specificTask;

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (!isSingleTaskMode) {
        loadHistory();
      } else {
        setLoading(false);
      }
    }
  }, [isOpen, patientId, specificTask]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const qM = query(collection(db, "assigned_missions"), where("patientId", "==", patientId));
      const qR = query(collection(db, "assigned_routines"), where("patientId", "==", patientId));

      const [snapM, snapR] = await Promise.all([getDocs(qM), getDocs(qR)]);

      const missions = snapM.docs.map(d => ({ id: d.id, ...d.data(), type: 'mission' }));
      const routines = snapR.docs.map(d => ({ id: d.id, ...d.data(), type: 'routine' }));

      // Ordenamiento seguro
      const all = [...missions, ...routines].sort((a: any, b: any) => {
        const dateA = parseFirestoreDate(a.createdAt);
        const dateB = parseFirestoreDate(b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });
      setTasks(all);
    } catch (e: any) {
      console.error("Error cargando historial:", e);
      setErrorMsg("Error cargando datos: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: any) => {
    try {
      const d = parseFirestoreDate(value);
      if (d.getTime() === 0) return "-";
      return d.toLocaleDateString('es-ES', { 
        day: '2-digit', month: 'short', hour: '2-digit', minute:'2-digit' 
      });
    } catch (e) {
      return "Error Fecha";
    }
  };

  // --- HELPERS VISUALES ---
  const getEfficacyColor = (score: number) => {
    if (score >= 80) return '#2E7D32'; 
    if (score >= 50) return '#F9A825'; 
    return '#D32F2F'; 
  };

  const renderEffortRating = (rating?: number) => {
    if (!rating) return <span style={{color:'#999', fontSize:'11px'}}>N/A</span>;
    const colors = ['#81C784', '#AED581', '#FFD54F', '#FFB74D', '#E57373'];
    const safeIndex = Math.max(0, Math.min(4, rating - 1));
    const color = colors[safeIndex] || '#ccc';
    
    return (
      <div style={{display:'flex', alignItems:'center', gap:'6px'}}>
        <div style={{
          width:'24px', height:'24px', borderRadius:'50%', background: color, color:'white',
          display:'flex', justifyContent:'center', alignItems:'center', fontWeight:'bold', fontSize:'12px',
          boxShadow:'0 1px 2px rgba(0,0,0,0.1)'
        }}>
          {rating}
        </div>
        <span style={{fontSize:'11px', color:'#666'}}>
          {rating === 1 ? 'Muy Fácil' : rating === 5 ? 'Muy Difícil' : 'Esfuerzo'}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100
    }}>
      <div style={{ 
        backgroundColor: 'white', width: '900px', borderRadius: '12px', padding: '0', 
        maxHeight: '90vh', overflow: 'hidden', display:'flex', flexDirection:'column', boxShadow:'0 10px 25px rgba(0,0,0,0.2)' 
      }}>

        {/* HEADER */}
        <div style={{
          padding:'20px 25px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center',
          background: isSingleTaskMode ? '#E3F2FD' : 'white'
        }}>
          <div>
            <h2 style={{margin:0, color:'#333', fontSize:'20px'}}>
              {isSingleTaskMode ? '📋 Bitácora de Ejecución' : '📂 Historial Clínico Global'}
            </h2>
            <div style={{marginTop:'5px', color:'#555', fontSize:'14px'}}>
              Paciente: <strong>{patientName}</strong>
              {isSingleTaskMode && specificTask && (
                <span style={{marginLeft:'15px', color:'#1565C0', background:'rgba(255,255,255,0.6)', padding:'2px 8px', borderRadius:'4px', border:'1px solid #BBDEFB'}}>
                  Tarea: <strong>{specificTask?.title || "Sin Título"}</strong>
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'28px', cursor:'pointer', color:'#999', lineHeight:1}}>×</button>
        </div>

        {/* CONTENIDO */}
        <div style={{flex:1, overflowY:'auto', padding:'25px'}}>
          {errorMsg ? (
             <div style={{color:'red', textAlign:'center', padding:'20px', background:'#FFEBEE', borderRadius:'8px'}}>{errorMsg}</div>
          ) : loading ? (
            <div style={{textAlign:'center', padding:'40px', color:'#999'}}>Cargando datos...</div>
          ) : isSingleTaskMode && specificTask ? (
            renderSingleTaskDetail(specificTask, formatDate, renderEffortRating)
          ) : (
            renderGeneralHistoryTable(tasks, formatDate, getEfficacyColor)
          )}
        </div>

        {/* FOOTER */}
        <div style={{padding:'15px 25px', borderTop:'1px solid #eee', textAlign:'right', background:'#fafafa'}}>
          <button onClick={onClose} style={{
            padding:'10px 24px', background:'#546E7A', border:'none', borderRadius:'6px', 
            cursor:'pointer', fontWeight:'bold', color:'white', fontSize:'14px'
          }}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTES
// ----------------------------------------------------------------------

function renderSingleTaskDetail(task: any, formatDate: any, renderRating: any) {
  // 1. OBTENER HISTORIAL (Normalizando Objeto -> Array)
  let history: any[] = normalizeHistory(task?.completionHistory || task?.history);

  // 2. ORDENAR
  history.sort((a: any, b: any) => {
    const dateA = parseFirestoreDate(a?.completedAt || a?.loggedAt);
    const dateB = parseFirestoreDate(b?.completedAt || b?.loggedAt);
    return dateB.getTime() - dateA.getTime();
  });

  if (history.length === 0) {
    return (
      <div style={{textAlign:'center', padding:'40px', background:'#f9f9f9', borderRadius:'8px', color:'#777'}}>
        <div style={{fontSize:'48px', marginBottom:'15px'}}>📭</div>
        <p style={{fontSize:'16px', fontWeight:'bold'}}>No se encontraron registros de actividad.</p>
        <p style={{fontSize:'13px', color:'#999', marginBottom:'20px'}}>El paciente aún no ha completado ni saltado esta tarea.</p>
        
        {/* Debug opcional (puedes borrarlo luego) */}
        <details style={{textAlign:'left', marginTop:'20px', border:'1px solid #ccc', borderRadius:'4px', padding:'10px', background:'#eee'}}>
          <summary style={{cursor:'pointer', fontWeight:'bold', fontSize:'12px', color:'#555'}}>🛠️ Ver Datos Crudos</summary>
          <pre style={{fontSize:'10px', overflowX:'auto', marginTop:'10px', whiteSpace:'pre-wrap'}}>
            {JSON.stringify(task, null, 2)}
          </pre>
        </details>
      </div>
    );
  }

  return (
    <table style={{width:'100%', borderCollapse:'collapse', fontSize:'14px'}}>
      <thead style={{background:'#ECEFF1', color:'#455A64', textTransform:'uppercase', fontSize:'11px', letterSpacing:'0.5px'}}>
        <tr>
          <th style={{padding:'12px', textAlign:'left', width:'150px', borderBottom:'2px solid #CFD8DC'}}>Fecha / Hora</th>
          <th style={{padding:'12px', textAlign:'center', width:'100px', borderBottom:'2px solid #CFD8DC'}}>Estado</th>
          <th style={{padding:'12px', textAlign:'left', width:'140px', borderBottom:'2px solid #CFD8DC'}}>Nivel Esfuerzo</th>
          <th style={{padding:'12px', textAlign:'left', borderBottom:'2px solid #CFD8DC'}}>Reflexión / Motivo</th>
        </tr>
      </thead>
      <tbody>
        {history.map((record: any, idx: number) => {
          if (!record) return null;
          
          const dateObj = parseFirestoreDate(record.completedAt || record.loggedAt);
          const isSkipped = record.status === 'skipped' || record.isSkipped === true;
          
          // Compatibilidad: algunos registros tienen 'selfRating', otros 'rating'
          const ratingValue = record.selfRating || record.rating;

          return (
            <tr key={idx} style={{borderBottom:'1px solid #eee', background: isSkipped ? '#FFFDE7' : 'white'}}>
              <td style={{padding:'16px 12px', color:'#444', verticalAlign:'top', fontWeight:'500'}}>
                {formatDate(dateObj)}
              </td>
              
              <td style={{padding:'16px 12px', textAlign:'center', verticalAlign:'top'}}>
                {isSkipped ? (
                  <span style={{
                    background:'#FFECB3', color:'#E65100', padding:'4px 10px', borderRadius:'20px', 
                    fontSize:'11px', fontWeight:'bold', border:'1px solid #FFD54F', display:'inline-block'
                  }}>
                    🏃 ESCAPE
                  </span>
                ) : (
                  <span style={{
                    background:'#E8F5E9', color:'#2E7D32', padding:'4px 10px', borderRadius:'20px', 
                    fontSize:'11px', fontWeight:'bold', border:'1px solid #A5D6A7', display:'inline-block'
                  }}>
                    ✅ HECHO
                  </span>
                )}
              </td>

              <td style={{padding:'16px 12px', verticalAlign:'top'}}>
                 {!isSkipped ? renderRating(ratingValue) : (
                   <div style={{color:'#E65100', fontSize:'12px', fontStyle:'italic', display:'flex', alignItems:'center', gap:'5px'}}>
                     <span>🚫</span> N/A
                   </div>
                 )}
              </td>

              <td style={{padding:'16px 12px', verticalAlign:'top', color:'#333'}}>
                {isSkipped ? (
                  <div style={{background:'rgba(255,255,255,0.5)', padding:'8px', borderRadius:'4px', border:'1px dashed #FFD54F'}}>
                    <strong style={{color:'#E65100', fontSize:'11px', textTransform:'uppercase'}}>Motivo:</strong>
                    <div style={{marginTop:'4px', fontStyle:'italic', color:'#5D4037'}}>
                      "{record.motive || record.note || 'Sin motivo'}"
                    </div>
                  </div>
                ) : (
                  <div>
                    {(record.reflection || record.note) ? (
                      <>
                        <div style={{display:'flex', alignItems:'center', gap:'5px', marginBottom:'4px'}}>
                          <span style={{fontSize:'14px'}}>💬</span>
                          <strong style={{color:'#1565C0', fontSize:'12px'}}>Reflexión:</strong>
                        </div>
                        <div style={{marginLeft:'24px', lineHeight:'1.5', color:'#424242', background:'#F5F5F5', padding:'8px', borderRadius:'0 8px 8px 8px'}}>
                          {record.reflection || record.note}
                        </div>
                      </>
                    ) : (
                      <span style={{color:'#B0BEC5', fontStyle:'italic', fontSize:'12px'}}>- Sin notas -</span>
                    )}
                  </div>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function renderGeneralHistoryTable(tasks: any[], formatDate: any, getEfficacyColor: any) {
  if (!tasks || tasks.length === 0) {
    return (
      <div style={{textAlign:'center', padding:'50px', color:'#999', fontStyle:'italic'}}>
        Este paciente aún no tiene misiones ni rutinas asignadas.
      </div>
    );
  }

  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%', borderCollapse:'collapse', fontSize:'14px'}}>
        <thead style={{background:'#f5f5f5', color:'#666', fontSize:'12px', textTransform:'uppercase'}}>
          <tr>
            <th style={{padding:'12px', textAlign:'left'}}>Asignado</th>
            <th style={{padding:'12px', textAlign:'left'}}>Tarea y Análisis</th>
            <th style={{padding:'12px', textAlign:'left', width:'120px'}}>Duración</th>
            <th style={{padding:'12px', textAlign:'center', width:'200px'}}>Eficacia Global</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(t => {
            let analysis = { successScore: 0, insightMessage: '' };
            try {
              // Convertir historial a Array para que analyzeAssignment funcione
              const historyArray = normalizeHistory(t.completionHistory).map((h:any) => ({
                ...h,
                completedAt: parseFirestoreDate(h.completedAt || h.loggedAt)
              }));

              const taskForAnalysis = {
                ...t,
                assignedAt: parseFirestoreDate(t.createdAt),
                completionHistory: historyArray
              };
              
              // Usamos la función importada desde ClinicalEngine
              if (typeof analyzeAssignment === 'function') {
                  analysis = analyzeAssignment(taskForAnalysis as Assignment);
              }
            } catch (err) {
              console.warn("Skip analysis", t.id);
            }

            const isRoutine = t.type === 'routine' || t.type === 'recurring';
            const efficacyColor = getEfficacyColor(analysis.successScore);

            return (
              <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                <td style={{padding:'12px', color:'#555', verticalAlign:'top'}}>
                  {formatDate(t.createdAt)}
                </td>
                <td style={{padding:'12px', verticalAlign:'top'}}>
                  <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px'}}>
                    <span style={{
                      fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white', fontWeight:'bold',
                      background: isRoutine ? '#AB47BC' : '#FF7043'
                    }}>
                      {isRoutine ? 'RUTINA' : 'MISIÓN'}
                    </span>
                    <strong style={{color:'#333', fontSize:'15px'}}>{t.title}</strong>
                  </div>
                  <div style={{fontSize:'12px', color:'#78909C', lineHeight:'1.4'}}>
                     {analysis.insightMessage || 'Sin análisis disponible'}
                  </div>
                </td>
                <td style={{padding:'12px', fontSize:'13px', color:'#555', verticalAlign:'top'}}>
                  {isRoutine ? (
                    <span style={{background:'#F3E5F5', color:'#8E24AA', padding:'2px 6px', borderRadius:'4px', fontSize:'11px'}}>
                      {t.durationWeeks || 1} Semanas
                    </span>
                  ) : (
                    <span style={{color:'#999'}}>- Única -</span>
                  )}
                </td>
                <td style={{padding:'12px', textAlign:'center', verticalAlign:'middle'}}>
                   <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px'}}>
                      <span style={{fontSize:'11px', color:'#777'}}>Cumplimiento</span>
                      <span style={{color: efficacyColor, fontWeight:'bold', fontSize:'16px'}}>{analysis.successScore}%</span>
                   </div>
                   <div style={{width:'100%', height:'6px', background:'#ECEFF1', borderRadius:'3px', overflow:'hidden'}}>
                      <div style={{width:`${analysis.successScore}%`, height:'100%', background:efficacyColor}} />
                   </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}