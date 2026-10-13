import { useEffect, useState } from 'react';
import { Activity, Database, ShieldCheck, Users, UserPlus, RefreshCw, Power, Server, ClipboardList } from 'lucide-react';
import { api } from '../../services/api';

export default function RootAdmin() {
  const [overview, setOverview] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [logs, setLogs] = useState([]);
  const [system, setSystem] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({name:'', email:'', password:'', role:'admin', studentId:'S0003'});

  async function load() {
    setError('');
    try {
      const [o,a,l,s] = await Promise.all([
        api('/root-admin/overview'), api('/root-admin/accounts'), api('/root-admin/audit-logs'), api('/root-admin/system')
      ]);
      setOverview(o); setAccounts(a.items || []); setLogs(l.items || []); setSystem(s);
    } catch (e) { setError(e.message || 'Unable to load root-admin controls.'); }
  }
  useEffect(() => { load(); }, []);

  async function createAccount(e) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      const payload = {...form};
      if (payload.role !== 'student') delete payload.studentId;
      const result = await api('/root-admin/accounts', {method:'POST', body:JSON.stringify(payload)});
      setNotice(`${result.account.email} created. ${result.note}`);
      setForm({name:'',email:'',password:'',role:'admin',studentId:'S0003'});
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function toggleAccount(account) {
    setError(''); setNotice('');
    try {
      await api(`/root-admin/accounts/${encodeURIComponent(account.email)}/status`, {method:'PATCH',body:JSON.stringify({active:!account.active})});
      setNotice(`${account.email} ${account.active ? 'disabled' : 'enabled'}.`); await load();
    } catch(e) { setError(e.message); }
  }
  async function resetDemo() {
    if (!window.confirm('Reset demo interventions to the predefined sample data?')) return;
    setError(''); setNotice('');
    try { const r=await api('/root-admin/dataset/reset',{method:'POST'}); setNotice(r.note); await load(); }
    catch(e) { setError(e.message); }
  }
  const metric = (label,value,Icon,caption) => <article className="metric-card" key={label}><div className="metric-top"><span>{label}</span><Icon size={19}/></div><div className="metric-value">{value ?? '—'}</div><small>{caption}</small></article>;

  return <div className="page-stack">
    <div className="page-heading"><div><div className="eyebrow">PLATFORM GOVERNANCE</div><h1>Root Admin Control Center</h1><p>Manage demo access, inspect system health, and control predefined data.</p></div><button className="secondary-btn" onClick={load}><RefreshCw size={15}/> Refresh</button></div>
    {error && <div className="error-box" role="alert">{error}</div>}{notice && <div className="success-box" role="status">{notice}</div>}
    <div className="metric-grid">
      {metric('Active root admins',overview?.roles?.rootAdmins,ShieldCheck,'Protected top-level role')}
      {metric('Active administrators',overview?.roles?.admins,Users,'Can view campus-wide records')}
      {metric('Active student accounts',overview?.roles?.students,Users,'Student-specific access')}
      {metric('Predefined students',overview?.dataset?.students,Database,'Synthetic, read-only dataset')}
    </div>
    <div className="content-grid two-col">
      <section className="panel"><div className="panel-heading"><div><h2><UserPlus size={18}/> Create account</h2><p>Create a demo admin or link a login to an existing sample student.</p></div></div>
        <form className="stack-form" onSubmit={createAccount}>
          <label>Display name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Name"/></label>
          <label>Email ID<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="person@eduai.demo"/></label>
          <label>Temporary demo password<input type="password" required minLength={8} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>
          <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="admin">Admin</option><option value="student">Student</option></select></label>
          {form.role==='student' && <label>Predefined Student ID<select value={form.studentId} onChange={e=>setForm({...form,studentId:e.target.value})}>{Array.from({length:20},(_,i)=>`S${String(i+1).padStart(4,'0')}`).map(id=><option key={id} value={id}>{id}</option>)}</select><small>Must link to an existing predefined student record without an account.</small></label>}
          <button className="primary-btn" disabled={busy}>{busy?'Creating…':'Create demo account'}</button>
        </form>
        <p className="muted">Demo only: newly created accounts are kept in server memory and disappear after restart. Do not use real passwords or real student data.</p>
      </section>
      <section className="panel"><div className="panel-heading"><div><h2><Server size={18}/> System status</h2><p>Runtime and storage status from the backend.</p></div><span className="status-pill"><span className="live-dot"/> {system?.status || 'Checking'}</span></div>
        <div className="detail-list"><div><span>Service</span><b>{system?.service || '—'}</b></div><div><span>Database</span><b>{system?.database || '—'}</b></div><div><span>Storage</span><b>{system?.storage || '—'}</b></div><div><span>Node runtime</span><b>{system?.node || '—'}</b></div><div><span>Uptime</span><b>{system ? `${Math.floor(system.uptimeSeconds/60)}m ${system.uptimeSeconds%60}s` : '—'}</b></div><div><span>Environment</span><b>{system?.environment || '—'}</b></div></div>
        <div className="warning-note"><Activity size={16}/><span>{system?.warning || 'Loading system notes…'}</span></div>
        <button className="secondary-btn" onClick={resetDemo}><RefreshCw size={15}/> Reset demo interventions</button>
      </section>
    </div>
    <section className="panel"><div className="panel-heading"><div><h2><Users size={18}/> Account directory</h2><p>Only root admin can enable or disable demo accounts.</p></div><span className="count-pill">{accounts.length} accounts</span></div>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Account</th><th>Role</th><th>Linked student</th><th>Status</th><th>Control</th></tr></thead><tbody>{accounts.map(a=><tr key={a.email}><td><b>{a.name}</b><small>{a.email}</small></td><td><span className="role-pill">{a.role}</span></td><td>{a.studentId || '—'}</td><td><span className={`status-label ${a.active?'active':'inactive'}`}>{a.active?'Active':'Disabled'}</span></td><td><button className="table-action" disabled={a.role==='root-admin'} onClick={()=>toggleAccount(a)} title={a.active?'Disable account':'Enable account'}><Power size={15}/>{a.active?'Disable':'Enable'}</button></td></tr>)}</tbody></table></div>
    </section>
    <section className="panel"><div className="panel-heading"><div><h2><ClipboardList size={18}/> Security audit log</h2><p>Recent sign-ins and root-admin control actions.</p></div></div>
      {logs.length===0?<p className="muted">No activity recorded in this server session yet.</p>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead><tbody>{logs.slice(0,30).map(log=><tr key={log.id}><td>{new Date(log.at).toLocaleString()}</td><td>{log.actor}</td><td>{log.action}</td><td><code>{JSON.stringify(log.details||{})}</code></td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}
