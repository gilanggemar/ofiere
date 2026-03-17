'use client';

import { useState, useMemo, useEffect } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Search, InboxIcon, GitBranch, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import { useTaskStore, type Task } from '@/lib/useTaskStore';
import { useSchedulerStore } from '@/store/useSchedulerStore';
import { useAvailableAgents } from '@/hooks/useAvailableAgents';
import { useWorkflowStore } from '@/store/useWorkflowStore';

// ─── Agent color helper ─────────────────────────────────────────────────────

function getAgentColor(agentId: string | null | undefined): string {
    if (!agentId) return 'var(--accent-base)';
    const lower = agentId.toLowerCase();
    if (lower.includes('daisy')) return 'var(--agent-daisy)';
    if (lower.includes('ivy')) return 'var(--agent-ivy)';
    if (lower.includes('celia')) return 'var(--agent-celia)';
    if (lower.includes('thalia')) return 'var(--agent-thalia)';
    if (lower.includes('zero')) return 'var(--agent-zero)';
    return 'var(--accent-base)';
}

// ─── Draggable task wrapper ─────────────────────────────────────────────────

function DraggableTrayTask({ task }: { task: Task }) {
    const agents = useAvailableAgents();
    const agent = agents.find((a: any) => a.id === task.agentId);

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `tray-${task.id}`,
        data: { type: 'tray-task', task },
    });

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            <TaskCard
                id={task.id}
                title={task.title}
                agentId={task.agentId}
                agentName={agent?.name || task.agentId}
                agentColor={getAgentColor(task.agentId)}
                priority={task.priority?.toLowerCase() as 'low' | 'medium' | 'high' | 'critical' || 'medium'}
                status="PENDING"
                description={task.description}
                isDragging={isDragging}
                isCompact={false}
            />
        </div>
    );
}

// ─── Draggable workflow wrapper ─────────────────────────────────────────────

function DraggableWorkflowCard({ workflow }: { workflow: any }) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `tray-wf-${workflow.id}`,
        data: { type: 'tray-workflow', workflow },
    });

    const stepCount = workflow.steps?.length || workflow.nodes?.length || 0;

    return (
        <div ref={setNodeRef} {...attributes} {...listeners}>
            <motion.div
                whileHover={!isDragging ? { scale: 1.02 } : undefined}
                className={cn(
                    'nerv-glass-1 rounded-xl p-3 mb-2 border-l-4 transition-all duration-150',
                    'cursor-grab active:cursor-grabbing select-none',
                    isDragging && 'opacity-50 border-dashed',
                )}
                style={{ borderLeftColor: 'var(--accent-base)' }}
            >
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-start justify-between gap-1.5">
                        <span className="nerv-body font-medium line-clamp-2 flex-1">
                            {workflow.name}
                        </span>
                        <GitBranch className="w-3.5 h-3.5 shrink-0 opacity-40 mt-0.5" />
                    </div>
                    {workflow.description && (
                        <p className="nerv-caption truncate">{workflow.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1 nerv-caption opacity-60">
                            <Zap className="w-3 h-3" />
                            {stepCount} step{stepCount !== 1 ? 's' : ''}
                        </span>
                        <span className={cn(
                            'nerv-badge-text px-1.5 py-0.5 rounded-full text-[9px]',
                            workflow.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/[0.08]',
                        )}>
                            {workflow.status || 'draft'}
                        </span>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// ─── Component ──────────────────────────────────────────────────────────────

export function TaskCardTray() {
    const [searchQuery, setSearchQuery] = useState('');
    const tasks = useTaskStore((s) => s.tasks);
    const events = useSchedulerStore((s) => s.events);
    const filterAgentIds = useSchedulerStore((s) => s.filterAgentIds);
    const { workflows, fetchWorkflows } = useWorkflowStore();

    // Fetch workflows on mount
    useEffect(() => {
        fetchWorkflows();
    }, [fetchWorkflows]);

    // Filter: PENDING tasks that don't have a scheduler event
    const unscheduledTasks = useMemo(() => {
        const scheduledTaskIds = new Set(
            events.filter(e => e.taskId).map(e => e.taskId)
        );

        return tasks
            .filter(t => t.status === 'PENDING' && !scheduledTaskIds.has(t.id))
            .filter(t => {
                // Agent filter
                if (filterAgentIds.length > 0 && !filterAgentIds.includes(t.agentId)) return false;
                // Search filter
                if (!searchQuery) return true;
                return t.title.toLowerCase().includes(searchQuery.toLowerCase());
            });
    }, [tasks, events, searchQuery, filterAgentIds]);

    // Filter: workflows matching search
    const filteredWorkflows = useMemo(() => {
        if (!searchQuery) return workflows;
        return workflows.filter(wf =>
            wf.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [workflows, searchQuery]);

    return (
        <div className="nerv-glass-1 w-64 border-r border-white/[0.06] flex flex-col h-full shrink-0">
            {/* Header */}
            <div className="px-3 py-3 border-b border-white/[0.06] shrink-0">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="nerv-section-prominent">Unscheduled</h3>
                    <span className="nerv-badge-text bg-white/[0.08] px-2 py-0.5 rounded-full">
                        {unscheduledTasks.length + filteredWorkflows.length}
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 opacity-40" />
                    <Input
                        placeholder="Filter tasks & workflows..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-7 text-xs pl-7 bg-white/[0.04] border-white/[0.06]"
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-2">
                {/* ─── Tasks Section ─── */}
                {unscheduledTasks.length > 0 && (
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 px-1 mb-1.5">
                            <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">Tasks</span>
                        </div>
                        {unscheduledTasks.map((task) => (
                            <DraggableTrayTask key={task.id} task={task} />
                        ))}
                    </div>
                )}

                {/* ─── Workflows Section ─── */}
                {filteredWorkflows.length > 0 && (
                    <div className="mb-3">
                        <div className="flex items-center gap-1.5 px-1 mb-1.5">
                            <GitBranch className="w-3 h-3 text-white/30" />
                            <span className="text-[10px] font-medium uppercase tracking-widest text-white/30">Workflows</span>
                        </div>
                        {filteredWorkflows.map((wf) => (
                            <DraggableWorkflowCard key={wf.id} workflow={wf} />
                        ))}
                    </div>
                )}

                {/* ─── Empty state ─── */}
                {unscheduledTasks.length === 0 && filteredWorkflows.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-2 opacity-40">
                        <InboxIcon className="w-8 h-8" />
                        <div className="nerv-caption text-center">
                            {searchQuery ? 'No matching items' : 'All tasks scheduled! 🎯'}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
