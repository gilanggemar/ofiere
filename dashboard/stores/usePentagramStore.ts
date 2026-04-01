// ============================================================
// stores/usePentagramStore.ts
// Zustand store for the Pentagram Protocol game state
// ============================================================
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PentagramState, SceneId, HeroTransform, DialogTransform, InteractSceneConfig, ImageSequenceMapping } from '@/lib/games/pentagram/types';
import { PENTAGRAM_SCENES } from '@/lib/games/pentagram/scenarioData';

// Generate default state exactly matching the design doc
const getInitialState = (): PentagramState => ({
    IVY_affection: 0,
    IVY_resistance: 100,
    DAISY_trust: 0,
    DAISY_obsession: 0,
    CELIA_vulnerability: 0,
    CELIA_stability: 100,
    THALIA_recalibration: 0,
    THALIA_real: 0,
    COMPANY_health: 100,
    CORRUPTION: 0,
    GILANG_control: 100,
    SENTINEL_gap: 0,
    flags: {},
});

// Added asset overrides and save management
export interface PentagramStore {
    currentSceneId: SceneId;
    gameState: PentagramState;
    history: SceneId[];

    // User Authored Data
    customScenes: Record<string, any>;
    customChoices: Record<string, any[]>;
    isSyncing: boolean;

    // Display overrides for Dev tools
    customBackgroundUrl: string | null;
    customHeroUrl: string | null;
    customSceneBackgrounds: Record<string, string>;
    customSceneHeroes: Record<string, string>;
    globalHeroTransform: HeroTransform;
    customSceneHeroTransforms: Record<string, HeroTransform>;
    globalDialogTransform: DialogTransform;
    customSceneDialogTransforms: Record<string, DialogTransform>;
    dialogTransformPresets: Record<string, DialogTransform>;
    
    // Auth & DB state
    saveId: string | null;
    isSaving: boolean;

    // Actions
    makeChoice: (choiceId: string) => void;
    restartGame: () => void;
    goBack: () => void;
    jumpToScene: (sceneId: SceneId) => void;
    
    setCustomBackgroundUrl: (url: string | null) => void;
    setCustomHeroUrl: (url: string | null) => void;
    bindBackgroundToScene: (sceneId: string, url: string) => void;
    unbindBackgroundFromScene: (sceneId: string) => void;
    bindHeroToScene: (sceneId: string, url: string, transform: HeroTransform) => void;
    unbindHeroFromScene: (sceneId: string) => void;
    updateHeroTransform: (key: keyof HeroTransform, value: number) => void;
    updateSceneHeroTransform: (sceneId: string, key: keyof HeroTransform, value: number) => void;
    
    bindDialogTransformToScene: (sceneId: string) => void;
    unbindDialogTransformFromScene: (sceneId: string) => void;
    updateDialogTransform: (key: keyof DialogTransform, value: number) => void;
    updateSceneDialogTransform: (sceneId: string, key: keyof DialogTransform, value: number) => void;
    saveDialogTransformPreset: (name: string, transform: DialogTransform) => void;
    deleteDialogTransformPreset: (name: string) => void;
    
    // Debug actions
    updateVariable: (key: keyof PentagramState, value: number) => void;

    // Custom Scenario Actions
    loadCustomScenarioData: () => Promise<void>;
    addCustomSceneNode: (parentSceneId: string, choiceText: string, newSceneId: string, sceneText: string, speakerName?: string, sceneTitle?: string) => Promise<void>;
    addCustomChoice: (parentSceneId: string, choiceText: string, targetSceneId: string) => Promise<void>;
    deleteCustomScene: (sceneId: string) => Promise<void>;
    deleteCustomChoice: (choiceId: string, parentSceneId: string) => Promise<void>;
    editScene: (sceneId: string, sceneText: string, speakerName?: string, sceneTitle?: string) => Promise<void>;
    editChoice: (choiceId: string, parentSceneId: string, choiceText: string) => Promise<void>;

