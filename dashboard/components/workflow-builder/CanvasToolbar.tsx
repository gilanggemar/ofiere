"use client";

import React, { useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Play, Square, Save, Flame, BoxSelect, Loader2 } from "lucide-react";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export default function CanvasToolbar() {
    const workflowMeta = useWorkflowBuilderStore((s) => s.workflowMeta);
    const nodes = useWorkflowBuilderStore((s) => s.nodes);
    const edges = useWorkflowBuilderStore((s) => s.edges);
    const isDirty = useWorkflowBuilderStore((s) => s.isDirty);
    const isExecuting = useWorkflowBuilderStore((s) => s.isExecuting);
    const togglePalette = useWorkflowBuilderStore((s) => s.togglePalette);
    const setWorkflowMeta = useWorkflowBuilderStore((s) => s.setWorkflowMeta);
    const startMissionExecution = useWorkflowBuilderStore((s) => s.startMissionExecution);
    const abortExecution = useWorkflowBuilderStore((s) => s.abortExecution);
    const setDirty = useWorkflowBuilderStore((s) => s.setDirty);
    const addExecutionLog = useWorkflowBuilderStore((s) => s.addExecutionLog);
    const createGroupFromSelection = useWorkflowBuilderStore((s) => s.createGroupFromSelection);
    const hasSelection = useWorkflowBuilderStore((s) => s.nodes.filter((n) => n.selected && n.type !== 'group').length >= 2);

    const handleNameChange = useCallback(
        (e: React.FocusEvent<HTMLSpanElement>) => {
            const n = e.currentTarget.textContent?.trim() || "Untitled Workflow";
            setWorkflowMeta({ name: n });
        }, [setWorkflowMeta]
    );

    // ─── Save: persist nodes/edges to the API ───
    const handleSave = useCallback(async () => {
        const wfId = workflowMeta.id;
        if (!wfId) return;

        try {
            const res = await fetch(`/api/workflows/${wfId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: workflowMeta.name,
                    description: workflowMeta.description,
                    nodes,
                    edges,
                }),
            });
            if (!res.ok) throw new Error("Save failed");
            setDirty(false);
        } catch (err) {
            console.error("Failed to save workflow:", err);
            addExecutionLog({
                nodeId: "system",
                timestamp: Date.now(),
                type: "error",
                message: `Save failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            });
        }
    }, [workflowMeta, nodes, edges, setDirty, addExecutionLog]);

    // ─── Execute: save first, then run ───
    const handleExecute = useCallback(async () => {
        const wfId = workflowMeta.id;
        if (!wfId) return;

        if (nodes.length === 0) {
            addExecutionLog({
                nodeId: "system",
                timestamp: Date.now(),
                type: "error",
                message: "Cannot execute: no nodes on the canvas.",
            });
            return;
        }

        // Auto-save before executing
        try {
            await fetch(`/api/workflows/${wfId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: workflowMeta.name,
                    description: workflowMeta.description,
                    nodes,
                    edges,
                }),
            });
            setDirty(false);
        } catch {
            // Continue even if save fails — the run API will read from DB
        }

        // Now trigger execution via the engine
        await startMissionExecution(wfId);
    }, [workflowMeta, nodes, edges, setDirty, startMissionExecution, addExecutionLog]);

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3 }}
            style={{
                position: "absolute",
                top: 12,
                left: 0,
                right: 0,
                zIndex: 20,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "none",
            }}
        >
            <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 12px", borderRadius: 12,
                background: "oklch(0.11 0.005 0 / 0.8)", backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)", border: "1px solid oklch(1 0 0 / 0.10)",
                boxShadow: "0 8px 40px oklch(0 0 0 / 0.35), inset 0 1px 0 oklch(1 0 0 / 0.05)",
                pointerEvents: "auto",
            }}>
                {/* Name */}
                <span contentEditable suppressContentEditableWarning onBlur={handleNameChange}
                    style={{
                        fontSize: 12, fontWeight: 600, color: "var(--text-primary)", outline: "none",
                        minWidth: 60, maxWidth: 160, overflow: "hidden", whiteSpace: "nowrap",
                        textOverflow: "ellipsis", cursor: "text", padding: "1px 4px", borderRadius: 4,
                    }}>
                    {workflowMeta.name}
                </span>

                {workflowMeta.streak > 0 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 10, fontWeight: 600, color: "var(--accent-base)" }}>
                        <Flame size={12} />{workflowMeta.streak}
                    </div>
                )}

                <Divider />

                <TBtn icon={<Plus size={13} />} label="Add Node" onClick={togglePalette} />

                {hasSelection && (
                    <TBtn icon={<BoxSelect size={13} />} label="Group" onClick={createGroupFromSelection} />
                )}

                {isExecuting ? (
                    <TBtn icon={<Square size={13} />} label="Stop" variant="danger" onClick={abortExecution} />
                ) : (
                    <TBtn icon={<Play size={13} />} label="Execute" variant="primary" onClick={handleExecute} />
                )}

                <TBtn icon={<Save size={13} />} label="Save" onClick={handleSave} />

                <Divider />

                <span style={{ fontSize: 9, color: isDirty ? "var(--accent-base)" : "var(--text-muted)", fontWeight: 500, whiteSpace: "nowrap" }}>
                    {isDirty ? "Unsaved" : "Saved"}
                </span>
            </div>
        </motion.div>
    );
}

function Divider() {
    return <div style={{ width: 1, height: 16, background: "oklch(1 0 0 / 0.1)" }} />;
}

function TBtn({ icon, label, variant, onClick }: {
    icon: React.ReactNode; label: string; variant?: "primary" | "danger"; onClick?: () => void;
}) {
    const bg = variant === "primary" ? "var(--accent-base)" : variant === "danger" ? "var(--status-error)" : "oklch(1 0 0 / 0.06)";
    const col = variant ? "#000" : "var(--text-primary)";
    return (
        <button onClick={onClick} style={{
            display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px",
            borderRadius: 8, border: "none", background: bg, color: col,
            fontSize: 10, fontWeight: 600, cursor: "pointer", transition: "opacity 150ms",
        }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
            {icon}{label}
        </button>
    );
}
