"use client";

import { usePMStore } from "@/store/usePMStore";
import { PRIORITY_LABELS, PRIORITY_DOTS, STATUS_LABELS } from "@/lib/pm/types";
import type {
    PMTaskStatus, PMAssigneeType, PMTimeEntry, PMApproval, DependencyType,
    PMExecutionStep, PMTaskGoal, PMTaskConstraint, PMTaskCustomFields, PMTaskAssignee, TaskOpsItemType,
} from "@/lib/pm/types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    X, Bot, User, Zap, Clock, ListChecks, Send, Trash2, ChevronRight,
    Plus, Play, Square, Timer, CheckCircle2, XCircle, AlertCircle,
    Tag, Calendar, BarChart3, Link2, Search, ChevronDown, GripVertical,
    Target, Shield, DollarSign, Code2, Scale, MessageSquare, FileText, Cpu, Users,
    Sparkles, Loader2, Repeat, Save, RefreshCw, ToggleLeft, ToggleRight, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { usePresetStore, PresetType, PresetItem } from "@/lib/usePresetStore";
import { AGENT_ROSTER, getAgentProfile } from "@/lib/agentRoster";
import { useAgentAvatar } from "@/hooks/useAgentAvatar";

type DetailTab = 'details' | 'subtasks' | 'dependencies' | 'approvals' | 'activity';

const DEPENDENCY_TYPE_LABELS: Record<string, string> = {
    finish_to_start: 'Finish to Start',
    start_to_start: 'Start to Start',
    finish_to_finish: 'Finish to Finish',
    start_to_finish: 'Start to Finish',
};

const TYPE_ICONS: Record<TaskOpsItemType, React.ReactNode> = {
    budget: <DollarSign className="w-3 h-3" />,
    stack: <Code2 className="w-3 h-3" />,
    legal: <Scale className="w-3 h-3" />,
    deadline: <Clock className="w-3 h-3" />,
    custom: <Shield className="w-3 h-3" />,
};

const TYPE_COLORS: Record<TaskOpsItemType, string> = {
    budget: '#f59e0b',
    stack: '#22d3ee',
    legal: '#a78bfa',
    deadline: '#ef4444',
    custom: '#71717a',
};

/* ─── Square Agent Avatar ─── */
function AgentSquareAvatar({ agentId, size = 20 }: { agentId: string; size?: number }) {
    const { avatarUri } = useAgentAvatar(agentId);
    const profile = getAgentProfile(agentId);

    if (avatarUri) {
        return (
            <img
                src={avatarUri}
                alt={profile?.name || agentId}
                className="object-cover shrink-0"
                style={{
                    width: size, height: size,
                    borderRadius: 'var(--radius, 0.375rem)',
                    border: `1.5px solid ${profile?.colorHex || '#666'}`,
                }}
            />
        );
    }

    // Fallback: try static avatar path
    if (profile?.avatar) {
        return (
            <img
                src={profile.avatar}
                alt={profile.name}
                className="object-cover shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                style={{
                    width: size, height: size,
                    borderRadius: 'var(--radius, 0.375rem)',
                    border: `1.5px solid ${profile.colorHex}`,
                }}
            />
        );
    }

    return (
        <div
            className="flex items-center justify-center text-white font-bold shrink-0"
            style={{
                width: size, height: size,
                background: profile?.colorHex || '#666',
                borderRadius: 'var(--radius, 0.375rem)',
                fontSize: size * 0.4,
            }}
        >
            {profile?.avatarFallback || agentId.slice(0, 2).toUpperCase()}
        </div>
    );
}

/* ─── Time Input (24h hh:mm, commits on blur/Enter) ─── */
function TimeInput({ dateValue, onCommit, placeholder = "00:00" }: {
    dateValue: string | null;
    onCommit: (isoString: string) => void;
    placeholder?: string;
}) {
    const extractTime = (iso: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        if (isNaN(d.getTime())) return '';
        return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    };

    const [localValue, setLocalValue] = useState(extractTime(dateValue));
    const [isFocused, setIsFocused] = useState(false);

    // Sync from parent when not focused
    useEffect(() => {
        if (!isFocused) {
            setLocalValue(extractTime(dateValue));
        }
    }, [dateValue, isFocused]);

    const commit = () => {
        if (!dateValue) return;
        const match = localValue.match(/^(\d{1,2}):(\d{2})$/);
        if (match) {
            const h = Math.min(23, parseInt(match[1]));
            const m = Math.min(59, parseInt(match[2]));
            const d = new Date(dateValue);
            d.setHours(h, m, 0, 0);
            onCommit(d.toISOString());
        } else {
            // Reset to current value
            setLocalValue(extractTime(dateValue));
        }
    };

    return (
        <input
            type="text"
            placeholder={placeholder}
            value={localValue}
            disabled={!dateValue}
            onFocus={() => setIsFocused(true)}
            onBlur={() => { setIsFocused(false); commit(); }}
            onChange={(e) => {
                let val = e.target.value.replace(/[^0-9:]/g, '');
                // Auto-insert colon after 2 digits
                if (val.length === 2 && !val.includes(':') && localValue.length < 2) val += ':';
                if (val.length <= 5) setLocalValue(val);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); } }}
            className="w-[52px] h-7 text-[11px] text-center rounded-md border border-border bg-card px-1 outline-none focus:border-accent-base/50 transition-colors text-foreground placeholder:text-muted-foreground/20 tabular-nums disabled:opacity-30"
            maxLength={5}
        />
    );
}

