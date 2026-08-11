//src/components/agenda/WaitlistSelectorModal.tsx
import React from 'react';
import ModalPortal from '../ModalPortal';

// Saneamiento del tipo 'any' para los elementos de la lista de espera
interface WaitlistEntry {
  id: string;
  patientName: string;
  notes?: string;
  patientId?: string;
  patientExternalPhone?: string;
}

interface WaitlistSelectorModalProps {
  isOpen: boolean;
  waitlist: WaitlistEntry[];
  onAssign: (waitlistItem: WaitlistEntry) => void;
  onCancel: () => void;
}

export default function WaitlistSelectorModal({
  isOpen,
  waitlist,
  onAssign,
  onCancel,
}: WaitlistSelectorModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[4000] p-4">
        <div className="bg-slate-900 p-6 rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-slate-700/50 custom-scrollbar">
          <h3 className="m-0 text-cyan-400 font-bold text-lg mb-4 flex items-center gap-2 border-b border-cyan-900/50 pb-3">
            <span>♻️</span> Reasignar Espacio
          </h3>

          {waitlist.length === 0 ? (
            <div className="text-center text-slate-500 py-6 text-sm italic">
              No hay pacientes en la lista de espera.
            </div>
          ) : (
            <div className="space-y-2 mb-5">
              {waitlist.map((w) => (
                <div
                  key={w.id}
                  onClick={() => onAssign(w)}
                  className="p-3 bg-slate-800/80 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/50 rounded-lg cursor-pointer transition-all group"
                >
                  <div className="font-bold text-slate-200 group-hover:text-cyan-300 transition-colors">
                    {w.patientName}
                  </div>
                  {w.notes && (
                    <div className="text-xs text-slate-400 mt-1 line-clamp-2">
                      {w.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-slate-800">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 rounded-md transition-colors text-sm cursor-pointer"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
