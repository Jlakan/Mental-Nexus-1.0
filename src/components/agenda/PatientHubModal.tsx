// src/components/agenda/PatientHubModal.tsx
import React, { useState, useMemo } from 'react';
import ModalPortal from '../ModalPortal';

interface PatientHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewPatient: () => void;
  onEditPatient: (patient: any) => void; // Función para editar
  patients: any[];
}

export default function PatientHubModal({
  isOpen,
  onClose,
  onOpenNewPatient,
  onEditPatient,
  patients,
}: PatientHubModalProps) {
  const [searchTerm, setSearchTerm] = useState('');

  // Búsqueda optimizada: Solo busca si hay 3 o más caracteres
  const filteredPatients = useMemo(() => {
    const term = searchTerm.trim();
    if (term.length < 3) return []; // Retorna vacío si no hay 3 letras

    const lowerTerm = term.toLowerCase();
    const result = patients.filter(
      (p) =>
        (p.fullName && p.fullName.toLowerCase().includes(lowerTerm)) ||
        (p.contactNumber && p.contactNumber.includes(lowerTerm)) ||
        (p.email && p.email.toLowerCase().includes(lowerTerm))
    );

    return result.sort((a, b) =>
      (a.fullName || '').localeCompare(b.fullName || '')
    );
  }, [searchTerm, patients]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-start pt-20 z-[4000] p-4">
        <div className="bg-slate-900 p-6 rounded-xl w-full max-w-2xl shadow-[0_0_30px_rgba(8,145,178,0.2)] border border-slate-700/50 animate-in slide-in-from-top-10 duration-200 flex flex-col max-h-[80vh]">
          <div className="flex justify-between items-center mb-6 border-b border-cyan-900/50 pb-4">
            <h3 className="m-0 text-cyan-400 font-bold flex items-center gap-2 text-lg">
              <span>👥</span> Directorio de Pacientes
            </h3>
            <button
              onClick={() => {
                onClose();
                onOpenNewPatient();
              }}
              className="px-4 py-2 bg-gradient-to-b from-cyan-600 to-cyan-800 text-white border border-cyan-500 rounded-md font-bold text-sm cursor-pointer transition-all shadow-[0_4px_0_rgb(8,145,178)] active:translate-y-[4px] active:shadow-none hover:brightness-110 flex items-center gap-2"
            >
              <span>➕</span> Registrar Nuevo
            </button>
          </div>

          <div className="mb-4 relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono o correo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 p-3 bg-slate-950/50 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-colors text-lg"
              autoFocus
            />
          </div>

          <div className="flex-1 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-cyan-900/50 scrollbar-track-transparent">
            {searchTerm.trim().length === 0 ? (
              <div className="text-center text-slate-500 py-10 flex flex-col items-center gap-2">
                <span className="text-4xl opacity-50">📂</span>
                <p>
                  Escribe al menos 3 letras para buscar en tus {patients.length}{' '}
                  expedientes.
                </p>
              </div>
            ) : searchTerm.trim().length < 3 ? (
              <div className="text-center text-amber-500/70 py-10">
                Escribe {3 - searchTerm.trim().length} letra(s) más para
                buscar...
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="text-center text-rose-400 py-10">
                No se encontraron pacientes con "{searchTerm}".
              </div>
            ) : (
              <div className="space-y-3">
                {filteredPatients.map((p) => (
                  <div
                    key={p.id}
                    className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50 flex justify-between items-center group hover:border-cyan-500/30 transition-colors"
                  >
                    <div>
                      <h4 className="m-0 text-slate-200 font-bold group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                        {p.fullName}
                      </h4>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          📞{' '}
                          {p.contactNumber || (
                            <span className="text-rose-400">
                              Falta teléfono
                            </span>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          ✉️{' '}
                          {p.email || (
                            <span className="text-slate-600">Sin correo</span>
                          )}
                        </span>
                      </div>
                    </div>
                    <div className="text-right flex flex-col items-end gap-2">
                      <span
                        className={`text-[10px] px-2 py-1 rounded-full uppercase tracking-wider font-bold ${
                          p.status === 'active_with_appt'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : p.status === 'active_no_appt'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}
                      >
                        {p.status === 'active_with_appt'
                          ? 'Con Cita'
                          : p.status === 'active_no_appt'
                          ? 'Sin Cita'
                          : 'Pausado'}
                      </span>
                      {/* BOTÓN DE EDICIÓN: Aquí es donde aparece */}
                      <button
                        onClick={() => {
                          onClose();
                          onEditPatient(p);
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                      >
                        ✏️ Editar Contacto
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-800 flex justify-between items-center">
            <span className="text-xs text-slate-500 font-bold">
              Total de expedientes: {patients.length}
            </span>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-slate-800 text-slate-300 hover:text-white border border-slate-700 rounded-md text-sm cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
