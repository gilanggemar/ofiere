import { useMemo } from 'react';
import { useSocketStore } from '@/lib/useSocket';
import { useConnectionStore } from '@/store/useConnectionStore';
import { useAgentSettingsStore } from '@/store/useAgentSettingsStore';
import { getAgentProfile } from '@/lib/agentRoster';

export function useAvailableAgents() {
    const socketAgents = useSocketStore((s) => s.agents);
    const { activeProfile } = useConnectionStore();
    const { hiddenAgentIds } = useAgentSettingsStore();

    const availableAgents = useMemo(() => {
        const available = [...socketAgents];
        if (activeProfile?.agentZeroEnabled) {
            if (!available.find(a => a.id === 'agent-zero')) {
                available.push({
                    id: 'agent-zero',
                    name: 'Zero',
                    status: 'idle',
                    channel: 'system',
                    accountId: 'agent-zero',
                    avatar: getAgentProfile('agent-zero')?.avatar || '/agents/zero.png',
                    configured: true,
                    running: true,
                    connected: true,
                    linked: true,
                    probeOk: true,
                });
            }
        }

        return available.filter((a: any) => {
            const id = a.accountId || a.name || a.id;
            return !hiddenAgentIds.includes(id);
        });
    }, [socketAgents, activeProfile?.agentZeroEnabled, hiddenAgentIds]);

    return availableAgents;
}
