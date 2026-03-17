"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FileText, ChevronRight } from "lucide-react";
import type { WarRoomEvent } from '@/lib/war-room/types';
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";

interface ReasoningPanelProps {
    events: WarRoomEvent[];
    currentTime: number;
}

export function ReasoningPanel({ events, currentTime }: ReasoningPanelProps) {
    const { hiddenAgentIds } = useAgentSettingsStore();
    const activeEvents = events.filter(e => e.timestamp <= currentTime);
    const agents = ['daisy', 'ivy', 'celia', 'thalia'].filter(a => !hiddenAgentIds.includes(a));

    // Get the most recent position statement for each agent
    const currentStances: Record<string, WarRoomEvent | null> = {};
    agents.forEach(a => currentStances[a] = null);

    activeEvents.forEach(e => {
        if (e.type === 'position_update' && e.agentId) {
            currentStances[e.agentId] = e;
        }
    });

    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto p-2 pb-4 nerv-glass-1 rounded-xl">
            {agents.map(agent => {
                const stance = currentStances[agent];

                return (
                    <div key={agent} className="border border-border/50 bg-card rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="bg-accent/30 px-3 py-2 border-b border-border/50 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <AgentAvatar agentId={agent} size={16} />
                                <span className="text-xs font-semibold capitalize text-foreground">{agent}</span>
                            </div>
                            {stance && stance.metadata.sentiment !== undefined && (
                                <div className={`w-2 h-2 rounded-full ${(stance.metadata.sentiment as number) > 0.5 ? 'bg-emerald-400' : (stance.metadata.sentiment as number) < -0.5 ? 'bg-red-400' : 'bg-blue-400'}`} />
                            )}
                        </div>

                        <div className="p-3">
                            {stance ? (
                                <AnimatePresence mode="popLayout">
                                    <motion.div
                                        key={stance.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ duration: 0.3 }}
                                        exit={{ opacity: 0, x: 20 }}
                                    >
                                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                                            {stance.content}
                                        </p>
                                        {Array.isArray(stance.metadata.actionItems) && (
                                            <div className="mt-2 pt-2 border-t border-border/30">
                                                <span className="text-[9px] font-semibold text-foreground/50 uppercase tracking-wide">Proposed Actions</span>
                                                <ul className="mt-1 space-y-1">
                                                    {(stance.metadata.actionItems as string[]).map((item: string, idx: number) => (
                                                        <li key={idx} className="text-[10px] text-muted-foreground flex items-start gap-1">
                                                            <ChevronRight className="w-3 h-3 text-emerald-400 shrink-0" />
                                                            <span className="line-clamp-2">{String(item)}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </motion.div>
                                </AnimatePresence>
                            ) : (
                                <div className="flex items-center justify-center py-4 text-muted-foreground/40">
                                    <FileText className="w-4 h-4 mr-2" />
                                    <span className="text-xs">Awaiting analysis...</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
