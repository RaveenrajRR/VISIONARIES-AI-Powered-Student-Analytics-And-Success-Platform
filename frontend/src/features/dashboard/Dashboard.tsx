import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, ArrowUpRight, ClipboardCheck, Database, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../../services/api';
import { Panel } from '../../components/ui/Panel';
import FeatureCenter from '../FeatureCenter';

type RiskSummary = { total: number; academicRiskCount: number; placementRiskCount: number };

export default function Dashboard() {
  const { search } = useLocation();
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['overview'], queryFn: () => api<any>('/dashboard/overview') });
  const aiHealth = useQuery({ queryKey: ['ai-health'], queryFn: () => api<any>('/ai/health'), retry: false });
  const { data: students } = useQuery({ queryKey: ['students-dashboard'], queryFn: () => api<any>('/students?limit=100') });
  const role = currentUserRole();
  const canReviewInstitutionSignals = role === 'admin' || role === 'faculty';
  const riskSummary = useQuery({
    queryKey: ['risk-summary', 'dashboard'],
    queryFn: () => api<RiskSummary>('/analytics/risk-summary'),
    enabled: canReviewInstitutionSignals,
    retry: false,
  });
  const items = students?.items || [];
  const departments = Object.entries(items.reduce((counts: Record<string, number>, student: any) => {
    counts[student.department] = (counts[student.department] || 0) + 1;
    return counts;
  }, {})).map(([name, count]) => ({ name, count }));

  if (new URLSearchParams(search).get('view') === 'features') return <FeatureCenter />;

  return <>
    <div className="page-heading"><div><div className="eyebrow">CAMPUS INTELLIGENCE</div><h1>AI insights & operations overview</h1><p>Explainable support indicators from authorized, observed student records.</p></div><button className="secondary-btn" onClick={() => { void refetch(); void aiHealth.refetch(); if (canReviewInstitutionSignals) void riskSummary.refetch(); }}><RefreshCw size={15} /> Refresh data</button></div>
    {error && <div className="error-box">Could not load live analytics. Check API and MongoDB configuration. {String(error)}</div>}
    {isLoading ? <div className="loading-card">Loading institution metrics…</div> : <>
      <div className="metric-grid"><Metric icon={<Users />} label="Students in scope" value={data?.studentCount ?? 0} sub="Database records" /><Metric icon={<Activity />} label="Students loaded" value={data?.studentsLoaded ?? 0} sub="Current query window" /><Metric icon={<ClipboardCheck />} label="Open interventions" value={data?.interventionOpen ?? 0} sub="Awaiting follow-up" /><Metric icon={<Database />} label="Data provenance" value={data?.syntheticOnly ? 'Synthetic' : 'Mixed / empty'} sub={data?.syntheticOnly ? 'Demo records labelled' : 'Review source provenance'} /></div>
      <div className="chart-grid">
        <Panel title="Department distribution" subtitle="Based on currently loaded authorized student records"><div className="chart-wrap">{departments.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={departments}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="name" tick={{ fill: 'var(--muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--muted)' }} /><Tooltip contentStyle={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 12 }} /><Bar dataKey="count" fill="var(--accent-secondary)" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <Empty text="No student records yet. Import the synthetic dataset or connect a source." />}</div></Panel>
        <Panel title="Live service status" subtitle="Service health is checked from the authenticated API"><div className="status-list"><Status label="REST API" status="Connected to dashboard endpoint" /><Status label="Database" status="Connected during backend startup" /><Status label="AI service" status={aiHealth.isLoading ? 'Checking AI health…' : aiHealth.error ? 'Unavailable — start FastAPI' : `${aiHealth.data?.mode || 'Connected'} · live`} /><Status label="Scoring confidence" status="Data freshness and coverage are reported separately" /></div><div className="callout"><ShieldAlert size={18} /><span>Risk flags are support signals, not definitive judgments. Faculty review is required before action.</span></div></Panel>
      </div>
      <div className="detail-grid lower">
        <Panel title="Current AI support signals" subtitle={canReviewInstitutionSignals ? 'Calculated from authorized department/institution records' : 'Institution summaries are limited to faculty and administrators'} action={<Link to="/risk" className="text-link">Review evidence <ArrowUpRight size={14} /></Link>}>
          {!canReviewInstitutionSignals ? <p className="muted">Open your own profile to review personal risk indicators.</p> : riskSummary.error ? <div className="error-box">Risk summary unavailable. {String(riskSummary.error)}</div> : riskSummary.isLoading ? <p>Analyzing live risk rules…</p> : riskSummary.data ? <div className="status-list"><Status label="Students in scope" status={`${riskSummary.data.total}`} /><Status label="Academic support flags" status={`${riskSummary.data.academicRiskCount}`} /><Status label="Placement support flags" status={`${riskSummary.data.placementRiskCount}`} /></div> : <p className="muted">No risk summary returned.</p>}
        </Panel>
        <Panel title="Score interpretation" subtitle="Provisional and deterministic methodology"><p>Available components are renormalized; missing sources are omitted rather than imputed.</p><p>Coverage measures weighted data availability. Confidence is a separate source-freshness proxy, not a success probability.</p><Link to="/methodology" className="text-link">Review scoring method <ArrowUpRight size={14} /></Link></Panel>
      </div>
      <div className="bottom-grid">
        <Panel title="Recently indexed students" subtitle="First page of authorized records" action={<Link to="/students" className="text-link">View directory <ArrowUpRight size={14} /></Link>}>{items.length ? <div className="mini-table"><div className="mini-row head"><span>Student</span><span>Department</span><span>Year</span><span>Record type</span></div>{items.slice(0, 5).map((student: any) => <div className="mini-row" key={student.studentId}><span><b>{student.displayName}</b><small>{student.studentId}</small></span><span>{student.department}</span><span>Year {student.year}</span><span><i className="synthetic-tag">{student.synthetic ? 'Synthetic' : 'Imported'}</i></span></div>)}</div> : <Empty text="No students found in the database." />}</Panel>
        <Panel title="Next best action" subtitle="Operational checklist"><div className="check-list"><div><span className="check-num">01</span><span><b>Review source freshness</b><small>Re-import source files to record current update time.</small></span></div><div><span className="check-num">02</span><span><b>Review risk rules</b><small>Confirm provisional thresholds with academic leadership.</small></span></div><div><span className="check-num">03</span><span><b>Assign supportive follow-ups</b><small>Review evidence, owner, notes and measurable outcomes.</small></span></div></div></Panel>
      </div>
    </>}
  </>;
}

function currentUserRole(): string {
  try { return JSON.parse(localStorage.getItem('eduai_user') || '{}').role || ''; }
  catch { return ''; }
}
function Metric({ icon, label, value, sub }: any) { return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span><span className="metric-arrow"><ArrowUpRight size={15} /></span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-sub">{sub}</div></div> }
function Empty({ text }: { text: string }) { return <div className="empty-state"><Database size={25} /><p>{text}</p></div> }
function Status({ label, status }: { label: string; status: string }) { return <div className="status-row"><span className="live-dot" /><span><b>{label}</b><small>{status}</small></span><span className="status-ok">INFO</span></div> }
