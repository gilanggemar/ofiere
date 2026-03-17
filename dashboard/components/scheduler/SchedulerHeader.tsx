'use client';

import { useMemo } from 'react';
import { format, addWeeks, addDays } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSchedulerStore } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { AgentAvatar } from '@/components/agents/AgentAvatar';

// ─── Agent color helper ─────────────────────────────────────────────────────

function getAgentColor(agentId: string | null | undefined): string {
    if (!agentId) return 'var(--accent-base)';
    const lower = agentId.toLowerCase();
    if (lower.includes('daisy')) return 'var(--agent-daisy)';
    if (lower.includes('ivy')) return 'var(--agent-ivy)';
    if (lower.includes('celia')) return 'var(--agent-celia)';
    if (lower.includes('thalia')) return 'var(--agent-thalia)';
    if (lower.includes('zero')) return 'var(--agent-zero)';
    return 'var(--accent-base)';
}

// ─── Component ──────────────────────────────────────────────────────────────

export function SchedulerHeader() {
    const {
        viewStartDate, viewRangeWeeks, filterAgentIds, events,
        scrollForward, scrollBackward, scrollToToday,
        setViewRange, toggleAgentFilter, setCreateModalOpen,
    } = useSchedulerStore();

    const socketAgents = useAvailableAgents();

    // Fallback agents when WebSocket hasn't connected yet
    const FALLBACK_AGENTS = useMemo(() => [
        { id: 'daisy', name: 'Daisy' },
        { id: 'ivy', name: 'Ivy' },
        { id: 'celia', name: 'Celia' },
        { id: 'thalia', name: 'Thalia' },
    ], []);
    const agentList = socketAgents.length > 0 ? socketAgents : FALLBACK_AGENTS;

    // Compute date range label
    const rangeLabel = useMemo(() => {
        const endDate = addDays(addWeeks(viewStartDate, viewRangeWeeks), -1);
        const startStr = format(viewStartDate, 'MMM d');
        const endStr = format(endDate, 'MMM d, yyyy');
        return `${startStr} — ${endStr}`;
    }, [viewStartDate, viewRangeWeeks]);

    // Compute streak
    const streak = useMemo(() => {
        const completedDates = new Set(
            events
                .filter(e => e.status === 'completed')
                .map(e => e.virtualDate || e.scheduledDate)
        );
        if (completedDates.size === 0) return 0;

        // Count consecutive days from today backwards
        let count = 0;
        let cursor = new Date();
        for (let i = 0; i < 365; i++) {
            const key = format(cursor, 'yyyy-MM-dd');
            if (completedDates.has(key)) {
                count++;
                cursor = addDays(cursor, -1);
            } else if (i === 0) {
                // Today might not be done yet — check yesterday
                cursor = addDays(cursor, -1);
                continue;
            } else {
                break;
            }
        }
        return count;
    }, [events]);

    const viewRanges = [
        { label: '2W', value: 2 },
        { label: '4W', value: 4 },
        { label: '8W', value: 8 },
    ];

    return (
        <div className="nerv-glass-2 sticky top-0 z-10 px-6 py-3 border-b border-white/[0.06]">
            {/* ─── Top Row ─── */}
            <div className="flex items-center justify-between gap-4">
                {/* Left: Title */}
                <div className="flex items-center gap-3">
                    <CalendarDays className="w-5 h-5 text-[var(--accent-base)]" />
                    <h1 className="nerv-h2">Mission Scheduler</h1>
                    {/* Streak badge */}
                    {streak > 0 && (
                        <span className="bg-[var(--accent-base)]/20 text-[var(--accent-base)] rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5" />
                            {streak}-day streak
                        </span>
                    )}
                </div>

                {/* Center: Navigation */}
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToToday()}
                        className="rounded-full text-xs h-7 px-3"
                    >
                        Today
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => scrollBackward(1)}
                        className="h-7 w-7 rounded-full"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="nerv-body-sm font-medium min-w-[180px] text-center">
                        {rangeLabel}
                    </span>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => scrollForward(1)}
                        className="h-7 w-7 rounded-full"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </Button>
                </div>

                {/* Right: View range */}
                <div className="flex items-center gap-2">
                    <div className="flex items-center rounded-full bg-white/[0.04] p-0.5">
                        {viewRanges.map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setViewRange(value)}
                                className={cn(
                                    'px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150',
                                    viewRangeWeeks === value
                                        ? 'bg-[var(--accent-base)] text-[var(--text-on-accent)]'
                                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]',
                                )}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── Agent Filter Pills ─── */}
            {agentList.length > 0 && (
                <div className="flex items-center gap-2 mt-2.5 overflow-x-auto scrollbar-hide">
                    {agentList.map((agent: any) => {
                        const isActive = filterAgentIds.includes(agent.id);
                        const color = getAgentColor(agent.id);
                        return (
                            <button
                                key={agent.id}
                                onClick={() => toggleAgentFilter(agent.id)}
                                className={cn(
                                    'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 shrink-0',
                                    isActive
                                        ? 'text-white'
                                        : 'nerv-glass-1 opacity-60 hover:opacity-100',
                                )}
                                style={isActive ? { backgroundColor: color } : undefined}
                            >
                                <AgentAvatar
                                    agentId={agent.id}
                                    size={20}
                                    showStatus={false}
                                />
                                {agent.name}
                            </button>
                        );
                    })}
                    {filterAgentIds.length > 0 && (
                        <button
                            onClick={() => useSchedulerStore.getState().clearAgentFilters()}
                            className="nerv-caption px-2 py-1 rounded-full hover:bg-white/[0.06] transition-colors"
                        >
                            Clear
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
