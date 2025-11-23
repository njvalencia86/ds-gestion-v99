import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, query, onSnapshot, addDoc, serverTimestamp, writeBatch, doc, deleteDoc, setDoc } from 'firebase/firestore';

// --- CONFIGURACIÓN FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyCoS1DQmjrW89ymIxkbKYY8EKFZ5-1RIdU",
  authDomain: "ds-gestion-app.firebaseapp.com",
  projectId: "ds-gestion-app",
  storageBucket: "ds-gestion-app.firebasestorage.app",
  messagingSenderId: "415297430138",
  appId: "1:415297430138:web:aa22529f2456b2746dd1c3"
};

const INITIAL_MODELOS = [
    'KATHY', 'TIMMY', 'LEO', 'JACOB', 'LEYLA', 'LAURY', 'EMMA', 'HANNAH',
    'SPEEDY', 'JOSE', 'ANDREW', 'CARLOS', 'DUKE', 'JEN', 'JOSE LUIS', 
    'JADEN_SMITH', 'SOFY_RIOS', 'MARTHA', 'DONNA', 'HOBBIT'
].sort();
const EMPRESA = 'DS FILMATION';
const COLLECTION_PATH = `base_datos_global/empresa`;

// --- UTILIDADES ---
const cleanCode = (code) => {
    if (!code) return '';
    let clean = code.toString().trim();
    clean = clean.replace(/^v0+/, ''); 
    return clean;
};

const getMonthOptions = () => {
    const options = [];
    const months = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    for (let year = 2024; year <= 2026; year++) {
        for (let m = 0; m < 12; m++) {
            const value = `${year}-${String(m + 1).padStart(2, '0')}`;
            const label = `${months[m]} ${year}`;
            options.push({ value, label });
        }
    }
    return options;
};

// =================================================================================================
// 🔒 LOGIN QUANTUM (EFECTO ESCÁNER)
// =================================================================================================
const LoginScreen = ({ auth }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            setError('ACCESO DENEGADO // CREDENCIALES INVÁLIDAS');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4 relative overflow-hidden font-mono">
             {/* Grid de fondo animado */}
             <div className="absolute inset-0 bg-[linear-gradient(to_right,#080808_1px,transparent_1px),linear-gradient(to_bottom,#080808_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] pointer-events-none"></div>
             
             <div className="bg-black/40 backdrop-blur-xl p-8 rounded-3xl shadow-[0_0_50px_rgba(0,255,255,0.1)] border border-cyan-500/20 w-full max-w-md relative z-10">
                <div className="text-center mb-10">
                    <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-cyan-500 flex items-center justify-center shadow-[0_0_20px_#06b6d4] relative animate-pulse">
                        <span className="text-3xl">👁️</span>
                        <div className="absolute inset-0 border-t-2 border-cyan-200 rounded-full animate-spin"></div>
                    </div>
                    <h1 className="text-4xl font-black text-white tracking-widest">DS <span className="text-cyan-400">QUANTUM</span></h1>
                    <p className="text-cyan-700 text-[10px] tracking-[0.3em] mt-2">v5.21 // BIOMETRIC ACCESS</p>
                </div>
                
                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="group">
                        <input type="email" className="w-full bg-slate-900/50 border-b border-slate-700 p-3 text-white outline-none focus:border-cyan-500 transition-all text-center tracking-widest group-hover:bg-slate-900/80" placeholder="IDENTIFICACIÓN" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="group">
                        <input type="password" className="w-full bg-slate-900/50 border-b border-slate-700 p-3 text-white outline-none focus:border-purple-500 transition-all text-center tracking-widest group-hover:bg-slate-900/80" placeholder="CLAVE DE ACCESO" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    {error && <div className="bg-red-500/20 border border-red-500 text-red-400 text-xs p-3 rounded text-center font-bold tracking-wider animate-bounce">{error}</div>}
                    <button type="submit" disabled={loading} className="w-full bg-cyan-900/30 hover:bg-cyan-500 hover:text-black border border-cyan-500 text-cyan-400 font-bold py-4 rounded-xl transition-all duration-300 tracking-[0.2em] uppercase shadow-[0_0_10px_rgba(6,182,212,0.2)]">
                        {loading ? 'DESENCRIPTANDO...' : 'INICIAR SISTEMA'}
                    </button>
                </form>
             </div>
        </div>
    );
};

