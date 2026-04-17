// stores/useOpenClawCapabilitiesStore.ts
// New Zustand store for OpenClaw-native capabilities management.
// All data comes from the OpenClaw Gateway via WebSocket RPC.
// No local database persistence.

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';
import {
    deriveGlobalToolState,
    derivePerAgentToolState,
    deriveGlobalSkillState,
    derivePerAgentSkillState,
    parseAgentsFromConfig,
    parseCatalogTools,
    parseSkillStatuses,
    type OpenClawTool,
    type OpenClawSkill,
    type OpenClawAgent,
    type SkillGroup,
} from '@/lib/openclaw/capabilities';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Try to parse config.get `raw` field into an object. Handles JSON5-style configs. */
function parseConfigRaw(configRes: any): { config: any; hash: string | null } {
    if (!configRes) return { config: {}, hash: null };

    const hash = configRes.hash || null;

    // If configRes already has a structured config field, use it directly
    if (configRes.config && typeof configRes.config === 'object') {
        return { config: configRes.config, hash };
    }

    // configRes.raw is the raw config file string (JSON5/JSONC format)
    const raw = configRes.raw;
    if (typeof raw === 'string') {
        try {
            // Try standard JSON.parse first
            return { config: JSON.parse(raw), hash };
        } catch {
            // JSON5-style: unquoted keys, single-quoted strings, trailing commas
            // Attempt a lenient parse
            try {
                const sanitized = raw
                    // Replace single-quoted strings with double-quoted
                    .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
                    // Quote unquoted keys (word chars before colon)
                    .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
                    // Remove trailing commas before } or ]
                    .replace(/,\s*([\]}])/g, '$1')
                    // Remove comments
                    .replace(/\/\/.*/g, '')
                    .replace(/\/\*[\s\S]*?\*\//g, '');
                return { config: JSON.parse(sanitized), hash };
            } catch (e2) {
                console.warn('[Capabilities] Failed to parse config.raw:', e2);
            }
        }
    }

    // Fallback: use the response object itself (minus meta fields)
    const { path, exists, raw: _raw, ...rest } = configRes;
    if (Object.keys(rest).length > 0) {
        return { config: rest, hash };
    }

    return { config: {}, hash };
}

/** Serialize any error into a readable string */
function errMsg(err: any, fallback: string): string {
    if (typeof err === 'string') return err;
    if (err?.message) return err.message;
    if (err?.error) return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    if (typeof err === 'object') {
        const s = JSON.stringify(err);
        return s === '{}' ? fallback : s;
    }
    return String(err) || fallback;
}

// ─── State Interface ────────────────────────────────────────────────────────

interface WorkspaceFile {
    name: string;
    size: number;
    modified: number; // unix timestamp ms
}

interface OpenClawCapabilitiesState {
    // UI State
    activeTab: 'per-agent' | 'global' | 'core-files';
    selectedAgentId: string | null;

    // Data from Gateway
    agents: OpenClawAgent[];
    globalTools: OpenClawTool[];
    globalSkills: OpenClawSkill[];
    perAgentTools: Record<string, OpenClawTool[]>;
    perAgentSkills: Record<string, OpenClawSkill[]>;
    perAgentSkillStatusesCache: Record<string, any[]>;

    // Skill management
    skillGroups: SkillGroup[];
    _installedSkillsMeta: Record<string, { key: string; name: string; description?: string; source?: string; sourceUrl?: string; enabled: boolean }>;

    // Raw config cache (for patching)
    rawConfig: any | null;
    draftConfig: any | null;
    configHash: string | null;

    // Buffering State
    hasUnsavedChanges: boolean;
    catalogToolsCache: any[];
    skillStatusesCache: any[];

    // Core Files State
    workspaceFiles: WorkspaceFile[];
    selectedFileName: string | null;
    selectedFileContent: string | null;
    selectedFilePath: string | null;
    fileDraftContent: string | null;
    isFileDirty: boolean;
    isFilesLoading: boolean;
    isFileContentLoading: boolean;
    isFileSaving: boolean;
    fileError: string | null;

    // Loading & Error
    isLoading: boolean;
    error: string | null;
    togglingItems: Set<string>; // keys of items currently being toggled
    isApplying: boolean;

    // Actions
    setActiveTab: (tab: 'per-agent' | 'global' | 'core-files') => void;
    setSelectedAgentId: (id: string | null) => void;
    fetchAll: () => Promise<void>;
    applyChanges: () => Promise<void>;
    discardChanges: () => void;
    toggleGlobalTool: (toolName: string, allowed: boolean) => void;
    toggleGlobalSkill: (skillKey: string, enabled: boolean) => void;
    togglePerAgentTool: (agentId: string, toolName: string, allowed: boolean) => void;
    togglePerAgentSkill: (agentId: string, skillKey: string, enabled: boolean) => void;

