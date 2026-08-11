// src/components/agenda/PatientCardsModal.tsx
import React from 'react';

interface PatientCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  listType: 'needing' | 'waitlist' | 'paused';
  patients: any[];
  onSchedule?: (patient: any) => void;
  onArchive?: (id: string, name: string) => void;
  onReactivate?: (id: string, name: string) => void;
  onDeleteWaitlist?: (id: string) => void;
}

const PatientCardsModal: React.FC<PatientCardsModalProps> = ({
  isOpen,
  onClose,
  listType,
  patients,
  onSchedule,
  onArchive,
  onReactivate,
  onDeleteWaitlist,
}) => {
  if (!isOpen) return null;

  // Configuramos colores y textos dependiendo del tipo de lista
  const theme = {
    needing: {
      title: '⚠️ Pacientes que Requieren Cita',
      color: 'text-amber-400',
      borderColor: 'border-amber-500/30',
      cardHover: 'hover:border-amber-500/50',
      badgeBg: 'bg-amber-950/50 text-amber-300 border-amber-800',
    },
    waitlist: {
      title: '⏳ Lista de Espera',
      color: 'text-cyan-400',
      borderColor: 'border-cyan-500/30',
      cardHover: 'hover:border-cyan-500/50',
      badgeBg: 'bg-cyan-950/50 text-cyan-300 border-cyan-800',
    },
    paused: {
      title: '⏸️ Pacientes Pausados',
      color: 'text-slate-400',
      borderColor: 'border-slate-600/30',
      cardHover: 'hover:border-slate-500/50',
      badgeBg: 'bg-slate-800/50 text-slate-300 border-slate-600',
    },
  }[listType];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md transition-opacity">
      {/* Contenedor Principal del Modal */}
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-cyan-900/50 rounded-2xl w-full max-w-6xl max-h-full flex flex-col shadow-[0_0_40px_rgba(8,145,178,0.15)] relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Cabecera */}
        <div className="p-6 border-b border-cyan-900/30 flex justify-between items-center bg-slate-900/50">
          <div className="flex items-center gap-3">
            <h2
              className={`text-2xl font-bold tracking-wide m-0 ${theme.color}`}
            >
              {theme.title}
            </h2>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
              {patients.length} pacientes
            </span>
          </div>
          <button
            onClick={onClose}
            className="border-none bg-slate-800 w-10 h-10 rounded-xl flex items-center justify-center text-xl cursor-pointer text-slate-400 hover:bg-red-900/40 hover:text-red-400 hover:rotate-90 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.5)]"
          >
            ✕
          </button>
        </div>

        {/* Grid de Tarjetas */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent">
          {patients.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
              <span className="text-6xl opacity-20">📁</span>
              <p className="text-lg font-medium">
                No hay pacientes en esta lista.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {patients.map((p) => {
                // Adaptamos las variables porque en 'waitlist' la propiedad suele llamarse patientName en lugar de fullName
                const id = p.id;
                const name = p.fullName || p.patientName;
                const email = p.email || 'Sin correo registrado';
                const phone = p.contactNumber || p.phone || 'Sin teléfono';

                return (
                  <div
                    key={id}
                    className={`bg-slate-800/40 border border-slate-700/50 rounded-xl p-5 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 hover:shadow-lg ${theme.cardHover} relative overflow-hidden`}
                  >
                    {/* Acento lateral de Nexus */}
                    <div
                      className={`absolute left-0 top-0 bottom-0 w-1 ${
                        theme.badgeBg.split(' ')[0]
                      }`}
                    ></div>

                    <div className="mb-4 ml-2">
                      <h3 className="text-lg font-bold text-slate-200 mb-1 group-hover:text-white transition-colors line-clamp-1">
                        {name}
                      </h3>

                      {/* Metadatos (Ocultos en waitlist básico, pero listos si los tienes) */}
                      {listType !== 'waitlist' && (
                        <div className="text-xs text-slate-400 space-y-1 mt-3">
                          <p className="flex items-center gap-2">
                            <span className="opacity-70">📞</span> {phone}
                          </p>
                          <p className="flex items-center gap-2">
                            <span className="opacity-70">✉️</span> {email}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Botones de Acción */}
                    <div className="flex gap-2 ml-2 mt-2 pt-4 border-t border-slate-700/50">
                      {listType === 'needing' && (
                        <>
                          <button
                            onClick={() => onSchedule?.(p)}
                            className="flex-1 px-4 py-2 bg-gradient-to-b from-cyan-700 to-cyan-900 text-cyan-50 text-sm font-semibold rounded-lg border border-cyan-600 hover:brightness-110 transition-all cursor-pointer shadow-md"
                          >
                            📅 Agendar
                          </button>
                          <button
                            onClick={() => onArchive?.(id, name)}
                            className="px-4 py-2 bg-slate-800 text-slate-300 text-sm font-semibold rounded-lg border border-slate-600 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
                          >
                            Pausar
                          </button>
                        </>
                      )}

                      {listType === 'waitlist' && (
                        <button
                          onClick={() => onDeleteWaitlist?.(id)}
                          className="w-full px-4 py-2 bg-slate-800 text-red-400 text-sm font-semibold rounded-lg border border-red-900/50 hover:bg-red-950/50 hover:border-red-800 hover:text-red-300 transition-all cursor-pointer"
                        >
                          ❌ Eliminar de Espera
                        </button>
                      )}

                      {listType === 'paused' && (
                        <button
                          onClick={() => onReactivate?.(id, name)}
                          className="w-full px-4 py-2 bg-gradient-to-b from-emerald-800 to-emerald-950 text-emerald-100 text-sm font-semibold rounded-lg border border-emerald-700 hover:brightness-110 transition-all cursor-pointer shadow-md flex justify-center items-center gap-2"
                        >
                          <span>🔄</span> Reactivar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientCardsModal;