    // Interact Scene Customization
    customInteractConfigs: Record<string, InteractSceneConfig>;
    imageSequences: (ImageSequenceMapping & { id: string })[];
    isInteractEditorOpen: boolean;
    setInteractEditorOpen: (open: boolean) => void;
    loadInteractConfigs: () => Promise<void>;
    saveInteractConfig: (sceneId: string, config: InteractSceneConfig) => Promise<void>;
    deleteInteractConfig: (sceneId: string) => Promise<void>;
    loadImageSequences: () => Promise<void>;
    saveImageSequence: (seq: { id?: string; name: string; description?: string; frame_count: number; frame_width?: number; frame_height?: number; frame_urls: string[]; thumbnail_url?: string }) => Promise<void>;
    deleteImageSequence: (id: string) => Promise<void>;
}

export const usePentagramStore = create<PentagramStore>()(
    persist(
        (set, get) => ({
            currentSceneId: 'P_START',
            gameState: getInitialState(),
            history: [],

            customScenes: {},
            customChoices: {},
            isSyncing: false,

            customBackgroundUrl: null,
            customHeroUrl: null,
            customSceneBackgrounds: {},
            customSceneHeroes: {},
            globalHeroTransform: { scale: 100, x: 50, y: 0 },
            customSceneHeroTransforms: {},
            globalDialogTransform: { scale: 100, x: 0, y: 0 },
            customSceneDialogTransforms: {},
            dialogTransformPresets: {
                "Center": { scale: 100, x: 0, y: 0 },
                "Bottom Left": { scale: 80, x: -70, y: 20 },
                "Bottom Right": { scale: 80, x: 70, y: 20 }
            },
            
            saveId: null,
            isSaving: false,

            // Interact Scene Customization
            customInteractConfigs: {},
            imageSequences: [],
            isInteractEditorOpen: false,
            setInteractEditorOpen: (open: boolean) => set({ isInteractEditorOpen: open }),

            makeChoice: (choiceId: string) => {
                const { currentSceneId, gameState, history, customScenes, customChoices } = get();
                
                let scene: any = PENTAGRAM_SCENES[currentSceneId];
                if (!scene) {
                    scene = customScenes[currentSceneId];
                }
                
                if (!scene) return;

                // Merge choices
                const choices = [...(scene.choices || []), ...(customChoices[currentSceneId] || [])];
                const choice = choices.find(c => c.id === choiceId);
                if (!choice) return;

                // Verify condition if it exists (only hardcoded choices will have condition fns right now)
                if (choice.condition && !choice.condition(gameState)) {
                    return;
                }

                // Apply choice effects
                let nextState = { ...gameState };
                if (choice.effect) {
                    nextState = choice.effect(nextState);
                }

                let nextScene: any = PENTAGRAM_SCENES[choice.nextSceneId];
                if (!nextScene) {
                    nextScene = customScenes[choice.nextSceneId];
                } else if (customScenes[choice.nextSceneId]) {
                    nextScene = { ...nextScene, ...customScenes[choice.nextSceneId] };
                }
                
                if (nextScene && nextScene.onEnter) {
                    nextState = nextScene.onEnter(nextState);
                }

                // Clamp values 0-100 automatically
                const clampedState: PentagramState = { ...nextState, flags: { ...nextState.flags } };
                (Object.keys(clampedState) as Array<keyof PentagramState>).forEach(key => {
                    if (key !== 'flags' && typeof clampedState[key] === 'number') {
                        clampedState[key] = Math.max(0, Math.min(100, clampedState[key] as number));
                    }
                });

                set({
                    currentSceneId: choice.nextSceneId,
                    gameState: clampedState,
                    history: [...history, currentSceneId]
                });
            },

            jumpToScene: (sceneId: string) => {
                set({ currentSceneId: sceneId });
            },

            goBack: () => {
                const { history } = get();
                if (history.length === 0) return;
                
                const prevScene = history[history.length - 1];
                set({
                    currentSceneId: prevScene,
                    history: history.slice(0, -1)
                });
            },

            restartGame: () => set({
                currentSceneId: 'P_START',
                gameState: getInitialState(),
                history: []
            }),

            setCustomBackgroundUrl: (url) => set({ customBackgroundUrl: url }),
            setCustomHeroUrl: (url) => set({ customHeroUrl: url }),
            
            bindBackgroundToScene: (sceneId, url) => {
                set((state) => ({
                    customSceneBackgrounds: {
                        ...state.customSceneBackgrounds,
                        [sceneId]: url
                    }
                }));
            },
            
            unbindBackgroundFromScene: (sceneId) => {
                set((state) => {
                    const newBg = { ...state.customSceneBackgrounds };
                    delete newBg[sceneId];
                    return { customSceneBackgrounds: newBg };
                });
            },
            
            bindHeroToScene: (sceneId, url, transform) => {
                set((state) => ({
                    customSceneHeroes: {
                        ...state.customSceneHeroes,
                        [sceneId]: url
                    },
                    customSceneHeroTransforms: {
                        ...state.customSceneHeroTransforms,
                        [sceneId]: transform
                    }
                }));
            },
            
            unbindHeroFromScene: (sceneId) => {
                set((state) => {
                    const newHeroes = { ...state.customSceneHeroes };
                    const newTransforms = { ...state.customSceneHeroTransforms };
                    delete newHeroes[sceneId];
                    delete newTransforms[sceneId];
                    return { customSceneHeroes: newHeroes, customSceneHeroTransforms: newTransforms };
                });
            },

            updateHeroTransform: (key, value) => {
                set((state) => ({
                    globalHeroTransform: {
                        ...state.globalHeroTransform,
                        [key]: value
                    }
                }));
            },

            updateSceneHeroTransform: (sceneId, key, value) => {
                set((state) => {
                    const currentTransform = state.customSceneHeroTransforms[sceneId] || { scale: 100, x: 50, y: 0 };
                    return {
                        customSceneHeroTransforms: {
                            ...state.customSceneHeroTransforms,
                            [sceneId]: {
                                ...currentTransform,
                                [key]: value
                            }
                        }
                    };
                });
            },

            bindDialogTransformToScene: (sceneId) => {
                set((state) => ({
                    customSceneDialogTransforms: {
                        ...state.customSceneDialogTransforms,
                        [sceneId]: { ...state.globalDialogTransform }
                    }
                }));
            },

            unbindDialogTransformFromScene: (sceneId) => {
                set((state) => {
                    const newTransforms = { ...state.customSceneDialogTransforms };
                    delete newTransforms[sceneId];
                    return { customSceneDialogTransforms: newTransforms };
                });
            },

            updateDialogTransform: (key, value) => {
                set((state) => ({
                    globalDialogTransform: {
                        ...state.globalDialogTransform,
                        [key]: value
                    }
                }));
            },

            updateSceneDialogTransform: (sceneId, key, value) => {
                set((state) => {
                    const currentTransform = state.customSceneDialogTransforms[sceneId] || { scale: 100, x: 0, y: 0 };
                    return {
                        customSceneDialogTransforms: {
                            ...state.customSceneDialogTransforms,
                            [sceneId]: {
                                ...currentTransform,
                                [key]: value
                            }
                        }
                    };
                });
            },

            saveDialogTransformPreset: (name, transform) => {
                set((state) => ({
                    dialogTransformPresets: {
                        ...state.dialogTransformPresets,
                        [name]: { ...transform }
                    }
                }));
            },

            deleteDialogTransformPreset: (name) => {
                set((state) => {
                    const newPresets = { ...state.dialogTransformPresets };
                    delete newPresets[name];
                    return { dialogTransformPresets: newPresets };
                });
            },

            updateVariable: (key, value) => {
                set(state => ({
                    gameState: {
                        ...state.gameState,
                        [key]: Math.max(0, Math.min(100, value))
                    }
                }));
            },

            loadCustomScenarioData: async () => {
                set({ isSyncing: true });
                try {
                    const res = await fetch('/api/games/pentagram/scenario');
                    if (res.ok) {
                        const { scenes, choices } = await res.json();
                        
                        const newCustomScenes: Record<string, any> = {};
                        scenes.forEach((s: any) => {
                            newCustomScenes[s.scene_id] = s.scene_data;
                        });

                        const newCustomChoices: Record<string, any[]> = {};
                        choices.forEach((c: any) => {
                            if (!newCustomChoices[c.parent_scene_id]) {
                                newCustomChoices[c.parent_scene_id] = [];
                            }
                            newCustomChoices[c.parent_scene_id].push({
                                ...c.choice_data,
                                id: c.choice_data.id || c.id
                            });
                        });

                        set({ customScenes: newCustomScenes, customChoices: newCustomChoices });
                    }
                } catch (e) {
                    console.error("Failed to load scenario data", e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            addCustomSceneNode: async (parentSceneId, choiceText, newSceneId, sceneText, speakerName) => {
                set({ isSyncing: true });
                try {
                    // Create minimal choice wrapper
                    const choiceData = {
                        id: crypto.randomUUID(), // Temporarily use browser crypto
                        text: choiceText,
                        nextSceneId: newSceneId
                    };

                    const sceneData = {
                        id: newSceneId,
                        arcTitle: "CUSTOM BRANCH",
                        chapterTitle: "USER CREATED",
                        sceneTitle: "Unknown",
                        text: sceneText,
                        speakerName: speakerName || undefined,
                        choices: []
                    };

                    // Persist Choice
                    const cRes = await fetch('/api/games/pentagram/scenario', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'choice', payload: { id: choiceData.id, parent_scene_id: parentSceneId, choice_data: choiceData } })
                    });
                    const savedChoice = await cRes.json();

                    // Persist Scene
                    const sRes = await fetch('/api/games/pentagram/scenario', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'scene', payload: { scene_id: newSceneId, scene_data: sceneData } })
                    });
                    
                    if (cRes.ok && sRes.ok) {
                        // Optimistically update
                        set((state) => {
                            const newCustomChoices = { ...state.customChoices };
                            if (!newCustomChoices[parentSceneId]) newCustomChoices[parentSceneId] = [];
                            newCustomChoices[parentSceneId].push({ ...choiceData, id: savedChoice.id });

                            return {
                                customScenes: { ...state.customScenes, [newSceneId]: sceneData },
                                customChoices: newCustomChoices
                            };
                        });
                    }
                } catch (e) {
                    console.error("Failed to add custom node", e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            addCustomChoice: async (parentSceneId, choiceText, targetSceneId) => {
                set({ isSyncing: true });
                try {
                    const choiceData = {
                        id: crypto.randomUUID(),
                        text: choiceText,
                        nextSceneId: targetSceneId,
                        isSecret: true,
                        condition: undefined // Always visible overrides
                    };

                    const res = await fetch('/api/games/pentagram/scenario', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'choice', payload: { id: choiceData.id, parent_scene_id: parentSceneId, choice_data: choiceData } })
                    });
                    
                    if (res.ok) {
                        const savedChoice = await res.json();
                        set((state) => {
                            const newCustomChoices = { ...state.customChoices };
                            if (!newCustomChoices[parentSceneId]) newCustomChoices[parentSceneId] = [];
                            newCustomChoices[parentSceneId].push({ ...choiceData, id: savedChoice.id });

                            return { customChoices: newCustomChoices };
                        });
                    }
                } catch (e) {
                    console.error("Failed to add custom choice", e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            deleteCustomScene: async (sceneId) => {
                set({ isSyncing: true });
                try {
                    const res = await fetch(`/api/games/pentagram/scenario?type=scene&id=${sceneId}`, { method: 'DELETE' });
                    if (res.ok) {
                        set(state => {
                            const newScenes = { ...state.customScenes };
                            delete newScenes[sceneId];
                            return { customScenes: newScenes };
                        });
                    }
                } finally {
                    set({ isSyncing: false });
                }
            },

            deleteCustomChoice: async (choiceId, parentSceneId) => {
                set({ isSyncing: true });
                try {
                    const baseScene = PENTAGRAM_SCENES[parentSceneId];
                    const hardcodedChoice = baseScene?.choices?.find((c: any) => c.id === choiceId);
                    const isHardcoded = !!hardcodedChoice;
                    
                    let targetNextSceneId = hardcodedChoice?.nextSceneId;
                    if (!targetNextSceneId) {
                        targetNextSceneId = get().customChoices[parentSceneId]?.find((c:any) => c.id === choiceId)?.nextSceneId;
                    }

                    if (isHardcoded) {
                        const payload = { ...hardcodedChoice, isHidden: true };
                        delete payload.condition;
                        delete payload.effect;

                        const res = await fetch('/api/games/pentagram/scenario', {
                            method: 'POST',
                            body: JSON.stringify({ type: 'choice', payload: { id: choiceId, parent_scene_id: parentSceneId, choice_data: payload } })
                        });
                        if (res.ok) {
                            set((state) => {
                                const newChoicesArray = [...(state.customChoices[parentSceneId] || [])];
                                const existingIdx = newChoicesArray.findIndex(c => c.id === choiceId);
                                if (existingIdx >= 0) newChoicesArray[existingIdx] = payload;
                                else newChoicesArray.push(payload);
                                return { customChoices: { ...state.customChoices, [parentSceneId]: newChoicesArray } };
                            });
                        }
                    } else {
                        const res = await fetch(`/api/games/pentagram/scenario?type=choice&id=${choiceId}&parent_scene_id=${parentSceneId}`, {
                            method: 'DELETE'
                        });
                        if (res.ok) {
                            set((state) => ({
                                customChoices: {
                                    ...state.customChoices,
                                    [parentSceneId]: (state.customChoices[parentSceneId] || []).filter(c => c.id !== choiceId)
                                }
                            }));
                        }
                    }

                    // Cascade delete the linked custom scene if it's purely custom
                    if (targetNextSceneId && !PENTAGRAM_SCENES[targetNextSceneId]) {
                        await get().deleteCustomScene(targetNextSceneId);
                    }

                } finally {
                    set({ isSyncing: false });
                }
            },

            editScene: async (sceneId, sceneText, speakerName, sceneTitle) => {
                set({ isSyncing: true });
                try {
                    const baseScene = get().customScenes[sceneId] || PENTAGRAM_SCENES[sceneId] || {};
                    const sceneData = {
                        ...baseScene,
                        id: sceneId,
                        text: sceneText,
                        speakerName: speakerName || undefined,
                    };
                    if (sceneTitle !== undefined) {
                        sceneData.sceneTitle = sceneTitle;
                    }
                    
                    const res = await fetch('/api/games/pentagram/scenario', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'scene', payload: { scene_id: sceneId, scene_data: sceneData } })
                    });
                    
                    if (res.ok) {
                        set((state) => ({
                            customScenes: { ...state.customScenes, [sceneId]: sceneData }
                        }));
                    }
                } finally {
                    set({ isSyncing: false });
                }
            },

            editChoice: async (choiceId, parentSceneId, choiceText) => {
                set({ isSyncing: true });
                try {
                    const baseScene = get().customScenes[parentSceneId] || PENTAGRAM_SCENES[parentSceneId];
                    let baseChoice = baseScene?.choices?.find((c: any) => c.id === choiceId);
                    if (!baseChoice) {
                        const customArr = get().customChoices[parentSceneId] || [];
                        baseChoice = customArr.find((c: any) => c.id === choiceId);
                    }
                    if (!baseChoice) return;

                    const choiceData = {
                        ...baseChoice,
                        text: choiceText
                    };
                    delete choiceData.condition;
                    delete choiceData.effect;

                    const res = await fetch('/api/games/pentagram/scenario', {
                        method: 'POST',
                        body: JSON.stringify({ type: 'choice', payload: { id: choiceId, parent_scene_id: parentSceneId, choice_data: choiceData } })
                    });

                    if (res.ok) {
                        set((state) => {
                            const newChoicesArray = [...(state.customChoices[parentSceneId] || [])];
                            const existingIdx = newChoicesArray.findIndex(c => c.id === choiceId);
                            if (existingIdx >= 0) {
                                newChoicesArray[existingIdx] = choiceData;
                            } else {
                                newChoicesArray.push(choiceData);
                            }
                            return {
                                customChoices: { ...state.customChoices, [parentSceneId]: newChoicesArray }
                            };
                        });
                    }
                } finally {
                    set({ isSyncing: false });
                }
            },

            // ── INTERACT SCENE CUSTOMIZATION ──

            loadInteractConfigs: async () => {
                try {
                    const res = await fetch('/api/games/pentagram/interact-config');
                    if (!res.ok) return;
                    const data = await res.json();
                    if (!Array.isArray(data)) return;

                    const configs: Record<string, any> = {};
                    for (const row of data) {
                        if (row.scene_id && row.interact_config) {
                            configs[row.scene_id] = row.interact_config;
                        }
                    }
                    set({ customInteractConfigs: configs });
                } catch (e) {
                    console.error('[Pentagram] Failed to load interact configs:', e);
                }
            },

            saveInteractConfig: async (sceneId: string, config: any) => {
                try {
                    set({ isSyncing: true });
                    const res = await fetch('/api/games/pentagram/interact-config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ scene_id: sceneId, interact_config: config }),
                    });
                    if (res.ok) {
                        set((state) => ({
                            customInteractConfigs: {
                                ...state.customInteractConfigs,
                                [sceneId]: config,
                            },
                        }));
                    }
                } catch (e) {
                    console.error('[Pentagram] Failed to save interact config:', e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            deleteInteractConfig: async (sceneId: string) => {
                try {
                    set({ isSyncing: true });
                    await fetch(`/api/games/pentagram/interact-config?scene_id=${encodeURIComponent(sceneId)}`, {
                        method: 'DELETE',
                    });
                    set((state) => {
                        const { [sceneId]: _, ...rest } = state.customInteractConfigs;
                        return { customInteractConfigs: rest };
                    });
                } catch (e) {
                    console.error('[Pentagram] Failed to delete interact config:', e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            loadImageSequences: async () => {
                try {
                    const res = await fetch('/api/games/pentagram/image-sequences');
                    if (!res.ok) return;
                    const data = await res.json();
                    if (!Array.isArray(data)) return;

                    const sequences = data.map((row: any) => ({
                        id: row.id,
                        name: row.name,
                        frameUrls: row.frame_urls || [],
                        frameCount: row.frame_count || 0,
                        frameDuration: 100,
                        frameWidth: row.frame_width,
                        frameHeight: row.frame_height,
                    }));
                    set({ imageSequences: sequences });
                } catch (e) {
                    console.error('[Pentagram] Failed to load image sequences:', e);
                }
            },

            saveImageSequence: async (seq) => {
                try {
                    set({ isSyncing: true });
                    const res = await fetch('/api/games/pentagram/image-sequences', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(seq),
                    });
                    if (res.ok) {
                        // Reload all sequences to get the server-generated ID
                        await get().loadImageSequences();
                    }
                } catch (e) {
                    console.error('[Pentagram] Failed to save image sequence:', e);
                } finally {
                    set({ isSyncing: false });
                }
            },

            deleteImageSequence: async (id: string) => {
                try {
                    set({ isSyncing: true });
                    await fetch(`/api/games/pentagram/image-sequences?id=${encodeURIComponent(id)}`, {
                        method: 'DELETE',
                    });
                    set((state) => ({
                        imageSequences: state.imageSequences.filter((s) => s.id !== id),
                    }));
                } catch (e) {
                    console.error('[Pentagram] Failed to delete image sequence:', e);
                } finally {
                    set({ isSyncing: false });
                }
            },
        }),
        {
            name: 'pentagram-storage', // Key for localStorage
            // Optionally, we could omit certain states from persisting (like isSaving),
            // but for dev workflow persisting the whole thing is perfectly fine.
        }
    )
);
