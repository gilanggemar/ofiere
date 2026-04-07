"use client";

import { useState, useEffect, useCallback } from "react";
import { usePentagramStore } from "@/stores/usePentagramStore";
import { usePentagramChatStore } from "@/stores/usePentagramChatStore";
import { PentagramState } from "@/lib/games/pentagram/types";
import { 
    Activity, ShieldAlert, Heart, BrainCircuit, Users, Database, Sliders, Image as ImageIcon,
    UploadCloud, Loader2, Map, Trash2, User
} from "lucide-react";
import { PENTAGRAM_SCENES } from "@/lib/games/pentagram/scenarioData";
import { PentagramCropModal } from "./PentagramCropModal";
import { AGENT_ROSTER } from "@/lib/agentRoster";

export function DevToolsPanel() {
    const { 
        gameState, 
        currentSceneId, 
        updateVariable,
        jumpToScene, 
        setCustomBackgroundUrl, 
        setCustomHeroUrl,
        bindBackgroundToScene,
        unbindBackgroundFromScene,
        bindHeroToScene,
        unbindHeroFromScene,
        customBackgroundUrl,
        customHeroUrl,
        customSceneBackgrounds,
        customSceneHeroes,
        globalHeroTransform,
        customSceneHeroTransforms,
        updateHeroTransform,
        updateSceneHeroTransform,
        globalDialogTransform,
        customSceneDialogTransforms,
        updateDialogTransform,
        updateSceneDialogTransform,
        bindDialogTransformToScene,
        unbindDialogTransformFromScene,
        dialogTransformPresets,
        saveDialogTransformPreset,
        deleteDialogTransformPreset,
        isDialogHidden,
        setIsDialogHidden,
        customScenes,
        deleteCustomScene,
        editScene
    } = usePentagramStore();

    const [isUploadingBg, setIsUploadingBg] = useState(false);
    const [isUploadingHero, setIsUploadingHero] = useState(false);
    
    // Crop states
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [activeCropType, setActiveCropType] = useState<'background' | 'hero' | null>(null);
    const [dynamicAspectRatio, setDynamicAspectRatio] = useState<number | undefined>(undefined);

    // Character asset binding from chat store
    const activeCharacterId = usePentagramChatStore(s => s.activeCharacterId);
    const characters = usePentagramChatStore(s => s.characters);
    const characterAssets = usePentagramChatStore(s => s.characterAssets);
    const setCharacterAsset = usePentagramChatStore(s => s.setCharacterAsset);
    const clearCharacterAsset = usePentagramChatStore(s => s.clearCharacterAsset);
    const activeChar = characters.find(c => c.id === activeCharacterId);

    // Asset Gallery state
    const [assets, setAssets] = useState<{name: string, url: string}[]>([]);
    const [agentGalleries, setAgentGalleries] = useState<Record<string, { id: number, imageData: string }[]>>({});

    const fetchAssets = useCallback(async () => {
        try {
            const res = await fetch('/api/games/pentagram/assets');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) setAssets(data);
            }
        } catch (e) {
            console.error("Failed to fetch assets", e);
        }
    }, []);

    useEffect(() => {
        fetchAssets();

        const fetchGalleries = async () => {
            const temp: Record<string, any[]> = {};
            for (const agent of AGENT_ROSTER) {
                try {
                    const res = await fetch(`/api/agents/hero?agentId=${agent.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        if (data && data.images) {
                            temp[agent.id] = data.images;
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch gallery for agent", agent.id, e);
                }
            }
            setAgentGalleries(temp);
        };
        fetchGalleries();
    }, [fetchAssets]);

    // Dynamic slider handler
    const handleSlider = (key: keyof PentagramState) => (e: React.ChangeEvent<HTMLInputElement>) => {
        updateVariable(key, parseInt(e.target.value, 10));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'background' | 'hero') => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (type === 'hero') {
            setIsUploadingHero(true);
            try {
                const formData = new FormData();
                formData.append('file', file, file.name || 'hero.png');
                formData.append('type', 'hero');

                const res = await fetch('/api/games/pentagram/upload', {
                    method: 'POST',
                    body: formData
                });

                if (!res.ok) throw new Error('Upload failed');
                const data = await res.json();
                
                setCustomHeroUrl(data.url);
                fetchAssets();
            } catch (error) {
                console.error(error);
                setCustomHeroUrl(URL.createObjectURL(file));
            } finally {
                setIsUploadingHero(false);
            }
            e.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (ev) => {
            setCropImageSrc(ev.target?.result as string);
            setActiveCropType(type);
            
            const vnContainer = document.getElementById('pentagram-vn-container');
            if (vnContainer && vnContainer.clientWidth && vnContainer.clientHeight) {
                setDynamicAspectRatio(vnContainer.clientWidth / vnContainer.clientHeight);
            } else {
                setDynamicAspectRatio(16 / 9); // Fallback
            }
        };
        reader.readAsDataURL(file);
        
        // Reset input value to allow selecting same file again
        e.target.value = '';
    };

    const handleApplyCrop = async (blob: Blob) => {
        if (!activeCropType) return;
        
        const type = activeCropType;
        const setLoader = type === 'background' ? setIsUploadingBg : setIsUploadingHero;
        setLoader(true);
        setCropImageSrc(null);
        setActiveCropType(null);

        try {
            const formData = new FormData();
            formData.append('file', blob, 'cropped.webp');
            formData.append('type', type);

            const res = await fetch('/api/games/pentagram/upload', {
                method: 'POST',
                body: formData
            });

            if (!res.ok) throw new Error('Upload failed');
            
            const data = await res.json();
            
            if (type === 'background') {
                setCustomBackgroundUrl(data.url);
            } else {
                setCustomHeroUrl(data.url);
            }
            fetchAssets();
        } catch (error) {
            console.error(error);
            // Fallback for visual testing if API route isn't up yet
            const objectUrl = URL.createObjectURL(blob);
            if (type === 'background') setCustomBackgroundUrl(objectUrl);
            else setCustomHeroUrl(objectUrl);
        } finally {
            setLoader(false);
        }
    };

    const handleDeleteAsset = async (url: string) => {
        const asset = assets.find(a => a.url === url);
        if (!asset) return;

        if (!confirm("Are you sure you want to permanently delete this asset from the server?")) return;

        try {
            const res = await fetch(`/api/games/pentagram/assets?file=${encodeURIComponent(asset.name)}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                if (customBackgroundUrl === url) setCustomBackgroundUrl(null);
                if (customHeroUrl === url) setCustomHeroUrl(null);
                fetchAssets();
            }
        } catch (e) {
            console.error("Failed to delete asset", e);
        }
    };

    const Bar = ({ label, value, colorClass }: { label: string, value: number, colorClass: string }) => (
        <div className="mb-2">
            <div className="flex justify-between text-xs mb-1 font-mono uppercase text-muted-foreground">
                <span>{label}</span>
                <span className={colorClass}>{value}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${colorClass.replace('text-', 'bg-')} transition-all duration-300 ease-out`}
                    style={{ width: `${value}%` }}
                />
            </div>
        </div>
    );

    return (
        <div className="w-80 border-l border-white/5 bg-black/95 flex flex-col h-full overflow-y-auto custom-scrollbar">
            <div className="p-4 border-b border-white/5 bg-white/[0.02]">
                <h3 className="font-mono text-xs uppercase text-emerald-500 flex items-center gap-2">
                    <Sliders className="w-4 h-4" />
                    Dev_Override_Panel
                </h3>
            </div>

            <div className="p-4 space-y-6">
                
                {/* Visual Overrides - File Uploads */}
                <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-mono text-muted-foreground flex items-center gap-2">
                        <ImageIcon className="w-3 h-3" /> Asset Injection
                    </h4>
                    
                    <div className="space-y-4">
                        {/* Background Upload */}
                        <div className="bg-white/5 border border-white/10 rounded-md p-3 relative overflow-hidden group">
                            <label className="flex flex-col items-center justify-center cursor-pointer text-xs text-muted-foreground hover:text-white transition-colors">
                                {isUploadingBg ? (
                                    <Loader2 className="w-5 h-5 animate-spin mb-1 text-emerald-500" />
                                ) : (
                                    <UploadCloud className="w-5 h-5 mb-1" />
                                )}
                                <span>Upload Custom Background</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'background')} />
                            </label>
                            {customBackgroundUrl && (
                                <div className="absolute inset-0 z-[-1] opacity-30 bg-cover bg-center" style={{ backgroundImage: `url(${customBackgroundUrl})`}} />
                            )}
                        </div>
                        
                        {assets.filter(a => a.name.startsWith('background')).length > 0 && (
                            <div className="relative mt-2">
                                <select 
                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white/70 font-mono focus:outline-none focus:border-emerald-500/50 appearance-none cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.value) setCustomBackgroundUrl(e.target.value);
                                    }}
                                    value={customBackgroundUrl || ""}
                                >
                                    <option value="">-- Or Pick Existing Asset --</option>
                                    {assets.filter(a => a.name.startsWith('background')).map(a => (
                                        <option key={a.url} value={a.url}>{a.name.replace('background_', '').substring(0, 16)}...</option>
                                    ))}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Activity className="w-3 h-3 text-white/30" />
                                </div>
                            </div>
                        )}

                        {/* Hero Upload */}
                        <div className="bg-white/5 border border-white/10 rounded-md p-3 relative overflow-hidden group">
                            <label className="flex flex-col items-center justify-center cursor-pointer text-xs text-muted-foreground hover:text-white transition-colors">
                                {isUploadingHero ? (
                                    <Loader2 className="w-5 h-5 animate-spin mb-1 text-emerald-500" />
                                ) : (
                                    <UploadCloud className="w-5 h-5 mb-1" />
                                )}
                                <span>Upload Character Sprite</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileUpload(e, 'hero')} />
                            </label>
                            {customHeroUrl && (
                                <div className="mt-2 text-[10px] text-emerald-500 text-center truncate px-2">{customHeroUrl.split('/').pop()} injected.</div>
                            )}
                        </div>

                        {(AGENT_ROSTER.length > 0 || assets.filter(a => a.name.startsWith('hero_')).length > 0) && (
                            <div className="relative mt-2">
                                <select 
                                    className="w-full bg-black/40 border border-white/10 rounded p-2 text-xs text-white/70 font-mono focus:outline-none focus:border-amber-500/50 appearance-none cursor-pointer"
                                    onChange={(e) => {
                                        if (e.target.value) setCustomHeroUrl(e.target.value);
                                    }}
                                    value={customHeroUrl || ""}
                                >
                                    <option value="">-- Or Pick Existing Hero --</option>
                                    <optgroup label="System Heroes (Avatars)">
                                        {AGENT_ROSTER.map(a => (
                                            <option key={`avatar-${a.id}`} value={a.avatar}>{a.name} (Avatar)</option>
                                        ))}
                                    </optgroup>

                                    {AGENT_ROSTER.map(agent => {
                                        const images = agentGalleries[agent.id];
                                        if (!images || images.length === 0) return null;
                                        return (
                                            <optgroup key={`gallery-${agent.id}`} label={`${agent.name} Gallery`}>
                                                {images.map((img, i) => (
                                                    <option key={`gallery-${agent.id}-${img.id}`} value={img.imageData}>
                                                        {agent.name} - Image {i + 1}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        );
                                    })}

                                    {assets.filter(a => a.name.startsWith('hero_')).length > 0 && (
                                        <optgroup label="Uploaded Heroes">
                                            {assets.filter(a => a.name.startsWith('hero_')).map(a => (
                                                <option key={a.url} value={a.url}>{a.name.replace('hero_', '').substring(0, 16)}...</option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                                    <Activity className="w-3 h-3 text-white/30" />
                                </div>
                            </div>
                        )}
                        
                        {(customBackgroundUrl || customHeroUrl) && (
                            <button 
                                onClick={() => { setCustomBackgroundUrl(null); setCustomHeroUrl(null); }}
                                className="text-[10px] text-red-400 hover:text-red-300 font-mono w-full text-center"
                            >
                                [CLEAR GLOBAL ASSETS]
                            </button>
                        )}

                        {customBackgroundUrl && (
                            <div className="flex gap-1.5 mt-2">
                                <button 
                                    onClick={() => {
                                        bindBackgroundToScene(currentSceneId, customBackgroundUrl);
                                        setCustomBackgroundUrl(null);
                                    }}
                                    className="flex-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono text-center border border-emerald-500/20 bg-emerald-500/5 p-1 rounded"
                                >
                                    [BIND BG → SCENE]
                                </button>
                                {activeCharacterId && activeChar && (
                                    <button 
                                        onClick={() => {
                                            setCharacterAsset(activeCharacterId, { backgroundUrl: customBackgroundUrl });
                                            setCustomBackgroundUrl(null);
                                        }}
                                        className="flex-1 text-[10px] font-mono text-center border p-1 rounded hover:brightness-125 transition-all"
                                        style={{ 
                                            color: activeChar.colorHex, 
                                            borderColor: `${activeChar.colorHex}33`,
                                            backgroundColor: `${activeChar.colorHex}0D`
                                        }}
                                    >
                                        [BG → {activeChar.name.toUpperCase()}]
                                    </button>
                                )}
                            </div>
                        )}
                        
                        {customBackgroundUrl && assets.find(a => a.url === customBackgroundUrl) && (
                            <button 
                                onClick={() => handleDeleteAsset(customBackgroundUrl)}
                                className="text-[10px] text-red-500 hover:text-red-400 font-mono w-full text-center mt-2 border border-red-500/20 bg-red-500/5 p-1 rounded"
                            >
                                [DELETE SELECTED BG FROM SERVER]
                            </button>
                        )}

                        {customHeroUrl && assets.find(a => a.url === customHeroUrl) && (
                            <button 
                                onClick={() => handleDeleteAsset(customHeroUrl)}
                                className="text-[10px] text-red-500 hover:text-red-400 font-mono w-full text-center mt-2 border border-red-500/20 bg-red-500/5 p-1 rounded"
                            >
                                [DELETE SELECTED HERO FROM SERVER]
                            </button>
                        )}
                        
                        {customHeroUrl && (
                            <div className="flex gap-1.5 mt-2">
                                <button 
                                    onClick={() => {
                                        bindHeroToScene(currentSceneId, customHeroUrl, globalHeroTransform);
                                        setCustomHeroUrl(null);
                                    }}
                                    className="flex-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono text-center border border-emerald-500/20 bg-emerald-500/5 p-1 rounded"
                                >
                                    [HERO → SCENE]
                                </button>
                                {activeCharacterId && activeChar && (
                                    <button 
                                        onClick={() => {
                                            setCharacterAsset(activeCharacterId, { 
                                                heroUrl: customHeroUrl,
                                                heroTransform: globalHeroTransform 
                                            });
                                            setCustomHeroUrl(null);
                                        }}
                                        className="flex-1 text-[10px] font-mono text-center border p-1 rounded hover:brightness-125 transition-all"
                                        style={{ 
                                            color: activeChar.colorHex, 
                                            borderColor: `${activeChar.colorHex}33`,
                                            backgroundColor: `${activeChar.colorHex}0D`
                                        }}
                                    >
                                        [HERO → {activeChar.name.toUpperCase()}]
                                    </button>
                                )}
                            </div>
                        )}

                        {/* HERO TRANSFORM OVERRIDES UI */}
                        {(customHeroUrl || customSceneHeroes[currentSceneId]) && (
                            <div className="bg-white/5 border border-white/10 rounded-md p-3 mt-4 space-y-3">
                                <h4 className="text-[10px] uppercase font-mono text-emerald-500 tracking-widest flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                    <span>HERO_TRANSFORM</span>
                                    {(customSceneHeroes[currentSceneId] && !customHeroUrl) ? <span className="text-amber-500">SCENE</span> : <span className="text-cyan-400">GLOBAL</span>}
                                </h4>
                                
                                {(() => {
                                    const isSceneBound = !!(customSceneHeroes[currentSceneId] && !customHeroUrl);
                                    const t = isSceneBound 
                                        ? (customSceneHeroTransforms[currentSceneId] || { scale: 100, x: 50, y: 0 }) 
                                        : globalHeroTransform;
                                    
                                    const updateFn = isSceneBound
                                        ? (key: 'scale' | 'x' | 'y', val: number) => updateSceneHeroTransform(currentSceneId, key, val)
                                        : (key: 'scale' | 'x' | 'y', val: number) => updateHeroTransform(key, val);

                                    return (
                                        <>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] w-12 text-muted-foreground">Scale</span>
                                                <input type="range" min="10" max="300" value={t.scale} onChange={(e) => updateFn('scale', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                                <div className="flex items-center justify-end w-12">
                                                    <input type="number" value={t.scale} onChange={(e) => updateFn('scale', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                    <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] w-12 text-muted-foreground">Pos X</span>
                                                <input type="range" min="-50" max="150" value={t.x} onChange={(e) => updateFn('x', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                                <div className="flex items-center justify-end w-12">
                                                    <input type="number" value={t.x} onChange={(e) => updateFn('x', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                    <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] w-12 text-muted-foreground">Pos Y</span>
                                                <input type="range" min="-50" max="100" value={t.y} onChange={(e) => updateFn('y', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                                <div className="flex items-center justify-end w-12">
                                                    <input type="number" value={t.y} onChange={(e) => updateFn('y', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                    <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                        
                        {customSceneBackgrounds[currentSceneId] && (
                            <div className="flex flex-col gap-1 mt-2">
                                <div className="text-[10px] text-emerald-500 text-center uppercase">
                                    ✓ Custom Background Bound to [{currentSceneId}]
                                </div>
                                <button 
                                    onClick={() => unbindBackgroundFromScene(currentSceneId)}
                                    className="text-[10px] text-zinc-400 hover:text-white font-mono w-full text-center border border-white/10 bg-black rounded p-1"
                                >
                                    [UNBIND BG]
                                </button>
                            </div>
                        )}

                        {customSceneHeroes[currentSceneId] && (
                            <div className="flex flex-col gap-1 mt-2">
                                <div className="text-[10px] text-emerald-500 text-center uppercase">
                                    ✓ Custom Hero Bound to [{currentSceneId}]
                                </div>
                                <button 
                                    onClick={() => unbindHeroFromScene(currentSceneId)}
                                    className="text-[10px] text-zinc-400 hover:text-white font-mono w-full text-center border border-white/10 bg-black rounded p-1"
                                >
                                    [UNBIND HERO]
                                </button>
                            </div>
                        )}

                        {/* Character-Bound Assets Display */}
                        {activeCharacterId && activeChar && (() => {
                            const ca = characterAssets[activeCharacterId] || {};
                            const hasAny = ca.heroUrl || ca.backgroundUrl;
                            if (!hasAny) return null;
                            return (
                                <div className="mt-3 p-2.5 rounded-md border space-y-2" style={{ borderColor: `${activeChar.colorHex}25`, backgroundColor: `${activeChar.colorHex}08` }}>
                                    <h4 className="text-[9px] uppercase font-mono tracking-widest flex items-center gap-1.5">
                                        <User className="w-3 h-3" style={{ color: activeChar.colorHex }} />
                                        <span style={{ color: activeChar.colorHex }}>{activeChar.name}</span>
                                        <span className="text-white/30">BINDINGS</span>
                                    </h4>
                                    {ca.heroUrl && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-8 rounded bg-cover bg-center border border-white/10 flex-shrink-0" style={{ backgroundImage: `url(${ca.heroUrl})` }} />
                                            <span className="text-[9px] text-white/40 font-mono flex-1 truncate">Hero</span>
                                            <button onClick={() => clearCharacterAsset(activeCharacterId, 'heroUrl')} className="text-[9px] text-rose-400/60 hover:text-rose-400 font-mono">✕</button>
                                        </div>
                                    )}
                                    {ca.backgroundUrl && (
                                        <div className="flex items-center gap-1.5">
                                            <div className="w-6 h-4 rounded bg-cover bg-center border border-white/10 flex-shrink-0" style={{ backgroundImage: `url(${ca.backgroundUrl})` }} />
                                            <span className="text-[9px] text-white/40 font-mono flex-1 truncate">Background</span>
                                            <button onClick={() => clearCharacterAsset(activeCharacterId, 'backgroundUrl')} className="text-[9px] text-rose-400/60 hover:text-rose-400 font-mono">✕</button>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                        
                        {/* DIALOG TRANSFORM OVERRIDES UI */}
                        <div className="bg-white/5 border border-white/10 rounded-md p-3 mt-4 space-y-3">
                            <h4 className="text-[10px] uppercase font-mono text-emerald-500 tracking-widest flex items-center justify-between mb-2 border-b border-white/10 pb-2">
                                <span>DIALOG_TRANSFORM</span>
                                {customSceneDialogTransforms[currentSceneId] ? <span className="text-amber-500">SCENE</span> : <span className="text-cyan-400">GLOBAL</span>}
                            </h4>
                            
                            {(() => {
                                const isSceneBoundDialog = !!customSceneDialogTransforms[currentSceneId];
                                const t = isSceneBoundDialog 
                                    ? customSceneDialogTransforms[currentSceneId]
                                    : globalDialogTransform;
                                
                                const updateFn = isSceneBoundDialog
                                    ? (key: 'scale' | 'x' | 'y', val: number) => updateSceneDialogTransform(currentSceneId, key, val)
                                    : (key: 'scale' | 'x' | 'y', val: number) => updateDialogTransform(key, val);

                                return (
                                    <>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] w-12 text-muted-foreground">Scale</span>
                                            <input type="range" min="10" max="200" value={t.scale} onChange={(e) => updateFn('scale', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                            <div className="flex items-center justify-end w-12">
                                                <input type="number" value={t.scale} onChange={(e) => updateFn('scale', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] w-12 text-muted-foreground">Pos X</span>
                                            <input type="range" min="-200" max="200" value={t.x} onChange={(e) => updateFn('x', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                            <div className="flex items-center justify-end w-12">
                                                <input type="number" value={t.x} onChange={(e) => updateFn('x', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] w-12 text-muted-foreground">Pos Y</span>
                                            <input type="range" min="-200" max="200" value={t.y} onChange={(e) => updateFn('y', parseInt(e.target.value))} className="flex-1 h-1 bg-slate-800 rounded appearance-none cursor-pointer" />
                                            <div className="flex items-center justify-end w-12">
                                                <input type="number" value={t.y} onChange={(e) => updateFn('y', parseInt(e.target.value || '0'))} className="text-[10px] text-white/90 bg-black/40 border border-white/10 rounded px-1 w-8 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus:border-emerald-500 focus:outline-none" />
                                                <span className="text-[10px] text-white/50 ml-0.5">%</span>
                                            </div>
                                        </div>

                                        {/* Presets */}
                                        <div className="pt-3 border-t border-white/5 mt-3 space-y-2">
                                            <div className="flex gap-2">
                                                <select
                                                    className="flex-1 bg-black/40 border border-white/10 rounded p-1.5 text-[10px] text-white/70 font-mono focus:outline-none"
                                                    onChange={(e) => {
                                                        const preset = dialogTransformPresets[e.target.value];
                                                        if (preset) {
                                                            updateFn('scale', preset.scale);
                                                            updateFn('x', preset.x);
                                                            updateFn('y', preset.y);
                                                        }
                                                        e.target.value = ""; // reset
                                                    }}
                                                    defaultValue=""
                                                >
                                                    <option value="" disabled>-- Load Preset --</option>
                                                    {Object.keys(dialogTransformPresets).map(presetName => (
                                                        <option key={presetName} value={presetName}>{presetName}</option>
                                                    ))}
                                                </select>
                                                <button 
                                                    onClick={() => {
                                                        const name = prompt("Name for this preset?");
                                                        if (name) saveDialogTransformPreset(name, t);
                                                    }}
                                                    className="px-2 bg-neutral-800 border border-white/10 rounded text-[10px] hover:bg-neutral-700"
                                                >
                                                    SAVE AS
                                                </button>
                                            </div>
                                        </div>

                                        {isSceneBoundDialog ? (
                                            <button 
                                                onClick={() => unbindDialogTransformFromScene(currentSceneId)}
                                                className="text-[10px] text-amber-500 hover:text-amber-400 font-mono w-full text-center border border-amber-500/20 bg-amber-500/5 p-1 rounded mt-2"
                                            >
                                                [UNBIND DIALOG]
                                            </button>
                                        ) : (
                                            <button 
                                                onClick={() => bindDialogTransformToScene(currentSceneId)}
                                                className="text-[10px] text-cyan-500 hover:text-cyan-400 font-mono w-full text-center border border-cyan-500/20 bg-cyan-500/5 p-1 rounded mt-2"
                                            >
                                                [BIND DIALOG IN SCENE]
                                            </button>
                                        )}
                                        
                                        <button 
                                            onClick={() => setIsDialogHidden(!isDialogHidden)}
                                            className={`text-[10px] font-mono w-full text-center border p-1 rounded mt-2 transition-colors ${
                                                isDialogHidden 
                                                    ? 'text-rose-500 hover:text-rose-400 border-rose-500/20 bg-rose-500/5' 
                                                    : 'text-zinc-400 hover:text-white border-white/10 bg-black hover:bg-neutral-900'
                                            }`}
                                        >
                                            {isDialogHidden ? '[SHOW DIALOG]' : '[HIDE DIALOG]'}
                                        </button>
                                    </>
                                );
                            })()}
                        </div>
                    </div>
                </div>


                {/* Scenario Navigation / Graph */}
                <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-mono text-emerald-500 tracking-widest flex items-center gap-2">
                        <Map className="w-3 h-3" /> Scene Navigation
                    </h4>
                    <select 
                        className="w-full bg-slate-900 border border-white/10 text-xs font-mono p-2 rounded text-white/80 focus:outline-none focus:border-emerald-500"
                        value={currentSceneId}
                        onChange={(e) => jumpToScene(e.target.value)}
                    >
                        <optgroup label="Core Storyline">
                            {Object.entries(PENTAGRAM_SCENES).map(([id, scene]) => (
                                <option key={id} value={id}>
                                    [{id}] {scene.sceneTitle}
                                </option>
                            ))}
                        </optgroup>
                        {Object.keys(customScenes).filter(id => !PENTAGRAM_SCENES[id]).length > 0 && (
                            <optgroup label="Custom Branches">
                                {Object.entries(customScenes)
                                    .filter(([id]) => !PENTAGRAM_SCENES[id])
                                    .map(([id, scene]) => (
                                        <option key={id} value={id}>
                                            [{id}] {scene.sceneTitle || "CUSTOM SCENE"}
                                        </option>
                                    ))}
                            </optgroup>
                        )}
                    </select>

                    {/* Quick-delete list for custom scenes */}
                    {Object.keys(customScenes).filter(id => !PENTAGRAM_SCENES[id]).length > 0 && (
                        <div className="space-y-1 mt-2">
                            <span className="text-[9px] uppercase font-mono text-white/30 tracking-wider">Custom Scenes</span>
                            {Object.entries(customScenes)
                                .filter(([id]) => !PENTAGRAM_SCENES[id])
                                .map(([id, scene]) => (
                                    <div key={id} className="flex items-center gap-1.5 group">
                                        <button
                                            onClick={() => jumpToScene(id)}
                                            className={`flex-1 text-left text-[10px] font-mono px-2 py-1 rounded truncate transition-all ${
                                                id === currentSceneId
                                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                                            }`}
                                        >
                                            {scene.sceneTitle || id}
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Delete scene "${scene.sceneTitle || id}"?`)) {
                                                    deleteCustomScene(id);
                                                    if (currentSceneId === id) jumpToScene("P_START");
                                                }
                                            }}
                                            className="p-1 opacity-0 group-hover:opacity-100 text-rose-500/50 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all"
                                            title="Delete scene"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                        </div>
                    )}

                    {customScenes[currentSceneId] && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => {
                                    const newTitle = prompt("Enter new scene title:", customScenes[currentSceneId].sceneTitle || PENTAGRAM_SCENES[currentSceneId]?.sceneTitle || "");
                                    if (newTitle !== null && newTitle.trim() !== "") {
                                        editScene(currentSceneId, customScenes[currentSceneId].text || PENTAGRAM_SCENES[currentSceneId]?.text || "", customScenes[currentSceneId].speakerName, newTitle.trim());
                                    }
                                }}
                                className="flex-1 p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[10px] font-mono text-white/60 hover:text-white transition-all text-center"
                            >
                                [RENAME SCENE]
                            </button>
                            {!PENTAGRAM_SCENES[currentSceneId] && (
                                <button
                                    onClick={() => {
                                        if (window.confirm("Delete this custom scene branch completely?")) {
                                            deleteCustomScene(currentSceneId);
                                            jumpToScene("P_START");
                                        }
                                    }}
                                    className="p-1.5 flex items-center justify-center bg-rose-500/10 hover:bg-rose-500/30 text-rose-500 border border-rose-500/30 rounded transition-all w-8"
                                    title="Delete custom scene"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Architecture State - Global */}
                <div className="space-y-3">
                    <h4 className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest flex items-center gap-2">
                        <Activity className="w-3 h-3" /> Core Metrics
                    </h4>
                    
                    <Bar label="Company Health" value={gameState.COMPANY_health} colorClass="text-emerald-400" />
                    <Bar label="Corruption" value={gameState.CORRUPTION} colorClass="text-rose-500" />
                    <Bar label="Gilang Control" value={gameState.GILANG_control} colorClass="text-blue-400" />
                    <Bar label="Sentinel Gap" value={gameState.SENTINEL_gap} colorClass="text-purple-500" />
                </div>

                {/* Character Matrix */}
                <div className="space-y-4 pt-2 border-t border-white/5">
                    <h4 className="text-[10px] uppercase font-mono text-muted-foreground tracking-widest flex items-center gap-2">
                        <Database className="w-3 h-3" /> State Forcing
                    </h4>

                    {/* IVY */}
                    <div className="space-y-2 bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-xs font-mono text-amber-500 flex items-center justify-between">
                            IVY <span className="text-[10px] text-muted-foreground">The Axis</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16">Affection</span>
                            <input type="range" min="0" max="100" value={gameState.IVY_affection} onChange={handleSlider('IVY_affection')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16">Resistance</span>
                            <input type="range" min="0" max="100" value={gameState.IVY_resistance} onChange={handleSlider('IVY_resistance')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>

                    {/* DAISY */}
                    <div className="space-y-2 bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-xs font-mono text-blue-400 flex items-center justify-between">
                            DAISY <span className="text-[10px] text-muted-foreground">The Oracle</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16">Trust</span>
                            <input type="range" min="0" max="100" value={gameState.DAISY_trust} onChange={handleSlider('DAISY_trust')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16">Obsession</span>
                            <input type="range" min="0" max="100" value={gameState.DAISY_obsession} onChange={handleSlider('DAISY_obsession')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>

                    {/* CELIA */}
                    <div className="space-y-2 bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-xs font-mono text-pink-500 flex items-center justify-between">
                            CELIA <span className="text-[10px] text-muted-foreground">The Forge</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16 border-b border-dashed border-white/20" title="Vulnerability">Vuln.</span>
                            <input type="range" min="0" max="100" value={gameState.CELIA_vulnerability} onChange={handleSlider('CELIA_vulnerability')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16">Stability</span>
                            <input type="range" min="0" max="100" value={gameState.CELIA_stability} onChange={handleSlider('CELIA_stability')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>

                    {/* THALIA */}
                    <div className="space-y-2 bg-slate-900/50 p-2 rounded border border-white/5">
                        <span className="text-xs font-mono text-cyan-400 flex items-center justify-between">
                            THALIA <span className="text-[10px] text-muted-foreground">The Conduit</span>
                        </span>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16 border-b border-dashed border-white/20" title="Recalibration">Recalib.</span>
                            <input type="range" min="0" max="100" value={gameState.THALIA_recalibration} onChange={handleSlider('THALIA_recalibration')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] w-16 border-b border-dashed border-white/20" title="Realness Factor">Real</span>
                            <input type="range" min="0" max="100" value={gameState.THALIA_real} onChange={handleSlider('THALIA_real')} className="flex-1 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>

                </div>

            </div>

            {cropImageSrc && activeCropType && (
                <PentagramCropModal 
                    imageSrc={cropImageSrc}
                    aspectRatio={dynamicAspectRatio}
                    onClose={() => {
                        setCropImageSrc(null);
                        setActiveCropType(null);
                    }}
                    onApply={handleApplyCrop}
                />
            )}
        </div>
    );
}
