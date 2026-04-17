'use client';

import { useEffect, useMemo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import {
    DndContext, DragOverlay, PointerSensor,
    useSensor, useSensors, useDraggable,
    type DragStartEvent,
    type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { addWeeks, addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight, Flame, Search, InboxIcon, GitBranch, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { usePMStore } from '@/store/usePMStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { useWorkflowStore } from '@/store/useWorkflowStore';
import type { Task } from '@/lib/useTaskStore';
import type { PMTask } from '@/lib/pm/types';
import type { Workflow } from '@/lib/workflows/types';

/* ── Lazy-loaded scheduler sub-components ──────────────────────────────── */

const CalendarTimeline = dynamic(
    () => import('@/components/scheduler/CalendarTimeline').then(mod => mod.CalendarTimeline),
    {
        ssr: false,
        loading: () => (
            <div className="flex-1 flex items-center justify-center animate-pulse text-muted-foreground text-xs">
                Loading calendar…
            </div>
        ),
    }
);

const TaskCard = dynamic(
    () => import('@/components/scheduler/TaskCard').then(mod => mod.TaskCard),
    { ssr: false }
);

const EventDetailPanel = dynamic(
    () => import('@/components/scheduler/EventDetailPanel').then(mod => mod.EventDetailPanel),
    { ssr: false }
);

const CreateEventModal = dynamic(
    () => import('@/components/scheduler/CreateEventModal').then(mod => mod.CreateEventModal),
    { ssr: false }
);

/* ── Agent colour helper ───────────────────────────────────────────────── */

function getAgentColor(agentId: string | null | undefined): string {
    if (!agentId) return 'var(--accent-base)';
    const lower = agentId.toLowerCase();
    if (lower.includes('daisy'))  return 'var(--agent-daisy)';
    if (lower.includes('ivy'))    return 'var(--agent-ivy)';
    if (lower.includes('celia'))  return 'var(--agent-celia)';
    if (lower.includes('thalia')) return 'var(--agent-thalia)';
    if (lower.includes('zero'))   return 'var(--agent-zero)';
    return 'var(--accent-base)';
}

/* ── Priority label map (PM tasks use numeric priorities) ──────────────── */

const PRIORITY_MAP: Record<number, string> = {
    0: 'low',
    1: 'medium',
    2: 'high',
    3: 'critical',
};

/* ── Draggable PM task wrapper ─────────────────────────────────────────── */

function DraggablePMTask({ task }: { task: PMTask }) {
    const agents = useAvailableAgents();
    const agent = agents.find((a: any) => a.id === task.agent_id);
    const priorityLabel = PRIORITY_MAP[task.priority] || 'medium';

    // Adapt PMTask → draggable data shape expected by DnD handlers
    const adaptedTask: Task = {
        id: task.id,
        title: task.title,
        description: task.description || undefined,
        agentId: task.agent_id || '',
        status: task.status as any,
        priority: priorityLabel.toUpperCase() as any,
        updatedAt: Date.now(),
        timestamp: task.updated_at,
    };

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `tray-${task.id}`,
        data: { type: 'tray-task', task: adaptedTask },
    });

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            <TaskCard
                id={task.id}
                title={task.title}
                agentId={task.agent_id || ''}
                agentName={agent?.name || task.agent_id || 'Unassigned'}
                agentColor={getAgentColor(task.agent_id)}
                priority={priorityLabel as any}
                status="PENDING"
                description={task.description}
                isDragging={isDragging}
                isCompact={false}
            />
        </div>
    );
}

/* ── Draggable workflow wrapper ─────────────────────────────────────────── */

