// src/components/agenda/PatientManagerModal.tsx
import React, { useState } from 'react';
import ModalPortal from '../ModalPortal';

export interface PatientFormData {
  fullName: string;
  contactNumber: string;
  email: string;
  attentionType: string;
  consultationReason: string;
}

interface PatientManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: PatientFormData) => Promise<boolean>;
}

export default function PatientManagerModal({
  isOpen,
  onClose,
  onSubmit,
}: PatientManagerModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<PatientFormData>({
    fullName: '',
    contactNumber: '',
    email: '',
    attentionType: 'Presencial', // Valor por defecto
    consultationReason: '',
  });

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      alert('El nombre completo es obligatorio.');
      return;
    }

    setIsSubmitting(true);
    const success = await onSubmit(formData);
    setIsSubmitting(false);

    if (success) {
      // Limpiar el formulario y cerrar
      setFormData({
        fullName: '',
        contactNumber: '',
        email: '',
        attentionType: 'Presencial',
        consultationReason: '',
      });
      onClose();
    }
  };

  return (
    <ModalPortal>
      {/* Overlay Oscuro / Glassmorphism */}
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[5000] p-4">
        {/* Contenedor Principal */}
        <div className="bg-slate-900 p-6 rounded-xl w-full max-w-lg shadow-[0_0_20px_rgba(34,211,238,0.15)] border border-slate-700/50 animate-in fade-in zoom-in-95 duration-200">
          <h3 className="mt-0 mb-5 text-cyan-400 font-bold border-b border-cyan-900/50 pb-3 flex items-center gap-2">
            <span>👤</span> Registrar Nuevo Paciente
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* --- SECCIÓN 1: DATOS PERSONALES --- */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">
                Datos Personales
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Nombre Completo *
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="Ej. Juan Pérez"
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="contactNumber"
                      value={formData.contactNumber}
                      onChange={handleChange}
                      placeholder="Ej. 555-0123"
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="correo@ejemplo.com"
                      className="w-full p-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* --- SECCIÓN 2: CONTEXTO CLÍNICO --- */}
            <div className="bg-slate-950/50 p-4 rounded-lg border border-slate-800">
              <h4 className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-3">
                Contexto Inicial
              </h4>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Tipo de Atención
                  </label>
                  <select
                    name="attentionType"
                    value={formData.attentionType}
                    onChange={handleChange}
                    className="w-full p-2.5 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors appearance-none cursor-pointer"
                  >
                    <option value="Presencial">Presencial</option>
                    <option value="Videollamada">Videollamada</option>
                    <option value="Domicilio">Domicilio</option>
                    <option value="Valoración Inicial">
                      Valoración Inicial
                    </option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
                    Motivo de Consulta (Breve)
                  </label>
                  <textarea
                    name="consultationReason"
                    value={formData.consultationReason}
                    onChange={handleChange}
                    placeholder="¿Por qué acude el paciente?"
                    className="w-full p-3 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors min-h-[80px] custom-scrollbar"
                  />
                </div>
              </div>
            </div>

            {/* --- BOTONERA --- */}
            <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 bg-transparent text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 transition-colors rounded-md text-sm cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-cyan-700 hover:bg-cyan-600 text-white border-none rounded-md font-bold text-sm cursor-pointer transition-all shadow-[0_4px_0_#164e63] active:shadow-none active:translate-y-[4px] disabled:opacity-50 flex items-center gap-2"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar Paciente'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
}
