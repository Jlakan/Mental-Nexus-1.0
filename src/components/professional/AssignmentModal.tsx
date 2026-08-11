// src/components/professional/AssignmentModal.tsx
import { useAssignmentModal } from './useAssignmentModal';
import type { Assignment } from '../../utils/ClinicalEngine';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  professionalId: string;
  patientName: string;
  userProfessionId?: string;
  taskToEdit?: Assignment;
}

const WEEKDAYS = [
  { id: 'lun', label: 'L' },
  { id: 'mar', label: 'M' },
  { id: 'mie', label: 'X' },
  { id: 'jue', label: 'J' },
  { id: 'vie', label: 'V' },
  { id: 'sab', label: 'S' },
  { id: 'dom', label: 'D' },
];

export default function AssignmentModal({
  isOpen,
  onClose,
  patientId,
  professionalId,
  patientName,
  userProfessionId,
  taskToEdit,
}: Props) {
  const { state, actions } = useAssignmentModal(
    isOpen,
    onClose,
    patientId,
    professionalId,
    userProfessionId,
    taskToEdit
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar text-slate-200">
        <h2 className="text-xl font-bold text-white mb-6">
          {taskToEdit ? 'Editar Tarea' : `Asignar a ${patientName}`}
        </h2>

        {/* SELECTOR TIPO */}
        <div className="flex gap-2 mb-6 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
          <button
            onClick={() => !taskToEdit && actions.setMissionType('one-off')}
            disabled={!!taskToEdit}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-all ${
              state.missionType === 'one-off'
                ? 'bg-orange-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white disabled:opacity-50'
            }`}
          >
            🎯 Misión Única
          </button>
          <button
            onClick={() => !taskToEdit && actions.setMissionType('daily')}
            disabled={!!taskToEdit}
            className={`flex-1 py-2 px-4 rounded-md font-bold transition-all ${
              state.missionType === 'daily'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white disabled:opacity-50'
            }`}
          >
            📅 Rutina Diaria
          </button>
        </div>

        {/* TABS */}
        {!taskToEdit && (
          <div className="flex gap-4 mb-6 border-b border-slate-700">
            <button
              onClick={() => actions.setActiveTab('custom')}
              className={`pb-2 font-bold transition-colors ${
                state.activeTab === 'custom'
                  ? 'text-nexus-cyan border-b-2 border-nexus-cyan'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => actions.setActiveTab('catalog')}
              className={`pb-2 font-bold transition-colors ${
                state.activeTab === 'catalog'
                  ? 'text-nexus-cyan border-b-2 border-nexus-cyan'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Catálogo Nexus
            </button>
          </div>
        )}

        {/* ALERTA DE PRIVACIDAD */}
        {state.activeTab === 'custom' && !taskToEdit && (
          <div className="bg-orange-900/20 border border-orange-500/30 text-orange-200 text-xs p-3 rounded-lg mb-6 flex gap-3 items-start">
            <span className="text-lg leading-none">⚠️</span>
            <p>
              <strong>Atención:</strong> Las tareas manuales son evaluadas para
              ser incluidas en el catálogo global. Por favor,{' '}
              <strong>
                no incluyas nombres, diagnósticos, ni información confidencial
              </strong>{' '}
              del paciente en el título o instrucciones.
            </p>
          </div>
        )}

        {/* PANEL CATÁLOGO */}
        {state.activeTab === 'catalog' && !taskToEdit && (
          <div className="bg-slate-800/50 p-4 rounded-lg mb-6 border border-slate-700">
            <div className="text-xs text-slate-400 mb-3">
              Profesión:{' '}
              <strong className="text-white">{state.profNameDisplay}</strong>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <select
                className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white"
                value={state.selCat}
                onChange={(e) => actions.setSelCat(e.target.value)}
              >
                <option value="">📂 Categoría...</option>
                {state.cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                className="bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white disabled:opacity-50"
                value={state.selSubCat}
                onChange={(e) => actions.setSelSubCat(e.target.value)}
                disabled={!state.selCat}
              >
                <option value="">📂 Subcategoría...</option>
                {state.subCats.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <select
              className="w-full bg-slate-900 border border-nexus-cyan/50 rounded p-2 text-sm text-white font-bold disabled:opacity-50"
              onChange={(e) => actions.handleSelectCatalogTask(e.target.value)}
              disabled={!state.selSubCat}
            >
              <option value="">
                👇 Seleccionar{' '}
                {state.missionType === 'daily' ? 'Rutina' : 'Misión'}
              </option>
              {state.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.tier})
                </option>
              ))}
            </select>

            {/* STATS VISUALES */}
            {state.currentStats && (
              <div className="mt-4 p-3 bg-slate-900 rounded-lg flex justify-between items-center border border-slate-700">
                <div>
                  <div className="text-[10px] text-nexus-cyan font-bold mb-1">
                    TU HISTORIAL
                  </div>
                  <div className="text-xs text-slate-400">
                    Asignada:{' '}
                    <strong className="text-white">
                      {state.currentStats.personalAssigned} veces
                    </strong>
                    <br />
                    Volumen Total:{' '}
                    <strong className="text-white">
                      {state.currentStats.personalVolume} reps
                    </strong>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-orange-400 font-bold mb-1">
                    GLOBAL NEXUS
                  </div>
                  <div className="text-xs text-slate-400">
                    {state.currentStats.globalAssigned} usos totales
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* FORMULARIO */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">
              Título:
            </label>
            <input
              value={state.title}
              onChange={(e) => actions.setTitle(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-nexus-cyan outline-none transition-colors"
              placeholder="Ej. Registro de Pensamientos"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-300 mb-1">
              Instrucciones:
            </label>
            <textarea
              value={state.desc}
              onChange={(e) => actions.setDesc(e.target.value)}
              rows={3}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:border-nexus-cyan outline-none transition-colors resize-none"
              placeholder="Describe paso a paso lo que el paciente debe hacer..."
            />
          </div>

          {/* CONFIGURACIÓN RUTINA */}
          {state.missionType === 'daily' && (
            <div className="bg-purple-900/10 p-4 rounded-lg border border-purple-500/20">
              <div className="mb-4">
                <label className="block text-sm font-bold text-purple-400 mb-2">
                  1. Frecuencia Semanal:
                </label>
                <div className="flex gap-2">
                  {WEEKDAYS.map((d) => {
                    const active = state.selectedDays.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        onClick={() =>
                          actions.setSelectedDays((prev) =>
                            active
                              ? prev.filter((x) => x !== d.id)
                              : [...prev, d.id]
                          )
                        }
                        className={`w-10 h-10 rounded-full font-bold transition-colors ${
                          active
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
                            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 border border-slate-700'
                        }`}
                      >
                        {d.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-purple-400 mb-2">
                  2. Duración del Ciclo:
                </label>
                <select
                  value={state.durationWeeks}
                  onChange={(e) =>
                    actions.setDurationWeeks(Number(e.target.value))
                  }
                  className="bg-slate-900 border border-purple-500/50 rounded-lg p-2 text-sm text-white w-full sm:w-1/2 outline-none focus:border-purple-500"
                >
                  <option value={1}>1 Semana (Sprint Corto)</option>
                  <option value={2}>2 Semanas</option>
                  <option value={3}>3 Semanas</option>
                  <option value={4}>4 Semanas (Hábito)</option>
                </select>
              </div>

              <div className="mt-3 text-right text-xs text-slate-400">
                Volumen Total Esperado:{' '}
                <strong className="text-white">
                  {state.selectedDays.length * state.durationWeeks} repeticiones
                </strong>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-slate-700">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-bold text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={actions.handleAssign}
              disabled={state.saving}
              className={`px-6 py-2.5 rounded-lg font-bold text-white transition-all shadow-lg ${
                state.missionType === 'daily'
                  ? 'bg-purple-600 hover:bg-purple-500'
                  : 'bg-orange-600 hover:bg-orange-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {state.saving
                ? 'Procesando...'
                : taskToEdit
                ? 'Guardar Cambios'
                : 'Confirmar Asignación'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
