import {useState} from 'react';
import {Link} from 'react-router-dom';
import {useQuery} from '@tanstack/react-query';
import {AlertTriangle,BrainCircuit,Filter,RefreshCw,ShieldAlert} from 'lucide-react';
import {api} from '../../services/api';
import {Panel} from '../../components/ui/Panel';

type RiskItem={
  studentId:string;
  displayName:string;
  department:string;
  academicRisk:boolean;
  academicRiskLevel:'low'|'moderate'|'high';
  academicReasons:{metric:string;value:number;reason:string}[];
  placementRisk:boolean;
  placementRiskLevel:'low'|'moderate'|'high';
  placementReasons:{metric:string;value:number;reason:string}[];
};
type SegmentItem={
  studentId:string;
  displayName:string;
  department:string;
  segment:string;
  evidence:{metric:string;value:number}[];
  recommendedAction:string;
};
type PlacementItem={
  studentId:string;
  displayName:string;
  department:string;
  readinessPct:number|null;
  coveragePct:number;
  skillGaps:{skill:string;value:number;target:number;gap:number}[];
  practicePlan:{skill:string;action:string;weeks:number}[];
};

export function RiskAnalysisPage(){
  const [type,setType]=useState<'all'|'academic'|'placement'>('all');
  const query=useQuery({
    queryKey:['risk-summary',type],
    queryFn:()=>api<{total:number;academicRiskCount:number;placementRiskCount:number;items:RiskItem[]}>(`/analytics/risk-summary?type=${type}`),
  });
  return <><div className="page-heading"><div><div className="eyebrow">EARLY SUPPORT · AI INSIGHTS</div><h1>Academic & placement risk</h1><p>Transparent rule-based support signals from observed student metrics. Faculty review is required.</p></div><button className="secondary-btn" onClick={()=>query.refetch()}><RefreshCw size={15}/> Refresh</button></div>
    {query.error&&<div className="error-box">Risk analysis is unavailable. {String(query.error)}</div>}
    {query.isLoading?<div className="loading-card">Analyzing authorized student records…</div>:query.data&&<>
      <div className="metric-grid"><Metric label="Students in scope" value={query.data.total}/><Metric label="Academic support flags" value={query.data.academicRiskCount}/><Metric label="Placement support flags" value={query.data.placementRiskCount}/></div>
      <div className="filter-bar"><label className="search-field"><Filter size={16}/><select value={type} onChange={event=>setType(event.target.value as typeof type)}><option value="all">All records</option><option value="academic">Academic support</option><option value="placement">Placement support</option></select></label></div>
      <Panel title="Evidence-based review queue" subtitle={`${query.data.items.length} matching records · rules are provisional, not predictive labels`}>
        {query.data.items.length===0?<div className="empty-state"><ShieldAlert size={22}/><p>No matching risk flags in the authorized records.</p></div>:<div className="table-scroll"><table><thead><tr><th>Student</th><th>Department</th><th>Academic evidence</th><th>Placement evidence</th><th>Profile</th></tr></thead><tbody>{query.data.items.map(item=><tr key={item.studentId}><td><b>{item.displayName}</b><small className="cell-sub">{item.studentId}</small></td><td>{item.department}</td><td>{item.academicRisk?item.academicReasons.map(reason=><small className="cell-sub" key={reason.metric}>{reason.metric}: {reason.value}</small>):'No flag'}</td><td>{item.placementRisk?item.placementReasons.map(reason=><small className="cell-sub" key={reason.metric}>{reason.metric}: {reason.value}</small>):'No flag'}</td><td><Link className="row-link" to={`/students/${item.studentId}`}>Review →</Link></td></tr>)}</tbody></table></div>}
      </Panel>
    </>}
  </>;
}

