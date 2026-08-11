// src/components/patient/GamificationStats.tsx
import { useState } from 'react';
import { AtlasCard, AtlasIcons } from './AtlasDesignSystem';

interface StatsProps {
  stats: {
    psique: number;
    vitalidad: number;
    resiliencia: number;
  };
}

type StatType = 'psique' | 'vitalidad' | 'resiliencia' | null;

export default function GamificationStats({ stats }: StatsProps) {
  const [zoomedStat, setZoomedStat] = useState<StatType>(null);

  const handleCloseZoom = () => setZoomedStat(null);

  const getStatTitle = () => {
    if (zoomedStat === 'psique') return 'PSIQUE';
    if (zoomedStat === 'vitalidad') return 'VITALIDAD';
    if (zoomedStat === 'resiliencia') return 'RESILIENCIA';
    return '';
  };

  return (
    <>
      {/* MODAL DE VISUALIZACIÓN DE ARTE */}
      {zoomedStat && (
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
                {getStatTitle()}
              </h3>
              <button
                onClick={handleCloseZoom}
                className="text-slate-400 hover:text-white p-1 hover:bg-slate-700 rounded transition-colors"
              >
                <AtlasIcons.Close size={20} />
              </button>
            </div>
            <div className="w-full bg-slate-950 flex justify-center items-center p-8">
              {zoomedStat === 'psique' && (
                <AtlasIcons.Brain
                  size={250}
                  className="shadow-[0_0_60px_rgba(168,85,247,0.4)]"
                />
              )}
              {zoomedStat === 'vitalidad' && (
                <AtlasIcons.Heart
                  size={250}
                  className="shadow-[0_0_60px_rgba(239,68,68,0.4)]"
                />
              )}
              {zoomedStat === 'resiliencia' && (
                <AtlasIcons.Shield
                  size={250}
                  className="shadow-[0_0_60px_rgba(59,130,246,0.4)]"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* TARJETAS DE ESTADÍSTICAS */}
      <div className="grid grid-cols-3 gap-3">
        <AtlasCard
          noPadding
          className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-purple-500 transition-all cursor-pointer group"
        >
          <div
            className="p-3 text-center flex flex-col items-center gap-2"
            onClick={() => setZoomedStat('psique')}
          >
            <div className="p-1 transform transition-transform duration-300 group-hover:scale-110">
              <AtlasIcons.Brain />
            </div>
            <div>
              <div className="text-xl font-bold text-white">{stats.psique}</div>
              <div className="text-[9px] text-slate-500 font-mono uppercase group-hover:text-purple-400 transition-colors">
                PSIQUE
              </div>
            </div>
          </div>
        </AtlasCard>

        <AtlasCard
          noPadding
          className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-red-500 transition-all cursor-pointer group"
        >
          <div
            className="p-3 text-center flex flex-col items-center gap-2"
            onClick={() => setZoomedStat('vitalidad')}
          >
            <div className="p-1 transform transition-transform duration-300 group-hover:scale-110">
              <AtlasIcons.Heart />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {stats.vitalidad}
              </div>
              <div className="text-[9px] text-slate-500 font-mono uppercase group-hover:text-red-400 transition-colors">
                VITALIDAD
              </div>
            </div>
          </div>
        </AtlasCard>

        <AtlasCard
          noPadding
          className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-blue-500 transition-all cursor-pointer group"
        >
          <div
            className="p-3 text-center flex flex-col items-center gap-2"
            onClick={() => setZoomedStat('resiliencia')}
          >
            <div className="p-1 transform transition-transform duration-300 group-hover:scale-110">
              <AtlasIcons.Shield />
            </div>
            <div>
              <div className="text-xl font-bold text-white">
                {stats.resiliencia}
              </div>
              <div className="text-[9px] text-slate-500 font-mono uppercase group-hover:text-blue-400 transition-colors">
                RESILIENCIA
              </div>
            </div>
          </div>
        </AtlasCard>
      </div>
    </>
  );
}
