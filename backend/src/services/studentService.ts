import {ai,AIPath,AIResponse} from './aiClient';

const SOURCE_NAMES=['academic','attendance','lms','engagement','placement','skills','feedback'] as const;

function mapValue(source:any,key:string){
  if(source instanceof Map)return source.get(key);
  return source?.[key];
}

function toMetrics(student:any):Record<string,number|null>{
  const metrics:Record<string,number|null>={};
  for(const sourceName of SOURCE_NAMES){
    const source=mapValue(student.sources,sourceName);
    if(!source||typeof source!=='object')continue;
    const entries=source instanceof Map?source.entries():Object.entries(source);
    for(const [key,value] of entries){
      if(key==='student_id'||key==='studentId'||key==='synthetic'||value===undefined)continue;
      if(value===null||value===''){
        metrics[key]=null;
        continue;
      }
      if(typeof value==='number'&&Number.isFinite(value)){
        metrics[key]=value;
        continue;
      }
      if(typeof value==='string'&&value.trim()!==''){
        const parsed=Number(value);
        if(Number.isFinite(parsed))metrics[key]=parsed;
      }
    }
  }
  return metrics;
}

function sourceImportTimes(student:any):Record<string,string|null>{
  const result:Record<string,string|null>={};
  for(const sourceName of SOURCE_NAMES){
    const metadata=mapValue(student.sourceMetadata,sourceName);
    const importedAt=metadata instanceof Map?metadata.get('importedAt'):metadata?.importedAt;
    if(importedAt instanceof Date)result[sourceName]=importedAt.toISOString();
    else if(typeof importedAt==='string')result[sourceName]=importedAt;
    else result[sourceName]=null;
  }
  return result;
}

export async function studentAnalytics<P extends AIPath>(student:any,path:P):Promise<AIResponse<P>>{
  return ai(path,student.studentId,toMetrics(student),sourceImportTimes(student));
}

export function visibleStudentFilter(user:any,query:any={}){
  const filter:any={};
  if(user.role==='student')filter.studentId=user.studentId;
  if(user.role==='faculty')filter.department=user.department||'__no_department_assigned__';
  if(user.role==='admin'&&query.department)filter.department=String(query.department);
  if(query.year){
    const year=Number(query.year);
    if(Number.isInteger(year)&&year>0)filter.year=year;
  }
  if(query.q){
    const escaped=String(query.q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    filter.$or=[{studentId:new RegExp(escaped,'i')},{displayName:new RegExp(escaped,'i')}];
  }
  return filter;
}
