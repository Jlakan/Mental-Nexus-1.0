// src/components/agenda/AgendaSidebar.tsx
import React from 'react';

export interface SidebarPatient {
  id: string;
  fullName: string;
  [key: string]: unknown;
}
export interface SidebarWaitlistEntry {
  id: string;
  patientName: string;
  [key: string]: unknown;
}

interface AgendaSidebarProps {
  onBack?: () => void;
  patientsNeedingAppt: SidebarPatient[];
  waitlist: SidebarWaitlistEntry[];
  isMobile: boolean;
  onOpenAgendaMenu: () => void;
  onOpenPatientsMenu: () => void;
}

const AgendaSidebar: React.FC<AgendaSidebarProps> = ({
  onBack,
  patientsNeedingAppt,
  waitlist,
  isMobile,
  onOpenAgendaMenu,
  onOpenPatientsMenu,
}) => {
  return (
    <div
      className={`h-full flex flex-col relative z-20 bg-slate-950 ${
        isMobile
          ? 'w-full'
          : 'w-[280px] border-r border-cyan-900/30 shadow-[4px_0_15px_rgba(0,0,0,0.5)]'
      }`}
    >
      {/* --- BOTONERA PRINCIPAL SÚPER LIMPIA --- */}
      <div className="flex-1 p-5 pb-24">
        <h3 className="mt-0 mb-6 text-cyan-500/80 font-bold tracking-widest uppercase text-xs">
          Panel de Control
        </h3>

        {/* BOTÓN RAÍZ 1: AGENDA */}
        <button
          onClick={onOpenAgendaMenu}
          className="w-full mb-5 p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 shadow-[0_4px_0_rgb(51,65,85)] active:translate-y-[4px] active:shadow-[none] hover:border-cyan-500/50 hover:shadow-[0_4px_0_rgb(8,145,178)] cursor-pointer group"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">
            📅
          </span>
          <span className="text-slate-300 font-bold tracking-wide group-hover:text-cyan-400 transition-colors">
            Menú de Agenda
          </span>
        </button>

        {/* BOTÓN RAÍZ 2: PACIENTES */}
        <button
          onClick={onOpenPatientsMenu}
          className="w-full p-4 rounded-xl flex flex-col items-center justify-center gap-2 transition-all bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 shadow-[0_4px_0_rgb(51,65,85)] active:translate-y-[4px] active:shadow-[none] hover:border-cyan-500/50 hover:shadow-[0_4px_0_rgb(8,145,178)] cursor-pointer group relative"
        >
          <span className="text-3xl group-hover:scale-110 transition-transform">
            👥
          </span>
          <span className="text-slate-300 font-bold tracking-wide group-hover:text-cyan-400 transition-colors">
            Gestión Pacientes
          </span>

          {/* Indicador visual si hay tareas pendientes */}
          {(patientsNeedingAppt.length > 0 || waitlist.length > 0) && (
            <span className="absolute top-3 right-3 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
          )}
        </button>
      </div>

      {/* BOTÓN VOLVER */}
      {onBack && (
        <button
          onClick={onBack}
          className="absolute bottom-6 left-6 z-50 flex items-center justify-center p-4 bg-slate-800 border border-cyan-700/50 hover:border-cyan-400 text-cyan-400 rounded-full cursor-pointer transition-all group"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
            className="w-6 h-6 group-hover:-translate-x-1 transition-transform"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
            />
          </svg>
        </button>
      )}
    </div>
  );
};

export default AgendaSidebar;
