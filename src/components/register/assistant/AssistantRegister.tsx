import React from 'react';
import { useAssistantRegister } from './hooks/useAssistantRegister';
import Step1BasicData from './steps/Step1BasicData';
import Step2Specialty from './steps/Step2Specialty';
import Step3ProfessionalSearch from './steps/Step3ProfessionalSearch';

export default function AssistantRegister() {
  // Extraemos toda la lógica y el estado de nuestro Custom Hook
  const {
    step,
    setStep,
    loading,
    status,
    name,
    setName,
    birthDate,
    setBirthDate,
    phone,
    setPhone,
    specialtySearch,
    setSpecialtySearch,
    setSpecialty,
    availableSpecialties,
    loadingSpecialties,
    professionalsIndex,
    searchTerm,
    setSearchTerm,
    selectedProfUID,
    setSelectedProfUID,
    handleFinalSubmit,
  } = useAssistantRegister();

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 p-8 rounded-2xl shadow-2xl transition-all">
        {/* ENCABEZADO */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🛡️</div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Registro de Asistente
          </h2>

          {/* INDICADORES DE PASO */}
          <div className="flex justify-center gap-2 mt-4">
            <div
              className={`h-2 w-8 rounded-full transition-colors ${
                step >= 1 ? 'bg-purple-500' : 'bg-slate-700'
              }`}
            ></div>
            <div
              className={`h-2 w-8 rounded-full transition-colors ${
                step >= 2 ? 'bg-purple-500' : 'bg-slate-700'
              }`}
            ></div>
            <div
              className={`h-2 w-8 rounded-full transition-colors ${
                step >= 3 ? 'bg-purple-500' : 'bg-slate-700'
              }`}
            ></div>
          </div>
        </div>

        {/* PASO 1: DATOS BÁSICOS */}
        {step === 1 && (
          <Step1BasicData
            name={name}
            setName={setName}
            birthDate={birthDate}
            setBirthDate={setBirthDate}
            phone={phone}
            setPhone={setPhone}
            onNext={() => setStep(2)}
          />
        )}

        {/* PASO 2: SELECCIÓN DE ESPECIALIDAD */}
        {step === 2 && (
          <Step2Specialty
            loading={loading}
            loadingSpecialties={loadingSpecialties}
            availableSpecialties={availableSpecialties}
            specialtySearch={specialtySearch}
            setSpecialtySearch={setSpecialtySearch}
            onSelectSpecialty={(id) => setSpecialty(id)}
            onBack={() => setStep(1)}
          />
        )}

        {/* PASO 3: BÚSQUEDA Y VINCULACIÓN */}
        {step === 3 && (
          <Step3ProfessionalSearch
            professionalsIndex={professionalsIndex}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedProfUID={selectedProfUID}
            setSelectedProfUID={setSelectedProfUID}
            loading={loading}
            onSubmit={handleFinalSubmit}
            onChangeSpecialty={() => setStep(2)}
          />
        )}

        {/* MENSAJES DE ESTADO GENERALES */}
        {status.type && (
          <div
            className={`mt-6 p-3 rounded text-center text-sm font-bold animate-fade-in ${
              status.type === 'error'
                ? 'bg-red-900/30 text-red-400 border border-red-900/50'
                : status.type === 'success'
                ? 'bg-green-900/30 text-green-400 border border-green-900/50'
                : 'bg-blue-900/30 text-blue-400 border border-blue-900/50'
            }`}
          >
            {status.text}
          </div>
        )}
      </div>
    </div>
  );
}
