// src/components/agenda/PatientsMenuModal.tsx
import { useState } from 'react';
import ModalPortal from '../ModalPortal';

interface PatientsMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDirectory: () => void;
  onOpenNeeding: () => void;
  onOpenWaitlist: () => void;
  onOpenPaused: () => void;
  counts: { needing: number; waitlist: number; paused: number };
}

export default function PatientsMenuModal({
  isOpen,
  onClose,
  onOpenDirectory,
  onOpenNeeding,
  onOpenWaitlist,
  onOpenPaused,
  counts,
}: PatientsMenuModalProps) {
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'directory',
      icon: '👥',
      title: 'Directorio General',
      count: null,
      description:
        'Busca, edita la información de contacto y registra nuevos pacientes en tu base de datos.',
      action: () => {
        onClose();
        onOpenDirectory();
      },
      color: 'cyan',
    },
    {
      id: 'needing',
      icon: '⚠️',
      title: 'Sin Cita Programada',
      count: counts.needing,
      description:
        'Pacientes activos que no tienen una próxima sesión agendada en el calendario.',
      action: () => {
        onClose();
        onOpenNeeding();
      },
      color: 'amber',
    },
    {
      id: 'waitlist',
      icon: '⏳',
      title: 'Lista de Espera',
      count: counts.waitlist,
      description:
        'Pacientes que están esperando que se libere un espacio o haya una cancelación.',
      action: () => {
        onClose();
        onOpenWaitlist();
      },
      color: 'cyan',
    },
    {
      id: 'paused',
      icon: '⏸️',
      title: 'Pacientes Pausados',
      count: counts.paused,
      description:
        'Historial de pacientes inactivos o dados de alta temporalmente.',
      action: () => {
        onClose();
        onOpenPaused();
      },
      color: 'slate',
    },
  ];

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[5000] p-4"
        onClick={onClose}
      >
        <div
          className="bg-slate-900 p-6 rounded-xl w-full max-w-md shadow-[0_0_30px_rgba(34,211,238,0.15)] border border-slate-700/50"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mt-0 mb-6 text-cyan-400 font-bold flex items-center gap-2 text-lg border-b border-cyan-900/50 pb-3">
            <span>👥</span> Gestión de Pacientes
          </h3>

          <div className="flex flex-col gap-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onMouseEnter={() => setHoveredInfo(item.description)}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={item.action}
                className={`w-full p-4 rounded-lg flex items-center justify-between transition-all cursor-pointer
                  bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 
                  hover:border-${item.color}-500/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]
                  active:translate-y-[2px]`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{item.icon}</span>
                  <span className="font-bold text-slate-200">{item.title}</span>
                </div>
                {item.count !== null && item.count > 0 && (
                  <span
                    className={`bg-${item.color}-500/20 text-${item.color}-300 border border-${item.color}-500/50 rounded-full px-3 py-1 text-xs font-mono font-bold shadow-inner`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Panel de Descripción (Hover) */}
          <div className="mt-6 h-20 bg-slate-950/50 rounded-lg border border-slate-800 p-3 flex items-center justify-center text-center transition-all">
            <p
              className={`text-sm m-0 transition-opacity duration-300 ${
                hoveredInfo
                  ? 'text-cyan-300 opacity-100'
                  : 'text-slate-500 opacity-50'
              }`}
            >
              {hoveredInfo ||
                'Pasa el cursor sobre una opción para ver su descripción.'}
            </p>
          </div>

          <div className="mt-6 text-right">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-800 text-slate-300 hover:text-white rounded-md text-sm border border-slate-700 transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
