// src/components/agenda/AgendaConfigModal.tsx
//Tiene la función de configurar los horarios de trabajo en el consultrio
import React, { useState } from 'react';
import type { WorkConfig, TimeRange } from '../../utils/agendaTypes';

// --- IMPORTACIONES MUI ---
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/es';

dayjs.locale('es');

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentConfig: WorkConfig;
  onSave: (newConfig: WorkConfig) => void;
}

const DAYS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

export default function AgendaConfigModal({
  isOpen,
  onClose,
  currentConfig,
  onSave,
}: Props) {
  const [config, setConfig] = useState<WorkConfig>(
    JSON.parse(JSON.stringify(currentConfig))
  );

  if (!isOpen) return null;

  const strToDayjs = (timeStr: string) => {
    if (!timeStr) return dayjs().hour(9).minute(0);
    const [h, m] = timeStr.split(':').map(Number);
    return dayjs().hour(h).minute(m);
  };

  const handleDayToggle = (dayIndex: number) => {
    const newSchedule = { ...(config.schedule || {}) };
    if (!newSchedule[dayIndex]) {
      newSchedule[dayIndex] = {
        active: true,
        ranges: [{ start: '09:00', end: '14:00' }],
      };
    } else {
      newSchedule[dayIndex] = {
        ...newSchedule[dayIndex],
        active: !newSchedule[dayIndex].active,
      };
    }
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleAddRange = (dayIndex: number) => {
    const newSchedule = { ...(config.schedule || {}) };
    if (!newSchedule[dayIndex].ranges) newSchedule[dayIndex].ranges = [];
    newSchedule[dayIndex].ranges.push({ start: '16:00', end: '20:00' });
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleRemoveRange = (dayIndex: number, rangeIndex: number) => {
    const newSchedule = { ...(config.schedule || {}) };
    newSchedule[dayIndex].ranges.splice(rangeIndex, 1);
    setConfig({ ...config, schedule: newSchedule });
  };

  const handleTimeChange = (
    dayIndex: number,
    rangeIndex: number,
    field: keyof TimeRange,
    newValue: dayjs.Dayjs | null
  ) => {
    if (!newValue) return;
    const timeStr = newValue.format('HH:mm');
    const newSchedule = { ...(config.schedule || {}) };
    newSchedule[dayIndex].ranges[rangeIndex][field] = timeStr;
    setConfig({ ...config, schedule: newSchedule });
  };

  // --- ESTILOS "NEXUS DIGITAL" PARA MATERIAL UI ---
  const digitalPickerStyles = {
    textField: {
      size: 'small' as const,
      sx: {
        width: 140,
        // FONDO: Ámbar brillante (estilo pantalla retroiluminada antigua)
        backgroundColor: '#fbbf24', // amber-400
        borderRadius: '6px',
        border: '2px solid #92400e', // amber-800 (Borde tipo cobre/bronce)
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3)', // Sombra interna para efecto hundido
        '& .MuiInputBase-input': {
          color: '#000000 !important', // Negro absoluto
          WebkitTextFillColor: '#000000 !important',
          fontWeight: '900 !important', // Extra negrita para máxima legibilidad
          fontFamily: 'monospace',
          fontSize: '16px',
          padding: '10px',
          textAlign: 'center',
        },
        '& .MuiInputAdornment-root .MuiSvgIcon-root': {
          color: '#78350f', // Icono en marrón/óxido
        },
        '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
        '&:hover': {
          backgroundColor: '#f59e0b', // amber-500 un poco más oscuro al pasar el mouse
        },
      },
    },
    popper: {
      sx: {
        zIndex: 3000,
        '& .MuiPaper-root': {
          backgroundColor: '#020617', // slate-950
          border: '1px solid #0891b2', // cyan-600
          color: '#cbd5e1', // slate-300
          boxShadow: '0 0 20px rgba(8,145,178,0.3)', // resplandor cian
        },
        '& .MuiMultiSectionDigitalClock-root': {
          backgroundColor: '#0f172a', // slate-900
        },
        '& .MuiMenuItem-root': {
          color: '#94a3b8', // slate-400
          '&:hover': { backgroundColor: '#1e293b' }, // slate-800
          '&.Mui-selected': {
            backgroundColor: '#0891b2', // cyan-600
            color: '#ffffff',
            fontWeight: 'bold',
            '&:hover': { backgroundColor: '#06b6d4' }, // cyan-500
          },
        },
      },
    },
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex justify-center items-center z-[1500] p-4">
      <div className="bg-slate-950 w-full max-w-3xl max-h-[90vh] rounded-xl flex flex-col border border-cyan-900/50 shadow-[0_0_30px_rgba(0,0,0,0.8),inset_0_1px_2px_rgba(34,211,238,0.1)] overflow-hidden">
        {/* HEADER */}
        <div className="p-5 border-b border-cyan-900/40 bg-slate-900/50 flex justify-between items-center shadow-md">
          <h2 className="m-0 text-xl font-bold tracking-widest flex items-center gap-2">
            <span className="text-amber-500">⚙️ CONFIGURACIÓN</span>
            <span className="text-cyan-500/80">NEXUS</span>
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded flex items-center justify-center text-xl cursor-pointer bg-slate-800/50 text-slate-400 hover:bg-red-900/40 hover:text-red-400 border border-transparent hover:border-red-900/50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
          >
            ✕
          </button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent">
          <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="es">
            <div className="flex flex-col gap-4">
              {DAYS.map((dayName, index) => {
                const dayData = config.schedule?.[index] || {
                  active: false,
                  ranges: [],
                };
                return (
                  <div
                    key={index}
                    className={`p-5 rounded-lg border transition-all duration-300 ${
                      dayData.active
                        ? 'border-cyan-700/50 bg-slate-900/80 shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]'
                        : 'border-slate-800 bg-slate-950/50 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <label
                        className={`flex items-center gap-3 cursor-pointer font-bold text-lg tracking-wide select-none ${
                          dayData.active ? 'text-cyan-400' : 'text-slate-500'
                        }`}
                      >
                        <div className="relative flex items-center">
                          <input
                            type="checkbox"
                            checked={dayData.active}
                            onChange={() => handleDayToggle(index)}
                            className="peer appearance-none w-6 h-6 border-2 border-slate-600 rounded bg-slate-800 cursor-pointer checked:bg-cyan-600 checked:border-cyan-400 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
                          />
                          <svg
                            className="absolute w-4 h-4 text-slate-950 pointer-events-none left-1 top-1 opacity-0 peer-checked:opacity-100 transition-opacity"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth="3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </div>
                        {dayName.toUpperCase()}
                      </label>

                      {dayData.active && (
                        <button
                          onClick={() => handleAddRange(index)}
                          className="px-3 py-1.5 text-xs font-bold rounded-md bg-gradient-to-b from-cyan-900/50 to-cyan-950 text-cyan-400 border border-cyan-700/50 shadow-[0_2px_0_rgba(8,145,178,0.4),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[2px] active:shadow-[none] cursor-pointer hover:brightness-110 flex items-center gap-1 transition-all"
                        >
                          <span>+</span> AÑADIR TURNO
                        </button>
                      )}
                    </div>

                    {dayData.active && dayData.ranges.length > 0 && (
                      <div className="mt-4 flex flex-col gap-3 pl-9 border-l-2 border-cyan-900/30">
                        {dayData.ranges.map((range, rIndex) => (
                          <div
                            key={rIndex}
                            className="flex items-center gap-4 bg-slate-950/50 p-2 rounded-lg border border-slate-800 w-fit"
                          >
                            <TimePicker
                              value={strToDayjs(range.start)}
                              onChange={(val) =>
                                handleTimeChange(index, rIndex, 'start', val)
                              }
                              timeSteps={{ minutes: 15 }}
                              ampm={true}
                              slotProps={digitalPickerStyles}
                            />
                            <span className="text-amber-500 font-bold text-xl drop-shadow-[0_0_5px_rgba(245,158,11,0.5)]">
                              ➜
                            </span>
                            <TimePicker
                              value={strToDayjs(range.end)}
                              onChange={(val) =>
                                handleTimeChange(index, rIndex, 'end', val)
                              }
                              timeSteps={{ minutes: 15 }}
                              ampm={true}
                              slotProps={digitalPickerStyles}
                            />
                            <button
                              onClick={() => handleRemoveRange(index, rIndex)}
                              className="ml-2 w-8 h-8 flex items-center justify-center rounded bg-slate-900 border border-slate-700 text-red-500/80 hover:bg-red-900/40 hover:text-red-400 hover:border-red-900 transition-all shadow-[0_2px_0_rgb(51,65,85)] active:translate-y-[2px] active:shadow-[none] cursor-pointer"
                              title="Eliminar turno"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </LocalizationProvider>
        </div>

        {/* FOOTER */}
        <div className="p-5 border-t border-cyan-900/40 bg-slate-900/80 flex gap-4 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg font-bold bg-gradient-to-b from-slate-800 to-slate-900 text-slate-400 border border-slate-700 shadow-[0_4px_0_rgb(51,65,85),inset_0_1px_1px_rgba(255,255,255,0.1)] active:translate-y-[4px] active:shadow-[none] cursor-pointer hover:brightness-110 transition-all"
          >
            CANCELAR
          </button>
          <button
            onClick={() => onSave(config)}
            className="px-8 py-2 rounded-lg font-bold tracking-wider bg-gradient-to-b from-amber-600 to-amber-800 text-slate-950 border border-amber-400 shadow-[0_4px_0_rgb(180,83,9),inset_0_1px_1px_rgba(255,255,255,0.3)] active:translate-y-[4px] active:shadow-[none] cursor-pointer hover:brightness-110 transition-all"
          >
            GUARDAR CAMBIOS
          </button>
        </div>
      </div>
    </div>
  );
}
