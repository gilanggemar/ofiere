// stores/useOpenClawModelStore.ts
// Zustand store for OpenClaw model configuration.
// Reads model config from OpenClaw Gateway via config.get + models.list RPCs.
// Model changes are buffered — not applied until user clicks "Apply & Restart".
//
// Supports 6 model roles per agent:
//   primary   — main inference model
//   heartbeat — lightweight model for status/heartbeat checks
//   tool_call — model used when the agent invokes tools / function-calling
//   coding    — model used for code generation tasks
//   fallback  — fallback model when primary fails or hits rate-limits
//   companion — model used in companion (conversational) mode

import { create } from 'zustand';
import { getGateway } from '@/lib/openclawGateway';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ModelRole = 'primary' | 'heartbeat' | 'tool_call' | 'coding' | 'fallback' | 'companion'
    | 'companion_chat' | 'companion_coding' | 'companion_tool_call' | 'companion_function_call' | 'companion_vision';

export const AGENT_MODEL_ROLES: { role: ModelRole; label: string; description: string }[] = [
    { role: 'primary', label: 'Primary Model', description: 'Main inference model' },
    { role: 'heartbeat', label: 'Heartbeat Model', description: 'Lightweight model for status checks' },
    { role: 'tool_call', label: 'Tool Call Model', description: 'Model used for tool / function calling' },
    { role: 'coding', label: 'Coding Model', description: 'Model used for code generation' },
    { role: 'fallback', label: 'Fallback Model', description: 'Used when primary fails or hits rate-limits' },
];

export const COMPANION_MODEL_ROLES: { role: ModelRole; label: string; description: string }[] = [
    { role: 'companion_chat', label: 'Chat Model', description: 'Primary conversational model' },
    { role: 'companion_coding', label: 'Coding Model', description: 'Used for code generation tasks' },
    { role: 'companion_tool_call', label: 'Tool Call Model', description: 'Used for tool invocations' },
    { role: 'companion_function_call', label: 'Function Calling Model', description: 'Used for function calling' },
    { role: 'companion_vision', label: 'Vision Model', description: 'Used when processing images' },
];

export const MODEL_ROLES: { role: ModelRole; label: string; description: string }[] = [
    ...AGENT_MODEL_ROLES,
    { role: 'companion', label: 'Companion Model', description: 'Used in companion (conversational) mode' },
    ...COMPANION_MODEL_ROLES,
];

export interface ModelCatalogEntry {
    ref: string;        // e.g. "openai-codex/gpt-5.3-codex"
    alias?: string;     // e.g. "Codex" — friendly display name
    provider: string;   // e.g. "openai-codex" — derived from ref
    modelName: string;  // e.g. "gpt-5.3-codex" — derived from ref
    account?: string;   // e.g. "gilanggemar@gmail.com" — which account/credential this model uses
    baseUrl?: string;   // e.g. "https://api.openai.com" — base URL for the provider
    apiKeyHint?: string; // e.g. "sk-...abc" — masked API key hint
}

/** A single buffered change: agentId + role + new model ref */
interface PendingChange {
    agentId: string;
    role: ModelRole;
    modelRef: string;
    isDefault: boolean; // true → change agents.defaults.model.<role>
}

interface OpenClawModelState {
    // Resolved active model for each agent for each role
    // activeModels[role][agentId] → model ref string
    activeModels: Record<ModelRole, Record<string, string>>;

    // Default model per role
    defaults: Record<ModelRole, string | null>;

    // The model catalog/allowlist
    modelCatalog: ModelCatalogEntry[];

    // Config hash for optimistic concurrency
    configHash: string | null;

    // Raw config cache for patching
    rawConfig: any | null;

    // Loading state
    isModelLoading: boolean;
    modelError: string | null;

    // Buffered changes — keyed by "agentId:role"
    pendingChanges: Map<string, PendingChange>;
    hasUnsavedChanges: boolean;

    // Apply-in-progress
    isApplying: boolean;

    // Actions
    fetchModels: () => Promise<void>;
    bufferChange: (agentId: string, role: ModelRole, modelRef: string, isDefault: boolean) => void;
    applyAllChanges: () => Promise<void>;
    discardAllChanges: () => void;

    // Legacy compatibility aliases
    bufferModelChange: (agentId: string, modelRef: string, isDefault: boolean) => void;
    bufferHeartbeatModelChange: (agentId: string, modelRef: string, isDefault: boolean) => void;
    applyModelChange: () => Promise<void>;
    discardModelChange: () => void;
}

