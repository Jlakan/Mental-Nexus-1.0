import { useState, useEffect } from 'react';
// CORRECCIÓN: Quitamos updateDoc del import
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'; 
import { db } from '../services/firebase';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  professionalId: string;
}

export default function AssignmentModal({ isOpen, onClose, professionalId }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [professionalCode, setProfessionalCode] = useState('');

  // Cargar el código del profesional al abrir
  useEffect(() => {
    if (isOpen && professionalId) {
      const loadCode = async () => {
        const docRef = doc(db, "professionals", professionalId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          setProfessionalCode(snap.data().professionalCode || 'No generado');
        }
      };
      loadCode();
    }
  }, [isOpen, professionalId]);

  const handleAssign = async () => {
    setLoading(true);
    try {
      // 1. Buscar usuario por email
      const q = query(collection(db, "users"), where("email", "==", email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        alert("No se encontró un usuario con ese correo.");
        setLoading(false);
        return;
      }

      const userDoc = querySnapshot.docs[0];
      const userData = userDoc.data();
      const patientId = userDoc.id;

      // 2. Verificar si ya es paciente (opcional, pero recomendado)
      // ... lógica de verificación ...

      // 3. Crear registro en colección "patients"
      await setDoc(doc(db, "patients", patientId), {
        uid: patientId,
        email: userData.email,
        name: userData.fullName || 'Paciente',
        linkedProfessionalCode: professionalCode,
        createdAt: new Date()
      }, { merge: true });

      alert(`Paciente ${userData.fullName} asignado exitosamente.`);
      setEmail('');
      onClose();

    } catch (error) {
      console.error("Error asignando paciente:", error);
      alert("Hubo un error al asignar.");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '400px', maxWidth: '90%'
      }}>
        <h2>Asignar Paciente Existente</h2>
        <p>Ingresa el correo del usuario registrado en Mental Nexus para vincularlo a tu cuenta.</p>
        
        <input 
          type="email" 
          placeholder="Correo del paciente" 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: '100%', padding: '10px', margin: '10px 0', borderRadius: '4px', border: '1px solid #ccc' }}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleAssign} disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? 'Asignando...' : 'Asignar'}
          </button>
        </div>
      </div>
    </div>
  );
}