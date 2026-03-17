"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Code } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function FormatterStepNode(props: NodeProps) {
    const template = (props.data as any).template || "";
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.formatter_step}
            icon={<Code size={14} />}
        >
            {template && (
                <div style={{
                    fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace",
                    overflow: "hidden", textOverflow: "ellipsis",
                    whiteSpace: "nowrap", maxWidth: 180, marginTop: 2,
                }}>
                    {template}
                </div>
            )}
        </BaseNodeV2>
    );
}