// Legacy compatibility aliases
type LegacyAliases = {
    defaultModel: string | null;
    defaultHeartbeatModel: string | null;
    defaultFallbacks: string[];
    hasUnsavedModelChange: boolean;
    hasUnsavedHeartbeatChange: boolean;
    pendingModelChange: PendingChange | null;
    pendingHeartbeatModelChange: PendingChange | null;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseConfigRaw(configRes: any): { config: any; hash: string | null } {
    if (!configRes) return { config: {}, hash: null };
    const hash = configRes.hash || null;
    if (configRes.config && typeof configRes.config === 'object') {
        return { config: configRes.config, hash };
    }
    const raw = configRes.raw;
    if (typeof raw === 'string') {
        try { return { config: JSON.parse(raw), hash }; } catch { /* fallthrough */ }
        try {
            const sanitized = raw
                .replace(/'([^'\\]*(\\.[^'\\]*)*)'/g, '"$1"')
                .replace(/([{,]\s*)([a-zA-Z_$][\w$]*)\s*:/g, '$1"$2":')
                .replace(/,\s*([\]}])/g, '$1')
                .replace(/\/\/.*/g, '')
                .replace(/\/\*[\s\S]*?\*\//g, '');
            return { config: JSON.parse(sanitized), hash };
        } catch { /* fallthrough */ }
    }
    const { path, exists, raw: _raw, ...rest } = configRes;
    if (Object.keys(rest).length > 0) return { config: rest, hash };
    return { config: {}, hash };
}

function buildCatalog(config: any): ModelCatalogEntry[] {
    const modelsObj = config?.agents?.defaults?.models ?? {};
    const catalog: ModelCatalogEntry[] = Object.entries(modelsObj).map(([ref, meta]) => {
        const slashIndex = ref.indexOf('/');
        const m = meta as any;
        return {
            ref,
            alias: m?.alias ?? m?.displayName ?? undefined,
            provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
            modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
            account: m?.account ?? m?.email ?? m?.credential ?? m?.accountId ?? undefined,
            baseUrl: m?.baseUrl ?? m?.base_url ?? m?.endpoint ?? undefined,
            apiKeyHint: m?.apiKeyHint ?? m?.api_key_hint ?? m?.maskedKey ?? undefined,
        };
    });
    return catalog;
}

const ALL_ROLES: ModelRole[] = [
    'primary', 'heartbeat', 'tool_call', 'coding', 'companion', 'fallback',
    'companion_chat', 'companion_coding', 'companion_tool_call', 'companion_function_call', 'companion_vision',
];

function emptyRoleMap(): Record<ModelRole, Record<string, string>> {
    return {
        primary: {}, heartbeat: {}, tool_call: {}, coding: {}, companion: {}, fallback: {},
        companion_chat: {}, companion_coding: {}, companion_tool_call: {}, companion_function_call: {}, companion_vision: {},
    };
}

function emptyDefaults(): Record<ModelRole, string | null> {
    return {
        primary: null, heartbeat: null, tool_call: null, coding: null, companion: null, fallback: null,
        companion_chat: null, companion_coding: null, companion_tool_call: null, companion_function_call: null, companion_vision: null,
    };
}

/** Read default model for each role from config/localStorage */
function readDefaults(config: any): Record<ModelRole, string | null> {
    const modelDefaults = config?.agents?.defaults?.model ?? {};
    
    let companionDefaults: Record<string, string | null> = {};
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('ofiere_companion_models');
            if (stored) {
                const parsed = JSON.parse(stored);
                companionDefaults = parsed?.defaults ?? {};
            }
        } catch { /* ignore */ }
    }
    
    return {
        primary: modelDefaults.primary ?? null,
        heartbeat: modelDefaults.heartbeat ?? null,
        tool_call: modelDefaults.tool_call ?? null,
        coding: modelDefaults.coding ?? null,
        companion: companionDefaults.companion ?? modelDefaults.companion ?? null,
        fallback: modelDefaults.fallback ?? (Array.isArray(modelDefaults.fallbacks) && modelDefaults.fallbacks[0]) ?? null,
        companion_chat: companionDefaults.companion_chat ?? null,
        companion_coding: companionDefaults.companion_coding ?? null,
        companion_tool_call: companionDefaults.companion_tool_call ?? null,
        companion_function_call: companionDefaults.companion_function_call ?? null,
        companion_vision: companionDefaults.companion_vision ?? null,
    };
}

