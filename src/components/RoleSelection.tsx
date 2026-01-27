// src/components/RoleSelection.tsx
interface Props {
  userName: string;
  onSelect: (role: 'patient' | 'professional' | 'assistant') => void;
}

export default function RoleSelection({ userName, onSelect }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      
      <h1 className="text-4xl md:text-5xl mb-4">
        Bienvenido, <span className="text-nexus-cyan">{userName}</span>
      </h1>
      <p className="text-nexus-muted text-lg mb-12 max-w-2xl">
        Identifica tu nivel de acceso para inicializar la interfaz neuronal.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        
        {/* OPCIÓN: PACIENTE */}
        <div 
          onClick={() => onSelect('patient')}
          className="nexus-card cursor-pointer group hover:-translate-y-2"
        >
          <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🧬</div>
          <h3 className="text-2xl text-nexus-green mb-2">Paciente</h3>
          <p className="text-sm text-slate-400">
            Accede a tus misiones, visualiza tu progreso y evoluciona tu perfil.
          </p>
        </div>

        {/* OPCIÓN: PROFESIONAL */}
        <div 
          onClick={() => onSelect('professional')}
          className="nexus-card cursor-pointer group hover:-translate-y-2 border-nexus-cyan/30"
        >
          <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🥼</div>
          <h3 className="text-2xl text-nexus-cyan mb-2">Profesional</h3>
          <p className="text-sm text-slate-400">
            Gestión clínica, asignación de tareas y análisis de población.
          </p>
        </div>

        {/* OPCIÓN: ASISTENTE */}
        <div 
          onClick={() => onSelect('assistant')}
          className="nexus-card cursor-pointer group hover:-translate-y-2"
        >
          <div className="text-6xl mb-4 group-hover:scale-110 transition-transform">🛡️</div>
          <h3 className="text-2xl text-purple-400 mb-2">Asistente</h3>
          <p className="text-sm text-slate-400">
            Gestión de agenda, recepción y soporte administrativo.
          </p>
        </div>

      </div>
    </div>
  );
}