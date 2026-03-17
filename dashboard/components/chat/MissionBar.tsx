"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
    Target, Lock, Unlock, Plus, X, AlertTriangle,
    Scale, Code2, DollarSign, Clock, Shield, Pencil
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    constraints: Constraint[];
}

const CONSTRAINT_TYPES: { type: ConstraintType; icon: React.ReactNode; label: string; color: string }[] = [
    { type: 'budget', icon: <DollarSign className="w-3 h-3" />, label: 'Budget', color: 'var(--nerv-warn)' },
    { type: 'stack', icon: <Code2 className="w-3 h-3" />, label: 'Stack', color: 'var(--nerv-cyan)' },
    { type: 'legal', icon: <Scale className="w-3 h-3" />, label: 'Legal', color: 'var(--nerv-violet)' },
    { type: 'deadline', icon: <Clock className="w-3 h-3" />, label: 'Deadline', color: 'var(--nerv-danger)' },
    { type: 'custom', icon: <Shield className="w-3 h-3" />, label: 'Custom', color: 'var(--nerv-text-secondary)' },
];

interface MissionBarProps {
    conversationId?: string;
    missionConfig: MissionConfig;
    onMissionChange: (config: MissionConfig) => void;
    className?: string;
}

/* ─── Component ─── */
export const MissionBar: React.FC<MissionBarProps> = ({
    conversationId,
    missionConfig,
    onMissionChange,
    className,
}) => {
    const { goalText, goalLocked, constraints } = missionConfig;

    const [isEditingGoal, setIsEditingGoal] = useState(false);
    const [goalDraft, setGoalDraft] = useState(goalText);
    const [showConstraintPopover, setShowConstraintPopover] = useState(false);
    const [newConstraintLabel, setNewConstraintLabel] = useState('');
    const [newConstraintType, setNewConstraintType] = useState<ConstraintType>('custom');

    const goalInputRef = useRef<HTMLInputElement>(null);
    const popoverRef = useRef<HTMLDivElement>(null);
    const addBtnRef = useRef<HTMLButtonElement>(null);

    // Auto-persist to API on change (debounced)
    const persistTimeout = useRef<ReturnType<typeof setTimeout>>();
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

    useEffect(() => {
        if (isEditingGoal && goalInputRef.current) goalInputRef.current.focus();
    }, [isEditingGoal]);

    // Close popover on outside click
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

    const handleGoalSubmit = () => {
        updateConfig({ goalText: goalDraft.trim() });
        setIsEditingGoal(false);
    };

    const toggleGoalLock = () => {
        if (!goalText) {
            setIsEditingGoal(true);
            return;
        }
        updateConfig({ goalLocked: !goalLocked });
    };

    const addConstraint = () => {
        if (!newConstraintLabel.trim()) return;
        const newConstraint: Constraint = {
            id: crypto.randomUUID(),
            type: newConstraintType,
            label: newConstraintLabel.trim(),
            locked: true,
        };
        updateConfig({ constraints: [...constraints, newConstraint] });
        setNewConstraintLabel('');
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

    // Determine if mission bar should be in "collapsed" mode (no goal set, no constraints)
    const isEmpty = !goalText && constraints.length === 0;

    return (
        <div
            className={cn(
                "relative flex items-center gap-2 px-3 rounded-xl transition-all duration-200",
                isEmpty ? "py-1" : "py-2",
                className
            )}
            style={{
                background: isEmpty ? 'transparent' : 'var(--nerv-surface-2)',
                border: isEmpty ? '1px dashed var(--nerv-border-subtle)' : '1px solid var(--nerv-border-subtle)',
            }}
        >
            {/* ─── Goal Lock Section ─── */}
            <div className="flex items-center gap-1.5 shrink-0">
                <button
                    onClick={toggleGoalLock}
                    className="p-1 rounded-md transition-all duration-200"
                    style={{
                        background: goalLocked ? 'var(--nerv-success-dim)' : 'transparent',
                        color: goalLocked ? 'var(--nerv-success)' : 'var(--nerv-text-ghost)',
                    }}
                    title={goalLocked ? 'Unlock goal' : 'Lock goal'}
                    aria-label={goalLocked ? 'Unlock goal' : 'Lock goal'}
                >
                    {goalLocked ? (
                        <Lock className="w-3.5 h-3.5" />
                    ) : (
                        <Target className="w-3.5 h-3.5" />
                    )}
                </button>

                {isEditingGoal ? (
                    <input
                        ref={goalInputRef}
                        value={goalDraft}
                        onChange={e => setGoalDraft(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter') handleGoalSubmit();
                            if (e.key === 'Escape') { setIsEditingGoal(false); setGoalDraft(goalText); }
                        }}
                        onBlur={handleGoalSubmit}
                        placeholder="Define your mission goal…"
                        className="flex-1 text-[11px] bg-transparent outline-none min-w-[120px] max-w-[300px]"
                        style={{
                            color: 'var(--nerv-text-primary)',
                            borderBottom: '1px solid var(--nerv-cyan)',
                        }}
                    />
                ) : goalText ? (
                    <button
                        onClick={() => { if (!goalLocked) { setGoalDraft(goalText); setIsEditingGoal(true); } }}
                        className="flex items-center gap-1 text-[11px] font-medium truncate max-w-[300px]"
                        style={{
                            color: goalLocked ? 'var(--nerv-success)' : 'var(--nerv-text-primary)',
                            cursor: goalLocked ? 'default' : 'pointer',
                        }}
                        disabled={goalLocked}
                    >
                        <span className="truncate">{goalText}</span>
                        {!goalLocked && <Pencil className="w-2.5 h-2.5 shrink-0 opacity-30" />}
                    </button>
                ) : (
                    <button
                        onClick={() => { setGoalDraft(''); setIsEditingGoal(true); }}
                        className="text-[10px] italic"
                        style={{ color: 'var(--nerv-text-ghost)' }}
                    >
                        Set a goal…
                    </button>
                )}
            </div>

            {/* Divider */}
            {(goalText || constraints.length > 0) && (
                <div className="w-px h-4 shrink-0" style={{ background: 'var(--nerv-border-default)' }} />
            )}

            {/* ─── Constraint Chips ─── */}
            <div className="flex items-center gap-1.5 flex-wrap min-w-0 flex-1">
                {constraints.map(c => {
                    const meta = getConstraintMeta(c.type);
                    return (
                        <div
                            key={c.id}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 group"
                            style={{
                                background: c.locked
                                    ? `color-mix(in srgb, ${meta.color} 12%, transparent)`
                                    : 'var(--nerv-surface-3)',
                                border: `1px solid color-mix(in srgb, ${meta.color} 25%, transparent)`,
                                color: c.locked ? meta.color : 'var(--nerv-text-tertiary)',
                            }}
                        >
                            <span className="shrink-0">{meta.icon}</span>
                            <span className="truncate max-w-[80px]">{c.label}</span>
                            <button
                                onClick={() => toggleConstraintLock(c.id)}
                                className="p-0 transition-opacity opacity-50 hover:opacity-100"
                                title={c.locked ? 'Unlock constraint' : 'Lock constraint'}
                            >
                                {c.locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                            </button>
                            <button
                                onClick={() => removeConstraint(c.id)}
                                className="p-0 transition-opacity opacity-0 group-hover:opacity-50 hover:!opacity-100"
                                title="Remove constraint"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        </div>
                    );
                })}

                {/* Add Constraint Button */}
                <div className="relative">
                    <button
                        ref={addBtnRef}
                        onClick={() => setShowConstraintPopover(!showConstraintPopover)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] transition-all duration-200"
                        style={{
                            color: 'var(--nerv-text-ghost)',
                            border: '1px dashed var(--nerv-border-subtle)',
                        }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--nerv-cyan)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--nerv-cyan-dim)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--nerv-text-ghost)';
                            (e.currentTarget as HTMLElement).style.borderColor = 'var(--nerv-border-subtle)';
                        }}
                    >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Constraint</span>
                    </button>

                    {/* Constraint Popover */}
                    {showConstraintPopover && (
                        <div
                            ref={popoverRef}
                            className="absolute top-full left-0 mt-2 z-50 rounded-md overflow-hidden shadow-md"
                            style={{
                                background: 'var(--popover)',
                                border: '1px solid var(--border)',
                                minWidth: 220,
                            }}
                        >
                            <div className="p-3 space-y-2.5">
                                <span
                                    className="text-[10px] font-semibold uppercase tracking-wider"
                                    style={{ color: 'var(--nerv-text-tertiary)' }}
                                >
                                    Add Constraint
                                </span>

                                {/* Type selector */}
                                <div className="flex gap-1">
                                    {CONSTRAINT_TYPES.map(ct => (
                                        <button
                                            key={ct.type}
                                            onClick={() => setNewConstraintType(ct.type)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors"
                                            style={{
                                                background: newConstraintType === ct.type
                                                    ? 'var(--accent)'
                                                    : 'transparent',
                                                color: newConstraintType === ct.type ? ct.color : 'var(--muted-foreground)',
                                                border: newConstraintType === ct.type
                                                    ? `1px solid color-mix(in srgb, ${ct.color} 30%, transparent)`
                                                    : '1px solid transparent',
                                            }}
                                        >
                                            {ct.icon}
                                            <span>{ct.label}</span>
                                        </button>
                                    ))}
                                </div>

                                {/* Label input */}
                                <div className="flex gap-1.5">
                                    <input
                                        value={newConstraintLabel}
                                        onChange={e => setNewConstraintLabel(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') addConstraint(); }}
                                        placeholder={`e.g. "Max $5k spend"`}
                                        className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none"
                                        style={{
                                            color: 'var(--popover-foreground)',
                                            border: '1px solid var(--border)',
                                        }}
                                        autoFocus
                                    />
                                    <Button
                                        size="sm"
                                        onClick={addConstraint}
                                        disabled={!newConstraintLabel.trim()}
                                        className="h-7 px-2 rounded-md text-[10px]"
                                    >
                                        Add
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Build a system prompt string from the active mission config
export const getMissionSystemPrompt = (config: MissionConfig): string => {
    const parts: string[] = [];

    if (config.goalText) {
        parts.push(
            `[SYSTEM DIRECTIVE — MISSION GOAL]\n` +
            `Your primary objective for this conversation is: "${config.goalText}"\n` +
            `All responses MUST be oriented toward achieving this goal. Do not deviate. ` +
            `If a user request conflicts with this goal, acknowledge the conflict and steer back toward the goal.`
        );
    }

    const activeConstraints = config.constraints.filter(c => c.locked);
    if (activeConstraints.length > 0) {
        const lines = activeConstraints.map(c => `  • [${c.type.charAt(0).toUpperCase() + c.type.slice(1)}] ${c.label}`);
        parts.push(
            `[SYSTEM DIRECTIVE — HARD CONSTRAINTS]\n` +
            `The following constraints are ABSOLUTE and MUST NOT be violated under any circumstances:\n` +
            `${lines.join('\n')}\n` +
            `These constraints override all other instructions. If a user request would violate any constraint, ` +
            `you MUST refuse and explain which constraint prevents it. Never work around or ignore these constraints.`
        );
    }

    return parts.join('\n\n');
};

export default MissionBar;
