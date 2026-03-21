import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, Eye, EyeOff, PlusCircle, LayoutDashboard,
  LogOut, Download, Trash2, RefreshCw, Check, Loader2,
  Calendar, Search, X, FileDown, UtensilsCrossed, Plane,
  Film, Tag, ChevronDown, ChevronUp, Clock, CalendarDays, CalendarRange
} from 'lucide-react';
import jsPDF from 'jspdf';
import { PRELOADED_EXPENSES } from './preloadData';
import autoTable from 'jspdf-autotable';

// ─── Storage ──────────────────────────────────────────────────────
const STORAGE_KEY = 'ledger_data';
const loadData = () => { try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { user: null, expenses: [] }; } catch { return { user: null, expenses: [] }; } };
const saveData = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));

const todayStr = () => new Date().toISOString().split('T')[0];
const genId = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const hashPassword = async (pw) => { const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw)); return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join(''); };

const CAT = {
  Food:          { color: '#e67e22', tag: 'tag-food',          Icon: UtensilsCrossed },
  Travel:        { color: '#3498db', tag: 'tag-travel',        Icon: Plane },
  Entertainment: { color: '#9b59b6', tag: 'tag-entertainment', Icon: Film },
  Others:        { color: '#1abc9c', tag: 'tag-others',        Icon: Tag },
};
const dispCat = (e) => e.category === 'Others' && e.manual_category ? e.manual_category : e.category;
const fmtAmt = (v) => v >= 100000 ? `₹${(v/100000).toFixed(1)}L` : v >= 1000 ? `₹${(v/1000).toFixed(1)}K` : `₹${v.toFixed(0)}`;

// ─── SVG Illustrations ────────────────────────────────────────────
const Illustration = ({ filter }) => {
  const d = new Date();
  const today = d.getDate();
  const month = d.toLocaleString('default',{month:'long',year:'numeric'});
  const year = d.getFullYear();
  const curMonth = d.getMonth();
  const curDay = d.getDay();

  const svgs = {
    today: (
      <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
        <circle cx="100" cy="58" r="48" fill="rgba(212,168,83,0.06)"/>
        <circle cx="100" cy="58" r="24" fill="none" stroke="#d4a853" strokeWidth="1.5" opacity="0.5"/>
        <circle cx="100" cy="58" r="15" fill="#d4a853" opacity="0.9"/>
        {[0,30,60,90,120,150,180,210,240,270,300,330].map((a,i)=>(
          <line key={i} x1={100+28*Math.cos(a*Math.PI/180)} y1={58+28*Math.sin(a*Math.PI/180)}
            x2={100+37*Math.cos(a*Math.PI/180)} y2={58+37*Math.sin(a*Math.PI/180)}
            stroke="#d4a853" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
        ))}
        <text x="100" y="108" textAnchor="middle" fill="#b8ae9f" fontSize="11" fontFamily="DM Sans,sans-serif">Today's Snapshot</text>
      </svg>
    ),
    week: (
      <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
        {['S','M','T','W','T','F','S'].map((day,i)=>{
          const x=16+i*27; const h=[22,55,38,72,46,62,28][i]; const active=i===curDay;
          return (<g key={i}>
            <rect x={x} y={85-h} width="18" height={h} rx="5"
              fill={active?'#d4a853':'rgba(212,168,83,0.18)'}
              stroke={active?'#d4a853':'rgba(212,168,83,0.3)'} strokeWidth="0.5"/>
            <text x={x+9} y="102" textAnchor="middle" fill={active?'#d4a853':'#7d6e5c'} fontSize="9" fontFamily="DM Sans,sans-serif">{day}</text>
          </g>);
        })}
        <text x="100" y="118" textAnchor="middle" fill="#b8ae9f" fontSize="11" fontFamily="DM Sans,sans-serif">This Week</text>
      </svg>
    ),
    month: (
      <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
        <rect x="20" y="10" width="160" height="100" rx="10" fill="none" stroke="rgba(212,168,83,0.25)" strokeWidth="1"/>
        <rect x="20" y="10" width="160" height="26" rx="10" fill="rgba(212,168,83,0.12)"/>
        <text x="100" y="27" textAnchor="middle" fill="#d4a853" fontSize="9.5" fontFamily="DM Sans,sans-serif" fontWeight="600">{month}</text>
        {['S','M','T','W','T','F','S'].map((day,i)=>(
          <text key={i} x={34+i*22} y="48" textAnchor="middle" fill="#5a4e3a" fontSize="7.5" fontFamily="DM Sans,sans-serif">{day}</text>
        ))}
        {Array.from({length:28},(_,i)=>{
          const isT=i+1===today; const col=i%7; const row=Math.floor(i/7);
          return (<g key={i}>
            {isT&&<circle cx={34+col*22} cy={61+row*13} r="8" fill="rgba(212,168,83,0.2)"/>}
            <text x={34+col*22} y={65+row*13} textAnchor="middle"
              fill={isT?'#d4a853':'#b8ae9f'} fontSize="7.5" fontFamily="DM Sans,sans-serif"
              fontWeight={isT?'700':'400'}>{i+1}</text>
          </g>);
        })}
      </svg>
    ),
    year: (
      <svg viewBox="0 0 200 130" xmlns="http://www.w3.org/2000/svg" style={{width:'100%'}}>
        {['J','F','M','A','M','J','J','A','S','O','N','D'].map((m,i)=>{
          const x=10+i*15; const h=[20,25,35,45,55,65,60,58,45,35,28,22][i]; const cur=i===curMonth;
          return (<g key={i}>
            <rect x={x} y={88-h} width="11" height={h} rx="3"
              fill={i<=curMonth?'rgba(212,168,83,0.65)':'rgba(212,168,83,0.12)'}
              stroke={cur?'#d4a853':'none'} strokeWidth="1"/>
            <text x={x+5.5} y="102" textAnchor="middle" fill={cur?'#d4a853':'#4a3e2e'} fontSize="6.5" fontFamily="DM Sans,sans-serif">{m}</text>
          </g>);
        })}
        <text x="100" y="118" textAnchor="middle" fill="#b8ae9f" fontSize="11" fontFamily="DM Sans,sans-serif">{year}</text>
      </svg>
    ),
  };
  return (
    <motion.div key={filter} initial={{opacity:0,scale:0.9,y:6}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.9,y:-6}} transition={{duration:0.35}}
      style={{width:'100%',padding:'0 8px'}}>
      {svgs[filter]||svgs.month}
    </motion.div>
  );
};

