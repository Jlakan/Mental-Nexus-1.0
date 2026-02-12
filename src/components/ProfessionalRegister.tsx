// src/components/ProfessionalRegister.tsx
import React, { useState, useEffect } from 'react';
import { doc, setDoc, getDocs, collection, updateDoc } from "firebase/firestore";
import { auth, db } from '../services/firebase';

export default function ProfessionalRegister() {
  const [professions, setProfessions] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    fullName: '',
    license: '',
    phone: '',
    professionId: ''
  });
  const [saving, setSaving] = useState(false);

  // Cargar lista de profesiones al iniciar
  useEffect(() => {
    const fetchProfessions = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "professions"));
        const lista = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProfessions(lista);
      } catch (error) {
        console.error("Error cargando profesiones:", error);
      }
    };
    fetchProfessions();
  }, []);

  const generateCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let result = "";
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    if (!auth.currentUser) return;

    try {
      const newCode = generateCode();
      const uid = auth.currentUser.uid;

      // 1. Guardar en colección 'professionals'
      // AQUÍ AGREGAMOS LOS CAMPOS CRÍTICOS (nexusBalance y metrics)
      await setDoc(doc(db, "professionals", uid), {
        fullName: formData.fullName,
        licenseNumber: formData.license,
        contactNumber: formData.phone,
        professionType: formData.professionId,
        professionalCode: newCode,
        isAuthorized: false, // Requiere aprobación del Admin para operar
        email: auth.currentUser.email,
        
        // --- INICIALIZACIÓN DE SALDO Y MÉTRICAS ---
        nexusBalance: 50, // Saldo inicial de regalo (ajusta este valor según tu lógica)
        metrics: {
          nexusDistributed: 0 // Contador iniciado en 0 para evitar errores al incrementar
        },
        createdAt: new Date() // Es buena práctica guardar cuándo se creó
      });

      // 2. Actualizar rol en 'users' para que el ruteo sepa que ya es profesional
      await updateDoc(doc(db, "users", uid), {
        role: 'professional',
        professionalCode: newCode
      });

      // Recargar la página para que App.tsx lea el nuevo rol y muestre el Dashboard
      window.location.reload();

    } catch (error) {
      console.error("Error:", error);
      alert("Error al registrar profesional");
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto', fontFamily: 'sans-serif' }}>
      <h2>Registro de Profesional</h2>
      <p>Configura tu perfil clínico.</p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
      
        <div>
          <label>Nombre Completo:</label>
          <input 
            type="text" 
            name="fullName" 
            required 
            value={formData.fullName} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }} 
            placeholder="Ej. Dr. Juan Pérez"
          />
        </div>

        <div>
          <label>Cédula Profesional:</label>
          <input 
            type="text" 
            name="license" 
            required 
            value={formData.license} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }} 
            placeholder="Ej. 12345678"
          />
        </div>

        <div>
          <label>Celular de Contacto:</label>
          <input 
            type="tel" 
            name="phone" 
            required 
            value={formData.phone} 
            onChange={handleChange} 
            style={{ width: '100%', padding: '8px' }} 
            placeholder="Ej. 55 1234 5678"
          />
        </div>

        <div>
          <label>Profesión:</label>
          <select
            name="professionId"
            required
            value={formData.professionId}
            onChange={handleChange}
            style={{ width: '100%', padding: '8px', backgroundColor: 'white' }}
          >
            <option value="">-- Selecciona una --</option>
            {professions.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={saving}
          style={{ 
            marginTop: '20px', 
            padding: '15px', 
            backgroundColor: saving ? '#ccc' : '#2196F3', 
            color: 'white', 
            border: 'none', 
            cursor: saving ? 'not-allowed' : 'pointer',
            borderRadius: '4px',
            fontWeight: 'bold'
          }}
        >
          {saving ? "Registrando..." : "Solicitar Alta"}
        </button>

      </form>
    </div>
  );
}