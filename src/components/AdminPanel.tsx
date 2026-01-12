// src/components/AdminPanel.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, deleteDoc, updateDoc, getDoc, query, where, setDoc } from "firebase/firestore";
import { db, auth } from '../services/firebase';
import AdminCatalogTree from './AdminCatalogTree';
import GameEconomyPanel from './GameEconomyPanel';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'catalog' | 'config' | 'economy'>('users');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingPros, setPendingPros] = useState<any[]>([]);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  
  const [globalConfig, setGlobalConfig] = useState({ appDownloadLink: '' });
  const [savingConfig, setSavingConfig] = useState(false);
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
      alert("Usuario actualizado.");
      setEditingUser(null);
      fetchAll();
    } catch (error) {
      console.error(error);
      alert("Error al guardar.");
    }
  };

  const handleDelete = async (uid: string, role: string) => {
    if (!window.confirm("¿Estás SEGURO?")) return;
    try {
      await deleteDoc(doc(db, "users", uid));
      if (role === 'patient') await deleteDoc(doc(db, "patients", uid));
      if (role === 'professional') await deleteDoc(doc(db, "professionals", uid));
      fetchAll();
    } catch (e) { alert("Error al eliminar"); }
  };

  const handleAuthorize = async (profUid: string) => {
    if(!window.confirm("¿Autorizar?")) return;
    await updateDoc(doc(db, "professionals", profUid), { isAuthorized: true });
    fetchAll();
  };

  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      await setDoc(doc(db, "settings", "global"), globalConfig, { merge: true });
      alert("Configuración guardada.");
    } catch (e) { alert("Error al guardar."); } 
    finally { setSavingConfig(false); }
  };

  const renderEditModal = () => {
    if (!editingUser) return null;
    return (
      <div style={{ position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000 }}>
        <div style={{background:'white', padding:'20px', borderRadius:'8px', width:'400px'}}>
          <h3>Editar Usuario</h3>
          <select value={editForm.role || 'patient'} onChange={e => setEditForm({...editForm, role: e.target.value})} style={{width:'100%', marginBottom:'10px', padding:'8px'}}>
            <option value="patient">Paciente</option>
            <option value="professional">Profesional</option>
            <option value="admin">Administrador</option>
          </select>
          <input value={editForm.displayName || ''} onChange={e => setEditForm({...editForm, displayName: e.target.value})} placeholder="Nombre" style={{width:'100%', marginBottom:'10px', padding:'8px'}} />
          <div style={{display:'flex', justifyContent:'flex-end', gap:'10px'}}>
            <button onClick={() => setEditingUser(null)}>Cancelar</button>
            <button onClick={handleSaveEdit} style={{background:'#2196F3', color:'white', border:'none', padding:'8px 16px'}}>Guardar</button>
          </div>
        </div>
      </div>
    );
  };

  const getTabStyle = (isActive: boolean) => ({
    padding: '10px 15px', cursor: 'pointer',
    background: isActive ? '#333' : '#eee', color: isActive ? '#fff' : '#333',
    border: 'none', borderRadius: '4px', fontWeight: 'bold' as const
  });

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif', maxWidth:'1200px', margin:'0 auto' }}>
      {renderEditModal()}
      <div style={{display:'flex', justifyContent:'space-between', marginBottom:'20px'}}>
        <h1>Panel de Administración</h1>
        <button onClick={() => auth.signOut()} style={{background:'#f44336', color:'white', border:'none', padding:'8px 16px', borderRadius:'4px'}}>Cerrar Sesión</button>
      </div>
      
      <div style={{display:'flex', gap:'10px', borderBottom:'2px solid #ddd', paddingBottom:'15px', marginBottom:'25px', flexWrap:'wrap'}}>
        <button onClick={() => setActiveTab('users')} style={getTabStyle(activeTab === 'users')}>👥 Usuarios</button>
        <button onClick={() => setActiveTab('requests')} style={getTabStyle(activeTab === 'requests')}>🔔 Solicitudes</button>
        <button onClick={() => setActiveTab('catalog')} style={getTabStyle(activeTab === 'catalog')}>📚 Catálogo</button>
        <button onClick={() => setActiveTab('economy')} style={{...getTabStyle(activeTab === 'economy'), background: activeTab==='economy'?'#E91E63':'#eee'}}>💎 Economía</button>
        <button onClick={() => setActiveTab('config')} style={getTabStyle(activeTab === 'config')}>⚙️ Configuración</button>
      </div>

      {activeTab === 'catalog' && <AdminCatalogTree />}
      {activeTab === 'economy' && <GameEconomyPanel />}

      {activeTab === 'config' && (
        <div style={{maxWidth:'600px', background:'white', padding:'20px', borderRadius:'8px', border:'1px solid #ccc'}}>
           <h3>Configuración Global</h3>
           <label>Enlace de Descarga:</label>
           <input value={globalConfig.appDownloadLink} onChange={e => setGlobalConfig({...globalConfig, appDownloadLink: e.target.value})} style={{width:'100%', padding:'10px', margin:'10px 0'}} />
           <button onClick={handleSaveConfig} disabled={savingConfig} style={{padding:'10px 20px', background:'#4CAF50', color:'white', border:'none'}}>{savingConfig ? 'Guardando...' : 'Guardar'}</button>
        </div>
      )}

      {activeTab === 'requests' && (
         <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white'}}>
           <thead><tr style={{background:'#fff3e0'}}><th>Nombre</th><th>Acción</th></tr></thead>
            <tbody>
            {pendingPros.map(p => (
              <tr key={p.uid}>
                <td style={{padding:'10px'}}>{p.fullName}</td>
                <td style={{padding:'10px'}}><button onClick={() => handleAuthorize(p.uid)}>✅ Autorizar</button></td>
              </tr>
            ))}
            </tbody>
         </table>
      )}

      {activeTab === 'users' && (
        <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white'}}>
          <thead><tr style={{background:'#f0f0f0'}}><th>Usuario</th><th>Rol</th><th>Acciones</th></tr></thead>
          <tbody>
          {usersList.map(u => (
            <tr key={u.uid}>
              <td style={{padding:'10px'}}>{u.displayName} <br/><small>{u.email}</small></td>
              <td style={{padding:'10px'}}>{u.role}</td>
              <td style={{padding:'10px'}}>
                <button onClick={() => handleEditClick(u)} style={{marginRight:'5px'}}>✏️</button>
                {u.role !== 'admin' && <button onClick={() => handleDelete(u.uid, u.role)} style={{color:'red'}}>🗑</button>}
              </td>
            </tr>
          ))}
          </tbody>
        </table>
      )}
    </div>
  );
}