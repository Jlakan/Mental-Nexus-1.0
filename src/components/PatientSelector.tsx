import React, { useState, useEffect, useRef } from 'react';

interface Props {
  patients: any[];
  selectedPatientId: string;
  manualNameValue: string;
  onSelect: (id: string, name: string) => void;
}

export default function PatientSelector({ patients, selectedPatientId, manualNameValue, onSelect }: Props) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Sincronizar el input cuando se selecciona un paciente desde fuera
  useEffect(() => {
    if (selectedPatientId) {
      const p = patients.find(x => x.id === selectedPatientId);
      if (p) setSearchTerm(p.fullName);
    } else if (manualNameValue) {
      setSearchTerm(manualNameValue);
    }
  }, [selectedPatientId, manualNameValue, patients]);

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: any) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const filteredPatients = patients.filter(p => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const name = p.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return name.includes(term);
  });

  const handleSelect = (id: string, name: string) => {
    setSearchTerm(name);
    onSelect(id, name);
    setIsOpen(false);
  };

  // Determinar si lo que escribió el usuario no coincide con ningún paciente existente
  const showManualOption = searchTerm && !patients.some(p => p.fullName.toLowerCase() === searchTerm.toLowerCase());

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
      <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '5px' }}>Paciente:</label>
      <input
        type="text"
        placeholder="Buscar o escribir nombre nuevo..."
        value={searchTerm}
        onChange={(e) => { setSearchTerm(e.target.value); setIsOpen(true); }}
        onFocus={() => setIsOpen(true)}
        style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', boxSizing:'border-box' }}
      />

      {isOpen && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, background: 'white', border: '1px solid #ccc',
          borderRadius: '0 0 6px 6px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
        }}>
          {filteredPatients.length === 0 && !showManualOption && (
             <div style={{padding:'10px', color:'#999', fontStyle:'italic'}}>No se encontraron resultados.</div>
          )}

          {filteredPatients.map(p => (
            <div
              key={p.id}
              onClick={() => handleSelect(p.id, p.fullName)}
              style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', background: 'white', display:'flex', alignItems:'center', gap:'10px' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
            >
              {/* --- DISTINCIÓN VISUAL --- */}
              <div style={{fontSize:'18px'}}>
                  {p.isManual ? '📝' : '📱'}
              </div>
              <div>
                  <div style={{fontWeight:'bold'}}>{p.fullName}</div>
                  <div style={{fontSize:'11px', color: p.isManual ? '#795548' : '#1976D2'}}>
                      {p.isManual ? 'Paciente Local (Sin App)' : 'Usuario App Verificado'}
                  </div>
              </div>
            </div>
          ))}

          {showManualOption && (
            <div
              onClick={() => handleSelect('', searchTerm)}
              style={{ padding: '10px', cursor: 'pointer', background: '#E8F5E9', color: '#2E7D32', borderTop: '2px solid #4CAF50', fontWeight: 'bold' }}
            >
              + Crear como nuevo: "{searchTerm}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}