    // Skill management actions
    installSkill: (skill: { key: string; name: string; description?: string; source: 'github' | 'skill.sh' | 'manual'; sourceUrl?: string; content?: string; compatibilityNote?: string }) => void;
    installPerAgentSkill: (agentId: string, skill: { key: string; name: string; description?: string; source: 'github' | 'skill.sh' | 'manual'; sourceUrl?: string; content?: string; compatibilityNote?: string }) => void;
    deleteSkill: (skillKey: string) => void;
    renameSkill: (skillKey: string, newName: string) => void;
    setSkillTags: (skillKey: string, tags: string[]) => void;
    batchDeploySkills: (agentId: string, skills: any[], githubUrl: string) => void;
    handleInstallConfirmation: (agentId: string, installedKeys: string[]) => void;
    createSkillGroup: (name: string) => void;
    renameSkillGroup: (groupId: string, name: string) => void;
    deleteSkillGroup: (groupId: string) => void;

    // Core Files Actions
    fetchWorkspaceFiles: (agentId: string) => Promise<void>;
    selectFile: (agentId: string, fileName: string) => Promise<void>;
    updateFileDraft: (content: string) => void;
    saveFile: (agentId: string) => Promise<void>;
    resetFileDraft: () => void;
    clearFileSelection: () => void;
}

// ─── Helper: Send GitHub URL to agent so THEY clone and install ──────────────
async function _sendInstallCommand(gw: any, agentId: string, githubUrl: string, skills: any[] = []) {
    try {
        const sessionKey = `agent:${agentId}:main`;
        const idempotencyKey = `skill-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        
        const skillNames = skills?.length ? skills.map(s => s.name || s.key).join(', ') : 'Unknown Skill';
        const skillDesc = skills?.length ? skills.map(s => s.description).filter(Boolean).join(' | ') : '';

        const message = `Install this skill from GitHub into your skills directory. Git clone it and make sure all files are properly accessible.
Repo: ${githubUrl}

If the skills weren't originally made for OpenClaw, then read it and figure it out. Make it work.

After cloning, you must update your documentation. A new workspace skill has been installed for this agent.

Inputs:
- agent workspace: \`./\`
- tools file: \`TOOLS.md\`
- skill name: \`${skillNames}\`
- skill file: (the files you just cloned)
- optional installer summary: \`${skillDesc}\`

Task:
Update your agent-local \`TOOLS.md\` so its skill guide remains current and cumulative.

Instructions:
1. Read the current \`TOOLS.md\` before editing.
2. Read the skill files before writing the skill entry.
3. Edit only this agent’s own \`TOOLS.md\`.
4. Continue the existing skill guide if present; if none exists, create a small local skill guide section.
5. Only document workspace-local or agent-specific skills unless \`TOOLS.md\` explicitly requires a broader catalog.
6. Add or revise the skill entry in this exact format:

\`- **[skill_name]** — one-sentence description. Use for: primary use cases. Avoid when: obvious boundary or non-fit.\`

7. Keep the entry concise, specific, action-oriented, and consistent with the existing file style.
8. If the new skill overlaps with an existing one, clarify the distinction and prefer the more specific skill.
9. Preserve all other \`TOOLS.md\` content, including persona rules, tool rules, formatting, and existing sections.
10. Make the smallest precise edit possible; do not replace the whole file unless necessary.

When done, reply with:
[SKILLS_INSTALLED]
repo: ${githubUrl}
skills: (list the skill folder names, comma separated)
[/SKILLS_INSTALLED]`;

        await gw.request('chat.send', { sessionKey, message, idempotencyKey });
        console.log(`[Capabilities] ✓ Sent install command for ${githubUrl} to agent ${agentId}`);
    } catch (err: any) {
        console.error(`[Capabilities] Failed to send install command to ${agentId}:`, err?.message || JSON.stringify(err));
    }
}


