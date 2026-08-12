import { useState } from 'react';
import dayjs from 'dayjs';
import ModalPortal from '../ModalPortal';

interface AnnualEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  createdAt: any;
}

interface EventsManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  annualEvents: AnnualEvent[];
  onOpenNewEvent: () => void;
  onEditEvent: (event: AnnualEvent) => void;
  onDeleteEvent: (event: AnnualEvent) => void;
}

export default function EventsManagerModal({
  isOpen,
  onClose,
  annualEvents,
  onOpenNewEvent,
  onEditEvent,
  onDeleteEvent,
}: EventsManagerModalProps) {
  // Movemos el estado de las pestañas aquí para desacoplarlo del AgendaMain
  const [eventsTab, setEventsTab] = useState<'upcoming' | 'past'>('upcoming');

  if (!isOpen) return null;

  return (
    <ModalPortal>
      {/* z-[100] asegura que esté por encima del sidebar (z-99) */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[100] p-4 transition-all">
        <div className="bg-slate-900 border border-cyan-500/30 rounded-xl w-full max-w-lg shadow-[0_0_30px_rgba(34,211,238,0.1)] flex flex-col max-h-[85vh] overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-cyan-500/20 flex justify-between items-center bg-slate-900/80">
            <h3 className="text-xl font-bold text-cyan-400 m-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]">
              📅 Eventos del Año
            </h3>
            <button
              onClick={onOpenNewEvent}
              className="px-4 py-2 bg-cyan-600/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/50 rounded-md transition-all font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)] hover:shadow-[0_0_15px_rgba(34,211,238,0.4)]"
            >
              + Nuevo Evento
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-cyan-500/20 bg-slate-950/80">
            <button
              onClick={() => setEventsTab('upcoming')}
              className={`flex-1 p-4 text-center transition-all font-medium tracking-wide ${
                eventsTab === 'upcoming'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900 shadow-[inset_0_-10px_20px_-10px_rgba(34,211,238,0.2)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              🚀 Próximos
            </button>
            <button
              onClick={() => setEventsTab('past')}
              className={`flex-1 p-4 text-center transition-all font-medium tracking-wide ${
                eventsTab === 'past'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-slate-900 shadow-[inset_0_-10px_20px_-10px_rgba(34,211,238,0.2)]'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              📜 Historial
            </button>
          </div>

          {/* Lista de Eventos */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {annualEvents
              .filter((e) => {
                const end = dayjs(e.endDate);
                return eventsTab === 'upcoming'
                  ? end.isAfter(dayjs().subtract(1, 'day'))
                  : end.isBefore(dayjs().subtract(1, 'day'));
              })
              .map((e) => (
                <div
                  key={e.id}
                  className="border border-cyan-500/20 rounded-lg p-4 bg-slate-800/40 flex justify-between items-center hover:border-cyan-500/50 transition-all group"
                >
                  <div>
                    <div className="font-bold text-slate-100 text-lg tracking-wide group-hover:text-cyan-50 transition-colors">
                      {e.title}
                    </div>
                    <div className="text-sm text-slate-400 mt-1 uppercase tracking-wider">
                      {dayjs(e.startDate).format('DD MMM')}{' '}
                      <span className="text-cyan-500/50 mx-1">/</span>{' '}
                      {dayjs(e.endDate).format('DD MMM YYYY')}
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEditEvent(e)}
                      title="Editar Evento"
                      className="p-2 bg-slate-800 hover:bg-amber-500/20 text-amber-500 rounded-md border border-slate-700 hover:border-amber-500/50 transition-all"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => onDeleteEvent(e)}
                      title="Eliminar y Liberar Horarios"
                      className="p-2 bg-slate-800 hover:bg-red-500/20 text-red-500 rounded-md border border-slate-700 hover:border-red-500/50 transition-all"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}

            {annualEvents.filter((e) => {
              const end = dayjs(e.endDate);
              return eventsTab === 'upcoming'
                ? end.isAfter(dayjs().subtract(1, 'day'))
                : end.isBefore(dayjs().subtract(1, 'day'));
            }).length === 0 && (
              <div className="text-center text-slate-500 py-10 font-medium">
                No hay eventos en esta categoría.
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-5 border-t border-cyan-500/20 bg-slate-900/80 text-right">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-800/80 text-slate-300 hover:text-cyan-50 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-md transition-all font-medium"
            >
              Cerrar Panel
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
