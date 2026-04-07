// stores/usePentagramChatStore.ts
// Manages in-game companion chat for Pentagram Protocol:
// character registry, per-character conversations, save/load, gossip settings,
// sampling parameters, and per-character asset bindings.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PentagramCharacter {
    id: string;            // agent id e.g. 'ivy'
    name: string;
    avatar?: string;
    colorHex: string;
    hidden: boolean;       // user can hide from the bar
    addedAt: string;       // ISO timestamp
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: string;
}

export interface GameSaveEntry {
    id: string;
    save_name: string;
    created_at: string;
    updated_at: string;
}

/** Featherless AI / OpenAI-compatible sampling parameters */
export interface SamplingParams {
    temperature: number;
    top_p: number;
    top_k: number;
    repetition_penalty: number;
    frequency_penalty: number;
    presence_penalty: number;
    min_p: number;
    max_tokens: number;
}

/** Per-character visual asset bindings */
export interface CharacterAssetBinding {
    heroUrl?: string;
    backgroundUrl?: string;
    heroTransform?: { scale: number; x: number; y: number };
}

const DEFAULT_SAMPLING: SamplingParams = {
    temperature: 0.82,
    top_p: 0.9,
    top_k: 50,
    repetition_penalty: 1.15,
    frequency_penalty: 0.1,
    presence_penalty: 0.1,
    min_p: 0.05,
    max_tokens: 2048,
};

// Module-level abort controller for cancelling in-flight LLM requests
let _activeAbortController: AbortController | null = null;

interface PentagramChatState {
    // Character registry (persisted locally)
    characters: PentagramCharacter[];

    // Active character being chatted with
    activeCharacterId: string | null;

    // Per-character message history (loaded from DB)
    conversations: Record<string, ChatMessage[]>;

    // Chat UI state
    isChatOpen: boolean;
    isStreaming: boolean;
    streamingContent: string;

    // Gossip frequency (0-1)
    gossipFrequency: number;

    // Sampling parameters (persisted)
    samplingParams: SamplingParams;

    // Per-character asset bindings (persisted)
    characterAssets: Record<string, CharacterAssetBinding>;

    // Save slots
    saves: GameSaveEntry[];

    // Actions
    setActiveCharacter: (agentId: string) => void;
    toggleChat: () => void;
    openChat: () => void;
    closeChat: () => void;
    setGossipFrequency: (freq: number) => void;

    // Sampling params
    updateSamplingParam: <K extends keyof SamplingParams>(key: K, value: SamplingParams[K]) => void;
    resetSamplingParams: () => void;

    // Character asset bindings
    setCharacterAsset: (agentId: string, binding: Partial<CharacterAssetBinding>) => void;
    clearCharacterAsset: (agentId: string, field: keyof CharacterAssetBinding) => void;

    // Character management
    syncCharactersFromRoster: (connectedAgents: { id: string; name: string; avatar?: string; colorHex: string }[]) => void;
    toggleCharacterVisibility: (agentId: string) => void;

    // Chat operations
    loadChatHistory: (agentId: string) => Promise<void>;
    sendMessage: (content: string, gameContext: any) => Promise<void>;
    clearConversation: (agentId: string) => Promise<void>;
    addLocalMessage: (agentId: string, msg: ChatMessage) => void;

    // Save/Load
    loadSaves: () => Promise<void>;
    createSave: (saveName: string, gameData: any) => Promise<void>;
    loadSave: (saveId: string) => Promise<any>;
    deleteSave: (saveId: string) => Promise<void>;
}

