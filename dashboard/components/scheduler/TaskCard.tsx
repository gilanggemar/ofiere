'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Repeat, Check, X, Flame, Clock } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TaskCardProps {
    id: string;
    title: string;
    agentId: string;
    agentName: string;
    agentColor: string;
    scheduledTime?: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled' | 'PENDING';
    recurrenceType?: string;
    description?: string | null;
    isCompact?: boolean;
    isDragging?: boolean;
    onClick?: () => void;
}

// ─── Priority dot colors ────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
    low: 'var(--accent-lime)',
    medium: 'var(--accent-ocean)',
    high: 'var(--status-warning)',
    critical: 'var(--status-error)',
    LOW: 'var(--accent-lime)',
    MEDIUM: 'var(--accent-ocean)',
    HIGH: 'var(--status-warning)',
    CRITICAL: 'var(--status-error)',
};

// ─── Recurrence label helper ────────────────────────────────────────────────

function getRecurrenceLabel(type?: string): string {
    switch (type) {
        case 'hourly': return 'Hourly';
        case 'daily': return 'Daily';
        case 'weekly': return 'Weekly';
        case 'monthly': return 'Monthly';
        case 'custom': return 'Custom';
        default: return '';
    }
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TaskCard({
    title, agentName, agentColor, scheduledTime, priority,
    status, recurrenceType, description, isCompact = false,
    isDragging = false, onClick,
}: TaskCardProps) {
    const priorityColor = PRIORITY_COLORS[priority] || PRIORITY_COLORS.medium;
    const isRecurring = recurrenceType && recurrenceType !== 'none';

    return (
        <motion.div
            onClick={onClick}
            whileHover={!isDragging ? { scale: 1.02 } : undefined}
            className={cn(
                'transition-all duration-150 cursor-grab active:cursor-grabbing select-none',
                isCompact
                    ? 'rounded-lg p-2 mb-1.5'
                    : 'rounded-md p-2 mb-1.5',
                isDragging && 'opacity-50 border-dashed',
            )}
            style={{
                border: `1px solid oklch(0.75 0.18 55 / ${isDragging ? '0.15' : '0.12'})`,
                background: isDragging
                    ? 'oklch(0.12 0.01 55 / 0.5)'
                    : 'linear-gradient(135deg, oklch(0.12 0.015 55 / 0.8) 0%, oklch(0.10 0.008 30 / 0.7) 50%, oklch(0.11 0.012 55 / 0.6) 100%)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
            }}
        >
            {/* ─── Compact mode (calendar column) ─── */}
            {isCompact ? (
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                        <span className="hecate-body-sm font-medium truncate flex-1">
                            {title}
                        </span>
                        {/* Status indicator */}
                        {status === 'running' && (
                            <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-pulse shrink-0" />
                        )}
                        {status === 'completed' && (
                            <Check className="w-3 h-3 shrink-0" style={{ color: 'var(--status-online)' }} />
                        )}
                        {status === 'failed' && (
                            <X className="w-3 h-3 shrink-0" style={{ color: 'var(--status-error)' }} />
                        )}
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="hecate-caption truncate">{agentName}</span>
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: priorityColor }}
                        />
                    </div>
                    {scheduledTime && (
                        <div className="flex items-center gap-1 mt-0.5">
                            <Clock className="w-2.5 h-2.5 opacity-40" />
                            <span className="hecate-mono-sm opacity-60">{scheduledTime}</span>
                        </div>
                    )}
                    {isRecurring && (
                        <TooltipProvider delayDuration={200}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Repeat className="w-3 h-3 opacity-40 mt-0.5" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="hecate-glass-3">
                                    {getRecurrenceLabel(recurrenceType)}
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    )}
                </div>
            ) : (
                /* ─── Full mode (tray) — compact ─── */
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                        <span className="hecate-body-sm font-medium truncate flex-1">
                            {title}
                        </span>
                        {status === 'running' && (
                            <span className="w-2 h-2 rounded-full bg-[var(--status-online)] animate-pulse shrink-0" />
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: agentColor }}
                        />
                        <span className="hecate-caption opacity-70 truncate">{agentName}</span>
                        <span className="text-white/20">·</span>
                        <span
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: priorityColor }}
                        />
                        <span className="hecate-caption capitalize">{priority}</span>
                        {isRecurring && (
                            <span className="flex items-center gap-0.5 hecate-caption opacity-50">
                                <Repeat className="w-2.5 h-2.5" />
                            </span>
                        )}
                    </div>
                </div>
            )}
        </motion.div>
    );
}
