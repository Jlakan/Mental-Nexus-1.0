// src/components/PatientFilterBar.tsx

interface PatientFilterBarProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  sortBy: string;
  setSortBy: (sort: string) => void;
}

export default function PatientFilterBar({
  searchTerm,
  setSearchTerm,
  activeFilter,
  setActiveFilter,
  sortBy,
  setSortBy
}: PatientFilterBarProps) {
  
  const filters = [
    { id: 'all', label: 'Todos' },
    { id: 'upcoming_appt', label: '📅 Con cita' },
    { id: 'needs_attention', label: '⚠️ Atención requerida' }
  ];

  const sortOptions = [
    { id: 'name_asc', label: 'Nombre (A-Z)' },
    { id: 'appt_closest', label: 'Cita más próxima' },
    { id: 'level_desc', label: 'Nivel (Mayor a Menor)' }
  ];

  return (
    <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex flex-col md:flex-row gap-4 justify-between items-center mb-6 shadow-lg">
      
      {/* Búsqueda por Texto */}
      <div className="w-full md:w-1/3 relative flex-shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
        <input
          type="text"
          placeholder="Buscar paciente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-4 py-2 text-white text-sm focus:border-nexus-cyan outline-none transition-colors"
        />
      </div>

      {/* Filtros Rápidos (Píldoras) */}
      <div className="flex gap-2 w-full md:w-auto overflow-x-auto custom-scrollbar pb-2 md:pb-0">
        {filters.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
              activeFilter === f.id 
                ? 'bg-nexus-cyan text-black shadow-[0_0_10px_rgba(34,211,238,0.3)]' 
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Menú de Ordenamiento */}
      <div className="w-full md:w-auto flex items-center gap-2 flex-shrink-0">
        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider hidden sm:inline">Ordenar:</span>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full sm:w-auto bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-nexus-cyan outline-none cursor-pointer"
        >
          {sortOptions.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}