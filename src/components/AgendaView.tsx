import React, { useState, useEffect, useMemo } from 'react';
import {
 doc, getDoc, collection, query, where, getDocs,
 addDoc, updateDoc, Timestamp, orderBy, deleteDoc
} from "firebase/firestore";
import { db } from '../services/firebase';
import PatientSelector from './PatientSelector';


interface Props {
 userRole: 'professional' | 'assistant';
 currentUserId: string;
 onBack?: () => void;
}


interface Appointment {
 id: string;
 patientId: string;
 patientName: string;
 patientExternalPhone?: string;
 patientExternalEmail?: string;
 start: Date;
 end: Date;
 duration: number;
 price: number;
 status: 'confirmed' | 'pending_approval' | 'cancelled' | 'completed';
 paymentStatus: 'pending' | 'paid';
 paymentMethod?: string;
 adminNotes: string;
 createdBy: string;
}


const DAYS_HEADER = ['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'];


// Generamos las opciones para los selectores
const HOURS_OPTIONS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const MINUTES_OPTIONS = ['00', '15', '30', '45'];


const getCalendarGrid = (date: Date) => {
 const year = date.getFullYear();
 const month = date.getMonth();
 const firstDay = new Date(year, month, 1);
 const lastDay = new Date(year, month + 1, 0);
 const daysInMonth = lastDay.getDate();
 const startDayIndex = firstDay.getDay();


 const grid = [];
 for (let i = 0; i < startDayIndex; i++) {
   grid.push(null);
 }
 for (let i = 1; i <= daysInMonth; i++) {
   grid.push(new Date(year, month, i));
 }
 return grid;
};