const COMPANION_ROLES_SET = new Set<string>([
    'companion', 'companion_chat', 'companion_coding', 'companion_tool_call', 'companion_function_call', 'companion_vision'
]);

/** Read per-agent models for all roles */
function readAgentModels(config: any, defaults: Record<ModelRole, string | null>): Record<ModelRole, Record<string, string>> {
    const agentsList = config?.agents?.list ?? [];
    const result = emptyRoleMap();

    let storedCompanionModels: Record<string, Record<string, string>> = {};
    if (typeof window !== 'undefined') {
        try {
            const stored = localStorage.getItem('ofiere_companion_models');
            if (stored) {
                const parsed = JSON.parse(stored);
                storedCompanionModels = parsed?.activeModels ?? {};
            }
        } catch { /* ignore */ }
    }

    for (const agent of agentsList) {
        const id = agent.id || agent.agentId;
        if (!id) continue;
        const m = agent.model ?? {};
        result.primary[id] = m.primary ?? defaults.primary ?? '';
        result.heartbeat[id] = m.heartbeat ?? defaults.heartbeat ?? '';
        result.tool_call[id] = m.tool_call ?? defaults.tool_call ?? '';
        result.coding[id] = m.coding ?? defaults.coding ?? '';
        result.companion[id] = storedCompanionModels.companion?.[id] ?? m.companion ?? defaults.companion ?? '';
        result.fallback[id] = m.fallback ?? (Array.isArray(m.fallbacks) && m.fallbacks[0]) ?? defaults.fallback ?? '';
        // Companion sub-roles from localStorage
        result.companion_chat[id] = storedCompanionModels.companion_chat?.[id] ?? defaults.companion_chat ?? '';
        result.companion_coding[id] = storedCompanionModels.companion_coding?.[id] ?? defaults.companion_coding ?? '';
        result.companion_tool_call[id] = storedCompanionModels.companion_tool_call?.[id] ?? defaults.companion_tool_call ?? '';
        result.companion_function_call[id] = storedCompanionModels.companion_function_call?.[id] ?? defaults.companion_function_call ?? '';
        result.companion_vision[id] = storedCompanionModels.companion_vision?.[id] ?? defaults.companion_vision ?? '';
    }

    // If no agents in list, create 'main' agent entry
    if (agentsList.length === 0) {
        for (const role of ALL_ROLES) {
            if (COMPANION_ROLES_SET.has(role)) {
                result[role]['main'] = storedCompanionModels[role]?.['main'] ?? defaults[role] ?? '';
            } else {
                result[role]['main'] = defaults[role] ?? '';
            }
        }
    }

    return result;
}

function ensureInCatalog(catalog: ModelCatalogEntry[], ref: string): void {
    if (ref && !catalog.find(c => c.ref === ref)) {
        const slashIndex = ref.indexOf('/');
        catalog.push({
            ref,
            provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
            modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
        });
    }
}

// ─── Store ──────────────────────────────────────────────────────────────────

