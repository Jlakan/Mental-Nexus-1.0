// src/components/ClinicalNotesPanel.tsx
import { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  doc,
  setDoc,
  updateDoc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../../services/firebase';

interface NotesProps {
  patientId: string;
  professionalId: string;
}

const ITEMS_PER_PAGE = 5;

export const ClinicalNotesPanel = ({
  patientId,
  professionalId,
}: NotesProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notesRecord, setNotesRecord] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentNoteText, setCurrentNoteText] = useState('');
  
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  // Estados para el arrastre (Drag)
  const [position, setPosition] = useState({ x: 80, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startPosX: 0, startPosY: 0 });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const stateRef = useRef({ currentNoteText, notesRecord, selectedDate });
  useEffect(() => {
    stateRef.current = { currentNoteText, notesRecord, selectedDate };
  }, [currentNoteText, notesRecord, selectedDate]);

  const getTodayString = () => {
    const today = new Date();
    return new Date(today.getTime() - today.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];
  };

  const handleClose = () => {
    const { currentNoteText, notesRecord, selectedDate } = stateRef.current;
    const hasUnsavedChanges = currentNoteText !== (notesRecord[selectedDate] || '');
    
    if (hasUnsavedChanges) {
      if (!window.confirm('Tienes cambios sin guardar. ¿Seguro que quieres salir y perderlos?')) {
        return;
      }
    }
    
    setIsOpen(false);
    window.history.replaceState(null, '', window.location.pathname);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Lógica de arrastre
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: position.x,
      startPosY: position.y
    };
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: dragRef.current.startPosX + (e.clientX - dragRef.current.startX),
        y: dragRef.current.startPosY + (e.clientY - dragRef.current.startY)
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    let isMounted = true;

    const fetchNotes = async () => {
      if (!isOpen) return;
      setIsLoading(true);
      try {
        const docRef = doc(db, 'professionals', professionalId, 'clinical_notes', patientId);
        const snap = await getDoc(docRef);
        
        if (!isMounted) return;

        const today = getTodayString();
        let fetchedNotes: Record<string, string> = {};
        
        if (snap.exists()) {
          fetchedNotes = snap.data().notas || {};
        }

        if (!fetchedNotes[today]) {
          fetchedNotes[today] = '';
        }
        
        setNotesRecord(fetchedNotes);
        setCurrentNoteText(fetchedNotes[today] || '');
        setSelectedDate(today);
      } catch (error) {
        if (isMounted) console.error('Error fetching notes:', error);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchNotes();

    return () => {
      isMounted = false;
    };
  }, [patientId, professionalId, isOpen]);

  useEffect(() => {
    if (!isLoading && isOpen) {
      const hash = window.location.hash;
      if (hash.startsWith('#nota-')) {
        const hashDate = hash.replace('#nota-', '');
        if (hashDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          setSelectedDate(hashDate);
          setCurrentNoteText(notesRecord[hashDate] || '');
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isOpen]);

  useEffect(() => {
    if (selectedDate && isOpen) {
      window.history.replaceState(null, '', `#nota-${selectedDate}`);
    }
  }, [selectedDate, isOpen]);

  useEffect(() => {
    if (!isLoading && isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isLoading, isOpen, selectedDate]);

  const handleDateChange = (dateKey: string) => {
    if (dateKey === selectedDate) return;

    setNotesRecord((prev) => {
      const updated = { ...prev, [selectedDate]: currentNoteText };
      setCurrentNoteText(updated[dateKey] || '');
      return updated;
    });
    
    setSelectedDate(dateKey);
  };

  const handleSave = async () => {
    if (!currentNoteText.trim()) {
      alert('No se puede guardar una nota clínica vacía.');
      return;
    }

    setIsSaving(true);
    try {
      const docRef = doc(db, 'professionals', professionalId, 'clinical_notes', patientId);
      
      try {
        await updateDoc(docRef, {
          [`notas.${selectedDate}`]: currentNoteText,
          lastUpdated: serverTimestamp(),
        });
      } catch (error: any) {
        if (error.code === 'not-found') {
          await setDoc(docRef, {
            patientId: patientId,
            notas: { [selectedDate]: currentNoteText },
            lastUpdated: serverTimestamp(),
          });
        } else {
          throw error;
        }
      }

      setNotesRecord((prev) => ({ ...prev, [selectedDate]: currentNoteText }));
    } catch (error) {
      console.error('Error saving note:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const filteredDates = useMemo(() => {
    const datesSet = new Set(Object.keys(notesRecord));
    if (selectedDate) datesSet.add(selectedDate);
    
    const allDates = Array.from(datesSet).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    if (!searchTerm) return allDates;
    
    const lowerSearch = searchTerm.toLowerCase();
    return allDates.filter((date) => {
      const text = notesRecord[date] || ''; 
      return date.includes(lowerSearch) || text.toLowerCase().includes(lowerSearch);
    });
  }, [notesRecord, selectedDate, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredDates.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, Math.max(0, totalPages - 1));

  const paginatedDates = filteredDates.slice(
    safeCurrentPage * ITEMS_PER_PAGE,
    (safeCurrentPage + 1) * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setCurrentPage(0);
  }, [searchTerm]);

  const handlePrevPage = () => setCurrentPage((_p) => Math.max(0, safeCurrentPage - 1));
  const handleNextPage = () => setCurrentPage((_p) => Math.min(totalPages - 1, safeCurrentPage + 1));

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) await processImportedText(text);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const processImportedText = async (text: string) => {
    setIsImporting(true);
    try {
      const lines = text.split(/\r?\n/);
      const newNotes: Record<string, string> = {};
      let currentDateKey = '';
      let currentNoteContent: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (/^[-=]{5,}$/.test(trimmed) || trimmed.startsWith('Historial de Notas') || trimmed.startsWith('Generado el:')) {
          continue;
        }

        const matchYMD = trimmed.match(/^(?:Fecha:\s*)?(\d{4}[-/]\d{2}[-/]\d{2})/i);
        const matchDMY = trimmed.match(/^(?:Fecha:\s*)?(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i);

        let parsedDate = null;
        let remainingText = '';

        if (matchYMD) {
          parsedDate = matchYMD[1].replace(/\//g, '-');
          remainingText = trimmed.substring(matchYMD[0].length).replace(/^[:\s\-]+/, '').trim();
        } else if (matchDMY) {
          parsedDate = `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
          remainingText = trimmed.substring(matchDMY[0].length).replace(/^[:\s\-]+/, '').trim();
        }

        if (parsedDate) {
          if (currentDateKey) newNotes[currentDateKey] = currentNoteContent.join('\n').trim();
          currentDateKey = parsedDate;
          currentNoteContent = remainingText ? [remainingText] : [];
        } else if (currentDateKey) {
          currentNoteContent.push(line);
        }
      }

      if (currentDateKey) newNotes[currentDateKey] = currentNoteContent.join('\n').trim();

      const validNotes: Record<string, string> = {};
      Object.keys(newNotes).forEach((date) => {
        if (newNotes[date] && newNotes[date].trim() !== '') validNotes[date] = newNotes[date].trim();
      });

      if (Object.keys(validNotes).length === 0) return alert('No se detectaron notas válidas.');
      if (!window.confirm(`¿Importar ${Object.keys(validNotes).length} notas?`)) return;

      const docRef = doc(db, 'professionals', professionalId, 'clinical_notes', patientId);
      const updates: any = { lastUpdated: serverTimestamp() };
      Object.keys(validNotes).forEach(date => updates[`notas.${date}`] = validNotes[date]);

      try {
        await updateDoc(docRef, updates);
      } catch (error: any) {
        if (error.code === 'not-found') {
          await setDoc(docRef, { patientId, notas: validNotes, lastUpdated: serverTimestamp() });
        } else throw error;
      }

      setNotesRecord((prev) => ({ ...prev, ...validNotes }));
      
      const sortedImportedDates = Object.keys(validNotes).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      if (sortedImportedDates.length > 0) {
        setSelectedDate(sortedImportedDates[0]);
        setCurrentNoteText(validNotes[sortedImportedDates[0]]);
      }
    } catch (error) {
      console.error('Error importando:', error);
      alert('Error procesando el archivo.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    const currentRecord = { ...notesRecord };
    if (currentNoteText.trim() !== '') {
      currentRecord[selectedDate] = currentNoteText;
    }

    const validDates = Object.keys(currentRecord).filter(date => currentRecord[date]?.trim() !== '');

    if (validDates.length === 0) return alert('No hay notas con contenido para exportar.');
    const sortedDates = validDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    let exportText = `Historial de Notas Clínicas\nGenerado el: ${new Date().toLocaleDateString()}\n\n=========================================\n\n`;
    sortedDates.forEach((date) => {
      exportText += `Fecha: ${date}\n${currentRecord[date]}\n\n-----------------------------------------\n\n`;
    });

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `notas_clinicas_${patientId}.txt`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(url);
  };

  const modalContent = isOpen ? (
    <div 
      className="fixed inset-0 z-[99999] bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div 
        className="absolute resize overflow-auto bg-slate-800 rounded-xl shadow-2xl border border-slate-700 min-w-[700px] min-h-[500px]"
        style={{ 
          top: `${position.y}px`, 
          left: `${position.x}px`,
          width: '80vw', 
          height: '80vh',
          maxWidth: '90vw',
          maxHeight: '90vh'
        }}
      >
        <div className="flex w-full h-full min-h-[498px] overflow-hidden">
          <div className="flex-1 flex flex-col border-r border-slate-700">
            {/* CABECERA ARRASTRABLE */}
            <div 
              onMouseDown={handleMouseDown}
              className={`p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/80 hover:bg-slate-700/80 transition-colors ${
                isDragging ? 'cursor-grabbing' : 'cursor-grab'
              }`}
              title="Arrastra para mover el panel"
            >
              <h3 id="modal-title" className="text-sm uppercase font-bold text-nexus-cyan tracking-wider flex items-center gap-2 select-none pointer-events-none">
                📝 Nota Clínica: {selectedDate === getTodayString() ? `Hoy (${selectedDate})` : selectedDate}
              </h3>
              
              <button 
                onMouseDown={(e) => e.stopPropagation()}
                onClick={handleClose} 
                className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
              >
                &times;
              </button>
            </div>

            <div className="flex-1 p-4 flex flex-col overflow-hidden">
              {isLoading ? (
                <div className="flex-1 flex items-center justify-center animate-pulse text-slate-400">
                  Cargando historial clínico...
                </div>
              ) : (
                <textarea
                  ref={textareaRef}
                  value={currentNoteText}
                  onChange={(e) => setCurrentNoteText(e.target.value)}
                  placeholder={`Escribe la nota para el ${selectedDate}...`}
                  className="flex-1 w-full h-full bg-slate-900 border border-slate-700 rounded-lg p-4 text-sm text-slate-200 resize-none focus:outline-none focus:border-nexus-cyan focus:ring-1 focus:ring-nexus-cyan custom-scrollbar"
                />
              )}
            </div>

            <div className="p-4 border-t border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <div className="flex gap-3">
                <input type="file" accept=".txt" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} disabled={isImporting} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  {isImporting ? '⏳ Procesando...' : '📥 Importar'}
                </button>
                <button onClick={handleExport} className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors">
                  📤 Exportar
                </button>
              </div>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading}
                className={`px-6 py-2 rounded text-sm font-bold transition-colors shadow-lg ${
                  isSaving || isLoading ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-nexus-cyan text-black hover:bg-cyan-300'
                }`}
              >
                {isSaving ? 'Guardando...' : 'Guardar Nota'}
              </button>
            </div>
          </div>

          <div className="w-[320px] flex flex-col bg-slate-900 shrink-0">
            <div className="p-4 border-b border-slate-700">
              <input
                type="text"
                placeholder="🔍 Buscar por fecha o texto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-nexus-cyan transition-colors"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
              {paginatedDates.length === 0 ? (
                <p className="text-slate-500 text-sm text-center mt-4">No se encontraron notas.</p>
              ) : (
                paginatedDates.map((date) => {
                  const isSelected = date === selectedDate;
                  const previewText = isSelected 
                    ? (currentNoteText || 'Sin contenido...') 
                    : (notesRecord[date] || 'Sin contenido...');
                  
                  return (
                    <div
                      key={date}
                      onClick={() => handleDateChange(date)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected ? 'bg-slate-800 border-nexus-cyan shadow-md shadow-nexus-cyan/20' : 'bg-slate-800/40 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-300 mb-1 flex justify-between">
                        <span>📅 {date}</span>
                        {isSelected && <span className="text-nexus-cyan text-[10px] uppercase">Actual</span>}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-snug break-words">
                        {previewText}
                      </p>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-slate-700 bg-slate-800 flex items-center justify-between">
              <button onClick={handlePrevPage} disabled={safeCurrentPage === 0} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors">
                ◀ Ant
              </button>
              <span className="text-xs text-slate-400 font-mono">
                {filteredDates.length > 0 ? `${safeCurrentPage + 1} / ${totalPages}` : '0 / 0'}
              </span>
              <button onClick={handleNextPage} disabled={safeCurrentPage >= totalPages - 1} className="text-xs px-2 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 disabled:hover:bg-slate-700 rounded text-slate-200 transition-colors">
                Sig ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="
          group flex items-center justify-center gap-3 w-full sm:w-auto px-6 py-3 
          font-bold tracking-wide uppercase text-sm rounded-lg transition-all duration-150
          bg-transparent border border-[#00E5FF] text-[#00E5FF]
          shadow-[0_5px_0_0_#00E5FF]
          hover:bg-[#00E5FF]/10 hover:text-white hover:-translate-y-[2px] hover:shadow-[0_7px_0_0_#00E5FF]
          active:bg-[#00E5FF]/20 active:translate-y-[5px] active:shadow-none
          disabled:border-slate-600 disabled:text-slate-600 disabled:bg-transparent 
          disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed
        "
      >
        <svg 
          className="w-5 h-5 transition-colors group-hover:text-white group-disabled:text-slate-600" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        Abrir Expediente Clínico
      </button>

      {isOpen && createPortal(modalContent, document.body)}
    </>
  );
};