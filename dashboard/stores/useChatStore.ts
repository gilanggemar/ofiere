// ─── Unified Chat Store ──────────────────────────────────────────────────────
// Single source of truth for ALL chat state in NERV.OS.
// Supabase is the persistent layer; this store is the reactive cache.
// Agent adapters handle the actual message dispatch to backends.

import { create } from 'zustand';
import type { Conversation, Message } from '@/types/chat';
import { getAdapterForAgent } from '@/lib/chat/adapters';
import type { MissionConfig } from '@/components/chat/MissionBar';
import type { StrategyMode } from '@/components/chat/StrategyModeSwitcher';

// ─── State Shape ─────────────────────────────────────────────────────────────

interface ChatState {
    // Active agent and conversation
    activeAgentId: string | null;
    activeConversationId: string | null;

    // Conversations keyed by ID for O(1) lookup
    conversations: Record<string, Conversation>;

    // Messages for the active conversation
    activeMessages: Message[];

    // Streaming content for real-time agent responses
    streamingContent: string;

    // Per-conversation strategy mode (ephemeral, not persisted to DB)
    strategyModes: Record<string, StrategyMode>;

    // Loading states
    isLoadingConversations: boolean;
    isLoadingMessages: boolean;
    isSendingMessage: boolean;

    // Error tracking
    lastError: string | null;
}

interface ChatActions {
    // Agent management
    setActiveAgent: (agentId: string) => void;

    // Conversation management
    loadConversations: (agentId?: string) => Promise<void>;
    setActiveConversation: (conversationId: string | null) => Promise<void>;
    createConversation: (agentId: string, title?: string) => Promise<string | null>;
    updateConversation: (id: string, updates: Partial<Pick<Conversation, 'title' | 'pinned' | 'archived' | 'mission_config'>>) => Promise<void>;
    deleteConversation: (id: string) => Promise<void>;

    // Message management
    sendMessage: (content: string, attachments?: any[]) => Promise<void>;
    appendMessage: (message: Message) => void;
    updateStreamingContent: (content: string) => void;

    // Strategy mode (ephemeral)
    setStrategyMode: (conversationId: string, mode: StrategyMode) => void;
    getStrategyMode: (conversationId: string) => StrategyMode;

    // Mission config persistence
    updateMissionConfig: (conversationId: string, config: MissionConfig) => Promise<void>;

    // Utility
    clearActiveConversation: () => void;
    getFilteredConversations: (filter?: 'all' | 'pinned' | 'archived') => Conversation[];
}

type ChatStore = ChatState & ChatActions;

// ─── Store Implementation ────────────────────────────────────────────────────

