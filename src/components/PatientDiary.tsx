// src/components/PatientDiary.tsx

import { useState, useEffect } from 'react';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { AtlasCard, AtlasButton, AtlasIcons } from './design/AtlasDesignSystem';

interface PatientDiaryProps {
  patientId: string;
  careTeam: any;
}

export default function PatientDiary({ patientId, careTeam }: PatientDiaryProps) {
  // --- ESTADOS ---
  const [text, setText] = useState('');
  const [selectedProfs, setSelectedProfs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // --- OBTENER FECHAS ---
  const today = new Date();
  const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // Ej: "2026-03"
  const dayKey = String(today.getDate()).padStart(2, '0'); // Ej: "13"

  // --- CARGA INICIAL (Ver si ya escribió hoy) ---
  useEffect(() => {
    const fetchTodaysEntry = async () => {
      if (!patientId) return;
      setFetching(true);
      try {
        const docRef = doc(db, `patients/${patientId}/diary`, yearMonth);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          const todaysData = data.entries?.[dayKey];
          
          if (todaysData) {
            setText(todaysData.text || '');
            setSelectedProfs(todaysData.sharedWith || []);
            if (todaysData.timestamp) setLastSaved(new Date(todaysData.timestamp));
          }
        }
      } catch (error) {
        console.error("Error cargando bitácora:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchTodaysEntry();
  }, [patientId, yearMonth, dayKey]);

  // --- LÓGICA DE SELECCIÓN DE PROFESIONALES ---
  const toggleProfessional = (profId: string) => {
    setSelectedProfs(prev => 
      prev.includes(profId) 
        ? prev.filter(id => id !== profId) // Quitar si ya estaba
        : [...prev, profId] // Agregar si no estaba
    );
  };

  const selectAll = () => {
    if (!careTeam) return;
    const activeProfs = Object.values(careTeam)
        .filter((p: any) => p.active)
        .map((p: any) => p.professionalId);
    setSelectedProfs(activeProfs);
  };

  const clearSelection = () => setSelectedProfs([]);

  // --- GUARDAR EN FIREBASE ---
  const handleSaveDiary = async () => {
    if (!text.trim() || !patientId) return;
    setLoading(true);

    try {
      const docRef = doc(db, `patients/${patientId}/diary`, yearMonth);
      
      // Usamos setDoc con { merge: true } para no borrar los días anteriores de este mes
      await setDoc(docRef, {
        entries: {
          [dayKey]: {
            text: text.trim(),
            timestamp: new Date().toISOString(),
            sharedWith: selectedProfs
          }
        }
      }, { merge: true });

      setLastSaved(new Date());
      // Opcional: Podrías disparar un toast aquí informando "Bitácora encriptada y guardada"
    } catch (error) {
      console.error("Error guardando bitácora:", error);
      alert("Error en el enlace al guardar la bitácora.");
    } finally {
      setLoading(false);
    }
  };

  // --- RENDERIZADO ---
  if (fetching) {
    return (
      <AtlasCard className="bg-slate-800/50 border-slate-700 flex justify-center py-10">
        <span className="text-cyan-500 font-mono animate-pulse text-xs">Desencriptando bitácora...</span>
      </AtlasCard>
    );
  }

  // Filtrar solo los profesionales activos
  const activeCareTeam = careTeam 
    ? Object.values(careTeam).filter((p: any) => p.active) 
    : [];

  return (
    <AtlasCard className="bg-slate-800 border-cyan-900/50 shadow-lg">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <span className="text-cyan-400">📝</span>
          BITÁCORA PERSONAL
        </h3>
        <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-cyan-500 border border-slate-700">
          {today.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
        </span>
      </div>

      <p className="text-xs text-slate-400 mb-4">
        Registra tus pensamientos, avances o temas que desees tratar en tu próxima sesión. Tú decides quién tiene acceso a este bloque de memoria.
      </p>

      {/* ÁREA DE TEXTO */}
      <div className="relative mb-4">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escribe aquí tu registro del día..."
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-slate-200 text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none min-h-[150px] resize-y custom-scrollbar transition-all"
        />
        {lastSaved && (
          <span className="absolute bottom-3 right-4 text-[10px] text-green-500/70 font-mono">
            Último guardado: {lastSaved.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* CONTROL DE PRIVACIDAD / COMPARTIR */}
      <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700/50 mb-6">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
            <AtlasIcons.Lock size={14} /> 
            Nivel de Acceso
          </label>
          <div className="flex gap-2">
            <button onClick={selectAll} className="text-[10px] text-slate-400 hover:text-white transition-colors">Seleccionar Todos</button>
            <span className="text-slate-600">|</span>
            <button onClick={clearSelection} className="text-[10px] text-slate-400 hover:text-white transition-colors">Privado (Solo yo)</button>
          </div>
        </div>

        {activeCareTeam.length === 0 ? (
          <p className="text-xs text-slate-500 italic">No tienes especialistas vinculados actualmente.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activeCareTeam.map((prof: any) => {
              const isSelected = selectedProfs.includes(prof.professionalId);
              return (
                <button
                  key={prof.professionalId}
                  onClick={() => toggleProfessional(prof.professionalId)}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200
                    ${isSelected 
                      ? 'bg-cyan-900/30 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.2)]' 
                      : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'
                    }
                  `}
                >
                  <div className={`w-2 h-2 rounded-full ${isSelected ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'}`}></div>
                  {prof.professionalName || 'Especialista'} 
                  <span className="opacity-50 text-[9px] uppercase">({prof.professionType})</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTÓN DE GUARDAR */}
      <div className="flex justify-end">
        <AtlasButton 
          onClick={handleSaveDiary} 
          isLoading={loading}
          disabled={!text.trim()}
          className="w-full sm:w-auto px-8"
        >
          ENCRIPTAR Y GUARDAR
        </AtlasButton>
      </div>
    </AtlasCard>
  );
}