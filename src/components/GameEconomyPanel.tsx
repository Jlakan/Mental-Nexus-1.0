// src/components/GameEconomyPanel.tsx
import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from '../services/firebase'; 
import { type GameConfig, DEFAULT_GAME_CONFIG } from '../utils/GamificationUtils';

export default function GameEconomyPanel() {
  const [config, setConfig] = useState<GameConfig>(DEFAULT_GAME_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const docRef = doc(db, "system_config", "game_rules");
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        setConfig({ ...DEFAULT_GAME_CONFIG, ...docSnap.data() } as GameConfig);
      } else {
        setConfig(DEFAULT_GAME_CONFIG);
      }
    } catch (error) {
      console.error("Error cargando economía:", error);
      alert("Error al cargar configuración.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof GameConfig, value: string) => {
    const numValue = parseFloat(value);
    setConfig(prev => ({
      ...prev,
      [field]: isNaN(numValue) ? 0 : numValue
    }));
  };

  const handleSave = async () => {
    if (config.baseXpOneTime < 0 || config.baseXpRoutine < 0 || config.goldPerTask < 0) {
      return alert("⛔️ No puedes usar valores negativos.");
    }

    setSaving(true);
    try {
      await setDoc(doc(db, "system_config", "game_rules"), config);
      alert("✅ ¡Economía actualizada!");
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreDefaults = () => {
    if(window.confirm("¿Restaurar valores por defecto?")) {
      setConfig(DEFAULT_GAME_CONFIG);
    }
  };

  if (loading) return <div style={{padding: 20}}>Cargando...</div>;

  return (
    <div style={{ maxWidth: '700px', background: 'white', padding: '25px', borderRadius: '8px', border: '1px solid #e0e0e0' }}>
      <h2 style={{ margin: '0 0 20px 0', color: '#E91E63' }}>💎 Configuración de Economía</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
        
        <div>
          <label style={labelStyle}>XP Base (Misión Única)</label>
          <input
            type="number"
            value={config.baseXpOneTime}
            onChange={(e) => handleChange('baseXpOneTime', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>XP Base (Rutina)</label>
          <input
            type="number"
            value={config.baseXpRoutine}
            onChange={(e) => handleChange('baseXpRoutine', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Oro Base</label>
          <input
            type="number"
            value={config.goldPerTask}
            onChange={(e) => handleChange('goldPerTask', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>XP Bonus Reflexión</label>
          <input
            type="number"
            value={config.reflectionBonusXp}
            onChange={(e) => handleChange('reflectionBonusXp', e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ gridColumn: 'span 2' }}>
          <label style={labelStyle}>Multiplicador de Racha (1.05 = +5%)</label>
          <input
            type="number"
            step="0.05"
            value={config.streakBonusMultiplier}
            onChange={(e) => handleChange('streakBonusMultiplier', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={handleRestoreDefaults} style={{ padding: '10px', background: '#9E9E9E', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Restaurar Default
        </button>
        <button onClick={handleSave} disabled={saving} style={{ padding: '10px 25px', background: '#2196F3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          {saving ? 'Guardando...' : '💾 Guardar Cambios'}
        </button>
      </div>
    </div>
  );
}

const labelStyle = { fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#333' };
const inputStyle = { padding: '10px', width: '100%', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' as const };