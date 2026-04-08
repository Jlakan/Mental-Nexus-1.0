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
import { calculateTagCorrelations } from '../utils/TagCorrelationEngine';

export default function AdminPanel() {
  // Estado de navegación
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'catalog' | 'config' | 'economy' | 'bulk' | 'analytics'>('users');
  
  // Estados de datos
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingPros, setPendingPros] = useState<any[]>([]);
  const [professionalsList, setProfessionalsList] = useState<any[]>([]);
  const [globalConfig, setGlobalConfig] = useState({ appDownloadLink: '' });
  const [dbProfessions, setDbProfessions] = useState<any[]>([]);
  
  // Estados de UI
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [newProfForm, setNewProfForm] = useState({ id: '', name: '' });

  // Estados de Analítica Global
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [populationStats, setPopulationStats] = useState<any>(null);
  const [tagCorrelations, setTagCorrelations] = useState<any[]>([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Estados para filtros de Analítica
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'top' | 'worst'>('all');

  // --- ESTADOS PARA FILTROS DE DIRECTORIO DE USUARIOS ---
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'patient' | 'pro' | 'admin'>('all');
  const [userProFilter, setUserProFilter] = useState<string>('all');
  const [userManualFilter, setUserManualFilter] = useState<'all' | 'app' | 'manual'>('all');

  // Estado para sistema de tags
  const [isInitializingTags, setIsInitializingTags] = useState(false);

  // --- 1. CARGA DE DATOS ---
  const fetchAll = async () => {
    await Promise.all([fetchUsers(), fetchPendingRequests(), fetchConfig(), fetchProfessions()]);
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchProfessions = async () => {
    try {
      const snap = await getDocs(collection(db, "professions"));
      setDbProfessions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error("Error cargando profesiones:", e); }
  };

  const fetchUsers = async () => {
    try {
      const [usersSnap, patientsSnap, prosSnap] = await Promise.all([
        getDocs(collection(db, "users")),
        getDocs(collection(db, "patients")),
        getDocs(collection(db, "professionals"))
      ]);

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

  // --- LÓGICA: GESTIÓN DE PROFESIONES ---
  const handleAddProfession = async () => {
    if (!newProfForm.id || !newProfForm.name) return alert("Por favor llena ambos campos.");
    try {
        await setDoc(doc(db, "professions", newProfForm.id), { name: newProfForm.name, active: true });
        setNewProfForm({ id: '', name: '' });
        alert("Especialidad agregada correctamente.");
        fetchProfessions();
    } catch (error) {
        console.error(error);
        alert("Error al agregar especialidad.");
    }
  };

  const handleToggleProfession = async (id: string, currentActive: boolean) => {
    try {
        const newStatus = currentActive === false ? true : false;
        await updateDoc(doc(db, "professions", id), { active: newStatus });
        fetchProfessions();
    } catch (error) {
        console.error(error);
        alert("Error al cambiar el estado.");
    }
  };

  // --- LÓGICA: INTELIGENCIA GLOBAL ---
  const handleLoadGlobalAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
        const [snapM, snapR] = await Promise.all([
            getDocs(collection(db, "assigned_missions")),
            getDocs(collection(db, "assigned_routines"))
        ]);

        const normalizeTask = (d: any, type: string) => {
            const data = d.data();
            let historyArray = [];
            
            if (Array.isArray(data.completionHistory)) {
                historyArray = data.completionHistory;
            } else if (data.completionHistory && typeof data.completionHistory === 'object') {
                historyArray = Object.values(data.completionHistory);
            }

            return { 
                ...data, 
                id: d.id, 
                type, 
                completionHistory: historyArray 
            } as unknown as Assignment;
        };

        const allTasks = [
          ...snapM.docs.map(d => normalizeTask(d, 'mission')),
          ...snapR.docs.map(d => normalizeTask(d, 'routine'))
        ];

        const contentStats = analyzeCatalogBatch(allTasks as any[]); 
        let statsArray = Array.isArray(contentStats) ? contentStats : Object.values(contentStats);
        statsArray.sort((a: any, b: any) => b.usageCount - a.usageCount); 

        const popStats = calculateAggregatedStats ? calculateAggregatedStats(usersList, allTasks) : {};
        const correlations = calculateTagCorrelations ? calculateTagCorrelations(usersList) : [];

        setAnalyticsData(statsArray);
        setPopulationStats(popStats);
        setTagCorrelations(correlations);

    } catch (error) {
        console.error("Error loading analytics:", error);
        alert("Error al cargar inteligencia global.");
    } finally {
        setLoadingAnalytics(false);
    }
  };

  // --- LÓGICA: INICIALIZAR SISTEMA DE TAGS ---
  const handleInitializeTagsSystem = async () => {
    setIsInitializingTags(true);
    try {
      const batch = writeBatch(db);
      const metadataRef = doc(db, 'system', 'tagsMetadata');
      const metadataSnap = await getDoc(metadataRef);

      if (!metadataSnap.exists()) {
        const initialMetadata: any = {};
        dbProfessions.forEach(p => { initialMetadata[`${p.id}_version`] = 1; });
        if (dbProfessions.length === 0) {
            initialMetadata.psicologia_version = 1;
            initialMetadata.nutricion_version = 1;
            initialMetadata.lenguaje_version = 1;
        }
        batch.set(metadataRef, initialMetadata);
      }

      const professionsToInit = dbProfessions.length > 0 
        ? dbProfessions.map(p => p.id) 
        : ['psicologia', 'nutricion', 'lenguaje'];

      professionsToInit.forEach((profId) => { 
        batch.set(doc(db, 'tagsDictionaries', profId), { tags: [] }, { merge: true }); 
      });

      await batch.commit();
      alert("Sistema de Tags inicializado correctamente para las profesiones.");
    } catch (error) {
      console.error("Error al inicializar el sistema de tags:", error);
      alert("Error al inicializar el sistema de tags.");
    } finally {
      setIsInitializingTags(false);
    }
  };

  // --- LÓGICA DE FILTRADO PARA LA TABLA ANALÍTICA ---
  const getFilteredStats = () => {
      if (!analyticsData) return [];
      let data = [...analyticsData];
      
      if (searchTerm) {
          data = data.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));
      }
      
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

  // --- LÓGICA DE FILTRADO DEL DIRECTORIO DE USUARIOS ---
  const getFilteredUsers = () => {
    return usersList.filter(u => {
      if (userSearchTerm) {
        const term = userSearchTerm.toLowerCase();
        const matchName = u.displayName?.toLowerCase().includes(term);
        const matchEmail = u.email?.toLowerCase().includes(term);
        if (!matchName && !matchEmail) return false;
      }
      if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
      if (userManualFilter === 'manual' && !u.isManual) return false;
      if (userManualFilter === 'app' && u.isManual) return false;

      if (userProFilter !== 'all') {
        if (userProFilter === 'unassigned') {
          if (u.profName !== 'Sin asignar' && u.role === 'patient') return false;
          if (u.role !== 'patient' && !u.isManual) return false;
        } else {
          const isLinked = u.linkedProfessionalId === userProFilter || (u.careTeam && u.careTeam[userProFilter]);
          if (!isLinked) return false;
        }
      }
      return true;
    });
  };

  const displayedUsers = getFilteredUsers();

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
            if (extraData.linkedProfessionalId) {
                currentProId = extraData.linkedProfessionalId;
            } else if (extraData.careTeam) {
                currentProId = Object.keys(extraData.careTeam)[0];
            }
        }
      }
    } catch (e) { console.log("No extra data found"); }
    
    setEditForm({ ...user, ...extraData, linkedProfessionalId: currentProId });
    setEditingUser(user);
  };

  const saveEdit = async () => {
    try {
        const isPatient = editForm.role === 'patient' || editingUser.isManual;
        const patientUpdates: any = { fullName: editForm.displayName, role: editForm.role, email: editForm.email };
        const userUpdates: any = { displayName: editForm.displayName, role: editForm.role, email: editForm.email };

        if (isPatient && editForm.linkedProfessionalId) {
            patientUpdates.linkedProfessionalId = editForm.linkedProfessionalId;
            patientUpdates[`careTeam.${editForm.linkedProfessionalId}.status`] = 'active';
            userUpdates.linkedProfessionalId = editForm.linkedProfessionalId;
            userUpdates[`careTeam.${editForm.linkedProfessionalId}.status`] = 'active';
        }

        if (editingUser.isManual) {
            await updateDoc(doc(db, "patients", editingUser.uid), patientUpdates);
        } else {
            await updateDoc(doc(db, "users", editingUser.uid), userUpdates);
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
    } catch (e) { 
        console.error(e); 
        alert("Error al actualizar"); 
    }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    await setDoc(doc(db, "settings", "global"), globalConfig, { merge: true });
    setSavingConfig(false); 
    alert("Configuración guardada");
  };

  // --- HELPERS VISUALES ---
  const StatCard = ({ title, value, icon, colorHex }: any) => (
    <div style={{background:'white', padding:'20px', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', flex:1, display:'flex', alignItems:'center', gap:'15px', minWidth: '220px'}}>
       <div style={{background: colorHex, width:'45px', height:'45px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', color:'white', boxShadow: `0 4px 10px ${colorHex}40`}}>
           {icon}
       </div>
       <div>
          <div style={{fontSize:'11px', color:'#64748B', textTransform:'uppercase', fontWeight:'bold', letterSpacing: '0.5px'}}>{title}</div>
          <div style={{fontSize:'28px', fontWeight:'900', color:'#1E293B', marginTop: '2px'}}>{value}</div>
       </div>
    </div>
  );

  const ProgressBar = ({ label, value, max, color }: any) => {
      const percentage = max > 0 ? (value / max) * 100 : 0;
      return (
          <div style={{marginBottom:'15px'}}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px', marginBottom:'6px'}}>
                  <span style={{color:'#64748B', fontWeight: '500'}}>{label}</span>
                  <span style={{fontWeight:'bold', color: '#1E293B'}}>{value} ({Math.round(percentage)}%)</span>
              </div>
              <div style={{width:'100%', height:'8px', background:'#F1F5F9', borderRadius:'4px', overflow:'hidden'}}>
                  <div style={{width:`${percentage}%`, height:'100%', background:color, transition:'width 0.5s ease', borderRadius:'4px'}}></div>
              </div>
          </div>
      )
  };

  const modalInputStyle = { width:'100%', padding:'10px', marginTop: '6px', border: '1px solid #334155', borderRadius: '6px', color: '#fff', boxSizing: 'border-box' as const, background: '#0B1121', outline: 'none', fontSize: '14px' };

  return (
    <div style={{ padding: '20px', fontFamily:'sans-serif', position:'relative', background:'#0B1121', minHeight:'100vh', color: '#fff' }}>
     
      {/* HEADER DINÁMICO */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ color: '#00E5FF', margin: 0, textTransform: 'uppercase', letterSpacing: '2px', fontSize: '18px' }}>
          PANEL DE CONTROL NEXUS
        </h2>
        <div style={{ display: 'flex', gap: '15px' }}>
          <button 
            onClick={handleInitializeTagsSystem} 
            disabled={isInitializingTags} 
            style={{padding:'10px 20px', background:'#F59E0B', color:'white', border:'none', borderRadius:'6px', cursor: isInitializingTags ? 'not-allowed' : 'pointer', fontWeight:'bold', fontSize: '13px'}}
          >
            {isInitializingTags ? 'Inicializando...' : 'Inicializar Sistema Tags'}
          </button>
          <button onClick={() => auth.signOut()} style={{ background: '#EF4444', color: 'white', border: 'none', borderRadius: '6px', padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
              Cerrar Sesión
          </button>
        </div>
      </div>
     
      {/* NAVEGACIÓN ESTILO TABS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap', borderBottom: '1px solid #1E293B', paddingBottom: '15px' }}>
        {[
          { id: 'users', label: '👥 USUARIOS' },
          { id: 'requests', label: '📩 SOLICITUDES' },
          { id: 'catalog', label: '📚 CATÁLOGO' },
          { id: 'economy', label: '💎 ECONOMÍA' },
          { id: 'config', label: '⚙️ CONFIG' },
          { id: 'bulk', label: '📦 CARGA MASIVA' },
          { id: 'analytics', label: '📈 INTELIGENCIA GLOBAL' }
        ].map((tab) => (
          <button 
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id as any);
              if (tab.id === 'analytics') handleLoadGlobalAnalytics();
            }}
            style={{
              padding: '10px 18px', borderRadius: '6px', border: activeTab === tab.id ? '1px solid #7DD3FC' : '1px solid transparent', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px',
              background: activeTab === tab.id ? '#7DD3FC' : '#1E293B',
              color: activeTab === tab.id ? '#0B1121' : '#94A3B8',
              boxShadow: activeTab === tab.id ? '0 0 10px rgba(125, 211, 252, 0.3)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* --- MODAL EDIT USER --- */}
      {editingUser && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(11, 17, 33, 0.8)', backdropFilter:'blur(4px)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}}>
            <div style={{ background:'#151E32', padding:'30px', borderRadius:'12px', width:'400px', maxWidth:'90%', border: '1px solid #334155', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', color: '#fff' }}>
                <h3 style={{ color:'#00E5FF', marginTop: 0, borderBottom: '1px solid #334155', paddingBottom: '15px', marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '1px' }}>✏️ Editar Usuario</h3>
                <label style={{display:'block', marginBottom:'15px', color: '#94A3B8', fontSize:'13px'}}>Nombre Completo: <input type="text" value={editForm.displayName||''} onChange={e=>setEditForm({...editForm, displayName:e.target.value})} style={modalInputStyle} /></label>
                <label style={{display:'block', marginBottom:'15px', color: '#94A3B8', fontSize:'13px'}}>Correo Electrónico: <input type="text" value={editForm.email||''} onChange={e=>setEditForm({...editForm, email:e.target.value})} style={modalInputStyle} /></label>
                <label style={{display:'block', marginBottom:'20px', color: '#94A3B8', fontSize:'13px'}}>Rol de Sistema: 
                    <select value={editForm.role||'user'} onChange={e=>setEditForm({...editForm, role:e.target.value})} style={{...modalInputStyle, cursor: 'pointer'}}>
                        <option value="user">Usuario Común</option><option value="patient">Paciente</option><option value="pro">Profesional</option><option value="admin">Administrador</option>
                    </select>
                </label>
                {(editForm.role === 'patient' || editingUser?.isManual) && (
                    <div style={{background:'#0B1121', padding:'15px', borderRadius:'8px', border:'1px solid #334155', marginBottom:'25px'}}>
                        <label style={{display:'block', color: '#00E5FF', fontSize:'13px', fontWeight:'bold', marginBottom:'5px'}}>🩺 Vincular a Profesional: </label>
                        <select value={editForm.linkedProfessionalId || ''} onChange={e=>setEditForm({...editForm, linkedProfessionalId:e.target.value})} style={{...modalInputStyle, background:'#151E32', border:'1px solid #00E5FF'}}>
                            <option value="">-- Sin Asignar --</option>
                            {professionalsList.map(pro => <option key={pro.uid} value={pro.uid}>{pro.fullName || pro.displayName || 'Profesional Sin Nombre'}</option>)}
                        </select>
                        <div style={{fontSize:'11px', color:'#64748B', marginTop:'8px'}}>Esto integrará al paciente en la agenda del profesional.</div>
                    </div>
                )}
                <div style={{display:'flex', justifyContent:'flex-end', gap:'15px', marginTop: '10px'}}>
                    <button onClick={()=>setEditingUser(null)} style={{ padding:'10px 20px', background:'#1E293B', color:'#94A3B8', border:'none', borderRadius:'6px', fontWeight: 'bold', cursor: 'pointer' }}>Cancelar</button>
                    <button onClick={saveEdit} style={{ padding:'10px 20px', background:'#00E5FF', color:'#0B1121', border:'none', borderRadius:'6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0, 229, 255, 0.2)' }}>Guardar Cambios</button>
                </div>
            </div>
        </div>
      )}

      {/* --- VISTAS --- */}

      {activeTab === 'config' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{background:'#151E32', padding:'25px', borderRadius:'12px', boxShadow:'0 4px 10px rgba(0,0,0,0.2)'}}>
            <h3 style={{color: '#00E5FF', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px'}}>Configuración Global</h3>
            <label style={{color: '#94A3B8', display: 'block', marginBottom: '10px'}}>
                Enlace de Descarga de la App (Link App): 
                <input 
                  value={globalConfig.appDownloadLink} 
                  onChange={e => setGlobalConfig({...globalConfig, appDownloadLink: e.target.value})} 
                  style={modalInputStyle}
                />
            </label>
            <button 
              onClick={saveConfig} 
              disabled={savingConfig} 
              style={{ marginTop:'10px', padding:'10px 20px', background:'#22C55E', color:'white', border:'none', borderRadius:'6px', fontWeight: 'bold', cursor: savingConfig ? 'not-allowed' : 'pointer' }}
            >
                {savingConfig ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>

          {/* GESTOR DE PROFESIONES */}
          <div style={{background:'#151E32', padding:'25px', borderRadius:'12px', boxShadow:'0 4px 10px rgba(0,0,0,0.2)'}}>
            <h3 style={{color: '#00E5FF', marginTop: 0, textTransform: 'uppercase', letterSpacing: '1px'}}>Especialidades Clínicas (Profesiones)</h3>
            
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '5px' }}>ID Interno (ej. terapia_ocupacional)</label>
                <input 
                  value={newProfForm.id} 
                  onChange={e => setNewProfForm({...newProfForm, id: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')})} 
                  style={{...modalInputStyle, marginTop: 0}} 
                  placeholder="Solo minúsculas y guión bajo" 
                />
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ color: '#94A3B8', fontSize: '13px', display: 'block', marginBottom: '5px' }}>Nombre Visible (ej. Terapia Ocupacional)</label>
                <input 
                  value={newProfForm.name} 
                  onChange={e => setNewProfForm({...newProfForm, name: e.target.value})} 
                  style={{...modalInputStyle, marginTop: 0}} 
                  placeholder="Nombre para el público" 
                />
              </div>
              <button 
                  onClick={handleAddProfession} 
                  style={{ padding:'10px 20px', background:'#3B82F6', color:'white', border:'none', borderRadius:'6px', fontWeight: 'bold', cursor: 'pointer', height: '39px' }}
              >
                  ➕ Agregar
              </button>
            </div>
            
            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px', color: '#fff', border: '1px solid #334155'}}>
              <thead style={{background:'#0B1121'}}>
                <tr>
                    <th style={{padding:'12px', textAlign:'left', color:'#94A3B8', borderBottom: '1px solid #334155'}}>ID Interno (Base de datos)</th>
                    <th style={{padding:'12px', textAlign:'left', color:'#94A3B8', borderBottom: '1px solid #334155'}}>Nombre Público</th>
                    <th style={{padding:'12px', textAlign:'center', color:'#94A3B8', borderBottom: '1px solid #334155'}}>Estado (Soft Delete)</th>
                </tr>
              </thead>
              <tbody>
                {dbProfessions.map(p => (
                  <tr key={p.id} style={{borderBottom:'1px solid #1E293B'}}>
                    <td style={{padding:'12px', color: '#00E5FF'}}>{p.id}</td>
                    <td style={{padding:'12px', fontWeight: 'bold'}}>{p.name}</td>
                    <td style={{padding:'12px', textAlign:'center'}}>
                      <button 
                          onClick={() => handleToggleProfession(p.id, p.active)} 
                          style={{
                              padding: '6px 12px', 
                              borderRadius: '20px', 
                              fontWeight: 'bold', 
                              cursor: 'pointer', 
                              background: p.active !== false ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)', 
                              color: p.active !== false ? '#22C55E' : '#EF4444',
                              border: `1px solid ${p.active !== false ? '#22C55E' : '#EF4444'}`
                          }}
                      >
                        {p.active !== false ? '✅ Activo' : '❌ Inactivo'}
                      </button>
                    </td>
                  </tr>
                ))}
                {dbProfessions.length === 0 && (
                    <tr><td colSpan={3} style={{textAlign: 'center', padding: '30px', color: '#94A3B8'}}>No hay profesiones registradas en la base de datos.</td></tr>
                )}
              </tbody>
            </table>
            <p style={{color: '#64748B', fontSize: '12px', marginTop: '15px'}}>* Desactivar una profesión la oculta en el registro de nuevos profesionales, pero preserva el historial clínico de los existentes.</p>
          </div>
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, color: '#00E5FF', textTransform: 'uppercase', letterSpacing: '1px' }}>Directorio Global</h3>
            <span style={{color: '#94A3B8', fontSize: '14px'}}>Total de registros: {displayedUsers.length}</span>
          </div>
          <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', flexWrap: 'wrap', background: '#151E32', padding: '15px', borderRadius: '8px', border: '1px solid #334155' }}>
            <input placeholder="🔍 Buscar nombre o correo..." value={userSearchTerm} onChange={(e) => setUserSearchTerm(e.target.value)} style={{ flex: 1, minWidth: '200px', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0B1121', color: '#fff' }} />
            <select value={userRoleFilter} onChange={e => { setUserRoleFilter(e.target.value as any); if (e.target.value === 'pro' || e.target.value === 'admin') { setUserProFilter('all'); setUserManualFilter('all'); } }} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0B1121', color: '#fff', cursor: 'pointer' }}>
                <option value="all">Todos los Roles</option><option value="patient">Pacientes</option><option value="pro">Profesionales</option><option value="admin">Administradores</option>
            </select>
            {(userRoleFilter === 'all' || userRoleFilter === 'patient') && (
                <select value={userProFilter} onChange={e => setUserProFilter(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0B1121', color: '#fff', cursor: 'pointer' }}>
                    <option value="all">Cualquier Profesional</option><option value="unassigned">⚠️ Pacientes Sin Asignar</option>
                    {professionalsList.map(p => <option key={p.uid} value={p.uid}>🩺 {p.fullName || p.displayName}</option>)}
                </select>
            )}
            {(userRoleFilter === 'all' || userRoleFilter === 'patient') && (
                <select value={userManualFilter} onChange={e => setUserManualFilter(e.target.value as any)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0B1121', color: '#fff', cursor: 'pointer' }}>
                    <option value="all">Cualquier Registro</option><option value="app">📱 Usuarios de App</option><option value="manual">📝 Registros Manuales</option>
                </select>
             )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {displayedUsers.map(u => (
              <div key={u.uid} style={{ background: '#151E32', border: '1px solid #334155', borderRadius: '12px', padding: '20px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', right: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => handleEditClick(u)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }} title="Editar">✏️</button>
                  {u.role !== 'admin' && <button onClick={() => handleDelete(u)} style={{ background: 'none', border: 'none', color: '#FF5252', cursor: 'pointer', fontSize: '16px' }} title="Eliminar">🗑</button>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 'bold', color: '#94A3B8' }}>
                    {u.displayName?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '16px', color: '#00E5FF' }}>{u.displayName}</div>
                    <div style={{ fontSize: '12px', color: '#94A3B8' }}>{u.email || 'Sin correo asociado'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '15px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '12px', background: u.role === 'pro' ? 'rgba(33, 150, 243, 0.15)' : 'rgba(156, 39, 176, 0.15)', color: u.role === 'pro' ? '#64B5F6' : '#CE93D8', fontSize: '11px', fontWeight: 'bold', border: `1px solid ${u.role === 'pro' ? '#1976D2' : '#8E24AA'}` }}>{u.role?.toUpperCase() || 'PACIENTE'}</span>
                  {u.isManual && <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255, 152, 0, 0.15)', color: '#FFB74D', fontSize: '11px', fontWeight: 'bold', border: '1px solid #F57C00' }}>📝 MANUAL</span>}
                </div>
                <div style={{ borderTop: '1px solid #334155', paddingTop: '15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ display: 'block', fontSize: '10px', color: '#64748B', textTransform: 'uppercase', marginBottom: '4px' }}>Profesional a cargo</span>
                    <span style={{ fontSize: '13px', color: '#E2E8F0', fontWeight: 'bold' }}>{u.profName === 'Sin asignar' ? '⚠️ Sin Asignar' : `🩺 ${u.profName}`}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {displayedUsers.length === 0 && <div style={{ color: '#94A3B8', textAlign: 'center', padding: '40px', background: '#151E32', borderRadius: '8px', border: '1px dashed #334155' }}>No se encontraron usuarios...</div>}
        </div>
      )}
     
      {activeTab === 'catalog' && <AdminCatalogTree />}
      {activeTab === 'economy' && <GameEconomyPanel />}
      {activeTab === 'bulk' && <AdminBulkTools />}

      {/* --- DASHBOARD INTELIGENCIA GLOBAL --- */}
      {activeTab === 'analytics' && (
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
               <h3 style={{color:'#64748B', margin:0, display: 'flex', alignItems: 'center', gap: '8px'}}>
                 <span style={{fontSize: '20px'}}>📊</span> Panel de Inteligencia
               </h3>
               <button onClick={handleExportCSV} disabled={loadingAnalytics || !analyticsData}
                 style={{
                    padding:'10px 20px', background: analyticsData ? '#22C55E' : '#475569',
                    color: 'white', border:'none', borderRadius:'6px', 
                    cursor: analyticsData ? 'pointer' : 'not-allowed', fontWeight:'bold',
                    display:'flex', alignItems:'center', gap:'8px',
                    boxShadow: analyticsData ? '0 4px 6px rgba(34, 197, 94, 0.2)' : 'none',
                    fontSize: '13px'
                 }}>
                 📥 Descargar Excel (.csv)
               </button>
            </div>

            {loadingAnalytics && <div style={{textAlign:'center', padding:'40px', color:'#94A3B8'}}>🔄 Analizando millones de puntos de datos clínicos...</div>}

            {!loadingAnalytics && analyticsData && (
                <>
                    <div style={{display:'flex', gap:'15px', flexWrap:'wrap', color: 'black'}}>
                        <StatCard title="TOTAL USUARIOS" value={usersList.length} icon="👥" colorHex="#64748B" />
                        <StatCard title="PACIENTES ACTIVOS" value={usersList.filter(u => u.role === 'patient' || u.isManual).length} icon="❤️" colorHex="#22C55E" />
                        <StatCard title="PROFESIONALES" value={usersList.filter(u => u.role === 'pro').length} icon="🩺" colorHex="#3B82F6" />
                        <StatCard title="TAREAS ASIGNADAS" value={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} icon="📝" colorHex="#F59E0B" />
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'20px', color: 'black'}}>
                        
                        <div style={{background:'white', padding:'25px', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                            <h4 style={{margin:0, color:'#1E293B', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                              🏆 Rendimiento del Contenido
                            </h4>
                            <div style={{width: '100%', height: '2px', background: '#0D9488', marginTop: '15px', marginBottom: '20px'}}></div>

                            <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                                <div style={{position: 'relative', flex: 1}}>
                                    <span style={{position: 'absolute', left: '12px', top: '10px', color: '#94A3B8'}}>🔍</span>
                                    <input 
                                        placeholder="Buscar tarea..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        style={{padding:'10px 10px 10px 35px', borderRadius:'6px', border:'1px solid #CBD5E1', width: '100%', boxSizing: 'border-box', color: '#334155'}}
                                    />
                                </div>
                                <select 
                                    value={filterMode}
                                    onChange={e => setFilterMode(e.target.value as any)} 
                                    style={{padding:'10px', borderRadius:'6px', border:'1px solid #0D9488', fontWeight:'bold', color:'#0D9488', background: 'white', cursor: 'pointer', minWidth: '200px'}}
                                >
                                    <option value="all">Ver Todas (Recientes)</option>
                                    <option value="top">🔥 Top 5 Éxito</option>
                                    <option value="worst">🚨 Top 5 Riesgo</option>
                                </select>
                            </div>

                            <div style={{maxHeight:'350px', overflowY:'auto'}}>
                                <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                                    <thead style={{background:'#F8FAFC', position:'sticky', top:0}}>
                                        <tr>
                                            <th style={{padding:'12px', textAlign:'left', color:'#64748B', fontWeight: 'bold'}}>Título de la Tarea</th>
                                            <th style={{padding:'12px', textAlign:'center', color:'#64748B', fontWeight: 'bold'}}>Frecuencia</th>
                                            <th style={{padding:'12px', textAlign:'center', color:'#64748B', fontWeight: 'bold'}}>Efectividad</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {displayedStats.map((stat: any, i: number) => (
                                            <tr key={i} style={{borderBottom:'1px solid #F1F5F9'}}>
                                                <td style={{padding:'14px 10px', fontWeight:'600', color: '#334155'}}>{stat.title}</td>
                                                <td style={{padding:'14px 10px', textAlign:'center'}}>
                                                    <span style={{ color:'#10B981', fontSize:'13px', fontWeight:'bold'}}>
                                                        {stat.usageCount}
                                                    </span>
                                                </td>
                                                <td style={{padding:'14px 10px', textAlign:'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'}}>
                                                    <div style={{width:'80px', height:'6px', background:'#F1F5F9', borderRadius:'3px', overflow: 'hidden'}}>
                                                        <div style={{width:`${stat.globalSuccessRate}%`, height:'100%', background: stat.globalSuccessRate > 70 ? '#22C55E' : '#F59E0B', borderRadius:'3px'}}></div>
                                                    </div>
                                                    <span style={{fontSize:'12px', color:'#64748B', fontWeight: 'bold', width: '30px', textAlign: 'right'}}>{stat.globalSuccessRate.toFixed(0)}%</span>
                                                </td>
                                            </tr>
                                        ))}
                                        {displayedStats.length === 0 && (
                                            <tr><td colSpan={3} style={{padding:'30px', textAlign:'center', color:'#94A3B8'}}>No se encontraron tareas.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                            
                            <div style={{background:'white', padding:'25px', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)'}}>
                                <h4 style={{marginTop:0, color:'#1E293B', marginBottom:'20px', fontSize: '15px'}}>⏰ Ritmo Circadiano</h4>
                                {populationStats?.timeOfDayStats ? (
                                    <div style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                                        <ProgressBar label="Mañana (06-12)" value={populationStats.timeOfDayStats.morning?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#F59E0B" />
                                        <ProgressBar label="Tarde (12-19)" value={populationStats.timeOfDayStats.afternoon?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#3B82F6" />
                                        <ProgressBar label="Noche (19-06)" value={populationStats.timeOfDayStats.night?.completed || 0} max={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#6366F1" />
                                    </div>
                                ) : <p style={{color:'#94A3B8', fontSize:'13px'}}>Sin datos calculados.</p>}
                            </div>

                            <div style={{background:'white', padding:'25px', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', flex:1}}>
                                <h4 style={{marginTop:0, color:'#1E293B', marginBottom:'20px', fontSize: '15px'}}>📅 Semana Tipo</h4>
                                {populationStats?.byCategory?.General?.dayDistribution ? (
                                    <div style={{display:'flex', alignItems:'flex-end', justifyContent:'space-between', height:'120px', paddingTop:'10px'}}>
                                        {['mon','tue','wed','thu','fri','sat','sun'].map(day => {
                                            const val = populationStats.byCategory.General.dayDistribution[day] || 0;
                                            const maxVal = Math.max(10, ...Object.values(populationStats.byCategory.General.dayDistribution as Record<string, number>)); 
                                            const h = Math.min(100, (val / maxVal) * 100);
                                            return (
                                                <div key={day} style={{textAlign:'center', width:'100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%'}}>
                                                    <div style={{height:`${h || 2}%`, background: val > 0 ? '#3B82F6' : '#F1F5F9', width:'24px', borderRadius:'4px 4px 0 0', minHeight:'4px', transition: 'height 0.5s'}}></div>
                                                    <div style={{fontSize:'11px', color:'#64748B', marginTop:'8px', textTransform:'uppercase', fontWeight: 'bold'}}>{day.substring(0,1)}</div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : <p style={{color:'#94A3B8', fontSize:'13px'}}>Esperando agregación de datos...</p>}
                            </div>
                        </div>
                    </div>

                    <div style={{background:'white', padding:'25px', borderRadius:'10px', boxShadow:'0 2px 5px rgba(0,0,0,0.05)', marginTop: '20px', color: 'black'}}>
                        <h4 style={{margin:0, color:'#1E293B', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '8px'}}>
                            🔥 Hallazgos Clínicos (Correlaciones de Etiquetas)
                        </h4>
                        <div style={{width: '100%', height: '2px', background: '#9C27B0', marginTop: '15px', marginBottom: '20px'}}></div>
                        
                        <div style={{maxHeight:'300px', overflowY:'auto'}}>
                            <table style={{width:'100%', borderCollapse:'collapse', fontSize:'13px'}}>
                                <thead style={{background:'#F8FAFC', position:'sticky', top:0}}>
                                    <tr>
                                        <th style={{padding:'12px', textAlign:'left', color:'#64748B', fontWeight: 'bold'}}>Cruce de Etiquetas Detectado</th>
                                        <th style={{padding:'12px', textAlign:'center', color:'#64748B', fontWeight: 'bold'}}>Pacientes con esta combinación</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tagCorrelations && tagCorrelations.length > 0 ? (
                                        tagCorrelations.slice(0, 15).map((corr: any, i: number) => (
                                            <tr key={i} style={{borderBottom:'1px solid #F1F5F9'}}>
                                                <td style={{padding:'14px 10px', fontWeight:'500', display:'flex', alignItems:'center', gap:'10px'}}>
                                                    {corr.pairName.split(' 🔗 ').map((tag: string, idx: number) => (
                                                        <span key={idx} style={{background:'#F3E5F5', color:'#7B1FA2', padding:'4px 10px', borderRadius:'6px', fontSize:'12px', fontWeight: 'bold', border:'1px solid #E1BEE7'}}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </td>
                                                <td style={{padding:'14px 10px', textAlign:'center'}}>
                                                    <span style={{background:'#ECFCCB', color:'#16A34A', padding:'4px 12px', borderRadius:'12px', fontSize:'13px', fontWeight:'900'}}>
                                                        {corr.count}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr><td colSpan={2} style={{padding:'30px', textAlign:'center', color:'#94A3B8'}}>Aún no hay suficientes datos para generar correlaciones clínicas.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
      )}
    </div>
  );
}