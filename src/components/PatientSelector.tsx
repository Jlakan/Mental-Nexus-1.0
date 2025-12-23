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


 // Sincronizar el input cuando se selecciona un paciente desde fuera o al editar una cita existente
 useEffect(() => {
   if (selectedPatientId) {
     const p = patients.find(x => x.id === selectedPatientId);
     if (p) setSearchTerm(p.fullName);
   } else if (manualNameValue) {
     setSearchTerm(manualNameValue);
   }
 }, [selectedPatientId, manualNameValue, patients]);


 // Cerrar el menú si se hace clic fuera del componente
 useEffect(() => {
   function handleClickOutside(event: any) {
     if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
       setIsOpen(false);
     }
   }
   document.addEventListener("mousedown", handleClickOutside);
   return () => document.removeEventListener("mousedown", handleClickOutside);
 }, [wrapperRef]);


 // Lógica de filtrado inteligente
 const filteredPatients = patients.filter(p => {
   if (!searchTerm) return true; // Si no hay búsqueda, mostrar todos
   const term = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
   const name = p.fullName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
   // Coincidencia exacta o parcial
   if (name.includes(term)) return true;
  
   // Coincidencia fonética simple (ej: K/C, S/Z)
   if ((term.startsWith('k') || term.startsWith('c')) && (name.startsWith('k') || name.startsWith('c'))) {
       const termSub = term.substring(1);
       const nameSub = name.substring(1);
       if (nameSub.includes(termSub)) return true;
   }
   return false;
 });


 const handleSelect = (id: string, name: string) => {
   setSearchTerm(name);
   onSelect(id, name);
   setIsOpen(false);
 };


 const handleManualInput = (e: React.ChangeEvent<HTMLInputElement>) => {
   const val = e.target.value;
   setSearchTerm(val);
   setIsOpen(true);
   // Si el usuario escribe, limpiamos el ID (es manual temporalmente) pero enviamos el nombre
   onSelect('', val);
 };


 // Mostrar opción manual solo si hay texto y no coincide exactamente con uno existente
 const showManualOption = searchTerm.length > 0 && !filteredPatients.some(p => p.fullName.toLowerCase() === searchTerm.toLowerCase());


 return (
   <div ref={wrapperRef} style={{ position: 'relative', width: '100%' }}>
     <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>Paciente:</label>
     <input
       type="text"
       placeholder="Seleccionar o escribir nombre..."
       value={searchTerm}
       onChange={handleManualInput}
       onClick={() => setIsOpen(true)} // Abrir lista al hacer clic
       style={{
         width: '100%', padding: '10px', borderRadius: '6px',
         border: '1px solid #ccc', boxSizing: 'border-box'
       }}
       autoComplete="off"
     />


     {isOpen && (
       <div style={{
         position: 'absolute', top: '100%', left: 0, right: 0,
         background: 'white', border: '1px solid #ccc',
         borderRadius: '0 0 6px 6px', zIndex: 1000,
         maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
       }}>
         {/* Mensaje si no hay resultados */}
         {filteredPatients.length === 0 && !showManualOption && (
            <div style={{padding:'10px', color:'#999', fontStyle:'italic'}}>No se encontraron pacientes registrados.</div>
         )}


         {/* Lista de pacientes filtrados */}
         {filteredPatients.map(p => (
           <div
             key={p.id}
             onClick={() => handleSelect(p.id, p.fullName)}
             style={{ padding: '10px', cursor: 'pointer', borderBottom: '1px solid #eee', background: 'white', transition:'0.2s' }}
             onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
             onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
           >
             <strong>{p.fullName}</strong> <br/>
             <small style={{color:'#666'}}>{p.email || 'Registrado en App'}</small>
           </div>
         ))}


         {/* Opción Manual */}
         {showManualOption && (
           <div
             onClick={() => handleSelect('', searchTerm)}
             style={{ padding: '10px', cursor: 'pointer', background: '#E8F5E9', color: '#2E7D32', fontStyle:'italic', borderTop:'1px solid #ddd' }}
           >
             ➕ Usar "<strong>{searchTerm}</strong>" como paciente externo
           </div>
         )}
       </div>
     )}
   </div>
 );
}
