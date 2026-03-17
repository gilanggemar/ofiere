"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function AgentStepNode(props: NodeProps) {
    const d = props.data as any;
    const agentName = d.agentName || d.agentId || "No agent";
    const task = d.task || "";

    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.agent_step}
            icon={<Bot size={14} />}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{
                        fontSize: 8, fontWeight: 600, textTransform: "uppercase",
                        padding: "1px 4px", borderRadius: 3,
                        background: "oklch(0.75 0.18 55 / 0.15)", color: "oklch(0.75 0.18 55)",
                    }}>
                        {d.provider || "OpenClaw"}
                    </span>
                    <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>{agentName}</span>
                </div>
                {task && (
                    <div style={{
                        fontSize: 9, color: "var(--text-muted)",
                        overflow: "hidden", textOverflow: "ellipsis",
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                        maxWidth: 180,
                    }}>
                        {task}
                    </div>
                )}
            </div>
        </BaseNodeV2>
    );
}
