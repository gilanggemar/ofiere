"use client";

import { usePentagramStore } from "@/stores/usePentagramStore";
import { PENTAGRAM_SCENES } from "@/lib/games/pentagram/scenarioData";
import { cn } from "@/lib/utils";
import { ChevronRight, RefreshCcw, Plus, Trash2, X, Save, Loader2, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect, useCallback } from "react";
import { InteractScene } from "./InteractScene";

export function VisualNovelScreen() {
    const { 
        currentSceneId, gameState, makeChoice, customBackgroundUrl, customHeroUrl, restartGame, goBack, history,
        customSceneBackgrounds, customSceneHeroes, globalHeroTransform, customSceneHeroTransforms,
        globalDialogTransform, customSceneDialogTransforms,
        customScenes, customChoices, isSyncing, loadCustomScenarioData,
        addCustomSceneNode, addCustomChoice, deleteCustomScene, deleteCustomChoice,
        editScene, editChoice,
        customInteractConfigs, loadInteractConfigs
    } = usePentagramStore();

    useEffect(() => {
        loadCustomScenarioData();
        loadInteractConfigs();
    }, [loadCustomScenarioData, loadInteractConfigs]);

    const [isAddingMode, setIsAddingMode] = useState(false);
    const [newChoiceText, setNewChoiceText] = useState("");
    const [newSceneText, setNewSceneText] = useState("");
    const [newSpeaker, setNewSpeaker] = useState("");
    const [newSceneTitle, setNewSceneTitle] = useState("");
    const [customIdInput, setCustomIdInput] = useState("");
    const [linkToExisting, setLinkToExisting] = useState<string>("NEW_SCENE");

    const [isEditingSceneMode, setIsEditingSceneMode] = useState(false);
    const [editSceneText, setEditSceneText] = useState("");
    const [editSpeaker, setEditSpeaker] = useState("");

    const [isEditingChoiceMode, setIsEditingChoiceMode] = useState<string | null>(null);
    const [editChoiceText, setEditChoiceText] = useState("");

    const handleCreateCustom = async () => {
        if (!newChoiceText) return;
        
        if (linkToExisting === "NEW_SCENE") {
            if (!newSceneText) return;
            const newSceneId = customIdInput.trim() ? customIdInput.trim().toUpperCase() : `CUST_${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
            await addCustomSceneNode(currentSceneId, newChoiceText, newSceneId, newSceneText, newSpeaker, newSceneTitle.trim());
        } else {
            await addCustomChoice(currentSceneId, newChoiceText, linkToExisting);
        }

        setIsAddingMode(false);
        setNewChoiceText("");
        setNewSceneText("");
        setNewSpeaker("");
        setNewSceneTitle("");
        setCustomIdInput("");
        setLinkToExisting("NEW_SCENE");
    };

    let scene: any = PENTAGRAM_SCENES[currentSceneId];
    let isCustomScene = false;
    
    if (!scene) {
        scene = customScenes[currentSceneId];
        isCustomScene = true;
    } else if (customScenes[currentSceneId]) {
        scene = { ...scene, ...customScenes[currentSceneId] };
    }

    if (!scene) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-black text-red-500 font-mono">
                [CRITICAL ERROR] SCENE NODE {currentSceneId} NOT FOUND.
            </div>
        );
    }

    // ── INTERACT SCENE SWITCHOVER ──
    // If the scene is an interact scene, render the InteractScene component instead
    const handleInteractTransition = useCallback((nextSceneId: string) => {
        // Apply any onEnter effects for the next scene
        const nextScene: any = PENTAGRAM_SCENES[nextSceneId] || customScenes[nextSceneId];
        if (nextScene?.onEnter) {
            const newState = nextScene.onEnter(gameState);
            // We can't directly set gameState here, so we use jumpToScene
            // The onEnter will be handled by the store's makeChoice or jumpToScene
        }
        usePentagramStore.getState().jumpToScene(nextSceneId);
    }, [gameState, customScenes]);

    if (scene.type === 'interact' && scene.interactConfig) {
        // Merge custom interact config from Supabase on top of hardcoded config
        const baseConfig = scene.interactConfig;
        const customConfig = customInteractConfigs[currentSceneId];
        const mergedConfig = customConfig ? { ...baseConfig, ...customConfig, mechanic: { ...baseConfig.mechanic, ...(customConfig.mechanic || {}) } } : baseConfig;

        const activeBgUrl = customBackgroundUrl || customSceneBackgrounds[currentSceneId] || scene.backgroundUrl || undefined;
        return (
            <InteractScene
                config={mergedConfig}
                backgroundUrl={activeBgUrl}
                sceneTitle={scene.sceneTitle}
                narrativeOverride={typeof scene.text === 'function' ? scene.text(gameState) : scene.text}
                onSceneTransition={handleInteractTransition}
            />
        );
    }

    // Also check if there's a custom interact config that CREATES a new interact scene from a normal scene
    if (customInteractConfigs[currentSceneId]) {
        const customConfig = customInteractConfigs[currentSceneId];
        const activeBgUrl = customBackgroundUrl || customSceneBackgrounds[currentSceneId] || scene.backgroundUrl || undefined;
        return (
            <InteractScene
                config={customConfig}
                backgroundUrl={activeBgUrl}
                sceneTitle={scene.sceneTitle}
                narrativeOverride={typeof scene.text === 'function' ? scene.text(gameState) : scene.text}
                onSceneTransition={handleInteractTransition}
            />
        );
    }

    // Resolve text if it's a function
    const sceneText = typeof scene.text === 'function' ? scene.text(gameState) : scene.text;
    
    const handleSaveEditScene = async () => {
        if (!editSceneText) return;
        await editScene(currentSceneId, editSceneText, editSpeaker);
        setIsEditingSceneMode(false);
    };

    const handleSaveEditChoice = async () => {
        if (!isEditingChoiceMode || !editChoiceText) return;
        await editChoice(isEditingChoiceMode, currentSceneId, editChoiceText);
        setIsEditingChoiceMode(null);
    };

    // Merge Choices
    const hardcodedChoices = scene.choices?.filter((c: any) => !c.condition || c.condition(gameState)) || [];
    const dbChoices = customChoices[currentSceneId] || [];
    
    const choiceMap = new Map();
    hardcodedChoices.forEach((c: any) => choiceMap.set(c.id, c));
    dbChoices.forEach((c: any) => {
        if (choiceMap.has(c.id)) {
            if (c.isHidden) choiceMap.delete(c.id);
            else choiceMap.set(c.id, { ...choiceMap.get(c.id), text: c.text });
        } else {
            if (!c.isHidden) choiceMap.set(c.id, c);
        }
    });
    const mergedChoices = Array.from(choiceMap.values());

    
    // Resolve layered urls
    const activeBgUrl = customBackgroundUrl || customSceneBackgrounds[currentSceneId] || scene.backgroundUrl || "https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop";
    const isSceneBoundHero = !!(customSceneHeroes[currentSceneId] && !customHeroUrl);
    const activeHeroUrl = customHeroUrl || customSceneHeroes[currentSceneId] || scene.heroSprite;
    
    const activeTransform = isSceneBoundHero 
        ? (customSceneHeroTransforms[currentSceneId] || { scale: 100, x: 50, y: 0 }) 
        : globalHeroTransform;

    const isSceneBoundDialog = !!customSceneDialogTransforms[currentSceneId];
    const activeDialogTransform = isSceneBoundDialog
        ? customSceneDialogTransforms[currentSceneId]
        : globalDialogTransform;

    // Theming based on character focus
    const focusColors = {
        ivy: "from-amber-500/20 to-transparent border-amber-500/50",
        daisy: "from-blue-500/20 to-transparent border-blue-500/50",
        celia: "from-pink-500/20 to-transparent border-pink-500/50",
        thalia: "from-cyan-500/20 to-transparent border-cyan-500/50",
        gilang: "from-emerald-500/20 to-transparent border-emerald-500/50",
        none: "from-slate-800/80 to-slate-900/90 border-white/10"
    };

    const headerColor = {
        ivy: "text-amber-500",
        daisy: "text-blue-400",
        celia: "text-pink-500",
        thalia: "text-cyan-400",
        gilang: "text-emerald-500",
        none: "text-slate-400"
    };

    const charKey = scene.characterFocus || 'none';
    const bgGradient = focusColors[charKey as keyof typeof focusColors];
    const titleColor = headerColor[charKey as keyof typeof headerColor];

    return (
        <div className="w-full h-full relative bg-black overflow-hidden flex flex-col font-mono text-sm selection:bg-emerald-500/30">
            {/* Background Layer */}
            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeBgUrl}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1 }}
                    className="absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: `url(${activeBgUrl})` }}
                />
            </AnimatePresence>
            
            {/* Visual Effects */}
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] mix-blend-overlay pointer-events-none" />

            {/* Top Bar - Minimalist Data */}
            <div className="absolute top-14 left-0 right-0 px-6 py-4 flex justify-between items-start z-20 pointer-events-none">
                <div>
                    <div className="text-[10px] text-white/40 tracking-[0.2em]">{scene.arcTitle}</div>
                    <div className={cn("text-xs tracking-widest uppercase font-semibold mt-1", titleColor)}>
                        {scene.chapterTitle} // {scene.sceneTitle}
                    </div>
                    {/* Back Button explicitly placed under Chapter headers */}
                    {history.length > 0 && (
                        <div className="mt-4 pointer-events-auto">
                            <button
                                onClick={goBack}
                                className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs font-mono text-white/60 hover:text-white transition-all backdrop-blur-sm"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                                PREVIOUS SCENE
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex flex-col items-end gap-1 text-[10px] font-mono opacity-50">
                    <span className="flex items-center gap-2 text-emerald-500">
                        {isSyncing && <Loader2 className="w-3 h-3 animate-spin"/>}
                        SYS_HEALTH: {gameState.COMPANY_health}%
                    </span>
                    <span className="text-rose-500">ENTROPY: {gameState.CORRUPTION}%</span>
                </div>
            </div>

            {/* Custom Scene Delete Button (if applicable) */}
            {isCustomScene && (
                <div className="absolute top-24 left-6 z-30 pointer-events-auto">
                    <button 
                        onClick={() => {
                            if (window.confirm("Delete this custom scene?")) {
                                deleteCustomScene(currentSceneId);
                                goBack();
                            }
                        }}
                        className="p-2 bg-rose-500/20 text-rose-500 hover:bg-rose-500/40 rounded border border-rose-500/50 backdrop-blur-sm transition-all"
                        title="Delete Scene"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 relative z-10 flex flex-col justify-end pb-12 px-8 max-w-3xl mx-auto w-full">
                
                {/* Character Sprite Layer (if applicable) */}
                <AnimatePresence mode="wait">
                    {activeHeroUrl && (
                        <motion.div 
                            key={activeHeroUrl}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.5 }}
                            className="absolute w-[120%] h-[95vh] bg-contain bg-bottom bg-no-repeat pointer-events-none drop-shadow-2xl z-[-1] origin-bottom"
                            style={{ 
                                backgroundImage: `url(${activeHeroUrl})`,
                                left: `${activeTransform.x}%`,
                                bottom: `${activeTransform.y}%`,
                                scale: activeTransform.scale / 100,
                                x: "-50%"
                            }}
                        />
                    )}
                </AnimatePresence>

                {/* Dialog & Choices Container */}
                <div 
                    className="w-full relative z-10"
                    style={{
                        transform: `translate(${activeDialogTransform.x}%, ${activeDialogTransform.y}%) scale(${activeDialogTransform.scale / 100})`,
                        transformOrigin: 'bottom center'
                    }}
                >
                    {/* Text Box */}
                    <motion.div 
                        key={`text-${currentSceneId}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "relative bg-black/80 backdrop-blur-md rounded border border-white/20 shadow-2xl mb-4 p-5",
                            bgGradient
                        )}
                    >
                        {/* Speaker Tag (Only show if someone is talking) */}
                        {scene.speakerName && (
                            <div className={cn(
                                "absolute -top-4 left-4 px-3 py-1 rounded bg-black border text-xs tracking-wider uppercase flex items-center gap-2",
                                bgGradient
                            )}>
                                <span>{scene.speakerName}</span>
                                {scene.speakerEmoji && <span>{scene.speakerEmoji}</span>}
                            </div>
                        )}

                        <div className="text-white/90 leading-relaxed font-sans text-sm relative group">
                            {sceneText}
                            <button 
                                onClick={() => {
                                    setEditSceneText(sceneText);
                                    setEditSpeaker(scene.speakerName || "");
                                    setIsEditingSceneMode(true);
                                }}
                                className="absolute -bottom-2 -right-2 p-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-emerald-500 hover:text-black rounded text-white/50 pointer-events-auto"
                                title="Edit Document Narrative"
                            >
                                <Edit2 className="w-3 h-3" />
                            </button>
                        </div>
                    </motion.div>

                    {/* Choices */}
                    <motion.div 
                        key={`choices-${currentSceneId}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="flex flex-col gap-2"
                    >
                        {/* Unified Merged Choices */}
                        {mergedChoices.map((c: any) => {
                            const isTotallyCustom = !hardcodedChoices.find((hc: any) => hc.id === c.id);
                            return (
                                <div key={c.id} className="relative flex group pointer-events-auto items-stretch gap-1">
                                    <button
                                        onClick={() => makeChoice(c.id)}
                                        className={cn(
                                            "flex-1 text-left bg-black border border-white/10 hover:bg-neutral-900 hover:border-emerald-500/50",
                                            "transition-all duration-300 rounded p-3 shadow-xl overflow-hidden relative",
                                            c.isSecret && "border-rose-500/20 hover:border-rose-500 text-rose-200"
                                        )}
                                    >
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-white/50 transform -translate-x-full group-hover:translate-x-0 transition-transform" />
                                        <div className="flex items-center gap-3">
                                            <ChevronRight className="w-3 h-3 text-emerald-500 opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                            <span className="font-sans text-sm text-white/80 group-hover:text-white">
                                                {c.text}
                                            </span>
                                        </div>
                                    </button>
                                    
                                    <div className="flex flex-col gap-1 justify-center opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-0 bottom-0 pointer-events-none">
                                        <div className="flex items-center gap-1 my-auto pointer-events-auto">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditChoiceText(c.text);
                                                    setIsEditingChoiceMode(c.id);
                                                }}
                                                className="p-2 bg-black/80 hover:bg-emerald-500 hover:text-black border border-white/20 rounded transition-all text-white/50 shadow-md backdrop-blur-sm"
                                                title="Edit Choice Text"
                                            >
                                                <Edit2 className="w-3 h-3" />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (window.confirm("Delete this choice and any connected custom branches?")) {
                                                        deleteCustomChoice(c.id, currentSceneId);
                                                    }
                                                }}
                                                className="p-2 bg-black/80 hover:bg-rose-500 hover:text-black border border-rose-500/30 hover:border-rose-500 rounded transition-all text-rose-500 shadow-md backdrop-blur-sm"
                                                title="Delete Choice"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        <div className="flex items-center justify-between mt-2">
                            <button
                                onClick={() => setIsAddingMode(true)}
                                className="text-xs px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-white/60 hover:text-white flex items-center gap-2 pointer-events-auto transition-all"
                            >
                                <Plus className="w-3 h-3" />
                                Add Action
                            </button>

                            {(!scene.choices || scene.choices.length === 0) && (!customChoices[currentSceneId] || customChoices[currentSceneId].length === 0) && (
                                <button 
                                    onClick={restartGame}
                                    className="text-xs text-white/40 hover:text-white flex items-center gap-2 uppercase tracking-widest pointer-events-auto transition-all"
                                >
                                    <RefreshCcw className="w-3 h-3" />
                                    System Reset
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* Custom Scene Modal Overlay */}
            <AnimatePresence>
                {isAddingMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-neutral-900 border border-white/10 rounded-lg shadow-2xl p-6 w-full max-w-lg pointer-events-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Add Custom Branch</h3>
                                <button onClick={() => setIsAddingMode(false)} className="text-white/50 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Player Action / Choice</label>
                                    <input 
                                        type="text" 
                                        value={newChoiceText}
                                        onChange={e => setNewChoiceText(e.target.value)}
                                        placeholder="What does Gilang do or say?"
                                        className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Target Scene</label>
                                    <select 
                                        value={linkToExisting}
                                        onChange={e => setLinkToExisting(e.target.value)}
                                        className="w-full bg-black border border-white/20 rounded p-2 text-white outline-none focus:border-emerald-500 font-mono text-xs"
                                    >
                                        <option value="NEW_SCENE">[+] CREATE NEW SCENE</option>
                                        {Object.keys(customScenes).length > 0 && (
                                            <optgroup label="Custom Scenes">
                                                {Object.keys(customScenes).map(id => (
                                                    <option key={id} value={id}>{id} - {customScenes[id].sceneTitle || "Custom Scene"}</option>
                                                ))}
                                            </optgroup>
                                        )}
                                        <optgroup label="Hardcoded Core Scenes">
                                            {Object.keys(PENTAGRAM_SCENES).map(id => (
                                                <option key={id} value={id}>{id} - {PENTAGRAM_SCENES[id].sceneTitle || "Core Scene"}</option>
                                            ))}
                                        </optgroup>
                                    </select>
                                </div>

                                {linkToExisting === "NEW_SCENE" && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Speaker Tag (Optional)</label>
                                                <input 
                                                    type="text" 
                                                    value={newSpeaker}
                                                    onChange={e => setNewSpeaker(e.target.value)}
                                                    placeholder="e.g. Ivy, Daisy..."
                                                    className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs uppercase tracking-wider text-emerald-500/80 mb-1">Scene Title (Optional)</label>
                                                <input 
                                                    type="text" 
                                                    value={newSceneTitle}
                                                    onChange={e => setNewSceneTitle(e.target.value)}
                                                    placeholder="e.g. IVY'S SECRET"
                                                    className="w-full bg-emerald-950/20 border border-emerald-500/30 rounded p-2 text-white placeholder-emerald-500/30 focus:border-emerald-500 outline-none uppercase font-mono"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-cyan-500/80 mb-1">Custom Node ID (Optional)</label>
                                            <input 
                                                type="text" 
                                                value={customIdInput}
                                                onChange={e => setCustomIdInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                                                placeholder="Leave blank for auto-generation (A-Z, 0-9, _ only)"
                                                className="w-full bg-cyan-950/20 border border-cyan-500/30 rounded p-2 text-white placeholder-cyan-500/30 focus:border-cyan-500 outline-none uppercase font-mono text-xs"
                                            />
                                            <p className="text-[10px] text-white/40 mt-1 uppercase">Recommended format: [CHARACTER_ACTION]</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Resulting Scene Narrative</label>
                                            <textarea 
                                                value={newSceneText}
                                                onChange={e => setNewSceneText(e.target.value)}
                                                placeholder="The resulting text and narrative for this new path..."
                                                rows={4}
                                                className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none resize-none"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-3">
                                <button 
                                    onClick={() => setIsAddingMode(false)}
                                    className="px-4 py-2 rounded text-white/60 hover:bg-white/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleCreateCustom}
                                    disabled={!newChoiceText || (linkToExisting === "NEW_SCENE" && !newSceneText)}
                                    className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-semibold rounded flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Branch & Sync
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Scene Modal Overlay */}
            <AnimatePresence>
                {isEditingSceneMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-neutral-900 border border-white/10 rounded-lg shadow-2xl p-6 w-full max-w-lg pointer-events-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Edit Document Narrative</h3>
                                <button onClick={() => setIsEditingSceneMode(false)} className="text-white/50 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Speaker Tag (Optional)</label>
                                    <input 
                                        type="text" 
                                        value={editSpeaker}
                                        onChange={e => setEditSpeaker(e.target.value)}
                                        className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Scene Narrative</label>
                                    <textarea 
                                        value={editSceneText}
                                        onChange={e => setEditSceneText(e.target.value)}
                                        rows={6}
                                        className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none resize-none"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setIsEditingSceneMode(false)} className="px-4 py-2 rounded text-white/60 hover:bg-white/5 transition-all">Cancel</button>
                                <button 
                                    onClick={handleSaveEditScene}
                                    disabled={!editSceneText}
                                    className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-semibold rounded flex items-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    <Save className="w-4 h-4" /> Save Edits
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Edit Choice Modal Overlay */}
            <AnimatePresence>
                {isEditingChoiceMode && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm font-sans"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="bg-neutral-900 border border-white/10 rounded-lg shadow-2xl p-6 w-full max-w-lg pointer-events-auto"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-semibold text-white">Edit Choice Action</h3>
                                <button onClick={() => setIsEditingChoiceMode(null)} className="text-white/50 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs uppercase tracking-wider text-white/60 mb-1">Player Action Text</label>
                                    <input 
                                        type="text" 
                                        value={editChoiceText}
                                        onChange={e => setEditChoiceText(e.target.value)}
                                        className="w-full bg-black border border-white/20 rounded p-2 text-white placeholder-white/30 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div className="mt-6 flex justify-end gap-3">
                                <button onClick={() => setIsEditingChoiceMode(null)} className="px-4 py-2 rounded text-white/60 hover:bg-white/5 transition-all">Cancel</button>
                                <button 
                                    onClick={handleSaveEditChoice}
                                    disabled={!editChoiceText}
                                    className="px-4 py-2 bg-emerald-500 text-black hover:bg-emerald-400 font-semibold rounded flex items-center gap-2 disabled:opacity-50 transition-all"
                                >
                                    <Save className="w-4 h-4" /> Save Edits
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
