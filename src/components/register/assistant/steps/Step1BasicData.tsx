import React from 'react';

// Definimos los props que el componente Padre le pasará a este hijo
interface Step1BasicDataProps {
  name: string;
  setName: (val: string) => void;
  birthDate: string;
  setBirthDate: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  onNext: () => void;
}

export default function Step1BasicData({
  name,
  setName,
  birthDate,
  setBirthDate,
  phone,
  setPhone,
  onNext,
}: Step1BasicDataProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <label className="block text-xs font-bold text-purple-300 uppercase mb-1">
          Nombre Completo
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-purple-300 uppercase mb-1">
          Fecha de Nacimiento
        </label>
        <input
          type="date"
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-bold text-purple-300 uppercase mb-1">
          Teléfono
        </label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 outline-none transition-colors"
          required
        />
      </div>

      <button
        onClick={() => {
          // Validación simple antes de avanzar
          if (name && birthDate && phone) onNext();
        }}
        className="w-full py-4 rounded-lg font-bold uppercase tracking-wider bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white transition-all shadow-lg hover:scale-[1.02]"
      >
        Siguiente
      </button>
    </div>
  );
}
