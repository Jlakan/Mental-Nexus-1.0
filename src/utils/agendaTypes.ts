export interface TimeRange {
    start: string; 
    end: string;
  }
  
  export interface DaySchedule {
    active: boolean;
    ranges: TimeRange[];
  }
  
  export interface WorkConfig {
    durationMinutes: number;
    defaultPrice: number;
    schedule: {
      [dayOfWeek: number]: DaySchedule;
    };
  }
  
  export type SlotStatus = 'available' | 'booked' | 'blocked' | 'completed' | 'cancelled';
  
  // --- VERIFICA QUE ESTE BLOQUE ESTÉ PRESENTE ---
  export interface AgendaSlot {
    status: SlotStatus;
    time: string;
    duration: number;
    price: number;
    
    // Datos cuando está ocupado
    patientId?: string;
    patientName?: string;
    patientExternalPhone?: string;
    patientExternalEmail?: string;
    
    adminNotes?: string;
    paymentStatus?: 'pending' | 'paid';
    paymentMethod?: string;
    
    // Metadata
    updatedAt?: string;
    bookedBy?: string;
  }
  
  export interface MonthlySlotMap {
    [slotKey: string]: AgendaSlot;
  }
  
  export interface MonthlyAgendaDocument {
    id: string;
    professionalId: string;
    year: number;
    month: number;
    slots: MonthlySlotMap;
  }