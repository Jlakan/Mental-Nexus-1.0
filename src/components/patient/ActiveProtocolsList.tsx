import { AtlasIcons } from './AtlasDesignSystem';

export type ProtocolTask = {
  id: string;
  title?: string;
  type?: 'routine' | 'challenge';
  lastCompletedAt?: any;
  rewards?: { xp?: number };
  staticTaskData?: { title?: string; xp?: number };
  hasSeenArt?: boolean;
};

interface ActiveProtocolsListProps {
  tasks: ProtocolTask[];
  onTaskClick: (task: ProtocolTask) => void;
}

const isSameDay = (d1: Date, d2: Date) => {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
};

export default function ActiveProtocolsList({
  tasks,
  onTaskClick,
}: ActiveProtocolsListProps) {
  // Instanciamos la fecha una sola vez para evitar bugs de medianoche y exceso de memoria
  const today = new Date();

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <AtlasIcons.Target className="text-cyan-500" />
          PROTOCOLOS ACTIVOS
        </h3>
        <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-cyan-400 border border-slate-700">
          HOY:{' '}
          {today.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: 'numeric',
          })}
        </span>
      </div>

      <div className="space-y-4">
        {tasks.length === 0 && (
          <div className="text-center py-10 text-slate-500 border border-dashed border-slate-700 rounded-xl bg-slate-800/30">
            <p>No hay misiones asignadas para hoy.</p>
            <p className="text-xs mt-1">Recarga tu energía para mañana.</p>
          </div>
        )}

        {tasks.map((task) => {
          let isCompletedToday = false;

          if (task.lastCompletedAt) {
            try {
              const lastDate =
                typeof task.lastCompletedAt.toDate === 'function'
                  ? task.lastCompletedAt.toDate()
                  : new Date(task.lastCompletedAt);
              isCompletedToday = isSameDay(lastDate, today);
            } catch {
              // Fallback silencioso: si la fecha es corrupta, asumimos que no está completada hoy
              isCompletedToday = false;
            }
          }

          const title =
            task.staticTaskData?.title || task.title || 'Misión Desconocida';
          const xpVal = task.rewards?.xp || task.staticTaskData?.xp || 10;
          const type = task.type === 'routine' ? 'Rutina' : 'Reto';

          // Arreglo de clases para mayor legibilidad
          const buttonClasses = [
            'w-full text-left relative overflow-hidden group flex items-center gap-4 p-4 rounded-xl transition-all duration-200',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900',
            isCompletedToday
              ? 'bg-slate-900/40 border border-slate-800 opacity-60 grayscale cursor-not-allowed'
              : 'bg-slate-800 border border-slate-600 cursor-pointer shadow-[0_4px_0_0_rgb(15,23,42),inset_0_1px_0_0_rgba(255,255,255,0.1)] hover:bg-slate-700/80 hover:-translate-y-1 hover:border-cyan-500 hover:shadow-[0_6px_0_0_rgb(15,23,42),0_0_15px_rgba(6,182,212,0.15),inset_0_1px_0_0_rgba(255,255,255,0.2)] active:translate-y-[4px] active:shadow-[0_0px_0_0_rgb(15,23,42),inset_0_2px_4px_rgba(0,0,0,0.3)]',
          ].join(' ');

          return (
            <button
              key={task.id}
              onClick={() => onTaskClick(task)}
              disabled={isCompletedToday}
              className={buttonClasses}
            >
              <div
                className={`min-w-[2.5rem] h-10 rounded-full flex items-center justify-center border transition-colors ${
                  isCompletedToday
                    ? 'bg-green-900/20 border-green-600 text-green-500'
                    : 'bg-slate-900 border-slate-700 text-cyan-500 group-hover:bg-cyan-900/30 group-hover:text-cyan-400 group-hover:border-cyan-500'
                }`}
              >
                {isCompletedToday ? (
                  <AtlasIcons.Check size={20} />
                ) : (
                  <AtlasIcons.Zap size={20} />
                )}
              </div>

              <div className="flex-1">
                <h4
                  className={`font-bold transition-colors ${
                    isCompletedToday
                      ? 'text-slate-500 line-through'
                      : 'text-slate-200 group-hover:text-white'
                  }`}
                >
                  {title}
                </h4>
                <span className="text-xs text-slate-500 font-mono uppercase">
                  {type} {task.hasSeenArt ? '' : '• NUEVO'}
                </span>
              </div>

              <div
                className={`text-xs font-bold font-mono px-2 py-1 rounded border transition-colors ${
                  isCompletedToday
                    ? 'text-slate-600 border-transparent'
                    : 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20 group-hover:bg-yellow-500/20'
                }`}
              >
                +{xpVal} XP
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
