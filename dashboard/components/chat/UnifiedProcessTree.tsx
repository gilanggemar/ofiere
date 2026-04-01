"use client";

import React, { useMemo, useState, useCallback, useRef, createContext, useContext } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    ChevronRight,
    ChevronDown,
    CheckCircle2,
    Circle,
    ArrowRightCircle,
    XCircle,
    Terminal,
    Wrench,
    Brain,
    Zap,
    Trash2,
    ChevronsDownUp,
    ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import useAgentZeroStore from "@/store/useAgentZeroStore";
import { useSocketStore } from "@/lib/useSocket";
import { useOpenClawStore, type AgentRun, type ToolCallEvent } from "@/store/useOpenClawStore";

// ─── Tree Node Data ───

interface ProcessNode {
    id: string;
    name: string;
    status: "pending" | "running" | "done" | "error";
    children: ProcessNode[];
    detail?: string;
    toolName?: string;
    toolArgs?: any;
    output?: string;
    thoughts?: string[];
    timestamp?: string;
}

// ─── Expand/Collapse Context ───
// A generation counter that forces all TreeNodeViews to re-evaluate their expanded state.
interface TreeControlCtx {
    /** Incremented on "collapse all" */
    collapseGen: number;
    /** Incremented on "expand all" */
    expandGen: number;
}
const TreeControlContext = createContext<TreeControlCtx>({ collapseGen: 0, expandGen: 0 });

// ─── Agent Zero Parser ───

function parseAgentZeroData(content: any): {
    headline?: string;
    tool_name?: string;
    tool_args?: Record<string, any>;
    detail?: string;
    thoughts?: string[];
} | null {
    if (!content) return null;
    if (typeof content === "object" && (content.headline || content.tool_name || content.thoughts)) {
        return content;
    }
    if (typeof content === "string") {
        try {
            let jsonStr = content.trim();
            if (jsonStr.startsWith("```")) {
                const lines = jsonStr.split("\n");
                if (lines.length > 2) jsonStr = lines.slice(1, -1).join("\n").trim();
            }
            const parsed = JSON.parse(jsonStr);
            if (parsed.headline || parsed.tool_name || parsed.thoughts) return parsed;
        } catch {
            return null;
        }
    }
    return null;
}

// ─── Tree Node Renderer ───

