import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Eye, EyeOff, PlusCircle, LayoutDashboard,
  LogOut, Download, Trash2, RefreshCw, Check, Loader2,
  Calendar, Search, X, FileDown, UtensilsCrossed, Plane,
  Film, Tag, ChevronDown, ChevronUp, Clock, CalendarDays, CalendarRange
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Storage helpers ──────────────────────────────────────────────
const STORAGE_KEY = 'ledger_data';

const loadData = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : { user: null, expenses: [] };
  } catch { return { user: null, expenses: [] }; }
};

const saveData = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// ─── Helpers ─────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);

const hashPassword = async (pw) => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
};

const CATEGORY_CONFIG = {
  Food:          { color: '#e67e22', tagClass: 'tag-food',          icon: UtensilsCrossed },
  Travel:        { color: '#3498db', tagClass: 'tag-travel',        icon: Plane },
  Entertainment: { color: '#9b59b6', tagClass: 'tag-entertainment', icon: Film },
  Others:        { color: '#1abc9c', tagClass: 'tag-others',        icon: Tag },
};

const getDisplayCategory = (e) =>
  e.category === 'Others' && e.manual_category ? e.manual_category : e.category;

// ─── Filter illustrations (SVG inline) ───────────────────────────
const FilterIllustration = ({ filter }) => {
  const illustrations = {
    today: (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#d4a853" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#d4a853" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <circle cx="100" cy="55" r="45" fill="url(#sunGlow)"/>
        <circle cx="100" cy="55" r="22" fill="none" stroke="#d4a853" strokeWidth="1.5" opacity="0.6"/>
        <circle cx="100" cy="55" r="14" fill="#d4a853" opacity="0.85"/>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i) => (
          <line key={i}
            x1={100 + 26*Math.cos(a*Math.PI/180)}
            y1={55 + 26*Math.sin(a*Math.PI/180)}
            x2={100 + 34*Math.cos(a*Math.PI/180)}
            y2={55 + 34*Math.sin(a*Math.PI/180)}
            stroke="#d4a853" strokeWidth="1.5" strokeLinecap="round" opacity="0.7"
          />
        ))}
        <text x="100" y="105" textAnchor="middle" fill="#b8ae9f" fontSize="10" fontFamily="DM Sans">Today's Snapshot</text>
      </svg>
    ),
    week: (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        {['S','M','T','W','T','F','S'].map((d,i) => {
          const x = 18 + i*26; const h = [20,55,35,70,45,60,25][i]; const active = i===new Date().getDay();
          return (
            <g key={i}>
              <rect x={x} y={80-h} width="16" height={h} rx="4"
                fill={active ? '#d4a853' : 'rgba(212,168,83,0.2)'}
                stroke={active ? '#d4a853' : 'rgba(212,168,83,0.3)'} strokeWidth="0.5"/>
              <text x={x+8} y="100" textAnchor="middle" fill={active ? '#d4a853' : '#7d6e5c'} fontSize="8" fontFamily="DM Sans">{d}</text>
            </g>
          );
        })}
        <text x="100" y="115" textAnchor="middle" fill="#b8ae9f" fontSize="10" fontFamily="DM Sans">This Week</text>
      </svg>
    ),
    month: (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <rect x="30" y="15" width="140" height="90" rx="8" fill="none" stroke="rgba(212,168,83,0.3)" strokeWidth="1"/>
        <rect x="30" y="15" width="140" height="22" rx="8" fill="rgba(212,168,83,0.15)"/>
        <text x="100" y="31" textAnchor="middle" fill="#d4a853" fontSize="9" fontFamily="DM Sans" fontWeight="600">
          {new Date().toLocaleString('default',{month:'long',year:'numeric'})}
        </text>
        {['S','M','T','W','T','F','S'].map((d,i) => (
          <text key={i} x={44+i*19} y="50" textAnchor="middle" fill="#7d6e5c" fontSize="7" fontFamily="DM Sans">{d}</text>
        ))}
        {Array.from({length:28},(_,i)=>{
          const day=i+1; const today=new Date().getDate(); const isT=day===today;
          const col=i%7; const row=Math.floor(i/7);
          return (
            <g key={i}>
              {isT && <circle cx={44+col*19} cy={62+row*13} r="7" fill="rgba(212,168,83,0.25)"/>}
              <text x={44+col*19} y={65+row*13} textAnchor="middle"
                fill={isT ? '#d4a853' : '#b8ae9f'} fontSize="7" fontFamily="DM Sans"
                fontWeight={isT ? '600' : '400'}>{day}</text>
            </g>
          );
        })}
      </svg>
    ),
    year: (
      <svg viewBox="0 0 200 120" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="yearLine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#d4a853" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#d4a853" stopOpacity="1"/>
          </linearGradient>
        </defs>
        {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m,i) => {
          const x = 14+i*15; const h = [20,25,35,45,55,65,60,58,45,35,28,22][i];
          const cur = new Date().getMonth();
          return (
            <g key={i}>
              <rect x={x} y={85-h} width="10" height={h} rx="2"
                fill={i<=cur ? 'rgba(212,168,83,0.6)' : 'rgba(212,168,83,0.15)'}
                stroke={i===cur ? '#d4a853' : 'none'} strokeWidth="1"/>
              <text x={x+5} y="100" textAnchor="middle" fill={i===cur ? '#d4a853' : '#5a4e3a'} fontSize="6.5" fontFamily="DM Sans">{m}</text>
            </g>
          );
        })}
        <text x="100" y="115" textAnchor="middle" fill="#b8ae9f" fontSize="10" fontFamily="DM Sans">{new Date().getFullYear()}</text>
      </svg>
    ),
  };
  return (
    <motion.div
      key={filter}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -8 }}
      transition={{ duration: 0.4 }}
      style={{ width: '100%', maxWidth: 200 }}
    >
      {illustrations[filter] || illustrations.month}
    </motion.div>
  );
};

