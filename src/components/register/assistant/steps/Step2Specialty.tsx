import React, { useMemo } from 'react';
import type { SpecialtyData } from '../hooks/useAssistantRegister';

// Diccionario visual: Mapea el ID de la base de datos con un emoji.
// Si agregas una especialidad nueva a BD que no está aquí, usará el fallback '🏥'
const ICON_MAP: Record<string, string> = {
  psicologia: '🧠',
  nutricion: '🥗',
  fisioterapia: '🏃',
  medicina: '🩺',
  odontologia: '🦷',
  psiquiatria: '🧩',
  pediatria: '👶',
  ginecologia: '🌸',
};

interface Step2SpecialtyProps {
  loading: boolean;
  loadingSpecialties: boolean;
  availableSpecialties: SpecialtyData[];
  specialtySearch: string;
  setSpecialtySearch: (val: string) => void;
  onSelectSpecialty: (specialtyId: string) => void;
  onBack: () => void;
}

export default function Step2Specialty({
  loading,
  loadingSpecialties,
  availableSpecialties,
  specialtySearch,
  setSpecialtySearch,
  onSelectSpecialty,
  onBack,
}: Step2SpecialtyProps) {
  // Filtra la lista dinámica obtenida de Firestore
  const filteredSpecialties = useMemo(() => {
    const term = specialtySearch.toLowerCase();
    return availableSpecialties.filter(
      (s) =>
        s.name.toLowerCase().includes(term) || s.id.toLowerCase().includes(term)
    );
  }, [specialtySearch, availableSpecialties]);

  const handleSelect = (id: string) => {
    onSelectSpecialty(id);
    setSpecialtySearch('');
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <h3 className="text-white font-bold text-center">
        ¿En qué área trabajarás?
      </h3>

      {loading || loadingSpecialties ? (
        <div className="text-purple-400 py-8 animate-pulse font-semibold tracking-wider text-center">
          Cargando áreas disponibles...
        </div>
      ) : (
        <>
          {/* Si no hay búsqueda, mostramos todas en formato de botones grandes */}
          {specialtySearch.length === 0 && (
            <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
              {availableSpecialties.map((spec) => (
                <button
                  key={spec.id}
                  onClick={() => handleSelect(spec.id)}
                  className="p-4 bg-slate-800 border border-slate-700 rounded-xl hover:border-purple-500 text-white transition-all hover:bg-slate-800/80 hover:scale-[1.02] flex flex-col items-center justify-center text-center"
                >
                  <div className="text-2xl mb-1">
                    {ICON_MAP[spec.id] || '🏥'}
                  </div>
                  <div className="text-xs font-semibold capitalize">
                    {spec.name}
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="pt-2">
            <div className="relative">
              <input
                type="text"
                value={specialtySearch}
                onChange={(e) => setSpecialtySearch(e.target.value)}
                placeholder="Buscar especialidad..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 pl-10 text-white text-sm focus:border-purple-500 outline-none transition-colors"
              />
              <span className="absolute left-3 top-3 text-slate-500">🔍</span>
            </div>

            {/* Resultados de la búsqueda */}
            {specialtySearch.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin scrollbar-thumb-purple-900 scrollbar-track-transparent">
                {filteredSpecialties.length > 0 ? (
                  filteredSpecialties.map((spec) => (
                    <button
                      key={spec.id}
                      onClick={() => handleSelect(spec.id)}
                      className="w-full text-left p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-white text-sm transition-colors flex items-center gap-2"
                    >
                      <span>{ICON_MAP[spec.id] || '🏥'}</span>
                      <span className="capitalize">{spec.name}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-slate-500 text-xs text-center py-3 bg-slate-950/50 rounded-lg border border-dashed border-slate-800">
                    No hay especialidades registradas con ese nombre.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      <button
        onClick={() => {
          setSpecialtySearch('');
          onBack();
        }}
        className="text-sm text-slate-400 hover:text-white underline mt-2 transition-colors w-full text-center"
      >
        Volver
      </button>
    </div>
  );
}
