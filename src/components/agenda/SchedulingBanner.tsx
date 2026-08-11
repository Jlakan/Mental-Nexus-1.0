// src/components/agenda/SchedulingBanner.tsx
import React from 'react';

interface SchedulingBannerProps {
  isVisible: boolean;
  patientName: string;
  isMobile: boolean;
  onCancel: () => void;
}

export default function SchedulingBanner({
  isVisible,
  patientName,
  isMobile,
  onCancel,
}: SchedulingBannerProps) {
  if (!isVisible) return null;

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#323232]/95 backdrop-blur-sm text-white px-6 py-3 rounded-full flex items-center gap-4 shadow-[0_4px_15px_rgba(0,0,0,0.3)] z-[90] border border-white/10">
      <span className={isMobile ? 'text-xs' : 'text-sm'}>
        Agendando a: <b className="text-cyan-400">{patientName}</b>. Haz clic en
        un espacio libre.
      </span>
      <button
        onClick={onCancel}
        className="bg-red-500 hover:bg-red-600 text-white border-none rounded-full px-4 py-1.5 cursor-pointer font-bold text-xs transition-colors shadow-md active:scale-95"
      >
        Cancelar ✕
      </button>
    </div>
  );
}
