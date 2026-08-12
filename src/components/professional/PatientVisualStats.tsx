// src/components/professional/PatientVisualStats.tsx
import { useState } from 'react';
import { PredictiveTagSearch } from '../PredictiveTagSearch';

const DualDoughnutChart = ({
  percentAdherence,
  percentProgress,
  size = 80,
}: any) => {
  return (
    <div
      className="relative flex justify-center items-center"
      style={{ width: size, height: size }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(#3b82f6 ${percentAdherence}%, #334155 0)`,
        }}
        title={`Adherencia al día: ${percentAdherence}%`}
      ></div>
      <div className="absolute inset-[8px] rounded-full bg-slate-800"></div>
      <div
        className="absolute inset-[12px] rounded-full"
        style={{
          background: `conic-gradient(#a855f7 ${percentProgress}%, #334155 0)`,
        }}
        title={`Avance total del plan: ${percentProgress}%`}
      ></div>
      <div className="absolute inset-[20px] rounded-full bg-slate-800 flex flex-col justify-center items-center leading-none">
        <span className="text-[14px] font-bold text-white">
          {percentAdherence}%
        </span>
        <span className="text-[7px] text-slate-400 uppercase tracking-wide mt-0.5">
          AL DÍA
        </span>
      </div>
    </div>
  );
};

