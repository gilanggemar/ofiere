import React, { memo, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, Swords, Star, Crown, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGamificationStore } from '@/store/useGamificationStore';

export interface AgentMasteryProps {
    agentId: string;
    agentName: string;
    completedTasks: number;
    totalTasks?: number;
    failedTasks?: number;
    className?: string;
}

// ─── XP Level Calculation (mirrors server xpEngine.ts + AgentIdentityPlate) ───
function calculateLevelFromTotalXp(totalXp: number) {
    let level = 1;
    let cumulativeXp = 0;
    let xpForThisLevel = 100;

    while (totalXp >= cumulativeXp + xpForThisLevel) {
        cumulativeXp += xpForThisLevel;
        level++;
        xpForThisLevel = Math.floor(100 * Math.pow(1.15, level - 1));
    }

    return {
        level,
        currentLevelXp: totalXp - cumulativeXp,
        xpToNextLevel: xpForThisLevel,
    };
}

// ─── Rank from XP (same thresholds as server) ───
function getRankFromXP(totalXp: number): { name: string; icon: typeof Shield; color: string } {
    if (totalXp >= 5000) return { name: 'Architect', icon: Sparkles, color: 'var(--accent-violet)' };
    if (totalXp >= 2000) return { name: 'Commander', icon: Crown, color: 'var(--accent-base)' };
    if (totalXp >= 500)  return { name: 'Specialist', icon: Star, color: 'var(--accent-teal)' };
    if (totalXp >= 100)  return { name: 'Operative', icon: Swords, color: 'var(--accent-coral)' };
    return { name: 'Initiate', icon: Shield, color: 'var(--status-offline)' };
}

export const AgentMastery = memo(({
    agentId,
    agentName,
    completedTasks,
    totalTasks,
    failedTasks = 0,
    className
}: AgentMasteryProps) => {
    // ─── Use the SAME gamification store as AgentIdentityPlate (single source of truth) ───
    const agentXP = useGamificationStore(s => s.agentXP);
    const storeXp = agentXP[agentId] || null;
    const totalXp = storeXp?.totalXp ?? 0;

    // Use the same level calculation as the main dashboard
    const levelCalc = useMemo(() => calculateLevelFromTotalXp(totalXp), [totalXp]);
    const { level, currentLevelXp, xpToNextLevel } = levelCalc;

    const rank = useMemo(() => getRankFromXP(totalXp), [totalXp]);
    const progress = xpToNextLevel > 0 ? Math.min(100, (currentLevelXp / xpToNextLevel) * 100) : 0;

    const Icon = rank.icon;
    const isArchitect = rank.name === 'Architect';

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex flex-col gap-1 w-full max-w-[250px] font-sans group", className)}>
                        {/* Top Row */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                <Icon size={16} className="shrink-0" style={{ color: rank.color }} />

                                <span
                                    className={cn("ofiere-badge-text truncate", isArchitect && "relative overflow-hidden")}
                                    style={!isArchitect ? { color: rank.color } : {
                                        background: `linear-gradient(90deg, ${rank.color} 0%, #ffffff 50%, ${rank.color} 100%)`,
                                        backgroundSize: '200% auto',
                                        color: 'transparent',
                                        WebkitBackgroundClip: 'text',
                                        backgroundClip: 'text',
                                        animation: 'shimmer 3s infinite linear'
                                    }}
                                >
                                    {rank.name}
                                </span>

                                <div className="flex items-center gap-0.5 ml-1 shrink-0">
                                    <span className="ofiere-metric-sm text-foreground/80">Lv.{level}</span>
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
                                style={{ backgroundColor: rank.color }}
                                initial={{ width: '0%' }}
                                animate={{ width: `${Math.min(100, progress)}%` }}
                                transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
                            />
                        </div>

                        {/* Bottom Row */}
                        <div className="text-right">
                            <span className="ofiere-caption opacity-50 tabular-nums">
                                {currentLevelXp} / {xpToNextLevel} XP
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
                    <p className="font-semibold">{agentName} — {rank.name} Level {level}</p>
                    <p className="text-sm opacity-80">{totalXp.toLocaleString()} Total XP</p>
                    <p className="text-sm opacity-60">
                        {xpToNextLevel - currentLevelXp} XP to next level
                    </p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

AgentMastery.displayName = 'AgentMastery';
export default AgentMastery;
