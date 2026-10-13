import {NextFunction,Request,Response} from 'express';
import jwt from 'jsonwebtoken';
import {User} from '../models/User';

declare global{
  namespace Express{
    interface Request{
      user?:{id:string;role:string;department?:string;studentId?:string;email?:string};
    }
  }
}

export async function auth(req:Request,res:Response,next:NextFunction){
  const header=req.headers.authorization;
  if(!header?.startsWith('Bearer '))return res.status(401).json({error:'Authentication required'});
  const secret=process.env.JWT_SECRET;
  if(!secret)return res.status(500).json({error:'JWT_SECRET is not configured'});

  let subject:string;
  try{
    const payload=jwt.verify(header.slice(7),secret);
    if(typeof payload==='string'||typeof payload.sub!=='string')return res.status(401).json({error:'Invalid or expired token'});
    subject=payload.sub;
  }catch{
    return res.status(401).json({error:'Invalid or expired token'});
  }

  try{
    const user=await User.findById(subject);
    if(!user||!user.active)return res.status(401).json({error:'Invalid account'});
    req.user={
      id:String(user._id),
      role:user.role,
      department:user.department??undefined,
      studentId:user.studentId??undefined,
      email:user.email,
    };
    return next();
  }catch(error){
    return next(error);
  }
}

export function allow(...roles:string[]){
  return (req:Request,res:Response,next:NextFunction)=>{
    if(!req.user||!roles.includes(req.user.role))return res.status(403).json({error:'Forbidden for this role'});
    return next();
  };
}
