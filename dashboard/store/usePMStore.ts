import { create } from 'zustand';
import type {
    PMSpace, PMFolder, PMTask, PMAgent, PMDependency,
    PMActivity, PMViewType, PMAssigneeType, PMTaskStatus
} from '@/lib/pm/types';
import { PRIORITY_LABELS, PRIORITY_DOTS, STATUS_LABELS } from '@/lib/pm/types';

export { PRIORITY_LABELS, PRIORITY_DOTS, STATUS_LABELS };
export type { PMSpace, PMFolder, PMTask, PMAgent, PMActivity, PMViewType, PMAssigneeType, PMTaskStatus };

/* ────────────────────────────────────────────────────────────────────────────
   PM Store — Zustand cache backed by Supabase
   
   Key design decision: Tasks are stored in the SAME `tasks` table used by
   Task-Ops. The PM layer adds hierarchy (spaces → folders → tasks) and
   richer metadata (dates, progress, custom fields, dependencies).
   
   Agents (Ivy, Daisy, Celia, Thalia, etc.) are the primary assignees.
   ──────────────────────────────────────────────────────────────────────────── */

interface PMStore {
    // ── Data ──
    spaces: PMSpace[];
    folders: PMFolder[];
    tasks: PMTask[];
    agents: PMAgent[];
    activities: PMActivity[];
    dependencies: PMDependency[];

    // ── UI State ──
    activeSpaceId: string | null;
    activeFolderId: string | null;
    activeProjectId: string | null;  // folder_type='project' that is currently navigated into
    selectedTaskId: string | null;
    currentView: PMViewType;
    isLoading: boolean;
    hasFetched: boolean;

    // Dialog states
    createSpaceOpen: boolean;
    createFolderOpen: boolean;
    createTaskOpen: boolean;
    createWorkflowItemOpen: boolean;

    // ── Actions ──
    hydrate: () => Promise<void>;
    fetchAgents: () => Promise<void>;

    // Spaces
    createSpace: (name: string, icon?: string, iconColor?: string) => Promise<PMSpace | null>;
    updateSpace: (id: string, updates: Partial<PMSpace>) => Promise<void>;
    deleteSpace: (id: string) => Promise<void>;

    // Folders & Projects
    createFolder: (spaceId: string, name: string, parentFolderId?: string | null, folderType?: 'folder' | 'project') => Promise<PMFolder | null>;
    createProject: (spaceId: string, name: string, parentFolderId?: string | null) => Promise<PMFolder | null>;
    updateFolder: (id: string, updates: Partial<PMFolder>) => Promise<void>;
    deleteFolder: (id: string) => Promise<void>;

    // Tasks
    createTask: (data: Partial<PMTask>) => Promise<PMTask | null>;
    updateTask: (id: string, updates: Partial<PMTask>) => Promise<void>;
    deleteTask: (id: string) => Promise<void>;
    linkTask: (taskId: string, overrides?: Partial<PMTask>) => Promise<void>;

    // Dependencies
    fetchDependencies: (taskId?: string) => Promise<void>;
    addDependency: (predecessorId: string, successorId: string, depType?: string) => Promise<PMDependency | null>;
    removeDependency: (id: string) => Promise<void>;
    updateDependency: (id: string, updates: Partial<PMDependency>) => Promise<void>;
    getTaskDependencies: (taskId: string) => { predecessors: PMDependency[]; successors: PMDependency[] };

    // Activities
    logActivity: (entityType: string, entityId: string, actionType: string, content: string, source?: string, sourceName?: string) => Promise<void>;
    fetchActivities: (entityType: string, entityId: string) => Promise<PMActivity[]>;

    // UI setters
    setActiveSpace: (id: string | null) => void;
    setActiveFolder: (id: string | null) => void;
    setActiveProject: (id: string | null) => void;
    setSelectedTask: (id: string | null) => void;
    setCurrentView: (view: PMViewType) => void;
    setCreateSpaceOpen: (open: boolean) => void;
    setCreateFolderOpen: (open: boolean) => void;
    setCreateTaskOpen: (open: boolean) => void;
    setCreateWorkflowItemOpen: (open: boolean) => void;

    // Getters
    getSpaceTasks: (spaceId: string) => PMTask[];
    getFolderTasks: (folderId: string) => PMTask[];
    getSubtasks: (parentId: string) => PMTask[];
    getTaskById: (id: string) => PMTask | undefined;
    getActiveTasks: () => PMTask[];
}

