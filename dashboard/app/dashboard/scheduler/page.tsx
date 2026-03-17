'use client';

import { useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
    DndContext, DragOverlay, PointerSensor,
    useSensor, useSensors, type DragStartEvent,
    type DragOverEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { AnimatePresence } from 'framer-motion';
import { addWeeks, addDays, format } from 'date-fns';

import { SchedulerHeader } from '@/components/scheduler/SchedulerHeader';
import { TaskCardTray } from '@/components/scheduler/TaskCardTray';
import { TaskCard } from '@/components/scheduler/TaskCard';
import { useSchedulerStore, type SchedulerEvent } from '@/store/useSchedulerStore';
import { useSocketStore } from '@/lib/useSocket';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import type { Task } from '@/lib/useTaskStore';
import type { Workflow } from '@/lib/workflows/types';

const CalendarTimeline = dynamic(
    () => import('@/components/scheduler/CalendarTimeline').then(mod => mod.CalendarTimeline),
    { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center animate-pulse text-muted-foreground text-xs">Loading calendar...</div> }
);

const EventDetailPanel = dynamic(
    () => import('@/components/scheduler/EventDetailPanel').then(mod => mod.EventDetailPanel),
    { ssr: false }
);

const CreateEventModal = dynamic(
    () => import('@/components/scheduler/CreateEventModal').then(mod => mod.CreateEventModal),
    { ssr: false }
);

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

// ─── Page Component ─────────────────────────────────────────────────────────

export default function SchedulerPage() {
    const {
        viewStartDate, viewRangeWeeks, draggedEvent,
        fetchEvents, setDraggedEvent, setDropTargetDate,
        createEvent, moveEventToDate, selectedEventId,
    } = useSchedulerStore();

    const agents = useAvailableAgents();

    // dnd-kit sensors — 8px activation distance to prevent accidental drags
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 8 },
        }),
    );

    // Compute date range and fetch events
    const dateRange = useMemo(() => {
        const start = format(viewStartDate, 'yyyy-MM-dd');
        const end = format(addDays(addWeeks(viewStartDate, viewRangeWeeks), -1), 'yyyy-MM-dd');
        return { start, end };
    }, [viewStartDate, viewRangeWeeks]);

    useEffect(() => {
        fetchEvents(dateRange.start, dateRange.end);
    }, [dateRange.start, dateRange.end, fetchEvents]);

    // ─── Drag handlers ──────────────────────────────────────────────

    const handleDragStart = useCallback((event: DragStartEvent) => {
        const { active } = event;
        const data = active.data.current;

        if (data?.type === 'calendar-event') {
            setDraggedEvent(data.event as SchedulerEvent);
        } else if (data?.type === 'tray-task') {
            // Convert task to a pseudo-event for the overlay
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
            // Convert workflow to a pseudo-event for the overlay
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

        // Clear drag state
        setDraggedEvent(null);
        setDropTargetDate(null);

        if (!over || over.data?.current?.type !== 'date-column') return;

        const targetDate = over.data.current.date as string;
        const sourceData = active.data.current;

        if (sourceData?.type === 'tray-task') {
            // Tray task → Calendar: Create new event
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
            // Tray workflow → Calendar: Create new event linked to workflow
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
            // Calendar event → Calendar: Move to new date
            const sourceEvent = sourceData.event as SchedulerEvent;
            await moveEventToDate(sourceEvent.id, targetDate);
        }
    }, [createEvent, moveEventToDate, setDraggedEvent, setDropTargetDate]);

    const handleDragCancel = useCallback(() => {
        setDraggedEvent(null);
        setDropTargetDate(null);
    }, [setDraggedEvent, setDropTargetDate]);

    // ─── Drag overlay props ─────────────────────────────────────────

    const overlayAgent = draggedEvent ? agents.find((a: any) => a.id === draggedEvent.agentId) : null;

    return (
        <div className="flex flex-col h-full">
            <SchedulerHeader />

            <DndContext
                sensors={sensors}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={handleDragCancel}
            >
                <div className="flex flex-1 overflow-hidden">
                    {/* Left: Task Tray */}
                    <TaskCardTray />

                    {/* Right: Calendar Timeline */}
                    <CalendarTimeline />
                </div>

                {/* Drag Overlay */}
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

            {/* Bottom: Event Detail Panel */}
            <EventDetailPanel />

            {/* Modal */}
            <CreateEventModal />
        </div>
    );
}
