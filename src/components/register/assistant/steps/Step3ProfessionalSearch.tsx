import React, { useMemo } from 'react';

// Definimos la interfaz del profesional que viene del índice
export interface IndexedProfessional {
  UID: string;
  fullName: string;
  clinicName: string;
  clinicAddress: string;
  publicPhone: string;
}

interface Step3ProfessionalSearchProps {
  professionalsIndex: IndexedProfessional[];
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  selectedProfUID: string | null;
  setSelectedProfUID: (val: string | null) => void;
  loading: boolean;
  onSubmit: () => void;
  onChangeSpecialty: () => void;
}

export default function Step3ProfessionalSearch({
  professionalsIndex,
  searchTerm,
  setSearchTerm,
  selectedProfUID,
  setSelectedProfUID,
  loading,
  onSubmit,
  onChangeSpecialty,
}: Step3ProfessionalSearchProps) {
  // Filtro en memoria: Se activa solo si hay 5 o más letras
  const filteredProfessionals = useMemo(() => {
    if (searchTerm.length < 5) return [];

    const term = searchTerm.toLowerCase();
    return professionalsIndex.filter((prof) => {
      const fullName = prof.fullName?.toLowerCase() || '';
      const clinicName = prof.clinicName?.toLowerCase() || '';
      const clinicAddress = prof.clinicAddress?.toLowerCase() || '';

      return (
        fullName.includes(term) ||
        clinicName.includes(term) ||
        clinicAddress.includes(term)
      );
    });
  }, [searchTerm, professionalsIndex]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <label className="block text-xs font-bold text-purple-300 uppercase mb-1">
          Buscar Profesional
        </label>
        <p className="text-[10px] text-slate-400 mb-2">
          Escribe al menos 5 letras del nombre, clínica o dirección.
        </p>
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setSelectedProfUID(null);
          }}
          placeholder="Ej. Oscar Rodríguez..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition-colors"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2 pr-2 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
        {searchTerm.length >= 5 ? (
          filteredProfessionals.length > 0 ? (
            filteredProfessionals.map((prof) => (
              <div
                key={prof.UID}
                onClick={() => setSelectedProfUID(prof.UID)}
                className={`p-3 rounded-lg cursor-pointer border transition-all ${
                  selectedProfUID === prof.UID
                    ? 'bg-purple-900/50 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                }`}
              >
                <div className="text-white font-bold text-sm">
                  {prof.fullName}
                </div>
                <div className="text-slate-400 text-xs">{prof.clinicName}</div>
                <div className="text-slate-500 text-[10px] mt-1 line-clamp-1">
                  {prof.clinicAddress}
                </div>
              </div>
            ))
          ) : (
            <div className="text-slate-400 text-center text-sm py-4 bg-slate-950/50 rounded-lg border border-dashed border-slate-700">
              No se encontraron resultados.
            </div>
          )
        ) : (
          <div className="text-slate-500 text-center text-xs py-4 bg-slate-950/50 rounded-lg border border-dashed border-slate-800">
            Sigue escribiendo para buscar...
          </div>
        )}
      </div>

      <button
        onClick={onSubmit}
        disabled={loading || !selectedProfUID}
        className={`w-full py-4 rounded-lg font-bold uppercase tracking-wider transition-all shadow-lg ${
          selectedProfUID && !loading
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:scale-[1.02]'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Enviando Solicitud...' : 'Solicitar Vinculación'}
      </button>

      <div className="text-center mt-4">
        <button
          onClick={() => {
            setSearchTerm('');
            setSelectedProfUID(null);
            onChangeSpecialty();
          }}
          className="text-sm text-slate-400 hover:text-white underline transition-colors"
        >
          Cambiar Especialidad
        </button>
      </div>
    </div>
  );
}
