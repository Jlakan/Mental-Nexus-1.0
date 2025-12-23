import React from 'react';


interface Props {
 userName: string;
 onSelect: (role: 'patient' | 'professional' | 'assistant') => void;
}


export default function RoleSelection({ userName, onSelect }: Props) {
 return (
   <div style={{ textAlign: 'center', marginTop: '50px', fontFamily: 'sans-serif' }}>
     <h1>¡Hola, {userName}!</h1>
     <p>Para continuar, selecciona tu perfil en Mental Nexus.</p>


     <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '30px', flexWrap: 'wrap' }}>
      
       {/* Botón Paciente */}
       <button
         onClick={() => onSelect('patient')}
         style={{
           padding: '20px',
           fontSize: '18px',
           cursor: 'pointer',
           backgroundColor: '#4CAF50', // Verde
           color: 'white',
           border: 'none',
           borderRadius: '8px',
           width: '200px',
           boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
         }}
       >
         Soy Paciente
       </button>


       {/* Botón Profesional */}
       <button
         onClick={() => onSelect('professional')}
         style={{
           padding: '20px',
           fontSize: '18px',
           cursor: 'pointer',
           backgroundColor: '#2196F3', // Azul
           color: 'white',
           border: 'none',
           borderRadius: '8px',
           width: '200px',
           boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
         }}
       >
         Soy Profesional
       </button>


       {/* NUEVO: Botón Asistente */}
       <button
         onClick={() => onSelect('assistant')}
         style={{
           padding: '20px',
           fontSize: '18px',
           cursor: 'pointer',
           backgroundColor: '#9C27B0', // Morado
           color: 'white',
           border: 'none',
           borderRadius: '8px',
           width: '200px',
           boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
         }}
       >
         Soy Asistente
       </button>


     </div>
   </div>
 );
}
