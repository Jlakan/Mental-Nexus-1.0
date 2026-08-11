// src/components/professional/PatientMergeModal.tsx
import { useState } from 'react';

interface PatientMergeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: any[];
  onMerge: (
    manualId: string,
    appId: string,
    manualShardId: string
  ) => Promise<boolean>;
}

export default function PatientMergeModal({
  isOpen,
  onClose,
  patients,
  onMerge,
}: PatientMergeModalProps) {
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [isMerging, setIsMerging] = useState(false);

  if (!isOpen) return null;

  // Ordenamos alfabéticamente para que sea fácil buscar en los select
  const sortedPatients = [...patients].sort((a, b) =>
    a.fullName.localeCompare(b.fullName)
  );

  const handleExecuteMerge = async () => {
    if (!sourceId || !targetId)
      return alert('Debes seleccionar ambos perfiles.');
    if (sourceId === targetId)
      return alert('No puedes fusionar a un paciente consigo mismo.');

    const sourcePatient = patients.find((p) => p.id === sourceId);
    const targetPatient = patients.find((p) => p.id === targetId);

    if (
      !window.confirm(
        `⚠️ ADVERTENCIA CRÍTICA\n\nEstás a punto de fusionar:\n[ORIGEN] ${sourcePatient.fullName}\n   ⬇️ Hacia ⬇️\n[DESTINO] ${targetPatient.fullName}\n\nEl perfil de ORIGEN desaparecerá de tu lista y sus datos/notas se enviarán al DESTINO.\n\n¿Estás completamente seguro?`
      )
    )
      return;

    setIsMerging(true);
    const success = await onMerge(sourceId, targetId, sourcePatient.shardId);
    setIsMerging(false);

    if (success) onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        {/* Decoración superior */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 to-nexus-cyan"></div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>🧬</span> Fusión de Expedientes Clínicos
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              Traslada el historial y las notas de un perfil manual hacia la
              cuenta oficial de la aplicación.
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isMerging}
            className="text-slate-500 hover:text-white text-xl"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative">
          {/* Flecha indicadora central (solo visible en desktop) */}
          <div className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none z-10">
            <div className="bg-slate-800 border border-slate-700 rounded-full p-2 text-nexus-cyan shadow-lg">
              ➡️
            </div>
          </div>

          {/* PERFIL ORIGEN (El que se va a descartar) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-amber-900/50">
            <label className="block text-xs font-bold text-amber-500 uppercase tracking-wider mb-2">
              1. Perfil Origen (Manual)
            </label>
            <p className="text-[10px] text-slate-500 mb-3 leading-tight">
              Este es el perfil que creaste tú. Se extraerán sus datos y
              desaparecerá de tu lista.
            </p>
            <select
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 text-sm focus:border-amber-500 outline-none"
            >
              <option value="">Selecciona el perfil a descartar...</option>
              {sortedPatients.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === targetId}>
                  {p.fullName} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* PERFIL DESTINO (El que se conserva) */}
          <div className="bg-slate-950 p-4 rounded-xl border border-cyan-900/50">
            <label className="block text-xs font-bold text-nexus-cyan uppercase tracking-wider mb-2">
              2. Perfil Destino (App Nexus)
            </label>
            <p className="text-[10px] text-slate-500 mb-3 leading-tight">
              Este es el perfil oficial del paciente. Absorberá todas las notas
              e historial del origen.
            </p>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-3 text-sm focus:border-nexus-cyan outline-none"
            >
              <option value="">Selecciona el perfil a conservar...</option>
              {sortedPatients.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === sourceId}>
                  {p.fullName} {p.email ? `(${p.email})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* CONTROLES */}
        <div className="mt-8 flex justify-end gap-3 border-t border-slate-800 pt-5">
          <button
            onClick={onClose}
            disabled={isMerging}
            className="px-5 py-2.5 text-sm text-slate-300 hover:text-white"
          >
            Cancelar
          </button>
          <button
            onClick={handleExecuteMerge}
            disabled={isMerging || !sourceId || !targetId}
            className={`px-6 py-2.5 rounded-lg text-sm font-bold shadow-lg transition-all ${
              isMerging || !sourceId || !targetId
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-nexus-cyan text-black hover:bg-cyan-400 hover:shadow-cyan-500/20'
            }`}
          >
            {isMerging ? 'Fusionando Datos...' : 'Confirmar Fusión'}
          </button>
        </div>
      </div>
    </div>
  );
}