export const PatientVisualStats = ({
  tasks,
  indicators,
  onAddTag,
  onDeleteTag,
  onResolveTag,
  dictionary,
  profession,
}: any) => {
  // ESTADO PARA EL MODAL DE TAGS
  const [selectedTagModal, setSelectedTagModal] = useState<any>(null);

  const activeTasks = tasks.filter((t: any) => t.status !== 'completed');
  const completedTasks = tasks.filter((t: any) => t.status === 'completed');

  let totalExpectedFinal = 0;
  let totalExpectedToDate = 0;
  let totalDone = 0;

  activeTasks.forEach((t: any) => {
    const expectedFinal = t.totalVolumeExpected || 1;
    const done = t.completionHistory
      ? Object.keys(t.completionHistory).length
      : 0;

    totalExpectedFinal += expectedFinal;
    totalDone += done;

    const createdAt = t.createdAt?.toDate ? t.createdAt.toDate() : new Date();
    const durationDays = (t.durationWeeks || 1) * 7;
    const now = new Date();
    const diffTime = Math.max(0, now.getTime() - createdAt.getTime());
    const elapsedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

    let expectedToday = Math.ceil((expectedFinal / durationDays) * elapsedDays);
    if (expectedToday > expectedFinal) expectedToday = expectedFinal;

    totalExpectedToDate += expectedToday;
  });

  const globalProgress =
    totalExpectedFinal > 0
      ? Math.round((totalDone / totalExpectedFinal) * 100)
      : 0;
  let dailyAdherence =
    totalExpectedToDate > 0
      ? Math.round((totalDone / totalExpectedToDate) * 100)
      : 0;
  if (dailyAdherence > 100) dailyAdherence = 100;

  // Separamos los objetos activos de los resueltos
  const activeIndicators = indicators.filter((t: any) => t.status === 'Activo');
  const resolvedIndicators = indicators.filter(
    (t: any) => t.status === 'Resuelto'
  );

  // Búsqueda de correlaciones en el diccionario para el modal
  const getCorrelationsForTag = (tagName: string) => {
    if (!dictionary) return [];
    const tagInfo = dictionary.find((d: any) => d.masterTag === tagName);
    return tagInfo?.correlations || [];
  };

  return (
    <>
      <div className="bg-slate-800 rounded-xl shadow-lg mb-6 flex flex-col sm:flex-row overflow-hidden border border-slate-700">
        {/* 1. IZQUIERDA: ADHERENCIA */}
        <div className="p-4 bg-slate-800/50 border-b sm:border-b-0 sm:border-r border-slate-700 flex flex-col items-center justify-center min-w-[150px]">
          <DualDoughnutChart
            percentAdherence={dailyAdherence}
            percentProgress={globalProgress}
            size={80}
          />
          <div className="mt-3 text-center w-full">
            <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">
              Carga Activa ({activeTasks.length})
            </div>
            <div className="flex justify-center gap-2 text-[10px]">
              <span className="text-blue-400 font-bold whitespace-nowrap">
                🔵 Día: {dailyAdherence}%
              </span>
              <span className="text-purple-400 font-bold whitespace-nowrap">
                🟣 Tot: {globalProgress}%
              </span>
            </div>
          </div>
        </div>

        {/* 2. CENTRO: TAGS CLÍNICOS */}
        <div className="flex-1 p-4 flex flex-col bg-slate-800">
          <div className="flex justify-between items-center mb-2">
            <h4 className="m-0 text-slate-300 text-xs uppercase font-bold tracking-wider">
              🏷️ Vocabulario Clínico
            </h4>
            <span className="text-[10px] text-slate-500">
              {activeIndicators.length} activos
            </span>
          </div>

          <div className="flex-1 min-h-[50px] max-h-[80px] overflow-y-auto flex flex-col gap-2 content-start mb-2 custom-scrollbar">
            {indicators.length === 0 && (
              <div className="text-xs text-slate-600 italic mt-1 w-full text-center">
                Sin observaciones clínicas...
              </div>
            )}

            {/* GRUPO DE ACTIVOS */}
            {activeIndicators.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {activeIndicators.map((tagObj: any, i: number) => (
                  <button
                    key={`act-${i}`}
                    onClick={() => setSelectedTagModal(tagObj)}
                    className="bg-yellow-900/60 hover:bg-yellow-800 border border-yellow-600/50 border-b-[3px] border-b-yellow-700 text-yellow-200 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all active:border-b-[1px] active:translate-y-[2px] shadow-sm"
                  >
                    {tagObj.tag}
                  </button>
                ))}
              </div>
            )}

            {/* GRUPO DE RESUELTOS (HISTÓRICO) */}
            {resolvedIndicators.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-700/50 mt-1">
                <span className="w-full text-[9px] text-slate-500 uppercase font-bold mb-1">
                  Historial (Resueltos):
                </span>
                {resolvedIndicators.map((tagObj: any, i: number) => (
                  <button
                    key={`res-${i}`}
                    onClick={() => setSelectedTagModal(tagObj)}
                    className="bg-slate-800 hover:bg-slate-700 border border-slate-600 border-b-[3px] border-b-slate-900 text-slate-400 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all opacity-80 hover:opacity-100 line-through decoration-slate-500 active:border-b-[1px] active:translate-y-[2px] shadow-sm"
                  >
                    {tagObj.tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Buscador predictivo integrado */}
          <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1 relative w-full mt-auto">
            <PredictiveTagSearch
              dictionary={dictionary || []}
              onSelectTag={(tagEntry: any) => {
                onAddTag(tagEntry.masterTag);
              }}
              placeholder="+ Buscar síntoma (ej. 'ansiedad')..."
              profession={profession}
            />
          </div>
        </div>

        {/* 3. DERECHA: HISTÓRICO */}
        <div className="p-4 bg-slate-800/50 border-t sm:border-t-0 sm:border-l border-slate-700 flex flex-col items-center justify-center min-w-[100px]">
          <div className="text-2xl font-bold text-green-500 leading-none">
            {completedTasks.length}
          </div>
          <div className="text-[9px] text-slate-500 uppercase text-center mt-1">
            Completadas
          </div>
          <div className="text-xl mt-1">🏆</div>
        </div>
      </div>

      {/* MODAL DEL TAG */}
      {selectedTagModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col">
            {/* Cabecera del Modal */}
            <div className="p-5 border-b border-slate-800 text-center relative">
              <button
                onClick={() => setSelectedTagModal(null)}
                className="absolute right-4 top-4 text-slate-400 hover:text-white"
              >
                ✕
              </button>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-1">
                Análisis de Síntoma
              </div>
              <h3
                className={`text-xl font-bold ${
                  selectedTagModal.status === 'Activo'
                    ? 'text-yellow-400'
                    : 'text-slate-400'
                }`}
              >
                {selectedTagModal.tag}
              </h3>
              <div className="mt-2 text-xs">
                Estado:{' '}
                <span
                  className={
                    selectedTagModal.status === 'Activo'
                      ? 'text-green-400'
                      : 'text-slate-500'
                  }
                >
                  {selectedTagModal.status}
                </span>
              </div>
            </div>

            {/* Cuerpo del Modal: Correlaciones */}
            <div className="p-5 bg-slate-800/30 flex-1">
              <h4 className="text-xs text-nexus-cyan uppercase font-bold mb-3 flex items-center gap-2">
                <span>🧠</span> Sugerencias de Exploración
              </h4>

              {/* Aquí se pintarán las correlaciones que encuentre en el diccionario */}
              {getCorrelationsForTag(selectedTagModal.tag).length > 0 ? (
                <div className="space-y-2">
                  {getCorrelationsForTag(selectedTagModal.tag).map(
                    (corr: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-slate-800 p-2 rounded border border-slate-700 text-sm shadow-sm"
                      >
                        <span className="text-slate-200">{corr.tag}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-nexus-cyan font-mono text-xs font-bold">
                            {corr.percentage}%
                          </span>
                          <button
                            onClick={() => {
                              onAddTag(corr.tag);
                              setSelectedTagModal(null);
                            }}
                            className="text-white bg-slate-700 hover:bg-slate-600 border border-slate-500 border-b-[3px] border-b-slate-800 active:border-b-[1px] active:translate-y-[2px] px-3 py-1 rounded text-xs font-bold transition-all"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="text-center p-4 border border-dashed border-slate-700 rounded-lg bg-slate-800/50">
                  <span className="text-2xl mb-2 block opacity-50">📊</span>
                  <p className="text-xs text-slate-400">
                    Recopilando datos estadísticos clínicos para este
                    indicador...
                  </p>
                </div>
              )}
            </div>

            {/* Pie del Modal: Acciones */}
            <div className="p-5 border-t border-slate-800 flex flex-col gap-3">
              {selectedTagModal.status === 'Activo' && (
                <button
                  onClick={() => {
                    onResolveTag(selectedTagModal.tag);
                    setSelectedTagModal(null);
                  }}
                  className="w-full py-2.5 bg-green-900/40 hover:bg-green-800/60 text-green-400 border border-green-700 border-b-[4px] border-b-green-900 rounded-lg text-sm font-bold transition-all active:border-b-[1px] active:translate-y-[3px] flex items-center justify-center gap-2 shadow-lg"
                >
                  ✅ Marcar como Resuelto
                </button>
              )}

              <button
                onClick={() => {
                  onDeleteTag(selectedTagModal.tag);
                  setSelectedTagModal(null);
                }}
                className="w-full py-2.5 bg-red-900/40 hover:bg-red-800/60 text-red-400 border border-red-800 border-b-[4px] border-b-red-950 rounded-lg text-sm font-bold transition-all active:border-b-[1px] active:translate-y-[3px] flex items-center justify-center gap-2 shadow-lg"
              >
                🗑️ Eliminar por Error de Diagnóstico
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
