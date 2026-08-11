import { AtlasCard, AtlasIcons } from './AtlasDesignSystem';

interface PatientStatsProps {
  psique: number;
  vitalidad: number;
  resiliencia: number;
}

export default function PatientStats({
  psique,
  vitalidad,
  resiliencia,
}: PatientStatsProps) {
  return (
    <div className="grid grid-cols-3 gap-3">
      <AtlasCard
        noPadding
        className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-purple-500 transition-all"
      >
        <div className="p-3 text-center flex flex-col items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-900 text-purple-400">
            <AtlasIcons.Brain />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{psique}</div>
            <div className="text-[9px] text-slate-500 font-mono uppercase">
              PSIQUE
            </div>
          </div>
        </div>
      </AtlasCard>

      <AtlasCard
        noPadding
        className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-red-500 transition-all"
      >
        <div className="p-3 text-center flex flex-col items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-900 text-red-400">
            <AtlasIcons.Heart />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{vitalidad}</div>
            <div className="text-[9px] text-slate-500 font-mono uppercase">
              VITALIDAD
            </div>
          </div>
        </div>
      </AtlasCard>

      <AtlasCard
        noPadding
        className="bg-slate-800/50 border-t-2 border-t-transparent hover:border-t-blue-500 transition-all"
      >
        <div className="p-3 text-center flex flex-col items-center gap-2">
          <div className="p-2 rounded-lg bg-slate-900 text-blue-400">
            <AtlasIcons.Shield />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{resiliencia}</div>
            <div className="text-[9px] text-slate-500 font-mono uppercase">
              RESILIENCIA
            </div>
          </div>
        </div>
      </AtlasCard>
    </div>
  );
}
