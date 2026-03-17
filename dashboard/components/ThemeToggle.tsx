'use client';

import { useThemeStore } from '@/store/useThemeStore';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const { theme, setTheme } = useThemeStore();

    const isDark = theme === 'dark' || theme === 'system';

    const toggle = () => {
        setTheme(isDark ? 'light' : 'dark');
    };

    return (
        <button
            onClick={toggle}
            className="flex items-center justify-center rounded-lg p-2 transition-colors hover:bg-accent"
            style={{ color: 'var(--color-accent-base)' }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
    );
}
