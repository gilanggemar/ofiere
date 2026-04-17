'use client';

import { memo } from 'react';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { format, isToday as checkIsToday } from 'date-fns';
import { Plus } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';

// ─── Agent color helper ─────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
    'daisy-slack': 'var(--agent-daisy)',
    'ivy-main': 'var(--agent-ivy)',
    'celia-research': 'var(--agent-celia)',
    'thalia-ops': 'var(--agent-thalia)',
    'agent-zero': 'var(--agent-zero)',
};

function getAgentColor(agentId: string | null | undefined): string {
    if (!agentId) return 'var(--accent-base)';
    if (AGENT_COLORS[agentId]) return AGENT_COLORS[agentId];
    // Check partial matches
    const lower = agentId.toLowerCase();
    if (lower.includes('daisy')) return 'var(--agent-daisy)';
    if (lower.includes('ivy')) return 'var(--agent-ivy)';
    if (lower.includes('celia')) return 'var(--agent-celia)';
    if (lower.includes('thalia')) return 'var(--agent-thalia)';
    if (lower.includes('zero')) return 'var(--agent-zero)';
    return 'var(--accent-base)';
}

// ─── Draggable event card wrapper ───────────────────────────────────────────

function DraggableEventCard({ event, agents }: { event: SchedulerEvent; agents: any[] }) {
    const setSelectedEvent = useSchedulerStore((s) => s.setSelectedEvent);
    const agent = agents.find((a: any) => a.id === event.agentId);

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `calendar-event-${event.id}`,
        data: { type: 'calendar-event', event },
    });

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            <TaskCard
                id={event.id}
                title={event.title}
                agentId={event.agentId}
                agentName={agent?.name || event.agentId}
                agentColor={getAgentColor(event.agentId)}
                scheduledTime={event.scheduledTime}
                priority={event.priority}
                status={event.status}
                recurrenceType={event.recurrenceType}
                isCompact
                isDragging={isDragging}
                onClick={() => setSelectedEvent(event.id)}
            />
        </div>
    );
}

// ─── Props ──────────────────────────────────────────────────────────────────

interface DateColumnProps {
    date: Date;
    dateStr: string;
    events: SchedulerEvent[];
    isToday: boolean;
    isWeekend: boolean;
    isMonthStart: boolean;
    isSelected: boolean;
    isDropTarget: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export const DateColumn = memo(function DateColumn({
    date, dateStr, events, isToday, isWeekend,
    isMonthStart, isSelected, isDropTarget,
}: DateColumnProps) {
    const { setNodeRef, isOver } = useDroppable({
        id: `date-${dateStr}`,
        data: { type: 'date-column', date: dateStr },
    });

    const agents = useAvailableAgents();
    const setCreateModalOpen = useSchedulerStore((s) => s.setCreateModalOpen);

    const dayName = format(date, 'EEE');
    const dayNum = format(date, 'd');
    const monthLabel = format(date, 'MMM');

    // Compute day score
    const completedCount = events.filter(e => e.status === 'completed').length;
    const totalCount = events.length;
    const scoreRatio = totalCount > 0 ? completedCount / totalCount : 0;

    const showActive = isDropTarget || isOver;

    return (
        <div
            ref={setNodeRef}
            className={cn(
                'w-36 min-w-[144px] flex-shrink-0 border-r border-white/[0.04] flex flex-col h-full relative group',
                isWeekend && 'bg-white/[0.015]',
                isSelected && 'bg-white/[0.04]',
                showActive && 'bg-[var(--accent-base)]/[0.08] border-2 border-dashed border-[var(--accent-base)]/40',
            )}
        >
            {/* Month boundary separator */}
            {isMonthStart && (
                <div className="absolute -top-0.5 left-0 z-10 border-l-2 border-[var(--accent-base)]/30 h-full pointer-events-none">
                    <span className="absolute -top-5 left-1 ofiere-badge-text text-[var(--accent-base)] bg-[var(--accent-base)]/10 px-1.5 py-0.5 rounded-sm">
                        {monthLabel}
                    </span>
                </div>
            )}

            {/* ─── Column Header ─── */}
            <div
                className={cn(
                    'px-2 py-3 text-center border-b border-white/[0.06] shrink-0',
                    isToday && 'bg-[var(--accent-base)]/10',
                )}
            >
                <div className={cn(
                    'ofiere-caption uppercase',
                    isToday ? 'text-[var(--accent-base)] font-semibold' : 'opacity-50',
                )}>
                    {dayName}
                </div>
                <div className={cn(
                    isToday ? 'ofiere-metric-md text-[var(--accent-base)]' : 'ofiere-body font-medium',
                )}>
                    {dayNum}
                </div>
                {(isMonthStart || isToday) && (
                    <div className="ofiere-caption mt-0.5 opacity-60">{monthLabel}</div>
                )}

                {/* Day score bar (gamification) */}
                {totalCount > 0 && (
                    <div className="mt-1.5 h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                                width: `${scoreRatio * 100}%`,
                                backgroundColor: scoreRatio === 1
                                    ? 'var(--status-online)'
                                    : scoreRatio >= 0.5
                                        ? 'var(--status-warning)'
                                        : 'var(--status-error)',
                            }}
                        />
                    </div>
                )}
            </div>

            {/* ─── Event Area ─── */}
            <div className="flex-1 overflow-y-auto p-1.5 space-y-0">
                {events.slice(0, 5).map((event) => (
                    <DraggableEventCard key={`${event.id}-${event.virtualDate || event.scheduledDate}`} event={event} agents={agents} />
                ))}
                {events.length > 5 && (
                    <div className="ofiere-caption text-center py-1 opacity-60">
                        +{events.length - 5} more
                    </div>
                )}
            </div>

            {/* ─── Quick-add button ─── */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150 p-1 shrink-0">
                <button
                    onClick={() => setCreateModalOpen(true, dateStr)}
                    className="w-full flex items-center justify-center gap-1 py-1 rounded-md text-[var(--accent-base)] hover:bg-[var(--accent-base)]/10 transition-colors ofiere-caption"
                >
                    <Plus className="w-3 h-3" />
                    Add
                </button>
            </div>
        </div>
    );
});
