"use client";
import React, { useState } from "react";
import { type NodeProps } from "@xyflow/react";
import { Users, Check, RefreshCw, X } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

export function HumanApprovalNode(props: NodeProps) {
    const instructions = (props.data as any).instructions || "";
    const executionState = useWorkflowBuilderStore((s) => s.executionState);
    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);
    const approveGate = useWorkflowBuilderStore((s) => s.approveGate);
    const retryGate = useWorkflowBuilderStore((s) => s.retryGate);
    const declineGate = useWorkflowBuilderStore((s) => s.declineGate);

    const execStatus = executionState[props.id] || "idle";
    const isPending = execStatus === "waiting" && pendingGates.some(g => g.nodeId === props.id);

    const [reviewText, setReviewText] = useState("");
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const handleApprove = async () => {
        setActionLoading("approve");
        await approveGate(props.id, reviewText.trim() || undefined);
        setActionLoading(null);
        setReviewText("");
    };

    const handleRetry = async () => {
        setActionLoading("retry");
        await retryGate(props.id, reviewText.trim() || undefined);
        setActionLoading(null);
        setReviewText("");
    };

    const handleDecline = () => {
        declineGate(props.id);
        setReviewText("");
    };

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.human_approval}
            icon={<Users size={14} />}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                {instructions || "Pauses for human approval"}
            </div>

            {/* Approval panel — appears when execution is waiting on this node */}
            {isPending && (
                <div
                    style={{
                        marginTop: 10,
                        padding: 10,
                        borderRadius: 8,
                        background: "oklch(0.10 0.005 0 / 0.9)",
                        border: "1px solid oklch(1 0 0 / 0.1)",
                    }}
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                >
                    {/* Instructions textarea */}
                    <textarea
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Reviewer instructions (optional)…"
                        rows={2}
                        style={{
                            width: "100%",
                            resize: "vertical",
                            background: "oklch(0.06 0.005 0 / 0.8)",
                            border: "1px solid oklch(1 0 0 / 0.08)",
                            borderRadius: 6,
                            padding: "6px 8px",
                            fontSize: 10,
                            color: "var(--text-primary)",
                            outline: "none",
                            fontFamily: "inherit",
                            marginBottom: 8,
                            boxSizing: "border-box",
                        }}
                        onFocus={(e) => { e.currentTarget.style.borderColor = NODE_ACCENTS.human_approval; }}
                        onBlur={(e) => { e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.08)"; }}
                    />

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 6 }}>
                        {/* Approve */}
                        <button
                            onClick={handleApprove}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.55 0.18 145)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading && actionLoading !== "approve" ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <Check size={11} />
                            {actionLoading === "approve" ? "…" : "Approve"}
                        </button>

                        {/* Retry */}
                        <button
                            onClick={handleRetry}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.60 0.15 70)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading && actionLoading !== "retry" ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <RefreshCw size={11} />
                            {actionLoading === "retry" ? "…" : "Retry"}
                        </button>

                        {/* Decline */}
                        <button
                            onClick={handleDecline}
                            disabled={!!actionLoading}
                            style={{
                                flex: 1,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 4,
                                padding: "5px 8px",
                                borderRadius: 6,
                                border: "none",
                                background: "oklch(0.50 0.18 25)",
                                color: "#fff",
                                fontSize: 10,
                                fontWeight: 600,
                                cursor: actionLoading ? "wait" : "pointer",
                                opacity: actionLoading ? 0.4 : 1,
                                transition: "opacity 150ms",
                            }}
                        >
                            <X size={11} />
                            Decline
                        </button>
                    </div>
                </div>
            )}
        </BaseNodeV2>
    );
}
