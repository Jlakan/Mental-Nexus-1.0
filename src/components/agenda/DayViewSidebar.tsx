//src/components/agenda/DayViewSidebar.tsx

import dayjs from 'dayjs';
import ModalPortal from '../ModalPortal';
import type {
  AgendaSlot,
  MonthlySlotMap,
  WorkConfig,
} from '../../utils/agendaTypes';

interface DayViewSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: Date;
  currentMonthData: MonthlySlotMap | null;
  workConfig: WorkConfig;
  isMobile: boolean;
  formData: any;
  onAddExtraSlot: () => void;
  onBlockDay: () => void;
  onQuickPay: (slotKey: string, currentStatus: string | undefined) => void;
  onMarkNoShow: (slotKey: string, patientId: string | undefined) => void;
  onReopenSlot: (slotKey: string) => void;
  onSmartReleaseCheck: (slotKey: string) => void;
  openForm: (slotKey: string, slot: AgendaSlot) => void;
  onDirectSchedule: (slotKey: string) => void; // Para agendar directo si ya hay un paciente seleccionado
}

export default function DayViewSidebar({
  isOpen,
  onClose,
  selectedDate,
  currentMonthData,
  isMobile,
  formData,
  onAddExtraSlot,
  onBlockDay,
  onQuickPay,
  onMarkNoShow,
  onReopenSlot,
  onSmartReleaseCheck,
  openForm,
  onDirectSchedule,
}: DayViewSidebarProps) {
  if (!isOpen) return null;

  const renderDaySlots = () => {
    if (!currentMonthData)
      return (
        <div className="text-cyan-500/50 text-center p-10 font-bold tracking-widest">
          CARGANDO MATRIZ...
        </div>
      );

    const dayStr = selectedDate.getDate().toString().padStart(2, '0');
    const daySlots = Object.entries(currentMonthData)
      .filter(([k]) => k.startsWith(`${dayStr}_`))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (daySlots.length === 0) {
      return (
        <div className="p-8 text-center text-slate-500 flex flex-col items-center justify-center h-full">
          <p className="mb-4 tracking-wider uppercase text-sm">
            No hay turnos configurados hoy.
          </p>
          <button
            onClick={onAddExtraSlot}
            className="px-5 py-2 bg-cyan-600/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 rounded-md transition-all font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)]"
          >
            + Forzar Turno Extra
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {daySlots.map(([key, slot]) => {
          const [dStr, tStr] = key.split('_');
          const sH = parseInt(tStr.substring(0, 2));
          const sM = parseInt(tStr.substring(2));
          const slotDateObj = dayjs(
            new Date(
              selectedDate.getFullYear(),
              selectedDate.getMonth(),
              parseInt(dStr),
              sH,
              sM
            )
          );
          const isPast = slotDateObj.isBefore(dayjs());

          return (
            <div
              key={key}
              className="flex items-center gap-4 p-3 border-b border-cyan-900/30 hover:bg-slate-800/30 transition-colors"
            >
              <div className="font-bold text-cyan-400/70 min-w-[50px] tracking-widest font-mono">
                {slot.time}
              </div>
              <div className="flex-1">
                {slot.status === 'available' ? (
                  <div
                    onClick={() => {
                      if (isPast)
                        return alert('Anomalía Temporal: Fecha en el pasado.');
                      if (formData.patientId && formData.patientName) {
                        onDirectSchedule(key);
                      } else {
                        openForm(key, slot);
                      }
                    }}
                    className={`p-3 rounded-lg text-center font-medium transition-all ${
                      isPast
                        ? 'bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed'
                        : 'bg-emerald-950/30 border border-emerald-500/40 text-emerald-400 hover:bg-emerald-900/50 hover:border-emerald-400 hover:shadow-[0_0_15px_rgba(16,185,129,0.2)] cursor-pointer'
                    }`}
                  >
                    {isPast
                      ? 'Tiempo Transcurrido'
                      : `+ Habilitado ${
                          formData.patientId && formData.patientName
                            ? `(Inyectar: ${formData.patientName})`
                            : ''
                        }`}
                  </div>
                ) : slot.status === 'blocked' ? (
                  <div
                    onClick={() => onReopenSlot(key)}
                    className="p-3 rounded-lg bg-red-950/30 border border-red-500/40 text-red-400 flex justify-between cursor-pointer hover:bg-red-900/50 hover:shadow-[0_0_15px_rgba(239,68,68,0.2)] transition-all"
                  >
                    <span className="font-medium">
                      🚫 Bloqueo: {slot.adminNotes}
                    </span>
                    <span className="opacity-70">✕ Quitar</span>
                  </div>
                ) : slot.status === 'cancelled' ? (
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 flex justify-between items-center">
                    <div>
                      <div className="line-through font-bold text-slate-500">
                        {slot.patientName}
                      </div>
                      <div
                        className={`text-xs italic mt-1 ${
                          slot.adminNotes?.includes('AUSENCIA')
                            ? 'text-amber-500'
                            : 'text-slate-500'
                        }`}
                      >
                        {slot.adminNotes}
                      </div>
                    </div>
                    <button
                      onClick={() => onReopenSlot(key)}
                      className="px-3 py-1.5 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/50 rounded-md text-xs font-bold transition-all"
                    >
                      ↻ Abrir espacio
                    </button>
                  </div>
                ) : (
                  // BOOKED
                  <div
                    onClick={() => openForm(key, slot)}
                    className={`p-3 rounded-lg relative cursor-pointer border-l-4 transition-all hover:brightness-110 ${
                      slot.paymentStatus === 'paid'
                        ? 'bg-slate-800 border-emerald-500 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
                        : 'bg-slate-800 border-cyan-500 shadow-[inset_0_0_20px_rgba(34,211,238,0.05)]'
                    }`}
                  >
                    <div className="font-bold text-slate-100 pr-16">
                      {slot.patientName}
                    </div>
                    <div className="text-xs text-slate-400 mt-1 truncate max-w-[80%]">
                      {slot.adminNotes || 'Sin notas del sistema'}
                    </div>
                    <div className="text-sm font-bold mt-2 text-cyan-400">
                      ${slot.price}
                    </div>

                    {/* Botón PAGO */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onQuickPay(key, slot.paymentStatus);
                      }}
                      className={`absolute right-11 top-3 w-7 h-7 rounded-full flex justify-center items-center font-bold text-xs border transition-all z-10 hover:scale-110 ${
                        slot.paymentStatus === 'paid'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                          : 'bg-slate-900 text-slate-500 border-slate-600 hover:text-cyan-400 hover:border-cyan-500'
                      }`}
                    >
                      $
                    </div>

                    {/* Botón NO SHOW */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkNoShow(key, slot.patientId);
                      }}
                      className="absolute right-20 top-3 w-7 h-7 rounded-full flex justify-center items-center bg-red-950/50 text-red-400 border border-red-500/50 hover:bg-red-900 hover:text-white transition-all z-10"
                      title="Marcar No-Show"
                    >
                      🚫
                    </button>

                    {/* Botón CANCELAR */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSmartReleaseCheck(key);
                      }}
                      className="absolute right-3 top-3 w-7 h-7 flex justify-center items-center text-slate-500 hover:text-red-400 transition-colors z-10"
                      title="Liberar Slot"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex justify-end z-[100]">
        <div
          className={`h-full bg-slate-950 border-l border-cyan-500/30 flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.5)] transition-all ${
            isMobile ? 'w-full' : 'w-[450px]'
          }`}
        >
          <div className="p-5 border-b border-cyan-900/50 bg-slate-900/50 flex justify-between items-start">
            <div>
              <h2 className="m-0 text-2xl font-bold text-cyan-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] capitalize">
                {selectedDate.toLocaleDateString('es-ES', {
                  weekday: 'long',
                  day: 'numeric',
                })}
              </h2>
              <div className="flex gap-3 mt-3">
                <button
                  onClick={onBlockDay}
                  className="text-xs px-3 py-1.5 bg-red-950/30 text-red-400 border border-red-500/30 rounded-md font-bold uppercase tracking-wider hover:bg-red-900/50 transition-all"
                >
                  🚫 Bloquear
                </button>
                <button
                  onClick={onAddExtraSlot}
                  className="text-xs px-3 py-1.5 bg-cyan-900/30 text-cyan-400 border border-cyan-500/30 rounded-md font-bold uppercase tracking-wider hover:bg-cyan-800/50 transition-all"
                >
                  ➕ Slot Manual
                </button>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-cyan-400 text-2xl transition-colors"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2">{renderDaySlots()}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
