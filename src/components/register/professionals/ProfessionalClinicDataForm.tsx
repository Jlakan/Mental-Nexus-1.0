// Ruta: src/components/register/professionals/ProfessionalClinicDataForm.tsx

import React from 'react';

interface FormData {
  clinicName: string;
  clinicCity: string;
  clinicAddress: string;
  publicPhone: string;
  mapsUrl: string;
  facebookUrl: string;
  instagramUrl: string;
}

interface Props {
  formData: FormData;
  saving: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function ProfessionalClinicDataForm({
  formData,
  saving,
  onChange,
  onBack,
  onSubmit,
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

  const optionalLabelStyle = {
    ...labelStyle,
    color: '#475569', // Un gris un poco más suave para diferenciar lo opcional
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
    >
      <div>
        <label style={labelStyle}>Nombre de la Clínica o Consultorio</label>
        <input
          type="text"
          name="clinicName"
          required
          value={formData.clinicName}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. Centro Regional de Desarrollo Infantil"
        />
      </div>

      <div>
        <label style={labelStyle}>Ciudad y Estado</label>
        <input
          type="text"
          name="clinicCity"
          required
          value={formData.clinicCity}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. Durango, Dgo."
        />
      </div>

      <div>
        <label style={labelStyle}>
          Dirección de Consulta (Calle, Núm, Col)
        </label>
        <input
          type="text"
          name="clinicAddress"
          required
          value={formData.clinicAddress}
          onChange={onChange}
          style={inputStyle}
          placeholder="Ej. Av. 20 de Noviembre #102, Zona Centro"
        />
      </div>

      <div>
        <label style={optionalLabelStyle}>
          Teléfono de Contacto (Público) - Opcional
        </label>
        <input
          type="tel"
          name="publicPhone"
          value={formData.publicPhone}
          onChange={onChange}
          style={inputStyle}
          placeholder="Teléfono para agendar citas"
        />
      </div>

      <div
        style={{
          marginTop: '10px',
          padding: '15px',
          backgroundColor: '#F8FAFC',
          border: '2px dashed #94A3B8',
          borderRadius: '8px',
        }}
      >
        <h4
          style={{ margin: '0 0 15px 0', color: '#000000', fontSize: '15px' }}
        >
          Redes y Enlaces (Opcional)
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={optionalLabelStyle}>
              Ubicación en Google Maps (URL)
            </label>
            <input
              type="url"
              name="mapsUrl"
              value={formData.mapsUrl}
              onChange={onChange}
              style={inputStyle}
              placeholder="https://maps.app.goo.gl/..."
            />
          </div>
          <div>
            <label style={optionalLabelStyle}>Facebook (URL)</label>
            <input
              type="url"
              name="facebookUrl"
              value={formData.facebookUrl}
              onChange={onChange}
              style={inputStyle}
              placeholder="https://facebook.com/..."
            />
          </div>
          <div>
            <label style={optionalLabelStyle}>Instagram (URL)</label>
            <input
              type="url"
              name="instagramUrl"
              value={formData.instagramUrl}
              onChange={onChange}
              style={inputStyle}
              placeholder="https://instagram.com/..."
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
        <button
          type="button"
          onClick={onBack}
          disabled={saving}
          style={{
            flex: '1',
            padding: '14px',
            fontSize: '16px',
            cursor: saving ? 'not-allowed' : 'pointer',
            backgroundColor: '#E2E8F0',
            color: '#0F172A',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            opacity: saving ? 0.7 : 1,
          }}
        >
          🡠 Volver
        </button>

        <button
          type="submit"
          disabled={saving}
          style={{
            flex: '2',
            padding: '14px',
            fontSize: '16px',
            cursor: saving ? 'not-allowed' : 'pointer',
            backgroundColor: '#16A34A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Registrando...' : 'Solicitar Alta de Perfil'}
        </button>
      </div>
    </form>
  );
}
