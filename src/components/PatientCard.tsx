// src/components/PatientCard.tsx
import React, { useState, useRef, useEffect } from 'react';

interface PatientCardProps {
  patient: any;
  professionalId: string;
  onOpenPatient: (patient: any) => void;
  onUnlink: (patient: any) => void;
  onRegisterAttendance: (patient: any) => void;
}

export default function PatientCard({ 
  patient, 
  professionalId, 
  onOpenPatient, 
  onUnlink, 
  onRegisterAttendance 
}: PatientCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cerrar el menú al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Datos extraídos para limpiar la vista
  const level = patient.gamificationProfile?.level || 1;
  const nexusBalance = patient.gamificationProfile?.wallet?.nexus || 0;
  const tags = patient.clinicalIndicators?.[professionalId] || [];
  const nextApptStr = patient.careTeam?.[professionalId]?.nextAppointment;
  
  let isFutureAppt = false;
  let apptText = "Sin cita programada";
  
  if (nextApptStr) {
    const apptDate = new Date(nextApptStr);
    isFutureAppt = apptDate > new Date();
    apptText = `${isFutureAppt ? 'Próxima:' : 'Última:'} ${apptDate.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`;
  }

  return (
    <div className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-nexus-cyan hover:shadow-[0_0_15px_rgba(34,211,238,0.15)] transition-all relative flex flex-col h-full group">
      
      {/* CABECERA: Avatar, Nombre y Menú */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-slate-300 border-2 border-slate-600 group-hover:border-nexus-cyan transition-colors">
            {patient.fullName.charAt(0)}
          </div>
          <div>
            <h3 className="font-bold text-white leading-tight group-hover:text-nexus-cyan transition-colors line-clamp-1">
              {patient.fullName}
            </h3>
            <p className="text-xs text-slate-400 line-clamp-1">{patient.email}</p>
          </div>
        </div>

        {/* Menú de 3 puntos */}
        <div className="relative" ref={menuRef}>
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-700 transition-colors"
          >
            ⋮
          </button>
          
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-10 overflow-hidden">
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onRegisterAttendance(patient); }}
                className="w-full text-left px-4 py-3 text-xs text-slate-200 hover:bg-slate-800 flex items-center gap-2"
              >
                <span>✅</span> Registrar Asistencia
              </button>
              <div className="h-px bg-slate-700 w-full"></div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMenuOpen(false); onUnlink(patient); }}
                className="w-full text-left px-4 py-3 text-xs text-red-400 hover:bg-red-900/30 flex items-center gap-2 font-bold"
              >
                <span>⚠️</span> Desvincular
              </button>
            </div>
          )}
        </div>
      </div>

      {/* GAMIFICACIÓN: Nivel y Nexus */}
      <div className="flex gap-2 mb-4">
        <span className="bg-purple-900/30 text-purple-300 border border-purple-500/30 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase">
          Nivel {level}
        </span>
        <span className="bg-blue-900/30 text-blue-300 border border-blue-500/30 px-2 py-1 rounded text-[10px] font-bold tracking-wider uppercase flex items-center gap-1">
          💎 {nexusBalance}
        </span>
      </div>

      {/* TAGS CLÍNICOS (Máximo 3 para no romper el diseño) */}
      <div className="flex-1">
        <div className="flex flex-wrap gap-1.5 mb-4">
          {tags.length === 0 && <span className="text-[10px] text-slate-500 italic">Sin etiquetas clínicas</span>}
          {tags.slice(0, 3).map((tag: string, i: number) => (
            <span key={i} className="bg-yellow-900/20 border border-yellow-600/30 text-yellow-200 px-2 py-0.5 rounded-full text-[10px]">
              {tag}
            </span>
          ))}
          {tags.length > 3 && (
            <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full text-[10px]">
              +{tags.length - 3}
            </span>
          )}
        </div>
      </div>

      {/* PIE DE TARJETA: Cita y Botón de Expediente */}
      <div className="mt-auto pt-4 border-t border-slate-700 flex justify-between items-center">
        <div className={`text-[10px] font-bold ${isFutureAppt ? 'text-blue-400' : 'text-slate-500'}`}>
          📅 {apptText}
        </div>
        
        <button
          onClick={() => onOpenPatient(patient)}
          className="bg-slate-700 hover:bg-nexus-cyan hover:text-black text-white px-4 py-1.5 rounded-full text-xs font-bold transition-colors"
        >
          Expediente →
        </button>
      </div>

    </div>
  );
}