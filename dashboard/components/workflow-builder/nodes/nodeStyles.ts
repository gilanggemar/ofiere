// ─── OFIERE GRAPH — V2 Node Style Constants ──────────────────────────────

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
    // New V2 nodes
    delay: 'oklch(0.75 0.14 80)',
    variable_set: 'oklch(0.68 0.12 200)',
    http_request: 'oklch(0.72 0.16 160)',
    loop: 'oklch(0.70 0.15 310)',
    note: 'oklch(0.72 0.08 80)',
    checkpoint: 'oklch(0.75 0.16 350)',
    task_call: 'oklch(0.68 0.16 265)',
    convergence: 'oklch(0.65 0.12 180)',
    // Keep group for canvas grouping
    group: 'var(--accent-ocean)',
} as const;

export type WfNodeType = keyof typeof NODE_ACCENTS;

export const EXEC_STATUS_COLORS: Record<WfNodeExecStatus, string> = {
    idle: 'var(--text-muted)',
    queued: 'var(--accent-base)',
    running: 'var(--accent-base)',
    completed: 'var(--status-online)',
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
            { type: 'http_request', label: 'HTTP Request', icon: 'Globe', description: 'Call an API', defaultData: { label: 'HTTP Request', method: 'GET', url: '' } },
            { type: 'task_call', label: 'Task', icon: 'ClipboardList', description: 'Run a saved task', defaultData: { label: 'Task', agentId: '', taskId: '', taskTitle: '', agentName: '', systemPromptOverride: '' } },
            { type: 'variable_set', label: 'Set Variable', icon: 'Wrench', description: 'Store / transform data', defaultData: { label: 'Set Variable', variableName: '', variableValue: '' } },
        ],
    },
    {
        id: 'control',
        label: 'Control',
        accent: NODE_ACCENTS.condition,
        items: [
            { type: 'condition', label: 'Condition', icon: 'GitBranch', description: 'If / else branch', defaultData: { label: 'Condition', expression: '' } },
            { type: 'human_approval', label: 'Approval', icon: 'Users', description: 'Human approval gate', defaultData: { label: 'Human Approval', instructions: '' } },
            { type: 'delay', label: 'Delay', icon: 'Timer', description: 'Wait / pause timer', defaultData: { label: 'Delay', delaySec: 5 } },
            { type: 'loop', label: 'Loop', icon: 'Repeat', description: 'Iterate / repeat', defaultData: { label: 'Loop', loopType: 'count', maxIterations: 3 } },
            { type: 'convergence', label: 'Convergence', icon: 'Merge', description: 'Wait for multiple inputs', defaultData: { label: 'Convergence', mergeStrategy: 'wait_all' } },
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
            { type: 'checkpoint', label: 'Checkpoint', icon: 'MapPin', description: 'Cycle target marker', defaultData: { label: 'Checkpoint' } },
            { type: 'group', label: 'Group', icon: 'Box', description: 'Container' },
            { type: 'note', label: 'Note', icon: 'StickyNote', description: 'Annotation', defaultData: { label: 'Note', noteText: '' } },
        ],
    },
];

export const NODE_INFO: Record<WfNodeType, { description: string; tips: string }> = {
    manual_trigger: { description: "Starts the workflow manually", tips: "Connect this to your first action step. Click 'Execute' to run." },
    webhook_trigger: { description: "Starts when an external request is received", tips: "Use the generated URL in other apps to trigger this flow." },
    schedule_trigger: { description: "Starts on a recurring schedule", tips: "Use cron or simple intervals to automate regular tasks." },
    agent_step: { description: "Delegates a task to an AI agent", tips: "Set clear instructions and choose the best agent for the job. Use {{prev.step_id.outputText}} to pass data." },
    formatter_step: { description: "Formats or transforms text/JSON", tips: "Use templates to merge data from multiple previous steps." },
    http_request: { description: "Makes an external API call", tips: "Useful for fetching data or updating external systems." },
    variable_set: { description: "Stores data in a variable", tips: "Use variables to maintain state across complex workflows." },
    condition: { description: "Branches flow based on logic", tips: "Connect the 'TRUE' handle to one path and 'FALSE' to another." },
    human_approval: { description: "Pauses until a human approves", tips: "Use for critical decisions or reviewing generated content." },
    delay: { description: "Pauses execution for a set time", tips: "Helpful to avoid rate limits when calling external APIs." },
    loop: { description: "Repeats actions multiple times", tips: "Send flow to a Checkpoint to cycle, or use 'Done' to continue." },
    convergence: { description: "Waits for multiple inputs before continuing", tips: "Useful to merge branches that were split by a Condition or parallel processes." },
    output: { description: "Ends the workflow and returns a result", tips: "Every workflow should end with an Output node." },
    checkpoint: { description: "Target marker for loops and cycles", tips: "Select this Checkpoint from a Loop or Approval node to jump here." },
    group: { description: "Visual container for nodes", tips: "Drag nodes inside to group them. Move the group to move all children." },
    note: { description: "Sticky note for documentation", tips: "Explain your logic to others. Doesn't affect execution." },
    task_call: { description: "Runs a pre-configured task from an agent", tips: "Select an agent, then pick one of their saved tasks. Optionally add a system prompt to adjust behavior." },
};
