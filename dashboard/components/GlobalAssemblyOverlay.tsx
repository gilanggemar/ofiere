'use client'

import { useAssemblyStore } from '@/store/useAssemblyStore';
import { DashboardAssembly } from '@/components/DashboardAssembly';
import { useCallback } from 'react';

/**
 * Global assembly overlay — lives in root layout so it persists
 * across route changes (login → dashboard). Only one instance ever.
 */
export function GlobalAssemblyOverlay() {
    const visible = useAssemblyStore((s) => s.visible);
    const ready = useAssemblyStore((s) => s.ready);
    const reset = useAssemblyStore((s) => s.reset);

    const handleComplete = useCallback(() => {
        reset();
    }, [reset]);

    if (!visible) return null;

    return (
        <DashboardAssembly
            isReady={ready}
            onComplete={handleComplete}
        />
    );
}
