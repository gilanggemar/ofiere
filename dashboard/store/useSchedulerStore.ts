'use client';

import { create } from 'zustand';
import {
    startOfWeek, addWeeks, subWeeks, format, addDays,
} from 'date-fns';

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
            // Parse recurrenceDaysOfWeek from JSON string
            const events = data.map((e: Record<string, unknown>) => ({
                ...e,
                recurrenceDaysOfWeek: e.recurrenceDaysOfWeek
                    ? (typeof e.recurrenceDaysOfWeek === 'string'
                        ? JSON.parse(e.recurrenceDaysOfWeek as string)
                        : e.recurrenceDaysOfWeek)
                    : null,
                durationMinutes: e.durationMinutes ?? 60,
                recurrenceInterval: e.recurrenceInterval ?? 1,
                runCount: e.runCount ?? 0,
                priority: e.priority ?? 'medium',
                recurrenceType: e.recurrenceType ?? 'none',
                status: e.status ?? 'scheduled',
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
            if (!res.ok) throw new Error('Failed to create');
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
