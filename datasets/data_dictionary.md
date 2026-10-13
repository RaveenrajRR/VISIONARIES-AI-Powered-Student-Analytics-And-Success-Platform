# Dataset data dictionary
All rows are **synthetic** and generated for demonstration; no real personal data is used. Stable join key: `student_id` (`S0001` … `S0600`). Blank numeric cells mean unknown, not zero.

| File | Fields | Meaning / scale |
|---|---|---|
| students.csv | student_id, synthetic, display_name, department, year, email, status | Synthetic identity; email uses reserved `.invalid` domain |
| academic.csv | semester_gpa, backlogs, trend | GPA 0–10, count of backlogs, GPA trend |
| attendance.csv | attendance_pct | Attendance 0–100%; some missing values |
| lms.csv | weekly_active_days, assignment_completion_pct, course_progress_pct | Days 0–7 and completion/progress 0–100 |
| engagement.csv | club_activities, event_participation_pct, faculty_interactions | Participation indicators |
| placement.csv | aptitude_pct, coding_pct, mock_interview_pct, internship_experience | Placement readiness inputs; some missing aptitude values |
| skills.csv | technical_skill_pct, communication_pct, portfolio_pct | Skill rubric percentages |
| feedback.csv | wellbeing_support_pct, course_satisfaction_pct | Support/satisfaction survey scales normalized to 0–100 |

All source files contain a `synthetic=true` provenance flag. Join integrity report: all source `student_id` values map to `students.csv`; blank values are intentionally retained.
