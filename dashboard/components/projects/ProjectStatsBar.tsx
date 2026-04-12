"use client";

import { usePMStore } from "@/store/usePMStore";
import { STATUS_LABELS } from "@/lib/pm/types";
import { CheckCircle2, Clock, AlertTriangle, Bot, User, TrendingUp, Circle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

const STATUS_BAR_COLORS: Record<string, string> = {
    DONE: 'bg-accent-lime',
    IN_PROGRESS: 'bg-accent-base',
    PENDING: 'bg-zinc-500',
    FAILED: 'bg-red-500',
};

export function ProjectStatsBar() {
    const tasks = usePMStore((s) => s.tasks);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);

    const stats = useMemo(() => {
        let filtered = tasks;
        if (activeFolderId) {
            filtered = tasks.filter((t) => t.folder_id === activeFolderId);
        } else if (activeSpaceId) {
            // At space level, show aggregate stats for ALL tasks in the space
            filtered = tasks.filter((t) => t.space_id === activeSpaceId);
        }

        const total = filtered.length;
        const completed = filtered.filter((t) => t.status === 'DONE').length;
        const inProgress = filtered.filter((t) => t.status === 'IN_PROGRESS').length;
        const pending = filtered.filter((t) => t.status === 'PENDING').length;
        const failed = filtered.filter((t) => t.status === 'FAILED').length;
        const overdue = filtered.filter((t) => {
            if (!t.due_date || t.status === 'DONE') return false;
            return new Date(t.due_date) < new Date();
        }).length;
        const agentTasks = filtered.filter((t) => t.assignee_type === 'agent' && t.agent_id).length;
        const humanTasks = filtered.filter((t) => t.assignee_type === 'human').length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

        return { total, completed, inProgress, pending, failed, overdue, agentTasks, humanTasks, pct };
    }, [tasks, activeSpaceId, activeFolderId]);

    if (stats.total === 0) return null;

    return (
        <div className="flex items-center gap-3 px-4 py-1.5">
            {/* Progress bar — visual at-a-glance */}
            <div className="flex items-center gap-1 min-w-[140px]">
                <div className="flex-1 h-1.5 rounded-full bg-foreground/5 overflow-hidden flex">
                    {stats.completed > 0 && (
                        <div className="h-full bg-accent-lime transition-all" style={{ width: `${(stats.completed / stats.total) * 100}%` }} />
                    )}
                    {stats.inProgress > 0 && (
                        <div className="h-full bg-accent-base transition-all" style={{ width: `${(stats.inProgress / stats.total) * 100}%` }} />
                    )}
                    {stats.failed > 0 && (
                        <div className="h-full bg-red-500 transition-all" style={{ width: `${(stats.failed / stats.total) * 100}%` }} />
                    )}
                </div>
                <span className="text-[10px] font-semibold text-foreground tabular-nums w-[32px] text-right">{stats.pct}%</span>
            </div>

            <div className="w-px h-3 bg-border/20" />

            {/* Status counts — icons instead of dots */}
            <div className="flex items-center gap-2 text-[10px]">
                <div className="flex items-center gap-1" title="Completed">
                    <CheckCircle2 className="w-3 h-3 text-accent-lime" />
                    <span className="text-muted-foreground/60">{stats.completed}</span>
                </div>
                <div className="flex items-center gap-1" title="In Progress">
                    <Clock className="w-3 h-3 text-accent-base" />
                    <span className="text-muted-foreground/60">{stats.inProgress}</span>
                </div>
                <div className="flex items-center gap-1" title="Backlog">
                    <Circle className="w-3 h-3 text-zinc-500" />
                    <span className="text-muted-foreground/60">{stats.pending}</span>
                </div>
                {stats.failed > 0 && (
                    <div className="flex items-center gap-1" title="Failed">
                        <XCircle className="w-3 h-3 text-red-500" />
                        <span className="text-muted-foreground/60">{stats.failed}</span>
                    </div>
                )}
            </div>

            <div className="w-px h-3 bg-border/20" />

            {/* Overdue */}
            {stats.overdue > 0 && (
                <>
                    <div className="flex items-center gap-1 text-[10px]">
                        <AlertTriangle className="w-3 h-3 text-red-400" />
                        <span className="font-semibold text-red-400">{stats.overdue}</span>
                        <span className="text-red-400/60">overdue</span>
                    </div>
                    <div className="w-px h-3 bg-border/20" />
                </>
            )}

            {/* Agent / Human split */}
            <div className="flex items-center gap-2 text-[10px]">
                <div className="flex items-center gap-1">
                    <Bot className="w-3 h-3 text-accent-violet" />
                    <span className="text-muted-foreground/60">{stats.agentTasks}</span>
                </div>
                <div className="flex items-center gap-1">
                    <User className="w-3 h-3 text-accent-ocean" />
                    <span className="text-muted-foreground/60">{stats.humanTasks}</span>
                </div>
            </div>

            <div className="ml-auto text-[9px] text-muted-foreground/25 tabular-nums">
                {stats.total} tasks
            </div>
        </div>
    );
}
