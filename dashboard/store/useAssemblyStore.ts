import { create } from 'zustand';

/**
 * Global store for the DashboardAssembly loading screen.
 * Lives at the root layout level so it persists across route changes.
 * 
 * Flow:
 * 1. Login page calls show() immediately on Sign In click
 * 2. Assembly animation plays while auth + route change happen in background
 * 3. Dashboard layout calls markReady() when data is fetched
 * 4. Assembly fades out, onComplete calls reset()
 */
interface AssemblyState {
    visible: boolean;
    ready: boolean;
    show: () => void;
    markReady: () => void;
    reset: () => void;
}

export const useAssemblyStore = create<AssemblyState>((set) => ({
    visible: false,
    ready: false,
    show: () => set({ visible: true, ready: false }),
    markReady: () => set({ ready: true }),
    reset: () => set({ visible: false, ready: false }),
}));
