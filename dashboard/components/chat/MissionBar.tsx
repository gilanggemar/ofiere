"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
    Target, Lock, Unlock, Plus, X, Trash2,
    Scale, Code2, DollarSign, Clock, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePresetStore, PresetType, PresetItem } from '@/lib/usePresetStore';

/* ─── Types ─── */
export type ConstraintType = 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';

export interface Constraint {
    id: string;
    type: ConstraintType;
    label: string;
    locked: boolean;
}

export interface MissionConfig {
    goalText: string;
    goalLocked: boolean;
    goalType?: ConstraintType;
    goals: Constraint[];
    constraints: Constraint[];
}

const CONSTRAINT_TYPES: { type: ConstraintType; icon: React.ReactNode; label: string; color: string }[] = [
    { type: 'budget', icon: <DollarSign className="w-3 h-3" />, label: 'Budget', color: 'var(--ofiere-warn)' },
    { type: 'stack', icon: <Code2 className="w-3 h-3" />, label: 'Stack', color: 'var(--ofiere-cyan)' },
    { type: 'legal', icon: <Scale className="w-3 h-3" />, label: 'Legal', color: 'var(--ofiere-violet)' },
    { type: 'deadline', icon: <Clock className="w-3 h-3" />, label: 'Deadline', color: 'var(--ofiere-danger)' },
    { type: 'custom', icon: <Shield className="w-3 h-3" />, label: 'Custom', color: 'var(--ofiere-text-secondary)' },
];

interface MissionBarProps {
    conversationId?: string;
    missionConfig: MissionConfig;
    onMissionChange: (config: MissionConfig) => void;
    className?: string;
}

