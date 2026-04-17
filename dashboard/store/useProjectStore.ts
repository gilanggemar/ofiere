import { create } from 'zustand';

export interface ProjectFile {
    id: string;
    project_id: string;
    file_name: string;
    file_type: string;
    file_url: string;
    content_text: string | null;
    file_size: number;
    created_at: string;
}

export interface Project {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    custom_instructions: string | null;
    agent_id: string | null;
    created_at: string;
    updated_at: string;
    project_files?: ProjectFile[];
}

interface ProjectState {
    projects: Project[];
    activeProjectId: string | null;
    activeProject: Project | null;
    isLoading: boolean;
    lastError: string | null;

    loadProjects: () => Promise<void>;
    setActiveProject: (projectId: string | null) => Promise<void>;
    createProject: (data: { name: string; description?: string; custom_instructions?: string; agent_id?: string }) => Promise<string | null>;
    updateProject: (id: string, updates: Partial<Pick<Project, 'name' | 'description' | 'custom_instructions' | 'agent_id'>>) => Promise<void>;
    deleteProject: (id: string) => Promise<void>;
    uploadFile: (projectId: string, file: File) => Promise<ProjectFile | null>;
    deleteFile: (projectId: string, fileId: string) => Promise<void>;
    getProjectContext: () => string;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    activeProjectId: null,
    activeProject: null,
    isLoading: false,
    lastError: null,

    loadProjects: async () => {
        set({ isLoading: true, lastError: null });
        try {
            const res = await fetch(`/api/projects`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { projects } = await res.json();
            set({ projects: projects || [], isLoading: false });
        } catch (err: any) {
            console.error('[useProjectStore] loadProjects:', err);
            set({ isLoading: false, lastError: err.message });
        }
    },

    setActiveProject: async (projectId: string | null) => {
        if (!projectId) {
            set({ activeProjectId: null, activeProject: null });
            if (typeof window !== 'undefined') localStorage.removeItem('ofiere_active_project');
            return;
        }

        set({ activeProjectId: projectId, isLoading: true });
        if (typeof window !== 'undefined') localStorage.setItem('ofiere_active_project', projectId);

        try {
            const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}`);
            if (res.status === 404) {
                // Project no longer exists — clear selection
                set({ activeProjectId: null, activeProject: null, isLoading: false });
                if (typeof window !== 'undefined') localStorage.removeItem('ofiere_active_project');
                return;
            }
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { project } = await res.json();
            set({ activeProject: project, isLoading: false });
        } catch (err: any) {
            console.error('[useProjectStore] setActiveProject:', err);
            set({ activeProjectId: null, activeProject: null, isLoading: false, lastError: err.message });
            if (typeof window !== 'undefined') localStorage.removeItem('ofiere_active_project');
        }
    },

    createProject: async (data) => {
        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { project } = await res.json();

            set(state => ({
                projects: [project, ...state.projects],
                activeProjectId: project.id,
                activeProject: project,
            }));

            return project.id;
        } catch (err: any) {
            console.error('[useProjectStore] createProject:', err);
            set({ lastError: err.message });
            return null;
        }
    },

    updateProject: async (id, updates) => {
        // Optimistic update
        set(state => ({
            projects: state.projects.map(p => p.id === id ? { ...p, ...updates, updated_at: new Date().toISOString() } : p),
            activeProject: state.activeProject?.id === id ? { ...state.activeProject, ...updates, updated_at: new Date().toISOString() } : state.activeProject,
        }));

        try {
            const res = await fetch(`/api/projects/${encodeURIComponent(id)}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { project } = await res.json();

            set(state => ({
                projects: state.projects.map(p => p.id === id ? project : p),
                activeProject: state.activeProject?.id === id ? { ...project, project_files: state.activeProject?.project_files } : state.activeProject,
            }));
        } catch (err: any) {
            console.error('[useProjectStore] updateProject:', err);
            get().loadProjects();
        }
    },

    deleteProject: async (id) => {
        set(state => ({
            projects: state.projects.filter(p => p.id !== id),
            ...(state.activeProjectId === id ? { activeProjectId: null, activeProject: null } : {}),
        }));

        try {
            await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
        } catch (err: any) {
            console.error('[useProjectStore] deleteProject:', err);
            get().loadProjects();
        }
    },

    uploadFile: async (projectId, file) => {
        try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: file.name, type: file.type, data: dataUrl }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const { file: fileRecord } = await res.json();

            // Add to active project's files
            set(state => {
                if (state.activeProject?.id === projectId) {
                    const updatedFiles = [...(state.activeProject.project_files || []), fileRecord];
                    return { activeProject: { ...state.activeProject, project_files: updatedFiles } };
                }
                return {};
            });

            return fileRecord;
        } catch (err: any) {
            console.error('[useProjectStore] uploadFile:', err);
            set({ lastError: err.message });
            return null;
        }
    },

    deleteFile: async (projectId, fileId) => {
        // Optimistic removal
        set(state => {
            if (state.activeProject?.id === projectId) {
                const updatedFiles = (state.activeProject.project_files || []).filter(f => f.id !== fileId);
                return { activeProject: { ...state.activeProject, project_files: updatedFiles } };
            }
            return {};
        });

        try {
            await fetch(`/api/projects/${encodeURIComponent(projectId)}/files`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ file_id: fileId }),
            });
        } catch (err: any) {
            console.error('[useProjectStore] deleteFile:', err);
        }
    },

    /**
     * Build context string from active project's instructions + file contents.
     * This is injected into agent messages as a system prefix.
     */
    getProjectContext: () => {
        const { activeProject } = get();
        if (!activeProject) return '';

        const parts: string[] = [];

        if (activeProject.custom_instructions) {
            parts.push(`[PROJECT CONTEXT — ${activeProject.name}]\nCustom Instructions:\n${activeProject.custom_instructions}`);
        }

        const files = activeProject.project_files || [];
        const textFiles = files.filter(f => f.content_text);
        if (textFiles.length > 0) {
            parts.push('Attached Files:');
            for (const f of textFiles) {
                parts.push(`--- ${f.file_name} ---\n${f.content_text}`);
            }
        }

        if (parts.length === 0) return '';
        return parts.join('\n\n') + '\n\n';
    },
}));