// ─── PDF Export ───────────────────────────────────────────────────
const exportPDF = (expenses, from, to, name) => {
  const doc = new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  const W = doc.internal.pageSize.getWidth(); const H = doc.internal.pageSize.getHeight();
  const fmt = (d) => { if(!d) return ''; const [y,m,day]=d.split('-'); return `${day} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+m-1]} ${y}`; };
  const label = from&&to?`${fmt(from)} — ${fmt(to)}`:'All Expenses';
  doc.setFillColor(26,20,16); doc.rect(0,0,W,H,'F');
  doc.setFillColor(44,33,24); doc.rect(0,0,W,42,'F');
  doc.setDrawColor(212,168,83); doc.setLineWidth(0.8); doc.line(0,42,W,42);
  doc.setFont('helvetica','bold'); doc.setFontSize(20); doc.setTextColor(212,168,83); doc.text('EXPENSE REPORT',16,15);
  doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(184,174,159);
  doc.text(name||'User',16,24); doc.text(`Period: ${label}`,16,31); doc.text(`Generated: ${new Date().toLocaleDateString('en-IN',{dateStyle:'long'})}`,16,37);
  const total = expenses.reduce((s,e)=>s+e.amount,0);
  doc.setFont('helvetica','bold'); doc.setFontSize(16); doc.setTextColor(212,168,83); doc.text(`₹${total.toLocaleString('en-IN',{minimumFractionDigits:2})}`,W-16,22,{align:'right'});
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(184,174,159);
  doc.text('TOTAL SPEND',W-16,29,{align:'right'}); doc.text(`${expenses.length} transactions`,W-16,35,{align:'right'});
  const cats={};
  expenses.forEach(e=>{const k=dispCat(e);cats[k]=(cats[k]||0)+e.amount;});
  const COLORS={Food:[230,126,34],Travel:[52,152,219],Entertainment:[155,89,182],Others:[26,188,156]};
  let bx=16;
  Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,5).forEach(([cat,amt])=>{
    const rgb=COLORS[cat]||[125,110,92]; const bw=38;
    doc.setFillColor(rgb[0]*.15+26,rgb[1]*.15+16,rgb[2]*.15+12); doc.roundedRect(bx,49,bw,22,2,2,'F');
    doc.setDrawColor(...rgb); doc.setLineWidth(0.4); doc.roundedRect(bx,49,bw,22,2,2,'S');
    doc.setFont('helvetica','bold'); doc.setFontSize(7.5); doc.setTextColor(...rgb); doc.text(cat,bx+bw/2,57,{align:'center'});
    doc.setFontSize(9); doc.setTextColor(245,240,232); doc.text(`₹${amt.toLocaleString('en-IN',{maximumFractionDigits:0})}`,bx+bw/2,66,{align:'center'});
    bx+=bw+4;
  });
  autoTable(doc,{startY:79,head:[['#','Date','Category','Description','Amount']],
    body:expenses.map((e,i)=>[i+1,e.date,dispCat(e),e.description||'—',`₹${e.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}`]),
    theme:'plain',
    styles:{font:'helvetica',fontSize:9,cellPadding:{top:4,bottom:4,left:5,right:5},textColor:[245,240,232],lineColor:[55,42,28],lineWidth:0.3},
    headStyles:{fillColor:[44,33,24],textColor:[212,168,83],fontStyle:'bold',fontSize:8},
    alternateRowStyles:{fillColor:[30,23,16]},bodyStyles:{fillColor:[26,20,16]},
    columnStyles:{0:{halign:'center',cellWidth:10,textColor:[100,85,65]},1:{cellWidth:30},2:{cellWidth:35},3:{cellWidth:'auto'},4:{halign:'right',cellWidth:38,textColor:[212,168,83],fontStyle:'bold'}},
    margin:{left:16,right:16}});
  doc.save(`ledger_report_${Date.now()}.pdf`);
};

