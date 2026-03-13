// src/components/NextAppointments.tsx

import { AtlasCard, AtlasIcons } from './design/AtlasDesignSystem';

interface NextAppointmentsProps {
  careTeam: any;
}

export default function NextAppointments({ careTeam }: NextAppointmentsProps) {
  // Filtramos solo a los profesionales activos
  const activeCareTeam = careTeam 
    ? Object.values(careTeam).filter((p: any) => p.active) 
    : [];

  // Ordenamos por fecha de cita (Si no hay fecha, se van al final)
  // Nota: Asumimos que en el futuro agregarás un campo "nextAppointment" a la BD
  const sortedTeam = [...activeCareTeam].sort((a, b) => {
    if (!a.nextAppointment) return 1;
    if (!b.nextAppointment) return -1;
    return new Date(a.nextAppointment).getTime() - new Date(b.nextAppointment).getTime();
  });

  return (
    <AtlasCard className="bg-slate-800 border-cyan-900/50 shadow-lg w-full">
      <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
        <h3 className="text-lg font-bold text-white flex items-center gap-2">
          <AtlasIcons.Zap className="text-cyan-400" />
          PRÓXIMAS SESIONES
        </h3>
      </div>

      <div className="space-y-3 mb-4">
        {sortedTeam.length === 0 ? (
          <p className="text-xs text-slate-500 italic text-center py-4">
            No hay citas programadas en este momento.
          </p>
        ) : (
          sortedTeam.map((prof: any) => (
            <div key={prof.professionalId} className="flex items-center justify-between bg-slate-900/50 p-3 rounded-lg border border-slate-700/50 hover:border-cyan-500/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-600">
                  👨‍⚕️
                </div>
                <div>
                  <p className="text-sm font-bold text-white leading-tight">
                    {prof.professionType || 'Especialista'}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    {prof.professionalName}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-cyan-400 font-bold">
                  {/* Simulador de fecha si no existe en la BD aún */}
                  {prof.nextAppointment 
                    ? new Date(prof.nextAppointment).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) 
                    : 'Por definir'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recordatorio Gamificado */}
      <div className="bg-cyan-900/20 border border-cyan-500/30 rounded-lg p-3 flex items-start gap-3">
        <div className="text-cyan-400 mt-0.5 animate-pulse">
          <AtlasIcons.Target size={16} />
        </div>
        <div>
          <p className="text-xs font-bold text-cyan-300 uppercase tracking-wide">
            Recordatorio Nexus
          </p>
          <p className="text-[10px] text-slate-400 mt-1">
            Al finalizar tu próxima sesión, recuerda solicitarle a tu especialista que te asigne tus puntos Nexus correspondientes.
          </p>
        </div>
      </div>
    </AtlasCard>
  );
}