'use client';

import { create } from 'zustand';
import {
    startOfWeek, addWeeks, subWeeks, format, addDays,
} from 'date-fns';
import { getGateway } from '@/lib/openclawGateway';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SchedulerEvent {
    id: string;
    taskId: string | null;
    agentId: string;
    title: string;
    description: string | null;
    scheduledDate: string;       // "2026-02-28"
    scheduledTime: string | null; // "14:30"
    durationMinutes: number;
    recurrenceType: 'none' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'custom';
    recurrenceInterval: number;
    recurrenceEndDate: string | null;
    recurrenceDaysOfWeek: number[] | null;
    status: 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
    lastRunAt: number | null;
    nextRunAt: number | null;
    runCount: number;
    color: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    createdAt: number;
    updatedAt: number;
    // Virtual fields from API
    isVirtual?: boolean;
    virtualDate?: string;
}

interface SchedulerState {
    // Data
    events: SchedulerEvent[];
    isLoading: boolean;
    error: string | null;

    // View State
    viewStartDate: Date;
    viewRangeWeeks: number;
    selectedDate: string | null;
    selectedEventId: string | null;
    filterAgentIds: string[];

    // Drag State
    draggedEvent: SchedulerEvent | null;
    dropTargetDate: string | null;

    // Modal State
    createModalOpen: boolean;
    createModalDate: string | null;
    setCreateModalOpen: (open: boolean, prefillDate?: string | null) => void;

    // Actions
    fetchEvents: (startDate: string, endDate: string) => Promise<void>;
    createEvent: (event: Partial<SchedulerEvent>) => Promise<void>;
    updateEvent: (id: string, updates: Partial<SchedulerEvent>) => Promise<void>;
    deleteEvent: (id: string) => Promise<void>;
    executeEvent: (id: string) => Promise<void>;
    moveEventToDate: (eventId: string, newDate: string) => Promise<void>;

    // View Actions
    scrollToDate: (date: Date) => void;
    scrollForward: (weeks?: number) => void;
    scrollBackward: (weeks?: number) => void;
    scrollToToday: () => void;
    setViewRange: (weeks: number) => void;
    setSelectedDate: (date: string | null) => void;
    setSelectedEvent: (id: string | null) => void;
    toggleAgentFilter: (agentId: string) => void;
    clearAgentFilters: () => void;

