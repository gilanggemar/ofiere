import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AgentSettingsState {
    hiddenAgentIds: string[];
    toggleAgentVisibility: (agentId: string) => void;
    setAgentVisibility: (agentId: string, isHidden: boolean) => void;
}

export const useAgentSettingsStore = create<AgentSettingsState>()(
    persist(
        (set) => ({
            hiddenAgentIds: [],
            toggleAgentVisibility: (agentId) => set((state) => {
                const isHidden = state.hiddenAgentIds.includes(agentId);
                if (isHidden) {
                    return { hiddenAgentIds: state.hiddenAgentIds.filter((id) => id !== agentId) };
                } else {
                    return { hiddenAgentIds: [...state.hiddenAgentIds, agentId] };
                }
            }),
            setAgentVisibility: (agentId, isHidden) => set((state) => {
                const currentlyHidden = state.hiddenAgentIds.includes(agentId);
                if (isHidden && !currentlyHidden) {
                    return { hiddenAgentIds: [...state.hiddenAgentIds, agentId] };
                }
                if (!isHidden && currentlyHidden) {
                    return { hiddenAgentIds: state.hiddenAgentIds.filter((id) => id !== agentId) };
                }
                return state;
            }),
        }),
        {
            name: 'agent-settings-storage',
        }
    )
);
