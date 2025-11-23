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
// 🔒 COMPONENTE DE LOGIN
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
            console.error(err);
            setError('ACCESO DENEGADO: Credenciales incorrectas.');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
             <div className="bg-slate-800 p-8 rounded-2xl shadow-2xl border border-cyan-500/30 w-full max-w-md relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-purple-600"></div>
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-black text-white tracking-widest uppercase mb-2">DS GESTIÓN <span className="text-cyan-400">v5.18</span></h1>
                    <p className="text-slate-400 text-xs font-mono">SISTEMA DE ACCESO RESTRINGIDO</p>
                </div>
                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="text-cyan-400 text-xs font-bold uppercase block mb-2">Usuario Autorizado</label>
                        <input type="email" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-cyan-500 transition" placeholder="admin@dsfilmation.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div>
                        <label className="text-purple-400 text-xs font-bold uppercase block mb-2">Contraseña</label>
                        <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white outline-none focus:border-purple-500 transition" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    {error && <div className="bg-red-500/10 border border-red-500 text-red-400 text-xs p-3 rounded font-bold text-center">⚠️ {error}</div>}
                    <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50">{loading ? 'VERIFICANDO...' : 'INICIAR SESIÓN'}</button>
                </form>
                <div className="mt-6 text-center text-[10px] text-slate-500 font-mono">SECURE CONNECTION • DS FILMATION</div>
             </div>
        </div>
    );
};

