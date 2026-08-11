interface MissionOverlayProps {
  imageUrl: string;
  onClose: () => void;
}

export default function MissionOverlay({
  imageUrl,
  onClose,
}: MissionOverlayProps) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in zoom-in duration-300 cursor-pointer"
      onClick={onClose}
    >
      <img
        src={imageUrl}
        alt="Arte de Misión"
        className="w-full h-full p-4 md:p-12 object-contain drop-shadow-[0_0_50px_rgba(6,182,212,0.4)] transition-transform transform scale-100"
      />
      <div className="absolute bottom-8 text-cyan-500 text-xs md:text-sm font-mono tracking-widest animate-pulse bg-slate-900/50 px-4 py-2 rounded-full border border-cyan-500/30">
        [ CLIC PARA CONTINUAR ]
      </div>
    </div>
  );
}
