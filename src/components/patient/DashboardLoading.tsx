import { AtlasIcons } from './AtlasDesignSystem';

export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-cyan-500 gap-4">
      <AtlasIcons.Zap className="animate-spin w-12 h-12" />
      <span className="font-mono animate-pulse tracking-widest text-sm">
        SINCRONIZANDO NEXUS...
      </span>
    </div>
  );
}