// ─── Login ────────────────────────────────────────────────────────
const LoginPage = ({ onLogin }) => {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name:'', email:'', password:'' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true); setError('');
    await new Promise(r=>setTimeout(r,300));
    try {
      const data = loadData();
      if (mode === 'register') {
        if (!form.name.trim()) { setError('Name is required'); return; }
        if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
        const hash = await hashPassword(form.password);
        const user = { id: genId(), name: form.name.trim(), email: form.email.toLowerCase() };
        saveData({ user, passwordHash: hash, expenses: PRELOADED_EXPENSES });
        onLogin(user);
      } else {
        if (!data.user) { setError('No account found. Please register first.'); return; }
        if (data.user.email !== form.email.toLowerCase()) { setError('Invalid email or password'); return; }
        const hash = await hashPassword(form.password);
        if (data.passwordHash !== hash) { setError('Invalid email or password'); return; }
        onLogin(data.user);
      }
    } catch { setError('Something went wrong'); } finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1410',padding:'20px',position:'relative',overflow:'hidden'}}>
      {/* BG orbs */}
      <div style={{position:'absolute',inset:0,pointerEvents:'none',overflow:'hidden'}}>
        <motion.div style={{position:'absolute',width:500,height:500,borderRadius:'50%',background:'radial-gradient(circle, rgba(212,168,83,0.07) 0%, transparent 70%)',top:'-120px',right:'-120px'}}
          animate={{scale:[1,1.1,1],rotate:[0,15,0]}} transition={{duration:8,repeat:Infinity,ease:'easeInOut'}}/>
        <motion.div style={{position:'absolute',width:300,height:300,borderRadius:'50%',background:'radial-gradient(circle, rgba(212,168,83,0.05) 0%, transparent 70%)',bottom:'-60px',left:'-60px'}}
          animate={{scale:[1,1.15,1]}} transition={{duration:6,repeat:Infinity,ease:'easeInOut',delay:2}}/>
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0.05}} xmlns="http://www.w3.org/2000/svg">
          <defs><pattern id="g" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#d4a853" strokeWidth="0.5"/>
          </pattern></defs>
          <rect width="100%" height="100%" fill="url(#g)"/>
        </svg>
      </div>

      <motion.div style={{position:'relative',zIndex:1,width:'100%',maxWidth:'420px'}}
        initial={{opacity:0,y:40}} animate={{opacity:1,y:0}} transition={{duration:0.7,ease:[0.22,1,0.36,1]}}>

        {/* Brand */}
        <motion.div style={{textAlign:'center',marginBottom:'36px'}}
          initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}} transition={{delay:0.2,duration:0.6}}>
          <div style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:64,height:64,borderRadius:'18px',background:'rgba(212,168,83,0.15)',border:'1px solid rgba(212,168,83,0.2)',marginBottom:'16px'}}>
            <TrendingUp size={28} color="#d4a853"/>
          </div>
          <h1 style={{fontFamily:'"DM Serif Display",Georgia,serif',fontSize:'44px',color:'#f5f0e8',lineHeight:1,marginBottom:'6px',letterSpacing:'-0.5px'}}>Ledger</h1>
          <p style={{color:'#7d6e5c',fontSize:'13px',letterSpacing:'0.02em'}}>Personal expense intelligence</p>
        </motion.div>

        {/* Card */}
        <motion.div style={{background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)',borderRadius:'20px',padding:'32px',boxShadow:'0 32px 80px rgba(0,0,0,0.5)'}}
          initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}} transition={{delay:0.3,duration:0.6}}>

          {/* Tabs */}
          <div style={{display:'flex',borderRadius:'10px',padding:'4px',background:'rgba(255,255,255,0.03)',marginBottom:'24px'}}>
            {['login','register'].map(tab=>(
              <button key={tab} onClick={()=>{setMode(tab);setError('');}}
                style={{flex:1,padding:'9px',borderRadius:'7px',fontSize:'13px',fontWeight:500,border:'none',cursor:'pointer',transition:'all .2s',
                  background:mode===tab?'#d4a853':'transparent', color:mode===tab?'#1a1410':'#7d6e5c'}}>
                {tab==='login'?'Sign In':'Register'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form key={mode} onSubmit={handleSubmit}
              initial={{opacity:0,x:mode==='login'?-16:16}} animate={{opacity:1,x:0}} exit={{opacity:0}} transition={{duration:0.2}}>

              {mode==='register' && (
                <div style={{marginBottom:'16px'}}>
                  <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#b8ae9f',marginBottom:'7px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Full Name</label>
                  <input type="text" className="input-field" placeholder="Your name" value={form.name}
                    onChange={e=>setForm(f=>({...f,name:e.target.value}))} required/>
                </div>
              )}

              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#b8ae9f',marginBottom:'7px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Email Address</label>
                <input type="email" className="input-field" placeholder="you@example.com" value={form.email}
                  onChange={e=>setForm(f=>({...f,email:e.target.value}))} required/>
              </div>

              <div style={{marginBottom:'24px'}}>
                <label style={{display:'block',fontSize:'11px',fontWeight:600,color:'#b8ae9f',marginBottom:'7px',textTransform:'uppercase',letterSpacing:'0.05em'}}>Password</label>
                <div style={{position:'relative'}}>
                  <input type={showPass?'text':'password'} className="input-field" style={{paddingRight:'42px'}}
                    placeholder={mode==='register'?'Min 6 characters':'••••••••'} value={form.password}
                    onChange={e=>setForm(f=>({...f,password:e.target.value}))} required/>
                  <button type="button" onClick={()=>setShowPass(s=>!s)}
                    style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#7d6e5c',display:'flex',padding:0}}>
                    {showPass?<EyeOff size={15}/>:<Eye size={15}/>}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0}}
                    style={{marginBottom:'16px',padding:'10px 14px',borderRadius:'8px',fontSize:'13px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.3)',color:'#e74c3c'}}>
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <motion.button type="submit" disabled={loading}
                style={{width:'100%',padding:'13px',borderRadius:'9px',fontSize:'14px',fontWeight:600,border:'none',cursor:loading?'not-allowed':'pointer',
                  background:'#d4a853',color:'#1a1410',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',opacity:loading?0.7:1,transition:'all .2s'}}
                whileHover={!loading?{scale:1.01,boxShadow:'0 8px 24px rgba(212,168,83,0.3)'}:{}}
                whileTap={!loading?{scale:0.98}:{}}>
                {loading?<><Loader2 size={15} className="animate-spin"/>{mode==='login'?'Signing in...':'Creating...'}</>:mode==='login'?'Sign In':'Create Account'}
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
  const [customDate, setCustomDate] = useState({ from:'', to:'' });
  const [showPdf, setShowPdf] = useState(false);
  const [pdfRange, setPdfRange] = useState({ from:'', to:todayStr() });
  const [addForm, setAddForm] = useState({ amount:'',category:'Food',manual_category:'',description:'',date:todayStr() });
  const [addState, setAddState] = useState('idle');
  const [addError, setAddError] = useState('');
  const [showAll, setShowAll] = useState(false);

  useEffect(()=>{ setExpenses(loadData().expenses||[]); },[]);

  const saveExp = (list) => { setExpenses(list); const d=loadData(); saveData({...d,expenses:list}); };

  const filtered = useMemo(()=>{
    const d=new Date(); const today=todayStr();
    const ws=new Date(d); ws.setDate(d.getDate()-d.getDay()); const weekStart=ws.toISOString().split('T')[0];
    const mp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const yp=`${d.getFullYear()}`;
    let list=[...expenses];
    if(filter==='today') list=list.filter(e=>e.date===today);
    else if(filter==='week') list=list.filter(e=>e.date>=weekStart);
    else if(filter==='month') list=list.filter(e=>e.date.startsWith(mp));
    else if(filter==='year') list=list.filter(e=>e.date.startsWith(yp));
    else if(filter==='custom'){
      if(customDate.from) list=list.filter(e=>e.date>=customDate.from);
      if(customDate.to) list=list.filter(e=>e.date<=customDate.to);
    }
    return list.sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  },[expenses,filter,customDate]);

  const summary = useMemo(()=>{
    const d=new Date(); const today=todayStr();
    const ws=new Date(d); ws.setDate(d.getDate()-d.getDay()); const weekStart=ws.toISOString().split('T')[0];
    const mp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const yp=`${d.getFullYear()}`;
    const sum=fn=>expenses.filter(fn).reduce((s,e)=>s+e.amount,0);
    const cats={};
    expenses.filter(e=>e.date.startsWith(mp)).forEach(e=>{const k=dispCat(e);cats[k]=(cats[k]||0)+e.amount;});
    return {
      today:sum(e=>e.date===today), week:sum(e=>e.date>=weekStart),
      month:sum(e=>e.date.startsWith(mp)), year:sum(e=>e.date.startsWith(yp)),
      cats:Object.entries(cats).sort((a,b)=>b[1]-a[1]).map(([cat,total])=>({cat,total})),
    };
  },[expenses]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if(!addForm.amount||parseFloat(addForm.amount)<=0){setAddError('Enter a valid amount');return;}
    if(addForm.category==='Others'&&!addForm.manual_category.trim()){setAddError('Specify the category name');return;}
    setAddState('saving'); setAddError('');
    await new Promise(r=>setTimeout(r,400));
    const exp={id:genId(),amount:parseFloat(addForm.amount),category:addForm.category,
      manual_category:addForm.category==='Others'?addForm.manual_category.trim():null,
      description:addForm.description.trim(),date:addForm.date};
    saveExp([exp,...expenses]);
    setAddState('done');
    setAddForm({amount:'',category:'Food',manual_category:'',description:'',date:todayStr()});
    setTimeout(()=>setAddState('idle'),1500);
  };

  const FILTER_CARDS = [
    {key:'today',label:'Today',icon:Clock,color:'#e67e22'},
    {key:'week',label:'This Week',icon:CalendarDays,color:'#3498db'},
    {key:'month',label:'This Month',icon:CalendarRange,color:'#d4a853'},
    {key:'year',label:'This Year',icon:Calendar,color:'#9b59b6'},
  ];

  const visible = showAll ? filtered : filtered.slice(0,8);
  const filterLabel = {today:'Today',week:'This Week',month:'This Month',year:'This Year',custom:'Custom Range'}[filter]||'Expenses';
  const totalFiltered = filtered.reduce((s,e)=>s+e.amount,0);
  const illFilter = filter==='custom'?'month':filter;

  return (
    <div style={{minHeight:'100vh',background:'#1a1410'}}>
      {/* Header */}
      <header style={{position:'sticky',top:0,zIndex:40,background:'rgba(26,20,16,0.93)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(212,168,83,0.12)'}}>
        <div style={{maxWidth:'1100px',margin:'0 auto',padding:'0 20px',height:'56px',display:'flex',alignItems:'center',gap:'12px'}}>
          {/* Brand */}
          <div style={{display:'flex',alignItems:'center',gap:'10px',flexShrink:0}}>
            <div style={{width:28,height:28,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(212,168,83,0.15)',border:'1px solid rgba(212,168,83,0.2)'}}>
              <TrendingUp size={14} color="#d4a853"/>
            </div>
            <div style={{display:'none'}} className="sm-show">
              <p style={{fontSize:'10px',color:'#7d6e5c',lineHeight:1,marginBottom:'2px'}}>Welcome back,</p>
              <p style={{fontFamily:'"DM Serif Display",Georgia,serif',fontSize:'14px',color:'#f5f0e8',lineHeight:1}}>{user.name}</p>
            </div>
          </div>
          {/* Nav */}
          <div style={{flex:1,display:'flex',justifyContent:'center'}}>
            <nav style={{display:'inline-flex',borderRadius:'8px',padding:'3px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(212,168,83,0.12)'}}>
              {[{key:'summary',label:'Summary',Icon:LayoutDashboard},{key:'add',label:'Add Entry',Icon:PlusCircle}].map(({key,label,Icon})=>(
                <button key={key} onClick={()=>setView(key)}
                  style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 14px',borderRadius:'6px',fontSize:'12px',fontWeight:500,border:'none',cursor:'pointer',transition:'all .2s',
                    background:view===key?'#d4a853':'transparent',color:view===key?'#1a1410':'#7d6e5c'}}>
                  <Icon size={12}/>{label}
                </button>
              ))}
            </nav>
          </div>
          {/* Actions */}
          <div style={{display:'flex',gap:'8px',flexShrink:0}}>
            <motion.button onClick={()=>setShowPdf(true)}
              style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 12px',borderRadius:'8px',fontSize:'12px',fontWeight:500,border:'1px solid rgba(212,168,83,0.2)',background:'rgba(212,168,83,0.12)',color:'#d4a853',cursor:'pointer'}}
              whileHover={{scale:1.03}} whileTap={{scale:0.97}}>
              <Download size={12}/>PDF
            </motion.button>
            <motion.button onClick={onLogout}
              style={{display:'flex',alignItems:'center',gap:'6px',padding:'7px 12px',borderRadius:'8px',fontSize:'12px',border:'1px solid rgba(212,168,83,0.12)',background:'rgba(255,255,255,0.03)',color:'#7d6e5c',cursor:'pointer'}}
              whileHover={{color:'#e74c3c',borderColor:'rgba(192,57,43,0.3)'}} whileTap={{scale:0.97}}>
              <LogOut size={12}/>Sign out
            </motion.button>
          </div>
        </div>
      </header>

      <main style={{maxWidth:'1100px',margin:'0 auto',padding:'24px 20px'}}>
        <AnimatePresence mode="wait">

          {view==='summary' && (
            <motion.div key="sum" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}} transition={{duration:0.3}}>
              {/* Summary cards */}
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
                {FILTER_CARDS.map(({key,label,icon:Icon,color},i)=>(
                  <motion.button key={key} onClick={()=>{setFilter(key);setShowAll(false);}}
                    style={{textAlign:'left',borderRadius:'12px',padding:'16px',cursor:'pointer',border:`1px solid ${filter===key?color+'55':'rgba(212,168,83,0.12)'}`,
                      background:filter===key?`linear-gradient(135deg,${color}22,${color}08)`:'#2c2118',
                      boxShadow:filter===key?`0 0 24px ${color}18`:'none',position:'relative'}}
                    initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*.07}}
                    whileHover={{y:-2}} whileTap={{scale:0.97}}>
                    {filter===key&&<motion.div layoutId="dot" style={{position:'absolute',top:10,right:10,width:7,height:7,borderRadius:'50%',background:color}}/>}
                    <div style={{width:32,height:32,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:`${color}18`,marginBottom:'10px'}}>
                      <Icon size={14} color={color}/>
                    </div>
                    <p style={{fontSize:'11px',fontWeight:500,color:filter===key?color:'#7d6e5c',marginBottom:'4px'}}>{label}</p>
                    <p style={{fontFamily:'"JetBrains Mono","Courier New",monospace',fontSize:'17px',fontWeight:600,color:filter===key?'#f5f0e8':'#b8ae9f',lineHeight:1}}>
                      {fmtAmt(summary[key])}
                    </p>
                  </motion.button>
                ))}
              </div>

              {/* Grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:'20px',alignItems:'start'}}>
                {/* List */}
                <div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
                    <div>
                      <h2 style={{fontFamily:'"DM Serif Display",Georgia,serif',fontSize:'20px',color:'#f5f0e8',lineHeight:1.2}}>{filterLabel}</h2>
                      {filtered.length>0&&<p style={{fontFamily:'"JetBrains Mono","Courier New",monospace',fontSize:'11px',color:'#7d6e5c',marginTop:'3px'}}>
                        {filtered.length} transactions · <span style={{color:'#d4a853'}}>₹{totalFiltered.toLocaleString('en-IN',{minimumFractionDigits:2})}</span>
                      </p>}
                    </div>
                  </div>

                  {filtered.length===0?(
                    <div style={{textAlign:'center',padding:'60px 0'}}>
                      <div style={{width:52,height:52,borderRadius:'16px',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 12px',background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)'}}>
                        <Tag size={22} color="#7d6e5c"/>
                      </div>
                      <p style={{color:'#b8ae9f',fontWeight:500}}>No expenses found</p>
                      <p style={{color:'#7d6e5c',fontSize:'13px',marginTop:'4px'}}>Switch filter or add a new expense</p>
                    </div>
                  ):(
                    <>
                      <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                        <AnimatePresence mode="popLayout">
                          {visible.map(exp=>{
                            const cfg=CAT[exp.category]||CAT.Others; const dc=dispCat(exp);
                            return (
                              <motion.div key={exp.id} layout
                                initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,x:-20}} transition={{duration:0.25}}
                                style={{display:'flex',alignItems:'center',gap:'12px',padding:'12px 14px',borderRadius:'12px',background:'#2c2118',border:'1px solid rgba(212,168,83,0.1)',position:'relative'}}
                                whileHover={{borderColor:'rgba(212,168,83,0.25)',y:-1,boxShadow:'0 4px 20px rgba(0,0,0,0.2)'}}>
                                <div style={{width:36,height:36,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,background:`${cfg.color}18`}}>
                                  <cfg.Icon size={15} color={cfg.color}/>
                                </div>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px',flexWrap:'wrap'}}>
                                    <span style={{fontSize:'13px',fontWeight:500,color:'#f5f0e8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{exp.description||dc}</span>
                                    <span className={cfg.tag} style={{padding:'2px 7px',borderRadius:'4px',fontSize:'10px',fontWeight:500,flexShrink:0}}>{dc}</span>
                                  </div>
                                  <p style={{fontFamily:'"JetBrains Mono","Courier New",monospace',fontSize:'11px',color:'#7d6e5c'}}>
                                    {new Date(exp.date+'T00:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'})}
                                  </p>
                                </div>
                                <p style={{fontFamily:'"JetBrains Mono","Courier New",monospace',fontSize:'15px',fontWeight:600,color:'#d4a853',flexShrink:0}}>
                                  ₹{exp.amount.toLocaleString('en-IN',{minimumFractionDigits:2})}
                                </p>
                                <motion.button onClick={()=>saveExp(expenses.filter(e=>e.id!==exp.id))}
                                  style={{padding:'6px',borderRadius:'6px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.2)',color:'#e74c3c',cursor:'pointer',flexShrink:0}}
                                  whileHover={{scale:1.08}} whileTap={{scale:0.92}}>
                                  <Trash2 size={12}/>
                                </motion.button>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                      {filtered.length>8&&(
                        <button onClick={()=>setShowAll(s=>!s)}
                          style={{width:'100%',marginTop:'10px',padding:'10px',borderRadius:'10px',fontSize:'12px',background:'rgba(255,255,255,0.02)',border:'1px solid rgba(212,168,83,0.1)',color:'#7d6e5c',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
                          {showAll?<><ChevronUp size={13}/>Show less</>:<><ChevronDown size={13}/>Show {filtered.length-8} more</>}
                        </button>
                      )}
                    </>
                  )}
                </div>

                {/* Sidebar */}
                <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
                  {/* Illustration */}
                  <div style={{background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)',borderRadius:'14px',padding:'16px',display:'flex',flexDirection:'column',alignItems:'center'}}>
                    <p style={{fontSize:'11px',fontWeight:500,color:'#7d6e5c',marginBottom:'10px',alignSelf:'flex-start'}}>Period View</p>
                    <AnimatePresence mode="wait">
                      <Illustration key={illFilter} filter={illFilter}/>
                    </AnimatePresence>
                  </div>

                  {/* Custom date */}
                  <div style={{background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)',borderRadius:'14px',padding:'16px'}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'12px'}}>
                      <Calendar size={13} color="#d4a853"/>
                      <span style={{fontSize:'11px',fontWeight:500,color:'#b8ae9f'}}>Custom Filter</span>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                      <div>
                        <label style={{fontSize:'10px',color:'#7d6e5c',marginBottom:'4px',display:'block'}}>From</label>
                        <input type="date" className="input-field" style={{fontSize:'12px',padding:'8px 10px',fontFamily:'"JetBrains Mono","Courier New",monospace'}}
                          value={customDate.from} onChange={e=>setCustomDate(d=>({...d,from:e.target.value}))}/>
                      </div>
                      <div>
                        <label style={{fontSize:'10px',color:'#7d6e5c',marginBottom:'4px',display:'block'}}>To</label>
                        <input type="date" className="input-field" style={{fontSize:'12px',padding:'8px 10px',fontFamily:'"JetBrains Mono","Courier New",monospace'}}
                          value={customDate.to} onChange={e=>setCustomDate(d=>({...d,to:e.target.value}))}/>
                      </div>
                      <motion.button onClick={()=>{setFilter('custom');setShowAll(false);}}
                        style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',padding:'8px',borderRadius:'8px',fontSize:'12px',fontWeight:500,border:'none',cursor:'pointer',background:'rgba(212,168,83,0.12)',color:'#d4a853'}}
                        whileHover={{scale:1.02}} whileTap={{scale:0.97}}>
                        <Search size={12}/>Apply
                      </motion.button>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {summary.cats.length>0&&(
                    <div style={{background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)',borderRadius:'14px',padding:'16px'}}>
                      <p style={{fontSize:'11px',fontWeight:500,color:'#b8ae9f',marginBottom:'14px'}}>This Month by Category</p>
                      <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                        {summary.cats.map((item,i)=>{
                          const pct=summary.month>0?(item.total/summary.month)*100:0;
                          const color=(CAT[item.cat]||CAT.Others).color;
                          return (<div key={item.cat}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:'4px'}}>
                              <span style={{fontSize:'11px',color:'#b8ae9f'}}>{item.cat}</span>
                              <span style={{fontFamily:'"JetBrains Mono","Courier New",monospace',fontSize:'11px',color}}>{fmtAmt(item.total)}</span>
                            </div>
                            <div style={{height:'5px',borderRadius:'3px',background:'rgba(255,255,255,0.05)',overflow:'hidden'}}>
                              <motion.div style={{height:'100%',borderRadius:'3px',background:color}}
                                initial={{width:0}} animate={{width:`${pct}%`}} transition={{delay:i*.1,duration:0.6,ease:'easeOut'}}/>
                            </div>
                          </div>);
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {view==='add' && (
            <motion.div key="add" initial={{opacity:0,y:16}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-16}} transition={{duration:0.3}}
              style={{maxWidth:'640px',margin:'0 auto'}}>
              <div style={{background:'#2c2118',border:'1px solid rgba(212,168,83,0.12)',borderRadius:'20px',padding:'32px'}}>
                <h2 style={{fontFamily:'"DM Serif Display",Georgia,serif',fontSize:'26px',color:'#f5f0e8',marginBottom:'6px'}}>Log Expense</h2>
                <p style={{color:'#7d6e5c',fontSize:'13px',marginBottom:'28px'}}>Record a new expense entry.</p>
                <form onSubmit={handleAdd} autoComplete="off">
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                    <div>
                      <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'#b8ae9f'}}>Amount (₹)</label>
                      <div style={{position:'relative'}}>
                        <span style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',color:'#d4a853',fontFamily:'"JetBrains Mono","Courier New",monospace',fontWeight:600,pointerEvents:'none'}}>₹</span>
                        <input type="number" className="input-field" style={{paddingLeft:'28px',fontSize:'15px',fontFamily:'"JetBrains Mono","Courier New",monospace'}}
                          placeholder="0.00" value={addForm.amount} min="0" step="0.01" required
                          onChange={e=>setAddForm(f=>({...f,amount:e.target.value}))}/>
                      </div>
                    </div>
                    <div>
                      <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'#b8ae9f'}}>Date</label>
                      <input type="date" className="input-field" style={{fontFamily:'"JetBrains Mono","Courier New",monospace'}} value={addForm.date} required
                        onChange={e=>setAddForm(f=>({...f,date:e.target.value}))}/>
                    </div>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'16px'}}>
                    <div>
                      <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'#b8ae9f'}}>Category</label>
                      <div style={{position:'relative'}}>
                        <select className="select-field" value={addForm.category} onChange={e=>setAddForm(f=>({...f,category:e.target.value,manual_category:''}))}>
                          {['Food','Travel','Entertainment','Others'].map(c=><option key={c} value={c}>{c}</option>)}
                        </select>
                        <div style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',width:'8px',height:'8px',borderRadius:'50%',background:(CAT[addForm.category]||CAT.Others).color,pointerEvents:'none'}}/>
                      </div>
                    </div>
                    <AnimatePresence mode="wait">
                      {addForm.category==='Others'?(
                        <motion.div key="m" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}>
                          <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'#b8ae9f'}}>Specify *</label>
                          <input type="text" className="input-field" placeholder="e.g. Healthcare…" value={addForm.manual_category}
                            onChange={e=>setAddForm(f=>({...f,manual_category:e.target.value}))} required/>
                        </motion.div>
                      ):<div key="sp"/>}
                    </AnimatePresence>
                  </div>
                  <div style={{marginBottom:'24px'}}>
                    <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'8px',color:'#b8ae9f'}}>Description <span style={{textTransform:'none',fontWeight:400,fontSize:'11px',color:'#7d6e5c'}}>(optional)</span></label>
                    <input type="text" className="input-field" placeholder="What was this for?" value={addForm.description}
                      onChange={e=>setAddForm(f=>({...f,description:e.target.value}))}/>
                  </div>
                  {addError&&<div style={{marginBottom:'16px',padding:'10px 14px',borderRadius:'10px',fontSize:'13px',background:'rgba(192,57,43,0.1)',border:'1px solid rgba(192,57,43,0.3)',color:'#e74c3c'}}>{addError}</div>}
                  <div style={{borderTop:'1px solid rgba(212,168,83,0.12)',paddingTop:'20px',display:'flex',alignItems:'center',gap:'12px'}}>
                    <motion.button type="submit" disabled={addState!=='idle'}
                      style={{padding:'12px 28px',borderRadius:'9px',fontSize:'15px',fontWeight:600,border:'none',cursor:addState!=='idle'?'not-allowed':'pointer',minWidth:'160px',
                        display:'flex',alignItems:'center',justifyContent:'center',gap:'8px',transition:'all .2s',
                        background:addState==='done'?'#2ecc71':'#d4a853',color:addState==='done'?'#fff':'#1a1410',opacity:addState==='saving'?0.7:1}}
                      whileHover={addState==='idle'?{scale:1.02,boxShadow:'0 8px 24px rgba(212,168,83,0.3)'}:{}} whileTap={addState==='idle'?{scale:0.97}:{}}>
                      {addState==='saving'?<><Loader2 size={15} className="animate-spin"/>Saving…</>:addState==='done'?<><Check size={15}/>Saved!</>:<><PlusCircle size={15}/>Add Expense</>}
                    </motion.button>
                    {addState==='done'&&<motion.p initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} style={{fontSize:'13px',color:'#2ecc71'}}>Expense recorded!</motion.p>}
                  </div>
                </form>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* PDF Modal */}
      <AnimatePresence>
        {showPdf&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:50,display:'flex',alignItems:'center',justifyContent:'center',padding:'16px',background:'rgba(0,0,0,0.75)',backdropFilter:'blur(6px)'}}
            onClick={e=>e.target===e.currentTarget&&setShowPdf(false)}>
            <motion.div style={{width:'100%',maxWidth:'380px',background:'#2c2118',border:'1px solid rgba(212,168,83,0.15)',borderRadius:'20px',padding:'24px',boxShadow:'0 32px 80px rgba(0,0,0,0.6)'}}
              initial={{scale:0.92,y:20,opacity:0}} animate={{scale:1,y:0,opacity:1}} exit={{scale:0.92,y:20,opacity:0}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                  <div style={{width:32,height:32,borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(212,168,83,0.15)'}}><FileDown size={14} color="#d4a853"/></div>
                  <div>
                    <p style={{fontFamily:'"DM Serif Display",Georgia,serif',fontSize:'15px',color:'#f5f0e8'}}>Download Report</p>
                    <p style={{fontSize:'11px',color:'#7d6e5c'}}>Select date range for PDF</p>
                  </div>
                </div>
                <button onClick={()=>setShowPdf(false)} style={{background:'none',border:'none',cursor:'pointer',color:'#7d6e5c'}}><X size={15}/></button>
              </div>
              <div style={{borderTop:'1px solid rgba(212,168,83,0.1)',marginBottom:'16px'}}/>
              {['from','to'].map(key=>(
                <div key={key} style={{marginBottom:'12px'}}>
                  <label style={{display:'block',fontSize:'10px',fontWeight:600,textTransform:'uppercase',letterSpacing:'.05em',marginBottom:'6px',color:'#b8ae9f'}}>{key==='from'?'From Date':'To Date'}</label>
                  <div style={{position:'relative'}}>
                    <Calendar size={12} style={{position:'absolute',left:'10px',top:'50%',transform:'translateY(-50%)',color:'#7d6e5c',pointerEvents:'none'}}/>
                    <input type="date" className="input-field" style={{paddingLeft:'28px',fontSize:'13px',fontFamily:'"JetBrains Mono","Courier New",monospace'}}
                      value={pdfRange[key]} max={todayStr()} onChange={e=>setPdfRange(r=>({...r,[key]:e.target.value}))}/>
                  </div>
                </div>
              ))}
              <div style={{display:'flex',gap:'10px',marginTop:'4px'}}>
                <button onClick={()=>setShowPdf(false)}
                  style={{flex:1,padding:'10px',borderRadius:'8px',fontSize:'13px',fontWeight:500,background:'rgba(255,255,255,0.04)',border:'1px solid rgba(212,168,83,0.12)',color:'#7d6e5c',cursor:'pointer'}}>Cancel</button>
                <motion.button onClick={()=>{
                    const list=expenses.filter(e=>(!pdfRange.from||e.date>=pdfRange.from)&&(!pdfRange.to||e.date<=pdfRange.to)).sort((a,b)=>a.date.localeCompare(b.date));
                    exportPDF(list,pdfRange.from,pdfRange.to,user.name); setShowPdf(false);
                  }}
                  style={{flex:1,padding:'10px',borderRadius:'8px',fontSize:'13px',fontWeight:600,border:'none',cursor:'pointer',background:'#d4a853',color:'#1a1410',display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}
                  whileHover={{scale:1.02}} whileTap={{scale:0.97}}>
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

  useEffect(()=>{
    const session = sessionStorage.getItem('ledger_session');
    if(session){ try{ setUser(JSON.parse(session)); }catch{} }
    setBooting(false);
  },[]);

  const handleLogin = (u) => { sessionStorage.setItem('ledger_session',JSON.stringify(u)); setUser(u); };
  const handleLogout = () => { sessionStorage.removeItem('ledger_session'); setUser(null); };

  if(booting) return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1410'}}>
      <motion.div style={{width:32,height:32,borderRadius:'50%',border:'2px solid #d4a853',borderTopColor:'transparent'}}
        animate={{rotate:360}} transition={{duration:.8,repeat:Infinity,ease:'linear'}}/>
    </div>
  );

  return (
    <AnimatePresence mode="wait">
      {user
        ? <motion.div key="d" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.3}}><Dashboard user={user} onLogout={handleLogout}/></motion.div>
        : <motion.div key="l" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:.3}}><LoginPage onLogin={handleLogin}/></motion.div>
      }
    </AnimatePresence>
  );
}
