// src/components/GameEconomyPanel.tsx
import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../services/firebase'; 
import { GameConfig, DEFAULT_GAME_CONFIG } from '../utils/GamificationUtils';

export default function GameEconomyPanel() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar configuración al montar el componente
  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "system_config", "game_rules");
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Fusionamos con default para garantizar que todos los campos existan
        setConfig({ ...DEFAULT_GAME_CONFIG, ...docSnap.data() } as GameConfig);
      } else {
        // Si no existe configuración remota, usamos los defaults locales
        setConfig(DEFAULT_GAME_CONFIG);
      }
    } catch (error) {
      console.error("Error cargando economía:", error);
      alert("Error al cargar la configuración de economía.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof GameConfig, value: string) => {
    const numValue = parseFloat(value);
    // Evitamos NaN si el campo está vacío temporalmente
    setConfig(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleSave = async () => {
    // Validaciones de seguridad: no permitir negativos
    if (config.baseXpOneTime < 0 || config.baseXpRoutine < 0 || config.goldPerTask < 0) {
      return alert("⛔️ Error: No puedes usar valores negativos en la economía del juego.");
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "system_config", "game_rules"), config);
      alert("✅ ¡Economía actualizada! Los cambios se aplicarán inmediatamente para todos los usuarios.");
    } catch (error) {
      console.error(error);
      alert("Hubo un error al guardar en Firebase.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if(window.confirm("¿Estás seguro? Esto restaurará los valores originales definidos en el código.")) {
      setConfig(DEFAULT_GAME_CONFIG);
    }
  };

  if (loading) return <div style={{padding: 20}}>Cargando reglas del juego...</div>;

  return (
    <div style={{ maxWidth: '700px', background: 'white', padding: '25px', borderRadius: '8px', border: '1px solid #e0e0e0', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
      <div style={{ borderBottom: '2px solid #E91E63', paddingBottom: '10px', marginBottom: '20px' }}>
        <h2 style={{ margin: 0, color: '#E91E63', display: 'flex', alignItems: 'center', gap: '10px' }}>
          💎 Configuración de Economía (God Mode)
        </h2>
        <p style={{ margin: '5px 0 0 0', color: '#666', fontSize: '0.9rem' }}>
          Ajusta las recompensas globales. Cambios aquí afectan el balance del juego.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        
        {/* XP Misión Única */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>XP Base (Misión Única)</label>
          <input
            type="number"
            value={config.baseXpOneTime}
            onChange={(e) => handleChange('baseXpOneTime', e.target.value)}
            style={inputStyle}
          />
          <small style={hintStyle}>Recomendado: 50</small>
        </div>

        {/* XP Rutina */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>XP Base (Rutina Diaria)</label>
          <input
            type="number"
            value={config.baseXpRoutine}
            onChange={(e) => handleChange('baseXpRoutine', e.target.value)}
            style={inputStyle}
          />
          <small style={hintStyle}>Recomendado: 30</small>
        </div>

        {/* Oro Base */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>Oro Base por Tarea</label>
          <input
            type="number"
            value={config.goldPerTask}
            onChange={(e) => handleChange('goldPerTask', e.target.value)}
            style={inputStyle}
          />
          <small style={hintStyle}>Moneda estándar</small>
        </div>

        {/* Bonus Reflexión */}
        <div style={fieldGroupStyle}>
          <label style={labelStyle}>XP Bonus por Reflexión</label>
          <input
            type="number"
            value={config.reflectionBonusXp}
            onChange={(e) => handleChange('reflectionBonusXp', e.target.value)}
            style={inputStyle}
          />
          <small style={hintStyle}>Premio por llenar el diario</small>
        </div>

        {/* Multiplicador Racha */}
        <div style={{ ...fieldGroupStyle, gridColumn: 'span 2', background: '#f9f9f9', padding: '10px', borderRadius: '5px' }}>
          <label style={labelStyle}>Multiplicador de Racha 🔥</label>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <input
              type="number"
              step="0.05"
              value={config.streakBonusMultiplier}
              onChange={(e) => handleChange('streakBonusMultiplier', e.target.value)}
              style={{...inputStyle, width: '150px'}}
            />
            <span style={{color: '#666', fontSize: '0.9rem'}}>
                (Ej: 1.05 = +5% de recompensas)
            </span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
        <button 
          onClick={handleRestoreDefaults}
          style={{ padding: '10px 15px', background: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight:'bold' }}
        >
          ↺ Restaurar Default
        </button>

        <button 
          onClick={handleSave}
          disabled={saving}
          style={{ 
            padding: '12px 30px', 
            background: saving ? '#ccc' : '#2196F3', 
            color: 'white', 
            border: 'none', 
            borderRadius: '4px', 
            cursor: saving ? 'not-allowed' : 'pointer', 
            fontWeight: 'bold', 
            fontSize: '1rem',
            boxShadow: '0 2px 5px rgba(0,0,0,0.2)' 
          }}
        >
          {saving ? 'Guardando...' : '💾 Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}

// Estilos locales para el componente
const fieldGroupStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
};

const labelStyle = {
  fontWeight: 'bold',
  marginBottom: '5px',
  color: '#333'
};

const inputStyle = {
  padding: '10px',
  borderRadius: '4px',
  border: '1px solid #ccc',
  fontSize: '16px',
  width: '100%',
  boxSizing: 'border-box' as const
};

const hintStyle = {
  color: '#888',
  marginTop: '4px',
  fontSize: '0.8rem'
};