// =================================================================================================
// 📱 APP PRINCIPAL
// =================================================================================================
const App = () => {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [user, setUser] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    
    const [inventoryList, setInventoryList] = useState([]); 
    const [transactions, setTransactions] = useState([]); 
    const [activeTab, setActiveTab] = useState('database'); 
    const [trm, setTrm] = useState(4000);
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
            const unsubscribe = onAuthStateChanged(firebaseAuth, (u) => {
                setUser(u);
                setIsAuthReady(true);
            });
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

    if (!isAuthReady) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-cyan-500 font-mono animate-pulse">CARGANDO SISTEMA...</div>;
    if (!user) return <LoginScreen auth={auth} />;

    return (
        <div className="min-h-screen font-sans flex flex-col bg-slate-900 text-white">
            <style>{`
                @media print {
                    @page { margin: 0; size: auto; }
                    body, html { margin: 0; padding: 0; background-color: white !important; }
                    body * { visibility: hidden; }
                    .print-content, .print-content * { visibility: visible; }
                    .print-content { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; color: black !important; }
                    .no-print { display: none !important; }
                }
                .custom-scrollbar::-webkit-scrollbar { width: 6px; }
                .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
                .neon-text { text-shadow: 0 0 10px rgba(56, 189, 248, 0.5); }
                .neon-green-text { text-shadow: 0 0 10px rgba(74, 222, 128, 0.5); }
                .neon-box { box-shadow: 0 0 20px rgba(99, 102, 241, 0.2); }
                .neon-box-green { box-shadow: 0 0 20px rgba(74, 222, 128, 0.2); }
                .grid-bg { background-image: radial-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px); background-size: 20px 20px; }
            `}</style>

            {/* HEADER */}
            <div className="p-4 shadow-lg no-print sticky top-0 z-50 transition-colors duration-500 bg-black/90 backdrop-blur-md border-b border-cyan-900">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-4">
                        <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-500 neon-text">DS GESTIÓN <span className="text-orange-400">v5.18</span></h1>
                        <button onClick={() => signOut(auth)} className="bg-red-500/20 hover:bg-red-500 text-red-200 hover:text-white text-[10px] px-2 py-1 rounded border border-red-500/50 transition uppercase font-bold">SALIR</button>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-lg border border-slate-700">
                        <span className="text-xs font-bold text-slate-400 uppercase ml-2">Periodo:</span>
                        <select value={currentPeriod} onChange={(e) => setCurrentPeriod(e.target.value)} className="bg-slate-900 text-white font-bold text-sm py-1 px-3 rounded border border-slate-600 outline-none focus:border-cyan-500">
                            {getMonthOptions().map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
                        <TabButton id="database" label="Base Datos" icon="📦" active={activeTab} set={setActiveTab} color="indigo" />
                        <TabButton id="billing" label="Facturación" icon="💳" active={activeTab} set={setActiveTab} color="green" />
                        <TabButton id="reports" label="Reporte PDF" icon="📄" active={activeTab} set={setActiveTab} color="blue" />
                        <TabButton id="analytics" label="ESTADÍSTICAS" icon="🚀" active={activeTab} set={setActiveTab} color="purple" />
                    </div>
                </div>
            </div>

            {/* CONTENIDO */}
            <div className="flex-1 w-full p-4 max-w-full px-4 md:px-8 grid-bg">
                {notification && <div className={`fixed top-20 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl text-white font-bold animate-bounce ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'} no-print`}>{notification.msg}</div>}
                
                {activeTab === 'database' && <TabDatabase db={db} inventoryList={inventoryList} availableModels={availableModels} setAvailableModels={setAvailableModels} showNotify={showNotify} COLLECTION_PATH={COLLECTION_PATH} />}
                {activeTab === 'billing' && <TabBilling db={db} inventory={inventoryMap} inventoryList={inventoryList} transactions={filteredTransactions} trm={trm} setTrm={setTrm} showNotify={showNotify} COLLECTION_PATH={COLLECTION_PATH} currentPeriod={currentPeriod} />}
                {activeTab === 'reports' && <TabReports transactions={filteredTransactions} trm={trm} currentPeriod={currentPeriod} />}
                {activeTab === 'analytics' && <TabAnalytics transactions={transactions} currentPeriod={currentPeriod} availableModels={availableModels} trm={trm} />}
            </div>
        </div>
    );
};

const TabButton = ({ id, label, icon, active, set, color }) => (
    <button onClick={() => set(id)} className={`px-4 py-2 rounded-md text-xs font-bold transition flex items-center gap-2 ${active === id ? `bg-${color}-600 text-white shadow-lg scale-105` : 'text-slate-400 hover:text-white hover:bg-slate-700'}`}>
        <span className="text-lg">{icon}</span> <span className="hidden sm:inline">{label}</span>
    </button>
);

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
            showNotify('success', 'Guardado correctamente');
            setRawIds(''); setBatchName(''); setEditingBatchId(null); setSelectedModels([]); setModelConfig({});
        } catch (e) { showNotify('error', 'Error al guardar'); }
        setSaving(false);
    };

    const handleDeleteBatch = async (batchId) => {
        if (confirmDeleteId === batchId) {
            try {
                const itemsToDelete = inventoryList.filter(i => i.batchId === batchId);
                const batch = writeBatch(db);
                itemsToDelete.forEach(item => { batch.delete(doc(db, `${COLLECTION_PATH}/item_owners`, item.itemId)); });
                await batch.commit();
                showNotify('success', 'Registro eliminado correctamente');
                setConfirmDeleteId(null);
            } catch (e) { console.error(e); showNotify('error', 'Error al eliminar'); }
        } else { setConfirmDeleteId(batchId); setTimeout(() => setConfirmDeleteId(null), 3000); }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
             <div className="lg:col-span-5 bg-slate-800/80 rounded-2xl shadow-lg border border-indigo-500/30 p-6 h-fit neon-box backdrop-blur-sm">
                <h2 className="text-lg font-black text-indigo-400 mb-4 uppercase tracking-wider">1. Gestión de Modelos</h2>
                <input type="text" placeholder="Nombre del Registro (Ej: Pack Octubre)" className="w-full mb-3 p-3 border border-slate-600 rounded bg-slate-900/50 text-white font-bold outline-none focus:border-indigo-500" value={batchName} onChange={e => setBatchName(e.target.value)} />
                <div className="flex gap-2 mb-2">
                    <input type="text" placeholder="Buscar modelo..." className="flex-1 p-2 border border-slate-600 rounded bg-slate-900/50 text-sm text-white outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    <button onClick={() => setShowNewModelInput(!showNewModelInput)} className="bg-slate-700 text-white px-3 rounded hover:bg-slate-600">+</button>
                </div>
                {showNewModelInput && (<div className="flex gap-2 mb-3"><input type="text" className="flex-1 border border-slate-600 bg-slate-900/50 text-white p-1 rounded" value={newModelName} onChange={e => setNewModelName(e.target.value)} /><button onClick={() => { if(newModelName) { setAvailableModels(p => [...p, newModelName.toUpperCase()].sort()); setNewModelName(''); }}} className="bg-indigo-600 text-white px-3 rounded">OK</button></div>)}
                <div className="flex flex-wrap gap-1 mb-4 max-h-32 overflow-y-auto">
                    {filteredModels.map(m => (<button key={m} onClick={() => { if (selectedModels.includes(m)) { setSelectedModels(s => s.filter(x => x !== m)); const c = {...modelConfig}; delete c[m]; setModelConfig(c); } else { setSelectedModels(s => [...s, m]); } }} className={`text-[10px] px-2 py-1 rounded border transition ${selectedModels.includes(m) ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600'}`}>{m}</button>))}
                </div>
                {selectedModels.map(m => (
                    <div key={m} className="flex justify-between items-center mb-1 text-xs">
                        <span className="font-bold text-indigo-300">{m}</span>
                        <input type="number" className="w-16 bg-white text-indigo-900 border border-indigo-500 rounded text-right p-1 font-bold outline-none focus:ring-2 focus:ring-indigo-400" value={modelConfig[m]||''} onChange={e => setModelConfig({...modelConfig, [m]: parseFloat(e.target.value)})} placeholder="%" />
                    </div>
                ))}
                <textarea className="w-full h-32 p-3 border border-slate-600 rounded mt-4 text-xs font-mono bg-slate-900/90 text-indigo-200 outline-none focus:border-indigo-500 shadow-inner" placeholder="Pega los códigos aquí..." value={rawIds} onChange={e => setRawIds(e.target.value)}></textarea>
                <button onClick={handleSave} disabled={saving} className="w-full mt-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50">{saving ? 'Guardando...' : 'GUARDAR REGISTRO'}</button>
             </div>
             
             <div className="lg:col-span-7 bg-slate-800/80 rounded-2xl shadow-lg border border-slate-600 p-6 h-[600px] overflow-hidden flex flex-col backdrop-blur-sm">
                <h3 className="font-bold mb-4 text-white uppercase tracking-wider">Registros Guardados ({filteredSavedRecords.length})</h3>
                <div className="mb-4">
                    <input type="text" placeholder="🔍 Buscar registro guardado (ej: Pack Octubre)..." className="w-full p-3 border border-slate-600 rounded-xl bg-slate-900/80 text-white text-sm outline-none focus:border-indigo-500 shadow-inner" value={searchSaved} onChange={e => setSearchSaved(e.target.value)} />
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    {filteredSavedRecords.length === 0 ? <div className="text-center text-slate-500 mt-10">No se encontraron registros.</div> : 
                    filteredSavedRecords.map(g => (
                        <div key={g.batchId} className="border-b border-slate-700 py-3 flex justify-between items-start hover:bg-slate-700/30 transition px-2 rounded">
                            <div><div className="font-bold text-indigo-300">{g.batchName || 'Sin Nombre'}</div><div className="text-xs text-slate-400">{g.items.length} items - {new Date(g.createdAt?.seconds * 1000).toLocaleDateString()}</div></div>
                            <div className="flex gap-2">
                                <button onClick={() => { setEditingBatchId(g.batchId); setBatchName(g.batchName); setRawIds(g.items.join('\n')); const mods = Object.keys(g.percentages).filter(k=>k!==EMPRESA); setSelectedModels(mods); const c={}; mods.forEach(m=>c[m]=g.percentages[m]); setModelConfig(c); }} className="text-indigo-400 text-xs font-bold bg-indigo-900/30 px-3 py-1 rounded hover:bg-indigo-900/50 transition border border-indigo-800">Editar</button>
                                <button onClick={() => handleDeleteBatch(g.batchId)} className={`text-xs font-bold px-3 py-1 rounded transition ${confirmDeleteId === g.batchId ? 'bg-red-600 text-white animate-pulse' : 'text-red-400 hover:bg-red-900/30 border border-red-900/50'}`}>{confirmDeleteId === g.batchId ? '¿CONFIRMAR?' : 'Eliminar'}</button>
                            </div>
                        </div>
                    ))}
                </div>
             </div>
        </div>
    );
};

