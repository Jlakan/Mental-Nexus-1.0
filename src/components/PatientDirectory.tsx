// src/components/PatientDirectory.tsx
import { useState, useMemo } from 'react';
import PatientFilterBar from './PatientFilterBar';
import PatientCard from './PatientCard';

interface PatientDirectoryProps {
  patients: any[];
  professionalId: string;
  onOpenPatient: (patient: any) => void;
  onUnlink: (patient: any) => void;
  onRegisterAttendance: (patient: any) => void;
}

export default function PatientDirectory({
  patients,
  professionalId,
  onOpenPatient,
  onUnlink,
  onRegisterAttendance
}: PatientDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name_asc');

  const filteredAndSortedPatients = useMemo(() => {
    let result = [...patients];

    // 1. Filtro por texto (Búsqueda)
    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.fullName?.toLowerCase().includes(lowerTerm) || 
        p.email?.toLowerCase().includes(lowerTerm)
      );
    }

    // 2. Filtros Rápidos
    const now = new Date();
    if (activeFilter === 'upcoming_appt') {
      result = result.filter(p => {
        const apptStr = p.careTeam?.[professionalId]?.nextAppointment;
        if (!apptStr) return false;
        return new Date(apptStr) > now;
      });
    } else if (activeFilter === 'needs_attention') {
      result = result.filter(p => {
        // Consideramos "atención requerida" si no tiene asistencia en más de 7 días
        if (!p.lastAttendance?.[professionalId]) return true; // Nunca ha tenido asistencia
        const lastAtt = p.lastAttendance[professionalId].toDate 
          ? p.lastAttendance[professionalId].toDate() 
          : new Date(p.lastAttendance[professionalId]);
        const daysSince = Math.abs(now.getTime() - lastAtt.getTime()) / (1000 * 3600 * 24);
        return daysSince > 7;
      });
    }

    // 3. Ordenamiento
    result.sort((a, b) => {
      if (sortBy === 'name_asc') {
        return (a.fullName || '').localeCompare(b.fullName || '');
      } 
      else if (sortBy === 'level_desc') {
        const levelA = a.gamificationProfile?.level || 1;
        const levelB = b.gamificationProfile?.level || 1;
        return levelB - levelA;
      } 
      else if (sortBy === 'appt_closest') {
        const apptA = a.careTeam?.[professionalId]?.nextAppointment;
        const apptB = b.careTeam?.[professionalId]?.nextAppointment;
        
        // Asignamos Infinity a las fechas pasadas o inexistentes para mandarlas al final de la lista
        const timeA = apptA && new Date(apptA) > now ? new Date(apptA).getTime() : Infinity;
        const timeB = apptB && new Date(apptB) > now ? new Date(apptB).getTime() : Infinity;
        
        return timeA - timeB;
      }
      return 0;
    });

    return result;
  }, [patients, searchTerm, activeFilter, sortBy, professionalId]);

  return (
    <div className="flex flex-col gap-4">
      <PatientFilterBar 
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

      {filteredAndSortedPatients.length === 0 ? (
        <div className="text-center py-16 bg-slate-800/50 rounded-xl border border-dashed border-slate-700">
          <div className="text-4xl mb-4">📭</div>
          <h3 className="text-lg font-bold text-white mb-2">No se encontraron pacientes</h3>
          <p className="text-sm text-slate-400">
            Intenta cambiar los filtros o los términos de búsqueda.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAndSortedPatients.map(p => (
            <PatientCard 
              key={p.id}
              patient={p}
              professionalId={professionalId}
              onOpenPatient={onOpenPatient}
              onUnlink={onUnlink}
              onRegisterAttendance={onRegisterAttendance}
            />
          ))}
        </div>
      )}
    </div>
  );
}