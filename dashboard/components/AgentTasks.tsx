"use client";

import { useCallback, useState, useEffect } from "react";
import { Plus, Settings2Icon, Loader2, CheckCircle2, AlertTriangle, Clock, RefreshCw, Play, Trash } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import SortableList, { Item, SortableListItem } from "./ui/sortable-list";
import { useTaskStore, Task } from "@/lib/useTaskStore";
import { useSocket, useSocketStore } from "@/lib/useSocket";
import { TaskCardModal } from "@/components/TaskCardModal";
import { AGENT_ROSTER } from "@/lib/agentRoster";
import { useRouter } from "next/navigation";

export function AgentTasks({ agentId, onPopoverChange }: { agentId: string; onPopoverChange?: (isOpen: boolean) => void }) {
    const { tasks, addTask, updateTask, updateTaskStatus, removeTask } = useTaskStore();
    const { sendChatMessage } = useSocket();
    const { sessions } = useSocketStore();
    const router = useRouter();

    const agentTasks = tasks.filter((t) => t.agentId === agentId);

    // Convert to SortableList Item format
    const [items, setItems] = useState<Item[]>([]);

    useEffect(() => {
        setItems(agentTasks.map((t) => ({
            id: t.id,
            text: t.title,
            description: t.description || "",
            checked: t.status === "DONE" || t.status === "FAILED",
            rawStatus: t.status
        } as any)));
    }, [tasks, agentId]);

    const [isDeleteMode, setIsDeleteMode] = useState(false);

    // ─── Task Card Modal State ───
    const [showTaskCard, setShowTaskCard] = useState(false);
    const [taskCardMode, setTaskCardMode] = useState<'create' | 'edit'>('create');
    const [taskCardData, setTaskCardData] = useState<Partial<Task> | undefined>(undefined);

    // Notify parent when modal is open
    useEffect(() => {
        onPopoverChange?.(showTaskCard);
    }, [showTaskCard, onPopoverChange]);

    const handleCompleteItem = (id: string | number) => {
        const t = agentTasks.find((task) => task.id === id);
        if (t) {
            updateTaskStatus(t.id, t.status === "DONE" ? "PENDING" : "DONE");
        }
    };

    const handleAddItem = () => {
        // Open TaskCardModal in create mode
        setTaskCardData({
            agentId,
            source: 'manual',
        });
        setTaskCardMode('create');
        setShowTaskCard(true);
    };

    const handleConfigureItem = (taskId: string | number) => {
        const task = agentTasks.find(t => t.id === String(taskId));
        if (!task) return;
        // Open TaskCardModal in edit mode with task data
        setTaskCardData(task);
        setTaskCardMode('edit');
        setShowTaskCard(true);
    };

    const handleRemoveItem = (id: string | number) => {
        removeTask(String(id));
    };

    const handleCloseOnDrag = useCallback(() => {
        // no-op since we removed inline popovers
    }, []);

    const handleExecute = async (taskId: string | number) => {
        const t = agentTasks.find((task) => task.id === taskId);
        if (!t || agentId === "unassigned") return;

        let sessionKey = `agent:${agentId}:main`;
        const webchatSession = sessions.find(s => s.agentId === agentId && s.key?.includes('webchat'));
        if (webchatSession) {
            sessionKey = webchatSession.key;
        } else {
            const anySession = sessions.find(s => s.agentId === agentId);
            if (anySession) sessionKey = anySession.key;
        }

        // Build a richer directive from the task card fields
        let directive = `## SCHEDULED TASK: ${t.title}`;

        if (t.description) {
            directive += `\n\n### Instructions\n${t.description}`;
        }

        // Include execution plan steps
        if (t.executionPlan && t.executionPlan.length > 0) {
            directive += `\n\n### Execution Plan`;
            t.executionPlan.forEach((step, i) => {
                if (step.text.trim()) {
                    directive += `\n${i + 1}. ${step.text}`;
                }
            });
        }

        // Include goals
        if (t.goals && t.goals.length > 0) {
            directive += `\n\n### Goals`;
            t.goals.forEach(g => { directive += `\n- ${g.label}`; });
        }

        // Include constraints
        if (t.constraints && t.constraints.length > 0) {
            directive += `\n\n### Constraints`;
            t.constraints.forEach(c => {
                const prefix = c.type && c.type !== 'custom' ? `[${c.type.toUpperCase()}] ` : '';
                directive += `\n- ${prefix}${c.label}`;
            });
        }

        // Include system prompt injection
        if (t.systemPrompt) {
            directive += `\n\n### Behavioral Directive\n${t.systemPrompt}`;
        }

        directive += `\n\n---\nPriority: ${t.priority}\nExecute this task now. Use your available tools and capabilities to complete it. Report your progress and results.`;

        // Dispatch via WebSocket (immediate, client-side)
        sendChatMessage(agentId, directive, sessionKey);
        updateTaskStatus(t.id, "IN_PROGRESS");

        // Also log dispatch server-side (non-blocking)
        fetch('/api/tasks/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: String(t.id) }),
        }).catch(() => { /* Non-fatal: server-side logging is best-effort */ });

        toast.success('Task dispatched', {
            description: `"${t.title}" sent to ${agentId} for execution`,
            duration: 4000,
            position: 'bottom-left',
        });
    };

    const handleTaskHandoff = (task: Task) => {
        toast.success('Task added successfully', {
            description: `"${task.title}" assigned to ${agentId}`,
            duration: 5000,
            position: 'bottom-left',
            action: {
                label: 'Go to task-ops',
                onClick: () => router.push('/summit'),
            },
        });
    };

    const renderListItem = (
        item: Item,
        order: number,
        onCompleteItem: (id: string | number) => void,
        onRemoveItem: (id: string | number) => void
    ) => {
        const task = agentTasks.find(t => t.id === String(item.id));
        if (!task) return null;

        return (
            <SortableListItem
                item={item}
                order={order}
                key={item.id}
                isDeleteMode={isDeleteMode}
                isActive={false}
                onCompleteItem={onCompleteItem}
                onRemoveItem={onRemoveItem}
                handleDrag={handleCloseOnDrag}
                className="my-1.5"
                renderExtra={(item: any) => (
                    <div
                        className="flex items-center shrink-0 py-2 pr-3 pl-1"
                    >
                        <div className="relative ml-auto flex items-center gap-2 z-10">
                            {task.status === "PENDING" && (
                                <div className="flex items-center" onClick={(e) => { e.stopPropagation(); handleExecute(item.id); }}>
                                    <Play className="w-4 h-4 fill-amber-500 text-amber-500 hover:fill-amber-400 hover:text-amber-400 cursor-pointer transition-colors drop-shadow-[0_0_5px_rgba(217,119,6,0.3)]" />
                                </div>
                            )}
                            <div className="flex items-center" onClick={(e) => { e.stopPropagation(); handleConfigureItem(item.id); }}>
                                <Settings2Icon
                                    className="stroke-1 h-4 w-4 text-zinc-500 hover:text-[#13EEE3]/70 hover:stroke-[#13EEE3]/70 transition-colors cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                )}
            />
        );
    };

    return (
        <div className="w-full">
            <div className="rounded-md bg-background/60 p-4 flex flex-col gap-4 mx-2 mb-2">
                {/* Actions row */}
                <div className="flex items-center justify-between px-2 pt-2">
                    <button onClick={handleAddItem} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                        <Plus className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setIsDeleteMode(!isDeleteMode)}
                        className={cn("transition-colors", isDeleteMode ? "text-red-500 hover:text-red-400" : "text-zinc-500 hover:text-zinc-300")}
                    >
                        <Trash className="w-4 h-4" />
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[60px] opacity-70">
                        <p className="text-xs font-mono text-zinc-600">No agent task</p>
                    </div>
                ) : (
                    <div className="relative space-y-2 mt-4 pr-1 mb-2">
                        <SortableList
                            items={items}
                            setItems={setItems}
                            onCompleteItem={handleCompleteItem}
                            onRemoveItem={handleRemoveItem as any}
                            renderItem={renderListItem}
                        />
                    </div>
                )}
            </div>

            {/* Task Card Modal */}
            <TaskCardModal
                isOpen={showTaskCard}
                onClose={() => setShowTaskCard(false)}
                initialData={taskCardData}
                defaultAgentId={agentId}
                availableAgents={AGENT_ROSTER.map(a => ({ id: a.id, name: a.name }))}
                onHandoff={taskCardMode === 'create' ? handleTaskHandoff : undefined}
                mode={taskCardMode}
            />
        </div>
    );
}
