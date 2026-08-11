// src/components/agenda/AgendaMenuModal.tsx
import React, { useState } from 'react';
import ModalPortal from '../ModalPortal';

interface AgendaMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenConfig: () => void;
  onOpenEvents: () => void;
  isMonthInitialized: boolean;
  onRegenerate: () => void;
  onInitialize: () => void;
  onSyncPatients: () => void;
}

export default function AgendaMenuModal({
  isOpen,
  onClose,
  onOpenConfig,
  onOpenEvents,
  isMonthInitialized,
  onRegenerate,
  onInitialize,
  onSyncPatients,
}: AgendaMenuModalProps) {
  const [hoveredInfo, setHoveredInfo] = useState<string | null>(null);

  if (!isOpen) return null;

  const menuItems = [
    {
      id: 'config',
      icon: '⚙️',
      title: 'Configurar Horarios',
      description:
        'Ajusta tus días laborales, horas de disponibilidad y el precio estándar por consulta.',
      action: () => {
        onClose();
        onOpenConfig();
      },
      color: 'slate',
    },
    {
      id: 'events',
      icon: '📅',
      title: 'Mis Eventos y Bloqueos',
      description:
        'Añade vacaciones, días festivos o bloqueos personales para evitar que se agenden citas en esas fechas.',
      action: () => {
        onClose();
        onOpenEvents();
      },
      color: 'indigo',
    },
    {
      id: 'spaces',
      icon: isMonthInitialized ? '🔄' : '⚡',
      title: isMonthInitialized ? 'Actualizar Espacios' : 'Inicializar Mes',
      description: isMonthInitialized
        ? 'Refresca la cuadrícula de horarios conservando las citas ya agendadas.'
        : 'Genera los espacios disponibles en la agenda para el mes seleccionado.',
      action: () => {
        onClose();
        isMonthInitialized ? onRegenerate() : onInitialize();
      },
      color: 'amber',
    },
    {
      id: 'audit',
      icon: '🛠️',
      title: 'Auditar Sistema',
      description:
        'Escanea y repara tu base de datos sincronizando expedientes, citas futuras y contactos.',
      action: () => {
        onClose();
        onSyncPatients();
      },
      color: 'emerald',
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
            <span>📅</span> Gestión de Agenda
          </h3>

          <div className="flex flex-col gap-3">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onMouseEnter={() => setHoveredInfo(item.description)}
                onMouseLeave={() => setHoveredInfo(null)}
                onClick={item.action}
                className={`w-full p-4 rounded-lg flex items-center gap-3 transition-all cursor-pointer text-left
                  bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 
                  hover:border-${item.color}-500/50 hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]
                  active:translate-y-[2px]`}
              >
                <span className="text-2xl">{item.icon}</span>
                <span className="font-bold text-slate-200">{item.title}</span>
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
