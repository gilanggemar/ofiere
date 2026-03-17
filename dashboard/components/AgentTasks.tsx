"use client";

import { useCallback, useState, useEffect } from "react";
import { Plus, Settings2Icon, XIcon, Loader2, CheckCircle2, AlertTriangle, Clock, RefreshCw, Play, Trash } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import SortableList, { Item, SortableListItem } from "./ui/sortable-list";
import { useTaskStore, Task } from "@/lib/useTaskStore";
import { useSocket, useSocketStore } from "@/lib/useSocket";
import {
    PopoverForm,
    PopoverFormButton,
    PopoverFormCutOutLeftIcon,
    PopoverFormCutOutRightIcon,
    PopoverFormSeparator,
    PopoverFormSuccess,
} from "@/components/ui/popover-form";

function TaskSettingsPopover({ item, task, updateTask, setItems, open, setOpen }: any) {
    const [formState, setFormState] = useState<"idle" | "loading" | "success">("idle");
    const [title, setTitle] = useState(item.text);
    const [description, setDescription] = useState(item.description || "");
    const [topP, setTopP] = useState(task.topP || 0.9);
    const [temp, setTemp] = useState(task.temp || 0.7);

    useEffect(() => {
        if (open) {
            setTitle(item.text);
            setDescription(item.description || "");
            setTopP(task.topP || 0.9);
            setTemp(task.temp || 0.7);
            setFormState("idle");
        }
    }, [open, item.text, item.description, task.topP, task.temp]);

    function submit() {
        setFormState("loading");
        updateTask(String(item.id), { title, description, topP, temp });
        setItems((prev: any) => prev.map((i: any) => i.id === item.id ? { ...i, text: title, description } : i));

        setTimeout(() => {
            setFormState("success");
            setTimeout(() => {
                setOpen(false);
                setFormState("idle");
            }, 1000);
        }, 800);
    }

    return (
        <PopoverForm
            id={String(item.id)}
            title="Task Settings"
            open={open}
            setOpen={setOpen}
            width="340px"
            height="318px"
            showCloseButton={formState !== "success"}
            showSuccess={formState === "success"}
            triggerNode={
                <Settings2Icon
                    className="stroke-1 h-4 w-4 text-zinc-500 hover:text-[#13EEE3]/70 hover:stroke-[#13EEE3]/70 transition-colors cursor-pointer"
                />
            }
            openChild={
                <form
                    onSubmit={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        submit();
                    }}
                    className="flex flex-col gap-3 p-3 pt-8 pb-1 z-50 relative"
                >
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono text-zinc-500 block">Task Title</label>
                        <input
                            required
                            autoFocus
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs font-mono text-white placeholder:text-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#13EEE3]/50"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="text-[10px] uppercase font-mono text-zinc-500 block">Context / Directive</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            className="h-20 w-full resize-none rounded-md bg-zinc-900/50 border border-zinc-800 px-2 py-1.5 text-[11px] font-mono text-white placeholder:text-white/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#13EEE3]/50"
                        />
                    </div>
                    <div className="flex gap-4">
                        <div className="space-y-1 flex-1">
                            <label className="text-[10px] uppercase font-mono text-zinc-500 block">Top P: {topP}</label>
                            <Slider
                                max={1}
                                value={[topP]}
                                step={0.1}
                                onValueChange={(v) => setTopP(v[0])}
                                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-3 [&_[role=slider]]:rounded-[2px] [&_[role=slider]]:border-zinc-800 [&_[role=slider]]:bg-zinc-300"
                            />
                        </div>
                        <div className="space-y-1 flex-1">
                            <label className="text-[10px] uppercase font-mono text-zinc-500 block">Temp: {temp}</label>
                            <Slider
                                max={2}
                                value={[temp]}
                                step={0.1}
                                onValueChange={(v) => setTemp(v[0])}
                                className="[&_[role=slider]]:h-4 [&_[role=slider]]:w-3 [&_[role=slider]]:rounded-[2px] [&_[role=slider]]:border-zinc-800 [&_[role=slider]]:bg-zinc-300"
                            />
                        </div>
                    </div>

                    <div className="relative flex h-12 items-center px-1 mt-2">
                        <PopoverFormSeparator width="100%" />
                        <div className="absolute left-0 top-0 -translate-x-[1.5px] -translate-y-1/2">
                            <PopoverFormCutOutLeftIcon />
                        </div>
                        <div className="absolute right-0 top-0 translate-x-[1.5px] -translate-y-1/2 rotate-180">
                            <PopoverFormCutOutRightIcon />
                        </div>
                        <PopoverFormButton loading={formState === "loading"} text="SAVE CONFIG" />
                    </div>
                </form>
            }
            successChild={
                <PopoverFormSuccess
                    title="Config Saved"
                    description="The task parameters have been updated."
                />
            }
        />
    )
}

