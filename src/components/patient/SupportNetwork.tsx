// src/components/patient/SupportNetwork.tsx
import { AtlasCard } from './AtlasDesignSystem';

interface Professional {
  professionalId: string;
  professionalName?: string;
  professionType?: string;
  active: boolean;
}

interface SupportNetworkProps {
  careTeam?: Record<string, Professional>;
  onUnlink: (profId: string) => void;
}

export default function SupportNetwork({
  careTeam,
  onUnlink,
}: SupportNetworkProps) {
  const activeProfessionals = careTeam
    ? Object.values(careTeam).filter((pro) => pro.active)
    : [];

  return (
    <section>
      <h3 className="text-sm text-slate-400 font-mono uppercase mb-3 mt-4 tracking-widest border-b border-slate-800 pb-2">
        Red de Soporte
      </h3>
      {activeProfessionals.length === 0 ? (
        <p className="text-sm text-slate-600 italic">
          No tienes especialistas vinculados.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {activeProfessionals.map((pro) => (
            <AtlasCard
              key={pro.professionalId}
              className="flex items-center gap-4 border-slate-700 bg-slate-800/50"
            >
              <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-xl">
                👨‍⚕️
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="font-bold text-white text-sm truncate">
                  {pro.professionalName || 'Especialista'}
                </h4>
                <p className="text-xs text-slate-500 capitalize truncate">
                  {pro.professionType || 'Salud Mental'}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onUnlink(pro.professionalId);
                }}
                className="text-red-400 hover:text-white hover:bg-red-600 text-[10px] uppercase border border-red-900/50 bg-red-900/10 px-2 py-1 rounded transition-all"
              >
                Desvincular
              </button>
            </AtlasCard>
          ))}
        </div>
      )}
    </section>
  );
}
