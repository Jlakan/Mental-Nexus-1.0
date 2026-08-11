// src/components/professional/HistoryModal.tsx
import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db, auth } from '../../services/firebase';
import { analyzeAssignment } from '../../utils/ClinicalEngine';
import type { Assignment } from '../../utils/ClinicalEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  specificTask?: Assignment | null;
}

// --- HELPER ROBUSTO PARA FECHAS ---
const parseFirestoreDate = (value: any): Date => {
  if (!value) return new Date(0);
  if (value instanceof Date) return value;
  if (typeof value.toDate === 'function') return value.toDate();
  if (typeof value === 'object' && 'seconds' in value)
    return new Date(value.seconds * 1000);
  if (typeof value === 'string') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date(0);
};

export default function HistoryModal({
  isOpen,
  onClose,
  patientId,
  patientName,
  specificTask,
}: Props) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isSingleTaskMode = !!specificTask;

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      if (isSingleTaskMode) {
        loadSingleTaskHistory();
      } else {
        loadGeneralHistory();
      }
    }
  }, [isOpen, patientId, specificTask]);

  // --- CARGA DE HISTORIAL GLOBAL (Nueva Arquitectura) ---
  const loadGeneralHistory = async () => {
    setLoading(true);
    try {
      const profId = auth.currentUser?.uid;
      if (!profId) throw new Error('Sesión no válida');

      let allTasks: any[] = [];

      // 1. Tareas Activas
      const planRef = doc(db, 'active_plans', patientId);
      const planSnap = await getDoc(planRef);
      if (planSnap.exists()) {
        const pData = planSnap.data();
        const activeObj = pData.activeTasks || {};
        const activeArray = Object.keys(activeObj)
          .map((k) => ({ id: k, ...activeObj[k] }))
          .filter((t) => t.professionalId === profId);
        allTasks = [...allTasks, ...activeArray];
      }

      // 2. Tareas Archivadas (Históricas)
      const archiveRef = doc(
        db,
        'patients',
        patientId,
        'historical_archives',
        profId
      );
      const archiveSnap = await getDoc(archiveRef);
      if (archiveSnap.exists()) {
        const aData = archiveSnap.data();
        const histObj = aData.tasks || {};
        const histArray = Object.keys(histObj).map((k) => ({
          id: k,
          ...histObj[k],
        }));
        allTasks = [...allTasks, ...histArray];
      }

      // Ordenar por fecha de asignación/creación
      allTasks.sort((a, b) => {
        const dateA = parseFirestoreDate(a.assignedAt || a.createdAt);
        const dateB = parseFirestoreDate(b.assignedAt || b.createdAt);
        return dateB.getTime() - dateA.getTime();
      });

      setTasks(allTasks);
    } catch (e: any) {
      console.error('Error cargando historial global:', e);
      setErrorMsg('Error cargando datos: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  // --- CARGA DE DETALLE ÚNICO (Desde la colección de logs) ---
  const loadSingleTaskHistory = async () => {
    setLoading(true);
    try {
      const qCompletions = query(
        collection(db, 'patients', patientId, 'completions'),
        where('taskId', '==', specificTask!.id)
      );
      const snap = await getDocs(qCompletions);

      const logs = snap.docs
        .map((d) => d.data())
        .sort((a, b) => {
          const dateA = parseFirestoreDate(a.createdAt);
          const dateB = parseFirestoreDate(b.createdAt);
          return dateB.getTime() - dateA.getTime();
        });

      setCompletions(logs);
    } catch (e: any) {
      console.error('Error cargando bitácora de tarea:', e);
      setErrorMsg('Error al cargar la bitácora: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (value: any) => {
    try {
      const d = parseFirestoreDate(value);
      if (d.getTime() === 0) return '-';
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return 'Error Fecha';
    }
  };

  const getEfficacyColor = (score: number) => {
    if (score >= 80) return '#2E7D32'; // Verde
    if (score >= 50) return '#F9A825'; // Naranja
    return '#D32F2F'; // Rojo
  };

  const renderEffortRating = (rating?: number) => {
    if (!rating)
      return <span className="text-slate-500 text-xs italic">N/A</span>;
    const colors = [
      'bg-green-500',
      'bg-lime-500',
      'bg-yellow-500',
      'bg-orange-500',
      'bg-red-500',
    ];
    const safeIndex = Math.max(0, Math.min(4, rating - 1));
    const colorClass = colors[safeIndex] || 'bg-slate-500';

    return (
      <div className="flex items-center gap-2">
        <div
          className={`w-6 h-6 rounded-full text-white flex justify-center items-center font-bold text-xs shadow ${colorClass}`}
        >
          {rating}
        </div>
        <span className="text-xs text-slate-400">
          {rating === 1
            ? 'Muy Fácil'
            : rating === 5
            ? 'Muy Difícil'
            : 'Esfuerzo'}
        </span>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-[2100] p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-4xl rounded-xl flex flex-col shadow-2xl max-h-[90vh] overflow-hidden text-slate-200">
        {/* HEADER */}
        <div className="p-6 border-b border-slate-700 flex justify-between items-center bg-slate-800">
          <div>
            <h2 className="m-0 text-white text-xl font-bold flex items-center gap-2">
              {isSingleTaskMode
                ? '📋 Bitácora de Ejecución'
                : '📂 Historial Clínico Global'}
            </h2>
            <div className="mt-1 text-slate-400 text-sm flex items-center gap-2">
              Paciente: <strong className="text-white">{patientName}</strong>
              {isSingleTaskMode && specificTask && (
                <span className="ml-3 bg-nexus-cyan/10 text-nexus-cyan border border-nexus-cyan/30 px-2 py-0.5 rounded text-xs font-bold">
                  Tarea: {specificTask?.title || 'Sin Título'}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-3xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* CONTENIDO */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {errorMsg ? (
            <div className="text-red-400 text-center p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              {errorMsg}
            </div>
          ) : loading ? (
            <div className="text-center p-10 text-nexus-cyan animate-pulse">
              Extrayendo datos de la red neural...
            </div>
          ) : isSingleTaskMode && specificTask ? (
            renderSingleTaskDetail(completions, formatDate, renderEffortRating)
          ) : (
            renderGeneralHistoryTable(tasks, formatDate, getEfficacyColor)
          )}
        </div>

        {/* FOOTER */}
        <div className="p-4 border-t border-slate-700 text-right bg-slate-800">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors"
          >
            Cerrar Panel
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-COMPONENTES
// ----------------------------------------------------------------------

function renderSingleTaskDetail(
  history: any[],
  formatDate: any,
  renderRating: any
) {
  if (history.length === 0) {
    return (
      <div className="text-center p-10 bg-slate-800/50 rounded-lg border border-slate-700">
        <div className="text-5xl mb-4">📭</div>
        <p className="text-lg font-bold text-white mb-1">
          No hay registros de actividad.
        </p>
        <p className="text-sm text-slate-400">
          El paciente aún no ha completado reflexiones para esta tarea.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs text-slate-500 uppercase bg-slate-800">
          <tr>
            <th className="px-4 py-3 border-b border-slate-700 w-40">
              Fecha / Hora
            </th>
            <th className="px-4 py-3 border-b border-slate-700 w-32 text-center">
              Estado
            </th>
            <th className="px-4 py-3 border-b border-slate-700 w-40">
              Esfuerzo
            </th>
            <th className="px-4 py-3 border-b border-slate-700">
              Reflexión / Notas
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">
          {history.map((record: any, idx: number) => {
            const dateObj = parseFirestoreDate(
              record.createdAt || record.loggedAt
            );
            const isSkipped =
              record.status === 'skipped' || record.isSkipped === true;
            const ratingValue = record.rating || record.selfRating;

            return (
              <tr
                key={idx}
                className={`hover:bg-slate-800/30 transition-colors ${
                  isSkipped ? 'bg-orange-900/10' : ''
                }`}
              >
                <td className="px-4 py-4 font-medium text-slate-200 align-top">
                  {formatDate(dateObj)}
                </td>

                <td className="px-4 py-4 text-center align-top">
                  {isSkipped ? (
                    <span className="bg-orange-900/40 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-full text-[10px] font-bold">
                      🏃 ESCAPE
                    </span>
                  ) : (
                    <span className="bg-green-900/40 text-green-400 border border-green-500/30 px-2 py-1 rounded-full text-[10px] font-bold">
                      ✅ HECHO
                    </span>
                  )}
                </td>

                <td className="px-4 py-4 align-top">
                  {!isSkipped ? (
                    renderRating(ratingValue)
                  ) : (
                    <div className="text-orange-400 text-xs italic flex items-center gap-1">
                      <span>🚫</span> N/A
                    </div>
                  )}
                </td>

                <td className="px-4 py-4 align-top">
                  {isSkipped ? (
                    <div className="bg-slate-800 p-2 rounded border border-orange-500/20">
                      <strong className="text-orange-400 text-[10px] uppercase block mb-1">
                        Motivo de escape:
                      </strong>
                      <div className="text-slate-300 italic text-sm">
                        {record.reflection ||
                          record.note ||
                          'Sin motivo reportado'}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {record.reflection || record.note ? (
                        <>
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-sm">💬</span>
                            <strong className="text-nexus-cyan text-xs">
                              Reflexión:
                            </strong>
                          </div>
                          <div className="ml-5 text-slate-300 bg-slate-800/80 p-2.5 rounded-r-lg rounded-bl-lg text-sm border border-slate-700">
                            {record.reflection || record.note}
                          </div>
                        </>
                      ) : (
                        <span className="text-slate-500 italic text-xs">
                          - Sin notas -
                        </span>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function renderGeneralHistoryTable(
  tasks: any[],
  formatDate: any,
  getEfficacyColor: any
) {
  if (!tasks || tasks.length === 0) {
    return (
      <div className="text-center p-12 text-slate-500 italic border border-dashed border-slate-700 rounded-lg">
        Este paciente aún no tiene misiones ni rutinas en su expediente.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-slate-300">
        <thead className="text-xs text-slate-500 uppercase bg-slate-800">
          <tr>
            <th className="px-4 py-3 border-b border-slate-700">
              Estado / Asignado
            </th>
            <th className="px-4 py-3 border-b border-slate-700">
              Tarea y Análisis
            </th>
            <th className="px-4 py-3 border-b border-slate-700 w-32">
              Duración
            </th>
            <th className="px-4 py-3 border-b border-slate-700 w-40 text-center">
              Eficacia Global
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {tasks.map((t) => {
            let analysis = { successScore: 0, insightMessage: '' };
            try {
              // Convertimos los arrays de checks para que el motor clínico no falle
              const historyArray = (
                t.historyChecks ||
                t.completionHistory ||
                []
              ).map((dateStr: string) => ({ completedAt: new Date(dateStr) }));
              const taskForAnalysis = {
                ...t,
                assignedAt: parseFirestoreDate(t.assignedAt || t.createdAt),
                completionHistory: historyArray,
              };

              if (typeof analyzeAssignment === 'function') {
                analysis = analyzeAssignment(taskForAnalysis as Assignment);
              }
            } catch (err) {
              console.warn('Skip analysis', t.id);
            }

            const isRoutine = t.type === 'routine' || t.type === 'recurring';
            const efficacyColor = getEfficacyColor(analysis.successScore);
            const isCompleted = t.status === 'completed';

            return (
              <tr
                key={t.id}
                className="hover:bg-slate-800/30 transition-colors"
              >
                <td className="px-4 py-4 text-slate-400 align-top">
                  <div className="mb-1">
                    {isCompleted ? (
                      <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                        ARCHIVADA
                      </span>
                    ) : (
                      <span className="bg-green-900/30 text-green-400 px-2 py-0.5 rounded text-[10px] font-bold border border-green-500/20">
                        ACTIVA
                      </span>
                    )}
                  </div>
                  {formatDate(t.assignedAt || t.createdAt)}
                </td>
                <td className="px-4 py-4 align-top">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold text-white ${
                        isRoutine ? 'bg-purple-600' : 'bg-orange-600'
                      }`}
                    >
                      {isRoutine ? 'RUTINA' : 'MISIÓN'}
                    </span>
                    <strong className="text-white text-base">{t.title}</strong>
                  </div>
                  <div className="text-xs text-slate-400 leading-relaxed">
                    {analysis.insightMessage ||
                      'Recopilando datos de adherencia...'}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-400 align-top">
                  {isRoutine ? (
                    <span className="bg-purple-900/20 text-purple-400 border border-purple-500/20 px-2 py-1 rounded text-xs">
                      {t.durationWeeks || 1} Semanas
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">- Única -</span>
                  )}
                </td>
                <td className="px-4 py-4 align-middle text-center">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-slate-500 uppercase">
                      Cumplimiento
                    </span>
                    <span
                      className="font-bold text-lg"
                      style={{ color: efficacyColor }}
                    >
                      {analysis.successScore}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${analysis.successScore}%`,
                        backgroundColor: efficacyColor,
                      }}
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
