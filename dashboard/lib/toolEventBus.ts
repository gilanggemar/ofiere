// dashboard/lib/toolEventBus.ts
//
// Server-side event bus for broadcasting tool-call events
// from the webhook receiver to SSE subscribers.
//
// This is an in-memory bus — works perfectly for local dev
// and single-instance deployments. For multi-instance prod,
// swap with Redis pub/sub.

import { EventEmitter } from 'events';

export interface ToolCallWebhookEvent {
    /** Event type: tool_call_start, tool_call_end, tool_call_error */
    type: 'tool_call_start' | 'tool_call_end' | 'tool_call_error' | 'tool_call_progress';
    /** Unique tool call ID */
    callId: string;
    /** Parent run ID (groups multiple tool calls in one agent turn) */
    runId: string;
    /** Agent making the call */
    agentId: string;
    /** Session key for routing */
    sessionKey: string;
    /** Tool name (e.g., "Exec", "Read", "WebSearch") */
    toolName: string;
    /** Tool input/arguments */
    input?: any;
    /** Tool output (only on end/error) */
    output?: any;
    /** Error message (only on error) */
    error?: string;
    /** Progress text (only on progress) */
    progress?: string;
    /** ISO timestamp */
    timestamp: string;
    /** Optional metadata */
    meta?: Record<string, any>;
}

// Singleton event emitter — persists across API route invocations in dev
const globalForBus = globalThis as unknown as { __toolEventBus?: EventEmitter };

if (!globalForBus.__toolEventBus) {
    globalForBus.__toolEventBus = new EventEmitter();
    globalForBus.__toolEventBus.setMaxListeners(50);
}

export const toolEventBus = globalForBus.__toolEventBus;

/** Emit a tool call event to all SSE subscribers */
export function emitToolEvent(event: ToolCallWebhookEvent) {
    toolEventBus.emit('tool-event', event);
}

/** Subscribe to tool call events (returns unsubscribe function) */
export function onToolEvent(handler: (event: ToolCallWebhookEvent) => void): () => void {
    toolEventBus.on('tool-event', handler);
    return () => toolEventBus.off('tool-event', handler);
}
