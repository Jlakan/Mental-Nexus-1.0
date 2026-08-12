// Ruta: src/components/register/patients/ProfessionalResultCard.tsx

interface ProfessionalData {
  id: string;
  fullName: string;
  clinicName?: string;
  clinicAddress?: string;
  clinicCity?: string;
  publicPhone?: string;
  links?: {
    maps?: string;
    facebook?: string;
    instagram?: string;
  };
}

interface Props {
  professional: ProfessionalData;
  onLink: () => void;
}

export default function ProfessionalResultCard({
  professional,
  onLink,
}: Props) {
  // --- ESTILOS DE ALTO CONTRASTE ---
  const linkBadgeStyle = {
    display: 'inline-block',
    padding: '4px 8px',
    backgroundColor: '#E2E8F0',
    color: '#1E293B',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    textDecoration: 'none',
    border: '1px solid #94A3B8',
  };

  return (
    <div
      style={{
        border: '2px solid #000000',
        borderRadius: '8px',
        padding: '16px',
        backgroundColor: '#F8FAFC',
      }}
    >
      <h4
        style={{
          margin: '0 0 10px 0',
          color: '#000000',
          fontSize: '18px',
          fontWeight: 'bold',
        }}
      >
        {professional.fullName}
      </h4>

      <div
        style={{
          color: '#000000',
          fontSize: '14px',
          lineHeight: '1.5',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <p style={{ margin: 0 }}>
          <strong>Clínica / Marca:</strong>{' '}
          {professional.clinicName || 'Consultorio Privado'}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Dirección:</strong>{' '}
          {professional.clinicAddress || 'Atención Online'}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Ciudad:</strong>{' '}
          {professional.clinicCity || 'No especificada'}
        </p>
        {professional.publicPhone && (
          <p style={{ margin: 0 }}>
            <strong>Teléfono de contacto:</strong> {professional.publicPhone}
          </p>
        )}
      </div>

      {/* ENLACES EXTERNOS DE LA CLÍNICA */}
      {professional.links &&
        Object.values(professional.links).some((link) => link) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              marginTop: '12px',
              marginBottom: '12px',
            }}
          >
            {professional.links.maps && (
              <a
                href={professional.links.maps}
                target="_blank"
                rel="noreferrer"
                style={linkBadgeStyle}
              >
                📍 Ubicación en Maps
              </a>
            )}
            {professional.links.facebook && (
              <a
                href={professional.links.facebook}
                target="_blank"
                rel="noreferrer"
                style={linkBadgeStyle}
              >
                📘 Facebook
              </a>
            )}
            {professional.links.instagram && (
              <a
                href={professional.links.instagram}
                target="_blank"
                rel="noreferrer"
                style={linkBadgeStyle}
              >
                📸 Instagram
              </a>
            )}
          </div>
        )}

      <button
        onClick={onLink}
        style={{
          width: '100%',
          marginTop: '4px',
          padding: '12px',
          backgroundColor: '#16A34A',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontWeight: 'bold',
          fontSize: '14px',
        }}
      >
        Solicitar Vinculación
      </button>
    </div>
  );
}
