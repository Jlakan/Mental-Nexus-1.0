// src/components/AdminCatalogTree.tsx
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, addDoc, deleteDoc, setDoc } from "firebase/firestore";
import { db } from '../services/firebase';

// Interfaces para el manejo de datos
interface CatalogItem {
  id: string;
  name: string; // CORRECCIÓN: Quitamos el '?' para hacerlo obligatorio y evitar errores de tipo
  title?: string;
  _collection?: string;
  typeLabel?: string;
  [key:string]: any
}

export default function AdminCatalogTree() {
  // --- ESTADOS DE NAVEGACIÓN (Breadcrumbs) ---
  const [professions, setProfessions] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<CatalogItem[]>([]);
  const [subcategories, setSubcategories] = useState<CatalogItem[]>([]);
  const [tasks, setTasks] = useState<CatalogItem[]>([]);

  // Selecciones actuales
  const [selProf, setSelProf] = useState<{id: string, name: string} | null>(null);
  const [selCat, setSelCat] = useState<{id: string, name: string} | null>(null);
  const [selSub, setSelSub] = useState<{id: string, name: string} | null>(null);

  // --- ESTADOS DE FORMULARIO ---
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'mission' | 'routine'>('mission');
  const [loading, setLoading] = useState(false);

  // 1. CARGA DE DATOS (CASCADA)
  // A. Carga Inicial (Profesiones)
  useEffect(() => {
    getDocs(collection(db, "professions")).then(snap =>
      setProfessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)))
    );
  }, []);

  // B. Carga de Categorías
  useEffect(() => {
    if(!selProf) { setCategories([]); return; }
    setCategories([]); setSubcategories([]); setTasks([]); 
    getDocs(collection(db, "professions", selProf.id, "categories")).then(snap =>
      setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)))
    );
  }, [selProf]);

  // C. Carga de Subcategorías
  useEffect(() => {
    if(!selProf || !selCat) { setSubcategories([]); return; }
    setSubcategories([]); setTasks([]); 

    getDocs(collection(db, "professions", selProf.id, "categories", selCat.id, "subcategories")).then(snap =>
      setSubcategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)))
    );
  }, [selCat]);

  // D. Carga de Tareas
  const fetchTasks = async () => {
    if(!selProf || !selCat || !selSub) return;
    setLoading(true);

    try {
      const basePath = `professions/${selProf.id}/categories/${selCat.id}/subcategories/${selSub.id}`;
      const [missionsSnap, routinesSnap] = await Promise.all([
        getDocs(collection(db, `${basePath}/catalog_missions`)),
        getDocs(collection(db, `${basePath}/catalog_routines`))
      ]);

      const missions = missionsSnap.docs.map(d => ({
        id: d.id, ...d.data(), _collection: 'catalog_missions', typeLabel: '🎯 Misión'
      } as CatalogItem));

      const routines = routinesSnap.docs.map(d => ({
        id: d.id, ...d.data(), _collection: 'catalog_routines', typeLabel: '📅 Rutina'
      } as CatalogItem));

      setTasks([...missions, ...routines]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [selSub]);

  // 2. HANDLER: AGREGAR ITEM (CRUD)
  const handleAddItem = async () => {
    if(!newItemName.trim()) return;
    setLoading(true);

    try {
      if (selProf && selCat && selSub) {
        const targetCollection = newItemType === 'routine' ? 'catalog_routines' : 'catalog_missions';
        await addDoc(collection(db, "professions", selProf.id, "categories", selCat.id, "subcategories", selSub.id, targetCollection), {
          title: newItemName,
          description: '', 
          tier: 'EASY',    
          createdAt: new Date()
        });
        await fetchTasks(); 
      }
      else if (selProf && selCat) {
        await addDoc(collection(db, "professions", selProf.id, "categories", selCat.id, "subcategories"), { name: newItemName });
        const snap = await getDocs(collection(db, "professions", selProf.id, "categories", selCat.id, "subcategories"));
        setSubcategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
      else if (selProf) {
        await addDoc(collection(db, "professions", selProf.id, "categories"), { name: newItemName });
        const snap = await getDocs(collection(db, "professions", selProf.id, "categories"));
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
      else {
        const id = newItemName.toLowerCase().replace(/\s+/g, '');
        await setDoc(doc(db, "professions", id), { name: newItemName });
        const snap = await getDocs(collection(db, "professions"));
        setProfessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
      setNewItemName('');
    } catch (e) {
      console.error(e);
      alert("Error al guardar");
    } finally {
      setLoading(false);
    }
  };

  // 3. HANDLER: BORRAR ITEM
  const handleDelete = async (id: string, collectionOverride?: string) => {
    if(!window.confirm("¿Borrar elemento? Se perderán los hijos.")) return;
    try {
      if (selProf && selCat && selSub && collectionOverride) {
        await deleteDoc(doc(db, "professions", selProf.id, "categories", selCat.id, "subcategories", selSub.id, collectionOverride, id));
        fetchTasks();
      } else {
        alert("Por seguridad, implementa el borrado de categorías manualmente en Firebase o expande esta lógica.");
      }
    } catch (e) { console.error(e); }
  };

  const deleteUpperLevel = async (itemId: string, level: 'prof'|'cat'|'sub') => {
    if(!window.confirm("¿Borrar carpeta?")) return;
    try {
      if(level === 'prof') {
        await deleteDoc(doc(db, "professions", itemId));
        const snap = await getDocs(collection(db, "professions"));
        setProfessions(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
      if(level === 'cat' && selProf) {
        await deleteDoc(doc(db, "professions", selProf.id, "categories", itemId));
        const snap = await getDocs(collection(db, "professions", selProf.id, "categories"));
        setCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
      if(level === 'sub' && selProf && selCat) {
        await deleteDoc(doc(db, "professions", selProf.id, "categories", selCat.id, "subcategories", itemId));
        const snap = await getDocs(collection(db, "professions", selProf.id, "categories", selCat.id, "subcategories"));
        setSubcategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as CatalogItem)));
      }
    } catch(e) { console.error(e); }
  }

  // 4. RENDERIZADO
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>Gestor de Catálogo Jerárquico</h2>
      <div style={{marginBottom:'10px', fontSize:'14px', color:'#555'}}>
        Ruta: <span style={{fontWeight:'bold'}}> {selProf ? selProf.name : "Inicio"} </span>
        {selCat && <span> / {selCat.name} </span>}
        {selSub && <span> / {selSub.name} </span>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
        {/* COLUMNA 1 */}
        <div style={{border:'1px solid #ccc', padding:'10px', borderRadius:'8px', background: selProf ? '#f9f9f9' : 'white'}}>
          <h4 style={{marginTop:0}}>1. Profesión</h4>
          <div style={{marginBottom:'10px'}}>
            {professions.map(p => (
              <div key={p.id} style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                <div onClick={() => { setSelProf(p); setSelCat(null); setSelSub(null); }} style={{background: selProf?.id===p.id?'#2196F3':'white', color: selProf?.id===p.id?'white':'black', padding:'5px', cursor:'pointer', flex:1, borderRadius:'4px', border:'1px solid #eee'}}>
                  {p.name}
                </div>
                <button onClick={() => deleteUpperLevel(p.id, 'prof')} style={{marginLeft:'5px', border:'none', background:'none', cursor:'pointer'}}>🗑</button>
              </div>
            ))}
          </div>
          {!selProf && (
            <div style={{display:'flex'}}>
              <input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{width:'100%'}} />
              <button onClick={handleAddItem} disabled={loading}>+</button>
            </div>
          )}
        </div>

        {/* COLUMNA 2 */}
        <div style={{border:'1px solid #ccc', padding:'10px', borderRadius:'8px', opacity: selProf ? 1 : 0.5, background: selCat ? '#f9f9f9' : 'white'}}>
          <h4 style={{marginTop:0}}>2. Categoría</h4>
          {selProf ? (
            <>
              <div style={{marginBottom:'10px'}}>
                {categories.map(c => (
                  <div key={c.id} style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                    <div onClick={() => { setSelCat(c); setSelSub(null); }} style={{background: selCat?.id===c.id?'#2196F3':'white', color: selCat?.id===c.id?'white':'black', padding:'5px', cursor:'pointer', flex:1, borderRadius:'4px', border:'1px solid #eee'}}>
                      {c.name}
                    </div>
                    <button onClick={() => deleteUpperLevel(c.id, 'cat')} style={{marginLeft:'5px', border:'none', background:'none', cursor:'pointer'}}>🗑</button>
                  </div>
                ))}
              </div>
              {!selCat && (
                <div style={{display:'flex'}}>
                  <input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{width:'100%'}} />
                  <button onClick={handleAddItem} disabled={loading}>+</button>
                </div>
              )}
            </>
          ) : <small>Selecciona una profesión</small>}
        </div>

        {/* COLUMNA 3 */}
        <div style={{border:'1px solid #ccc', padding:'10px', borderRadius:'8px', opacity: selCat ? 1 : 0.5, background: selSub ? '#f9f9f9' : 'white'}}>
          <h4 style={{marginTop:0}}>3. Subcategoría</h4>
          {selCat ? (
            <>
              <div style={{marginBottom:'10px'}}>
                {subcategories.map(s => (
                  <div key={s.id} style={{display:'flex', justifyContent:'space-between', marginBottom:'5px'}}>
                    <div onClick={() => setSelSub(s)} style={{background: selSub?.id===s.id?'#2196F3':'white', color: selSub?.id===s.id?'white':'black', padding:'5px', cursor:'pointer', flex:1, borderRadius:'4px', border:'1px solid #eee'}}>
                      {s.name}
                    </div>
                    <button onClick={() => deleteUpperLevel(s.id, 'sub')} style={{marginLeft:'5px', border:'none', background:'none', cursor:'pointer'}}>🗑</button>
                  </div>
                ))}
              </div>
              {!selSub && (
                <div style={{display:'flex'}}>
                  <input placeholder="Nueva..." value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{width:'100%'}} />
                  <button onClick={handleAddItem} disabled={loading}>+</button>
                </div>
              )}
            </>
          ) : <small>Selecciona una categoría</small>}
        </div>

        {/* COLUMNA 4 */}
        <div style={{border:'1px solid #ccc', padding:'10px', borderRadius:'8px', opacity: selSub ? 1 : 0.5, background: '#fafafa'}}>
          <h4 style={{marginTop:0}}>4. Tareas (Mix)</h4>
          {selSub ? (
            <>
              <div style={{marginBottom:'15px', borderBottom:'1px solid #ddd', paddingBottom:'10px'}}>
                <input placeholder="Título de la tarea..." value={newItemName} onChange={e => setNewItemName(e.target.value)} style={{width:'100%', marginBottom:'5px', padding:'5px'}} />
                <div style={{display:'flex', gap:'5px'}}>
                  <select value={newItemType} onChange={(e) => setNewItemType(e.target.value as any)} style={{flex:1, padding:'5px'}}>
                    <option value="mission">🎯 Misión Única</option>
                    <option value="routine">📅 Rutina Diaria</option>
                  </select>
                  <button onClick={handleAddItem} disabled={loading} style={{background:'#4CAF50', color:'white', border:'none', borderRadius:'4px', cursor:'pointer'}}>+ Crear</button>
                </div>
              </div>
              <div style={{maxHeight:'400px', overflowY:'auto'}}>
                {tasks.length === 0 && <small style={{color:'#999'}}>No hay tareas aún.</small>}
                {tasks.map(t => (
                  <div key={t.id} style={{padding:'8px', borderBottom:'1px solid #eee', background:'white', marginBottom:'5px', fontSize:'13px', borderRadius:'4px', borderLeft: t._collection === 'catalog_routines' ? '4px solid #9C27B0' : '4px solid #E65100'}}>
                    <div style={{fontWeight:'bold', color:'#333'}}>{t.title}</div>
                    <div style={{display:'flex', justifyContent:'space-between', marginTop:'5px', alignItems:'center'}}>
                      <span style={{fontSize:'10px', padding:'2px 6px', borderRadius:'4px', color:'white', background: t._collection === 'catalog_routines' ? '#9C27B0' : '#E65100'}}>
                        {t.typeLabel}
                      </span>
                      <button onClick={() => handleDelete(t.id, t._collection)} style={{color:'#d32f2f', border:'none', background:'none', cursor:'pointer', fontSize:'14px'}} title="Borrar tarea">🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : <small>Selecciona una subcategoría</small>}
        </div>
      </div>
    </div>
  );
}
