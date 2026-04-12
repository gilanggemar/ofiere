"use client";

import { usePMStore } from "@/store/usePMStore";
import { STATUS_LABELS, PRIORITY_DOTS, PRIORITY_LABELS } from "@/lib/pm/types";
import type { PMTask, PMTaskStatus } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import {
    Bot, User, Zap, Plus, AlertTriangle, Settings2,
    CheckCircle2, Clock, Circle, XCircle, ArrowUp, ArrowDown, Minus, Flame
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";

const COLUMNS: PMTaskStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE', 'FAILED'];

const COLUMN_ICONS: Record<string, { icon: typeof Circle; color: string }> = {
    PENDING: { icon: Circle, color: 'text-zinc-500' },
    IN_PROGRESS: { icon: Clock, color: 'text-accent-base' },
    DONE: { icon: CheckCircle2, color: 'text-accent-lime' },
    FAILED: { icon: XCircle, color: 'text-red-500' },
};

const PRIORITY_ICONS: Record<number, { icon: typeof Minus; color: string }> = {
    0: { icon: Minus, color: 'text-zinc-500' },
    1: { icon: ArrowUp, color: 'text-teal-400' },
    2: { icon: ArrowUp, color: 'text-orange-500' },
    3: { icon: Flame, color: 'text-red-500' },
};

const DEFAULT_WIP_LIMITS: Record<string, number> = {
    PENDING: 0,
    IN_PROGRESS: 5,
    DONE: 0,
    FAILED: 0,
};

export function ProjectsBoard() {
    const allTasks = usePMStore((s) => s.tasks);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);
    const agents = usePMStore((s) => s.agents);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const updateTask = usePMStore((s) => s.updateTask);
    const createTask = usePMStore((s) => s.createTask);

    const tasks = useMemo(() => {
        let filtered = allTasks.filter((t) => !t.parent_task_id);
        if (activeFolderId) {
            filtered = filtered.filter((t) => t.folder_id === activeFolderId);
        } else if (activeSpaceId) {
            filtered = filtered.filter((t) => t.space_id === activeSpaceId);
        }
        return filtered;
    }, [allTasks, activeSpaceId, activeFolderId]);

    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [wipLimits, setWipLimits] = useState(DEFAULT_WIP_LIMITS);
    const [showWipSettings, setShowWipSettings] = useState(false);
    const [quickAddCol, setQuickAddCol] = useState<string | null>(null);
    const [quickAddTitle, setQuickAddTitle] = useState('');

    const getAgentName = (agentId: string | null) => {
        if (!agentId) return null;
        return agents.find((a) => a.id === agentId)?.name || agentId;
    };

    const handleDrop = (taskId: string, newStatus: PMTaskStatus) => {
        updateTask(taskId, { status: newStatus });
        setDragOverCol(null);
    };

    const handleQuickAdd = async (status: PMTaskStatus) => {
        if (!quickAddTitle.trim()) { setQuickAddCol(null); return; }
        await createTask({ title: quickAddTitle.trim(), status });
        setQuickAddTitle('');
        setQuickAddCol(null);
    };

    return (
        <div className="flex-1 overflow-hidden p-4">
            <div className="flex gap-3 h-full">
                {COLUMNS.map((col) => {
                    const colTasks = tasks.filter((t) => t.status === col);
                    const wipLimit = wipLimits[col];
                    const isOverWip = wipLimit > 0 && colTasks.length > wipLimit;
                    const isDropTarget = dragOverCol === col;
                    const ColIcon = COLUMN_ICONS[col].icon;

                    return (
                        <div
                            key={col}
                            className={cn(
                                "flex-1 flex flex-col rounded-xl transition-colors",
                                isDropTarget ? "bg-accent-base/5 ring-1 ring-accent-base/20" : "bg-foreground/2"
                            )}
                            onDragOver={(e) => { e.preventDefault(); setDragOverCol(col); }}
                            onDragLeave={() => setDragOverCol(null)}
                            onDrop={(e) => {
                                const taskId = e.dataTransfer.getData('taskId');
                                if (taskId) handleDrop(taskId, col);
                            }}
                        >
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-3 py-2.5">
                                <div className="flex items-center gap-2">
                                    <ColIcon className={cn("w-3.5 h-3.5", COLUMN_ICONS[col].color)} />
                                    <span className="text-[11px] font-semibold text-foreground">{STATUS_LABELS[col]}</span>
                                    <span className={cn(
                                        "text-[10px] tabular-nums w-5 h-5 rounded-md flex items-center justify-center font-medium",
                                        isOverWip
                                            ? "bg-red-500/15 text-red-400"
                                            : "bg-foreground/5 text-muted-foreground/40"
                                    )}>
                                        {colTasks.length}
                                    </span>
                                    {wipLimit > 0 && (
                                        <span className="text-[9px] text-muted-foreground/30">/ {wipLimit}</span>
                                    )}
                                    {isOverWip && (
                                        <AlertTriangle className="w-3 h-3 text-red-400" />
                                    )}
                                </div>
                                <button
                                    onClick={() => setQuickAddCol(quickAddCol === col ? null : col)}
                                    className="w-5 h-5 rounded-md flex items-center justify-center text-muted-foreground/30 hover:text-foreground hover:bg-foreground/5 transition-colors"
                                >
                                    <Plus className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Quick add */}
                            <AnimatePresence>
                                {quickAddCol === col && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="overflow-hidden px-2"
                                    >
                                        <div className="rounded-lg bg-card border border-border/50 p-2 mb-1.5">
                                            <input
                                                autoFocus
                                                value={quickAddTitle}
                                                onChange={(e) => setQuickAddTitle(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleQuickAdd(col);
                                                    if (e.key === 'Escape') { setQuickAddCol(null); setQuickAddTitle(''); }
                                                }}
                                                placeholder="Task name..."
                                                className="w-full text-[12px] bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/30"
                                            />
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Cards */}
                            <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1.5 scrollbar-hide">
                                {colTasks.map((task) => {
                                    const isOverdue = task.due_date && task.status !== 'DONE' && new Date(task.due_date) < new Date();
                                    const AssigneeIcon = task.assignee_type === 'agent' ? Bot : task.assignee_type === 'human' ? User : Zap;
                                    const subtasks = allTasks.filter((t) => t.parent_task_id === task.id);
                                    const completedSubs = subtasks.filter((s) => s.status === 'DONE').length;
                                    const PriorityIcon = PRIORITY_ICONS[task.priority]?.icon || Minus;
                                    const priorityColor = PRIORITY_ICONS[task.priority]?.color || 'text-zinc-500';

                                    return (
                                        <motion.div
                                            key={task.id}
                                            layout
                                            draggable
                                            onDragStart={(e: any) => e.dataTransfer?.setData('taskId', task.id)}
                                            onClick={() => setSelectedTask(task.id)}
                                            className="rounded-lg bg-card border border-border/30 p-2.5 cursor-pointer hover:border-border/60 transition-all group"
                                            whileHover={{ y: -1 }}
                                        >
                                            {/* Tags */}
                                            {task.tags && task.tags.length > 0 && (
                                                <div className="flex items-center gap-1 mb-1.5 overflow-hidden">
                                                    {task.tags.slice(0, 3).map((tag: string) => (
                                                        <span key={tag} className="text-[8px] bg-accent-base/8 text-accent-base/70 rounded px-1.5 py-0.5 truncate">
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            <p className="text-[12px] font-medium text-foreground leading-snug mb-2">{task.title}</p>

                                            {/* Subtask progress */}
                                            {subtasks.length > 0 && (
                                                <div className="flex items-center gap-1.5 mb-2">
                                                    <div className="flex-1 h-1 rounded-full bg-foreground/5 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-accent-lime/60 transition-all"
                                                            style={{ width: `${(completedSubs / subtasks.length) * 100}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-[8px] text-muted-foreground/40 tabular-nums">{completedSubs}/{subtasks.length}</span>
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    {/* Priority icon */}
                                                    <span title={PRIORITY_LABELS[task.priority]}>
                                                        <PriorityIcon className={cn("w-3 h-3", priorityColor)} />
                                                    </span>
                                                    {/* Assignee */}
                                                    <div className="flex items-center gap-1">
                                                        <AssigneeIcon className={cn("w-3 h-3",
                                                            task.assignee_type === 'agent' ? "text-accent-violet" : "text-accent-ocean"
                                                        )} />
                                                        <span className="text-[9px] text-muted-foreground/50 truncate max-w-[70px]">
                                                            {getAgentName(task.agent_id) || 'None'}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Due date */}
                                                {task.due_date && (
                                                    <span className={cn("text-[9px]", isOverdue ? "text-red-400 font-medium" : "text-muted-foreground/40")}>
                                                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                                    </span>
                                                )}
                                            </div>

                                            {/* Progress bar */}
                                            {task.progress > 0 && subtasks.length === 0 && (
                                                <div className="mt-2 h-1 rounded-full bg-foreground/5 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-accent-base/50 transition-all"
                                                        style={{ width: `${task.progress}%` }}
                                                    />
                                                </div>
                                            )}
                                        </motion.div>
                                    );
                                })}

                                {colTasks.length === 0 && (
                                    <div className="flex items-center justify-center py-8 text-[10px] text-muted-foreground/20">
                                        Drop tasks here
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
