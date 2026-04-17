import React, { memo, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export interface OperationsStreakProps {
    currentStreak: number;
    longestStreak: number;
    todayComplete: boolean;
    last7Days: boolean[];
    className?: string;
}

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export const OperationsStreak = memo(({
    currentStreak,
    longestStreak,
    todayComplete,
    last7Days,
    className
}: OperationsStreakProps) => {
    const [justIncremented, setJustIncremented] = useState(false);
    const prevStreakRef = useRef(currentStreak);

    useEffect(() => {
        if (currentStreak > prevStreakRef.current) {
            setJustIncremented(true);
            const timer = setTimeout(() => setJustIncremented(false), 1000);
            return () => clearTimeout(timer);
        }
        prevStreakRef.current = currentStreak;
    }, [currentStreak]);

    const today = new Date().getDay();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const daysAgo = 6 - i;
        const dayIndex = (today - daysAgo + 7) % 7;
        return DAYS[dayIndex];
    });

    const isEmpty = currentStreak === 0;
    const isBest = currentStreak === longestStreak && currentStreak > 0;
    const isMilestone = [7, 14, 30, 50, 100].includes(currentStreak);
    const particles = Array.from({ length: 5 });

    return (
        <TooltipProvider delayDuration={200}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex flex-col gap-3 font-sans w-fit", className)}>

                        {/* MAIN ROW */}
                        <div className="flex items-center gap-3">
                            {/* Flame Icon Container */}
                            <div className="relative flex items-center justify-center w-10 h-10">
                                {/* Milestone Particles */}
                                {isMilestone && (
                                    <motion.div
                                        className="absolute inset-x-[-10px] inset-y-[-10px] pointer-events-none"
                                        animate={{ rotate: 360 }}
                                        transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                    >
                                        {particles.map((_, i) => {
                                            const angle = (i / particles.length) * Math.PI * 2;
                                            const radius = 22;
                                            const x = Math.cos(angle) * radius;
                                            const y = Math.sin(angle) * radius;
                                            return (
                                                <div
                                                    key={i}
                                                    className="absolute w-[3px] h-[3px] rounded-full"
                                                    style={{
                                                        backgroundColor: 'var(--accent-base)',
                                                        top: '50%',
                                                        left: '50%',
                                                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                                                    }}
                                                />
                                            );
                                        })}
                                    </motion.div>
                                )}

                                {/* The Flame itself */}
                                <motion.div
                                    className="rounded-full flex items-center justify-center"
                                    animate={{
                                        boxShadow: todayComplete
                                            ? ['0 0 0px rgba(var(--accent-base-rgb), 0)', '0 0 12px rgba(var(--accent-base-rgb), 0.4)', '0 0 0px rgba(var(--accent-base-rgb), 0)']
                                            : 'none',
                                        scale: todayComplete ? [1.0, 1.08, 1.0] : 1.0
                                    }}
                                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                                    style={{
                                        color: todayComplete ? 'var(--accent-base)' : 'var(--status-offline)',
                                        opacity: todayComplete ? 1 : 0.4
                                    }}
                                >
                                    <Flame size={28} />
                                </motion.div>
                            </div>

                            {/* Counter Text */}
                            <div className="flex items-baseline gap-2">
                                <motion.span
                                    className="ofiere-metric-xl tabular-nums leading-none"
                                    style={{ color: currentStreak > 0 ? 'var(--accent-base)' : 'var(--foreground)' }}
                                    animate={justIncremented ? { scale: [1, 1.2, 1] } : { scale: 1 }}
                                    transition={{ duration: 0.3 }}
                                >
                                    {currentStreak}
                                </motion.span>
                                <span className="ofiere-body-sm opacity-50 relative top-[-2px]">
                                    {currentStreak === 1 ? 'day streak' : 'days streak'}
                                </span>
                            </div>
                        </div>

                        {/* WEEK DOTS ROW */}
                        <div className="flex flex-col gap-1.5 pl-1.5">
                            <div className="flex items-center gap-1.5">
                                {last7Days.map((isDayComplete, i) => {
                                    const isToday = i === 6;

                                    // The last dot (index 6, today):
                                    // If todayComplete: filled with var(--accent-lime)
                                    // If not todayComplete: pulsing ring animation
                                    if (isToday) {
                                        if (todayComplete) {
                                            return (
                                                <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-lime)' }} />
                                            );
                                        } else {
                                            return (
                                                <div key={i} className="relative flex items-center justify-center w-2 h-2">
                                                    <div className="w-[6px] h-[6px] rounded-full bg-foreground/20 absolute" />
                                                    <motion.div
                                                        className="absolute rounded-full border border-foreground/50"
                                                        initial={{ width: 6, height: 6, opacity: 0.8 }}
                                                        animate={{ width: 14, height: 14, opacity: 0 }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
                                                    />
                                                </div>
                                            );
                                        }
                                    }

                                    // Past days
                                    if (isDayComplete) {
                                        return <div key={i} className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--accent-base)' }} />;
                                    } else {
                                        return <div key={i} className="w-2 h-2 rounded-full border border-[var(--status-offline)] opacity-50" />;
                                    }
                                })}
                            </div>

                            <div className="flex items-center gap-1.5 relative left-[-2px]">
                                {weekDays.map((day, i) => (
                                    <span key={i} className="ofiere-caption opacity-40 w-[10px] text-center" style={{ fontSize: '9px' }}>
                                        {day}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* BEST STREAK ROW */}
                        {!isEmpty && (
                            <div className="pl-1.5 mt-1">
                                {isBest ? (
                                    <span className="ofiere-caption" style={{ color: 'var(--accent-lime)' }}>
                                        🏆 Personal best!
                                    </span>
                                ) : (longestStreak > currentStreak && (
                                    <span className="ofiere-caption opacity-50">
                                        Best: {longestStreak} days
                                    </span>
                                ))}
                            </div>
                        )}

                        {isEmpty && (
                            <div className="pl-1.5 mt-1">
                                <span className="ofiere-caption opacity-50">
                                    Start a new streak by completing all tasks today
                                </span>
                            </div>
                        )}

                    </div>
                </TooltipTrigger>
                <TooltipContent side="top" align="center" className="flex flex-col gap-1 p-2 max-w-[200px]">
                    <p className="font-semibold text-sm">Operations Streak: {currentStreak} days</p>
                    <p className="text-xs opacity-80">All scheduled tasks must complete without errors to maintain the streak.</p>
                    <p className="text-xs opacity-60 mt-1">Longest streak: {longestStreak} days</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
});

OperationsStreak.displayName = 'OperationsStreak';
export default OperationsStreak;
