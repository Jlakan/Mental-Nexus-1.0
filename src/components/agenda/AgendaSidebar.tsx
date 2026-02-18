import React from 'react';

interface AgendaSidebarProps {
  onBack?: () => void;
  onOpenConfig: () => void;
  onOpenEvents: () => void;
  isMonthInitialized: boolean;
  onRegenerate: () => void;
  onInitialize: () => void;
  
  // Estados de Paneles
  activeSidePanel: 'none' | 'needing' | 'waitlist';
  setActiveSidePanel: (panel: 'none' | 'needing' | 'waitlist') => void;
  isPausedSidebarOpen: boolean;
  setIsPausedSidebarOpen: (open: boolean) => void;
  
  // Datos
  patientsNeedingAppt: any[];
  waitlist: any[];
  pausedList: any[];
  
  // Funciones de acción
  onOpenPausedSidebar: () => void;
  onScheduleNeeding: (p: any) => void;
  onArchivePatient: (id: string, name: string) => void;
  onAddWaitlist: () => void;
  onDeleteWaitlist: (id: string) => void;
  onReactivatePatient: (id: string, name: string) => void;

  // Prop para responsive
  isMobile: boolean; 
  
  // Función auditora
  onSyncPatients: () => void;
}

const AgendaSidebar: React.FC<AgendaSidebarProps> = ({
  onBack, onOpenConfig, onOpenEvents, isMonthInitialized, onRegenerate, onInitialize,
  activeSidePanel, setActiveSidePanel, isPausedSidebarOpen, setIsPausedSidebarOpen,
  patientsNeedingAppt, waitlist, pausedList,
  onOpenPausedSidebar, onScheduleNeeding, onArchivePatient, onAddWaitlist, onDeleteWaitlist, onReactivatePatient,
  isMobile,
  onSyncPatients
}) => {

  // --- LÓGICA (Conservamos la mejora de V2) ---
  const handleTogglePanel = (panel: 'needing' | 'waitlist') => {
    setIsPausedSidebarOpen(false); 
    if (activeSidePanel === panel) {
      setActiveSidePanel('none');
    } else {
      setActiveSidePanel(panel);
    }
  };

  const handleOpenPaused = () => {
    setActiveSidePanel('none'); 
    onOpenPausedSidebar();
  };

  // --- ESTILOS ---

  // 1. Estilo del Contenedor Principal (Fusión V1 y V2)
  const containerStyle: React.CSSProperties = {
    // Si es móvil, ocupa el 100% de su contenedor padre (el drawer).
    // Si es escritorio, impone su ancho de 280px (V1).
    width: isMobile ? '100%' : '280px', 
    height: '100%',
    background: 'white',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    
    // Restauramos bordes y sombras para escritorio (V1)
    borderRight: isMobile ? 'none' : '1px solid #ddd', 
    boxShadow: isMobile ? 'none' : '2px 0 5px rgba(0,0,0,0.05)',
    zIndex: 20 
  };

  // 2. Estilo de Paneles Secundarios (V2)
  const sidePanelStyle: React.CSSProperties = isMobile 
    ? { 
        // Móvil: Cubre todo el sidebar (Superposición)
        position: 'absolute', inset: 0, 
        background: 'white', zIndex: 30, display: 'flex', flexDirection: 'column' 
      }
    : { 
        // Escritorio: Sale a la derecha (Expansión)
        position: 'absolute', left: '100%', top: 0, bottom: 0, 
        width: '320px', background: 'white', 
        boxShadow: '5px 0 15px rgba(0,0,0,0.1)', zIndex: 19, 
        borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column' 
      };

  return (
    <div style={containerStyle}>
      
      {/* --- MENÚ PRINCIPAL --- */}
      {/* Añadimos paddingBottom: '80px' para que el botón flotante no tape las últimas opciones */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', paddingBottom: '80px' }}>
        <h3 style={{marginTop:0, color:'#333'}}>Opciones</h3>

        <button onClick={onOpenConfig} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'white', border:'1px solid #ccc', borderRadius:'6px', cursor:'pointer', textAlign:'left'}}>⚙️ Configurar</button>
        <button onClick={onOpenEvents} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'#F3E5F5', border:'1px solid #E1BEE7', color:'#7B1FA2', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', textAlign:'left'}}>📅 Mis Eventos</button>

        {/* --- BOTÓN DE SINCRONIZACIÓN NUEVO --- */}
        <button onClick={onSyncPatients} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'#E8F5E9', border:'1px solid #C8E6C9', color:'#2E7D32', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', textAlign:'left'}}>
          🔄 Auditar Pacientes
        </button>

        {isMonthInitialized ? (
          <button onClick={onRegenerate} style={{width:'100%', marginBottom:'20px', padding:'10px', background:'#FFF3E0', border:'1px solid #FFB74D', color:'#E65100', borderRadius:'6px', cursor:'pointer', textAlign:'left'}}>🔄 Actualizar Espacios</button>
        ) : (
          <button onClick={onInitialize} style={{width:'100%', marginBottom:'20px', padding:'10px', background:'#FF9800', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', textAlign:'left'}}>⚡ Inicializar Mes</button>
        )}

        <div style={{borderTop:'1px solid #eee', margin:'10px 0'}}></div>

        {/* Botón Sin Cita */}
        <button
          onClick={() => handleTogglePanel('needing')}
          style={{
            width:'100%', padding:'12px', marginBottom:'10px', borderRadius:'8px', cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background: activeSidePanel === 'needing' ? '#FFEBEE' : 'white',
            border: activeSidePanel === 'needing' ? '2px solid #EF5350' : '1px solid #eee',
            color: activeSidePanel === 'needing' ? '#D32F2F' : '#555'
          }}
        >
          <span style={{fontWeight:'bold'}}>⚠️ Sin Cita</span>
          <span style={{background:'#D32F2F', color:'white', borderRadius:'12px', padding:'2px 8px', fontSize:'11px'}}>{patientsNeedingAppt.length}</span>
        </button>

        {/* Botón Lista Espera */}
        <button
          onClick={() => handleTogglePanel('waitlist')}
          style={{
            width:'100%', padding:'12px', marginBottom:'10px', borderRadius:'8px', cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background: activeSidePanel === 'waitlist' ? '#E3F2FD' : 'white',
            border: activeSidePanel === 'waitlist' ? '2px solid #2196F3' : '1px solid #eee',
            color: activeSidePanel === 'waitlist' ? '#1976D2' : '#555'
          }}
        >
          <span style={{fontWeight:'bold'}}>⏳ Lista de Espera</span>
          <span style={{background:'#1976D2', color:'white', borderRadius:'12px', padding:'2px 8px', fontSize:'11px'}}>{waitlist.length}</span>
        </button>

        {/* Botón Pausados */}
        <button
          onClick={handleOpenPaused}
          style={{
            width:'100%', padding:'12px', marginTop:'10px', borderRadius:'8px', cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center',
            background: isPausedSidebarOpen ? '#F5F5F5' : 'white',
            border: isPausedSidebarOpen ? '2px solid #9E9E9E' : '1px solid #eee',
            color: isPausedSidebarOpen ? '#616161' : '#757575'
          }}
        >
          <span style={{fontWeight:'bold'}}>⏸️ Ver Pausados</span>
          {pausedList.length > 0 && (
            <span style={{background:'#9E9E9E', color:'white', borderRadius:'12px', padding:'2px 8px', fontSize:'11px'}}>{pausedList.length}</span>
          )}
        </button>
      </div>

      {/* --- PANELES LATERALES DINÁMICOS --- */}
      
      {activeSidePanel !== 'none' && (
        <div style={sidePanelStyle}>
          <div style={{padding:'20px', borderBottom:'1px solid #eee', background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{margin:0, color:'#333'}}>{activeSidePanel === 'needing' ? '⚠️ Requieren Cita' : '⏳ Lista de Espera'}</h3>
            <button onClick={() => setActiveSidePanel('none')} style={{border:'none', background:'none', fontSize:'18px', cursor:'pointer', color:'#999'}}>✕</button>
          </div>
          <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
             {activeSidePanel === 'needing' ? (
                patientsNeedingAppt.map(p => (
                  <div key={p.id} onClick={() => onScheduleNeeding(p)} style={{background:'white', border:'1px solid #eee', marginBottom:'8px', padding:'12px', borderRadius:'8px', cursor:'pointer'}}>
                    <strong style={{fontSize:'14px', color: '#222'}}>{p.fullName}</strong>
                    <div style={{marginTop:'10px', textAlign:'right'}}>
                      <button onClick={(e) => { e.stopPropagation(); onArchivePatient(p.id, p.fullName); }} style={{fontSize:'11px', padding:'4px 8px', cursor:'pointer'}}>Pausar</button>
                    </div>
                  </div>
                ))
             ) : (
                <>
                  <button onClick={onAddWaitlist} style={{width:'100%', marginBottom:'10px', padding:'8px', background:'#1976D2', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>+ Agregar a Espera</button>
                  {waitlist.map(w => (
                    <div key={w.id} style={{background:'white', border:'1px solid #eee', borderLeft:'4px solid #FFA000', padding:'10px', marginBottom:'8px'}}>
                      <div style={{fontWeight:'bold'}}>{w.patientName}</div>
                      <button onClick={() => onDeleteWaitlist(w.id)} style={{color:'red', border:'none', background:'none', cursor:'pointer', fontSize:'11px'}}>Eliminar</button>
                    </div>
                  ))}
                </>
             )}
          </div>
        </div>
      )}

      {isPausedSidebarOpen && (
        <div style={sidePanelStyle}>
          <div style={{padding:'20px', borderBottom:'1px solid #eee', background:'#fafafa', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
            <h3 style={{margin:0, color:'#616161', fontSize:'16px'}}>Pacientes Pausados</h3>
            <button onClick={() => setIsPausedSidebarOpen(false)} style={{border:'none', background:'none', fontSize:'18px', cursor:'pointer', color:'#999'}}>✕</button>
          </div>
          <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
            {pausedList.map(p => (
              <div key={p.id} style={{background:'white', border:'1px solid #eee', borderLeft:'4px solid #BDBDBD', padding:'12px', marginBottom:'8px'}}>
                <div style={{fontWeight:'bold'}}>{p.fullName}</div>
                <button onClick={() => onReactivatePatient(p.id, p.fullName)} style={{width:'100%', marginTop:'10px', padding:'8px', background:'#4CAF50', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>🔄 Reactivar</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- BOTÓN FLOTANTE PARA REGRESAR A MIS DOCTORES --- */}
      {onBack && (
        <button 
          onClick={onBack} 
          className="absolute bottom-6 left-6 z-50 flex items-center justify-center p-4 bg-slate-800 border border-slate-700 hover:border-cyan-400 text-cyan-400 rounded-full shadow-lg hover:shadow-[0_0_15px_rgba(34,211,238,0.3)] transition-all group"
          aria-label="Regresar a mis doctores"
          title="Regresar a mis doctores"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6 group-hover:-translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
        </button>
      )}

    </div>
  );
};

export default AgendaSidebar;