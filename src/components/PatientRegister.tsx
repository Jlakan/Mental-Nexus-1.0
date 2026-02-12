import React, { useState } from 'react';
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { INITIAL_PLAYER_PROFILE } from '../utils/GamificationUtils';

// 1. Definimos las Props para recibir onComplete
interface Props {
  user?: any;
  onComplete: () => void;
}

export default function PatientRegister({ onComplete }: Props) {
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    phone: '',
    code: '',
    securityPin: ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.name === 'securityPin') {
      const val = e.target.value.replace(/\D/g, '').slice(0, 4);
      setFormData({ ...formData, securityPin: val });
    } else {
      setFormData({ ...formData, [e.target.name]: e.target.value });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    if (formData.securityPin.length !== 4) {
      setErrorMsg("El PIN de seguridad debe tener exactamente 4 números.");
      setSaving(false);
      return;
    }

    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email;

    try {
      // --- LÓGICA DE VINCULACIÓN CON PROFESIONAL ---
      let initialCareTeam = {};
      let linkedProfessionalCode = null;
      let isAuthorizedValue = true;

      if (formData.code.trim()) {
        const cleanCode = formData.code.trim().toUpperCase();
        const q = query(collection(db, "professionals"), where("professionalCode", "==", cleanCode));
        const docSnap = await getDocs(q);

        if (!docSnap.empty) {
          const profDoc = docSnap.docs[0];
          const profData = profDoc.data();
          const profId = profDoc.id;
          
          linkedProfessionalCode = cleanCode;
          isAuthorizedValue = false; // Requiere aprobación si usa código

          initialCareTeam = {
            [profId]: {
              status: 'active',
              active: true,               
              nextAppointment: null,
              joinedAt: new Date().toISOString(),
              professionalName: profData.fullName,
              professionalId: profId,
              professionType: profData.professionType || 'psicologo',
              contactNumber: formData.phone,
              noShowCount: 0,
              customPrice: profData.agendaSettings?.defaultPrice || 500
            }
          };
        } else {
          setSaving(false);
          setErrorMsg("El código de profesional no existe. Verifícalo o déjalo en blanco.");
          return;
        }
      }

      // --- 2. GUARDAR EN LA COLECCIÓN 'patients' (Ficha Médica) ---
      await setDoc(doc(db, "patients", uid), {
        uid: uid,
        fullName: formData.fullName,
        email: email,
        dob: formData.dob,
        contactNumber: formData.phone,
        securityPin: formData.securityPin,
        createdAt: new Date(),
        gamificationProfile: INITIAL_PLAYER_PROFILE,
        careTeam: initialCareTeam,
        linkedProfessionalCode: linkedProfessionalCode,
        isAuthorized: isAuthorizedValue,
        isManual: false
      });

      // --- 3. CORRECCIÓN VITAL: ACTUALIZAR 'users' (Cuenta de Usuario) ---
      // Esto marca que el registro terminó
      await setDoc(doc(db, "users", uid), {
        profileCompleted: true,
        updatedAt: new Date()
      }, { merge: true });

      // --- 4. AVISAR A APP.TSX ---
      onComplete();

    } catch (error: any) {
      console.error("Error al registrar:", error);
      setErrorMsg("Error al guardar datos: " + error.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', backgroundColor: 'white', fontFamily: 'sans-serif' }}>
      <h2 style={{textAlign: 'center', color: '#2E7D32', marginBottom:'10px'}}>¡Bienvenido!</h2>
      <p style={{textAlign:'center', color:'#666', fontSize:'14px', marginBottom:'20px'}}>Completa tu perfil de héroe para comenzar.</p>

      {errorMsg && (
        <div style={{ backgroundColor: '#ffebee', color: '#c62828', padding: '10px', borderRadius: '6px', marginBottom: '15px', fontSize: '13px', textAlign:'center' }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
        <div>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Nombre Completo</label>
          <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>
        
        <div>
           <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Fecha de Nacimiento</label>
           <input type="date" name="dob" required value={formData.dob} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>

        <div>
           <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Teléfono (WhatsApp)</label>
           <input type="tel" name="phone" required placeholder="Para notificaciones" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>

        {/* CAMPO PIN */}
        <div style={{ background: '#FFF3E0', padding: '10px', borderRadius: '6px', border: '1px solid #FFE0B2' }}>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#E65100'}}>PIN de Seguridad (4 dígitos)</label>
          <input 
            type="password" 
            inputMode="numeric"
            name="securityPin" 
            required 
            maxLength={4}
            placeholder="****" 
            value={formData.securityPin} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #FFCC80', fontSize: '18px', letterSpacing: '4px', textAlign: 'center' }} 
          />
          <small style={{ color: '#888', fontSize: '11px', display: 'block', marginTop: '5px' }}>
            Usarás este PIN para confirmar asistencia a tus sesiones.
          </small>
        </div>

        <div style={{marginTop:'10px', padding:'15px', backgroundColor:'#E3F2FD', borderRadius:'8px', border:'1px dashed #2196F3'}}>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#1565C0'}}>Código de Vinculación (Opcional)</label>
          <small style={{display:'block', marginBottom:'8px', color:'#555'}}>Si tu profesional te dio un código, ingrésalo aquí.</small>
          <input 
            type="text" 
            name="code" 
            placeholder="Ej: A1B2C3" 
            value={formData.code} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #1565C0', fontWeight:'bold', textAlign:'center', textTransform:'uppercase' }} 
          />
        </div>

        <button 
          type="submit" 
          disabled={saving} 
          style={{ marginTop: '10px', padding: '15px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#2E7D32', color: 'white', border: 'none', borderRadius:'6px', fontWeight:'bold' }}
        >
          {saving ? "Creando Perfil..." : "⚔️ Comenzar Aventura"}
        </button>
      </form>

      <div style={{marginTop: '25px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px'}}>
        <button onClick={() => auth.signOut()} style={{ background:'none', border:'none', color:'#d32f2f', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>
          Cerrar Sesión / Cancelar Registro
        </button>
      </div>
    </div>
  );
}