// store/useConstellationStore.ts
// Agent Architecture Canvas state.
// Bridges structured agent data to the OpenClaw Gateway via file read/write.
// Uses the SAME gateway API as useOpenClawCapabilitiesStore (agents.files.*)

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';
import { useOpenClawCapabilitiesStore } from '@/stores/useOpenClawCapabilitiesStore';
import {
    type AgentArchitecture,
    type AgentRelationship,
    type AgentFile,
    type BuildScore,
    createEmptyAgent,
    AGENT_DEFAULTS,
    DEFAULT_RELATIONSHIPS,
} from '@/lib/constellation/agentSchema';
import { parseAgentFiles, parseDoctrineMd, calculateBuildScore, DOCTRINE_FILE_NAMES, SPECIAL_FILES } from '@/lib/constellation/markdownParser';
import { serializeAgentToFiles } from '@/lib/constellation/markdownSerializer';

// ─── Hierarchical Layout Positions ──────────────────────────────────────────

const HIERARCHY_POSITIONS: Record<string, { x: number; y: number }> = {
    // All four chiefs in a single row below the CEO node
    // Card width is 280px, using 320px spacing for breathing room
    ivy:    { x: 0,   y: 300 },   // COO — operations hub
    daisy:  { x: 320, y: 300 },   // CIO — intelligence
    celia:  { x: 640, y: 300 },   // CTO — builds
    thalia: { x: 960, y: 300 },   // CMO — distribution
};

function getHierarchicalPositions(agentIds: string[]): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};

    // Assign known positions first
    for (const id of agentIds) {
        if (HIERARCHY_POSITIONS[id]) {
            positions[id] = { ...HIERARCHY_POSITIONS[id] };
        }
    }

    // Fallback for unknown agents — place them in a row below
    let unknownIndex = 0;
    for (const id of agentIds) {
        if (!positions[id]) {
            positions[id] = {
                x: 200 + unknownIndex * 250,
                y: 720,
            };
            unknownIndex++;
        }
    }

    return positions;
}

// ─── State Interface ────────────────────────────────────────────────────────

interface ConstellationState {
    agents: Record<string, AgentArchitecture>;
    relationships: AgentRelationship[];

    // UI state
    selectedAgentId: string | null;
    drawerOpen: boolean;
    drawerTab: 'overview' | 'doctrine' | 'files' | 'build' | 'relationships';
    isLoading: boolean;
    isSaving: boolean;
    error: string | null;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';

    // Doctrine lazy loading
    doctrineLoaded: Record<string, boolean>;
    doctrineLoadingId: string | null;

    // CEO config (visual-only apex node)
    ceoConfig: { name: string; title: string; subtitle: string };

    // Agent Zero chat
    zeroChatOpen: boolean;
    zeroChatTargetAgent: string | null;

    // Actions
    initialize: () => Promise<void>;
    loadAgentFiles: (agentId: string) => Promise<void>;
    loadAllAgents: () => Promise<void>;
    saveAgentFiles: (agentId: string) => Promise<void>;
    saveAllDirtyAgents: () => Promise<void>;

    // Doctrine-specific actions
    loadDoctrine: (agentId: string) => Promise<void>;
    saveDoctrine: (agentId: string) => Promise<void>;

    // Edit actions — these stage changes locally
    updateAgentField: <K extends keyof AgentArchitecture>(agentId: string, field: K, value: AgentArchitecture[K]) => void;
    updateAgentFileContent: (agentId: string, fileName: string, content: string) => void;
    markFileDirty: (agentId: string, fileName: string) => void;

    // UI actions
    selectAgent: (agentId: string | null) => void;
    openDrawer: (agentId: string, tab?: ConstellationState['drawerTab']) => void;
    closeDrawer: () => void;
    setDrawerTab: (tab: ConstellationState['drawerTab']) => void;
    toggleZeroChat: (targetAgentId?: string) => void;

