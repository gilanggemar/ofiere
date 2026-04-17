"use client";

import { useMemo, useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export interface ScheduledTask {
    id: string;
    name: string;
    agentId: string;
    cronExpression?: string;
    nextRun?: Date | string;
    duration?: number; // default: 30
    status: 'scheduled' | 'running' | 'completed' | 'failed';
}

interface SchedulerTimelineProps {
    tasks: ScheduledTask[];
    date?: Date;
    onTaskClick?: (taskId: string) => void;
    className?: string;
}

const getAgentColor = (id: string) => {
    switch (id.toLowerCase()) {
        case 'daisy': return 'oklch(0.78 0.17 135)'; // lime
        case 'ivy': return 'oklch(0.72 0.14 195)'; // teal
        case 'celia': return 'oklch(0.55 0.14 290)'; // violet
        case 'thalia': return 'oklch(0.65 0.19 25)'; // coral
        case 'agent-zero': return 'oklch(0.55 0.15 232)'; // blue
        default: return 'oklch(0.72 0.18 52)';
    }
};

const getAgentName = (id: string) => {
    switch (id.toLowerCase()) {
        case 'agent-zero': return 'Agent Zero';
        default: return id.charAt(0).toUpperCase() + id.slice(1);
    }
};

// Returns an array of start times (in hours 0-24) based on the cron expression
const parseCronToHours = (cron?: string, nextRun?: Date | string): number[] => {
    if (!cron) {
        if (!nextRun) return [];
        const date = new Date(nextRun);
        return [date.getHours() + date.getMinutes() / 60];
    }

    // Split standard 5-part cron: min hour dom mon dow
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return [];

    const min = parts[0];
    const hour = parts[1];

    const minVal = min.includes('*/') ? 0 : (parseInt(min) || 0);

    // "0 */N * * *"
    if (hour.startsWith('*/')) {
        const interval = parseInt(hour.replace('*/', '')) || 1;
        const hours: number[] = [];
        for (let i = 0; i < 24; i += interval) {
            hours.push(i + minVal / 60);
        }
        return hours;
    }

    // "0 H1,H2 * * *"
    if (hour.includes(',')) {
        return hour.split(',').map(h => parseInt(h) + minVal / 60).filter(h => !isNaN(h));
    }

    // "0 H * * *"
    if (hour !== '*' && !isNaN(parseInt(hour))) {
        return [parseInt(hour) + minVal / 60];
    }

    // "*/M * * * *" -> every M minutes (we'll just plot it at every hour for simplicity, or 24 blocks)
    if (min.startsWith('*/')) {
        const intervalMins = parseInt(min.replace('*/', '')) || 5;
        const runs: number[] = [];
        for (let i = 0; i < 24; i++) {
            for (let j = 0; j < 60; j += intervalMins) {
                runs.push(i + j / 60);
            }
        }
        return runs;
    }

    // Fallback to nextRun
    if (nextRun) {
        const date = new Date(nextRun);
        return [date.getHours() + date.getMinutes() / 60];
    }

    return [];
};

export default function SchedulerTimeline({
    tasks,
    date = new Date(),
    onTaskClick,
    className = ""
}: SchedulerTimelineProps) {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000); // update every minute
        return () => clearInterval(timer);
    }, []);

    // Is the displayed date today?
    const isToday = now.toDateString() === date.toDateString();
    const currentHourFraction = now.getHours() + now.getMinutes() / 60;

    // Calculate relative position (0 to 100%)
    const percentageAt = (hourFraction: number) => `${(hourFraction / 24) * 100}%`;

    // Group tasks by agent
    const agentTasks = useMemo(() => {
        const map = new Map<string, { agentId: string, occurrences: { task: ScheduledTask, startH: number, durationH: number }[] }>();

        tasks.forEach(task => {
            if (!map.has(task.agentId)) {
                map.set(task.agentId, { agentId: task.agentId, occurrences: [] });
            }

            const starts = parseCronToHours(task.cronExpression, task.nextRun);
            const durationH = (task.duration || 30) / 60;

            starts.forEach(start => {
                map.get(task.agentId)!.occurrences.push({
                    task,
                    startH: start,
                    durationH
                });
            });
        });
        // Return as array
        return Array.from(map.values());
    }, [tasks]);

    // Find next upcoming task
    const nextTask = useMemo(() => {
        if (!isToday) return null;
        let closest: { task: ScheduledTask, waitTimeMins: number } | null = null;

        const currentMins = now.getHours() * 60 + now.getMinutes();

        tasks.forEach(task => {
            const starts = parseCronToHours(task.cronExpression, task.nextRun);
            starts.forEach(start => {
                const startMins = start * 60;
                if (startMins >= currentMins) {
                    const wait = startMins - currentMins;
                    if (!closest || wait < closest.waitTimeMins) {
                        closest = { task, waitTimeMins: wait };
                    }
                } else if (startMins + (task.duration || 30) > currentMins) {
                    // Currently running
                    if (!closest || closest.waitTimeMins > 0) {
                        closest = { task, waitTimeMins: 0 };
                    }
                }
            });
        });
        return closest as { task: ScheduledTask, waitTimeMins: number } | null;
    }, [tasks, now, isToday]);

    const formatWaitTime = (mins: number) => {
        if (mins === 0) return "in progress";
        const h = Math.floor(mins / 60);
        const m = Math.floor(mins % 60);
        return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
    };

    const getStatusOpacity = (status: string) => {
        if (status === 'completed') return 0.4;
        if (status === 'failed') return 0.5;
        return 0.7; // scheduled or running
    };

    const hours = Array.from({ length: 13 }, (_, i) => i * 2); // 0, 2, 4...24

    return (
        <div className={`rounded-md border border-border bg-card p-4 ${className}`}>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h3 className="ofiere-section text-muted-foreground">Schedule Timeline</h3>
                <span className="ofiere-caption">{date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>

            {tasks.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-border/50 rounded-lg flex items-center justify-center">
                    <span className="text-muted-foreground ofiere-body-sm">No scheduled tasks</span>
                </div>
            ) : (
                <div className="relative">
                    {/* Timeline Container (horizontal scroll on mobile) */}
                    <div className="overflow-x-auto pb-4">
                        <div className="min-w-[600px] flex">

                            {/* Left: Agent Labels */}
                            <div className="w-[100px] flex-shrink-0 flex flex-col pt-8">
                                {agentTasks.map(({ agentId, occurrences }) => (
                                    <div key={agentId} className="h-10 relative flex items-center gap-2 pr-4">
                                        <div
                                            className="w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]"
                                            style={{ backgroundColor: getAgentColor(agentId), color: getAgentColor(agentId) }}
                                        />
                                        <span className={`ofiere-body-sm truncate ${occurrences.length === 0 ? 'opacity-30' : ''}`}>
                                            {getAgentName(agentId)}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Right: Timeline Grid */}
                            <div className="relative flex-grow">
                                {/* Axis labels & grid lines */}
                                <div className="absolute top-0 left-0 right-0 h-6 border-b border-border/30 flex text-muted-foreground text-[10px] items-center">
                                    {hours.map(h => (
                                        <div
                                            key={h}
                                            className="absolute whitespace-nowrap -translate-x-1/2"
                                            style={{ left: percentageAt(h) }}
                                        >
                                            {h.toString().padStart(2, '0')}
                                        </div>
                                    ))}
                                </div>

                                {/* Vertical faint grid ticks */}
                                {hours.map(h => (
                                    <div
                                        key={`tick-${h}`}
                                        className="absolute top-6 bottom-0 w-px bg-[oklch(1_0_0/0.06)] -translate-x-1/2"
                                        style={{ left: percentageAt(h) }}
                                    />
                                ))}

                                {/* Tasks Rows */}
                                <div className="pt-8 flex flex-col">
                                    {agentTasks.map(({ agentId, occurrences }) => (
                                        <div key={agentId} className="h-10 relative border-b border-border/10 last:border-0 group">
                                            {/* Background hover highlight for the whole row */}
                                            <div className="absolute inset-x-0 inset-y-1 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity rounded-sm pointer-events-none" />

                                            {occurrences.map((occ, idx) => {
                                                const isEndBeforeStart = occ.startH + occ.durationH > 24;
                                                const widthPct = Math.min((occ.durationH / 24) * 100, 100 - (occ.startH / 24) * 100);

                                                return (
                                                    <motion.div
                                                        key={`${occ.task.id}-${idx}`}
                                                        whileHover={{ scale: 1.02, zIndex: 10, opacity: 1 }}
                                                        onClick={() => onTaskClick?.(occ.task.id)}
                                                        className="absolute top-2 h-6 rounded-md cursor-pointer overflow-hidden border transition-all flex items-center px-1"
                                                        style={{
                                                            left: percentageAt(occ.startH),
                                                            width: `${widthPct}%`,
                                                            backgroundColor: getAgentColor(agentId),
                                                            borderColor: getAgentColor(agentId),
                                                            opacity: getStatusOpacity(occ.task.status),
                                                            minWidth: '4px' // prevent zero-width ticks
                                                        }}
                                                        title={`${occ.task.name} (${occ.durationH * 60}m) - ${occ.task.status}`}
                                                    >
                                                        {/* Text inside block only if wide enough */}
                                                        {(widthPct > 8) && (
                                                            <span className="text-[10px] text-white/90 truncate font-medium">
                                                                {occ.task.name}
                                                            </span>
                                                        )}
                                                    </motion.div>
                                                );
                                            })}

                                            {/* Handle wrap-around tasks (cross midnight) optionally. Skipping for simplicity unless needed. */}
                                        </div>
                                    ))}
                                </div>

                                {/* Current Time Line (Now) */}
                                {isToday && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="absolute top-0 bottom-0 pointer-events-none z-10"
                                        style={{
                                            left: percentageAt(currentHourFraction),
                                            borderLeft: '2px dashed var(--accent-base)'
                                        }}
                                    >
                                        <div className="-translate-x-1/2 -mt-4 bg-[var(--accent-base)] text-background text-[9px] font-bold px-1.5 py-0.5 rounded">
                                            NOW
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Next Up Footer */}
                    {isToday && nextTask && (
                        <div className="mt-4 pt-3 border-t border-border/30 flex items-center text-sm">
                            <span className="text-muted-foreground mr-2">Next up:</span>
                            <span className="font-medium" style={{ color: getAgentColor(nextTask.task.agentId) }}>
                                {nextTask.task.name}
                            </span>
                            <span className="text-muted-foreground ml-2">
                                {formatWaitTime(nextTask.waitTimeMins)}
                            </span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
