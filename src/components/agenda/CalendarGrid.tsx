import React from 'react';
import dayjs from 'dayjs';
import type { MonthlySlotMap } from '../../utils/agendaTypes';

interface CalendarGridProps {
  calendarDays: (Date | null)[];
  selectedDate: Date;
  currentMonthData: MonthlySlotMap | null;
  isMobile: boolean;
  onDayClick: (date: Date) => void;
}

const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

export default function CalendarGrid({
  calendarDays,
  selectedDate,
  currentMonthData,
  isMobile,
  onDayClick,
}: CalendarGridProps) {
  return (
    // Abismo Tecnológico: Fondo ultra oscuro con resplandor cian interno
    <div className="flex-1 p-2 md:p-4 overflow-y-auto custom-scrollbar bg-[#050810] shadow-[inset_0_0_60px_rgba(34,211,238,0.04)] rounded-xl border border-cyan-900/20">
      {/* Cabecera de días con cian residual */}
      <div className="grid grid-cols-7 text-center mb-4 text-cyan-800/80 font-bold uppercase tracking-widest text-[10px] md:text-sm">
        {DAYS_HEADER.map((d) => (
          <div key={d}>{isMobile ? d.charAt(0) : d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 auto-rows-[minmax(60px,1fr)] md:auto-rows-[minmax(100px,1fr)] gap-1 md:gap-2">
        {calendarDays.map((dateObj, i) => {
          if (!dateObj) return <div key={i} className="bg-transparent" />;

          const isToday = dateObj.toDateString() === new Date().toDateString();
          const isPastDay = dayjs(dateObj).isBefore(dayjs(), 'day');
          const isSelected =
            dateObj.toDateString() === selectedDate.toDateString();
          const dayStr = dateObj.getDate().toString().padStart(2, '0');

          let available = 0;
          let hasSlots = false;

          if (currentMonthData) {
            const slots = Object.entries(currentMonthData).filter(([k]) =>
              k.startsWith(`${dayStr}_`)
            );
            if (slots.length > 0) {
              hasSlots = true;
              available = slots.filter(([, v]) => {
                if (v.status !== 'available') return false;
                if (isPastDay) return false;
                if (isToday) {
                  const [h, m] = v.time.split(':').map(Number);
                  return dayjs().hour(h).minute(m).isAfter(dayjs());
                }
                return true;
              }).length;
            }
          }

          // DÍAS SIN CONSULTA (Futuros pero sin agenda configurada): Bronce tenue
          let bgClass =
            'bg-[#150e0a] border border-amber-900/20 hover:border-amber-900/50 transition-all shadow-[inset_0_0_15px_rgba(120,53,15,0.05)]';
          let statusText = '';
          let statusBadgeClass = '';
          let textClass =
            'text-amber-700/40 group-hover:text-amber-600/70 text-sm md:text-base';

          if (isPastDay) {
            // COBRE OXIDADO (Steampunk): Días pasados con tonos marrón/bronce más marcados
            bgClass =
              'bg-[#1a120d] border border-amber-900/30 shadow-[inset_0_0_15px_rgba(120,53,15,0.2)]';
            textClass = 'text-amber-600/60 text-sm md:text-base drop-shadow-sm';
          } else if (hasSlots) {
            if (available === 0) {
              // AGOTADO
              bgClass =
                'bg-[#050810] border border-cyan-500/20 shadow-[inset_0_0_15px_rgba(153,27,27,0.15)]';
              statusText = isMobile ? '0' : 'Agotado';
              statusBadgeClass =
                'bg-[#050810] text-red-500/70 border border-red-900/30';
              textClass =
                'text-slate-400 group-hover:text-cyan-200 text-sm md:text-base';
            } else {
              // DISPONIBLE
              bgClass =
                'bg-[#050810] border border-cyan-500/40 hover:border-cyan-400 hover:bg-cyan-950/30 transition-all shadow-[inset_0_0_10px_rgba(34,211,238,0.05)]';
              statusText = isMobile ? `${available}` : `${available} Libres`;
              statusBadgeClass =
                'bg-slate-900/90 text-cyan-400 border border-cyan-700/50 shadow-[0_0_10px_rgba(34,211,238,0.1)]';
              textClass =
                'text-slate-400 group-hover:text-cyan-200 text-sm md:text-base';
            }
          }

          if (isSelected) {
            // SELECCIÓN: Borde cian vibrante
            bgClass +=
              ' ring-1 ring-cyan-500/50 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.15)] z-10';
          }

          if (isToday) {
            // HOY: Sobrescribe el texto con el resplandor ámbar/bronce
            textClass =
              'text-amber-500 drop-shadow-[0_0_8px_rgba(217,119,6,0.8)] text-lg md:text-xl font-black';
          }

          return (
            <div
              key={i}
              onClick={() => onDayClick(dateObj)}
              className={`rounded-lg p-1.5 md:p-2 cursor-pointer flex flex-col justify-between relative overflow-hidden transition-all ${bgClass} group`}
            >
              <span
                className={`font-bold text-right tracking-tighter md:tracking-wider transition-colors ${textClass}`}
              >
                {dateObj.getDate()}
              </span>

              {statusText && (
                <div
                  className={`self-end text-[9px] md:text-[11px] font-mono tracking-widest px-2 py-0.5 rounded-sm backdrop-blur-md ${statusBadgeClass}`}
                >
                  {statusText}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