export const usePentagramChatStore = create<PentagramChatState>()(
    persist(
        (set, get) => ({
            characters: [],
            activeCharacterId: null,
            conversations: {},
            isChatOpen: false,
            isStreaming: false,
            streamingContent: '',
            gossipFrequency: 0.4,
            samplingParams: { ...DEFAULT_SAMPLING },
            characterAssets: {},
            saves: [],

            setActiveCharacter: (agentId) => {
                set({ activeCharacterId: agentId });
                // Load history if not already loaded
                const convos = get().conversations;
                if (!convos[agentId] || convos[agentId].length === 0) {
                    get().loadChatHistory(agentId);
                }
            },

            toggleChat: () => set(s => ({ isChatOpen: !s.isChatOpen })),
            openChat: () => set({ isChatOpen: true }),
            closeChat: () => set({ isChatOpen: false }),

            setGossipFrequency: (freq) => set({ gossipFrequency: Math.max(0, Math.min(1, freq)) }),

            updateSamplingParam: (key, value) => {
                set(s => ({
                    samplingParams: { ...s.samplingParams, [key]: value },
                }));
            },

            resetSamplingParams: () => set({ samplingParams: { ...DEFAULT_SAMPLING } }),

            setCharacterAsset: (agentId, binding) => {
                set(s => ({
                    characterAssets: {
                        ...s.characterAssets,
                        [agentId]: { ...(s.characterAssets[agentId] || {}), ...binding },
                    },
                }));
            },

            clearCharacterAsset: (agentId, field) => {
                set(s => {
                    const current = { ...(s.characterAssets[agentId] || {}) };
                    delete current[field];
                    return {
                        characterAssets: { ...s.characterAssets, [agentId]: current },
                    };
                });
            },

            syncCharactersFromRoster: (connectedAgents) => {
                const existing = get().characters;
                const existingIds = new Set(existing.map(c => c.id));

                const newChars = connectedAgents
                    .filter(a => !existingIds.has(a.id))
                    .map(a => ({
                        id: a.id,
                        name: a.name,
                        avatar: a.avatar,
                        colorHex: a.colorHex,
                        hidden: false,
                        addedAt: new Date().toISOString(),
                    }));

                const updatedExisting = existing.map(c => {
                    const fresh = connectedAgents.find(a => a.id === c.id);
                    if (fresh) {
                        return { ...c, name: fresh.name, avatar: fresh.avatar, colorHex: fresh.colorHex };
                    }
                    return c;
                });

                set({ characters: [...updatedExisting, ...newChars] });
            },

            toggleCharacterVisibility: (agentId) => {
                set(s => ({
                    characters: s.characters.map(c =>
                        c.id === agentId ? { ...c, hidden: !c.hidden } : c
                    ),
                }));
            },

            loadChatHistory: async (agentId) => {
                try {
                    const res = await fetch(`/api/pentagram-chat/history?agent_id=${encodeURIComponent(agentId)}`);
                    if (!res.ok) return;
                    const data = await res.json();
                    const msgs: ChatMessage[] = data.map((d: any) => ({
                        id: d.id,
                        role: d.role,
                        content: d.content,
                        timestamp: d.created_at,
                    }));
                    set(s => ({
                        conversations: { ...s.conversations, [agentId]: msgs },
                    }));
                } catch (e) {
                    console.warn('[pentagram-chat] Failed to load history:', e);
                }
            },

            sendMessage: async (content, gameContext) => {
                const { activeCharacterId, conversations, gossipFrequency, characters, samplingParams } = get();
                if (!activeCharacterId) return;

                // If already streaming, abort the previous request first
                if (get().isStreaming && _activeAbortController) {
                    console.warn('[pentagram-chat] Aborting previous in-flight request...');
                    _activeAbortController.abort();
                    // Small delay to let the abort settle
                    await new Promise(r => setTimeout(r, 300));
                }

                const char = characters.find(c => c.id === activeCharacterId);
                if (!char) return;

                // Add user message locally
                const userMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content,
                    timestamp: new Date().toISOString(),
                };

                const currentMsgs = conversations[activeCharacterId] || [];
                const updatedMsgs = [...currentMsgs, userMsg];
                set(s => ({
                    conversations: { ...s.conversations, [activeCharacterId]: updatedMsgs },
                    isStreaming: true,
                    streamingContent: '',
                }));

                // Create AbortController for this request
                const abortController = new AbortController();
                _activeAbortController = abortController;

                // Helper: add a system message to the chat (for errors)
                const addSystemMsg = (text: string) => {
                    const sysMsg: ChatMessage = {
                        id: crypto.randomUUID(),
                        role: 'system',
                        content: text,
                        timestamp: new Date().toISOString(),
                    };
                    set(s => ({
                        conversations: {
                            ...s.conversations,
                            [activeCharacterId]: [...(s.conversations[activeCharacterId] || []), sysMsg],
                        },
                    }));
                };

                // Retry logic with concurrency-aware backoff
                const MAX_RETRIES = 4;
                let lastError: Error | null = null;

                for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                    // Check if this request was aborted (new message sent)
                    if (abortController.signal.aborted) {
                        set({ isStreaming: false, streamingContent: '' });
                        return;
                    }

                    try {
                        // Dynamically import stores to avoid circular deps
                        const { useOpenClawModelStore } = await import('@/stores/useOpenClawModelStore');
                        const { useCompanionProfileStore } = await import('@/stores/useCompanionProfileStore');

                        const modelStore = useOpenClawModelStore.getState();
                        const companionStore = useCompanionProfileStore.getState();

                        // Resolve companion model
                        const getModel = (role: string): string => {
                            return modelStore.activeModels[role as keyof typeof modelStore.activeModels]?.[activeCharacterId]
                                || modelStore.defaults[role as keyof typeof modelStore.defaults]
                                || '';
                        };
                        const modelRef = getModel('companion_chat') || getModel('companion') || '';

                        // Get companion profile system prompt
                        await companionStore.loadProfile(activeCharacterId);
                        const systemPrompt = companionStore.getCompiledMarkdown(activeCharacterId, char.name);

                        // Build message history for API (last 30 messages for context window)
                        const historyForApi = updatedMsgs
                            .filter(m => m.role !== 'system')
                            .slice(-30)
                            .map(m => ({ role: m.role, content: m.content }));

                        // Show retry status in streaming content
                        if (attempt > 0) {
                            set({ streamingContent: `⏳ Waiting for API slot... (attempt ${attempt + 1}/${MAX_RETRIES + 1})` });
                        }

                        const res = await fetch('/api/pentagram-chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            signal: abortController.signal,
                            body: JSON.stringify({
                                agent_id: activeCharacterId,
                                agent_name: char.name,
                                model_ref: modelRef,
                                system_prompt: systemPrompt,
                                messages: historyForApi,
                                game_context: gameContext,
                                gossip_frequency: gossipFrequency,
                                sampling_params: samplingParams,
                            }),
                        });

                        if (!res.ok) {
                            const errText = await res.text();
                            const status = res.status;

                            // Parse error to check for concurrency limit
                            let isConcurrencyError = false;
                            try {
                                const errJson = JSON.parse(errText);
                                const errMsg = errJson?.error?.message || errJson?.error || '';
                                isConcurrencyError = typeof errMsg === 'string' && (
                                    errMsg.includes('concurrency') ||
                                    errMsg.includes('Concurrency') ||
                                    errMsg.includes('concurrent')
                                );
                            } catch {
                                isConcurrencyError = errText.includes('concurrency') || errText.includes('Concurrency');
                            }

                            if (attempt < MAX_RETRIES && (status === 429 || status === 502 || status === 503 || isConcurrencyError)) {
                                // Concurrency errors need longer waits (previous request must finish)
                                const baseDelay = isConcurrencyError ? 8000 : 2000;
                                const backoffMs = Math.min(baseDelay * Math.pow(1.5, attempt) + Math.random() * 2000, 20000);
                                console.warn(`[pentagram-chat] ${isConcurrencyError ? 'Concurrency limit' : status} error, retrying in ${Math.round(backoffMs / 1000)}s (attempt ${attempt + 1}/${MAX_RETRIES})...`);
                                set({ streamingContent: `⏳ ${isConcurrencyError ? 'Model busy — waiting for slot' : 'Rate limited — retrying'}... (${Math.round(backoffMs / 1000)}s)` });
                                await new Promise(r => setTimeout(r, backoffMs));
                                continue;
                            }

                            // Format a friendly error message
                            if (isConcurrencyError) {
                                throw new Error('CONCURRENCY_LIMIT');
                            }
                            throw new Error(errText);
                        }

                        // Clear retry status
                        set({ streamingContent: '' });

                        // Stream the response
                        const reader = res.body?.getReader();
                        if (!reader) throw new Error('No stream');

                        const decoder = new TextDecoder();
                        let fullResponse = '';
                        let buffer = '';

                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            buffer += decoder.decode(value, { stream: true });
                            const lines = buffer.split('\n');
                            buffer = lines.pop() || '';

                            for (const line of lines) {
                                const trimmed = line.trim();
                                if (!trimmed || !trimmed.startsWith('data:')) continue;
                                const payload = trimmed.slice(5).trim();
                                if (payload === '[DONE]') continue;

                                try {
                                    const parsed = JSON.parse(payload);
                                    if (parsed.content) {
                                        fullResponse += parsed.content;
                                        set({ streamingContent: fullResponse });
                                    }
                                } catch {}
                            }
                        }

                        // Finalize: add assistant message
                        if (fullResponse) {
                            const assistantMsg: ChatMessage = {
                                id: crypto.randomUUID(),
                                role: 'assistant',
                                content: fullResponse,
                                timestamp: new Date().toISOString(),
                            };

                            set(s => ({
                                conversations: {
                                    ...s.conversations,
                                    [activeCharacterId]: [...(s.conversations[activeCharacterId] || []), assistantMsg],
                                },
                                isStreaming: false,
                                streamingContent: '',
                            }));
                        } else {
                            set({ isStreaming: false, streamingContent: '' });
                        }

                        // Clean up abort controller
                        if (_activeAbortController === abortController) {
                            _activeAbortController = null;
                        }

                        // Success — exit retry loop
                        return;

                    } catch (e: any) {
                        // Aborted by user sending a new message — exit silently
                        if (e?.name === 'AbortError') {
                            set({ isStreaming: false, streamingContent: '' });
                            return;
                        }

                        lastError = e;

                        // Concurrency-specific friendly message after all retries
                        if (e?.message === 'CONCURRENCY_LIMIT') {
                            addSystemMsg('⚠️ Model is busy — your plan\'s concurrency limit was reached. Wait a moment for the previous request to finish, then try again.');
                            set({ isStreaming: false, streamingContent: '' });
                            if (_activeAbortController === abortController) _activeAbortController = null;
                            return;
                        }

                        // If we still have retries left for network errors, try again
                        if (attempt < MAX_RETRIES && (e?.message?.includes('fetch') || e?.message?.includes('network') || e?.message?.includes('Failed'))) {
                            const backoffMs = Math.min(2000 * Math.pow(2, attempt) + Math.random() * 1000, 15000);
                            console.warn(`[pentagram-chat] Network error, retrying in ${Math.round(backoffMs / 1000)}s...`, e?.message);
                            set({ streamingContent: `⏳ Connection issue — retrying... (${Math.round(backoffMs / 1000)}s)` });
                            await new Promise(r => setTimeout(r, backoffMs));
                            continue;
                        }

                        break;
                    }
                }

                // All retries exhausted — show error in chat
                console.error('[pentagram-chat] Send failed after retries:', lastError);
                const errorDetail = lastError?.message?.slice(0, 120) || 'Unknown error';
                addSystemMsg(`⚠️ Failed to get a response. ${errorDetail.includes('{') ? 'The model may be overloaded.' : errorDetail} — Please try again.`);
                set({ isStreaming: false, streamingContent: '' });
                if (_activeAbortController === abortController) _activeAbortController = null;
            },

            clearConversation: async (agentId) => {
                try {
                    await fetch(`/api/pentagram-chat/history?agent_id=${encodeURIComponent(agentId)}`, {
                        method: 'DELETE',
                    });
                } catch (e) {
                    console.warn('[pentagram-chat] Clear failed:', e);
                }
                set(s => ({
                    conversations: { ...s.conversations, [agentId]: [] },
                }));
            },

            addLocalMessage: (agentId, msg) => {
                set(s => ({
                    conversations: {
                        ...s.conversations,
                        [agentId]: [...(s.conversations[agentId] || []), msg],
                    },
                }));
            },

            loadSaves: async () => {
                try {
                    const res = await fetch('/api/pentagram-saves');
                    if (!res.ok) return;
                    const data = await res.json();
                    set({ saves: data });
                } catch (e) {
                    console.warn('[pentagram-saves] Load failed:', e);
                }
            },

            createSave: async (saveName, gameData) => {
                try {
                    const res = await fetch('/api/pentagram-saves', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ save_name: saveName, save_data: gameData }),
                    });
                    if (res.ok) {
                        await get().loadSaves();
                    }
                } catch (e) {
                    console.error('[pentagram-saves] Save failed:', e);
                }
            },

            loadSave: async (saveId) => {
                try {
                    const res = await fetch('/api/pentagram-saves', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ save_id: saveId }),
                    });
                    if (!res.ok) throw new Error('Load failed');
                    const data = await res.json();
                    return data.save_data;
                } catch (e) {
                    console.error('[pentagram-saves] Load failed:', e);
                    return null;
                }
            },

            deleteSave: async (saveId) => {
                try {
                    await fetch(`/api/pentagram-saves?id=${encodeURIComponent(saveId)}`, {
                        method: 'DELETE',
                    });
                    await get().loadSaves();
                } catch (e) {
                    console.warn('[pentagram-saves] Delete failed:', e);
                }
            },
        }),
        {
            name: 'pentagram-chat-v1',
            partialize: (state) => ({
                characters: state.characters,
                gossipFrequency: state.gossipFrequency,
                samplingParams: state.samplingParams,
                characterAssets: state.characterAssets,
                // Don't persist conversations or streaming state — load from DB
            }),
        }
    )
);
