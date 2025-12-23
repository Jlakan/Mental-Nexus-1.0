import { differenceInCalendarDays, getDay, parseISO, isBefore, addDays } from 'date-fns';


// --- CONFIGURACIÓN ---
const DAY_MAP: { [key: string]: number } = {
 'dom': 0, 'lun': 1, 'mar': 2, 'mie': 3, 'jue': 4, 'vie': 5, 'sab': 6
};
const DAY_LABELS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];


// --- TIPOS DE DATOS ---
interface RoutineStats {
   totalAssigned: number;
   totalCompleted: number;
   complianceRate: number;
}


interface CorrelationResult {
   taskTitle: string;
   avgPatientNexus: number; // El promedio de Nexus que tienen los pacientes que completan esta tarea
   totalCompletions: number;
}


// ============================================================================
// 1. CUMPLIMIENTO (INDIVIDUAL Y GRUPAL)
// ============================================================================


/**
* Calcula el % de cumplimiento de UNA rutina específica.
*/
export const calculateIndividualCompliance = (routine: any): RoutineStats => {
   const createdAt = routine.createdAt?.toDate ? routine.createdAt.toDate() : new Date(routine.createdAt);
   const now = new Date();
   const frequency = routine.frequency || [];
   const history = routine.completionHistory || {};


   let potentialDays = 0;
   let completedDays = 0;


   let current = new Date(createdAt);
   // Recorremos desde la creación hasta hoy
   while (isBefore(current, now) || current.toDateString() === now.toDateString()) {
       const dayIndex = getDay(current);
       const dayString = Object.keys(DAY_MAP).find(key => DAY_MAP[key] === dayIndex);
      
       if (dayString && frequency.includes(dayString)) {
           potentialDays++;
           const dateKey = current.toISOString().split('T')[0];
           if (history[dateKey]) completedDays++;
       }
       current = addDays(current, 1);
   }


   return {
       totalAssigned: potentialDays,
       totalCompleted: completedDays,
       complianceRate: potentialDays === 0 ? 0 : (completedDays / potentialDays) * 100
   };
};


/**
* Genera reporte agrupado por "intensidad" (días a la semana).
*/
export const generateComplianceReport = (allRoutines: any[]) => {
   const groups: { [key: number]: { sumCompliance: number, count: number } } = {};
   let globalSum = 0;
   let globalCount = 0;


   allRoutines.forEach(routine => {
       const stats = calculateIndividualCompliance(routine);
       const freqLength = routine.frequency?.length || 0; // 0 a 7 días


       if (!groups[freqLength]) groups[freqLength] = { sumCompliance: 0, count: 0 };
       groups[freqLength].sumCompliance += stats.complianceRate;
       groups[freqLength].count += 1;


       globalSum += stats.complianceRate;
       globalCount += 1;
   });


   const groupResults = Object.keys(groups).map(key => {
       const k = Number(key);
       return {
           frequencyCount: k,
           peopleCount: groups[k].count,
           avgCompliance: (groups[k].sumCompliance / groups[k].count).toFixed(1) + '%'
       };
   });


   return {
       globalAverage: globalCount === 0 ? '0%' : (globalSum / globalCount).toFixed(1) + '%',
       byGroup: groupResults.sort((a, b) => a.frequencyCount - b.frequencyCount)
   };
};


// ============================================================================
// 2. TENDENCIAS TEMPORALES (DÍAS DE LA SEMANA)
// ============================================================================


export const getCompletionTrendsByDay = (allRoutines: any[]) => {
   const counts = [0, 0, 0, 0, 0, 0, 0]; // Dom-Sab


   allRoutines.forEach(routine => {
       const history = routine.completionHistory || {};
       Object.keys(history).forEach(dateString => {
           try {
               const dayIndex = getDay(parseISO(dateString));
               counts[dayIndex]++;
           } catch (e) { console.warn("Fecha inválida:", dateString); }
       });
   });


   const total = counts.reduce((a, b) => a + b, 0);
   const chartData = DAY_LABELS.map((label, index) => ({
       day: label,
       completions: counts[index],
       percentage: total === 0 ? 0 : ((counts[index] / total) * 100).toFixed(1)
   }));


   const maxVal = Math.max(...counts);
  
   return {
       bestDay: total === 0 ? 'N/A' : DAY_LABELS[counts.indexOf(maxVal)],
       trendData: chartData
   };
};


// ============================================================================
// 3. CORRELACIÓN NEXUS (ASISTENCIA) VS TAREAS
// ============================================================================


/**
* Descubre qué tareas son preferidas por los pacientes con alta asistencia.
* @param tasks Lista mezclada de misiones y rutinas de TODOS los pacientes.
* @param patients Lista de todos los pacientes (para consultar sus Nexus).
*/
export const analyzeTaskCorrelationWithAttendance = (tasks: any[], patients: any[]): CorrelationResult[] => {
   // 1. Crear mapa rápido: ID Paciente -> Cantidad de Nexus
   const patientNexusMap: { [uid: string]: number } = {};
   patients.forEach(p => {
       patientNexusMap[p.uid || p.id] = p.gamificationProfile?.wallet?.nexus || 0;
   });


   // 2. Agrupar tareas por Título
   const taskGroups: { [title: string]: { nexusSum: number, completersCount: number } } = {};


   tasks.forEach(task => {
       const pNexus = patientNexusMap[task.patientId] || 0;
      
       // Criterio de "Considerar": Misión completada o Rutina con al menos 1 check
       let isRelevant = false;
       if (task.type === 'daily') {
           isRelevant = task.completionHistory && Object.keys(task.completionHistory).length > 0;
       } else {
           isRelevant = task.status === 'completed';
       }


       if (isRelevant) {
           if (!taskGroups[task.title]) {
               taskGroups[task.title] = { nexusSum: 0, completersCount: 0 };
           }
           taskGroups[task.title].nexusSum += pNexus;
           taskGroups[task.title].completersCount += 1;
       }
   });


   // 3. Calcular promedios y formatear
   const results: CorrelationResult[] = Object.keys(taskGroups).map(title => {
       const group = taskGroups[title];
       return {
           taskTitle: title,
           // Si el promedio es 15, significa que los pacientes que hacen esta tarea suelen tener 15 Nexus (Han ido a ~15 sesiones)
           avgPatientNexus: parseFloat((group.nexusSum / group.completersCount).toFixed(1)),
           totalCompletions: group.completersCount
       };
   });


   // 4. Ordenar: Las tareas con mayor "Avg Nexus" arriba.
   // Estas son las tareas que completan tus pacientes más fieles.
   return results.sort((a, b) => b.avgPatientNexus - a.avgPatientNexus);
};
