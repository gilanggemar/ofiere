// ─── OpenClaw Adapter ────────────────────────────────────────────────────────
// Wraps the existing OpenClaw WebSocket connection.
// Does NOT replace useSocket/useOpenClawStore — it calls into them.
// The heavy lifting (streaming, tool calls, lifecycle) still happens
// in useSocket.ts; this adapter just triggers the send.

import type { AgentAdapter, SendMessageParams, SendMessageResult } from './types';
import { useSocketStore } from '@/lib/useSocket';

export const openClawAdapter: AgentAdapter = {
    name: 'OpenClaw',

    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
        const { agentId, content, sessionKey, attachments } = params;

        // We can't call hooks from a non-React context, so we access the store
        // directly. The actual WebSocket send is done by the gateway; we just
        // need to add the user message to the socket store for the existing
        // streaming pipeline to pick up the response.
        //
        // NOTE: The actual send is done in the chat page via useSocket().sendChatMessage
        // because it requires the hook's ref-based runId tracking.
        // This adapter returns a streaming marker so the store knows not to expect
        // a direct response — the response arrives via WebSocket events and gets
        // merged into useChatStore.activeMessages by the sync layer.

        const sk = sessionKey || `agent:${agentId}:webchat`;

        return {
            content: '', // Content arrives via streaming events
            metadata: {
                provider: 'openclaw',
                sessionKey: sk,
                agentId,
            },
            streaming: true,
        };
    },
};