// =================================================================================================
// 🌌 APP PRINCIPAL (ESTRUCTURA QUANTUM)
// =================================================================================================
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    const [inventoryList, setInventoryList] = useState([]); 
    const [transactions, setTransactions] = useState([]); 
    const [activeTab, setActiveTab] = useState('billing'); // Facturación por defecto para rapidez
    const [trm, setTrm] = useState(4000);
    const [manyvidsCop, setManyvidsCop] = useState(''); 
    const [notification, setNotification] = useState(null);
    const [availableModels, setAvailableModels] = useState(INITIAL_MODELOS);
    const [currentPeriod, setCurrentPeriod] = useState(new Date().toISOString().slice(0, 7));

    const inventoryMap = useMemo(() => {
        const map = {};
        inventoryList.forEach(item => map[item.itemId] = item.percentages);
        return map;
    }, [inventoryList]);

    const filteredTransactions = useMemo(() => transactions.filter(t => {
        const tPeriod = t.period || (t.createdAt ? t.createdAt.toDate().toISOString().slice(0,7) : 'Sin Fecha');
        return tPeriod === currentPeriod;
    }), [transactions, currentPeriod]);

    useEffect(() => {
        try {
            const app = initializeApp(firebaseConfig);
            const firestoreDb = getFirestore(app);
            const firebaseAuth = getAuth(app);
            setDb(firestoreDb);
            setAuth(firebaseAuth);
            const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => { setUser(u); setIsAuthReady(true); });
            return () => unsubscribe();
        } catch (e) { console.error("Init Error:", e); }
    }, []);

    useEffect(() => {
        if (!user || !db) return;
        const qInv = query(collection(db, `${COLLECTION_PATH}/item_owners`));
        const unsubInv = onSnapshot(qInv, (snap) => setInventoryList(snap.docs.map(doc => ({ itemId: doc.id, ...doc.data(), batchId: doc.data().batchId || 'legacy' }))));
        const qTrans = query(collection(db, `${COLLECTION_PATH}/earnings_records`));
        const unsubTrans = onSnapshot(qTrans, (snap) => setTransactions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
        return () => { unsubInv(); unsubTrans(); };
    }, [user, db]);

    const showNotify = (type, msg) => {
        setNotification({ type, msg });
        setTimeout(() => setNotification(null), 5000);
    };

    if (!isAuthReady) return <div className="min-h-screen bg-black flex items-center justify-center text-cyan-500 font-mono animate-pulse tracking-widest">CARGANDO INTERFAZ QUANTUM...</div>;
    if (!user) return <LoginScreen auth={auth} />;

    return (
        <div className="min-h-screen font-sans flex flex-col bg-[#050505] text-white selection:bg-cyan-500 selection:text-black">
            {/* GLOBAL STYLES FOR QUANTUM UI */}
            <style>{`
                .quantum-glass { background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
                .quantum-input { background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: white; transition: all 0.3s; }
                .quantum-input:focus { border-color: #06b6d4; box-shadow: 0 0 15px rgba(6,182,212,0.2); }
                .neon-glow { text-shadow: 0 0 10px currentColor; }
                @media print {
                    body { background: white !important; color: black !important; }
                    .no-print { display: none !important; }
                    .print-content { position: absolute; top: 0; left: 0; width: 100%; margin: 0; padding: 20px; box-shadow: none; border: none; }
                }
                /* Custom Scrollbar */
                ::-webkit-scrollbar { width: 8px; height: 8px; }
                ::-webkit-scrollbar-track { background: #000; }
                ::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
                ::-webkit-scrollbar-thumb:hover { background: #06b6d4; }
            `}</style>

            {/* TOP NAVIGATION HUD */}
            <div className="quantum-glass sticky top-0 z-50 no-print border-b border-cyan-900/30">
                <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <h1 className="text-2xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500">DS <span className="text-cyan-400">Q</span></h1>
                            <span className="text-[8px] text-cyan-600 tracking-[0.3em] uppercase">System v5.21</span>
                        </div>
                        
                        {/* PERIOD SELECTOR */}
                        <div className="hidden md:flex items-center bg-black/40 rounded-lg border border-white/10 px-3 py-1">
                            <span className="text-[10px] text-slate-500 mr-2">CICLO</span>
                            <select value={currentPeriod} onChange={(e) => setCurrentPeriod(e.target.value)} className="bg-transparent text-cyan-400 text-sm font-bold outline-none uppercase font-mono">
                                {getMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* NAVIGATION TABS */}
                    <div className="flex bg-black/40 rounded-full p-1 gap-1 border border-white/5">
                        <NavButton id="database" icon="📦" active={activeTab} set={setActiveTab} />
                        <NavButton id="billing" icon="💳" active={activeTab} set={setActiveTab} />
                        <NavButton id="reports" icon="📄" active={activeTab} set={setActiveTab} />
                        <NavButton id="analytics" icon="📈" active={activeTab} set={setActiveTab} />
                    </div>

                    <button onClick={() => signOut(auth)} className="text-[10px] hover:text-red-400 transition font-mono border border-white/10 px-3 py-1 rounded hover:border-red-500/50">EXIT</button>
                </div>
            </div>

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 max-w-[1600px] w-full mx-auto p-4 md:p-6">
                {notification && (
                    <div className="fixed bottom-10 right-10 z-50 bg-black border border-green-500 text-green-400 px-6 py-4 rounded-xl shadow-[0_0_30px_rgba(34,197,94,0.2)] font-mono animate-bounce flex items-center gap-3">
                        <span className="text-xl">✅</span> {notification.msg}
                    </div>
                )}
                
                {/* DYNAMIC TABS */}
                {activeTab === 'database' && <TabDatabase db={db} inventoryList={inventoryList} availableModels={availableModels} setAvailableModels={setAvailableModels} showNotify={showNotify} COLLECTION_PATH={COLLECTION_PATH} />}
                {activeTab === 'billing' && <TabBilling db={db} inventory={inventoryMap} inventoryList={inventoryList} transactions={filteredTransactions} trm={trm} setTrm={setTrm} showNotify={showNotify} COLLECTION_PATH={COLLECTION_PATH} currentPeriod={currentPeriod} manyvidsCop={manyvidsCop} setManyvidsCop={setManyvidsCop} />}
                {activeTab === 'reports' && <TabReports transactions={filteredTransactions} trm={trm} currentPeriod={currentPeriod} manyvidsCop={manyvidsCop} />}
                {activeTab === 'analytics' && <TabAnalytics transactions={transactions} currentPeriod={currentPeriod} availableModels={availableModels} trm={trm} />}
            </div>
        </div>
    );
};

