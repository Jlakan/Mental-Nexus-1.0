// Ruta: src/components/register/patients/ProfessionalSearchForm.tsx

import React from 'react';

interface Profession {
  id: string;
  name: string;
}

interface Props {
  professions: Profession[];
  selectedProfession: string;
  setSelectedProfession: (value: string) => void;
  searchName: string;
  setSearchName: (value: string) => void;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProfessionalSearchForm({
  professions,
  selectedProfession,
  setSelectedProfession,
  searchName,
  setSearchName,
  saving,
  onSubmit,
}: Props) {
  // --- ESTILOS DE ALTO CONTRASTE ---
  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '6px',
    border: '2px solid #334155', // Gris pizarra oscuro para visibilidad
    backgroundColor: '#FFFFFF',
    color: '#000000', // Texto negro puro
    fontSize: '16px',
    boxSizing: 'border-box' as const,
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontWeight: 'bold',
    fontSize: '14px',
    color: '#000000',
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        marginBottom: '20px',
      }}
    >
      <div>
        <label style={labelStyle}>Área de Atención (Profesión)</label>
        <select
          value={selectedProfession}
          onChange={(e) => setSelectedProfession(e.target.value)}
          style={inputStyle}
        >
          {professions.length === 0 && (
            <option value="">Cargando áreas...</option>
          )}
          {professions.map((prof) => (
            <option key={prof.id} value={prof.id}>
              {prof.name.charAt(0).toUpperCase() + prof.name.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Nombre del Profesional</label>
        <input
          type="text"
          placeholder="Escribe el apellido o deja en blanco para ver todos"
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          style={inputStyle}
        />
      </div>

      <button
        type="submit"
        disabled={saving || professions.length === 0}
        style={{
          padding: '12px',
          fontSize: '15px',
          cursor:
            saving || professions.length === 0 ? 'not-allowed' : 'pointer',
          backgroundColor: '#0F172A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          opacity: saving || professions.length === 0 ? 0.7 : 1,
        }}
      >
        {saving ? 'Buscando en directorio...' : '🔍 Buscar Especialista'}
      </button>
    </form>
  );
}
