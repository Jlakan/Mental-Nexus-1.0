// src/components/PredictiveTagSearch.tsx

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';
import type { TagEntry } from '../types/tags';

interface PredictiveTagSearchProps {
  dictionary: TagEntry[];
  onSelectTag: (tag: TagEntry) => void;
  placeholder?: string;
  profession?: string;
}

export const PredictiveTagSearch: React.FC<PredictiveTagSearchProps> = ({
  dictionary,
  onSelectTag,
  placeholder = "Buscar síntoma, indicador, tag...",
  profession = "psicologia"
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // Filtrado optimizado
  const suggestions = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const lowerQuery = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return dictionary.filter((entry) => {
      const matchMaster = entry.masterTag.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQuery);
      const matchSynonym = entry.synonyms.some(syn => 
        syn.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(lowerQuery)
      );
      return matchMaster || matchSynonym;
    }).slice(0, 10);
  }, [searchTerm, dictionary]);

  const handleSelect = (entry: TagEntry) => {
    onSelectTag(entry);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleSuggestNewTag = async () => {
    if (!searchTerm.trim() || isSubmitting) return;
    setIsSubmitting(true);
    
    const termToSave = searchTerm.trim();
    const normalizedTerm = termToSave.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    try {
      const pendingRef = collection(db, 'tagsDictionaries', profession, 'pendingTags');
      await addDoc(pendingRef, {
        originalTerm: termToSave,
        normalizedTerm: normalizedTerm,
        status: 'pending',
        reportedAt: serverTimestamp(),
      });
      
      const tempTag: TagEntry = {
        masterTag: termToSave,
        category: 'Sugerido',
        synonyms: []
      };
      
      onSelectTag(tempTag);
      setSearchTerm('');
      setIsOpen(false);
    } catch (error) {
      console.error("Error al enviar tag al sandbox:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Manejo de la tecla Enter
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeAction();
    }
  };

  // Lógica compartida entre el botón Agregar y la tecla Enter
  const executeAction = () => {
    if (suggestions.length > 0) {
      handleSelect(suggestions[0]);
    } else if (searchTerm.trim() !== '') {
      handleSuggestNewTag();
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full flex items-center">
      <input
        type="text"
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="flex-1 bg-transparent border-none text-xs text-white outline-none px-2 py-1 placeholder-slate-600 w-full"
      />
      
      <button
        onClick={executeAction}
        disabled={!searchTerm.trim() || isSubmitting}
        className="text-nexus-cyan text-[10px] font-bold uppercase px-2 py-1 hover:bg-white/5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Agregar
      </button>

      {/* Menú Desplegable con Tema Oscuro */}
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 list-none p-0 m-0 max-h-48 overflow-y-auto z-50 rounded-lg mt-2 shadow-2xl custom-scrollbar">
          {suggestions.map((entry, idx) => (
            <li 
              key={`${entry.masterTag}-${idx}`}
              onClick={() => handleSelect(entry)}
              className="p-3 cursor-pointer border-b border-slate-700/50 hover:bg-slate-700 transition-colors flex justify-between items-center"
            >
              <strong className="text-white text-sm">{entry.masterTag}</strong> 
              <span className="text-[10px] text-slate-400 uppercase tracking-wider">
                {entry.category}
              </span>
            </li>
          ))}
        </ul>
      )}
      
      {/* Estado Vacío / Sandbox con Tema Oscuro */}
      {isOpen && searchTerm && suggestions.length === 0 && (
        <div className="absolute top-full left-0 right-0 bg-slate-800 border border-slate-700 p-3 z-50 rounded-lg mt-2 flex flex-col gap-3 shadow-2xl">
          <span className="text-slate-400 text-xs italic text-center">No existe en el diccionario oficial.</span>
          <button 
            onClick={handleSuggestNewTag}
            disabled={isSubmitting}
            className="w-full py-2 bg-nexus-cyan text-slate-900 font-bold text-xs uppercase tracking-wider rounded cursor-pointer hover:bg-cyan-400 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Enviando...' : `Añadir "${searchTerm}" a revisión`}
          </button>
        </div>
      )}
    </div>
  );
};