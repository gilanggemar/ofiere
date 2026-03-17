"use client";

import type { WarRoomEvent } from '@/lib/war-room/types';
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";

interface ConsensusHeatmapProps {
    events: WarRoomEvent[];
    currentTime: number;
}

export function ConsensusHeatmap({ events, currentTime }: ConsensusHeatmapProps) {
    const { hiddenAgentIds } = useAgentSettingsStore();
    const activeEvents = events.filter(e => e.timestamp <= currentTime);
    const agents = ['daisy', 'ivy', 'celia', 'thalia'].filter(a => !hiddenAgentIds.includes(a));

    // Matrix: matrix[source][target] = weight
    const matrix: Record<string, Record<string, number>> = {};
    agents.forEach(a => {
        matrix[a] = {};
        agents.forEach(b => matrix[a][b] = 0);
    });

    activeEvents.forEach(e => {
        if (e.type === 'agreement' && e.agentId && e.metadata.targetAgentId) {
            const source = e.agentId;
            const target = e.metadata.targetAgentId as string;
            const weight = (e.metadata.weight as number) || 0;
            matrix[source][target] = weight;
            matrix[target][source] = weight; // symmetric for heatmap
        }
    });

    const getColor = (weight: number) => {
        if (weight === 0) return 'bg-accent/30';
        if (weight > 0) return `bg-emerald-400/${Math.min(20 + weight * 80, 100)}`; // 20-100%
        return `bg-red-400/${Math.min(20 + Math.abs(weight) * 80, 100)}`;
    };

    return (
        <div className="w-full">
            <h3 className="text-xs font-semibold text-foreground/80 mb-3 uppercase tracking-wider">Consensus Matrix</h3>
            <div className="grid grid-cols-5 gap-1">
                <div className="col-span-1"></div>
                {agents.map(a => (
                    <div key={`col-${a}`} className="col-span-1 text-[10px] text-center text-muted-foreground capitalize font-medium">{a.charAt(0)}</div>
                ))}

                {agents.map(rowAgent => (
                    <div key={`row-${rowAgent}`} className="contents">
                        <div className="col-span-1 text-[10px] flex items-center justify-end pr-2 text-muted-foreground capitalize font-medium">
                            {rowAgent.charAt(0)}
                        </div>
                        {agents.map(colAgent => {
                            const val = rowAgent === colAgent ? 1 : matrix[rowAgent][colAgent];
                            const colorClass = rowAgent === colAgent ? 'bg-accent border border-border/50' : getColor(val);
                            return (
                                <div
                                    key={`${rowAgent}-${colAgent}`}
                                    className={`col-span-1 aspect-square rounded-md flex items-center justify-center transition-colors ${colorClass}`}
                                    title={`${rowAgent} & ${colAgent}: ${val}`}
                                >
                                    <span className="text-[9px] font-mono text-foreground/50 opacity-0 hover:opacity-100">{val.toFixed(1)}</span>
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        </div>
    );
}