// ─── PDF Export ───────────────────────────────────────────────────
const exportToPDF = (expenses, fromDate, toDate, userName) => {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const fmtDate = (d) => { if (!d) return ''; const [y,m,day]=d.split('-'); const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; return `${day} ${months[parseInt(m)-1]} ${y}`; };
  const rangeLabel = fromDate && toDate ? `${fmtDate(fromDate)} — ${fmtDate(toDate)}` : 'All Expenses';
  doc.setFillColor(26,20,16); doc.rect(0,0,pageW,pageH,'F');
  doc.setFillColor(44,33,24); doc.rect(0,0,pageW,42,'F');
  doc.setDrawColor(212,168,83); doc.setLineWidth(0.8); doc.line(0,42,pageW,42);
  doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(212,168,83);
  doc.text('EXPENSE REPORT',16,15);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(184,174,159);
  doc.text(userName||'User',16,24); doc.text(`Period: ${rangeLabel}`,16,31);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}`,16,37);
  const total = expenses.reduce((s,e)=>s+e.amount,0);
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(212,168,83);
  doc.text(`₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}`,pageW-16,22,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(184,174,159);
  doc.text('TOTAL SPEND',pageW-16,29,{align:'right'});
  doc.text(`${expenses.length} transaction${expenses.length!==1?'s':''}`,pageW-16,35,{align:'right'});
  const cats={};
  expenses.forEach(e=>{const k=getDisplayCategory(e);cats[k]=(cats[k]||0)+e.amount;});
  const catEntries=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const COLORS={Food:[230,126,34],Travel:[52,152,219],Entertainment:[155,89,182],Others:[26,188,156]};
  let bx=16;
  catEntries.forEach(([cat,amt])=>{
    const rgb=COLORS[cat]||[125,110,92]; const bw=38;
    doc.setFillColor(rgb[0]*.15+26,rgb[1]*.15+16,rgb[2]*.15+12); doc.roundedRect(bx,49,bw,22,2,2,'F');
    doc.setDrawColor(...rgb); doc.setLineWidth(0.4); doc.roundedRect(bx,49,bw,22,2,2,'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb);
    doc.text(cat,bx+bw/2,57,{align:'center'});
    doc.setFontSize(9); doc.setTextColor(245,240,232);
    doc.text(`₹${amt.toLocaleString('en-IN',{maximumFractionDigits:0})}`,bx+bw/2,66,{align:'center'});
    bx+=bw+4;
  });
  autoTable(doc,{
    startY:79,
    head:[['#','Date','Category','Description','Amount']],
    body:expenses.map((e,i)=>[i+1,e.date,getDisplayCategory(e),e.description||'—',`₹${e.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}`]),
    theme:'plain',
    styles:{font:'helvetica',fontSize:9,cellPadding:{top:4,bottom:4,left:5,right:5},textColor:[245,240,232],lineColor:[55,42,28],lineWidth:0.3},
    headStyles:{fillColor:[44,33,24],textColor:[212,168,83],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[30,23,16]},bodyStyles:{fillColor:[26,20,16]},
    columnStyles:{0:{halign:'center',cellWidth:10,textColor:[100,85,65]},1:{cellWidth:30},2:{cellWidth:35},3:{cellWidth:'auto'},4:{halign:'right',cellWidth:38,textColor:[212,168,83],fontStyle:'bold'}},
    margin:{left:16,right:16},
  });
  doc.save(`expense_report_${Date.now()}.pdf`);
};

// ─── Login Page ───────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    await new Promise(r => setTimeout(r, 300));
    try {
      const data = loadData();
      if (mode === 'register') {
        if (!form.name.trim()) { setError('Name is required'); return; }
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
        const hash = await hashPassword(form.password);
        const user = { id: genId(), name: form.name.trim(), email: form.email.toLowerCase() };
        const newData = { user, passwordHash: hash, expenses: data.expenses || [] };
        saveData(newData);
        onLogin(user);
      } else {
        if (!data.user) { setError('No account found. Please register first.'); return; }
        if (data.user.email !== form.email.toLowerCase()) { setError('Invalid email or password'); return; }
        const hash = await hashPassword(form.password);
        if (data.passwordHash !== hash) { setError('Invalid email or password'); return; }
        onLogin(data.user);
      }
    } catch { setError('Something went wrong'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div className="absolute rounded-full"
          style={{ width:500,height:500,background:'radial-gradient(circle, rgba(212,168,83,0.06) 0%, transparent 70%)',top:'-100px',right:'-100px' }}
          animate={{ scale:[1,1.1,1],rotate:[0,15,0] }} transition={{ duration:8,repeat:Infinity,ease:'easeInOut' }}/>
        <motion.div className="absolute rounded-full"
          style={{ width:300,height:300,background:'radial-gradient(circle, rgba(212,168,83,0.04) 0%, transparent 70%)',bottom:'-50px',left:'-50px' }}
          animate={{ scale:[1,1.15,1] }} transition={{ duration:6,repeat:Infinity,ease:'easeInOut',delay:2 }}/>
        <svg className="absolute inset-0 w-full h-full" style={{opacity:0.05}} xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4a853" strokeWidth="0.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#grid)"/>
        </svg>
      </div>

      <motion.div className="relative z-10 w-full max-w-md px-6"
        initial={{ opacity:0,y:40 }} animate={{ opacity:1,y:0 }} transition={{ duration:0.7,ease:[0.22,1,0.36,1] }}>
        <motion.div className="text-center mb-10"
          initial={{ opacity:0,y:-20 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2,duration:0.6 }}>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ background:'var(--accent-dim)',border:'1px solid var(--border)' }}>
            <TrendingUp size={28} style={{ color:'var(--accent)' }}/>
          </div>
          <h1 className="font-display" style={{ fontSize:'2.5rem',color:'var(--text-primary)',marginBottom:'4px' }}>Ledger</h1>
          <p style={{ color:'var(--text-muted)',fontSize:'13px' }}>Personal expense intelligence</p>
        </motion.div>

        <motion.div className="glass-card rounded-2xl" style={{ padding:'32px',boxShadow:'0 24px 80px rgba(0,0,0,0.5)' }}
          initial={{ opacity:0,scale:0.96 }} animate={{ opacity:1,scale:1 }} transition={{ delay:0.3,duration:0.6 }}>
          <div className="flex rounded-lg p-1 mb-6" style={{ background:'rgba(255,255,255,0.03)' }}>
            {['login','register'].map(tab => (
              <button key={tab} onClick={() => { setMode(tab); setError(''); }}
                className="flex-1 py-2 rounded-md text-sm font-medium capitalize transition-all duration-200"
                style={{ background:mode===tab?'var(--accent)':'transparent', color:mode===tab?'var(--bg-primary)':'var(--text-muted)' }}>
                {tab === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form key={mode} onSubmit={handleSubmit}
              initial={{ opacity:0,x:mode==='login'?-20:20 }} animate={{ opacity:1,x:0 }}
              exit={{ opacity:0,x:mode==='login'?20:-20 }} transition={{ duration:0.25 }}>
              {mode === 'register' && (
                <div style={{ marginBottom:'16px' }}>
                  <label style={{ display:'block',fontSize:'11px',fontWeight:500,marginBottom:'6px',color:'var(--text-secondary)' }}>Full Name</label>
                  <input type="text" className="input-field" placeholder="Your name" value={form.name}
                    onChange={e => setForm(f=>({...f,name:e.target.value}))} required/>
                </div>
              )}
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block',fontSize:'11px',fontWeight:500,marginBottom:'6px',color:'var(--text-secondary)' }}>Email Address</label>
                <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
                  onChange={e => setForm(f=>({...f,email:e.target.value}))} required/>
              </div>
              <div style={{ marginBottom:'24px' }}>
                <label style={{ display:'block',fontSize:'11px',fontWeight:500,marginBottom:'6px',color:'var(--text-secondary)' }}>Password</label>
                <div style={{ position:'relative' }}>
                  <input type={showPass?'text':'password'} className="input-field" style={{ paddingRight:'40px' }}
                    placeholder={mode==='register'?'Min 6 characters':'••••••••'} value={form.password}
                    onChange={e => setForm(f=>({...f,password:e.target.value}))} required/>
                  <button type="button" onClick={() => setShowPass(s=>!s)}
                    style={{ position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer' }}>
                    {showPass ? <EyeOff size={15}/> : <Eye size={15}/>}
                  </button>
                </div>
              </div>
              <AnimatePresence>
                {error && (
                  <motion.div initial={{ opacity:0,y:-8 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                    style={{ marginBottom:'16px',padding:'10px 14px',borderRadius:'8px',fontSize:'13px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.3)',color:'#e74c3c' }}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>
              <motion.button type="submit" className="btn-primary w-full flex items-center justify-center gap-2"
                disabled={loading} whileHover={{ scale:1.01 }} whileTap={{ scale:0.98 }}>
                {loading ? <><Loader2 size={15} className="animate-spin"/> {mode==='login'?'Signing in...':'Creating...'}</> : mode==='login'?'Sign In':'Create Account'}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </div>
  );
};

// ─── Dashboard ────────────────────────────────────────────────────
const Dashboard = ({ user, onLogout }) => {
  const [view, setView] = useState('summary');
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState('month');
  const [customDate, setCustomDate] = useState({ from: '', to: '' });
  const [showPdf, setShowPdf] = useState(false);
  const [pdfRange, setPdfRange] = useState({ from: '', to: todayStr() });
  const [addForm, setAddForm] = useState({ amount:'',category:'Food',manual_category:'',description:'',date:todayStr() });
  const [addState, setAddState] = useState('idle'); // idle | saving | done
  const [addError, setAddError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    const data = loadData();
    setExpenses(data.expenses || []);
  }, []);

  const saveExpenses = (list) => {
    setExpenses(list);
    const data = loadData();
    saveData({ ...data, expenses: list });
  };

  // ── Filter logic ──
  const filtered = useMemo(() => {
    const today = todayStr();
    const d = new Date();
    const weekStart = new Date(d); weekStart.setDate(d.getDate()-d.getDay());
    const ws = weekStart.toISOString().split('T')[0];
    const monthPfx = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const yearPfx = `${d.getFullYear()}`;

    let list = [...expenses];
    switch(filter) {
      case 'today':   list = list.filter(e => e.date === today); break;
      case 'week':    list = list.filter(e => e.date >= ws); break;
      case 'month':   list = list.filter(e => e.date.startsWith(monthPfx)); break;
      case 'year':    list = list.filter(e => e.date.startsWith(yearPfx)); break;
      case 'custom':
        if (customDate.from) list = list.filter(e => e.date >= customDate.from);
        if (customDate.to)   list = list.filter(e => e.date <= customDate.to);
        break;
      default: break;
    }
    return list.sort((a,b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  }, [expenses, filter, customDate]);

  // ── Summary ──
  const summary = useMemo(() => {
    const d = new Date(); const today = todayStr();
    const weekStart = new Date(d); weekStart.setDate(d.getDate()-d.getDay());
    const ws = weekStart.toISOString().split('T')[0];
    const mp = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const yp = `${d.getFullYear()}`;
    const sum = (fn) => expenses.filter(fn).reduce((s,e)=>s+e.amount,0);
    const cats = {};
    expenses.filter(e=>e.date.startsWith(mp)).forEach(e=>{const k=getDisplayCategory(e);cats[k]=(cats[k]||0)+e.amount;});
    return {
      today: sum(e=>e.date===today),
      week:  sum(e=>e.date>=ws),
      month: sum(e=>e.date.startsWith(mp)),
      year:  sum(e=>e.date.startsWith(yp)),
      categoryBreakdown: Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>({cat,total})),
    };
  }, [expenses]);

  const totalFiltered = filtered.reduce((s,e)=>s+e.amount,0);

  const fmtAmt = (v) => {
    if (v >= 100000) return `₹${(v/100000).toFixed(1)}L`;
    if (v >= 1000) return `₹${(v/1000).toFixed(1)}K`;
    return `₹${v.toFixed(0)}`;
  };

  // ── Add expense ──
  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.amount || parseFloat(addForm.amount)<=0) { setAddError('Enter a valid amount'); return; }
    if (addForm.category==='Others' && !addForm.manual_category.trim()) { setAddError('Specify the category name'); return; }
    setAddState('saving'); setAddError('');
    await new Promise(r=>setTimeout(r,400));
    const newExp = {
      id: genId(),
      amount: parseFloat(addForm.amount),
      category: addForm.category,
      manual_category: addForm.category==='Others' ? addForm.manual_category.trim() : null,
      description: addForm.description.trim(),
      date: addForm.date,
    };
    saveExpenses([newExp, ...expenses]);
    setAddState('done');
    setAddForm({ amount:'',category:'Food',manual_category:'',description:'',date:todayStr() });
    setTimeout(() => setAddState('idle'), 1500);
  };

  // ── Delete ──
  const handleDelete = (id) => saveExpenses(expenses.filter(e=>e.id!==id));

  // ── PDF export ──
  const handlePdfExport = () => {
    const { from, to } = pdfRange;
    const list = expenses.filter(e => (!from||e.date>=from) && (!to||e.date<=to))
                         .sort((a,b)=>a.date.localeCompare(b.date));
    exportToPDF(list, from, to, user.name);
    setShowPdf(false);
  };

  const FILTER_CARDS = [
    { key:'today', label:'Today',      icon:Clock,         color:'#e67e22' },
    { key:'week',  label:'This Week',  icon:CalendarDays,  color:'#3498db' },
    { key:'month', label:'This Month', icon:CalendarRange, color:'#d4a853' },
    { key:'year',  label:'This Year',  icon:Calendar,      color:'#9b59b6' },
  ];

  const visible = showAll ? filtered : filtered.slice(0,8);
  const filterLabel = { today:'Today',week:'This Week',month:'This Month',year:'This Year',custom:'Custom Range' }[filter] || 'Expenses';

  return (
    <div className="min-h-screen" style={{ background:'var(--bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-40" style={{ background:'rgba(26,20,16,0.92)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)' }}>
        <div style={{ maxWidth:'1100px',margin:'0 auto',padding:'0 20px',height:'56px',display:'flex',alignItems:'center',gap:'16px' }}>
          <div style={{ display:'flex',alignItems:'center',gap:'10px',flexShrink:0 }}>
            <div style={{ width:28,height:28,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent-dim)',border:'1px solid var(--border)' }}>
              <TrendingUp size={14} style={{ color:'var(--accent)' }}/>
            </div>
            <div className="hidden sm:block">
              <p style={{ fontSize:'10px',color:'var(--text-muted)',lineHeight:1,marginBottom:'2px' }}>Welcome back,</p>
              <p className="font-display" style={{ fontSize:'14px',color:'var(--text-primary)',lineHeight:1 }}>{user.name}</p>
            </div>
          </div>

          <div style={{ flex:1,display:'flex',justifyContent:'center' }}>
            <nav style={{ display:'inline-flex',borderRadius:'8px',padding:'3px',background:'rgba(255,255,255,0.03)',border:'1px solid var(--border)' }}>
              {[{key:'summary',label:'Summary',icon:LayoutDashboard},{key:'add',label:'Add Entry',icon:PlusCircle}].map(({key,label,icon:Icon})=>(
                <button key={key} onClick={()=>setView(key)}
                  style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 14px',borderRadius:'6px',fontSize:'12px',fontWeight:500,border:'none',cursor:'pointer',transition:'all .2s',
                    background:view===key?'var(--accent)':'transparent', color:view===key?'var(--bg-primary)':'var(--text-muted)' }}>
                  <Icon size={12}/>{label}
                </button>
              ))}
            </nav>
          </div>

          <div style={{ display:'flex',gap:'8px',flexShrink:0 }}>
            <motion.button onClick={()=>setShowPdf(true)}
              style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:500,border:'1px solid var(--border)',background:'var(--accent-dim)',color:'var(--accent)',cursor:'pointer' }}
              whileHover={{ scale:1.03 }} whileTap={{ scale:0.97 }}>
              <Download size={12}/><span className="hidden sm:inline">PDF</span>
            </motion.button>
            <motion.button onClick={onLogout}
              style={{ display:'flex',alignItems:'center',gap:'6px',padding:'6px 12px',borderRadius:'8px',fontSize:'12px',border:'1px solid var(--border)',background:'rgba(255,255,255,0.03)',color:'var(--text-muted)',cursor:'pointer' }}
              whileHover={{ color:'#e74c3c',borderColor:'rgba(192,57,43,0.3)' }} whileTap={{ scale:0.97 }}>
              <LogOut size={12}/><span className="hidden sm:inline">Sign out</span>
            </motion.button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth:'1100px',margin:'0 auto',padding:'24px 20px' }}>
        <AnimatePresence mode="wait">

          {/* ── Summary View ── */}
          {view === 'summary' && (
            <motion.div key="summary" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-16 }} transition={{ duration:0.3 }}>

              {/* Summary cards */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px' }}>
                {FILTER_CARDS.map(({key,label,icon:Icon,color},i) => (
                  <motion.button key={key} onClick={()=>{setFilter(key);setShowAll(false);}}
                    style={{ textAlign:'left',borderRadius:'12px',padding:'16px',cursor:'pointer',border:`1px solid ${filter===key?color+'50':'var(--border)'}`,
                      background:filter===key?`linear-gradient(135deg,${color}22,${color}08)`:'var(--bg-card)',
                      boxShadow:filter===key?`0 0 20px ${color}15`:'none',position:'relative' }}
                    initial={{ opacity:0,y:20 }} animate={{ opacity:1,y:0 }} transition={{ delay:i*.07 }}
                    whileHover={{ y:-2,scale:1.01 }} whileTap={{ scale:0.98 }}>
                    {filter===key && <motion.div layoutId="active-dot" style={{ position:'absolute',top:10,right:10,width:8,height:8,borderRadius:'50%',background:color }}/>}
                    <div style={{ width:32,height:32,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:`${color}15`,marginBottom:'10px' }}>
                      <Icon size={15} style={{ color }}/>
                    </div>
                    <p style={{ fontSize:'11px',fontWeight:500,color:filter===key?color:'var(--text-muted)',marginBottom:'4px' }}>{label}</p>
                    <p className="font-mono" style={{ fontSize:'18px',fontWeight:600,color:filter===key?'var(--text-primary)':'var(--text-secondary)',lineHeight:1 }}>
                      {fmtAmt(summary[key])}
                    </p>
                  </motion.button>
                ))}
              </div>

              {/* Main grid */}
              <div style={{ display:'grid',gridTemplateColumns:'1fr 280px',gap:'20px',alignItems:'start' }}>

                {/* Expense list */}
                <div>
                  <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px' }}>
                    <div>
                      <h2 className="font-display" style={{ fontSize:'20px',color:'var(--text-primary)',lineHeight:1.2 }}>{filterLabel}</h2>
                      {filtered.length > 0 && (
                        <p className="font-mono" style={{ fontSize:'11px',color:'var(--text-muted)',marginTop:'2px' }}>
                          {filtered.length} transactions · <span style={{ color:'var(--accent)' }}>₹{totalFiltered.toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                        </p>
                      )}
                    </div>
                    <motion.button onClick={()=>{}}
                      style={{ padding:'6px',borderRadius:'8px',color:'var(--text-muted)',background:'none',border:'none',cursor:'pointer' }}
                      whileHover={{ color:'var(--accent)' }}>
                      <RefreshCw size={13}/>
                    </motion.button>
                  </div>

                  {filtered.length === 0 ? (
                    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} style={{ textAlign:'center',padding:'60px 0' }}>
                      <div style={{ width:52,height:52,borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',background:'var(--bg-card)',border:'1px solid var(--border)' }}>
                        <Tag size={22} style={{ color:'var(--text-muted)' }}/>
                      </div>
                      <p style={{ color:'var(--text-secondary)',fontWeight:500 }}>No expenses found</p>
                      <p style={{ color:'var(--text-muted)',fontSize:'13px',marginTop:'4px' }}>Add your first expense</p>
                    </motion.div>
                  ) : (
                    <>
                      <AnimatePresence mode="popLayout">
                        <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                          {visible.map(exp => {
                            const cfg = CATEGORY_CONFIG[exp.category] || CATEGORY_CONFIG.Others;
                            const Icon = cfg.icon;
                            const dispCat = getDisplayCategory(exp);
                            return (
                              <motion.div key={exp.id} layout
                                initial={{ opacity:0,y:12,scale:0.97 }} animate={{ opacity:1,y:0,scale:1 }}
                                exit={{ opacity:0,x:-20,scale:0.95 }} transition={{ duration:0.25 }}
                                className="group"
                                style={{ display:'flex',alignItems:'center',gap:'12px',padding:'12px 14px',borderRadius:'12px',background:'var(--bg-card)',border:'1px solid var(--border)',position:'relative',cursor:'default' }}
                                whileHover={{ borderColor:'rgba(212,168,83,0.2)',y:-1,boxShadow:'0 4px 20px rgba(0,0,0,0.2)' }}>
                                <div style={{ width:36,height:36,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:`${cfg.color}15` }}>
                                  <Icon size={15} style={{ color:cfg.color }}/>
                                </div>
                                <div style={{ flex:1,minWidth:0 }}>
                                  <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px' }}>
                                    <span style={{ fontSize:'13px',fontWeight:500,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                                      {exp.description || dispCat}
                                    </span>
                                    <span className={`${cfg.tagClass}`} style={{ padding:'2px 6px',borderRadius:'4px',fontSize:'10px',fontWeight:500,flexShrink:0 }}>
                                      {dispCat}
                                    </span>
                                  </div>
                                  <p className="font-mono" style={{ fontSize:'11px',color:'var(--text-muted)' }}>
                                    {new Date(exp.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                                  </p>
                                </div>
                                <p className="font-mono" style={{ fontSize:'15px',fontWeight:600,color:'var(--accent)',flexShrink:0 }}>
                                  ₹{exp.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}
                                </p>
                                <motion.button onClick={()=>handleDelete(exp.id)}
                                  style={{ opacity:0,padding:'6px',borderRadius:'6px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.2)',color:'#e74c3c',cursor:'pointer',flexShrink:0 }}
                                  whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
                                  className="group-hover:opacity-100 transition-opacity">
                                  <Trash2 size={12}/>
                                </motion.button>
                              </motion.div>
                            );
                          })}
                        </div>
                      </AnimatePresence>
                      {filtered.length > 8 && (
                        <button onClick={()=>setShowAll(s=>!s)}
                          style={{ width:'100%',marginTop:'10px',padding:'10px',borderRadius:'10px',fontSize:'12px',background:'rgba(255,255,255,0.02)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px' }}>
                          {showAll ? <><ChevronUp size={13}/>Show less</> : <><ChevronDown size={13}/>Show {filtered.length-8} more</>}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Sidebar */}
                <div style={{ display:'flex',flexDirection:'column',gap:'14px' }}>

                  {/* Filter illustration — changes with active filter */}
                  <div className="glass-card" style={{ borderRadius:'14px',padding:'16px',display:'flex',flexDirection:'column',alignItems:'center' }}>
                    <p style={{ fontSize:'11px',fontWeight:500,color:'var(--text-muted)',marginBottom:'10px',alignSelf:'flex-start' }}>Period View</p>
                    <AnimatePresence mode="wait">
                      <FilterIllustration key={filter} filter={filter.startsWith('custom')?'month':filter}/>
                    </AnimatePresence>
                  </div>

                  {/* Custom date range */}
                  <div className="glass-card" style={{ borderRadius:'14px',padding:'16px' }}>
                    <div style={{ display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px' }}>
                      <Calendar size={13} style={{ color:'var(--accent)' }}/>
                      <span style={{ fontSize:'11px',fontWeight:500,color:'var(--text-secondary)' }}>Custom Filter</span>
                    </div>
                    <div style={{ display:'flex',flexDirection:'column',gap:'8px' }}>
                      <div>
                        <label style={{ fontSize:'10px',color:'var(--text-muted)',marginBottom:'4px',display:'block' }}>From</label>
                        <input type="date" className="input-field font-mono" style={{ fontSize:'12px',padding:'8px 10px' }}
                          value={customDate.from} onChange={e=>setCustomDate(d=>({...d,from:e.target.value}))}/>
                      </div>
                      <div>
                        <label style={{ fontSize:'10px',color:'var(--text-muted)',marginBottom:'4px',display:'block' }}>To</label>
                        <input type="date" className="input-field font-mono" style={{ fontSize:'12px',padding:'8px 10px' }}
                          value={customDate.to} onChange={e=>setCustomDate(d=>({...d,to:e.target.value}))}/>
                      </div>
                      <motion.button onClick={()=>{setFilter('custom');setShowAll(false);}}
                        style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',borderRadius:'8px',fontSize:'12px',fontWeight:500,border:'none',cursor:'pointer',background:'var(--accent-dim)',color:'var(--accent)' }}
                        whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
                        <Search size={12}/>Apply
                      </motion.button>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {summary.categoryBreakdown.length > 0 && (
                    <div className="glass-card" style={{ borderRadius:'14px',padding:'16px' }}>
                      <p style={{ fontSize:'11px',fontWeight:500,color:'var(--text-secondary)',marginBottom:'14px' }}>This Month by Category</p>
                      <div style={{ display:'flex',flexDirection:'column',gap:'10px' }}>
                        {summary.categoryBreakdown.map((item,i) => {
                          const pct = summary.month>0?(item.total/summary.month)*100:0;
                          const color = (CATEGORY_CONFIG[item.cat]||CATEGORY_CONFIG.Others).color;
                          return (
                            <div key={item.cat}>
                              <div style={{ display:'flex',justifyContent:'space-between',marginBottom:'4px' }}>
                                <span style={{ fontSize:'11px',color:'var(--text-secondary)' }}>{item.cat}</span>
                                <span className="font-mono" style={{ fontSize:'11px',color }}>{fmtAmt(item.total)}</span>
                              </div>
                              <div style={{ height:'5px',borderRadius:'3px',background:'rgba(255,255,255,0.05)',overflow:'hidden' }}>
                                <motion.div style={{ height:'100%',borderRadius:'3px',background:color }}
                                  initial={{ width:0 }} animate={{ width:`${pct}%` }}
                                  transition={{ delay:i*.1,duration:0.6,ease:'easeOut' }}/>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Add View ── */}
          {view === 'add' && (
            <motion.div key="add" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-16 }} transition={{ duration:0.3 }}
              style={{ maxWidth:'640px',margin:'0 auto' }}>
              <div className="glass-card" style={{ borderRadius:'20px',padding:'32px' }}>
                <h2 className="font-display" style={{ fontSize:'26px',color:'var(--text-primary)',marginBottom:'6px' }}>Log Expense</h2>
                <p style={{ color:'var(--text-muted)',fontSize:'13px',marginBottom:'28px' }}>Fill in the details to record a new expense.</p>
                <form onSubmit={handleAdd} autoComplete="off">
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px' }}>
                    <div>
                      <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'var(--text-secondary)' }}>Amount (₹)</label>
                      <div style={{ position:'relative' }}>
                        <span className="font-mono" style={{ position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'var(--accent)',fontWeight:600,pointerEvents:'none' }}>₹</span>
                        <input type="number" className="input-field font-mono" style={{ paddingLeft:'28px',fontSize:'15px' }}
                          placeholder="0.00" value={addForm.amount} min="0" step="0.01" required
                          onChange={e=>setAddForm(f=>({...f,amount:e.target.value}))}/>
                      </div>
                    </div>
                    <div>
                      <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'var(--text-secondary)' }}>Date</label>
                      <input type="date" className="input-field font-mono" value={addForm.date} required
                        onChange={e=>setAddForm(f=>({...f,date:e.target.value}))}/>
                    </div>
                  </div>

                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px' }}>
                    <div>
                      <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'var(--text-secondary)' }}>Category</label>
                      <div style={{ position:'relative' }}>
                        <select className="select-field" value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value,manual_category:''}))}>
                          {['Food','Travel','Entertainment','Others'].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <div style={{ position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',width:'8px',height:'8px',borderRadius:'50%',background:(CATEGORY_CONFIG[addForm.category]||CATEGORY_CONFIG.Others).color,pointerEvents:'none' }}/>
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      {addForm.category === 'Others' ? (
                        <motion.div key="manual" initial={{ opacity:0,x:10 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-10 }}>
                          <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'var(--text-secondary)' }}>Specify <span style={{ color:'#e74c3c' }}>*</span></label>
                          <input type="text" className="input-field" placeholder="e.g. Healthcare…" value={addForm.manual_category}
                            onChange={e=>setAddForm(f=>({...f,manual_category:e.target.value}))} required/>
                        </motion.div>
                      ) : <div key="spacer"/>}
                    </AnimatePresence>
                  </div>

                  <div style={{ marginBottom:'24px' }}>
                    <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'var(--text-secondary)' }}>Description <span style={{ color:'var(--text-muted)',textTransform:'none',fontWeight:400,fontSize:'11px' }}>(optional)</span></label>
                    <input type="text" className="input-field" placeholder="What was this for?" value={addForm.description}
                      onChange={e=>setAddForm(f=>({...f,description:e.target.value}))}/>
                  </div>

                  <AnimatePresence>
                    {addError && (
                      <motion.div initial={{ opacity:0,y:-6 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
                        style={{ marginBottom:'16px',padding:'10px 14px',borderRadius:'10px',fontSize:'13px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.3)',color:'#e74c3c' }}>
                        {addError}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div style={{ borderTop:'1px solid var(--border)',paddingTop:'20px',display:'flex',alignItems:'center',gap:'12px' }}>
                    <motion.button type="submit" className="btn-primary flex items-center gap-2"
                      style={{ padding:'12px 28px',fontSize:'15px',minWidth:'160px',justifyContent:'center',display:'flex',alignItems:'center',gap:'8px',
                        background:addState==='done'?'#2ecc71':undefined, color:addState==='done'?'#fff':undefined }}
                      disabled={addState==='saving'||addState==='done'}
                      whileHover={addState==='idle'?{scale:1.02}:{}} whileTap={addState==='idle'?{scale:0.97}:{}}>
                      {addState==='saving' ? <><Loader2 size={15} className="animate-spin"/>Saving…</>
                        : addState==='done' ? <><Check size={15}/>Saved!</>
                        : <><PlusCircle size={15}/>Add Expense</>}
                    </motion.button>
                    {addState==='done' && (
                      <motion.p initial={{ opacity:0,x:-8 }} animate={{ opacity:1,x:0 }} style={{ fontSize:'13px',color:'#2ecc71' }}>
                        Expense recorded!
                      </motion.p>
                    )}
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── PDF Modal ── */}
      <AnimatePresence>
        {showPdf && (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',background:'rgba(0,0,0,0.7)',backdropFilter:'blur(6px)' }}
            onClick={e=>e.target===e.currentTarget&&setShowPdf(false)}>
            <motion.div className="glass-card" style={{ width:'100%',maxWidth:'380px',borderRadius:'20px',padding:'24px',boxShadow:'0 32px 80px rgba(0,0,0,0.6)' }}
              initial={{ scale:0.92,y:20,opacity:0 }} animate={{ scale:1,y:0,opacity:1 }} exit={{ scale:0.92,y:20,opacity:0 }}>
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px' }}>
                <div style={{ display:'flex',alignItems:'center',gap:'10px' }}>
                  <div style={{ width:32,height:32,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--accent-dim)' }}>
                    <FileDown size={14} style={{ color:'var(--accent)' }}/>
                  </div>
                  <div>
                    <p className="font-display" style={{ fontSize:'15px',color:'var(--text-primary)' }}>Download Report</p>
                    <p style={{ fontSize:'11px',color:'var(--text-muted)' }}>Select date range for PDF</p>
                  </div>
                </div>
                <button onClick={()=>setShowPdf(false)} style={{ background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)' }}><X size={15}/></button>
              </div>
              <div style={{ borderTop:'1px solid var(--border)',marginBottom:'16px' }}/>
              <div style={{ marginBottom:'12px' }}>
                <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px',color:'var(--text-secondary)' }}>From Date</label>
                <div style={{ position:'relative' }}>
                  <Calendar size={12} style={{ position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
                  <input type="date" className="input-field font-mono" style={{ paddingLeft:'28px',fontSize:'13px' }}
                    value={pdfRange.from} max={todayStr()} onChange={e=>setPdfRange(r=>({...r,from:e.target.value}))}/>
                </div>
              </div>
              <div style={{ marginBottom:'16px' }}>
                <label style={{ display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px',color:'var(--text-secondary)' }}>To Date</label>
                <div style={{ position:'relative' }}>
                  <Calendar size={12} style={{ position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',pointerEvents:'none' }}/>
                  <input type="date" className="input-field font-mono" style={{ paddingLeft:'28px',fontSize:'13px' }}
                    value={pdfRange.to} max={todayStr()} onChange={e=>setPdfRange(r=>({...r,to:e.target.value}))}/>
                </div>
              </div>
              <div style={{ display:'flex',gap:'10px' }}>
                <button onClick={()=>setShowPdf(false)}
                  style={{ flex:1,padding:'10px',borderRadius:'8px',fontSize:'13px',fontWeight:500,background:'rgba(255,255,255,0.04)',border:'1px solid var(--border)',color:'var(--text-muted)',cursor:'pointer' }}>
                  Cancel
                </button>
                <motion.button onClick={handlePdfExport}
                  style={{ flex:1,padding:'10px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',cursor:'pointer',background:'var(--accent)',color:'var(--bg-primary)',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px' }}
                  whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }}>
                  <Download size={13}/>Download
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── App Root ─────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const data = loadData();
    // Auto-login if session exists
    const session = sessionStorage.getItem('ledger_session');
    if (session && data.user) {
      try { setUser(JSON.parse(session)); } catch {}
    }
    setBooting(false);
  }, []);

  const handleLogin = (u) => {
    sessionStorage.setItem('ledger_session', JSON.stringify(u));
    setUser(u);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('ledger_session');
    setUser(null);
  };

  if (booting) return (
    <div style={{ minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'var(--bg-primary)' }}>
      <motion.div style={{ width:32,height:32,borderRadius:'50%',border:'2px solid var(--accent)',borderTopColor:'transparent' }}
        animate={{ rotate:360 }} transition={{ duration:.8,repeat:Infinity,ease:'linear' }}/>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {user
        ? <motion.div key="dash" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:.3 }}>
            <Dashboard user={user} onLogout={handleLogout}/>
          </motion.div>
        : <motion.div key="login" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:.3 }}>
            <LoginPage onLogin={handleLogin}/>
          </motion.div>
      }
    </AnimatePresence>
  );
}