// --- COMPONENTE DE BOTÓN DE NAVEGACIÓN ---
const NavButton = ({ id, icon, active, set }) => (
    <button 
        onClick={() => set(id)} 
        className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${active === id ? 'bg-cyan-500 text-black shadow-[0_0_15px_#06b6d4] scale-110' : 'text-slate-500 hover:text-white hover:bg-white/10'}`}
    >
        <span className="text-lg">{icon}</span>
    </button>
);

// =================================================================================================
// 🗄️ TAB 1: BASE DE DATOS (REDISEÑADA - TARJETAS)
// =================================================================================================
const TabDatabase = ({ db, inventoryList, availableModels, setAvailableModels, showNotify, COLLECTION_PATH }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchSaved, setSearchSaved] = useState(''); 
    const [selectedModels, setSelectedModels] = useState([]);
    const [modelConfig, setModelConfig] = useState({});
    const [rawIds, setRawIds] = useState('');
    const [saving, setSaving] = useState(false);
    const [batchName, setBatchName] = useState('');
    const [editingBatchId, setEditingBatchId] = useState(null);
    const [newModelName, setNewModelName] = useState('');
    const [showNewModelInput, setShowNewModelInput] = useState(false);
    const [confirmDeleteId, setConfirmDeleteId] = useState(null);

    const filteredModels = availableModels.filter(m => m.toLowerCase().includes(searchTerm.toLowerCase()));
    const groupedInventory = useMemo(() => {
        const groups = {};
        inventoryList.forEach(item => {
            const bId = item.batchId;
            if (!groups[bId]) groups[bId] = { batchId: bId, batchName: item.batchName || '', createdAt: item.updatedAt, items: [], percentages: item.percentages };
            groups[bId].items.push(item.itemId);
        });
        return Object.values(groups).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    }, [inventoryList]);

    const filteredSavedRecords = useMemo(() => {
        return groupedInventory.filter(g => (g.batchName || '').toLowerCase().includes(searchSaved.toLowerCase()));
    }, [groupedInventory, searchSaved]);

    const handleSave = async () => {
        if (!rawIds.trim() || selectedModels.length === 0) return showNotify('error', 'Faltan datos');
        setSaving(true);
        try {
            const parsedIds = rawIds.split(/[\s\n,]+/).filter(x => x.trim()).map(cleanCode);
            const batch = writeBatch(db);
            const percentages = { ...modelConfig, [EMPRESA]: Math.max(0, 100 - Object.values(modelConfig).reduce((a,b)=>a+b,0)) };
            const bId = editingBatchId || Date.now().toString();
            parsedIds.forEach(id => batch.set(doc(db, `${COLLECTION_PATH}/item_owners`, id), { itemId: id, percentages, batchId: bId, batchName: batchName, updatedAt: serverTimestamp() }));
            await batch.commit();
            showNotify('success', 'OPERACIÓN EXITOSA');
            setRawIds(''); setBatchName(''); setEditingBatchId(null); setSelectedModels([]); setModelConfig({});
        } catch (e) { showNotify('error', 'ERROR EN LA MATRIX'); }
        setSaving(false);
    };

    const handleDeleteBatch = async (batchId) => {
        if (confirmDeleteId === batchId) {
            try {
                const itemsToDelete = inventoryList.filter(i => i.batchId === batchId);
                const batch = writeBatch(db);
                itemsToDelete.forEach(item => { batch.delete(doc(db, `${COLLECTION_PATH}/item_owners`, item.itemId)); });
                await batch.commit();
                showNotify('success', 'REGISTRO PURGADO');
                setConfirmDeleteId(null);
            } catch (e) { showNotify('error', 'Error al eliminar'); }
        } else { setConfirmDeleteId(batchId); setTimeout(() => setConfirmDeleteId(null), 3000); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
             <div className="lg:col-span-5 quantum-glass p-6 rounded-2xl h-fit">
                <h2 className="text-lg font-bold text-cyan-400 mb-6 tracking-widest flex items-center gap-2"><span className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></span> CONFIGURAR REGISTRO</h2>
                
                <div className="space-y-4">
                    <input type="text" placeholder="NOMBRE DEL REGISTRO (Ej: Pack Octubre)" className="quantum-input w-full p-4 rounded-xl font-bold placeholder-slate-600" value={batchName} onChange={e => setBatchName(e.target.value)} />
                    
                    <div className="flex gap-2">
                        <input type="text" placeholder="Buscar modelo..." className="quantum-input flex-1 p-3 rounded-lg text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        <button onClick={() => setShowNewModelInput(!showNewModelInput)} className="bg-slate-800 hover:bg-cyan-900 text-cyan-400 px-4 rounded-lg font-bold text-xl transition border border-cyan-900">+</button>
                    </div>
                    
                    {showNewModelInput && (<div className="flex gap-2 animate-fadeIn"><input type="text" className="quantum-input flex-1 p-2 rounded" value={newModelName} onChange={e => setNewModelName(e.target.value)} /><button onClick={() => { if(newModelName) { setAvailableModels(p => [...p, newModelName.toUpperCase()].sort()); setNewModelName(''); }}} className="bg-cyan-600 text-black px-3 rounded font-bold">ADD</button></div>)}
                    
                    {/* SELECCIÓN DE MODELOS TIPO CHIPS */}
                    <div className="flex flex-wrap gap-2 mb-4 max-h-40 overflow-y-auto p-2 bg-black/20 rounded-xl border border-white/5">
                        {filteredModels.map(m => (
                            <button key={m} onClick={() => { if (selectedModels.includes(m)) { setSelectedModels(s => s.filter(x => x !== m)); const c = {...modelConfig}; delete c[m]; setModelConfig(c); } else { setSelectedModels(s => [...s, m]); } }} 
                            className={`text-[10px] px-3 py-1.5 rounded-full border transition-all duration-300 font-bold ${selectedModels.includes(m) ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.4)]' : 'bg-transparent text-slate-400 border-slate-700 hover:border-white'}`}>
                                {m}
                            </button>
                        ))}
                    </div>

                    {/* CONFIGURACIÓN DE PORCENTAJES */}
                    <div className="space-y-2">
                        {selectedModels.map(m => (
                            <div key={m} className="flex justify-between items-center bg-slate-900/50 p-2 rounded-lg border border-white/5">
                                <span className="font-bold text-slate-200 text-xs ml-2">{m}</span>
                                <div className="flex items-center gap-1">
                                    <input type="number" className="w-16 bg-white text-black font-bold text-center rounded p-1 outline-none focus:ring-2 focus:ring-cyan-400" value={modelConfig[m]||''} onChange={e => setModelConfig({...modelConfig, [m]: parseFloat(e.target.value)})} placeholder="%" />
                                    <span className="text-slate-500 text-xs">%</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <textarea className="quantum-input w-full h-32 p-4 rounded-xl text-xs font-mono" placeholder=">> PEGAR CÓDIGOS AQUÍ..." value={rawIds} onChange={e => setRawIds(e.target.value)}></textarea>
                    
                    <button onClick={handleSave} disabled={saving} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 tracking-widest border-t border-white/20">
                        {saving ? 'PROCESANDO...' : 'GUARDAR DATOS'}
                    </button>
                </div>
             </div>
             
             <div className="lg:col-span-7 quantum-glass p-6 rounded-2xl h-[650px] flex flex-col">
                <div className="flex justify-between items-end mb-6">
                    <h3 className="font-bold text-white tracking-widest">REGISTROS <span className="text-slate-500">({filteredSavedRecords.length})</span></h3>
                    <input type="text" placeholder="🔍 Filtrar..." className="quantum-input w-48 p-2 rounded-lg text-xs" value={searchSaved} onChange={e => setSearchSaved(e.target.value)} />
                </div>
                
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                    {filteredSavedRecords.length === 0 ? <div className="text-center text-slate-600 mt-20 font-mono text-sm"> BASE DE DATOS VACÍA</div> : 
                    filteredSavedRecords.map(g => (
                        <div key={g.batchId} className="bg-black/30 border border-slate-800 p-4 rounded-xl hover:border-cyan-500/50 transition group relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-20 h-full bg-gradient-to-l from-black to-transparent opacity-50 pointer-events-none"></div>
                            <div className="flex justify-between items-start relative z-10">
                                <div>
                                    <div className="font-black text-cyan-100 text-sm uppercase tracking-wide mb-1">{g.batchName || 'REGISTRO SIN NOMBRE'}</div>
                                    <div className="text-[10px] font-mono text-cyan-600">{g.items.length} IDs • {new Date(g.createdAt?.seconds * 1000).toLocaleDateString()}</div>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => { setEditingBatchId(g.batchId); setBatchName(g.batchName); setRawIds(g.items.join('\n')); const mods = Object.keys(g.percentages).filter(k=>k!==EMPRESA); setSelectedModels(mods); const c={}; mods.forEach(m=>c[m]=g.percentages[m]); setModelConfig(c); }} className="text-[10px] font-bold bg-slate-800 text-slate-300 px-3 py-1.5 rounded hover:bg-cyan-900 hover:text-white transition border border-slate-700">EDIT</button>
                                    <button onClick={() => handleDeleteBatch(g.batchId)} className={`text-[10px] font-bold px-3 py-1.5 rounded transition border ${confirmDeleteId === g.batchId ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-black text-red-500 border-red-900/30 hover:border-red-500'}`}>{confirmDeleteId === g.batchId ? 'CONFIRM?' : 'DEL'}</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );
};

// =================================================================================================
// 💵 TAB 2: FACTURACIÓN (TERMINAL MATRIX)
// =================================================================================================

const BatchSearch = ({ batches, onAssign }) => {
    const [text, setText] = useState('');
    const [show, setShow] = useState(false);
    const filtered = useMemo(() => { if (!text) return batches; return batches.filter(b => b.name.toLowerCase().includes(text.toLowerCase())); }, [batches, text]);
    return (
        <div className="relative w-full">
            <input type="text" placeholder="🔍 ASIGNAR..." className="w-full bg-black border border-slate-700 rounded text-[10px] p-2 text-green-400 outline-none focus:border-green-500 placeholder-slate-700 font-mono" value={text} onChange={e => setText(e.target.value)} onFocus={() => setShow(true)} onBlur={() => setTimeout(() => setShow(false), 200)} />
            {show && (
                <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto bg-black border border-slate-700 rounded shadow-2xl z-50 custom-scrollbar">
                    {filtered.length === 0 ? (<div className="p-2 text-[10px] text-slate-500 font-mono">VOID</div>) : (filtered.map(b => (<div key={b.id} className="p-2 text-[10px] text-slate-400 hover:bg-green-900/20 hover:text-green-400 cursor-pointer border-b border-slate-800 font-mono" onClick={() => { setText(b.name); onAssign(b.id); }}>{b.name}</div>)))}
                </div>
            )}
        </div>
    );
};

const TabBilling = ({ db, inventory, inventoryList, transactions, trm, setTrm, showNotify, COLLECTION_PATH, currentPeriod, manyvidsCop, setManyvidsCop }) => {
    const [rawInput, setRawInput] = useState('');
    const [processing, setProcessing] = useState(false);
    const [previewData, setPreviewData] = useState([]);
    const [confirmClear, setConfirmClear] = useState(false);

    const uniqueBatches = useMemo(() => {
        const map = new Map();
        inventoryList.forEach(item => { if (!map.has(item.batchId)) map.set(item.batchId, { id: item.batchId, name: item.batchName || 'Sin Nombre', percentages: item.percentages }); });
        return Array.from(map.values()).reverse();
    }, [inventoryList]);

    useEffect(() => {
        if (!rawInput) { setPreviewData([]); return; }
        const lines = rawInput.split(/\n+/);
        const results = [];
        lines.forEach(line => {
            const match = line.match(/([v\d]{5,})\D+?(\d+\.\d{2})/);
            if (match) {
                const code = cleanCode(match[1]);
                const value = parseFloat(match[2]);
                results.push({ original: line.trim(), code, value, found: !!inventory[code], owners: inventory[code] ? Object.keys(inventory[code]).filter(k=>k!==EMPRESA).join(', ') : 'DESCONOCIDO' });
            }
        });
        setPreviewData(results);
    }, [rawInput, inventory]);

    const billingStats = useMemo(() => {
        const totalUSD = transactions.reduce((s,t)=>s+(t.usdValue||0),0);
        const theoreticalCOP = totalUSD * trm;
        const realCOP = parseFloat(manyvidsCop) || 0;
        const adjustment = realCOP > 0 ? (realCOP - theoreticalCOP) : 0;
        return { totalUSD, theoreticalCOP, realCOP, adjustment };
    }, [transactions, trm, manyvidsCop]);

    const handleAssignToBatch = async (itemCode, batchId) => {
        const batch = uniqueBatches.find(b => b.id === batchId);
        if (!batch) return;
        try { await setDoc(doc(db, `${COLLECTION_PATH}/item_owners`, itemCode), { itemId: itemCode, percentages: batch.percentages, batchId: batch.id, batchName: batch.name, updatedAt: serverTimestamp() }); showNotify('success', 'ASIGNADO'); } catch (e) { showNotify('error', 'Error'); }
    };

    const handleProcess = async () => {
        if (previewData.length === 0) return;
        setProcessing(true);
        try {
            const batch = writeBatch(db);
            const validItems = previewData.filter(i => i.found);
            validItems.forEach(item => {
                const earnings = {};
                const percentages = inventory[item.code];
                Object.entries(percentages).forEach(([owner, pct]) => earnings[owner] = (item.value * pct) / 100);
                const newDocRef = doc(collection(db, `${COLLECTION_PATH}/earnings_records`));
                batch.set(newDocRef, { itemId: item.code, usdValue: item.value, ganancias: earnings, rawLine: item.original, period: currentPeriod, createdAt: serverTimestamp() });
            });
            await batch.commit();
            showNotify('success', 'DATOS REGISTRADOS EN EL NÚCLEO');
            setRawInput('');
        } catch (e) { console.error(e); showNotify('error', 'FALLO CRÍTICO'); }
        setProcessing(false);
    };

    const handleDeleteTransaction = async (id) => { if(!window.confirm('¿ELIMINAR NODO?')) return; try { await deleteDoc(doc(db, `${COLLECTION_PATH}/earnings_records`, id)); showNotify('success', 'ELIMINADO'); } catch (e) { showNotify('error', 'Error'); } };

    const handleClearPeriod = async () => {
        if (transactions.length === 0) return;
        if (confirmClear) {
            try {
                const batch = writeBatch(db);
                transactions.forEach(t => { batch.delete(doc(db, `${COLLECTION_PATH}/earnings_records`, t.id)); });
                await batch.commit();
                showNotify('success', 'PURGA COMPLETA');
                setConfirmClear(false);
            } catch (e) { console.error(e); showNotify('error', 'Error'); }
        } else {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            <div className="lg:col-span-5 space-y-4">
                <div className="flex gap-4">
                    <div className="bg-black/50 border border-green-500/30 p-4 rounded-xl flex-1 flex flex-col items-center shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                        <span className="text-[9px] font-black text-green-500 tracking-widest mb-1">TRM (COP)</span>
                        <input type="number" value={trm} onChange={e => setTrm(parseFloat(e.target.value))} className="text-center font-mono font-bold text-2xl text-white bg-transparent w-full outline-none border-b border-green-500/50 focus:border-green-400" />
                    </div>
                    <div className="bg-black/50 border border-cyan-500/30 p-4 rounded-xl flex-1 flex flex-col items-center shadow-[0_0_15px_rgba(6,182,212,0.1)]">
                        <span className="text-[9px] font-black text-cyan-500 tracking-widest mb-1">REAL (COP)</span>
                        <input type="number" placeholder="0" value={manyvidsCop} onChange={e => setManyvidsCop(e.target.value)} className="text-center font-mono font-bold text-2xl text-white bg-transparent w-full outline-none border-b border-cyan-500/50 focus:border-cyan-400" />
                    </div>
                </div>

                <div className="bg-black border border-slate-800 p-1 rounded-xl shadow-2xl relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-cyan-500 rounded-xl blur opacity-20 group-hover:opacity-40 transition duration-1000"></div>
                    <div className="relative bg-black p-5 rounded-lg h-full">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="font-black text-white tracking-wider text-sm flex items-center gap-2"><span className="text-green-500">⚡</span> INPUT TERMINAL</h2>
                            <span className="text-[9px] font-mono text-slate-500">{currentPeriod}</span>
                        </div>
                        <textarea 
                            className="w-full h-64 bg-[#0a0a0a] border border-slate-800 rounded-lg p-4 text-xs font-mono text-green-400 outline-none resize-none focus:border-green-500/50 focus:shadow-[inset_0_0_20px_rgba(0,0,0,0.8)] placeholder-slate-800" 
                            placeholder="> WAITING FOR DATA STREAM..." 
                            value={rawInput} onChange={e => setRawInput(e.target.value)}
                        ></textarea>
                        <button onClick={handleProcess} disabled={processing || previewData.length === 0} className="w-full mt-4 bg-green-600 hover:bg-green-500 text-black font-black py-3 rounded-lg transition shadow-[0_0_20px_rgba(34,197,94,0.4)] tracking-widest uppercase text-xs">
                            {processing ? 'UPLOADING...' : 'INJECT DATA'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
                {rawInput && (
                    <div className="quantum-glass p-4 rounded-xl border-l-4 border-green-500 animate-fadeIn">
                        <h3 className="font-bold text-green-400 mb-2 text-xs uppercase tracking-wider">DATA PREVIEW</h3>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar bg-black/30 rounded-lg p-2">
                            <table className="w-full text-[10px] font-mono text-slate-300">
                                <thead className="text-left text-slate-500"><tr><th className="p-2">ID</th><th className="p-2">VAL</th><th className="p-2">STATUS</th></tr></thead>
                                <tbody>
                                    {previewData.map((row, i) => (
                                        <tr key={i} className={`border-b border-slate-800 ${row.found ? 'text-green-300' : 'text-red-400'}`}>
                                            <td className="p-2">{row.code}</td>
                                            <td className="p-2">${row.value}</td>
                                            <td className="p-2">{row.found ? 'READY' : <BatchSearch batches={uniqueBatches} onAssign={(batchId) => handleAssignToBatch(row.code, batchId)} />}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="quantum-glass rounded-xl border border-slate-700 p-6 flex flex-col h-[500px]">
                    <div className="flex justify-between items-start mb-6 border-b border-slate-700 pb-4">
                        <div>
                            <h3 className="font-black text-white uppercase tracking-widest text-lg">HISTORIAL</h3>
                            <p className="text-[10px] text-slate-400 font-mono">REGISTROS: {transactions.length}</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-3xl text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-600 font-black tracking-tighter">${billingStats.totalUSD.toFixed(2)}</span>
                            <span className="text-[9px] text-slate-500 font-mono block tracking-widest">USD TOTAL</span>
                            {billingStats.realCOP > 0 && (<div className={`mt-2 text-[10px] font-bold px-2 py-1 rounded border ${billingStats.adjustment >= 0 ? 'bg-green-900/20 border-green-500/50 text-green-400' : 'bg-red-900/20 border-red-500/50 text-red-400'}`}>ADJUST: {billingStats.adjustment >= 0 ? '+' : ''}${Math.round(billingStats.adjustment).toLocaleString('es-CO')}</div>)}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
                        {transactions.length === 0 ? <p className="text-center text-slate-600 py-20 font-mono text-xs tracking-[0.5em]">NO_DATA</p> : 
                        transactions.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(t => (
                            <div key={t.id} className="p-3 border-l-2 border-slate-700 bg-black/20 hover:bg-slate-800 hover:border-cyan-500 transition-all flex justify-between items-center text-xs group">
                                <div className="flex flex-col"><span className="font-mono font-bold text-cyan-200 tracking-wider">{t.itemId}</span><span className="text-[9px] text-slate-600">{new Date(t.createdAt?.seconds*1000).toLocaleTimeString()}</span></div>
                                <div className="flex items-center gap-4"><span className="font-bold text-white font-mono text-sm">${t.usdValue.toFixed(2)}</span><button onClick={() => handleDeleteTransaction(t.id)} className="text-slate-600 hover:text-red-500 transition">✖</button></div>
                            </div>
                        ))}
                    </div>

                    {transactions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-800">
                            <button onClick={handleClearPeriod} className={`w-full border font-bold py-3 rounded-lg transition flex justify-center items-center gap-2 uppercase text-[10px] tracking-[0.2em] ${confirmClear ? 'bg-red-600 text-white border-red-500 animate-pulse' : 'bg-transparent text-red-500 border-red-900/30 hover:bg-red-900/20'}`}>
                                {confirmClear ? 'CONFIRM DELETION' : 'PURGE ALL DATA'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TabReports = ({ transactions, trm, currentPeriod, manyvidsCop }) => {
    const report = useMemo(() => {
        const totals = {};
        let totalUSD = 0;
        transactions.forEach(t => { totalUSD += (t.usdValue || 0); Object.entries(t.ganancias).forEach(([owner, val]) => { totals[owner] = (totals[owner] || 0) + val; }); });
        let rows = Object.keys(totals).map(owner => ({ name: owner, usd: totals[owner], cop: totals[owner] * trm })).sort((a,b) => b.usd - a.usd);
        const realCOP = parseFloat(manyvidsCop) || 0;
        const theoreticalCOP = totalUSD * trm;
        if (realCOP > 0) {
            const adjustment = realCOP - theoreticalCOP;
            const dsRowIndex = rows.findIndex(r => r.name === EMPRESA);
            if (dsRowIndex !== -1) { rows[dsRowIndex].cop += adjustment; rows[dsRowIndex].hasAdjustment = true; }
        }
        return { rows, totalUSD, totalCOP: realCOP > 0 ? realCOP : theoreticalCOP, realCOP };
    }, [transactions, trm, manyvidsCop]);

    return (
        <div className="bg-white text-black p-10 max-w-4xl mx-auto shadow-2xl print-content border-none">
             <div className="mb-8 border-b-4 border-black pb-4 flex justify-between items-end">
                <div><h1 className="text-5xl font-black uppercase tracking-tighter">DS FILMATION</h1><p className="text-sm font-bold mt-1 text-slate-500 tracking-widest">OFFICIAL FINANCIAL REPORT</p></div>
                <div className="text-right"><div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Period</div><div className="text-2xl font-mono font-bold text-black uppercase">{currentPeriod}</div></div>
            </div>
            <table className="w-full text-sm mb-8">
                <thead className="bg-black text-white"><tr><th className="p-3 text-left">MODEL</th><th className="p-3 text-right">USD</th><th className="p-3 text-right">COP ({trm})</th></tr></thead>
                <tbody className="text-black">
                    {report.rows.map(r => (
                        <tr key={r.name} className="border-b border-slate-200">
                            <td className="p-3 font-bold flex items-center gap-2">{r.name} {r.hasAdjustment && <span className="text-[8px] bg-black text-white px-1 py-0.5 rounded print:hidden">ADJ</span>}</td>
                            <td className="p-3 text-right font-mono">${r.usd.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold text-base">${r.cop.toLocaleString('es-CO')}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-100 font-black text-black border-t-2 border-black">
                    <tr><td className="p-4">TOTAL</td><td className="p-4 text-right">${report.totalUSD.toFixed(2)}</td><td className="p-4 text-right text-xl">${report.totalCOP.toLocaleString('es-CO')}</td></tr>
                </tfoot>
            </table>
            {report.realCOP > 0 && (
                <div className="mt-4 text-right pt-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-widest">REAL BANK DEPOSIT</div>
                    <div className="text-2xl font-black text-black border-b-2 border-black inline-block">${report.realCOP.toLocaleString('es-CO')}</div>
                </div>
            )}
            <div className="text-center no-print mt-10"><button onClick={() => window.print()} className="bg-black text-white px-10 py-4 rounded-full font-bold shadow-lg hover:scale-105 transition tracking-widest">PRINT REPORT</button></div>
        </div>
    );
};

const TabAnalytics = ({ transactions, currentPeriod, availableModels, trm }) => {
    const periodStats = useMemo(() => {
        const currentData = transactions.filter(t => { const tPeriod = t.period || (t.createdAt ? t.createdAt.toDate().toISOString().slice(0,7) : 'Sin Fecha'); return tPeriod === currentPeriod; });
        let totalUSD = 0; const modelTotals = {};
        currentData.forEach(t => { totalUSD += (t.usdValue || 0); Object.entries(t.ganancias).forEach(([model, val]) => { modelTotals[model] = (modelTotals[model] || 0) + val; }); });
        const sortedModels = Object.keys(modelTotals).filter(m => m !== EMPRESA).map(m => ({ name: m, val: modelTotals[m] })).sort((a,b) => b.val - a.val);
        const mvp = sortedModels.length > 0 ? sortedModels[0] : null;
        return { totalUSD, sortedModels, mvp };
    }, [transactions, currentPeriod]);

    return (
        <div className="space-y-8 animate-fadeIn text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative overflow-hidden bg-slate-900 border border-cyan-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(6,182,212,0.1)]">
                    <h3 className="text-cyan-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">TOTAL REVENUE</h3>
                    <div className="text-5xl font-black text-white mb-1 tracking-tight">${periodStats.totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2})}</div>
                    <div className="text-xs font-mono text-cyan-700 opacity-80 mt-2">COP: ${(periodStats.totalUSD * trm).toLocaleString('es-CO')}</div>
                </div>
                <div className="relative overflow-hidden bg-slate-900 border border-purple-500/30 p-6 rounded-2xl shadow-[0_0_30px_rgba(168,85,247,0.1)]">
                    <h3 className="text-purple-500 text-[10px] font-black uppercase tracking-[0.3em] mb-2">MVP MODEL</h3>
                    {periodStats.mvp ? (<><div className="text-4xl font-black text-white mb-1 truncate">{periodStats.mvp.name}</div><div className="text-xl font-bold text-purple-500 font-mono">${periodStats.mvp.val.toFixed(2)}</div></>) : <div className="text-slate-700 font-mono">NO DATA</div>}
                </div>
            </div>
            
            <div className="quantum-glass border border-slate-800 p-8 rounded-3xl backdrop-blur-xl">
                <h3 className="text-white text-sm font-bold uppercase tracking-widest mb-8 flex items-center gap-3"><span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_10px_#06b6d4]"></span> PERFORMANCE METRICS</h3>
                <div className="space-y-5">
                    {periodStats.sortedModels.map((item, idx) => {
                        const maxVal = periodStats.sortedModels[0].val;
                        const percent = (item.val / maxVal) * 100;
                        const colors = ['bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-blue-500'];
                        const color = colors[idx % colors.length];
                        return (
                            <div key={item.name} className="group">
                                <div className="flex justify-between text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-wider"><span>{idx+1}. {item.name}</span><span className="text-white font-mono">${item.val.toFixed(2)}</span></div>
                                <div className="h-2 bg-black rounded-full overflow-hidden relative">
                                    <div className={`h-full ${color} relative transition-all duration-1000 ease-out group-hover:shadow-[0_0_15px_currentColor]`} style={{ width: `${percent}%` }}></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default App;