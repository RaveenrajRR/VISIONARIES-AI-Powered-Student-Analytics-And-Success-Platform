import '../src/config/env';
import mongoose from 'mongoose';
import fs from 'node:fs';
import path from 'node:path';
import {parse} from 'csv-parse/sync';
import {Student} from '../src/models/Student';

const files=['students','academic','attendance','lms','engagement','placement','skills','feedback'];
const numericFields=new Set([
  'year','semester_gpa','backlogs','trend','attendance_pct','weekly_active_days',
  'assignment_completion_pct','course_progress_pct','club_activities',
  'event_participation_pct','faculty_interactions','aptitude_pct','coding_pct',
  'mock_interview_pct','technical_skill_pct','communication_pct','portfolio_pct',
  'wellbeing_support_pct','course_satisfaction_pct',
]);
const percentageFields=new Set([
  'attendance_pct','assignment_completion_pct','course_progress_pct',
  'event_participation_pct','aptitude_pct','coding_pct','mock_interview_pct',
  'technical_skill_pct','communication_pct','portfolio_pct',
  'wellbeing_support_pct','course_satisfaction_pct',
]);

function parseMetric(file:string,key:string,value:string,row:number):number|null{
  if(value==='')return null;
  const parsed=Number(value);
  if(!Number.isFinite(parsed))throw new Error(`${file}.csv row ${row}: ${key} must be numeric`);
  if(percentageFields.has(key)&&(parsed<0||parsed>100))throw new Error(`${file}.csv row ${row}: ${key} must be between 0 and 100`);
  if(key==='semester_gpa'&&(parsed<0||parsed>10))throw new Error(`${file}.csv row ${row}: semester_gpa must be between 0 and 10`);
  if(['backlogs','weekly_active_days','club_activities','faculty_interactions'].includes(key)&&(parsed<0||!Number.isInteger(parsed)))throw new Error(`${file}.csv row ${row}: ${key} must be a non-negative integer`);
  if(key==='year'&&(!Number.isInteger(parsed)||parsed<1||parsed>8))throw new Error(`${file}.csv row ${row}: year must be an integer from 1 to 8`);
  return parsed;
}

async function main(){
  const uri=process.env.MONGODB_URI;
  if(!uri)throw new Error('Set MONGODB_URI');
  await mongoose.connect(uri);
  try{
    const root=path.resolve(__dirname,'../../datasets/raw');
    const studentIds=new Set<string>();
    for(const file of files){
      const rows=parse(fs.readFileSync(path.join(root,`${file}.csv`),'utf8'),{
        columns:true,
        skip_empty_lines:true,
        bom:true,
      }) as Array<Record<string,string>>;
      const seen=new Set<string>();
      const importedAt=new Date().toISOString();

      for(let index=0;index<rows.length;index++){
        const row=rows[index];
        const line=index+2;
        const id=row.student_id?.trim();
        if(!id)throw new Error(`${file}.csv row ${line}: student_id is required`);
        if(seen.has(id))throw new Error(`${file}.csv row ${line}: duplicate student_id ${id}`);
        seen.add(id);

        if(file==='students'){
          for(const field of ['display_name','department','email','status']){
            if(!row[field]?.trim())throw new Error(`${file}.csv row ${line}: ${field} is required`);
          }
          const year=parseMetric(file,'year',row.year,line);
          studentIds.add(id);
          await Student.updateOne(
            {studentId:id},
            {$set:{
              studentId:id,
              synthetic:row.synthetic!=='false',
              displayName:row.display_name.trim(),
              department:row.department.trim(),
              year,
              email:row.email.trim().toLowerCase(),
              status:row.status.trim(),
            }},
            {upsert:true},
          );
          continue;
        }

        if(!studentIds.has(id))throw new Error(`${file}.csv row ${line}: student_id ${id} is missing from students.csv`);
        const data:Record<string,unknown>={};
        for(const [key,value] of Object.entries(row)){
          if(key==='student_id'||key==='synthetic')continue;
          data[key]=numericFields.has(key)?parseMetric(file,key,value,line):value===''?null:value;
        }
        const student=await Student.findOne({studentId:id});
        if(!student)throw new Error(`${file}.csv row ${line}: student ${id} is not present in MongoDB`);
        student.sources.set(file,data);
        student.sourceMetadata.set(file,{importedAt});
        await student.save();
      }
    }
    console.log('Imported synthetic dataset using stable student IDs (repeat runs update existing records and source freshness).');
  }finally{
    await mongoose.disconnect();
  }
}

main().catch(error=>{
  console.error(error instanceof Error?error.message:error);
  process.exitCode=1;
});
