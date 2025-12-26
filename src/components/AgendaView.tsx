import { useState, useEffect } from 'react';
import {
  doc, getDoc, collection, query, where, getDocs,
  setDoc, updateDoc, writeBatch, arrayUnion
} from "firebase/firestore";
import { db } from '../services/firebase';
import PatientSelector from './PatientSelector';
import AgendaConfigModal from './AgendaConfigModal';
import { generateMonthSkeleton } from '../utils/agendaGenerator';

import type { MonthlySlotMap, WorkConfig, AgendaSlot } from '../utils/agendaTypes';

interface Props {
  userRole: 'professional' | 'assistant';
  currentUserId: string;
  onBack?: () => void;
}

const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];

const DEFAULT_CONFIG: WorkConfig = {
  durationMinutes: 50,
  defaultPrice: 500,
  schedule: {
    1: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    2: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    3: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    4: { active: true, ranges: [{ start: "09:00", end: "14:00" }, { start: "16:00", end: "20:00" }] },
    5: { active: true, ranges: [{ start: "09:00", end: "14:00" }] },
    6: { active: true, ranges: [{ start: "10:00", end: "14:00" }] },
    0: { active: false, ranges: [] }
  }
};

const getCalendarGrid = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayIndex = firstDay.getDay();

  const grid = [];
  for (let i = 0; i < startDayIndex; i++) grid.push(null);
  for (let i = 1; i <= daysInMonth; i++) grid.push(new Date(year, month, i));
  return grid;
};

