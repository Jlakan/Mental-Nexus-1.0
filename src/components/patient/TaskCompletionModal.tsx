import { AtlasButton, AtlasIcons } from './AtlasDesignSystem';

interface TaskCompletionModalProps {
  task: any | null;
  reflection: string;
  rating: number;
  isSubmitting: boolean;
  onClose: () => void;
  onReflectionChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onSubmit: () => void;
}

export default function TaskCompletionModal({
  task,
  reflection,
  rating,
  isSubmitting,
  onClose,
  onReflectionChange,
  onRatingChange,
  onSubmit,
}: TaskCompletionModalProps) {
  if (!task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-slate-900 border border-cyan-500/50 rounded-2xl shadow-[0_0_50px_rgba(6,182,212,0.2)] overflow-hidden">
        <div className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center">
          <h3 className="font-bold text-white flex items-center gap-2">
            <AtlasIcons.Zap className="text-cyan-400" />
            VALIDAR PROTOCOLO
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <AtlasIcons.Close />
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div>
            <h4 className="text-xl font-bold text-white mb-1">
              {task.staticTaskData?.title || task.title}
            </h4>
            <p className="text-sm text-slate-400">
              {task.description ||
                'Completa este ejercicio y registra tu experiencia para ganar XP.'}
            </p>
          </div>
          <div>
            <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">
              Bitácora (Opcional)
            </label>
            <textarea
              value={reflection}
              onChange={(e) => onReflectionChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-200 text-sm focus:border-cyan-500 focus:outline-none h-24 resize-none"
              placeholder="¿Cómo te sentiste?..."
            />
          </div>
          <div>
            <label className="text-xs font-mono text-cyan-400 uppercase mb-2 block">
              Autoevaluación (1-5)
            </label>
            <div className="flex justify-between bg-slate-950 p-2 rounded-lg border border-slate-700">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => onRatingChange(num)}
                  className={`w-10 h-10 rounded-md font-bold transition-all ${
                    rating === num
                      ? 'bg-cyan-600 text-white shadow-lg scale-110'
                      : 'text-slate-500 hover:text-white'
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
          <AtlasButton
            onClick={onSubmit}
            isLoading={isSubmitting}
            className="w-full"
          >
            COMPLETAR Y RECLAMAR XP
          </AtlasButton>
        </div>
      </div>
    </div>
  );
}
