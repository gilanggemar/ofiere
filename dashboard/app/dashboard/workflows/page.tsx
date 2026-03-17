"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Workflow, Play, Pause, Plus, Trash2, Clock, CheckCircle2,
    XCircle, Loader2, ChevronRight, Calendar, Zap, FileText,
    Search, ArrowRight, GitBranch, PenTool, Pencil,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import { WORKFLOW_TEMPLATES } from "@/lib/workflows/types";
import type { WorkflowRun, StepResult } from "@/lib/workflows/types";



const STATUS_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    draft: { icon: FileText, color: "text-muted-foreground", label: "Draft" },
    active: { icon: CheckCircle2, color: "text-emerald-400", label: "Active" },
    paused: { icon: Pause, color: "text-amber-400", label: "Paused" },
    archived: { icon: XCircle, color: "text-muted-foreground/50", label: "Archived" },
    pending: { icon: Clock, color: "text-muted-foreground", label: "Pending" },
    running: { icon: Loader2, color: "text-blue-400", label: "Running" },
    completed: { icon: CheckCircle2, color: "text-emerald-400", label: "Completed" },
    failed: { icon: XCircle, color: "text-red-400", label: "Failed" },
    cancelled: { icon: XCircle, color: "text-muted-foreground/50", label: "Cancelled" },
    skipped: { icon: ArrowRight, color: "text-muted-foreground/50", label: "Skipped" },
};

export default function WorkflowsPage() {
    const {
        workflows, runs, isLoading,
        fetchWorkflows, fetchRuns, triggerRun,
    } = useWorkflowStore();


    const [createOpen, setCreateOpen] = useState(false);
    const [editTarget, setEditTarget] = useState<{ id: string; name: string; description: string } | null>(null);

    const handleEdit = useCallback((wf: any) => {
        setEditTarget({ id: wf.id, name: wf.name, description: wf.description || '' });
    }, []);

    useEffect(() => {
        fetchWorkflows();
        fetchRuns();
    }, [fetchWorkflows, fetchRuns]);

    const handleTrigger = useCallback(async (id: string) => {
        await triggerRun(id);
        fetchRuns();
        fetchWorkflows();
    }, [triggerRun, fetchRuns, fetchWorkflows]);

    const [confirmState, setConfirmState] = useState({
        isOpen: false, title: "", description: "", onConfirm: () => { }, destructive: true
    });

    const openConfirm = useCallback((title: string, description: string, onConfirm: () => void, destructive = true) => {
        setConfirmState({ isOpen: true, title, description, onConfirm, destructive });
    }, []);

    const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        openConfirm(
            "Delete Workflow",
            "Are you sure you want to delete this workflow? This action cannot be undone.",
            async () => {
                try {
                    const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
                    if (!res.ok) {
                        const data = await res.json();
                        console.error("Delete failed:", data);
                    }
                    fetchWorkflows();
                } catch (e) {
                    console.error("Failed:", e);
                }
            }
        );
    }, [fetchWorkflows, openConfirm]);

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Workflows</h1>
                <Button
                    size="sm"
                    onClick={() => setCreateOpen(true)}
                    className="rounded-full h-8 px-4 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                >
                    <Plus className="w-3 h-3" /> Create
                </Button>
            </div>

            {/* Two-column split layout */}
            <div className="flex-1 flex gap-5 min-h-0">
                {/* Left — Workflow List */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-3">
                        <GitBranch className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            My Workflows
                        </span>
                    </div>
                    <ScrollArea className="h-[calc(100%-2rem)]">
                        <WorkflowList
                            workflows={workflows}
                            onTrigger={handleTrigger}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                        />
                    </ScrollArea>
                </div>

                {/* Right — Run History Panel */}
                <div className="flex-1 min-w-0 flex flex-col min-h-0">
                    <div className="flex items-center gap-2 mb-3">
                        <Play className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                            Recent Runs
                        </span>
                        <span className="ml-auto text-[10px] text-muted-foreground/50">
                            {runs.length} {runs.length === 1 ? 'run' : 'runs'}
                        </span>
                    </div>
                    <div className="flex-1 min-h-0 rounded-xl border border-border bg-card/30 p-3">
                        <ScrollArea className="h-full">
                            <RunHistory runs={runs} onConfirm={openConfirm} />
                        </ScrollArea>
                    </div>
                </div>
            </div>

            <EditWorkflowDialog
                workflow={editTarget}
                onOpenChange={(open) => { if (!open) setEditTarget(null); }}
                onSaved={() => { setEditTarget(null); fetchWorkflows(); }}
            />

            <CreateWorkflowDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                onCreated={fetchWorkflows}
            />

            <ConfirmDialog
                open={confirmState.isOpen}
                onOpenChange={(isOpen) => setConfirmState(prev => ({ ...prev, isOpen }))}
                title={confirmState.title}
                description={confirmState.description}
                onConfirm={confirmState.onConfirm}
                destructive={confirmState.destructive}
            />
        </div>
    );
}

