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
    goalType?: ConstraintType;
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
    const { goalText, goalLocked, goalType, constraints } = missionConfig;

    const [showGoalPopover, setShowGoalPopover] = useState(false);
    const [goalDraft, setGoalDraft] = useState(goalText);
    const [goalTypeDraft, setGoalTypeDraft] = useState<ConstraintType>(goalType || 'custom');
    const [showConstraintPopover, setShowConstraintPopover] = useState(false);
    const [newConstraintLabel, setNewConstraintLabel] = useState('');
    const [newConstraintType, setNewConstraintType] = useState<ConstraintType>('custom');

    const goalInputRef = useRef<HTMLInputElement>(null);
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

    // Focus goal input when popover opens
    useEffect(() => {
        if (showGoalPopover && goalInputRef.current) {
            setTimeout(() => goalInputRef.current?.focus(), 50);
        }
    }, [showGoalPopover]);

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

    const handleGoalSubmit = () => {
        if (!goalDraft.trim()) return;
        updateConfig({ goalText: goalDraft.trim(), goalType: goalTypeDraft });
        setShowGoalPopover(false);
    };

    const toggleGoalLock = () => {
        if (!goalText) {
            setGoalDraft('');
            setGoalTypeDraft('custom');
            setShowGoalPopover(true);
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

    const isEmpty = !goalText && constraints.length === 0;

    /* ─── Shared popover renderer (used by both Goal and Constraint) ─── */
    const renderPopover = (
        ref: React.RefObject<HTMLDivElement | null>,
        title: string,
        inputValue: string,
        onInputChange: (v: string) => void,
        selectedType: ConstraintType,
        onTypeChange: (t: ConstraintType) => void,
        placeholder: string,
        submitLabel: string,
        onSubmit: () => void,
        canSubmit: boolean,
    ) => (
        <div
            ref={ref}
            className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-md"
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
                    {title}
                </span>

                {/* Type selector */}
                <div className="flex gap-1">
                    {CONSTRAINT_TYPES.map(ct => (
                        <button
                            key={ct.type}
                            onClick={() => onTypeChange(ct.type)}
                            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] transition-colors"
                            style={{
                                background: selectedType === ct.type
                                    ? 'var(--accent)'
                                    : 'transparent',
                                color: selectedType === ct.type ? ct.color : 'var(--muted-foreground)',
                                border: selectedType === ct.type
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
                        ref={title.toLowerCase().includes('goal') ? goalInputRef : undefined}
                        value={inputValue}
                        onChange={e => onInputChange(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') { setShowGoalPopover(false); setShowConstraintPopover(false); } }}
                        placeholder={placeholder}
                        className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none"
                        style={{
                            color: 'var(--popover-foreground)',
                            border: '1px solid var(--border)',
                        }}
                        autoFocus
                    />
                    <Button
                        size="sm"
                        onClick={onSubmit}
                        disabled={!canSubmit}
                        className="h-7 px-2 rounded-md text-[10px]"
                    >
                        {submitLabel}
                    </Button>
                </div>
            </div>
        </div>
    );

    return (
        <div
            className={cn(
                "relative flex items-center gap-2 px-3 rounded-md transition-all duration-200",
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

                {/* Goal display — chip with lock/delete like constraints */}
                {goalText ? (
                    <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-all duration-200 group"
                        style={{
                            background: goalLocked
                                ? `color-mix(in srgb, ${getConstraintMeta(goalType || 'custom').color} 12%, transparent)`
                                : 'var(--nerv-surface-3)',
                            border: `1px solid color-mix(in srgb, ${getConstraintMeta(goalType || 'custom').color} 25%, transparent)`,
                            color: goalLocked ? getConstraintMeta(goalType || 'custom').color : 'var(--nerv-text-tertiary)',
                        }}
                    >
                        <span className="shrink-0">{getConstraintMeta(goalType || 'custom').icon}</span>
                        <button
                            ref={goalBtnRef}
                            onClick={() => {
                                if (!goalLocked) {
                                    setGoalDraft(goalText);
                                    setGoalTypeDraft(goalType || 'custom');
                                    setShowGoalPopover(!showGoalPopover);
                                }
                            }}
                            className="truncate max-w-[200px]"
                            style={{ cursor: goalLocked ? 'default' : 'pointer' }}
                            disabled={goalLocked}
                        >
                            {goalText}
                        </button>
                        <button
                            onClick={() => toggleGoalLock()}
                            className="p-0 transition-opacity opacity-50 hover:opacity-100"
                            title={goalLocked ? 'Unlock goal' : 'Lock goal'}
                        >
                            {goalLocked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                        </button>
                        <button
                            onClick={() => updateConfig({ goalText: '', goalLocked: false, goalType: undefined })}
                            className="p-0 transition-opacity opacity-0 group-hover:opacity-50 hover:!opacity-100"
                            title="Remove goal"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                ) : (
                    <div className="relative">
                        <button
                            ref={goalBtnRef}
                            onClick={() => { setGoalDraft(''); setGoalTypeDraft('custom'); setShowGoalPopover(!showGoalPopover); }}
                            className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all duration-200 hover:bg-white/5"
                            style={{ color: 'var(--nerv-text-ghost)' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.color = 'var(--nerv-cyan)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.color = 'var(--nerv-text-ghost)';
                            }}
                        >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Goal</span>
                        </button>

                        {/* Goal Popover */}
                        {showGoalPopover && renderPopover(
                            goalPopoverRef,
                            'Set Goal',
                            goalDraft,
                            setGoalDraft,
                            goalTypeDraft,
                            setGoalTypeDraft,
                            'Define your mission goal…',
                            'Set',
                            handleGoalSubmit,
                            !!goalDraft.trim(),
                        )}
                    </div>
                )}

                {/* Goal edit popover when goal is already set */}
                {goalText && !goalLocked && showGoalPopover && renderPopover(
                    goalPopoverRef,
                    'Edit Goal',
                    goalDraft,
                    setGoalDraft,
                    goalTypeDraft,
                    setGoalTypeDraft,
                    'Define your mission goal…',
                    'Save',
                    handleGoalSubmit,
                    !!goalDraft.trim(),
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

                {/* Add Constraint Button — plain text, no pill */}
                <div className="relative">
                    <button
                        ref={addBtnRef}
                        onClick={() => setShowConstraintPopover(!showConstraintPopover)}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all duration-200 hover:bg-white/5"
                        style={{ color: 'var(--nerv-text-ghost)' }}
                        onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--nerv-cyan)';
                        }}
                        onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = 'var(--nerv-text-ghost)';
                        }}
                    >
                        <Plus className="w-2.5 h-2.5" />
                        <span>Constraint</span>
                    </button>

                    {/* Constraint Popover */}
                    {showConstraintPopover && renderPopover(
                        popoverRef,
                        'Add Constraint',
                        newConstraintLabel,
                        setNewConstraintLabel,
                        newConstraintType,
                        setNewConstraintType,
                        'e.g. "Max $5k spend"',
                        'Add',
                        addConstraint,
                        !!newConstraintLabel.trim(),
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
        const goalMeta = CONSTRAINT_TYPES.find(ct => ct.type === (config.goalType || 'custom'));
        parts.push(
            `[SYSTEM DIRECTIVE — MISSION GOAL]\n` +
            `Category: ${goalMeta?.label || 'Custom'}\n` +
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
