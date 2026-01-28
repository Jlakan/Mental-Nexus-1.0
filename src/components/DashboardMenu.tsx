// src/components/DashboardMenu.tsx
import React from 'react';

interface Props {
  activeView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
  // Nuevas props para control móvil
  isOpen: boolean;
  onClose: () => void;
}

export default function DashboardMenu({ activeView, onNavigate, onLogout, isOpen, onClose }: Props) {
  
  const handleNav = (view: string) => {
    onNavigate(view);
    onClose(); // Cerrar menú automáticamente al hacer clic en móvil
  };

  const getButtonClass = (menuView: string) => {
    const isActive = activeView === menuView || (menuView === 'patients_manage' && activeView === 'patient_detail');
    
    let classes = "flex items-center gap-3 w-full px-5 py-4 border-l-4 transition-all duration-200 text-sm tracking-wider uppercase font-bold mb-1 ";
    
    if (isActive) {
      classes += "border-nexus-cyan bg-nexus-cyan/10 text-white shadow-[0_0_15px_rgba(0,229,255,0.2)]";
    } else {
      classes += "border-transparent text-slate-500 hover:text-nexus-cyan hover:bg-slate-800/50";
    }
    return classes;
  };

  return (
    <>
      {/* 1. OVERLAY (Fondo oscuro solo en móvil cuando el menú está abierto) */}
      <div 
        className={`fixed inset-0 bg-black/60 z-30 transition-opacity duration-300 md:hidden ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* 2. SIDEBAR (El menú en sí) */}
      <div className={`
        fixed inset-y-0 left-0 z-40 w-72 bg-nexus-panel border-r border-slate-800 flex flex-col shadow-2xl transition-transform duration-300 ease-in-out
        md:relative md:translate-x-0 
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        
        {/* HEADER LOGO */}
        <div className="p-6 border-b border-slate-800 mb-4 bg-nexus-dark/50 flex justify-between items-center">
          <div>
            <h2 className="m-0 text-transparent bg-clip-text bg-gradient-to-r from-nexus-cyan to-nexus-teal font-black text-2xl tracking-tighter drop-shadow-sm">
              NEXUS <span className="text-white text-base font-light">PRO</span>
            </h2>
            <span className="text-xs text-nexus-muted tracking-[0.2em] uppercase">Panel Clínico</span>
          </div>
          {/* Botón cerrar solo móvil */}
          <button onClick={onClose} className="md:hidden text-slate-500 hover:text-white text-2xl">
            ✕
          </button>
        </div>

        {/* NAVEGACIÓN */}
        <nav className="flex-1 overflow-y-auto py-2">
          <button onClick={() => handleNav('dashboard')} className={getButtonClass('dashboard')}>
            <span className="text-xl">📊</span> Inicio
          </button>

          <button onClick={() => handleNav('patients_manage')} className={getButtonClass('patients_manage')}>
            <span className="text-xl">👥</span> Pacientes
          </button>

          <button onClick={() => handleNav('agenda')} className={getButtonClass('agenda')}>
            <span className="text-xl">📅</span> Agenda
          </button>

          <button onClick={() => handleNav('team')} className={getButtonClass('team')}>
            <span className="text-xl">🥼</span> Equipo
          </button>
        </nav>

        {/* FOOTER / LOGOUT */}
        <div className="p-4 border-t border-slate-800 bg-nexus-dark/30">
          <button
            onClick={onLogout}
            className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg border border-red-900/50 text-red-400 hover:bg-red-900/20 hover:text-red-200 hover:border-red-500 transition-all text-xs font-bold uppercase tracking-widest"
          >
            <span>🔌</span> Desconectar
          </button>
        </div>
      </div>
    </>
  );
}