import { create } from 'zustand';

// --- Types ---

export interface ConnectionProfileClient {
    id: string;
    name: string;
    description: string | null;
    isActive: boolean;

    // Flat fields from DB (returned by list endpoint)
    openclawEnabled: boolean;
    openclawWsUrl: string;
    openclawHttpUrl: string;
    openclawAuthMode: string;
    openclawAuthToken: string | null; // redacted or null
    agentZeroEnabled: boolean;
    agentZeroBaseUrl: string;
    agentZeroAuthMode: string;
    agentZeroApiKey: string | null; // redacted or null
    agentZeroTransport: string;

    lastConnectedAt: string | null;
    lastHealthStatus: 'healthy' | 'degraded' | 'offline' | null;

    createdAt: string | null;
    updatedAt: string | null;
}

export interface ConnectionTestResult {
    openclaw: {
        tested: boolean;
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
        wsHandshake: boolean;
    };
    agentZero: {
        tested: boolean;
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
        apiKeyValid: boolean;
    };
}

interface ConnectionState {
    // --- Data ---
    profiles: ConnectionProfileClient[];
    activeProfile: ConnectionProfileClient | null;
    isLoading: boolean;
    error: string | null;
    testResults: Record<string, ConnectionTestResult>; // keyed by profile id
    testingIds: Set<string>;

    // --- Actions ---
    fetchProfiles: () => Promise<void>;
    fetchActiveProfile: () => Promise<void>;
    createProfile: (data: Record<string, unknown>) => Promise<string | null>;
    updateProfile: (id: string, data: Record<string, unknown>) => Promise<void>;
    deleteProfile: (id: string) => Promise<void>;
    activateProfile: (id: string) => Promise<void>;
    testProfile: (id: string) => Promise<ConnectionTestResult | null>;
    clearError: () => void;
}

export const useConnectionStore = create<ConnectionState>((set, get) => ({
    profiles: [],
    activeProfile: null,
    isLoading: false,
    error: null,
    testResults: {},
    testingIds: new Set(),

    clearError: () => set({ error: null }),

    fetchProfiles: async () => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch('/api/connection-profiles');
            if (!res.ok) throw new Error('Failed to fetch profiles');
            const data = await res.json();
            set({ profiles: data, isLoading: false });
        } catch (err: any) {
            set({ error: err.message, isLoading: false });
        }
    },

    fetchActiveProfile: async () => {
        try {
            const res = await fetch('/api/connection-profiles/active/client');
            if (!res.ok) {
                set({ activeProfile: null });
                return;
            }
            const data = await res.json();
            set({ activeProfile: data });
        } catch {
            set({ activeProfile: null });
        }
    },

    createProfile: async (data) => {
        try {
            const res = await fetch('/api/connection-profiles', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to create profile');
            }
            const created = await res.json();
            await get().fetchProfiles();
            return created.id;
        } catch (err: any) {
            set({ error: err.message });
            return null;
        }
    },

    updateProfile: async (id, data) => {
        try {
            const res = await fetch(`/api/connection-profiles/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update profile');
            // Clear cached Agent Zero endpoint paths so fresh discovery happens
            await fetch('/api/agent-zero/csrf', { method: 'POST' }).catch(() => {});
            await get().fetchProfiles();
            await get().fetchActiveProfile(); // Force syncing active profile too
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    deleteProfile: async (id) => {
        try {
            const res = await fetch(`/api/connection-profiles/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to delete profile');
            }
            await get().fetchProfiles();
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    activateProfile: async (id) => {
        try {
            const res = await fetch(`/api/connection-profiles/${id}/activate`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to activate profile');
            // Clear cached Agent Zero endpoint paths for the new profile
            await fetch('/api/agent-zero/csrf', { method: 'POST' }).catch(() => {});
            await get().fetchProfiles();
            await get().fetchActiveProfile();
        } catch (err: any) {
            set({ error: err.message });
        }
    },

    testProfile: async (id) => {
        set((state) => ({ testingIds: new Set([...state.testingIds, id]) }));
        try {
            const res = await fetch(`/api/connection-profiles/${id}/test`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to test connection');
            const result: ConnectionTestResult = await res.json();
            set((state) => ({
                testResults: { ...state.testResults, [id]: result },
                testingIds: new Set([...state.testingIds].filter((x) => x !== id)),
            }));
            await get().fetchProfiles();
            return result;
        } catch (err: any) {
            set((state) => ({
                error: err.message,
                testingIds: new Set([...state.testingIds].filter((x) => x !== id)),
            }));
            return null;
        }
    },
}));
