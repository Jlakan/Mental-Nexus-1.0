// src/components/AdminPanel.tsx
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, updateDoc,
  getDoc, query, where, setDoc, writeBatch
} from "firebase/firestore";
import { db, auth } from '../services/firebase';

// Componentes
import AdminCatalogTree from './AdminCatalogTree';
import GameEconomyPanel from './GameEconomyPanel';
import AdminBulkTools from './AdminBulkTools';

// Tipos
import type { Assignment } from '../types'; 

// Importaciones de Inteligencia
import { analyzeCatalogBatch } from '../utils/ClinicalEngine';
import { calculateAggregatedStats } from '../utils/PopulationAnalytics';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'catalog' | 'config' | 'economy' | 'bulk' | 'analytics'>('users');
  
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingPros, setPendingPros] = useState<any[]>([]);
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [globalConfig, setGlobalConfig] = useState({ appDownloadLink: '' });
  
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [populationStats, setPopulationStats] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'top' | 'worst'>('all');

  const [isInitializingTags, setIsInitializingTags] = useState(false);

  const fetchAll = async () => {
    await Promise.all([fetchUsers(), fetchPendingRequests(), fetchConfig()]);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchUsers = async () => {
    try {
      const [usersSnap, patientsSnap, prosSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "patients")),
        getDocs(collection(db, "professionals"))
      ]);

      // SOLUCIÓN: Agregado "as any" para evitar errores de propiedades en TypeScript
      const pros = prosSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
      setProfessionalsList(pros);

      const prosMap = new Map(pros.map(p => [p.uid, p.fullName || p.displayName || 'Profesional']));

      const registeredUsers = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any));
      const manualPatients = patientsSnap.docs.map(d => ({ 
        uid: d.id, 
        ...d.data(),
        displayName: d.data().fullName || d.data().displayName || 'Sin Nombre',
        isManual: d.data().isManual || false,
        role: d.data().role || 'patient'
      } as any));

      const combined = [...registeredUsers];
      manualPatients.forEach(p => {
        if (!combined.find(u => u.uid === p.uid)) combined.push(p);
      });

      const finalData = combined.map(u => {
        let profName = 'Sin asignar';
        if (u.linkedProfessionalId) {
          profName = prosMap.get(u.linkedProfessionalId) || 'Sin asignar';
        } else if (u.careTeam) {
          const firstProId = Object.keys(u.careTeam)[0];
          if (firstProId) profName = prosMap.get(firstProId) || 'Sin asignar';
        }
        return { ...u, profName };
      });

      setUsersList(finalData);
    } catch (e) { console.error("Error al cargar usuarios:", e); }
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
      const d = await getDoc(doc(db, "settings", "global"));
      if (d.exists()) setGlobalConfig(d.data() as any);
    } catch (e) { console.error(e); }
  };

  const handleLoadGlobalAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
        const [snapM, snapR] = await Promise.all([
            getDocs(collection(db, "assigned_missions")),
            getDocs(collection(db, "assigned_routines"))
        ]);

        const allTasks = [
          ...snapM.docs.map(d => ({ ...d.data(), id: d.id, type: 'mission' } as unknown as Assignment)),
          ...snapR.docs.map(d => ({ ...d.data(), id: d.id, type: 'routine' } as unknown as Assignment))
        ];

        const contentStats = analyzeCatalogBatch(allTasks as any[]); 
        let statsArray = Array.isArray(contentStats) ? contentStats : Object.values(contentStats);
        statsArray.sort((a: any, b: any) => b.usageCount - a.usageCount); 

        const popStats = calculateAggregatedStats ? calculateAggregatedStats(usersList, allTasks) : {};

        setAnalyticsData(statsArray);
        setPopulationStats(popStats);

    } catch (error) {
        console.error("Error loading analytics:", error);
        alert("Error al cargar inteligencia global.");
    } finally {
        setLoadingAnalytics(false);
    }
  };

  const handleInitializeTagsSystem = async () => {
    setIsInitializingTags(true);
    try {
      const batch = writeBatch(db);
      const metadataRef = doc(db, 'system', 'tagsMetadata');
      const metadataSnap = await getDoc(metadataRef);

      if (!metadataSnap.exists()) {
        batch.set(metadataRef, { psicologia_version: 1, nutricion_version: 1, lenguaje_version: 1 });
      }

      const dictRefs = [
        doc(db, 'tagsDictionaries', 'psicologia'),
        doc(db, 'tagsDictionaries', 'nutricion'),
        doc(db, 'tagsDictionaries', 'lenguaje')
      ];

      dictRefs.forEach((ref) => { batch.set(ref, { tags: [] }, { merge: true }); });

      await batch.commit();
      alert("Sistema de Tags inicializado correctamente.");
    } catch (error) {
      console.error("Error al inicializar el sistema de tags:", error);
      alert("Error al inicializar el sistema de tags.");
    } finally {
      setIsInitializingTags(false);
    }
  };

  const getFilteredStats = () => {
      if (!analyticsData) return [];
      let data = [...analyticsData];
      if (searchTerm) data = data.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));
      if (filterMode === 'top') {
          data.sort((a, b) => b.globalSuccessRate - a.globalSuccessRate);
          return data.slice(0, 5);
      } else if (filterMode === 'worst') {
          data.sort((a, b) => b.dropoutRate - a.dropoutRate);
          return data.slice(0, 5);
      } else {
          return data.slice(0, 20);
      }
  };

  const displayedStats = getFilteredStats();

  const handleExportCSV = () => {
    if (!analyticsData || analyticsData.length === 0) {
      alert("No hay datos para exportar. Carga la Inteligencia Global primero.");
      return;
    }
    const headers = ["ID_Referencia", "Título de Tarea", "Frecuencia (Uso)", "Tasa de Éxito Global (%)", "Tasa de Abandono (%)", "Carga Cognitiva Est."];
    const csvRows = analyticsData.map((row: any) => {
      const safeTitle = row.title ? `"${row.title.replace(/"/g, '""')}"` : "Sin Título";
      return [
        row.catalogId, safeTitle, row.usageCount, row.globalSuccessRate.toFixed(2), row.dropoutRate.toFixed(2), row.workloadImpact
      ].join(",");
    });
    const csvString = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob(["\uFEFF" + csvString], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `reporte_clinico_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAuthorize = async (proUid: string) => {
    if (!window.confirm("¿Autorizar a este profesional?")) return;
    try {
      await updateDoc(doc(db, "professionals", proUid), { isAuthorized: true });
      await updateDoc(doc(db, "users", proUid), { role: 'professional' });
      alert("Profesional autorizado correctamente.");
      fetchAll();
    } catch (e) { console.error(e); alert("Error al autorizar."); }
  };

  const handleDelete = async (user: any) => {
    const { uid, role, isManual, displayName } = user;
    const confirmMsg = isManual 
      ? `¿Seguro que deseas eliminar al paciente manual "${displayName}" y sus datos vinculados?` 
      : `¿Seguro que deseas eliminar todos los datos de Firestore de "${displayName}"?`;

    if (!window.confirm(confirmMsg)) return;

    const batch = writeBatch(db);
    try {
        if (!isManual) batch.delete(doc(db, "users", uid));
        if (role === 'pro') batch.delete(doc(db, "professionals", uid));
        if (role === 'patient' || isManual) batch.delete(doc(db, "patients", uid));

        await batch.commit();
        alert("Registro eliminado correctamente.");
        fetchAll();
    } catch (e) { console.error(e); alert("Error al eliminar"); }
  };

  const handleEditClick = async (user: any) => {
    let extraData: any = {};
    let currentProId = user.linkedProfessionalId || (user.careTeam ? Object.keys(user.careTeam)[0] : '');

    try {
      if (user.role === 'pro') {
        const snap = await getDoc(doc(db, 'professionals', user.uid));
        if (snap.exists()) extraData = snap.data();
      } else if (user.role === 'patient' || user.isManual) {
        const snap = await getDoc(doc(db, 'patients', user.uid));
        if (snap.exists()) {
            extraData = snap.data();
            if (extraData.linkedProfessionalId) currentProId = extraData.linkedProfessionalId;
            else if (extraData.careTeam) currentProId = Object.keys(extraData.careTeam)[0];
        }
      }
    } catch (e) { console.log("No extra data found"); }
    
    setEditForm({ ...user, ...extraData, linkedProfessionalId: currentProId });
    setEditingUser(user);
  };

  const saveEdit = async () => {
    try {
        const isPatient = editForm.role === 'patient' || editingUser.isManual;
        
        const patientUpdates: any = {
            fullName: editForm.displayName,
            role: editForm.role, 
            email: editForm.email
        };

        if (isPatient && editForm.linkedProfessionalId) {
            patientUpdates.linkedProfessionalId = editForm.linkedProfessionalId;
            patientUpdates[`careTeam.${editForm.linkedProfessionalId}.status`] = 'active';
        }

        if (editingUser.isManual) {
            await updateDoc(doc(db, "patients", editingUser.uid), patientUpdates);
        } else {
            await updateDoc(doc(db, "users", editingUser.uid), {
                displayName: editForm.displayName, role: editForm.role, email: editForm.email
            });

            if (isPatient) {
                await setDoc(doc(db, "patients", editingUser.uid), patientUpdates, { merge: true });
            }

            if (editForm.role === 'pro') {
               const proRef = doc(db, "professionals", editingUser.uid);
               await setDoc(proRef, { fullName: editForm.displayName, email: editForm.email }, { merge: true });
            }
        }
        
        setEditingUser(null); 
        alert("Usuario y vinculaciones actualizadas"); 
        fetchAll();
    } catch (e) { console.error(e); alert("Error al actualizar"); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    await setDoc(doc(db, "settings", "global"), globalConfig, { merge: true });
    setSavingConfig(false); alert("Configuración guardada");
  };

  const StatCard = ({ title, value, color, icon }: any) => (
    <div style={{background:'white', padding:'15px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', flex:1, display:'flex', alignItems:'center', gap:'15px'}}>
       <div style={{background: color, width:'40px', height:'40px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', color:'white'}}>{icon}</div>
       <div>
          <div style={{fontSize:'12px', color:'#666', textTransform:'uppercase', fontWeight:'bold'}}>{title}</div>
          <div style={{fontSize:'24px', fontWeight:'bold', color:'#333'}}>{value}</div>
       </div>
    </div>
  );

  const ProgressBar = ({ label, value, max, color }: any) => {
      const percentage = max > 0 ? (value / max) * 100 : 0;
      return (
          <div style={{marginBottom:'10px'}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'4px'}}>
                  <span style={{color:'#555'}}>{label}</span>
                  <span style={{fontWeight:'bold'}}>{value} ({Math.round(percentage)}%)</span>
              </div>
              <div style={{width:'100%', height:'8px', background:'#eee', borderRadius:'4px', overflow:'hidden'}}>
                  <div style={{width:`${percentage}%`, height:'100%', background:color, transition:'width 0.5s ease'}}></div>
              </div>
          </div>
      )
  };

  const modalInputStyle = {
    width:'100%', 
    padding:'10px', 
    marginTop: '6px',
    border: '1px solid #334155',
    borderRadius: '6px',
    color: '#fff',
    boxSizing: 'border-box' as const,
    background: '#0B1121',
    outline: 'none',
    fontSize: '14px'
  };

  return (
    <div style={{ padding: '20px', fontFamily:'sans-serif', position:'relative', background:'#0B1121', minHeight:'100vh', color: '#fff' }}>
     
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#00E5FF', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Panel de Control Nexus
        </h2>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={handleInitializeTagsSystem} 
            disabled={isInitializingTags}
            style={{padding:'8px 15px', background:'#FF9800', color:'white', border:'none', borderRadius:'4px', cursor: isInitializingTags ? 'not-allowed' : 'pointer', fontWeight:'bold'}}
          >
            {isInitializingTags ? 'Inicializando...' : 'Inicializar Sistema Tags'}
          </button>
          <button onClick={() => auth.signOut()} style={{ background: '#f44336', color: 'white', border: 'none', borderRadius: '4px', padding: '10px 20px', cursor: 'pointer' }}>Cerrar Sesión</button>
        </div>
      </div>
     
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' }}>
        {[
          { id: 'users', label: '👥 Usuarios' },
          { id: 'requests', label: '📩 Solicitudes' },
          { id: 'catalog', label: '📚 Catálogo' },
          { id: 'economy', label: '💎 Economía' },
          { id: 'config', label: '⚙️ Config' },
          { id: 'bulk', label: '📦 Carga Masiva' },
          { id: 'analytics', label: '📈 Inteligencia Global' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'analytics') {
                handleLoadGlobalAnalytics();
              }
            }}
            style={{
              padding: '10px 20px', borderRadius: '4px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
              background: activeTab === tab.id ? '#00E5FF' : '#151E32',
              color: activeTab === tab.id ? '#0B1121' : '#94A3B8'
            }}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </div>

      <hr style={{borderColor:'#334155', marginBottom:'20px'}} />

      {editingUser && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(11, 17, 33, 0.8)', backdropFilter:'blur(4px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}}>
            <div style={{
                background:'#151E32', 
                padding:'30px', 
                borderRadius:'12px', 
                width:'400px', 
                maxWidth:'90%',
                border: '1px solid #334155',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                color: '#fff'
            }}>
                <h3 style={{
                    color:'#00E5FF', 
                    marginTop: 0, 
                    borderBottom: '1px solid #334155', 
                    paddingBottom: '15px', 
                    marginBottom: '20px',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                }}>✏️ Editar Usuario</h3>
                
                <label style={{display:'block', marginBottom:'15px', color: '#94A3B8', fontSize:'13px'}}>
                    Nombre Completo: 
                    <input 
                        type="text" 
                        value={editForm.displayName||''} 
                        onChange={e=>setEditForm({...editForm, displayName:e.target.value})} 
                        style={modalInputStyle}
                    />
                </label>

                <label style={{display:'block', marginBottom:'15px', color: '#94A3B8', fontSize:'13px'}}>
                    Correo Electrónico: 
                    <input 
                        type="text" 
                        value={editForm.email||''} 
                        onChange={e=>setEditForm({...editForm, email:e.target.value})} 
                        style={modalInputStyle}
                    />
                </label>

                <label style={{display:'block', marginBottom:'20px', color: '#94A3B8', fontSize:'13px'}}>
                    Rol de Sistema: 
                    <select 
                        value={editForm.role||'user'} 
                        onChange={e=>setEditForm({...editForm, role:e.target.value})} 
                        style={{...modalInputStyle, cursor: 'pointer'}}
                    >
                        <option value="user">Usuario Común</option>
                        <option value="patient">Paciente</option>
                        <option value="pro">Profesional</option>
                        <option value="admin">Administrador</option>
                    </select>
                </label>

                {(editForm.role === 'patient' || editingUser?.isManual) && (
                    <div style={{background:'#0B1121', padding:'15px', borderRadius:'8px', border:'1px solid #334155', marginBottom:'25px'}}>
                        <label style={{display:'block', color: '#00E5FF', fontSize:'13px', fontWeight:'bold', marginBottom:'5px'}}>
                            🩺 Vincular a Profesional: 
                        </label>
                        <select 
                            value={editForm.linkedProfessionalId || ''} 
                            onChange={e=>setEditForm({...editForm, linkedProfessionalId:e.target.value})} 
                            style={{...modalInputStyle, background:'#151E32', border:'1px solid #00E5FF'}}
                        >
                            <option value="">-- Sin Asignar --</option>
                            {professionalsList.map(pro => (
                                <option key={pro.uid} value={pro.uid}>
                                    {pro.fullName || pro.displayName || 'Profesional Sin Nombre'}
                                </option>
                            ))}
                        </select>
                        <div style={{fontSize:'11px', color:'#64748B', marginTop:'8px'}}>
                            Esto integrará al paciente en la agenda del profesional.
                        </div>
                    </div>
                )}

                <div style={{display:'flex', justifyContent:'flex-end', gap:'15px', marginTop: '10px'}}>
                    <button 
                        onClick={()=>setEditingUser(null)} 
                        style={{
                            padding:'10px 20px', 
                            background:'#1E293B', 
                            color:'#94A3B8', 
                            border:'none', 
                            borderRadius:'6px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={saveEdit} 
                        style={{
                            padding:'10px 20px', 
                            background:'#00E5FF', 
                            color:'#0B1121', 
                            border:'none', 
                            borderRadius:'6px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(0, 229, 255, 0.2)'
                        }}
                    >
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
      )}

      {activeTab === 'config' && (
        <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          <h3 style={{color: 'black'}}>Configuración Global</h3>
          <label style={{color: 'black'}}>Link App: <input value={globalConfig.appDownloadLink} onChange={e => setGlobalConfig({...globalConfig, appDownloadLink: e.target.value})} style={{width:'100%', padding:'8px'}}/></label>
          <button onClick={saveConfig} disabled={savingConfig} style={{marginTop:'10px', padding:'10px', background:'#4CAF50', color:'white', border:'none', borderRadius:'4px'}}>{savingConfig ? '...' : 'Guardar'}</button>
        </div>
      )}

      {activeTab === 'requests' && (
         <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white', color: 'black'}}>
           <thead><tr style={{background:'#fff3e0'}}><th>Nombre</th><th>Email</th><th>Acción</th></tr></thead>
            <tbody>
            {pendingPros.map(p => (
              <tr key={p.uid}>
                <td style={{padding:'10px'}}>{p.fullName || p.displayName}</td>
                <td style={{padding:'10px'}}>{p.email}</td>
                <td style={{padding:'10px'}}><button onClick={() => handleAuthorize(p.uid)}>Autorizar</button></td>
              </tr>
            ))}
            </tbody>
         </table>
      )}

      {activeTab === 'users' && (
        <div style={{ background: '#0B1121', padding: '25px', borderRadius: '12px', boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px' }}>
            <h3 style={{ margin: 0, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '1px' }}>Directorio Global</h3>
            <input 
              placeholder="Buscar por nombre o correo..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '10px 20px', borderRadius: '30px', border: '1px solid #334155', background: '#151E32', color: '#fff', width: '300px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {usersList.filter(u => u.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())).map(u => (
              <div key={u.uid} style={{ 
                background: '#151E32', border: '1px solid #334155', borderRadius: '12px', padding: '20px', position: 'relative'
              }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleEditClick(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="Editar">✏️</button>
                  {u.role !== 'admin' && (
                    <button onClick={() => handleDelete(u)} style={{ background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer', fontSize: '16px' }} title="Eliminar">🗑</button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <div style={{ 
                    width: '50px', height: '50px', borderRadius: '50%', background: '#1E293B',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#94A3B8'
                  }}>
                    {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#00E5FF' }}>{u.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>{u.email || 'Sin correo asociado'}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', background: u.role === 'pro' ? 'rgba(33, 150, 243, 0.15)' : 'rgba(156, 39, 176, 0.15)', color: u.role === 'pro' ? '#64B5F6' : '#CE93D8', fontSize: '11px', fontWeight: 'bold', border: `1px solid ${u.role === 'pro' ? '#1976D2' : '#8E24AA'}` }}>
                    {u.role?.toUpperCase() || 'PACIENTE'}
                  </span>
                  {u.isManual && (
                    <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D', fontSize: '11px', fontWeight: 'bold', border: '1px solid #F57C00' }}>
                      📝 MANUAL
                    </span>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #334155', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Profesional a cargo</span>
                    <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 'bold' }}>🩺 {u.profName}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {usersList.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '40px' }}>No se encontraron usuarios...</div>}
        </div>
      )}
     
      {activeTab === 'catalog' && <AdminCatalogTree />}
      {activeTab === 'economy' && <GameEconomyPanel />}
      {activeTab === 'bulk' && <AdminBulkTools />}

      {activeTab === 'analytics' && (
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
               <h3 style={{color:'#37474F', margin:0}}>📊 Panel de Inteligencia</h3>
               <button onClick={handleExportCSV} disabled={loadingAnalytics || !analyticsData}
                 style={{
                    padding:'10px 20px', background: analyticsData ? '#2E7D32' : '#ddd',
                    color: analyticsData ? 'white' : '#666', border:'none', borderRadius:'6px', 
                    cursor: analyticsData ? 'pointer' : 'not-allowed', fontWeight:'bold',
                    display:'flex', alignItems:'center', gap:'8px',
                    boxShadow: analyticsData ? '0 2px 5px rgba(0,0,0,0.2)' : 'none'
                 }}>
                 📥 Descargar Excel (.csv)
               </button>
            </div>

            {loadingAnalytics && <div style={{textAlign:'center', padding:'40px', color:'#666'}}>🔄 Cargando inteligencia clínica...</div>}

            {!loadingAnalytics && analyticsData && (
                <>
                    <div style={{display:'flex', gap:'15px', flexWrap:'wrap', color: 'black'}}>
                        <StatCard title="Total Usuarios" value={usersList.length} color="#607D8B" icon="👥" />
                        <StatCard title="Pacientes Activos" value={usersList.filter(u => u.role === 'patient' || u.isManual).length} color="#4CAF50" icon="❤️" />
                        <StatCard title="Profesionales" value={usersList.filter(u => u.role === 'pro').length} color="#2196F3" icon="🩺" />
                        <StatCard title="Tareas Asignadas" value={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#FF9800" icon="📝" />
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'20px', color: 'black'}}>
                        
                        <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', borderBottom:'2px solid #009688', paddingBottom:'10px'}}>
                                <h4 style={{margin:0, color:'#37474F'}}>🏆 Rendimiento del Contenido</h4>
                            </div>

                            <div style={{display:'flex', gap:'10px', marginBottom:'15px', background:'#f9f9f9', padding:'10px', borderRadius:'6px'}}>
                                <input 
                                    placeholder="🔍 Buscar tarea..." 
                                    value={searchTerm}
                                    onChange={e => setSearchTerm(e.target.value)}
                                    style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc', flex:1}}
                                />
                                <select 
                                    value={filterMode}
                                    onChange={e => setFilterMode(e.target.value as any)} 
                                    style={{padding:'8px', borderRadius:'4px', border:'1px solid #ccc', fontWeight:'bold', color:'#555'}}
                                >
                                    <option value="all">Ver Todas (Recientes)</option>
                                    <option value="top">🔥 Top 5 Éxito</option>
                                    <option value="worst">🚨 Top 5 Riesgo</option>
                                </select>
                            </div>

                            <div style={{maxHeight:'400px', overflowY:'auto'}}>
                                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                                    <thead style={{background:'#f9f9f9', position:'sticky', top:0}}>
                                        <tr>
                                            <th style={{padding:'10px', textAlign:'left', color:'#666'}}>Título de la Tarea</th>
                                            <th style={{padding:'10px', textAlign:'center', color:'#666'}}>Frecuencia</th>
                                            <th style={{padding:'10px', textAlign:'center', color:'#666'}}>Efectividad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedStats.map((stat: any, i: number) => (
                                            <tr key={i} style={{borderBottom:'1px solid #f1f1f1'}}>
                                                <td style={{padding:'10px', fontWeight:'500'}}>{stat.title}</td>
                                                <td style={{padding:'10px', textAlign:'center'}}>
                                                    <span style={{background:'#E0F2F1', color:'#00695C', padding:'2px 8px', borderRadius:'10px', fontSize:'11px', fontWeight:'bold'}}>
                                                        {stat.usageCount}
                                                    </span>
                                                </td>
                                                <td style={{padding:'10px', textAlign:'center'}}>
                                                    <div style={{width:'60px', height:'6px', background:'#eee', borderRadius:'3px', display:'inline-block', marginRight:'8px', verticalAlign:'middle'}}>
                                                        <div style={{width:`${stat.globalSuccessRate}%`, height:'100%', background: stat.globalSuccessRate > 70 ? '#4CAF50' : '#FFC107', borderRadius:'3px'}}></div>
                                                    </div>
                                                    <span style={{fontSize:'11px', color:'#666'}}>{stat.globalSuccessRate.toFixed(0)}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {displayedStats.length === 0 && (
                                            <tr><td colSpan={3} style={{padding:'20px', textAlign:'center', color:'#999'}}>No se encontraron tareas con ese filtro.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {filterMode === 'all' && !searchTerm && (
                                <div style={{textAlign:'center', fontSize:'11px', color:'#999', marginTop:'10px'}}>
                                    Mostrando primeras 20 tareas. Usa "Descargar Excel" para ver todo.
                                </div>
                            )}
                        </div>

                        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                            
                            <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                                <h4 style={{marginTop:0, color:'#37474F', marginBottom:'15px'}}>⏰ Ritmo Circadiano</h4>
                                {populationStats?.timeOfDayStats ? (
                                    <>
                                        <ProgressBar label="Mañana (06-12)" value={populationStats.timeOfDayStats.morning?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#FFC107" />
                                        <ProgressBar label="Tarde (12-19)" value={populationStats.timeOfDayStats.afternoon?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#2196F3" />
                                        <ProgressBar label="Noche (19-06)" value={populationStats.timeOfDayStats.night?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#673AB7" />
                                    </>
                                ) : <p style={{color:'#999', fontSize:'13px'}}>Sin datos.</p>}
                            </div>

                            <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)', flex:1}}>
                                <h4 style={{marginTop:0, color:'#37474F', marginBottom:'15px'}}>📅 Semana Tipo</h4>
                                {populationStats?.byCategory?.General?.dayDistribution ? (
                                    <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', height:'100px', paddingTop:'10px'}}>
                                        {['mon','tue','wed','thu','fri','sat','sun'].map(day => {
                                            const val = populationStats.byCategory.General.dayDistribution[day] || 0;
                                            const maxVal = 10; 
                                            const h = Math.min(100, (val / maxVal) * 100);
                                            return (
                                                <div key={day} style={{textAlign:'center', width:'100%'}}>
                                                    <div style={{height:`${h || 5}%`, background: val > 0 ? '#009688' : '#eee', width:'60%', margin:'0 auto', borderRadius:'4px 4px 0 0', minHeight:'4px'}}></div>
                                                    <div style={{fontSize:'10px', color:'#666', marginTop:'4px', textTransform:'uppercase'}}>{day.substring(0,1)}</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : <p style={{color:'#999', fontSize:'13px'}}>Esperando datos...</p>}
                            </div>

                        </div>
                    </div>
                </>
            )}
        </div>
      )}
    </div>
  );
}