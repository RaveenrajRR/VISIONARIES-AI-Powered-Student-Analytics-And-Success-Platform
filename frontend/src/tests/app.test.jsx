import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from '../app/App';
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
});
function authenticateAs(role, path = '/dashboard') {
    localStorage.setItem('eduai_token', 'test-session-token');
    localStorage.setItem('eduai_user', JSON.stringify({ email: `${role}@example.invalid`, role }));
    window.history.pushState({}, '', path);
}
describe('App authentication and theme', () => {
    it('renders login route', () => {
        window.history.pushState({}, '', '/login');
        render(<App />);
        expect(screen.getByText(/Welcome back/i)).toBeInTheDocument();
    });
    it('stores the authenticated session and opens the workspace', async () => {
        window.history.pushState({}, '', '/login');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ token: 'test-session-token', user: { email: 'admin@example.invalid', role: 'admin' } }),
        }));
        render(<App />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Institution email' }), { target: { value: 'admin@example.invalid' } });
        fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'test-password' } });
        fireEvent.click(screen.getByRole('button', { name: 'Sign in securely' }));
        expect(await screen.findByRole('heading', { name: 'AI insights & operations overview' })).toBeInTheDocument();
        expect(localStorage.getItem('eduai_token')).toBe('test-session-token');
    });
    it('prefills the public demo credentials without bypassing API login', () => {
        window.history.pushState({}, '', '/login');
        render(<App />);
        fireEvent.click(screen.getByRole('button', { name: /Student demo/ }));
        expect(screen.getByRole('textbox', { name: 'Institution email' })).toHaveValue('student@eduanexus.demo');
        expect(screen.getByLabelText('Password')).toHaveValue('StudentDemo@123');
        expect(screen.getByText(/server-authenticated/i)).toBeInTheDocument();
    });
    it('uses role-aware navigation and redirects restricted direct routes', async () => {
        vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ user: JSON.parse(localStorage.getItem('eduai_user')) }),
        })));
        for (const [role, path, palette, mode] of [
            ['admin', '/dashboard', 'admin', 'dark'],
            ['faculty', '/dashboard', 'faculty', 'light'],
            ['student', '/dashboard', 'student', 'light'],
            ['student', '/risk', 'student', 'light'],
        ]) {
            cleanup();
            authenticateAs(role, path);
            render(<App />);
            const shell = await screen.findByRole('navigation', { name: 'Main navigation' });
            expect(shell).toBeInTheDocument();
            const appShell = document.querySelector('.app-shell');
            expect(appShell).toHaveAttribute('data-palette', palette);
            expect(appShell).toHaveAttribute('data-mode', mode);
            if (role === 'admin') {
                expect(screen.getByRole('link', { name: 'Data integration' })).toBeInTheDocument();
                expect(screen.getByRole('link', { name: 'Settings & audit' })).toBeInTheDocument();
            }
            if (role === 'student') {
                expect(screen.queryByRole('link', { name: 'Risk analysis' })).not.toBeInTheDocument();
                expect(screen.queryByRole('link', { name: 'Data integration' })).not.toBeInTheDocument();
            }
            if (path === '/risk') {
                expect(await screen.findByRole('heading', { name: 'AI insights & operations overview' })).toBeInTheDocument();
                expect(window.location.pathname).toBe('/dashboard');
            }
        }
    });
    it('persists the selected color mode while navigating', async () => {
        authenticateAs('admin');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ user: JSON.parse(localStorage.getItem('eduai_user')), items: [], total: 0, pages: 1 }),
        }));
        render(<App />);
        fireEvent.click(await screen.findByRole('button', { name: 'Switch to light mode' }));
        expect(localStorage.getItem('eduai_theme_mode')).toBe('light');
        expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
        fireEvent.click(screen.getByRole('link', { name: /Students/ }));
        expect(await screen.findByRole('heading', { name: 'Student directory' })).toBeInTheDocument();
        expect(localStorage.getItem('eduai_theme_mode')).toBe('light');
        expect(screen.getByRole('button', { name: 'Switch to dark mode' })).toBeInTheDocument();
    });
    it('clears an expired session and returns to login', async () => {
        localStorage.setItem('eduai_token', 'expired-test-token');
        localStorage.setItem('eduai_user', JSON.stringify({ email: 'admin@example.invalid', role: 'admin' }));
        window.history.pushState({}, '', '/dashboard');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: false,
            status: 401,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ error: 'Invalid or expired token' }),
        }));
        render(<App />);
        expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
        expect(localStorage.getItem('eduai_token')).toBeNull();
    });
    it('clears the local session on sign out', async () => {
        authenticateAs('admin');
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ user: JSON.parse(localStorage.getItem('eduai_user')) }),
        }));
        render(<App />);
        fireEvent.click(await screen.findByRole('button', { name: /Sign out/ }));
        expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument();
        expect(localStorage.getItem('eduai_token')).toBeNull();
        expect(localStorage.getItem('eduai_user')).toBeNull();
    });
});
