// src/components/ClinicalNotesPanel.tsx
import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../services/firebase';

interface NotesProps {
  patientId: string;
  professionalId: string;
}

export const ClinicalNotesPanel = ({ patientId, professionalId }: NotesProps) => {
  const [notesRecord, setNotesRecord] = useState<Record<string, string>>({});
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [currentNoteText, setCurrentNoteText] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getTodayString = () => {
    const today = new Date();
    return new Date(today.getTime() - (today.getTimezoneOffset() * 60000))
      .toISOString()
      .split('T')[0];
  };

  useEffect(() => {
    fetchNotes();
  }, [patientId, professionalId]);

  const fetchNotes = async () => {
    setIsLoading(true);
    try {
      const docRef = doc(db, 'patients', patientId, 'clinicalNotes', professionalId);
      const snap = await getDoc(docRef);
      
      const today = getTodayString();
      
      if (snap.exists()) {
        const data = snap.data();
        const datesOnly = data.notas || {};
        
        if (!datesOnly[today]) {
          datesOnly[today] = "";
        }
        setNotesRecord(datesOnly);
        setCurrentNoteText(datesOnly[today] || "");
      } else {
        setNotesRecord({ [today]: "" });
        setCurrentNoteText("");
      }
      
      setSelectedDate(today);
    } catch (error) {
      console.error("Error fetching notes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDateChange = (dateKey: string) => {
    setNotesRecord(prev => ({ ...prev, [selectedDate]: currentNoteText }));
    setSelectedDate(dateKey);
    setCurrentNoteText(notesRecord[dateKey] || "");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const docRef = doc(db, 'patients', patientId, 'clinicalNotes', professionalId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        await setDoc(docRef, {
          notas: {
            [selectedDate]: currentNoteText
          },
          lastUpdated: serverTimestamp()
        });
      } else {
        await updateDoc(docRef, {
          [`notas.${selectedDate}`]: currentNoteText,
          lastUpdated: serverTimestamp()
        });
      }
      
      setNotesRecord(prev => ({ ...prev, [selectedDate]: currentNoteText }));
    } catch (error) {
      console.error("Error saving note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // --- NUEVA LÓGICA DE IMPORTACIÓN MEJORADA ---
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      if (text) {
        await processImportedText(text);
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const processImportedText = async (text: string) => {
    setIsImporting(true);
    try {
      // Soportar saltos de línea de Windows (\r\n) y Mac/Linux (\n)
      const lines = text.split(/\r?\n/);
      const newNotes: Record<string, string> = {};
      let currentDateKey = '';
      let currentNoteContent: string[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Ignorar basura visual de exports previos
        if (/^[-=]{5,}$/.test(trimmed) || trimmed.startsWith('Historial de Notas') || trimmed.startsWith('Generado el:')) {
          continue;
        }

        // Buscar fecha al inicio de la línea
        const matchYMD = trimmed.match(/^(?:Fecha:\s*)?(\d{4}[-/]\d{2}[-/]\d{2})/i);
        const matchDMY = trimmed.match(/^(?:Fecha:\s*)?(\d{2})[\/\-](\d{2})[\/\-](\d{4})/i);

        let parsedDate = null;
        let remainingText = '';

        if (matchYMD) {
          parsedDate = matchYMD[1].replace(/\//g, '-');
          // Capturar el texto que esté en la misma línea después de la fecha
          remainingText = trimmed.substring(matchYMD[0].length).replace(/^[:\s\-]+/, '').trim();
        } else if (matchDMY) {
          parsedDate = `${matchDMY[3]}-${matchDMY[2]}-${matchDMY[1]}`;
          remainingText = trimmed.substring(matchDMY[0].length).replace(/^[:\s\-]+/, '').trim();
        }

        if (parsedDate) {
          // Si ya teníamos una fecha guardándose, la cerramos y guardamos
          if (currentDateKey) {
            newNotes[currentDateKey] = currentNoteContent.join('\n').trim();
          }
          currentDateKey = parsedDate;
          currentNoteContent = [];
          
          // Si había texto en la misma línea, lo añadimos
          if (remainingText) {
            currentNoteContent.push(remainingText);
          }
        } else if (currentDateKey) {
          // Es continuación de la nota actual (solo añadimos si no es línea completamente en blanco sin sentido, aunque conservamos el formato)
          currentNoteContent.push(line);
        }
      }
      
      // Guardar la última nota que quedó en el buffer
      if (currentDateKey) {
        newNotes[currentDateKey] = currentNoteContent.join('\n').trim();
      }

      // Limpiar fechas que se hayan creado sin absolutamente nada de texto
      const validNotes: Record<string, string> = {};
      Object.keys(newNotes).forEach(date => {
        if (newNotes[date] && newNotes[date].trim() !== '') {
          validNotes[date] = newNotes[date].trim();
        }
      });

      if (Object.keys(validNotes).length === 0) {
        alert("No se detectaron notas con texto válido. Verifica el formato del documento.");
        return;
      }

      if (!window.confirm(`Se detectaron ${Object.keys(validNotes).length} notas. ¿Importarlas y sincronizarlas con la base de datos?`)) {
        return;
      }

      const docRef = doc(db, 'patients', patientId, 'clinicalNotes', professionalId);
      const snap = await getDoc(docRef);

      const updates: any = { lastUpdated: serverTimestamp() };
      Object.keys(validNotes).forEach(date => {
        updates[`notas.${date}`] = validNotes[date];
      });

      if (!snap.exists()) {
        await setDoc(docRef, {
          notas: validNotes,
          lastUpdated: serverTimestamp()
        });
      } else {
        await updateDoc(docRef, updates);
      }

      setNotesRecord(prev => {
        const updated = { ...prev, ...validNotes };
        return updated;
      });
      
      const sortedImportedDates = Object.keys(validNotes).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
      if (sortedImportedDates.length > 0) {
        setSelectedDate(sortedImportedDates[0]);
        setCurrentNoteText(validNotes[sortedImportedDates[0]]);
      }
      
    } catch (error) {
      console.error("Error procesando texto:", error);
      alert("Ocurrió un error al procesar el archivo.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleExport = () => {
    const currentRecord = { ...notesRecord, [selectedDate]: currentNoteText };
    const validDates = Object.keys(currentRecord).filter(date => currentRecord[date] && currentRecord[date].trim() !== '');

    if (validDates.length === 0) {
      alert("No hay notas con contenido para exportar.");
      return;
    }

    const sortedDates = validDates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    let exportText = `Historial de Notas Clínicas\nGenerado el: ${new Date().toLocaleDateString()}\n\n`;
    exportText += "=========================================\n\n";

    sortedDates.forEach(date => {
      exportText += `Fecha: ${date}\n${currentRecord[date]}\n\n`;
      exportText += "-----------------------------------------\n\n";
    });

    const blob = new Blob([exportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notas_clinicas_${patientId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 animate-pulse h-64 flex items-center justify-center text-slate-400">Cargando notas...</div>;
  }

  const availableDates = Object.keys(notesRecord).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const currentIndex = availableDates.indexOf(selectedDate);

  const handlePrevDate = () => {
    if (currentIndex < availableDates.length - 1) {
      handleDateChange(availableDates[currentIndex + 1]);
    }
  };

  const handleNextDate = () => {
    if (currentIndex > 0) {
      handleDateChange(availableDates[currentIndex - 1]);
    }
  };

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 flex flex-col h-[500px]">
      
      <input 
        type="file" 
        accept=".txt" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        className="hidden" 
      />

      <div className="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
        <h3 className="text-sm uppercase font-bold text-nexus-cyan tracking-wider flex items-center gap-2">
          📝 Notas
        </h3>
        
        <div className="flex items-center gap-1">
          <button 
            onClick={handlePrevDate}
            disabled={currentIndex >= availableDates.length - 1}
            title="Nota Anterior"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ◀
          </button>
          
          <select 
            value={selectedDate}
            onChange={(e) => handleDateChange(e.target.value)}
            className="bg-slate-900 border border-slate-600 text-slate-200 text-xs rounded px-2 py-1 outline-none focus:border-nexus-cyan max-w-[120px] sm:max-w-none"
          >
            {availableDates.map(date => (
              <option key={date} value={date}>
                {date === getTodayString() ? `Hoy (${date})` : date}
              </option>
            ))}
          </select>

          <button 
            onClick={handleNextDate}
            disabled={currentIndex <= 0}
            title="Nota Siguiente"
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
          >
            ▶
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 flex flex-col">
        <textarea
          value={currentNoteText}
          onChange={(e) => setCurrentNoteText(e.target.value)}
          placeholder={`Escribe la nota para el ${selectedDate}...`}
          className="flex-1 w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-sm text-slate-200 resize-none focus:outline-none focus:border-nexus-cyan focus:ring-1 focus:ring-nexus-cyan custom-scrollbar"
        />
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex justify-between items-center">
        <div className="flex gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            title="Importar historial desde un archivo .txt"
          >
            {isImporting ? '⏳ Procesando...' : '📥 Importar'}
          </button>
          
          <button
            onClick={handleExport}
            className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
            title="Descargar historial en formato .txt"
          >
            📤 Exportar
          </button>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`px-4 py-2 rounded text-sm font-bold transition-colors shadow-lg ${
            isSaving ? 'bg-slate-600 text-slate-400 cursor-not-allowed' : 'bg-nexus-cyan text-black hover:bg-cyan-300'
          }`}
        >
          {isSaving ? 'Guardando...' : 'Guardar Nota'}
        </button>
      </div>
    </div>
  );
};