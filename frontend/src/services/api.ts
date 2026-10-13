const API=import.meta.env.VITE_API_URL||'http://localhost:4000/api';

export function token(){return localStorage.getItem('eduai_token')||'';}

export async function api<T=unknown>(path:string,init:RequestInit={}):Promise<T>{
  const headers=new Headers(init.headers);
  const isMultipart=typeof FormData!=='undefined'&&init.body instanceof FormData;
  if(isMultipart)headers.delete('content-type');
  else if(!headers.has('content-type'))headers.set('content-type','application/json');
  const authToken=token();
  if(authToken)headers.set('authorization',`Bearer ${authToken}`);

  const response=await fetch(`${API}${path}`,{...init,headers});
  if(!response.ok){
    const body=await response.json().catch(()=>({}));
    if(response.status===401&&path!=='/auth/login'){
      localStorage.removeItem('eduai_token');
      localStorage.removeItem('eduai_user');
      window.dispatchEvent(new Event('eduai:unauthorized'));
    }
    throw new Error(body.error||`Request failed (${response.status})`);
  }
  if(response.headers.get('content-type')?.includes('text/csv'))return await response.text() as T;
  return response.json() as Promise<T>;
}
