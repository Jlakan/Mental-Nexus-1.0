// Ruta: src/components/register/professionals/ProfessionalBasicDataForm.tsx

import React from 'react';

interface Profession {
  id: string;
  name: string;
}

interface FormData {
  fullName: string;
  license: string;
  phone: string;
  professionId: string;
}

interface Props {
  formData: FormData;
  professions: Profession[];
  onChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  onNext: (e: React.FormEvent) => void;
}

export default function ProfessionalBasicDataForm({
  formData,
  professions,
  onChange,
  onNext,
}: Props) {
  // --- ESTILOS DE ALTO CONTRASTE ---
  const inputStyle = {
    width: '100%',
    padding: '12px',
    borderRadius: '6px',
    border: '2px solid #334155',
    backgroundColor: '#FFFFFF',
    color: '#000000',
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
      onSubmit={onNext}
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      <div>
        <label style={labelStyle}>Nombre Completo (Con título)</label>
        <input
          type="text"
          name="fullName"
          required
          value={formData.fullName}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. Psic. Alejandro Martínez"
        />
      </div>

      <div>
        <label style={labelStyle}>Cédula Profesional</label>
        <input
          type="text"
          name="license"
          required
          value={formData.license}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. 12345678"
        />
      </div>

      <div>
        <label style={labelStyle}>
          Celular Personal (No visible para pacientes)
        </label>
        <input
          type="tel"
          name="phone"
          required
          value={formData.phone}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. 6181234567"
        />
      </div>

      <div>
        <label style={labelStyle}>Especialidad Clínica</label>
        <select
          name="professionId"
          required
          value={formData.professionId}
          onChange={onChange}
          style={inputStyle}
        >
          <option value="">-- Selecciona tu área --</option>
          {professions.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.charAt(0).toUpperCase() + p.name.slice(1)}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        style={{
          marginTop: '10px',
          padding: '14px',
          fontSize: '16px',
          cursor: 'pointer',
          backgroundColor: '#0284C7',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
        }}
      >
        Continuar al Directorio ➔
      </button>
    </form>
  );
}
