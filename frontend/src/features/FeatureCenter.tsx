import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, token } from '../services/api';
import { Panel } from '../components/ui/Panel';
import { BookOpen, BriefcaseBusiness, ChartNoAxesCombined, FileCheck2, FileText, GraduationCap, HeartHandshake, MessageSquareText, Search, Settings2, Users } from 'lucide-react';

const views = [
                ['study', 'Study partners', Users], ['mentors', 'Mentors', HeartHandshake], ['certificates', 'Certificates', FileCheck2],
                ['scholarships', 'Scholarships', GraduationCap], ['performance', 'Performance', ChartNoAxesCombined], ['skills', 'Skill gaps', Search],
                ['courses', 'Courses', BookOpen], ['careers', 'Career paths', BriefcaseBusiness], ['resume', 'Resume review', FileText], ['feedback', 'Feedback', MessageSquareText], ['catalog', 'Configure catalogs', Settings2],
] as const;
type View = typeof views[number][0];
type Item = { _id?: string; id?: string;[key: string]: any };
type ItemsResponse<T> = { items: T[] };
const split = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
const currentUser = () => { try { return JSON.parse(localStorage.getItem('eduai_user') || '{}') } catch { return {} } };

export default function FeatureCenter() {
                const [view, setView] = useState<View>('study');
                const canConfigure = ['admin', 'faculty'].includes(currentUser().role);
                const visibleViews = canConfigure ? views : views.filter(([id]) => id !== 'catalog');
                return <>
                                <div className="page-heading"><div><div className="eyebrow">STUDENT SUCCESS TOOLS</div><h1>Learning, opportunity & career</h1><p>Matches and recommendations are calculated from authorized records and configured catalogs.</p></div></div>
                                <div className="feature-tabs" role="tablist" aria-label="Student success tools">
                                                {visibleViews.map(([id, label, Icon]) => <button key={id} type="button" role="tab" aria-selected={view === id} className={view === id ? 'selected' : ''} onClick={() => setView(id)}><Icon size={15} /><span>{label}</span></button>)}
                                </div>
                                {view === 'study' && <><StudyPartners /><GroupComposer /></>}
                                {view === 'mentors' && <Mentors />}
                                {view === 'certificates' && <Certificates />}
                                {view === 'scholarships' && <><Scholarships /><ApplicationsTracker /></>}
                                {view === 'performance' && <Performance />}
                                {view === 'skills' && <SkillGaps />}
                                {view === 'courses' && <Courses />}
                                {view === 'careers' && <Careers />}
                                {view === 'resume' && <ResumeReview />}
                                {view === 'feedback' && <Feedback />}
                                {view === 'catalog' && canConfigure && <CatalogConfiguration />}
                </>;
}

function PageState({ loading, error, empty, children }: { loading: boolean; error: unknown; empty: boolean; children: React.ReactNode }) {
                if (loading) return <div className="loading-card">Loading records…</div>;
                if (error) return <div className="error-box">{String(error)}</div>;
                if (empty) return <div className="empty-state"><p>No matching records are available yet.</p></div>;
                return <>{children}</>;
}

