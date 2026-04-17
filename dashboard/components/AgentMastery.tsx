import React, { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Shield, Swords, Star, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface AgentMasteryProps {
    agentId: string;
    agentName: string;
    completedTasks: number;
    totalTasks?: number;
    failedTasks?: number;
    className?: string;
}

const TIERS = [
    { name: 'Initiate', minXP: 0, icon: Shield, color: 'var(--status-offline)' },
    { name: 'Operative', minXP: 100, icon: Swords, color: 'var(--accent-coral)' },
    { name: 'Specialist', minXP: 500, icon: Star, color: 'var(--accent-teal)' },
    { name: 'Commander', minXP: 2000, icon: Crown, color: 'var(--accent-base)' },
    { name: 'Architect', minXP: 5000, icon: Sparkles, color: 'var(--accent-violet)' },
];

export const AgentMastery = memo(({
    agentId,
    agentName,
    completedTasks,
    totalTasks, // Not actively used in XP calc per prompt, but included in interface
    failedTasks = 0,
    className
}: AgentMasteryProps) => {
    // Fetch real XP from gamification API
    const [dbXP, setDbXP] = useState(0);
    useEffect(() => {
        let cancelled = false;
        fetch('/api/gamification/xp')
            .then(r => r.json())
            .then(data => {
                if (cancelled) return;
                if (data.agents && Array.isArray(data.agents)) {
                    const match = data.agents.find((a: any) => a.agent_id === agentId);
                    if (match) setDbXP(match.total_xp || 0);
                }
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [agentId]);

    const baseXP = completedTasks * 10;

    let multiplier = 1.0;
    if (completedTasks + failedTasks > 0) {
        const successRate = completedTasks / (completedTasks + failedTasks);
        if (successRate > 0.95) {
            multiplier = 1.2;
        } else if (successRate < 0.80) {
            multiplier = 0.9;
        }
    }

    // Combine task-based XP with game/gamification DB XP
    const finalXP = Math.floor(baseXP * multiplier) + dbXP;

    let currentTierIndex = 0;
    for (let i = TIERS.length - 1; i >= 0; i--) {
        if (finalXP >= TIERS[i].minXP) {
            currentTierIndex = i;
            break;
        }
    }

    const currentTier = TIERS[currentTierIndex];
    const nextTier = currentTierIndex < TIERS.length - 1 ? TIERS[currentTierIndex + 1] : null;

    let progress = 100;
    if (nextTier) {
        progress = ((finalXP - currentTier.minXP) / (nextTier.minXP - currentTier.minXP)) * 100;
    }

    // Distribute levels
    let level = 1;
    if (currentTier.name === 'Initiate') {
        level = 1 + Math.floor(finalXP / 20); // Levels 1-5
    } else if (currentTier.name === 'Operative') {
        level = 6 + Math.floor((finalXP - TIERS[1].minXP) / 40); // Levels 6-15
    } else if (currentTier.name === 'Specialist') {
        level = 16 + Math.floor((finalXP - TIERS[2].minXP) / 100); // Levels 16-30
    } else if (currentTier.name === 'Commander') {
        level = 31 + Math.floor((finalXP - TIERS[3].minXP) / 150); // Levels 31-50
    } else {
        level = 51 + Math.floor((finalXP - TIERS[4].minXP) / 200); // Levels 51+
    }

    const Icon = currentTier.icon;
    const isArchitect = currentTier.name === 'Architect';
    const hasPrecisionBonus = multiplier > 1.0;

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex flex-col gap-1 w-full max-w-[250px] font-sans group", className)}>
                        {/* Top Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Icon size={16} className="shrink-0" style={{ color: currentTier.color }} />

                                <span
                                    className={cn("ofiere-badge-text truncate", isArchitect && "relative overflow-hidden")}
                                    style={!isArchitect ? { color: currentTier.color } : {
                                        background: `linear-gradient(90deg, ${currentTier.color} 0%, #ffffff 50%, ${currentTier.color} 100%)`,
                                        backgroundSize: '200% auto',
                                        color: 'transparent',
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        animation: 'shimmer 3s infinite linear'
                                    }}
                                >
                                    {currentTier.name}
                                </span>

                                <div className="flex items-center gap-0.5 ml-1 shrink-0">
                                    <span className="ofiere-metric-sm text-foreground/80">Lv.{level}</span>
                                    {hasPrecisionBonus && (
                                        <motion.span
                                            initial={{ opacity: 0.5, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1.2 }}
                                            transition={{ duration: 1, repeat: Infinity, repeatType: 'reverse' }}
                                            className="text-[10px]"
                                        >
                                            ⚡
                                        </motion.span>
                                    )}
                                </div>
                            </div>

                            <span className="ofiere-caption opacity-70 tabular-nums shrink-0 ml-2">
                                {Math.floor(progress)}%
                            </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-1 w-full rounded-full bg-accent-base/10 overflow-hidden relative">
                            <motion.div
                                className="absolute left-0 top-0 bottom-0 rounded-full"
                                style={{ backgroundColor: currentTier.color }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${Math.min(100, progress)}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                            />
                        </div>

                        {/* Bottom Row */}
                        <div className="text-right">
                            <span className="ofiere-caption opacity-50 tabular-nums">
                                {finalXP.toLocaleString()} {nextTier && `/ ${nextTier.minXP.toLocaleString()}`} XP
                            </span>
                        </div>

                        <style>{`
              @keyframes shimmer {
                0% { background-position: -200% center; }
                100% { background-position: 200% center; }
              }
            `}</style>
                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="flex flex-col gap-1 p-2">
                    <p className="font-semibold">{agentName} — {currentTier.name} Level {level}</p>
                    <p className="text-sm opacity-80">{completedTasks} tasks completed</p>
                    {dbXP > 0 && <p className="text-sm text-[var(--accent-base)]">+{dbXP.toLocaleString()} XP from Games</p>}
                    {multiplier === 1.2 && <p className="text-sm text-[var(--accent-lime)]">Precision Bonus: 1.2x XP</p>}
                    {multiplier === 0.9 && <p className="text-sm text-[var(--accent-coral)]">Reliability Penalty: 0.9x XP</p>}
                    <p className="text-sm opacity-60">
                        {nextTier ? `Next tier at ${nextTier.minXP.toLocaleString()} XP` : 'Max Tier Reached'}
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

AgentMastery.displayName = 'AgentMastery';
export default AgentMastery;
