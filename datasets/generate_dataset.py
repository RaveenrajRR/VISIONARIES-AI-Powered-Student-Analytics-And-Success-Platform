"""Reproducibly generate linked synthetic student CSVs. Run from any directory."""
import csv, random
from pathlib import Path
ROOT=Path(__file__).resolve().parent/'raw'
ROOT.mkdir(parents=True,exist_ok=True)
rng=random.Random(20261013)
rows={k:[] for k in ['students','academic','attendance','lms','engagement','placement','skills','feedback']}
deps=['Computer Science','Information Technology','Electronics','Mechanical','Civil']
for i in range(1,601):
 sid=f'S{i:04d}'; dept=rng.choice(deps); year=rng.randint(1,4)
 rows['students'].append(dict(student_id=sid,synthetic='true',display_name=f'Synthetic Student {i:04d}',department=dept,year=year,email=f'{sid.lower()}@example.invalid',status='active'))
 rows['academic'].append(dict(student_id=sid,synthetic='true',semester_gpa=round(rng.uniform(4.5,10),2),backlogs=rng.choices([0,1,2,3,4],[.58,.22,.12,.06,.02])[0],trend=round(rng.uniform(-1.5,1.5),2)))
 rows['attendance'].append(dict(student_id=sid,synthetic='true',attendance_pct='' if i%71==0 else round(max(35,min(100,rng.gauss(82,13))),1)))
 rows['lms'].append(dict(student_id=sid,synthetic='true',weekly_active_days=rng.randint(0,7),assignment_completion_pct=round(rng.uniform(25,100),1),course_progress_pct=round(rng.uniform(20,100),1)))
 rows['engagement'].append(dict(student_id=sid,synthetic='true',club_activities=rng.randint(0,8),event_participation_pct=round(rng.uniform(0,100),1),faculty_interactions=rng.randint(0,12)))
 rows['placement'].append(dict(student_id=sid,synthetic='true',aptitude_pct='' if i%83==0 else round(rng.uniform(20,100),1),coding_pct=round(rng.uniform(10,100),1),mock_interview_pct=round(rng.uniform(15,100),1),internship_experience=rng.choice(['yes','no'])))
 rows['skills'].append(dict(student_id=sid,synthetic='true',technical_skill_pct=round(rng.uniform(20,100),1),communication_pct=round(rng.uniform(20,100),1),portfolio_pct=round(rng.uniform(0,100),1)))
 rows['feedback'].append(dict(student_id=sid,synthetic='true',wellbeing_support_pct=round(rng.uniform(30,100),1),course_satisfaction_pct=round(rng.uniform(30,100),1)))
for name,data in rows.items():
 with (ROOT/f'{name}.csv').open('w',newline='',encoding='utf-8') as f:
  writer=csv.DictWriter(f,fieldnames=list(data[0]));writer.writeheader();writer.writerows(data)
# Referential integrity check: all source IDs must exist in master file.
master={r['student_id'] for r in rows['students']}
assert len(master)==600
for name,data in rows.items():
 ids=[r['student_id'] for r in data]
 assert len(ids)==len(set(ids)), f'duplicate IDs in {name}'
 if name!='students': assert set(ids)<=master, f'orphan foreign key in {name}'
print(f'Generated and validated 600 synthetic students and 7 linked source files in {ROOT}')
