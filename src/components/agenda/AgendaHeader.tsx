//src/components/agenda/AgendaHeader.tsx
//Es el encabezado que permite iterar entre meses del año en la agenda
import React from 'react';

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

interface AgendaHeaderProps {
  isMobile: boolean;
  onToggleSidebar: () => void;
  selectedDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  isMonthInitialized: boolean;
  monthGoal: string;
  setMonthGoal: (val: string) => void;
  isEditingGoal: boolean;
  setIsEditingGoal: (val: boolean) => void;
  onSaveGoal: () => void;
}

export default function AgendaHeader({
  isMobile,
  onToggleSidebar,
  selectedDate,
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  onYearChange,
  isMonthInitialized,
  monthGoal,
  setMonthGoal,
  isEditingGoal,
  setIsEditingGoal,
  onSaveGoal,
}: AgendaHeaderProps) {
  return (
    <div className="flex flex-col border-b border-cyan-900/30 bg-[#050810] shadow-[0_5px_20px_rgba(0,0,0,0.5)] z-20 relative">
      {/* Barra Superior: Título y Meta */}
      <div className="flex items-center gap-3 p-3 md:px-6 bg-gradient-to-r from-slate-900/80 to-[#050810] border-b border-cyan-900/10">
        {isMobile && (
          <button
            onClick={onToggleSidebar}
            className="text-cyan-500 text-2xl p-1 hover:text-cyan-300 transition-colors drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]"
          >
            ☰
          </button>
        )}

        <span className="font-bold text-[10px] md:text-xs bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 px-2 py-1.5 rounded tracking-widest uppercase shadow-[inset_0_0_10px_rgba(34,211,238,0.1)]">
          {MONTHS_LIST[selectedDate.getMonth()]} - META:
        </span>

        {isMonthInitialized ? (
          isEditingGoal ? (
            <input
              autoFocus
              value={monthGoal}
              onChange={(e) => setMonthGoal(e.target.value)}
              onBlur={onSaveGoal}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSaveGoal();
              }}
              className="flex-1 bg-[#0a0f18] text-amber-400 border border-amber-500/50 rounded px-3 py-1 text-sm outline-none focus:ring-1 focus:ring-amber-500 focus:shadow-[0_0_10px_rgba(217,119,6,0.3)] transition-all font-mono"
              placeholder="Establecer meta..."
            />
          ) : (
            <div
              onClick={() => setIsEditingGoal(true)}
              className="flex-1 cursor-pointer border-b border-dashed border-cyan-700/50 pb-0.5 text-slate-300 hover:text-amber-400 transition-colors text-sm truncate font-mono"
              title="Click para editar"
            >
              {monthGoal || (
                <span className="text-slate-600 italic">
                  Establecer meta...
                </span>
              )}{' '}
              <span className="text-cyan-700 ml-2">✎</span>
            </div>
          )
        ) : (
          <div className="flex-1 text-cyan-800/50 italic text-sm font-mono tracking-wider">
            (Requiere Inicializar)
          </div>
        )}
      </div>

      {/* Barra Inferior: Navegación del Calendario */}
      <div className="flex justify-center items-center gap-4 p-3 bg-[#020408]">
        <button
          onClick={onPrevMonth}
          className="text-cyan-800 hover:text-cyan-400 text-xl md:text-2xl transition-all hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] hover:-translate-x-1"
        >
          ◀
        </button>

        <div className="flex gap-2 items-center">
          <select
            value={selectedDate.getMonth()}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="bg-[#0a0f18] text-cyan-300 border border-cyan-900/50 rounded-md px-2 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold uppercase tracking-widest outline-none hover:border-cyan-500/50 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all cursor-pointer"
          >
            {MONTHS_LIST.map((m, i) => (
              <option key={i} value={i} className="bg-slate-900">
                {m}
              </option>
            ))}
          </select>

          <select
            value={selectedDate.getFullYear()}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="bg-[#0a0f18] text-cyan-300 border border-cyan-900/50 rounded-md px-2 py-1.5 md:px-4 md:py-2 text-xs md:text-sm font-bold tracking-widest outline-none hover:border-cyan-500/50 focus:border-cyan-400 focus:shadow-[0_0_10px_rgba(34,211,238,0.2)] transition-all cursor-pointer"
          >
            {YEARS_LIST.map((y) => (
              <option key={y} value={y} className="bg-slate-900">
                {y}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={onNextMonth}
          className="text-cyan-800 hover:text-cyan-400 text-xl md:text-2xl transition-all hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] hover:translate-x-1"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
