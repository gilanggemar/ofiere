// ─── Agent Zero Adapter ──────────────────────────────────────────────────────
// Wraps the existing Agent Zero REST/polling connection.
// Does NOT replace useAgentZeroStore — it calls into it.

import type { AgentAdapter, SendMessageParams, SendMessageResult } from './types';
import useAgentZeroStore from '@/store/useAgentZeroStore';

export const agentZeroAdapter: AgentAdapter = {
    name: 'Agent Zero',

    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
        const { content, attachments } = params;
        const store = useAgentZeroStore.getState();

        // The Agent Zero store.sendMessage is synchronous from the UI's perspective —
        // it awaits the REST response and adds it to the store's messages array.
        // We trigger it and then read the latest message back.

        const prevMessageCount = store.messages.length;

        await store.sendMessage(content, attachments);

        // After sendMessage resolves, the store should have a new agent message
        const updatedStore = useAgentZeroStore.getState();
        const newMessages = updatedStore.messages.slice(prevMessageCount);
        const agentReply = newMessages.find(m => m.role === 'agent');

        return {
            content: agentReply?.content || '',
            metadata: {
                provider: 'agent-zero',
                contextId: updatedStore.contextId || undefined,
            },
            streaming: false, // Agent Zero returns the full response at once
        };
    },
};
