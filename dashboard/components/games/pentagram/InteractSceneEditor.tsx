"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    X, Save, Trash2, Plus, Loader2, GripHorizontal,
    Sliders, MousePointerClick, Image as ImageIcon, Zap,
    ChevronDown, Upload, Eye, EyeOff, Palette
} from "lucide-react";
import { usePentagramStore } from "@/stores/usePentagramStore";
import {
    InteractSceneConfig,
    InteractMechanicConfig,
    InteractButton,
    InteractButtonAction,
    OverrideTransitionMode,
    ImageSequenceMapping,
} from "@/lib/games/pentagram/types";
import { PENTAGRAM_SCENES } from "@/lib/games/pentagram/scenarioData";

// ============================================================
// INTERACT SCENE EDITOR — Draggable floating configuration panel
// ============================================================

const TABS = [
    { id: "mechanic", label: "Mechanic", icon: Sliders },
    { id: "buttons", label: "Buttons", icon: MousePointerClick },
    { id: "visuals", label: "Visuals", icon: ImageIcon },
    { id: "events", label: "Events", icon: Zap },
] as const;

type TabId = typeof TABS[number]["id"];

// Helper: get all scene IDs for dropdowns
function getAllSceneIds(): string[] {
    const hardcoded = Object.keys(PENTAGRAM_SCENES);
    const custom = Object.keys(usePentagramStore.getState().customScenes);
    return [...new Set([...hardcoded, ...custom])].sort();
}

// ── SECTION COMPONENTS ──

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-mono mt-4 mb-2 first:mt-0">
            {children}
        </div>
    );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-[11px] text-white/60 font-mono whitespace-nowrap shrink-0">{label}</label>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function NumberInput({
    value, onChange, min = 0, max = 100, step = 1, className
}: {
    value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string;
}) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1 h-1 accent-orange-500 bg-white/10 rounded-full appearance-none cursor-pointer"
            />
            <input
                type="number"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="w-14 text-right text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-white/80 font-mono"
            />
        </div>
    );
}

function TextInput({
    value, onChange, placeholder, className
}: {
    value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
    return (
        <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={cn(
                "w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-orange-500/50",
                className
            )}
        />
    );
}

function SelectInput({
    value, onChange, options, className
}: {
    value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; className?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn(
                "w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/80 font-mono focus:outline-none focus:border-orange-500/50 appearance-none cursor-pointer",
                className
            )}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-neutral-900 text-white">
                    {opt.label}
                </option>
            ))}
        </select>
    );
}

function Toggle({
    value, onChange, label
}: { value: boolean; onChange: (v: boolean) => void; label?: string }) {
    return (
        <button
            onClick={() => onChange(!value)}
            className={cn(
                "flex items-center gap-2 text-[11px] font-mono px-2 py-1 rounded transition-colors",
                value
                    ? "text-emerald-400 bg-emerald-500/10 border border-emerald-500/30"
                    : "text-white/40 bg-white/5 border border-white/10"
            )}
        >
            {value ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {label}
        </button>
    );
}

function SceneSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
    const sceneIds = getAllSceneIds();
    return (
        <SelectInput
            value={value}
            onChange={onChange}
            options={[
                { value: "", label: "— Select Scene —" },
                ...sceneIds.map((id) => ({ value: id, label: id })),
            ]}
        />
    );
}

// ── TAB: MECHANIC ──

