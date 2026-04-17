import { create } from 'zustand';

export interface ThemeStore {
    theme: 'dark' | 'light' | 'system';
    resolvedTheme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light' | 'system') => void;
}

const getInitialTheme = (): 'dark' | 'light' | 'system' => {
    if (typeof window !== 'undefined') {
        return (localStorage.getItem('ofiere-theme') as 'dark' | 'light' | 'system') ?? 'dark';
    }
    return 'dark';
};

export const useThemeStore = create<ThemeStore>((set) => ({
    theme: getInitialTheme(),
    resolvedTheme: 'dark',
    setTheme: (theme) => {
        let resolved: 'dark' | 'light' = 'dark';
        if (theme === 'system') {
            resolved = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
        } else {
            resolved = theme;
        }

        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('data-theme', resolved);
            if (resolved === 'dark') {
                document.documentElement.classList.add('dark');
            } else {
                document.documentElement.classList.remove('dark');
            }
        }

        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('ofiere-theme', theme);
        }

        set({ theme, resolvedTheme: resolved });
    },
}));
