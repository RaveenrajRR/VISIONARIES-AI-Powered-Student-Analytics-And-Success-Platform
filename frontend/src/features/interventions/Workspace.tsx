import {FormEvent,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {ClipboardCheck,RefreshCw} from 'lucide-react';
import {api} from '../../services/api';
import {Panel} from '../../components/ui/Panel';

type Intervention={
  _id:string;
  studentId:string;
  title:string;
  type?:string;
  priority:string;
  status:string;
  notes?:string;
  rationale?:string;
  evidence?:string;
  expectedOutcome?:string;
  followUpDate?:string;
};

export default function InterventionWorkspace(){
  const queryClient=useQueryClient();
  const [studentId,setStudentId]=useState('');
  const [title,setTitle]=useState('');
  const [notes,setNotes]=useState('');
  const [expectedOutcome,setExpectedOutcome]=useState('');
  const [followUpDate,setFollowUpDate]=useState('');
  const [message,setMessage]=useState('');
  const user=readUser();
  const canManage=user.role==='admin'||user.role==='faculty';
  const query=useQuery({queryKey:['interventions'],queryFn:()=>api<Intervention[]>('/interventions')});

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setMessage('');
    try{
      await api('/interventions',{
        method:'POST',
        body:JSON.stringify({
          studentId,title,notes,expectedOutcome,priority:'medium',
          followUpDate:followUpDate?new Date(followUpDate).toISOString():undefined,
        }),
      });
      setStudentId('');
      setTitle('');
      setNotes('');
      setExpectedOutcome('');
      setFollowUpDate('');
      setMessage('Intervention assigned and saved.');
      await queryClient.invalidateQueries({queryKey:['interventions']});
    }catch(error){
      setMessage(error instanceof Error?error.message:'Could not assign intervention.');
    }
  }

  async function updateStatus(item:Intervention,status:string){
    setMessage('');
    try{
      await api(`/interventions/${item._id}`,{method:'PATCH',body:JSON.stringify({status})});
      setMessage('Intervention status updated.');
      await queryClient.invalidateQueries({queryKey:['interventions']});
    }catch(error){
      setMessage(error instanceof Error?error.message:'Could not update intervention.');
    }
  }

  return <>
    <div className="page-heading"><div><div className="eyebrow">STUDENT SUPPORT</div><h1>Intervention workspace</h1><p>Persist evidence, accountable follow-up, notes and measurable review outcomes.</p></div><button className="secondary-btn" onClick={()=>query.refetch()}><RefreshCw size={15}/> Refresh</button></div>
    {message&&<div className="callout" role="status">{message}</div>}
    <div className="detail-grid">
      {canManage&&<Panel title="Assign a supportive intervention" subtitle="The student must exist and be within your authorized scope">
        <form className="stack-form" onSubmit={create}>
          <label>Student ID<input required value={studentId} onChange={event=>setStudentId(event.target.value)} placeholder="S0001"/></label>
          <label>Action title<input required minLength={2} maxLength={200} value={title} onChange={event=>setTitle(event.target.value)} placeholder="Attendance follow-up"/></label>
          <label>Expected measurable outcome<input required maxLength={1000} value={expectedOutcome} onChange={event=>setExpectedOutcome(event.target.value)} placeholder="Review attendance percentage at the follow-up"/></label>
          <label>Follow-up date<input type="date" value={followUpDate} onChange={event=>setFollowUpDate(event.target.value)}/></label>
          <label>Notes and context<textarea maxLength={4000} value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Evidence, action and student context"/></label>
          <button className="primary-btn"><ClipboardCheck size={15}/> Assign intervention</button>
        </form>
      </Panel>}
      <Panel title="Intervention queue" subtitle="Persisted MongoDB records within your access scope">
        {query.error?<div className="error-box">Unable to load interventions. {String(query.error)}</div>:query.isLoading?<div className="loading-card">Loading intervention records…</div>:query.data?.length?<div className="intervention-list">{query.data.map(item=><div className="intervention-row" key={item._id}><div><b>{item.title}</b><small>{item.studentId} · {item.priority} priority</small><p>{item.notes||item.rationale||item.evidence||'No notes provided.'}</p>{item.expectedOutcome&&<small>Expected outcome: {item.expectedOutcome}</small>}{item.followUpDate&&<small>Follow-up: {new Date(item.followUpDate).toLocaleDateString()}</small>}</div>{canManage?<select aria-label={`Status for ${item.title}`} value={item.status} onChange={event=>void updateStatus(item,event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option></select>:<span className="state-tag">{item.status}</span>}</div>)}</div>:<div className="empty-state"><ClipboardCheck size={22}/><p>No interventions yet. Suggestions require faculty review before assignment.</p></div>}
      </Panel>
    </div>
  </>;
}

function readUser():{role?:string}{
  try{return JSON.parse(localStorage.getItem('eduai_user')||'{}');}
  catch{return {};}
}