    // Drag Actions
    setDraggedEvent: (event: SchedulerEvent | null) => void;
    setDropTargetDate: (date: string | null) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getMonday(date: Date): Date {
    return startOfWeek(date, { weekStartsOn: 1 });
}

function computeDateRange(startDate: Date, weeks: number) {
    const start = format(startDate, 'yyyy-MM-dd');
    const end = format(addDays(addWeeks(startDate, weeks), -1), 'yyyy-MM-dd');
    return { start, end };
}

function generateCron(
    dateStr: string, timeStr: string | null,
    recurType: string, recurInterval: number,
    daysOfWeek: number[] | null
): string {
    const time = timeStr || '00:00';
    const [hh, mm] = time.split(':');
    const d = new Date(dateStr);
    const dayOfMonth = d.getDate();
    const month = d.getMonth() + 1;

    switch (recurType) {
        case 'hourly':
            return `${parseInt(mm)} */${recurInterval} * * *`;
        case 'daily':
            return `${parseInt(mm)} ${parseInt(hh)} */${recurInterval} * *`;
        case 'weekly':
            const dowStr = (daysOfWeek && daysOfWeek.length > 0) ? daysOfWeek.join(',') : d.getDay();
            return `${parseInt(mm)} ${parseInt(hh)} * * ${dowStr}`;
        case 'monthly':
            return `${parseInt(mm)} ${parseInt(hh)} ${dayOfMonth} */${recurInterval} *`;
        case 'none':
        default:
            return `${parseInt(mm)} ${parseInt(hh)} ${dayOfMonth} ${month} *`;
    }
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useSchedulerStore = create<SchedulerState>((set, get) => ({
    events: [],
    isLoading: false,
    error: null,

    viewStartDate: getMonday(new Date()),
    viewRangeWeeks: 4,
    selectedDate: null,
    selectedEventId: null,
    filterAgentIds: [],

    draggedEvent: null,
    dropTargetDate: null,

    createModalOpen: false,
    createModalDate: null,
    setCreateModalOpen: (open, prefillDate) => set({
        createModalOpen: open,
        createModalDate: prefillDate ?? null,
    }),

    // ─── Data Actions ───────────────────────────────────────────────

    fetchEvents: async (startDate, endDate) => {
        set({ isLoading: true, error: null });
        try {
            const res = await fetch(`/api/scheduler/events?startDate=${startDate}&endDate=${endDate}`);
            if (!res.ok) throw new Error('Failed to fetch');
            const data = await res.json();
            // Ensure data is an array before mapping
            if (!Array.isArray(data)) {
                set({ events: [], isLoading: false });
                return;
            }
            // Map snake_case DB fields to camelCase store fields
            const events = data.map((e: any) => ({
                id: e.id,
                taskId: e.task_id,
                agentId: e.agent_id,
                title: e.title,
                description: e.description,
                scheduledDate: e.scheduled_date,
                scheduledTime: e.scheduled_time,
                durationMinutes: e.duration_minutes ?? 60,
                recurrenceType: e.recurrence_type ?? 'none',
                recurrenceInterval: e.recurrence_interval ?? 1,
                recurrenceEndDate: e.recurrence_end_date,
                recurrenceDaysOfWeek: e.recurrence_days_of_week
                    ? (typeof e.recurrence_days_of_week === 'string'
                        ? JSON.parse(e.recurrence_days_of_week)
                        : e.recurrence_days_of_week)
                    : null,
                status: e.status ?? 'scheduled',
                lastRunAt: e.last_run_at,
                nextRunAt: e.next_run_at,
                runCount: e.run_count ?? 0,
                color: e.color,
                priority: e.priority ?? 'medium',
                createdAt: e.created_at,
                updatedAt: e.updated_at,
                isVirtual: e.isVirtual,
                virtualDate: e.virtualDate
            } as SchedulerEvent));
            set({ events, isLoading: false });
        } catch (e) {
            console.error('fetchEvents error:', e);
            set({ error: 'Failed to fetch events', isLoading: false });
        }
    },

    createEvent: async (event) => {
        try {
            const res = await fetch('/api/scheduler/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(event),
            });
            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                console.error('createEvent API error:', res.status, errBody);
                throw new Error(errBody.details || errBody.error || 'Failed to create');
            }
            
            const createdData = await res.json();
            const createdId = createdData?.id || event.id;

            // Sync with OpenClaw Cron backend ONLY for single-agent tasks
            const gw = getGateway();
            if (gw.isConnected && event.agentId) {
                const cronExpr = generateCron(
                    event.scheduledDate || '',
                    event.scheduledTime || null,
                    event.recurrenceType || 'none',
                    event.recurrenceInterval || 1,
                    event.recurrenceDaysOfWeek || null
                );
                
                // Formulate an appropriate task prompt for the agent based on event details
                const prompt = event.description 
                    ? `Scheduled Task: ${event.title}\nDetails: ${event.description}` 
                    : `Scheduled Task: ${event.title}`;

                await gw.request('cron.add', {
                    name: createdId || 'ofiere-scheduled-task',
                    sessionTarget: `agent:${event.agentId}:cron-${createdId || Date.now()}`,
                    payload: { kind: 'agentTurn', message: prompt },
                    schedule: { cron: cronExpr }
                }).then(cronRes => {
                    console.log('[OpenClaw Scheduler] Transmitted cron job:', cronRes);
                }).catch(err => {
                    // Keep verbose logging to catch any remaining schema issues
                    console.error('[OpenClaw Scheduler] Failed to add cron job:', 
                        JSON.stringify(err, Object.getOwnPropertyNames(err), 2)
                    );
                });
            }

            // Refetch
            const { viewStartDate, viewRangeWeeks, fetchEvents } = get();
            const { start, end } = computeDateRange(viewStartDate, viewRangeWeeks);
            await fetchEvents(start, end);
        } catch (e) {
            console.error('createEvent error:', e);
        }
    },

    updateEvent: async (id, updates) => {
        try {
            const res = await fetch(`/api/scheduler/events/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error('Failed to update');
            const { viewStartDate, viewRangeWeeks, fetchEvents } = get();
            const { start, end } = computeDateRange(viewStartDate, viewRangeWeeks);
            await fetchEvents(start, end);
        } catch (e) {
            console.error('updateEvent error:', e);
        }
    },

    deleteEvent: async (id) => {
        try {
            // Unsync from OpenClaw Backend if present
            const gw = getGateway();
            if (gw.isConnected) {
                await gw.request('cron.remove', { name: id }).then(() => {
                    console.log('[OpenClaw Scheduler] Removed cron job:', id);
                }).catch(err => {
                    console.warn('[OpenClaw Scheduler] Ignored cron removal error (may not exist):', err?.message || err);
                });
            }

            const res = await fetch(`/api/scheduler/events/${id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Failed to delete');
            const { viewStartDate, viewRangeWeeks, fetchEvents } = get();
            const { start, end } = computeDateRange(viewStartDate, viewRangeWeeks);
            await fetchEvents(start, end);
        } catch (e) {
            console.error('deleteEvent error:', e);
        }
    },

    executeEvent: async (id) => {
        try {
            const res = await fetch(`/api/scheduler/events/${id}/execute`, { method: 'POST' });
            if (!res.ok) throw new Error('Failed to execute');
            const { viewStartDate, viewRangeWeeks, fetchEvents } = get();
            const { start, end } = computeDateRange(viewStartDate, viewRangeWeeks);
            await fetchEvents(start, end);
        } catch (e) {
            console.error('executeEvent error:', e);
        }
    },

    moveEventToDate: async (eventId, newDate) => {
        try {
            const res = await fetch(`/api/scheduler/events/${eventId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scheduledDate: newDate }),
            });
            if (!res.ok) throw new Error('Failed to move');
            const { viewStartDate, viewRangeWeeks, fetchEvents } = get();
            const { start, end } = computeDateRange(viewStartDate, viewRangeWeeks);
            await fetchEvents(start, end);
        } catch (e) {
            console.error('moveEventToDate error:', e);
        }
    },

    // ─── View Actions ───────────────────────────────────────────────

    scrollToDate: (date) => set({ viewStartDate: getMonday(date) }),

    scrollForward: (weeks = 1) => set((state) => ({
        viewStartDate: addWeeks(state.viewStartDate, weeks),
    })),

    scrollBackward: (weeks = 1) => set((state) => ({
        viewStartDate: subWeeks(state.viewStartDate, weeks),
    })),

    scrollToToday: () => set({ viewStartDate: getMonday(new Date()) }),

    setViewRange: (weeks) => set({ viewRangeWeeks: weeks }),

    setSelectedDate: (date) => set({ selectedDate: date }),

    setSelectedEvent: (id) => set({ selectedEventId: id }),

    toggleAgentFilter: (agentId) => set((state) => {
        const idx = state.filterAgentIds.indexOf(agentId);
        return {
            filterAgentIds: idx >= 0
                ? state.filterAgentIds.filter(id => id !== agentId)
                : [...state.filterAgentIds, agentId],
        };
    }),

    clearAgentFilters: () => set({ filterAgentIds: [] }),

    // ─── Drag Actions ───────────────────────────────────────────────

    setDraggedEvent: (event) => set({ draggedEvent: event }),
    setDropTargetDate: (date) => set({ dropTargetDate: date }),
}));
