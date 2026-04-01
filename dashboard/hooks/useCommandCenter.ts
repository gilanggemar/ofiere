'use client';

import { useState, useEffect } from 'react';
import { useSocketStore } from '@/lib/useSocket';
import { useGamificationStore } from '@/store/useGamificationStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { useConnectionStore } from '@/store/useConnectionStore';

export function useCommandCenter() {
    const availableAgents = useAvailableAgents();
    const [activeAgentId, setActiveAgentId] = useState<string>('');
    const [isMounted, setIsMounted] = useState(false);
    const profileLoading = useConnectionStore((s) => s.profileLoading);
    const profileFetched = useConnectionStore((s) => s.profileFetched);

    const {
        agentXP,
        fleetPowerScore,
        currentStreak,
        fetchAll
    } = useGamificationStore();



    useEffect(() => {
        setIsMounted(true);
        // Fetch all gamification data on mount
        fetchAll();

        // Set up polling for gamification updates every 15s
        const statsInterval = setInterval(() => fetchAll(), 15000);
        return () => clearInterval(statsInterval);
    }, [fetchAll]);

    // Auto-select first agent if none is selected, or if the selected one disconnects
    useEffect(() => {
        if (availableAgents.length > 0) {
            if (!activeAgentId || !availableAgents.find((a: any) => a.id === activeAgentId)) {
                setActiveAgentId(availableAgents[0].id);
            }
        } else {
            setActiveAgentId('');
        }
    }, [availableAgents.length, activeAgentId]); // depend on length to catch additions

    const activeAgent = availableAgents.find((a: any) => a.id === activeAgentId) || null;

    // Look up XP — try every possible ID field since socket agents and DB may use different identifiers
    const activeAgentXp = (() => {
        const fallback = { level: 1, totalXp: 0, xpToNextLevel: 100, rank: 'INITIATE' };
        if (!activeAgent) return fallback;
        const agent = activeAgent as any;
        
        // All possible IDs this agent could be stored under
        const candidateIds = [
            agent.id,
            agent.accountId,
            agent.name?.toLowerCase(),
            agent.botName?.toLowerCase(),
        ].filter(Boolean);


        for (const id of candidateIds) {
            if (agentXP[id]) {
                return agentXP[id];
            }
        }
        return fallback;
    })();

    return {
        isMounted,
        activeAgent,
        activeAgentXp,
        fleetPowerScore,
        currentStreak,
        setActiveAgentId,
        availableAgents,
        profileLoading,
        profileFetched
    };
}
