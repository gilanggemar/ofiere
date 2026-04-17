"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
    X, GripVertical, Plus, Trash2, Copy, ChevronDown,
    Target, Shield, DollarSign, Code2, Scale, Clock,
    Send, Check, Loader2, Quote
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Task, ExecutionStep, TaskGoal, TaskConstraint,
    useTaskStore
} from "@/lib/useTaskStore";
import { usePresetStore, PresetType, PresetItem } from "@/lib/usePresetStore";
import { AGENT_ROSTER, getAgentProfile } from "@/lib/agentRoster";
import { useAgentAvatar } from "@/hooks/useAgentAvatar";
import { AnimatePresence, motion, Reorder } from "framer-motion";

/* ─── Type Config (icons + colors) ─── */
type ItemType = 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';

const TYPE_CONFIG: Record<ItemType, { icon: React.ReactNode; label: string; color: string }> = {
    budget:   { icon: <DollarSign className="w-3 h-3" />, label: 'Budget',   color: 'var(--ofiere-warn)' },
    stack:    { icon: <Code2 className="w-3 h-3" />,      label: 'Stack',    color: 'var(--ofiere-cyan)' },
    legal:    { icon: <Scale className="w-3 h-3" />,      label: 'Legal',    color: 'var(--ofiere-violet)' },
    deadline: { icon: <Clock className="w-3 h-3" />,      label: 'Deadline', color: 'var(--ofiere-danger)' },
    custom:   { icon: <Shield className="w-3 h-3" />,     label: 'Custom',   color: 'var(--ofiere-text-secondary)' },
};

/* ─── Agent Avatar Small ─── */
function SmallAgentAvatar({ agentId, size = 24 }: { agentId: string; size?: number }) {
    const { avatarUri } = useAgentAvatar(agentId);
    const profile = getAgentProfile(agentId);
    if (avatarUri) {
        return <img src={avatarUri} alt={profile?.name || agentId} className="rounded-sm object-cover" style={{ width: size, height: size * 1.33 }} />;
    }
    return (
        <div className="rounded-sm flex items-center justify-center text-[9px] font-bold" style={{ width: size, height: size * 1.33, background: profile?.colorHex || '#444', color: '#fff' }}>
            {profile?.avatarFallback || agentId.slice(0, 2).toUpperCase()}
        </div>
    );
}

/* ─── Preset Popover (Goal/Constraint) ─── */
function PresetPopover({
    title,
    presets,
    onAdd,
    onDelete,
    onUpdate,
    onAddNewPreset,
    onClose,
    chipIconType,
}: {
    title: string;
    presets: PresetItem[];
    onAdd: (label: string, type: ItemType) => void;
    onDelete: (presetId: string) => void;
    onUpdate: (presetId: string, newLabel: string) => void;
    onAddNewPreset: (label: string, type: ItemType) => void;
    onClose: () => void;
    chipIconType: 'goal' | 'constraint';
}) {
    const [customLabel, setCustomLabel] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) onClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [onClose]);

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
        <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-lg"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 260 }}>
            <div className="p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ofiere-text-tertiary)' }}>
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
                            <div key={p.id}
                                onDoubleClick={() => handleDoubleClick(p)}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-left transition-all hover:bg-white/5 group cursor-default"
                                style={{ color: 'var(--foreground)' }}>
                                {/* Plus icon to add (left side) */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); onAdd(p.label, p.type); onClose(); }}
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

                {/* Add New Preset — big dotted plus button */}
                <button
                    onClick={handleAddNewPreset}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] transition-all hover:bg-white/5"
                    style={{ border: '1px dashed var(--border)', color: 'var(--ofiere-text-ghost)' }}>
                    <Plus className="w-3.5 h-3.5" />
                </button>

                {/* Divider */}
                <div className="h-px w-full" style={{ background: 'var(--border)' }} />

                {/* Quick add (once) — adds directly without saving as preset */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5">
                        <span className="shrink-0 opacity-60" style={{ color: 'var(--ofiere-text-secondary)' }}>
                            <Plus className="w-3 h-3" />
                        </span>
                        <span className="text-[10px] text-muted-foreground">Quick add (once)</span>
                    </div>
                    <div className="flex gap-1.5">
                        <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && customLabel.trim()) { onAdd(customLabel.trim(), 'custom'); onClose(); } if (e.key === 'Escape') onClose(); }}
                            placeholder='e.g. "Max $5k spend"'
                            className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none"
                            style={{ color: 'var(--foreground)', border: '1px solid var(--border)' }} />
                        <Button size="sm" disabled={!customLabel.trim()} className="h-7 px-2 rounded-md text-[10px]"
                            onClick={() => { if (customLabel.trim()) { onAdd(customLabel.trim(), 'custom'); onClose(); } }}>
                            Set
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── Main Task Card Modal ─── */
export interface TaskCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData?: Partial<Task>;
    defaultAgentId?: string;
    availableAgents?: { id: string; name: string }[];
    onHandoff?: (task: Task) => void;
    mode?: 'create' | 'edit';
    autoGenerate?: boolean;
    onAutoGenerate?: () => Promise<Partial<Task>>;
}

