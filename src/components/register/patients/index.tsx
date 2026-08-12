// Ruta: src/components/register/patients/index.tsx

import { auth } from '../../../services/firebase';
import { usePatientRegister } from './usePatientRegister';
import PatientBasicDataForm from './PatientBasicDataForm';
import ProfessionalSearchForm from './ProfessionalSearchForm';
import ProfessionalResultCard from './ProfessionalResultCard';

interface Props {
  onComplete: () => void;
}

export default function PatientRegister({ onComplete }: Props) {
  const {
    step,
    saving,
    errorMsg,
    formData,
    professions,
    selectedProfession,
    setSelectedProfession,
    searchName,
    setSearchName,
    searchResults,
    hasSearched,
    handleDataChange,
    handleRegisterData,
    handleSearchProfessional,
    handleLinkProfessional,
    handleSkip,
  } = usePatientRegister(onComplete);

  // --- ESTILOS DE ALTO CONTRASTE (Estructura base del contenedor) ---
  const containerStyle = {
    maxWidth: '480px',
    margin: '40px auto',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
    backgroundColor: '#FFFFFF',
    fontFamily: 'sans-serif',
  };

  return (
    <div style={containerStyle}>
      {/* Mensajes de error globales del flujo */}
      {errorMsg && (
        <div
          style={{
            backgroundColor: '#FEE2E2',
            color: '#991B1B',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px',
            textAlign: 'center',
            border: '2px solid #EF4444',
            fontWeight: 'bold',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ================= PASO 1: REGISTRO DE DATOS BÁSICOS ================= */}
      {step === 1 && (
        <>
          <h2
            style={{
              textAlign: 'center',
              color: '#000000',
              marginBottom: '5px',
              fontSize: '26px',
              fontWeight: 'bold',
            }}
          >
            Crear Perfil
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#334155',
              fontSize: '15px',
              marginBottom: '25px',
            }}
          >
            Paso 1 de 2: Datos de identificación
          </p>

          <PatientBasicDataForm
            formData={formData}
            saving={saving}
            onChange={handleDataChange}
            onSubmit={handleRegisterData}
          />
        </>
      )}

      {/* ================= PASO 2: BÚSQUEDA Y VINCULACIÓN ================= */}
      {step === 2 && (
        <>
          <h2
            style={{
              textAlign: 'center',
              color: '#000000',
              marginBottom: '5px',
              fontSize: '26px',
              fontWeight: 'bold',
            }}
          >
            Encuentra tu Especialista
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#334155',
              fontSize: '15px',
              marginBottom: '25px',
            }}
          >
            Paso 2 de 2: Selección de consulta
          </p>

          <ProfessionalSearchForm
            professions={professions}
            selectedProfession={selectedProfession}
            setSelectedProfession={setSelectedProfession}
            searchName={searchName}
            setSearchName={setSearchName}
            saving={saving}
            onSubmit={handleSearchProfessional}
          />

          {/* CONTENEDOR LOCAL DE RESULTADOS (Se renderiza si ya se ejecutó una búsqueda) */}
          {hasSearched && (
            <div
              style={{
                marginTop: '20px',
                borderTop: '2px solid #334155',
                paddingTop: '15px',
              }}
            >
              {searchResults.length === 0 ? (
                <p
                  style={{
                    textAlign: 'center',
                    color: '#334155',
                    fontSize: '14px',
                    fontWeight: 'bold',
                  }}
                >
                  No se encontraron profesionales registrados en esta zona o
                  especialidad.
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  }}
                >
                  {searchResults.map((prof) => (
                    <ProfessionalResultCard
                      key={prof.id}
                      professional={prof}
                      onLink={() => handleLinkProfessional(prof)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'none',
                border: 'none',
                color: '#334155',
                textDecoration: 'underline',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 'bold',
              }}
            >
              Omitir este paso por ahora
            </button>
          </div>
        </>
      )}

      {/* PIE DE PÁGINA GLOBAL DE NAVEGACIÓN */}
      <div
        style={{
          marginTop: '30px',
          textAlign: 'center',
          borderTop: '2px solid #334155',
          paddingTop: '15px',
        }}
      >
        <button
          onClick={() => auth.signOut()}
          style={{
            background: 'none',
            border: 'none',
            color: '#DC2626',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            textDecoration: 'underline',
          }}
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