function MechanicTab({
    config, onChange
}: {
    config: InteractSceneConfig;
    onChange: (config: InteractSceneConfig) => void;
}) {
    const mechanic = config.mechanic;
    const updateMechanic = (patch: Partial<InteractMechanicConfig>) => {
        onChange({ ...config, mechanic: { ...mechanic, ...patch } as InteractMechanicConfig });
    };

    return (
        <div className="space-y-1">
            <SectionLabel>Mechanic Type</SectionLabel>
            <SelectInput
                value={mechanic.type}
                onChange={(v) => {
                    const base = { type: v as any };
                    if (v === "resistance") {
                        onChange({
                            ...config,
                            mechanic: { ...base, victoryFillRate: 15, resistanceDrainRate: 8, breakFreeThreshold: 20, onBreakFreeSceneId: "", onVictorySceneId: "" } as any
                        });
                    } else if (v === "obstacle") {
                        onChange({
                            ...config,
                            mechanic: { ...base, forcePerPress: 5, onObstacleClearedSceneId: "" } as any
                        });
                    } else if (v === "pain_threshold") {
                        onChange({
                            ...config,
                            mechanic: { ...base, intensityPerPress: 3, painPerPress: 5, painDrainRate: 10, onCrackSceneId: "", onSuccessSceneId: "" } as any
                        });
                    }
                }}
                options={[
                    { value: "resistance", label: "Resistance (Hold to Pin)" },
                    { value: "obstacle", label: "Obstacle (Spam to Force)" },
                    { value: "pain_threshold", label: "Pain Threshold (Don't Break)" },
                ]}
            />

            <SectionLabel>Mechanic Parameters</SectionLabel>

            {mechanic.type === "resistance" && (
                <>
                    <FieldRow label="Pin Button Label">
                        <TextInput value={mechanic.pinButtonLabel || "⚡ HOLD TO PIN"} onChange={(v) => updateMechanic({ pinButtonLabel: v })} />
                    </FieldRow>
                    <FieldRow label="Victory Fill Rate">
                        <NumberInput value={mechanic.victoryFillRate} onChange={(v) => updateMechanic({ victoryFillRate: v })} max={100} />
                    </FieldRow>
                    <FieldRow label="Resistance Drain">
                        <NumberInput value={mechanic.resistanceDrainRate} onChange={(v) => updateMechanic({ resistanceDrainRate: v })} max={50} />
                    </FieldRow>
                    <FieldRow label="Break Free %">
                        <NumberInput value={mechanic.breakFreeThreshold} onChange={(v) => updateMechanic({ breakFreeThreshold: v })} max={100} />
                    </FieldRow>
                    <FieldRow label="On Victory →">
                        <SceneSelect value={mechanic.onVictorySceneId} onChange={(v) => updateMechanic({ onVictorySceneId: v })} />
                    </FieldRow>
                    <FieldRow label="On Break Free →">
                        <SceneSelect value={mechanic.onBreakFreeSceneId} onChange={(v) => updateMechanic({ onBreakFreeSceneId: v })} />
                    </FieldRow>
                    <FieldRow label="Fail Transition">
                        <SelectInput
                            value={mechanic.failTransitionMode || "immediate"}
                            onChange={(v) => updateMechanic({ failTransitionMode: v as OverrideTransitionMode })}
                            options={[
                                { value: "immediate", label: "Immediate Jump" },
                                { value: "brief_animation", label: "Brief Animation" },
                                { value: "brief_scene", label: "Brief Scene/Image" },
                            ]}
                        />
                    </FieldRow>
                    {mechanic.failTransitionMode && mechanic.failTransitionMode !== "immediate" && (
                        <FieldRow label="Fail Duration (ms)">
                            <NumberInput value={mechanic.failTransitionDurationMs || 1500} onChange={(v) => updateMechanic({ failTransitionDurationMs: v })} min={200} max={10000} step={100} />
                        </FieldRow>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <Toggle value={mechanic.enableHitPhase || false} onChange={(v) => updateMechanic({ enableHitPhase: v })} label="Hit Phase" />
                    </div>
                    {mechanic.enableHitPhase && (
                        <>
                            <FieldRow label="Hit Target">
                                <NumberInput value={mechanic.hitPhaseTarget || 10} onChange={(v) => updateMechanic({ hitPhaseTarget: v })} min={1} max={100} />
                            </FieldRow>
                            <FieldRow label="On Hit Done →">
                                <SceneSelect value={mechanic.onHitCompleteSceneId || ""} onChange={(v) => updateMechanic({ onHitCompleteSceneId: v })} />
                            </FieldRow>
                        </>
                    )}
                </>
            )}

            {mechanic.type === "obstacle" && (
                <>
                    <FieldRow label="Force Button Label">
                        <TextInput value={mechanic.forceButtonLabel || "⚡ FORCE"} onChange={(v) => updateMechanic({ forceButtonLabel: v })} />
                    </FieldRow>
                    <FieldRow label="Obstacle Start">
                        <NumberInput value={mechanic.obstacleStartValue || 100} onChange={(v) => updateMechanic({ obstacleStartValue: v })} max={500} />
                    </FieldRow>
                    <FieldRow label="Force Per Press">
                        <NumberInput value={mechanic.forcePerPress} onChange={(v) => updateMechanic({ forcePerPress: v })} max={50} />
                    </FieldRow>
                    <FieldRow label="Max Spam Rate">
                        <NumberInput value={mechanic.maxSpamRate || 0} onChange={(v) => updateMechanic({ maxSpamRate: v })} max={30} />
                    </FieldRow>
                    <FieldRow label="On Cleared →">
                        <SceneSelect value={mechanic.onObstacleClearedSceneId || ""} onChange={(v) => updateMechanic({ onObstacleClearedSceneId: v })} />
                    </FieldRow>
                    <FieldRow label="On Break →">
                        <SceneSelect value={mechanic.onBreakSceneId || ""} onChange={(v) => updateMechanic({ onBreakSceneId: v })} />
                    </FieldRow>
                    <FieldRow label="Break Transition">
                        <SelectInput
                            value={mechanic.breakTransitionMode || "immediate"}
                            onChange={(v) => updateMechanic({ breakTransitionMode: v as OverrideTransitionMode })}
                            options={[
                                { value: "immediate", label: "Immediate Jump" },
                                { value: "brief_animation", label: "Brief Animation" },
                                { value: "brief_scene", label: "Brief Scene/Image" },
                            ]}
                        />
                    </FieldRow>
                    <FieldRow label="Flicker Interval">
                        <NumberInput value={mechanic.forceButtonFlickerInterval || 0} onChange={(v) => updateMechanic({ forceButtonFlickerInterval: v })} max={10000} step={100} />
                    </FieldRow>
                    {(mechanic.forceButtonFlickerInterval ?? 0) > 0 && (
                        <FieldRow label="Flicker Duration">
                            <NumberInput value={mechanic.forceButtonFlickerDuration || 1500} onChange={(v) => updateMechanic({ forceButtonFlickerDuration: v })} max={5000} step={100} />
                        </FieldRow>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                        <Toggle value={mechanic.enableHitPhase || false} onChange={(v) => updateMechanic({ enableHitPhase: v })} label="Hit Phase" />
                    </div>
                    {mechanic.enableHitPhase && (
                        <>
                            <FieldRow label="Hit Target">
                                <NumberInput value={mechanic.hitPhaseTarget || 10} onChange={(v) => updateMechanic({ hitPhaseTarget: v })} min={1} max={100} />
                            </FieldRow>
                            <FieldRow label="On Hit Done →">
                                <SceneSelect value={mechanic.onHitCompleteSceneId || ""} onChange={(v) => updateMechanic({ onHitCompleteSceneId: v })} />
                            </FieldRow>
                        </>
                    )}
                </>
            )}

            {mechanic.type === "pain_threshold" && (
                <>
                    <FieldRow label="Hit Button Label">
                        <TextInput value={mechanic.hitButtonLabel || "💥 STRIKE"} onChange={(v) => updateMechanic({ hitButtonLabel: v })} />
                    </FieldRow>
                    <FieldRow label="Intensity/Press">
                        <NumberInput value={mechanic.intensityPerPress} onChange={(v) => updateMechanic({ intensityPerPress: v })} max={20} />
                    </FieldRow>
                    <FieldRow label="Pain/Press">
                        <NumberInput value={mechanic.painPerPress} onChange={(v) => updateMechanic({ painPerPress: v })} max={20} />
                    </FieldRow>
                    <FieldRow label="Pain Drain/s">
                        <NumberInput value={mechanic.painDrainRate} onChange={(v) => updateMechanic({ painDrainRate: v })} max={50} />
                    </FieldRow>
                    <FieldRow label="Intensity Target">
                        <NumberInput value={mechanic.intensityTarget || 100} onChange={(v) => updateMechanic({ intensityTarget: v })} max={500} />
                    </FieldRow>
                    <FieldRow label="Pain Crack At">
                        <NumberInput value={mechanic.painCrackThreshold || 100} onChange={(v) => updateMechanic({ painCrackThreshold: v })} max={500} />
                    </FieldRow>
                    <FieldRow label="On Success →">
                        <SceneSelect value={mechanic.onSuccessSceneId} onChange={(v) => updateMechanic({ onSuccessSceneId: v })} />
                    </FieldRow>
                    <FieldRow label="On Crack →">
                        <SceneSelect value={mechanic.onCrackSceneId} onChange={(v) => updateMechanic({ onCrackSceneId: v })} />
                    </FieldRow>
                    <FieldRow label="Hidden Crack →">
                        <SceneSelect value={mechanic.onHiddenCrackSceneId || ""} onChange={(v) => updateMechanic({ onHiddenCrackSceneId: v || undefined })} />
                    </FieldRow>
                    <FieldRow label="Crack Transition">
                        <SelectInput
                            value={mechanic.crackTransitionMode || "immediate"}
                            onChange={(v) => updateMechanic({ crackTransitionMode: v as OverrideTransitionMode })}
                            options={[
                                { value: "immediate", label: "Immediate Jump" },
                                { value: "brief_animation", label: "Brief Animation" },
                                { value: "brief_scene", label: "Brief Scene/Image" },
                            ]}
                        />
                    </FieldRow>
                </>
            )}

            <SectionLabel>Narrative Text</SectionLabel>
            <textarea
                value={config.narrativeText || ""}
                onChange={(e) => onChange({ ...config, narrativeText: e.target.value })}
                placeholder="Optional narrative text during this scene..."
                rows={3}
                className="w-full text-xs bg-white/5 border border-white/10 rounded px-2 py-1.5 text-white/80 font-mono placeholder:text-white/20 focus:outline-none focus:border-orange-500/50 resize-y"
            />

            <SectionLabel>HUD Bars</SectionLabel>
            <div className="flex flex-wrap gap-2">
                <Toggle value={config.showBars?.victory !== false} onChange={(v) => onChange({ ...config, showBars: { ...config.showBars, victory: v } })} label="Victory" />
                <Toggle value={config.showBars?.resistance !== false} onChange={(v) => onChange({ ...config, showBars: { ...config.showBars, resistance: v } })} label="Resistance" />
                <Toggle value={config.showBars?.obstacle !== false} onChange={(v) => onChange({ ...config, showBars: { ...config.showBars, obstacle: v } })} label="Obstacle" />
                <Toggle value={config.showBars?.intensity !== false} onChange={(v) => onChange({ ...config, showBars: { ...config.showBars, intensity: v } })} label="Intensity" />
                <Toggle value={config.showBars?.pain !== false} onChange={(v) => onChange({ ...config, showBars: { ...config.showBars, pain: v } })} label="Pain" />
            </div>
        </div>
    );
}

// ── TAB: BUTTONS ──

function ButtonEditor({
    button, onChange, onDelete
}: {
    button: InteractButton;
    onChange: (btn: InteractButton) => void;
    onDelete: () => void;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="border border-white/10 rounded-lg p-3 bg-white/[0.02] space-y-2">
            <div className="flex items-center justify-between">
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-xs text-white/70 font-mono flex-1">
                    <ChevronDown className={cn("w-3 h-3 transition-transform", expanded && "rotate-180")} />
                    <span className="truncate">{button.label || "Untitled Button"}</span>
                </button>
                <div className="flex items-center gap-1.5">
                    <Toggle value={button.visible !== false} onChange={(v) => onChange({ ...button, visible: v })} />
                    <button onClick={onDelete} className="p-1 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded">
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="space-y-2 pt-2 border-t border-white/5">
                    <FieldRow label="Label">
                        <TextInput value={button.label} onChange={(v) => onChange({ ...button, label: v })} placeholder="Button text" />
                    </FieldRow>
                    <FieldRow label="Color">
                        <div className="flex items-center gap-2">
                            <input
                                type="color"
                                value={button.color || "#8b5cf6"}
                                onChange={(e) => onChange({ ...button, color: e.target.value })}
                                className="w-6 h-6 border-0 bg-transparent cursor-pointer"
                            />
                            <TextInput value={button.color || "#8b5cf6"} onChange={(v) => onChange({ ...button, color: v })} className="flex-1" />
                        </div>
                    </FieldRow>
                    <FieldRow label="Position X%">
                        <NumberInput value={button.posX ?? 50} onChange={(v) => onChange({ ...button, posX: v })} />
                    </FieldRow>
                    <FieldRow label="Position Y%">
                        <NumberInput value={button.posY ?? 85} onChange={(v) => onChange({ ...button, posY: v })} />
                    </FieldRow>
                    <FieldRow label="Scale">
                        <NumberInput value={(button.scale || 1) * 100} onChange={(v) => onChange({ ...button, scale: v / 100 })} min={10} max={300} />
                    </FieldRow>
                    <div className="flex items-center gap-3">
                        <Toggle value={button.holdMode || false} onChange={(v) => onChange({ ...button, holdMode: v })} label="Hold Mode" />
                    </div>

                    {/* Actions */}
                    <SectionLabel>Actions on Press</SectionLabel>
                    {(button.actions || []).map((action, i) => (
                        <ActionEditor
                            key={i}
                            action={action}
                            onChange={(a) => {
                                const newActions = [...(button.actions || [])];
                                newActions[i] = a;
                                onChange({ ...button, actions: newActions });
                            }}
                            onDelete={() => {
                                const newActions = [...(button.actions || [])];
                                newActions.splice(i, 1);
                                onChange({ ...button, actions: newActions });
                            }}
                        />
                    ))}
                    <button
                        onClick={() => onChange({ ...button, actions: [...(button.actions || []), { type: 'proceed_to_scene', sceneId: '' }] })}
                        className="flex items-center gap-1.5 text-[10px] text-orange-400 hover:text-orange-300 font-mono"
                    >
                        <Plus className="w-3 h-3" /> Add Action
                    </button>
                </div>
            )}
        </div>
    );
}

function ActionEditor({
    action, onChange, onDelete
}: {
    action: InteractButtonAction;
    onChange: (a: InteractButtonAction) => void;
    onDelete: () => void;
}) {
    return (
        <div className="flex items-start gap-2 p-2 bg-white/[0.03] rounded border border-white/5">
            <div className="flex-1 space-y-1.5">
                <SelectInput
                    value={action.type}
                    onChange={(v) => {
                        // Reset action when type changes
                        if (v === 'proceed_to_scene') onChange({ type: 'proceed_to_scene', sceneId: '' });
                        else if (v === 'override_to_scene') onChange({ type: 'override_to_scene', sceneId: '', transitionMode: 'immediate' });
                        else if (v === 'change_background') onChange({ type: 'change_background', backgroundUrl: '' });
                        else if (v === 'change_hero') onChange({ type: 'change_hero', heroUrl: '' });
                        else if (v === 'trigger_interact_button') onChange({ type: 'trigger_interact_button', buttonId: '' });
                        else if (v === 'trigger_animation') onChange({ type: 'trigger_animation', targetButtonId: '' });
                        else if (v === 'play_sequence') onChange({ type: 'play_sequence', sequenceId: '' });
                        else if (v === 'custom_effect') onChange({ type: 'custom_effect', effectKey: '' });
                    }}
                    options={[
                        { value: 'proceed_to_scene', label: '→ Proceed to Scene' },
                        { value: 'override_to_scene', label: '⚡ Override to Scene' },
                        { value: 'change_background', label: '🖼 Change Background' },
                        { value: 'change_hero', label: '👤 Change Hero' },
                        { value: 'trigger_interact_button', label: '🔘 Trigger Button' },
                        { value: 'trigger_animation', label: '🎬 Trigger Animation' },
                        { value: 'play_sequence', label: '📽 Play Sequence' },
                        { value: 'custom_effect', label: '🔧 Custom Effect' },
                    ]}
                />

                {(action.type === 'proceed_to_scene' || action.type === 'override_to_scene') && (
                    <>
                        <SceneSelect value={(action as any).sceneId} onChange={(v) => onChange({ ...action, sceneId: v } as any)} />
                        {'transitionMode' in action && (
                            <SelectInput
                                value={(action as any).transitionMode || 'immediate'}
                                onChange={(v) => onChange({ ...action, transitionMode: v as OverrideTransitionMode } as any)}
                                options={[
                                    { value: 'immediate', label: 'Immediate' },
                                    { value: 'brief_animation', label: 'Brief Animation' },
                                    { value: 'brief_scene', label: 'Brief Scene' },
                                ]}
                            />
                        )}
                    </>
                )}

                {action.type === 'change_background' && (
                    <TextInput value={action.backgroundUrl} onChange={(v) => onChange({ type: 'change_background', backgroundUrl: v })} placeholder="Image URL..." />
                )}

                {action.type === 'change_hero' && (
                    <TextInput value={action.heroUrl} onChange={(v) => onChange({ type: 'change_hero', heroUrl: v })} placeholder="Image URL..." />
                )}

                {action.type === 'trigger_interact_button' && (
                    <TextInput value={action.buttonId} onChange={(v) => onChange({ type: 'trigger_interact_button', buttonId: v })} placeholder="Button ID..." />
                )}

                {action.type === 'trigger_animation' && (
                    <TextInput value={action.targetButtonId} onChange={(v) => onChange({ type: 'trigger_animation', targetButtonId: v })} placeholder="Target Button ID..." />
                )}

                {action.type === 'play_sequence' && (
                    <TextInput value={action.sequenceId} onChange={(v) => onChange({ type: 'play_sequence', sequenceId: v })} placeholder="Sequence ID..." />
                )}

                {action.type === 'custom_effect' && (
                    <TextInput value={action.effectKey} onChange={(v) => onChange({ type: 'custom_effect', effectKey: v })} placeholder="Effect key..." />
                )}
            </div>
            <button onClick={onDelete} className="p-1 text-rose-400 hover:text-rose-300 shrink-0 mt-0.5">
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}

function ButtonsTab({
    config, onChange
}: {
    config: InteractSceneConfig;
    onChange: (config: InteractSceneConfig) => void;
}) {
    const buttons = config.customButtons || [];

    const addButton = () => {
        const newBtn: InteractButton = {
            id: `btn_${Date.now()}`,
            label: "New Button",
            color: "#8b5cf6",
            posX: 50,
            posY: 85,
            scale: 1,
            visible: true,
            actions: [],
        };
        onChange({ ...config, customButtons: [...buttons, newBtn] });
    };

    return (
        <div className="space-y-3">
            <SectionLabel>Interactive Buttons ({buttons.length})</SectionLabel>

            {buttons.map((btn, i) => (
                <ButtonEditor
                    key={btn.id}
                    button={btn}
                    onChange={(updated) => {
                        const newBtns = [...buttons];
                        newBtns[i] = updated;
                        onChange({ ...config, customButtons: newBtns });
                    }}
                    onDelete={() => {
                        onChange({ ...config, customButtons: buttons.filter((_, j) => j !== i) });
                    }}
                />
            ))}

            <button
                onClick={addButton}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] text-orange-400 hover:text-orange-300 font-mono border border-dashed border-orange-500/30 hover:border-orange-500/50 rounded-lg transition-colors"
            >
                <Plus className="w-3.5 h-3.5" /> Add Button
            </button>
        </div>
    );
}

// ── TAB: VISUALS ──

function VisualsTab({
    config, onChange
}: {
    config: InteractSceneConfig;
    onChange: (config: InteractSceneConfig) => void;
}) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<string>("");
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { saveImageSequence } = usePentagramStore();

    const handleSequenceUpload = useCallback(async (files: FileList) => {
        setUploadError(null);
        setUploading(true);

        // Validate all files are webp
        for (const file of Array.from(files)) {
            const ext = file.name.split('.').pop()?.toLowerCase();
            if (ext !== 'webp') {
                setUploadError(`"${file.name}" is not a .webp file. Please convert all images to WebP format to avoid lag and ensure optimal performance.`);
                setUploading(false);
                return;
            }
        }

        try {
            const sequenceId = `seq_${Date.now()}`;
            setUploadProgress(`Uploading ${files.length} frames...`);

            const formData = new FormData();
            formData.append("type", "sequence_bulk");
            formData.append("sequence_id", sequenceId);
            Array.from(files).forEach((file) => formData.append("files", file));

            const res = await fetch("/api/games/pentagram/upload", { method: "POST", body: formData });
            const data = await res.json();

            if (!res.ok) {
                setUploadError(data.error || "Upload failed");
                return;
            }

            // Save the image sequence to DB
            const sequenceName = `Sequence ${new Date().toLocaleTimeString()}`;
            await saveImageSequence({
                name: sequenceName,
                frame_count: data.count,
                frame_urls: data.urls,
            });

            setUploadProgress(`✓ ${data.count} frames uploaded`);
            setTimeout(() => setUploadProgress(""), 3000);
        } catch (e: any) {
            setUploadError(e.message || "Upload failed");
        } finally {
            setUploading(false);
        }
    }, [saveImageSequence]);

    return (
        <div className="space-y-1">
            <SectionLabel>Image Sequences</SectionLabel>

            {/* Upload zone */}
            <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.dataTransfer.files.length) handleSequenceUpload(e.dataTransfer.files);
                }}
                className={cn(
                    "border-2 border-dashed rounded-lg p-4 cursor-pointer transition-colors text-center",
                    uploading
                        ? "border-orange-500/50 bg-orange-500/5"
                        : "border-white/10 hover:border-orange-500/30 bg-white/[0.02]"
                )}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".webp"
                    className="hidden"
                    onChange={(e) => {
                        if (e.target.files?.length) handleSequenceUpload(e.target.files);
                    }}
                />
                {uploading ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-orange-400" />
                        <span className="text-[11px] text-orange-400 font-mono">{uploadProgress}</span>
                    </div>
                ) : (
                    <>
                        <Upload className="w-5 h-5 text-white/30 mx-auto mb-1.5" />
                        <div className="text-[11px] text-white/40 font-mono">
                            Drop .webp frames here or click to upload
                        </div>
                        <div className="text-[9px] text-white/20 font-mono mt-1">
                            Only .webp format accepted
                        </div>
                    </>
                )}
            </div>

            {uploadError && (
                <div className="text-[10px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded p-2 font-mono">
                    ⚠ {uploadError}
                </div>
            )}

            {uploadProgress && !uploading && (
                <div className="text-[10px] text-emerald-400 font-mono">{uploadProgress}</div>
            )}

            <SectionLabel>Sequence Library</SectionLabel>
            <SequenceLibrary />
        </div>
    );
}