export const useOpenClawModelStore = create<OpenClawModelState & LegacyAliases>((set, get) => ({
    activeModels: emptyRoleMap(),
    defaults: emptyDefaults(),
    modelCatalog: [],
    configHash: null,
    rawConfig: null,
    isModelLoading: false,
    modelError: null,
    pendingChanges: new Map(),
    hasUnsavedChanges: false,
    isApplying: false,

    // Legacy compatibility getters
    get defaultModel() { return get().defaults.primary; },
    get defaultHeartbeatModel() { return get().defaults.heartbeat; },
    get defaultFallbacks() {
        const fb = get().defaults.fallback;
        return fb ? [fb] : [];
    },
    get hasUnsavedModelChange() { return get().hasUnsavedChanges; },
    get hasUnsavedHeartbeatChange() { return get().hasUnsavedChanges; },
    get pendingModelChange() {
        for (const [, change] of get().pendingChanges) {
            if (change.role === 'primary') return change;
        }
        return null;
    },
    get pendingHeartbeatModelChange() {
        for (const [, change] of get().pendingChanges) {
            if (change.role === 'heartbeat') return change;
        }
        return null;
    },

    // ─── fetchModels ────────────────────────────────────────────────────

    fetchModels: async () => {
        const gw = getGateway();
        if (!gw.isConnected) {
            set({ modelError: 'Not connected to OpenClaw Gateway', isModelLoading: false });
            return;
        }

        set({ isModelLoading: true, modelError: null });

        try {
            const configRes = await gw.request('config.get', {}).catch((e) => {
                console.warn('[ModelStore] config.get failed:', e);
                return null;
            });

            const { config, hash } = parseConfigRaw(configRes);

            const defaults = readDefaults(config);

            // Build catalog from config
            let catalog = buildCatalog(config);

            // If catalog is empty, try models.list RPC
            if (catalog.length === 0) {
                try {
                    const modelsRes = await gw.request('models.list', {});
                    const modelsList = modelsRes?.models ?? modelsRes ?? [];
                    if (Array.isArray(modelsList)) {
                        catalog = modelsList.map((m: any) => {
                            const ref = m.ref || m.id || m.model || m.name || '';
                            const slashIndex = ref.indexOf('/');
                            return {
                                ref,
                                alias: m.alias ?? m.displayName ?? undefined,
                                provider: slashIndex > -1 ? ref.substring(0, slashIndex) : ref,
                                modelName: slashIndex > -1 ? ref.substring(slashIndex + 1) : ref,
                            };
                        });
                    }
                } catch (e) {
                    console.warn('[ModelStore] models.list failed:', e);
                }
            }

            // Ensure all default/active models are in the catalog
            for (const role of ALL_ROLES) {
                if (defaults[role]) ensureInCatalog(catalog, defaults[role]!);
            }

            const activeModels = readAgentModels(config, defaults);

            // Ensure per-agent models are in catalog too
            for (const role of ALL_ROLES) {
                for (const ref of Object.values(activeModels[role])) {
                    if (ref) ensureInCatalog(catalog, ref);
                }
            }

            set({
                activeModels,
                defaults,
                modelCatalog: catalog,
                configHash: hash,
                rawConfig: config,
                isModelLoading: false,
                modelError: null,
            });
        } catch (err: any) {
            console.error('[ModelStore] fetchModels failed:', err);
            set({
                isModelLoading: false,
                modelError: err?.message || 'Failed to fetch model configuration',
            });
        }
    },

    // ─── Buffer a model change ──────────────────────────────────────────

    bufferChange: (agentId, role, modelRef, isDefault) => {
        if (COMPANION_ROLES_SET.has(role)) {
            // Instantly apply to local state so UI updates immediately
            set((state) => {
                const newActive = { ...state.activeModels };
                newActive[role] = { ...newActive[role], [agentId]: modelRef };
                const newDefaults = { ...state.defaults };
                
                if (isDefault) {
                    newDefaults[role] = modelRef;
                }

                // Persist exclusively to localStorage, keeping it totally separated from OpenClaw's agents.json
                if (typeof window !== 'undefined') {
                    try {
                        let existing: any = {};
                        try {
                            const stored = localStorage.getItem('ofiere_companion_models');
                            if (stored) existing = JSON.parse(stored);
                        } catch { /* ignore */ }

                        const existingActiveModels = existing.activeModels || {};
                        const existingDefaults = existing.defaults || {};

                        const toStore = {
                            ...existing,
                            activeModels: { ...existingActiveModels, [role]: newActive[role] },
                            defaults: { ...existingDefaults, [role]: newDefaults[role] }
                        };
                        
                        localStorage.setItem('ofiere_companion_models', JSON.stringify(toStore));
                    } catch (e) {
                        console.error('[ModelStore] failed to save companion models to localStorage:', e);
                    }
                }

                return { activeModels: newActive, defaults: newDefaults };
            });
            return;
        }

        const key = `${agentId}:${role}`;
        set((state) => {
            const next = new Map(state.pendingChanges);
            next.set(key, { agentId, role, modelRef, isDefault });
            return { pendingChanges: next, hasUnsavedChanges: true };
        });
    },

    // Legacy compatibility wrappers
    bufferModelChange: (agentId, modelRef, isDefault) => {
        get().bufferChange(agentId, 'primary', modelRef, isDefault);
    },

    bufferHeartbeatModelChange: (agentId, modelRef, isDefault) => {
        get().bufferChange(agentId, 'heartbeat', modelRef, isDefault);
    },

    // ─── Apply all buffered changes ─────────────────────────────────────

    applyAllChanges: async () => {
        const { pendingChanges, rawConfig, configHash } = get();
        if (pendingChanges.size === 0) return;

        const gw = getGateway();
        if (!gw.isConnected) return;

        set({ isApplying: true });

        try {
            // Re-fetch fresh config for hash
            const freshRes = await gw.request('config.get', {}).catch(() => null);
            const { config: freshConfig, hash: freshHash } = parseConfigRaw(freshRes);
            const baseHash = freshHash || configHash;
            const workingConfig = freshConfig || rawConfig || {};

            // Group changes by type: default-level vs per-agent
            const defaultChanges: Partial<Record<ModelRole, string>> = {};
            const agentChanges: Record<string, Partial<Record<ModelRole, string>>> = {};

            for (const [, change] of pendingChanges) {
                if (change.isDefault) {
                    defaultChanges[change.role] = change.modelRef;
                } else {
                    if (!agentChanges[change.agentId]) agentChanges[change.agentId] = {};
                    agentChanges[change.agentId][change.role] = change.modelRef;
                }
            }

            // Build the patch payload
            const patchPayload: any = {};

            // Apply default-level changes
            if (Object.keys(defaultChanges).length > 0) {
                const modelPatch: any = {};
                for (const [role, ref] of Object.entries(defaultChanges)) {
                    if (role === 'fallback') {
                        // fallback goes into both 'fallback' field and 'fallbacks' array
                        modelPatch.fallback = ref;
                        modelPatch.fallbacks = [ref];
                    } else {
                        modelPatch[role] = ref;
                    }
                }
                patchPayload.agents = {
                    ...patchPayload.agents,
                    defaults: {
                        ...(patchPayload.agents?.defaults ?? {}),
                        model: modelPatch,
                    },
                };
            }

            // Apply per-agent changes
            if (Object.keys(agentChanges).length > 0) {
                const agentsList = [...(workingConfig?.agents?.list ?? [])];

                for (const [agentId, roleChanges] of Object.entries(agentChanges)) {
                    const agentIndex = agentsList.findIndex(
                        (a: any) => (a.id || a.agentId) === agentId
                    );

                    if (agentIndex >= 0) {
                        const existingModel = agentsList[agentIndex].model || {};
                        const updatedModel = { ...existingModel };

                        for (const [role, ref] of Object.entries(roleChanges)) {
                            if (role === 'fallback') {
                                updatedModel.fallback = ref;
                                updatedModel.fallbacks = [ref];
                            } else {
                                updatedModel[role] = ref;
                            }
                        }

                        agentsList[agentIndex] = {
                            ...agentsList[agentIndex],
                            model: updatedModel,
                        };
                    } else {
                        // Agent not in list — treat as default change
                        const modelPatch: any =
                            patchPayload.agents?.defaults?.model ?? {};
                        for (const [role, ref] of Object.entries(roleChanges)) {
                            if (role === 'fallback') {
                                modelPatch.fallback = ref;
                                modelPatch.fallbacks = [ref];
                            } else {
                                modelPatch[role] = ref;
                            }
                        }
                        patchPayload.agents = {
                            ...patchPayload.agents,
                            defaults: {
                                ...(patchPayload.agents?.defaults ?? {}),
                                model: modelPatch,
                            },
                        };
                    }
                }

                if (agentsList.length > 0) {
                    patchPayload.agents = {
                        ...patchPayload.agents,
                        list: agentsList,
                    };
                }
            }

            // Send the single patch
            await gw.request('config.patch', {
                raw: JSON.stringify(patchPayload),
                baseHash,
            });

            // Clear all pending changes
            set({
                pendingChanges: new Map(),
                hasUnsavedChanges: false,
                isApplying: false,
            });

            // Re-fetch
            await get().fetchModels();
        } catch (err: any) {
            console.error('[ModelStore] applyAllChanges failed:', err);
            set({
                modelError: err?.message || 'Failed to apply model changes',
                isApplying: false,
            });
        }
    },

    // Legacy alias
    applyModelChange: async () => get().applyAllChanges(),

    // ─── Discard all changes ────────────────────────────────────────────

    discardAllChanges: () => {
        set({ pendingChanges: new Map(), hasUnsavedChanges: false });
    },

    // Legacy alias
    discardModelChange: () => get().discardAllChanges(),
}));

// ─── Legacy compatibility selectors ─────────────────────────────────────────

/** @deprecated Use activeModels.primary instead */
export function selectActiveModels(state: OpenClawModelState & LegacyAliases) {
    return state.activeModels.primary;
}

/** @deprecated Use activeModels.heartbeat instead */
export function selectActiveHeartbeatModels(state: OpenClawModelState & LegacyAliases) {
    return state.activeModels.heartbeat;
}
