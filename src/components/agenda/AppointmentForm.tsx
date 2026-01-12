import React from 'react';
import PatientSelector from '../PatientSelector'; 
// Asegúrate de que PatientSelector esté en src/components/, si no ajusta la ruta.

interface AppointmentFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (e: React.FormEvent) => void;
  
  // Datos del formulario
  formData: {
    patientId: string;
    patientName: string;
    patientExternalPhone: string;
    patientExternalEmail: string;
    price: number;
    adminNotes: string;
    paymentStatus: string;
    paymentMethod: string;
  };
  setFormData: (data: any) => void;
  
  // Datos Auxiliares
  patients: any[];
  savePricePreference: boolean;
  setSavePricePreference: (val: boolean) => void;
  selectedPatientNoShows: number;
  
  // Acción al seleccionar paciente (para que el padre calcule precios y faltas)
  onPatientSelect: (id: string, name: string) => void;
}

const AppointmentForm: React.FC<AppointmentFormProps> = ({
  isOpen, onClose, onSave,
  formData, setFormData,
  patients,
  savePricePreference, setSavePricePreference,
  selectedPatientNoShows,
  onPatientSelect
}) => {

  if (!isOpen) return null;

  return (
    <div style={{position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:20}}>
      <div style={{background:'white', padding:'25px', borderRadius:'12px', width:'400px', maxHeight:'90vh', overflowY:'auto'}}>
        <h3>{formData.patientName ? 'Editar Cita' : 'Nueva Cita'}</h3>

        {/* ALERTA DE FALTAS */}
        {selectedPatientNoShows > 0 && (
          <div style={{background:'#FFEBEE', color:'#D32F2F', padding:'10px', borderRadius:'6px', marginBottom:'15px', border:'1px solid #FFCDD2', fontSize:'13px', display:'flex', alignItems:'center', gap:'10px'}}>
            <span style={{fontSize:'20px'}}>⚠️</span>
            <div>
              <strong>Cuidado:</strong> Este paciente tiene <b>{selectedPatientNoShows} faltas</b> registradas.
            </div>
          </div>
        )}

        <form onSubmit={onSave}>
          <PatientSelector
            patients={patients}
            selectedPatientId={formData.patientId}
            manualNameValue={formData.patientName}
            onSelect={onPatientSelect} 
          />

          <div style={{display:'flex', gap:'10px', marginTop:'15px'}}>
            <div style={{flex:1}}>
              <label style={{fontSize:'12px', color:'#666'}}>Precio Consulta</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                style={{width:'100%', padding:'8px', boxSizing:'border-box', border:'1px solid #ccc', borderRadius:'4px'}}
              />
            </div>
            <div style={{flex:1}}>
              <label style={{fontSize:'12px', color:'#666'}}>Método Pago</label>
              <select
                value={formData.paymentMethod}
                onChange={(e) => setFormData({...formData, paymentMethod: e.target.value})}
                style={{width:'100%', padding:'8px', boxSizing:'border-box', border:'1px solid #ccc', borderRadius:'4px'}}
              >
                <option value="cash">Efectivo</option>
                <option value="transfer">Transferencia</option>
                <option value="card">Tarjeta</option>
              </select>
            </div>
          </div>

          {/* CHECKBOX FIJAR PRECIO */}
          <div style={{marginTop:'10px', background:'#f9f9f9', padding:'8px', borderRadius:'4px', display:'flex', alignItems:'center'}}>
            <input
              type="checkbox"
              id="savePriceCheck"
              checked={savePricePreference}
              onChange={(e) => setSavePricePreference(e.target.checked)}
              style={{marginRight:'8px', cursor:'pointer'}}
            />
            <label htmlFor="savePriceCheck" style={{fontSize:'12px', cursor:'pointer', userSelect:'none'}}>
              Fijar <b>${formData.price}</b> como precio para futuras citas de este paciente.
            </label>
          </div>

          <textarea 
            placeholder="Notas internas..." 
            value={formData.adminNotes} 
            onChange={e => setFormData({...formData, adminNotes: e.target.value})} 
            style={{width:'100%', marginTop:'15px', padding:'8px', minHeight:'60px'}} 
          />

          <div style={{marginTop:'20px', textAlign:'right'}}>
            <button type="button" onClick={onClose} style={{marginRight:'10px', padding:'8px 15px', border:'none', background:'#eee', borderRadius:'4px', cursor:'pointer'}}>Cancelar</button>
            <button type="submit" style={{padding:'8px 15px', background:'#2196F3', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>Guardar</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AppointmentForm;