function StudyPartners() {
                const qc = useQueryClient(), [topics, setTopics] = useState(''), [availability, setAvailability] = useState(''), [message, setMessage] = useState('');
                const matches = useQuery({ queryKey: ['feature-study-matches'], queryFn: () => api<ItemsResponse<Item>>('/features/learning/matches') });
                const invites = useQuery({ queryKey: ['feature-study-invites'], queryFn: () => api<ItemsResponse<Item>>('/features/learning/invitations') });
                const groups = useQuery({ queryKey: ['feature-study-groups'], queryFn: () => api<ItemsResponse<Item>>('/features/learning/groups') });
                async function saveProfile(e: React.FormEvent) { e.preventDefault(); try { await api('/features/learning/matches', { method: 'POST', body: JSON.stringify({ topics: split(topics), availability: split(availability), discoverable: true }) }); setMessage('Study profile updated.'); await qc.invalidateQueries({ queryKey: ['feature-study-matches'] }); } catch (error) { setMessage(errorText(error)); } }
                async function invite(studentId: string) { try { await api('/features/learning/invitations', { method: 'POST', body: JSON.stringify({ receiverStudentId: studentId, message: 'Would you like to study together?' }) }); await qc.invalidateQueries({ queryKey: ['feature-study-invites'] }); setMessage('Invitation sent.'); } catch (error) { setMessage(errorText(error)); } }
                async function respond(invitationId: string, action: 'accept' | 'decline') { try { await api('/features/learning/invitations', { method: 'POST', body: JSON.stringify({ invitationId, action }) }); await Promise.all([qc.invalidateQueries({ queryKey: ['feature-study-invites'] }), qc.invalidateQueries({ queryKey: ['feature-study-groups'] })]); } catch (error) { setMessage(errorText(error)); } }
                return <div className="detail-grid"><Panel title="Study profile" subtitle="Discoverable only within your department"><form className="stack-form" onSubmit={saveProfile}><label>Topics<input value={topics} onChange={e => setTopics(e.target.value)} placeholder="e.g. calculus, databases" /></label><label>Availability<input value={availability} onChange={e => setAvailability(e.target.value)} placeholder="e.g. Mon evening, Sat morning" /></label><button className="primary-btn">Save profile</button></form>{message && <p className="muted">{message}</p>}<Section title="Study groups">{groups.data?.items?.length ? groups.data.items.map((group: Item) => <div className="intervention-row" key={group._id}><div><b>{group.name}</b><small>{group.memberStudentIds?.length || 0} members · {(group.topics || []).join(', ')}</small></div></div>) : <p className="muted">No study groups recorded.</p>}</Section></Panel><Panel title="Compatible learners" subtitle="Shared topics and schedules explain each match"><PageState loading={matches.isLoading} error={matches.error} empty={!matches.data?.items?.length}><List>{matches.data?.items?.map((match: Item) => <div className="intervention-row" key={match.studentId}><div><b>{match.studentId}</b><small>{match.explanation?.join(' · ')}</small></div><button className="secondary-btn" onClick={() => invite(match.studentId)}>Invite</button></div>)}</List></PageState><Section title="Invitations">{invites.data?.items?.length ? invites.data.items.map((invite: Item) => <div className="intervention-row" key={invite._id}><div><b>{invite.senderStudentId} → {invite.receiverStudentId}</b><small>{invite.status}</small></div>{invite.status === 'pending' && invite.receiverStudentId === currentUser().studentId && <div className="form-actions"><button className="secondary-btn" onClick={() => respond(invite._id!, 'accept')}>Accept</button><button className="secondary-btn" onClick={() => respond(invite._id!, 'decline')}>Decline</button></div>}</div>) : <p className="muted">No invitations recorded.</p>}</Section></Panel></div>;
}

function GroupComposer() {
                const qc = useQueryClient(), [name, setName] = useState(''), [topics, setTopics] = useState(''), [members, setMembers] = useState(''), [message, setMessage] = useState('');
                async function create(e: React.FormEvent) {
                                e.preventDefault();
                                try {
                                                await api('/features/learning/groups', { method: 'POST', body: JSON.stringify({ name, topics: split(topics), memberStudentIds: split(members) }) });
                                                setName(''); setMessage('Study group saved. Additional members require accepted invitations.');
                                                await qc.invalidateQueries({ queryKey: ['feature-study-groups'] });
                                } catch (error) { setMessage(errorText(error)); }
                }
                return <Panel title="Create a study group" subtitle="Additional members need an accepted learning invitation"><form className="stack-form" onSubmit={create}><label>Group name<input required minLength={2} maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label><label>Topics<input value={topics} onChange={e => setTopics(e.target.value)} placeholder="Comma-separated" /></label><label>Accepted member student IDs<input value={members} onChange={e => setMembers(e.target.value)} placeholder="Optional, comma-separated" /></label><button className="primary-btn">Create group</button></form>{message && <p className="muted">{message}</p>}</Panel>;
}

