import {afterEach,describe,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import App from '../app/App';

afterEach(()=>{
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function authenticateAs(role:string,path='/dashboard'){
  localStorage.setItem('eduai_token','test-session-token');
  localStorage.setItem('eduai_user',JSON.stringify({email:`${role}@example.invalid`,role}));
  window.history.pushState({},'',path);
}

describe('App authentication and theme',()=>{
  it('renders login route',()=>{
    window.history.pushState({},'','/login');
    render(<App/>);
    expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
  });

  it('stores the authenticated session and opens the workspace',async()=>{
    window.history.pushState({},'','/login');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,
      status:200,
      headers:new Headers({'content-type':'application/json'}),
      json:async()=>({token:'test-session-token',user:{email:'admin@example.invalid',role:'admin'}}),
    }));
    render(<App/>);
    fireEvent.change(screen.getByRole('textbox',{name:'Institution email'}),{target:{value:'admin@example.invalid'}});
    fireEvent.change(screen.getByLabelText('Password'),{target:{value:'test-password'}});
    fireEvent.click(screen.getByRole('button',{name:'Sign in securely'}));
    expect(await screen.findByRole('heading',{name:'AI insights & operations overview'})).toBeInTheDocument();
    expect(localStorage.getItem('eduai_token')).toBe('test-session-token');
  });

  it('uses faculty, student, and AI palette defaults',()=>{
    vi.stubGlobal('fetch',vi.fn(()=>new Promise(()=>{})));
    for(const [role,path,palette,mode] of [
      ['faculty','/dashboard','faculty','light'],
      ['student','/dashboard','student','light'],
      ['student','/risk','ai','dark'],
    ]){
      cleanup();
      authenticateAs(role,path);
      render(<App/>);
      const shell=document.querySelector('.app-shell');
      expect(shell).toHaveAttribute('data-palette',palette);
      expect(shell).toHaveAttribute('data-mode',mode);
    }
  });

  it('persists the selected color mode while navigating',async()=>{
    authenticateAs('admin');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:true,
      status:200,
      headers:new Headers({'content-type':'application/json'}),
      json:async()=>({items:[],total:0,pages:1}),
    }));
    render(<App/>);
    fireEvent.click(screen.getByRole('button',{name:'Switch to light mode'}));
    expect(localStorage.getItem('eduai_theme_mode')).toBe('light');
    expect(screen.getByRole('button',{name:'Switch to dark mode'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link',{name:/Students/}));
    expect(await screen.findByRole('heading',{name:'Student directory'})).toBeInTheDocument();
    expect(localStorage.getItem('eduai_theme_mode')).toBe('light');
    expect(screen.getByRole('button',{name:'Switch to dark mode'})).toBeInTheDocument();
  });

  it('clears an expired session and returns to login',async()=>{
    localStorage.setItem('eduai_token','expired-test-token');
    localStorage.setItem('eduai_user',JSON.stringify({email:'admin@example.invalid',role:'admin'}));
    window.history.pushState({},'','/dashboard');
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({
      ok:false,
      status:401,
      headers:new Headers({'content-type':'application/json'}),
      json:async()=>({error:'Invalid or expired token'}),
    }));
    render(<App/>);
    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
    expect(localStorage.getItem('eduai_token')).toBeNull();
  });
});
