import {useState} from 'react';import {useNavigate} from 'react-router-dom';import {BrainCircuit,ShieldCheck,Moon,Sun} from 'lucide-react';import {api} from '../../services/api';import {useThemePreference} from '../../hooks/useThemePreference';
export default function Login(){
  const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const nav=useNavigate();
  const {mode,toggleMode}=useThemePreference('admin');
  const ModeIcon=mode==='dark'?Sun:Moon;
  async function submit(e:React.FormEvent){
    e.preventDefault();setBusy(true);setError('');
    try{
      const r=await api<any>('/auth/login',{method:'POST',body:JSON.stringify({email,password})});
      localStorage.setItem('eduai_token',r.token);localStorage.setItem('eduai_user',JSON.stringify(r.user));nav('/dashboard');
    }catch(err:any){setError(err.message+' — start the backend and create an account with the documented seed process.');}
    finally{setBusy(false);}
  }
  return <div className="login-page" data-palette="admin" data-mode={mode}>
    <button className="theme-toggle login-theme-toggle" type="button" onClick={toggleMode} aria-label={`Switch to ${mode==='dark'?'light':'dark'} mode`} title={`Switch to ${mode==='dark'?'light':'dark'} mode`}><ModeIcon size={16}/><span>{mode==='dark'?'Light':'Dark'} mode</span></button>
    <div className="login-art"><div className="brand"><div className="brand-mark"><BrainCircuit/></div><b>EduAI <span>Nexus</span></b></div><div className="orb orb1"/><div className="orb orb2"/><div className="login-copy"><div className="eyebrow">INTELLIGENCE FOR STUDENT SUCCESS</div><h1>See the signals.<br/><span>Support every</span><br/>student.</h1><p>Unify campus data into explainable insights and timely, human-centered interventions.</p><div className="trust-note"><ShieldCheck size={17}/> Privacy-first · Explainable · Evidence-led</div></div><div className="login-foot">EDUAI NEXUS · SMART CAMPUS ANALYTICS</div></div>
    <div className="login-form-wrap"><form className="login-form" onSubmit={submit}><div className="form-icon"><BrainCircuit/></div><h2>Welcome back</h2><p>Sign in to your campus workspace.</p><label>Institution email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="you@college.edu"/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required placeholder="Enter your password"/></label>{error&&<div className="error-box">{error}</div>}<button className="primary-btn full" disabled={busy}>{busy?'Signing in…':'Sign in securely'}</button><small className="muted">Accounts are provisioned by your institution administrator.</small></form></div>
  </div>;
}
