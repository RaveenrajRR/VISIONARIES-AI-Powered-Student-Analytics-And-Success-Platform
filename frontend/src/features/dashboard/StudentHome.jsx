import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Activity, BookOpen, GraduationCap, Target, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { api } from '../../services/api';
import { Panel } from '../../components/ui/Panel';

function readUser() {
  try { return JSON.parse(localStorage.getItem('eduai_user') || '{}'); } catch { return {}; }
}
export default function StudentHome() {
  const user = readUser();
  const id = user.studentId || 'S0001';
  const { data: student, isLoading, error, refetch } = useQuery({ queryKey: ['my-profile', id], queryFn: () => api(`/students/${id}`) });
  const { data: score } = useQuery({ queryKey: ['my-score', id], queryFn: () => api(`/students/${id}/score`), enabled: !!student });
  const { data: risks } = useQuery({ queryKey: ['my-risks', id], queryFn: () => api(`/students/${id}/risks`), enabled: !!student });
  const { data: placement } = useQuery({ queryKey: ['my-placement', id], queryFn: () => api(`/students/${id}/placement`), enabled: !!student });
  const { data: courses } = useQuery({ queryKey: ['my-courses'], queryFn: () => api('/courses') });
  if (isLoading) return <div className="loading-card">Loading your student dashboard…</div>;
  if (error || !student) return <div className="error-box">Could not load your profile. {String(error || '')}</div>;
  const success = score?.successScore ?? Math.round((student.attendance + student.averageMarks + student.lmsActivity + student.engagementScore) / 4);
  const ownCourses = courses?.items || [];
  return <>
    <div className="page-heading"><div><div className="eyebrow">MY CAMPUS SPACE</div><h1>Welcome, {student.displayName.split(' ')[0]}</h1><p>Your learning progress, academic indicators and career readiness in one place.</p></div><button className="secondary-btn" onClick={() => void refetch()}><Activity size={15}/> Refresh my data</button></div>
    <div className="callout"><ShieldCheck size={18}/><span>This is your private student view. You can only see your own academic and career details. All records in this demo are synthetic.</span></div>
    <div className="metric-grid">
      <Metric icon={<Target/>} label="Student success score" value={`${success}/100`} sub="Illustrative indicator, not a prediction"/>
      <Metric icon={<Activity/>} label="Attendance" value={`${student.attendance}%`} sub="Recorded demo attendance"/>
      <Metric icon={<BookOpen/>} label="Average marks" value={`${student.averageMarks}%`} sub="Assessment average"/>
      <Metric icon={<GraduationCap/>} label="Placement readiness" value={`${student.placementReadiness}%`} sub="Skills and preparation indicator"/>
    </div>
    <div className="detail-grid">
      <Panel title="My profile" subtitle="Your personal academic record">
        <div className="profile-summary">
          <div className="avatar">{student.displayName.split(' ').map(n=>n[0]).join('').slice(0,2)}</div>
          <div><h2>{student.displayName}</h2><p>{student.studentId} · {student.department} · Year {student.year}</p><p>{student.email}</p></div>
        </div>
        <div className="student-facts"><div><small>LMS activity</small><b>{student.lmsActivity}%</b></div><div><small>Engagement</small><b>{student.engagementScore}%</b></div><div><small>Record type</small><b>Synthetic demo</b></div></div>
        <Link to={`/students/${student.studentId}`} className="text-link">Open my detailed profile <ArrowUpRight size={14}/></Link>
      </Panel>
      <Panel title="Personal support indicators" subtitle="Rule-based indicators to help guide your next steps">
        <div className="status-list">
          <Status label="Academic indicator" status={risks?.riskLevel || 'Calculating'} />
          <Status label="Placement readiness" status={`${placement?.readiness ?? student.placementReadiness}%`} />
        </div>
        <div className="callout"><ShieldCheck size={18}/><span>These demo indicators are not diagnoses or final judgments. Discuss concerns with your faculty mentor.</span></div>
      </Panel>
    </div>
    <Panel title="Learning resources" subtitle="Sample courses available in this demo">
      <div className="course-grid">{ownCourses.map(course=><div className="course-card" key={course.id}><div className="course-icon"><BookOpen size={18}/></div><b>{course.name}</b><small>{course.category} · {course.duration}</small><div className="tiny-track"><i style={{width:`${course.progress}%`}}/></div><small>{course.progress}% sample progress</small></div>)}</div>
    </Panel>
  </>;
}
function Metric({icon,label,value,sub}) { return <div className="metric-card"><div className="metric-top"><span className="metric-icon">{icon}</span></div><div className="metric-value">{value}</div><div className="metric-label">{label}</div><div className="metric-sub">{sub}</div></div>; }
function Status({label,status}) { return <div className="status-row"><span className="live-dot"/><span><b>{label}</b><small>{status}</small></span></div>; }
