import { useState } from 'react';
import type { WorkConfig, DaySchedule, TimeRange } from '../utils/agendaTypes';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: WorkConfig;
  onSave: (newConfig: WorkConfig) => void;
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AgendaConfigModal({ isOpen, onClose, currentConfig, onSave }: Props) {
  // Estado local para editar sin afectar al padre hasta guardar
  const [config, setConfig] = useState<WorkConfig>(JSON.parse(JSON.stringify(currentConfig)));

  if (!isOpen) return null;

  const handleDayToggle = (dayIndex: number) => {
    const newSchedule = { ...config.schedule };
    if (!newSchedule[dayIndex]) {
        // Si no existía, lo inicializamos
        newSchedule[dayIndex] = { active: true, ranges: [{ start: '09:00', end: '14:00' }] };
    } else {
        newSchedule[dayIndex] = { 
            ...newSchedule[dayIndex], 
            active: !newSchedule[dayIndex].active 
        };
    }
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleAddRange = (dayIndex: number) => {
    const newSchedule = { ...config.schedule };
    newSchedule[dayIndex].ranges.push({ start: '16:00', end: '20:00' });
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleRemoveRange = (dayIndex: number, rangeIndex: number) => {
    const newSchedule = { ...config.schedule };
    newSchedule[dayIndex].ranges.splice(rangeIndex, 1);
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleRangeChange = (dayIndex: number, rangeIndex: number, field: keyof TimeRange, value: string) => {
    const newSchedule = { ...config.schedule };
    newSchedule[dayIndex].ranges[rangeIndex][field] = value;
    setConfig({ ...config, schedule: newSchedule });
  };

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:50}}>
      <div style={{background:'white', width:'600px', maxHeight:'90vh', borderRadius:'12px', display:'flex', flexDirection:'column', boxShadow:'0 10px 25px rgba(0,0,0,0.2)'}}>
        
        {/* HEADER */}
        <div style={{padding:'20px', borderBottom:'1px solid #eee'}}>
            <h2 style={{margin:0}}>⚙️ Configuración de Horarios</h2>
            <p style={{margin:'5px 0 0 0', color:'#666', fontSize:'13px'}}>Define tu semana tipo. Esto se usará al generar nuevos meses.</p>
        </div>

        {/* BODY SCROLLABLE */}
        <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
            
            {/* GLOBALES */}
            <div style={{display:'flex', gap:'20px', marginBottom:'20px', background:'#F5F5F5', padding:'15px', borderRadius:'8px'}}>
                <div style={{flex:1}}>
                    <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Duración Sesión (min):</label>
                    <input 
                        type="number" 
                        value={config.durationMinutes} 
                        onChange={e => setConfig({...config, durationMinutes: Number(e.target.value)})}
                        style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}}
                    />
                </div>
                <div style={{flex:1}}>
                    <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Precio Base ($):</label>
                    <input 
                        type="number" 
                        value={config.defaultPrice} 
                        onChange={e => setConfig({...config, defaultPrice: Number(e.target.value)})}
                        style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}}
                    />
                </div>
            </div>

            {/* DÍAS */}
            <div style={{display:'flex', flexDirection:'column', gap:'10px'}}>
                {DAYS.map((dayName, index) => {
                    const dayData = config.schedule[index] || { active: false, ranges: [] };
                    
                    return (
                        <div key={index} style={{border:'1px solid #eee', borderRadius:'8px', padding:'10px', opacity: dayData.active ? 1 : 0.6}}>
                            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dayData.active ? '10px' : '0'}}>
                                <label style={{display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold', cursor:'pointer'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={dayData.active} 
                                        onChange={() => handleDayToggle(index)}
                                    />
                                    {dayName}
                                </label>
                                {dayData.active && (
                                    <button onClick={() => handleAddRange(index)} style={{background:'#E3F2FD', color:'#1976D2', border:'none', borderRadius:'4px', padding:'4px 8px', cursor:'pointer', fontSize:'12px'}}>
                                        + Agregar Turno
                                    </button>
                                )}
                            </div>

                            {dayData.active && dayData.ranges.map((range, rIndex) => (
                                <div key={rIndex} style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'5px', marginLeft:'25px'}}>
                                    <span style={{fontSize:'12px', color:'#666'}}>De:</span>
                                    <input 
                                        type="time" 
                                        value={range.start} 
                                        onChange={e => handleRangeChange(index, rIndex, 'start', e.target.value)}
                                        style={{padding:'5px', borderRadius:'4px', border:'1px solid #ddd'}}
                                    />
                                    <span style={{fontSize:'12px', color:'#666'}}>A:</span>
                                    <input 
                                        type="time" 
                                        value={range.end} 
                                        onChange={e => handleRangeChange(index, rIndex, 'end', e.target.value)}
                                        style={{padding:'5px', borderRadius:'4px', border:'1px solid #ddd'}}
                                    />
                                    <button 
                                        onClick={() => handleRemoveRange(index, rIndex)}
                                        style={{border:'none', background:'none', color:'#D32F2F', cursor:'pointer', fontWeight:'bold'}}
                                        title="Eliminar turno"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

        </div>

        {/* FOOTER */}
        <div style={{padding:'20px', borderTop:'1px solid #eee', textAlign:'right', display:'flex', gap:'10px', justifyContent:'flex-end'}}>
            <button onClick={onClose} style={{padding:'10px 20px', background:'#eee', border:'none', borderRadius:'6px', cursor:'pointer'}}>Cancelar</button>
            <button onClick={() => onSave(config)} style={{padding:'10px 20px', background:'#2196F3', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>Guardar Configuración</button>
        </div>

      </div>
    </div>
  );
}