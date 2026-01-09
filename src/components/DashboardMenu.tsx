interface Props {
  activeView: string;
  onNavigate: (view: any) => void;
  onLogout: () => void;
}

export default function DashboardMenu({ activeView, onNavigate, onLogout }: Props) {
  // Función auxiliar para saber si un botón debe estar "activo"
  // Nota: Si estamos viendo el detalle de un paciente, mantenemos activo el botón de "Pacientes"
  const isActive = (menuView: string) => {
    if (activeView === menuView) return true;
    if (menuView === 'patients_manage' && activeView === 'patient_detail') return true;
    return false;
  };

  const getButtonStyle = (menuView: string) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 20px',
    border: 'none',
    background: isActive(menuView) ? '#E3F2FD' : 'transparent', // Azul claro si está activo
    color: isActive(menuView) ? '#1565C0' : '#546E7A',          // Azul fuerte si activo, gris si no
    fontWeight: isActive(menuView) ? 'bold' : 'normal',
    cursor: 'pointer',
    borderRadius: '8px',
    marginBottom: '8px',
    fontSize: '15px',
    textAlign: 'left' as const,
    transition: 'background 0.2s'
  });

  return (
    <div style={{
      width: '240px',
      minWidth: '240px',
      background: 'white',
      borderRight: '1px solid #ECEFF1',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      height: '100vh', // Ocupa toda la altura
      boxSizing: 'border-box',
      position: 'sticky',
      top: 0
    }}>
      {/* Título o Logo de la App (Opcional) */}
      <div style={{ marginBottom: '30px', paddingLeft: '10px' }}>
        <h2 style={{ margin: 0, color: '#1565C0', fontSize: '20px' }}>Mental Nexus</h2>
        <span style={{ fontSize: '12px', color: '#90A4AE' }}>Panel Profesional</span>
      </div>

      {/* MENÚ DE NAVEGACIÓN */}
      <nav style={{ flex: 1 }}>
        <button onClick={() => onNavigate('dashboard')} style={getButtonStyle('dashboard')}>
          <span>📊</span> Inicio
        </button>

        <button onClick={() => onNavigate('patients_manage')} style={getButtonStyle('patients_manage')}>
          <span>👥</span> Pacientes
        </button>

        <button onClick={() => onNavigate('agenda')} style={getButtonStyle('agenda')}>
          <span>📅</span> Agenda
        </button>

        <button onClick={() => onNavigate('team')} style={getButtonStyle('team')}>
          <span>🥼</span> Equipo
        </button>
      </nav>

      {/* BOTÓN DE SALIR (Abajo del todo) */}
      <div style={{ borderTop: '1px solid #ECEFF1', paddingTop: '20px' }}>
        <button
          onClick={onLogout}
          style={{
            ...getButtonStyle('logout'), // Reutilizamos estilos base
            background: '#FFEBEE',
            color: '#D32F2F',
            justifyContent: 'center'
          }}
        >
          🚪 Cerrar Sesión
        </button>
      </div>
    </div>
  );
}