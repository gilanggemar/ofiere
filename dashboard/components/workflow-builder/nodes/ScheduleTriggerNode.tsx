"use client";
import React from "react";
import { type NodeProps } from "@xyflow/react";
import { Clock } from "lucide-react";
import { NODE_ACCENTS } from "./nodeStyles";
import { BaseNodeV2 } from "./BaseNodeV2";

export function ScheduleTriggerNode(props: NodeProps) {
    const cron = (props.data as any).cron;
    return (
        <BaseNodeV2
            nodeProps={props}
            accent={NODE_ACCENTS.schedule_trigger}
            icon={<Clock size={14} />}
            showTargetHandle={false}
            showSourceHandle={true}
        >
            {cron && (
                <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "monospace", marginTop: 2 }}>
                    {cron}
                </div>
            )}
        </BaseNodeV2>
    );
}