export default function AgendaView({ userRole, currentUserId, onBack }: Props) {
 // --- CONTEXTO ---
 const [myProfessionals, setMyProfessionals] = useState<any[]>([]);
 const [selectedProfId, setSelectedProfId] = useState<string>('');
 const [profConfig, setProfConfig] = useState<any>(null);
 const [globalAppLink, setGlobalAppLink] = useState('');


 // --- DATOS ---
 const [appointments, setAppointments] = useState<Appointment[]>([]);
 const [patients, setPatients] = useState<any[]>([]);
 const [waitlist, setWaitlist] = useState<any[]>([]);
 const [ghostPatients, setGhostPatients] = useState<any[]>([]);
  // --- UI STATE ---
 const [selectedDate, setSelectedDate] = useState(new Date());
 const [sidebarTab, setSidebarTab] = useState<'rescue' | 'waitlist'>('rescue');
 const [loading, setLoading] = useState(true);


 // --- MODALES (VENTANAS EMERGENTES) ---
 const [isDayViewOpen, setIsDayViewOpen] = useState(false); // Modal para ver la agenda del día
 const [isFormOpen, setIsFormOpen] = useState(false);       // Modal para Crear/Editar cita
 const [isWaitlistMode, setIsWaitlistMode] = useState(false); // Modo lista de espera en el form


 const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
   patientId: '',
   patientName: '',
   patientExternalPhone: '',
   patientExternalEmail: '',
   time: '09:00',
   duration: 50,
   price: 500,
   adminNotes: '',
   paymentStatus: 'pending',
   paymentMethod: 'cash'
 });


 // 1. CARGA INICIAL
 useEffect(() => {
   const loadContext = async () => {
     try {
       const settingsSnap = await getDoc(doc(db, "settings", "global"));
       if(settingsSnap.exists()) setGlobalAppLink(settingsSnap.data().appDownloadLink || '');


       if (userRole === 'professional') {
         const docSnap = await getDoc(doc(db, "professionals", currentUserId));
         const selfData = { id: currentUserId, ...docSnap.data() };
         setMyProfessionals([selfData]);
         setSelectedProfId(currentUserId);
       } else {
         const q = query(collection(db, "professionals"), where("authorizedAssistants", "array-contains", currentUserId));
         const snap = await getDocs(q);
         const pros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
         setMyProfessionals(pros);
         if (pros.length > 0) setSelectedProfId(pros[0].id);
       }
     } catch (e) { console.error(e); }
   };
   loadContext();
 }, [currentUserId, userRole]);


 // 2. CARGA DE AGENDA
 useEffect(() => {
   if (!selectedProfId) return;
   loadAgendaData();
 }, [selectedProfId, selectedDate.getMonth(), selectedDate.getFullYear()]);


 const loadAgendaData = async () => {
   setLoading(true);
   try {
     const profRef = myProfessionals.find(p => p.id === selectedProfId);
    
     setProfConfig(profRef?.agendaConfig || {
       startHour: 7, endHour: 24, defaultDuration: 50, countryCode: '52'
     });


     const qAppts = query(collection(db, "appointments"), where("professionalId", "==", selectedProfId), where("status", "!=", "cancelled"));
     const snapAppts = await getDocs(qAppts);
     const apptsList = snapAppts.docs.map(d => {
       const data = d.data();
       return {
         id: d.id, ...data,
         start: data.start.toDate(),
         end: data.end.toDate()
       } as Appointment;
     });
     setAppointments(apptsList);


     if (profRef?.professionalCode) {
       const qPats = query(collection(db, "patients"), where("linkedProfessionalCode", "==", profRef.professionalCode));
       const snapPats = await getDocs(qPats);
       const patsList = snapPats.docs.map(d => ({ id: d.id, ...d.data() }));
       setPatients(patsList);
       calculateGhostPatients(patsList, apptsList);
     }


     const qWait = query(collection(db, "waitlist"), where("professionalId", "==", selectedProfId), orderBy("createdAt", "asc"));
     const snapWait = await getDocs(qWait);
     setWaitlist(snapWait.docs.map(d => ({ id: d.id, ...d.data() })));


   } catch (e) { console.error(e); }
   finally { setLoading(false); }
 };


 const calculateGhostPatients = (allPats: any[], allAppts: any[]) => {
   const now = new Date();
   const activePats = new Set(allAppts.filter(a => a.start > now).map(a => a.patientId));
   setGhostPatients(allPats.filter(p => !activePats.has(p.id)));
 };


 // 3. EXPORTAR A CSV
 const exportMonthToCSV = () => {
   if (appointments.length === 0) return alert("No hay datos para exportar.");
   const currentMonth = selectedDate.getMonth();
   const currentYear = selectedDate.getFullYear();
   const monthAppts = appointments.filter(a => a.start.getMonth() === currentMonth && a.start.getFullYear() === currentYear);


   if (monthAppts.length === 0) return alert("No hay citas en este mes para exportar.");


   let csvContent = "data:text/csv;charset=utf-8,";
   csvContent += "Fecha,Hora,Paciente,Telefono,Email,Duracion,Precio,Estatus,Notas\n";


   monthAppts.forEach(a => {
     const pName = a.patientName || patients.find(p => p.id === a.patientId)?.fullName || "Desconocido";
     let contactPhone = a.patientExternalPhone || '';
     let contactEmail = a.patientExternalEmail || '';
     if (a.patientId) {
       const registeredP = patients.find(p => p.id === a.patientId);
       if (registeredP) {
         contactPhone = registeredP.contactNumber || '';
         contactEmail = registeredP.email || '';
       }
     }


     const dateStr = a.start.toLocaleDateString();
     const timeStr = a.start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
     const row = `${dateStr},${timeStr},"${pName}","${contactPhone}","${contactEmail}",${a.duration},${a.price},${a.paymentStatus},"${a.adminNotes}"`;
     csvContent += row + "\n";
   });


   const encodedUri = encodeURI(csvContent);
   const link = document.createElement("a");
   link.setAttribute("href", encodedUri);
   link.setAttribute("download", `Reporte_Agenda_${currentMonth + 1}_${currentYear}.csv`);
   document.body.appendChild(link);
   link.click();
   document.body.removeChild(link);
 };


 // 4. GUARDAR / EDITAR
 const handleSave = async (e: React.FormEvent) => {
   e.preventDefault();
   if (!formData.patientName) return alert("Debes ingresar un nombre de paciente.");


   // --- MODO LISTA DE ESPERA ---
   if (isWaitlistMode) {
     try {
       await addDoc(collection(db, "waitlist"), {
         professionalId: selectedProfId,
         patientId: formData.patientId || '',
         patientName: formData.patientName,
         patientExternalPhone: formData.patientExternalPhone || '',
         patientExternalEmail: formData.patientExternalEmail || '',
         notes: formData.adminNotes || '',
         createdAt: new Date()
       });
       alert("Paciente agregado a la lista de espera correctamente.");
       setIsFormOpen(false);
       setIsWaitlistMode(false);
       loadAgendaData();
     } catch (err) {
       console.error(err);
       alert("Error al guardar en lista de espera.");
     }
     return;
   }


   // --- MODO CITA NORMAL ---
   if (!formData.patientId && !formData.patientExternalPhone) {
     if(!window.confirm("⚠️ Estás creando un paciente manual SIN TELÉFONO. No podrás enviarle WhatsApp. ¿Continuar?")) return;
   }


   const [h, m] = formData.time.split(':');
   const start = new Date(selectedDate);
   start.setHours(parseInt(h), parseInt(m), 0, 0);
   const end = new Date(start);
   end.setMinutes(start.getMinutes() + formData.duration);


   const conflict = appointments.find(a => {
     if (editingApptId === a.id) return false;
     return (start < a.end) && (end > a.start);
   });


   if (conflict) {
     if (!window.confirm("⚠️ CHOQUE DE HORARIO. ¿Forzar cita?")) return;
   }


   try {
     const payload = {
       professionalId: selectedProfId,
       patientId: formData.patientId,
       patientName: formData.patientName,
       patientExternalPhone: !formData.patientId ? formData.patientExternalPhone : '',
       patientExternalEmail: !formData.patientId ? formData.patientExternalEmail : '',
       start: Timestamp.fromDate(start),
       end: Timestamp.fromDate(end),
       duration: formData.duration,
       price: Number(formData.price),
       adminNotes: formData.adminNotes,
       paymentStatus: formData.paymentStatus,
       paymentMethod: formData.paymentMethod,
       status: 'confirmed',
       updatedBy: currentUserId,
       updatedAt: new Date()
     };


     if (editingApptId) {
       await updateDoc(doc(db, "appointments", editingApptId), payload);
     } else {
       await addDoc(collection(db, "appointments"), { ...payload, createdAt: new Date(), createdBy: currentUserId });
     }
     setIsFormOpen(false);
     loadAgendaData();
   } catch (e) { alert("Error al guardar"); console.error(e); }
 };


 // 5. FUNCIONES AUXILIARES
 const openFormModal = (appt?: Appointment, slotTime?: string) => {
   setIsWaitlistMode(false);
   if (appt) {
     setEditingApptId(appt.id);
     const timeStr = appt.start.getHours().toString().padStart(2,'0') + ':' + appt.start.getMinutes().toString().padStart(2,'0');
    
     let pName = appt.patientName;
     if(!pName && appt.patientId) {
       pName = patients.find(p => p.id === appt.patientId)?.fullName || '';
     }


     setFormData({
       patientId: appt.patientId || '',
       patientName: pName || '',
       patientExternalPhone: appt.patientExternalPhone || '',
       patientExternalEmail: appt.patientExternalEmail || '',
       time: timeStr, duration: appt.duration, price: appt.price || 500,
       adminNotes: appt.adminNotes, paymentStatus: appt.paymentStatus, paymentMethod: appt.paymentMethod || 'cash'
     });
   } else {
     setEditingApptId(null);
     setFormData({
       patientId: '', patientName: '', patientExternalPhone: '', patientExternalEmail: '',
       time: slotTime || '09:00', duration: profConfig?.defaultDuration || 50, price: 500,
       adminNotes: '', paymentStatus: 'pending', paymentMethod: 'cash'
     });
   }
   setIsFormOpen(true);
 };


 const handleOpenWaitlistModal = () => {
   setEditingApptId(null);
   setFormData({
     patientId: '', patientName: '', patientExternalPhone: '', patientExternalEmail: '',
     time: '09:00', duration: 50, price: 500,
     adminNotes: '', paymentStatus: 'pending', paymentMethod: 'cash'
   });
   setIsWaitlistMode(true);
   setIsFormOpen(true);
 };


 const handleSoftDelete = async (apptId: string) => {
   if (!window.confirm("¿Cancelar cita?")) return;
   await updateDoc(doc(db, "appointments", apptId), { status: 'cancelled', cancelledBy: currentUserId });
   loadAgendaData();
 };


 const removeFromWaitlist = async (waitlistId: string) => {
   if(!window.confirm("¿Eliminar de la lista de espera?")) return;
   await deleteDoc(doc(db, "waitlist", waitlistId));
   loadAgendaData();
 };


 const openWhatsApp = (appt: Appointment) => {
   let phone = '';
   let pName = appt.patientName;
  
   if (appt.patientId) {
     const p = patients.find(x => x.id === appt.patientId);
     if (p) {
       phone = p.contactNumber || '';
       pName = p.fullName;
     }
   } else {
     phone = appt.patientExternalPhone || '';
   }


   if (!phone) return alert("No hay número de teléfono registrado.");


   let cleanPhone = phone.replace(/\D/g, '');
   const prefix = profConfig?.countryCode || '52';
   if (cleanPhone.length <= 10) cleanPhone = `${prefix}${cleanPhone}`;


   const dateStr = appt.start.toLocaleDateString('es-ES', {weekday:'long', hour:'2-digit', minute:'2-digit'});
   let msg = `Hola ${pName}, confirmamos cita el ${dateStr}.`;


   const currentProf = myProfessionals.find(p => p.id === selectedProfId);
   if (globalAppLink && currentProf?.professionalCode) {
     const includeInvite = window.confirm("¿Deseas incluir la invitación a descargar la App y el código de vinculación en este mensaje?");
     if (includeInvite) {
       msg += `\n\nTe invito a usar Mental Nexus para seguir tu tratamiento.`;
       msg += `\n📲 Descarga: ${globalAppLink}`;
       msg += `\n🔑 Código de vinculación: *${currentProf.professionalCode}*`;
     }
   }


   window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
 };


 const handleTimeChange = (type: 'hour' | 'minute', value: string) => {
   const [currentH, currentM] = formData.time.split(':');
   if (type === 'hour') {
     setFormData({...formData, time: `${value}:${currentM}`});
   } else {
     setFormData({...formData, time: `${currentH}:${value}`});
   }
 };


 // 6. RENDER DE SLOTS (Ahora se usa dentro del Modal de Día)
 const renderSlots = () => {
   const startH = parseInt(profConfig?.startHour) || 7;
   const endH = parseInt(profConfig?.endHour) || 24;


   const slots = [];
   for (let h = startH; h < endH; h++) {
     const hourStr = `${h.toString().padStart(2, '0')}:00`;
     const slotAppts = appointments.filter(a => a.start.getHours() === h && a.start.getDate() === selectedDate.getDate() && a.start.getMonth() === selectedDate.getMonth() && a.start.getFullYear() === selectedDate.getFullYear());


     slots.push(
       <div key={h} style={{display:'flex', minHeight:'70px', borderBottom:'1px solid #eee'}}>
         <div style={{width:'60px', padding:'10px', color:'#999', borderRight:'1px solid #eee', fontSize:'14px', fontWeight:'bold'}}>{hourStr}</div>
         <div style={{flex:1, position:'relative'}}>
           {/* Click en espacio vacío abre form */}
           <div style={{position:'absolute', inset:0, zIndex:1}} onClick={() => openFormModal(undefined, hourStr)} />
          
           {slotAppts.map(appt => {
             const pName = appt.patientName || patients.find(p => p.id === appt.patientId)?.fullName || 'Desconocido';
             const isPaid = appt.paymentStatus === 'paid';
             const hasPhone = appt.patientId || appt.patientExternalPhone;
            
             return (
               <div key={appt.id} onClick={(e) => {e.stopPropagation(); openFormModal(appt);}}
                 style={{
                   position:'relative', zIndex:2, margin:'2px', padding:'8px', borderRadius:'6px', cursor:'pointer',
                   background: isPaid ? '#E8F5E9' : '#E3F2FD', borderLeft: `5px solid ${isPaid ? '#43A047' : '#2196F3'}`,
                   boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                 }}>
                 <div style={{fontWeight:'bold', fontSize:'14px', marginBottom:'2px'}}>{pName} <span style={{fontWeight:'normal'}}>(${appt.price})</span></div>
                 <div style={{fontSize:'12px', color:'#555'}}>{appt.duration} min | {appt.adminNotes}</div>
                 <div style={{display:'flex', gap:'10px', marginTop:'8px'}}>
                   {hasPhone && <button onClick={(e)=>{e.stopPropagation(); openWhatsApp(appt)}} style={{border:'none', background:'none', cursor:'pointer', fontSize:'16px'}} title="Enviar WhatsApp">💬</button>}
                   <button onClick={(e)=>{e.stopPropagation(); handleSoftDelete(appt.id)}} style={{border:'none', background:'none', cursor:'pointer', color:'#D32F2F', fontSize:'16px'}} title="Cancelar Cita">🗑</button>
                 </div>
               </div>
             )
           })}
         </div>
       </div>
     );
   }
   return slots;
 };


 const calendarDays = getCalendarGrid(selectedDate);
 const [currentFormHour, currentFormMinute] = formData.time.split(':');


 if (loading && !selectedProfId) return <div style={{height:'100vh', display:'flex', justifyContent:'center', alignItems:'center', color:'#666'}}><h2> ⏳ Cargando Agenda... </h2></div>;


 return (
   <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background:'#f5f5f5' }}>
    
     {/* SIDEBAR */}
     <div style={{ width: '300px', background: 'white', borderRight: '1px solid #ddd', display:'flex', flexDirection:'column' }}>
       {userRole === 'assistant' && (
         <div style={{ padding: '15px', background: '#333', color: 'white' }}>
           <small style={{display:'block', marginBottom:'5px', fontSize:'10px', textTransform:'uppercase'}}>Gestionando Agenda de:</small>
           <select value={selectedProfId} onChange={e => setSelectedProfId(e.target.value)} style={{width:'100%', padding:'8px', borderRadius:'4px'}}>
             {myProfessionals.map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
           </select>
         </div>
       )}
       <div style={{display:'flex', borderBottom:'1px solid #eee'}}>
         <button onClick={() => setSidebarTab('rescue')} style={{flex:1, padding:'15px', border:'none', background: sidebarTab==='rescue'?'#fff':'#f0f0f0', borderBottom: sidebarTab==='rescue'?'3px solid #D32F2F':'none', cursor:'pointer', fontWeight:'bold', color: sidebarTab==='rescue'?'#D32F2F':'#666'}}>
            👥 Pacientes sin cita
         </button>
         <button onClick={() => setSidebarTab('waitlist')} style={{flex:1, padding:'15px', border:'none', background: sidebarTab==='waitlist'?'#fff':'#f0f0f0', borderBottom: sidebarTab==='waitlist'?'3px solid #1976D2':'none', cursor:'pointer', fontWeight:'bold', color: sidebarTab==='waitlist'?'#1976D2':'#666'}}> ⏳ Espera </button>
       </div>
       <div style={{flex:1, overflowY:'auto', padding:'10px'}}>
         {sidebarTab === 'rescue' ? ghostPatients.map(p => (
           <div key={p.id} style={{padding:'10px', borderBottom:'1px solid #eee', background:'white'}}>
             <div style={{fontWeight:'bold', fontSize:'14px'}}>{p.fullName}</div>
             <div style={{fontSize:'12px', color:'#777', marginBottom:'5px'}}>{p.contactNumber}</div>
             <button onClick={() => openFormModal({patientId:p.id, patientName:p.fullName} as any)} style={{display:'block', width:'100%', padding:'5px', background:'#FFEBEE', color:'#D32F2F', border:'none', borderRadius:'4px', cursor:'pointer', fontWeight:'bold'}}>📅 Agendar</button>
           </div>
         )) : (
           <div>
             <button onClick={handleOpenWaitlistModal} style={{width:'100%', marginBottom:'10px', padding:'10px', background:'#E3F2FD', color:'#1976D2', border:'1px dashed #1976D2', cursor:'pointer'}}>+ Agregar a Lista</button>
            
             {waitlist.map(w => {
               const displayName = w.patientName || patients.find(p => p.id === w.patientId)?.fullName || 'Sin Nombre';
               return (
                 <div key={w.id} style={{background:'#F3E5F5', padding:'10px', marginBottom:'5px', borderRadius:'6px', border:'1px solid #CE93D8', position:'relative'}}>
                   <button onClick={() => removeFromWaitlist(w.id)} style={{position:'absolute', top:'5px', right:'5px', border:'none', background:'none', cursor:'pointer', color:'#999'}}>×</button>
                   <strong>{displayName}</strong>
                   <div style={{fontSize:'12px', fontStyle:'italic', margin:'5px 0'}}>"{w.notes}"</div>
                   <button onClick={() => openFormModal({
                       patientId: w.patientId,
                       patientName: displayName,
                       patientExternalPhone: w.patientExternalPhone,
                       patientExternalEmail: w.patientExternalEmail,
                       adminNotes: `[ESPERA] ${w.notes}`
                     } as any)}
                     style={{fontSize:'11px', padding:'3px 8px', background:'#AB47BC', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}
                   >
                     Asignar
                   </button>
                 </div>
               );
             })}
           </div>
         )}
       </div>
     </div>


     {/* MAIN */}
     <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
       <div style={{ flex: 1, padding: '20px', background: 'white', display:'flex', flexDirection:'column' }}>
        
         {/* HEADER */}
         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
           <div style={{display:'flex', alignItems:'center', gap:'15px'}}>
             {onBack && (
               <button
                 onClick={onBack}
                 style={{
                   padding:'8px 15px', cursor:'pointer', borderRadius:'4px',
                   border:'1px solid #ccc', background:'white', fontWeight:'bold',
                   color:'#555', display:'flex', alignItems:'center', gap:'5px'
                 }}
               >
                 ⬅ Volver al Panel
               </button>
             )}


             <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
               <button
                 onClick={() => {
                   const prevMonth = new Date(selectedDate);
                   prevMonth.setMonth(prevMonth.getMonth() - 1);
                   setSelectedDate(prevMonth);
                 }}
                 style={{border:'none', background:'none', cursor:'pointer', fontSize:'24px', padding:'10px', color:'#555'}}
               >
                 ◀
               </button>
              
               <div style={{fontSize:'26px', fontWeight:'900', color:'#333', textTransform:'uppercase', letterSpacing:'1px'}}>
                 {selectedDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
               </div>


               <button
                 onClick={() => {
                   const nextMonth = new Date(selectedDate);
                   nextMonth.setMonth(nextMonth.getMonth() + 1);
                   setSelectedDate(nextMonth);
                 }}
                 style={{border:'none', background:'none', cursor:'pointer', fontSize:'24px', padding:'10px', color:'#555'}}
               >
                 ▶
               </button>
             </div>
           </div>


           <div style={{display:'flex', gap:'10px'}}>
              <button onClick={exportMonthToCSV} style={{background:'#607D8B', color:'white', border:'none', padding:'10px 20px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'14px'}}>📊 CSV</button>
              {/* Este botón abre el form general, no el del día específico */}
              <button onClick={() => openFormModal()} style={{background:'#4CAF50', color:'white', border:'none', padding:'10px 20px', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'14px'}}>+ Cita</button>
           </div>
         </div>


         {/* CALENDARIO MENSUAL GRANDE */}
         <div style={{flex:1, display:'flex', flexDirection:'column'}}>
           <div style={{display:'grid', gridTemplateColumns:'repeat(7, 1fr)', textAlign:'center', marginBottom:'10px'}}>
             {DAYS_HEADER.map(d => (
               <div key={d} style={{fontSize:'14px', fontWeight:'bold', color:'#777'}}>{d}</div>
             ))}
           </div>


           <div style={{flex:1, display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gridAutoRows:'1fr', gap:'8px'}}>
             {calendarDays.map((dateObj, index) => {
               if (!dateObj) return <div key={`empty-${index}`} style={{background:'#f9f9f9', borderRadius:'8px'}} />;


               const isToday = dateObj.toDateString() === new Date().toDateString();
              
               // Citas del día para mostrar puntitos
               const dayAppts = appointments.filter(a =>
                 a.start.getDate() === dateObj.getDate() &&
                 a.start.getMonth() === dateObj.getMonth() &&
                 a.start.getFullYear() === dateObj.getFullYear()
               );


               return (
                 <button
                   key={index}
                   onClick={() => {
                     setSelectedDate(dateObj);
                     setIsDayViewOpen(true);
                   }}
                   style={{
                     border: isToday ? '2px solid #2196F3' : '1px solid #ddd',
                     background: isToday ? '#E3F2FD' : 'white',
                     borderRadius:'8px',
                     cursor:'pointer',
                     display:'flex',
                     flexDirection:'column',
                     alignItems:'flex-start',
                     padding:'10px',
                     minHeight:'100px', // Altura mayor para que se vea bien en móviles
                     position:'relative',
                     boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                   }}
                 >
                   <span style={{
                     fontSize:'18px',
                     fontWeight: isToday ? 'bold' : 'normal',
                     color: isToday ? '#1565C0' : '#333',
                     marginBottom:'5px'
                   }}>
                     {dateObj.getDate()}
                   </span>
                  
                   {/* Indicadores visuales de citas */}
                   <div style={{display:'flex', flexWrap:'wrap', gap:'3px'}}>
                     {dayAppts.slice(0, 8).map((appt, i) => (
                       <div key={i} title={appt.patientName} style={{
                         width:'8px', height:'8px', borderRadius:'50%',
                         background: appt.paymentStatus==='paid' ? '#4CAF50' : '#2196F3'
                       }} />
                     ))}
                     {dayAppts.length > 8 && <span style={{fontSize:'10px', color:'#999'}}>+</span>}
                   </div>
                 </button>
               );
             })}
           </div>
         </div>
       </div>
     </div>


     {/* --- MODAL DE AGENDA DEL DÍA (NUEVO) --- */}
     {isDayViewOpen && (
       <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:100}}>
         <div style={{background:'white', width:'500px', height:'80vh', borderRadius:'12px', display:'flex', flexDirection:'column', boxShadow:'0 10px 40px rgba(0,0,0,0.3)', overflow:'hidden'}}>
          
           {/* Header del Modal */}
           <div style={{padding:'20px', borderBottom:'1px solid #eee', display:'flex', justifyContent:'space-between', alignItems:'center', background:'#f9f9f9'}}>
             <div>
               <h2 style={{margin:0, color:'#333'}}>
                 {selectedDate.getDate()} de {selectedDate.toLocaleDateString('es-ES', { month: 'long' })}
               </h2>
               <small style={{color:'#777'}}>{selectedDate.toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric' })}</small>
             </div>
             <button onClick={() => setIsDayViewOpen(false)} style={{border:'none', background:'none', fontSize:'24px', cursor:'pointer', color:'#999'}}>✕</button>
           </div>


           {/* Lista Scrollable */}
           <div style={{flex:1, overflowY:'auto', padding:'20px'}}>
              {renderSlots()}
           </div>


           {/* Footer con acción rápida */}
           <div style={{padding:'15px', borderTop:'1px solid #eee', textAlign:'center'}}>
             <button onClick={() => openFormModal()} style={{background:'#2196F3', color:'white', border:'none', padding:'12px 25px', borderRadius:'30px', fontWeight:'bold', cursor:'pointer', width:'100%'}}>
               + Agendar en este día
             </button>
           </div>
         </div>
       </div>
     )}


     {/* --- MODAL FORMULARIO UNIFICADO (Z-INDEX SUPERIOR 200) --- */}
     {isFormOpen && (
       <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:200}}>
         <div style={{background:'white', padding:'25px', width:'400px', borderRadius:'12px', boxShadow:'0 10px 25px rgba(0,0,0,0.4)'}}>
          
           <h3 style={{marginTop:0, borderBottom:'1px solid #eee', paddingBottom:'10px'}}>
             {isWaitlistMode ? 'Agregar a Lista de Espera' : (editingApptId?'Editar':'Nueva') + ' Cita'}
           </h3>
          
           <form onSubmit={handleSave}>


             <div style={{marginBottom:'15px'}}>
               <PatientSelector
                 patients={patients}
                 selectedPatientId={formData.patientId}
                 manualNameValue={formData.patientName}
                 onSelect={(id, name) => setFormData({ ...formData, patientId: id, patientName: name })}
               />
             </div>


             {!formData.patientId && formData.patientName && (
               <div style={{marginBottom:'15px', padding:'10px', background:'#FFF3E0', borderRadius:'6px', border:'1px solid #FFCC80'}}>
                 <small style={{display:'block', color:'#E65100', marginBottom:'5px', fontWeight:'bold'}}>👤 Paciente Externo (Manual)</small>
                 <div style={{marginBottom:'8px'}}>
                   <label style={{fontSize:'11px', display:'block'}}>Teléfono de contacto (Para WhatsApp):</label>
                   <input
                     type="tel"
                     placeholder="Ej: 618 123 4567"
                     value={formData.patientExternalPhone}
                     onChange={e=>setFormData({...formData, patientExternalPhone:e.target.value})}
                     style={{width:'100%', padding:'5px', border:'1px solid #ccc', borderRadius:'4px'}}
                   />
                 </div>
                 <div>
                   <label style={{fontSize:'11px', display:'block'}}>Correo electrónico (Opcional):</label>
                   <input
                     type="email"
                     placeholder="Ej: correo@ejemplo.com"
                     value={formData.patientExternalEmail}
                     onChange={e=>setFormData({...formData, patientExternalEmail:e.target.value})}
                     style={{width:'100%', padding:'5px', border:'1px solid #ccc', borderRadius:'4px'}}
                   />
                 </div>
               </div>
             )}


             {!isWaitlistMode && (
               <>
                 <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                   <div style={{flex:1}}>
                     <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>Hora de Inicio:</label>
                     <div style={{display:'flex', gap:'5px'}}>
                       <select value={currentFormHour} onChange={e => handleTimeChange('hour', e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', border:'1px solid #ccc', background:'white'}}>
                         {HOURS_OPTIONS.map(h => <option key={h} value={h}>{h} h</option>)}
                       </select>
                       <span style={{display:'flex', alignItems:'center', fontWeight:'bold'}}>:</span>
                       <select value={currentFormMinute} onChange={e => handleTimeChange('minute', e.target.value)} style={{flex:1, padding:'10px', borderRadius:'6px', border:'1px solid #ccc', background:'white'}}>
                         {MINUTES_OPTIONS.map(m => <option key={m} value={m}>{m} min</option>)}
                       </select>
                     </div>
                   </div>
                  
                   <div style={{flex:1}}>
                     <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>Duración (min):</label>
                     <input type="number" value={formData.duration} onChange={e=>setFormData({...formData, duration:Number(e.target.value)})} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #ccc'}} />
                   </div>
                 </div>


                 <div style={{marginBottom:'15px'}}>
                   <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>Precio Consulta ($):</label>
                   <input type="number" value={formData.price} onChange={e=>setFormData({...formData, price:Number(e.target.value)})} style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #ccc'}} />
                 </div>


                 <div style={{display:'flex', gap:'10px', marginBottom:'15px', background:'#f5f5f5', padding:'10px', borderRadius:'6px'}}>
                   <div style={{flex:1}}>
                     <label style={{fontSize:'11px', display:'block'}}>Estatus Pago:</label>
                     <select value={formData.paymentStatus} onChange={e=>setFormData({...formData, paymentStatus:e.target.value as any})} style={{width:'100%', padding:'5px'}}>
                       <option value="pending">Pendiente</option><option value="paid">Pagado</option>
                     </select>
                   </div>
                   <div style={{flex:1}}>
                     <label style={{fontSize:'11px', display:'block'}}>Método:</label>
                     <select value={formData.paymentMethod} onChange={e=>setFormData({...formData, paymentMethod:e.target.value})} style={{width:'100%', padding:'5px'}}>
                       <option value="cash">Efectivo</option><option value="card">Tarjeta</option>
                       <option value="transfer">Transferencia</option>
                     </select>
                   </div>
                 </div>
               </>
             )}


             <div style={{marginBottom:'20px'}}>
               <label style={{fontSize:'12px', fontWeight:'bold', display:'block', marginBottom:'5px'}}>
                 {isWaitlistMode ? 'Motivo / Preferencia de horario:' : 'Notas Administrativas:'}
               </label>
               <textarea
                 placeholder={isWaitlistMode ? "Ej: Sólo puede los viernes por la tarde..." : "Ej: Traer estudios, cobrar saldo..."}
                 value={formData.adminNotes}
                 onChange={e=>setFormData({...formData, adminNotes:e.target.value})}
                 rows={2}
                 style={{width:'100%', padding:'10px', borderRadius:'6px', border:'1px solid #ccc'}}
               />
             </div>


             <div style={{textAlign:'right', display:'flex', gap:'10px', justifyContent:'flex-end'}}>
               <button type="button" onClick={()=>{setIsFormOpen(false); setIsWaitlistMode(false);}} style={{padding:'10px 20px', borderRadius:'6px', border:'none', background:'#eee', cursor:'pointer'}}>Cancelar</button>
               <button type="submit" style={{padding:'10px 20px', borderRadius:'6px', border:'none', background: isWaitlistMode ? '#AB47BC' : '#2196F3', color:'white', fontWeight:'bold', cursor:'pointer'}}>
                 {isWaitlistMode ? 'Guardar en Espera' : 'Guardar Cita'}
               </button>
             </div>
           </form>
         </div>
       </div>
     )}
   </div>
 );
}
