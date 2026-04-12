"use client";

import { useState, useEffect } from "react";
import { usePMStore } from "@/store/usePMStore";
import { PRIORITY_LABELS, PRIORITY_DOTS } from "@/lib/pm/types";
import type { PMTaskStatus } from "@/lib/pm/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, X, GitBranch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface Workflow {
    id: string;
    name: string;
    description?: string;
    status: string;
}

const STATUS_OPTIONS: { id: PMTaskStatus; label: string }[] = [
    { id: 'PENDING', label: 'Backlog' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
];

export function AddWorkflowDialog() {
    const open = usePMStore((s) => s.createWorkflowItemOpen);
    const setOpen = usePMStore((s) => s.setCreateWorkflowItemOpen);
    const createTask = usePMStore((s) => s.createTask);
    const agents = usePMStore((s) => s.agents);

    const [workflows, setWorkflows] = useState<Workflow[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedWorkflowId, setSelectedWorkflowId] = useState("");
    const [aicAgentId, setAicAgentId] = useState("");
    const [aicPrompt, setAicPrompt] = useState("");
    const [priority, setPriority] = useState(1);
    const [status, setStatus] = useState<PMTaskStatus>("PENDING");
    const [startDate, setStartDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    // Fetch workflows when dialog opens
    useEffect(() => {
        if (!open) return;
        setLoading(true);
        fetch('/api/workflows')
            .then((r) => r.json())
            .then((data) => {
                setWorkflows(Array.isArray(data) ? data : []);
            })
            .catch(() => setWorkflows([]))
            .finally(() => setLoading(false));
    }, [open]);

    const selectedWorkflow = workflows.find((w) => w.id === selectedWorkflowId);

    const handleCreate = async () => {
        if (!selectedWorkflowId || !aicAgentId) return;

        const wf = selectedWorkflow;
        await createTask({
            title: wf?.name || 'Workflow Task',
            description: aicPrompt.trim() || `Workflow execution managed by agent`,
            priority,
            assignee_type: 'agent',
            agent_id: aicAgentId,
            tags: [...tags, 'workflow'],
            status,
            start_date: startDate ? new Date(startDate).toISOString() : null,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
            custom_fields: {
                type: 'workflow',
                workflow_id: selectedWorkflowId,
                workflow_name: wf?.name || '',
                aic_agent_id: aicAgentId,
                aic_prompt: aicPrompt.trim(),
            },
        });

        // Reset
        setSelectedWorkflowId("");
        setAicAgentId("");
        setAicPrompt("");
        setPriority(1);
        setStatus("PENDING");
        setTags([]);
        setStartDate("");
        setDueDate("");
        setOpen(false);
    };

    const handleTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && tagInput.trim()) {
            e.preventDefault();
            if (!tags.includes(tagInput.trim().toLowerCase())) {
                setTags([...tags, tagInput.trim().toLowerCase()]);
            }
            setTagInput("");
        }
    };

    const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));
    const handleClose = () => setOpen(false);

    if (!open) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                    className="w-full max-w-lg border border-border rounded-xl bg-card shadow-2xl relative flex flex-col max-h-[90vh]"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border/50 shrink-0">
                        <span className="text-[13px] font-medium text-foreground">Add Workflow</span>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* Form */}
                    <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                        {/* Workflow Selector */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Select Workflow</label>
                            {loading ? (
                                <div className="flex items-center gap-2 h-8 text-[12px] text-muted-foreground/50">
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading workflows...
                                </div>
                            ) : workflows.length === 0 ? (
                                <div className="text-[11px] text-muted-foreground/40 py-2">
                                    No workflows found. Create one in the Workflows page first.
                                </div>
                            ) : (
                                <Select value={selectedWorkflowId} onValueChange={setSelectedWorkflowId}>
                                    <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                        <SelectValue placeholder="Choose a workflow..." />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-md z-[10000]">
                                        {workflows.map((wf) => (
                                            <SelectItem key={wf.id} value={wf.id} className="text-[12px] rounded-md">
                                                <span className="flex items-center gap-2">
                                                    <GitBranch className="w-3 h-3 text-accent-base" />
                                                    {wf.name}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        {/* Workflow description preview */}
                        {selectedWorkflow?.description && (
                            <div className="text-[11px] text-muted-foreground/50 bg-muted/10 rounded-md px-3 py-2 border border-border/30">
                                {selectedWorkflow.description}
                            </div>
                        )}

                        {/* Agent in Charge (AIC) */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Agent in Charge</label>
                            <Select value={aicAgentId} onValueChange={setAicAgentId}>
                                <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                    <SelectValue placeholder="Select agent..." />
                                </SelectTrigger>
                                <SelectContent className="rounded-md z-[10000]">
                                    {agents.map((a) => (
                                        <SelectItem key={a.id} value={a.id} className="text-[12px] rounded-md">
                                            <span className="flex items-center gap-2">
                                                <Bot className="w-3 h-3 text-accent-violet" />
                                                {a.name}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-muted-foreground/30">This agent triggers the workflow and handles its output.</p>
                        </div>

                        {/* AIC Prompt */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Instructions for Agent</label>
                            <Textarea
                                value={aicPrompt}
                                onChange={(e) => setAicPrompt(e.target.value)}
                                placeholder="What should the agent do with the workflow output..."
                                className="min-h-16 text-[12px] rounded-md border-border bg-background resize-none"
                            />
                        </div>

                        {/* Row: Priority + Status */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground font-medium">Priority</label>
                                <Select value={String(priority)} onValueChange={(v) => setPriority(Number(v))}>
                                    <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-md z-[10000]">
                                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                                            <SelectItem key={k} value={k} className="text-[12px] rounded-md">
                                                <span className="flex items-center gap-2">
                                                    <span className={cn("w-2 h-2 rounded-full", PRIORITY_DOTS[Number(k)])} />
                                                    {v}
                                                </span>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground font-medium">Status</label>
                                <Select value={status} onValueChange={(v) => setStatus(v as PMTaskStatus)}>
                                    <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-md z-[10000]">
                                        {STATUS_OPTIONS.map((s) => (
                                            <SelectItem key={s.id} value={s.id} className="text-[12px] rounded-md">
                                                {s.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {/* Dates */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground font-medium">Start Date</label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="h-8 text-[12px] rounded-md border-border bg-background"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground font-medium">Due Date</label>
                                <Input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    className="h-8 text-[12px] rounded-md border-border bg-background"
                                />
                            </div>
                        </div>

                        {/* Tags */}
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground font-medium">Tags</label>
                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                {tags.map((tag) => (
                                    <Badge
                                        key={tag}
                                        variant="secondary"
                                        className="text-[10px] h-5 rounded-md px-2 font-normal gap-1 cursor-pointer hover:bg-destructive/20"
                                        onClick={() => removeTag(tag)}
                                    >
                                        {tag}
                                        <X className="w-2.5 h-2.5" />
                                    </Badge>
                                ))}
                            </div>
                            <Input
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleTagKeyDown}
                                placeholder="Type and press Enter"
                                className="h-8 text-[12px] rounded-md border-border bg-background"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/50 shrink-0">
                        <Button
                            onClick={handleClose}
                            variant="ghost"
                            size="sm"
                            className="h-8 px-4 rounded-md text-[11px]"
                        >
                            Cancel
                        </Button>
                        <Button
                            size="sm"
                            className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5 disabled:opacity-30"
                            onClick={handleCreate}
                            disabled={!selectedWorkflowId || !aicAgentId}
                        >
                            <GitBranch className="w-3 h-3" />
                            Add Workflow
                        </Button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