    // Relationship actions
    addRelationship: (rel: Omit<AgentRelationship, 'id'>) => void;
    removeRelationship: (id: string) => void;
    updateRelationship: (id: string, updates: Partial<AgentRelationship>) => void;

    // Position
    updateAgentPosition: (agentId: string, position: { x: number; y: number }) => void;

    // CEO
    updateCEOConfig: (field: string, value: string) => void;

    // Derived
    getDirtyAgents: () => string[];
    hasUnsavedChanges: () => boolean;
}

export const useConstellationStore = create<ConstellationState>((set, get) => ({
    agents: {},
    relationships: DEFAULT_RELATIONSHIPS,
    selectedAgentId: null,
    drawerOpen: false,
    drawerTab: 'overview',
    isLoading: false,
    isSaving: false,
    error: null,
    syncStatus: 'idle',
    doctrineLoaded: {},
    doctrineLoadingId: null,
    ceoConfig: { name: 'Gilang', title: 'Founder & CEO', subtitle: 'Ofiere Center' },
    zeroChatOpen: false,
    zeroChatTargetAgent: null,

    // ─── Initialize ─────────────────────────────────────────────────────

    initialize: async () => {
        set({ isLoading: true, error: null, syncStatus: 'syncing' });

        const gw = getGateway();

        // Step 1: Get real agent list from the capabilities store or config
        let agentIds: string[] = [];
        const capStore = useOpenClawCapabilitiesStore.getState();

        if (capStore.agents.length > 0) {
            // Already fetched — use the real agent IDs
            agentIds = capStore.agents.map(a => a.id);
        } else {
            // Try to fetch config to get agent list
            if (gw.isConnected) {
                try {
                    await capStore.fetchAll();
                    const freshState = useOpenClawCapabilitiesStore.getState();
                    agentIds = freshState.agents.map(a => a.id);
                } catch (err) {
                    console.warn('[Constellation] Could not fetch capabilities, using defaults');
                }
            }
        }

        // Fallback to defaults if gateway isn't connected
        if (agentIds.length === 0) {
            agentIds = Object.keys(AGENT_DEFAULTS);
        }

        // Step 2: Create empty agents with hierarchical positions
        const positions = getHierarchicalPositions(agentIds);
        const agents: Record<string, AgentArchitecture> = {};
        for (const id of agentIds) {
            agents[id] = {
                ...createEmptyAgent(id),
                position: positions[id] || { x: 400, y: 400 },
            };
        }

        // Also build relationships based on actual agent IDs
        // (filter out any default relationships that reference non-existent agents)
        const validRels = DEFAULT_RELATIONSHIPS.filter(
            r => agentIds.includes(r.sourceAgentId) && agentIds.includes(r.targetAgentId)
        );

        set({ agents, relationships: validRels, doctrineLoaded: {} });

        // Step 3: Load real files from gateway
        if (gw.isConnected) {
            await get().loadAllAgents();
        } else {
            set({ isLoading: false, syncStatus: 'idle' });
        }
    },

    // ─── Load Files ─────────────────────────────────────────────────────

    loadAgentFiles: async (agentId: string) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            console.warn(`[Constellation] Gateway not connected, can't load ${agentId}`);
            return;
        }

        try {
            // 1. List workspace files (same API as CoreFilesPanel)
            const listRes = await gw.request('agents.files.list', { agentId });
            const fileList: Array<{ name: string; size: number; modified: number }> =
                listRes?.files ?? (Array.isArray(listRes) ? listRes : []);

            console.log(`[Constellation] ${agentId}: found ${fileList.length} files:`,
                fileList.map(f => f.name));

            // 2. Fetch content for each .md file EXCEPT doctrine files (those are lazy-loaded)
            const doctrineNames = DOCTRINE_FILE_NAMES.map(n => n.toLowerCase());
            const mdFiles = fileList.filter(f => f.name.endsWith('.md'));
            const nonDoctrineFiles = mdFiles.filter(
                f => !doctrineNames.includes(f.name.toLowerCase())
            );

            const fileContents: Record<string, string> = {};
            const agentFiles: AgentFile[] = [];

            for (const file of nonDoctrineFiles) {
                try {
                    const res = await gw.request('agents.files.get', { agentId, name: file.name });

                    // Defensively extract content (same logic as capabilities store)
                    let content = '';
                    if (typeof res === 'string') {
                        content = res;
                    } else if (res && typeof res === 'object') {
                        content = res.content ?? res.text ?? res.body ?? res.data ?? '';
                        if (!content && res.file && typeof res.file === 'object') {
                            content = res.file.content ?? res.file.text ?? '';
                        }
                    }

                    fileContents[file.name] = content;
                    agentFiles.push({
                        name: file.name,
                        content,
                        size: file.size ?? content.length,
                        modified: file.modified ?? 0,
                        isDirty: false,
                        draftContent: null,
                    });
                } catch (e) {
                    console.warn(`[Constellation] Failed to load ${file.name} for ${agentId}:`, e);
                }
            }

            // Add doctrine files as placeholders (content empty, will be lazy-loaded)
            const doctrineInWorkspace = mdFiles.filter(
                f => doctrineNames.includes(f.name.toLowerCase())
            );
            for (const file of doctrineInWorkspace) {
                agentFiles.push({
                    name: file.name,
                    content: '',
                    size: file.size ?? 0,
                    modified: file.modified ?? 0,
                    isDirty: false,
                    draftContent: null,
                });
            }

            // Add non-md files for reference
            for (const file of fileList.filter(f => !f.name.endsWith('.md'))) {
                agentFiles.push({
                    name: file.name,
                    content: '',
                    size: file.size ?? 0,
                    modified: file.modified ?? 0,
                    isDirty: false,
                    draftContent: null,
                });
            }

            // 3. Parse into structured data (skip doctrine — lazy loaded)
            const parsed = parseAgentFiles(agentId, fileContents, true);

            // 4. Merge into existing agent — only override with non-empty parsed values
            const { agents } = get();
            const existing = agents[agentId] || createEmptyAgent(agentId);

            // Helper: merge only non-empty string/array fields from parsed into existing
            function mergeLayer<T extends Record<string, any>>(base: T, patch: Partial<T>): T {
                const result = { ...base };
                for (const [k, v] of Object.entries(patch)) {
                    if (v === undefined || v === null) continue;
                    if (typeof v === 'string' && v.trim() === '') continue;
                    if (Array.isArray(v) && v.length === 0) continue;
                    (result as any)[k] = v;
                }
                return result;
            }

            const updated: AgentArchitecture = {
                ...existing,
                files: agentFiles,
                roleCharter: mergeLayer(existing.roleCharter, parsed.roleCharter || {}),
                boundaries: mergeLayer(existing.boundaries, parsed.boundaries || {}),
                doctrine: mergeLayer(existing.doctrine, parsed.doctrine || {}),
                operationalProtocol: mergeLayer(existing.operationalProtocol, parsed.operationalProtocol || {}),
                memoryPolicy: mergeLayer(existing.memoryPolicy, parsed.memoryPolicy || {}),
                characterLayer: mergeLayer(existing.characterLayer, parsed.characterLayer || {}),
                identityCard: mergeLayer(existing.identityCard, parsed.identityCard || {}),
                userContext: mergeLayer(existing.userContext, parsed.userContext || {}),
                toolGuide: mergeLayer(existing.toolGuide, parsed.toolGuide || {}),
                heartbeat: mergeLayer(existing.heartbeat, parsed.heartbeat || {}),
            };

            // 5. Override top-level fields from parsed identity card
            // This ensures the node header shows the correct name/codename/role
            if (parsed.identityCard?.codename) updated.codename = parsed.identityCard.codename;
            if (parsed.identityCard?.role) updated.executiveRole = parsed.identityCard.role;
            if (parsed.identityCard?.name) updated.name = parsed.identityCard.name;

            // 6. Calculate build score
            updated.buildScore = calculateBuildScore(updated);

            console.log(`[Constellation] ${agentId}: name="${updated.name}" codename="${updated.codename}" role="${updated.executiveRole}" mission="${updated.roleCharter.mission?.slice(0, 50)}…"`);
            set({ agents: { ...agents, [agentId]: updated } });
        } catch (err: any) {
            console.error(`[Constellation] loadAgentFiles(${agentId}) failed:`, err);
        }
    },

    loadAllAgents: async () => {
        set({ isLoading: true, syncStatus: 'syncing', error: null });
        const agentIds = Object.keys(get().agents);

        try {
            for (const id of agentIds) {
                await get().loadAgentFiles(id);
            }
            set({ isLoading: false, syncStatus: 'synced' });
        } catch (err: any) {
            set({ isLoading: false, syncStatus: 'error', error: err?.message });
        }
    },

    // ─── Doctrine Lazy Loading ──────────────────────────────────────────

    loadDoctrine: async (agentId: string) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            console.warn(`[Constellation] Gateway not connected, can't load doctrine for ${agentId}`);
            return;
        }

        const { doctrineLoaded } = get();
        if (doctrineLoaded[agentId]) return; // Already loaded

        set({ doctrineLoadingId: agentId });

        try {
            const { agents } = get();
            const agent = agents[agentId];
            if (!agent) return;

            // Find doctrine files in the agent's file list
            const doctrineNames = DOCTRINE_FILE_NAMES.map(n => n.toLowerCase());
            const doctrineFiles = agent.files.filter(
                f => doctrineNames.includes(f.name.toLowerCase())
            );

            if (doctrineFiles.length === 0) {
                console.log(`[Constellation] No doctrine files found for ${agentId}`);
                set({
                    doctrineLoaded: { ...get().doctrineLoaded, [agentId]: true },
                    doctrineLoadingId: null,
                });
                return;
            }

            // Fetch doctrine file content
            const fileContents: Record<string, string> = {};
            const updatedFiles = [...agent.files];

            for (const file of doctrineFiles) {
                try {
                    const res = await gw.request('agents.files.get', { agentId, name: file.name });

                    let content = '';
                    if (typeof res === 'string') {
                        content = res;
                    } else if (res && typeof res === 'object') {
                        content = res.content ?? res.text ?? res.body ?? res.data ?? '';
                        if (!content && res.file && typeof res.file === 'object') {
                            content = res.file.content ?? res.file.text ?? '';
                        }
                    }

                    fileContents[file.name] = content;

                    // Update file content in the files array
                    const idx = updatedFiles.findIndex(f => f.name === file.name);
                    if (idx >= 0) {
                        updatedFiles[idx] = { ...updatedFiles[idx], content, size: content.length };
                    }

                    console.log(`[Constellation] Loaded doctrine ${file.name} for ${agentId}: ${content.length} chars`);
                } catch (e) {
                    console.warn(`[Constellation] Failed to load doctrine ${file.name} for ${agentId}:`, e);
                }
            }

            // Parse doctrine content
            let parsedDoctrine = agent.doctrine;
            for (const [fileName, content] of Object.entries(fileContents)) {
                const parsed = parseDoctrineMd(content);
                if (Object.keys(parsed).length > 0) {
                    parsedDoctrine = {
                        ...parsedDoctrine,
                        ...parsed,
                    };
                }
            }

            // Update agent
            const updated = {
                ...agent,
                files: updatedFiles,
                doctrine: parsedDoctrine,
            };
            updated.buildScore = calculateBuildScore(updated);

            set({
                agents: { ...get().agents, [agentId]: updated },
                doctrineLoaded: { ...get().doctrineLoaded, [agentId]: true },
                doctrineLoadingId: null,
            });
        } catch (err: any) {
            console.error(`[Constellation] loadDoctrine(${agentId}) failed:`, err);
            set({ doctrineLoadingId: null });
        }
    },

    saveDoctrine: async (agentId: string) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ error: 'Not connected to OpenClaw Gateway' });
            return;
        }

        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        set({ isSaving: true, error: null });

        try {
            // Serialize doctrine to markdown
            const { serializeDoctrineMd } = await import('@/lib/constellation/markdownSerializer');
            const doctrineContent = serializeDoctrineMd(agent.doctrine, agent.name, agent.codename);
            const fileName = `${agent.codename}.md`;

            // Write via gateway
            await gw.request('agents.files.set', {
                agentId,
                name: fileName,
                content: doctrineContent,
            });

            console.log(`[Constellation] Saved doctrine ${fileName} for ${agentId}`);

            // Update local file content
            const updatedFiles = agent.files.map(f =>
                f.name === fileName
                    ? { ...f, content: doctrineContent, size: doctrineContent.length, isDirty: false, draftContent: null }
                    : f
            );

            // If the file didn't exist, add it
            if (!updatedFiles.some(f => f.name === fileName)) {
                updatedFiles.push({
                    name: fileName,
                    content: doctrineContent,
                    size: doctrineContent.length,
                    modified: Date.now(),
                    isDirty: false,
                    draftContent: null,
                });
            }

            set({
                agents: { ...get().agents, [agentId]: { ...agent, files: updatedFiles } },
                isSaving: false,
            });
        } catch (err: any) {
            console.error(`[Constellation] saveDoctrine(${agentId}) failed:`, err);
            set({ isSaving: false, error: err?.message || 'Failed to save doctrine' });
        }
    },

    // ─── Save Files ─────────────────────────────────────────────────────

    saveAgentFiles: async (agentId: string) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ error: 'Not connected to OpenClaw Gateway' });
            return;
        }

        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        set({ isSaving: true, error: null });

        try {
            // Serialize structured data to markdown files
            const filesToWrite = serializeAgentToFiles(agent);

            // Also include any directly-edited file drafts (from the Files tab)
            for (const file of agent.files) {
                if (file.isDirty && file.draftContent !== null) {
                    filesToWrite[file.name] = file.draftContent;
                }
            }

            console.log(`[Constellation] Saving ${agentId}:`, Object.keys(filesToWrite));

            // Write each file to gateway (same API as CoreFilesPanel saveFile)
            for (const [fileName, content] of Object.entries(filesToWrite)) {
                try {
                    await gw.request('agents.files.set', {
                        agentId,
                        name: fileName,
                        content,
                    });
                    console.log(`[Constellation] Saved ${fileName} for ${agentId}`);
                } catch (e) {
                    console.error(`[Constellation] Failed to save ${fileName} for ${agentId}:`, e);
                    throw e;
                }
            }

            // Mark all files as clean and update their content
            const updatedFiles = agent.files.map(f => ({
                ...f,
                isDirty: false,
                draftContent: null,
                content: filesToWrite[f.name] ?? f.content,
            }));

            set({
                agents: {
                    ...get().agents,
                    [agentId]: { ...agent, files: updatedFiles },
                },
                isSaving: false,
            });

            // Reload to confirm the save took effect
            await get().loadAgentFiles(agentId);
        } catch (err: any) {
            console.error(`[Constellation] saveAgentFiles(${agentId}) failed:`, err);
            set({ isSaving: false, error: err?.message || 'Failed to save agent files' });
        }
    },

    saveAllDirtyAgents: async () => {
        const dirtyIds = get().getDirtyAgents();
        for (const id of dirtyIds) {
            await get().saveAgentFiles(id);
        }
    },

    // ─── Edit Actions ───────────────────────────────────────────────────
    // These modify the structured data locally AND mark the corresponding file as dirty.

    updateAgentField: (agentId, field, value) => {
        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        const updated = { ...agent, [field]: value };
        updated.buildScore = calculateBuildScore(updated);

        // Mark the corresponding file as dirty based on which field was updated
        const dirtyFileMap: Record<string, string> = {
            roleCharter: 'AGENTS.md',
            boundaries: 'AGENTS.md',
            operationalProtocol: 'AGENTS.md',
            characterLayer: 'SOUL.md',
            memoryPolicy: 'MEMORY.md',
            doctrine: `${agent.codename}.md`,
        };

        const dirtyFileName = dirtyFileMap[field as string];
        if (dirtyFileName) {
            updated.files = updated.files.map(f =>
                f.name === dirtyFileName ? { ...f, isDirty: true } : f
            );

            // If the file doesn't exist yet, add it as dirty
            if (!updated.files.some(f => f.name === dirtyFileName)) {
                updated.files.push({
                    name: dirtyFileName,
                    content: '',
                    size: 0,
                    modified: Date.now(),
                    isDirty: true,
                    draftContent: null,
                });
            }
        }

        set({ agents: { ...agents, [agentId]: updated } });
    },

    updateAgentFileContent: (agentId, fileName, content) => {
        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        const updatedFiles = agent.files.map(f =>
            f.name === fileName
                ? { ...f, draftContent: content, isDirty: content !== f.content }
                : f
        );

        set({
            agents: { ...agents, [agentId]: { ...agent, files: updatedFiles } },
        });
    },

    markFileDirty: (agentId, fileName) => {
        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        const updatedFiles = agent.files.map(f =>
            f.name === fileName ? { ...f, isDirty: true } : f
        );

        set({ agents: { ...agents, [agentId]: { ...agent, files: updatedFiles } } });
    },

    // ─── UI Actions ─────────────────────────────────────────────────────

    selectAgent: (agentId) => set({ selectedAgentId: agentId }),

    openDrawer: (agentId, tab = 'overview') => set({
        selectedAgentId: agentId,
        drawerOpen: true,
        drawerTab: tab,
    }),

    closeDrawer: () => set({ drawerOpen: false }),
    setDrawerTab: (tab) => set({ drawerTab: tab }),

    toggleZeroChat: (targetAgentId) => {
        const { zeroChatOpen } = get();
        set({
            zeroChatOpen: !zeroChatOpen,
            zeroChatTargetAgent: targetAgentId || get().zeroChatTargetAgent,
        });
    },

    // ─── Relationship Actions ───────────────────────────────────────────

    addRelationship: (rel) => {
        const id = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        set({ relationships: [...get().relationships, { ...rel, id }] });
    },

    removeRelationship: (id) => {
        set({ relationships: get().relationships.filter(r => r.id !== id) });
    },

    updateRelationship: (id, updates) => {
        set({
            relationships: get().relationships.map(r =>
                r.id === id ? { ...r, ...updates } : r
            ),
        });
    },

    // ─── Position ───────────────────────────────────────────────────────

    updateAgentPosition: (agentId, position) => {
        const { agents } = get();
        const agent = agents[agentId];
        if (!agent) return;

        set({ agents: { ...agents, [agentId]: { ...agent, position } } });
    },
    // ─── CEO Config ─────────────────────────────────────────────────────

    updateCEOConfig: (field, value) => {
        const { ceoConfig } = get();
        set({ ceoConfig: { ...ceoConfig, [field]: value } });
    },

    // ─── Derived ────────────────────────────────────────────────────────

    getDirtyAgents: () => {
        const { agents } = get();
        return Object.entries(agents)
            .filter(([_, agent]) => agent.files.some(f => f.isDirty))
            .map(([id]) => id);
    },

    hasUnsavedChanges: () => {
        return get().getDirtyAgents().length > 0;
    },
}));