export function AgentTasks({ agentId, onPopoverChange }: { agentId: string; onPopoverChange?: (isOpen: boolean) => void }) {
    const { tasks, addTask, updateTask, updateTaskStatus, removeTask } = useTaskStore();
    const { sendChatMessage } = useSocket();
    const { sessions } = useSocketStore();

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

    const [openItemId, setOpenItemId] = useState<string | number | null>(null);

    // Notify parent when popover open state changes
    useEffect(() => {
        onPopoverChange?.(openItemId !== null);
    }, [openItemId, onPopoverChange]);
    const [tabChangeRerender, setTabChangeRerender] = useState<number>(1);
    const [isDeleteMode, setIsDeleteMode] = useState(false);

    const handleCompleteItem = (id: string | number) => {
        const t = agentTasks.find((task) => task.id === id);
        if (t) {
            updateTaskStatus(t.id, t.status === "DONE" ? "PENDING" : "DONE");
        }
    };

    const handleAddItem = () => {
        const id = `task-${Date.now()}`;
        addTask({
            id,
            title: `New Task`,
            description: "",
            agentId,
            status: "PENDING",
            priority: "MEDIUM",
            topP: 0.9,
            temp: 0.7,
            tokens: 4000,
            updatedAt: Date.now(),
            timestamp: new Date().toLocaleTimeString(),
        });
        // Remove setOpenItemId(id) so it doesn't auto-open
    };

    const handleRemoveItem = (id: string | number) => {
        removeTask(String(id));
    };

    const handleCloseOnDrag = useCallback(() => {
        setOpenItemId(null);
    }, []);

    const handleExecute = (taskId: string | number) => {
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

        const directive = t.description
            ? `[SYSTEM DIRECTIVE]: Execute the following task immediately:\n\nTitle: ${t.title}\nDescription: ${t.description}\nPriority: ${t.priority}`
            : `[SYSTEM DIRECTIVE]: Execute the following task immediately:\n\n${t.title}`;

        sendChatMessage(agentId, directive, sessionKey);
        updateTaskStatus(t.id, "IN_PROGRESS");
    };

    const renderListItem = (
        item: Item,
        order: number,
        onCompleteItem: (id: string | number) => void,
        onRemoveItem: (id: string | number) => void
    ) => {
        const isOpen = item.id === openItemId;
        const task = agentTasks.find(t => t.id === String(item.id));
        if (!task) return null;

        return (
            <SortableListItem
                item={item}
                order={order}
                key={item.id}
                isDeleteMode={isDeleteMode}
                isActive={isOpen}
                onCompleteItem={onCompleteItem}
                onRemoveItem={onRemoveItem}
                handleDrag={handleCloseOnDrag}
                className="my-1.5"
                renderExtra={(item: any) => (
                    <div
                        className="flex items-center shrink-0 py-2 pr-3 pl-1"
                    >
                        <div className={`relative ml-auto flex items-center gap-2 ${isOpen ? 'z-[100]' : 'z-10'}`}>
                            {task.status === "PENDING" && (
                                <div className="flex items-center" onClick={(e) => { e.stopPropagation(); handleExecute(item.id); }}>
                                    <Play className="w-4 h-4 fill-amber-500 text-amber-500 hover:fill-amber-400 hover:text-amber-400 cursor-pointer transition-colors drop-shadow-[0_0_5px_rgba(217,119,6,0.3)]" />
                                </div>
                            )}
                            <TaskSettingsPopover
                                item={item}
                                task={task}
                                updateTask={updateTask}
                                setItems={setItems}
                                open={isOpen}
                                setOpen={(open: boolean) => setOpenItemId(open ? item.id : null)}
                            />
                        </div>
                    </div>
                )}
            />
        );
    };

    return (
        <div className="w-full">
            <div className="rounded-3xl bg-background/60 p-4 flex flex-col gap-4 mx-2 mb-2">
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
        </div>
    );
}