export const useChatStore = create<ChatStore>((set, get) => ({
    // Initial state
    activeAgentId: null,
    activeConversationId: null,
    conversations: {},
    activeMessages: [],
    streamingContent: '',
    strategyModes: {},
    isLoadingConversations: false,
    isLoadingMessages: false,
    isSendingMessage: false,
    lastError: null,

    // ─── Agent Management ────────────────────────────────────────────────────

    setActiveAgent: (agentId: string) => {
        const current = get().activeAgentId;
        if (current === agentId) return;

        set({
            activeAgentId: agentId,
            activeConversationId: null,
            activeMessages: [],
            streamingContent: '',
        });

        // Load conversations for the new agent
        get().loadConversations(agentId);
    },

    // ─── Conversation Management ─────────────────────────────────────────────

    loadConversations: async (agentId?: string) => {
        const agent = agentId || get().activeAgentId;
        if (!agent) return;

        set({ isLoadingConversations: true, lastError: null });
        try {
            const res = await fetch(`/api/chat/conversations?agent_id=${encodeURIComponent(agent)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { conversations: list } = await res.json();

            const map: Record<string, Conversation> = {};
            for (const c of list) {
                map[c.id] = c;
            }
            set({ conversations: map, isLoadingConversations: false });
        } catch (err: any) {
            console.error('[useChatStore] loadConversations failed:', err);
            set({ isLoadingConversations: false, lastError: err.message });
        }
    },

    setActiveConversation: async (conversationId: string | null) => {
        if (!conversationId) {
            set({ activeConversationId: null, activeMessages: [], streamingContent: '' });
            return;
        }

        const current = get().activeConversationId;
        if (current === conversationId) return;

        set({
            activeConversationId: conversationId,
            activeMessages: [],
            streamingContent: '',
            isLoadingMessages: true,
        });

        try {
            const res = await fetch(`/api/chat/messages?conversation_id=${encodeURIComponent(conversationId)}`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { messages } = await res.json();

            // Only update if we're still on the same conversation (prevent stale data)
            if (get().activeConversationId === conversationId) {
                set({ activeMessages: messages || [], isLoadingMessages: false });
            }
        } catch (err: any) {
            console.error('[useChatStore] setActiveConversation failed:', err);
            if (get().activeConversationId === conversationId) {
                set({ isLoadingMessages: false, lastError: err.message });
            }
        }
    },

    createConversation: async (agentId: string, title?: string) => {
        try {
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: agentId, title }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { conversation } = await res.json();

            // Add to local map
            set((state) => ({
                conversations: { ...state.conversations, [conversation.id]: conversation },
                activeConversationId: conversation.id,
                activeMessages: [],
                streamingContent: '',
            }));

            return conversation.id;
        } catch (err: any) {
            console.error('[useChatStore] createConversation failed:', err);
            set({ lastError: err.message });
            return null;
        }
    },

    updateConversation: async (id: string, updates) => {
        // Optimistic update
        set((state) => {
            const existing = state.conversations[id];
            if (!existing) return state;
            return {
                conversations: {
                    ...state.conversations,
                    [id]: { ...existing, ...updates, updated_at: new Date().toISOString() },
                },
            };
        });

        try {
            const res = await fetch(`/api/chat/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { conversation } = await res.json();

            // Replace with server data
            set((state) => ({
                conversations: { ...state.conversations, [id]: conversation },
            }));
        } catch (err: any) {
            console.error('[useChatStore] updateConversation failed:', err);
            // Revert on error — reload all
            get().loadConversations();
        }
    },

    deleteConversation: async (id: string) => {
        // Optimistic removal
        set((state) => {
            const { [id]: _, ...rest } = state.conversations;
            const isActive = state.activeConversationId === id;
            return {
                conversations: rest,
                ...(isActive ? { activeConversationId: null, activeMessages: [], streamingContent: '' } : {}),
            };
        });

        try {
            const res = await fetch(`/api/chat/conversations/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
        } catch (err: any) {
            console.error('[useChatStore] deleteConversation failed:', err);
            get().loadConversations();
        }
    },

    // ─── Message Management ──────────────────────────────────────────────────

    sendMessage: async (content: string, attachments?: any[]) => {
        const { activeAgentId, activeConversationId } = get();
        if (!activeAgentId) return;

        set({ isSendingMessage: true, lastError: null });

        try {
            let conversationId = activeConversationId;

            // Auto-create conversation if none is active
            if (!conversationId) {
                conversationId = await get().createConversation(activeAgentId);
                if (!conversationId) throw new Error('Failed to create conversation');
            }

            // 1. Persist user message to Supabase
            const userMsgRes = await fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: conversationId,
                    role: 'user',
                    content,
                    metadata: attachments ? { attachments } : {},
                }),
            });

            if (!userMsgRes.ok) throw new Error(`Failed to save user message: HTTP ${userMsgRes.status}`);
            const { message: savedUserMsg, title_updated } = await userMsgRes.json();

            // 2. Optimistically add user message to active messages
            set((state) => ({
                activeMessages: [...state.activeMessages, savedUserMsg],
            }));

            // 3. If title was auto-generated, update the local conversation
            if (title_updated) {
                get().loadConversations(activeAgentId);
            }

            // 4. Dispatch to agent adapter
            const adapter = getAdapterForAgent(activeAgentId);
            const result = await adapter.sendMessage({
                conversationId,
                agentId: activeAgentId,
                content,
                attachments,
                history: get().activeMessages,
            });

            // 5. If adapter returned a direct response (non-streaming), persist it
            if (!result.streaming && result.content) {
                const assistantRes = await fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: conversationId,
                        role: 'assistant',
                        content: result.content,
                        metadata: result.metadata,
                    }),
                });

                if (assistantRes.ok) {
                    const { message: savedAssistantMsg } = await assistantRes.json();
                    set((state) => ({
                        activeMessages: [...state.activeMessages, savedAssistantMsg],
                    }));
                }
            }
            // For streaming adapters, the response comes via WebSocket events
            // and is synced into activeMessages by the UI layer

        } catch (err: any) {
            console.error('[useChatStore] sendMessage failed:', err);
            set({ lastError: err.message });
        } finally {
            set({ isSendingMessage: false });
        }
    },

    appendMessage: (message: Message) => {
        set((state) => ({
            activeMessages: [...state.activeMessages, message],
        }));
    },

    updateStreamingContent: (content: string) => {
        set({ streamingContent: content });
    },

    // ─── Strategy Mode (Ephemeral) ──────────────────────────────────────────

    setStrategyMode: (conversationId: string, mode: StrategyMode) => {
        set((state) => ({
            strategyModes: { ...state.strategyModes, [conversationId]: mode },
        }));
    },

    getStrategyMode: (conversationId: string): StrategyMode => {
        return get().strategyModes[conversationId] || 'off';
    },

    // ─── Mission Config ─────────────────────────────────────────────────────

    updateMissionConfig: async (conversationId: string, config: MissionConfig) => {
        await get().updateConversation(conversationId, { mission_config: config });
    },

    // ─── Utility ─────────────────────────────────────────────────────────────

    clearActiveConversation: () => {
        set({
            activeConversationId: null,
            activeMessages: [],
            streamingContent: '',
        });
    },

    getFilteredConversations: (filter: 'all' | 'pinned' | 'archived' = 'all') => {
        const convos = Object.values(get().conversations);
        switch (filter) {
            case 'pinned':
                return convos.filter(c => c.pinned && !c.archived);
            case 'archived':
                return convos.filter(c => c.archived);
            case 'all':
            default:
                return convos.filter(c => !c.archived);
        }
    },
}));
