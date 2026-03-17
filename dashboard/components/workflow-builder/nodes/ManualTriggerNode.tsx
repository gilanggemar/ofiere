"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function ManualTriggerNode(props: NodeProps) {
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.manual_trigger}
            icon={<Zap size={14} />}
            showTargetHandle={false}
            showSourceHandle={true}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                Triggers on execute
            </div>
        </BaseNodeV2>
    );
}
