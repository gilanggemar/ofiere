// ─── Agent Adapter Types ─────────────────────────────────────────────────────
// Defines the contract that every agent adapter must implement.
// Adapters wrap existing agent connections (WebSocket, REST, etc.)
// and normalize them into a single interface the store can call.

import type { Message } from '@/types/chat';

export interface SendMessageParams {
    conversationId: string;
    agentId: string;
    content: string;
    /** Optional session key for OpenClaw agents */
    sessionKey?: string;
    /** File attachments */
    attachments?: any[];
    /** Full conversation history for context replay */
    history?: Message[];
}

export interface SendMessageResult {
    /** The response content (may be empty for streaming agents) */
    content: string;
    /** Agent-specific metadata to persist alongside the message row */
    metadata: Record<string, any>;
    /** Whether the response is being streamed (content will arrive via events) */
    streaming: boolean;
}

export interface AgentAdapter {
    /** Human-readable name for logging */
    readonly name: string;
    /** Send a user message and return the agent's response */
    sendMessage(params: SendMessageParams): Promise<SendMessageResult>;
}
