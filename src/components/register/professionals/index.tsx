// Ruta: src/components/register/professionals/index.tsx

import React from 'react';
import { auth } from '../../../services/firebase';
import { useProfessionalRegister } from './useProfessionalRegister';
import ProfessionalBasicDataForm from './ProfessionalBasicDataForm';
import ProfessionalClinicDataForm from './ProfessionalClinicDataForm';

export default function ProfessionalRegister() {
  const {
    step,
    saving,
    errorMsg,
    formData,
    professions,
    handleChange,
    handleNextStep,
    handleBack,
    handleSubmit,
  } = useProfessionalRegister();

  // --- ESTILOS DE ALTO CONTRASTE ---
  const containerStyle = {
    maxWidth: '500px',
    margin: '40px auto',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
    backgroundColor: '#FFFFFF',
    fontFamily: 'sans-serif',
  };

  return (
    <div style={containerStyle}>
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

      {/* ================= PASO 1: DATOS PERSONALES Y LEGALES ================= */}
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
            Perfil Clínico
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#334155',
              fontSize: '15px',
              marginBottom: '25px',
            }}
          >
            Paso 1 de 2: Identificación profesional
          </p>

          <ProfessionalBasicDataForm
            formData={formData}
            professions={professions}
            onChange={handleChange}
            onNext={handleNextStep}
          />
        </>
      )}

      {/* ================= PASO 2: DIRECTORIO PÚBLICO ================= */}
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
            Directorio Público
          </h2>
          <p
            style={{
              textAlign: 'center',
              color: '#334155',
              fontSize: '15px',
              marginBottom: '25px',
            }}
          >
            Paso 2 de 2: Datos de contacto para pacientes
          </p>

          <ProfessionalClinicDataForm
            formData={formData}
            saving={saving}
            onChange={handleChange}
            onBack={handleBack}
            onSubmit={handleSubmit}
          />
        </>
      )}

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
          Cancelar Registro / Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