export const usePMStore = create<PMStore>((set, get) => ({
    // ── Initial State ──
    spaces: [],
    folders: [],
    tasks: [],
    agents: [],
    activities: [],
    dependencies: [],

    activeSpaceId: null,
    activeFolderId: null,
    activeProjectId: null,
    selectedTaskId: null,
    currentView: 'table',
    isLoading: false,
    hasFetched: false,

    createSpaceOpen: false,
    createFolderOpen: false,
    createTaskOpen: false,
    createWorkflowItemOpen: false,

    // ── Hydrate from Supabase ──
    hydrate: async () => {
        if (get().isLoading) return;
        set({ isLoading: true });
        try {
            const [spacesRes, foldersRes, tasksRes, depsRes] = await Promise.all([
                fetch('/api/pm/spaces'),
                fetch('/api/pm/folders'),
                fetch('/api/pm/tasks'),
                fetch('/api/pm/dependencies'),
            ]);

            const [spacesData, foldersData, tasksData, depsData] = await Promise.all([
                spacesRes.json(),
                foldersRes.json(),
                tasksRes.json(),
                depsRes.json(),
            ]);

            set({
                spaces: spacesData.spaces || [],
                folders: foldersData.folders || [],
                tasks: tasksData.tasks || [],
                dependencies: depsData.dependencies || [],
                hasFetched: true,
                isLoading: false,
            });

            // Auto-select first space if none selected
            const state = get();
            if (!state.activeSpaceId && state.spaces.length > 0) {
                set({ activeSpaceId: state.spaces[0].id });
            }
        } catch (e) {
            console.error('[PM] hydrate error:', e);
            set({ isLoading: false, hasFetched: true });
        }
    },

    // ── Fetch agents from existing agents table ──
    fetchAgents: async () => {
        try {
            // Agents are served by the constellations/page or we can fetch directly
            const res = await fetch('/api/pm/agents');
            if (!res.ok) return;
            const data = await res.json();
            set({ agents: data.agents || [] });
        } catch (e) {
            console.error('[PM] fetchAgents error:', e);
        }
    },

    // ── Spaces ──
    createSpace: async (name, icon, iconColor) => {
        try {
            const res = await fetch('/api/pm/spaces', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, icon: icon || '📁', icon_color: iconColor || '#FF6D29' }),
            });
            const data = await res.json();
            if (data.space) {
                set((s) => ({ spaces: [...s.spaces, data.space], activeSpaceId: data.space.id }));
                return data.space;
            }
            return null;
        } catch (e) {
            console.error('[PM] createSpace error:', e);
            return null;
        }
    },

    updateSpace: async (id, updates) => {
        try {
            await fetch('/api/pm/spaces', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
            set((s) => ({
                spaces: s.spaces.map((sp) => (sp.id === id ? { ...sp, ...updates } : sp)),
            }));
        } catch (e) {
            console.error('[PM] updateSpace error:', e);
        }
    },

    deleteSpace: async (id) => {
        try {
            await fetch(`/api/pm/spaces?id=${id}`, { method: 'DELETE' });
            set((s) => ({
                spaces: s.spaces.filter((sp) => sp.id !== id),
                folders: s.folders.filter((f) => f.space_id !== id),
                tasks: s.tasks.filter((t) => t.space_id !== id),
                activeSpaceId: s.activeSpaceId === id ? (s.spaces.find((sp) => sp.id !== id)?.id || null) : s.activeSpaceId,
            }));
        } catch (e) {
            console.error('[PM] deleteSpace error:', e);
        }
    },

    // ── Folders ──
    createFolder: async (spaceId, name, parentFolderId, folderType) => {
        try {
            const res = await fetch('/api/pm/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ space_id: spaceId, name, parent_folder_id: parentFolderId || null, folder_type: folderType || 'folder' }),
            });
            const data = await res.json();
            if (data.folder) {
                set((s) => ({ folders: [...s.folders, data.folder] }));
                return data.folder;
            }
            return null;
        } catch (e) {
            console.error('[PM] createFolder error:', e);
            return null;
        }
    },

    createProject: async (spaceId, name, parentFolderId) => {
        return get().createFolder(spaceId, name, parentFolderId, 'project');
    },

    updateFolder: async (id, updates) => {
        try {
            await fetch('/api/pm/folders', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
            set((s) => ({
                folders: s.folders.map((f) => (f.id === id ? { ...f, ...updates } : f)),
            }));
        } catch (e) {
            console.error('[PM] updateFolder error:', e);
        }
    },

    deleteFolder: async (id) => {
        try {
            await fetch(`/api/pm/folders?id=${id}`, { method: 'DELETE' });
            set((s) => ({
                folders: s.folders.filter((f) => f.id !== id),
                tasks: s.tasks.filter((t) => t.folder_id !== id),
            }));
        } catch (e) {
            console.error('[PM] deleteFolder error:', e);
        }
    },

    // ── Tasks (uses same `tasks` table as Task-Ops) ──
    createTask: async (data) => {
        try {
            const state = get();
            const taskData = {
                ...data,
                space_id: data.space_id || state.activeSpaceId,
                folder_id: data.folder_id || state.activeFolderId,
                status: data.status || 'PENDING',
                priority: data.priority ?? 1,
                assignee_type: data.assignee_type || 'agent',
            };

            const res = await fetch('/api/pm/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData),
            });
            const result = await res.json();

            if (result.id) {
                const newTask: PMTask = {
                    id: result.id,
                    user_id: '',
                    agent_id: (data.agent_id as string) || null,
                    title: data.title || 'Untitled Task',
                    description: data.description || null,
                    status: (data.status as PMTaskStatus) || 'PENDING',
                    priority: data.priority ?? 1,
                    assignee_type: (data.assignee_type as PMAssigneeType) || 'agent',
                    space_id: taskData.space_id || null,
                    folder_id: taskData.folder_id || null,
                    project_id: data.project_id || null,
                    parent_task_id: data.parent_task_id || null,
                    start_date: data.start_date || null,
                    due_date: data.due_date || null,
                    completed_at: null,
                    progress: data.progress || 0,
                    sort_order: data.sort_order || 0,
                    custom_fields: data.custom_fields || {},
                    tags: data.tags || [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
                set((s) => ({ tasks: [newTask, ...s.tasks] }));
                return newTask;
            }
            return null;
        } catch (e) {
            console.error('[PM] createTask error:', e);
            return null;
        }
    },

    updateTask: async (id, updates) => {
        // Optimistic update
        set((s) => ({
            tasks: s.tasks.map((t) =>
                t.id === id ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
            ),
        }));

        try {
            await fetch('/api/pm/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
        } catch (e) {
            console.error('[PM] updateTask error:', e);
            // Re-fetch to get consistent state
            get().hydrate();
        }
    },

    deleteTask: async (id) => {
        try {
            await fetch(`/api/pm/tasks?id=${id}`, { method: 'DELETE' });
            // Remove the task and any subtasks (DB cascade handles this too)
            const subtaskIds = new Set<string>();
            const collectSubtasks = (parentId: string) => {
                get().tasks.forEach((t) => {
                    if (t.parent_task_id === parentId) {
                        subtaskIds.add(t.id);
                        collectSubtasks(t.id);
                    }
                });
            };
            collectSubtasks(id);
            set((s) => ({
                tasks: s.tasks.filter((t) => t.id !== id && !subtaskIds.has(t.id)),
                selectedTaskId: s.selectedTaskId === id || subtaskIds.has(s.selectedTaskId || '') ? null : s.selectedTaskId,
            }));
        } catch (e) {
            console.error('[PM] deleteTask error:', e);
        }
    },

    linkTask: async (taskId, overrides = {}) => {
        try {
            const state = get();
            const spaceId = state.activeSpaceId;
            const folderId = state.activeFolderId || state.activeProjectId || null;

            // Build the full patch payload
            const patchData: Record<string, any> = {
                id: taskId,
                space_id: spaceId,
                folder_id: folderId,
                ...overrides,
            };

            // Optimistic update: if the task already exists in the store, update it in-place;
            // otherwise add a placeholder entry so the UI reflects the link immediately
            const existingIdx = state.tasks.findIndex(t => t.id === taskId);
            if (existingIdx >= 0) {
                set((s) => ({
                    tasks: s.tasks.map(t =>
                        t.id === taskId ? { ...t, ...patchData, updated_at: new Date().toISOString() } : t
                    ),
                }));
            } else {
                // Build a minimal task entry from the overrides
                const minimalTask: any = {
                    id: taskId,
                    user_id: '',
                    title: 'Linked Task',
                    status: 'PENDING',
                    priority: 1,
                    progress: 0,
                    sort_order: 0,
                    custom_fields: {},
                    tags: [],
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                    ...patchData,
                };
                set((s) => ({ tasks: [...s.tasks, minimalTask] }));
            }

            // Persist to DB
            await fetch('/api/pm/tasks', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patchData),
            });

            // Re-fetch from DB to ensure full consistency (authoritative data)
            const res = await fetch(`/api/pm/tasks?space_id=${spaceId || ''}`);
            if (res.ok) {
                const data = await res.json();
                const freshTasks: PMTask[] = data.tasks || [];
                const otherTasks = get().tasks.filter(t => t.space_id !== spaceId);
                set({ tasks: [...otherTasks, ...freshTasks] });
            }
        } catch (e) {
            console.error('[PM] linkTask error:', e);
        }
    },

    // ── Activities ──
    logActivity: async (entityType, entityId, actionType, content, source = 'human', sourceName = 'You') => {
        try {
            const res = await fetch('/api/pm/activities', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entity_type: entityType, entity_id: entityId, action_type: actionType, content, source, source_name: sourceName }),
            });
            const data = await res.json();
            if (data.activity) {
                set((s) => ({ activities: [data.activity, ...s.activities] }));
            }
        } catch (e) {
            console.error('[PM] logActivity error:', e);
        }
    },

    fetchActivities: async (entityType, entityId) => {
        try {
            const res = await fetch(`/api/pm/activities?entity_type=${entityType}&entity_id=${entityId}`);
            const data = await res.json();
            const activities = data.activities || [];
            set({ activities });
            return activities;
        } catch (e) {
            console.error('[PM] fetchActivities error:', e);
            return [];
        }
    },

    // ── Dependencies ──
    fetchDependencies: async (taskId) => {
        try {
            const url = taskId
                ? `/api/pm/dependencies?task_id=${taskId}`
                : '/api/pm/dependencies';
            const res = await fetch(url);
            const data = await res.json();
            if (!taskId) {
                // Full replace when fetching all
                set({ dependencies: data.dependencies || [] });
            } else {
                // Merge new deps with existing (replace ones for this task)
                set((s) => {
                    const otherDeps = s.dependencies.filter(
                        (d) => d.predecessor_id !== taskId && d.successor_id !== taskId
                    );
                    return { dependencies: [...otherDeps, ...(data.dependencies || [])] };
                });
            }
        } catch (e) {
            console.error('[PM] fetchDependencies error:', e);
        }
    },

    addDependency: async (predecessorId, successorId, depType = 'finish_to_start') => {
        try {
            const res = await fetch('/api/pm/dependencies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    predecessor_id: predecessorId,
                    successor_id: successorId,
                    dependency_type: depType,
                }),
            });
            const data = await res.json();
            if (data.id) {
                const newDep: PMDependency = {
                    id: data.id,
                    predecessor_id: predecessorId,
                    successor_id: successorId,
                    dependency_type: depType as any,
                    lag_days: 0,
                };
                set((s) => ({ dependencies: [...s.dependencies, newDep] }));
                return newDep;
            }
            return null;
        } catch (e) {
            console.error('[PM] addDependency error:', e);
            return null;
        }
    },

    removeDependency: async (id) => {
        // Optimistic removal
        set((s) => ({ dependencies: s.dependencies.filter((d) => d.id !== id) }));
        try {
            await fetch(`/api/pm/dependencies?id=${id}`, { method: 'DELETE' });
        } catch (e) {
            console.error('[PM] removeDependency error:', e);
            // Re-fetch to restore on error
            get().fetchDependencies();
        }
    },

    updateDependency: async (id, updates) => {
        set((s) => ({
            dependencies: s.dependencies.map((d) => (d.id === id ? { ...d, ...updates } : d)),
        }));
        try {
            await fetch('/api/pm/dependencies', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, ...updates }),
            });
        } catch (e) {
            console.error('[PM] updateDependency error:', e);
        }
    },

    getTaskDependencies: (taskId) => {
        const deps = get().dependencies;
        return {
            // Tasks that must finish BEFORE this task (this task is the successor)
            predecessors: deps.filter((d) => d.successor_id === taskId),
            // Tasks that must start AFTER this task (this task is the predecessor)
            successors: deps.filter((d) => d.predecessor_id === taskId),
        };
    },

    // ── UI Setters ──
    setActiveSpace: (id) => set({ activeSpaceId: id, activeFolderId: null, activeProjectId: null, selectedTaskId: null }),
    setActiveFolder: (id) => set({ activeFolderId: id, selectedTaskId: null }),
    setActiveProject: (id) => set({ activeProjectId: id, activeFolderId: id, selectedTaskId: null }),
    setSelectedTask: (id) => set({ selectedTaskId: id }),
    setCurrentView: (view) => set({ currentView: view }),
    setCreateSpaceOpen: (open) => set({ createSpaceOpen: open }),
    setCreateFolderOpen: (open) => set({ createFolderOpen: open }),
    setCreateTaskOpen: (open) => set({ createTaskOpen: open }),
    setCreateWorkflowItemOpen: (open) => set({ createWorkflowItemOpen: open }),

    // ── Getters ──
    getSpaceTasks: (spaceId) => get().tasks.filter((t) => t.space_id === spaceId && !t.parent_task_id),
    getFolderTasks: (folderId) => get().tasks.filter((t) => t.folder_id === folderId && !t.parent_task_id),
    getSubtasks: (parentId) => get().tasks.filter((t) => t.parent_task_id === parentId),
    getTaskById: (id) => get().tasks.find((t) => t.id === id),
    getActiveTasks: () => {
        const state = get();
        let filtered = state.tasks.filter((t) => !t.parent_task_id);
        if (state.activeFolderId) {
            filtered = filtered.filter((t) => t.folder_id === state.activeFolderId);
        } else if (state.activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === state.activeSpaceId);
        }
        return filtered;
    },
}));
