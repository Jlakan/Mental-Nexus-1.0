import React from 'react';
import ModalPortal from '../ModalPortal';
import PatientSelector from '../PatientSelector';

// Definimos la estructura de los datos que maneja el formulario
interface WaitlistFormData {
  patientId: string;
  patientName: string;
  adminNotes: string;
  [key: string]: any; // Permite las demás propiedades que usa AgendaMain
}

interface WaitlistFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: WaitlistFormData;
  setFormData: (data: any) => void;
  patients: any[];
}

export default function WaitlistFormModal({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  patients,
}: WaitlistFormModalProps) {
  if (!isOpen) return null;

  return (
    <ModalPortal>
      {/* Contenedor con Glassmorphism y la estética Nexus */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[3000] p-4 text-slate-200">
        <div className="bg-slate-900 p-6 rounded-xl w-full max-w-sm shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-slate-700/50 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="mt-0 mb-5 text-cyan-400 font-bold border-b border-cyan-900/50 pb-3 flex items-center gap-2">
            <span>📝</span> Agregar a Lista de Espera
          </h3>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* El PatientSelector ahora maneja su propio espacio sin el recuadro negro extra */}
            <PatientSelector
              patients={patients}
              selectedPatientId={formData.patientId}
              manualNameValue={formData.patientName}
              onSelect={(id, name) =>
                setFormData({ ...formData, patientId: id, patientName: name })
              }
            />

            <div>
              <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                Preferencias / Notas
              </label>
              <textarea
                placeholder="Ej: Solo tardes, requiere valoración urgente..."
                value={formData.adminNotes}
                onChange={(e) =>
                  setFormData({ ...formData, adminNotes: e.target.value })
                }
                className="w-full p-3 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors min-h-[80px] custom-scrollbar"
              />
            </div>

            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-transparent text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors rounded-md text-sm cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white border-none rounded-md font-bold text-sm cursor-pointer transition-all shadow-[0_4px_0_#92400e] active:shadow-none active:translate-y-[4px]"
              >
                Poner en espera
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
