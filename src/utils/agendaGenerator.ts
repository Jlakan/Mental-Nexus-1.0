// utils/agendaGenerator.ts
import type { WorkConfig, MonthlySlotMap } from './agendaTypes';

// Helper para convertir "09:30" a horas y minutos numéricos
const parseTimeStr = (timeStr: string) => {
  const [h, m] = timeStr.split(':').map(Number);
  return { h, m };
};

export const generateMonthSkeleton = (
  year: number, 
  month: number, 
  config: WorkConfig
): MonthlySlotMap => {

  const slots: MonthlySlotMap = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Recorremos cada día del mes (1 al 31)
  for (let day = 1; day <= daysInMonth; day++) {
    
    const dateObj = new Date(year, month, day);
    const dayOfWeek = dateObj.getDay(); // 0 (Dom) a 6 (Sab)

    // 1. Obtenemos la regla para este día específico
    const dayRule = config.schedule[dayOfWeek];

    // Si no hay regla o el día no está activo, saltamos
    if (!dayRule || !dayRule.active) continue;

    // 2. Iteramos por cada RANGO de horas (ej: Mañana y Tarde)
    // Esto permite que tengas huecos libres para comer sin crear slots
    dayRule.ranges.forEach(range => {
      
      const start = parseTimeStr(range.start);
      const end = parseTimeStr(range.end);

      // Creamos objetos Date para calcular los bloques
      let currentTime = new Date(year, month, day, start.h, start.m);
      const limitTime = new Date(year, month, day, end.h, end.m);

      // Generar slots mientras quepan en el rango
      while (currentTime < limitTime) {
        // Verificar que el slot completo cabe antes de la hora de salida
        const slotEnd = new Date(currentTime);
        slotEnd.setMinutes(currentTime.getMinutes() + config.durationMinutes);

        if (slotEnd > limitTime) break; 

        // Generar Clave (ID)
        const dayStr = day.toString().padStart(2, '0');
        const hStr = currentTime.getHours().toString().padStart(2, '0');
        const mStr = currentTime.getMinutes().toString().padStart(2, '0');
        const slotKey = `${dayStr}_${hStr}${mStr}`; // Ej: "05_0900"
        const timeDisplay = `${hStr}:${mStr}`;

        slots[slotKey] = {
          status: 'available',
          time: timeDisplay,
          price: config.defaultPrice,
          duration: config.durationMinutes
        };

        // Avanzar al siguiente bloque
        currentTime = slotEnd; 
      }
    });
  }

  return slots;
};