export function SegmentsPage(){
  const [selected,setSelected]=useState('');
  const queryString=selected?`?segment=${encodeURIComponent(selected)}`:'';
  const query=useQuery({
    queryKey:['segments',selected],
    queryFn:()=>api<{total:number;counts:Record<string,number>;items:SegmentItem[]}>(`/analytics/segments${queryString}`),
  });
  return <><div className="page-heading"><div><div className="eyebrow">COHORT DISCOVERY</div><h1>Student segmentation</h1><p>Segments are calculated from observed records using transparent rules, with evidence and suggested actions.</p></div><button className="secondary-btn" onClick={()=>query.refetch()}><RefreshCw size={15}/> Refresh</button></div>
    {query.error&&<div className="error-box">Segmentation is unavailable. {String(query.error)}</div>}
    {query.isLoading?<div className="loading-card">Calculating segments…</div>:query.data&&<>
      <div className="segment-grid">{Object.entries(query.data.counts).map(([name,count])=><button className={`segment-card ${selected===name?'selected':''}`} key={name} onClick={()=>setSelected(selected===name?'':name)}><span className="segment-mark"><BrainCircuit size={20}/></span><strong>{count}</strong><h3>{name}</h3><p>Click to view students and evidence.</p></button>)}</div>
      <Panel title={selected||'All student segments'} subtitle={`${query.data.items.length} of ${query.data.total} authorized student records`}>
        {query.data.items.length===0?<div className="empty-state"><AlertTriangle size={22}/><p>No students in this segment. Incomplete source data remains visible as its own review segment.</p></div>:<div className="table-scroll"><table><thead><tr><th>Student</th><th>Department</th><th>Observed evidence</th><th>Suggested action</th><th>Profile</th></tr></thead><tbody>{query.data.items.map(item=><tr key={item.studentId}><td><b>{item.displayName}</b><small className="cell-sub">{item.studentId}</small></td><td>{item.department}</td><td>{item.evidence.length?item.evidence.map(value=><small className="cell-sub" key={value.metric}>{value.metric}: {value.value}</small>):'Insufficient data for a specific evidence rule'}</td><td>{item.recommendedAction}</td><td><Link className="row-link" to={`/students/${item.studentId}`}>Review →</Link></td></tr>)}</tbody></table></div>}
      </Panel>
    </>}
  </>;
}

export function PlacementReadinessPage(){
  const [department,setDepartment]=useState('');
  const query=useQuery({
    queryKey:['placement-summary',department],
    queryFn:()=>api<{total:number;observedCount:number;averageReadinessPct:number|null;items:PlacementItem[]}>(`/analytics/placement-summary${department?`?department=${encodeURIComponent(department)}`:''}`),
  });
  const items=[...(query.data?.items||[])].sort((a,b)=>(a.readinessPct??Infinity)-(b.readinessPct??Infinity));
  return <><div className="page-heading"><div><div className="eyebrow">CAREER PREPARATION · AI INSIGHTS</div><h1>Placement readiness</h1><p>Observed aptitude, coding, interview, communication, technical-skill and portfolio indicators. No placement outcomes are predicted.</p></div><button className="secondary-btn" onClick={()=>query.refetch()}><RefreshCw size={15}/> Refresh</button></div>
    {query.error&&<div className="error-box">Placement readiness is unavailable. {String(query.error)}</div>}
    {query.isLoading?<div className="loading-card">Reviewing placement indicators…</div>:query.data&&<>
      <div className="metric-grid"><Metric label="Students in scope" value={query.data.total}/><Metric label="With observed indicators" value={query.data.observedCount}/><Metric label="Average observed readiness" value={query.data.averageReadinessPct===null?'—':`${query.data.averageReadinessPct}%`}/></div>
      <div className="filter-bar"><label>Department <select value={department} onChange={event=>setDepartment(event.target.value)}><option value="">All authorized departments</option>{['Computer Science','Information Technology','Electronics','Mechanical','Civil','Unassigned'].map(value=><option key={value}>{value}</option>)}</select></label></div>
      <Panel title="Readiness indicators & skill gaps" subtitle="Review evidence with each student; scores are not guarantees">
        {items.length===0?<div className="empty-state"><AlertTriangle size={22}/><p>No student records are available in this scope.</p></div>:<div className="table-scroll"><table><thead><tr><th>Student</th><th>Observed readiness</th><th>Coverage</th><th>Largest observed gaps</th><th>Practice action</th><th>Profile</th></tr></thead><tbody>{items.map(item=><tr key={item.studentId}><td><b>{item.displayName}</b><small className="cell-sub">{item.studentId} · {item.department}</small></td><td>{item.readinessPct===null?'Not enough data':`${item.readinessPct}%`}</td><td>{item.coveragePct}%</td><td>{item.skillGaps.length?item.skillGaps.slice(0,3).map(gap=><small className="cell-sub" key={gap.skill}>{gap.skill}: {gap.value}% (target {gap.target}%)</small>):'No gap below the provisional target'}</td><td>{item.practicePlan[0]?.action||'Review the student’s goals and choose a next step.'}</td><td><Link className="row-link" to={`/students/${item.studentId}`}>Review →</Link></td></tr>)}</tbody></table></div>}
      </Panel>
    </>}
  </>;
}

function Metric({label,value}:{label:string;value:number|string}){return <div className="metric-card"><div className="metric-value">{value}</div><div className="metric-label">{label}</div></div>}
