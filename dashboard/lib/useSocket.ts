"use client";

import { useEffect, useRef, useCallback } from 'react';
import { create } from 'zustand';
import { useTaskStore } from './useTaskStore';
import { getGateway } from './openclawGateway';
import { initializeAgentSessions } from './useOpenClawGateway';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { parseOpenClawToolCalls } from './openclawToolParser';
import { getAgentProfile } from './agentRoster';

/** Estimate token count from text (roughly 4 chars per token for English) */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Log telemetry to the API when a chat run completes */
async function logChatTelemetry(params: {
    agentId: string;
    inputText: string;
    outputText: string;
    latencyMs: number;
    status: 'success' | 'error';
    runId?: string;
    errorMessage?: string;
}) {
    try {
        await fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: params.agentId,
                provider: 'openclaw',
                model: 'claude-sonnet-4-5-20250514',
                inputTokens: estimateTokens(params.inputText),
                outputTokens: estimateTokens(params.outputText),
                latencyMs: params.latencyMs,
                status: params.status,
                taskId: params.runId,
                errorMessage: params.errorMessage,
            }),
        });
    } catch (e) {
        console.warn('[Telemetry] Failed to log chat:', e);
    }
}

// ─── Re-export types for backward compatibility ───
// These types are used by: AppSidebar, summit/page, settings/page, console/page, chat/page, useChatRouter, AgentTasks

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    agentId?: string;
    sessionKey?: string;
    streaming?: boolean;
    tool_calls?: any[];
    attachments?: any[];
}

export interface SummitMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    agentId: string;
    agentLabel?: string;
    streaming?: boolean;
    roundNumber?: number;
    tool_calls?: any[];
    runId?: string;
}

export interface SessionInfo {
    key: string;
    kind: string;
    channel: string;
    displayName?: string;
    sessionId: string;
    agentId: string;
    updatedAt: number;
}

// ─── Socket Store (backward compatibility shim) ───
// Preserves the exact same interface that all consumers use.
// Internally bridges to the new OpenClawStore for shared state.

interface SocketState {
    isConnected: boolean;
    agents: any[];
    logs: string[];
    lastPing: number;
    gatewayInfo: any;
    sessions: SessionInfo[];
    chatMessages: ChatMessage[];
    summitMessages: SummitMessage[];
    summitParticipants: string[];
    summitActive: boolean;
    summitRound: number;
}

interface SocketStore extends SocketState {
    setConnected: (status: boolean) => void;
    setAgents: (agents: any[]) => void;
    addLog: (log: string) => void;
    updatePing: () => void;
    setGatewayInfo: (info: any) => void;
    setSessions: (sessions: SessionInfo[]) => void;
    addChatMessage: (msg: ChatMessage) => void;
    updateChatMessage: (id: string, update: Partial<ChatMessage>) => void;
    addSummitMessage: (msg: SummitMessage) => void;
    updateSummitMessage: (id: string, update: Partial<SummitMessage>) => void;
    setSummitParticipants: (ids: string[]) => void;
    setSummitActive: (active: boolean) => void;
    incrementSummitRound: () => void;
    clearSummit: () => void;
    setChatMessages: (messages: ChatMessage[], sessionKey?: string) => void;
}

export const useSocketStore = create<SocketStore>((set) => ({
    isConnected: false,
    agents: [],
    logs: [],
    lastPing: 0,
    gatewayInfo: null,
    sessions: [],
    chatMessages: [],
    summitMessages: [],
    summitParticipants: [],
    summitActive: false,
    summitRound: 0,
    setConnected: (status) => set({ isConnected: status }),
    setAgents: (agents) => set({ agents }),
    addLog: (log) => set((state) => ({ logs: [...state.logs.slice(-49), log] })),
    updatePing: () => set({ lastPing: Date.now() }),
    setGatewayInfo: (info) => set({ gatewayInfo: info }),
    setSessions: (sessions) => set({ sessions }),
    addChatMessage: (msg) => set((state) => {
        if (state.chatMessages.some(m => m.id === msg.id)) return state;
        const finalMsg = (msg as any)._sortTime ? msg : { ...msg, _sortTime: Date.now() };
        return { chatMessages: [...state.chatMessages, finalMsg] };
    }),
    updateChatMessage: (id, update) => set((state) => ({
        chatMessages: state.chatMessages.map(m =>
            m.id === id ? { ...m, ...update } : m
        )
    })),
    addSummitMessage: (msg) => set((state) => {
        if (state.summitMessages.some(m => m.id === msg.id)) return state;
        return { summitMessages: [...state.summitMessages, msg] };
    }),
    updateSummitMessage: (id, update) => set((state) => ({
        summitMessages: state.summitMessages.map(m =>
            m.id === id ? { ...m, ...update } : m
        )
    })),
    setSummitParticipants: (ids) => set({ summitParticipants: ids }),
    setSummitActive: (active) => set({ summitActive: active }),
    incrementSummitRound: () => set((state) => ({ summitRound: state.summitRound + 1 })),
    clearSummit: () => set({ summitMessages: [], summitParticipants: [], summitActive: false, summitRound: 0 }),
    setChatMessages: (messages, sessionKey) => set((state) => {
        if (!sessionKey) return { chatMessages: messages };
        const otherMessages = state.chatMessages.filter(m => m.sessionKey !== sessionKey);
        return { chatMessages: [...otherMessages, ...messages] };
    }),
}));

// ─── Constants ───

const SESSIONS_LIST_ID = 'ofiere-sessions-list';

