import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface VignetteState {
    tunableBlur: number;
    tunableStart: number;
    tunableEnd: number;
    tunableDarkness: number;
    updateVignette: (updates: Partial<VignetteState>) => void;
}

export const useVignetteStore = create<VignetteState>()(
    persist(
        (set) => ({
            tunableBlur: 24,
            tunableStart: 20,
            tunableEnd: 100,
            tunableDarkness: 30,
            updateVignette: (updates) => set((state) => ({ ...state, ...updates })),
        }),
        {
            name: 'ofiere_vignette_settings',
        }
    )
);
