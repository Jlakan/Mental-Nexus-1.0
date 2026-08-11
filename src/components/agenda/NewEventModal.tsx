//src/components/agenda/NewEventModal.tsx
import React from 'react';
import dayjs from 'dayjs';
import ModalPortal from '../ModalPortal'; // Ajusta la ruta de importación si es necesario

// Constantes locales necesarias para los selectores
const MONTHS_LIST = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];
const currentYear = new Date().getFullYear();
const YEARS_LIST = Array.from({ length: 7 }, (_, i) => currentYear - 1 + i);

interface NewEventModalProps {
  isOpen: boolean;
  editingEventId: string | null;
  newEventData: { start: dayjs.Dayjs; end: dayjs.Dayjs; title: string };
  setNewEventData: React.Dispatch<
    React.SetStateAction<{
      start: dayjs.Dayjs;
      end: dayjs.Dayjs;
      title: string;
    }>
  >;
  onClose: () => void;
  onSave: () => void;
}

const DateSelectorRow = ({
  label,
  dateValue,
  onChange,
}: {
  label: string;
  dateValue: dayjs.Dayjs;
  onChange: (d: dayjs.Dayjs) => void;
}) => {
  const daysInMonth = dateValue.daysInMonth();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="mb-4">
      <label className="block text-xs font-bold text-cyan-500/80 mb-1 tracking-widest uppercase">
        {label}
      </label>
      <div className="flex gap-2">
        <select
          value={dateValue.date()}
          onChange={(e) => onChange(dateValue.date(parseInt(e.target.value)))}
          className="p-2 rounded-md bg-slate-900 border border-cyan-500/30 text-cyan-50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 flex-1 transition-all"
        >
          {days.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={dateValue.month()}
          onChange={(e) => onChange(dateValue.month(parseInt(e.target.value)))}
          className="p-2 rounded-md bg-slate-900 border border-cyan-500/30 text-cyan-50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 flex-[2] transition-all"
        >
          {MONTHS_LIST.map((m, i) => (
            <option key={i} value={i}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={dateValue.year()}
          onChange={(e) => onChange(dateValue.year(parseInt(e.target.value)))}
          className="p-2 rounded-md bg-slate-900 border border-cyan-500/30 text-cyan-50 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 flex-1 transition-all"
        >
          {YEARS_LIST.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default function NewEventModal({
  isOpen,
  editingEventId,
  newEventData,
  setNewEventData,
  onClose,
  onSave,
}: NewEventModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[110] p-4 transition-all">
        <div className="bg-slate-900 border border-cyan-500/30 p-6 rounded-xl w-full max-w-sm shadow-[0_0_30px_rgba(34,211,238,0.1)]">
          <h3 className="text-xl font-bold text-cyan-400 mb-6 border-b border-cyan-500/20 pb-3 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
            {editingEventId ? '✏️ Editar Evento' : '➕ Nuevo Evento'}
          </h3>

          <DateSelectorRow
            label="Desde:"
            dateValue={newEventData.start}
            onChange={(d) => setNewEventData({ ...newEventData, start: d })}
          />

          <DateSelectorRow
            label="Hasta:"
            dateValue={newEventData.end}
            onChange={(d) => setNewEventData({ ...newEventData, end: d })}
          />

          <label className="block mt-6 mb-6">
            <span className="block text-xs font-bold text-cyan-500/80 mb-2 tracking-widest uppercase">
              Título:
            </span>
            <input
              type="text"
              value={newEventData.title}
              onChange={(e) =>
                setNewEventData({ ...newEventData, title: e.target.value })
              }
              placeholder="Ej. Vacaciones, Congreso..."
              className="w-full p-2.5 rounded-md bg-slate-950 border border-cyan-500/30 text-cyan-50 placeholder-slate-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all shadow-inner"
            />
          </label>

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-cyan-500/20">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800/50 text-slate-300 hover:text-cyan-50 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-md transition-all font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="px-5 py-2 bg-gradient-to-b from-amber-500 to-amber-700 hover:from-amber-400 hover:to-amber-600 text-white border border-amber-400/50 rounded-md transition-all font-bold shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:shadow-[0_0_20px_rgba(217,119,6,0.6)]"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