/** Generate a short unique ID for idempotency keys and request tracking */
function uid(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract agentId from a session key.
 * Session keys follow the pattern: agent:<agentId>:<rest>
 */
function agentIdFromSessionKey(key: string): string {
    const parts = key.split(':');
    if (parts[0] === 'agent' && parts.length >= 2) return parts[1];
    return 'unknown';
}

/**
 * Parse health event payload into a flat agent list.
 */
function deriveStatus(data: any): string {
    if (data?.lastError) return 'error';
    if (data?.running && data?.connected) return 'working';
    if (data?.probe?.ok) return 'idle';
    if (data?.running) return 'idle';
    return 'offline';
}

function parseAgentsFromHealth(payload: any): any[] {
    const agents: any[] = [];

    if (payload?.agents && Array.isArray(payload.agents)) {
        for (const agent of payload.agents) {
            const rawId = agent.agentId ?? agent.id ?? agent.name ?? 'unknown';
            if (!rawId || typeof rawId !== 'string') continue;
            const profile = getAgentProfile(rawId);
            agents.push({
                id: rawId,
                name: rawId.charAt(0).toUpperCase() + rawId.slice(1),
                status: 'idle',
                channel: 'webchat',
                accountId: rawId,
                avatar: profile?.avatar,
                configured: true,
                running: true,
                connected: true,
                linked: true,
                probeOk: true,
            });
        }
    }

    if (payload?.channels) {
        for (const [channelName, channelData] of Object.entries(payload.channels) as any[]) {
            if (channelData?.accounts) {
                for (const [accountId, accountData] of Object.entries(channelData.accounts) as any[]) {
                    const botName = accountData?.probe?.bot?.name;
                    const generatedId = channelName === 'slack'
                        ? accountId
                        : `${channelName}:${accountId}`;

                    const existing = agents.find(a => a.id === generatedId);
                    if (existing) {
                        existing.status = deriveStatus(accountData);
                        existing.channel = channelName;
                        if (botName) existing.name = botName;
                        if (accountData?.lastError) existing.lastError = accountData.lastError;
                    } else {
                        const profile = getAgentProfile(generatedId);
                        agents.push({
                            id: generatedId,
                            name: botName || (accountId !== 'default' ? accountId : channelName),
                            status: deriveStatus(accountData),
                            channel: channelName,
                            accountId,
                            avatar: profile?.avatar,
                            running: accountData?.running ?? false,
                            connected: accountData?.connected ?? false,
                            configured: accountData?.configured ?? false,
                            linked: accountData?.linked ?? false,
                            probeOk: accountData?.probe?.ok ?? false,
                            botName,
                            lastConnectedAt: accountData?.lastConnectedAt,
                            lastError: accountData?.lastError,
                        });
                    }
                }
            } else if (channelData?.configured) {
                const existing = agents.find(a => a.id === channelName);
                if (existing) {
                    existing.status = deriveStatus(channelData);
                } else {
                    agents.push({
                        id: channelName,
                        name: channelName,
                        status: deriveStatus(channelData),
                        channel: channelName,
                        accountId: 'default',
                        running: channelData?.running ?? false,
                        connected: channelData?.connected ?? false,
                        configured: channelData?.configured ?? false,
                        linked: channelData?.linked ?? false,
                    });
                }
            }
        }
    }

    return agents.filter(a => a.configured);
}

// Track which runIds belong to summit fan-out so chat events are routed correctly
const summitRunIds = new Set<string>();

// ─── Main Hook ───
// This hook now delegates to the OpenClawGateway singleton.
// It wires gateway events back into the useSocketStore for backward compatibility
// with all existing consumers.

export function useSocket() {
    const closedIntentionally = useRef(false);
    const runIdToAgent = useRef<Map<string, string>>(new Map());
    const runIdToSessionKey = useRef(new Map<string, string>());
    const runIdToStartTime = useRef<Map<string, number>>(new Map()); // Track when runs start for latency
    const runIdToInputText = useRef<Map<string, string>>(new Map()); // Track input text for telemetry
    const commandTaskMap = useRef<Map<string, string>>(new Map());
    // Buffer for tool calls that arrive via event:agent BEFORE the event:chat message is created
    const pendingToolCalls = useRef<Map<string, any[]>>(new Map());
    // Track runIds that event:chat is already handling content for,
    // so event:agent bridge doesn't double-accumulate the same streaming deltas
    const chatHandledRunIds = useRef(new Set<string>());
    const gatewayInitialized = useRef(false);

    const {
        setConnected, setAgents, addLog, updatePing,
        setGatewayInfo, setSessions, addChatMessage, updateChatMessage,
        addSummitMessage, updateSummitMessage, setChatMessages
    } = useSocketStore();

    const connect = useCallback(() => {
        const gw = getGateway();

        // Only wire up events once (singleton pattern)
        if (gatewayInitialized.current) return;
        gatewayInitialized.current = true;

        // --- Wire gateway events to the legacy store ---

        // Ready (handshake complete)
        gw.on('ready', (payload) => {
            addLog('✅ Handshake Verified');
            setConnected(true);
            setGatewayInfo(payload);

            const hostName = payload?.server?.hostname || payload?.hostname || payload?.host || 'unknown';
            addLog(`🖥️ Gateway: ${payload?.server?.version || payload?.version || 'unknown'} on ${hostName}`);
            const granted = payload?.scopes ?? payload?.grantedScopes ?? [];
            if (Array.isArray(granted) && granted.length > 0) {
                addLog(`🔐 Scopes granted: ${granted.join(', ')}`);
            }
            console.log('[HANDSHAKE PAYLOAD]', JSON.stringify(payload, null, 2));

            // Discover sessions after handshake
            gw.request('sessions.list', { limit: 50 }).then((res) => {
                const rows: any[] = res?.sessions ?? res ?? [];
                const parsed: SessionInfo[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
                    key: r.key ?? '',
                    kind: r.kind ?? 'other',
                    channel: r.channel ?? 'unknown',
                    displayName: r.displayName ?? r.key,
                    sessionId: r.sessionId ?? '',
                    agentId: agentIdFromSessionKey(r.key ?? ''),
                    updatedAt: r.updatedAt ?? 0,
                }));
                setSessions(parsed);
                addLog(`📋 Sessions: ${parsed.length} active`);
            }).catch((err) => {
                console.error('[sessions.list error]', err);
            });

            // Fetch agents and populate store immediately
            gw.request('agents.list', {}).then((res) => {
                if (res?.agents && Array.isArray(res.agents)) {
                    addLog(`📄 Agents List: ${res.agents.length} items found`);
                    console.log('[AGENTS LIST]', JSON.stringify(res, null, 2));
                    // Populate agents into the store right away so UI renders immediately
                    const agentsFromList = parseAgentsFromHealth({ agents: res.agents });
                    if (agentsFromList.length > 0) {
                        setAgents(agentsFromList);
                        agentsFromList.forEach(agent => {
                            initializeAgentSessions(agent.id).catch(console.error);
                        });
                    }
                }
            }).catch((err) => {
                console.error('[agents.list error]', err);
            });

            // Also request full health immediately to get detailed agent status
            gw.request('health', {}).then((healthRes) => {
                if (healthRes) {
                    const agents = parseAgentsFromHealth(healthRes);
                    if (agents.length > 0) {
                        setAgents(agents);
                        agents.forEach(agent => {
                            initializeAgentSessions(agent.id).catch(console.error);
                        });
                        addLog(`💓 Initial health: ${agents.length} configured agents`);
                    }
                }
            }).catch((err) => {
                console.warn('[Initial health request error]', err);
            });
        });

        // Connection status
        gw.on('connection_status', (payload) => {
            setConnected(payload.connected);
            if (!payload.connected) {
                addLog('🔌 Disconnected');
            }
        });

        // WebSocket open
        gw.on('_ws_open', () => {
            addLog('🔌 Connected to Gateway');
        });

        // Health → agent list
        gw.on('health', (payload) => {
            if (payload) {
                const agents = parseAgentsFromHealth(payload);
                if (agents.length > 0) {
                    setAgents(agents);
                    agents.forEach(agent => {
                        initializeAgentSessions(agent.id).catch(console.error);
                    });
                }
                addLog(`💓 Health: ${agents.length} configured agents`);
            }
            updatePing();
        });

        // Chat events → streaming agent reply
        gw.on('chat', (payload) => {
            const p = payload;
            const runId = p.runId ?? p.requestId;

            // Helper to extract string content from various payload shapes
            const extractContent = (raw: any): string => {
                if (!raw) return '';
                if (typeof raw === 'string') return raw;
                if (Array.isArray(raw)) {
                    return raw.map(item => extractContent(item)).join('');
                }
                if (typeof raw === 'object') {
                    if (raw.text) return extractContent(raw.text);
                    if (raw.delta) return extractContent(raw.delta);
                    if (raw.content) return extractContent(raw.content);
                    if (raw.type === 'text' && raw.text) return raw.text;
                    return JSON.stringify(raw);
                }
                return String(raw);
            };

            // Summit routing
            const isSummitReply = runId && summitRunIds.has(runId);
            const routeToSummit = isSummitReply;

            // Handle error
            if (p.state === 'error' || p.error || p.errorMessage) {
                const errorMessage = p.errorMessage
                    || p.error?.message
                    || (typeof p.error === 'string' ? p.error : null)
                    || 'Unknown error from agent';
                console.error('[CHAT ERROR]', errorMessage, p);

                const sessionAgentId = p.sessionKey ? agentIdFromSessionKey(p.sessionKey) : null;
                const mappedAgentId = runId ? runIdToAgent.current.get(runId) : null;
                const errorAgentId = p.agentId ?? sessionAgentId ?? mappedAgentId ?? 'system';

                const taskStore = useTaskStore.getState();
                const activeTask = taskStore.tasks.find(t => t.agentId === errorAgentId && t.status === 'IN_PROGRESS');
                if (activeTask) {
                    taskStore.updateTaskStatus(activeTask.id, 'FAILED');
                }

                if (routeToSummit) {
                    const existing = useSocketStore.getState().summitMessages.find(m => m.runId === runId);
                    if (existing) {
                        updateSummitMessage(existing.id, { content: `⚠️ Error: ${errorMessage}`, streaming: false });
                    } else {
                        addSummitMessage({
                            id: crypto.randomUUID(),
                            runId,
                            role: 'assistant',
                            content: `⚠️ ${errorMessage}`,
                            timestamp: new Date().toLocaleTimeString(),
                            agentId: errorAgentId,
                        });
                    }
                } else {
                    const existing = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`);
                    if (existing) {
                        updateChatMessage(`reply-${runId}`, { content: `⚠️ Error: ${errorMessage}`, streaming: false });
                    } else {
                        addChatMessage({
                            id: `error-${runId || Date.now()}`,
                            role: 'assistant',
                            content: `⚠️ ${errorMessage}`,
                            timestamp: new Date().toLocaleTimeString(),
                            agentId: errorAgentId,
                        });
                    }
                }
                return;
            }

            // Handle tool events inside chat
            if (p.type === 'tool_call' || p.type === 'tool_response' || p.type === 'task.progress' || p.event === 'task.progress') {
                const toolRunId = p.runId || p.requestId;
                const existingMsg = routeToSummit
                    ? useSocketStore.getState().summitMessages.find(m => m.runId === runId)
                    : useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`);

                let existingToolCalls = [...(existingMsg?.tool_calls || [])];
                if (p.tool_calls && Array.isArray(p.tool_calls)) {
                    p.tool_calls.forEach((ptc: any) => {
                        if (!existingToolCalls.find(et => et.id === ptc.id)) existingToolCalls.push(ptc);
                    });
                }

                let tcIndex = existingToolCalls.findIndex(tc => tc.id === toolRunId);

                if (p.type === 'tool_call') {
                    const toolName = p.tool || p.name || p.toolName || p.function?.name || p.task || p.step || 'tool_event';
                    const args = p.params || p.args || p.arguments || p.function?.arguments || p.payload || {};
                    const newTc = {
                        id: toolRunId,
                        function: {
                            name: toolName,
                            arguments: typeof args === 'string' ? args : JSON.stringify(args)
                        },
                        status: 'in_progress'
                    };
                    if (tcIndex >= 0) existingToolCalls[tcIndex] = { ...existingToolCalls[tcIndex], ...newTc };
                    else existingToolCalls.push(newTc);
                } else if (p.type === 'tool_response') {
                    const isError = !!p.error;
                    const outputValue = p.output || p.error || '';
                    if (tcIndex >= 0) {
                        existingToolCalls[tcIndex].status = isError ? 'failed' : 'completed';
                        existingToolCalls[tcIndex].output = typeof outputValue === 'string' ? outputValue : JSON.stringify(outputValue);
                    } else {
                        existingToolCalls.push({
                            id: toolRunId,
                            function: { name: 'tool_response', arguments: '' },
                            status: isError ? 'failed' : 'completed',
                            output: typeof outputValue === 'string' ? outputValue : JSON.stringify(outputValue)
                        });
                    }
                } else if (p.type === 'task.progress' || p.event === 'task.progress') {
                    const progressVal = p.progress || p.payload || '';
                    if (tcIndex >= 0) {
                        existingToolCalls[tcIndex].progress = typeof progressVal === 'string' ? progressVal : JSON.stringify(progressVal);
                    } else {
                        existingToolCalls.push({
                            id: toolRunId,
                            function: { name: 'task_progress', arguments: '' },
                            status: 'in_progress',
                            progress: typeof progressVal === 'string' ? progressVal : JSON.stringify(progressVal)
                        });
                    }
                }
                p.tool_calls = existingToolCalls;
            }

            // Content handling
            let contentChunk = '';
            let isSnapshot = false;

            if (p.text || p.delta) {
                contentChunk = extractContent(p.text ?? p.delta);
                isSnapshot = false;
            } else if (p.message?.content) {
                contentChunk = extractContent(p.message.content);
                isSnapshot = true;
            }

            // Handle embedded tools in structured chat payloads (Anthropic format)
            if (p.message?.content && Array.isArray(p.message.content)) {
                const extractedTools: any[] = [];
                p.message.content.forEach((block: any) => {
                    if (block.type === 'tool_use' || block.type === 'tool_call') {
                        extractedTools.push({
                            id: block.id || `embedded-${Date.now()}`,
                            status: 'completed',
                            function: {
                                name: block.name,
                                arguments: typeof block.input === 'object' ? JSON.stringify(block.input) : block.input || block.arguments || ''
                            }
                        });
                    }
                });
                if (extractedTools.length > 0) {
                    p.tool_calls = [...(p.tool_calls || []), ...extractedTools];
                }
            }

            // ─── Parse inline tool markup from content (brace-counting parser) ───
            // This catches call:Exec{...} / response:Exec{...} embedded in text
            if (contentChunk && isSnapshot) {
                const parseResult = parseOpenClawToolCalls(contentChunk);
                if (parseResult.toolCalls.length > 0) {
                    const inlineParsedTools = parseResult.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: 'function' as const,
                        function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                        output: tc.output ? JSON.stringify(tc.output) : undefined,
                        status: tc.status,
                        _parsed: tc,
                    }));
                    p.tool_calls = [...(p.tool_calls || []), ...inlineParsedTools];
                    contentChunk = parseResult.cleanedText;
                    isSnapshot = true; // still a snapshot, just cleaned
                }
            } else if (contentChunk && !isSnapshot) {
                // For streaming deltas, don't parse yet — wait for snapshot
                // But still try to detect and strip partial markup to keep chat clean
                const hasMarkup = contentChunk.includes('call:') || contentChunk.includes(String.fromCodePoint(0x100085));
                if (hasMarkup) {
                    const parseResult = parseOpenClawToolCalls(contentChunk);
                    if (parseResult.toolCalls.length > 0) {
                        const inlineParsedTools = parseResult.toolCalls.map((tc) => ({
                            id: tc.id,
                            type: 'function' as const,
                            function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                            output: tc.output ? JSON.stringify(tc.output) : undefined,
                            status: tc.status,
                            _parsed: tc,
                        }));
                        p.tool_calls = [...(p.tool_calls || []), ...inlineParsedTools];
                        contentChunk = parseResult.cleanedText;
                    }
                }
            }

            // Handle OpenClaw nested tool packets
            if (p.type === 'tool_call' || p.type === 'tool_response' || p.state === 'progress' || p.tool) {
                const isResponse = p.type === 'tool_response' || p.output !== undefined;
                const extractedTool = {
                    isAgentEvent: true,
                    id: runId || `tool-${Date.now()}`,
                    status: isResponse ? 'completed' : 'in_progress',
                    progress: p.progress,
                    output: isResponse ? (typeof p.output === 'string' ? p.output : JSON.stringify(p.output)) : undefined,
                    function: {
                        name: p.tool || p.function?.name || 'unknown_tool',
                        arguments: typeof p.params === 'object' ? JSON.stringify(p.params) : p.params || p.arguments || ''
                    }
                };
                p.tool_calls = [...(p.tool_calls || []), extractedTool];
            }

            // Resolve agentId — never default to a specific agent name; use session-derived ID
            const startId = (p.runId ?? p.requestId) || null;
            const mappedAgentId = startId ? runIdToAgent.current.get(startId) : null;
            const sessionAgentId = p.sessionKey ? agentIdFromSessionKey(p.sessionKey) : null;
            // Try to derive from parent runId mapping if this is a sub-run
            const parentRunId = p.parentRunId ?? p.parent_run_id;
            const parentAgentId = parentRunId ? runIdToAgent.current.get(parentRunId) : null;
            const finalAgentId = p.agentId ?? p.message?.agentId ?? mappedAgentId ?? parentAgentId ?? sessionAgentId ?? 'unknown';
            const finalSessionKey = p.sessionKey || (startId && runIdToSessionKey.current?.get(startId)) || `agent:${finalAgentId}:nchat`;
            
            // Forward-map this runId so sub-runs can inherit the agent
            if (startId && finalAgentId !== 'unknown' && !runIdToAgent.current.has(startId)) {
                runIdToAgent.current.set(startId, finalAgentId);
                runIdToSessionKey.current.set(startId, finalSessionKey);
            }

            if (routeToSummit && runId && contentChunk) {
                const existing = useSocketStore.getState().summitMessages.find(m => m.runId === runId);
                if (existing) {
                    const newToolCalls = (p.tool_calls && p.tool_calls.length > 0) ? p.tool_calls : (existing.tool_calls || []);
                    if (isSnapshot) {
                        if (contentChunk.length >= existing.content.length) {
                            updateSummitMessage(existing.id, { content: contentChunk, tool_calls: newToolCalls });
                        }
                    } else {
                        updateSummitMessage(existing.id, { content: existing.content + contentChunk, tool_calls: newToolCalls });
                    }
                } else {
                    addSummitMessage({
                        id: crypto.randomUUID(),
                        runId,
                        role: 'assistant',
                        content: contentChunk,
                        timestamp: new Date().toLocaleTimeString(),
                        agentId: finalAgentId,
                        streaming: true,
                        tool_calls: p.tool_calls || [],
                    });
                }
            } else if (!routeToSummit && runId) {
                // Mark this runId as handled by event:chat so event:agent bridge
                // doesn't double-accumulate the same streaming content
                chatHandledRunIds.current.add(runId);

                const existing = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`);
                if (existing) {
                    const newToolCalls = (p.tool_calls && p.tool_calls.length > 0) ? p.tool_calls : (existing.tool_calls || []);
                    if (contentChunk) {
                        if (isSnapshot) {
                            if (contentChunk.length >= existing.content.length) {
                                updateChatMessage(`reply-${runId}`, { content: contentChunk, tool_calls: newToolCalls });
                            }
                        } else {
                            updateChatMessage(`reply-${runId}`, { content: existing.content + contentChunk, tool_calls: newToolCalls });
                        }
                    } else if (p.tool_calls) {
                        updateChatMessage(`reply-${runId}`, { tool_calls: newToolCalls });
                    }
                } else {
                    if (contentChunk || p.tool_calls || p.state === 'delta' || p.state === 'progress') {
                        // Check if we have buffered tool calls from event:agent that arrived early
                        const bufferedTools = pendingToolCalls.current.get(runId) || [];
                        const mergedTools = [...(p.tool_calls || []), ...bufferedTools];

                        addChatMessage({
                            id: `reply-${runId}`,
                            role: 'assistant',
                            content: contentChunk || '',
                            timestamp: new Date().toLocaleTimeString(),
                            agentId: finalAgentId,
                            sessionKey: finalSessionKey,
                            streaming: true,
                            tool_calls: mergedTools,
                        });

                        // Clear the buffer since they are now attached to the message
                        if (bufferedTools.length > 0) {
                            pendingToolCalls.current.delete(runId);
                        }
                    }
                }
            }

            // Completion handling
            const isDone = p?.state === 'done' || p?.type === 'message_end' || p?.type === 'done' || p?.state === 'stop' || p?.done === true || p?.finished === true || p?.state === 'complete' || p?.state === 'end';

            if (runId && isDone) {
                // Log telemetry for completed chat
                const startTime = runIdToStartTime.current.get(runId) || Date.now();
                const inputText = runIdToInputText.current.get(runId) || '';
                const completedMsgForTelemetry = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`);
                const outputText = completedMsgForTelemetry?.content || contentChunk || '';
                logChatTelemetry({
                    agentId: finalAgentId,
                    inputText,
                    outputText,
                    latencyMs: Date.now() - startTime,
                    status: 'success',
                    runId,
                });
                // Clean up tracking refs
                runIdToStartTime.current.delete(runId);
                runIdToInputText.current.delete(runId);
                chatHandledRunIds.current.delete(runId);

                if (routeToSummit) {
                    const existing = useSocketStore.getState().summitMessages.find(m => m.runId === runId);
                    if (existing) updateSummitMessage(existing.id, { streaming: false });
                } else {
                    // Re-parse accumulated content at completion time
                    // This catches tool markup spread across multiple streaming deltas
                    const completedMsg = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`);
                    if (completedMsg && completedMsg.content && (!completedMsg.tool_calls || completedMsg.tool_calls.length === 0)) {
                        const finalParse = parseOpenClawToolCalls(completedMsg.content);
                        if (finalParse.toolCalls.length > 0) {
                            const finalToolCalls = finalParse.toolCalls.map((tc) => ({
                                id: tc.id,
                                type: 'function' as const,
                                function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                output: tc.output ? JSON.stringify(tc.output) : undefined,
                                status: tc.status,
                                _parsed: tc,
                            }));
                            updateChatMessage(`reply-${runId}`, {
                                streaming: false,
                                content: finalParse.cleanedText,
                                tool_calls: finalToolCalls,
                            });
                        } else {
                            updateChatMessage(`reply-${runId}`, { streaming: false });
                        }
                    } else {
                        updateChatMessage(`reply-${runId}`, { streaming: false });
                    }
                    const taskStore = useTaskStore.getState();
                    const activeTask = taskStore.tasks.find(t => t.agentId === finalAgentId && t.status === 'IN_PROGRESS');
                    if (activeTask && activeTask.status !== 'FAILED') {
                        taskStore.updateTaskStatus(activeTask.id, 'DONE');
                    }

                    // Detect [SKILLS_INSTALLED] confirmation from agent
                    const finalContent = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${runId}`)?.content || '';
                    const skillsMatch = finalContent.match(/\[SKILLS_INSTALLED\][\s\S]*?skills:\s*(.+?)[\s\S]*?\[\/SKILLS_INSTALLED\]/);
                    if (skillsMatch) {
                        const keys = skillsMatch[1].split(',').map((k: string) => k.trim()).filter(Boolean);
                        if (keys.length > 0) {
                            try {
                                const { useOpenClawCapabilitiesStore } = require('@/stores/useOpenClawCapabilitiesStore');
                                useOpenClawCapabilitiesStore.getState().handleInstallConfirmation(finalAgentId, keys);
                            } catch (e) { console.warn('[Skills] Could not process install confirmation:', e); }
                        }
                    }
                }
            }

            updatePing();
        });

        // Agent events (new protocol: tool calls, thinking, lifecycle, assistant deltas)
        gw.on('agent', (payload) => {
            const p = payload;

            // ── Resolve agentId for ALL agent events ──
            // This is critical: event:agent payloads carry sessionKey/agentId
            // that we use to bridge text into chatMessages.
            const agentRunId = p.runId;
            const agentSessionKey = p.sessionKey || (p.data?.sessionKey);
            const agentPayloadId = p.agentId || p.data?.agentId;
            const agentFromSession = agentSessionKey ? agentIdFromSessionKey(agentSessionKey) : null;
            const agentFromMap = agentRunId ? runIdToAgent.current.get(agentRunId) : null;
            const resolvedAgentId = agentPayloadId || agentFromMap || agentFromSession || 'unknown';
            const resolvedSessionKey = agentSessionKey || `agent:${resolvedAgentId}:nchat`;

            // Forward-map this runId so future events inherit the agent
            if (agentRunId && resolvedAgentId !== 'unknown' && !runIdToAgent.current.has(agentRunId)) {
                runIdToAgent.current.set(agentRunId, resolvedAgentId);
                runIdToSessionKey.current.set(agentRunId, resolvedSessionKey);
            }

            // ── Lifecycle: end → finalize chat message ──
            if (p.stream === 'lifecycle' && p.data?.phase === 'end' && agentRunId) {
                const lifecycleRunId = agentRunId;

                // Log telemetry for completed OpenClaw agent run
                const startTime = runIdToStartTime.current.get(lifecycleRunId) || Date.now();
                const inputText = runIdToInputText.current.get(lifecycleRunId) || '';
                const completedMsgForTelemetry = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${lifecycleRunId}`);
                const outputText = completedMsgForTelemetry?.content || '';

                if (outputText || inputText) {
                    logChatTelemetry({
                        agentId: resolvedAgentId,
                        inputText,
                        outputText,
                        latencyMs: Date.now() - startTime,
                        status: 'success',
                        runId: lifecycleRunId,
                    });
                }
                // Clean up tracking refs
                runIdToStartTime.current.delete(lifecycleRunId);
                runIdToInputText.current.delete(lifecycleRunId);

                if (summitRunIds.has(lifecycleRunId)) {
                    const existing = useSocketStore.getState().summitMessages.find(m => m.runId === lifecycleRunId);
                    if (existing) updateSummitMessage(existing.id, { streaming: false });
                } else {
                    const completedMsg = useSocketStore.getState().chatMessages.find(m => m.id === `reply-${lifecycleRunId}`);
                    if (completedMsg) {
                        // Re-parse for tool calls at lifecycle end
                        if (completedMsg.content && (!completedMsg.tool_calls || completedMsg.tool_calls.length === 0)) {
                            const finalParse = parseOpenClawToolCalls(completedMsg.content);
                            if (finalParse.toolCalls.length > 0) {
                                const finalToolCalls = finalParse.toolCalls.map((tc) => ({
                                    id: tc.id,
                                    type: 'function' as const,
                                    function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                    output: tc.output ? JSON.stringify(tc.output) : undefined,
                                    status: tc.status,
                                    _parsed: tc,
                                }));
                                updateChatMessage(`reply-${lifecycleRunId}`, {
                                    streaming: false,
                                    content: finalParse.cleanedText,
                                    tool_calls: finalToolCalls,
                                });
                            } else {
                                updateChatMessage(`reply-${lifecycleRunId}`, { streaming: false });
                            }
                        } else {
                            updateChatMessage(`reply-${lifecycleRunId}`, { streaming: false });
                        }
                    } else {
                        // ── BRIDGE: No chatMessage exists yet — create from OpenClawStore's accumulated run ──
                        // This handles the case where the gateway sent text only via event:agent,
                        // never via event:chat (common after tool calls).
                        const ocRun = useOpenClawStore.getState().activeRuns.get(lifecycleRunId);
                        if (ocRun && ocRun.assistantText.trim() && resolvedAgentId !== 'unknown') {
                            const finalParse = parseOpenClawToolCalls(ocRun.assistantText);
                            const toolCallsMapped = finalParse.toolCalls.map((tc) => ({
                                id: tc.id,
                                type: 'function' as const,
                                function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                output: tc.output ? JSON.stringify(tc.output) : undefined,
                                status: tc.status,
                                _parsed: tc,
                            }));
                            addChatMessage({
                                id: `reply-${lifecycleRunId}`,
                                role: 'assistant' as const,
                                content: finalParse.cleanedText || ocRun.assistantText,
                                timestamp: new Date().toLocaleTimeString(),
                                agentId: resolvedAgentId,
                                sessionKey: resolvedSessionKey,
                                streaming: false,
                                tool_calls: toolCallsMapped.length > 0 ? toolCallsMapped : (ocRun.toolCalls.length > 0 ? ocRun.toolCalls.map(tc => ({
                                    id: tc.id,
                                    status: tc.status,
                                    function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                    output: tc.output,
                                })) : []),
                            } as any);
                        }
                    }
                }
            }

            // ── Bridge: assistant stream text → chatMessages ──
            // NOTE: Content accumulation is intentionally NOT done here.
            // event:chat handles all streaming content. If event:chat never
            // fires (post-tool-call text), the lifecycle:end handler creates
            // a fallback message from OpenClawStore's accumulated assistantText.
            // Doing content updates here caused double-accumulation bugs where
            // every token was duplicated (both channels appending the same delta).
            if (p.stream === 'assistant' && agentRunId) {
                const runId = agentRunId;
                const delta = p.data?.delta || '';
                const fullText = p.data?.text || p.data?.content || '';
                const text = delta || fullText;

                // Also parse for inline tool calls (original behavior)
                if (text) {
                    const parseResult = parseOpenClawToolCalls(text);
                    if (parseResult.toolCalls.length > 0) {
                        const routeToSummit = summitRunIds.has(runId);
                        const storeState = useSocketStore.getState();
                        const msgs = routeToSummit ? storeState.summitMessages : storeState.chatMessages;
                        const existingMsg = msgs.find(m => routeToSummit ? (m as any).runId === runId : m.id === `reply-${runId}`);

                        if (existingMsg) {
                            const existingToolIds = new Set((existingMsg.tool_calls || []).map(tc => tc.id));
                            const newTools = parseResult.toolCalls
                                .filter(tc => !existingToolIds.has(tc.id))
                                .map(tc => ({
                                    id: tc.id,
                                    type: 'function' as const,
                                    function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                    output: tc.output ? JSON.stringify(tc.output) : undefined,
                                    status: tc.status,
                                    _parsed: tc,
                                }));

                            if (newTools.length > 0) {
                                const mergedTools = [...(existingMsg.tool_calls || []), ...newTools];
                                if (routeToSummit) {
                                    updateSummitMessage(existingMsg.id, { tool_calls: mergedTools });
                                } else {
                                    updateChatMessage(`reply-${runId}`, { tool_calls: mergedTools });
                                }
                            }
                        } else {
                            const newTools = parseResult.toolCalls.map(tc => ({
                                id: tc.id,
                                type: 'function' as const,
                                function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
                                output: tc.output ? JSON.stringify(tc.output) : undefined,
                                status: tc.status,
                                _parsed: tc,
                            }));
                            if (newTools.length > 0) {
                                const buffered = pendingToolCalls.current.get(runId) || [];
                                const existingIds = new Set(buffered.map(tc => tc.id));
                                const uniqueNewTools = newTools.filter(tc => !existingIds.has(tc.id));
                                if (uniqueNewTools.length > 0) {
                                    pendingToolCalls.current.set(runId, [...buffered, ...uniqueNewTools]);
                                }
                            }
                        }
                    }
                }
            }

            // Tool call/output events
            if (p.type === 'tool_call' || p.type === 'tool_output' || p.stream === 'tool') {
                const runId = p.runId;
                if (runId) {
                    const callId = p.callId || p.toolCallId || `tool-${Date.now()}`;
                    const isResponse = p.type === 'tool_output' || p.status === 'completed' || p.output !== undefined;
                    const toolName = p.toolName || p.tool || p.name || 'unknown_tool';

                    const newToolCall = {
                        id: callId,
                        status: isResponse ? (p.success === false ? 'failed' : 'completed') : 'in_progress',
                        output: isResponse ? (typeof p.output === 'string' ? p.output : JSON.stringify(p.output)) : undefined,
                        function: {
                            name: toolName,
                            arguments: typeof p.input === 'object' ? JSON.stringify(p.input) : (p.input || p.args || '')
                        }
                    };

                    const routeToSummit = summitRunIds.has(runId);
                    const storeState = useSocketStore.getState();
                    const msgs = routeToSummit ? storeState.summitMessages : storeState.chatMessages;
                    const existingMsg = msgs.find(m => routeToSummit ? (m as any).runId === runId : m.id === `reply-${runId}`);

                    if (existingMsg) {
                        const tcs = [...(existingMsg.tool_calls || [])];
                        const idx = tcs.findIndex(tc => tc.id === callId);
                        if (idx >= 0) {
                            tcs[idx] = { ...tcs[idx], ...newToolCall };
                        } else {
                            tcs.push(newToolCall);
                        }
                        if (routeToSummit) {
                            updateSummitMessage(existingMsg.id, { tool_calls: tcs });
                        } else {
                            updateChatMessage(`reply-${runId}`, { tool_calls: tcs });
                        }
                    } else {
                        const mapAgentId = runIdToAgent.current.get(runId) || 'ivy';
                        const sessionKey = p.sessionKey || `agent:${mapAgentId}:nchat`;
                        const newMsg = {
                            id: routeToSummit ? crypto.randomUUID() : `reply-${runId}`,
                            runId: routeToSummit ? runId : undefined,
                            role: 'assistant' as const,
                            content: '',
                            timestamp: new Date().toLocaleTimeString(),
                            agentId: mapAgentId,
                            sessionKey: sessionKey,
                            streaming: true,
                            tool_calls: [newToolCall]
                        };
                        if (routeToSummit) {
                            addSummitMessage(newMsg as any);
                        } else {
                            addChatMessage(newMsg as any);
                        }
                    }
                }
            }

            updatePing();
        });

        // Tick keepalive
        gw.on('tick', () => {
            updatePing();
        });

        // Presence
        gw.on('presence', (payload) => {
            console.log('[PRESENCE]', payload);
        });

        // Generic event logging
        gw.on('_raw_frame', (frame) => {
            console.log('[RAW FRAME]', frame);
        });

        // Connection initialization is now handled strictly by useOpenClawGateway 
        // watching the active profiles. We do not call gw.connect() here anymore.

        // ── Race condition guard ──────────────────────────────────────────
        // If the gateway already completed handshake BEFORE we registered
        // our 'ready' listener above, we missed the event. Check now and
        // manually trigger the same agent-fetch logic.
        if (gw.isConnected) {
            console.log('[useSocket] Gateway already connected — fetching agents immediately');
            setConnected(true);

            gw.request('agents.list', {}).then((res) => {
                if (res?.agents && Array.isArray(res.agents)) {
                    const agentsFromList = parseAgentsFromHealth({ agents: res.agents });
                    if (agentsFromList.length > 0) {
                        setAgents(agentsFromList);
                        agentsFromList.forEach(agent => {
                            initializeAgentSessions(agent.id).catch(console.error);
                        });
                        addLog(`📄 Agents: ${agentsFromList.length} loaded (catch-up)`);
                    }
                }
            }).catch(() => {});

            gw.request('health', {}).then((healthRes) => {
                if (healthRes) {
                    const agents = parseAgentsFromHealth(healthRes);
                    if (agents.length > 0) {
                        setAgents(agents);
                        agents.forEach(agent => {
                            initializeAgentSessions(agent.id).catch(console.error);
                        });
                    }
                }
            }).catch(() => {});

            gw.request('sessions.list', { limit: 50 }).then((res) => {
                const rows: any[] = res?.sessions ?? res ?? [];
                const parsed: SessionInfo[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
                    key: r.key ?? '',
                    kind: r.kind ?? 'other',
                    channel: r.channel ?? 'unknown',
                    displayName: r.displayName ?? r.key,
                    sessionId: r.sessionId ?? '',
                    agentId: agentIdFromSessionKey(r.key ?? ''),
                    updatedAt: r.updatedAt ?? 0,
                }));
                setSessions(parsed);
            }).catch(() => {});
        }

    }, [addLog, setAgents, setConnected, updatePing, setGatewayInfo, setSessions,
        addChatMessage, updateChatMessage, addSummitMessage, updateSummitMessage, setChatMessages]);

    useEffect(() => {
        connect();
        return () => {
            closedIntentionally.current = true;
            // Don't disconnect the singleton - other components may need it
        };
    }, [connect]);

    /**
     * Send a raw RPC request to the gateway.
     */
    const sendCommand = useCallback((method: string, params: any, idPrefix = 'cmd'): string => {
        const gw = getGateway();
        const id = `${idPrefix}-${uid()}`;
        if (gw.isConnected) {
            gw.sendRaw({ type: 'req', id, method, params });
        }
        return id;
    }, []);

    /**
     * Fetch chat history for a session
     */
    const fetchHistory = useCallback((sessionKey: string, agentId: string) => {
        const gw = getGateway();
        if (!gw.isConnected) return;

        const reqId = `history-${uid()}`;
        runIdToAgent.current.set(reqId, agentId);
        runIdToSessionKey.current.set(reqId, sessionKey);

        gw.request('chat.history', { sessionKey, limit: 100 }).then((res) => {
            const items = res?.items || res || [];
            if (Array.isArray(items)) {
                const parsedMessages = items.map((m: any) => ({
                    id: m.id || `hist-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                    role: m.role || 'user',
                    content: m.content ? (typeof m.content === 'string' ? m.content : JSON.stringify(m.content)) : '',
                    timestamp: m.createdAt ? new Date(m.createdAt).toLocaleTimeString() : new Date().toLocaleTimeString(),
                    _sortTime: m.createdAt ? new Date(m.createdAt).getTime() : Date.now(),
                    agentId: agentId,
                    sessionKey: sessionKey,
                    tool_calls: m.toolCalls || m.tool_calls
                }));
                console.log('[CHAT HISTORY LOADED]', parsedMessages.length);
                setChatMessages(parsedMessages.reverse(), sessionKey);
            }
        }).catch((err) => {
            console.error('[chat.history error]', err);
        });
    }, [setChatMessages]);

    /**
     * Send a chat message to an agent via the gateway `chat.send` RPC.
     */
    const sendChatMessage = useCallback((agentId: string, message: string, customSessionKey?: string, attachments?: any[], skipStoreAdd?: boolean, modelOverride?: string): string => {
        const gw = getGateway();
        const sessionKey = customSessionKey || `agent:${agentId}:main`;
        const idempotencyKey = uid();
        const reqId = `chat-${idempotencyKey}`;

        // Format for OpenClaw native attachment ingest (per Ivy's schema)
        const gatewayAttachments = attachments?.length ? attachments.map(a => {
            let rawBase64 = a.url;
            if (a.url && a.url.startsWith('data:')) {
                // Robustly split off the base64 content regardless of MIME type params like charset=utf-8
                rawBase64 = a.url.split(',')[1] || a.url;
            }

            return {
                name: a.name,
                mimeType: a.type || a.mimeType,
                content: rawBase64,
                encoding: "base64",
                size: a.size
            };
        }) : undefined;

        if (gw.isConnected) {
            gw.request('chat.send', {
                sessionKey,
                message,
                attachments: gatewayAttachments,
                idempotencyKey,
                ...(modelOverride ? { model: modelOverride } : {}),
            }).then((res) => {
                console.log('[chat.send ok]', res);
                const gatewayRunId = res?.runId;
                if (gatewayRunId) {
                    runIdToAgent.current.set(gatewayRunId, agentId);
                    runIdToSessionKey.current.set(gatewayRunId, sessionKey);
                    // Copy start time and input text to gateway runId for telemetry tracking
                    const startTime = runIdToStartTime.current.get(reqId) || runIdToStartTime.current.get(idempotencyKey) || Date.now();
                    runIdToStartTime.current.set(gatewayRunId, startTime);
                    runIdToInputText.current.set(gatewayRunId, message);
                    console.log('[RUNID MAP]', `gateway:${gatewayRunId} → agent:${agentId}`);
                    if (summitRunIds.has(reqId)) {
                        summitRunIds.add(gatewayRunId);
                    }
                }
                // Refresh sessions
                gw.request('sessions.list', { limit: 50 }).then((sessRes) => {
                    const rows: any[] = sessRes?.sessions ?? sessRes ?? [];
                    const parsed: SessionInfo[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
                        key: r.key ?? '',
                        kind: r.kind ?? 'other',
                        channel: r.channel ?? 'unknown',
                        displayName: r.displayName ?? r.key,
                        sessionId: r.sessionId ?? '',
                        agentId: agentIdFromSessionKey(r.key ?? ''),
                        updatedAt: r.updatedAt ?? 0,
                    }));
                    setSessions(parsed);
                }).catch(() => { /* ignore session refresh failures */ });
            }).catch((err) => {
                const errDetail = JSON.stringify(err, null, 2);
                addLog(`❌ chat.send failed: ${errDetail}`);
                console.error('[chat.send error]', err);
            });

            runIdToAgent.current.set(reqId, agentId);
            runIdToAgent.current.set(idempotencyKey, agentId);
            runIdToSessionKey.current.set(reqId, sessionKey);
            runIdToSessionKey.current.set(idempotencyKey, sessionKey);
            // Track start time and input text for telemetry
            runIdToStartTime.current.set(reqId, Date.now());
            runIdToStartTime.current.set(idempotencyKey, Date.now());
            runIdToInputText.current.set(reqId, message);
            runIdToInputText.current.set(idempotencyKey, message);

            addLog(`💬 Sent to ${agentId}: ${message.slice(0, 60)}${message.length > 60 ? '…' : ''}`);

            if (!skipStoreAdd) {
                useSocketStore.getState().addChatMessage({
                    id: `user-${idempotencyKey}`,
                    role: 'user',
                    content: message,
                    timestamp: new Date().toLocaleTimeString(),
                    agentId: agentId,
                    sessionKey: sessionKey,
                    streaming: false,
                    attachments: attachments,
                });
            }
        } else {
            addLog('⚠️ Cannot send — WebSocket not connected');
        }
        return reqId;
    }, [addLog, setSessions]);

    /**
     * Fan-out a message to multiple agents for the Summit.
     */
    const sendSummitMessage = useCallback((agentIds: string[], contextMessage: string, attachments?: any[]): void => {
        const gw = getGateway();
        if (!gw.isConnected) {
            addLog('⚠️ Cannot send summit — WebSocket not connected');
            return;
        }

        const currentSessions = useSocketStore.getState().sessions;

        for (const agentId of agentIds) {
            let sessionKey = `agent:${agentId}:nsummit`;

            const handshakeKey = `hs_v3_${sessionKey}`;
            if (!sessionStorage.getItem(handshakeKey)) {
                sendToolsHandshake(sessionKey, agentId);
                sessionStorage.setItem(handshakeKey, 'true');
            }

            const idempotencyKey = uid();
            const reqId = `chat-${idempotencyKey}`;

            summitRunIds.add(reqId);
            summitRunIds.add(idempotencyKey);

            runIdToAgent.current.set(reqId, agentId);
            runIdToAgent.current.set(idempotencyKey, agentId);
            // Track start time and input text for telemetry
            const startTime = Date.now();
            runIdToStartTime.current.set(reqId, startTime);
            runIdToStartTime.current.set(idempotencyKey, startTime);
            runIdToInputText.current.set(reqId, contextMessage);
            runIdToInputText.current.set(idempotencyKey, contextMessage);

            const gatewayAttachments = attachments?.length ? attachments.map(a => {
                let rawBase64 = a.url;
                if (a.url && a.url.startsWith('data:')) {
                    rawBase64 = a.url.split(',')[1] || a.url;
                }
                return {
                    name: a.name,
                    mimeType: a.type || a.mimeType,
                    content: rawBase64,
                    encoding: "base64",
                    size: a.size
                };
            }) : undefined;

            gw.request('chat.send', {
                sessionKey,
                message: contextMessage,
                attachments: gatewayAttachments,
                idempotencyKey
            }).then((res) => {
                const gatewayRunId = res?.runId;
                if (gatewayRunId) {
                    runIdToAgent.current.set(gatewayRunId, agentId);
                    // Copy start time and input text to gateway runId for telemetry
                    runIdToStartTime.current.set(gatewayRunId, startTime);
                    runIdToInputText.current.set(gatewayRunId, contextMessage);
                    summitRunIds.add(gatewayRunId);
                    console.log('[SUMMIT RUNID MAP]', gatewayRunId);
                }
            }).catch((err) => {
                console.error('[SUMMIT chat.send error]', err);
            });

            console.log('[SUMMIT SEND]', agentId, reqId);
        }

        addLog(`🏛️ Summit broadcast to ${agentIds.length} agents`);
    }, [addLog]);

    const sendConfigUpdate = useCallback((agentId: string, updates: any) => {
        const gw = getGateway();
        if (gw.isConnected) {
            gw.request('agent.update', { agentId, ...updates }).then(() => {
                addLog(`⚙️ Config update for ${agentId} applied`);
            }).catch((err) => {
                addLog(`❌ Config update failed: ${err?.message || err}`);
            });
        } else {
            addLog('⚠️ Cannot update config — WebSocket not connected');
        }
    }, [addLog]);

    const sendToolsHandshake = useCallback(async (_sessionKey: string, _agentId: string) => {
        // Composio injection removed — capabilities are managed via OpenClaw Gateway
        console.log('[Handshake] Tools handshake is now managed by OpenClaw capabilities system');
    }, []);

    const sendEmergencyShutdown = useCallback(() => {
        const gw = getGateway();
        if (gw.isConnected) {
            gw.request('system.shutdown', { force: true, reason: 'Emergency shutdown triggered from Ofiere' }).then(() => {
                addLog(`🚨 EMERGENCY SHUTDOWN INITIATED`);
            }).catch((err) => {
                addLog(`❌ Shutdown failed: ${err?.message || err}`);
            });
        } else {
            addLog('⚠️ Cannot issue shutdown — WebSocket not connected');
        }
    }, [addLog]);

    return { sendCommand, sendChatMessage, sendSummitMessage, fetchHistory, sendConfigUpdate, sendEmergencyShutdown, sendToolsHandshake };
}
