import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BrainCircuit, Users, ChartNoAxesCombined, Database, ShieldAlert, ClipboardCheck, Settings, LogOut, GraduationCap, FileBarChart, Layers, Moon, Sun } from 'lucide-react';
import { useThemePreference } from '../../hooks/useThemePreference';
import { api, clearSession } from '../../services/api';

const allRoles = ['admin', 'faculty', 'student'];
const nav = [
    ['Overview', '/dashboard', ChartNoAxesCombined, allRoles],
    ['Learning & career', '/dashboard?view=features', BrainCircuit, allRoles],
    ['Students', '/students', Users, allRoles],
    ['Risk analysis', '/risk', ShieldAlert, ['admin', 'faculty']],
    ['Placement readiness', '/placement', GraduationCap, ['admin', 'faculty']],
    ['Segments', '/segments', Layers, ['admin', 'faculty']],
    ['Interventions', '/interventions', ClipboardCheck, ['admin', 'faculty']],
    ['Data integration', '/integration', Database, ['admin']],
    ['Score methodology', '/methodology', BrainCircuit, allRoles],
    ['Reports', '/reports', FileBarChart, ['admin', 'faculty']],
    ['Settings & audit', '/settings', Settings, ['admin']],
];

export function Shell({ children, user }) {
    const navigate = useNavigate();
    const { pathname, search } = useLocation();
    const isFeatureView = new URLSearchParams(search).get('view') === 'features';
    const role = String(user?.role || '').toLowerCase();
    const palette = isFeatureView || /^\/(risk|placement|segments)(\/|$)/.test(pathname) ? 'ai' : role === 'faculty' ? 'faculty' : role === 'student' ? 'student' : 'admin';
    const { mode, toggleMode } = useThemePreference(palette);
    const ModeIcon = mode === 'dark' ? Sun : Moon;

    async function signOut() {
        try {
            await api('/auth/logout', { method: 'POST' });
        } catch {
            // The JWT is stateless; clearing it locally still signs this browser out.
        } finally {
            clearSession();
            navigate('/login', { replace: true });
        }
    }

    return <div className="app-shell" data-palette={palette} data-mode={mode}>
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><BrainCircuit size={22}/></div><div><b>EduAI <span>Nexus</span></b><small>SMART CAMPUS ANALYTICS</small></div></div>
        <div className="workspace"><span className="live-dot"/> {user.demo ? 'SYNTHETIC DEMO WORKSPACE' : 'INSTITUTION WORKSPACE'}</div>
        {user.demo && <div className="demo-mode-banner" role="status">Public demo · synthetic records · read-only</div>}
        <nav aria-label="Main navigation">{nav.filter(([, , , roles]) => roles.includes(role)).map(([label, to, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${(to === '/dashboard?view=features' ? isFeatureView : isActive && !isFeatureView) ? 'active' : ''}`}><Icon size={17}/><span>{label}</span></NavLink>)}</nav>
        <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">{role[0]?.toUpperCase() || '?'}</div><div><b>{user.email}</b><small>{role}{user.demo ? ' · demo' : ''}</small></div></div><button className="logout" onClick={signOut}><LogOut size={16}/> Sign out</button></div>
      </aside>
      <main className="main">
        <header className="topbar"><div><span className="crumb">EDUAI NEXUS /</span> <b>Campus intelligence</b></div><div className="top-right"><span className="status-pill"><span className="live-dot"/> {user.demo ? 'Synthetic demo' : 'Analytics workspace'}</span><button className="theme-toggle" type="button" onClick={toggleMode} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}><ModeIcon size={16}/><span>{mode === 'dark' ? 'Light' : 'Dark'} mode</span></button><div className="avatar small">{role[0]?.toUpperCase() || '?'}</div></div></header>
        <div className="page-content">{children}</div>
      </main>
    </div>;
}
