// src/components/patient/ui/ToastNotification.tsx
import { AtlasIcons } from '../AtlasDesignSystem';

interface ToastNotificationProps {
  message: string | null;
}

export default function ToastNotification({ message }: ToastNotificationProps) {
  if (!message) return null;

  return (
    <div className="fixed top-20 right-4 md:right-10 z-[9999] bg-slate-900/95 border border-cyan-500 text-cyan-400 px-5 py-3 rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-3 animate-in slide-in-from-right fade-in duration-300">
      <div className="bg-cyan-900/50 p-1.5 rounded-full">
        <AtlasIcons.Zap size={16} className="animate-pulse" />
      </div>
      <span className="font-bold text-sm tracking-wide uppercase">
        {message}
      </span>
    </div>
  );
}
