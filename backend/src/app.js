import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import { demoData } from "./data/demoData.js";

export const app = express();
app.use(helmet());
app.use(cors({ origin: (process.env.FRONTEND_ORIGIN || "http://localhost:5173").split(",").map(x=>x.trim()), credentials: false }));
app.use(express.json({limit:"2mb"}));
app.use(rateLimit({windowMs:15*60*1000,limit:300,standardHeaders:true,legacyHeaders:false}));

// Demo-only accounts. These are synthetic credentials, not real Gmail accounts.
const accounts = [
 {email:"root@eduai.demo",password:"Root@12345",role:"root-admin",name:"EduAI Root Administrator",active:true},
 {email:"admin@eduai.demo",password:"Admin@123",role:"admin",name:"EduAI Administrator",active:true},
 {email:"student@eduai.demo",password:"Student@123",role:"student",name:"Aarav Kumar",studentId:"S0001",active:true},
 {email:"student02@eduai.demo",password:"Student@123",role:"student",name:"Diya Sharma",studentId:"S0002",active:true}
];
const JWT_SECRET = process.env.JWT_SECRET || "local-demo-secret-change-before-deployment";
const interventions = [...demoData.interventions];
const auditLogs = [];
function audit(actor, action, details={}) { auditLogs.unshift({id:`AUD-${Date.now()}-${Math.random().toString(16).slice(2,6)}`,actor,action,details,at:new Date().toISOString()}); if(auditLogs.length>500) auditLogs.length=500; }
function sign(account){ return jwt.sign({sub:account.email,role:account.role,studentId:account.studentId||null},JWT_SECRET,{expiresIn:"8h"}); }
function auth(req,res,next){
 const token=(req.headers.authorization||"").replace(/^Bearer\s+/i,"");
 try { if(!token) throw Error(); req.user=jwt.verify(token,JWT_SECRET); const current=accounts.find(a=>a.email===req.user.sub); if(!current||current.active===false) return res.status(401).json({error:"Account is disabled or no longer available. Please sign in again."}); next(); }
 catch { res.status(401).json({error:"Please login with a demo account."}); }
}
function allow(...roles){return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:"You do not have permission for this action."});}
const risk=s=>s.attendance<70||s.averageMarks<55?"High":s.attendance<80||s.averageMarks<70?"Medium":"Low";
app.get("/api/health",(_req,res)=>res.json({status:"ok",service:"EduAI Nexus Demo API",database:"not-used",dataset:"synthetic-demo"}));
app.get("/api/ai/health",auth,(_req,res)=>res.json({status:"ok",mode:"local demo rules",syntheticOnly:true}));
app.post("/api/auth/login",(req,res)=>{
 const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");
 const account=accounts.find(a=>a.email===email&&a.password===password&&a.active!==false);
 if(!account)return res.status(401).json({error:"Invalid credentials or account disabled"});
 audit(email,"login",{role:account.role});
 res.json({token:sign(account),user:{email:account.email,role:account.role,name:account.name,studentId:account.studentId||null,demo:true}});
});
app.post("/api/auth/logout",auth,(_req,res)=>res.json({ok:true,note:"Remove token from client storage."}));
app.get("/api/auth/me",auth,(req,res)=>{const a=accounts.find(x=>x.email===req.user.sub&&x.active!==false);res.json({user:a?{email:a.email,role:a.role,name:a.name,studentId:a.studentId||null,demo:true}:null});});
app.get("/api/dashboard/overview",auth,(req,res)=>{
 const list=req.user.role==="student"?demoData.students.filter(s=>s.studentId===req.user.studentId):demoData.students;
 res.json({studentCount:list.length,interventionOpen:interventions.filter(i=>i.status!=="Completed"&&(req.user.role!=="student"||i.studentId===req.user.studentId)).length,studentsLoaded:list.length,syntheticOnly:true,averageAttendance:Math.round(list.reduce((a,s)=>a+s.attendance,0)/Math.max(list.length,1)),averageMarks:Math.round(list.reduce((a,s)=>a+s.averageMarks,0)/Math.max(list.length,1)),highRisk:list.filter(s=>risk(s)==="High").length,note:"All records are predefined synthetic demo data."});
});
app.get("/api/students",auth,(req,res)=>{
 let items=req.user.role==="student"?demoData.students.filter(s=>s.studentId===req.user.studentId):[...demoData.students];
 const q=String(req.query.q||"").toLowerCase(),dep=String(req.query.department||"");
 if(q)items=items.filter(s=>s.displayName.toLowerCase().includes(q)||s.studentId.toLowerCase().includes(q));
 if(dep)items=items.filter(s=>s.department===dep);
 if(req.query.year)items=items.filter(s=>String(s.year)===String(req.query.year));
 items=items.map(s=>({...s,status:risk(s)==="High"?"Needs support":"Active",riskLevel:risk(s)}));
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||100));
 res.json({items:items.slice((page-1)*limit,page*limit),total:items.length,page,limit,pages:Math.ceil(items.length/limit)});
});
app.get("/api/students/:id",auth,(req,res)=>{
 const s=demoData.students.find(x=>x.studentId===req.params.id);
 if(!s)return res.status(404).json({error:"Student not found"});
 if(req.user.role==="student"&&req.user.studentId!==s.studentId)return res.status(403).json({error:"You can only access your own profile."});
 res.json({...s,status:risk(s)==="High"?"Needs support":"Active",riskLevel:risk(s)});
});
app.get("/api/students/:id/:kind",auth,(req,res)=>{
 const s=demoData.students.find(x=>x.studentId===req.params.id);
 if(!s)return res.status(404).json({error:"Student not found"});
 if(req.user.role==="student"&&req.user.studentId!==s.studentId)return res.status(403).json({error:"Forbidden"});
 const k=req.params.kind;
 const result={score:{studentId:s.studentId,successScore:Math.round((s.attendance+s.averageMarks+s.lmsActivity+s.engagementScore)/4),score:Math.round((s.attendance+s.averageMarks+s.lmsActivity+s.engagementScore)/4),coverage_pct:100,confidence_pct:80,freshness_pct:100,riskLevel:risk(s)},risks:{studentId:s.studentId,riskLevel:risk(s),academic_risk_level:risk(s),placement_risk_level:s.placementReadiness<55?"High":s.placementReadiness<70?"Medium":"Low",academic_risk:risk(s)==="High"?75:risk(s)==="Medium"?45:15,placement_risk:s.placementReadiness<55?70:s.placementReadiness<70?45:20,academic_reasons:[...(s.attendance<75?["Attendance needs attention"]:[]),...(s.averageMarks<60?["Assessment marks need attention"]:[])],placement_reasons:s.placementReadiness<60?["Build role-specific skills and practice interview preparation"]:[],factors:[...(s.attendance<75?["Attendance needs attention"]:[]),...(s.averageMarks<60?["Assessment marks need attention"]:[])]},explanations:{studentId:s.studentId,summary:"Demo explanation based on attendance, assessment, LMS activity and engagement indicators."},recommendations:{studentId:s.studentId,items:["Create a weekly study plan","Complete recommended course modules","Meet faculty mentor if needed"]},segment:{studentId:s.studentId,segment:risk(s)==="Low"?"On Track":"Needs Support"},placement:{studentId:s.studentId,readiness:s.placementReadiness,readiness_pct:s.placementReadiness,coverage_pct:100,skills:s.skills,skill_gaps:s.skills.map(skill=>({skill,value:Math.max(15,100-s.placementReadiness),target:75})),practice_plan:s.skills.map(skill=>({skill,action:`Practice ${skill} with a small portfolio project.`}))}}[k];
 if(!result)return res.status(400).json({error:"Unknown analytics type"});res.json(result);
});
app.get("/api/interventions",auth,(req,res)=>res.json({items:interventions.filter(i=>req.user.role!=="student"||i.studentId===req.user.studentId)}));
app.post("/api/interventions",auth,allow("admin","faculty"),(req,res)=>{
 const {studentId,type="Academic",priority="Medium",note=""}=req.body||{};
 if(!demoData.students.some(s=>s.studentId===studentId))return res.status(400).json({error:"Unknown studentId"});
 const item={id:"INT-"+Date.now(),studentId,type,priority,status:"Open",note:String(note).slice(0,500)};interventions.unshift(item);res.status(201).json(item);
});
app.patch("/api/interventions/:id",auth,allow("admin","faculty"),(req,res)=>{
 const item=interventions.find(i=>i.id===req.params.id);if(!item)return res.status(404).json({error:"Intervention not found"});
 if(req.body?.status)item.status=String(req.body.status);if(req.body?.note!==undefined)item.note=String(req.body.note).slice(0,500);res.json(item);
});
app.get("/api/analytics/trends",auth,(_req,res)=>res.json({items:[{period:"Jan",attendance:76,marks:68},{period:"Feb",attendance:79,marks:71},{period:"Mar",attendance:82,marks:74},{period:"Apr",attendance:84,marks:77}],syntheticOnly:true}));
app.get("/api/analytics/segments",auth,allow("admin","faculty"),(_req,res)=>res.json({items:["Low","Medium","High"].map(level=>({name:level,value:demoData.students.filter(s=>risk(s)===level).length}))}));
app.get("/api/analytics/risk-summary",auth,allow("admin","faculty"),(_req,res)=>res.json({items:["Low","Medium","High"].map(level=>({riskLevel:level,count:demoData.students.filter(s=>risk(s)===level).length}))}));
app.get("/api/analytics/placement-summary",auth,allow("admin","faculty"),(_req,res)=>res.json({averageReadiness:Math.round(demoData.students.reduce((a,s)=>a+s.placementReadiness,0)/demoData.students.length),items:demoData.students.map(s=>({studentId:s.studentId,readiness:s.placementReadiness}))}));
app.get("/api/courses",auth,(_req,res)=>res.json({items:demoData.courses}));
app.get("/api/audit-logs",auth,allow("admin","root-admin"),(_req,res)=>res.json({items:auditLogs}));
app.get("/api/reports/export",auth,allow("admin","faculty"),(req,res)=>{
 const rows=(req.user.role==="student"?demoData.students.filter(s=>s.studentId===req.user.studentId):demoData.students);
 res.setHeader("Content-Type","text/csv");res.setHeader("Content-Disposition",'attachment; filename="eduai-demo-students.csv"');
 res.send(["studentId,displayName,email,department,year,attendance,averageMarks,lmsActivity,engagementScore,placementReadiness,riskLevel",...rows.map(s=>[s.studentId,s.displayName,s.email,s.department,s.year,s.attendance,s.averageMarks,s.lmsActivity,s.engagementScore,s.placementReadiness,risk(s)].map(v=>`"${String(v).replaceAll('"','""')}"`).join(","))].join("\n"));
});
// Root-admin control plane: separate from ordinary administrator permissions.
app.get("/api/root-admin/overview",auth,allow("root-admin"),(_req,res)=>res.json({
  roles:{rootAdmins:accounts.filter(a=>a.role==="root-admin"&&a.active!==false).length,admins:accounts.filter(a=>a.role==="admin"&&a.active!==false).length,students:accounts.filter(a=>a.role==="student"&&a.active!==false).length},
  dataset:{students:demoData.students.length,courses:demoData.courses.length,interventions:interventions.length,storage:"in-memory",database:"not-used"},
  recentAudit:auditLogs.slice(0,8),uptimeSeconds:Math.round(process.uptime()),nodeVersion:process.version
}));
app.get("/api/root-admin/accounts",auth,allow("root-admin"),(_req,res)=>res.json({items:accounts.map(({email,role,name,studentId,active})=>({email,role,name,studentId:studentId||null,active:active!==false}))}));
app.post("/api/root-admin/accounts",auth,allow("root-admin"),(req,res)=>{
 const email=String(req.body?.email||"").trim().toLowerCase(); const password=String(req.body?.password||""); const role=String(req.body?.role||""); const name=String(req.body?.name||"").trim(); const studentId=String(req.body?.studentId||"").trim();
 if(!/^\S+@\S+\.\S+$/.test(email))return res.status(400).json({error:"Enter a valid demo email address."});
 if(password.length<8)return res.status(400).json({error:"Password must contain at least 8 characters."});
 if(!["admin","student"].includes(role))return res.status(400).json({error:"Root-admin is not assignable from this screen; choose admin or student."});
 if(accounts.some(a=>a.email===email))return res.status(409).json({error:"An account with this email already exists."});
 let linkedStudentId;
 if(role==="student"){
   const student=demoData.students.find(s=>s.studentId===studentId||s.email.toLowerCase()===email);
   if(!student)return res.status(400).json({error:"For a student account, provide an existing predefined studentId (for example S0003)."});
   if(accounts.some(a=>a.studentId===student.studentId))return res.status(409).json({error:"That student already has a login account."});
   linkedStudentId=student.studentId;
 }
 const account={email,password,role,name:name||email.split("@")[0],studentId:linkedStudentId,active:true}; accounts.push(account); audit(req.user.sub,"account_created",{email,role,studentId:linkedStudentId||null});
 res.status(201).json({account:{email:account.email,role:account.role,name:account.name,studentId:account.studentId||null,active:true},note:"In-memory demo account; removed when the server restarts."});
});
app.patch("/api/root-admin/accounts/:email/status",auth,allow("root-admin"),(req,res)=>{
 const email=decodeURIComponent(req.params.email).toLowerCase(); const account=accounts.find(a=>a.email.toLowerCase()===email); if(!account)return res.status(404).json({error:"Account not found."});
 if(account.role==="root-admin")return res.status(400).json({error:"The root-admin account cannot be disabled from the demo control panel."});
 const active=Boolean(req.body?.active); account.active=active; audit(req.user.sub,active?"account_enabled":"account_disabled",{email}); res.json({email,active});
});
app.get("/api/root-admin/audit-logs",auth,allow("root-admin"),(_req,res)=>res.json({items:auditLogs}));
app.post("/api/root-admin/dataset/reset",auth,allow("root-admin"),(req,res)=>{
 interventions.splice(0,interventions.length,...demoData.interventions); audit(req.user.sub,"demo_interventions_reset",{}); res.json({ok:true,note:"Demo interventions restored. Student dataset is predefined and read-only.",interventions:interventions.length});
});
app.get("/api/root-admin/system",auth,allow("root-admin"),(_req,res)=>res.json({service:"EduAI Nexus Demo API",status:"ok",database:"not-used",storage:"in-memory",node:process.version,uptimeSeconds:Math.round(process.uptime()),environment:process.env.NODE_ENV||"development",warning:"Demo only: account changes and interventions reset on restart."}));
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:"Internal server error"});});
