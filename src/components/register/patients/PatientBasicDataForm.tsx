// Ruta: src/components/register/patients/PatientBasicDataForm.tsx

import React from 'react';

interface FormData {
  fullName: string;
  dob: string;
  phone: string;
}

interface Props {
  formData: FormData;
  saving: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PatientBasicDataForm({
  formData,
  saving,
  onChange,
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
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      <div>
        <label style={labelStyle}>Nombre Completo</label>
        <input
          type="text"
          name="fullName"
          required
          value={formData.fullName}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. Juan Pérez"
        />
      </div>

      <div>
        <label style={labelStyle}>Fecha de Nacimiento</label>
        <input
          type="date"
          name="dob"
          required
          value={formData.dob}
          onChange={onChange}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>Teléfono (WhatsApp)</label>
        <input
          type="tel"
          name="phone"
          required
          placeholder="Ej. 6181234567"
          value={formData.phone}
          onChange={onChange}
          style={inputStyle}
        />
      </div>

      <button
        type="submit"
        disabled={saving}
        style={{
          marginTop: '10px',
          padding: '14px',
          fontSize: '16px',
          cursor: saving ? 'not-allowed' : 'pointer',
          backgroundColor: '#0284C7',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 'bold',
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? 'Guardando...' : 'Siguiente Paso ➔'}
      </button>
    </form>
  );
}
