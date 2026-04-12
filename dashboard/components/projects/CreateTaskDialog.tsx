"use client";

import { useState, useEffect, useMemo } from "react";
import { usePMStore } from "@/store/usePMStore";
import { PRIORITY_LABELS, PRIORITY_DOTS } from "@/lib/pm/types";
import type { PMAssigneeType, PMTaskStatus } from "@/lib/pm/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Bot, User, Zap, X, FileText, Link2, Search, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ASSIGNEE_OPTIONS: { id: PMAssigneeType; icon: typeof Bot; label: string }[] = [
    { id: 'auto', icon: Zap, label: 'Auto-assign' },
    { id: 'agent', icon: Bot, label: 'Agent' },
    { id: 'human', icon: User, label: 'Human (Me)' },
];

const STATUS_OPTIONS: { id: PMTaskStatus; label: string }[] = [
    { id: 'PENDING', label: 'Backlog' },
    { id: 'IN_PROGRESS', label: 'In Progress' },
];

type Tab = 'new' | 'link';

interface AgentTask {
    id: string;
    title: string;
    agentId: string;
    status: string;
    priority: string;
    description?: string;
    spaceId?: string | null;
}

export function CreateTaskDialog() {
    const open = usePMStore((s) => s.createTaskOpen);
    const setOpen = usePMStore((s) => s.setCreateTaskOpen);
    const createTask = usePMStore((s) => s.createTask);
    const linkTask = usePMStore((s) => s.linkTask);
    const agents = usePMStore((s) => s.agents);

    // Tab state
    const [activeTab, setActiveTab] = useState<Tab>('new');

    // ── New Task form state ──
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [priority, setPriority] = useState(1);
    const [assigneeType, setAssigneeType] = useState<PMAssigneeType>("agent");
    const [agentId, setAgentId] = useState("");
    const [status, setStatus] = useState<PMTaskStatus>("PENDING");
    const [startDate, setStartDate] = useState("");
    const [dueDate, setDueDate] = useState("");
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState<string[]>([]);

    // ── Link Task state ──
    const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
    const [loadingTasks, setLoadingTasks] = useState(false);
    const [linkAgentId, setLinkAgentId] = useState("");
    const [selectedLinkTaskId, setSelectedLinkTaskId] = useState<string | null>(null);
    const [linkPriority, setLinkPriority] = useState(1);
    const [linkStatus, setLinkStatus] = useState<PMTaskStatus>("PENDING");
    const [linkStartDate, setLinkStartDate] = useState("");
    const [linkDueDate, setLinkDueDate] = useState("");
    const [linkTagInput, setLinkTagInput] = useState("");
    const [linkTags, setLinkTags] = useState<string[]>([]);

    // Fetch agent tasks when switching to Link tab
    useEffect(() => {
        if (!open || activeTab !== 'link') return;
        setLoadingTasks(true);
        fetch('/api/tasks')
            .then((r) => r.json())
            .then((data) => {
                setAgentTasks(data.tasks || []);
            })
            .catch(() => setAgentTasks([]))
            .finally(() => setLoadingTasks(false));
    }, [open, activeTab]);

    // Filter agent tasks: for the selected agent, exclude those already linked to a PM space
    const agentFilteredTasks = useMemo(() => {
        if (!linkAgentId) return [];
        return agentTasks.filter(t => t.agentId === linkAgentId && !t.spaceId);
    }, [agentTasks, linkAgentId]);

    const selectedAgentTask = agentTasks.find(t => t.id === selectedLinkTaskId);
    const selectedAgent = agents.find(a => a.id === selectedAgentTask?.agentId);

    const handleCreate = async () => {
        if (!title.trim()) return;
        await createTask({
            title: title.trim(),
            description: description.trim() || null,
            priority,
            assignee_type: assigneeType,
            agent_id: assigneeType === 'agent' && agentId ? agentId : null,
            tags,
            status,
            start_date: startDate ? new Date(startDate).toISOString() : null,
            due_date: dueDate ? new Date(dueDate).toISOString() : null,
        });
        resetAndClose();
    };

    const handleLink = async () => {
        if (!selectedLinkTaskId || !selectedAgentTask) return;
        await linkTask(selectedLinkTaskId, {
            title: selectedAgentTask.title,
            description: selectedAgentTask.description || null,
            agent_id: selectedAgentTask.agentId || null,
            assignee_type: selectedAgentTask.agentId ? 'agent' : 'auto',
            priority: linkPriority,
            status: linkStatus,
            start_date: linkStartDate ? new Date(linkStartDate).toISOString() : null,
            due_date: linkDueDate ? new Date(linkDueDate).toISOString() : null,
            tags: linkTags.length > 0 ? linkTags : undefined,
        } as any);
        resetAndClose();
    };

    const resetAndClose = () => {
        setTitle(""); setDescription(""); setPriority(1);
        setAssigneeType("agent"); setAgentId(""); setStatus("PENDING");
        setTags([]); setStartDate(""); setDueDate("");
        setSelectedLinkTaskId(null); setLinkAgentId("");
        setLinkPriority(1); setLinkStatus("PENDING");
        setLinkStartDate(""); setLinkDueDate(""); setLinkTags([]);
        setActiveTab('new');
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

    const handleLinkTagKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && linkTagInput.trim()) {
            e.preventDefault();
            if (!linkTags.includes(linkTagInput.trim().toLowerCase())) {
                setLinkTags([...linkTags, linkTagInput.trim().toLowerCase()]);
            }
            setLinkTagInput("");
        }
    };

    const removeTag = (tag: string) => setTags(tags.filter((t) => t !== tag));
    const removeLinkTag = (tag: string) => setLinkTags(linkTags.filter((t) => t !== tag));
    const handleClose = () => resetAndClose();

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
                    {/* Header with Tabs */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 shrink-0">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setActiveTab('new')}
                                className={cn(
                                    "text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors",
                                    activeTab === 'new'
                                        ? "text-foreground bg-foreground/5"
                                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/3"
                                )}
                            >
                                New Task
                            </button>
                            <button
                                onClick={() => setActiveTab('link')}
                                className={cn(
                                    "text-[13px] font-medium px-3 py-1.5 rounded-md transition-colors flex items-center gap-1.5",
                                    activeTab === 'link'
                                        ? "text-foreground bg-foreground/5"
                                        : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-foreground/3"
                                )}
                            >
                                <Link2 className="w-3 h-3" />
                                Link Task
                            </button>
                        </div>
                        <button
                            onClick={handleClose}
                            className="p-1 rounded-md hover:bg-muted/40 transition-colors"
                        >
                            <X className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                    </div>

                    {/* ═══ NEW TASK TAB ═══ */}
                    {activeTab === 'new' && (
                        <>
                            <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                                {/* Title */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground font-medium">Title</label>
                                    <Input
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Research competitor pricing"
                                        className="h-8 text-[12px] rounded-md border-border bg-background"
                                        autoFocus
                                    />
                                </div>

                                {/* Description */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground font-medium">Description</label>
                                    <Textarea
                                        value={description}
                                        onChange={(e) => setDescription(e.target.value)}
                                        placeholder="What needs to be done..."
                                        className="min-h-16 text-[12px] rounded-md border-border bg-background resize-none"
                                    />
                                </div>

                                {/* Row: Priority + Status + Assignee Type */}
                                <div className="grid grid-cols-3 gap-3">
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

                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-muted-foreground font-medium">Assignee</label>
                                        <Select value={assigneeType} onValueChange={(v) => setAssigneeType(v as PMAssigneeType)}>
                                            <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-md z-[10000]">
                                                {ASSIGNEE_OPTIONS.map((a) => (
                                                    <SelectItem key={a.id} value={a.id} className="text-[12px] rounded-md">
                                                        <span className="flex items-center gap-2">
                                                            <a.icon className="w-3 h-3" />
                                                            {a.label}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                {/* Agent picker (when type = agent) */}
                                {assigneeType === 'agent' && agents.length > 0 && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-muted-foreground font-medium">Assign to Agent</label>
                                        <Select value={agentId} onValueChange={setAgentId}>
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
                                    </div>
                                )}

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
                                <Button onClick={handleClose} variant="ghost" size="sm" className="h-8 px-4 rounded-md text-[11px]">
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5 disabled:opacity-30"
                                    onClick={handleCreate}
                                    disabled={!title.trim()}
                                >
                                    <FileText className="w-3 h-3" />
                                    Create Task
                                </Button>
                            </div>
                        </>
                    )}

                    {/* ═══ LINK TASK TAB ═══ */}
                    {activeTab === 'link' && (
                        <>
                            <div className="px-5 py-5 space-y-4 overflow-y-auto min-h-0 flex-1">
                                {/* Agent Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground font-medium">Select Agent</label>
                                    <Select value={linkAgentId} onValueChange={(v) => { setLinkAgentId(v); setSelectedLinkTaskId(null); }}>
                                        <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                            <SelectValue placeholder="Choose an agent..." />
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
                                </div>

                                {/* Task Selector (only available after agent is selected) */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground font-medium">Select Task</label>
                                    {!linkAgentId ? (
                                        <div className="h-8 flex items-center px-3 text-[11px] text-muted-foreground/30 border border-border/30 rounded-md bg-background/50">
                                            Select an agent first...
                                        </div>
                                    ) : loadingTasks ? (
                                        <div className="h-8 flex items-center gap-2 px-3 text-[11px] text-muted-foreground/40">
                                            <Loader2 className="w-3 h-3 animate-spin" /> Loading tasks...
                                        </div>
                                    ) : agentFilteredTasks.length === 0 ? (
                                        <div className="h-8 flex items-center px-3 text-[11px] text-muted-foreground/30 border border-border/30 rounded-md bg-background/50">
                                            No existing tasks
                                        </div>
                                    ) : (
                                        <Select value={selectedLinkTaskId || ''} onValueChange={(v) => setSelectedLinkTaskId(v)}>
                                            <SelectTrigger className="h-8 text-[12px] rounded-md border-border bg-background">
                                                <SelectValue placeholder="Choose a task..." />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-md z-[10000]">
                                                {agentFilteredTasks.map((task) => (
                                                    <SelectItem key={task.id} value={task.id} className="text-[12px] rounded-md">
                                                        <span className="flex items-center gap-2">
                                                            <FileText className="w-3 h-3 text-muted-foreground/60" />
                                                            {task.title}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                </div>

                                {/* Selected task details */}
                                {selectedAgentTask && (
                                    <div className="bg-muted/10 border border-border/30 rounded-lg px-3 py-2 space-y-1">
                                        <div className="text-[11px] font-medium text-foreground">{selectedAgentTask.title}</div>
                                        {selectedAgent && (
                                            <div className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                                                <Bot className="w-2.5 h-2.5" /> Assigned to {selectedAgent.name}
                                            </div>
                                        )}
                                        {selectedAgentTask.description && (
                                            <div className="text-[10px] text-muted-foreground/40 line-clamp-2 mt-1">
                                                {selectedAgentTask.description}
                                            </div>
                                        )}
                                        <p className="text-[9px] text-muted-foreground/25 mt-1">
                                            Execution plan, goals, constraints, and system prompt injection from the original task will be preserved.
                                        </p>
                                    </div>
                                )}

                                {/* Editable PM fields for linked task */}
                                {selectedLinkTaskId && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] text-muted-foreground font-medium">Priority</label>
                                                <Select value={String(linkPriority)} onValueChange={(v) => setLinkPriority(Number(v))}>
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
                                                <Select value={linkStatus} onValueChange={(v) => setLinkStatus(v as PMTaskStatus)}>
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

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] text-muted-foreground font-medium">Start Date</label>
                                                <Input
                                                    type="date"
                                                    value={linkStartDate}
                                                    onChange={(e) => setLinkStartDate(e.target.value)}
                                                    className="h-8 text-[12px] rounded-md border-border bg-background"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] text-muted-foreground font-medium">Due Date</label>
                                                <Input
                                                    type="date"
                                                    value={linkDueDate}
                                                    onChange={(e) => setLinkDueDate(e.target.value)}
                                                    className="h-8 text-[12px] rounded-md border-border bg-background"
                                                />
                                            </div>
                                        </div>

                                        {/* Tags */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] text-muted-foreground font-medium">Tags</label>
                                            <div className="flex flex-wrap gap-1.5 mb-1.5">
                                                {linkTags.map((tag) => (
                                                    <Badge
                                                        key={tag}
                                                        variant="secondary"
                                                        className="text-[10px] h-5 rounded-md px-2 font-normal gap-1 cursor-pointer hover:bg-destructive/20"
                                                        onClick={() => removeLinkTag(tag)}
                                                    >
                                                        {tag}
                                                        <X className="w-2.5 h-2.5" />
                                                    </Badge>
                                                ))}
                                            </div>
                                            <Input
                                                value={linkTagInput}
                                                onChange={(e) => setLinkTagInput(e.target.value)}
                                                onKeyDown={handleLinkTagKeyDown}
                                                placeholder="Type and press Enter"
                                                className="h-8 text-[12px] rounded-md border-border bg-background"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border/50 shrink-0">
                                <Button onClick={handleClose} variant="ghost" size="sm" className="h-8 px-4 rounded-md text-[11px]">
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    className="h-8 px-5 rounded-md text-[11px] bg-orange-500 text-white hover:bg-orange-600 gap-1.5 disabled:opacity-30"
                                    onClick={handleLink}
                                    disabled={!selectedLinkTaskId}
                                >
                                    <Link2 className="w-3 h-3" />
                                    Link Task
                                </Button>
                            </div>
                        </>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
