import { create } from 'zustand';
import { agentZeroService } from '@/lib/agentZeroService';
import { AGENT_ZERO_BASE_URL, IS_REMOTE_AGENT_ZERO } from '@/lib/config';

export interface AgentZeroMessage {
    id: string;
    role: 'user' | 'agent';
    content: string;
    timestamp: number;
    attachments?: any[];
}

export interface AgentZeroState {
    status: 'unconfigured' | 'offline' | 'connecting' | 'online' | 'error';
    connectionMode: 'rest' | 'polling' | 'websocket';
    messages: AgentZeroMessage[];
    isResponding: boolean;

    // A0 state
    contextId: string | null;
    snapshot: any | null;
    logs: any[];
    notifications: any[];

    // VPS Configuration
    vpsBaseUrl: string;
    vpsConnected: boolean;
    vpsLastHealthCheck: number | null;
    isRemote: boolean;

    // Actions
    setSocketStatus: (status: 'offline' | 'connecting' | 'online' | 'error' | 'unconfigured') => void;
    setSnapshot: (snapshot: any) => void;
    addNotification: (notice: any) => void;
    setLogs: (logs: any[]) => void;
    setVpsBaseUrl: (url: string) => void;

    checkConnection: () => Promise<void>;
    checkVpsHealth: () => Promise<boolean>;
    sendMessage: (message: string, attachments?: any[]) => Promise<void>;
    getLogs: () => Promise<void>;
    resetChat: () => Promise<void>;
    terminateChat: () => Promise<void>;

    clearMessages: () => void;
}

const genId = () => typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const useAgentZeroStore = create<AgentZeroState>()((set, get) => ({
    status: 'unconfigured',
    connectionMode: 'polling', // A0 fallback mode
    messages: [],
    isResponding: false,

    contextId: null,
    snapshot: null,
    logs: [],
    notifications: [],

    // VPS Configuration
    vpsBaseUrl: AGENT_ZERO_BASE_URL,
    vpsConnected: false,
    vpsLastHealthCheck: null,
    isRemote: IS_REMOTE_AGENT_ZERO,

    setSocketStatus: (status) => set({ status }),
    setSnapshot: (snapshot) => set({ snapshot }),
    addNotification: (notice) => set((state) => ({ notifications: [...state.notifications, notice] })),
    setLogs: (logs) => set({ logs }),
    setVpsBaseUrl: (url) => set({
        vpsBaseUrl: url,
        isRemote: !url.includes('127.0.0.1') && !url.includes('localhost'),
    }),

    checkVpsHealth: async () => {
        try {
            const res = await agentZeroService.checkHealth();
            const isOnline = res.status === 'online';
            const isAuthFailed = (res as any).status === 'auth_failed';
            // Treat auth_failed as "online" — server IS reachable, just needs correct key
            const isReachable = isOnline || isAuthFailed;
            set({
                vpsConnected: isReachable,
                vpsLastHealthCheck: Date.now(),
                status: isReachable
                    ? 'online'
                    : (res.status === 'unconfigured' ? 'unconfigured' : 'offline'),
            });
            return isReachable;
        } catch {
            set({
                vpsConnected: false,
                vpsLastHealthCheck: Date.now(),
                status: 'error',
            });
            return false;
        }
    },

    checkConnection: async () => {
        set({ status: 'connecting' });
        try {
            const res = await agentZeroService.checkHealth();
            // Treat both 'online' and 'auth_failed' as reachable
            // auth_failed means the server IS running, just the API key is wrong
            const isReachable = res.status === 'online' || (res as any).status === 'auth_failed';
            if (isReachable) {
                set({ status: 'online' });
                // If we already have a context, start polling it slowly
                const ctx = get().contextId;
                if (ctx) agentZeroService.startLogPolling(ctx, 2000);
            } else {
                set({ status: 'offline' });
                agentZeroService.stopLogPolling();
            }
        } catch {
            set({ status: 'error' });
            agentZeroService.stopLogPolling();
        }
    },

    sendMessage: async (message: string, attachments?: any[]) => {
        set({ isResponding: true });

        const userMsg: AgentZeroMessage = {
            id: genId(),
            role: 'user',
            content: message,
            timestamp: Date.now(),
            attachments
        };

        set((state) => ({ messages: [...state.messages, userMsg] }));

        try {
            const { contextId } = get();

            // If we have a context, start fast polling while we wait for the message to return
            if (contextId) {
                agentZeroService.startLogPolling(contextId, 1000);
            }

            // Map attachments for A0 API
            const mappedAttachments = attachments?.map(a => ({
                filename: a.name || 'file',
                base64: typeof a.url === 'string' && a.url.includes('base64,') ? a.url.split('base64,')[1] : a.url
            }));

            const res = await agentZeroService.sendMessage({
                message,
                attachments: mappedAttachments && mappedAttachments.length > 0 ? mappedAttachments : undefined,
                context_id: contextId || undefined,
            });

            // Save new context ID if we didn't have one
            if (res.context_id && res.context_id !== contextId) {
                set({ contextId: res.context_id });
            }

            // A0 returns the agent's text response directly from POST /api_message
            if (res.response) {
                const agentMsg: AgentZeroMessage = {
                    id: genId(),
                    role: 'agent',
                    content: res.response,
                    timestamp: Date.now()
                };
                set((state) => ({ messages: [...state.messages, agentMsg] }));
            }

            // After message returns, drop caching back to a slow 2 second poll to keep terminal updated
            if (res.context_id) {
                agentZeroService.startLogPolling(res.context_id, 2000);
            }

        } catch (err: any) {
            const errorMsg: AgentZeroMessage = {
                id: genId(),
                role: 'agent',
                content: `Error: ${err.message}`,
                timestamp: Date.now()
            };
            set((state) => ({
                messages: [...state.messages, errorMsg],
            }));
            const { contextId } = get();
            if (contextId) agentZeroService.startLogPolling(contextId, 2000);
        } finally {
            set({ isResponding: false });
        }
    },

    getLogs: async () => {
        const { contextId } = get();
        if (!contextId) return;

        try {
            const res = await agentZeroService.getLogs(contextId);
            const items = res.log?.items || (res as any).items || (Array.isArray(res) ? res : []);
            set({ logs: items });
        } catch (err) {
            console.error('Failed to get logs:', err);
        }
    },

    resetChat: async () => {
        const { contextId } = get();
        if (!contextId) {
            set({ messages: [], snapshot: null, logs: [] });
            return;
        }

        agentZeroService.stopLogPolling();

        try {
            await agentZeroService.resetChat(contextId);
            set({ messages: [], snapshot: null, logs: [] });
            // Resume polling on the same context
            agentZeroService.startLogPolling(contextId, 2000);
        } catch (err: any) {
            console.error('Failed to reset chat:', err);
        }
    },

    terminateChat: async () => {
        const { contextId } = get();
        if (!contextId) {
            set({ messages: [], snapshot: null, logs: [], contextId: null });
            return;
        }

        try {
            agentZeroService.stopLogPolling();
            await agentZeroService.terminateChat(contextId);
            set({ messages: [], snapshot: null, logs: [], contextId: null });
        } catch (err: any) {
            console.error('Failed to terminate chat:', err);
        }
    },

    clearMessages: () => set({ messages: [], isResponding: false, snapshot: null, logs: [] }),
}));

export default useAgentZeroStore;
