"use client";

import { usePMStore } from "@/store/usePMStore";
import { STATUS_LABELS, PRIORITY_LABELS, PRIORITY_DOTS } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import {
    BarChart3, TrendingUp, Users, CheckCircle2, Clock, AlertTriangle,
    Bot, Zap, Activity
} from "lucide-react";

const STATUS_CHART_COLORS: Record<string, string> = {
    PENDING: '#71717a',
    IN_PROGRESS: '#FF6D29',
    DONE: '#22c55e',
    FAILED: '#ef4444',
};

const PRIORITY_CHART_COLORS: Record<number, string> = {
    0: '#71717a',
    1: '#2dd4bf',
    2: '#f97316',
    3: '#ef4444',
};

export function ProjectAnalytics() {
    const tasks = usePMStore((s) => s.tasks);
    const agents = usePMStore((s) => s.agents);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const activeFolderId = usePMStore((s) => s.activeFolderId);

    const filtered = useMemo(() => {
        let result = tasks;
        if (activeFolderId) result = result.filter((t) => t.folder_id === activeFolderId);
        else if (activeSpaceId) result = result.filter((t) => t.space_id === activeSpaceId);
        return result;
    }, [tasks, activeSpaceId, activeFolderId]);

    // ── Computed stats ──
    const stats = useMemo(() => {
        const total = filtered.length;
        const completed = filtered.filter((t) => t.status === 'DONE').length;
        const inProgress = filtered.filter((t) => t.status === 'IN_PROGRESS').length;
        const pending = filtered.filter((t) => t.status === 'PENDING').length;
        const failed = filtered.filter((t) => t.status === 'FAILED').length;
        const overdue = filtered.filter((t) => t.due_date && t.status !== 'DONE' && new Date(t.due_date) < new Date()).length;
        const avgProgress = total > 0 ? Math.round(filtered.reduce((s, t) => s + (t.progress || 0), 0) / total) : 0;

        // Status distribution
        const statusDist = [
            { key: 'PENDING', label: 'Backlog', count: pending, color: STATUS_CHART_COLORS.PENDING },
            { key: 'IN_PROGRESS', label: 'In Progress', count: inProgress, color: STATUS_CHART_COLORS.IN_PROGRESS },
            { key: 'DONE', label: 'Completed', count: completed, color: STATUS_CHART_COLORS.DONE },
            { key: 'FAILED', label: 'Failed', count: failed, color: STATUS_CHART_COLORS.FAILED },
        ];

        // Priority distribution
        const priorityDist = [0, 1, 2, 3].map((p) => ({
            key: p,
            label: PRIORITY_LABELS[p],
            count: filtered.filter((t) => t.priority === p).length,
            color: PRIORITY_CHART_COLORS[p],
        }));

        // Agent workload
        const agentMap = new Map<string, number>();
        let unassigned = 0;
        filtered.forEach((t) => {
            if (t.agent_id) {
                agentMap.set(t.agent_id, (agentMap.get(t.agent_id) || 0) + 1);
            } else {
                unassigned++;
            }
        });
        const agentWorkload = agents
            .map((a) => ({ name: a.name, count: agentMap.get(a.id) || 0 }))
            .filter((a) => a.count > 0)
            .sort((a, b) => b.count - a.count);
        if (unassigned > 0) agentWorkload.push({ name: 'Unassigned', count: unassigned });

        // Completion over time (last 7 days)
        const recentDays = 7;
        const completionByDay: { label: string; count: number }[] = [];
        for (let i = recentDays - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toDateString();
            const label = d.toLocaleDateString(undefined, { weekday: 'short' });
            const count = filtered.filter((t) => {
                if (!t.completed_at) return false;
                return new Date(t.completed_at).toDateString() === dateStr;
            }).length;
            completionByDay.push({ label, count });
        }

        return { total, completed, inProgress, pending, failed, overdue, avgProgress, statusDist, priorityDist, agentWorkload, completionByDay };
    }, [filtered, agents]);

    const maxBarCount = Math.max(...stats.completionByDay.map((d) => d.count), 1);
    const maxAgentCount = Math.max(...stats.agentWorkload.map((a) => a.count), 1);

    if (stats.total === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <BarChart3 className="w-8 h-8 text-muted-foreground/15 mx-auto mb-2" />
                    <p className="text-[12px] text-muted-foreground/30">No data to analyze yet</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-4 h-full">
            <div className="flex flex-col gap-4 h-full">
                {/* ── Summary Cards ── */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <SummaryCard icon={CheckCircle2} label="Completed" value={stats.completed} subtext={`of ${stats.total}`} color="text-accent-lime" bgColor="bg-accent-lime/5" />
                    <SummaryCard icon={Clock} label="In Progress" value={stats.inProgress} subtext="active" color="text-accent-base" bgColor="bg-accent-base/5" />
                    <SummaryCard icon={TrendingUp} label="Avg Progress" value={`${stats.avgProgress}%`} subtext="across all" color="text-accent-ocean" bgColor="bg-accent-ocean/5" />
                    <SummaryCard icon={AlertTriangle} label="Overdue" value={stats.overdue} subtext="need attention" color="text-red-400" bgColor="bg-red-500/5" />
                </div>

                {/* ── Main Charts Grid (fills remaining space) ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                    {/* ── Status Distribution (Donut) ── */}
                    <div className="rounded-xl bg-card border border-border/20 p-4 flex flex-col">
                        <h4 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                            <Activity className="w-3.5 h-3.5 text-muted-foreground/40" />
                            Status Distribution
                        </h4>
                        <div className="flex items-center gap-6 flex-1">
                            {/* SVG Donut */}
                            <div className="relative w-28 h-28 shrink-0">
                                <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                    {(() => {
                                        let cumOffset = 0;
                                        return stats.statusDist.map((s) => {
                                            if (s.count === 0) return null;
                                            const pct = (s.count / stats.total) * 100;
                                            const dash = `${pct} ${100 - pct}`;
                                            const offset = cumOffset;
                                            cumOffset += pct;
                                            return (
                                                <circle
                                                    key={s.key}
                                                    cx="18" cy="18" r="15.5"
                                                    fill="none"
                                                    stroke={s.color}
                                                    strokeWidth="3"
                                                    strokeDasharray={dash}
                                                    strokeDashoffset={-offset}
                                                    className="transition-all duration-500"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                    <span className="text-lg font-bold text-foreground tabular-nums">{stats.total}</span>
                                    <span className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Tasks</span>
                                </div>
                            </div>
                            {/* Legend */}
                            <div className="flex-1 space-y-1.5">
                                {stats.statusDist.map((s) => (
                                    <div key={s.key} className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
                                        <span className="text-[10px] text-muted-foreground/60 flex-1">{s.label}</span>
                                        <span className="text-[11px] font-semibold text-foreground tabular-nums">{s.count}</span>
                                        <span className="text-[9px] text-muted-foreground/30 tabular-nums w-8 text-right">
                                            {stats.total > 0 ? Math.round((s.count / stats.total) * 100) : 0}%
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* ── Priority Distribution (Horizontal Bars) ── */}
                    <div className="rounded-xl bg-card border border-border/20 p-4 flex flex-col">
                        <h4 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                            <BarChart3 className="w-3.5 h-3.5 text-muted-foreground/40" />
                            Priority Breakdown
                        </h4>
                        <div className="space-y-2.5 flex-1 flex flex-col justify-center">
                            {stats.priorityDist.map((p) => (
                                <div key={p.key} className="space-y-0.5">
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                                            {p.label}
                                        </span>
                                        <span className="text-[11px] font-semibold text-foreground tabular-nums">{p.count}</span>
                                    </div>
                                    <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: stats.total > 0 ? `${(p.count / stats.total) * 100}%` : '0%',
                                                backgroundColor: p.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* ── Agent Workload (Horizontal Bars) ── */}
                    <div className="rounded-xl bg-card border border-border/20 p-4 flex flex-col">
                        <h4 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-muted-foreground/40" />
                            Agent Workload
                        </h4>
                        {stats.agentWorkload.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground/25 text-center py-4 flex-1 flex items-center justify-center">No assigned tasks</p>
                        ) : (
                            <div className="space-y-2 flex-1 flex flex-col justify-center">
                                {stats.agentWorkload.map((agent) => (
                                    <div key={agent.name} className="space-y-0.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1.5">
                                                {agent.name === 'Unassigned' 
                                                    ? <Zap className="w-3 h-3 text-muted-foreground/30" />
                                                    : <Bot className="w-3 h-3 text-accent-violet" />
                                                }
                                                {agent.name}
                                            </span>
                                            <span className="text-[11px] font-semibold text-foreground tabular-nums">{agent.count}</span>
                                        </div>
                                        <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-accent-violet transition-all duration-500"
                                                style={{ width: `${(agent.count / maxAgentCount) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* ── Completion Velocity (7-day bar chart) ── */}
                    <div className="rounded-xl bg-card border border-border/20 p-4 flex flex-col">
                        <h4 className="text-[11px] font-semibold text-foreground mb-3 flex items-center gap-1.5">
                            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground/40" />
                            7-Day Velocity
                        </h4>
                        <div className="flex items-end gap-1 flex-1 min-h-[80px]">
                            {stats.completionByDay.map((day, i) => (
                                <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full">
                                    <div className="w-full flex flex-col items-center justify-end flex-1">
                                        {day.count > 0 && (
                                            <span className="text-[8px] text-accent-lime font-semibold tabular-nums mb-0.5">{day.count}</span>
                                        )}
                                        <div
                                            className="w-full rounded-t-sm bg-accent-lime/60 transition-all duration-500 min-h-[2px]"
                                            style={{ height: day.count > 0 ? `${(day.count / maxBarCount) * 100}%` : '2px' }}
                                        />
                                    </div>
                                    <span className="text-[8px] text-muted-foreground/30">{day.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Completion Rate Bar ── */}
                <div className="rounded-xl bg-card border border-border/20 p-4">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-[11px] font-semibold text-foreground">Overall Completion</h4>
                        <span className="text-[12px] font-bold text-accent-lime tabular-nums">
                            {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                        </span>
                    </div>
                    <div className="h-3 rounded-full bg-foreground/5 overflow-hidden flex">
                        {stats.statusDist.map((s) => (
                            s.count > 0 ? (
                                <div
                                    key={s.key}
                                    className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                                    style={{
                                        width: `${(s.count / stats.total) * 100}%`,
                                        backgroundColor: s.color,
                                    }}
                                />
                            ) : null
                        ))}
                    </div>
                    <div className="flex items-center gap-4 mt-2">
                        {stats.statusDist.map((s) => (
                            <span key={s.key} className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                                {s.label}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

function SummaryCard({ icon: Icon, label, value, subtext, color, bgColor }: {
    icon: typeof CheckCircle2;
    label: string;
    value: number | string;
    subtext: string;
    color: string;
    bgColor: string;
}) {
    return (
        <div className={cn("rounded-xl p-3 border border-border/20", bgColor)}>
            <div className="flex items-center gap-2 mb-1.5">
                <Icon className={cn("w-3.5 h-3.5", color)} />
                <span className="text-[10px] text-muted-foreground/50 font-semibold uppercase tracking-wider">{label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-bold text-foreground tabular-nums">{value}</span>
                <span className="text-[10px] text-muted-foreground/30">{subtext}</span>
            </div>
        </div>
    );
}
