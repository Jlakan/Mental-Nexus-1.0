import React, { useState } from 'react';
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from '../services/firebase';
import { INITIAL_PLAYER_PROFILE } from '../utils/GamificationUtils';

export default function PatientRegister() {
  const [formData, setFormData] = useState({
    fullName: '',
    dob: '',
    phone: '',
    code: ''
  });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg('');

    if (!auth.currentUser) return;
    const uid = auth.currentUser.uid;
    const email = auth.currentUser.email;

    try {
      // 1. LÓGICA DE VINCULACIÓN Y AUTORIZACIÓN
      let initialCareTeam = {};
      let linkedProfessionalCode = null;
      
      // POR DEFECTO: Si no hay código, el paciente es libre (autorizado)
      let isAuthorizedValue = true;

      if (formData.code.trim()) {
        const cleanCode = formData.code.trim().toUpperCase();

        // Buscamos al profesional dueño de ese código
        const q = query(collection(db, "professionals"), where("professionalCode", "==", cleanCode));
        const docSnap = await getDocs(q);

        if (!docSnap.empty) {
          const profDoc = docSnap.docs[0];
          const profData = profDoc.data();
          const profId = profDoc.id;
          
          // Obtenemos el tipo como dato informativo
          const professionType = profData.professionType || 'psicologo';

          linkedProfessionalCode = cleanCode;
          
          // Al usar código, requiere aprobación del profesional
          isAuthorizedValue = false; 

          // ---------------------------------------------------------
          // ESTRUCTURA CORREGIDA (PLANA) - CRÍTICO PARA LA AGENDA
          // ---------------------------------------------------------
          initialCareTeam = {
            [profId]: {
              // DATOS PRINCIPALES (Nivel raíz para que el filtro de Agenda funcione)
              status: 'active',                  // <--- 'active' para que aparezca YA en la lista
              active: true,                      // Flag auxiliar
              nextAppointment: null,             // <--- null asegura que aparezca en "Sin Cita"
              
              // Datos informativos
              joinedAt: new Date().toISOString(),
              professionalName: profData.fullName,
              professionalId: profId,
              professionType: professionType,    // El rol se guarda como propiedad interna
              contactNumber: formData.phone,
              
              // Inicialización de contadores y precios
              noShowCount: 0,
              customPrice: profData.agendaSettings?.defaultPrice || 500
            }
          };
          // ---------------------------------------------------------

        } else {
          setSaving(false);
          setErrorMsg("El código ingresado no existe. Verifica o déjalo en blanco.");
          return;
        }
      }

      // 2. CREAR DOCUMENTO DEL PACIENTE
      await setDoc(doc(db, "patients", uid), {
        uid: uid,
        fullName: formData.fullName,
        email: email,
        dob: formData.dob,
        contactNumber: formData.phone,
        createdAt: new Date(),
        
        // Perfil de Gamificación Inicial
        gamificationProfile: INITIAL_PLAYER_PROFILE,
        
        // Datos de Vinculación
        careTeam: initialCareTeam,
        linkedProfessionalCode: linkedProfessionalCode,
        isAuthorized: isAuthorizedValue,

        // Flag para identificar origen
        isManual: false 
      });

      // 3. REDIRECCIÓN FINAL (MODIFICADO)
      // Forzamos una recarga completa del navegador.
      // Esto hará que App.tsx se ejecute de cero, detecte que el usuario
      // ya tiene documento en "patients" y muestre el Dashboard.
      window.location.reload();

    } catch (error: any) {
      console.error("Error al registrar:", error);
      setErrorMsg("Error al guardar datos: " + error.message);
      setSaving(false);
    }
  };

  return (
    <div style={{
      maxWidth: '400px', margin: '50px auto', padding: '30px',
      borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      backgroundColor: 'white', fontFamily: 'sans-serif'
    }}>
      <h2 style={{textAlign: 'center', color: '#2E7D32', marginBottom:'10px'}}>¡Bienvenido!</h2>
      <p style={{textAlign:'center', color:'#666', fontSize:'14px', marginBottom:'20px'}}>
        Completa tu perfil de héroe para comenzar.
      </p>

      {errorMsg && (
        <div style={{
          backgroundColor: '#ffebee', color: '#c62828', padding: '10px',
          borderRadius: '6px', marginBottom: '15px', fontSize: '13px', textAlign:'center'
        }}>
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '15px'}}>
        
        <div>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Nombre Completo</label>
          <input
            type="text"
            name="fullName"
            required
            value={formData.fullName}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Fecha de Nacimiento</label>
          <input
            type="date"
            name="dob"
            required
            value={formData.dob}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }}
          />
        </div>

        <div>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#333'}}>Teléfono (WhatsApp)</label>
          <input
            type="tel"
            name="phone"
            required
            placeholder="Para notificaciones de citas"
            value={formData.phone}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }}
          />
        </div>

        <div style={{marginTop:'10px', padding:'15px', backgroundColor:'#E3F2FD', borderRadius:'8px', border:'1px dashed #2196F3'}}>
          <label style={{display:'block', marginBottom:'5px', fontWeight:'bold', fontSize:'13px', color:'#1565C0'}}>Código de Vinculación (Opcional)</label>
          <small style={{display:'block', marginBottom:'8px', color:'#555'}}>Si tu profesional te dio un código, ingrésalo aquí.</small>
          <input
            type="text"
            name="code"
            placeholder="Ej: A1B2C3 (Opcional)"
            value={formData.code}
            onChange={handleChange}
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #1565C0', fontWeight:'bold', textAlign:'center', textTransform:'uppercase' }}
          />
          <small style={{display:'block', marginTop:'5px', color:'#d32f2f', fontSize:'11px'}}>* Al usar código, tu cuenta quedará pendiente de aprobación.</small>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{
            marginTop: '10px', padding: '15px', fontSize: '16px', cursor: 'pointer',
            backgroundColor: '#2E7D32', color: 'white', border: 'none', borderRadius:'6px', fontWeight:'bold'
          }}
        >
          {saving ? "Creando Perfil..." : "⚔️ Comenzar Aventura"}
        </button>

      </form>

      <div style={{marginTop: '25px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px'}}>
        <button
          onClick={() => auth.signOut()}
          style={{
            background:'none', border:'none', color:'#d32f2f',
            textDecoration:'underline', cursor:'pointer', fontSize:'13px'
          }}
        >
          Cancelar y Salir
        </button>
      </div>

    </div>
  );
}