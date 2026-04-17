"use client";

import React, { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, X, Copy } from "lucide-react";
import { useWorkflowBuilderStore, type ExecutionLogEntry } from "@/store/useWorkflowBuilderStore";
import { NODE_ACCENTS, type WfNodeType } from "./nodes/nodeStyles";

export default function ExecutionLog() {
    const isExecuting = useWorkflowBuilderStore((s) => s.isExecuting);
    const executionLog = useWorkflowBuilderStore((s) => s.executionLog);
    const clearExecutionLog = useWorkflowBuilderStore((s) => s.clearExecutionLog);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [executionLog]);

    const visible = isExecuting || executionLog.length > 0;

    const handleCopy = () => {
        const text = executionLog
            .map((e) => `[${new Date(e.timestamp).toISOString()}] [${e.type}] ${e.nodeId}: ${e.message}`)
            .join("\n");
        navigator.clipboard.writeText(text);
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 200, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 200, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                    style={{
                        position: "absolute",
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: 200,
                        zIndex: 25,
                        background: "oklch(0.08 0.003 0 / 0.9)",
                        backdropFilter: "blur(16px)",
                        WebkitBackdropFilter: "blur(16px)",
                        borderTop: "1px solid oklch(1 0 0 / 0.08)",
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "8px 16px",
                            borderBottom: "1px solid oklch(1 0 0 / 0.05)",
                        }}
                    >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <Terminal size={12} style={{ color: "var(--text-muted)" }} />
                            <span
                                style={{
                                    fontSize: 10,
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.08em",
                                    color: "var(--text-muted)",
                                }}
                            >
                                Execution Log
                            </span>
                            {isExecuting && (
                                <span
                                    style={{
                                        width: 6,
                                        height: 6,
                                        borderRadius: "50%",
                                        background: "var(--accent-base)",
                                        animation: "wf-pulse 1.5s ease-in-out infinite",
                                    }}
                                />
                            )}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <button
                                onClick={handleCopy}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 4,
                                    background: "none",
                                    border: "none",
                                    color: "var(--text-muted)",
                                    cursor: "pointer",
                                    fontSize: 10,
                                }}
                            >
                                <Copy size={11} />
                                Copy
                            </button>
                            {!isExecuting && (
                                <button
                                    onClick={clearExecutionLog}
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 4,
                                        background: "none",
                                        border: "none",
                                        color: "var(--status-error)",
                                        cursor: "pointer",
                                        fontSize: 10,
                                    }}
                                    title="Close execution log"
                                >
                                    <X size={12} />
                                    Close
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Log entries */}
                    <div
                        ref={scrollRef}
                        className="ofiere-mono"
                        style={{
                            flex: 1,
                            overflowY: "auto",
                            padding: "8px 16px",
                            fontSize: 11,
                            lineHeight: 1.6,
                        }}
                    >
                        {executionLog.length === 0 && (
                            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
                                Waiting for execution events...
                            </div>
                        )}
                        {executionLog.map((entry, i) => (
                            <LogEntry key={i} entry={entry} />
                        ))}
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

function LogEntry({ entry }: { entry: ExecutionLogEntry }) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const color =
        entry.type === "error"
            ? "var(--status-error)"
            : entry.type === "output"
                ? "var(--status-online)"
                : "var(--text-muted)";

    return (
        <div style={{ display: "flex", gap: 8 }}>
            <span style={{ color: "var(--text-muted)", flexShrink: 0 }}>{time}</span>
            <span style={{ color, flexShrink: 0 }}>[{entry.type}]</span>
            <span style={{ color: "var(--text-secondary)" }}>{entry.message}</span>
        </div>
    );
}