const TreeNodeView = ({ node, level = 0 }: { node: ProcessNode; level?: number }) => {
    const { collapseGen, expandGen } = useContext(TreeControlContext);
    // Default: collapsed for all levels (requirement #2)
    const [expanded, setExpanded] = React.useState(false);

    // React to collapse-all / expand-all signals
    React.useEffect(() => {
        if (collapseGen > 0) setExpanded(false);
    }, [collapseGen]);

    React.useEffect(() => {
        if (expandGen > 0) setExpanded(true);
    }, [expandGen]);

    if (!node) return null;

    const hasChildren = node.children.length > 0 || !!node.detail || !!node.toolArgs || !!node.output;

    const statusIcon = () => {
        switch (node.status) {
            case "done":
                return <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />;
            case "running":
                return <ArrowRightCircle size={12} className="text-cyan-400 animate-pulse shrink-0" />;
            case "error":
                return <XCircle size={12} className="text-red-400 shrink-0" />;
            default:
                return <Circle size={12} className="text-zinc-500 shrink-0" />;
        }
    };

    const typeIcon = () => {
        if (node.toolName) {
            if (node.toolName.toLowerCase().includes("exec") || node.toolName.toLowerCase().includes("terminal") || node.toolName.toLowerCase().includes("bash") || node.toolName.toLowerCase().includes("shell")) {
                return <Terminal size={11} className="text-orange-400 shrink-0" />;
            }
            if (node.toolName.toLowerCase().includes("think") || node.toolName.toLowerCase().includes("reason")) {
                return <Brain size={11} className="text-purple-400 shrink-0" />;
            }
            return <Wrench size={11} className="text-cyan-400 shrink-0" />;
        }
        if (node.thoughts?.length) return <Brain size={11} className="text-purple-400 shrink-0" />;
        return <Zap size={11} className="text-orange-400/60 shrink-0" />;
    };

    return (
        <div className="flex flex-col w-full">
            <div
                className={cn(
                    "flex items-center gap-1.5 py-1.5 px-2 hover:bg-white/5 rounded-md cursor-pointer text-xs transition-colors",
                    level === 0 ? "font-medium" : "text-muted-foreground opacity-90"
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => setExpanded(!expanded)}
            >
                {/* Expand arrow */}
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                    {hasChildren ? (
                        expanded ? (
                            <ChevronDown size={12} className="opacity-50" />
                        ) : (
                            <ChevronRight size={12} className="opacity-50" />
                        )
                    ) : null}
                </div>

                {/* Status icon */}
                {statusIcon()}

                {/* Type icon */}
                {typeIcon()}

                {/* Name */}
                <span className="truncate flex-1">{node.name}</span>

                {/* Timestamp */}
                {node.timestamp && (
                    <span className="text-[9px] text-muted-foreground/40 shrink-0 ml-auto">{node.timestamp}</span>
                )}
            </div>

            {/* Expanded details */}
            {expanded && hasChildren && (
                <div
                    className="flex flex-col relative"
                    style={{ marginLeft: `${level * 12 + 14}px` }}
                >
                    <div className="absolute inset-y-0 left-[2px] w-px bg-white/8" />

                    {/* Tool name badge */}
                    {node.toolName && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Tool</span>
                            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-400/10 border border-cyan-400/20 px-1.5 py-0.5 rounded-sm w-fit">
                                {node.toolName}
                            </span>
                        </div>
                    )}

                    {/* Detail */}
                    {node.detail && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Detail</span>
                            <span className="text-muted-foreground leading-snug text-[11px]">{node.detail}</span>
                        </div>
                    )}

                    {/* Thoughts / Steps */}
                    {node.thoughts && node.thoughts.length > 0 && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Steps</span>
                            <ul className="list-disc list-outside ml-3.5 flex flex-col gap-0.5 text-muted-foreground/80 text-[11px]">
                                {node.thoughts.map((t, i) => (
                                    <li key={i} className="leading-snug">{t}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Tool Args */}
                    {node.toolArgs && Object.keys(node.toolArgs).length > 0 && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Input</span>
                            <div className="bg-black/40 p-2 rounded-md overflow-x-auto border border-white/5 max-h-[120px]">
                                <pre className="text-[10px] font-mono text-muted-foreground/80 m-0 whitespace-pre-wrap">
                                    {typeof node.toolArgs === "string" ? node.toolArgs : JSON.stringify(node.toolArgs, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Output */}
                    {node.output && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Output</span>
                            <div className="bg-black/40 p-2 rounded-md overflow-x-auto border border-white/5 max-h-[120px]">
                                <pre className="text-[10px] font-mono text-muted-foreground/80 m-0 whitespace-pre-wrap">
                                    {node.output.slice(0, 2000)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Child nodes */}
                    {node.children.map((child) => (
                        <TreeNodeView key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Parse tool calls from inline text markup ───
// Uses brace-counting parser for correct nested JSON handling

import { parseOpenClawToolCalls, type ToolCallBlock } from "@/lib/openclawToolParser";

// ─── Build OpenClaw Process Tree from Active Runs + Chat Messages ───

/**
 * Split thinking text into readable chunks for display as thought steps.
 * Splits on double-newlines or sentence boundaries for longer blocks.
 */
function splitThinkingIntoSteps(text: string): string[] {
    if (!text || !text.trim()) return [];
    // Split on double newlines first
    const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;
    // If single block, split on single newlines
    const lines = text.split(/\n/).map(l => l.trim()).filter(Boolean);
    return lines;
}

/**
 * Build a tool call ProcessNode from a ToolCallEvent.
 */
function buildToolCallNode(tc: ToolCallEvent): ProcessNode {
    let parsedArgs: any = tc.input || {};
    if (typeof parsedArgs === "string") {
        try { parsedArgs = JSON.parse(parsedArgs); } catch { /* keep as string */ }
    }

    let outputStr: string | undefined = undefined;
    if (tc.output) {
        if (typeof tc.output === "string") {
            try {
                const outObj = JSON.parse(tc.output);
                outputStr = JSON.stringify(outObj, null, 2);
            } catch {
                outputStr = tc.output;
            }
        } else {
            outputStr = JSON.stringify(tc.output, null, 2);
        }
    }

    const status = tc.status === "completed" ? "done"
        : tc.status === "error" ? "error"
            : "running";

    return {
        id: tc.id,
        name: tc.toolName || "unknown_tool",
        status,
        toolName: tc.toolName,
        toolArgs: parsedArgs,
        output: outputStr,
        children: [],
        timestamp: tc.startedAt ? new Date(tc.startedAt).toLocaleTimeString() : undefined,
    };
}

function buildOpenClawTree(
    agentId: string,
    activeRuns: Map<string, AgentRun>,
    chatMessages: any[]
): ProcessNode[] {
    const nodes: ProcessNode[] = [];
    const seenRunIds = new Set<string>();

    // === Source 1: Active runs from the OpenClaw store (live / streaming) ===
    activeRuns.forEach((run) => {
        // Filter to only runs that belong to this agent's sessions
        if (!run.sessionKey.includes(agentId)) return;
        seenRunIds.add(run.runId);

        const isRunning = run.status === "running";
        const runChildren: ProcessNode[] = [];

        // 1a. Thinking node — shows the agent's reasoning in real-time
        if (run.thinkingText && run.thinkingText.trim()) {
            const thoughtSteps = splitThinkingIntoSteps(run.thinkingText);
            runChildren.push({
                id: `thinking-${run.runId}`,
                name: "Thinking",
                status: isRunning ? "running" : "done",
                children: [],
                thoughts: thoughtSteps,
                timestamp: new Date(run.startedAt).toLocaleTimeString(),
            });
        }

        // 1b. Tool call nodes
        run.toolCalls.forEach((tc) => {
            runChildren.push(buildToolCallNode(tc));
        });

        // Root node for this run
        nodes.push({
            id: `run-${run.runId}`,
            name: isRunning ? "Agent Processing…" : "Agent Response",
            status: run.status === "error" ? "error" : isRunning ? "running" : "done",
            children: runChildren,
            timestamp: new Date(run.startedAt).toLocaleTimeString(),
        });
    });

    // === Source 2: Completed runs from chat messages (historical fallback) ===
    const agentMsgs = chatMessages.filter(
        (m) =>
            m.role === "assistant" &&
            (m.agentId === agentId || m.agentId?.includes(agentId) || agentId?.includes(m.agentId || ""))
    );

    agentMsgs.forEach((msg) => {
        // Skip if we already have this run from the active runs
        if (msg.runId && seenRunIds.has(msg.runId)) return;

        const msgChildren: ProcessNode[] = [];

        // Check msg.tool_calls[]
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            msg.tool_calls.forEach((tc: any, idx: number) => {
                const funcName = tc.function?.name || tc.toolName || tc.name || "unknown_tool";
                const tcId = tc.id || `tc-${msg.id}-${idx}`;

                let parsedArgs: any = tc.function?.arguments || tc.input || tc.args || "";
                if (typeof parsedArgs === "string") {
                    try { parsedArgs = JSON.parse(parsedArgs); } catch { /* keep as string */ }
                }

                let outputStr: string | undefined = undefined;
                if (tc.output) {
                    if (typeof tc.output === "string") {
                        try {
                            const outObj = JSON.parse(tc.output);
                            outputStr = JSON.stringify(outObj, null, 2);
                        } catch {
                            outputStr = tc.output;
                        }
                    } else {
                        outputStr = JSON.stringify(tc.output, null, 2);
                    }
                } else if (tc._parsed?.output) {
                    outputStr = JSON.stringify(tc._parsed.output, null, 2);
                }

                const status = tc.status === "completed" || tc.status === "done"
                    ? "done"
                    : tc.status === "failed" || tc.status === "error"
                        ? "error"
                        : tc.status === "in_progress" || tc.status === "running"
                            ? "running"
                            : "done";

                msgChildren.push({
                    id: tcId,
                    name: funcName,
                    status,
                    toolName: funcName,
                    toolArgs: parsedArgs,
                    output: outputStr,
                    children: [],
                    timestamp: msg.timestamp,
                });
            });
        }

        // Fallback — parse inline tool markup from message text
        if (msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
            const parseResult = parseOpenClawToolCalls(msg.content);
            parseResult.toolCalls.forEach((tc, idx) => {
                let outputStr: string | undefined = undefined;
                if (tc.output) {
                    outputStr = JSON.stringify(tc.output, null, 2);
                }

                msgChildren.push({
                    id: tc.id || `inline-${msg.id}-${idx}`,
                    name: tc.toolName,
                    status: tc.status === "completed" ? "done" : tc.status === "error" ? "error" : (msg.streaming ? "running" : "done"),
                    toolName: tc.toolName,
                    toolArgs: tc.input,
                    output: outputStr,
                    children: [],
                    timestamp: msg.timestamp,
                });
            });
        }

        // Only add a node if there's actual content to show
        if (msgChildren.length > 0) {
            nodes.push({
                id: `msg-run-${msg.id}`,
                name: "Agent Response",
                status: "done",
                children: msgChildren,
                timestamp: msg.timestamp,
            });
        }
    });

    return nodes.reverse(); // newest first
}

// ─── Build Agent Zero Process Tree from Logs ───

function buildAgentZeroTree(logs: any[], isResponding: boolean): ProcessNode[] {
    const roots: ProcessNode[] = [];
    let currentProcess: ProcessNode | null = null;

    logs.forEach((log: any, index: number) => {
        const node: ProcessNode = {
            id: `log-${index}`,
            name: "Process",
            status: "done",
            children: [],
        };

        const parsed = parseAgentZeroData(log.content || log.message);

        if (parsed) {
            node.name = parsed.headline || "Process Detail";
            node.toolName = parsed.tool_name;
            node.toolArgs = parsed.tool_args;
            node.detail = parsed.detail;
            node.thoughts = parsed.thoughts;
            roots.push(node);
            currentProcess = null;
        } else if (log.type === "tool_call" || log.type === "execute") {
            node.name = `Executing: ${log.name || log.type}`;
            node.status = "running";
            roots.push(node);
            currentProcess = node;
        } else if (log.type === "tool_result" || log.type === "result") {
            if (currentProcess) {
                node.name = "Result";
                node.output = typeof log.content === "string" ? log.content : JSON.stringify(log.content);
                currentProcess.children.push(node);
                currentProcess.status = "done";
            } else {
                node.name = "Result";
                roots.push(node);
            }
        }
    });

    if (isResponding && roots.length > 0) {
        roots[roots.length - 1].status = "running";
    }

    return roots.reverse();
}

// ─── Main Component ───

export const UnifiedProcessTree = ({
    agentId,
    provider,
    className,
    messages,
}: {
    agentId: string;
    provider: "openclaw" | "agent-zero" | "external";
    className?: string;
    messages?: any[];
}) => {
    // Agent Zero stores (only used for agent-zero/external providers)
    const a0Logs = useAgentZeroStore((s) => s.logs);
    const a0IsResponding = useAgentZeroStore((s) => s.isResponding);

    // OpenClaw stores (only used for openclaw provider)
    const openClawActiveRuns = useOpenClawStore((s) => s.activeRuns);
    const storeChatMessages = useSocketStore((s) => s.chatMessages);
    const chatMessagesSource = messages ?? storeChatMessages;

    // ─── Local UI state ───
    const [collapseGen, setCollapseGen] = useState(0);
    const [expandGen, setExpandGen] = useState(0);
    const clearedIdsRef = useRef<Set<string>>(new Set());
    const [clearTrigger, setClearTrigger] = useState(0);

    const treeData = useMemo(() => {
        if (provider === "agent-zero" || provider === "external") {
            return buildAgentZeroTree(a0Logs, a0IsResponding);
        }
        return buildOpenClawTree(agentId, openClawActiveRuns, chatMessagesSource);
    }, [provider, agentId, a0Logs, a0IsResponding, openClawActiveRuns, chatMessagesSource]);

    // Filter out cleared processes
    const displayData = useMemo(() => {
        if (clearedIdsRef.current.size === 0) return treeData;
        return treeData.filter(n => !clearedIdsRef.current.has(n.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeData, clearTrigger]);

    const handleClear = useCallback(() => {
        // Mark all current process IDs as cleared
        treeData.forEach(n => clearedIdsRef.current.add(n.id));
        // For OpenClaw: also clear active runs
        const sk = `agent:${agentId}:nchat`;
        useOpenClawStore.getState().clearRunsForSession(sk);
        // For Agent Zero: clear logs
        if (provider === "agent-zero" || provider === "external") {
            useAgentZeroStore.getState().setLogs([]);
        }
        setClearTrigger(t => t + 1);
    }, [agentId, provider, treeData]);

    const handleCollapseAll = useCallback(() => {
        setCollapseGen(g => g + 1);
    }, []);

    const handleExpandAll = useCallback(() => {
        setExpandGen(g => g + 1);
    }, []);
    const ctxValue = useMemo(() => ({ collapseGen, expandGen }), [collapseGen, expandGen]);

    return (
        <TreeControlContext.Provider value={ctxValue}>
            <div className={cn("flex flex-col overflow-hidden rounded-md border border-white/[0.06] h-full", className)}
                style={{ background: 'linear-gradient(180deg, rgba(12,11,10,0.75) 0%, rgba(8,7,6,0.65) 100%)' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/[0.06] shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <span className="text-xs font-medium opacity-80 uppercase tracking-widest text-[10px]">
                        Process Hierarchy
                    </span>

                    <div className="flex items-center gap-0.5">
                        {/* Process count */}
                        {displayData.length > 0 && (
                            <span className="text-[9px] text-muted-foreground/40 mr-1.5">
                                {displayData.filter((n) => n.status === "running").length > 0 && (
                                    <span className="text-cyan-400 animate-pulse mr-1">●</span>
                                )}
                                {displayData.length}
                            </span>
                        )}

                        {/* Collapse All */}
                        <button
                            onClick={handleCollapseAll}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
                            title="Collapse all"
                        >
                            <ChevronsDownUp size={13} />
                        </button>

                        {/* Expand All */}
                        <button
                            onClick={handleExpandAll}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
                            title="Expand all"
                        >
                            <ChevronsUpDown size={13} />
                        </button>

                        {/* Clear / Delete */}
                        <button
                            onClick={handleClear}
                            className="p-1 rounded hover:bg-red-500/15 transition-colors text-muted-foreground/50 hover:text-red-400"
                            title="Clear processes"
                        >
                            <Trash2 size={13} />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <ScrollArea className="flex-1 min-h-0 p-2">
                        {displayData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-xs text-muted-foreground/50 p-4 text-center">
                                No active processes
                            </div>
                        ) : (
                            <div className="flex flex-col gap-0.5 pb-4">
                                {displayData.map((rootNode) => (
                                    <TreeNodeView key={rootNode.id} node={rootNode} />
                                ))}
                            </div>
                        )}
                </ScrollArea>
            </div>
        </TreeControlContext.Provider>
    );
};
