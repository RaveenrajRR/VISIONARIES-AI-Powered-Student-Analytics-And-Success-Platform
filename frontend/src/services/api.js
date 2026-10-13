const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

export function apiUrl(path = '') {
    return path ? `${API_BASE}/${String(path).replace(/^\/+/, '')}` : API_BASE;
}

export function token() {
    return localStorage.getItem('eduai_token') || '';
}

export function clearSession() {
    localStorage.removeItem('eduai_token');
    localStorage.removeItem('eduai_user');
    window.dispatchEvent(new Event('eduai:unauthorized'));
}

export async function api(path, init = {}) {
    const headers = new Headers(init.headers);
    const isMultipart = typeof FormData !== 'undefined' && init.body instanceof FormData;
    if (isMultipart)
        headers.delete('content-type');
    else if (!headers.has('content-type'))
        headers.set('content-type', 'application/json');
    const authToken = token();
    if (authToken)
        headers.set('authorization', `Bearer ${authToken}`);

    let response;
    try {
        response = await fetch(apiUrl(path), { ...init, headers });
    } catch (error) {
        throw new Error(`Unable to reach the EduAI API at ${apiUrl(path)}. Check the deployment API URL and service health.`, { cause: error });
    }

    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401 && path !== '/auth/login')
            clearSession();
        throw new Error(body.error || `Request failed (${response.status})`);
    }
    if (response.headers.get('content-type')?.includes('text/csv'))
        return response.text();
    return response.json();
}

export async function downloadApiFile(path, filename) {
    const headers = new Headers();
    const authToken = token();
    if (authToken)
        headers.set('authorization', `Bearer ${authToken}`);
    let response;
    try {
        response = await fetch(apiUrl(path), { headers });
    } catch (error) {
        throw new Error(`Unable to reach the EduAI API at ${apiUrl(path)}. Check the deployment API URL and service health.`, { cause: error });
    }
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401)
            clearSession();
        throw new Error(body.error || `Download failed (${response.status})`);
    }
    const objectUrl = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
}
