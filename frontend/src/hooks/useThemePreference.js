import { useEffect, useState } from 'react';
const STORAGE_KEY = 'eduai_theme_mode';
export function useThemePreference(palette) {
    const [preference, setPreference] = useState(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === 'light' || stored === 'dark' ? stored : null;
    });
    const mode = preference ?? (palette === 'admin' || palette === 'ai' ? 'dark' : 'light');
    useEffect(() => {
        const themeColor = document.querySelector('meta[name="theme-color"]');
        if (!themeColor)
            return;
        themeColor.content = mode === 'dark'
            ? palette === 'ai' ? '#111126' : '#0B1220'
            : palette === 'ai' ? '#F7F6FF' : '#F8FAFC';
    }, [mode, palette]);
    function toggleMode() {
        const next = mode === 'dark' ? 'light' : 'dark';
        localStorage.setItem(STORAGE_KEY, next);
        setPreference(next);
    }
    return { mode, toggleMode };
}
