import { useState } from 'react';
import type { WorkConfig, TimeRange } from '../utils/agendaTypes';

// --- IMPORTACIONES MUI (Reloj Análogo) ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { renderTimeViewClock } from '@mui/x-date-pickers/timeViewRenderers';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: WorkConfig;
  onSave: (newConfig: WorkConfig) => void;
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function AgendaConfigModal({ isOpen, onClose, currentConfig, onSave }: Props) {
  const [config, setConfig] = useState<WorkConfig>(JSON.parse(JSON.stringify(currentConfig)));

  if (!isOpen) return null;

  // Helper para convertir string "HH:mm" a Dayjs para el componente
  const strToDayjs = (timeStr: string) => {
    const [h, m] = timeStr.split(':').map(Number);
    return dayjs().hour(h).minute(m);
  };

  // --- LÓGICA DE VALIDACIÓN ---
  const hasOverlap = (ranges: TimeRange[]) => {
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };
    const sorted = [...ranges].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const currentEnd = toMinutes(sorted[i].end);
      const nextStart = toMinutes(sorted[i + 1].start);
      if (nextStart < currentEnd) return true;
    }
    return false;
  };

  const handlePreSave = () => {
    for (let i = 0; i < 7; i++) {
        const day = config.schedule[i];
        if (day && day.active && day.ranges.length > 1) {
            if (hasOverlap(day.ranges)) {
                alert(`⚠️ Error en el día ${DAYS[i]}:\nLos horarios se superponen.`);
                return;
            }
        }
        if (day && day.active) {
            for(const range of day.ranges) {
                if(range.start >= range.end) {
                    alert(`⚠️ Error en el día ${DAYS[i]}:\nInicio (${range.start}) debe ser antes del fin (${range.end}).`);
                    return;
                }
            }
        }
    }
    onSave(config);
  };

  const handleDayToggle = (dayIndex: number) => {
    const newSchedule = { ...config.schedule };
    if (!newSchedule[dayIndex]) {
      newSchedule[dayIndex] = { active: true, ranges: [{ start: '09:00', end: '14:00' }] };
    } else {
      newSchedule[dayIndex] = { ...newSchedule[dayIndex], active: !newSchedule[dayIndex].active };
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

  // Cambio usando el TimePicker
  const handleTimeChange = (dayIndex: number, rangeIndex: number, field: keyof TimeRange, newValue: dayjs.Dayjs | null) => {
    if (!newValue) return;
    const timeStr = newValue.format('HH:mm');
    const newSchedule = { ...config.schedule };
    newSchedule[dayIndex].ranges[rangeIndex][field] = timeStr;
    setConfig({ ...config, schedule: newSchedule });
  };

  return (
    // SE ACTUALIZÓ EL ZINDEX A 2000 PARA QUE NO LO TAPE EL SIDEBAR
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex: 2000}}>
      <div style={{background:'white', width:'700px', maxHeight:'90vh', borderRadius:'12px', display:'flex', flexDirection:'column', boxShadow:'0 10px 25px rgba(0,0,0,0.2)'}}>

        <div style={{padding:'20px', borderBottom:'1px solid #eee'}}>
          <h2 style={{margin:0}}>⚙️ Configuración de Horarios</h2>
          <p style={{margin:'5px 0 0 0', color:'#666', fontSize:'13px'}}>Define tu semana tipo usando el reloj.</p>
        </div>

        <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
          
          {/* CONFIG GLOBAL */}
          <div style={{display:'flex', gap:'20px', marginBottom:'20px', background:'#F5F5F5', padding:'15px', borderRadius:'8px'}}>
            <div style={{flex:1}}>
              <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Duración Sesión (min):</label>
              <input type="number" value={config.durationMinutes} onChange={e => setConfig({...config, durationMinutes: Number(e.target.value)})} style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} />
            </div>
            <div style={{flex:1}}>
              <label style={{display:'block', fontSize:'12px', fontWeight:'bold'}}>Precio Base ($):</label>
              <input type="number" value={config.defaultPrice} onChange={e => setConfig({...config, defaultPrice: Number(e.target.value)})} style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc'}} />
            </div>
          </div>

          {/* DÍAS CON RELOJES MUI */}
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <div style={{display:'flex', flexDirection:'column', gap:'15px'}}>
              {DAYS.map((dayName, index) => {
                const dayData = config.schedule[index] || { active: false, ranges: [] };

                return (
                  <div key={index} style={{border:'1px solid #eee', borderRadius:'8px', padding:'15px', opacity: dayData.active ? 1 : 0.6, background: dayData.active ? 'white' : '#fafafa'}}>
                    <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: dayData.active ? '15px' : '0'}}>
                      <label style={{display:'flex', alignItems:'center', gap:'10px', fontWeight:'bold', cursor:'pointer', fontSize:'16px'}}>
                        <input type="checkbox" checked={dayData.active} onChange={() => handleDayToggle(index)} style={{transform:'scale(1.2)'}} />
                        {dayName}
                      </label>
                      {dayData.active && (
                        <button onClick={() => handleAddRange(index)} style={{background:'#E3F2FD', color:'#1976D2', border:'none', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontSize:'12px', fontWeight:'bold'}}>
                          + Agregar Turno
                        </button>
                      )}
                    </div>

                    {dayData.active && dayData.ranges.map((range, rIndex) => (
                      <div key={rIndex} style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'10px', marginLeft:'30px', background:'#fff', padding:'5px'}}>
                        
                        {/* RELOJ INICIO */}
                        <TimePicker
                          label="Inicio"
                          value={strToDayjs(range.start)}
                          onChange={(val) => handleTimeChange(index, rIndex, 'start', val)}
                          viewRenderers={{
                            hours: renderTimeViewClock,
                            minutes: renderTimeViewClock,
                          }}
                          slotProps={{ textField: { size: 'small', style: {width: 130} } }}
                          ampm={false}
                        />

                        <span style={{color:'#999'}}>➜</span>

                        {/* RELOJ FIN */}
                        <TimePicker
                          label="Fin"
                          value={strToDayjs(range.end)}
                          onChange={(val) => handleTimeChange(index, rIndex, 'end', val)}
                          viewRenderers={{
                            hours: renderTimeViewClock,
                            minutes: renderTimeViewClock,
                          }}
                          slotProps={{ textField: { size: 'small', style: {width: 130} } }}
                          ampm={false}
                        />

                        <button onClick={() => handleRemoveRange(index, rIndex)} style={{border:'none', background:'none', color:'#D32F2F', cursor:'pointer', fontSize:'18px', marginLeft:'10px'}} title="Eliminar turno">
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </LocalizationProvider>

        </div>

        <div style={{padding:'20px', borderTop:'1px solid #eee', textAlign:'right', display:'flex', gap:'10px', justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'10px 20px', background:'#eee', border:'none', borderRadius:'6px', cursor:'pointer'}}>Cancelar</button>
          <button onClick={handlePreSave} style={{padding:'10px 20px', background:'#2196F3', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold'}}>
            Guardar Configuración
          </button>
        </div>

      </div>
    </div>
  );
}