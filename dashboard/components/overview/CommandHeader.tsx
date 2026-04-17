"use client";

import React, { useEffect, useState } from 'react';
import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import { Zap } from 'lucide-react';
import { useOverviewData } from '@/hooks/useOverviewData';
import { SystemHealthBar } from '@/components/SystemHealthBar';
import { useAgentStore } from '@/store/useAgentStore';
import { useTaskStore } from '@/store/useTaskStore';
import { useAgentSettingsStore } from '@/store/useAgentSettingsStore';

export function CommandHeader() {
    const { fleetPowerScore } = useOverviewData();
    const { agents } = useAgentStore();
    const { tasks } = useTaskStore();
    const { hiddenAgentIds } = useAgentSettingsStore();
    const [timeStr, setTimeStr] = useState('');

    const countRaw = useMotionValue(0);
    const count = useTransform(countRaw, Math.round);

    useEffect(() => {
        const animation = animate(countRaw, fleetPowerScore, { duration: 2, ease: "easeOut" });
        return animation.stop;
    }, [fleetPowerScore, countRaw]);

    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            const str = now.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase() + ' · ' + now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'UTC' }) + ' UTC';
            setTimeStr(str);
        };
        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full h-14 ofiere-glass-1 border-b border-border/40 flex items-center justify-between px-6 sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center ofiere-glow-border">
                    <Zap size={16} className="text-accent" />
                </div>
                <div className="flex items-baseline gap-2">
                    <span className="text-xs text-muted-foreground uppercase tracking-widest font-semibold">Fleet Power</span>
                    <motion.span className="ofiere-power-score text-2xl relative">
                        {count}
                    </motion.span>
                </div>
            </div>

            <div className="flex items-center justify-center flex-1">
                <div className="scale-90 opacity-90">
                    <SystemHealthBar agents={Object.values(agents)
                        .filter(a => !hiddenAgentIds.includes(a.id))
                        .map(a => ({
                            id: a.id,
                            name: a.name,
                            isOnline: a.status === 'ONLINE' || a.status === 'WORKING',
                            hasError: false,
                            activeTasks: Object.values(tasks).filter(t => t.status === "IN_PROGRESS" && t.agentId === a.id).length
                        }))} />
                </div>
            </div>

            <div className="flex items-center">
                <span className="ofiere-mono text-muted-foreground/80 text-[11px] tracking-wider">
                    {timeStr}
                </span>
            </div>
        </div>
    );
}
