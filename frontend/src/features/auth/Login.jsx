import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, ShieldCheck, Moon, Sun } from 'lucide-react';
import { api } from '../../services/api';
import { useThemePreference } from '../../hooks/useThemePreference';

const demoAccounts = [
    { role: 'Root admin demo', email: 'root@eduai.demo', password: 'Root@12345' },
    { role: 'Student demo', email: 'student@eduai.demo', password: 'Student@123' },
    { role: 'Admin demo', email: 'admin@eduai.demo', password: 'Admin@123' },
];

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const nav = useNavigate();
    const { mode, toggleMode } = useThemePreference('admin');
    const ModeIcon = mode === 'dark' ? Sun : Moon;

    async function submit(event) {
        event.preventDefault();
        setBusy(true);
        setError('');
        try {
            const result = await api('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            });
            localStorage.setItem('eduai_token', result.token);
            localStorage.setItem('eduai_user', JSON.stringify(result.user));
            nav(result.user.role === 'root-admin' ? '/root-control' : '/dashboard', { replace: true });
        } catch (loginError) {
            setError(loginError.message);
        } finally {
            setBusy(false);
        }
    }

    return <div className="login-page" data-palette="admin" data-mode={mode}>
      <button className="theme-toggle login-theme-toggle" type="button" onClick={toggleMode} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}><ModeIcon size={16}/><span>{mode === 'dark' ? 'Light' : 'Dark'} mode</span></button>
      <div className="login-art"><div className="brand"><div className="brand-mark"><BrainCircuit /></div><b>EduAI <span>Nexus</span></b></div><div className="orb orb1"/><div className="orb orb2"/><div className="login-copy"><div className="eyebrow">INTELLIGENCE FOR STUDENT SUCCESS</div><h1>See the signals.<br /><span>Support every</span><br />student.</h1><p>Unify campus data into explainable insights and timely, human-centered interventions.</p><div className="trust-note"><ShieldCheck size={17}/> Privacy-first · Explainable · Evidence-led</div></div><div className="login-foot">EDUAI NEXUS · SMART CAMPUS ANALYTICS</div></div>
      <div className="login-form-wrap"><form className="login-form" onSubmit={submit}><div className="form-icon"><BrainCircuit /></div><h2>Welcome back</h2><p>Sign in to your campus workspace.</p><label>Email ID<input type="email" value={email} onChange={event => setEmail(event.target.value)} required placeholder="student@eduai.demo"/></label><label>Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required placeholder="Enter your password"/></label>{error && <div className="error-box" role="alert">{error}</div>}<button className="primary-btn full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in securely'}</button>
        <div className="demo-accounts" aria-label="Predefined demo accounts"><b>Predefined demo accounts</b><small>No database · predefined synthetic dataset</small>{demoAccounts.map(account => <button key={account.email} type="button" className="demo-account" onClick={() => { setEmail(account.email); setPassword(account.password); setError(''); }}><span>{account.role}</span><code>{account.email}</code><code>{account.password}</code></button>)}</div>
        <small className="muted">Demo passwords are public, not secure credentials. Accounts and changes are in-memory demo data and reset when the backend restarts. Never use real credentials or institutional records.</small>
      </form></div>
    </div>;
}