function Mentors() {
                const qc = useQueryClient(), user = currentUser(), [expertise, setExpertise] = useState(''), [availability, setAvailability] = useState(''), [capacity, setCapacity] = useState('3'), [message, setMessage] = useState('');
                const matches = useQuery({ queryKey: ['feature-mentor-matches'], queryFn: () => api<any>('/features/mentors/matches'), enabled: user.role === 'student' });
                const requests = useQuery({ queryKey: ['feature-mentor-requests'], queryFn: () => api<any>('/features/mentors/requests') });
                async function save(e: React.FormEvent) { e.preventDefault(); try { await api('/features/mentors/profile', { method: 'POST', body: JSON.stringify({ expertise: split(expertise), topics: split(expertise), availability: split(availability), capacity: Number(capacity), acceptingRequests: true }) }); setMessage('Mentor profile saved.'); } catch (error) { setMessage(errorText(error)); } }
                async function request(profileId: string) { const note = window.prompt('What would you like support with?'); if (!note) return; try { await api('/features/mentors/requests', { method: 'POST', body: JSON.stringify({ profileId, message: note }) }); await qc.invalidateQueries({ queryKey: ['feature-mentor-requests'] }); setMessage('Mentorship request sent.'); } catch (error) { setMessage(errorText(error)); } }
                async function decide(requestId: string, action: 'accept' | 'decline') { try { await api('/features/mentors/requests', { method: 'POST', body: JSON.stringify({ requestId, action }) }); await qc.invalidateQueries({ queryKey: ['feature-mentor-requests'] }); } catch (error) { setMessage(errorText(error)); } }
                return <div className="detail-grid"><Panel title={user.role === 'faculty' ? 'Mentor availability' : 'Mentor matches'} subtitle="Expertise, availability and active capacity"><PageState loading={matches.isLoading} error={matches.error} empty={!matches.data?.items?.length}>{matches.data?.items?.map((match: Item) => <div className="intervention-row" key={match.profileId}><div><b>{match.expertise?.join(', ') || 'Mentor'}</b><small>{match.explanation?.join(' · ')} · {match.compatibility?.remainingCapacity} places available</small></div><button className="secondary-btn" onClick={() => request(match.profileId)}>Request</button></div>)}</PageState>{user.role === 'faculty' && <form className="stack-form" onSubmit={save}><label>Expertise<input value={expertise} onChange={e => setExpertise(e.target.value)} placeholder="e.g. internships, Python" /></label><label>Availability<input value={availability} onChange={e => setAvailability(e.target.value)} /></label><label>Maximum active mentees<input type="number" min="1" max="100" value={capacity} onChange={e => setCapacity(e.target.value)} /></label><button className="primary-btn">Publish mentor profile</button></form>}{message && <p className="muted">{message}</p>}</Panel><Panel title="Mentorship requests" subtitle="Requests tied to your account and department"><PageState loading={requests.isLoading} error={requests.error} empty={!requests.data?.items?.length}><List>{requests.data?.items?.map((item: Item) => <div className="intervention-row" key={item._id}><div><b>{item.requesterStudentId}</b><small>{item.message} · {item.status}</small></div>{user.role === 'faculty' && item.status === 'pending' && <div className="form-actions"><button className="secondary-btn" onClick={() => decide(item._id!, 'accept')}>Accept</button><button className="secondary-btn" onClick={() => decide(item._id!, 'decline')}>Decline</button></div>}</div>)}</List></PageState></Panel></div>;
}


