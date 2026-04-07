// dashboard/store/useOpenClawStore.ts
//
// Central store for all OpenClaw Gateway state.
// Processes incoming agent events (tool calls, thinking, lifecycle, assistant deltas).

import { create } from "zustand";
import { OPENCLAW_WS_URL, OPENCLAW_HTTP_URL, IS_REMOTE_OPENCLAW } from "@/lib/config";

/** Estimate token count from text (roughly 4 chars per token for English) */
function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

/** Extract agentId from a session key (e.g., "agent:ivy:main" -> "ivy") */
function agentIdFromSessionKey(key: string): string {
    const parts = key.split(':');
    if (parts[0] === 'agent' && parts.length >= 2) return parts[1];
    return 'unknown';
}

/** Log telemetry to the API when an agent run completes */
async function logAgentRunTelemetry(run: AgentRun, inputText: string = '') {
    try {
        const agentId = agentIdFromSessionKey(run.sessionKey);
        const inputTokens = estimateTokens(inputText);
        const outputTokens = estimateTokens(run.assistantText);
        const latencyMs = run.completedAt ? run.completedAt - run.startedAt : 0;

        await fetch('/api/telemetry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId,
                provider: 'openclaw',
                model: 'claude-sonnet-4-5-20250514', // Default model, could be made dynamic
                inputTokens,
                outputTokens,
                latencyMs,
                status: run.status === 'error' ? 'error' : 'success',
                taskId: run.runId,
                errorMessage: run.error ? String(run.error) : undefined,
            }),
        });
    } catch (e) {
        // Silently ignore telemetry errors
        console.warn('[Telemetry] Failed to log run:', e);
    }
}

// --- Types ---

export interface ToolCallEvent {
    id: string;
    runId: string;
    toolName: string;
    input: any;
    output?: string;
    meta?: string;               // brief description from gateway (e.g., command summary)
    status: "running" | "completed" | "error";
    startedAt: number;
    completedAt?: number;
    sessionKey: string;
}

export interface AgentRun {
    runId: string;
    sessionKey: string;
    status: "running" | "completed" | "error";
    startedAt: number;
    completedAt?: number;
    assistantText: string;       // accumulated text deltas
    thinkingText: string;        // accumulated thinking deltas
    toolCalls: ToolCallEvent[];  // tool calls in this run
    error?: any;
}

export interface ChatMessage {
    id: string;
    role: "user" | "assistant" | "system" | "tool";
    content: string;
    timestamp: number;
    sessionKey: string;
    agentId?: string;
    toolCalls?: ToolCallEvent[];
    runId?: string;
}

export interface ExecApprovalRequest {
    id: string;
    command: string;
    workingDir?: string;
    sessionKey: string;
    agentId?: string;
    timestamp: number;
}

interface OpenClawState {
    // Connection
    isConnected: boolean;
    connectionStatus: 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';
    gatewayInfo: any | null;
    lastPing: number;
    connectionError: string | null;

    // VPS Configuration
    authToken: string | null;
    wsUrl: string;
    httpUrl: string;
    isRemote: boolean;

    // Active agent runs (keyed by runId)
    activeRuns: Map<string, AgentRun>;

    // Chat messages (keyed by sessionKey)
    messagesBySession: Map<string, ChatMessage[]>;

    // All tool calls (for the activity feed / observability)
    recentToolCalls: ToolCallEvent[];

    // Exec approval queue
    pendingApprovals: ExecApprovalRequest[];

    // Sessions and agents
    sessions: any[];
    agents: any[];

    // Presence
    presenceEntries: any[];

