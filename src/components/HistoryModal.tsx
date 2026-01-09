import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from '../services/firebase';

// SOLUCIÓN: Separamos la importación de la función (Lógica) y la del tipo (Interface)
import { analyzeAssignment } from '../utils/StatisticsUtils';
import type { Assignment } from '../utils/StatisticsUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

export default function HistoryModal({ isOpen, onClose, patientId, patientName }: Props) {
  // Usamos 'Assignment[]' o 'any[]' según tu configuración estricta de TS
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
      const qM = query(collection(db, "assigned_missions"), where("patientId", "==", patientId));
      const qR = query(collection(db, "assigned_routines"), where("patientId", "==", patientId));

      const [snapM, snapR] = await Promise.all([getDocs(qM), getDocs(qR)]);

      const missions = snapM.docs.map(d => ({ id: d.id, ...d.data(), type: 'mission' })); // map a 'one_time' en utils si es necesario
      const routines = snapR.docs.map(d => ({ id: d.id, ...d.data(), type: 'routine' })); // map a 'recurring'

      // Combinamos y Ordenamos (Más recientes primero)
      const all = [...missions, ...routines].sort((a: any, b: any) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(0);
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(0);
        return dateB - dateA; 
      });

      setTasks(all);
    } catch (e) {
      console.error("Error cargando historial:", e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "-";
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  // --- NUEVOS HELPERS VISUALES ---

  // Determina el color basado en el Score (Semáforo)
  const getEfficacyColor = (score: number) => {
    if (score >= 80) return '#2E7D32'; // Verde
    if (score >= 50) return '#F9A825'; // Amarillo/Naranja
    return '#D32F2F'; // Rojo
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2100
    }}>
      <div style={{ backgroundColor: 'white', width: '900px', borderRadius: '12px', padding: '25px', maxHeight: '90vh', overflowY: 'auto' }}>

        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px', borderBottom:'1px solid #eee', paddingBottom:'15px'}}>
          <div>
            <h2 style={{margin:0, color:'#333'}}>Historial Clínico Avanzado</h2>
            <span style={{color:'#666', fontSize:'14px'}}>Paciente: <strong>{patientName}</strong></span>
          </div>
          <button onClick={onClose} style={{background:'none', border:'none', fontSize:'24px', cursor:'pointer', color:'#999'}}>×</button>
        </div>

        {loading ? (
          <div style={{textAlign:'center', padding:'40px', color:'#999'}}>Analizando datos...</div>
        ) : tasks.length === 0 ? (
          <div style={{textAlign:'center', padding:'40px', color:'#999', fontStyle:'italic'}}>
            Este paciente aún no tiene historial de tareas.
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'14px'}}>
              <thead style={{background:'#f9f9f9', color:'#555', fontSize:'12px', textTransform:'uppercase'}}>
                <tr>
                  <th style={{padding:'12px', textAlign:'left'}}>Fecha</th>
                  <th style={{padding:'12px', textAlign:'left'}}>Análisis de Comportamiento</th>
                  <th style={{padding:'12px', textAlign:'left', width:'150px'}}>Ciclo</th>
                  <th style={{padding:'12px', textAlign:'center', width:'180px'}}>Eficacia Clínica</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => {
                  // 2. INVOCACIÓN DEL MOTOR MATEMÁTICO
                  // Convertimos la tarea cruda de Firebase al tipo esperado (o cast as any)
                  // Asegúrate de que las fechas sean objetos Date si el util lo requiere
                  const taskForAnalysis = {
                    ...t,
                    assignedAt: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(t.createdAt),
                    completionHistory: t.completionHistory?.map((h:any) => ({
                        ...h,
                        completedAt: h.completedAt?.toDate ? h.completedAt.toDate() : new Date(h.completedAt)
                    })) || []
                  };

                  const analysis = analyzeAssignment(taskForAnalysis as Assignment);
                  const isRoutine = t.type === 'routine' || t.type === 'recurring';
                  const efficacyColor = getEfficacyColor(analysis.successScore);

                  return (
                    <tr key={t.id} style={{borderBottom:'1px solid #eee'}}>
                      {/* FECHA */}
                      <td style={{padding:'12px', color:'#444', verticalAlign:'top'}}>
                        <div>{formatDate(t.createdAt)}</div>
                      </td>

                      {/* TAREA Y ETIQUETAS DE COMPORTAMIENTO */}
                      <td style={{padding:'12px', verticalAlign:'top'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px'}}>
                          <span style={{
                            fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white',
                            background: isRoutine ? '#9C27B0' : '#E65100'
                          }}>
                            {isRoutine ? 'RUTINA' : 'MISIÓN'}
                          </span>
                          <strong style={{color:'#333'}}>{t.title}</strong>
                        </div>
                        
                        {/* Renderizado de Tags basado en el Análisis */}
                        <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
                          {/* Tag: Acumulación (Cramming) */}
                          {analysis.consistencyFlag === 'cramming' && (
                            <span style={{fontSize:'11px', background:'#FFEBEE', color:'#C62828', padding:'2px 6px', borderRadius:'4px', border:'1px solid #FFCDD2'}}>
                              ⚠️ Acumulación
                            </span>
                          )}
                          
                          {/* Tag: Discrepancia/Sobreestimación (Perception Gap) */}
                          {analysis.perceptionGap && analysis.perceptionGap >= 2 && (
                             <span style={{fontSize:'11px', background:'#E3F2FD', color:'#1565C0', padding:'2px 6px', borderRadius:'4px', border:'1px solid #BBDEFB'}}>
                               📉 Discrepancia
                             </span>
                          )}

                          {/* Tag: Consistente (Stable + Buen Score) */}
                          {analysis.consistencyFlag === 'stable' && analysis.successScore > 60 && (
                            <span style={{fontSize:'11px', background:'#E8F5E9', color:'#2E7D32', padding:'2px 6px', borderRadius:'4px', border:'1px solid #C8E6C9'}}>
                              ⭐ Consistente
                            </span>
                          )}

                          {/* Tag: Sobrecarga (Manía/Obsesión) */}
                          {analysis.intensityPercentage > 150 && (
                            <span style={{fontSize:'11px', background:'#FFF3E0', color:'#E65100', padding:'2px 6px', borderRadius:'4px', border:'1px solid #FFE0B2'}}>
                              🔥 Sobrecarga
                            </span>
                          )}
                           {/* Tag: Pausa Activa */}
                           {analysis.pauseImpact === 'adjusted' && (
                            <span style={{fontSize:'11px', background:'#F5F5F5', color:'#616161', padding:'2px 6px', borderRadius:'4px', border:'1px solid #E0E0E0'}}>
                              ⏸️ Pausa
                            </span>
                          )}
                        </div>
                        
                        {/* Insights textuales (Opcional, tooltip o texto pequeño) */}
                        {analysis.insightMessage && (
                           <div style={{marginTop:'4px', fontSize:'11px', color:'#777', fontStyle:'italic'}}>
                             "{analysis.insightMessage}"
                           </div>
                        )}
                      </td>

                      {/* DETALLES DE CICLO */}
                      <td style={{padding:'12px', fontSize:'13px', color:'#555', verticalAlign:'top'}}>
                         {isRoutine ? (
                             <>
                               <div>Sprint: {t.durationWeeks || 1} sem</div>
                               <div style={{fontSize:'11px', color:'#777'}}>Intensidad: {analysis.intensityPercentage}%</div>
                             </>
                         ) : (
                             <span style={{color:'#999'}}>- Única -</span>
                         )}
                      </td>

                      {/* BARRA DE EFICACIA (NUEVO UI) */}
                      <td style={{padding:'12px', textAlign:'center', verticalAlign:'middle'}}>
                        <div style={{display:'flex', flexDirection:'column', alignItems:'center', width:'100%'}}>
                          
                          {/* Texto de Porcentaje */}
                          <span style={{
                              color: efficacyColor, 
                              fontWeight:'bold', fontSize:'14px', marginBottom:'4px'
                          }}>
                            {analysis.successScore}% Eficacia
                          </span>

                          {/* Barra de Progreso Visual */}
                          <div style={{
                              width:'100%', height:'8px', background:'#eee', borderRadius:'4px', overflow:'hidden',
                              boxShadow:'inset 0 1px 2px rgba(0,0,0,0.1)'
                          }}>
                            <div style={{
                                width: `${analysis.successScore}%`,
                                height:'100%',
                                backgroundColor: efficacyColor,
                                transition: 'width 0.5s ease-in-out'
                            }} />
                          </div>
                        </div>
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