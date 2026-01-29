import React, { useState } from 'react';
import { doc, updateDoc, collection, query, where, getDocs, arrayUnion, setDoc } from "firebase/firestore";
import { auth, db } from '../services/firebase';

export default function AssistantRegister() {
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setMsg('Buscando profesional...');

    try {
      // 1. Buscamos al profesional por su código único
      const q = query(collection(db, "professionals"), where("professionalCode", "==", code.trim().toUpperCase()));
      const snap = await getDocs(q);

      if (snap.empty) {
        setMsg('❌ Código no encontrado o inválido.');
        setLoading(false);
        return;
      }

      const profDoc = snap.docs[0];
      const profId = profDoc.id;
      const profData = profDoc.data();

      // ---------------------------------------------------------
      // 🔄 CAMBIO IMPORTANTE DE ORDEN
      // Primero preparamos todo el terreno antes de activar el rol
      // ---------------------------------------------------------

      // 2. Creamos/Actualizamos el perfil en la colección 'assistants' (Ahora va PRIMERO)
      await setDoc(doc(db, "assistants", auth.currentUser.uid), {
        uid: auth.currentUser.uid,
        email: auth.currentUser.email,
        displayName: auth.currentUser.displayName || 'Asistente',
        linkedProfessionals: arrayUnion(profId),
        lastUpdated: new Date()
      }, { merge: true });

      // 3. Nos agregamos a la lista del doctor
      await updateDoc(doc(db, "professionals", profId), {
        authorizedAssistants: arrayUnion(auth.currentUser.uid)
      });

      setMsg(`✅ Vinculado con ${profData.fullName}. Accediendo...`);

      // 4. EL DISPARADOR FINAL: Cambiamos el rol en 'users'
      // Esto hará que App.tsx detecte el cambio y redirija.
      // Al hacerlo al final, aseguramos que los pasos 2 y 3 ya terminaron.
      await setDoc(doc(db, "users", auth.currentUser.uid), {
        role: 'assistant'
      }, { merge: true });

      // No necesitamos window.location.reload() si App.tsx tiene un listener,
      // el cambio de rol hará la magia automáticamente.

    } catch (e) {
      console.error(e);
      setMsg('❌ Error de conexión. Intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', padding: '30px', textAlign: 'center', fontFamily: 'sans-serif', border: '1px solid #ddd', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.1)', background: 'white' }}>
      <h2 style={{ color: '#9C27B0', marginTop: 0 }}>Soy Asistente</h2>
      <p style={{ color: '#666', marginBottom: '25px' }}>Ingresa el código de vinculación proporcionado por el profesional para gestionar su agenda.</p>

      <form onSubmit={handleLink} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="CÓDIGO (Ej: A1B2C3)"
          required
          disabled={loading}
          style={{
            padding: '15px',
            fontSize: '20px',
            textAlign: 'center',
            textTransform: 'uppercase',
            letterSpacing: '3px',
            borderRadius: '8px',
            border: '2px solid #E1BEE7',
            outline: 'none',
            fontWeight: 'bold'
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '15px',
            background: loading ? '#ccc' : '#9C27B0',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            fontWeight: 'bold',
            cursor: loading ? 'default' : 'pointer',
            transition: 'background 0.2s'
          }}
        >
          {loading ? 'Vinculando...' : 'Vincular Cuenta'}
        </button>
      </form>

      {msg && <p style={{
        marginTop: '20px', fontWeight: 'bold', padding: '10px', borderRadius: '4px', background: msg.includes('Error') || msg.includes('❌') ?
          '#FFEBEE' : '#E8F5E9', color: msg.includes('Error') || msg.includes('❌') ? '#D32F2F' : '#2E7D32'
      }}>{msg}</p>}

      <div style={{ marginTop: '30px', borderTop: '1px solid #eee', paddingTop: '15px' }}>
        <button onClick={() => auth.signOut()} style={{ background: 'none', border: 'none', color: '#666', textDecoration: 'underline', cursor: 'pointer', fontSize: '14px' }}>
          Cancelar y Cerrar Sesión
        </button>
      </div>
    </div>
  );
}