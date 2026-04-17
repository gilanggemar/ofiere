import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Zap, CheckCircle2, Handshake, Gauge, Flame, Trophy, Radio, Moon, Shield, Sparkles } from 'lucide-react';
import { getAchievementById, Achievement, getRarityLabel } from '@/lib/achievements';
import { cn } from '@/lib/utils';

export function showAchievement(achievementId: string): void {
    const achievement = getAchievementById(achievementId);
    if (!achievement) return;

    toast.custom((t) => <AchievementToastContent id={t} achievement={achievement} />, {
        duration: 5000,
        position: 'top-center',
    });
}

const iconMap: Record<string, React.ElementType> = {
    Zap, CheckCircle2, Handshake, Gauge, Flame, Trophy, Radio, Moon, Shield, Sparkles
};

export const AchievementToastContent = ({ id, achievement }: { id: string | number, achievement: Achievement }) => {
    const IconComponent = iconMap[achievement.icon] || Zap;
    const isLegendary = achievement.rarity === 'legendary';
    const isEpic = achievement.rarity === 'epic';

    const duration = 5000;

    return (
        <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            className="relative flex flex-col w-full min-w-[340px] max-w-[420px] p-4 rounded-md border border-white/10 bg-background/80 backdrop-blur-md shadow-lg overflow-hidden"
            style={{ borderLeft: `3px solid ${achievement.color}` }}
        >
            {/* Epic Flash Overlay */}
            {isEpic && (
                <motion.div
                    initial={{ opacity: 0.15 }}
                    animate={{ opacity: 0 }}
                    transition={{ duration: 0.4, ease: "easeOut" }}
                    className="absolute inset-0 pointer-events-none"
                    style={{ backgroundColor: achievement.color }}
                />
            )}

            {/* Legendary Particles */}
            {isLegendary && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                    {[...Array(4)].map((_, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0.6, y: 0 }}
                            animate={{ opacity: 0, y: -20 }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: i * 0.5,
                                ease: "linear"
                            }}
                            className="absolute w-[3px] h-[3px] rounded-full"
                            style={{
                                backgroundColor: achievement.color,
                                left: `${20 + i * 20}%`,
                                bottom: '10%'
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Label */}
            <div
                className="ofiere-badge-text mb-2 text-[10px] uppercase tracking-wider font-bold"
                style={{ color: achievement.color }}
            >
                {getRarityLabel(achievement.rarity)}
            </div>

            {/* Icon + Title */}
            <div className="flex items-center gap-3 relative z-10">
                <IconComponent size={24} style={{ color: achievement.color }} className="shrink-0" />
                <div>
                    <h2 className="text-[22px] font-semibold tracking-tight text-foreground leading-none">
                        {achievement.title}
                    </h2>
                    <p className="ofiere-body-sm opacity-60 mt-1 pb-1">
                        {achievement.description}
                    </p>
                </div>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-[3px] rounded-full mt-3 overflow-hidden relative">
                <div
                    className="absolute inset-0"
                    style={{ backgroundColor: achievement.color, opacity: 0.15 }}
                />
                <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: duration / 1000, ease: 'linear' }}
                    className="absolute left-0 top-0 bottom-0"
                    style={{ backgroundColor: achievement.color }}
                />
            </div>
        </motion.div>
    );
};
