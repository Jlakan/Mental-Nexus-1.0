// src/components/patient/PatientHeader.tsx
import { useState } from 'react';
import { AtlasIcons } from './AtlasDesignSystem';

interface PatientHeaderProps {
  playerName: string;
  playerTitle: string;
  level: number;
  xpProgress: number;
  gold: number;
  nexus: number;
  avatarImage: string;
  showVideo: boolean;
  videoUrl: string;
  onAvatarClick: () => void;
  onVideoEnd: () => void;
  onSignOut: () => void;
}

type CurrencyType = 'gold' | 'nexus' | null;

export default function PatientHeader({
  playerName,
  playerTitle,
  level,
  xpProgress,
  gold,
  nexus,
  avatarImage,
  showVideo,
  videoUrl,
  onAvatarClick,
  onVideoEnd,
  onSignOut,
}: PatientHeaderProps) {
  const [zoomedCurrency, setZoomedCurrency] = useState<CurrencyType>(null);

  const handleCloseZoom = () => setZoomedCurrency(null);

  return (
    <>
      {/* MODAL DE VISUALIZACIÓN DE MONEDAS */}
      {zoomedCurrency && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in zoom-in duration-200"
          onClick={handleCloseZoom}
        >
          <div
            className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.4)] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full bg-slate-800 p-3 border-b border-slate-700 flex justify-between items-center">
              <h3 className="font-bold text-white flex items-center gap-2 uppercase text-sm font-mono tracking-widest">
                <AtlasIcons.Zap size={16} className="text-cyan-400" />
                {zoomedCurrency === 'gold' ? 'ORO' : 'NEXUS'}
              </h3>
              <button
                onClick={handleCloseZoom}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <AtlasIcons.Close size={20} />
              </button>
            </div>
            <div className="w-full bg-slate-950 flex justify-center items-center p-8">
              {zoomedCurrency === 'gold' && (
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Oro.jpg?alt=media&token=63d27131-c081-44e7-903f-6877389af694"
                  alt="Oro"
                  className="w-64 h-64 rounded-xl object-cover shadow-[0_0_60px_rgba(234,179,8,0.4)] border border-yellow-700"
                />
              )}
              {zoomedCurrency === 'nexus' && (
                <img
                  src="https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Nexus.jpg?alt=media&token=eba61fcb-a5a1-4b4f-97a4-1344ff2f8d78"
                  alt="Nexus"
                  className="w-64 h-64 rounded-xl object-cover shadow-[0_0_60px_rgba(16,185,129,0.4)] border border-emerald-500"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* CABECERA PRINCIPAL */}
      <section className="relative z-30 mb-8 p-4 bg-slate-900/90 border-b border-cyan-500/30 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.2)]">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-transparent pointer-events-none"></div>
        <div className="max-w-7xl mx-auto flex items-center gap-6 relative">
          <div
            onClick={onAvatarClick}
            className="relative flex-shrink-0 w-20 h-20 md:w-24 md:h-24 rounded-full border-2 border-cyan-400 p-1 shadow-[0_0_15px_rgba(6,182,212,0.4)] bg-slate-800 cursor-pointer hover:shadow-[0_0_30px_rgba(6,182,212,0.8)] hover:scale-105 hover:border-white transition-all duration-300"
            title="Abrir enlace neural con Atlas"
          >
            <div className="w-full h-full rounded-full overflow-hidden relative bg-black pointer-events-none">
              {showVideo ? (
                <video
                  src={videoUrl}
                  autoPlay
                  muted
                  playsInline
                  onEnded={onVideoEnd}
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={avatarImage}
                  alt="Avatar"
                  className="w-full h-full object-cover animate-pulse-slow"
                />
              )}
            </div>
            <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-black text-white tracking-wide uppercase flex items-center gap-2">
                  {playerName}
                  <span className="text-[10px] bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded border border-cyan-500/50">
                    NIVEL {level}
                  </span>
                </h2>
                <span className="text-xs text-slate-400 font-mono tracking-widest uppercase">
                  Rango: {playerTitle}
                </span>
              </div>
              <div className="flex gap-3">
                {/* ORO */}
                <div
                  onClick={() => setZoomedCurrency('gold')}
                  className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-700/50 px-2.5 py-1.5 rounded-lg shadow-[0_0_10px_rgba(234,179,8,0.1)] cursor-pointer hover:bg-yellow-900/40 hover:scale-105 hover:border-yellow-500 transition-all group"
                  title="Ver detalles de Oro"
                >
                  <img
                    src="https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Oro.jpg?alt=media&token=63d27131-c081-44e7-903f-6877389af694"
                    alt="Oro"
                    className="w-8 h-8 rounded-md object-cover shadow-sm border border-yellow-700/50 group-hover:border-yellow-400 transition-colors"
                  />
                  <span className="font-mono text-sm font-bold text-yellow-400">
                    {gold}
                  </span>
                </div>
                {/* NEXUS */}
                <div
                  onClick={() => setZoomedCurrency('nexus')}
                  className="flex items-center gap-2 bg-emerald-900/20 border border-emerald-500/50 px-2.5 py-1.5 rounded-lg shadow-[0_0_10px_rgba(16,185,129,0.1)] cursor-pointer hover:bg-emerald-900/40 hover:scale-105 hover:border-emerald-400 transition-all group"
                  title="Ver detalles de Nexus"
                >
                  <img
                    src="https://firebasestorage.googleapis.com/v0/b/mental-nexus-ac4c6.firebasestorage.app/o/Nexus.jpg?alt=media&token=eba61fcb-a5a1-4b4f-97a4-1344ff2f8d78"
                    alt="Nexus"
                    className="w-8 h-8 rounded-md object-cover shadow-sm border border-emerald-500/50 group-hover:border-emerald-300 transition-colors"
                  />
                  <span className="font-mono text-sm font-bold text-emerald-400">
                    {nexus}
                  </span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="flex justify-between text-[10px] font-mono mb-1 text-cyan-500">
                <span>SINCRONIZACIÓN NEXUS</span>
                <span>{Math.floor(xpProgress)}% / Siguiente Nivel</span>
              </div>
              <div className="h-4 bg-slate-950 rounded-sm border border-slate-700 relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,#fff_2px,#fff_4px)]"></div>
                <div
                  className="h-full bg-cyan-500 relative transition-all duration-1000 ease-out shadow-[0_0_10px_#06b6d4]"
                  style={{ width: `${xpProgress}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/40"></div>
                  <div className="absolute right-0 top-0 bottom-0 w-1 bg-white animate-pulse"></div>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="absolute top-0 right-0 md:relative p-2 text-slate-500 hover:text-red-400 transition-colors"
            title="Desconectar Nexus"
          >
            <AtlasIcons.Lock size={20} />
          </button>
        </div>
      </section>
    </>
  );
}
