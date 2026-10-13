import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../features/auth/Login';
import Dashboard from '../features/dashboard/Dashboard';
import StudentHome from '../features/dashboard/StudentHome';
import RootAdmin from '../features/dashboard/RootAdmin';
import Students from '../features/students/Students';
import StudentDetail from '../features/students/StudentDetail';
import InterventionWorkspace from '../features/interventions/Workspace';
import { Shell } from '../components/layout/Shell';
import { Integration, Methodology, Reports, SettingsPage } from '../features/GenericPage';
import { PlacementReadinessPage, RiskAnalysisPage, SegmentsPage } from '../features/analytics/AIInsights';
import { api, clearSession, token } from '../services/api';

function Guard({ children }) {
    const [user, setUser] = useState(null);
    const [status, setStatus] = useState(token() ? 'checking' : 'signedOut');

    useEffect(() => {
        let mounted = true;
        const onUnauthorized = () => {
            if (mounted) {
                setUser(null);
                setStatus('signedOut');
            }
        };
        window.addEventListener('eduai:unauthorized', onUnauthorized);

        if (token()) {
            api('/auth/me')
                .then(result => {
                    if (!mounted)
                        return;
                    localStorage.setItem('eduai_user', JSON.stringify(result.user));
                    setUser(result.user);
                    setStatus('authenticated');
                })
                .catch(error => {
                    if (!mounted)
                        return;
                    if (!token()) {
                        setUser(null);
                        setStatus('signedOut');
                    } else {
                        setStatus('unavailable');
                    }
                });
        }

        return () => {
            mounted = false;
            window.removeEventListener('eduai:unauthorized', onUnauthorized);
        };
    }, []);

    if (status === 'checking')
        return <div className="loading-card" role="status">Verifying your session…</div>;
    if (status === 'unavailable')
        return <div className="login-page"><div className="error-box" role="alert">Unable to verify your session with the deployed API. Check the API status and try again.</div><button className="secondary-btn" onClick={() => window.location.reload()}>Retry</button><button className="secondary-btn" onClick={() => { clearSession(); window.location.assign('/login'); }}>Sign out</button></div>;
    if (!user)
        return <Navigate to="/login" replace/>;
    return children(user);
}

function RoleRoute({ user, roles, children }) {
    return roles.includes(user.role) ? children : <Navigate to="/dashboard" replace/>;
}

function Workspace() {
    return <Guard>{user => <Shell user={user}><Routes>
      <Route path="/dashboard" element={user.role === "student" ? <StudentHome /> : user.role === "root-admin" ? <Navigate to="/root-control" replace/> : <Dashboard />}/>
      <Route path="/root-control" element={<RoleRoute user={user} roles={['root-admin']}><RootAdmin /></RoleRoute>}/>
      <Route path="/my-profile" element={<RoleRoute user={user} roles={['student']}><StudentHome /></RoleRoute>}/>
      <Route path="/students" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><Students /></RoleRoute>}/>
      <Route path="/students/:id" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty', 'student']}><StudentDetail /></RoleRoute>}/>
      <Route path="/integration" element={<RoleRoute user={user} roles={['root-admin', 'admin']}><Integration /></RoleRoute>}/>
      <Route path="/interventions" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><InterventionWorkspace /></RoleRoute>}/>
      <Route path="/methodology" element={<Methodology />}/>
      <Route path="/risk" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><RiskAnalysisPage /></RoleRoute>}/>
      <Route path="/placement" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><PlacementReadinessPage /></RoleRoute>}/>
      <Route path="/segments" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><SegmentsPage /></RoleRoute>}/>
      <Route path="/reports" element={<RoleRoute user={user} roles={['root-admin', 'admin', 'faculty']}><Reports /></RoleRoute>}/>
      <Route path="/settings" element={<RoleRoute user={user} roles={['root-admin', 'admin']}><SettingsPage /></RoleRoute>}/>
      <Route path="*" element={<Navigate to="/dashboard" replace/>}/>
    </Routes></Shell>}</Guard>;
}

export default function App() {
    const queryClient = useMemo(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }), []);
    return <QueryClientProvider client={queryClient}><BrowserRouter><Routes><Route path="/login" element={<Login />}/><Route path="/*" element={<Workspace />}/></Routes></BrowserRouter></QueryClientProvider>;
}
