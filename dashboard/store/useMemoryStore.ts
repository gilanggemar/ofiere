import { create } from 'zustand';
import type { Conversation, Message, KnowledgeFragment } from '@/lib/memory/types';

interface MemoryState {
    conversations: Conversation[];
    activeConversationId: string | null;
    messages: Message[];
    knowledge: KnowledgeFragment[];
    isLoading: boolean;
    searchQuery: string;
    activeAgentFilter: string;

    setConversations: (convos: Conversation[]) => void;
    setActiveConversation: (id: string | null) => void;
    setMessages: (msgs: Message[]) => void;
    appendMessage: (msg: Message) => void;
    setKnowledge: (fragments: KnowledgeFragment[]) => void;
    setLoading: (loading: boolean) => void;
    setSearchQuery: (query: string) => void;
    setActiveAgentFilter: (agent: string) => void;

    fetchConversations: (agentId?: string) => Promise<void>;
    fetchMessages: (conversationId: string) => Promise<void>;
    fetchKnowledge: (agentId: string, query?: string) => Promise<void>;
}

export const useMemoryStore = create<MemoryState>((set, get) => ({
    conversations: [],
    activeConversationId: null,
    messages: [],
    knowledge: [],
    isLoading: false,
    searchQuery: '',
    activeAgentFilter: 'all',

    setConversations: (conversations) => set({ conversations }),
    setActiveConversation: (id) => set({ activeConversationId: id }),
    setMessages: (messages) => set({ messages }),
    appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),
    setKnowledge: (knowledge) => set({ knowledge }),
    setLoading: (loading) => set({ isLoading: loading }),
    setSearchQuery: (query) => set({ searchQuery: query }),
    setActiveAgentFilter: (agent) => set({ activeAgentFilter: agent }),

    fetchConversations: async (agentId) => {
        set({ isLoading: true });
        try {
            const params = agentId && agentId !== 'all' ? `?agentId=${agentId}` : '';
            const res = await fetch(`/api/memory/conversations${params}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) set({ conversations: data });
            }
        } catch (e) {
            console.error('Failed to fetch conversations:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    fetchMessages: async (conversationId) => {
        set({ isLoading: true, activeConversationId: conversationId });
        try {
            const res = await fetch(`/api/chat/messages?conversation_id=${encodeURIComponent(conversationId)}`);
            if (res.ok) {
                const data = await res.json();
                set({ messages: data.messages || [] });
            }
        } catch (e) {
            console.error('Failed to fetch messages:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    fetchKnowledge: async (agentId, query) => {
        set({ isLoading: true });
        try {
            const params = new URLSearchParams({ agentId });
            if (query) params.set('q', query);
            const res = await fetch(`/api/memory/knowledge?${params}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) set({ knowledge: data });
            }
        } catch (e) {
            console.error('Failed to fetch knowledge:', e);
        } finally {
            set({ isLoading: false });
        }
    },
}));
