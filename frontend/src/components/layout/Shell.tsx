import { ReactNode } from 'react'; import { NavLink, useLocation, useNavigate } from 'react-router-dom'; import { Activity, BrainCircuit, Users, ChartNoAxesCombined, Database, ShieldAlert, ClipboardCheck, Settings, LogOut, GraduationCap, FileBarChart, Layers, Moon, Sun } from 'lucide-react'; import { ThemePalette, useThemePreference } from '../../hooks/useThemePreference';
const nav = [['Overview', '/dashboard', ChartNoAxesCombined], ['Learning & career', '/dashboard?view=features', BrainCircuit], ['Students', '/students', Users], ['Risk analysis', '/risk', ShieldAlert], ['Placement readiness', '/placement', GraduationCap], ['Segments', '/segments', Layers], ['Interventions', '/interventions', ClipboardCheck], ['Data integration', '/integration', Database], ['Score methodology', '/methodology', BrainCircuit], ['Reports', '/reports', FileBarChart], ['Settings & audit', '/settings', Settings]] as const;
export function Shell({ children, user }: { children: ReactNode; user: any }) {
  const go = useNavigate();
  const { pathname, search } = useLocation();
  const isFeatureView = new URLSearchParams(search).get('view') === 'features';
  const role = String(user?.role || 'admin').toLowerCase();
  const palette: ThemePalette = isFeatureView || /^\/(risk|placement|segments)(\/|$)/.test(pathname) ? 'ai' : role === 'faculty' ? 'faculty' : role === 'student' ? 'student' : 'admin';
  const { mode, toggleMode } = useThemePreference(palette);
  const ModeIcon = mode === 'dark' ? Sun : Moon;
  return <div className="app-shell" data-palette={palette} data-mode={mode}>
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><BrainCircuit size={22} /></div><div><b>EduAI <span>Nexus</span></b><small>SMART CAMPUS ANALYTICS</small></div></div>
      <div className="workspace"><span className="live-dot" /> INSTITUTION WORKSPACE</div>
      <nav aria-label="Main navigation">{nav.map(([label, to, Icon]) => <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${(to === '/dashboard?view=features' ? isFeatureView : isActive && !isFeatureView) ? 'active' : ''}`}><Icon size={17} /><span>{label}</span></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="profile-mini"><div className="avatar">{user?.role?.[0]?.toUpperCase() || 'A'}</div><div><b>{user?.email || 'Local preview'}</b><small>{user?.role || 'Connect backend'}</small></div></div><button className="logout" onClick={() => { localStorage.removeItem('eduai_token'); localStorage.removeItem('eduai_user'); go('/login') }}><LogOut size={16} /> Sign out</button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div><span className="crumb">EDUAI NEXUS /</span> <b>Campus intelligence</b></div><div className="top-right"><span className="status-pill"><span className="live-dot" /> Analytics workspace</span><button className="theme-toggle" type="button" onClick={toggleMode} aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`}><ModeIcon size={16} /><span>{mode === 'dark' ? 'Light' : 'Dark'} mode</span></button><div className="avatar small">{user?.role?.[0]?.toUpperCase() || 'A'}</div></div></header>
      <div className="page-content">{children}</div>
    </main>
  </div>;
}
