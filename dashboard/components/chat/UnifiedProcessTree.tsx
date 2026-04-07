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
    MessageSquare,
    Globe,
    FileText,
    Code,
    Search,
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
    /** Sorting key — epoch ms for chronological ordering */
    sortKey?: number;
    /** Node type for display differentiation */
    nodeType?: "tool" | "tool-group" | "chat" | "thinking" | "run";
}

// ─── Expand/Collapse Context ───
interface TreeControlCtx {
    collapseGen: number;
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

// ─── Tool Name Helpers ───

/** Convert snake_case/camelCase tool names to display-friendly format */
function formatToolName(raw: string): string {
    if (!raw || raw === "unknown" || raw === "unknown_tool") return "Tool Call";
    return raw
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

/** Get a descriptive icon for a tool name */
function getToolIcon(toolName: string): React.ReactNode {
    const name = (toolName || '').toLowerCase();
    if (name.includes('exec') || name.includes('terminal') || name.includes('bash') || name.includes('shell') || name.includes('command')) {
        return <Terminal size={11} className="text-orange-400 shrink-0" />;
    }
    if (name.includes('search') || name.includes('web') || name.includes('browse')) {
        return <Globe size={11} className="text-blue-400 shrink-0" />;
    }
    if (name.includes('read') || name.includes('file') || name.includes('write') || name.includes('memory')) {
        return <FileText size={11} className="text-green-400 shrink-0" />;
    }
    if (name.includes('code') || name.includes('edit') || name.includes('patch')) {
        return <Code size={11} className="text-purple-400 shrink-0" />;
    }
    if (name.includes('think') || name.includes('reason')) {
        return <Brain size={11} className="text-purple-400 shrink-0" />;
    }
    if (name.includes('find') || name.includes('query') || name.includes('lookup')) {
        return <Search size={11} className="text-yellow-400 shrink-0" />;
    }
    return <Wrench size={11} className="text-cyan-400 shrink-0" />;
}

/** Get a brief summary of tool input for inline display */
function getToolSummary(toolName: string, input: any): string | null {
    if (!input) return null;
    if (typeof input === 'string') return input.slice(0, 80);
    // Context-aware summaries based on tool name
    const name = (toolName || '').toLowerCase();
    if (name.includes('exec') && input.command) return input.command.slice(0, 80);
    if (name.includes('search') && input.query) return input.query.slice(0, 80);
    if (name.includes('search') && input.for) return input.for.slice(0, 80);
    if (input.command) return input.command.slice(0, 80);
    if (input.query) return input.query.slice(0, 80);
    if (input.path) return input.path.slice(0, 80);
    if (input.url) return input.url.slice(0, 80);
    if (input.code) return input.code.slice(0, 60);
    if (input.text) return input.text.slice(0, 80);
    if (input.content) return input.content.slice(0, 80);
    const keys = Object.keys(input);
    if (keys.length === 0) return null;
    const firstVal = input[keys[0]];
    if (typeof firstVal === 'string') return `${firstVal.slice(0, 60)}`;
    return null;
}

/** Parse a timestamp safely, returns epoch ms or null */
function safeTimestamp(ts: any): number | null {
    if (!ts) return null;
    if (typeof ts === 'number' && !isNaN(ts) && ts > 0) return ts;
    if (typeof ts === 'string') {
        const parsed = new Date(ts).getTime();
        if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    return null;
}

/** Format epoch ms to time string, or return empty */
function formatTime(epochMs: number | null | undefined): string {
    if (!epochMs || isNaN(epochMs)) return '';
    return new Date(epochMs).toLocaleTimeString();
}

// ─── Tree Node Renderer ───

const TreeNodeView = ({ node, level = 0 }: { node: ProcessNode; level?: number }) => {
    const { collapseGen, expandGen } = useContext(TreeControlContext);
    const [expanded, setExpanded] = React.useState(false);

    React.useEffect(() => {
        if (collapseGen > 0) setExpanded(false);
    }, [collapseGen]);

    React.useEffect(() => {
        if (expandGen > 0) setExpanded(true);
    }, [expandGen]);

    if (!node) return null;

    const isTool = node.nodeType === 'tool';
    const isToolGroup = node.nodeType === 'tool-group';
    const isChat = node.nodeType === 'chat';

    // Tool nodes are always expandable (show status/timing even with no args)
    const hasNonEmptyArgs = node.toolArgs && typeof node.toolArgs === 'object' && Object.keys(node.toolArgs).length > 0;
    const hasExpandableContent = node.children.length > 0 || !!node.detail || hasNonEmptyArgs || !!node.output
        || isTool; // Tools always expandable — show at minimum status + timing

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
        if (isTool) return getToolIcon(node.toolName || node.name);
        if (isToolGroup) return <Zap size={11} className="text-orange-400 shrink-0" />;
        if (isChat) return <MessageSquare size={11} className="text-zinc-400 shrink-0" />;
        if (node.thoughts?.length) return <Brain size={11} className="text-purple-400 shrink-0" />;
        return <Zap size={11} className="text-orange-400/60 shrink-0" />;
    };

    // Build the display name with inline summary for tools
    const displayName = () => {
        if (isTool) {
            const toolDisplay = formatToolName(node.toolName || node.name);
            const summary = getToolSummary(node.toolName || '', node.toolArgs);
            if (summary) {
                return (
                    <span className="truncate flex-1 min-w-0">
                        <span className="text-white/90">{toolDisplay}</span>
                        <span className="text-muted-foreground/30 mx-1">·</span>
                        <span className="text-muted-foreground/50 font-mono text-[10px]">{summary}</span>
                    </span>
                );
            }
            return <span className="truncate flex-1 text-white/90">{toolDisplay}</span>;
        }
        return <span className="truncate flex-1">{node.name}</span>;
    };

    return (
        <div className="flex flex-col w-full min-w-0">
            <div
                className={cn(
                    "flex items-center gap-1 py-1.5 px-2 rounded-md text-xs transition-colors min-w-0",
                    level === 0 ? "font-medium" : "text-muted-foreground opacity-90",
                    hasExpandableContent ? "hover:bg-white/5 cursor-pointer" : ""
                )}
                style={{ paddingLeft: `${level * 12 + 8}px` }}
                onClick={() => hasExpandableContent && setExpanded(!expanded)}
            >
                {/* Text content area — overflow hidden so text truncates */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0 overflow-hidden">
                    {/* Expand arrow OR type icon for non-expandable nodes */}
                    {hasExpandableContent ? (
                        <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                            {expanded ? (
                                <ChevronDown size={12} className="opacity-50" />
                            ) : (
                                <ChevronRight size={12} className="opacity-50" />
                            )}
                        </div>
                    ) : (
                        <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                            {typeIcon()}
                        </div>
                    )}

                    {/* Type icon (only for expandable nodes — non-expandable already have it in the arrow slot) */}
                    {hasExpandableContent && typeIcon()}
                    {displayName()}
                </div>

                {/* Status icon on the right — OUTSIDE overflow area so it's never clipped */}
                <div className="shrink-0 ml-1">
                    {statusIcon()}
                </div>
            </div>

            {/* Expanded content */}
            {expanded && hasExpandableContent && (
                <div
                    className="flex flex-col relative min-w-0"
                    style={{
                        marginLeft: `${level * 12 + 14}px`,
                        width: `calc(100% - ${level * 12 + 14}px)`,
                    }}
                >
                    <div className="absolute inset-y-0 left-[1px] w-px bg-white/8" />

                    {/* Timestamp (visible only when expanded) */}
                    {!isTool && node.timestamp && (
                        <div className="py-1 pl-4 text-[9px] text-muted-foreground/40">
                            {node.timestamp}
                        </div>
                    )}

                    {/* Detail text (for chat responses) */}
                    {node.detail && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Detail</span>
                            <span className="text-muted-foreground leading-snug text-[11px]">{node.detail}</span>
                        </div>
                    )}

                    {/* Thoughts (for thinking nodes) */}
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

                    {/* Tool status bar — always visible for tool nodes */}
                    {isTool && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4">
                            <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 flex-wrap">
                                <span className="font-mono text-cyan-400/80 bg-cyan-400/10 border border-cyan-400/15 px-1.5 py-0.5 rounded-sm">
                                    {node.toolName || node.name}
                                </span>
                                <span className={cn(
                                    "uppercase text-[9px] tracking-wider font-medium",
                                    node.status === 'done' ? 'text-emerald-400/70' :
                                    node.status === 'running' ? 'text-cyan-400/70' :
                                    node.status === 'error' ? 'text-red-400/70' : 'text-zinc-500'
                                )}>
                                    {node.status === 'done' ? 'completed' : node.status}
                                </span>
                            </div>
                            {node.timestamp && (
                                <span className="text-[9px] text-muted-foreground/40">{node.timestamp}</span>
                            )}
                        </div>
                    )}

                    {/* Tool Input */}
                    {hasNonEmptyArgs && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Input</span>
                            <div className="bg-black/40 p-2 rounded-md overflow-x-auto border border-white/5 max-h-[120px]">
                                <pre className="text-[10px] font-mono text-muted-foreground/80 m-0 whitespace-pre-wrap">
                                    {typeof node.toolArgs === "string" ? node.toolArgs : JSON.stringify(node.toolArgs, null, 2)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Meta — gateway description of what the tool did */}
                    {node.detail && isTool && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Description</span>
                            <span className="text-muted-foreground/70 text-[11px] leading-snug">{node.detail}</span>
                        </div>
                    )}

                    {/* Tool Output */}
                    {node.output && (
                        <div className="flex flex-col gap-1 py-1.5 pl-4 text-xs">
                            <span className="text-muted-foreground/50 uppercase text-[9px] tracking-wider font-medium">Output</span>
                            <div className="bg-black/40 p-2 rounded-md overflow-x-auto border border-white/5 max-h-[160px]">
                                <pre className="text-[10px] font-mono text-muted-foreground/80 m-0 whitespace-pre-wrap">
                                    {node.output.slice(0, 2000)}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Children */}
                    {node.children.map((child) => (
                        <TreeNodeView key={child.id} node={child} level={level + 1} />
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── Parse tool calls from inline text markup ───
import { parseOpenClawToolCalls, type ToolCallBlock } from "@/lib/openclawToolParser";

// ─── Build OpenClaw Process Tree ───

function splitThinkingIntoSteps(text: string): string[] {
    if (!text || !text.trim()) return [];
    const blocks = text.split(/\n\n+/).map(b => b.trim()).filter(Boolean);
    if (blocks.length > 1) return blocks;
    return text.split(/\n/).map(l => l.trim()).filter(Boolean);
}

/**
 * Build a tool call child node (used inside a tool group).
 */
function buildToolChildNode(tc: ToolCallEvent): ProcessNode {
    let parsedArgs: any = tc.input || {};
    if (typeof parsedArgs === "string") {
        try { parsedArgs = JSON.parse(parsedArgs); } catch { /* keep */ }
    }

    let outputStr: string | undefined;
    if (tc.output) {
        if (typeof tc.output === "string") {
            try { outputStr = JSON.stringify(JSON.parse(tc.output), null, 2); }
            catch { outputStr = tc.output; }
        } else {
            outputStr = JSON.stringify(tc.output, null, 2);
        }
    }

    const status = tc.status === "completed" ? "done"
        : tc.status === "error" ? "error"
        : "running";

    return {
        id: tc.id,
        name: tc.toolName || "unknown",
        status,
        toolName: tc.toolName,
        toolArgs: parsedArgs,
        output: outputStr,
        detail: tc.meta || undefined,  // gateway description
        children: [],
        timestamp: formatTime(tc.startedAt),
        sortKey: tc.startedAt || Date.now(),
        nodeType: "tool",
    };
}

/**
 * Build process tree: 
 * - Each run with tool calls → "N Tool Call(s)" group containing individual tool children
 * - Single tool call → shows tool name directly at top level
 * - Chat responses → "Chat Response" node
 * - Everything sorted chronologically (newest first)
 */
function buildOpenClawTree(
    agentId: string,
    activeRuns: Map<string, AgentRun>,
    chatMessages: any[]
): ProcessNode[] {
    const nodes: ProcessNode[] = [];
    const seenRunIds = new Set<string>();
    const seenToolCallIds = new Set<string>();

    // === Source 1: Active runs from WebSocket events ===
    activeRuns.forEach((run) => {
        const sk = run.sessionKey || '';
        const matchesAgent = sk.includes(agentId) 
            || sk === 'unknown' 
            || sk === 'agent:default:main'
            || !agentId;
        if (!matchesAgent) return;
        seenRunIds.add(run.runId);

        const isRunning = run.status === "running";
        const runTime = run.startedAt;

        // Mark all tool call IDs as seen
        run.toolCalls.forEach(tc => seenToolCallIds.add(tc.id));

        // Tool calls — each one is its own top-level node
        if (run.toolCalls.length > 0) {
            run.toolCalls.forEach(tc => {
                const child = buildToolChildNode(tc);
                nodes.push({
                    ...child,
                    sortKey: tc.startedAt || runTime,
                });
            });
        }

        // Thinking node
        if (run.thinkingText && run.thinkingText.trim()) {
            const thoughtSteps = splitThinkingIntoSteps(run.thinkingText);
            nodes.push({
                id: `thinking-${run.runId}`,
                name: "Thinking",
                status: isRunning ? "running" : "done",
                children: [],
                thoughts: thoughtSteps,
                timestamp: formatTime(runTime),
                sortKey: runTime,
                nodeType: "thinking",
            });
        }

        // Chat response — only for completed runs with text
        if (run.assistantText.trim() && run.status === "completed") {
            nodes.push({
                id: `chat-${run.runId}`,
                name: "Chat Response",
                status: "done",
                children: [],
                timestamp: formatTime(run.completedAt || runTime),
                sortKey: run.completedAt || runTime + 1,
                nodeType: "chat",
            });
        }

        // Processing indicator for runs with no content yet
        if (isRunning && run.toolCalls.length === 0 && !run.assistantText.trim() && !run.thinkingText.trim()) {
            nodes.push({
                id: `processing-${run.runId}`,
                name: "Processing…",
                status: "running",
                children: [],
                timestamp: formatTime(runTime),
                sortKey: runTime,
                nodeType: "run",
            });
        }
    });

    // === Source 2: Chat message history (fallback for completed runs not in active store) ===
    const agentMsgs = chatMessages.filter(
        (m) =>
            m.role === "assistant" &&
            (m.agentId === agentId || m.agentId?.includes(agentId) || agentId?.includes(m.agentId || ""))
    );

    agentMsgs.forEach((msg) => {
        if (msg.runId && seenRunIds.has(msg.runId)) return;

        const msgTime = safeTimestamp(msg.timestamp) || safeTimestamp(msg.createdAt) || null;
        if (!msgTime) return; // Skip messages with no valid timestamp

        // Extract tool calls
        if (msg.tool_calls && msg.tool_calls.length > 0) {
            const toolChildren: ProcessNode[] = [];

            msg.tool_calls.forEach((tc: any, idx: number) => {
                const tcId = tc.id || `tc-${msg.id}-${idx}`;
                if (seenToolCallIds.has(tcId)) return;
                seenToolCallIds.add(tcId);

                const funcName = tc.function?.name || tc.toolName || tc.name || "unknown";
                let parsedArgs: any = tc.function?.arguments || tc.input || tc.args || "";
                if (typeof parsedArgs === "string") {
                    try { parsedArgs = JSON.parse(parsedArgs); } catch { /* keep */ }
                }

                let outputStr: string | undefined;
                if (tc.output) {
                    if (typeof tc.output === "string") {
                        try { outputStr = JSON.stringify(JSON.parse(tc.output), null, 2); }
                        catch { outputStr = tc.output; }
                    } else {
                        outputStr = JSON.stringify(tc.output, null, 2);
                    }
                } else if (tc._parsed?.output) {
                    outputStr = JSON.stringify(tc._parsed.output, null, 2);
                }

                const status = tc.status === "completed" || tc.status === "done" ? "done"
                    : tc.status === "failed" || tc.status === "error" ? "error"
                    : "done"; // Historical messages are always done

                toolChildren.push({
                    id: tcId,
                    name: funcName,
                    status,
                    toolName: funcName,
                    toolArgs: parsedArgs,
                    output: outputStr,
                    children: [],
                    timestamp: formatTime(msgTime),
                    sortKey: msgTime,
                    nodeType: "tool",
                });
            });

            // Each tool call is its own top-level node
            toolChildren.forEach(child => {
                nodes.push({ ...child, sortKey: msgTime });
            });
        }

        // Inline tool parsing fallback (for messages with tool markup in text)
        if (msg.content && (!msg.tool_calls || msg.tool_calls.length === 0)) {
            const parseResult = parseOpenClawToolCalls(msg.content);
            if (parseResult.toolCalls.length > 0) {
                const inlineChildren: ProcessNode[] = [];
                parseResult.toolCalls.forEach((tc, idx) => {
                    const tcId = tc.id || `inline-${msg.id}-${idx}`;
                    if (seenToolCallIds.has(tcId)) return;
                    seenToolCallIds.add(tcId);

                    let outputStr: string | undefined;
                    if (tc.output) outputStr = JSON.stringify(tc.output, null, 2);

                    inlineChildren.push({
                        id: tcId,
                        name: tc.toolName,
                        status: tc.status === "completed" ? "done" : tc.status === "error" ? "error" : "done",
                        toolName: tc.toolName,
                        toolArgs: tc.input,
                        output: outputStr,
                        children: [],
                        timestamp: formatTime(msgTime),
                        sortKey: msgTime,
                        nodeType: "tool",
                    });
                });

                // Each tool call is its own top-level node
                inlineChildren.forEach(child => {
                    nodes.push({ ...child, sortKey: msgTime });
                });
            }
        }
    });

    // Sort chronologically: newest first
    nodes.sort((a, b) => (b.sortKey || 0) - (a.sortKey || 0));

    return nodes;
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
    const a0Logs = useAgentZeroStore((s) => s.logs);
    const a0IsResponding = useAgentZeroStore((s) => s.isResponding);
    const openClawActiveRuns = useOpenClawStore((s) => s.activeRuns);
    const storeChatMessages = useSocketStore((s) => s.chatMessages);
    const chatMessagesSource = messages ?? storeChatMessages;

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

    const displayData = useMemo(() => {
        if (clearedIdsRef.current.size === 0) return treeData;
        return treeData.filter(n => !clearedIdsRef.current.has(n.id));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [treeData, clearTrigger]);

    const handleClear = useCallback(() => {
        treeData.forEach(n => clearedIdsRef.current.add(n.id));
        const sk = `agent:${agentId}:nchat`;
        useOpenClawStore.getState().clearRunsForSession(sk);
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

    const activeCount = displayData.filter(n => n.status === "running").length;

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
                        {displayData.length > 0 && (
                            <span className="text-[9px] text-muted-foreground/40 mr-1.5">
                                {activeCount > 0 && (
                                    <span className="text-cyan-400 animate-pulse mr-1">●</span>
                                )}
                                {displayData.length}
                            </span>
                        )}

                        <button
                            onClick={handleCollapseAll}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
                            title="Collapse all"
                        >
                            <ChevronsDownUp size={13} />
                        </button>

                        <button
                            onClick={handleExpandAll}
                            className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground/50 hover:text-muted-foreground"
                            title="Expand all"
                        >
                            <ChevronsUpDown size={13} />
                        </button>

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
