"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOverviewData } from '@/hooks/useOverviewData';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { Shield, Zap, Target, Wrench, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentStore } from '@/store/useAgentStore';
import { useAgentSettingsStore } from '@/store/useAgentSettingsStore';

const RANK_COLORS: Record<string, string> = {
    'INITIATE': 'var(--text-muted)',
    'OPERATIVE': 'var(--accent-teal)',
    'SPECIALIST': 'var(--accent-violet)',
    'COMMANDER': 'var(--accent-gold)',
    'APEX': 'var(--accent-plasma)'
};

const AGENT_SPECIALTIES: Record<string, string[]> = {
    'daisy': ['Research', 'Writing', 'Data'],
    'ivy': ['Code', 'Analysis', 'Logic'],
    'celia': ['Coordination', 'Planning'],
    'thalia': ['Design', 'Creative', 'Vision'],
    'zero': ['Core System', 'Overseer', 'All']
};

export function FleetStatusCards() {
    const { agentXPData, streak, metrics } = useOverviewData();
    const { agents } = useAgentStore();
    const { hiddenAgentIds } = useAgentSettingsStore();

    // Sort array of agents to map over, filtering hidden ones
    const agentKeys = Object.keys(agents).filter(k => k !== 'zero' && k !== 'system' && !hiddenAgentIds.includes(k));
    // optionally include zero if not hidden
    if (!hiddenAgentIds.includes('zero')) {
        agentKeys.push('zero');
    }

    return (
        <div className="flex flex-col gap-4">
            <h3 className="ofiere-section flex items-center gap-2 px-1">
                <Shield size={14} className="text-accent-base" />
                Fleet Status
            </h3>

            <div className="flex flex-col gap-3">
                {agentKeys.map((agentId, i) => {
                    const agent = agents[agentId];
                    const xpData = agentXPData[agentId] || {
                        totalXp: 0, level: 1, xpToNextLevel: 100, rank: 'INITIATE'
                    };
                    const isOnline = agent?.status === 'ONLINE' || agent?.status === 'WORKING';
                    const colorVar = `var(--agent-${agentId})`;

                    const progressPercent = Math.min(100, (xpData.totalXp / (xpData.totalXp + xpData.xpToNextLevel)) * 100) || 0; // Simple approximation for bar

                    return (
                        <motion.div
                            key={agentId}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1, duration: 0.3 }}
                            whileHover={{ translateY: -2, scale: 1.01 }}
                            className={cn(
                                "group relative overflow-hidden rounded-md p-4 transition-all duration-300",
                                `ofiere-glass-agent-${agentId}`
                            )}
                            style={{ borderLeftColor: colorVar, borderLeftWidth: '3px' }}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-[var(--hover-bg,transparent)] to-transparent opacity-0 group-hover:opacity-10 transition-opacity duration-300 pointer-events-none" style={{ '--hover-bg': colorVar } as any} />

                            {/* Header */}
                            <div className="flex justify-between items-start mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <div className={cn("absolute inset-0 rounded-full blur-md opacity-20", isOnline && "opacity-60 animate-pulse")} style={{ backgroundColor: colorVar }} />
                                        <AgentAvatar agentId={agentId} size={48} className="ring-2 ring-background relative z-10" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold capitalize text-foreground">{agentId}</h4>
                                            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-background/50 border border-border/50">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", isOnline ? "bg-status-online" : "bg-status-offline")} />
                                                <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider">{isOnline ? 'ONLINE' : 'OFFLINE'}</span>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                            <span
                                                className="ofiere-rank"
                                                style={{ color: RANK_COLORS[xpData.rank] || RANK_COLORS.INITIATE }}
                                            >
                                                {xpData.rank}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground font-mono">Lv.{xpData.level}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* XP Bar */}
                            <div className="mb-4">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex-1 w-full h-[4px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--xp-bar-bg)' }}>
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${progressPercent}%` }}
                                            transition={{ duration: 1, ease: 'easeOut' }}
                                            className="h-full rounded-full"
                                            style={{ background: 'linear-gradient(90deg, var(--xp-gradient-start), var(--xp-gradient-end))' }}
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="opacity-0">-</span>
                                    <span className="ofiere-xp">{xpData.totalXp} / {xpData.totalXp + xpData.xpToNextLevel} XP</span>
                                </div>
                            </div>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-4 gap-2 mb-3">
                                <div className="flex flex-col items-center p-2 rounded-lg bg-background/40 border border-white/5">
                                    <CheckCircle2 size={12} className="text-muted-foreground mb-1" />
                                    <span className="text-xs font-semibold tabular-nums leading-none mb-1">...</span>
                                    <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Tasks</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-background/40 border border-white/5">
                                    <Zap size={12} className="text-accent-ember mb-1" />
                                    <span className="text-xs font-semibold tabular-nums leading-none mb-1">{streak.current}</span>
                                    <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Streak</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-background/40 border border-white/5">
                                    <Target size={12} className="text-accent-teal mb-1" />
                                    <span className="text-xs font-semibold tabular-nums leading-none mb-1">{metrics.successRate}%</span>
                                    <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Rate</span>
                                </div>
                                <div className="flex flex-col items-center p-2 rounded-lg bg-background/40 border border-white/5">
                                    <Wrench size={12} className="text-muted-foreground mb-1" />
                                    <span className="text-xs font-semibold tabular-nums leading-none mb-1">...</span>
                                    <span className="text-[9px] uppercase text-muted-foreground tracking-wider">Tools</span>
                                </div>
                            </div>

                            {/* Tags & Last Action */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                                <div className="flex gap-1.5">
                                    {(AGENT_SPECIALTIES[agentId] || []).map((spec) => (
                                        <span key={spec} className="px-1.5 py-0.5 text-[9px] tracking-wider uppercase bg-white/5 text-muted-foreground rounded-sm border border-white/5">
                                            {spec}
                                        </span>
                                    ))}
                                </div>
                                <div className="text-[10px] text-muted-foreground truncate max-w-[120px]" title="Awaiting orders...">
                                    Awaiting orders...
                                </div>
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}