/* ─── Workflow List ─── */
function WorkflowList({
    workflows, onTrigger, onDelete, onEdit,
}: {
    workflows: any[];
    onTrigger: (id: string) => void;
    onDelete: (e: React.MouseEvent, id: string) => void;
    onEdit: (wf: any) => void;
}) {
    if (workflows.length === 0) {
        return (
            <Card className="rounded-xl border-dashed border-border bg-card/50 shadow-none">
                <CardContent className="p-8 text-center">
                    <GitBranch className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No workflows yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Create one or start from a template.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-2 pb-6 max-w-2xl">
            <AnimatePresence mode="popLayout">
                {workflows.map((wf) => {
                    const statusCfg = STATUS_CONFIG[wf.status] || STATUS_CONFIG.draft;
                    const StatusIcon = statusCfg.icon;
                    return (
                        <motion.div
                            key={wf.id}
                            layout
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                                <CardContent className="p-4">
                                    <div className="flex items-start gap-3">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-accent/50 ${statusCfg.color} shrink-0`}>
                                            <StatusIcon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="text-sm font-medium text-foreground">{wf.name}</p>
                                                <Badge variant="secondary" className="text-[10px] h-4 rounded px-1.5 font-normal">
                                                    {statusCfg.label}
                                                </Badge>
                                            </div>
                                            {wf.description && (
                                                <p className="text-[11px] text-muted-foreground mb-2">{wf.description}</p>
                                            )}
                                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                                                <span className="flex items-center gap-1">
                                                    <Zap className="w-2.5 h-2.5" />{wf.steps?.length || 0} steps
                                                </span>
                                                {wf.lastRunAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-2.5 h-2.5" />Last: {new Date(wf.lastRunAt).toLocaleDateString()}
                                                    </span>
                                                )}
                                                {wf.schedule?.type && wf.schedule.type !== 'manual' && (
                                                    <span className="flex items-center gap-1">
                                                        <Calendar className="w-2.5 h-2.5" />{wf.schedule.cronExpr || `Every ${Math.round((wf.schedule.intervalMs || 0) / 60000)}m`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 shrink-0">
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-amber-400"
                                                onClick={(e) => { e.stopPropagation(); onEdit(wf); }}
                                                title="Edit workflow"
                                            >
                                                <Pencil className="w-3 h-3" />
                                            </Button>
                                            <Link href={`/dashboard/workflows/${wf.id}/builder`}>
                                                <Button
                                                    variant="ghost" size="sm"
                                                    className="h-7 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-accent-base gap-1"
                                                >
                                                    <PenTool className="w-3 h-3" /> Builder
                                                </Button>
                                            </Link>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-7 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-emerald-400 gap-1"
                                                onClick={() => onTrigger(wf.id)}
                                            >
                                                <Play className="w-3 h-3" /> Run
                                            </Button>
                                            <Button
                                                variant="ghost" size="sm"
                                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                onClick={(e) => onDelete(e, wf.id)}
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

/* ─── Run History ─── */
function RunHistory({ runs, onConfirm }: { runs: WorkflowRun[], onConfirm: (title: string, desc: string, onAction: () => void) => void }) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    if (runs.length === 0) {
        return (
            <Card className="rounded-xl border-dashed border-border bg-card/50 shadow-none">
                <CardContent className="p-8 text-center">
                    <Play className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">No runs yet.</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Trigger a workflow to see execution history.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-2 pb-6 max-w-2xl">
            {runs.map((run) => {
                const statusCfg = STATUS_CONFIG[run.status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;
                const isExpanded = expandedId === run.id;
                const duration = run.completedAt
                    ? Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)
                    : null;

                return (
                    <Card
                        key={run.id}
                        className="group rounded-xl border-border bg-card shadow-none py-0 gap-0 cursor-pointer hover:border-foreground/10 transition-colors"
                        onClick={() => setExpandedId(isExpanded ? null : run.id)}
                    >
                        <CardContent className="p-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-accent/50 ${statusCfg.color}`}>
                                    <StatusIcon className={`w-3.5 h-3.5 ${run.status === 'running' ? 'animate-spin' : ''}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-medium text-foreground">Run {run.id.slice(0, 8)}</span>
                                        <Badge variant="secondary" className="text-[10px] h-4 rounded px-1.5 font-normal">
                                            {run.triggeredBy}
                                        </Badge>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                        {new Date(run.startedAt).toLocaleString()}
                                        {duration !== null && ` · ${duration}s`}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    {run.status === 'running' && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity mr-1"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onConfirm(
                                                    "Terminate Run",
                                                    "Are you sure you want to terminate this running workflow?",
                                                    () => useWorkflowStore.getState().cancelRun(run.id)
                                                );
                                            }}
                                            title="Terminate Run"
                                        >
                                            <div className="w-2.5 h-2.5 bg-current rounded-sm" />
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onConfirm(
                                                "Delete Run",
                                                "Are you sure you want to delete this run history? This action cannot be undone.",
                                                () => useWorkflowStore.getState().deleteRun(run.id)
                                            );
                                        }}
                                        title="Delete Run"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </Button>
                                    <ChevronRight className={`w-3 h-3 text-muted-foreground/30 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                                </div>
                            </div>

                            <AnimatePresence>
                                {isExpanded && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="mt-3 overflow-hidden"
                                    >
                                        <div className="flex items-center gap-1.5 flex-wrap px-1 py-2 overflow-x-auto">
                                            {run.stepResults.map((sr: StepResult, i: number) => {
                                                const stepCfg = STATUS_CONFIG[sr.status] || STATUS_CONFIG.pending;
                                                const StepIcon = stepCfg.icon;
                                                return (
                                                    <div key={i} className="flex items-center gap-1.5 shrink-0">
                                                        {i > 0 && (
                                                            <ArrowRight className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                                                        )}
                                                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-accent/30 border border-border/50">
                                                            <StepIcon className={`w-3 h-3 ${stepCfg.color} shrink-0 ${sr.status === 'running' ? 'animate-spin' : ''}`} />
                                                            <span className="text-[11px] text-foreground whitespace-nowrap">{sr.stepId}</span>
                                                            <Badge variant="secondary" className="text-[9px] h-3.5 rounded px-1 font-normal ml-0.5">
                                                                {stepCfg.label}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}

/* ─── Template List ─── */
function TemplateList({ onCreateFromTemplate }: { onCreateFromTemplate: (t: any) => void }) {
    return (
        <div className="space-y-3 pb-6 max-w-2xl">
            <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Starter Templates
            </h2>
            {WORKFLOW_TEMPLATES.map((tpl) => (
                <Card key={tpl.id} className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                    <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-accent/50 text-muted-foreground shrink-0">
                                <Workflow className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                                    <Badge variant="secondary" className="text-[10px] h-4 rounded px-1.5 font-normal">
                                        {tpl.category}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mb-2">{tpl.description}</p>
                                <div className="flex items-center gap-1">
                                    {tpl.steps.map((s, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                            {i > 0 && <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/20" />}
                                            <span className="text-[9px] px-2 py-0.5 rounded bg-accent/50 text-muted-foreground">
                                                {s.title}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <Button
                                variant="ghost" size="sm"
                                className="h-7 px-2.5 rounded-lg text-xs text-muted-foreground hover:text-foreground gap-1 shrink-0"
                                onClick={() => onCreateFromTemplate(tpl)}
                            >
                                <Plus className="w-3 h-3" /> Use
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

/* ─── Create Dialog ─── */
function CreateWorkflowDialog({
    open, onOpenChange, onCreated,
}: {
    open: boolean;
    onOpenChange: (o: boolean) => void;
    onCreated: () => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await fetch("/api/workflows", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                    steps: [],
                    status: "draft",
                    definition_version: 2,
                    nodes: [{
                        id: `manual_trigger-${Date.now()}`,
                        type: "manual_trigger",
                        position: { x: 250, y: 80 },
                        data: { label: "Execute Trigger" },
                    }],
                    edges: [],
                }),
            });
            setName(""); setDescription("");
            onCreated();
            onOpenChange(false);
        } catch (e) {
            console.error("Failed:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base">Create Workflow</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="My Pipeline"
                            className="h-8 text-[13px] rounded-xl border-border bg-background"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Description</label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this workflow do?"
                            className="min-h-16 text-[13px] rounded-xl border-border bg-background resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button>
                    </DialogClose>
                    <Button
                        size="sm"
                        className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={handleCreate}
                        disabled={saving || !name.trim()}
                    >
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Edit Workflow Dialog ─── */
function EditWorkflowDialog({
    workflow, onOpenChange, onSaved,
}: {
    workflow: { id: string; name: string; description: string } | null;
    onOpenChange: (o: boolean) => void;
    onSaved: () => void;
}) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [saving, setSaving] = useState(false);

    // Sync local state when workflow changes
    useEffect(() => {
        if (workflow) {
            setName(workflow.name);
            setDescription(workflow.description);
        }
    }, [workflow]);

    const handleSave = async () => {
        if (!workflow || !name.trim()) return;
        setSaving(true);
        try {
            await fetch(`/api/workflows/${workflow.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(),
                    description: description.trim() || undefined,
                }),
            });
            onSaved();
        } catch (e) {
            console.error("Failed to update workflow:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={!!workflow} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base">Edit Workflow</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Name</label>
                        <Input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Workflow name"
                            className="h-8 text-[13px] rounded-xl border-border bg-background"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Description</label>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="What does this workflow do?"
                            className="min-h-16 text-[13px] rounded-xl border-border bg-background resize-none"
                        />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button>
                    </DialogClose>
                    <Button
                        size="sm"
                        className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={handleSave}
                        disabled={saving || !name.trim()}
                    >
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

/* ─── Confirm Dialog ─── */
function ConfirmDialog({
    open, onOpenChange, title, description, onConfirm, destructive
}: {
    open: boolean; onOpenChange: (o: boolean) => void;
    title: string; description?: string; onConfirm: () => void; destructive?: boolean;
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xs rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base">{title}</DialogTitle>
                    {description && <div className="text-sm text-muted-foreground mt-2">{description}</div>}
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0 mt-4">
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button>
                    </DialogClose>
                    <Button
                        size="sm"
                        variant={destructive ? "destructive" : "default"}
                        className="rounded-full h-8 px-5 text-xs"
                        onClick={() => { onConfirm(); onOpenChange(false); }}
                    >
                        Confirm
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
