import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export default function HistoryModal({ isOpen, onClose, patientId, patientName }: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen, patientId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      // 1. Buscamos en ambas colecciones
      const qM = query(collection(db, "assigned_missions"), where("patientId", "==", patientId));
      const qR = query(collection(db, "assigned_routines"), where("patientId", "==", patientId));

      const [snapM, snapR] = await Promise.all([getDocs(qM), getDocs(qR)]);

      const missions = snapM.docs.map(d => ({ id: d.id, ...d.data(), type: 'mission' }));
      const routines = snapR.docs.map(d => ({ id: d.id, ...d.data(), type: 'routine' }));

      // 2. Combinamos y Ordenamos (Más recientes primero)
      const all = [...missions, ...routines].sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; // Descendente
      });

      setTasks(all);
    } catch (e) {
      console.error("Error cargando historial:", e);
    } finally {
      setLoading(false);
    }
  };

  // --- HELPERS DE VISUALIZACIÓN ---
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const getComplianceBadge = (task: any) => {
    // A. Misiones Únicas
    if (task.type === 'mission') {
      if (task.status === 'completed') {
        return (
          <span style={{color: '#2E7D32', background: '#E8F5E9', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'}}>
            ✅ Completada
          </span>
        );
      }
      return (
        <span style={{color: '#F57F17', background: '#FFF9C4', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold'}}>
           ⏳ Pendiente
        </span>
      );
    }

    // B. Rutinas (Cálculo matemático)
    const completed = task.progress?.completedCount || 0;
    // Usamos totalVolumeExpected (nuevo) o targetCount (legacy)
    const target = task.totalVolumeExpected || task.progress?.targetCount || 1;
    
    const percentage = Math.round((completed / target) * 100);
    
    // Color según desempeño
    let color = '#D32F2F'; // Rojo (<30%)
    let bg = '#FFEBEE';
    if (percentage >= 80) { color = '#2E7D32'; bg = '#E8F5E9'; } // Verde
    else if (percentage >= 50) { color = '#F9A825'; bg = '#FFFDE7'; } // Amarillo

    return (
      <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
        <span style={{color, background: bg, padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 'bold'}}>
          📊 {percentage}%
        </span>
        <span style={{fontSize:'10px', color:'#666', marginTop:'2px'}}>
          ({completed}/{target} reps)
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
      <div style={{ backgroundColor: 'white', width: '800px', borderRadius: '12px', padding: '25px', maxHeight: '90vh', overflowY: 'auto' }}>
        
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
           <div>
             <h2 style={{margin:0, color:'#333'}}>Historial Clínico</h2>
             <span style={{color:'#666', fontSize:'14px'}}>Paciente: <strong>{patientName}</strong></span>
           </div>
           <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#999'}}>×</button>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:'40px', color:'#999'}}>Cargando historial...</div>
        ) : tasks.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px', color:'#999', fontStyle:'italic'}}>
            Este paciente aún no tiene historial de tareas.
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'14px'}}>
              <thead style={{background:'#f9f9f9', color:'#555', fontSize:'12px', textTransform:'uppercase'}}>
                <tr>
                  <th style={{padding:'12px', textAlign:'left'}}>Fecha Asignada</th>
                  <th style={{padding:'12px', textAlign:'left'}}>Tarea</th>
                  <th style={{padding:'12px', textAlign:'left'}}>Detalles de Ciclo</th>
                  <th style={{padding:'12px', textAlign:'center'}}>Cumplimiento</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                   const isRoutine = t.type === 'routine';
                   return (
                     <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                       {/* FECHA */}
                       <td style={{padding:'12px', color:'#444'}}>
                          <div>{formatDate(t.createdAt)}</div>
                          <div style={{fontSize:'11px', color:'#999'}}>hace {Math.floor((new Date().getTime() - (t.createdAt?.toDate ? t.createdAt.toDate() : new Date()).getTime())/(1000*60*60*24))} días</div>
                       </td>
                       
                       {/* TAREA */}
                       <td style={{padding:'12px'}}>
                          <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px'}}>
                             <span style={{
                               fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white', 
                               background: isRoutine ? '#9C27B0' : '#E65100'
                             }}>
                               {isRoutine ? 'RUTINA' : 'MISIÓN'}
                             </span>
                             <strong style={{color:'#333'}}>{t.title}</strong>
                          </div>
                          {t.originalCatalogId && (
                             <div style={{fontSize:'10px', color:'#1976D2', background:'#E3F2FD', display:'inline-block', padding:'1px 5px', borderRadius:'4px'}}>
                                🔗 Catálogo
                             </div>
                          )}
                       </td>

                       {/* DETALLES DE CICLO */}
                       <td style={{padding:'12px', fontSize:'13px', color:'#555'}}>
                          {isRoutine ? (
                             <div>
                                <div>⏱ <strong>Sprint:</strong> {t.durationWeeks || 1} semanas</div>
                                {t.endDate && (
                                   <div style={{fontSize:'11px', color: (t.endDate.toDate() < new Date()) ? '#D32F2F' : '#666'}}>
                                      Vence: {formatDate(t.endDate)}
                                      {(t.endDate.toDate() < new Date()) && <strong> (Expirado)</strong>}
                                   </div>
                                )}
                             </div>
                          ) : (
                             <span style={{color:'#999'}}>- Misión Única -</span>
                          )}
                       </td>

                       {/* CUMPLIMIENTO */}
                       <td style={{padding:'12px', textAlign:'center'}}>
                          {getComplianceBadge(t)}
                       </td>
                     </tr>
                   );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div style={{textAlign:'right', marginTop:'20px'}}>
           <button onClick={onClose} style={{padding:'10px 20px', background:'#eee', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', color:'#333'}}>
             Cerrar
           </button>
        </div>

      </div>
    </div>
  );
}