function DraggableWorkflowCard({ workflow }: { workflow: any }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `tray-wf-${workflow.id}`,
        data: { type: 'tray-workflow', workflow },
    });

    const stepCount = workflow.steps?.length || workflow.nodes?.length || 0;

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            <motion.div
                whileHover={!isDragging ? { scale: 1.02 } : undefined}
                className={cn(
                    'rounded-md p-2 mb-1.5 transition-all duration-150',
                    'cursor-grab active:cursor-grabbing select-none',
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
                <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                        <span className="hecate-body-sm font-medium truncate flex-1">
                            {workflow.name}
                        </span>
                        <GitBranch className="w-3 h-3 shrink-0 opacity-40" />
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="flex items-center gap-1 hecate-caption opacity-60">
                            <Zap className="w-2.5 h-2.5" />
                            {stepCount} step{stepCount !== 1 ? 's' : ''}
                        </span>
                        <span className={cn(
                            'hecate-badge-text px-1.5 py-0 rounded-sm text-[9px]',
                            workflow.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.08]',
                        )}>
                            {workflow.status || 'draft'}
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

/* ── PM-Context-Aware Task Tray ────────────────────────────────────────── */
/* Shows tasks from the ACTIVE project/folder/space in the PM sidebar.
   Replaces the generic TaskCardTray when embedded inside the PM page. */

function PMTaskTray() {
    const [searchQuery, setSearchQuery] = useState('');

    // PM Store — context-aware task source
    const pmTasks = usePMStore((s) => s.tasks);
    const folders = usePMStore((s) => s.folders);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const activeProjectId = usePMStore((s) => s.activeProjectId);

    // Scheduler state for filtering already-scheduled tasks
    const events = useSchedulerStore((s) => s.events);
    const filterAgentIds = useSchedulerStore((s) => s.filterAgentIds);

    // Workflows
    const { workflows, fetchWorkflows } = useWorkflowStore();
    useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);

    // Collect all folder IDs that belong under a given folder (recursive)
    const collectDescendantFolderIds = useCallback((parentId: string): Set<string> => {
        const ids = new Set<string>();
        const recurse = (pid: string) => {
            folders.filter(f => f.parent_folder_id === pid).forEach(child => {
                ids.add(child.id);
                recurse(child.id);
            });
        };
        recurse(parentId);
        return ids;
    }, [folders]);

    // Filter PM tasks based on active context
    const contextTasks = useMemo(() => {
        const scheduledTaskIds = new Set(
            events.filter(e => e.taskId).map(e => e.taskId)
        );

        let filtered = pmTasks.filter(t => !t.parent_task_id); // top-level only

        // Context filtering: project → folder (with descendants) → space
        if (activeProjectId) {
            // Inside a specific project: show only tasks belonging to that project
            filtered = filtered.filter(t => t.folder_id === activeProjectId);
        } else if (activeFolderId) {
            // Inside a folder: show tasks from this folder and ALL descendant projects/folders
            const descendantIds = collectDescendantFolderIds(activeFolderId);
            descendantIds.add(activeFolderId);
            filtered = filtered.filter(t => t.folder_id && descendantIds.has(t.folder_id));
        } else if (activeSpaceId) {
            // At space level: show all tasks in the space
            filtered = filtered.filter(t => t.space_id === activeSpaceId);
        }

        // Exclude already-scheduled tasks
        filtered = filtered.filter(t => !scheduledTaskIds.has(t.id));

        // Agent filter
        if (filterAgentIds.length > 0) {
            filtered = filtered.filter(t => t.agent_id && filterAgentIds.includes(t.agent_id));
        }

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
        }

        return filtered;
    }, [pmTasks, events, activeSpaceId, activeFolderId, activeProjectId, filterAgentIds, searchQuery, collectDescendantFolderIds]);

    // Filter workflows
    const filteredWorkflows = useMemo(() => {
        if (!searchQuery) return workflows;
        return workflows.filter(wf =>
            wf.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [workflows, searchQuery]);

    return (
        <div className="bg-black/[0.15] w-56 border-r border-white/[0.06] flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="px-2.5 py-2 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                    <h3 className="text-[10px] font-semibold uppercase tracking-widest text-foreground/60">Unscheduled</h3>
                    <span className="text-[9px] font-medium bg-white/[0.08] px-1.5 py-0.5 rounded-sm text-foreground/50">
                        {contextTasks.length + filteredWorkflows.length}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 opacity-40" />
                    <Input
                        placeholder="Filter tasks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-6 text-[10px] pl-6 bg-white/[0.04] border-white/[0.06]"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-1.5">
                {/* Tasks Section */}
                {contextTasks.length > 0 && (
                    <div className="mb-2">
                        <div className="flex items-center gap-1.5 px-1 mb-1">
                            <span className="text-[9px] font-medium uppercase tracking-widest text-white/25">Tasks</span>
                        </div>
                        {contextTasks.map((task) => (
                            <DraggablePMTask key={task.id} task={task} />
                        ))}
                    </div>
                )}

                {/* Workflows Section */}
                {filteredWorkflows.length > 0 && (
                    <div className="mb-2">
                        <div className="flex items-center gap-1 px-1 mb-1">
                            <GitBranch className="w-2.5 h-2.5 text-white/25" />
                            <span className="text-[9px] font-medium uppercase tracking-widest text-white/25">Workflows</span>
                        </div>
                        {filteredWorkflows.map((wf) => (
                            <DraggableWorkflowCard key={wf.id} workflow={wf} />
                        ))}
                    </div>
                )}

                {/* Empty state */}
                {contextTasks.length === 0 && filteredWorkflows.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-1.5 opacity-30">
                        <InboxIcon className="w-6 h-6" />
                        <div className="text-[10px] text-center">
                            {searchQuery ? 'No matching items' : 'All tasks scheduled! 🎯'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ── Compact Inline Scheduler Header ───────────────────────────────────── */

function InlineSchedulerHeader() {
    const {
        viewStartDate, viewRangeWeeks, filterAgentIds, events,
        scrollForward, scrollBackward, scrollToToday,
        setViewRange, toggleAgentFilter,
    } = useSchedulerStore();

    const socketAgents = useAvailableAgents();

    const FALLBACK_AGENTS = useMemo(() => [
        { id: 'daisy', name: 'Daisy' },
        { id: 'ivy', name: 'Ivy' },
        { id: 'celia', name: 'Celia' },
        { id: 'thalia', name: 'Thalia' },
    ], []);
    const agentList = socketAgents.length > 0 ? socketAgents : FALLBACK_AGENTS;

    const rangeLabel = useMemo(() => {
        const endDate = addDays(addWeeks(viewStartDate, viewRangeWeeks), -1);
        const startStr = format(viewStartDate, 'MMM d');
        const endStr = format(endDate, 'MMM d, yyyy');
        return `${startStr} — ${endStr}`;
    }, [viewStartDate, viewRangeWeeks]);

    const streak = useMemo(() => {
        const completedDates = new Set(
            events
                .filter(e => e.status === 'completed')
                .map(e => e.virtualDate || e.scheduledDate)
        );
        if (completedDates.size === 0) return 0;
        let count = 0;
        let cursor = new Date();
        for (let i = 0; i < 365; i++) {
            const key = format(cursor, 'yyyy-MM-dd');
            if (completedDates.has(key)) {
                count++;
                cursor = addDays(cursor, -1);
            } else if (i === 0) {
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
        <div className="shrink-0 border-b border-white/[0.06] bg-black/[0.15] backdrop-blur-[12px]">
            <div className="flex items-center justify-between gap-3 px-4 py-1.5">
                {/* Left: Agent filter pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide min-w-0 flex-1">
                    {agentList.map((agent: any) => {
                        const isActive = filterAgentIds.includes(agent.id);
                        const color = getAgentColor(agent.id);
                        return (
                            <button
                                key={agent.id}
                                onClick={() => toggleAgentFilter(agent.id)}
                                className={cn(
                                    'flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150 shrink-0',
                                    isActive
                                        ? 'text-white'
                                        : 'bg-white/[0.04] opacity-60 hover:opacity-100',
                                )}
                                style={isActive ? { backgroundColor: color } : undefined}
                            >
                                <AgentAvatar
                                    agentId={agent.id}
                                    size={16}
                                    showStatus={false}
                                />
                                {agent.name}
                            </button>
                        );
                    })}
                    {filterAgentIds.length > 0 && (
                        <button
                            onClick={() => useSchedulerStore.getState().clearAgentFilters()}
                            className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded-md hover:bg-white/[0.06] transition-colors shrink-0"
                        >
                            Clear
                        </button>
                    )}
                    {streak > 0 && (
                        <span className="bg-[var(--accent-base)]/15 text-[var(--accent-base)] rounded-md px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1 shrink-0 ml-1">
                            <Flame className="w-3 h-3" />
                            {streak}d
                        </span>
                    )}
                </div>

                {/* Center: Date navigation */}
                <div className="flex items-center gap-1.5 shrink-0">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => scrollToToday()}
                        className="rounded-md text-[10px] h-6 px-2.5 border-white/[0.08]"
                    >
                        Today
                    </Button>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => scrollBackward(1)}
                        className="h-6 w-6 rounded-full"
                    >
                        <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-[11px] font-medium min-w-[150px] text-center text-foreground/80">
                        {rangeLabel}
                    </span>
                    <Button
                        variant="ghost" size="icon"
                        onClick={() => scrollForward(1)}
                        className="h-6 w-6 rounded-full"
                    >
                        <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Right: View range toggle */}
                <div className="flex items-center shrink-0">
                    <div className="flex items-center rounded-md bg-white/[0.04] p-0.5">
                        {viewRanges.map(({ label, value }) => (
                            <button
                                key={value}
                                onClick={() => setViewRange(value)}
                                className={cn(
                                    'px-2 py-0.5 rounded-md text-[10px] font-medium transition-all duration-150',
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
        </div>
    );
}

/* ── ProjectScheduler Component ────────────────────────────────────────── */

export function ProjectScheduler() {
    const {
        viewStartDate, viewRangeWeeks, draggedEvent,
        fetchEvents, setDraggedEvent, setDropTargetDate,
        createEvent, moveEventToDate, selectedEventId,
    } = useSchedulerStore();

    const agents = useAvailableAgents();

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
    );

    const dateRange = useMemo(() => {
        const start = format(viewStartDate, 'yyyy-MM-dd');
        const end = format(addDays(addWeeks(viewStartDate, viewRangeWeeks), -1), 'yyyy-MM-dd');
        return { start, end };
    }, [viewStartDate, viewRangeWeeks]);

    useEffect(() => {
        fetchEvents(dateRange.start, dateRange.end);
    }, [dateRange.start, dateRange.end, fetchEvents]);

    /* ── Drag handlers ─────────────────────────────────────────────── */

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const data = active.data.current;

        if (data?.type === 'calendar-event') {
            setDraggedEvent(data.event as SchedulerEvent);
        } else if (data?.type === 'tray-task') {
            const task = data.task as Task;
            setDraggedEvent({
                id: task.id,
                taskId: task.id,
                agentId: task.agentId,
                title: task.title,
                description: task.description || null,
                scheduledDate: '',
                scheduledTime: null,
                durationMinutes: 60,
                recurrenceType: 'none',
                recurrenceInterval: 1,
                recurrenceEndDate: null,
                recurrenceDaysOfWeek: null,
                status: 'scheduled',
                lastRunAt: null,
                nextRunAt: null,
                runCount: 0,
                color: null,
                priority: (task.priority?.toLowerCase() as SchedulerEvent['priority']) || 'medium',
                createdAt: 0,
                updatedAt: 0,
            });
        } else if (data?.type === 'tray-workflow') {
            const workflow = data.workflow as Workflow;
            setDraggedEvent({
                id: `wf-${workflow.id}`,
                taskId: null,
                agentId: null as any,
                title: `⚡ ${workflow.name}`,
                description: workflow.description || null,
                scheduledDate: '',
                scheduledTime: null,
                durationMinutes: 60,
                recurrenceType: 'none',
                recurrenceInterval: 1,
                recurrenceEndDate: null,
                recurrenceDaysOfWeek: null,
                status: 'scheduled',
                lastRunAt: null,
                nextRunAt: null,
                runCount: 0,
                color: null,
                priority: 'medium',
                createdAt: 0,
                updatedAt: 0,
            });
        }
    }, [setDraggedEvent]);

    const handleDragOver = useCallback((event: DragOverEvent) => {
        const { over } = event;
        if (over?.data?.current?.type === 'date-column') {
            setDropTargetDate(over.data.current.date as string);
        } else {
            setDropTargetDate(null);
        }
    }, [setDropTargetDate]);

    const handleDragEnd = useCallback(async (event: DragEndEvent) => {
        const { active, over } = event;
        setDraggedEvent(null);
        setDropTargetDate(null);

        if (!over || over.data?.current?.type !== 'date-column') return;

        const targetDate = over.data.current.date as string;
        const sourceData = active.data.current;

        if (sourceData?.type === 'tray-task') {
            const task = sourceData.task as Task;
            await createEvent({
                taskId: task.id,
                agentId: task.agentId,
                title: task.title,
                description: task.description || null,
                scheduledDate: targetDate,
                priority: (task.priority?.toLowerCase() as SchedulerEvent['priority']) || 'medium',
            });
        } else if (sourceData?.type === 'tray-workflow') {
            const workflow = sourceData.workflow as Workflow;
            await createEvent({
                taskId: null,
                agentId: null,
                title: `⚡ ${workflow.name}`,
                description: workflow.description || null,
                scheduledDate: targetDate,
                priority: 'medium',
            } as any);
        } else if (sourceData?.type === 'calendar-event') {
            const sourceEvent = sourceData.event as SchedulerEvent;
            await moveEventToDate(sourceEvent.id, targetDate);
        }
    }, [createEvent, moveEventToDate, setDraggedEvent, setDropTargetDate]);

    const handleDragCancel = useCallback(() => {
        setDraggedEvent(null);
        setDropTargetDate(null);
    }, [setDraggedEvent, setDropTargetDate]);

    /* ── Drag overlay ──────────────────────────────────────────────── */

    const overlayAgent = draggedEvent
        ? agents.find((a: any) => a.id === draggedEvent.agentId)
        : null;

    /* ── Render ─────────────────────────────────────────────────────── */

    return (
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <InlineSchedulerHeader />

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex flex-1 overflow-hidden min-h-0">
                    {/* Left: PM-Context-Aware Task Tray */}
                    <PMTaskTray />

                    {/* Right: Calendar Timeline */}
                    <CalendarTimeline />
                </div>

                <DragOverlay dropAnimation={null}>
                    {draggedEvent && (
                        <div className="rotate-2 opacity-90">
                            <TaskCard
                                id={draggedEvent.id}
                                title={draggedEvent.title}
                                agentId={draggedEvent.agentId}
                                agentName={overlayAgent?.name || draggedEvent.agentId}
                                agentColor={getAgentColor(draggedEvent.agentId)}
                                scheduledTime={draggedEvent.scheduledTime}
                                priority={draggedEvent.priority}
                                status={draggedEvent.status}
                                recurrenceType={draggedEvent.recurrenceType}
                                isCompact
                                isDragging
                            />
                        </div>
                    )}
                </DragOverlay>
            </DndContext>

            <EventDetailPanel />
            <CreateEventModal />
        </div>
    );
}
