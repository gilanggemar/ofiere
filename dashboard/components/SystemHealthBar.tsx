import React, { memo } from 'react';
import { motion } from 'framer-motion';
import { getAgentColor } from '@/lib/agentColors';
import { cn } from '@/lib/utils';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { useAgentZeroStore } from '@/store/useAgentZeroStore';

export interface AgentHealth {
    id: string;
    name: string;
    isOnline: boolean;
    hasError: boolean;
    activeTasks: number;
}

export interface SystemHealthBarProps {
    agents: AgentHealth[];
    className?: string;
    showVpsIndicators?: boolean;
}

// VPS Connection Indicator Component
const VpsIndicator = memo(({ label, connected, connecting }: {
    label: string;
    connected: boolean;
    connecting?: boolean;
}) => {
    const statusColor = connecting
        ? 'var(--accent-gold)'
        : connected
            ? 'var(--accent-lime)'
            : 'var(--accent-coral)';

    return (
        <div className="flex items-center gap-1.5">
            <motion.div
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor }}
                animate={connecting ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1, repeat: Infinity }}
            />
            <span className="ofiere-caption text-muted-foreground">{label}</span>
        </div>
    );
});
VpsIndicator.displayName = 'VpsIndicator';

export const SystemHealthBar = memo(({ agents, className, showVpsIndicators = true }: SystemHealthBarProps) => {
    // VPS connection state
    const openClawConnected = useOpenClawStore((s) => s.isConnected);
    const openClawStatus = useOpenClawStore((s) => s.connectionStatus);
    const agentZeroConnected = useAgentZeroStore((s) => s.vpsConnected);
    const agentZeroStatus = useAgentZeroStore((s) => s.status);

    const totalTasks = agents.reduce((sum, a) => sum + Math.max(1, a.activeTasks), 0);

    const segments = agents.map(agent => ({
        ...agent,
        displayWeight: Math.max(1, agent.activeTasks)
    }));

    const totalWeight = segments.reduce((sum, s) => sum + s.displayWeight, 0);

    const errorAgents = agents.filter(a => a.hasError);
    const isAllHealthy = errorAgents.length === 0;

    if (agents.length === 0) {
        return (
            <div className={cn("flex flex-col gap-2 w-full", className)}>
                <div className="h-1.5 w-full rounded-full bg-accent-base/10 animate-pulse" />
                <div className="flex items-center justify-between">
                    <span className="ofiere-caption text-muted-foreground opacity-50">Awaiting telemetry...</span>
                    {showVpsIndicators && (
                        <div className="flex items-center gap-3">
                            <VpsIndicator
                                label="OC"
                                connected={openClawConnected}
                                connecting={openClawStatus === 'connecting' || openClawStatus === 'authenticating'}
                            />
                            <VpsIndicator
                                label="A0"
                                connected={agentZeroConnected}
                                connecting={agentZeroStatus === 'connecting'}
                            />
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className={cn("flex flex-col gap-2 w-full", className)}>
            <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-background/20 relative">
                {isAllHealthy ? (
                    <div
                        className="absolute inset-0 w-full h-full"
                        style={{
                            background: `linear-gradient(90deg, ${agents.map(a => getAgentColor(a.id)).join(', ')})`
                        }}
                    />
                ) : (
                    segments.map((segment) => {
                        const widthPercentage = (segment.displayWeight / totalWeight) * 100;
                        const color = getAgentColor(segment.id);

                        return (
                            <motion.div
                                key={segment.id}
                                className="h-full border-r border-background/50 last:border-r-0"
                                style={{ width: `${widthPercentage}%`, backgroundColor: color }}
                                animate={segment.hasError ? {
                                    backgroundColor: [color, 'var(--accent-coral)', color]
                                } : {}}
                                transition={{ duration: 1.5, repeat: Infinity }}
                            />
                        );
                    })
                )}
            </div>

            <div className="flex items-center justify-between">
                <div>
                    {isAllHealthy ? (
                        <span className="ofiere-caption" style={{ color: 'var(--accent-lime)' }}>All systems nominal</span>
                    ) : (
                        <span className="ofiere-caption" style={{ color: 'var(--accent-coral)' }}>
                            {errorAgents.length} {errorAgents.length === 1 ? 'agent' : 'agents'} with warnings
                        </span>
                    )}
                </div>
                {showVpsIndicators && (
                    <div className="flex items-center gap-3">
                        <VpsIndicator
                            label="OC"
                            connected={openClawConnected}
                            connecting={openClawStatus === 'connecting' || openClawStatus === 'authenticating'}
                        />
                        <VpsIndicator
                            label="A0"
                            connected={agentZeroConnected}
                            connecting={agentZeroStatus === 'connecting'}
                        />
                    </div>
                )}
            </div>
        </div>
    );
});

SystemHealthBar.displayName = 'SystemHealthBar';