/* ─── Preset Popover (Goal / Constraint picker) ─── */
function PresetPopover({
    title, presets, onAdd, onDelete, onUpdate, onAddNewPreset, onClose,
}: {
    title: string;
    presets: PresetItem[];
    onAdd: (label: string, type: TaskOpsItemType) => void;
    onDelete: (presetId: string) => void;
    onUpdate: (presetId: string, newLabel: string) => void;
    onAddNewPreset: (label: string, type: TaskOpsItemType) => void;
    onClose: () => void;
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

    const handleEditSubmit = (preset: PresetItem) => {
        if (editText.trim() && editText.trim() !== preset.label) {
            onUpdate(preset.id, editText.trim());
        }
        setEditingId(null);
    };

    return (
        <div ref={ref} className="absolute bottom-full left-0 mb-2 z-50 rounded-lg overflow-hidden shadow-xl"
            style={{ background: 'var(--card)', border: '1px solid var(--border)', minWidth: 260 }}>
            <div className="p-3 space-y-2">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">{title}</span>
                <div className="flex flex-col gap-0.5">
                    {presets.map((p) => {
                        if (editingId === p.id) {
                            return (
                                <div key={p.id} className="flex items-center gap-1.5 px-2.5 py-1">
                                    <input ref={editInputRef} value={editText} onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => { if (e.key === 'Enter') handleEditSubmit(p); if (e.key === 'Escape') setEditingId(null); }}
                                        onBlur={() => handleEditSubmit(p)}
                                        className="flex-1 text-[11px] px-1.5 py-0.5 rounded-sm bg-transparent outline-none text-foreground border border-border" />
                                </div>
                            );
                        }
                        return (
                            <div key={p.id}
                                onDoubleClick={() => { setEditingId(p.id); setEditText(p.label); }}
                                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] transition-all hover:bg-foreground/5 group cursor-default text-foreground">
                                <button onClick={(e) => { e.stopPropagation(); onAdd(p.label, p.type as TaskOpsItemType); onClose(); }}
                                    className="p-0.5 rounded-sm hover:bg-foreground/10 transition-colors opacity-50 group-hover:opacity-100 shrink-0">
                                    <Plus className="w-3 h-3" />
                                </button>
                                <span className="flex-1 select-none">{p.label}</span>
                                <button onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                                    className="p-0.5 rounded-sm hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0">
                                    <Trash2 className="w-3 h-3 text-red-500/70" />
                                </button>
                            </div>
                        );
                    })}
                </div>
                <button onClick={() => onAddNewPreset('New Preset', 'custom')}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-md text-[11px] transition-all hover:bg-foreground/5 border border-dashed border-border text-muted-foreground/30">
                    <Plus className="w-3.5 h-3.5" />
                </button>
                <div className="h-px w-full bg-border" />
                <div className="space-y-1.5">
                    <span className="text-[10px] text-muted-foreground/40">Quick add (once)</span>
                    <div className="flex gap-1.5">
                        <input value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter' && customLabel.trim()) { onAdd(customLabel.trim(), 'custom'); onClose(); } if (e.key === 'Escape') onClose(); }}
                            placeholder='e.g. "Max $5k spend"'
                            className="flex-1 text-[11px] px-2 py-1.5 rounded-sm bg-transparent outline-none text-foreground border border-border" />
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

/* ─── Main Detail Panel ─── */
export function TaskDetailPanel() {
    const selectedTaskId = usePMStore((s) => s.selectedTaskId);
    const tasks = usePMStore((s) => s.tasks);
    const agents = usePMStore((s) => s.agents);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const updateTask = usePMStore((s) => s.updateTask);
    const deleteTask = usePMStore((s) => s.deleteTask);
    const createTask = usePMStore((s) => s.createTask);
    const logActivity = usePMStore((s) => s.logActivity);
    const fetchActivities = usePMStore((s) => s.fetchActivities);
    const activities = usePMStore((s) => s.activities);
    const dependencies = usePMStore((s) => s.dependencies);
    const addDependency = usePMStore((s) => s.addDependency);
    const removeDependency = usePMStore((s) => s.removeDependency);
    const updateDependency = usePMStore((s) => s.updateDependency);
    const getTaskDependencies = usePMStore((s) => s.getTaskDependencies);
    const saveTaskToOps = usePMStore((s) => s.saveTaskToOps);
    const syncTaskToOps = usePMStore((s) => s.syncTaskToOps);

    // Preset store (global goals/constraints)
    const goalPresets = usePresetStore((s) => s.goalPresets);
    const constraintPresets = usePresetStore((s) => s.constraintPresets);
    const addGoalPreset = usePresetStore((s) => s.addGoalPreset);
    const removeGoalPreset = usePresetStore((s) => s.removeGoalPreset);
    const updateGoalPreset = usePresetStore((s) => s.updateGoalPreset);
    const addConstraintPreset = usePresetStore((s) => s.addConstraintPreset);
    const removeConstraintPreset = usePresetStore((s) => s.removeConstraintPreset);
    const updateConstraintPreset = usePresetStore((s) => s.updateConstraintPreset);

    const task = useMemo(() => tasks.find((t) => t.id === selectedTaskId), [tasks, selectedTaskId]);
    const subtasks = useMemo(() => tasks.filter((t) => t.parent_task_id === selectedTaskId), [tasks, selectedTaskId]);
    const taskDeps = useMemo(() => {
        if (!selectedTaskId) return { predecessors: [], successors: [] };
        return getTaskDependencies(selectedTaskId);
    }, [selectedTaskId, dependencies, getTaskDependencies]);
    const totalDepCount = taskDeps.predecessors.length + taskDeps.successors.length;

    const [activeTab, setActiveTab] = useState<DetailTab>('details');
    const [comment, setComment] = useState("");
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editTitle, setEditTitle] = useState("");
    const [newSubtaskTitle, setNewSubtaskTitle] = useState("");
    const [showAddSubtask, setShowAddSubtask] = useState(false);
    const [tagInput, setTagInput] = useState("");
    const [openPanelDropdown, setOpenPanelDropdown] = useState<string | null>(null);

    // Dependencies
    const [addingDepType, setAddingDepType] = useState<'predecessor' | 'successor' | null>(null);
    const [depSearchQuery, setDepSearchQuery] = useState("");
    const depSearchRef = useRef<HTMLInputElement>(null);

    // Time tracking
    const [timeEntries, setTimeEntries] = useState<PMTimeEntry[]>([]);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
    const [timerStart, setTimerStart] = useState<Date | null>(null);
    const [elapsed, setElapsed] = useState(0);
    const [manualHours, setManualHours] = useState("");
    const [manualMinutes, setManualMinutes] = useState("");
    const [manualDescription, setManualDescription] = useState("");

    // Approvals
    const [approvals, setApprovals] = useState<PMApproval[]>([]);
    const [approvalName, setApprovalName] = useState("");
    const [showApprovalPicker, setShowApprovalPicker] = useState(false);

    // Task-Ops fields
    const [showGoalPicker, setShowGoalPicker] = useState(false);
    const [showConstraintPicker, setShowConstraintPicker] = useState(false);
    const [newStepText, setNewStepText] = useState("");
    const [showAssigneePicker, setShowAssigneePicker] = useState(false);

    // Auto-generate execution plan
    const [isGeneratingSteps, setIsGeneratingSteps] = useState(false);

    // Load Task toggle + Save/Sync state
    const [loadTaskMode, setLoadTaskMode] = useState(false);
    const [loadTaskDropdownOpen, setLoadTaskDropdownOpen] = useState(false);
    const [loadTaskAgentFilter, setLoadTaskAgentFilter] = useState<string | null>(null);
    const [loadTaskList, setLoadTaskList] = useState<any[]>([]);
    const [loadTaskLoading, setLoadTaskLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [saveToast, setSaveToast] = useState<string | null>(null);

    useEffect(() => {
        if (task) {
            fetchActivities('task', task.id);
            fetchTimeEntries(task.id);
            fetchApprovals(task.id);
        }
    }, [task?.id]);

    // Timer tick
    useEffect(() => {
        if (!isTimerRunning || !timerStart) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - timerStart.getTime()) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [isTimerRunning, timerStart]);

    const fetchTimeEntries = async (taskId: string) => {
        try {
            const res = await fetch(`/api/pm/time-entries?task_id=${taskId}`);
            const data = await res.json();
            setTimeEntries(data.entries || []);
            // Check for running timer
            const running = (data.entries || []).find((e: PMTimeEntry) => e.is_running);
            if (running) {
                setIsTimerRunning(true);
                setActiveTimerId(running.id);
                setTimerStart(new Date(running.start_time));
                setElapsed(Math.floor((Date.now() - new Date(running.start_time).getTime()) / 1000));
            }
        } catch { }
    };

    const fetchApprovals = async (taskId: string) => {
        try {
            const res = await fetch(`/api/pm/approvals?task_id=${taskId}`);
            const data = await res.json();
            setApprovals(data.approvals || []);
        } catch { }
    };

    // Searchable task list for dependency picker (must be before early return to maintain hook count)
    const depSearchResults = useMemo(() => {
        if (!depSearchQuery.trim() || !task) return [];
        const q = depSearchQuery.toLowerCase();
        return tasks.filter((t) => {
            if (t.id === task.id) return false;
            if (t.parent_task_id) return false;
            if (t.title.toLowerCase().includes(q)) return true;
            return false;
        }).slice(0, 8);
    }, [tasks, depSearchQuery, task]);

    // ── These useMemo hooks MUST be before the early return ──
    const _cf = (task?.custom_fields || {}) as any;
    const _linkedTaskId: string | null = _cf?.linked_task_id || null;

    const hasUnsyncedChanges = useMemo(() => {
        if (!task || !_linkedTaskId || !_cf?.last_sync_snapshot) return false;
        try {
            const snapshot = JSON.parse(_cf.last_sync_snapshot);
            return (
                task.title !== snapshot.title ||
                task.description !== snapshot.description ||
                JSON.stringify(_cf.execution_plan) !== JSON.stringify(snapshot.execution_plan) ||
                _cf.system_prompt !== snapshot.system_prompt ||
                JSON.stringify(_cf.goals) !== JSON.stringify(snapshot.goals) ||
                JSON.stringify(_cf.constraints) !== JSON.stringify(snapshot.constraints)
            );
        } catch {
            return true;
        }
    }, [task, _cf, _linkedTaskId]);

    const filteredLoadTasks = useMemo(() => {
        if (!loadTaskAgentFilter) return loadTaskList;
        return loadTaskList.filter((t: any) => t.agentId === loadTaskAgentFilter);
    }, [loadTaskList, loadTaskAgentFilter]);

    const loadTaskAgents = useMemo(() => {
        const agentIds = new Set(loadTaskList.map((t: any) => t.agentId).filter(Boolean));
        return AGENT_ROSTER.filter(a => agentIds.has(a.id));
    }, [loadTaskList]);

    if (!task) return null;

    // ── Custom fields helpers ──
    const cf = (task.custom_fields || {}) as PMTaskCustomFields & {
        pm_only?: boolean;
        linked_task_id?: string;
        last_sync_snapshot?: string;
    };
    const executionPlan: PMExecutionStep[] = cf.execution_plan || [];
    const systemPrompt: string = cf.system_prompt || '';
    const goals: PMTaskGoal[] = cf.goals || [];
    const constraints: PMTaskConstraint[] = cf.constraints || [];
    const assignees: PMTaskAssignee[] = cf.assignees || [];
    const linkedTaskId: string | null = cf.linked_task_id || null;

    const updateCustomFields = (updates: Partial<PMTaskCustomFields>) => {
        updateTask(task.id, {
            custom_fields: { ...cf, ...updates },
        });
    };

    // ── Save to Task-Ops handler (creates new copy) ──
    const handleSaveToOps = async () => {
        if (assignees.length === 0 && !task.agent_id) return;
        setIsSaving(true);
        try {
            const newId = await saveTaskToOps(task.id);
            if (newId) {
                const agentName = getAgentName(task.agent_id || assignees[0]?.id) || 'agent';
                setSaveToast(`Saved to ${agentName}'s task-ops`);
                setTimeout(() => setSaveToast(null), 3000);
                logActivity('task', task.id, 'updated', `Saved as new task-ops copy`, 'system', 'System');
            }
        } finally {
            setIsSaving(false);
        }
    };

    // ── Sync to linked Task-Ops task handler ──
    const handleSyncToOps = async () => {
        if (!linkedTaskId) return;
        setIsSyncing(true);
        try {
            await syncTaskToOps(task.id);
            setSaveToast('Synced to task-ops');
            setTimeout(() => setSaveToast(null), 3000);
            logActivity('task', task.id, 'updated', `Synced modifications to linked task-ops task`, 'system', 'System');
        } finally {
            setIsSyncing(false);
        }
    };

    // ── Load Task: fetch task-ops tasks for dropdown ──
    const handleLoadTaskToggle = async (on: boolean) => {
        setLoadTaskMode(on);
        if (on) {
            setLoadTaskDropdownOpen(true);
            setLoadTaskLoading(true);
            try {
                const res = await fetch('/api/tasks');
                const data = await res.json();
                setLoadTaskList(data.tasks || []);
            } catch {
                setLoadTaskList([]);
            } finally {
                setLoadTaskLoading(false);
            }
        } else {
            setLoadTaskDropdownOpen(false);
            setLoadTaskAgentFilter(null);
        }
    };

    // ── Load Task: select a task from the dropdown ──
    const handleSelectLoadTask = (opsTask: any) => {
        // Populate PM task fields from the selected task-ops task
        updateTask(task.id, {
            title: opsTask.title,
            description: opsTask.description || task.description,
            agent_id: opsTask.agentId || task.agent_id,
            assignee_type: opsTask.agentId ? 'agent' : task.assignee_type,
        });
        // Update custom fields too
        const newAssignees = opsTask.agentId
            ? [{ id: opsTask.agentId, type: 'agent' as const }, ...assignees.filter(a => a.id !== opsTask.agentId)]
            : assignees;
        updateCustomFields({
            assignees: newAssignees,
            linked_task_id: opsTask.id,
            pm_only: false,
            execution_plan: opsTask.executionPlan || cf.execution_plan || [],
            system_prompt: opsTask.systemPrompt || cf.system_prompt || '',
            goals: opsTask.goals || cf.goals || [],
            constraints: opsTask.constraints || cf.constraints || [],
            last_sync_snapshot: JSON.stringify({
                description: opsTask.description || task.description,
                execution_plan: opsTask.executionPlan || cf.execution_plan || [],
                system_prompt: opsTask.systemPrompt || cf.system_prompt || '',
                goals: opsTask.goals || cf.goals || [],
                constraints: opsTask.constraints || cf.constraints || [],
            }),
        } as any);
        logActivity('task', task.id, 'updated', `Linked to task-ops task: ${opsTask.title}`, 'system', 'System');
        setLoadTaskMode(false);
        setLoadTaskDropdownOpen(false);
        setLoadTaskAgentFilter(null);
    };

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return null;
        return agents.find((a) => a.id === agentId)?.name || agentId;
    };

    const handleStatusChange = (status: PMTaskStatus) => {
        const old = task.status;
        updateTask(task.id, { status, progress: status === 'DONE' ? 100 : task.progress });
        logActivity('task', task.id, 'status_change', `Status changed from ${STATUS_LABELS[old]} to ${STATUS_LABELS[status]}`, 'system', 'System');
    };

    const handleComment = () => {
        if (!comment.trim()) return;
        logActivity('task', task.id, 'comment', comment.trim(), 'human', 'You');
        setComment("");
    };

    const handleDelete = () => {
        deleteTask(task.id);
        setSelectedTask(null);
    };

    // ── Subtask ──
    const handleAddSubtask = async () => {
        if (!newSubtaskTitle.trim()) return;
        await createTask({
            title: newSubtaskTitle.trim(),
            parent_task_id: task.id,
            space_id: task.space_id,
            folder_id: task.folder_id,
        });
        setNewSubtaskTitle("");
        logActivity('task', task.id, 'created', `Added subtask: ${newSubtaskTitle.trim()}`, 'human', 'You');
    };

    // ── Tags ──
    const handleAddTag = () => {
        if (!tagInput.trim()) return;
        const newTag = tagInput.trim().toLowerCase();
        if (task.tags?.includes(newTag)) { setTagInput(""); return; }
        updateTask(task.id, { tags: [...(task.tags || []), newTag] });
        setTagInput("");
    };

    const handleRemoveTag = (tag: string) => {
        updateTask(task.id, { tags: (task.tags || []).filter((t: string) => t !== tag) });
    };

    // ── Timer ──
    const startTimer = async () => {
        try {
            const res = await fetch('/api/pm/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task_id: task.id, is_running: true }),
            });
            const data = await res.json();
            setIsTimerRunning(true);
            setActiveTimerId(data.id);
            setTimerStart(new Date());
            setElapsed(0);
        } catch { }
    };

    const stopTimer = async () => {
        if (!activeTimerId) return;
        const duration = Math.ceil(elapsed / 60);
        try {
            await fetch('/api/pm/time-entries', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: activeTimerId,
                    end_time: new Date().toISOString(),
                    duration_minutes: duration,
                    is_running: false,
                }),
            });
            setIsTimerRunning(false);
            setActiveTimerId(null);
            setTimerStart(null);
            setElapsed(0);
            fetchTimeEntries(task.id);
            logActivity('task', task.id, 'updated', `Logged ${duration}m via timer`, 'human', 'You');
        } catch { }
    };

    const addManualEntry = async () => {
        const mins = (parseInt(manualHours || '0') * 60) + parseInt(manualMinutes || '0');
        if (mins <= 0) return;
        try {
            await fetch('/api/pm/time-entries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    is_manual: true,
                    is_running: false,
                    duration_minutes: mins,
                    description: manualDescription,
                    end_time: new Date().toISOString(),
                }),
            });
            setManualHours("");
            setManualMinutes("");
            setManualDescription("");
            fetchTimeEntries(task.id);
            logActivity('task', task.id, 'updated', `Logged ${mins}m manually`, 'human', 'You');
        } catch { }
    };

    const deleteTimeEntry = async (entryId: string) => {
        try {
            await fetch(`/api/pm/time-entries?id=${entryId}`, { method: 'DELETE' });
            setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
        } catch { }
    };

    // ── Approvals ──
    const requestApproval = async (name?: string, type?: 'agent' | 'human') => {
        const approverName = name || approvalName.trim();
        if (!approverName) return;
        const approverType = type || (agents.find((a) => a.name.toLowerCase() === approverName.toLowerCase()) ? 'agent' : 'human');
        try {
            await fetch('/api/pm/approvals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    task_id: task.id,
                    approver_type: approverType,
                    approver_name: approverName,
                }),
            });
            setApprovalName("");
            setShowApprovalPicker(false);
            fetchApprovals(task.id);
            logActivity('task', task.id, 'updated', `Requested approval from ${approverName}`, 'human', 'You');
        } catch { }
    };

    const resolveApproval = async (id: string, status: 'approved' | 'rejected') => {
        try {
            await fetch('/api/pm/approvals', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, status }),
            });
            fetchApprovals(task.id);
        } catch { }
    };

    const formatTime = (secs: number) => {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const totalTrackedMinutes = timeEntries.reduce((sum, e) => sum + (e.duration_minutes || 0), 0);
    const totalTrackedDisplay = `${Math.floor(totalTrackedMinutes / 60)}h ${totalTrackedMinutes % 60}m`;

    const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();

    const TABS: { id: DetailTab; label: string; icon: typeof Clock; count?: number }[] = [
        { id: 'details', label: 'Details', icon: BarChart3 },
        { id: 'subtasks', label: 'Subtasks', icon: ListChecks, count: subtasks.length },
        { id: 'dependencies', label: 'Deps', icon: Link2, count: totalDepCount },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle2, count: approvals.length },
        { id: 'activity', label: 'Activity', icon: MessageSquare, count: activities.length },
    ];

    const handleAddDep = async (targetTaskId: string) => {
        if (!task) return;
        if (addingDepType === 'predecessor') {
            await addDependency(targetTaskId, task.id);
            logActivity('task', task.id, 'updated', `Added predecessor dependency`, 'human', 'You');
        } else {
            await addDependency(task.id, targetTaskId);
            logActivity('task', task.id, 'updated', `Added successor dependency`, 'human', 'You');
        }
        setAddingDepType(null);
        setDepSearchQuery("");
    };

    const handleRemoveDep = async (depId: string) => {
        await removeDependency(depId);
        if (task) logActivity('task', task.id, 'updated', `Removed dependency`, 'human', 'You');
    };

    // ── Execution Plan helpers ──
    const addExecutionStep = () => {
        if (!newStepText.trim()) return;
        const newStep: PMExecutionStep = {
            id: `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            text: newStepText.trim(),
            order: executionPlan.length,
        };
        updateCustomFields({ execution_plan: [...executionPlan, newStep] });
        setNewStepText("");
    };

    const removeExecutionStep = (stepId: string) => {
        updateCustomFields({
            execution_plan: executionPlan.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i })),
        });
    };

    const reorderExecutionPlan = (newOrder: PMExecutionStep[]) => {
        updateCustomFields({
            execution_plan: newOrder.map((s, i) => ({ ...s, order: i })),
        });
    };

    // ── Auto-Generate Execution Plan (LLM) ──
    const handleAutoGenerate = async () => {
        const instruction = task.description?.trim();
        if (!instruction || isGeneratingSteps) return;

        setIsGeneratingSteps(true);
        try {
            const primaryAgent = assignees.length > 0 ? getAgentProfile(assignees[0].id) : null;
            const res = await fetch('/api/pm/generate-steps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instruction,
                    task_title: task.title,
                    agent_name: primaryAgent?.name || undefined,
                }),
            });

            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();

            if (data.steps && Array.isArray(data.steps) && data.steps.length > 0) {
                const newSteps: PMExecutionStep[] = data.steps.map((text: string, i: number) => ({
                    id: `step-gen-${Date.now()}-${i}`,
                    text,
                    order: executionPlan.length + i,
                }));
                updateCustomFields({ execution_plan: [...executionPlan, ...newSteps] });
                logActivity('task', task.id, 'updated', `Auto-generated ${newSteps.length} execution steps`, 'system', 'System');
            }
        } catch (err) {
            console.error('[TaskDetailPanel] Auto-generate failed:', err);
        } finally {
            setIsGeneratingSteps(false);
        }
    };

    // ── Goals / Constraints helpers ──
    const addGoal = (label: string, type: TaskOpsItemType) => {
        const newGoal: PMTaskGoal = {
            id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            label,
        };
        updateCustomFields({ goals: [...goals, newGoal] });
    };

    const removeGoal = (goalId: string) => {
        updateCustomFields({ goals: goals.filter((g) => g.id !== goalId) });
    };

    const addConstraint = (label: string, type: TaskOpsItemType) => {
        const newConstraint: PMTaskConstraint = {
            id: `cons-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            type,
            label,
        };
        updateCustomFields({ constraints: [...constraints, newConstraint] });
    };

    const removeConstraint = (consId: string) => {
        updateCustomFields({ constraints: constraints.filter((c) => c.id !== consId) });
    };

    // ── Multi-Assignee helpers ──
    const addAssignee = (agentId: string) => {
        if (assignees.some((a) => a.id === agentId)) return;
        const newAssignee: PMTaskAssignee = { id: agentId, type: 'agent' };
        const updated = [...assignees, newAssignee];
        updateCustomFields({ assignees: updated });
        // Also set the primary agent_id to the first assignee
        if (!task.agent_id) {
            updateTask(task.id, { agent_id: agentId, assignee_type: 'agent' });
        }
    };

    const removeAssignee = (agentId: string) => {
        const updated = assignees.filter((a) => a.id !== agentId);
        updateCustomFields({ assignees: updated });
        // If removed the primary agent, set to first remaining or null
        if (task.agent_id === agentId) {
            updateTask(task.id, {
                agent_id: updated.length > 0 ? updated[0].id : null,
                assignee_type: updated.length > 0 ? 'agent' : 'auto',
            });
        }
    };

    const availableAgents = AGENT_ROSTER.filter((a) => !assignees.some((as) => as.id === a.id));

    // ── Dep search shared renderer ──
    const renderDepSearch = (type: 'predecessor' | 'successor') => (
        <div className="relative">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-card border border-accent-base/30">
                <Search className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                <input
                    ref={type === 'predecessor' ? depSearchRef : undefined}
                    autoFocus
                    value={depSearchQuery}
                    onChange={(e) => setDepSearchQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setAddingDepType(null); setDepSearchQuery(""); } }}
                    placeholder="Search tasks..."
                    className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                />
                <button onClick={() => { setAddingDepType(null); setDepSearchQuery(""); }}>
                    <X className="w-3 h-3 text-muted-foreground/30 hover:text-foreground" />
                </button>
            </div>
            {depSearchResults.length > 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                    {depSearchResults.map((t) => {
                        const alreadyLinked = type === 'predecessor'
                            ? taskDeps.predecessors.some(d => d.predecessor_id === t.id)
                            : taskDeps.successors.some(d => d.successor_id === t.id);
                        return (
                            <button key={t.id} onClick={() => !alreadyLinked && handleAddDep(t.id)} disabled={alreadyLinked}
                                className={cn("w-full text-left px-3 py-2 flex items-center gap-2 transition-colors border-b border-border/10 last:border-0",
                                    alreadyLinked ? "opacity-30 cursor-not-allowed" : "hover:bg-accent-base/5 cursor-pointer")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                                    'bg-zinc-500': t.status === 'PENDING', 'bg-accent-base': t.status === 'IN_PROGRESS',
                                    'bg-accent-lime': t.status === 'DONE', 'bg-red-500': t.status === 'FAILED',
                                })} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium text-foreground truncate">{t.title}</p>
                                    <p className="text-[8px] text-muted-foreground/30 truncate">{STATUS_LABELS[t.status]}{alreadyLinked && ' · Already linked'}</p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}
            {depSearchQuery.trim() && depSearchResults.length === 0 && (
                <div className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg bg-card border border-border/50 shadow-xl p-3">
                    <p className="text-[10px] text-muted-foreground/30 text-center">No matching tasks found</p>
                </div>
            )}
        </div>
    );

    // ── Dep item renderer ──
    const renderDepItem = (dep: any, linkedTask: any) => {
        if (!linkedTask) return null;
        return (
            <div key={dep.id} className="flex items-center gap-2 p-2 rounded-lg bg-foreground/2 border border-border/20 group">
                <div className={cn("w-2 h-2 rounded-full shrink-0", {
                    'bg-blue-500': linkedTask.status === 'NEW',
                    'bg-zinc-500': linkedTask.status === 'PENDING',
                    'bg-accent-base': linkedTask.status === 'IN_PROGRESS',
                    'bg-accent-lime': linkedTask.status === 'DONE',
                    'bg-red-500': linkedTask.status === 'FAILED',
                })} />
                <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate cursor-pointer hover:text-accent-base transition-colors"
                        onClick={() => setSelectedTask(linkedTask.id)}>
                        {linkedTask.title}
                    </p>
                </div>
                <button onClick={() => handleRemoveDep(dep.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <X className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                </button>
            </div>
        );
    };

    return (
        <div className="pm-detail-panel border-l border-border/30 flex flex-col h-full bg-background overflow-hidden shrink-0"
            style={{ width: '55vw', maxWidth: 800, minWidth: 520 }}>
            {/* ── Header: Title + Actions ── */}
            <div className="px-5 py-3.5 border-b border-border/20">
                <div className="flex items-center gap-2">
                    {/* Load Task Toggle */}
                    <button
                        onClick={() => handleLoadTaskToggle(!loadTaskMode)}
                        className={cn(
                            "shrink-0 transition-colors rounded p-0.5",
                            loadTaskMode
                                ? "text-accent-base"
                                : "text-muted-foreground/30 hover:text-muted-foreground/60"
                        )}
                        title={loadTaskMode ? "Cancel linking" : "Load Task from Task-Ops"}
                    >
                        {loadTaskMode
                            ? <ToggleRight className="w-5 h-5" />
                            : <ToggleLeft className="w-5 h-5" />
                        }
                    </button>

                    {/* Editable title OR Load Task dropdown */}
                    <div className="flex-1 min-w-0 relative">
                        {loadTaskMode ? (
                            /* ── Load Task Dropdown ── */
                            <>
                                <button
                                    onClick={() => setLoadTaskDropdownOpen(!loadTaskDropdownOpen)}
                                    className="w-full flex items-center gap-2 text-[15px] font-semibold text-accent-base tracking-tight cursor-pointer hover:text-accent-hover transition-colors truncate text-left"
                                >
                                    <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    {task.title}
                                    <ChevronDown className="w-3 h-3 opacity-50 shrink-0" />
                                </button>
                                <AnimatePresence>
                                    {loadTaskDropdownOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => { setLoadTaskDropdownOpen(false); setLoadTaskMode(false); setLoadTaskAgentFilter(null); }} />
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 4 }}
                                                className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl min-w-[340px] max-w-[420px] overflow-hidden"
                                            >
                                                {/* Agent filter pills */}
                                                {loadTaskAgents.length > 0 && (
                                                    <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20 overflow-x-auto scrollbar-hide">
                                                        <button
                                                            onClick={() => setLoadTaskAgentFilter(null)}
                                                            className={cn(
                                                                "text-[10px] font-medium px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0",
                                                                !loadTaskAgentFilter
                                                                    ? "bg-accent-base/15 border-accent-base/30 text-accent-base"
                                                                    : "bg-foreground/5 border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/8"
                                                            )}
                                                        >
                                                            All
                                                        </button>
                                                        {loadTaskAgents.map((agent) => {
                                                            const profile = getAgentProfile(agent.id);
                                                            return (
                                                                <button
                                                                    key={agent.id}
                                                                    onClick={() => setLoadTaskAgentFilter(loadTaskAgentFilter === agent.id ? null : agent.id)}
                                                                    className={cn(
                                                                        "text-[10px] font-medium px-2.5 py-1 rounded-md border transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5",
                                                                        loadTaskAgentFilter === agent.id
                                                                            ? "bg-accent-base/15 border-accent-base/30 text-accent-base"
                                                                            : "bg-foreground/5 border-border/30 text-muted-foreground hover:text-foreground hover:bg-foreground/8"
                                                                    )}
                                                                >
                                                                    <Bot className="w-3 h-3" style={{ color: profile?.color }} />
                                                                    {profile?.name || agent.id}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Task list */}
                                                <div className="max-h-[280px] overflow-y-auto">
                                                    {loadTaskLoading ? (
                                                        <div className="flex items-center justify-center py-6 gap-2 text-muted-foreground/40">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span className="text-[11px]">Loading tasks...</span>
                                                        </div>
                                                    ) : filteredLoadTasks.length === 0 ? (
                                                        <div className="flex items-center justify-center py-6">
                                                            <span className="text-[11px] text-muted-foreground/30">
                                                                {loadTaskAgentFilter ? 'No tasks for this agent' : 'No task-ops tasks found'}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        filteredLoadTasks.map((opsTask: any) => {
                                                            const agentProfile = getAgentProfile(opsTask.agentId);
                                                            return (
                                                                <button
                                                                    key={opsTask.id}
                                                                    onClick={() => handleSelectLoadTask(opsTask)}
                                                                    className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 hover:bg-accent-base/5 transition-colors border-b border-border/10 last:border-0 cursor-pointer"
                                                                >
                                                                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", {
                                                                        'bg-zinc-500': opsTask.status === 'PENDING',
                                                                        'bg-accent-base': opsTask.status === 'IN_PROGRESS',
                                                                        'bg-accent-lime': opsTask.status === 'DONE',
                                                                        'bg-red-500': opsTask.status === 'FAILED',
                                                                    })} />
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="text-[12px] font-medium text-foreground truncate">{opsTask.title}</p>
                                                                        <p className="text-[9px] text-muted-foreground/40 flex items-center gap-1 mt-0.5">
                                                                            {agentProfile && (
                                                                                <>
                                                                                    <Bot className="w-2.5 h-2.5" style={{ color: agentProfile.color }} />
                                                                                    {agentProfile.name}
                                                                                </>
                                                                            )}
                                                                        </p>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </>
                        ) : isEditingTitle ? (
                            <Input
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onBlur={() => { if (editTitle.trim()) updateTask(task.id, { title: editTitle.trim() }); setIsEditingTitle(false); }}
                                onKeyDown={(e) => { if (e.key === 'Enter') { if (editTitle.trim()) updateTask(task.id, { title: editTitle.trim() }); setIsEditingTitle(false); } }}
                                className="text-[15px] font-semibold h-auto py-0.5 border-none bg-transparent shadow-none focus-visible:ring-0 px-0"
                                autoFocus
                            />
                        ) : (
                            <h3
                                onClick={() => { setEditTitle(task.title); setIsEditingTitle(true); }}
                                className={cn(
                                    "text-[15px] font-semibold tracking-tight cursor-text hover:text-accent-base transition-colors truncate",
                                    linkedTaskId ? "text-accent-base" : "text-foreground"
                                )}
                            >
                                {linkedTaskId && <Link2 className="w-3 h-3 inline-block mr-1.5 opacity-50" />}
                                {task.title}
                            </h3>
                        )}
                    </div>
                    {assignees.length > 1 && (
                        <span className="flex items-center gap-1 text-[9px] text-accent-violet/70 bg-accent-violet/5 px-1.5 py-0.5 rounded shrink-0">
                            <Users className="w-2.5 h-2.5" />
                            Multi-Agent
                        </span>
                    )}
                    <button onClick={handleDelete} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setSelectedTask(null)} className="w-6 h-6 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors shrink-0">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Save Toast */}
                <AnimatePresence>
                    {saveToast && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="absolute top-1 right-14 z-50 text-[10px] font-medium text-accent-base bg-accent-base/10 border border-accent-base/20 rounded-md px-2.5 py-1 flex items-center gap-1.5"
                        >
                            <CheckCircle2 className="w-3 h-3" />
                            {saveToast}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Metadata row: status, priority, overdue, deps */}
                <div className="flex items-center gap-2 mt-2.5">
                    {/* Status dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenPanelDropdown(openPanelDropdown === 'status' ? null : 'status')}
                            className={cn(
                                "flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-md border bg-transparent cursor-pointer transition-colors",
                                task.status === 'NEW' ? "border-blue-500/30 text-blue-400" :
                                task.status === 'DONE' ? "border-accent-lime/30 text-accent-lime" :
                                task.status === 'IN_PROGRESS' ? "border-accent-base/30 text-accent-base" :
                                task.status === 'FAILED' ? "border-red-500/30 text-red-400" :
                                "border-border/50 text-muted-foreground"
                            )}
                        >
                            {STATUS_LABELS[task.status]}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        <AnimatePresence>
                            {openPanelDropdown === 'status' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenPanelDropdown(null)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[140px] space-y-0.5"
                                    >
                                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                                            <button
                                                key={k}
                                                onClick={() => { handleStatusChange(k as PMTaskStatus); setOpenPanelDropdown(null); }}
                                                className={cn(
                                                    "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors",
                                                    task.status === k
                                                        ? "bg-accent-base/10 text-accent-base"
                                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                )}
                                            >
                                                {v}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* Priority dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setOpenPanelDropdown(openPanelDropdown === 'priority' ? null : 'priority')}
                            className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md border border-border/50 bg-transparent text-muted-foreground cursor-pointer transition-colors"
                        >
                            {PRIORITY_LABELS[task.priority]}
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        <AnimatePresence>
                            {openPanelDropdown === 'priority' && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenPanelDropdown(null)} />
                                    <motion.div
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 4 }}
                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[120px] space-y-0.5"
                                    >
                                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                            <button
                                                key={k}
                                                onClick={() => { updateTask(task.id, { priority: Number(k) as any }); setOpenPanelDropdown(null); }}
                                                className={cn(
                                                    "w-full text-left text-[11px] px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-2",
                                                    task.priority === Number(k)
                                                        ? "bg-accent-base/10 text-accent-base"
                                                        : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                                                )}
                                            >
                                                <span className={cn("w-1.5 h-1.5 rounded-full", PRIORITY_DOTS[Number(k)])} />
                                                {v}
                                            </button>
                                        ))}
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                    {/* Save button (floppy disk) — creates new copy in task-ops */}
                    <button
                        onClick={handleSaveToOps}
                        disabled={assignees.length === 0 && !task.agent_id}
                        title={assignees.length === 0 && !task.agent_id ? 'Assign an agent first' : 'Save as new task-ops copy'}
                        className={cn(
                            "flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border transition-all",
                            assignees.length === 0 && !task.agent_id
                                ? "opacity-30 cursor-not-allowed border-border/30 text-muted-foreground/30"
                                : "border-accent-base/30 text-accent-base hover:bg-accent-base/10 hover:border-accent-base/50 cursor-pointer"
                        )}
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    </button>

                    {/* Sync button — updates existing linked task-ops task */}
                    {linkedTaskId && hasUnsyncedChanges && (
                        <button
                            onClick={handleSyncToOps}
                            title="Sync modifications to linked task-ops task"
                            className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md border border-accent-ocean/30 text-accent-ocean hover:bg-accent-ocean/10 hover:border-accent-ocean/50 cursor-pointer transition-all"
                        >
                            {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        </button>
                    )}

                    {/* Linked badge */}
                    {linkedTaskId && !hasUnsyncedChanges && (
                        <span className="flex items-center gap-1 text-[9px] text-accent-lime/70 bg-accent-lime/5 px-1.5 py-0.5 rounded-md" title="Linked & synced with task-ops">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Linked
                        </span>
                    )}

                    {isOverdue && (
                        <span className="text-[9px] text-red-400 flex items-center gap-0.5">
                            <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                    )}
                    {totalDepCount > 0 && (
                        <button
                            onClick={() => setActiveTab('dependencies')}
                            className="flex items-center gap-1 text-[9px] text-accent-base/70 hover:text-accent-base transition-colors px-1.5 py-0.5 rounded-md bg-accent-base/5 hover:bg-accent-base/10"
                        >
                            <Link2 className="w-2.5 h-2.5" />
                            {totalDepCount} dep{totalDepCount > 1 ? 's' : ''}
                        </button>
                    )}
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex items-center px-3 pt-2 pb-0 border-b border-border/20">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-1 py-1.5 text-[10px] font-medium transition-colors border-b-2 -mb-px",
                            activeTab === tab.id
                                ? "border-accent-base text-foreground"
                                : "border-transparent text-muted-foreground/50 hover:text-muted-foreground"
                        )}
                    >
                        <tab.icon className="w-3 h-3" />
                        {tab.label}
                        {tab.count !== undefined && tab.count > 0 && (
                            <span className="text-[8px] bg-foreground/5 rounded-full w-4 h-4 flex items-center justify-center tabular-nums">{tab.count}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ═══ SINGLE-COLUMN BODY ═══ */}
            <div className="flex-1 overflow-y-auto px-5 py-3 min-h-0">

                {/* ═══ DETAILS TAB ═══ */}
                {activeTab === 'details' && (
                    <div className="flex flex-col gap-2 pt-1">
                        {/* ── ROW 1: Assigned Agents (left) + Dates (right) ── */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* Assigned Agents */}
                            <div className="rounded-lg border border-border/20 px-2.5 py-2 space-y-1 bg-foreground/[0.01]">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <Users className="w-3 h-3" /> Assigned Agents
                                </label>
                                <div className="flex flex-wrap gap-1.5">
                                    {assignees.map((a) => {
                                        const profile = getAgentProfile(a.id);
                                        return (
                                            <div key={a.id}
                                                className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border/30 bg-foreground/2 group transition-colors hover:border-border/60">
                                                <AgentSquareAvatar agentId={a.id} size={20} />
                                                <span className="text-[11px] text-foreground">{profile?.name || a.id}</span>
                                                <button onClick={() => removeAssignee(a.id)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-3 h-3 text-muted-foreground/40 hover:text-red-400" />
                                                </button>
                                            </div>
                                        );
                                    })}
                                    {/* Add assignee button */}
                                    <div className="relative">
                                        <button
                                            onClick={() => setShowAssigneePicker(!showAssigneePicker)}
                                            className="flex items-center gap-1 px-2 py-1 rounded-md border border-dashed border-border/40 text-[10px] text-muted-foreground/40 hover:text-muted-foreground hover:border-border/60 transition-colors"
                                        >
                                            <Plus className="w-3 h-3" />
                                            {assignees.length === 0 ? 'Assign Agent' : 'Add'}
                                        </button>
                                        <AnimatePresence>
                                            {showAssigneePicker && (
                                                <>
                                                    <div className="fixed inset-0 z-40" onClick={() => setShowAssigneePicker(false)} />
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 4 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        exit={{ opacity: 0, y: 4 }}
                                                        className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 min-w-[180px]"
                                                    >
                                                        {availableAgents.length === 0 ? (
                                                            <p className="text-[10px] text-muted-foreground/30 text-center py-2 px-3">All agents assigned</p>
                                                        ) : (
                                                            availableAgents.map((agent) => (
                                                                <button key={agent.id}
                                                                    onClick={() => { addAssignee(agent.id); setShowAssigneePicker(false); }}
                                                                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[11px] text-foreground hover:bg-foreground/5 transition-colors">
                                                                    <AgentSquareAvatar agentId={agent.id} size={20} />
                                                                    <span>{agent.name}</span>
                                                                    <span className="text-[9px] text-muted-foreground/30 ml-auto">{agent.role}</span>
                                                                </button>
                                                            ))
                                                        )}
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </div>
                                {assignees.length > 1 && (
                                    <p className="text-[9px] text-accent-violet/50 flex items-center gap-1">
                                        <Cpu className="w-3 h-3" />
                                        Collaborative mode
                                    </p>
                                )}
                            </div>

                            {/* Start Date + Due Date + Recurring Presets + Recurrence Input */}
                            <div className="flex flex-col gap-1">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Start Date</label>
                                        <div className="flex items-center gap-1">
                                            <DatePicker
                                                value={task.start_date || null}
                                                onChange={(date) => updateTask(task.id, { start_date: date })}
                                                placeholder="Set start"
                                            />
                                            <TimeInput
                                                dateValue={task.start_date || null}
                                                onCommit={(iso) => updateTask(task.id, { start_date: iso })}
                                                placeholder="00:00"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Due Date</label>
                                        <div className="flex items-center gap-1">
                                            <DatePicker
                                                value={task.due_date || null}
                                                onChange={(date) => updateTask(task.id, { due_date: date })}
                                                placeholder="Set due"
                                                isError={!!isOverdue}
                                            />
                                            <TimeInput
                                                dateValue={task.due_date || null}
                                                onCommit={(iso) => updateTask(task.id, { due_date: iso })}
                                                placeholder="23:59"
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Recurring row: input left, preset pills right */}
                                <div className="grid grid-cols-2 gap-2">
                                    {/* Left: Recurrence input */}
                                    <div className="flex items-center gap-1.5">
                                        <Repeat className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                        <span className="text-[9px] text-muted-foreground/40 shrink-0">Every</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={cf.recurrence_days || ''}
                                            onChange={(e) => {
                                                const val = parseInt(e.target.value);
                                                updateCustomFields({ recurrence_days: isNaN(val) || val <= 0 ? null : val });
                                            }}
                                            placeholder="—"
                                            className="w-10 text-center text-[10px] h-6 rounded-md border border-border bg-card px-1 outline-none focus:border-accent-base/50 transition-colors text-foreground placeholder:text-muted-foreground/20 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                        <span className="text-[9px] text-muted-foreground/40 shrink-0">d</span>
                                        {/* Recurrence mode buttons: Start-to-Start vs End-to-Start */}
                                        {cf.recurrence_days && cf.recurrence_days > 0 && (
                                            <div className="flex items-center gap-0.5 ml-0.5">
                                                <button
                                                    onClick={() => updateCustomFields({ recurrence_mode: 'start_to_start' })}
                                                    className={cn(
                                                        "text-[7px] px-1 py-0.5 rounded border transition-all font-semibold leading-none whitespace-nowrap",
                                                        (cf.recurrence_mode === 'start_to_start')
                                                            ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-400"
                                                            : "border-border/30 bg-foreground/[0.02] text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-border/50"
                                                    )}
                                                    title="Start-to-Start: New instance starts every N days regardless of completion (overlapping)"
                                                >
                                                    S→S
                                                </button>
                                                <button
                                                    onClick={() => updateCustomFields({ recurrence_mode: 'end_to_start' })}
                                                    className={cn(
                                                        "text-[7px] px-1 py-0.5 rounded border transition-all font-semibold leading-none whitespace-nowrap",
                                                        (!cf.recurrence_mode || cf.recurrence_mode === 'end_to_start')
                                                            ? "border-accent-base/50 bg-accent-base/15 text-accent-base"
                                                            : "border-border/30 bg-foreground/[0.02] text-muted-foreground/30 hover:text-muted-foreground/60 hover:border-border/50"
                                                    )}
                                                    title="End-to-Start: Next instance starts after previous one ends (sequential)"
                                                >
                                                    E→S
                                                </button>
                                            </div>
                                        )}
                                        {cf.recurrence_days && cf.recurrence_days > 0 && (
                                            <button
                                                onClick={() => updateCustomFields({ recurrence_days: null, recurrence_mode: null })}
                                                className="text-muted-foreground/30 hover:text-red-400 transition-colors"
                                                title="Clear recurrence"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {/* Right: Preset pills (evenly spaced) */}
                                    <div className="grid grid-cols-6 gap-1">
                                        {[
                                            { label: 'D', days: 1 },
                                            { label: '2D', days: 2 },
                                            { label: '3D', days: 3 },
                                            { label: 'W', days: 7 },
                                            { label: '2W', days: 14 },
                                            { label: '1M', days: 30 },
                                        ].map((preset) => (
                                            <button
                                                key={preset.label}
                                                onClick={() => updateCustomFields({ recurrence_days: preset.days })}
                                                className={cn(
                                                    "text-[8px] py-0.5 rounded border transition-colors font-medium text-center",
                                                    cf.recurrence_days === preset.days
                                                        ? "border-accent-base/40 bg-accent-base/10 text-accent-base"
                                                        : "border-border/30 bg-foreground/[0.02] text-muted-foreground/40 hover:text-muted-foreground/70 hover:border-border/50"
                                                )}
                                            >
                                                {preset.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── ROW 2: Instruction (full width, no icon) ── */}
                        <div className="space-y-0.5">
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                                Instruction
                            </label>
                            <Textarea
                                value={task.description || ''}
                                onChange={(e) => updateTask(task.id, { description: e.target.value })}
                                placeholder="Describe what the agent should do..."
                                className="text-[11px] rounded-lg border-border bg-card resize-none"
                                style={{ minHeight: 56, maxHeight: 120, overflowY: 'auto' }}
                            />
                        </div>

                        {/* ── ROW 3: Execution Plan + Auto-Generate (full width) ── */}
                        <div className="rounded-lg border border-border/20 p-2.5 space-y-1.5 bg-foreground/[0.01] flex-1" style={{ minHeight: 100 }}>
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                    <FileText className="w-3 h-3" /> Execution Plan
                                    {executionPlan.length > 0 && (
                                        <span className="text-[8px] bg-foreground/5 rounded-full w-4 h-4 flex items-center justify-center tabular-nums">{executionPlan.length}</span>
                                    )}
                                </label>
                                {/* Auto-Generate Button (inline) */}
                                <button
                                    onClick={handleAutoGenerate}
                                    disabled={!task.description?.trim() || isGeneratingSteps}
                                    className={cn(
                                        "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-all border",
                                        task.description?.trim() && !isGeneratingSteps
                                            ? "border-accent-base/30 text-accent-base bg-accent-base/5 hover:bg-accent-base/10 cursor-pointer"
                                            : "border-border/20 text-muted-foreground/25 bg-foreground/[0.01] cursor-not-allowed"
                                    )}
                                >
                                    {isGeneratingSteps ? (
                                        <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                                    ) : (
                                        'Auto-Generate Steps'
                                    )}
                                </button>
                            </div>
                            {/* Scrollable step list */}
                            <div style={{ maxHeight: 200, overflowY: 'auto' }} className="-mx-0.5 px-0.5">
                                {executionPlan.length > 0 && (
                                    <Reorder.Group
                                        axis="y"
                                        values={executionPlan}
                                        onReorder={reorderExecutionPlan}
                                        className="space-y-1"
                                    >
                                        {executionPlan.map((step, idx) => (
                                            <Reorder.Item key={step.id} value={step}>
                                                <div className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-foreground/2 border border-border/20 group hover:border-border/40 transition-colors">
                                                    <GripVertical className="w-3 h-3 text-muted-foreground/20 mt-0.5 cursor-grab shrink-0" />
                                                    <span className="text-[10px] text-muted-foreground/30 font-mono mt-0.5 shrink-0">{idx + 1}.</span>
                                                    <span className="text-[11px] text-foreground flex-1 leading-relaxed">{step.text}</span>
                                                    <button onClick={() => removeExecutionStep(step.id)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity mt-0.5 shrink-0">
                                                        <X className="w-3 h-3 text-muted-foreground/30 hover:text-red-400" />
                                                    </button>
                                                </div>
                                            </Reorder.Item>
                                        ))}
                                    </Reorder.Group>
                                )}
                            </div>
                            <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-dashed border-border/20">
                                <input
                                    value={newStepText}
                                    onChange={(e) => setNewStepText(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') addExecutionStep(); }}
                                    placeholder="Add a step..."
                                    className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/20"
                                />
                                {newStepText.trim() && (
                                    <button onClick={addExecutionStep} className="text-accent-base hover:text-accent-base/80 transition-colors">
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* ── ROW 4: Progress (full width) ── */}
                        <div className="space-y-1">
                            <div className="flex items-center justify-between">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Progress</label>
                                <div className="flex items-center gap-2">
                                    {totalTrackedMinutes > 0 && (
                                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/40">
                                            <Timer className="w-3 h-3 text-accent-base" />
                                            {totalTrackedDisplay}
                                        </span>
                                    )}
                                    <span className="text-[11px] text-muted-foreground/50 tabular-nums font-medium">{task.progress}%</span>
                                </div>
                            </div>
                            <input
                                type="range" min={0} max={100} step={5}
                                value={task.progress}
                                onChange={(e) => updateTask(task.id, { progress: parseInt(e.target.value) })}
                                className="w-full h-1.5 rounded-full appearance-none bg-foreground/8 accent-accent-base cursor-pointer"
                            />
                        </div>

                        {/* ── ROW 5: Goals & Constraints (2 columns) ── */}
                        <div className="rounded-lg border border-border/20 bg-foreground/[0.01] grid grid-cols-2 flex-1">
                            {/* Goals */}
                            <div className="px-2.5 py-2 space-y-1 relative border-r border-border/15" style={{ minHeight: 80 }}>
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                <Target className="w-3 h-3" /> Goals
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {goals.map((g) => (
                                    <span key={g.id}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border/30 bg-foreground/2 group">
                                        <span style={{ color: TYPE_COLORS[g.type] }}>{TYPE_ICONS[g.type]}</span>
                                        <span className="text-foreground">{g.label}</span>
                                        <button onClick={() => removeGoal(g.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="w-2.5 h-2.5 text-muted-foreground/30 hover:text-red-400" />
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => { setShowGoalPicker(!showGoalPicker); setShowConstraintPicker(false); }}
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Goal
                                </button>
                            </div>
                            {showGoalPicker && (
                                <PresetPopover
                                    title="Goal Presets"
                                    presets={goalPresets}
                                    onAdd={(label, type) => addGoal(label, type)}
                                    onDelete={removeGoalPreset}
                                    onUpdate={updateGoalPreset}
                                    onAddNewPreset={(label, type) => addGoalPreset(type as PresetType, label)}
                                    onClose={() => setShowGoalPicker(false)}
                                />
                            )}
                            </div>
                            {/* Constraints */}
                            <div className="px-2.5 py-2 space-y-1 relative" style={{ minHeight: 80 }}>
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                                <Shield className="w-3 h-3" /> Constraints
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {constraints.map((c) => (
                                    <span key={c.id}
                                        className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border/30 bg-foreground/2 group">
                                        <span style={{ color: TYPE_COLORS[c.type] }}>{TYPE_ICONS[c.type]}</span>
                                        <span className="text-foreground">{c.label}</span>
                                        <button onClick={() => removeConstraint(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <X className="w-2.5 h-2.5 text-muted-foreground/30 hover:text-red-400" />
                                        </button>
                                    </span>
                                ))}
                                <button
                                    onClick={() => { setShowConstraintPicker(!showConstraintPicker); setShowGoalPicker(false); }}
                                    className="flex items-center gap-1 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors"
                                >
                                    <Plus className="w-3 h-3" /> Add Constraint
                                </button>
                            </div>
                            {showConstraintPicker && (
                                <PresetPopover
                                    title="Constraint Presets"
                                    presets={constraintPresets}
                                    onAdd={(label, type) => addConstraint(label, type)}
                                    onDelete={removeConstraintPreset}
                                    onUpdate={updateConstraintPreset}
                                    onAddNewPreset={(label, type) => addConstraintPreset(type as PresetType, label)}
                                    onClose={() => setShowConstraintPicker(false)}
                                />
                            )}
                            </div>
                        </div>

                        {/* ── ROW 6: System Prompt (full width, no icon) ── */}
                        <div className="space-y-0.5">
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                                System Prompt
                                <span className="text-[8px] text-muted-foreground/20 font-normal normal-case ml-1">(optional)</span>
                            </label>
                            <Textarea
                                value={systemPrompt}
                                onChange={(e) => updateCustomFields({ system_prompt: e.target.value })}
                                placeholder="Inject additional instructions for the agent..."
                                className="text-[11px] rounded-lg border-border bg-card resize-none"
                                style={{ minHeight: 56, maxHeight: 120, overflowY: 'auto' }}
                            />
                        </div>

                        {/* ── ROW 7: Tags ── */}
                        <div className="space-y-1">
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Tags</label>
                            <div className="flex flex-wrap gap-1">
                                {(task.tags || []).map((tag: string) => (
                                    <span key={tag} className="flex items-center gap-1 text-[10px] bg-foreground/5 text-muted-foreground/70 rounded px-2 py-0.5 group/tag">
                                        <Tag className="w-2.5 h-2.5" />
                                        {tag}
                                        <button onClick={() => handleRemoveTag(tag)} className="opacity-0 group-hover/tag:opacity-100 transition-opacity">
                                            <X className="w-2.5 h-2.5 hover:text-red-400" />
                                        </button>
                                    </span>
                                ))}
                                <input
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTag(); }}
                                    placeholder="+ add tag"
                                    className="text-[10px] bg-transparent border-none outline-none text-muted-foreground/30 placeholder:text-muted-foreground/20 w-16"
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ SUBTASKS TAB ═══ */}
                {activeTab === 'subtasks' && (
                    <>
                        {subtasks.length > 0 && (
                            <div className="flex items-center gap-2 mb-2">
                                <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-accent-lime/60 transition-all"
                                        style={{ width: `${(subtasks.filter((s) => s.status === 'DONE').length / subtasks.length) * 100}%` }}
                                    />
                                </div>
                                <span className="text-[10px] text-muted-foreground/50 tabular-nums">
                                    {subtasks.filter((s) => s.status === 'DONE').length}/{subtasks.length}
                                </span>
                            </div>
                        )}

                        <div className="space-y-0.5">
                            {subtasks.map((sub) => (
                                <div
                                    key={sub.id}
                                    className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-foreground/3 transition-colors group"
                                >
                                    <button
                                        onClick={() => updateTask(sub.id, { status: sub.status === 'DONE' ? 'PENDING' : 'DONE', progress: sub.status === 'DONE' ? 0 : 100 })}
                                        className={cn(
                                            "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                            sub.status === 'DONE'
                                                ? "bg-accent-lime border-accent-lime"
                                                : "border-border/50 hover:border-accent-lime"
                                        )}
                                    >
                                        {sub.status === 'DONE' && <CheckCircle2 className="w-3 h-3 text-background" />}
                                    </button>
                                    <span
                                        onClick={() => setSelectedTask(sub.id)}
                                        className={cn(
                                            "flex-1 text-[11px] cursor-pointer hover:text-accent-base transition-colors truncate",
                                            sub.status === 'DONE' ? "line-through text-muted-foreground/40" : "text-foreground"
                                        )}
                                    >
                                        {sub.title}
                                    </span>
                                    {sub.agent_id && (
                                        <span className="text-[9px] text-muted-foreground/30 truncate max-w-[50px]">
                                            {getAgentName(sub.agent_id)}
                                        </span>
                                    )}
                                    <button
                                        onClick={() => deleteTask(sub.id)}
                                        className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {/* Add subtask */}
                        {showAddSubtask ? (
                            <div className="flex items-center gap-2 mt-1">
                                <input
                                    autoFocus
                                    value={newSubtaskTitle}
                                    onChange={(e) => setNewSubtaskTitle(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleAddSubtask();
                                        if (e.key === 'Escape') { setShowAddSubtask(false); setNewSubtaskTitle(""); }
                                    }}
                                    onBlur={() => { if (!newSubtaskTitle.trim()) setShowAddSubtask(false); }}
                                    placeholder="Subtask name..."
                                    className="flex-1 text-[11px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                />
                            </div>
                        ) : (
                            <button
                                onClick={() => setShowAddSubtask(true)}
                                className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors mt-1"
                            >
                                <Plus className="w-3 h-3" /> Add subtask
                            </button>
                        )}
                    </>
                )}

                {/* ═══ DEPENDENCIES TAB (Two-Column) ═══ */}
                {activeTab === 'dependencies' && (
                    <>
                        {totalDepCount > 0 && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-foreground/3 mb-3">
                                <Link2 className="w-3.5 h-3.5 text-accent-base" />
                                <span className="text-[12px] text-foreground font-semibold">{totalDepCount} dependenc{totalDepCount === 1 ? 'y' : 'ies'}</span>
                            </div>
                        )}



                        <div className="grid grid-cols-2 gap-4">
                            {/* Predecessors Column */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">
                                    Predecessors
                                </label>
                                <p className="text-[9px] text-muted-foreground/25 -mt-0.5">Must finish before this task</p>

                                {taskDeps.predecessors.map((dep) => {
                                    const predTask = tasks.find((t) => t.id === dep.predecessor_id);
                                    return renderDepItem(dep, predTask);
                                })}

                                {addingDepType === 'predecessor' ? (
                                    renderDepSearch('predecessor')
                                ) : (
                                    <button onClick={() => { setAddingDepType('predecessor'); setDepSearchQuery(""); }}
                                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                        <Plus className="w-3 h-3" /> Add Predecessor
                                    </button>
                                )}
                            </div>

                            {/* Successors Column */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Successors</label>
                                <p className="text-[9px] text-muted-foreground/25 -mt-0.5">Should begin after this task</p>

                                {taskDeps.successors.map((dep) => {
                                    const succTask = tasks.find((t) => t.id === dep.successor_id);
                                    return renderDepItem(dep, succTask);
                                })}

                                {addingDepType === 'successor' ? (
                                    renderDepSearch('successor')
                                ) : (
                                    <button onClick={() => { setAddingDepType('successor'); setDepSearchQuery(""); }}
                                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground/30 hover:text-muted-foreground transition-colors">
                                        <Plus className="w-3 h-3" /> Add Successor
                                    </button>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* ═══ APPROVALS TAB (Dropdown) ═══ */}
                {activeTab === 'approvals' && (
                    <>
                        <div className="space-y-2">
                            <label className="text-[10px] text-muted-foreground/40 font-semibold uppercase tracking-wider">Request Approval</label>
                            <div className="relative">
                                <button
                                    onClick={() => setShowApprovalPicker(!showApprovalPicker)}
                                    className="w-full flex items-center gap-2 h-8 text-[11px] px-3 rounded-md bg-card border border-border text-muted-foreground/50 hover:border-border/80 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                    Select an approver...
                                    <ChevronDown className="w-3 h-3 ml-auto opacity-50" />
                                </button>
                                <AnimatePresence>
                                    {showApprovalPicker && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setShowApprovalPicker(false)} />
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: 4 }}
                                                className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl p-1 max-h-64 overflow-y-auto"
                                            >
                                                {/* User option */}
                                                <button
                                                    onClick={() => requestApproval('You', 'human')}
                                                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                                                >
                                                    <div className="w-6 h-6 rounded-full bg-accent-ocean/10 flex items-center justify-center shrink-0">
                                                        <User className="w-3.5 h-3.5 text-accent-ocean" />
                                                    </div>
                                                    <div className="flex-1 text-left">
                                                        <p className="font-medium">You</p>
                                                        <p className="text-[9px] text-muted-foreground/40">Human Approval</p>
                                                    </div>
                                                </button>
                                                <div className="h-px bg-border/30 my-1" />
                                                {/* Agent options */}
                                                {AGENT_ROSTER.map((agent) => (
                                                    <button
                                                        key={agent.id}
                                                        onClick={() => requestApproval(agent.name, 'agent')}
                                                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[11px] text-foreground hover:bg-foreground/5 transition-colors"
                                                    >
                                                        <AgentSquareAvatar agentId={agent.id} size={24} />
                                                        <div className="flex-1 text-left">
                                                            <p className="font-medium">{agent.name}</p>
                                                            <p className="text-[9px] text-muted-foreground/40">{agent.role}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        <div className="space-y-1.5 mt-3">
                            {approvals.length === 0 ? (
                                <p className="text-[11px] text-muted-foreground/25 text-center py-4">No approvals requested yet</p>
                            ) : (
                                approvals.map((appr) => (
                                    <div key={appr.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-foreground/2 border border-border/20">
                                        <div className={cn("w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                                            appr.approver_type === 'agent' ? "bg-accent-violet/10" : "bg-accent-ocean/10")}>
                                            {appr.approver_type === 'agent' ? <Bot className="w-3.5 h-3.5 text-accent-violet" /> : <User className="w-3.5 h-3.5 text-accent-ocean" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-medium text-foreground">{appr.approver_name}</p>
                                            <p className="text-[9px] text-muted-foreground/40">
                                                {appr.status === 'pending' ? 'Awaiting response' : appr.status === 'approved' ? 'Approved' : 'Rejected'}
                                                {appr.resolved_at && ` · ${new Date(appr.resolved_at).toLocaleDateString()}`}
                                            </p>
                                        </div>
                                        {appr.status === 'pending' ? (
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => resolveApproval(appr.id, 'approved')}
                                                    className="w-6 h-6 rounded-full bg-accent-lime/10 flex items-center justify-center text-accent-lime hover:bg-accent-lime/20 transition-colors">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button onClick={() => resolveApproval(appr.id, 'rejected')}
                                                    className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center text-red-400 hover:bg-red-500/20 transition-colors">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className={cn("text-[9px] font-semibold px-2 py-0.5 rounded-full",
                                                appr.status === 'approved' ? "bg-accent-lime/10 text-accent-lime" : "bg-red-500/10 text-red-400")}>
                                                {appr.status === 'approved' ? '✓ Approved' : '✕ Rejected'}
                                            </span>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </>
                )}

                {/* ═══ ACTIVITY TAB ═══ */}
                {activeTab === 'activity' && (
                    <div className="flex flex-col h-full">
                        {/* Activity timeline */}
                        <div className="flex-1 space-y-3 pb-3">
                            {activities.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-10 gap-2">
                                    <MessageSquare className="w-5 h-5 text-muted-foreground/10" />
                                    <p className="text-[10px] text-muted-foreground/20">No activity yet</p>
                                </div>
                            ) : (
                                activities.slice(0, 50).map((act) => (
                                    <div key={act.id} className="flex gap-2">
                                        <div className="w-5 h-5 rounded-full bg-foreground/5 flex items-center justify-center shrink-0 mt-0.5">
                                            {act.source === 'agent' ? <Bot className="w-2.5 h-2.5 text-accent-violet" /> :
                                             act.source === 'system' ? <Clock className="w-2.5 h-2.5 text-muted-foreground" /> :
                                             <User className="w-2.5 h-2.5 text-accent-ocean" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-baseline gap-1.5">
                                                <span className="text-[10px] font-medium text-foreground">{act.source_name}</span>
                                                <span className="text-[8px] text-muted-foreground/25">
                                                    {new Date(act.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            {act.action_type === 'comment' ? (
                                                <div className="mt-1 p-2 rounded-md bg-foreground/3 border border-border/20">
                                                    <p className="text-[11px] text-foreground/80 leading-relaxed">{act.content}</p>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground/50 leading-relaxed">{act.content}</p>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Comment input (sticky at bottom of activity tab) */}
                        <div className="border-t border-border/30 pt-2.5 mt-auto">
                            <div className="flex items-center gap-2">
                                <Input
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleComment(); }}
                                    placeholder="Add a comment..."
                                    className="flex-1 h-8 text-[11px] rounded-lg border-border bg-card"
                                />
                                <Button
                                    size="sm"
                                    onClick={handleComment}
                                    disabled={!comment.trim()}
                                    className="w-8 h-8 p-0 rounded-lg hover:opacity-90 transition-opacity"
                                    style={{ background: 'var(--accent-base)', color: 'var(--text-on-accent, #fff)' }}
                                >
                                    <Send className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
