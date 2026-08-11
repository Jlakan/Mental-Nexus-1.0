//src/components/PatientSelector.tsx
import { useState, useEffect, useRef } from 'react';

interface Props {
  patients: any[];
  selectedPatientId: string;
  manualNameValue: string;
  onSelect: (id: string, name: string) => void;
  onInputChange?: (value: string) => void;
}

export default function PatientSelector({
  patients,
  selectedPatientId,
  manualNameValue,
  onSelect,
  onInputChange,
}: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincronizar input
  useEffect(() => {
    if (selectedPatientId) {
      const p = patients.find((x) => x.id === selectedPatientId);
      if (p) setSearchTerm(p.fullName);
    } else if (manualNameValue) {
      setSearchTerm(manualNameValue);
    } else {
      setSearchTerm('');
    }
  }, [selectedPatientId, manualNameValue, patients]);

  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  const filteredPatients = patients.filter((p) => {
    if (!searchTerm) return true;
    const term = searchTerm
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const name = p.fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    return name.includes(term);
  });

  const handleSelect = (id: string, name: string) => {
    setSearchTerm(name);
    onSelect(id, name);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    setIsOpen(true);
    if (onInputChange) onInputChange(val);
  };

  const showManualOption =
    searchTerm.length >= 3 &&
    !patients.some(
      (p) => p.fullName.toLowerCase() === searchTerm.toLowerCase()
    );

  // Condición: Solo mostrar el dropdown si está abierto y hay al menos 3 letras
  const showDropdown = isOpen && searchTerm.length >= 3;

  return (
    <div ref={wrapperRef} className="relative w-full">
      {/* Etiqueta corregida con clases de Tailwind */}
      <label className="block text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">
        Paciente:
      </label>
      <input
        type="text"
        placeholder="Buscar o escribir nombre nuevo..."
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={() => setIsOpen(true)}
        className="w-full p-3 bg-slate-800 border border-slate-700 hover:border-cyan-500/50 focus:border-cyan-400 rounded-md text-sm text-slate-200 outline-none transition-colors"
        autoComplete="off"
      />

      {showDropdown && (
        <div className="absolute top-full left-0 right-0 bg-slate-900 border border-slate-700 rounded-b-md z-[3000] max-h-[200px] overflow-y-auto shadow-[0_4px_20px_rgba(0,0,0,0.5)] mt-1">
          {filteredPatients.length === 0 && !showManualOption && (
            <div className="p-3 text-slate-400 italic text-sm">
              No se encontraron resultados.
            </div>
          )}

          {filteredPatients.map((p) => (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id, p.fullName)}
              className="p-3 cursor-pointer border-b border-slate-800 bg-slate-900 hover:bg-slate-800 flex items-center gap-3 transition-colors"
            >
              <div className="text-lg">{p.isManual ? '📝' : '📱'}</div>
              <div>
                <div className="font-bold text-slate-200">{p.fullName}</div>
                <div className="text-xs text-slate-400">
                  {p.isManual ? 'Paciente Local' : 'App Verificado'}
                </div>
              </div>
            </div>
          ))}

          {showManualOption && (
            <div
              onClick={() => {
                if (onInputChange) onInputChange(searchTerm);
                onSelect('', searchTerm);
                setIsOpen(false);
              }}
              className="p-3 cursor-pointer bg-cyan-950/30 text-cyan-400 border-t border-cyan-800 font-bold hover:bg-cyan-900/50 transition-colors"
            >
              + Usar como nuevo: "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}
