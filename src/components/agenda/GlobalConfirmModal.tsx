//src/components/agenda/GlobalConfirmModal.tsx
import React from 'react';
import ModalPortal from '../ModalPortal';

interface GlobalConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function GlobalConfirmModal({
  isOpen,
  title,
  message,
  type = 'default',
  onConfirm,
  onCancel,
}: GlobalConfirmModalProps) {
  if (!isOpen) return null;

  // Lógica de estilos para variante de advertencia destructiva vs confirmación estándar
  const confirmButtonClass =
    type === 'danger'
      ? 'bg-red-900/80 hover:bg-red-800 text-orange-100 border border-red-500/50'
      : 'bg-cyan-900/80 hover:bg-cyan-800 text-cyan-100 border border-cyan-500/50';

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[4000]">
        <div className="bg-slate-900 p-6 rounded-lg w-full max-w-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-slate-700/50">
          <h3
            className={`text-lg font-bold mb-2 ${
              type === 'danger' ? 'text-red-400' : 'text-cyan-400'
            }`}
          >
            {title}
          </h3>
          <p className="text-slate-300 text-sm mb-6 whitespace-pre-wrap">
            {message}
          </p>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-transparent text-slate-400 hover:text-slate-200 border border-transparent hover:border-slate-700 rounded-md transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-md font-medium transition-all shadow-md active:scale-95 active:translate-y-[2px] text-sm ${confirmButtonClass}`}
            >
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
