"use client";

import React, { useEffect } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Zap, CheckCircle2, Target, Users } from 'lucide-react';
import { useOverviewData } from '@/hooks/useOverviewData';
import { staggerContainer, fadeInUp } from '@/lib/animations';
import { cn } from '@/lib/utils';

const AnimatedNumber = ({ value }: { value: number }) => {
    const raw = useMotionValue(0);
    const display = useTransform(raw, Math.round);

    useEffect(() => {
        const animation = animate(raw, value, { duration: 1.5, ease: "easeOut" });
        return animation.stop;
    }, [value, raw]);

    return <motion.span>{display}</motion.span>;
};

const TinySparkline = ({ color }: { color: string }) => {
    // Generate a simple jagged SVG path on client-side to prevent hydration mismatch
    const [points, setPoints] = React.useState("");

    React.useEffect(() => {
        setPoints(Array.from({ length: 6 }).map((_, i) => `${i * 12},${Math.random() * 16 + 4}`).join(' L '));
    }, []);

    // Provide a static fallback for SSR
    const fallback = "10,12 L 20,16 L 30,8 L 40,14 L 50,10";

    return (
        <svg width="60" height="24" className="opacity-40 transition-opacity duration-300 group-hover:opacity-100">
            <path d={`M 0,20 L ${points || fallback} L 60,20`} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
};

export function HeroMetrics() {
    const { metrics } = useOverviewData();

    const cards = [
        { id: 'active', label: 'Active Tasks', value: metrics.activeTasks, icon: Zap, color: 'var(--accent-base)' },
        { id: 'completed', label: 'Completed Today', value: metrics.completedToday, icon: CheckCircle2, color: 'var(--status-online)' },
        { id: 'success', label: 'Success Rate', value: metrics.successRate, icon: Target, color: 'var(--accent-teal)', suffix: '%' },
        { id: 'online', label: 'Agents Online', value: metrics.agentsOnline, icon: Users, color: 'var(--accent-violet)' },
    ];

    return (
        <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"
        >
            {cards.map((card) => (
                <motion.div
                    key={card.id}
                    variants={fadeInUp}
                    whileHover={{ translateY: -2 }}
                    className="group ofiere-glass-2 rounded-md p-4 flex flex-col relative overflow-hidden transition-all duration-300"
                    style={{ '--hover-border-color': card.color } as React.CSSProperties}
                >
                    <div className="absolute inset-0 border-2 border-transparent group-hover:border-[var(--hover-border-color)] opacity-0 group-hover:opacity-30 rounded-md transition-all duration-300 pointer-events-none" />

                    <div className="flex justify-between items-start mb-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `color-mix(in srgb, ${card.color} 20%, transparent)` }}>
                            <card.icon size={16} style={{ color: card.color }} />
                        </div>
                        <TinySparkline color={card.color} />
                    </div>

                    <div className="mt-2">
                        <div className="ofiere-metric-xl" style={{ color: card.color }}>
                            <AnimatedNumber value={card.value} />
                            {card.suffix && <span className="text-xl ml-1">{card.suffix}</span>}
                        </div>
                        <div className="ofiere-section mt-1">
                            {card.label}
                        </div>
                    </div>
                </motion.div>
            ))}
        </motion.div>
    );
}
