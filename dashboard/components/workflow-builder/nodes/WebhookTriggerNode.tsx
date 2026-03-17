"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Globe } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function WebhookTriggerNode(props: NodeProps) {
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.webhook_trigger}
            icon={<Globe size={14} />}
            showTargetHandle={false}
            showSourceHandle={true}
        >
            <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 2 }}>
                HTTP webhook endpoint
            </div>
        </BaseNodeV2>
    );
}
