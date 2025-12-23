// src/components/AdminPanel.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, getDoc, query, where, setDoc } from "firebase/firestore";
import { db, auth } from '../services/firebase';
import AdminCatalogTree from './AdminCatalogTree';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'catalog' | 'config'>('users');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingPros, setPendingPros] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  // Configuración Global
  const [globalConfig, setGlobalConfig] = useState({ appDownloadLink: '' });
  const [savingConfig, setSavingConfig] = useState(false);
  
  // CORRECCIÓN: Usamos una coma vacía para ignorar la variable 'loading' que no leíamos
  const [, setLoading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchPendingRequests(), fetchConfig()]);
    setLoading(false);
  };

  const fetchUsers = async () => {
    try {
      const q = await getDocs(collection(db, "users"));
      setUsersList(q.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const fetchPendingRequests = async () => {
    try {
      const q = query(collection(db, "professionals"), where("isAuthorized", "==", false));
      const snap = await getDocs(q);
      setPendingPros(snap.docs.map(d => ({ uid: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
  };

  const fetchConfig = async () => {
    try {
      const docSnap = await getDoc(doc(db, "settings", "global"));
      if (docSnap.exists()) {
        setGlobalConfig(docSnap.data() as any);
      }
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchAll(); }, []);

  const handleEditClick = async (user: any) => {
    let specificData = {};
    if (user.role === 'patient' || user.role === 'professional') {
      const collectionName = user.role === 'patient' ? 'patients' : 'professionals';
      const docSnap = await getDoc(doc(db, collectionName, user.uid));
      if (docSnap.exists()) specificData = docSnap.data();
    }
    setEditForm({ ...user, ...specificData, role: user.role });
    setEditingUser(user);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;
    try {
      const uid = editingUser.uid;
      const originalRole = editingUser.role;
      if (originalRole === 'patient' || originalRole === 'professional') {
        const collectionName = originalRole === 'patient' ? 'patients' : 'professionals';
        const { role, isAdmin, ...specificData } = editForm;
        await updateDoc(doc(db, collectionName, uid), specificData);
      }
      await updateDoc(doc(db, "users", uid), {
        displayName: editForm.fullName || editForm.displayName,
        email: editForm.email,
        role: editForm.role
      });
      alert("Usuario actualizado correctamente.");
      setEditingUser(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      alert("Error al guardar cambios.");
    }
  };

  const handleDelete = async (uid: string, role: string) => {
    if (!window.confirm("¿Estás SEGURO? Se borrará de todas las bases de datos.")) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      if (role === 'patient') await deleteDoc(doc(db, "patients", uid));
      if (role === 'professional') await deleteDoc(doc(db, "professionals", uid));
      fetchAll();
    } catch (e) { alert("Error al eliminar"); }
  };

  const handleAuthorize = async (profUid: string) => {
    if(!window.confirm("¿Autorizar profesional?")) return;
    await updateDoc(doc(db, "professionals", profUid), { isAuthorized: true });
    fetchAll();
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "settings", "global"), globalConfig, { merge: true });
      alert("Configuración guardada.");
    } catch (e) {
      alert("Error al guardar configuración.");
    } finally {
      setSavingConfig(false);
    }
  };

  const renderEditModal = () => {
    if (!editingUser) return null;
    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
        <div style={{backgroundColor:'white', padding:'20px', borderRadius:'8px', width:'400px', maxHeight:'80vh', overflowY:'auto'}}>
          <h2>Editando Usuario</h2>
          <label style={{display:'block', marginTop:'10px', fontWeight:'bold'}}>Rol del Sistema:</label>
          <select value={editForm.role || 'patient'} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{width:'100%', padding:'8px', marginBottom:'10px', border:'2px solid #2196F3', borderRadius:'4px'}}>
            <option value="patient">Paciente</option>
            <option value="professional">Profesional</option>
            <option value="admin">Administrador</option>
          </select>
          <label style={{display:'block', marginTop:'10px'}}>Nombre Completo:</label>
          <input value={editForm.fullName || editForm.displayName || ''} onChange={e => setEditForm({...editForm, fullName: e.target.value})} style={{width:'100%', padding:'8px'}} />
          <label style={{display:'block', marginTop:'10px'}}>Correo:</label>
          <input value={editForm.email || ''} onChange={e => setEditForm({...editForm, email: e.target.value})} style={{width:'100%', padding:'8px'}} />
          {editingUser.role === 'professional' && (
            <>
              <label style={{display:'block', marginTop:'10px'}}>Cédula:</label>
              <input value={editForm.licenseNumber || ''} onChange={e => setEditForm({...editForm, licenseNumber: e.target.value})} style={{width:'100%', padding:'8px'}} />
            </>
          )}
          <div style={{marginTop:'20px', display:'flex', justifyContent:'flex-end', gap:'10px'}}>
            <button onClick={() => setEditingUser(null)} style={{background:'#ccc', border:'none', padding:'10px', cursor:'pointer'}}>Cancelar</button>
            <button onClick={handleSaveEdit} style={{background:'#2196F3', color:'white', border:'none', padding:'10px', cursor:'pointer'}}>Guardar Todo</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      {renderEditModal()}
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
        <h1>Panel de Administración</h1>
        <button onClick={() => auth.signOut()} style={{background:'#ff4444', color:'white', border:'none', padding:'8px'}}>Salir</button>
      </div>
      <div style={{display:'flex', gap:'10px', borderBottom:'2px solid #ddd', paddingBottom:'10px', marginBottom:'20px'}}>
        <button onClick={() => setActiveTab('users')} style={{padding:'10px', background: activeTab==='users'?'#333':'#eee', color: activeTab==='users'?'white':'black'}}>👥 Usuarios</button>
        <button onClick={() => setActiveTab('requests')} style={{padding:'10px', background: activeTab==='requests'?'#FF9800':'#eee', color: activeTab==='requests'?'white':'black'}}>🔔 Solicitudes ({pendingPros.length})</button>
        <button onClick={() => setActiveTab('catalog')} style={{padding:'10px', background: activeTab==='catalog'?'#333':'#eee', color: activeTab==='catalog'?'white':'black'}}>📚 Catálogo</button>
        <button onClick={() => setActiveTab('config')} style={{padding:'10px', background: activeTab==='config'?'#333':'#eee', color: activeTab==='config'?'white':'black'}}>⚙️ Configuración</button>
      </div>

      {activeTab === 'catalog' && <AdminCatalogTree />}

      {activeTab === 'config' && (
        <div style={{maxWidth:'600px', background:'white', padding:'20px', borderRadius:'8px', border:'1px solid #ccc'}}>
          <h3 style={{marginTop:0}}>Configuración Global de la App</h3>
          <label style={{display:'block', fontWeight:'bold', marginBottom:'5px'}}>Enlace de Descarga / Invitación (Mental Nexus):</label>
          <input
            value={globalConfig.appDownloadLink}
            onChange={e => setGlobalConfig({...globalConfig, appDownloadLink: e.target.value})}
            placeholder="Ej: https://mentalnexus.app/descargar"
            style={{width:'100%', padding:'10px', marginBottom:'20px', borderRadius:'4px', border:'1px solid #ccc'}}
          />
          <button onClick={handleSaveConfig} disabled={savingConfig} style={{padding:'10px 20px', background:'#4CAF50', color:'white', border:'none', cursor:'pointer', fontWeight:'bold'}}>
            {savingConfig ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      )}

      {activeTab === 'requests' && (
        <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white'}}>
          <thead><tr style={{background:'#fff3e0'}}><th>Nombre</th><th>Acción</th></tr></thead>
          <tbody>
            {pendingPros.map(p => (
              <tr key={p.uid}>
                <td style={{padding:'10px'}}>{p.fullName}</td>
                <td style={{padding:'10px'}}><button onClick={() => handleAuthorize(p.uid)}>  ✅ Autorizar  </button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {activeTab === 'users' && (
        <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white'}}>
          <thead><tr style={{background:'#f0f0f0'}}><th>Usuario</th><th>Rol Actual</th><th>Acciones</th></tr></thead>
          <tbody>
            {usersList.map(u => (
              <tr key={u.uid}>
                <td style={{padding:'10px'}}><strong>{u.displayName || 'Sin Nombre'}</strong><br/><small>{u.email}</small></td>
                <td style={{padding:'10px', textAlign:'center', fontWeight:'bold', color: u.role==='admin'?'purple': u.role==='professional'?'blue':'green'}}>
                  {u.role ? u.role.toUpperCase() : 'SIN ROL'}
                </td>
                <td style={{padding:'10px', textAlign:'center'}}>
                  <button onClick={() => handleEditClick(u)} style={{marginRight:'5px', cursor:'pointer'}}>✏️ Editar</button>
                  {!u.isAdmin && <button onClick={() => handleDelete(u.uid, u.role)} style={{color:'red', cursor:'pointer'}}>🗑 Borrar</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}