function SequenceLibrary() {
    const { imageSequences, loadImageSequences, deleteImageSequence } = usePentagramStore();

    useEffect(() => {
        loadImageSequences();
    }, [loadImageSequences]);

    if (imageSequences.length === 0) {
        return <div className="text-[10px] text-white/30 font-mono py-2">No sequences uploaded yet</div>;
    }

    return (
        <div className="space-y-2 max-h-48 overflow-y-auto">
            {imageSequences.map((seq) => (
                <div key={seq.id} className="flex items-center justify-between p-2 bg-white/[0.03] rounded border border-white/5">
                    <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-white/70 font-mono truncate">{seq.name}</div>
                        <div className="text-[9px] text-white/30 font-mono">{seq.frameCount} frames · ID: {seq.id?.slice(0, 8)}...</div>
                    </div>
                    <button
                        onClick={() => deleteImageSequence(seq.id)}
                        className="p-1 text-rose-400 hover:text-rose-300 shrink-0"
                    >
                        <Trash2 className="w-3 h-3" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// ── TAB: EVENTS ──

function EventsTab({
    config, onChange
}: {
    config: InteractSceneConfig;
    onChange: (config: InteractSceneConfig) => void;
}) {
    const mechanic = config.mechanic;

    return (
        <div className="space-y-1">
            <SectionLabel>Event Wiring Overview</SectionLabel>
            <div className="text-[10px] text-white/40 font-mono mb-3">
                View and modify what happens when mechanic events trigger.
            </div>

            <div className="space-y-2">
                {mechanic.type === "resistance" && (
                    <>
                        <EventRow label="Victory" target={mechanic.onVictorySceneId} />
                        <EventRow label="Break Free (Fail)" target={mechanic.onBreakFreeSceneId} />
                        {mechanic.enableHitPhase && (
                            <EventRow label="Hit Complete" target={mechanic.onHitCompleteSceneId || ""} />
                        )}
                    </>
                )}
                {mechanic.type === "obstacle" && (
                    <>
                        <EventRow label="Obstacle Cleared" target={mechanic.onObstacleClearedSceneId || ""} />
                        <EventRow label="Break (Spam)" target={mechanic.onBreakSceneId || ""} />
                        {mechanic.enableHitPhase && (
                            <EventRow label="Hit Complete" target={mechanic.onHitCompleteSceneId || ""} />
                        )}
                    </>
                )}
                {mechanic.type === "pain_threshold" && (
                    <>
                        <EventRow label="Success" target={mechanic.onSuccessSceneId} />
                        <EventRow label="Crack (Fail)" target={mechanic.onCrackSceneId} />
                        {mechanic.onHiddenCrackSceneId && (
                            <EventRow label="Hidden Crack" target={mechanic.onHiddenCrackSceneId} />
                        )}
                    </>
                )}
            </div>

            {config.customButtons && config.customButtons.length > 0 && (
                <>
                    <SectionLabel>Button Events</SectionLabel>
                    {config.customButtons.map((btn) => (
                        <div key={btn.id} className="p-2 bg-white/[0.02] rounded border border-white/5 mb-2">
                            <div className="text-[10px] text-white/50 font-mono mb-1">
                                🔘 {btn.label} ({btn.actions?.length || 0} actions)
                            </div>
                            {(btn.actions || []).map((action, i) => (
                                <div key={i} className="text-[9px] text-white/30 font-mono pl-3">
                                    → {action.type}: {(action as any).sceneId || (action as any).buttonId || (action as any).backgroundUrl || (action as any).heroUrl || "..."}
                                </div>
                            ))}
                        </div>
                    ))}
                </>
            )}
        </div>
    );
}

function EventRow({ label, target }: { label: string; target: string }) {
    return (
        <div className="flex items-center justify-between p-2 bg-white/[0.02] rounded border border-white/5">
            <span className="text-[10px] text-white/50 font-mono">{label}</span>
            <span className={cn(
                "text-[10px] font-mono",
                target ? "text-emerald-400" : "text-rose-400/60"
            )}>
                {target || "⚠ Not Set"}
            </span>
        </div>
    );
}

// ── MAIN EDITOR COMPONENT ──

export function InteractSceneEditor() {
    const {
        currentSceneId, customInteractConfigs, isInteractEditorOpen,
        setInteractEditorOpen, saveInteractConfig, deleteInteractConfig,
        isSyncing, customScenes
    } = usePentagramStore();

    const [tab, setTab] = useState<TabId>("mechanic");
    const [localConfig, setLocalConfig] = useState<InteractSceneConfig | null>(null);
    const [targetSceneId, setTargetSceneId] = useState(currentSceneId);
    const [isDirty, setIsDirty] = useState(false);
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    // Dragging state
    const [position, setPosition] = useState({ x: 60, y: 60 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });
    const panelRef = useRef<HTMLDivElement>(null);

    // Load config when panel opens or scene changes
    useEffect(() => {
        if (!isInteractEditorOpen) return;
        setTargetSceneId(currentSceneId);

        // Try to load existing config
        const existing = customInteractConfigs[currentSceneId];
        const hardcoded = PENTAGRAM_SCENES[currentSceneId];
        const customScene = customScenes[currentSceneId];
        const sceneConfig = hardcoded?.interactConfig || customScene?.interactConfig;

        if (existing) {
            setLocalConfig(structuredClone(existing));
        } else if (sceneConfig) {
            setLocalConfig(structuredClone(sceneConfig));
        } else {
            // Default new config
            setLocalConfig({
                mechanic: {
                    type: "resistance",
                    victoryFillRate: 15,
                    resistanceDrainRate: 8,
                    breakFreeThreshold: 20,
                    onBreakFreeSceneId: "",
                    onVictorySceneId: "",
                },
                customButtons: [],
                narrativeText: "",
                showBars: { victory: true, resistance: true },
            });
        }
        setIsDirty(false);
        setSaveStatus("idle");
    }, [isInteractEditorOpen, currentSceneId, customInteractConfigs, customScenes]);

    // Handle drag
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        setIsDragging(true);
        dragOffset.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y,
        };
    }, [position]);

    useEffect(() => {
        if (!isDragging) return;
        const handleMouseMove = (e: MouseEvent) => {
            setPosition({
                x: e.clientX - dragOffset.current.x,
                y: e.clientY - dragOffset.current.y,
            });
        };
        const handleMouseUp = () => setIsDragging(false);
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [isDragging]);

    const handleSave = async () => {
        if (!localConfig || !targetSceneId) return;
        setSaveStatus("saving");
        await saveInteractConfig(targetSceneId, localConfig);
        setIsDirty(false);
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 2000);
    };

    const handleDelete = async () => {
        if (!targetSceneId) return;
        if (!confirm(`Delete interact config for "${targetSceneId}"?`)) return;
        await deleteInteractConfig(targetSceneId);
        setLocalConfig(null);
        setInteractEditorOpen(false);
    };

    const updateConfig = (newConfig: InteractSceneConfig) => {
        setLocalConfig(newConfig);
        setIsDirty(true);
    };

    if (!isInteractEditorOpen || !localConfig) return null;

    return (
        <motion.div
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-[100] select-none"
            style={{
                left: position.x,
                top: position.y,
                width: 380,
                maxHeight: "calc(100vh - 120px)",
            }}
        >
            <div className="w-full h-full bg-neutral-950/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden">
                
                {/* Header — drag handle */}
                <div
                    onMouseDown={handleMouseDown}
                    className={cn(
                        "flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-grab",
                        isDragging && "cursor-grabbing"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <GripHorizontal className="w-4 h-4 text-white/30" />
                        <div>
                            <div className="text-[10px] text-orange-500/60 uppercase tracking-[0.15em] font-mono">Interact Editor</div>
                            <div className="text-[11px] text-white/60 font-mono truncate max-w-[200px]">{targetSceneId}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {isDirty && <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />}
                        <button
                            onClick={() => setInteractEditorOpen(false)}
                            className="p-1.5 text-white/40 hover:text-white hover:bg-white/10 rounded transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Scene ID override */}
                <div className="px-4 py-2 border-b border-white/5">
                    <FieldRow label="Target Scene">
                        <TextInput value={targetSceneId} onChange={setTargetSceneId} placeholder="Scene ID..." />
                    </FieldRow>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] uppercase tracking-wider font-mono transition-colors",
                                tab === t.id
                                    ? "text-orange-400 border-b-2 border-orange-500 bg-orange-500/5"
                                    : "text-white/40 hover:text-white/60 hover:bg-white/[0.02]"
                            )}
                        >
                            <t.icon className="w-3 h-3" />
                            {t.label}
                        </button>
                    ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0" style={{ maxHeight: "calc(100vh - 340px)" }}>
                    {tab === "mechanic" && <MechanicTab config={localConfig} onChange={updateConfig} />}
                    {tab === "buttons" && <ButtonsTab config={localConfig} onChange={updateConfig} />}
                    {tab === "visuals" && <VisualsTab config={localConfig} onChange={updateConfig} />}
                    {tab === "events" && <EventsTab config={localConfig} onChange={updateConfig} />}
                </div>

                {/* Footer — save/delete */}
                <div className="flex items-center justify-between px-4 py-3 border-t border-white/10 bg-white/[0.02]">
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 text-[10px] text-rose-400 hover:text-rose-300 font-mono px-2 py-1.5 border border-rose-500/20 rounded hover:bg-rose-500/5 transition-colors"
                    >
                        <Trash2 className="w-3 h-3" /> Delete
                    </button>

                    <button
                        onClick={handleSave}
                        disabled={!isDirty || saveStatus === "saving"}
                        className={cn(
                            "flex items-center gap-1.5 text-[11px] font-mono font-bold uppercase tracking-wider px-4 py-2 rounded-lg transition-all",
                            saveStatus === "saved"
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                                : isDirty
                                ? "bg-orange-500/20 text-orange-400 border border-orange-500/40 hover:bg-orange-500/30"
                                : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                        )}
                    >
                        {saveStatus === "saving" ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                        ) : saveStatus === "saved" ? (
                            <>✓ Saved</>
                        ) : (
                            <><Save className="w-3.5 h-3.5" /> Save to DB</>
                        )}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}
