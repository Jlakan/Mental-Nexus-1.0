//src/components/agenda/ConflictModal.tsx

import dayjs from 'dayjs';
import ModalPortal from '../ModalPortal';
import type { AgendaSlot } from '../../utils/agendaTypes';

// Exportamos la interfaz para que AgendaMain la pueda seguir usando si es necesario
export interface ConflictItem {
  slotKey: string;
  date: Date;
  slotData: AgendaSlot;
  monthDocId: string;
}

interface ConflictModalProps {
  isOpen: boolean;
  conflictList: ConflictItem[];
  onResolveWaitlist: (conflict: ConflictItem) => void;
  onKeep: (conflict: ConflictItem) => void;
  onCancel: () => void;
  onFinalize: () => void;
}

export default function ConflictModal({
  isOpen,
  conflictList,
  onResolveWaitlist,
  onKeep,
  onCancel,
  onFinalize,
}: ConflictModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[2000] p-4">
        <div className="bg-slate-900 p-6 rounded-xl w-full max-w-lg shadow-[0_0_30px_rgba(220,38,38,0.15)] border border-red-900/50">
          <h3 className="m-0 text-red-400 font-bold text-xl flex items-center gap-2 mb-4">
            <span>⚠️</span> Conflicto Detectado
          </h3>

          <div className="max-h-[300px] overflow-y-auto bg-slate-950/50 border border-slate-800 rounded-lg p-3 mb-5 space-y-2 custom-scrollbar">
            {conflictList.map((c) => (
              <div
                key={c.slotKey}
                className="bg-slate-800 p-3 rounded-md border border-slate-700 flex justify-between items-center transition-all hover:border-slate-600"
              >
                <div>
                  <div className="font-bold text-slate-200">
                    {c.slotData.patientName}
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {dayjs(c.date).format('DD MMM')} -{' '}
                    <span className="text-cyan-400">{c.slotData.time}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => onResolveWaitlist(c)}
                    className="bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700/50 rounded flex items-center gap-1 px-3 py-1.5 text-xs cursor-pointer transition-colors active:scale-95"
                  >
                    <span>⏳</span> Espera
                  </button>
                  <button
                    onClick={() => onKeep(c)}
                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 border border-slate-600 rounded px-3 py-1.5 text-xs cursor-pointer transition-colors active:scale-95"
                  >
                    Mantener
                  </button>
                </div>
              </div>
            ))}
            {conflictList.length === 0 && (
              <div className="text-center text-slate-500 py-4 text-sm">
                Todos los conflictos resueltos.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent text-slate-400 hover:text-slate-200 transition-colors cursor-pointer text-sm font-medium"
            >
              Cancelar
            </button>
            <button
              onClick={onFinalize}
              className="bg-red-700 hover:bg-red-600 text-white px-5 py-2 border-none rounded shadow-[0_4px_0_#7f1d1d] active:shadow-none active:translate-y-[4px] cursor-pointer font-bold text-sm transition-all"
            >
              Finalizar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
