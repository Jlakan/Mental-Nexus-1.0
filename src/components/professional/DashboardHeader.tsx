// src/components/professional/DashboardHeader.tsx
import React from 'react';

// Exportamos la interfaz para que el Dashboard la pueda usar
export interface ProfessionalData {
  fullName?: string;
  nexusBalance?: number;
  professionalCode?: string;
  professionType?: string;
  isAuthorized?: boolean;
  notas?: boolean;
  [key: string]: any; // Para permitir otras propiedades que vengan de Firebase
}

interface DashboardHeaderProps {
  activeView: string;
  profData: ProfessionalData | null;
  onOpenSidebar: () => void;
}

export default function DashboardHeader({
  activeView,
  profData,
  onOpenSidebar,
}: DashboardHeaderProps) {
  return (
    <header className="p-6 border-b border-slate-800 bg-nexus-dark/95 backdrop-blur flex items-center justify-between shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onOpenSidebar}
          aria-label="Abrir menú"
          className="md:hidden p-2 text-white bg-slate-800 rounded-lg hover:bg-nexus-cyan hover:text-black transition-colors"
        >
          ☰
        </button>
        <div>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight leading-none">
            {activeView === 'dashboard' && 'Panel de Control'}
            {activeView === 'patients_manage' && 'Gestión de Pacientes'}
            {activeView === 'agenda' && 'Agenda'}
            {activeView === 'team' && 'Equipo Clínico'}
            {activeView === 'patient_detail' && 'Expediente'}
            {activeView === 'analytics' && 'Analítica'}
            <span className="text-nexus-cyan hidden md:inline"> .PRO</span>
          </h1>
          <p className="text-nexus-muted text-xs md:text-sm hidden md:block mt-1">
            Dr(a). {profData?.fullName || 'Usuario'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="bg-emerald-900/20 border border-emerald-500/50 rounded-lg px-3 py-1 flex items-center gap-2">
          {/* Imagen fija del logo Nexus */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Nexus.jpg?alt=media&token=eba61fcb-a5a1-4b4f-97a4-1344ff2f8d78"
            alt="Logo Nexus"
            className="w-5 h-5 md:w-6 md:h-6 rounded object-cover shadow-sm"
          />
          <span className="text-emerald-400 font-bold text-sm md:text-lg">
            {profData?.nexusBalance || 0}
          </span>
        </div>
      </div>
    </header>
  );
}