export const useOpenClawCapabilitiesStore = create<OpenClawCapabilitiesState>((set, get) => ({
    // Initial state
    activeTab: 'global',
    selectedAgentId: null,

    agents: [],
    globalTools: [],
    globalSkills: [],
    perAgentTools: {},
    perAgentSkills: {},
    perAgentSkillStatusesCache: {},

    skillGroups: [],
    _installedSkillsMeta: (() => {
        try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem('ofiere_installed_skills') : null;
            return stored ? JSON.parse(stored) : {};
        } catch { return {}; }
    })(),

    rawConfig: null,
    draftConfig: null,
    configHash: null,

    hasUnsavedChanges: false,
    catalogToolsCache: [],
    skillStatusesCache: [],

    // Core Files initial state
    workspaceFiles: [],
    selectedFileName: null,
    selectedFileContent: null,
    selectedFilePath: null,
    fileDraftContent: null,
    isFileDirty: false,
    isFilesLoading: false,
    isFileContentLoading: false,
    isFileSaving: false,
    fileError: null,

    isLoading: false,
    error: null,
    togglingItems: new Set(),
    isApplying: false,

    // ─── UI Actions ─────────────────────────────────────────────────────

    setActiveTab: (tab) => set({ activeTab: tab }),
    setSelectedAgentId: (id) => set({ selectedAgentId: id }),

    // ─── fetchAll ───────────────────────────────────────────────────────

    fetchAll: async () => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ error: 'Not connected to OpenClaw Gateway', isLoading: false });
            return;
        }

        set({ isLoading: true, error: null });

        try {
            // 1. Fetch config and skills status
            const [configRes, skillsRes] = await Promise.all([
                gw.request('config.get', {}).catch((e) => { console.warn('[Capabilities] config.get failed:', e); return null; }),
                gw.request('skills.status', {}).catch((e) => { console.warn('[Capabilities] skills.status failed:', e); return null; }),
            ]);

            // 2. Parse config from raw JSON5 string
            const { config, hash } = parseConfigRaw(configRes);
            console.log('[Capabilities] Parsed config keys:', Object.keys(config));

            // 3. Parse agents and determine IDs
            const agents = parseAgentsFromConfig(config);
            console.log('[Capabilities] Agents:', agents);

            // 4. Fetch tools catalog — use first agent's ID, then fallback to no agentId
            let catalogRes: any = null;
            const firstAgentId = agents.length > 0 ? agents[0].id : null;

            if (firstAgentId) {
                catalogRes = await gw.request('tools.catalog', { agentId: firstAgentId })
                    .catch((e) => { console.warn(`[Capabilities] tools.catalog(${firstAgentId}) failed:`, e); return null; });
            }
            if (!catalogRes) {
                catalogRes = await gw.request('tools.catalog', {})
                    .catch((e) => { console.warn('[Capabilities] tools.catalog({}) failed:', e); return null; });
            }

            console.log('[Capabilities] tools.catalog response:', JSON.stringify(catalogRes)?.slice(0, 500));

            // 5. Parse catalog tools
            const catalogTools = parseCatalogTools(catalogRes);
            console.log('[Capabilities] Parsed catalog tools:', catalogTools.length, catalogTools.slice(0, 3));

            // 6. Derive global tool state
            const globalTools = deriveGlobalToolState(catalogTools, config);

            // 7. Parse skills — The config uses `plugins.entries` for skill settings
            const skillStatuses = parseSkillStatuses(skillsRes);

            // Map config.plugins.entries to the format deriveGlobalSkillState expects
            const skillConfig = {
                skills: {
                    entries: config?.plugins?.entries ?? config?.skills?.entries ?? {},
                },
            };
            const globalSkills = deriveGlobalSkillState(skillStatuses, skillConfig);
            const globalSkillKeys = new Set(skillStatuses.map(s => s.key));
            console.log('[Capabilities] Global skills:', globalSkills.length, 'enabled:', globalSkills.filter(s => s.enabled).length);

            // 8. Derive per-agent states — fetch agent-specific skill statuses
            const perAgentTools: Record<string, OpenClawTool[]> = {};
            const perAgentSkills: Record<string, OpenClawSkill[]> = {};
            const perAgentSkillStatusesCache: Record<string, any[]> = {};

            const agentsList = config?.agents?.list || config?.agents;
            if (Array.isArray(agentsList)) {
                // Fetch per-agent skill statuses in parallel
                const agentSkillFetches = agentsList
                    .filter((a: any) => a.id || a.agentId)
                    .map(async (agent: any) => {
                        const agentId = agent.id || agent.agentId;
                        try {
                            const agentSkillsRes = await gw.request('skills.status', { agentId });
                            const agentSkillStatuses = parseSkillStatuses(agentSkillsRes);
                            console.log(`[Capabilities] Agent ${agentId} skills:`, agentSkillStatuses.length);
                            return { agentId, agent, statuses: agentSkillStatuses };
                        } catch (e) {
                            console.warn(`[Capabilities] skills.status(${agentId}) failed, falling back to global:`, e);
                            return { agentId, agent, statuses: null };
                        }
                    });

                const agentResults = await Promise.all(agentSkillFetches);

                for (const { agentId, agent, statuses } of agentResults) {
                    perAgentTools[agentId] = derivePerAgentToolState(
                        catalogTools,
                        agent,
                        globalTools
                    );

                    // Use agent-specific statuses if available, fall back to global
                    const effectiveStatuses = statuses ?? skillStatuses;
                    perAgentSkillStatusesCache[agentId] = effectiveStatuses;

                    perAgentSkills[agentId] = derivePerAgentSkillState(
                        effectiveStatuses,
                        skillConfig,
                        agentId,
                        globalSkillKeys
                    );
                }
            }

            // Parse skill groups from config
            const skillGroups: SkillGroup[] = (config?.plugins?.skillGroups ?? config?.skills?.skillGroups ?? []).map((g: any) => ({
                id: g.id || crypto.randomUUID(),
                name: g.name || 'Unnamed Group',
            }));

            // Enrich skills with source/tags from config entries
            const enrichSkills = (skills: OpenClawSkill[]): OpenClawSkill[] => {
                const entries = config?.plugins?.entries ?? config?.skills?.entries ?? {};
                return skills.map(s => {
                    const entry = entries[s.key];
                    return {
                        ...s,
                        source: entry?.source ?? 'inherited',
                        sourceUrl: entry?.sourceUrl ?? undefined,
                        tags: entry?.tags ?? [],
                    };
                });
            };

            // Merge locally-installed skill metadata ONLY into per-agent caches
            // (not global — global should only reflect what the gateway reports)
            const installedMeta = get()._installedSkillsMeta || {};
            for (const [key, meta] of Object.entries(installedMeta)) {
                const m = meta as any;
                const targetAgentId = m.agentId;
                if (!targetAgentId) continue; // Skip global entries — they're ghost data

                // Add to the specific agent's cache only
                const agentCache = perAgentSkillStatusesCache[targetAgentId] || [];
                if (!agentCache.some((s: any) => s.key === key)) {
                    perAgentSkillStatusesCache[targetAgentId] = [
                        ...agentCache,
                        { key, name: m.name || key, description: m.description || '', eligible: true },
                    ];
                }
            }

            // Re-derive with clean data (no localStorage pollution)
            const finalGlobalSkills = deriveGlobalSkillState(skillStatuses, skillConfig);

            set({
                agents,
                globalTools,
                globalSkills: enrichSkills(finalGlobalSkills),
                perAgentTools,
                perAgentSkills: Object.fromEntries(
                    Object.entries(perAgentSkills).map(([k, v]) => [k, enrichSkills(v)])
                ),
                rawConfig: config,
                draftConfig: JSON.parse(JSON.stringify(config)),
                configHash: hash,
                hasUnsavedChanges: false,
                catalogToolsCache: catalogTools,
                skillStatusesCache: skillStatuses,
                perAgentSkillStatusesCache,
                skillGroups,
                isLoading: false,
                error: null,
            });
        } catch (err: any) {
            console.error('[Capabilities] fetchAll failed:', err);
            set({
                isLoading: false,
                error: errMsg(err, 'Failed to fetch capabilities from Gateway'),
            });
        }
    },

    // ─── applyChanges & discardChanges ──────────────────────────────────

    applyChanges: async () => {
        const gw = getGateway();
        if (!gw.isConnected) return;

        const { draftConfig, configHash } = get();
        if (!draftConfig) return;

        set({ isApplying: true, error: null });

        try {
            // Deep clone and strip UI-only fields (content, compatibilityNote) from plugin entries
            // before sending to the gateway — these are large blobs that don't belong in the config file
            const cleanConfig = JSON.parse(JSON.stringify(draftConfig));

            // Strip from global plugins.entries — only `enabled`, `env`, `config`, `apiKey` are valid
            if (cleanConfig.plugins?.entries) {
                for (const [key, entry] of Object.entries(cleanConfig.plugins.entries) as [string, any][]) {
                    // Keep only gateway-valid keys
                    cleanConfig.plugins.entries[key] = {
                        ...(entry.enabled !== undefined ? { enabled: entry.enabled } : {}),
                        ...(entry.env ? { env: entry.env } : {}),
                        ...(entry.config ? { config: entry.config } : {}),
                        ...(entry.apiKey ? { apiKey: entry.apiKey } : {}),
                    };
                }
            }

            // Strip `plugins` from agent objects — gateway schema doesn't allow it at agent level
            const agentsList = cleanConfig.agents?.list || cleanConfig.agents;
            if (Array.isArray(agentsList)) {
                for (const agent of agentsList) {
                    delete agent.plugins;
                }
            }

            // Strip dashboard-only installed skills from plugins.entries
            // These exist only in _installedSkillsMeta and would cause config.patch to fail
            const installedMeta = get()._installedSkillsMeta || {};
            if (cleanConfig.plugins?.entries) {
                for (const key of Object.keys(installedMeta)) {
                    delete cleanConfig.plugins.entries[key];
                }
                // Remove plugins.entries entirely if empty
                if (Object.keys(cleanConfig.plugins.entries).length === 0) {
                    delete cleanConfig.plugins.entries;
                }
                // Remove plugins entirely if empty
                if (cleanConfig.plugins && Object.keys(cleanConfig.plugins).length === 0) {
                    delete cleanConfig.plugins;
                }
            }

            console.log('[Capabilities] Sending config.patch, size:', JSON.stringify(cleanConfig).length);

            await gw.request('config.patch', {
                raw: JSON.stringify(cleanConfig),
                baseHash: configHash,
            });

            // Re-fetch to confirm changes
            await get().fetchAll();
        } catch (err: any) {
            console.error('[Capabilities] applyChanges failed:', err, JSON.stringify(err));
            set({ error: errMsg(err, 'Failed to apply configuration changes'), isApplying: false });
        }
    },

    discardChanges: () => {
        const { rawConfig, selectedFileContent } = get();
        if (!rawConfig) return;

        // Reset draft to raw, then re-derive state
        const draftConfig = JSON.parse(JSON.stringify(rawConfig));
        set({
            draftConfig,
            hasUnsavedChanges: false,
            // Also reset file draft if dirty
            fileDraftContent: selectedFileContent,
            isFileDirty: false,
        });
        
        // Re-run derivations
        const s = get();
        const skillConfig = { skills: { entries: { ...(draftConfig?.plugins?.entries ?? draftConfig?.skills?.entries ?? {}) } } };
        // Merge dashboard-installed skills so they derive as enabled
        const installedMeta1 = get()._installedSkillsMeta || {};
        for (const [key, meta] of Object.entries(installedMeta1)) {
            if (!skillConfig.skills.entries[key]) {
                skillConfig.skills.entries[key] = { enabled: (meta as any).enabled !== false };
            }
        }
        
        const globalTools = deriveGlobalToolState(s.catalogToolsCache, draftConfig);
        const globalSkills = deriveGlobalSkillState(s.skillStatusesCache, skillConfig);

        const perAgentTools: Record<string, OpenClawTool[]> = {};
        const perAgentSkills: Record<string, OpenClawSkill[]> = {};

        const agentsList = draftConfig?.agents?.list || draftConfig?.agents;
        if (Array.isArray(agentsList)) {
            for (const agent of agentsList) {
                const agentId = agent.id || agent.agentId;
                if (!agentId) continue;
                perAgentTools[agentId] = derivePerAgentToolState(s.catalogToolsCache, agent, globalTools);
                const agentStatuses = s.perAgentSkillStatusesCache[agentId] ?? s.skillStatusesCache;
                const globalSkillKeys = new Set(s.skillStatusesCache.map((sk: any) => sk.key));
                perAgentSkills[agentId] = derivePerAgentSkillState(agentStatuses, skillConfig, agentId, globalSkillKeys);
            }
        }

        set({ globalTools, globalSkills, perAgentTools, perAgentSkills });
    },

    // ─── Local State Derivation Helper ──────────────────────────────────
    
    _rederiveLocalState: () => {
        const s = get();
        const draftConfig = s.draftConfig;
        if (!draftConfig) return;

        const skillConfig = { skills: { entries: { ...(draftConfig?.plugins?.entries ?? draftConfig?.skills?.entries ?? {}) } } };
        // Merge dashboard-installed skills so they derive as enabled
        const installedMeta2 = (s as any)._installedSkillsMeta || {};
        for (const [key, meta] of Object.entries(installedMeta2)) {
            if (!skillConfig.skills.entries[key]) {
                skillConfig.skills.entries[key] = { enabled: (meta as any).enabled !== false };
            }
        }
        
        const globalTools = deriveGlobalToolState(s.catalogToolsCache, draftConfig);
        const globalSkills = deriveGlobalSkillState(s.skillStatusesCache, skillConfig);

        const perAgentTools: Record<string, OpenClawTool[]> = {};
        const perAgentSkills: Record<string, OpenClawSkill[]> = {};

        const agentsList = draftConfig?.agents?.list || draftConfig?.agents;
        if (Array.isArray(agentsList)) {
            for (const agent of agentsList) {
                const agentId = agent.id || agent.agentId;
                if (!agentId) continue;
                perAgentTools[agentId] = derivePerAgentToolState(s.catalogToolsCache, agent, globalTools);
                const agentStatuses = s.perAgentSkillStatusesCache[agentId] ?? s.skillStatusesCache;
                const globalSkillKeys = new Set(s.skillStatusesCache.map((sk: any) => sk.key));
                perAgentSkills[agentId] = derivePerAgentSkillState(agentStatuses, skillConfig, agentId, globalSkillKeys);
            }
        }

        set({
            globalTools,
            globalSkills,
            perAgentTools,
            perAgentSkills,
            hasUnsavedChanges: true,
        });
    },

    // ─── toggleGlobalTool ───────────────────────────────────────────────

    toggleGlobalTool: (toolName, allowed) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.tools) draftConfig.tools = {};
        const currentAllow = Array.isArray(draftConfig.tools.allow) ? draftConfig.tools.allow : [];
        const currentDeny = Array.isArray(draftConfig.tools.deny) ? draftConfig.tools.deny : [];

        if (allowed) {
            if (!currentAllow.includes(toolName)) draftConfig.tools.allow = [...currentAllow, toolName];
            draftConfig.tools.deny = currentDeny.filter((t: string) => t !== toolName);
        } else {
            if (!currentDeny.includes(toolName)) draftConfig.tools.deny = [...currentDeny, toolName];
            draftConfig.tools.allow = currentAllow.filter((t: string) => t !== toolName);
        }

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── toggleGlobalSkill ──────────────────────────────────────────────

    toggleGlobalSkill: (skillKey, enabled) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.entries) draftConfig.plugins.entries = {};
        if (!draftConfig.plugins.entries[skillKey]) draftConfig.plugins.entries[skillKey] = {};

        draftConfig.plugins.entries[skillKey].enabled = enabled;

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── togglePerAgentTool ─────────────────────────────────────────────

    togglePerAgentTool: (agentId, toolName, allowed) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        const agentsList = draftConfig.agents?.list || draftConfig.agents;
        if (!Array.isArray(agentsList)) return;

        const agent = agentsList.find((a: any) => (a.id || a.agentId) === agentId);
        if (!agent) return;

        if (!agent.tools) agent.tools = {};
        const currentAllow = Array.isArray(agent.tools.allow) ? agent.tools.allow : [];
        const currentDeny = Array.isArray(agent.tools.deny) ? agent.tools.deny : [];

        if (allowed) {
            if (!currentAllow.includes(toolName)) agent.tools.allow = [...currentAllow, toolName];
            agent.tools.deny = currentDeny.filter((t: string) => t !== toolName);
        } else {
            if (!currentDeny.includes(toolName)) agent.tools.deny = [...currentDeny, toolName];
            agent.tools.allow = currentAllow.filter((t: string) => t !== toolName);
        }

        set({ draftConfig });
        _rederiveLocalState();
    },

    // ─── togglePerAgentSkill ────────────────────────────────────────────
    
    togglePerAgentSkill: (_agentId, skillKey, enabled) => {
        // Delegate to global toggle
        get().toggleGlobalSkill(skillKey, enabled);
    },

    // ─── Core Files Actions ─────────────────────────────────────────────

    fetchWorkspaceFiles: async (agentId) => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ fileError: 'Not connected to OpenClaw Gateway', isFilesLoading: false });
            return;
        }

        set({ isFilesLoading: true, fileError: null });

        try {
            const res = await gw.request('agents.files.list', { agentId });
            const files = res?.files ?? (Array.isArray(res) ? res : []);
            set({
                workspaceFiles: files.map((f: any) => ({
                    name: f.name,
                    size: f.size ?? 0,
                    modified: f.modified ?? 0,
                })),
                isFilesLoading: false,
            });
        } catch (err: any) {
            console.error('[Capabilities] fetchWorkspaceFiles failed:', err);
            set({
                isFilesLoading: false,
                fileError: err?.message || 'Failed to load workspace files',
            });
        }
    },

    selectFile: async (agentId, fileName) => {
        const gw = getGateway();
        if (!gw.isConnected) return;

        set({
            selectedFileName: fileName,
            isFileContentLoading: true,
            fileError: null,
        });

        try {
            const res = await gw.request('agents.files.get', { agentId, name: fileName });
            console.log('[Capabilities] agents.files.get response:', JSON.stringify(res).slice(0, 500));

            // Defensively extract content — the response shape may vary
            let content = '';
            let path: string | null = null;

            if (typeof res === 'string') {
                // Direct string response
                content = res;
            } else if (res && typeof res === 'object') {
                // Try common field names
                content = res.content ?? res.text ?? res.body ?? res.data ?? '';
                path = res.path ?? res.filePath ?? null;

                // Maybe content is nested under a payload or file key
                if (!content && res.file && typeof res.file === 'object') {
                    content = res.file.content ?? res.file.text ?? '';
                    path = (path || res.file.path) ?? null;
                }

                // If content is still empty but there are keys, log them for debugging
                if (!content) {
                    console.warn('[Capabilities] agents.files.get returned object with no content field. Keys:', Object.keys(res));
                }
            }

            set({
                selectedFileContent: content,
                selectedFilePath: path,
                fileDraftContent: content,
                isFileDirty: false,
                isFileContentLoading: false,
            });
        } catch (err: any) {
            console.error('[Capabilities] selectFile failed:', err);
            set({
                isFileContentLoading: false,
                fileError: err?.message || 'Failed to load file content',
            });
        }
    },

    updateFileDraft: (content) => {
        const selectedFileContent = get().selectedFileContent;
        set({
            fileDraftContent: content,
            isFileDirty: content !== selectedFileContent,
            hasUnsavedChanges: content !== selectedFileContent || get().hasUnsavedChanges,
        });
    },

    saveFile: async (agentId) => {
        const { isFileDirty, selectedFileName, fileDraftContent } = get();
        if (!isFileDirty || !selectedFileName || fileDraftContent === null) return;

        const gw = getGateway();
        if (!gw.isConnected) return;

        set({ isFileSaving: true, fileError: null });

        try {
            await gw.request('agents.files.set', {
                agentId,
                name: selectedFileName,
                content: fileDraftContent,
            });

            set({
                selectedFileContent: fileDraftContent,
                isFileDirty: false,
                isFileSaving: false,
            });

            // Re-fetch file list to update size/modified
            await get().fetchWorkspaceFiles(agentId);
        } catch (err: any) {
            console.error('[Capabilities] saveFile failed:', err);
            set({
                isFileSaving: false,
                fileError: err?.message || 'Failed to save file',
            });
        }
    },

    resetFileDraft: () => {
        const selectedFileContent = get().selectedFileContent;
        set({
            fileDraftContent: selectedFileContent,
            isFileDirty: false,
        });
    },

    clearFileSelection: () => {
        set({
            selectedFileName: null,
            selectedFileContent: null,
            selectedFilePath: null,
            fileDraftContent: null,
            isFileDirty: false,
            fileError: null,
        });
    },

    // ─── Skill Management Actions ───────────────────────────────────────

    installSkill: (skill) => {
        const { skillStatusesCache, _installedSkillsMeta, _rederiveLocalState } = get() as any;

        // Persist to localStorage for UI tracking (no gateway calls)
        const updatedMeta = {
            ..._installedSkillsMeta,
            [skill.key]: {
                key: skill.key,
                name: skill.name,
                description: skill.description,
                source: skill.source,
                sourceUrl: skill.sourceUrl,
                enabled: true,
            },
        };
        try { localStorage.setItem('ofiere_installed_skills', JSON.stringify(updatedMeta)); } catch {}

        // Update UI cache
        const alreadyInCache = skillStatusesCache.some((s: any) => s.key === skill.key);
        if (!alreadyInCache) {
            set({
                skillStatusesCache: [
                    ...skillStatusesCache,
                    { key: skill.key, name: skill.name, description: skill.description, eligible: true },
                ],
            });
        }

        set({ _installedSkillsMeta: updatedMeta });
        _rederiveLocalState();
    },

    installPerAgentSkill: (agentId, skill) => {
        const { skillStatusesCache, perAgentSkillStatusesCache, _installedSkillsMeta, _rederiveLocalState } = get() as any;

        // Persist to localStorage (no gateway calls — use batchDeploySkills after)
        const updatedMeta = {
            ..._installedSkillsMeta,
            [skill.key]: {
                key: skill.key,
                name: skill.name,
                description: skill.description,
                source: skill.source,
                sourceUrl: skill.sourceUrl,
                enabled: true,
                agentId,
            },
        };
        try { localStorage.setItem('ofiere_installed_skills', JSON.stringify(updatedMeta)); } catch {}

        // Update UI caches
        const alreadyInGlobalCache = skillStatusesCache.some((s: any) => s.key === skill.key);
        if (!alreadyInGlobalCache) {
            set({
                skillStatusesCache: [
                    ...skillStatusesCache,
                    { key: skill.key, name: skill.name, description: skill.description, eligible: true },
                ],
            });
        }

        const agentCache = perAgentSkillStatusesCache[agentId] || [];
        const alreadyInAgentCache = agentCache.some((s: any) => s.key === skill.key);
        if (!alreadyInAgentCache) {
            set({
                perAgentSkillStatusesCache: {
                    ...perAgentSkillStatusesCache,
                    [agentId]: [
                        ...agentCache,
                        { key: skill.key, name: skill.name, description: skill.description, eligible: true },
                    ],
                },
            });
        }

        set({ _installedSkillsMeta: updatedMeta });
        _rederiveLocalState();
    },

    batchDeploySkills: (agentId: string, _skills: any[], githubUrl: string) => {
        const gw = getGateway();
        if (!gw.isConnected || !githubUrl) return;
        _sendInstallCommand(gw, agentId, githubUrl, _skills);
    },

    // ─── Process agent's install confirmation ────────────────────────────
    handleInstallConfirmation: (agentId: string, installedKeys: string[]) => {
        const { _installedSkillsMeta, _rederiveLocalState } = get() as any;

        const updatedMeta = { ..._installedSkillsMeta };
        for (const key of installedKeys) {
            if (updatedMeta[key]) {
                updatedMeta[key] = { ...updatedMeta[key], confirmed: true };
            }
        }
        try { localStorage.setItem('ofiere_installed_skills', JSON.stringify(updatedMeta)); } catch {}
        set({ _installedSkillsMeta: updatedMeta });
        _rederiveLocalState();
        console.log(`[Capabilities] ✓ Agent ${agentId} confirmed installation of: ${installedKeys.join(', ')}`);
    },

    deleteSkill: (skillKey) => {
        const { draftConfig, skillStatusesCache, _installedSkillsMeta, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        // Remove from plugins.entries
        if (draftConfig.plugins?.entries?.[skillKey]) {
            delete draftConfig.plugins.entries[skillKey];
        }

        // Remove from _installedSkillsMeta + localStorage
        const updatedMeta = { ..._installedSkillsMeta };
        delete updatedMeta[skillKey];
        try { localStorage.setItem('ofiere_installed_skills', JSON.stringify(updatedMeta)); } catch {}

        // Remove from cache
        set({
            draftConfig,
            skillStatusesCache: skillStatusesCache.filter((s: any) => s.key !== skillKey),
            _installedSkillsMeta: updatedMeta,
        });
        _rederiveLocalState();
    },

    renameSkill: (skillKey, newName) => {
        const { draftConfig, skillStatusesCache, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (draftConfig.plugins?.entries?.[skillKey]) {
            draftConfig.plugins.entries[skillKey].name = newName;
        }

        // Also update the cache
        const updatedCache = skillStatusesCache.map((s: any) =>
            s.key === skillKey ? { ...s, name: newName } : s
        );

        set({ draftConfig, skillStatusesCache: updatedCache });
        _rederiveLocalState();
    },

    setSkillTags: (skillKey, tags) => {
        const { draftConfig, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.entries) draftConfig.plugins.entries = {};
        if (!draftConfig.plugins.entries[skillKey]) draftConfig.plugins.entries[skillKey] = {};

        draftConfig.plugins.entries[skillKey].tags = tags;

        set({ draftConfig });
        _rederiveLocalState();
    },

    createSkillGroup: (name) => {
        const { draftConfig, skillGroups } = get();
        if (!draftConfig) return;

        const newGroup: SkillGroup = {
            id: crypto.randomUUID(),
            name,
        };

        if (!draftConfig.plugins) draftConfig.plugins = {};
        if (!draftConfig.plugins.skillGroups) draftConfig.plugins.skillGroups = [];
        draftConfig.plugins.skillGroups.push({ id: newGroup.id, name: newGroup.name });

        set({
            draftConfig,
            skillGroups: [...skillGroups, newGroup],
            hasUnsavedChanges: true,
        });
    },

    renameSkillGroup: (groupId, name) => {
        const { draftConfig, skillGroups } = get();
        if (!draftConfig) return;

        if (draftConfig.plugins?.skillGroups) {
            const g = draftConfig.plugins.skillGroups.find((g: any) => g.id === groupId);
            if (g) g.name = name;
        }

        set({
            draftConfig,
            skillGroups: skillGroups.map(g => g.id === groupId ? { ...g, name } : g),
            hasUnsavedChanges: true,
        });
    },

    deleteSkillGroup: (groupId) => {
        const { draftConfig, skillGroups, _rederiveLocalState } = get() as any;
        if (!draftConfig) return;

        if (draftConfig.plugins?.skillGroups) {
            draftConfig.plugins.skillGroups = draftConfig.plugins.skillGroups.filter(
                (g: any) => g.id !== groupId
            );
        }

        // Remove this group from all skill tags
        if (draftConfig.plugins?.entries) {
            for (const entry of Object.values(draftConfig.plugins.entries) as any[]) {
                if (entry.tags && Array.isArray(entry.tags)) {
                    entry.tags = entry.tags.filter((t: string) => t !== groupId);
                }
            }
        }

        set({
            draftConfig,
            skillGroups: skillGroups.filter((g: SkillGroup) => g.id !== groupId),
        });
        _rederiveLocalState();
    },
}));
