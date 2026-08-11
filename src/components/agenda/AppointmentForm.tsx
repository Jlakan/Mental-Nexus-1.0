//src/components/agenda/AppointmentForm.tsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import ModalPortal from '../ModalPortal';

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  selectedDate: Date;
  slotTime: string;
  formData: {
    patientId: string;
    patientName: string;
    patientExternalPhone: string;
    patientExternalEmail: string;
    price: number;
    adminNotes: string;
    paymentStatus: string;
    paymentMethod: string;
  };
  setFormData: (data: any) => void;
  patients: any[];
  savePricePreference: boolean;
  setSavePricePreference: (val: boolean) => void;
  selectedPatientNoShows: number;
  onPatientSelect: (id: string, name: string) => void;
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({
  isOpen,
  onClose,
  onSave,
  selectedDate,
  slotTime,
  formData,
  setFormData,
  patients,
  selectedPatientNoShows,
  onPatientSelect,
}) => {
  // ESTADOS LOCALES
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar el nombre si estamos editando una cita ya existente
  useEffect(() => {
    if (formData.patientName) {
      setSearchQuery(formData.patientName);
    } else {
      setSearchQuery('');
    }
  }, [formData.patientName, isOpen]);

  // Cerrar el buscador predictivo al hacer clic afuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // FILTRADO EN TIEMPO REAL: ¡AQUÍ ESTÁ LA CORRECCIÓN!
  // Los Hooks siempre deben ir ANTES de cualquier "return" temprano.
  const filteredPatients = useMemo(() => {
    if (!searchQuery.trim()) return patients;
    const lowerQuery = searchQuery.toLowerCase();
    return patients.filter((p) =>
      (p.fullName || p.name || '').toLowerCase().includes(lowerQuery)
    );
  }, [patients, searchQuery]);

  // AHORA SÍ, EL RETURN TEMPRANO
  if (!isOpen) return null;

  // Lógica de fechas y horas
  let appointmentDate = dayjs(selectedDate);
  let hours = 0;
  let minutes = 0;

  if (slotTime) {
    if (slotTime.includes(':')) {
      const parts = slotTime.split(':');
      hours = parseInt(parts[0], 10) || 0;
      minutes = parseInt(parts[1], 10) || 0;
    } else {
      hours = parseInt(slotTime.slice(0, 2), 10) || 0;
      minutes = parseInt(slotTime.slice(2, 4), 10) || 0;
    }
  }
  appointmentDate = appointmentDate.hour(hours).minute(minutes);

  const formattedDate = appointmentDate.format('D [de] MMMM [de] YYYY');
  const timeLabel = appointmentDate.format('h:mm A');

  return (
    <ModalPortal>
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex justify-center items-center z-[120] p-4 transition-all">
        <div className="bg-[#050810] border border-cyan-500/30 p-6 rounded-xl w-full max-w-md shadow-[0_0_40px_rgba(34,211,238,0.1)] max-h-[90vh] overflow-y-auto custom-scrollbar relative">
          <div className="mb-6 border-b border-cyan-900/50 pb-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] tracking-wide">
                {formData.patientId ? '⚡ Editar Cita' : '⚡ Nueva Cita'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-600 hover:text-red-400 transition-colors text-2xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-4 shadow-[inset_0_0_15px_rgba(34,211,238,0.1)]">
              <p className="text-cyan-100 text-sm md:text-base font-medium leading-relaxed">
                Asignando cita para el{' '}
                <span className="text-cyan-400 font-bold">{formattedDate}</span>{' '}
                a las{' '}
                <span className="text-amber-400 font-black drop-shadow-[0_0_5px_rgba(217,119,6,0.4)]">
                  {timeLabel}
                </span>
                .
              </p>
            </div>
          </div>

          <form onSubmit={onSave} className="space-y-5">
            <div
              className="p-3 bg-cyan-950/10 border border-cyan-900/30 rounded-lg shadow-inner relative"
              ref={dropdownRef}
            >
              <label className="block text-[10px] font-bold text-cyan-600/80 mb-2 tracking-widest uppercase">
                Buscar Paciente por Nombre
              </label>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Escribe el nombre para buscar..."
                  value={searchQuery}
                  onFocus={() => setIsDropdownOpen(true)}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setIsDropdownOpen(true);
                    if (formData.patientId) {
                      onPatientSelect('', '');
                    }
                  }}
                  className="w-full bg-[#0a0f18] text-white placeholder-slate-600 border border-cyan-900/50 rounded-md p-2.5 outline-none focus:border-cyan-400 font-medium"
                />
                <span className="absolute right-3 top-3 opacity-40 text-sm">
                  🔍
                </span>
              </div>

              {isDropdownOpen && (
                <div className="absolute left-0 right-0 mt-1 bg-[#090d16] border border-cyan-900 rounded-md shadow-2xl max-h-48 overflow-y-auto z-50 custom-scrollbar">
                  {filteredPatients.length === 0 ? (
                    <div className="p-3 text-xs text-slate-500 italic">
                      ❌ No hay coincidencias en tu directorio.
                    </div>
                  ) : (
                    filteredPatients.map((p) => {
                      const name = p.fullName || p.name || 'Sin Nombre';
                      const isSelected = p.id === formData.patientId;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            onPatientSelect(p.id, name);
                            setSearchQuery(name);
                            setIsDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2.5 text-xs transition-colors flex justify-between items-center cursor-pointer ${
                            isSelected
                              ? 'bg-cyan-950/50 text-nexus-cyan font-bold'
                              : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                          }`}
                        >
                          <span>{name}</span>
                          {p.email && (
                            <span className="text-[10px] opacity-40">
                              {p.email}
                            </span>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

              <div className="mt-2 flex justify-between items-center">
                <span className="text-[10px] text-slate-500 italic">
                  *Búsqueda exclusiva en tu Directorio activo.
                </span>
                {formData.patientId ? (
                  <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-1 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-900/50">
                    ✓ Vinculado correctamente
                  </span>
                ) : searchQuery.trim() !== '' ? (
                  <span className="text-[10px] font-bold text-amber-500 flex items-center gap-1 bg-amber-950/30 px-2 py-0.5 rounded border border-amber-900/50">
                    ⚠️ Selecciona de la lista
                  </span>
                ) : null}
              </div>
            </div>

            {selectedPatientNoShows > 0 && (
              <div className="text-xs font-bold text-amber-500 bg-[#1a120d] border border-amber-900/50 p-3 rounded-md flex items-center gap-3 shadow-[inset_0_0_10px_rgba(120,53,15,0.2)]">
                <span className="text-xl">⚠️</span>
                <div>
                  <span className="text-amber-400">Atención:</span> El paciente
                  registra{' '}
                  <span className="text-red-400">
                    {selectedPatientNoShows} inasistencias
                  </span>
                  .
                </div>
              </div>
            )}

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-emerald-600/80 mb-1.5 tracking-widest uppercase">
                  Precio ($)
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData({ ...formData, price: Number(e.target.value) })
                  }
                  className="w-full bg-[#0a0f18] text-emerald-400 font-bold border border-emerald-900/50 rounded-md p-2.5 outline-none focus:border-emerald-400"
                />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-cyan-600/80 mb-1.5 tracking-widest uppercase">
                  Método de Pago
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) =>
                    setFormData({ ...formData, paymentMethod: e.target.value })
                  }
                  className="w-full bg-[#0a0f18] text-cyan-300 border border-cyan-900/50 rounded-md p-2.5 outline-none cursor-pointer"
                >
                  <option value="cash">💵 Efectivo</option>
                  <option value="transfer">🏦 Transferencia</option>
                  <option value="card">💳 Tarjeta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-cyan-600/80 mb-1.5 tracking-widest uppercase">
                Notas del Sistema
              </label>
              <textarea
                placeholder="Observaciones..."
                value={formData.adminNotes}
                onChange={(e) =>
                  setFormData({ ...formData, adminNotes: e.target.value })
                }
                rows={2}
                className="w-full bg-[#0a0f18] text-cyan-50 border border-cyan-900/50 rounded-md p-2.5 outline-none focus:border-cyan-400 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 mt-6 pt-5 border-t border-cyan-900/30">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 bg-slate-900/50 text-slate-400 hover:text-cyan-50 border border-slate-800 rounded-md transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!formData.patientId}
                className={`px-6 py-2.5 rounded-md font-bold transition-all ${
                  !formData.patientId
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/30'
                    : 'bg-gradient-to-b from-amber-500 to-amber-700 text-white shadow-[0_0_15px_rgba(217,119,6,0.3)] hover:brightness-110 cursor-pointer'
                }`}
              >
                Guardar Cita
              </button>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};

export default AppointmentForm;