// =================================================================================================
// 💵 TAB 2: FACTURACIÓN FUTURISTA (CON BUSCADOR INTELIGENTE)
// =================================================================================================

// --- NUEVO COMPONENTE: BUSCADOR DE LOTES EN FILA ---
const BatchSearch = ({ batches, onAssign }) => {
    const [text, setText] = useState('');
    const [show, setShow] = useState(false);

    const filtered = useMemo(() => {
        if (!text) return batches;
        return batches.filter(b => b.name.toLowerCase().includes(text.toLowerCase()));
    }, [batches, text]);

    return (
        <div className="relative w-full">
            <input 
                type="text" 
                placeholder="🔍 Escribe para buscar..." 
                className="w-full bg-slate-900/80 border border-slate-600 rounded text-[10px] p-2 text-white outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition"
                value={text}
                onChange={e => setText(e.target.value)}
                onFocus={() => setShow(true)}
                onBlur={() => setTimeout(() => setShow(false), 200)} // Delay para permitir click
            />
            {show && (
                <div className="absolute left-0 top-full mt-1 w-full max-h-40 overflow-y-auto bg-slate-800 border border-slate-600 rounded shadow-2xl z-50 custom-scrollbar">
                    {filtered.length === 0 ? (
                        <div className="p-2 text-[10px] text-slate-500">Sin resultados</div>
                    ) : (
                        filtered.map(b => (
                            <div 
                                key={b.id} 
                                className="p-2 text-[10px] text-slate-300 hover:bg-green-900/30 hover:text-green-400 cursor-pointer border-b border-slate-700 last:border-none"
                                onClick={() => {
                                    setText(b.name);
                                    onAssign(b.id);
                                }}
                            >
                                {b.name}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

const TabBilling = ({ db, inventory, inventoryList, transactions, trm, setTrm, showNotify, COLLECTION_PATH, currentPeriod }) => {
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

    const handleAssignToBatch = async (itemCode, batchId) => {
        const batch = uniqueBatches.find(b => b.id === batchId);
        if (!batch) return;
        try { await setDoc(doc(db, `${COLLECTION_PATH}/item_owners`, itemCode), { itemId: itemCode, percentages: batch.percentages, batchId: batch.id, batchName: batch.name, updatedAt: serverTimestamp() }); showNotify('success', 'Asignado. Vuelve a pegar los datos.'); } catch (e) { showNotify('error', 'Error al asignar'); }
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
            showNotify('success', `Guardados ${validItems.length} items en ${currentPeriod}`);
            setRawInput('');
        } catch (e) { console.error(e); showNotify('error', 'Error procesando'); }
        setProcessing(false);
    };

    const handleDeleteTransaction = async (id) => { if(!window.confirm('¿Borrar?')) return; try { await deleteDoc(doc(db, `${COLLECTION_PATH}/earnings_records`, id)); showNotify('success', 'Borrado'); } catch (e) { showNotify('error', 'Error'); } };

    const handleClearPeriod = async () => {
        if (transactions.length === 0) return;
        if (confirmClear) {
            try {
                const batch = writeBatch(db);
                transactions.forEach(t => { batch.delete(doc(db, `${COLLECTION_PATH}/earnings_records`, t.id)); });
                await batch.commit();
                showNotify('success', `Historial de ${currentPeriod} eliminado completamente.`);
                setConfirmClear(false);
            } catch (e) { console.error(e); showNotify('error', 'Error al intentar borrar todo.'); }
        } else {
            setConfirmClear(true);
            setTimeout(() => setConfirmClear(false), 3000);
        }
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
            <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-800/80 p-4 rounded-xl shadow-lg border border-green-500/30 backdrop-blur-sm flex justify-between items-center neon-box-green">
                    <span className="text-xs font-bold text-green-400 uppercase tracking-widest">TRM ACTIVA (COP)</span>
                    <input type="number" value={trm} onChange={e => setTrm(parseFloat(e.target.value))} className="text-right font-mono font-black text-xl text-green-300 bg-transparent w-32 outline-none border-b border-green-500/50 focus:border-green-400 neon-green-text" />
                </div>
                <div className="bg-black/40 p-6 rounded-xl shadow-lg border border-slate-700 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/10 rounded-full blur-xl pointer-events-none"></div>
                    <div className="flex justify-between items-center mb-2">
                        <h2 className="text-lg font-black text-white flex items-center gap-2"><span className="text-green-500 text-xl">⚡</span> Facturar: {currentPeriod}</h2>
                    </div>
                    <textarea 
                        className="w-full h-64 p-4 border border-slate-600 rounded-xl text-xs font-mono outline-none resize-none bg-slate-900/90 text-green-400 shadow-inner focus:border-green-500 focus:shadow-[0_0_15px_rgba(34,197,94,0.3)] transition" 
                        placeholder="SYSTEM READY... INGRESE DATOS DEL PDF..." 
                        value={rawInput} onChange={e => setRawInput(e.target.value)}
                    ></textarea>
                    <button onClick={handleProcess} disabled={processing || previewData.length === 0} className="w-full mt-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black py-4 rounded-xl shadow-lg transition transform hover:scale-[1.02] disabled:opacity-50 tracking-widest">
                        {processing ? 'PROCESANDO DATA...' : `REGISTRAR EN ${currentPeriod}`}
                    </button>
                </div>
            </div>

            <div className="lg:col-span-7 space-y-6">
                {rawInput && (
                    <div className="bg-slate-800 border border-slate-600 rounded-xl shadow p-4 animate-fadeIn">
                        <h3 className="font-bold text-green-400 mb-2 text-sm uppercase tracking-wider">Vista Previa de Datos</h3>
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <table className="w-full text-xs text-slate-300">
                                <thead className="bg-slate-900 text-green-500"><tr><th className="p-2 text-left">Código</th><th className="p-2">Valor</th><th className="p-2 w-48">Estado / Asignar</th></tr></thead>
                                <tbody>
                                    {previewData.map((row, i) => (
                                        <tr key={i} className={`border-b border-slate-700 ${row.found ? 'bg-transparent' : 'bg-red-900/20'}`}>
                                            <td className="p-2 font-mono text-white">{row.code}</td>
                                            <td className="p-2 font-bold text-green-300">${row.value}</td>
                                            <td className="p-2">
                                                {row.found ? <span className="text-green-500 font-bold">✓ OK</span> : 
                                                <BatchSearch batches={uniqueBatches} onAssign={(batchId) => handleAssignToBatch(row.code, batchId)} />
                                                }
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <div className="bg-slate-800/80 rounded-xl shadow-lg border border-slate-600 p-6 flex flex-col h-[500px] backdrop-blur-sm">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                        <div>
                            <h3 className="font-bold text-white uppercase tracking-wider">Historial: <span className="text-green-400">{currentPeriod}</span></h3>
                            <p className="text-[10px] text-slate-400">Total Transacciones: {transactions.length}</p>
                        </div>
                        <div className="text-right">
                            <span className="block text-2xl text-green-400 font-black neon-green-text">${transactions.reduce((s,t)=>s+(t.usdValue||0),0).toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2">
                        {transactions.length === 0 ? <p className="text-center text-slate-500 py-10 font-mono">--- SIN REGISTROS ---</p> : 
                        transactions.sort((a,b)=>(b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)).map(t => (
                            <div key={t.id} className="p-2 border border-slate-700/50 rounded bg-slate-900/50 flex justify-between items-center text-xs hover:border-green-500/50 transition group">
                                <div><span className="font-mono font-bold text-green-300 mr-2">{t.itemId}</span><span className="text-slate-500">{new Date(t.createdAt?.seconds*1000).toLocaleTimeString()}</span></div>
                                <div className="flex items-center gap-3"><span className="font-bold text-white">${t.usdValue.toFixed(2)}</span><button onClick={() => handleDeleteTransaction(t.id)} className="text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">✕</button></div>
                            </div>
                        ))}
                    </div>

                    {transactions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-700">
                            <button 
                                onClick={handleClearPeriod} 
                                className={`w-full border font-bold py-3 rounded-xl transition flex justify-center items-center gap-2 uppercase text-xs tracking-widest ${confirmClear ? 'bg-red-600 border-red-500 text-white animate-pulse shadow-[0_0_20px_rgba(220,38,38,0.6)]' : 'bg-red-900/20 border-red-900/50 text-red-400 hover:bg-red-900/40'}`}
                            >
                                {confirmClear ? '⚠️ ¿CONFIRMAR BORRADO TOTAL? ⚠️' : '💀 BORRAR TODO EL HISTORIAL'}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const TabReports = ({ transactions, trm, currentPeriod }) => {
    const report = useMemo(() => {
        const totals = {};
        let totalUSD = 0;
        transactions.forEach(t => { totalUSD += (t.usdValue || 0); Object.entries(t.ganancias).forEach(([owner, val]) => { totals[owner] = (totals[owner] || 0) + val; }); });
        const rows = Object.keys(totals).map(owner => ({ name: owner, usd: totals[owner], cop: totals[owner] * trm })).sort((a,b) => b.usd - a.usd);
        return { rows, totalUSD, totalCOP: totalUSD * trm };
    }, [transactions, trm]);

    return (
        <div className="bg-slate-800 p-8 max-w-4xl mx-auto shadow-2xl print-content border border-slate-600 neon-box">
             <div className="mb-8 border-b-4 border-slate-600 pb-4 flex justify-between items-end print-header">
                <div><h1 className="text-4xl font-black text-white uppercase print:text-black">DS FILMATION</h1><p className="text-sm font-bold mt-1 text-slate-400 print:text-black">REPORTE MENSUAL</p></div>
                <div className="text-right"><div className="text-xs font-bold text-slate-400 print:text-black">Periodo</div><div className="text-2xl font-mono font-bold text-white uppercase print:text-black">{currentPeriod}</div></div>
            </div>
            <table className="w-full text-sm mb-8">
                <thead className="bg-slate-900 text-white print:bg-slate-200 print:text-black">
                    <tr>
                        <th className="p-3 text-left">Modelo</th>
                        <th className="p-3 text-right">USD</th>
                        <th className="p-3 text-right">COP ({trm})</th>
                    </tr>
                </thead>
                <tbody className="text-slate-300 print:text-black">
                    {report.rows.map(r => (
                        <tr key={r.name} className="border-b border-slate-700 even:bg-slate-700/30 print:border-slate-300 print:even:bg-slate-100">
                            <td className="p-3 font-bold text-white print:text-black">{r.name}</td>
                            <td className="p-3 text-right font-mono">${r.usd.toFixed(2)}</td>
                            <td className="p-3 text-right font-bold">${r.cop.toLocaleString('es-CO')}</td>
                        </tr>
                    ))}
                </tbody>
                <tfoot className="bg-slate-900 font-bold text-white print:bg-slate-200 print:text-black">
                    <tr>
                        <td className="p-3">TOTAL</td>
                        <td className="p-3 text-right">${report.totalUSD.toFixed(2)}</td>
                        <td className="p-3 text-right">${report.totalCOP.toLocaleString('es-CO')}</td>
                    </tr>
                </tfoot>
            </table>
            <div className="text-center no-print"><button onClick={() => window.print()} className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:scale-105 transition">IMPRIMIR REPORTE OFICIAL</button></div>
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

    const historyStats = useMemo(() => {
        const months = getMonthOptions().map(o => o.value);
        const data = months.map(m => { const total = transactions.filter(t => (t.period || '').startsWith(m)).reduce((s, t) => s + (t.usdValue || 0), 0); return { month: m, total }; });
        return data.filter(d => d.total > 0 || d.month === currentPeriod);
    }, [transactions, currentPeriod]);

    return (
        <div className="space-y-8 animate-fadeIn text-white">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="relative overflow-hidden bg-slate-800/80 border border-cyan-500/30 p-6 rounded-2xl neon-box">
                    <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">💰</div>
                    <h3 className="text-cyan-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Total Facturado</h3>
                    <div className="text-4xl font-black text-white mb-1 tracking-tight">${periodStats.totalUSD.toLocaleString('en-US', {minimumFractionDigits: 2})} <span className="text-lg text-slate-500">USD</span></div>
                    <div className="text-sm font-mono text-cyan-300 opacity-80">≈ ${(periodStats.totalUSD * trm).toLocaleString('es-CO')} COP</div>
                    <div className="w-full bg-slate-700 h-1 mt-4 rounded-full overflow-hidden"><div className="bg-cyan-500 h-full shadow-[0_0_10px_#22d3ee]" style={{ width: '100%' }}></div></div>
                </div>
                <div className="relative overflow-hidden bg-slate-800/80 border border-purple-500/30 p-6 rounded-2xl neon-box">
                    <div className="absolute top-0 right-0 p-4 opacity-20 text-6xl">🏆</div>
                    <h3 className="text-purple-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Modelo Top (MVP)</h3>
                    {periodStats.mvp ? (<><div className="text-3xl font-black text-white mb-1 truncate">{periodStats.mvp.name}</div><div className="text-xl font-bold text-purple-300">${periodStats.mvp.val.toFixed(2)} USD</div></>) : <div className="text-slate-500 italic">Sin datos aún</div>}
                    <div className="w-full bg-slate-700 h-1 mt-4 rounded-full overflow-hidden"><div className="bg-purple-500 h-full shadow-[0_0_10px_#a855f7]" style={{ width: '75%' }}></div></div>
                </div>
                <div className="relative overflow-hidden bg-slate-800/80 border border-orange-500/30 p-6 rounded-2xl neon-box flex flex-col justify-center items-center text-center">
                    <h3 className="text-orange-400 text-xs font-bold uppercase tracking-[0.2em] mb-2">Periodo Activo</h3>
                    <div className="text-3xl font-black text-white uppercase">{currentPeriod}</div>
                    <div className="text-xs text-slate-400 mt-2">DS GESTIÓN v5.18 SYSTEM</div>
                </div>
            </div>
            
            <div className="bg-slate-800/50 border border-slate-700 p-8 rounded-3xl backdrop-blur-sm">
                <h3 className="text-white text-lg font-bold uppercase tracking-widest mb-8 flex items-center gap-2"><span className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></span>Rendimiento por Modelo</h3>
                {periodStats.sortedModels.length === 0 ? (<div className="text-center py-10 text-slate-500">No hay actividad registrada en este periodo.</div>) : (
                    <div className="space-y-4">
                        {periodStats.sortedModels.map((item, idx) => {
                            const maxVal = periodStats.sortedModels[0].val;
                            const percent = (item.val / maxVal) * 100;
                            const colors = ['bg-cyan-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500'];
                            const color = colors[idx % colors.length];
                            return (
                                <div key={item.name} className="relative group">
                                    <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase tracking-wider"><span>#{idx+1} {item.name}</span><span className="text-white">${item.val.toFixed(2)}</span></div>
                                    <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-700 relative">
                                        <div className={`h-full ${color} rounded-full relative transition-all duration-1000 ease-out group-hover:brightness-125`} style={{ width: `${percent}%` }}><div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 blur-[2px]"></div></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className="mt-8">
                <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-4">Tendencia Global (Últimos Meses)</h3>
                <div className="flex items-end gap-2 h-32 opacity-80">
                    {historyStats.map(h => {
                        const max = Math.max(...historyStats.map(x => x.total));
                        const hPercent = max > 0 ? (h.total / max) * 100 : 0;
                        const isCurrent = h.month === currentPeriod;
                        return (
                            <div key={h.month} className="flex-1 flex flex-col justify-end items-center group">
                                <div className="text-[10px] text-slate-400 mb-1 opacity-0 group-hover:opacity-100 transition">${Math.round(h.total)}</div>
                                <div 
                                    className={`w-full rounded-t-sm transition-all duration-500 ${isCurrent ? 'bg-cyan-400 shadow-[0_0_15px_#22d3ee]' : 'bg-slate-700 hover:bg-slate-600'}`} 
                                    style={{ height: `${Math.max(hPercent, 5)}%` }}
                                ></div>
                                <div className={`text-[9px] mt-1 ${isCurrent ? 'text-cyan-400 font-bold' : 'text-slate-500'}`}>{h.month.split('-')[1]}</div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    );
};

export default App;