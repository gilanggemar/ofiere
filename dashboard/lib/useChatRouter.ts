import { useSocket, useSocketStore, ChatMessage } from "@/lib/useSocket";
import useAgentZeroStore, { AgentZeroMessage } from "@/store/useAgentZeroStore";
import { getGateway } from "@/lib/useOpenClawGateway";
import { useConnectionStore } from "@/store/useConnectionStore";
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";
import { useMemo, useEffect, useCallback } from "react";

export type AgentProvider = "openclaw" | "agent-zero" | "external";

export interface IntegratedAgent {
    id: string;
    name: string;
    accountId?: string;
    provider: AgentProvider;
    isOnline: boolean;
    original: any;
}

export function useChatRouter() {
    const { agents: openClawAgents, isConnected: isOpenClawConnected, chatMessages: openClawMessages } = useSocketStore();
    const { sendChatMessage } = useSocket();

    const {
        status: a0Status,
        messages: a0Messages,
        sendMessage: sendA0Message,
        checkConnection: checkA0Connection,
    } = useAgentZeroStore();

    const { activeProfile } = useConnectionStore();
    const { hiddenAgentIds } = useAgentSettingsStore();

    // Auto-connect Agent Zero if unconfigured but enabled in the profile
    useEffect(() => {
        if (a0Status === 'unconfigured' && activeProfile?.agentZeroEnabled) {
            checkA0Connection();
        }
    }, [a0Status, checkA0Connection, activeProfile?.agentZeroEnabled]);

    // 1. Merge Agents
    const integratedAgents = useMemo<IntegratedAgent[]>(() => {
        const list: IntegratedAgent[] = openClawAgents
            .filter((a: any) => !hiddenAgentIds.includes(a.accountId || a.name || a.id))
            .map((a: any) => ({
                id: a.accountId || a.name || a.id,
                name: a.accountId
                    ? a.accountId.charAt(0).toUpperCase() + a.accountId.slice(1)
                    : (a.name || a.id),
            accountId: a.accountId,
            provider: "openclaw",
            isOnline: a.running || a.probeOk || a.connected || isOpenClawConnected,
            original: a
        }));

        // Add Agent Zero conditionally
        if (activeProfile?.agentZeroEnabled && !hiddenAgentIds.includes("agent-zero")) {
            list.push({
                id: "agent-zero",
                name: "Agent Zero",
                provider: "agent-zero",
                isOnline: a0Status === "online",
                original: null
            });
        }

        return list;
    }, [openClawAgents, isOpenClawConnected, a0Status, activeProfile?.agentZeroEnabled, hiddenAgentIds]);

    // 2. Get messages for a specific agent
    const getMessagesForAgent = useCallback((agentId: string): ChatMessage[] => {
        const agent = integratedAgents.find(a => a.id === agentId);
        if (agent?.provider === 'agent-zero') {
            return a0Messages.map((m: AgentZeroMessage) => ({
                id: m.id,
                role: m.role === 'agent' ? 'assistant' : 'user',
                content: m.content,
                timestamp: new Date(m.timestamp).toLocaleTimeString(),
                agentId: 'agent-zero',
                sessionKey: 'agent-zero-session',
                streaming: false,
                tool_calls: [],
                attachments: m.attachments
            }));
        }

        return openClawMessages.filter(m =>
            m.agentId === agentId ||
            (m.agentId && m.agentId.includes(agentId)) ||
            (agentId && m.agentId && agentId.includes(m.agentId))
        );
    }, [integratedAgents, a0Messages, openClawMessages]);

    // 3. Dispatch Message — now uses gateway for OpenClaw agents
    const dispatchMessage = useCallback(async (agentId: string, message: string, sessionKey?: string, attachments?: any[], skipStoreAdd?: boolean) => {
        const agent = integratedAgents.find(a => a.id === agentId);
        if (!agent) {
            console.warn("Agent not found for dispatch:", agentId);
            return;
        }

        if (agent.provider === 'agent-zero') {
            await sendA0Message(message, attachments);
        } else {
            // OpenClaw — use the gateway via the shim
            const sk = sessionKey || `agent:${agentId}:webchat`;
            sendChatMessage(agentId, message, sk, attachments, skipStoreAdd);
        }
    }, [integratedAgents, sendA0Message, sendChatMessage]);

    return {
        integratedAgents,
        getMessagesForAgent,
        dispatchMessage,
        isOpenClawConnected
    };
}
