import { create } from 'zustand';
import { ToolCallData } from '@/components/ToolNodeCard';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ExecutionStep {
    id: string;
    text: string;
    order: number;
}

export interface TaskGoal {
    id: string;
    type: 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';
    label: string;
}

export interface TaskConstraint {
    id: string;
    type: 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';
    label: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    agentId: string;
    status: TaskStatus;
    priority: TaskPriority;
    logs?: string[];
    toolCalls?: ToolCallData[];
    topP?: number;
    temp?: number;
    tokens?: number;
    updatedAt: number;
    timestamp: string;
    // Task Card fields
    executionPlan?: ExecutionStep[];
    systemPrompt?: string;
    goals?: TaskGoal[];
    constraints?: TaskConstraint[];
    source?: 'handoff' | 'manual' | 'summit';
}

interface TaskState {
    tasks: Task[];
    hasFetched: boolean;

    // Actions
    fetchTasks: (force?: boolean) => Promise<void>;
    addTask: (task: Task) => void;
    updateTask: (id: string, updates: Partial<Task>) => void;
    updateTaskStatus: (id: string, status: TaskStatus) => void;
    removeTask: (id: string) => void;
    clearTasks: () => void;
}

export const useTaskStore = create<TaskState>((set, get) => ({
    tasks: [],
    hasFetched: false,

    fetchTasks: async (force?: boolean) => {
        try {
            const res = await fetch('/api/tasks');
            if (!res.ok) return;
            const { tasks } = await res.json();
            if (Array.isArray(tasks)) {
                if (force) {
                    // Full replacement — no stale mem-only ghosts
                    set({ tasks, hasFetched: true });
                } else {
                    // Merge: keep any in-memory tasks not in DB, add DB tasks
                    const current = get().tasks;
                    const dbIds = new Set(tasks.map((t: Task) => t.id));
                    const memOnly = current.filter(t => !dbIds.has(t.id));
                    set({ tasks: [...tasks, ...memOnly], hasFetched: true });
                }
            }
        } catch (e) {
            console.error('fetchTasks error:', e);
        }
    },

    addTask: (task) => set((state) => {
        if (state.tasks.some(t => t.id === task.id)) return state;
        // Persist to DB (fire-and-forget)
        fetch('/api/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(task),
        }).catch(e => console.error('addTask persist error:', e));
        return { tasks: [task, ...state.tasks] };
    }),

    updateTask: (id, updates) => set((state) => {
        // Build the payload to persist — include custom_fields-mapped keys
        const payload: Record<string, any> = { id };
        if (updates.title !== undefined) payload.title = updates.title;
        if (updates.description !== undefined) payload.description = updates.description;
        if (updates.status !== undefined) payload.status = updates.status;
        if (updates.agentId !== undefined) payload.agentId = updates.agentId;
        if (updates.priority !== undefined) payload.priority = updates.priority;
        if (updates.executionPlan !== undefined) payload.executionPlan = updates.executionPlan;
        if (updates.systemPrompt !== undefined) payload.systemPrompt = updates.systemPrompt;
        if (updates.goals !== undefined) payload.goals = updates.goals;
        if (updates.constraints !== undefined) payload.constraints = updates.constraints;

        // Persist to DB (fire-and-forget)
        fetch('/api/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        }).catch(e => console.error('updateTask persist error:', e));
        return {
            tasks: state.tasks.map(t => t.id === id
                ? { ...t, ...updates, updatedAt: Date.now(), timestamp: new Date().toLocaleTimeString() }
                : t
            ),
        };
    }),

    updateTaskStatus: (id, status) => set((state) => {
        // Persist to DB (fire-and-forget)
        fetch('/api/tasks', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status }),
        }).catch(e => console.error('updateTaskStatus persist error:', e));
        return {
            tasks: state.tasks.map(t => t.id === id
                ? { ...t, status, updatedAt: Date.now(), timestamp: new Date().toLocaleTimeString() }
                : t
            ),
        };
    }),

    removeTask: (id) => set((state) => {
        // Persist to DB (fire-and-forget) — cascade-delete scheduler events too
        fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
            .catch(e => console.error('removeTask persist error:', e));
        return { tasks: state.tasks.filter(t => t.id !== id) };
    }),

    clearTasks: () => set({ tasks: [] }),
}));
