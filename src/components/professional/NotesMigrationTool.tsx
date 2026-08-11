// src/components/professional/NotesMigrationTool.tsx
import { useState } from 'react';
import {
  collection,
  getDocs,
  doc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';

export default function NotesMigrationTool() {
  const [isOpen, setIsOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [stats, setStats] = useState({ processed: 0, total: 0, copied: 0 });
  const [logs, setLogs] = useState<string[]>([]);

  const runMigration = async () => {
    if (
      !window.confirm(
        '⚠️ ¿Comenzar duplicación de Notas?\n\nEsto copiará el mapa de notas desde los expedientes hacia tu repositorio privado. No se borrará nada de la ruta original.'
      )
    )
      return;

    setRunning(true);
    setLogs(['🚀 Inicializando motor de clonación...']);

    try {
      const patientsSnap = await getDocs(collection(db, 'patients'));
      const total = patientsSnap.size;
      setStats({ processed: 0, total, copied: 0 });

      let copiedCount = 0;
      let idx = 0;
      let batch = writeBatch(db);
      let ops = 0;

      for (const pDoc of patientsSnap.docs) {
        idx++;
        setStats((s) => ({ ...s, processed: idx }));

        const pId = pDoc.id;
        const pData = pDoc.data();

        // Consultar la subcolección antigua
        const oldNotesSnap = await getDocs(
          collection(db, 'patients', pId, 'clinicalNotes')
        );

        if (!oldNotesSnap.empty) {
          setLogs((l) => [
            ...l,
            `Leyendo: ${pData.fullName || pId} (${
              oldNotesSnap.size
            } registros de profesionales)`,
          ]);

          for (const nDoc of oldNotesSnap.docs) {
            const nData = nDoc.data();

            // ¡CLAVE! En tu estructura, el ID del documento es el ID del Profesional
            const profId = nDoc.id;

            // Extraemos el mapa exacto que me mostraste en la imagen
            const notasMap = nData.notas || {};

            // Si el mapa de notas está vacío, no tiene caso copiar el documento
            if (Object.keys(notasMap).length === 0) continue;

            // Nueva ruta: professionals/{profId}/clinical_notes/{pId}
            const newNoteRef = doc(
              db,
              'professionals',
              profId,
              'clinical_notes',
              pId
            );

            // Guardamos el documento conservando el mapa de notas por fechas
            batch.set(
              newNoteRef,
              {
                patientId: pId,
                patientName: pData.fullName || 'Sin Nombre',
                notas: notasMap, // 👈 Aquí pasamos el mapa intacto
                lastUpdated: nData.lastUpdated || serverTimestamp(),
                migratedAt: serverTimestamp(),
                isMigratedCopy: true,
              },
              { merge: true }
            );

            copiedCount++;
            ops++;
            setStats((s) => ({ ...s, copied: copiedCount }));

            // Respetar el límite de operaciones de Firebase por bloque
            if (ops >= 400) {
              await batch.commit();
              batch = writeBatch(db);
              ops = 0;
            }
          }
        }
      }

      if (ops > 0) await batch.commit();
      setLogs((l) => [
        ...l,
        '🎉 ¡Proceso finalizado! Los mapas de notas se copiaron con éxito a las rutas de los profesionales.',
      ]);
    } catch (e: any) {
      console.error(e);
      setLogs((l) => [...l, `❌ Error crítico: ${e.message}`]);
    } finally {
      setRunning(false);
    }
  };

  return (
    <>
      {/* Botón flotante discreto */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold py-2 px-4 rounded-full shadow-2xl transition-all flex items-center gap-1 z-50"
      >
        ⚙️ Migrar Notas
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[9999] p-4 font-sans backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-xl p-6 shadow-2xl flex flex-col max-h-[85vh] text-slate-200">
            <div className="flex justify-between items-start border-b border-slate-700 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-amber-400 uppercase tracking-wider">
                  Migrador de Notas Clínicas (Mapa)
                </h3>
                <p className="text-slate-400 text-xs mt-0.5">
                  Clona el campo 'notas' desde el paciente hacia el profesional.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                disabled={running}
                className="text-slate-400 hover:text-white text-xl font-bold"
              >
                &times;
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center my-2">
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Expedientes
                </div>
                <div className="text-lg font-black text-white mt-0.5">
                  {stats.processed} / {stats.total}
                </div>
              </div>
              <div className="bg-slate-950 p-2.5 rounded border border-slate-800">
                <div className="text-[10px] text-slate-500 font-bold uppercase">
                  Documentos Copiados
                </div>
                <div className="text-lg font-black text-cyan-400 mt-0.5">
                  {stats.copied}
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={runMigration}
                  disabled={running}
                  className={`w-full py-2.5 rounded text-xs uppercase font-black tracking-wider transition-colors ${
                    running
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed animate-pulse'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {running ? 'Copiando...' : '🚀 Iniciar'}
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 rounded p-3 font-mono text-[10px] overflow-y-auto space-y-1 h-48 border border-slate-800 mt-3 text-slate-300 custom-scrollbar">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.startsWith('❌')
                      ? 'text-red-400 font-bold'
                      : log.startsWith('🎉')
                      ? 'text-green-400 font-bold'
                      : ''
                  }
                >
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
