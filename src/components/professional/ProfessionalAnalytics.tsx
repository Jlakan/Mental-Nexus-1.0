// src/components/professional/ProfessionalAnalytics.tsx
import { useState } from 'react';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { analyzeCatalogBatch } from '../../utils/ClinicalEngine';

interface Props {
  userId: string;
}

export default function ProfessionalAnalytics({ userId }: Props) {
  const [interventionStats, setInterventionStats] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false);

  const handleGenerateAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      // Busca en todas las subcolecciones 'historical_archives' que te pertenezcan
      const qArch = query(
        collectionGroup(db, 'historical_archives'),
        where('professionalId', '==', userId)
      );
      const snap = await getDocs(qArch);

      let allTasks: any[] = [];

      snap.docs.forEach((d) => {
        const data = d.data();
        if (data.tasks) {
          // Extraemos todas las tareas del mapa y las metemos en un arreglo plano
          Object.values(data.tasks).forEach((t: any) => {
            if (t.catalogId) {
              allTasks.push({
                ...t,
                title: t.title || 'S/T',
                // Compatibilidad con el motor clínico usando el nuevo o viejo formato de array
                completionHistory: t.completionLog || t.historyChecks || [],
              });
            }
          });
        }
      });

      let stats: any = analyzeCatalogBatch(allTasks);
      if (!Array.isArray(stats)) stats = Object.values(stats);
      stats.sort((a: any, b: any) => b.globalSuccessRate - a.globalSuccessRate);

      setInterventionStats(stats);
      setAnalyticsLoaded(true);
    } catch (e) {
      console.error(e);
      alert('Error al generar reporte de inteligencia');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const topPerformer =
    interventionStats.length > 0 ? interventionStats[0] : null;
  const mostAbandoned = [...interventionStats].sort(
    (a, b) => b.dropoutRate - a.dropoutRate
  )[0];

  return (
    <div className="space-y-6">
      {!analyticsLoaded && (
        <div className="text-center py-10">
          <p className="text-slate-400 mb-4">
            Analiza el rendimiento global de tus intervenciones clínicas.
          </p>
          <button
            onClick={handleGenerateAnalytics}
            className="btn-primary py-3 px-8 text-lg w-full md:w-auto"
          >
            Generar Reporte de Inteligencia
          </button>
        </div>
      )}

      {loadingAnalytics && (
        <p className="text-nexus-cyan text-center animate-pulse">
          Procesando datos del sistema...
        </p>
      )}

      {analyticsLoaded && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {topPerformer && (
              <div className="bg-green-900/20 border border-green-500/50 p-4 rounded-xl">
                <div className="text-xs uppercase text-green-400 font-bold mb-1">
                  🌟 Mejor Adherencia
                </div>
                <div className="text-lg font-bold text-white">
                  {topPerformer.title}
                </div>
                <div className="text-2xl font-bold text-green-400 mt-2">
                  {topPerformer.globalSuccessRate.toFixed(0)}%{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    de éxito
                  </span>
                </div>
              </div>
            )}
            {mostAbandoned && (
              <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl">
                <div className="text-xs uppercase text-red-400 font-bold mb-1">
                  ⚠️ Mayor Abandono
                </div>
                <div className="text-lg font-bold text-white">
                  {mostAbandoned.title}
                </div>
                <div className="text-2xl font-bold text-red-400 mt-2">
                  {mostAbandoned.dropoutRate.toFixed(0)}%{' '}
                  <span className="text-xs text-slate-400 font-normal">
                    abandono
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="nexus-card overflow-hidden">
            <h3 className="text-lg font-bold text-white mb-4">
              Detalle de Intervenciones
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left text-slate-300">
                <thead className="text-xs text-slate-500 uppercase bg-slate-800">
                  <tr>
                    <th className="px-4 py-3">Tarea</th>
                    <th className="px-4 py-3 text-center">Uso Total</th>
                    <th className="px-4 py-3 text-center">Tasa Éxito</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {interventionStats.map((s, i) => (
                    <tr key={i} className="hover:bg-slate-800/50">
                      <td className="px-4 py-3 font-medium text-white">
                        {s.title}
                      </td>
                      <td className="px-4 py-3 text-center">{s.usageCount}</td>
                      <td className="px-4 py-3 text-center text-nexus-cyan">
                        {s.globalSuccessRate.toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
