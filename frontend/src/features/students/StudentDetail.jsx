import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { Panel } from '../../components/ui/Panel';
import { ArrowLeft, BrainCircuit, ShieldAlert, ClipboardCheck } from 'lucide-react';
export default function StudentDetail() {
    const { id } = useParams();
    const { data: student, isLoading, error } = useQuery({ queryKey: ['student', id], queryFn: () => api(`/students/${id}`) });
    const score = useQuery({ queryKey: ['score', id], queryFn: () => api(`/students/${id}/score`), enabled: !!student });
    const risks = useQuery({ queryKey: ['risks', id], queryFn: () => api(`/students/${id}/risks`), enabled: !!student });
    const explanation = useQuery({ queryKey: ['explanations', id], queryFn: () => api(`/students/${id}/explanations`), enabled: !!student });
    const recommendations = useQuery({ queryKey: ['recommendations', id], queryFn: () => api(`/students/${id}/recommendations`), enabled: !!student });
    const placement = useQuery({ queryKey: ['placement', id], queryFn: () => api(`/students/${id}/placement`), enabled: !!student });
    if (isLoading)
        return <div className="loading-card">Loading unified profile…</div>;
    if (error || !student)
        return <div className="error-box">Student profile unavailable. <Link to="/students">Return to directory</Link></div>;
    return <>
    <Link to="/students" className="back-link"><ArrowLeft size={15}/> Student directory</Link>
    <div className="page-heading"><div><div className="eyebrow">UNIFIED STUDENT PROFILE</div><h1>{student.displayName}</h1><p>{student.studentId} · {student.department} · Year {student.year} · {student.synthetic ? 'Synthetic demo record' : 'Imported record'}</p></div><span className="state-tag">{student.status}</span></div>
    <div className="detail-grid">
      <div className="score-card">
        <div className="score-title"><BrainCircuit /> Student Success Score</div>
        <div className="score-number">{score.data?.score ?? score.data?.successScore ?? '—'}<small>/100</small></div>
        <div className="score-track"><span style={{ width: `${score.data?.score || 0}%` }}/></div>
        {score.error && <p className="error-box">Score service unavailable. {String(score.error)}</p>}
        <p>Coverage {score.data?.coverage_pct ?? 0}% · data confidence {score.data?.confidence_pct == null ? 'not yet measurable' : `${score.data.confidence_pct}%`} · source freshness {score.data?.freshness_pct == null ? 'unknown' : `${score.data.freshness_pct}%`}</p>
        <div className="score-foot">Provisional weighted baseline, not a validated prediction. Confidence is a data-quality proxy, not success probability.</div>
      </div>
      <Panel title="Academic & placement risk" subtitle="Rule-based signals and observed evidence">
        {risks.error ? <p className="error-box">Risk analysis unavailable. {String(risks.error)}</p> : risks.isLoading ? <p>Checking observed indicators…</p> : <><Risk label="Academic risk" level={risks.data?.academic_risk_level ?? risks.data?.riskLevel} value={risks.data?.academic_risk ?? 0} reasons={risks.data?.academic_reasons ?? risks.data?.factors}/><Risk label="Placement risk" level={risks.data?.placement_risk_level} value={risks.data?.placement_risk} reasons={risks.data?.placement_reasons}/></>}
      </Panel>
    </div>
    <div className="detail-grid lower">
      <Panel title="Placement readiness" subtitle="Observed skills only; not a prediction of placement outcomes">
        {placement.error ? <p className="error-box">Placement analysis unavailable. {String(placement.error)}</p> : placement.isLoading ? <p>Reviewing placement indicators…</p> : <><h2>{(placement.data?.readiness_pct ?? placement.data?.readiness) == null ? 'Not enough data' : `${placement.data.readiness_pct ?? placement.data.readiness}%`}</h2><p>Indicator coverage {placement.data?.coverage_pct ?? 0}%</p>{placement.data?.skill_gaps?.length ? <div className="contribution-list">{placement.data.skill_gaps.map((gap) => <div className="contribution" key={gap.skill}><span>{gap.skill}</span><div className="tiny-track"><i style={{ width: `${gap.value}%` }}/></div><b>{gap.value}%</b><small>Provisional target {gap.target}%</small></div>)}</div> : <p className="muted">No observed indicator falls below the provisional target.</p>}{placement.data?.practice_plan?.map((item) => <p key={item.skill}><b>{item.skill}:</b> {item.action}</p>)}</>}
      </Panel>
      <Panel title="Seven-source data coverage" subtitle="Source presence and freshness metadata">
        <div className="source-grid">{['academic', 'attendance', 'lms', 'engagement', 'placement', 'skills', 'feedback'].map(source => <div className="source-card" key={source}><span className="source-dot"/><b>{source[0].toUpperCase() + source.slice(1)}</b><small>{student.sources?.[source] ? 'Data available' : 'Not yet imported'}</small><small>{explanation.data?.source_freshness?.[source]?.status || 'Freshness unknown'}</small></div>)}</div>
        {explanation.data?.missing_sources?.length > 0 && <p className="muted">Missing score components: {explanation.data.missing_sources.join(', ')}</p>}
      </Panel>
    </div>
    <Panel title="Score contributors" subtitle="Deterministic weighted feature contributions; not causal attribution">
      {explanation.error ? <p className="error-box">Explanation unavailable. {String(explanation.error)}</p> : explanation.isLoading ? <p>Preparing component explanation…</p> : explanation.data?.factors?.length ? <div className="contribution-list">{explanation.data.factors.map((factor) => <div className="contribution" key={factor.component}><span>{factor.component}</span><div className="tiny-track"><i style={{ width: `${factor.value}%` }}/></div><b>{factor.value}</b><small>{factor.direction} · {factor.impact_from_neutral > 0 ? '+' : ''}{factor.impact_from_neutral} score points vs neutral</small><small>Observed: {Object.entries(factor.observed_metrics || {}).map(([key, value]) => `${key} ${value}`).join(' · ')}</small></div>)}</div> : <p className="muted">No valid score components yet.</p>}
    </Panel>
    <Panel title="Recommended faculty actions" subtitle="Supportive suggestions based on actual observed metrics; outcomes are not guaranteed">
      {recommendations.error ? <p className="error-box">Recommendations unavailable. {String(recommendations.error)}</p> : recommendations.isLoading ? <p>Generating evidence-linked suggestions…</p> : recommendations.data?.recommendations?.length ? <div className="recommendation-grid">{recommendations.data.recommendations.map((item) => <div className="recommendation" key={item.type}><div className="rec-top"><ClipboardCheck size={17}/><span className={`priority ${item.priority}`}>{item.priority} priority</span></div><h4>{item.title}</h4><p>{item.rationale}</p><small>Evidence: {item.evidence}</small><small>Suggested action: {item.suggested_action}</small><small>Expected measurable outcome: {item.expected_outcome}</small><small>Suggested follow-up: {item.follow_up_days} days</small>{currentUserRole() !== "student" && <button className="secondary-btn small-btn" onClick={async () => { try {
        await api('/interventions', { method: 'POST', body: JSON.stringify({ studentId: student.studentId, title: item.title, type: item.type, priority: item.priority, evidence: item.evidence, rationale: item.rationale, expectedOutcome: item.expected_outcome, followUpDate: new Date(Date.now() + item.follow_up_days * 86400000).toISOString() }) });
        alert('Intervention assigned.');
    }
    catch (error) {
        alert(error.message);
    } }}>Assign intervention</button>}</div>)}</div> : <div className="empty-state"><ClipboardCheck size={22}/><p>No support recommendation was produced from the observed values.</p></div>}
    </Panel>
  </>;
}
function Risk({ label, value, level, reasons }) {
    return <div className="risk-block"><div className="risk-head"><ShieldAlert size={16}/><b>{label}</b><span className={value ? 'risk-yes' : 'risk-no'}>{value ? `${level} support signal` : 'No rule triggered'}</span></div>{reasons?.length ? reasons.map(reason => <p key={reason.metric} className="risk-reason">• {reason.reason} <b>Observed: {reason.value}</b></p>) : <p className="muted">No configured threshold was crossed or the source metric is missing.</p>}</div>;
}

function currentUserRole() { try { return JSON.parse(localStorage.getItem("eduai_user") || "{}").role || ""; } catch { return ""; } }