/* ─── Preset Popover (shared by Goal & Constraint) ─── */
function PresetPopover({
    popoverRef,
    title,
    presets,
    onAdd,
    onDelete,
    onUpdate,
    onAddNewPreset,
    onClose,
    chipIconType,
}: {
    popoverRef: React.RefObject<HTMLDivElement | null>;
    title: string;
    presets: PresetItem[];
    onAdd: (label: string, type: ConstraintType) => void;
    onDelete: (presetId: string) => void;
    onUpdate: (presetId: string, newLabel: string) => void;
    onAddNewPreset: (label: string, type: ConstraintType) => void;
    onClose: () => void;
    chipIconType: 'goal' | 'constraint';
}) {
    const [customLabel, setCustomLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingId !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingId]);

    const handleDoubleClick = (preset: PresetItem) => {
        setEditingId(preset.id);
        setEditText(preset.label);
    };

    const handleEditSubmit = (preset: PresetItem) => {
        if (editText.trim() && editText.trim() !== preset.label) {
            onUpdate(preset.id, editText.trim());
        }
        setEditingId(null);
    };

    const handleAddNewPreset = () => {
        onAddNewPreset('New Preset', 'custom');
    };

    return (
        <div
            ref={popoverRef}
            className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-md"
            style={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                minWidth: 260,
            }}
        >
            <div className="p-3 space-y-2">
                <span
                    className="text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--ofiere-text-tertiary)' }}
                >
                    {title}
                </span>

                {/* Preset list */}
                <div className="flex flex-col gap-0.5">
                    {presets.map((p) => {
                        if (editingId === p.id) {
                            return (
                                <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1">
                                    <Plus className="w-3 h-3 shrink-0 text-muted-foreground" />
                                    <input ref={editInputRef} value={editText} onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleEditSubmit(p); if (e.key === 'Escape') setEditingId(null); }}
                                        onBlur={() => handleEditSubmit(p)}
                                        className="flex-1 text-[11px] px-1.5 py-0.5 rounded-sm bg-transparent outline-none"
                                        style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }} />
                                </div>
                            );
                        }

                        return (
                            <div
                                key={p.id}
                                onDoubleClick={() => handleDoubleClick(p)}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all hover:bg-white/5 group cursor-default"
                                style={{ color: 'var(--foreground)' }}
                            >
                                {/* Plus icon to add (left side) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAdd(p.label, p.type as ConstraintType); onClose(); }}
                                    className="p-0.5 rounded-sm hover:bg-white/10 transition-colors opacity-50 group-hover:opacity-100 shrink-0"
                                    title={`Add "${p.label}"`}>
                                    <Plus className="w-3 h-3" />
                                </button>
                                <span className="flex-1 select-none">{p.label}</span>
                                {/* Trash icon to delete preset (right side) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                                    className="p-0.5 rounded-sm hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0"
                                    title="Delete preset">
                                    <Trash2 className="w-3 h-3 text-red-500/70" />
                                </button>
                            </div>
                        );
                    })}
                </div>

                {/* Add New Preset — dotted plus button */}
                <button
                    onClick={handleAddNewPreset}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] transition-all hover:bg-white/5"
                    style={{ border: '1px dashed var(--border)', color: 'var(--ofiere-text-ghost)' }}>
                    <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Divider */}
                <div className="h-px w-full" style={{ background: 'var(--border)' }} />

                {/* Quick add (once) */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 opacity-60" style={{ color: 'var(--ofiere-text-secondary)' }}>
                            <Plus className="w-3 h-3" />
                        </span>
                        <span className="text-[10px] text-muted-foreground">Quick add (once)</span>
                    </div>
                    <div className="flex gap-1.5">
                        <input
                            value={customLabel}
                            onChange={e => setCustomLabel(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && customLabel.trim()) {
                                    onAdd(customLabel.trim(), 'custom');
                                    onClose();
                                }
                                if (e.key === 'Escape') onClose();
                            }}
                            placeholder='e.g. "Max $5k spend"'
                            className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none"
                            style={{
                                color: 'var(--popover-foreground)',
                                border: '1px solid var(--border)',
                            }}
                            autoFocus
                        />
                        <Button
                            size="sm"
                            onClick={() => {
                                if (customLabel.trim()) {
                                    onAdd(customLabel.trim(), 'custom');
                                    onClose();
                                }
                            }}
                            disabled={!customLabel.trim()}
                            className="h-7 px-2 rounded-md text-[10px]"
                        >
                            Set
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Component ─── */
export const MissionBar: React.FC<MissionBarProps> = ({
    conversationId,
    missionConfig,
    onMissionChange,
    className,
}) => {
    const goals = missionConfig.goals || [];
    const { constraints } = missionConfig;
    const {
        goalPresets, constraintPresets,
        addGoalPreset, removeGoalPreset, updateGoalPreset,
        addConstraintPreset, removeConstraintPreset, updateConstraintPreset,
    } = usePresetStore();

    const [showGoalPopover, setShowGoalPopover] = useState(false);
    const [showConstraintPopover, setShowConstraintPopover] = useState(false);

    const goalPopoverRef = useRef<HTMLDivElement>(null);
    const goalBtnRef = useRef<HTMLButtonElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);

    // Auto-persist to API on change (debounced)
    const persistTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
    const persistMission = useCallback((config: MissionConfig) => {
        if (!conversationId) return;
        clearTimeout(persistTimeout.current);
        persistTimeout.current = setTimeout(async () => {
            try {
                await fetch(`/api/chat/conversations/${conversationId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ mission_config: config }),
                });
            } catch (e) {
                console.error('Failed to persist mission config:', e);
            }
        }, 500);
    }, [conversationId]);

    // Close goal popover on outside click
    useEffect(() => {
        if (!showGoalPopover) return;
        const handler = (e: MouseEvent) => {
            if (
                goalPopoverRef.current && !goalPopoverRef.current.contains(e.target as Node) &&
                goalBtnRef.current && !goalBtnRef.current.contains(e.target as Node)
            ) {
                setShowGoalPopover(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showGoalPopover]);

    // Close constraint popover on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (
                popoverRef.current && !popoverRef.current.contains(e.target as Node) &&
                addBtnRef.current && !addBtnRef.current.contains(e.target as Node)
            ) {
                setShowConstraintPopover(false);
            }
        };
        if (showConstraintPopover) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showConstraintPopover]);

    const updateConfig = (partial: Partial<MissionConfig>) => {
        const updated = { ...missionConfig, ...partial };
        onMissionChange(updated);
        persistMission(updated);
    };

    const addGoal = (label: string, type: ConstraintType) => {
        // Prevent duplicates
        if (goals.some(g => g.label.toLowerCase() === label.toLowerCase())) {
            setShowGoalPopover(false);
            return;
        }
        const newGoal: Constraint = {
            id: crypto.randomUUID(),
            type,
            label,
            locked: true,
        };
        updateConfig({ goals: [...goals, newGoal], goalText: label, goalLocked: true });
        setShowGoalPopover(false);
    };

    const removeGoal = (id: string) => {
        const updated = goals.filter(g => g.id !== id);
        updateConfig({ goals: updated, goalText: updated[0]?.label || '', goalLocked: updated.length > 0 });
    };

    const toggleGoalLock = (id: string) => {
        updateConfig({
            goals: goals.map(g =>
                g.id === id ? { ...g, locked: !g.locked } : g
            )
        });
    };

    const addConstraint = (label: string, type: ConstraintType) => {
        // Prevent duplicates
        if (constraints.some(c => c.label.toLowerCase() === label.toLowerCase())) {
            setShowConstraintPopover(false);
            return;
        }
        const newConstraint: Constraint = {
            id: crypto.randomUUID(),
            type,
            label,
            locked: true,
        };
        updateConfig({ constraints: [...constraints, newConstraint] });
        setShowConstraintPopover(false);
    };

    const removeConstraint = (id: string) => {
        updateConfig({ constraints: constraints.filter(c => c.id !== id) });
    };

    const toggleConstraintLock = (id: string) => {
        updateConfig({
            constraints: constraints.map(c =>
                c.id === id ? { ...c, locked: !c.locked } : c
            )
        });
    };

    const getConstraintMeta = (type: ConstraintType) =>
        CONSTRAINT_TYPES.find(ct => ct.type === type) || CONSTRAINT_TYPES[4];

    // Backward compat: migrate legacy single goalText to goals array
    useEffect(() => {
        if (missionConfig.goalText && (!missionConfig.goals || missionConfig.goals.length === 0)) {
            const migratedGoal: Constraint = {
                id: crypto.randomUUID(),
                type: missionConfig.goalType || 'custom',
                label: missionConfig.goalText,
                locked: missionConfig.goalLocked,
            };
            updateConfig({ goals: [migratedGoal] });
        }
    }, []);

    const [showGoalDropup, setShowGoalDropup] = useState(false);
    const [showConstraintDropup, setShowConstraintDropup] = useState(false);
    const goalDropupRef = useRef<HTMLDivElement>(null);
    const constraintDropupRef = useRef<HTMLDivElement>(null);
    const goalSummaryBtnRef = useRef<HTMLButtonElement>(null);
    const constraintSummaryBtnRef = useRef<HTMLButtonElement>(null);

    // Close goal dropup on outside click
    useEffect(() => {
        if (!showGoalDropup) return;
        const handler = (e: MouseEvent) => {
            if (
                goalDropupRef.current && !goalDropupRef.current.contains(e.target as Node) &&
                goalSummaryBtnRef.current && !goalSummaryBtnRef.current.contains(e.target as Node)
            ) {
                setShowGoalDropup(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showGoalDropup]);

    // Close constraint dropup on outside click
    useEffect(() => {
        if (!showConstraintDropup) return;
        const handler = (e: MouseEvent) => {
            if (
                constraintDropupRef.current && !constraintDropupRef.current.contains(e.target as Node) &&
                constraintSummaryBtnRef.current && !constraintSummaryBtnRef.current.contains(e.target as Node)
            ) {
                setShowConstraintDropup(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showConstraintDropup]);

    const isEmpty = goals.length === 0 && constraints.length === 0;

    return (
        <div
            className={cn(
                "relative flex items-center gap-2 px-3 rounded-md transition-all duration-200",
                isEmpty ? "py-1" : "py-2",
                className
            )}
            style={{
                background: isEmpty ? 'transparent' : 'rgba(234, 120, 47, 0.06)',
                border: isEmpty ? '1px dashed var(--ofiere-border-subtle)' : '1px solid rgba(234, 120, 47, 0.2)',
            }}
        >
            {/* ─── Goal Summary Button ─── */}
            {goals.length > 0 && (
                <div className="relative shrink-0">
                    <button
                        ref={goalSummaryBtnRef}
                        onClick={() => { setShowGoalDropup(!showGoalDropup); setShowConstraintDropup(false); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 hover:brightness-125"
                        style={{
                            background: 'color-mix(in srgb, var(--ofiere-cyan) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--ofiere-cyan) 25%, transparent)',
                            color: 'var(--ofiere-cyan)',
                        }}
                    >
                        <Target className="w-2.5 h-2.5" />
                        <span>Goal: ON</span>
                        <Lock className="w-2.5 h-2.5 opacity-60" />
                    </button>

                    {/* Goal dropup */}
                    {showGoalDropup && (
                        <div
                            ref={goalDropupRef}
                            className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-md"
                            style={{
                                background: 'var(--popover)',
                                border: '1px solid var(--border)',
                                minWidth: 220,
                            }}
                        >
                            <div className="p-2.5 space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--ofiere-text-tertiary)' }}>
                                    Active Goals
                                </span>
                                {goals.map(g => (
                                    <div
                                        key={g.id}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all hover:bg-white/5 group"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        <Target className="w-3 h-3 shrink-0" style={{ color: 'var(--ofiere-cyan)' }} />
                                        <span className="flex-1 truncate">{g.label}</span>
                                        <button
                                            onClick={() => { removeGoal(g.id); if (goals.length <= 1) setShowGoalDropup(false); }}
                                            className="p-0.5 rounded-sm hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-70 hover:!opacity-100 shrink-0"
                                            title="Remove goal"
                                        >
                                            <X className="w-3 h-3 text-red-500/70" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* +Goal button (always visible) */}
            <div className="relative shrink-0">
                <button
                    ref={goalBtnRef}
                    onClick={() => { setShowGoalPopover(!showGoalPopover); setShowConstraintPopover(false); setShowGoalDropup(false); setShowConstraintDropup(false); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all duration-200 hover:bg-white/5"
                    style={{ color: 'var(--ofiere-text-ghost)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(234, 120, 47)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-text-ghost)'; }}
                >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Goal</span>
                </button>

                {showGoalPopover && (
                    <PresetPopover
                        popoverRef={goalPopoverRef}
                        title="Add Goal"
                        presets={goalPresets}
                        onAdd={addGoal}
                        onDelete={removeGoalPreset}
                        onUpdate={updateGoalPreset}
                        onAddNewPreset={(label, type) => addGoalPreset(type as PresetType, label)}
                        onClose={() => setShowGoalPopover(false)}
                        chipIconType="goal"
                    />
                )}
            </div>

            {/* ─── Constraint Summary Button ─── */}
            {constraints.length > 0 && (
                <div className="relative shrink-0">
                    <button
                        ref={constraintSummaryBtnRef}
                        onClick={() => { setShowConstraintDropup(!showConstraintDropup); setShowGoalDropup(false); }}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-semibold tracking-wide uppercase transition-all duration-200 hover:brightness-125"
                        style={{
                            background: 'color-mix(in srgb, var(--ofiere-danger) 12%, transparent)',
                            border: '1px solid color-mix(in srgb, var(--ofiere-danger) 25%, transparent)',
                            color: 'var(--ofiere-danger)',
                        }}
                    >
                        <Shield className="w-2.5 h-2.5" />
                        <span>Constraint: ON</span>
                        <Lock className="w-2.5 h-2.5 opacity-60" />
                    </button>

                    {/* Constraint dropup */}
                    {showConstraintDropup && (
                        <div
                            ref={constraintDropupRef}
                            className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-md"
                            style={{
                                background: 'var(--popover)',
                                border: '1px solid var(--border)',
                                minWidth: 220,
                            }}
                        >
                            <div className="p-2.5 space-y-1">
                                <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--ofiere-text-tertiary)' }}>
                                    Active Constraints
                                </span>
                                {constraints.map(c => (
                                    <div
                                        key={c.id}
                                        className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] transition-all hover:bg-white/5 group"
                                        style={{ color: 'var(--foreground)' }}
                                    >
                                        <Shield className="w-3 h-3 shrink-0" style={{ color: 'var(--ofiere-danger)' }} />
                                        <span className="flex-1 truncate">{c.label}</span>
                                        <button
                                            onClick={() => { removeConstraint(c.id); if (constraints.length <= 1) setShowConstraintDropup(false); }}
                                            className="p-0.5 rounded-sm hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-70 hover:!opacity-100 shrink-0"
                                            title="Remove constraint"
                                        >
                                            <X className="w-3 h-3 text-red-500/70" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* +Constraint button (always visible) */}
            <div className="relative shrink-0">
                <button
                    ref={addBtnRef}
                    onClick={() => { setShowConstraintPopover(!showConstraintPopover); setShowGoalPopover(false); setShowGoalDropup(false); setShowConstraintDropup(false); }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all duration-200 hover:bg-white/5"
                    style={{ color: 'var(--ofiere-text-ghost)' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'rgb(234, 120, 47)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-text-ghost)'; }}
                >
                    <Plus className="w-2.5 h-2.5" />
                    <span>Constraint</span>
                </button>

                {showConstraintPopover && (
                    <PresetPopover
                        popoverRef={popoverRef}
                        title="Add Constraint"
                        presets={constraintPresets}
                        onAdd={addConstraint}
                        onDelete={removeConstraintPreset}
                        onUpdate={updateConstraintPreset}
                        onAddNewPreset={(label, type) => addConstraintPreset(type as PresetType, label)}
                        onClose={() => setShowConstraintPopover(false)}
                        chipIconType="constraint"
                    />
                )}
            </div>
        </div>
    );
};

// Build a system prompt string from the active mission config
export const getMissionSystemPrompt = (config: MissionConfig): string => {
    const parts: string[] = [];

    const activeGoals = (config.goals || []).filter(g => g.locked);
    // Backward compat: if no goals array but goalText exists, use it
    if (activeGoals.length === 0 && config.goalText && config.goalLocked) {
        activeGoals.push({ id: 'legacy', type: config.goalType || 'custom', label: config.goalText, locked: true });
    }

    if (activeGoals.length > 0) {
        const lines = activeGoals.map(g => `• ${g.label}`);
        parts.push(
            `[GOAL — ACTIVE]\n` +
            `${lines.join('\n')}\n` +
            `Orient all responses toward these goals. If a request conflicts, acknowledge and steer back. Absence of this directive in future messages means deactivated.`
        );
    }

    const activeConstraints = config.constraints.filter(c => c.locked);
    if (activeConstraints.length > 0) {
        const lines = activeConstraints.map(c => `• ${c.label}`);
        parts.push(
            `[CONSTRAINTS — ACTIVE]\n` +
            `${lines.join('\n')}\n` +
            `These are absolute. Refuse any request that violates them. Absence of this directive in future messages means deactivated.`
        );
    }

    return parts.join('\n\n');
};

export default MissionBar;