export function TaskCardModal({
    isOpen, onClose, initialData, defaultAgentId, availableAgents,
    onHandoff, mode = 'create', autoGenerate, onAutoGenerate,
}: TaskCardModalProps) {
    const { addTask, updateTask } = useTaskStore();
    const {
        goalPresets, constraintPresets,
        addGoalPreset, removeGoalPreset, updateGoalPreset,
        addConstraintPreset, removeConstraintPreset, updateConstraintPreset,
    } = usePresetStore();

    const [title, setTitle] = useState('');
    const [agentId, setAgentId] = useState('');
    const [steps, setSteps] = useState<ExecutionStep[]>([]);
    const [systemPrompt, setSystemPrompt] = useState('');
    const [goals, setGoals] = useState<TaskGoal[]>([]);
    const [constraints, setConstraints] = useState<TaskConstraint[]>([]);
    const [showAgentDropdown, setShowAgentDropdown] = useState(false);
    const [showGoalPopover, setShowGoalPopover] = useState(false);
    const [showConstraintPopover, setShowConstraintPopover] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const hasAutoGenerated = useRef(false);

    const agents = availableAgents?.length
        ? availableAgents
        : AGENT_ROSTER.map(a => ({ id: a.id, name: a.name }));

    // ─── Initialize on open ───
    useEffect(() => {
        if (!isOpen) {
            hasAutoGenerated.current = false;
            return;
        }
        if (initialData) {
            setTitle(initialData.title || '');
            setAgentId(initialData.agentId || defaultAgentId || '');
            setSteps(initialData.executionPlan || []);
            setSystemPrompt(initialData.systemPrompt || '');
            setGoals(initialData.goals || []);
            setConstraints(initialData.constraints || []);
        } else {
            setTitle(''); setAgentId(defaultAgentId || ''); setSteps([]); setSystemPrompt(''); setGoals([]); setConstraints([]);
        }
        setIsSubmitting(false); setIsAutoGenerating(false);
    }, [isOpen, initialData, defaultAgentId]);

    // ─── Auto-generate on open ───
    useEffect(() => {
        if (!isOpen || !autoGenerate || !onAutoGenerate || hasAutoGenerated.current) return;
        hasAutoGenerated.current = true;
        setIsAutoGenerating(true);
        onAutoGenerate().then(data => {
            if (data) {
                setTitle(data.title || ''); setAgentId(data.agentId || defaultAgentId || '');
                setSteps(data.executionPlan || []); setSystemPrompt(data.systemPrompt || '');
                setGoals(data.goals || []); setConstraints(data.constraints || []);
            }
            setIsAutoGenerating(false);
        }).catch(() => setIsAutoGenerating(false));
    }, [isOpen, autoGenerate, onAutoGenerate, defaultAgentId]);

    useEffect(() => {
        if (!showAgentDropdown) return;
        const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowAgentDropdown(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showAgentDropdown]);

    // ─── Step operations ───
    const addStep = () => { setSteps(prev => [...prev, { id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, text: '', order: prev.length }]); };
    const updateStep = (id: string, text: string) => { setSteps(prev => prev.map(s => s.id === id ? { ...s, text } : s)); };
    const removeStep = (id: string) => { setSteps(prev => prev.filter(s => s.id !== id).map((s, i) => ({ ...s, order: i }))); };
    const duplicateStep = (id: string) => {
        const idx = steps.findIndex(s => s.id === id); if (idx === -1) return;
        const newStep = { ...steps[idx], id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, order: idx + 1 };
        const updated = [...steps]; updated.splice(idx + 1, 0, newStep);
        setSteps(updated.map((s, i) => ({ ...s, order: i })));
    };

    // ─── Goal / Constraint operations ───
    const addGoal = (label: string, type: ItemType) => { setGoals(prev => [...prev, { id: `goal-${Date.now()}`, type, label }]); };
    const removeGoal = (id: string) => { setGoals(prev => prev.filter(g => g.id !== id)); };
    const addConstraint = (label: string, type: ItemType) => { setConstraints(prev => [...prev, { id: `cons-${Date.now()}`, type, label }]); };
    const removeConstraint = (id: string) => { setConstraints(prev => prev.filter(c => c.id !== id)); };

    // ─── Submit ───
    const handleHandoff = () => {
        if (!title.trim() || !agentId) return;
        setIsSubmitting(true);
        const taskId = initialData?.id || `task-${Date.now()}`;
        const task: Task = {
            id: taskId, title: title.trim(), agentId, status: 'PENDING', priority: 'HIGH',
            updatedAt: Date.now(), timestamp: new Date().toLocaleTimeString(),
            executionPlan: steps.filter(s => s.text.trim()),
            systemPrompt: systemPrompt.trim() || undefined,
            goals: goals.length > 0 ? goals : undefined,
            constraints: constraints.length > 0 ? constraints : undefined,
            source: mode === 'create' ? 'handoff' : (initialData?.source || 'manual'),
            description: initialData?.description,
        };
        if (mode === 'edit' && initialData?.id) {
            updateTask(initialData.id, { title: task.title, agentId: task.agentId, executionPlan: task.executionPlan, systemPrompt: task.systemPrompt, goals: task.goals, constraints: task.constraints, description: task.description });
        } else { addTask(task); }
        onHandoff?.(task);
        setTimeout(() => { setIsSubmitting(false); onClose(); }, 400);
    };

    const selectedAgent = agents.find(a => a.id === agentId);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent showCloseButton={false}
                className="sm:max-w-[560px] max-h-[85vh] p-0 flex flex-col overflow-hidden gap-0 rounded-xl"
                style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                <VisuallyHidden><DialogTitle>{mode === 'edit' ? 'Configure Task' : 'New Task Card'}</DialogTitle></VisuallyHidden>

                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 shrink-0"
                    style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                    <span className="text-[13px] font-medium text-foreground">{mode === 'edit' ? 'Configure Task' : 'New Task Card'}</span>
                    <button onClick={onClose} className="p-1 rounded-md hover:bg-muted/40 transition-colors"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>

                {isAutoGenerating && (
                    <div className="px-5 py-2.5" style={{ borderBottom: '1px solid color-mix(in srgb, var(--border) 30%, transparent)' }}>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground animate-pulse">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: 'var(--ofiere-warn)' }} />
                            <span>Agent is analyzing conversation…</span>
                        </div>
                    </div>
                )}

                {/* Body */}
                <div className={cn("flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0", isAutoGenerating && "opacity-40 pointer-events-none")}>

                    {/* Task Title */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium"><Target className="w-3 h-3" /> Task Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="What should this task accomplish?"
                            className="w-full h-8 rounded-md px-3 text-[12px] text-foreground placeholder:text-muted-foreground/50 outline-none font-medium"
                            style={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                    </div>

                    {/* Agent Selector */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 font-medium">Assigned Agent</label>
                        <div className="relative" ref={dropdownRef}>
                            <button onClick={() => setShowAgentDropdown(!showAgentDropdown)}
                                className="w-full flex items-center gap-2.5 rounded-md px-3 h-8 text-left transition-all"
                                style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                                {agentId && <SmallAgentAvatar agentId={agentId} size={18} />}
                                <span className="flex-1 text-[12px] text-foreground truncate">{selectedAgent?.name || 'Select an agent…'}</span>
                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground transition-transform", showAgentDropdown && "rotate-180")} />
                            </button>
                            <AnimatePresence>
                                {showAgentDropdown && (
                                    <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                                        className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md overflow-hidden shadow-xl"
                                        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
                                        {agents.map(a => (
                                            <button key={a.id} onClick={() => { setAgentId(a.id); setShowAgentDropdown(false); }}
                                                className={cn("w-full flex items-center gap-2.5 px-3 py-2 text-[12px] transition-colors hover:bg-white/5", a.id === agentId && "bg-white/5")}>
                                                <SmallAgentAvatar agentId={a.id} size={18} />
                                                <span className="text-foreground">{a.name}</span>
                                                {a.id === agentId && <Check className="w-3 h-3 ml-auto" style={{ color: 'var(--ofiere-success)' }} />}
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Execution Plan */}
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <label className="text-[11px] text-muted-foreground font-medium">Execution Plan</label>
                            <button onClick={addStep} className="flex items-center gap-1 text-[10px] transition-colors px-1.5 py-0.5 rounded-sm hover:bg-white/5" style={{ color: 'var(--ofiere-cyan)' }}>
                                <Plus className="w-3 h-3" /> Add Step
                            </button>
                        </div>
                        <div className="space-y-1">
                            <Reorder.Group axis="y" values={steps} onReorder={(newOrder) => setSteps(newOrder.map((s, i) => ({ ...s, order: i })))}>
                                <AnimatePresence initial={false}>
                                    {steps.map((step, idx) => (
                                        <Reorder.Item key={step.id} value={step} className="group">
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <div className="cursor-grab active:cursor-grabbing p-0.5 text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"><GripVertical className="w-3.5 h-3.5" /></div>
                                                <span className="text-[10px] font-mono text-muted-foreground w-5 text-center shrink-0">{idx + 1}</span>
                                                <input value={step.text} onChange={e => updateStep(step.id, e.target.value)} placeholder={`Step ${idx + 1}…`}
                                                    className="flex-1 text-[12px] px-2.5 py-1.5 rounded-sm outline-none transition-all text-foreground placeholder:text-muted-foreground/40"
                                                    style={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                                                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => duplicateStep(step.id)} className="p-1 rounded-sm hover:bg-white/5 transition-colors" title="Duplicate"><Copy className="w-3 h-3 text-muted-foreground" /></button>
                                                    <button onClick={() => removeStep(step.id)} className="p-1 rounded-sm hover:bg-red-500/10 transition-colors" title="Delete"><Trash2 className="w-3 h-3 text-red-500/70" /></button>
                                                </div>
                                            </div>
                                        </Reorder.Item>
                                    ))}
                                </AnimatePresence>
                            </Reorder.Group>
                            {steps.length === 0 && (
                                <button onClick={addStep} className="w-full flex items-center justify-center gap-1.5 py-3 rounded-md text-[11px] transition-all hover:bg-white/3"
                                    style={{ border: '1px dashed var(--border)', color: 'var(--ofiere-text-ghost)' }}><Plus className="w-3 h-3" /> Add execution steps</button>
                            )}
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground font-medium">System Prompt Injection <span className="text-muted-foreground/50">(optional)</span></label>
                        <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
                            placeholder="Custom behavior instructions for the agent when executing this task…"
                            className="min-h-[60px] text-[12px] resize-none rounded-md" style={{ background: 'var(--background)', border: '1px solid var(--border)' }} />
                    </div>

                    {/* Goals & Constraints */}
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                        {goals.map(g => { const cfg = TYPE_CONFIG[g.type]; return (
                            <div key={g.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium group"
                                style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`, color: cfg.color }}>
                                <Target className="w-2.5 h-2.5" /><span className="truncate max-w-[100px]">{g.label}</span>
                                <button onClick={() => removeGoal(g.id)} className="p-0 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                            </div>
                        ); })}
                        {constraints.map(c => { const cfg = TYPE_CONFIG[c.type]; return (
                            <div key={c.id} className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium group"
                                style={{ background: `color-mix(in srgb, ${cfg.color} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${cfg.color} 25%, transparent)`, color: cfg.color }}>
                                <Shield className="w-2.5 h-2.5" /><span className="truncate max-w-[100px]">{c.label}</span>
                                <button onClick={() => removeConstraint(c.id)} className="p-0 opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-2.5 h-2.5" /></button>
                            </div>
                        ); })}

                        {/* +Goal */}
                        <div className="relative">
                            <button onClick={() => setShowGoalPopover(!showGoalPopover)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all hover:bg-white/5"
                                style={{ color: 'var(--ofiere-text-ghost)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-cyan)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-text-ghost)'; }}>
                                <Plus className="w-2.5 h-2.5" /><span>Goal</span>
                            </button>
                            {showGoalPopover && (
                                <PresetPopover title="Set Goal" presets={goalPresets} chipIconType="goal"
                                    onAdd={addGoal} onClose={() => setShowGoalPopover(false)}
                                    onDelete={removeGoalPreset} onUpdate={updateGoalPreset}
                                    onAddNewPreset={(label, type) => addGoalPreset(type, label)} />
                            )}
                        </div>

                        {/* +Constraint */}
                        <div className="relative">
                            <button onClick={() => setShowConstraintPopover(!showConstraintPopover)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[10px] transition-all hover:bg-white/5"
                                style={{ color: 'var(--ofiere-text-ghost)' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-warn)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'var(--ofiere-text-ghost)'; }}>
                                <Plus className="w-2.5 h-2.5" /><span>Constraint</span>
                            </button>
                            {showConstraintPopover && (
                                <PresetPopover title="Add Constraint" presets={constraintPresets} chipIconType="constraint"
                                    onAdd={addConstraint} onClose={() => setShowConstraintPopover(false)}
                                    onDelete={removeConstraintPreset} onUpdate={updateConstraintPreset}
                                    onAddNewPreset={(label, type) => addConstraintPreset(type, label)} />
                            )}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-5 py-4 shrink-0"
                    style={{ borderTop: '1px solid color-mix(in srgb, var(--border) 50%, transparent)' }}>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-4 rounded-md text-[11px]">Cancel</Button>
                    <Button size="sm" onClick={handleHandoff}
                        disabled={!title.trim() || !agentId || isSubmitting || isAutoGenerating}
                        className="h-8 px-5 rounded-md text-[11px] gap-1.5 font-semibold transition-all disabled:opacity-30"
                        style={{ background: isSubmitting ? 'var(--ofiere-success)' : 'rgb(234, 120, 47)', color: '#fff' }}>
                        {isSubmitting ? (<><Check className="w-3 h-3" /> Added</>) : (<><Send className="w-3 h-3" /> {mode === 'edit' ? 'Save Task' : 'Hand Off'}</>)}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
