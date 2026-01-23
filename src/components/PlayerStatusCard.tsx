// src/components/PlayerStatusCard.tsx


// Iconos simples para las estadísticas
const STAT_ICONS: any = {
  STR: '💪', // Fuerza/Voluntad
  INT: '🧠', // Intelecto
  STA: '❤️', // Resistencia
  DEX: '⚡', // Agilidad
};

interface Props {
  level: number;
  currentXp: number;
  requiredXp: number;
  progressPercent: number;
  stats: { [key: string]: number };
}

export default function PlayerStatusCard({ level, currentXp, requiredXp, progressPercent, stats }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-8 transform transition-all hover:scale-[1.01]">
      
      {/* 1. ENCABEZADO: Perfil y Nivel con Degradado */}
      <div className="bg-gradient-to-r from-purple-800 to-indigo-600 p-6 text-white relative overflow-hidden">
        <div className="relative z-10 flex items-center gap-5">
          
          {/* Círculo de Nivel */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-2xl border-4 border-purple-300">
              <span className="text-4xl font-black text-purple-800">{level}</span>
            </div>
            <div className="absolute -bottom-2 -right-1 bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1 rounded-full border border-yellow-200 shadow-sm">
              LVL
            </div>
          </div>

          {/* Textos */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Explorador Mental</h2>
            <p className="text-purple-200 text-sm font-medium">Sigue tu camino hacia el bienestar.</p>
          </div>
        </div>

        {/* Decoración de fondo (efecto visual) */}
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl pointer-events-none"></div>
      </div>

      {/* 2. BARRA DE EXPERIENCIA (XP) */}
      <div className="px-6 py-5 bg-white">
        <div className="flex justify-between text-sm mb-2 font-bold tracking-wide">
          <span className="text-gray-500 uppercase text-xs">Progreso de Nivel</span>
          <span className="text-indigo-600">
            {Math.floor(currentXp)} <span className="text-gray-300">/</span> {requiredXp} XP
          </span>
        </div>
        
        <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
          <div 
            className="h-full bg-gradient-to-r from-purple-500 via-purple-400 to-indigo-500 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(100, progressPercent)}%` }} 
          ></div>
        </div>
      </div>

      {/* 3. GRID DE ESTADÍSTICAS (STATS) */}
      <div className="bg-gray-50 px-6 py-4 border-t border-gray-100">
        <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Tus Atributos</h3>
        
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(stats || {}).map(([key, val]) => (
            <div key={key} className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm flex flex-col items-center justify-center hover:shadow-md transition-all">
              <span className="text-2xl mb-1">{STAT_ICONS[key] || '🔹'}</span>
              <span className="text-lg font-bold text-gray-800">{val}</span>
              <span className="text-[10px] font-bold text-gray-400 uppercase">{key}</span>
            </div>
          ))}
          
          {(!stats || Object.keys(stats).length === 0) && (
            <div className="col-span-3 text-center text-gray-400 text-sm italic py-2">
              Completa misiones para revelar tus stats...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}