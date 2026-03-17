'use client';

import { useEffect, useState, useCallback } from 'react';

const bgCache: Record<string, string | null> = {};

export function useAgentBackground(agentId: string) {
    const [backgroundUri, setBackgroundUri] = useState<string | null>(bgCache[agentId] ?? null);
    const [isLoading, setIsLoading] = useState(false);

    const fetchBackground = useCallback(async () => {
        if (!agentId) return;
        setIsLoading(true);
        try {
            const res = await fetch(`/api/agents/background?agentId=${agentId}`);
            const data = await res.json();
            const bg = data.backgroundImage || null;
            bgCache[agentId] = bg;
            setBackgroundUri(bg);
        } catch (err) {
            console.error('Failed to load agent background:', err);
        } finally {
            setIsLoading(false);
        }
    }, [agentId]);

    useEffect(() => {
        if (bgCache[agentId] !== undefined) {
            setBackgroundUri(bgCache[agentId]);
        }
        fetchBackground();
    }, [agentId, fetchBackground]);

    const invalidate = useCallback(() => {
        delete bgCache[agentId];
        fetchBackground();
    }, [agentId, fetchBackground]);

    return { backgroundUri, isLoading, invalidate };
}