function Certificates() {
  const qc = useQueryClient();
  const user = currentUser();

  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const certificates = useQuery({
    queryKey: ['feature-certificates'],
    queryFn: () => api<any>('/features/certificates'),
  });

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setMessage('Please select a certificate file.');
      return;
    }

    try {
      const contentBase64 = bytesToBase64(
        await file.arrayBuffer()
      );

      await api('/features/certificates', {
        method: 'POST',
        body: JSON.stringify({
          title,
          fileName: file.name,
          contentType: file.type,
          contentBase64,
        }),
      });

      setTitle('');
      setFile(null);
      setMessage('Certificate submitted for review.');

      await qc.invalidateQueries({
        queryKey: ['feature-certificates'],
      });
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  async function review(
    id: string,
    status: 'approved' | 'rejected'
  ) {
    try {
      await api(`/features/certificates/${id}/review`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });

      await qc.invalidateQueries({
        queryKey: ['feature-certificates'],
      });

      setMessage(`Certificate ${status}.`);
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  async function download(id: string, name: string) {
    try {
      const baseUrl =
        import.meta.env.VITE_API_URL ||
        'http://localhost:4000/api';

      const response = await fetch(
        `${baseUrl}/features/certificates/${id}/file`,
        {
          headers: {
            authorization: `Bearer ${token()}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Download was not authorized.');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');

      link.href = url;
      link.download = name;
      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);
    } catch (error) {
      setMessage(errorText(error));
    }
  }

  return (
    <div className="detail-grid">
      <Panel
        title="Upload certificate"
        subtitle="Private PDF, PNG or JPEG · maximum 3 MiB"
      >
        <form className="stack-form" onSubmit={upload}>
          <label>
            Certificate title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
            />
          </label>

          <label>
            File
            <input
              required
              type="file"
              accept="application/pdf,image/png,image/jpeg"
              onChange={(e) =>
                setFile(e.target.files?.[0] ?? null)
              }
            />
          </label>

          <button className="primary-btn" disabled={!file}>
            Submit certificate
          </button>
        </form>

        <p className="muted">
          Uploaded documents are private. Human review is required;
          a file or any text extraction does not prove authenticity.
        </p>

        {message && <p className="muted">{message}</p>}
      </Panel>

      <Panel
        title="Certificate review queue"
        subtitle="Private records from the authorized scope"
      >
        <PageState
          loading={certificates.isLoading}
          error={certificates.error}
          empty={!certificates.data?.items?.length}
        >
          <List>
            {certificates.data?.items?.map((item: Item) => {
              const id = item._id;

              return (
                <div
                  className="intervention-row"
                  key={id ?? item.id ?? item.title}
                >
                  <div>
                    <b>{item.title}</b>
                    <small>
                      {item.originalFileName} · {item.reviewStatus}
                    </small>

                    {item.reviewNote && (
                      <small>{item.reviewNote}</small>
                    )}
                  </div>

                  <div className="form-actions">
                    {id && (
                      <>
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            download(
                              id,
                              item.originalFileName ||
                                'certificate'
                            )
                          }
                        >
                          Download
                        </button>

                        {user.role !== 'student' &&
                          item.reviewStatus === 'pending' && (
                            <>
                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() =>
                                  review(id, 'approved')
                                }
                              >
                                Approve
                              </button>

                              <button
                                type="button"
                                className="secondary-btn"
                                onClick={() =>
                                  review(id, 'rejected')
                                }
                              >
                                Reject
                              </button>
                            </>
                          )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </List>
        </PageState>
      </Panel>
    </div>
  );
}


function Scholarships() {
                const qc = useQueryClient(), user = currentUser(), [message, setMessage] = useState('');
                const scholarships = useQuery({ queryKey: ['feature-scholarships'], queryFn: () => api<any>('/features/scholarships') });
                const certificates = useQuery({ queryKey: ['feature-certificates'], queryFn: () => api<any>('/features/certificates'), enabled: user.role === 'student' });
                async function apply(id: string) { try { await api(`/features/scholarships/${id}/applications`, { method: 'POST', body: JSON.stringify({ certificateIds: [] }) }); setMessage('Application status recorded.'); await qc.invalidateQueries({ queryKey: ['feature-scholarships'] }); } catch (error) { setMessage(errorText(error)); } }
                return <div className="detail-grid"><Panel title="Scholarship catalog" subtitle="Eligibility uses only configured criteria and approved documents"><PageState loading={scholarships.isLoading} error={scholarships.error} empty={!scholarships.data?.items?.length}><List>{scholarships.data?.items?.map((item: Item) => <div className="opportunity-row" key={item._id}><div><b>{item.name}</b><p>{item.description || 'No description provided.'}</p><small>Criteria: {item.metrics?.map((metric: Item) => `${metric.key} ${metric.minimum !== undefined ? `>= ${metric.minimum}` : ''} ${metric.maximum !== undefined ? `<= ${metric.maximum}` : ''}`).join('; ') || 'No metric criteria configured'}</small>{item.eligibility && <small>{item.eligibility.eligible ? 'Criteria met' : 'Missing'} · {[...(item.eligibility.missingCriteria || []), ...(item.eligibility.missingDocuments || []).map((doc: string) => `document: ${doc}`)].join(', ') || 'No missing criteria'}</small>}</div>{user.role === 'student' && <button className="secondary-btn" onClick={() => apply(item._id!)}>Track application</button>}</div>)}</List></PageState>{message && <p className="muted">{message}</p>}</Panel><Panel title="My uploaded documents" subtitle="Approved documents may satisfy configured requirements"><PageState loading={certificates.isLoading} error={certificates.error} empty={!certificates.data?.items?.length}>{certificates.data?.items?.map((item: Item) => <div className="intervention-row" key={item._id}><div><b>{item.title}</b><small>{item.reviewStatus}</small></div></div>)}</PageState></Panel></div>;
}

function ApplicationsTracker() {
                const user = currentUser();
                const scholarships = useQuery({ queryKey: ['feature-scholarships'], queryFn: () => api<any>('/features/scholarships'), enabled: user.role === 'student' });
                const ids = scholarships.data?.items?.map((item: Item) => item._id) || [];
                const applications = useQuery({
                                queryKey: ['feature-scholarship-applications', ids],
                                queryFn: async () => (await Promise.all(ids.map((id: string) => api<any>(`/features/scholarships/${id}/applications`)))).flatMap(result => result.items || []),
                                enabled: user.role === 'student' && ids.length > 0,
                });
                if (user.role !== 'student') return null;
                return <Panel title="Application tracking" subtitle="Status reflects persisted review records"><PageState loading={scholarships.isLoading || applications.isLoading} error={scholarships.error || applications.error} empty={!applications.data?.length}>{applications.data?.map((application: Item) => <div className="intervention-row" key={application._id}><div><b>{scholarships.data.items.find((item: Item) => item._id === application.scholarshipId)?.name || 'Scholarship application'}</b><small>{application.status} · {application.eligible ? 'eligibility criteria met' : 'eligibility criteria incomplete'}</small>{application.reviewNote && <small>{application.reviewNote}</small>}</div></div>)}</PageState></Panel>;
}

function Performance() {
                const [semester, setSemester] = useState('');
                const query = useQuery({ queryKey: ['feature-performance', semester], queryFn: () => api<any>(`/features/performance/comparison${semester ? `?semester=${encodeURIComponent(semester)}` : ''}`) });
                const rows = query.data?.items || [];
                async function exportCsv() { try { const csv = await api<string>(`/features/performance/comparison?format=csv${semester ? `&semester=${encodeURIComponent(semester)}` : ''}`); downloadText(csv, 'semester-performance.csv'); } catch { } }
                return <Panel title="Semester performance comparison" subtitle="Department-scoped aggregates; small cohorts are suppressed"><div className="filter-bar"><input aria-label="Filter semester" value={semester} onChange={e => setSemester(e.target.value)} placeholder="Filter semester" /><button className="secondary-btn" onClick={exportCsv}>Export CSV</button></div><PageState loading={query.isLoading} error={query.error} empty={!rows.length}><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows.filter((row: Item) => !row.suppressed && row.average !== null)}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)" /><XAxis dataKey="semester" tick={{ fill: 'var(--muted)', fontSize: 10 }} /><YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} /><Tooltip contentStyle={{ background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border)' }} /><Bar dataKey="average" fill="var(--accent-secondary)" /></BarChart></ResponsiveContainer></div><div className="table-scroll"><table><thead><tr><th>Semester</th><th>Metric</th><th>Average</th><th>Sample</th></tr></thead><tbody>{rows.map((row: Item, index: number) => <tr key={`${row.semester}-${row.metric}-${index}`}><td>{row.semester}</td><td>{row.metric}</td><td>{row.suppressed ? 'Suppressed' : Number(row.average).toFixed(2)}</td><td>{row.suppressed ? 'Suppressed' : row.count}</td></tr>)}</tbody></table></div></PageState></Panel>;
}

function SkillGaps() {
                const qc = useQueryClient(), roles = useQuery({ queryKey: ['feature-roles'], queryFn: () => api<any>('/features/roles') }), profile = useQuery({ queryKey: ['feature-skill-profile'], queryFn: () => api<any>('/features/skills/profile') });
                const [skills, setSkills] = useState(''), [interests, setInterests] = useState(''), [roleId, setRoleId] = useState(''), [result, setResult] = useState<any>(null), [message, setMessage] = useState('');
                async function saveProfile(e: React.FormEvent) { e.preventDefault(); try { await api('/features/skills/profile', { method: 'PUT', body: JSON.stringify({ selfReportedSkills: split(skills), interests: split(interests) }) }); await qc.invalidateQueries({ queryKey: ['feature-skill-profile'] }); setMessage('Skill and interest profile saved.'); } catch (error) { setMessage(errorText(error)); } }
                async function analyze() { if (!roleId) return; try { setResult(await api<any>(`/features/skills/gap?roleId=${encodeURIComponent(roleId)}`)); } catch (error) { setMessage(errorText(error)); } }
                return <div className="detail-grid"><Panel title="Self-reported evidence" subtitle="Kept distinct from skills verified in source records"><form className="stack-form" onSubmit={saveProfile}><label>Skills<input value={skills} onChange={e => setSkills(e.target.value)} placeholder="Comma-separated, e.g. SQL, Python" /></label><label>Interests<input value={interests} onChange={e => setInterests(e.target.value)} placeholder="e.g. data visualization, public health" /></label><button className="primary-btn">Save profile</button></form>{message && <p className="muted">{message}</p>}<small className="muted">Current saved skills: {(profile.data?.selfReportedSkills || []).join(', ') || 'none'}</small></Panel><Panel title="Role skill gap" subtitle="Exact phrase matching, with each evidence source shown"><label className="field-label">Role<select value={roleId} onChange={e => setRoleId(e.target.value)}><option value="">Select a configured role</option>{roles.data?.items?.map((role: Item) => <option value={role.roleId} key={role.roleId}>{role.title}</option>)}</select></label><button className="secondary-btn" onClick={analyze}>Analyze skill gaps</button>{result && <><div className="metric-grid compact"><Metric label="Requirement coverage" value={result.coverage_pct === null ? 'Not available' : `${result.coverage_pct}%`} /><Metric label="Matched requirements" value={result.matched_requirements.length} /><Metric label="Requirements" value={result.requirement_count} /></div><List>{result.missing_requirements.map((item: Item) => <div className="intervention-row" key={item.skill}><div><b>{item.skill}</b><small>Not found in verified or self-reported evidence</small></div></div>)}{result.matched_requirements.map((item: Item) => <div className="intervention-row" key={item.skill}><div><b>{item.skill}</b><small>Evidence: {item.evidence_sources.join(', ')}</small></div></div>)}</List><p className="muted">{result.disclaimer}</p><p className="callout">Milestones: {(result.milestones || []).join(' · ') || 'No milestones configured for this role.'}</p></>}</Panel></div>;
}

function Courses() {
                const roles = useQuery({ queryKey: ['feature-roles'], queryFn: () => api<any>('/features/roles') }), [roleId, setRoleId] = useState('');
                const query = useQuery({ queryKey: ['feature-course-recommendations', roleId], queryFn: () => api<any>('/features/courses/recommendations', { method: 'POST', body: JSON.stringify({ roleId }) }), enabled: Boolean(roleId), retry: false });
                return <Panel title="Courses for your role goals" subtitle="MongoDB catalog, named skill gaps, and completed-course prerequisites"><label className="field-label">Target role<select value={roleId} onChange={e => setRoleId(e.target.value)}><option value="">Choose a role</option>{roles.data?.items?.map((role: Item) => <option key={role.roleId} value={role.roleId}>{role.title}</option>)}</select></label>{roleId && <PageState loading={query.isLoading} error={query.error} empty={!query.data?.items?.length}>{query.data?.items?.map((item: Item) => <div className="opportunity-row" key={item.course.code}><div><b>{item.course.code} · {item.course.title}</b><small>{item.recommended ? 'Recommended for a documented skill gap' : item.missingPrerequisites?.length ? `Prerequisites missing: ${item.missingPrerequisites.join(', ')}` : 'No configured skill-gap match'}</small><small>Skills: {item.course.teaches?.join(', ') || 'Not mapped'}</small></div></div>)}</PageState>}</Panel>;
}

function Careers() {
                const query = useQuery({ queryKey: ['feature-career-suggestions'], queryFn: () => api<any>('/features/careers/suggestions') });
                return <Panel title="Career role suggestions" subtitle="Exploratory matches from configured roles, actual evidence and saved interests"><PageState loading={query.isLoading} error={query.error} empty={!query.data?.suggestions?.length}><List>{query.data?.suggestions?.map((item: Item) => <div className="opportunity-row" key={item.role_id}><div><b>{item.title} · {item.match_pct}% match</b><small>Skills: {item.matched_skills.map((skill: Item) => `${skill.skill} (${skill.evidence_sources.join('/')})`).join(', ') || 'None'} · Interests: {item.matched_interests.join(', ') || 'None'}</small><small>Milestones: {item.milestones?.join(' · ') || 'No milestones configured'}</small></div></div>)}</List></PageState><p className="muted">{query.data?.disclaimer || 'No career outcomes are guaranteed.'}</p></Panel>;
}

function ResumeReview() {
                const roles = useQuery({ queryKey: ['feature-roles'], queryFn: () => api<any>('/features/roles') }), [roleId, setRoleId] = useState(''), [jobDescription, setJobDescription] = useState(''), [file, setFile] = useState<File | null>(null), [result, setResult] = useState<any>(null), [message, setMessage] = useState('');
                async function analyze(e: React.FormEvent) { e.preventDefault(); if (!file) return; try { setResult(await api('/features/resumes/analyze', { method: 'POST', body: JSON.stringify({ roleId, fileName: file.name, contentType: file.type, contentBase64: bytesToBase64(await file.arrayBuffer()), jobDescription }) })); } catch (error) { setMessage(errorText(error)); } }
                return <div className="detail-grid"><Panel title="Private resume review" subtitle="PDF/DOCX text extraction and explicit role-skill comparison"><form className="stack-form" onSubmit={analyze}><label>Target role<select required value={roleId} onChange={e => setRoleId(e.target.value)}><option value="">Select a role</option>{roles.data?.items?.map((role: Item) => <option key={role.roleId} value={role.roleId}>{role.title}</option>)}</select></label><label>Job description<textarea required minLength={20} maxLength={12000} value={jobDescription} onChange={e => setJobDescription(e.target.value)} /></label><label>Resume file<input required type="file" accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx" onChange={e => setFile(e.target.files?.[0] || null)} /></label><button className="primary-btn" disabled={!file}>Analyze resume</button></form>{message && <p className="error-box">{message}</p>}</Panel><Panel title="Analysis" subtitle="No qualifications are inferred or verified"><PageState loading={false} error={null} empty={!result}>{result && <><b>{result.analysis.coverage_pct === null ? 'No skill evidence' : `${result.analysis.coverage_pct}% of configured skills mentioned`}</b><List>{result.analysis.missing_from_resume.map((item: Item) => <div className="intervention-row" key={item.skill}><div><b>{item.skill}</b><small>{item.mentioned_in_job_description ? 'Listed in the job description' : 'Not found in job description'}</small></div></div>)}</List><p className="muted">{result.analysis.disclaimer}</p><p className="muted">{result.extraction.warning}</p></>}</PageState></Panel></div>;
}

function Feedback() {
                const query = useQuery({ queryKey: ['feature-feedback-sentiment'], queryFn: () => api<any>('/features/feedback/sentiment') });
                if (query.data?.suppressed) return <Panel title="Student feedback trends" subtitle="Human-reviewed, rule-based aggregate; original comments are never returned"><p className="muted">{query.data.note}</p></Panel>;
                return <Panel title="Student feedback trends" subtitle="Human-reviewed, rule-based aggregate; original comments are never returned"><PageState loading={query.isLoading} error={query.error} empty={!query.data?.sample_size}><>{query.data?.suppressed ? <p className="muted">{query.data.note}</p> : <><div className="metric-grid compact"><Metric label="Sample size" value={query.data?.sample_size ?? 0} /><Metric label="Positive" value={query.data?.sentiment_counts?.positive ?? 0} /><Metric label="Neutral / negative" value={`${query.data?.sentiment_counts?.neutral ?? 0} / ${query.data?.sentiment_counts?.negative ?? 0}`} /></div><List>{query.data?.topic_trends?.map((topic: Item) => <div className="intervention-row" key={topic.topic}><div><b>{topic.topic.replaceAll('_', ' ')}</b><small>n={topic.sample_size} · positive {topic.sentiment_counts.positive} · neutral {topic.sentiment_counts.neutral} · negative {topic.sentiment_counts.negative}</small></div></div>)}</List><p className="muted">{query.data?.caveat}</p></>}</></PageState></Panel>;
}

function CatalogConfiguration() {
                const qc = useQueryClient(), user = currentUser();
                const [roleTitle, setRoleTitle] = useState(''), [roleSkills, setRoleSkills] = useState(''), [roleInterests, setRoleInterests] = useState('');
                const [scholarshipName, setScholarshipName] = useState(''), [scholarshipDoc, setScholarshipDoc] = useState(''), [metricKey, setMetricKey] = useState(''), [minimum, setMinimum] = useState('');
                const [courseCode, setCourseCode] = useState(''), [courseTitle, setCourseTitle] = useState(''), [courseSkills, setCourseSkills] = useState(''), [coursePrerequisites, setCoursePrerequisites] = useState('');
                const [department, setDepartment] = useState(user.department || ''), [message, setMessage] = useState('');
                async function submit(e: React.FormEvent, kind: 'role' | 'scholarship' | 'course') {
                                e.preventDefault();
                                try {
                                                if (kind === 'role') await api('/features/roles', { method: 'POST', body: JSON.stringify({ roleId: roleTitle.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-'), title: roleTitle, department, requiredSkills: split(roleSkills), interests: split(roleInterests), milestones: [] }) });
                                                if (kind === 'scholarship') await api('/features/scholarships', { method: 'POST', body: JSON.stringify({ name: scholarshipName, departments: split(department), requiredDocuments: split(scholarshipDoc), metrics: metricKey && minimum !== '' ? [{ key: metricKey, minimum: Number(minimum) }] : [] }) });
                                                if (kind === 'course') await api('/features/courses', { method: 'POST', body: JSON.stringify({ code: courseCode, title: courseTitle, department, credits: 3, teaches: split(courseSkills), prerequisites: split(coursePrerequisites) }) });
                                                setMessage('Catalog record saved.');
                                                await Promise.all(['feature-roles', 'feature-scholarships', 'feature-courses'].map(queryKey => qc.invalidateQueries({ queryKey: [queryKey] })));
                                } catch (error) { setMessage(errorText(error)); }
                }
                return <><div className="detail-grid"><Panel title="Role requirements" subtitle="Used by skill gaps, career suggestions, resumes and course matching"><form className="stack-form" onSubmit={e => submit(e, 'role')}><label>Role title<input required value={roleTitle} onChange={e => setRoleTitle(e.target.value)} /></label><label>Department<input required value={department} onChange={e => setDepartment(e.target.value)} /></label><label>Required competencies<input required value={roleSkills} onChange={e => setRoleSkills(e.target.value)} placeholder="Comma-separated exact skill names" /></label><label>Interests<input value={roleInterests} onChange={e => setRoleInterests(e.target.value)} /></label><button className="primary-btn">Add role</button></form></Panel><Panel title="Scholarship criteria" subtitle="No award amounts or deadlines are inferred"><form className="stack-form" onSubmit={e => submit(e, 'scholarship')}><label>Name<input required value={scholarshipName} onChange={e => setScholarshipName(e.target.value)} /></label><label>Department scope<input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Comma-separated; blank means all" /></label><label>Required document title contains<input value={scholarshipDoc} onChange={e => setScholarshipDoc(e.target.value)} placeholder="Optional" /></label><label>Metric key<input value={metricKey} onChange={e => setMetricKey(e.target.value)} placeholder="e.g. academic.semester_gpa" /></label><label>Minimum metric value<input type="number" step="any" value={minimum} onChange={e => setMinimum(e.target.value)} /></label>{user.role === 'admin' && <button className="primary-btn">Add scholarship</button>}{user.role !== 'admin' && <p className="muted">Scholarship creation requires an administrator account.</p>}</form></Panel><Panel title="Course catalog" subtitle="Courses are matched to role gaps and actual prerequisites"><form className="stack-form" onSubmit={e => submit(e, 'course')}><label>Course code<input required value={courseCode} onChange={e => setCourseCode(e.target.value)} /></label><label>Title<input required value={courseTitle} onChange={e => setCourseTitle(e.target.value)} /></label><label>Department<input required value={department} onChange={e => setDepartment(e.target.value)} /></label><label>Skills taught<input value={courseSkills} onChange={e => setCourseSkills(e.target.value)} placeholder="Comma-separated skills" /></label><label>Prerequisite course codes<input value={coursePrerequisites} onChange={e => setCoursePrerequisites(e.target.value)} /></label><button className="primary-btn">Add course</button></form></Panel></div>{message && <p className="muted">{message}</p>}</>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="feature-section"><h3>{title}</h3>{children}</section> }
function List({ children }: { children: React.ReactNode }) { return <div className="intervention-list">{children}</div> }
function Metric({ label, value }: { label: string; value: unknown }) { return <div className="metric-card compact-metric"><div className="metric-value">{String(value)}</div><div className="metric-label">{label}</div></div> }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Request failed.'; }
function bytesToBase64(buffer: ArrayBuffer) { const bytes = new Uint8Array(buffer); let binary = ''; for (let index = 0; index < bytes.length; index += 0x8000)binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000)); return btoa(binary); }
function downloadText(text: string, name: string) { const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); URL.revokeObjectURL(url); }