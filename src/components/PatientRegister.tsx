// src/components/PatientRegister.tsx
import React, { useState } from 'react';
import { doc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
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
      // 1. LÓGICA DE VINCULACIÓN (Solo si escribió código)
      let initialCareTeam = {};
      // CORRECCIÓN: Eliminamos la variable linkedProfessionalId que no se usaba
      let linkedProfessionalCode = null;

      if (formData.code.trim()) {
        const cleanCode = formData.code.trim().toUpperCase();

        // Buscamos al profesional dueño de ese código
        const q = query(collection(db, "professionals"), where("professionalCode", "==", cleanCode));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
          const profDoc = querySnapshot.docs[0];
          const profData = profDoc.data();
          const profId = profDoc.id;
          
          linkedProfessionalCode = cleanCode;

          const professionType = profData.professionType || 'general';

          initialCareTeam = {
            [professionType]: {
              professionalId: profId,
              professionalName: profData.fullName,
              joinedAt: new Date().toISOString(),
              active: true
            }
          };
        } else {
          alert("⚠️ El código ingresado no existe. Tu cuenta se creará sin vinculación profesional.");
        }
      }

      // 2. GUARDAR PERFIL DEL PACIENTE
      await setDoc(doc(db, "patients", uid), {
        uid: uid,
        fullName: formData.fullName,
        dob: formData.dob,
        contactNumber: formData.phone,
        email: email,
        
        careTeam: initialCareTeam,
        linkedProfessionalCode: linkedProfessionalCode,

        gamificationProfile: {
          ...INITIAL_PLAYER_PROFILE,
          wallet: { gold: 0, nexus: 0 }
        },

        createdAt: new Date()
      });

      // 3. ACTUALIZAR USUARIO CENTRAL
      await updateDoc(doc(db, "users", uid), {
        role: 'patient',
        fullName: formData.fullName,    
        profileCompleted: true,         
        updatedAt: new Date()
      });

      // Recargar para entrar al Dashboard
      window.location.reload();

    } catch (error) {
      console.error("Error al registrar:", error);
      setErrorMsg("Error técnico al crear perfil. Intenta de nuevo.");
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '450px', margin: '50px auto', fontFamily: 'sans-serif', padding:'20px', border:'1px solid #ddd', borderRadius:'8px', background:'white' }}>
      <h2 style={{textAlign:'center', color:'#2E7D32'}}>Registro de Aventurero</h2>
      <p style={{textAlign:'center', color:'#666'}}>Comienza tu viaje hacia el bienestar.</p>

      {errorMsg && <p style={{background:'#ffebee', color:'#c62828', padding:'10px', borderRadius:'4px'}}>{errorMsg}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        
        <div>
          <label style={{fontWeight:'bold', display:'block', marginBottom:'5px'}}>Nombre Completo:</label>
          <input type="text" name="fullName" required value={formData.fullName} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>

        <div>
          <label style={{fontWeight:'bold', display:'block', marginBottom:'5px'}}>Fecha de Nacimiento:</label>
          <input type="date" name="dob" required value={formData.dob} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>

        <div>
          <label style={{fontWeight:'bold', display:'block', marginBottom:'5px'}}>Celular:</label>
          <input type="tel" name="phone" required placeholder="55 1234 5678" value={formData.phone} onChange={handleChange} style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #ccc' }} />
        </div>

        <div style={{ backgroundColor: '#E3F2FD', padding: '15px', borderRadius: '8px', border:'1px solid #90CAF9' }}>
          <label style={{fontWeight:'bold', display:'block', marginBottom:'5px', color:'#1565C0'}}>¿Tienes un Código de Invitación?</label>
          <small style={{display:'block', marginBottom:'8px', color:'#555'}}>Si tu profesional te dio un código, ingrésalo aquí para conectarte automáticamente.</small>
          <input 
            type="text" 
            name="code" 
            placeholder="Ej: A1B2C3 (Opcional)" 
            value={formData.code} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '10px', borderRadius:'4px', border:'1px solid #1565C0', fontWeight:'bold', textAlign:'center', textTransform:'uppercase' }} 
          />
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

      {/* --- BOTÓN DE SALIR --- */}
      <div style={{marginTop: '25px', textAlign: 'center', borderTop: '1px solid #eee', paddingTop: '15px'}}>
        <button 
          onClick={() => auth.signOut()} 
          style={{
            background:'none', border:'none', color:'#d32f2f', 
            textDecoration:'underline', cursor:'pointer', fontSize:'14px', fontWeight:'bold'
          }}
        >
          Cancelar y Cerrar Sesión
        </button>
      </div>
    </div>
  );
}