export default function AgendaView({ userRole, currentUserId, onBack }: Props) {
  // --- CONTEXTO ---
  const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>('');
  
  // --- DATOS AGENDA ---
  const [currentMonthData, setCurrentMonthData] = useState<MonthlySlotMap | null>(null);
  const [isMonthInitialized, setIsMonthInitialized] = useState(false);
  const [patients, setPatients] = useState<any[]>([]);
  
  // --- SEGUIMIENTO / RETENCIÓN ---
  const [pendingPatients, setPendingPatients] = useState<any[]>([]);
  const [preSelectedPatient, setPreSelectedPatient] = useState<{id: string, name: string} | null>(null);
  
  // --- CONFIGURACIÓN ---
  const [workConfig, setWorkConfig] = useState<WorkConfig>(DEFAULT_CONFIG);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  
  // --- UI STATE ---
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [loading, setLoading] = useState(true);

  // --- MODALES ---
  const [isDayViewOpen, setIsDayViewOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // --- FORMULARIO ---
  const [targetSlotKey, setTargetSlotKey] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    patientId: '',
    patientName: '',
    patientExternalPhone: '',
    patientExternalEmail: '',
    price: 500,
    adminNotes: '',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    treatmentStatus: 'active'
  });

  // 1. CARGA INICIAL
  useEffect(() => {
    const loadContext = async () => {
      try {
        if (userRole === 'professional') {
          const docSnap = await getDoc(doc(db, "professionals", currentUserId));
          const selfData = { id: currentUserId, ...docSnap.data() };
          
          if (selfData.agendaSettings) setWorkConfig(selfData.agendaSettings);
          setMyProfessionals([selfData]);
          setSelectedProfId(currentUserId);
        } else {
          const q = query(collection(db, "professionals"), where("authorizedAssistants", "array-contains", currentUserId));
          const snap = await getDocs(q);
          const pros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
          setMyProfessionals(pros);
          if (pros.length > 0) {
             setSelectedProfId(pros[0].id);
             if (pros[0].agendaSettings) setWorkConfig(pros[0].agendaSettings);
          }
        }
      } catch (e) { console.error(e); }
    };
    loadContext();
  }, [currentUserId, userRole]);

  // 2. CARGA DE MES + PACIENTES
  useEffect(() => {
    if (!selectedProfId) return;
    loadMonthDoc();
    loadPatients();
  }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);

  const loadMonthDoc = async () => {
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;

      const docRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentMonthData(data.slots);
        setIsMonthInitialized(true);
      } else {
        setCurrentMonthData(null);
        setIsMonthInitialized(false);
      }
    } catch (e) { console.error(e); } 
    finally { setLoading(false); }
  };

  const loadPatients = async () => {
    const profRef = myProfessionals.find(p => p.id === selectedProfId);
    if(profRef?.professionalCode) {
        const q = query(collection(db, "patients"), where("linkedProfessionalCode", "==", profRef.professionalCode));
        const snap = await getDocs(q);
        const patientsList = snap.docs.map(d => ({id: d.id, ...d.data()}));
        setPatients(patientsList);
        calculatePendingPatients(patientsList);
    }
  };

  // --- LÓGICA DE DETECCIÓN DE "FALTANTES" ---
  const calculatePendingPatients = (allPatients: any[]) => {
    const now = new Date();
    now.setHours(0,0,0,0);
    
    const pending = allPatients.filter(p => {
        const careData = p.careTeam?.[selectedProfId];
        if (!careData) return true;
        if (careData.status === 'discharged') return false;

        if (!careData.nextAppointment) return true;
        
        const nextDate = new Date(careData.nextAppointment);
        return nextDate < now; 
    });

    setPendingPatients(pending);
  };

  // 3. INICIALIZAR MES
  const handleInitializeMonth = async () => {
    if (!window.confirm(`¿Generar agenda?`)) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const emptySlots = generateMonthSkeleton(year, month, workConfig);

      await setDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), {
        id: monthDocId, professionalId: selectedProfId, year, month, slots: emptySlots, createdAt: new Date()
      });

      setCurrentMonthData(emptySlots);
      setIsMonthInitialized(true);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 4. REGENERAR MES
  const handleRegenerateMonth = async () => {
    if (!currentMonthData) return;
    if (!window.confirm("⚠️ ¿Actualizar horarios?\n\nTUS CITAS YA AGENDADAS SE RESPETARÁN.")) return;
    setLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      
      const newSkeleton = generateMonthSkeleton(year, month, workConfig);
      const mergedSlots = { ...newSkeleton };

      Object.entries(currentMonthData).forEach(([key, oldSlot]) => {
        if (oldSlot.status !== 'available') mergedSlots[key] = oldSlot;
      });

      await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), { slots: mergedSlots, updatedAt: new Date() });
      setCurrentMonthData(mergedSlots);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 5. BLOQUEAR DÍA
  const handleBlockDay = async () => {
    if (!currentMonthData) return;
    const reason = window.prompt("¿Motivo del bloqueo?");
    if (reason === null) return;
    if (!window.confirm(`⚠️ ¿Bloquear día ${selectedDate.toLocaleDateString()}?`)) return;

    setLoading(true);
    try {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
        const prefix = `${selectedDate.getDate().toString().padStart(2, '0')}_`;

        const updates: any = {};
        const updatedLocalData = { ...currentMonthData };
        let count = 0;

        Object.entries(currentMonthData).forEach(([key, slot]) => {
            if (key.startsWith(prefix) && slot.status === 'available') {
                     const blockedSlot: AgendaSlot = { ...slot, status: 'blocked', adminNotes: reason || 'Bloqueado', price: 0 };
                     updates[`slots.${key}`] = blockedSlot;
                     updatedLocalData[key] = blockedSlot;
                     count++;
            }
        });

        if (count > 0) {
            await updateDoc(doc(db, "professionals", selectedProfId, "availability", monthDocId), updates);
            setCurrentMonthData(updatedLocalData);
            setIsDayViewOpen(false);
        }
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 6. GUARDAR CONFIGURACIÓN
  const handleSaveConfig = async (newConfig: WorkConfig) => {
    setLoading(true);
    try {
        await updateDoc(doc(db, "professionals", selectedProfId), { agendaSettings: newConfig });
        setWorkConfig(newConfig);
        setIsConfigOpen(false);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  // 7. GUARDAR CITA
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetSlotKey || !currentMonthData) return;
    if (!formData.patientName) return alert("Nombre requerido");

    setLoading(true);
    try {
      const batch = writeBatch(db);
      
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
      const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);

      const [d, t] = targetSlotKey.split('_');
      const appointmentDate = new Date(year, month, parseInt(d), parseInt(t.substring(0,2)), parseInt(t.substring(2)));
      const isFutureDate = appointmentDate > new Date();

      const slotPath = `slots.${targetSlotKey}`;
      const slotPayload: Partial<AgendaSlot> = {
        status: 'booked',
        patientId: formData.patientId || undefined,
        patientName: formData.patientName,
        patientExternalPhone: formData.patientExternalPhone,
        patientExternalEmail: formData.patientExternalEmail,
        price: Number(formData.price),
        adminNotes: formData.adminNotes,
        paymentStatus: formData.paymentStatus as any,
        updatedAt: new Date().toISOString()
      };
      
      batch.update(agendaRef, { [slotPath]: { ...currentMonthData[targetSlotKey], ...slotPayload } });

      if (formData.patientId) {
        const patientRef = doc(db, "patients", formData.patientId);
        
        const historyRef = doc(db, "patients", formData.patientId, "gamification", "history");
        const patientHistoryItem = {
           date: appointmentDate.toISOString(), slotKey: targetSlotKey, professionalId: selectedProfId,
           professionalName: myProfessionals.find(p=>p.id===selectedProfId)?.fullName || 'Doctor',
           status: 'booked', xpEarned: 0
        };
        batch.set(historyRef, { lastUpdate: new Date(), appointments: arrayUnion(patientHistoryItem) }, { merge: true });

        const careTeamUpdate = {
           careTeam: {
             [selectedProfId]: {
                status: formData.treatmentStatus,
                lastUpdate: new Date().toISOString(),
                ...(isFutureDate ? { nextAppointment: appointmentDate.toISOString() } : {}),
                ...(formData.treatmentStatus === 'discharged' ? { nextAppointment: null } : {})
             }
           }
        };
        batch.set(patientRef, careTeamUpdate, { merge: true });
      }

      await batch.commit();
      
      setCurrentMonthData({ ...currentMonthData, [targetSlotKey]: { ...currentMonthData[targetSlotKey], ...slotPayload as AgendaSlot } });
      
      if (formData.patientId) {
        const updatedPatients = patients.map(p => {
            if (p.id === formData.patientId) {
                const newCareTeam = { ...p.careTeam } || {};
                if (!newCareTeam[selectedProfId]) newCareTeam[selectedProfId] = {};
                newCareTeam[selectedProfId] = {
                    ...newCareTeam[selectedProfId],
                    status: formData.treatmentStatus,
                    nextAppointment: isFutureDate ? appointmentDate.toISOString() : (formData.treatmentStatus === 'discharged' ? null : newCareTeam[selectedProfId].nextAppointment)
                };
                return { ...p, careTeam: newCareTeam };
            }
            return p;
        });
        setPatients(updatedPatients);
        calculatePendingPatients(updatedPatients);
      }

      setPreSelectedPatient(null);
      setIsFormOpen(false);
    } catch (e) { console.error(e); alert("Error guardando."); } finally { setLoading(false); }
  };

  // 8. CANCELAR / LIBERAR SLOT (AQUÍ ESTÁ EL CAMBIO IMPORTANTE)
  const handleCancelSlot = async (slotKey: string) => {
    if (!window.confirm("¿Liberar este espacio?")) return;
    try {
        const year = selectedDate.getFullYear();
        const month = selectedDate.getMonth();
        const monthDocId = `${year}_${month.toString().padStart(2, '0')}`;
        
        // 1. Obtenemos datos del slot antes de borrarlo
        const slotOriginal = currentMonthData![slotKey];
        
        const resetSlot: AgendaSlot = {
            status: 'available',
            time: slotOriginal.time,
            duration: slotOriginal.duration,
            price: workConfig.defaultPrice 
        };

        const batch = writeBatch(db);

        // 2. Actualizamos la agenda (borrar cita)
        const agendaRef = doc(db, "professionals", selectedProfId, "availability", monthDocId);
        batch.update(agendaRef, { [`slots.${slotKey}`]: resetSlot });

        // 3. ACTUALIZAR AL PACIENTE: Borrar 'nextAppointment'
        if (slotOriginal.patientId) {
            const patientRef = doc(db, "patients", slotOriginal.patientId);
            // Establecemos nextAppointment como null para que vuelva a aparecer en la lista
            // NOTA: Esto asume que borras su única cita futura. 
            // Si el paciente tiene OTRA cita futura además de esta, aquí habría que buscarla.
            // Para simplificar, lo marcamos como null para que el asistente revise.
            const cancelUpdate = {
                [`careTeam.${selectedProfId}.nextAppointment`]: null,
                [`careTeam.${selectedProfId}.lastUpdate`]: new Date().toISOString()
            };
            batch.update(patientRef, cancelUpdate);
        }

        await batch.commit();

        // 4. Actualización Visual (Optimista)
        setCurrentMonthData({ ...currentMonthData!, [slotKey]: resetSlot });

        if (slotOriginal.patientId) {
            const updatedPatients = patients.map(p => {
                if (p.id === slotOriginal.patientId) {
                    const newCareTeam = { ...p.careTeam } || {};
                    if (newCareTeam[selectedProfId]) {
                        newCareTeam[selectedProfId].nextAppointment = null; // Borramos la fecha visualmente
                    }
                    return { ...p, careTeam: newCareTeam };
                }
                return p;
            });
            setPatients(updatedPatients);
            calculatePendingPatients(updatedPatients); // Esto hará que reaparezca en la lista roja
        }

    } catch(e) { console.error(e); }
  };

  // --- UI HELPERS ---
  const openForm = (slotKey: string, slot: AgendaSlot) => {
    setTargetSlotKey(slotKey);
    const initialPatientId = slot.patientId || (preSelectedPatient?.id || '');
    const initialPatientName = slot.patientName || (preSelectedPatient?.name || '');

    setFormData({
        patientId: initialPatientId,
        patientName: initialPatientName,
        patientExternalPhone: slot.patientExternalPhone || '',
        patientExternalEmail: slot.patientExternalEmail || '',
        price: slot.price,
        adminNotes: slot.adminNotes || '',
        paymentStatus: slot.paymentStatus || 'pending',
        paymentMethod: slot.paymentMethod || 'cash',
        treatmentStatus: 'active'
    });
    setIsFormOpen(true);
  };

  // --- RENDER DÍA ---
  const renderDaySlots = () => {
    if (!currentMonthData) return <div>Cargando...</div>;
    const prefix = `${selectedDate.getDate().toString().padStart(2, '0')}_`;
    const daySlots = Object.entries(currentMonthData)
        .filter(([key]) => key.startsWith(prefix))
        .sort((a, b) => a[0].localeCompare(b[0]));

    if (daySlots.length === 0) return <div style={{padding:'20px', color:'#777'}}>Día no laboral.</div>;

    return (
        <div>
            {daySlots.map(([key, slot]) => (
                <div key={key} style={{borderBottom:'1px solid #eee', padding:'12px', display:'flex', alignItems:'center', gap:'15px'}}>
                    <div style={{fontWeight:'bold', color:'#555', minWidth:'60px'}}>{slot.time}</div>
                    <div style={{flex:1}}>
                        {slot.status === 'available' ? (
                             <div 
                                onClick={() => openForm(key, slot)}
                                style={{
                                    border:'1px dashed #4CAF50', color:'#4CAF50', padding:'8px', 
                                    borderRadius:'6px', cursor:'pointer', textAlign:'center', background:'#F1F8E9'
                                }}
                             >
                                + Disponible
                             </div>
                        ) : slot.status === 'blocked' ? (
                            <div onClick={() => handleCancelSlot(key)} style={{background: '#FFEBEE', color:'#D32F2F', padding:'10px', borderRadius:'6px', cursor:'pointer', display:'flex', justifyContent:'space-between'}}>
                                <strong>🚫 {slot.adminNotes || 'Bloqueado'}</strong><span>✕</span>
                            </div>
                        ) : (
                            <div onClick={() => openForm(key, slot)} style={{background: slot.paymentStatus === 'paid' ? '#E8F5E9' : '#E3F2FD', borderLeft: `4px solid ${slot.paymentStatus === 'paid' ? '#4CAF50' : '#2196F3'}`, padding:'10px', borderRadius:'6px', cursor:'pointer', position:'relative'}}>
                                <div style={{fontWeight:'bold'}}>{slot.patientName}</div>
                                <div style={{fontSize:'12px', color:'#666'}}>{slot.adminNotes || 'Sin notas'}</div>
                                <button onClick={(e) => { e.stopPropagation(); handleCancelSlot(key); }} style={{position:'absolute', right:'10px', top:'10px', border:'none', background:'none', cursor:'pointer', color:'#D32F2F'}}>🗑</button>
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
  };

  const calendarDays = getCalendarGrid(selectedDate);
  if (loading && !currentMonthData && !isMonthInitialized) return <div style={{padding:'50px', textAlign:'center'}}>Cargando Agenda...</div>;

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background:'#f5f5f5' }}>
      
      {/* --- SIDEBAR --- */}
      <div style={{ width: '280px', background: 'white', borderRight: '1px solid #ddd', display:'flex', flexDirection:'column' }}>
         <div style={{padding:'20px', borderBottom:'1px solid #eee'}}>
             <h3 style={{marginTop:0}}>Opciones</h3>
             {onBack && <button onClick={onBack} style={{marginBottom:'10px', width:'100%', padding:'8px'}}>⬅ Volver</button>}
             <button onClick={() => setIsConfigOpen(true)} style={{width:'100%', marginBottom:'5px', padding:'8px', background:'white', border:'1px solid #ccc', borderRadius:'4px', cursor:'pointer'}}>⚙️ Configurar</button>
             {isMonthInitialized ? (
                <button onClick={handleRegenerateMonth} style={{width:'100%', padding:'8px', background:'#FFF3E0', border:'1px solid #FFB74D', color:'#E65100', borderRadius:'4px', cursor:'pointer', fontSize:'13px'}}>🔄 Actualizar Huecos</button>
             ) : (
                <button onClick={handleInitializeMonth} style={{width:'100%', background:'#FF9800', color:'white', border:'none', padding:'10px', borderRadius:'4px', cursor:'pointer'}}>⚡ Inicializar Mes</button>
             )}
         </div>

         {/* --- LISTA DE PENDIENTES --- */}
         <div style={{flex:1, display:'flex', flexDirection:'column', overflow:'hidden'}}>
            <div style={{padding:'10px 20px', background:'#FFEBEE', color:'#C62828', borderBottom:'1px solid #FFCDD2'}}>
                <strong>📉 Sin Cita Futura ({pendingPatients.length})</strong>
            </div>
            <div style={{flex:1, overflowY:'auto'}}>
                {pendingPatients.length === 0 ? (
                    <div style={{padding:'20px', color:'#999', fontSize:'13px', textAlign:'center'}}>¡Todo al día! 🎉</div>
                ) : (
                    pendingPatients.map(p => {
                        const displayName = p.name || p.fullName || p.displayName || 'Paciente sin nombre';
                        return (
                            <div 
                                key={p.id}
                                onClick={() => setPreSelectedPatient({id: p.id, name: displayName})}
                                style={{
                                    padding:'12px 20px', borderBottom:'1px solid #eee', cursor:'pointer',
                                    background: preSelectedPatient?.id === p.id ? '#E3F2FD' : 'white',
                                    borderLeft: preSelectedPatient?.id === p.id ? '4px solid #2196F3' : '4px solid transparent'
                                }}
                                title="Click para seleccionar y luego da click en un hueco de la agenda"
                            >
                                <div style={{fontWeight:'bold', fontSize:'14px', color:'#333'}}>{displayName}</div>
                                <div style={{fontSize:'11px', color:'#D32F2F'}}>⚠️ Requiere agendar</div>
                            </div>
                        );
                    })
                )}
            </div>
         </div>
      </div>

      {/* --- CALENDARIO PRINCIPAL --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', background: 'white', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid #eee' }}>
            <div style={{display:'flex', gap:'20px', alignItems:'center'}}>
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()-1)))} style={{fontSize:'20px', cursor:'pointer', background:'none', border:'none'}}>◀</button>
                <h2 style={{margin:0, textTransform:'uppercase', color:'#333'}}>{selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}</h2>
                <button onClick={() => setSelectedDate(new Date(selectedDate.setMonth(selectedDate.getMonth()+1)))} style={{fontSize:'20px', cursor:'pointer', background:'none', border:'none'}}>▶</button>
            </div>
        </div>

        <div style={{flex:1, padding:'20px', overflowY:'auto'}}>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', textAlign:'center', marginBottom:'10px', color:'#777', fontWeight:'bold'}}>
                {DAYS_HEADER.map(d => <div key={d}>{d}</div>)}
            </div>
            <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'minmax(100px, 1fr)', gap:'10px'}}>
                {calendarDays.map((dateObj, i) => {
                    if (!dateObj) return <div key={i} />;
                    const dayStr = dateObj.getDate().toString().padStart(2, '0');
                    const prefix = `${dayStr}_`;
                    const bookedCount = currentMonthData ? Object.entries(currentMonthData).filter(([k, v]) => k.startsWith(prefix) && v.status === 'booked').length : 0;
                    return (
                        <div key={i} onClick={() => { setSelectedDate(dateObj); setIsDayViewOpen(true); }} style={{ background: dateObj.toDateString()===new Date().toDateString() ? '#E3F2FD' : 'white', border: '1px solid #ddd', borderRadius: '8px', padding:'10px', cursor:'pointer' }}>
                            <span style={{fontWeight:'bold', fontSize:'18px'}}>{dateObj.getDate()}</span>
                            {bookedCount > 0 && <div style={{marginTop:'8px', display:'flex', gap:'3px'}}>{Array.from({length: Math.min(bookedCount, 6)}).map((_, idx) => <div key={idx} style={{width:'8px', height:'8px', borderRadius:'50%', background:'#2196F3'}} />)}</div>}
                        </div>
                    );
                })}
            </div>
        </div>
      </div>

      {/* MODAL DÍA */}
      {isDayViewOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'end', zIndex:10}}>
            <div style={{width:'400px', background:'white', height:'100%', padding:'20px', display:'flex', flexDirection:'column'}}>
                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                    <div>
                        <h2 style={{margin:0}}>{selectedDate.toLocaleDateString('es-ES', {weekday:'long', day:'numeric'})}</h2>
                        <button onClick={handleBlockDay} style={{marginTop:'5px', fontSize:'11px', padding:'4px 10px', background:'#FFEBEE', color:'#D32F2F', border:'none', borderRadius:'12px', cursor:'pointer'}}>🚫 Bloquear día</button>
                    </div>
                    <button onClick={() => setIsDayViewOpen(false)} style={{border:'none', background:'none', fontSize:'24px', cursor:'pointer'}}>✕</button>
                </div>
                {preSelectedPatient && <div style={{background:'#E3F2FD', padding:'10px', borderRadius:'6px', marginBottom:'10px', border:'1px solid #2196F3', fontSize:'13px'}}>✅ Seleccionado: <strong>{preSelectedPatient.name}</strong><br/>Da click en un horario disponible.</div>}
                <div style={{flex:1, overflowY:'auto'}}>{renderDaySlots()}</div>
            </div>
        </div>
      )}

      {/* MODAL FORMULARIO */}
      {isFormOpen && (
        <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:20}}>
            <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'400px'}}>
                <h3 style={{marginTop:0}}>{formData.patientName ? 'Editar Cita' : 'Nueva Cita'}</h3>
                <form onSubmit={handleSave}>
                    <PatientSelector patients={patients} selectedPatientId={formData.patientId} manualNameValue={formData.patientName} onSelect={(id, name) => setFormData({...formData, patientId: id, patientName: name})} />
                    
                    {formData.patientId && (
                      <div style={{margin:'10px 0', background:'#F5F5F5', padding:'10px', borderRadius:'6px'}}>
                          <label style={{display:'block', fontSize:'11px', fontWeight:'bold', marginBottom:'4px', color:'#555'}}>ESTADO TRATAMIENTO</label>
                          <select value={formData.treatmentStatus} onChange={(e) => setFormData({...formData, treatmentStatus: e.target.value})} style={{width:'100%', padding:'6px', borderRadius:'4px'}}>
                            <option value="active">🟢 Activo (Requiere cita)</option>
                            <option value="discharged">⚪ Dado de Alta</option>
                          </select>
                      </div>
                    )}
                    
                    <div style={{margin:'15px 0'}}>
                        <label style={{display:'block', fontSize:'12px', marginBottom:'5px'}}>Notas:</label>
                        <textarea value={formData.adminNotes} onChange={e => setFormData({...formData, adminNotes: e.target.value})} style={{width:'100%', padding:'8px', borderRadius:'4px', border:'1px solid #ccc', minHeight:'60px'}} />
                    </div>
                    <div style={{textAlign:'right', marginTop:'20px'}}>
                        <button type="button" onClick={() => setIsFormOpen(false)} style={{marginRight:'10px', padding:'10px', background:'#eee', border:'none', borderRadius:'4px'}}>Cancelar</button>
                        <button type="submit" disabled={loading} style={{padding:'10px', background:'#2196F3', color:'white', border:'none', borderRadius:'4px'}}>{loading ? '...' : 'Guardar'}</button>
                    </div>
                </form>
            </div>
        </div>
      )}

      <AgendaConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} currentConfig={workConfig} onSave={handleSaveConfig} />
    </div>
  );
}