import { AtlasIcons } from './AtlasDesignSystem';

interface AtlasVideoModalProps {
  videoUrl: string;
  onClose: () => void;
}

export default function AtlasVideoModal({
  videoUrl,
  onClose,
}: AtlasVideoModalProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200">
      <div className="relative w-full max-w-md md:max-w-2xl bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] overflow-hidden flex flex-col items-center">
        <div className="w-full bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <AtlasIcons.Zap className="text-cyan-400" />
            ENLACE NEURAL: ATLAS VANCE
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <AtlasIcons.Close />
          </button>
        </div>
        <div className="w-full bg-black aspect-square md:aspect-video relative flex justify-center items-center">
          <video
            src={videoUrl}
            autoPlay
            controls
            className="w-full h-full object-contain"
          />
        </div>
        <div className="w-full p-3 text-center bg-slate-900 border-t border-slate-700">
          <p className="text-cyan-500 text-[10px] font-mono tracking-widest uppercase animate-pulse">
            Transmisión Activa...
          </p>
        </div>
      </div>
    </div>
  );
}