    // Actions
    setConnected: (connected: boolean) => void;
    setConnectionStatus: (status: 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error') => void;
    setConnectionError: (error: string | null) => void;
    setGatewayInfo: (info: any) => void;
    setLastPing: (ts: number) => void;
    setAuthToken: (token: string | null) => void;
    setEndpoints: (wsUrl: string, httpUrl: string) => void;
    handleAgentEvent: (payload: any) => void;
    handleChatEvent: (payload: any) => void;
    handlePresenceEvent: (payload: any) => void;
    handleHealthEvent: (payload: any) => void;
    handleExecApprovalRequest: (payload: any) => void;
    resolveApproval: (approvalId: string) => void;
    addUserMessage: (sessionKey: string, content: string) => void;
    setSessions: (sessions: any[]) => void;
    setAgents: (agents: any[]) => void;
    clearMessagesForSession: (sessionKey: string) => void;
    setMessagesForSession: (sessionKey: string, messages: ChatMessage[]) => void;
    clearRunsForSession: (sessionKey: string) => void;
}

export const useOpenClawStore = create<OpenClawState>((set, get) => ({
    // Initial state
    isConnected: false,
    connectionStatus: 'disconnected',
    gatewayInfo: null,
    lastPing: 0,
    connectionError: null,

    // VPS Configuration
    authToken: null,
    wsUrl: OPENCLAW_WS_URL,
    httpUrl: OPENCLAW_HTTP_URL,
    isRemote: IS_REMOTE_OPENCLAW,

    activeRuns: new Map(),
    messagesBySession: new Map(),
    recentToolCalls: [],
    pendingApprovals: [],
    sessions: [],
    agents: [],
    presenceEntries: [],

    // --- Connection ---
    setConnected: (connected) => set({
        isConnected: connected,
        connectionStatus: connected ? 'connected' : 'disconnected',
        connectionError: connected ? null : get().connectionError,
    }),
    setConnectionStatus: (status) => set({ connectionStatus: status }),
    setConnectionError: (error) => set({ connectionError: error, connectionStatus: error ? 'error' : get().connectionStatus }),
    setGatewayInfo: (info) => set({ gatewayInfo: info }),
    setLastPing: (ts) => set({ lastPing: ts }),
    setAuthToken: (token) => set({ authToken: token }),
    setEndpoints: (wsUrl, httpUrl) => set({
        wsUrl,
        httpUrl,
        isRemote: !wsUrl.includes('127.0.0.1') && !wsUrl.includes('localhost'),
    }),

    // --- Agent Event Handler (THE CORE LOGIC) ---
    handleAgentEvent: (payload) => {
        // The gateway may nest fields under payload.data — normalize
        const d = payload.data || payload;
        const runId = payload.runId || d.runId;
        const stream = payload.stream || d.stream;
        const sessionKey = payload.sessionKey || d.sessionKey;
        const agentId = payload.agentId || d.agentId;

        if (!runId || !stream) {
            // Still no runId/stream after normalization — skip
            return;
        }

        // Only log tool/lifecycle events to keep console clean
        if (stream === 'tool' || stream === 'lifecycle') {
            console.log(`[OpenClawStore] Agent event: stream=${stream} runId=${runId} sessionKey=${sessionKey || 'none'}`);
        }

        // Resolve a usable session key — fall back to agent ID or 'default'
        const resolvedSessionKey = sessionKey 
            || (agentId ? `agent:${agentId}:main` : null)
            || 'agent:default:main';

        set((state) => {
            const runs = new Map(state.activeRuns);

            // Get or create the run
            let run = runs.get(runId);
            if (!run) {
                run = {
                    runId,
                    sessionKey: resolvedSessionKey,
                    status: "running",
                    startedAt: Date.now(),
                    assistantText: "",
                    thinkingText: "",
                    toolCalls: [],
                };
            } else if (run.sessionKey === 'unknown' && resolvedSessionKey !== 'agent:default:main') {
                // Upgrade from 'unknown' if we now have a real session key
                run = { ...run, sessionKey: resolvedSessionKey };
            }

            // Branch on stream type
            switch (stream) {
                case "assistant": {
                    // Text delta — prefer incremental delta, fall back to full text replacement
                    const delta = d.delta || payload.delta;
                    if (delta) {
                        run = { ...run, assistantText: run.assistantText + delta };
                    } else {
                        const fullText = d.text || d.content || payload.text || payload.content || "";
                        if (fullText) {
                            run = { ...run, assistantText: fullText };
                        }
                    }
                    break;
                }

                case "tool": {
                    // Tool call event — check many possible field names from gateway
                    const toolCallId = d.toolCallId || d.callId || d.id || d.tool_call_id
                        || payload.toolCallId || payload.callId || payload.tool_call_id 
                        || `tc-${Date.now()}`;
                    const toolName = d.toolName || d.tool || d.name || d.function?.name || d.functionName || d.tool_name
                        || payload.toolName || payload.tool || payload.name || payload.functionName || payload.tool_name
                        || "unknown";
                    const input = d.input || d.args || d.arguments || d.parameters || d.function?.arguments
                        || payload.input || payload.args || payload.arguments || payload.parameters || undefined;
                    const output = d.output || d.result || d.response
                        || payload.output || payload.result || undefined;
                    const meta = d.meta || payload.meta || undefined;
                    
                    // Normalize phase → status
                    const rawPhase = d.status || d.phase || payload.status || payload.phase || '';
                    const isError = d.isError === true || payload.isError === true;
                    const toolStatus = rawPhase === 'completed' || rawPhase === 'result' || rawPhase === 'done'
                        ? (isError ? 'error' : 'completed')
                        : rawPhase === 'error' || rawPhase === 'failed'
                        ? 'error'
                        : rawPhase === 'start' || rawPhase === 'update' || rawPhase === 'running'
                        ? 'running'
                        : output ? 'completed' : 'running';

                    // Find existing tool call or create new one
                    const existingIdx = run.toolCalls.findIndex(
                        (tc) => tc.id === toolCallId || (tc.toolName === toolName && tc.status === "running")
                    );

                    // Preserve existing data when merging update/result events
                    const existing = existingIdx >= 0 ? run.toolCalls[existingIdx] : null;

                    const toolCall: ToolCallEvent = {
                        id: toolCallId,
                        runId,
                        toolName,
                        input: input || existing?.input || {},
                        output: output ? (typeof output === 'string' ? output : JSON.stringify(output)) : existing?.output,
                        meta: meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : existing?.meta,
                        status: toolStatus,
                        startedAt: existing?.startedAt || Date.now(),
                        completedAt: toolStatus !== "running" ? Date.now() : existing?.completedAt,
                        sessionKey: run.sessionKey,
                    };

                    const updatedToolCalls = [...run.toolCalls];
                    if (existingIdx >= 0) {
                        updatedToolCalls[existingIdx] = toolCall;
                    } else {
                        updatedToolCalls.push(toolCall);
                    }

                    run = { ...run, toolCalls: updatedToolCalls };

                    // Also add to global recent tool calls
                    const recentToolCalls = [toolCall, ...state.recentToolCalls.slice(0, 99)];
                    runs.set(runId, run);
                    return { activeRuns: runs, recentToolCalls };
                }

                case "thinking": {
                    const thinking = d.thinking || d.text || d.content || payload.thinking || payload.text || payload.content || "";
                    run = { ...run, thinkingText: run.thinkingText + thinking };
                    break;
                }

                case "lifecycle": {
                    const phase = d.phase || payload.phase;
                    if (phase === "start") {
                        run = { ...run, status: "running", startedAt: Date.now() };
                    } else if (phase === "end") {
                        run = { ...run, status: "completed", completedAt: Date.now() };

                        // Log telemetry for completed run
                        logAgentRunTelemetry(run, d.inputText || payload.inputText || '');

                        // When run completes, convert accumulated text to a chat message
                        if (run.assistantText.trim()) {
                            const messages = new Map(state.messagesBySession);
                            const sessionMessages = [...(messages.get(run.sessionKey) || [])];
                            sessionMessages.push({
                                id: `msg-${runId}`,
                                role: "assistant",
                                content: run.assistantText,
                                timestamp: Date.now(),
                                sessionKey: run.sessionKey,
                                toolCalls: run.toolCalls.length > 0 ? run.toolCalls : undefined,
                                runId,
                            });
                            messages.set(run.sessionKey, sessionMessages);
                            runs.set(runId, run);
                            return { activeRuns: runs, messagesBySession: messages };
                        }
                    } else if (phase === "error") {
                        run = { ...run, status: "error", error: d.error || payload.error, completedAt: Date.now() };
                        // Log error telemetry
                        logAgentRunTelemetry(run);
                    }
                    break;
                }
            }

            runs.set(runId, run);
            return { activeRuns: runs };
        });
    },

    // --- Chat Events ---
    handleChatEvent: (payload) => {
        // Chat events come from messages sent/received across channels
        // These are already-completed messages (not streaming)
        set((state) => {
            const sessionKey = payload.sessionKey || "agent:default:main";
            const messages = new Map(state.messagesBySession);
            const sessionMessages = [...(messages.get(sessionKey) || [])];

            sessionMessages.push({
                id: payload.id || `chat-${Date.now()}`,
                role: payload.role || (payload.fromAgent ? "assistant" : "user"),
                content: payload.text || payload.content || payload.message || "",
                timestamp: payload.timestamp || Date.now(),
                sessionKey,
                agentId: payload.agentId,
            });

            messages.set(sessionKey, sessionMessages);
            return { messagesBySession: messages };
        });
    },

    // --- Presence ---
    handlePresenceEvent: (payload) => {
        set({ presenceEntries: payload.entries || payload || [] });
    },

    // --- Health ---
    handleHealthEvent: (payload) => {
        set({ lastPing: Date.now() });
    },

    // --- Exec Approvals ---
    handleExecApprovalRequest: (payload) => {
        set((state) => ({
            pendingApprovals: [
                ...state.pendingApprovals,
                {
                    id: payload.id || payload.approvalId,
                    command: payload.command || payload.cmd || "unknown command",
                    workingDir: payload.workingDir || payload.cwd,
                    sessionKey: payload.sessionKey || "unknown",
                    agentId: payload.agentId,
                    timestamp: Date.now(),
                },
            ],
        }));
    },

    resolveApproval: (approvalId) => {
        set((state) => ({
            pendingApprovals: state.pendingApprovals.filter((a) => a.id !== approvalId),
        }));
    },

    // --- User Actions ---
    addUserMessage: (sessionKey, content) => {
        set((state) => {
            const messages = new Map(state.messagesBySession);
            const sessionMessages = [...(messages.get(sessionKey) || [])];
            sessionMessages.push({
                id: `user-${Date.now()}`,
                role: "user",
                content,
                timestamp: Date.now(),
                sessionKey,
            });
            messages.set(sessionKey, sessionMessages);
            return { messagesBySession: messages };
        });
    },

    setSessions: (sessions) => set({ sessions }),
    setAgents: (agents) => set({ agents }),
    clearMessagesForSession: (sessionKey) => {
        set((state) => {
            const messages = new Map(state.messagesBySession);
            messages.delete(sessionKey);
            return { messagesBySession: messages };
        });
    },
    setMessagesForSession: (sessionKey, msgs) => {
        set((state) => {
            const messages = new Map(state.messagesBySession);
            messages.set(sessionKey, msgs);
            return { messagesBySession: messages };
        });
    },
    clearRunsForSession: (sessionKey) => {
        set((state) => {
            const newRuns = new Map(state.activeRuns);
            for (const [runId, run] of newRuns.entries()) {
                if (run.sessionKey === sessionKey || run.sessionKey.includes(sessionKey)) {
                    newRuns.delete(runId);
                }
            }
            return { activeRuns: newRuns };
        });
    },
}));
