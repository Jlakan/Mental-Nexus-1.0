import React, { useState } from 'react';
import { ESCAPE_REASONS, VALIDATION_LABELS } from '../utils/GamificationUtils';

interface Props {
  isOpen: boolean;
  taskTitle: string;
  onClose: () => void;
  // Callback para éxito: devuelve calificación (1-5) y reflexión
  onConfirmSuccess: (rating: number, reflection: string) => void;
  // Callback para escape: devuelve el ID del motivo
  onConfirmEscape: (reasonId: string) => void;
}

export default function TaskValidationModal({ 
  isOpen, 
  taskTitle, 
  onClose, 
  onConfirmSuccess, 
  onConfirmEscape 
}: Props) {
  
  // Estado interno del formulario
  const [activeTab, setActiveTab] = useState<'success' | 'escape'>('success');
  const [rating, setRating] = useState<number>(3); // Default: Moderado
  const [reflection, setReflection] = useState('');
  const [escapeReason, setEscapeReason] = useState(ESCAPE_REASONS[0].id);

  if (!isOpen) return null;

  // Estilos base para consistencia
  const modalOverlayStyle: React.CSSProperties = {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.6)', 
    display: 'flex', alignItems: 'center', justifyContent: 'center', 
    zIndex: 1000, backdropFilter: 'blur(2px)'
  };

  const modalContentStyle: React.CSSProperties = {
    background: 'white', 
    width: '90%', maxWidth: '400px', 
    borderRadius: '16px', overflow: 'hidden', 
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)'
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        
        {/* HEADER */}
        <div style={{ padding: '20px', background: '#f8f9fa', borderBottom: '1px solid #eee' }}>
          <h3 style={{ margin: 0, color: '#333', fontSize: '18px', textAlign: 'center' }}>
            {taskTitle}
          </h3>
        </div>

        {/* TABS DE SELECCIÓN */}
        <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
          <button 
            onClick={() => setActiveTab('success')}
            style={{ 
              flex: 1, padding: '15px', border: 'none', cursor: 'pointer',
              background: activeTab === 'success' ? 'white' : '#f5f5f5', 
              color: activeTab === 'success' ? '#4CAF50' : '#888', 
              fontWeight: 'bold', 
              borderBottom: activeTab === 'success' ? '3px solid #4CAF50' : 'none',
              transition: 'all 0.2s'
            }}>
            🏆 Completar
          </button>
          <button 
            onClick={() => setActiveTab('escape')}
            style={{ 
              flex: 1, padding: '15px', border: 'none', cursor: 'pointer',
              background: activeTab === 'escape' ? 'white' : '#f5f5f5', 
              color: activeTab === 'escape' ? '#FF9800' : '#888', 
              fontWeight: 'bold', 
              borderBottom: activeTab === 'escape' ? '3px solid #FF9800' : 'none',
              transition: 'all 0.2s'
            }}>
            🛡️ Runa Escape
          </button>
        </div>

        {/* CONTENIDO DEL FORMULARIO */}
        <div style={{ padding: '24px' }}>
          
          {/* --- ESCENARIO A: ÉXITO (REPORTAR) --- */}
          {activeTab === 'success' ? (
            <>
              <p style={{marginTop: 0, marginBottom: '15px', fontSize: '14px', color: '#666', textAlign: 'center'}}>
                ¿Qué tan difícil fue realizarlo?
              </p>
              
              {/* SELECTOR DE ESFUERZO (1-5) */}
              <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                {[1, 2, 3, 4, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => setRating(num)}
                    style={{
                      width: '45px', height: '45px', borderRadius: '50%', 
                      border: '1px solid #eee',
                      background: rating === num ? '#4CAF50' : 'white',
                      color: rating === num ? 'white' : '#333',
                      fontWeight: 'bold', fontSize: '16px', cursor: 'pointer',
                      boxShadow: rating === num ? '0 4px 6px rgba(76,175,80,0.3)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    {num}
                  </button>
                ))}
              </div>
              
              <div style={{textAlign: 'center', fontSize: '13px', color: '#4CAF50', fontWeight: '500', marginBottom: '20px', height: '20px'}}>
                "{VALIDATION_LABELS[rating]}"
              </div>

              {/* TEXTAREA REFLEXIÓN */}
              <div style={{position: 'relative'}}>
                <textarea
                  placeholder="¿Cómo te sentiste? (Opcional)"
                  value={reflection}
                  onChange={(e) => setReflection(e.target.value)}
                  style={{ 
                    width: '100%', height: '80px', padding: '12px', 
                    borderRadius: '8px', border: '1px solid #ddd', 
                    marginBottom: '5px', boxSizing: 'border-box',
                    fontFamily: 'inherit', resize: 'none'
                  }}
                />
                {reflection.length > 5 && (
                  <span style={{
                    position: 'absolute', right: '10px', bottom: '15px', 
                    fontSize: '10px', background: '#FFD700', color: '#333', 
                    padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold'
                  }}>
                    +BONUS XP
                  </span>
                )}
              </div>

              <button 
                onClick={() => onConfirmSuccess(rating, reflection)}
                style={{ 
                  width: '100%', padding: '14px', marginTop: '15px',
                  background: 'linear-gradient(45deg, #4CAF50, #45a049)', 
                  color: 'white', border: 'none', borderRadius: '8px', 
                  fontWeight: 'bold', fontSize: '16px', cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(76,175,80,0.3)'
                }}>
                ¡Reclamar Recompensa!
              </button>
            </>
          ) : (
            /* --- ESCENARIO B: ESCAPE (SALVAR RACHA) --- */
            <>
              <div style={{
                background: '#FFF3E0', padding: '12px', borderRadius: '8px', 
                marginBottom: '20px', fontSize: '13px', color: '#E65100',
                borderLeft: '4px solid #FF9800'
              }}>
                <strong>Zona Segura:</strong> Usar una Runa <b>mantiene tu racha visual</b> sin sumar puntos de experiencia. Es válido priorizar tu bienestar.
              </div>
              
              <label style={{display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#444'}}>
                Motivo Principal:
              </label>
              
              <select 
                value={escapeReason} 
                onChange={(e) => setEscapeReason(e.target.value)}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px', 
                  border: '1px solid #ccc', marginBottom: '25px',
                  background: 'white', fontSize: '14px'
                }}>
                {ESCAPE_REASONS.map(r => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>

              <button 
                onClick={() => onConfirmEscape(escapeReason)}
                style={{ 
                  width: '100%', padding: '14px', 
                  background: '#FF9800', 
                  color: 'white', border: 'none', borderRadius: '8px', 
                  fontWeight: 'bold', fontSize: '16px', cursor: 'pointer',
                  boxShadow: '0 4px 10px rgba(255,152,0,0.3)'
                }}>
                Consumir Runa
              </button>
            </>
          )}

          {/* BOTÓN CANCELAR */}
          <button 
            onClick={onClose} 
            style={{ 
              width: '100%', marginTop: '12px', padding: '12px', 
              background: 'transparent', color: '#999', border: 'none', 
              cursor: 'pointer', fontSize: '14px'
            }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}