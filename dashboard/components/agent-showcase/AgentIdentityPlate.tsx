'use client';

import { motion } from 'framer-motion';
import { Star, Flame } from 'lucide-react';
import { AgentCapabilities } from './AgentCapabilities';
import type { AgentProfile } from '@/lib/agentRoster';
import { useAgentZeroStore } from '@/store/useAgentZeroStore';
import { useRouter } from 'next/navigation';

interface AgentIdentityPlateProps {
    agent: AgentProfile;
    level: number;
    currentXp: number;
    xpToNext: number;
    rank: string;
    currentStreak: number;
}

function RarityStars({ level }: { level: number }) {
    const starCount = Math.min(5, Math.floor(level / 10) + 1);
    return (
        <div className="flex items-center gap-0.5 mb-1">
            {Array.from({ length: 5 }).map((_, i) => (
                <motion.div
                    key={i}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: i * 0.08, type: 'spring', stiffness: 300 }}
                >
                    <Star
                        size={14}
                        className={i < starCount ? 'text-amber-400 fill-amber-400' : 'text-white/15'}
                        style={i === starCount - 1 && starCount === 5 ? {
                            filter: 'drop-shadow(0 0 6px rgba(251,191,36,0.8))'
                        } : undefined}
                    />
                </motion.div>
            ))}
        </div>
    );
}

export function AgentIdentityPlate({ agent, level, currentXp, xpToNext, rank, currentStreak }: AgentIdentityPlateProps) {
    const router = useRouter();
    const isZero = agent.id === 'agent-zero';
    const zeroState = useAgentZeroStore(s => s.status);
    const statusLabel = isZero ? zeroState : 'standby';
    const statusDotColor = statusLabel === 'online' ? '#4ade80' : statusLabel === 'standby' ? '#60a5fa' : '#f59e0b';

    const xpPercent = xpToNext > 0 ? Math.min(100, (currentXp / (currentXp + xpToNext)) * 100) : 0;

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Identity Section — fixed */}
            <div className="flex-shrink-0 p-5 space-y-4">
                {/* Rank */}
                <div
                    className="text-[11px] uppercase tracking-[0.2em] font-mono"
                    style={{ color: 'var(--accent-base, #FF6D29)' }}
                >
                    ⬡ RANK: {rank}
                </div>

                {/* Rarity Stars */}
                <RarityStars level={level} />

                {/* Agent Name */}
                <h2
                    className="text-[28px] font-bold tracking-[-0.03em] leading-tight"
                    style={{
                        color: agent.colorHex,
                        textShadow: `0 0 20px ${agent.colorHex}88`
                    }}
                >
                    {agent.name}
                </h2>

                {/* Role */}
                <p className="text-sm text-white/50">{agent.role}</p>

                {/* Status */}
                <div className="flex items-center gap-2">
                    <span
                        className="w-2 h-2 rounded-full"
                        style={{
                            backgroundColor: statusDotColor,
                            boxShadow: `0 0 8px ${statusDotColor}`
                        }}
                    />
                    <span className="text-xs uppercase tracking-widest font-mono text-white/60">
                        {statusLabel}
                    </span>
                </div>

                {/* Divider */}
                <div className="w-full h-px bg-white/10" />

                {/* Level + XP Bar */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-mono text-white/70">LVL {level}</span>
                        <span className="text-[10px] font-mono text-white/40">
                            {currentXp.toLocaleString()} / {(currentXp + xpToNext).toLocaleString()} XP
                        </span>
                    </div>
                    <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full rounded-full"
                            style={{
                                background: `linear-gradient(to right, ${agent.colorHex}, ${agent.colorHex}40)`
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${xpPercent}%` }}
                            transition={{ duration: 1, ease: 'easeOut' }}
                        />
                    </div>
                </div>

                {/* Streak Badge */}
                {currentStreak > 0 && (
                    <div className="flex items-center gap-2 text-xs font-mono">
                        <Flame size={14} className="text-orange-400" />
                        <span className="text-orange-400/90 tracking-wider">
                            OPS STREAK: {currentStreak} {currentStreak === 1 ? 'DAY' : 'DAYS'}
                        </span>
                    </div>
                )}

                {/* Divider before capabilities */}
                <div className="w-full h-px bg-white/10" />
            </div>

            {/* Agent Capabilities — scrollable */}
            <div className="flex-1 overflow-y-auto min-h-0 identity-scrollbar">
                <AgentCapabilities agent={agent} />
            </div>

            {/* Deploy Button */}
            <div className="flex-shrink-0 p-4 pt-2">
                <button
                    onClick={() => router.push('/chat')}
                    className="w-full py-2.5 rounded-xl text-sm font-bold font-mono tracking-widest uppercase text-center cursor-pointer
                        transition-all duration-300 hover:shadow-[0_0_20px_rgba(255,109,41,0.3)]
                        pointer-events-auto"
                    style={{
                        background: 'var(--accent-base, #FF6D29)',
                        color: '#080706',
                    }}
                >
                    DEPLOY
                </button>
            </div>
        </div>
    );
}
