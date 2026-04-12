"use client";

import { usePMStore } from "@/store/usePMStore";
import type { PMActivity, PMTask } from "@/lib/pm/types";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/pm/types";
import { cn } from "@/lib/utils";
import {
    Bot, User, Clock, MessageSquare, CheckCircle2, AlertTriangle,
    ArrowRight, Plus, Pencil, Trash2, Zap, Tag, Activity
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const ACTION_ICONS: Record<string, typeof Bot> = {
    status_change: ArrowRight,
    comment: MessageSquare,
    created: Plus,
    updated: Pencil,
    deleted: Trash2,
    completed: CheckCircle2,
    assigned: Bot,
};

const ACTION_COLORS: Record<string, string> = {
    status_change: 'text-accent-base',
    comment: 'text-accent-ocean',
    created: 'text-accent-lime',
    updated: 'text-muted-foreground',
    deleted: 'text-red-400',
    completed: 'text-accent-lime',
    assigned: 'text-accent-violet',
};

const SOURCE_ICONS: Record<string, typeof Bot> = {
    agent: Bot,
    human: User,
    system: Zap,
};

export function ProjectStream() {
    const activities = usePMStore((s) => s.activities);
    const tasks = usePMStore((s) => s.tasks);
    const agents = usePMStore((s) => s.agents);
    const activeSpaceId = usePMStore((s) => s.activeSpaceId);
    const setSelectedTask = usePMStore((s) => s.setSelectedTask);
    const fetchActivities = usePMStore((s) => s.fetchActivities);

    const [filter, setFilter] = useState<'all' | 'comments' | 'changes' | 'agent'>('all');

    useEffect(() => {
        if (activeSpaceId) {
            fetchActivities('space', activeSpaceId);
        }
    }, [activeSpaceId, fetchActivities]);

    const filteredActivities = useMemo(() => {
        let result = activities;
        switch (filter) {
            case 'comments': result = result.filter((a) => a.action_type === 'comment'); break;
            case 'changes': result = result.filter((a) => a.action_type !== 'comment'); break;
            case 'agent': result = result.filter((a) => a.source === 'agent'); break;
        }
        return result;
    }, [activities, filter]);

    // Group activities by day
    const groupedByDay = useMemo(() => {
        const groups: { date: string; label: string; activities: PMActivity[] }[] = [];
        const dayMap = new Map<string, PMActivity[]>();

        filteredActivities.forEach((act) => {
            const dateKey = new Date(act.created_at).toDateString();
            if (!dayMap.has(dateKey)) dayMap.set(dateKey, []);
            dayMap.get(dateKey)!.push(act);
        });

        const today = new Date().toDateString();
        const yesterday = new Date(Date.now() - 86400000).toDateString();

        dayMap.forEach((acts, dateKey) => {
            let label: string;
            if (dateKey === today) label = 'Today';
            else if (dateKey === yesterday) label = 'Yesterday';
            else label = new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

            groups.push({ date: dateKey, label, activities: acts });
        });

        return groups;
    }, [filteredActivities]);

    const getTaskTitle = (entityId: string) => {
        const task = tasks.find((t) => t.id === entityId);
        return task?.title || entityId;
    };

    return (
        <div className="flex-1 overflow-auto">
            {/* Filter bar */}
            <div className="sticky top-0 border-b border-border/20 px-4 py-2 z-10">
                <div className="flex items-center gap-1">
                    {[
                        { id: 'all' as const, label: 'All Activity' },
                        { id: 'comments' as const, label: 'Comments' },
                        { id: 'changes' as const, label: 'Changes' },
                        { id: 'agent' as const, label: 'Agent Activity' },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id)}
                            className={cn(
                                "text-[10px] px-2.5 py-1 rounded-full transition-colors font-medium",
                                filter === f.id
                                    ? "bg-foreground/8 text-foreground"
                                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/3"
                            )}
                        >
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Activity stream */}
            <div className="max-w-2xl mx-auto px-4 py-4">
                {groupedByDay.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-12 h-12 rounded-xl bg-foreground/3 flex items-center justify-center mb-3">
                            <Activity className="w-5 h-5 text-muted-foreground/20" />
                        </div>
                        <p className="text-[12px] text-muted-foreground/30 mb-1">No activity yet</p>
                        <p className="text-[10px] text-muted-foreground/20">Create tasks and make changes to see activity here.</p>
                    </div>
                ) : (
                    groupedByDay.map((group) => (
                        <div key={group.date} className="mb-6">
                            {/* Day header */}
                            <div className="flex items-center gap-2 mb-3">
                                <span className="text-[11px] font-semibold text-foreground">{group.label}</span>
                                <div className="flex-1 h-px bg-border/20" />
                                <span className="text-[9px] text-muted-foreground/30 tabular-nums">{group.activities.length}</span>
                            </div>

                            {/* Activity items */}
                            <div className="space-y-1">
                                {group.activities.map((act) => {
                                    const ActionIcon = ACTION_ICONS[act.action_type] || Clock;
                                    const SourceIcon = SOURCE_ICONS[act.source] || User;
                                    const actionColor = ACTION_COLORS[act.action_type] || 'text-muted-foreground';

                                    return (
                                        <div
                                            key={act.id}
                                            className="flex gap-3 p-2.5 rounded-lg hover:bg-foreground/2 transition-colors group cursor-pointer"
                                            onClick={() => {
                                                if (act.entity_type === 'task') setSelectedTask(act.entity_id);
                                            }}
                                        >
                                            {/* Avatar */}
                                            <div className={cn(
                                                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5",
                                                act.source === 'agent' ? "bg-accent-violet/10" :
                                                act.source === 'system' ? "bg-foreground/5" :
                                                "bg-accent-ocean/10"
                                            )}>
                                                <SourceIcon className={cn("w-3.5 h-3.5",
                                                    act.source === 'agent' ? "text-accent-violet" :
                                                    act.source === 'system' ? "text-muted-foreground/50" :
                                                    "text-accent-ocean"
                                                )} />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                                    <span className="text-[11px] font-semibold text-foreground">{act.source_name}</span>
                                                    <ActionIcon className={cn("w-3 h-3 inline-block", actionColor)} />

                                                    {act.entity_type === 'task' && (
                                                        <span className="text-[11px] text-muted-foreground/60">
                                                            on <span className="text-foreground/80 font-medium">{getTaskTitle(act.entity_id)}</span>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Comment content */}
                                                {act.action_type === 'comment' && act.content && (
                                                    <div className="mt-1 p-2 rounded-md bg-foreground/3 border border-border/20">
                                                        <p className="text-[11px] text-foreground/80 leading-relaxed">{act.content}</p>
                                                    </div>
                                                )}

                                                {/* Change description */}
                                                {act.action_type !== 'comment' && act.content && (
                                                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 leading-relaxed">{act.content}</p>
                                                )}

                                                <span className="text-[9px] text-muted-foreground/25 mt-1 block">
                                                    {new Date(act.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
