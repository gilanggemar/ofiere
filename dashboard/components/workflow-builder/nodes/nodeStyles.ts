// ─── NERV GRAPH — V2 Node Style Constants ──────────────────────────────

import React from 'react';
import type { WfNodeExecStatus } from '@/store/useWorkflowBuilderStore';

export const NODE_ACCENTS = {
    // V2 Node Types
    manual_trigger: 'var(--accent-lime)',
    webhook_trigger: 'oklch(0.75 0.18 55)',
    schedule_trigger: 'oklch(0.72 0.14 195)',
    agent_step: 'var(--accent-base)',
    formatter_step: 'var(--accent-violet)',
    human_approval: 'oklch(0.65 0.19 25)',
    condition: 'var(--accent-coral)',
    output: 'var(--accent-teal)',
    // Keep group for canvas grouping
    group: 'var(--accent-ocean)',
} as const;

export type WfNodeType = keyof typeof NODE_ACCENTS;

export const EXEC_STATUS_COLORS: Record<WfNodeExecStatus, string> = {
    idle: 'var(--text-muted)',
    queued: 'var(--accent-base)',
    running: 'var(--accent-base)',
    success: 'var(--status-online)',
    error: 'var(--status-error)',
    waiting: 'oklch(0.80 0.18 80)',
    skipped: 'var(--text-muted)',
};

export const NODE_DIMENSIONS = {
    minWidth: 200,
    padding: 12,
    borderRadius: 14,
    handleSize: 10,
} as const;

export const HANDLE_BASE_STYLE: React.CSSProperties = {
    width: NODE_DIMENSIONS.handleSize,
    height: NODE_DIMENSIONS.handleSize,
    border: '2px solid oklch(1 0 0 / 0.15)',
    borderRadius: '50%',
    transition: 'all 150ms ease',
};

export function getHandleStyle(accent: string): React.CSSProperties {
    return {
        ...HANDLE_BASE_STYLE,
        background: accent,
        boxShadow: `0 0 6px ${accent}`,
    };
}

export interface NodeCategoryDef {
    id: string;
    label: string;
    accent: string;
    items: NodePaletteItem[];
}

export interface NodePaletteItem {
    type: WfNodeType;
    label: string;
    icon: string;
    description?: string;
    defaultData?: Record<string, unknown>;
}

export const NODE_CATEGORIES: NodeCategoryDef[] = [
    {
        id: 'triggers',
        label: 'Triggers',
        accent: NODE_ACCENTS.manual_trigger,
        items: [
            { type: 'manual_trigger', label: 'Execute', icon: 'Zap', description: 'Click to run', defaultData: { label: 'Execute Trigger' } },
            { type: 'webhook_trigger', label: 'Webhook', icon: 'Globe', description: 'HTTP endpoint', defaultData: { label: 'Webhook Trigger' } },
            { type: 'schedule_trigger', label: 'Schedule', icon: 'Clock', description: 'Cron / interval', defaultData: { label: 'Schedule Trigger', cron: '0 9 * * 1-5' } },
        ],
    },
    {
        id: 'steps',
        label: 'Steps',
        accent: NODE_ACCENTS.agent_step,
        items: [
            { type: 'agent_step', label: 'Agent Step', icon: 'Bot', description: 'Route to agent', defaultData: { label: 'Agent Step', agentId: '', task: '', responseMode: 'text', timeoutSec: 120 } },
            { type: 'formatter_step', label: 'Formatter', icon: 'Code', description: 'Template text', defaultData: { label: 'Formatter', template: '' } },
        ],
    },
    {
        id: 'control',
        label: 'Control',
        accent: NODE_ACCENTS.condition,
        items: [
            { type: 'condition', label: 'Condition', icon: 'GitBranch', description: 'If / else branch', defaultData: { label: 'Condition', expression: '' } },
            { type: 'human_approval', label: 'Approval', icon: 'Users', description: 'Human approval gate', defaultData: { label: 'Human Approval', instructions: '' } },
        ],
    },
    {
        id: 'end',
        label: 'End',
        accent: NODE_ACCENTS.output,
        items: [
            { type: 'output', label: 'Output', icon: 'Flag', description: 'Send result', defaultData: { label: 'Output', outputMode: 'return' } },
        ],
    },
    {
        id: 'special',
        label: 'Special',
        accent: NODE_ACCENTS.group,
        items: [
            { type: 'group', label: 'Group', icon: 'Box', description: 'Container' },
        ],
    },
];
