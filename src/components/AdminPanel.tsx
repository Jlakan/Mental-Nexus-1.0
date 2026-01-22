// src/components/AdminPanel.tsx
import { useState, useEffect } from 'react';
import {
  collection, getDocs, doc, deleteDoc, updateDoc,
  getDoc, query, where, setDoc
} from "firebase/firestore";
import { db, auth } from '../services/firebase';

// Componentes
import AdminCatalogTree from './AdminCatalogTree';
import GameEconomyPanel from './GameEconomyPanel';
import AdminBulkTools from './AdminBulkTools';

// Importaciones de Inteligencia
import { analyzeCatalogBatch } from '../utils/ClinicalEngine';
import { calculateAggregatedStats } from '../utils/PopulationAnalytics';

export default function AdminPanel() {
  // Estado de navegación
  const [activeTab, setActiveTab] = useState<'users' | 'requests' | 'catalog' | 'config' | 'economy' | 'bulk' | 'analytics'>('users');
  
  // Estados de datos
  const [usersList, setUsersList] = useState<any[]>([]);
  const [pendingPros, setPendingPros] = useState<any[]>([]);
  const [globalConfig, setGlobalConfig] = useState({ appDownloadLink: '' });
  
  // Estados de UI
  const [loading, setLoading] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});

  // Estados de Analítica Global
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [populationStats, setPopulationStats] = useState<any>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // --- NUEVOS ESTADOS PARA FILTROS VISUALES ---
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'top' | 'worst'>('all');

  // --- 1. CARGA DE DATOS ---
  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchUsers(), fetchPendingRequests(), fetchConfig()]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAll();
  }, []);

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
      const d = await getDoc(doc(db, "settings", "global"));
      if (d.exists()) setGlobalConfig(d.data() as any);
    } catch (e) { console.error(e); }
  };

  // --- NUEVA LÓGICA: INTELIGENCIA GLOBAL ---
  const handleLoadGlobalAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
        const [snapM, snapR] = await Promise.all([
            getDocs(collection(db, "assigned_missions")),
            getDocs(collection(db, "assigned_routines"))
        ]);

        const missions = snapM.docs.map(d => ({ ...d.data(), id: d.id, type: 'mission' }));
        const routines = snapR.docs.map(d => ({ ...d.data(), id: d.id, type: 'routine' }));
        const allTasks = [...missions, ...routines];

        // Análisis de contenido
        const contentStats = analyzeCatalogBatch(allTasks); 
        
        let statsArray = Array.isArray(contentStats) ? contentStats : Object.values(contentStats);
        // Orden por defecto: Popularidad
        statsArray.sort((a: any, b: any) => b.usageCount - a.usageCount); 

        // Análisis poblacional
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

  // --- LÓGICA DE FILTRADO PARA LA TABLA ---
  const getFilteredStats = () => {
      if (!analyticsData) return [];
      let data = [...analyticsData];

      // 1. Buscador
      if (searchTerm) {
          data = data.filter(d => d.title.toLowerCase().includes(searchTerm.toLowerCase()));
      }

      // 2. Modos de Filtro
      if (filterMode === 'top') {
          // Ordenar por Éxito y tomar 5
          data.sort((a, b) => b.globalSuccessRate - a.globalSuccessRate);
          return data.slice(0, 5);
      } else if (filterMode === 'worst') {
          // Ordenar por Abandono (mayor dropout primero) y tomar 5
          data.sort((a, b) => b.dropoutRate - a.dropoutRate);
          return data.slice(0, 5);
      } else {
          // Modo 'all': Paginación implícita (solo mostramos 20 para no saturar)
          return data.slice(0, 20);
      }
  };

  const displayedStats = getFilteredStats();

  // --- FUNCIÓN DE EXPORTACIÓN A CSV ---
  const handleExportCSV = () => {
    if (!analyticsData || analyticsData.length === 0) {
      alert("No hay datos para exportar. Carga la Inteligencia Global primero.");
      return;
    }

    const headers = [
      "ID_Referencia", "Título de Tarea", "Frecuencia (Uso)", 
      "Tasa de Éxito Global (%)", "Tasa de Abandono (%)", "Carga Cognitiva Est."
    ];

    const csvRows = analyticsData.map((row: any) => {
      const safeTitle = row.title ? `"${row.title.replace(/"/g, '""')}"` : "Sin Título";
      return [
        row.catalogId, safeTitle, row.usageCount,
        row.globalSuccessRate.toFixed(2), row.dropoutRate.toFixed(2), row.workloadImpact
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

  // --- LÓGICA DE ACCIONES ---
  const handleAuthorize = async (proUid: string) => {
    if (!window.confirm("¿Autorizar a este profesional?")) return;
    try {
      await updateDoc(doc(db, "professionals", proUid), { isAuthorized: true });
      await updateDoc(doc(db, "users", proUid), { role: 'pro' });
      alert("Profesional autorizado correctamente.");
      fetchAll();
    } catch (e) { console.error(e); alert("Error al autorizar."); }
  };

  const handleDelete = async (uid: string, role: string) => {
    if (!window.confirm("¿Seguro que deseas eliminar este usuario y todos sus datos vinculados?")) return;
    try {
        if (role === 'pro') await deleteDoc(doc(db, "professionals", uid));
        else if (role === 'patient' || role === 'user') try { await deleteDoc(doc(db, "patients", uid)); } catch (err) {}
        await deleteDoc(doc(db, "users", uid));
        alert("Usuario eliminado correctamente");
        fetchAll();
    } catch (e) { console.error(e); alert("Error al eliminar"); }
  };

  const handleEditClick = async (user: any) => {
    let extraData = {};
    try {
      if (user.role === 'pro') {
        const snap = await getDoc(doc(db, 'professionals', user.uid));
        if (snap.exists()) extraData = snap.data();
      } else if (user.role === 'patient') {
        const snap = await getDoc(doc(db, 'patients', user.uid));
        if (snap.exists()) extraData = snap.data();
      }
    } catch (e) { console.log("No extra data found"); }
    setEditForm({ ...user, ...extraData });
    setEditingUser(user);
  };

  const saveEdit = async () => {
    try {
        await updateDoc(doc(db, "users", editingUser.uid), {
            displayName: editForm.displayName, role: editForm.role, email: editForm.email
        });
        if (editForm.role === 'pro') {
           const proRef = doc(db, "professionals", editingUser.uid);
           await setDoc(proRef, { fullName: editForm.displayName, email: editForm.email }, { merge: true });
        }
        setEditingUser(null); alert("Usuario actualizado"); fetchAll();
    } catch (e) { console.error(e); alert("Error al actualizar"); }
  };

  const saveConfig = async () => {
    setSavingConfig(true);
    await setDoc(doc(db, "settings", "global"), globalConfig, { merge: true });
    setSavingConfig(false); alert("Configuración guardada");
  };

  // --- HELPERS VISUALES ---
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

  // --- RENDERIZADO ---
  const btnStyle = (active: boolean) => ({
    padding: '10px 15px', cursor: 'pointer', border: 'none', borderRadius: '5px',
    background: active ? '#2196F3' : '#e0e0e0', color: active ? 'white' : '#333',
    fontWeight: 'bold', fontSize: '14px'
  });

  return (
    <div style={{ padding: '20px', fontFamily:'sans-serif', position:'relative', background:'#F5F7FA', minHeight:'100vh' }}>
     
      {/* HEADER */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
        <h2 style={{color:'#263238', margin:0}}>Panel de Administración</h2>
        <button onClick={() => auth.signOut()} style={{padding:'8px 15px', background:'#f44336', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>Cerrar Sesión</button>
      </div>
     
      {/* NAVEGACIÓN */}
      <div style={{ marginBottom: '20px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
        <button onClick={() => setActiveTab('users')} style={btnStyle(activeTab === 'users')}>👥 Usuarios</button>
        <button onClick={() => setActiveTab('requests')} style={btnStyle(activeTab === 'requests')}>📩 Solicitudes</button>
        <button onClick={() => setActiveTab('catalog')} style={btnStyle(activeTab === 'catalog')}>📚 Catálogo</button>
        <button onClick={() => setActiveTab('economy')} style={btnStyle(activeTab === 'economy')}>💎 Economía</button>
        <button onClick={() => setActiveTab('config')} style={btnStyle(activeTab === 'config')}>⚙️ Config</button>
        <button onClick={() => setActiveTab('bulk')} style={{...btnStyle(activeTab === 'bulk'), background: activeTab === 'bulk' ? '#673AB7' : '#ddd', color: activeTab === 'bulk' ? 'white' : 'black'}}>📦 Carga Masiva</button>
        <button onClick={() => { setActiveTab('analytics'); handleLoadGlobalAnalytics(); }} style={{...btnStyle(activeTab === 'analytics'), background: activeTab === 'analytics' ? '#009688' : '#ddd', color: activeTab === 'analytics' ? 'white' : 'black'}}>📈 Inteligencia Global</button>
      </div>

      <hr style={{borderColor:'#ddd', marginBottom:'20px'}} />

      {/* MODAL EDIT USER */}
      {editingUser && (
        <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', display:'flex', justifyContent:'center', alignItems:'center', zIndex:1000}}>
            <div style={{background:'white', padding:'25px', borderRadius:'8px', width:'400px', maxWidth:'90%'}}>
                <h3>Editar Usuario</h3>
                <label style={{display:'block', marginBottom:'10px'}}>Nombre: <input type="text" value={editForm.displayName||''} onChange={e=>setEditForm({...editForm, displayName:e.target.value})} style={{width:'100%', padding:'8px'}}/></label>
                <label style={{display:'block', marginBottom:'10px'}}>Email: <input type="text" value={editForm.email||''} onChange={e=>setEditForm({...editForm, email:e.target.value})} style={{width:'100%', padding:'8px'}}/></label>
                <label style={{display:'block', marginBottom:'20px'}}>Rol: 
                    <select value={editForm.role||'user'} onChange={e=>setEditForm({...editForm, role:e.target.value})} style={{width:'100%', padding:'8px'}}>
                        <option value="user">Usuario</option><option value="pro">Profesional</option><option value="admin">Admin</option>
                    </select>
                </label>
                <div style={{display:'flex', justifyContent:'flex-end', gap:'10px'}}>
                    <button onClick={()=>setEditingUser(null)} style={{padding:'8px', background:'#ddd', border:'none', borderRadius:'4px'}}>Cancelar</button>
                    <button onClick={saveEdit} style={{padding:'8px', background:'#2196F3', color:'white', border:'none', borderRadius:'4px'}}>Guardar</button>
                </div>
            </div>
        </div>
      )}

      {/* --- VISTAS --- */}

      {activeTab === 'config' && (
        <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
          <h3>Configuración Global</h3>
          <label>Link App: <input value={globalConfig.appDownloadLink} onChange={e => setGlobalConfig({...globalConfig, appDownloadLink: e.target.value})} style={{width:'100%', padding:'8px'}}/></label>
          <button onClick={saveConfig} disabled={savingConfig} style={{marginTop:'10px', padding:'10px', background:'#4CAF50', color:'white', border:'none', borderRadius:'4px'}}>{savingConfig ? '...' : 'Guardar'}</button>
        </div>
      )}

      {activeTab === 'requests' && (
         <table border={1} style={{width:'100%', borderCollapse:'collapse', background:'white'}}>
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
        <div style={{background:'white', borderRadius:'8px', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
            <table style={{width:'100%', borderCollapse:'collapse'}}>
            <thead><tr style={{background:'#f5f5f5', textAlign:'left'}}>
                <th style={{padding:'12px'}}>Usuario</th><th style={{padding:'12px'}}>Rol</th><th style={{padding:'12px'}}>Acciones</th>
            </tr></thead>
            <tbody>
            {usersList.map(u => (
                <tr key={u.uid} style={{borderBottom:'1px solid #eee'}}>
                <td style={{padding:'12px'}}><strong>{u.displayName}</strong><br/><small style={{color:'#666'}}>{u.email}</small></td>
                <td style={{padding:'12px'}}><span style={{padding:'4px 8px', borderRadius:'12px', background:u.role==='pro'?'#E3F2FD':'#F3E5F5', color:u.role==='pro'?'#1565C0':'#7B1FA2', fontSize:'12px', fontWeight:'bold'}}>{u.role}</span></td>
                <td style={{padding:'12px'}}>
                    <button onClick={() => handleEditClick(u)} style={{marginRight:'5px', cursor:'pointer', border:'none', background:'none'}}>✏️</button>
                    {u.role !== 'admin' && <button onClick={() => handleDelete(u.uid, u.role)} style={{color:'red', cursor:'pointer', border:'none', background:'none'}}>🗑</button>}
                </td>
                </tr>
            ))}
            </tbody>
            </table>
        </div>
      )}
     
      {activeTab === 'catalog' && <AdminCatalogTree />}
      {activeTab === 'economy' && <GameEconomyPanel />}
      {activeTab === 'bulk' && <AdminBulkTools />}

      {/* --- DASHBOARD INTELIGENCIA GLOBAL --- */}
      {activeTab === 'analytics' && (
        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
            
            {/* CABECERA CON BOTÓN DE DESCARGA */}
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
                    {/* SECCIÓN 1: KPIS SUPERIORES */}
                    <div style={{display:'flex', gap:'15px', flexWrap:'wrap'}}>
                        <StatCard title="Total Usuarios" value={usersList.length} color="#607D8B" icon="👥" />
                        <StatCard title="Pacientes Activos" value={usersList.filter(u => u.role === 'patient').length} color="#4CAF50" icon="❤️" />
                        <StatCard title="Profesionales" value={usersList.filter(u => u.role === 'pro').length} color="#2196F3" icon="🩺" />
                        <StatCard title="Tareas Asignadas" value={analyticsData.reduce((acc:any, curr:any) => acc + curr.usageCount, 0)} color="#FF9800" icon="📝" />
                    </div>

                    <div style={{display:'grid', gridTemplateColumns:'1.5fr 1fr', gap:'20px'}}>
                        
                        {/* SECCIÓN 2: RENDIMIENTO DEL CATÁLOGO (TABLA FILTRABLE) */}
                        <div style={{background:'white', padding:'20px', borderRadius:'8px', boxShadow:'0 1px 3px rgba(0,0,0,0.1)'}}>
                            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px', borderBottom:'2px solid #009688', paddingBottom:'10px'}}>
                                <h4 style={{margin:0, color:'#37474F'}}>🏆 Rendimiento del Contenido</h4>
                            </div>

                            {/* CONTROLES DE FILTRO */}
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

                        {/* SECCIÓN 3: SALUD POBLACIONAL */}
                        <div style={{display:'flex', flexDirection:'column', gap:'20px'}}>
                            
                            {/* Ritmos Circadianos */}
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

                            {/* Distribución Semanal */}
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