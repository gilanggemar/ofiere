"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Flag } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function OutputNodeV2(props: NodeProps) {
    const outputMode = (props.data as any).outputMode || "return";
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.output}
            icon={<Flag size={14} />}
            showSourceHandle={false}
            showTargetHandle={true}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                {outputMode === "webhook" ? "Send to webhook" : outputMode === "notification" ? "Send to notification" : outputMode === "log" ? "Log output" : "Return result"}
            </div>
        </BaseNodeV2>
    );
}
