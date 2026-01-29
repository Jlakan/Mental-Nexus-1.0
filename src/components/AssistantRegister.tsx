import React, { useState } from 'react';
import { doc, setDoc, updateDoc, collection, query, where, getDocs, arrayUnion, serverTimestamp } from "firebase/firestore";
import { auth, db } from '../services/firebase';

export default function AssistantRegister() {
  // Estados para el perfil
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  // Estado para la vinculación opcional
  const [linkCode, setLinkCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setMsg('');

    try {
      const uid = auth.currentUser.uid;
      const email = auth.currentUser.email;

      // ---------------------------------------------------------
      // PASO 1: Intentar vincular (Solo si escribió un código)
      // ---------------------------------------------------------
      let linkedDoctorName = null;
      
      if (linkCode.trim().length > 0) {
        setMsg('Verificando código...');
        const q = query(collection(db, "professionals"), where("professionalCode", "==", linkCode.trim().toUpperCase()));
        const snap = await getDocs(q);

        if (snap.empty) {
          throw new Error("El código del profesional no es válido. Verifica o déjalo en blanco.");
        }

        const profDoc = snap.docs[0];
        // Vincular al asistente en el documento del doctor
        await updateDoc(doc(db, "professionals", profDoc.id), {
          authorizedAssistants: arrayUnion(uid)
        });
        linkedDoctorName = profDoc.data().name;
      }

      // ---------------------------------------------------------
      // PASO 2: Crear el Perfil en la colección 'assistants'
      // ---------------------------------------------------------
      setMsg('Creando perfil...');
      
      const assistantData = {
        name: name.trim(),
        phone: phone.trim(),
        email: email,
        uid: uid,
        createdAt: serverTimestamp(),
        // Guardamos un historial simple si se vinculó al inicio
        initialLink: linkedDoctorName ? { doctor: linkedDoctorName, date: new Date() } : null
      };

      await setDoc(doc(db, "assistants", uid), assistantData);

      // ---------------------------------------------------------
      // PASO 3: Actualizar rol en 'users' (Disparador final)
      // ---------------------------------------------------------
      // Esto le confirma a App.tsx que el proceso terminó
      await updateDoc(doc(db, "users", uid), {
        role: 'assistant',
        profileCompleted: true // Bandera útil para App.tsx
      });

      setMsg('✅ ¡Perfil creado con éxito! Redirigiendo...');
      
      // Recarga para entrar al Panel
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error(error);
      setMsg(`❌ Error: ${error.message}`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-purple-500/30 p-8 rounded-2xl shadow-2xl">
        
        <div className="text-center mb-8">
          <div className="text-5xl mb-2">🛡️</div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
            Registro de Asistente
          </h2>
          <p className="text-slate-400 text-sm mt-2">
            Configura tu perfil para gestionar agendas.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* NOMBRE */}
          <div>
            <label className="block text-xs font-bold text-purple-300 uppercase mb-1">Nombre Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre real"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>

          {/* CELULAR */}
          <div>
            <label className="block text-xs font-bold text-purple-300 uppercase mb-1">Celular / WhatsApp</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Para notificaciones y contacto"
              required
              className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:border-purple-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="h-px bg-slate-700 my-4"></div>

          {/* VINCULACIÓN OPCIONAL */}
          <div className="bg-purple-900/20 p-4 rounded-lg border border-purple-500/20">
            <label className="block text-xs font-bold text-purple-200 uppercase mb-1">
              Vincular con Profesional (Opcional)
            </label>
            <p className="text-[10px] text-slate-400 mb-2">
              Si tienes un código de doctor, ingrésalo ahora. Si no, puedes hacerlo después desde el panel.
            </p>
            <input
              type="text"
              value={linkCode}
              onChange={(e) => setLinkCode(e.target.value)}
              placeholder="EJ: A1B2C3"
              maxLength={8}
              className="w-full bg-slate-950 border border-slate-600 rounded p-2 text-center text-lg tracking-widest uppercase text-white focus:border-purple-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full py-4 rounded-lg font-bold uppercase tracking-wider shadow-lg transition-all ${
              loading 
                ? 'bg-slate-700 text-slate-400 cursor-wait' 
                : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white hover:scale-[1.02]'
            }`}
          >
            {loading ? 'Creando Perfil...' : 'Finalizar Registro'}
          </button>
        </form>

        {msg && (
          <div className={`mt-6 p-3 rounded text-center text-sm font-bold ${
            msg.includes('❌') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'
          }`}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}