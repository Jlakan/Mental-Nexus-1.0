// src/components/PredictiveTagSearch.tsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TagEntry } from '../types/tags';

interface PredictiveTagSearchProps {
  dictionary: TagEntry[];
  onSelectTag: (tag: TagEntry) => void;
  placeholder?: string;
}

export const PredictiveTagSearch: React.FC<PredictiveTagSearchProps> = ({
  dictionary,
  onSelectTag,
  placeholder = "Buscar síntoma, indicador, tag...",
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cerrar dropdown si se hace click fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filtrado optimizado en RAM
  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerQuery = searchTerm.toLowerCase();

    return dictionary.filter((entry) => {
      const matchMaster = entry.masterTag.toLowerCase().includes(lowerQuery);
      const matchSynonym = entry.synonyms.some(syn => syn.toLowerCase().includes(lowerQuery));
      return matchMaster || matchSynonym;
    }).slice(0, 10);
  }, [searchTerm, dictionary]);

  const handleSelect = (entry: TagEntry) => {
    onSelectTag(entry);
    setSearchTerm(''); // Limpiar input después de seleccionar
    setIsOpen(false);
  };

  return (
    <div ref={wrapperRef} style={{ position: 'relative', width: '100%', maxWidth: '400px' }}>
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '8px', boxSizing: 'border-box', borderRadius: '4px', border: '1px solid #ccc' }}
      />

      {isOpen && suggestions.length > 0 && (
        <ul style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #ccc',
          listStyle: 'none', padding: 0, margin: 0, maxHeight: '200px',
          overflowY: 'auto', zIndex: 10, borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }}>
          {suggestions.map((entry, idx) => (
            <li 
              key={`${entry.masterTag}-${idx}`}
              onClick={() => handleSelect(entry)}
              style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee' }}
            >
              <strong>{entry.masterTag}</strong> 
              <span style={{ fontSize: '0.8em', color: '#666', marginLeft: '8px' }}>
                ({entry.category})
              </span>
            </li>
          ))}
        </ul>
      )}
      
      {isOpen && searchTerm && suggestions.length === 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'white', border: '1px solid #ccc', padding: '10px', zIndex: 10, borderRadius: '4px', marginTop: '4px'
        }}>
          No se encontraron coincidencias.
        </div>
      )}
    </div>
  );
};