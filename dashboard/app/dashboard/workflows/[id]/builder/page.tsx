"use client";

import React, { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import WorkflowCanvas from "@/components/workflow-builder/WorkflowCanvas";
import CanvasToolbar from "@/components/workflow-builder/CanvasToolbar";
import NodePalette from "@/components/workflow-builder/NodePalette";
import NodeConfigPanel from "@/components/workflow-builder/NodeConfigPanel";
import ExecutionLog from "@/components/workflow-builder/ExecutionLog";
import FavoritesModal from "@/components/workflow-builder/FavoritesModal";

export default function WorkflowBuilderPage() {
    const params = useParams();
    const workflowId = params?.id as string;
    const hydrate = useWorkflowBuilderStore((s) => s.hydrate);
    const reset = useWorkflowBuilderStore((s) => s.reset);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!workflowId) return;

        async function load() {
            try {
                const res = await fetch(`/api/workflows/${workflowId}`);
                if (!res.ok) {
                    hydrate([], [], {
                        id: workflowId,
                        name: "New Workflow",
                        description: "",
                        masteryScore: 0,
                        streak: 0,
                    });
                    return;
                }
                const wf = await res.json();
                hydrate(wf.nodes ?? [], wf.edges ?? [], {
                    id: wf.id,
                    name: wf.name || "Untitled Workflow",
                    description: wf.description || "",
                    masteryScore: 0,
                    streak: 0,
                });
            } catch {
                hydrate([], [], {
                    id: workflowId,
                    name: "New Workflow",
                    description: "",
                    masteryScore: 0,
                    streak: 0,
                });
            } finally {
                setLoading(false);
            }
        }

        load();
        return () => { reset(); };
    }, [workflowId, hydrate, reset]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                Loading workflow…
            </div>
        );
    }

    return (
        <ReactFlowProvider>
            {/* Canvas fills the entire available height — no header row gap */}
            <div className="flex flex-col h-full">
                {/* Canvas in Constellation-style glass frame — full height */}
                <div className="flex-1 min-h-0 nerv-glass-2 rounded-xl overflow-hidden relative">
                    <WorkflowCanvas />
                    <CanvasToolbar />

                    {/* Back button — inside canvas, top-left */}
                    <Link
                        href="/dashboard/workflows"
                        style={{
                            position: "absolute",
                            top: 12,
                            left: 12,
                            zIndex: 20,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "5px 12px",
                            borderRadius: 8,
                            background: "oklch(0.11 0.005 0 / 0.7)",
                            backdropFilter: "blur(16px)",
                            WebkitBackdropFilter: "blur(16px)",
                            border: "1px solid oklch(1 0 0 / 0.08)",
                            color: "var(--text-muted)",
                            fontSize: 11,
                            fontWeight: 500,
                            textDecoration: "none",
                            transition: "color 150ms, border-color 150ms",
                            cursor: "pointer",
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.color = "var(--text-primary)";
                            e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.15)";
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.color = "var(--text-muted)";
                            e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.08)";
                        }}
                    >
                        <ArrowLeft size={13} />
                        Workflows
                    </Link>

                    <NodePalette />
                    <NodeConfigPanel />
                    <ExecutionLog />
                    <FavoritesModal />
                </div>
            </div>
        </ReactFlowProvider>
    );
}
