/* ─── PM Types — shared between client + server ─── */

// ── Hierarchy ──

export interface PMSpace {
    id: string;
    user_id: string;
    name: string;
    description: string;
    icon: string;
    icon_color: string;
    access_type: 'private' | 'workspace';
    sort_order: number;
    created_at: string;
    updated_at: string;
}

export interface PMFolder {
    id: string;
    user_id: string;
    space_id: string;
    parent_folder_id: string | null;
    name: string;
    description: string;
    folder_type: 'folder' | 'project';
    sort_order: number;
    created_at: string;
    updated_at: string;
}

// ── Task (extension of existing tasks table) ──

export type PMTaskStatus = 'NEW' | 'PENDING' | 'IN_PROGRESS' | 'DONE' | 'FAILED';
export type PMTaskPriority = 0 | 1 | 2 | 3; // LOW=0, MEDIUM=1, HIGH=2, CRITICAL=3
export type PMAssigneeType = 'agent' | 'human' | 'auto';

export const PRIORITY_LABELS: Record<number, string> = { 0: 'Low', 1: 'Medium', 2: 'High', 3: 'Critical' };
export const PRIORITY_DOTS: Record<number, string> = { 0: 'bg-zinc-500', 1: 'bg-teal-400', 2: 'bg-orange-500', 3: 'bg-red-500' };
export const STATUS_LABELS: Record<string, string> = {
    NEW: 'New',
    PENDING: 'Backlog',
    IN_PROGRESS: 'In Progress',
    DONE: 'Completed',
    FAILED: 'Failed',
};
export const STATUS_BADGE_CLASS: Record<string, string> = {
    NEW: 'pm-status-badge--new',
    PENDING: 'pm-status-badge--backlog',
    IN_PROGRESS: 'pm-status-badge--progress',
    DONE: 'pm-status-badge--completed',
    FAILED: 'pm-status-badge--failed',
};

export interface PMTask {
    id: string;
    user_id: string;
    agent_id: string | null;
    title: string;
    description: string | null;
    status: PMTaskStatus;
    priority: number;
    assignee_type: PMAssigneeType;

    // Hierarchy
    space_id: string | null;
    folder_id: string | null;
    project_id: string | null;
    parent_task_id: string | null;

    // Dates
    start_date: string | null;
    due_date: string | null;
    completed_at: string | null;

    // Progress
    progress: number;

    // Metadata
    sort_order: number;
    custom_fields: Record<string, any>;
    tags: string[];

    created_at: string;
    updated_at: string;
}

// ── Agent (from existing agents table) ──

export interface PMAgent {
    id: string;
    name: string;
    codename: string | null;
    role: string | null;
    avatar: string | null;
    status: string;
}

// ── Dependencies ──

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface PMDependency {
    id: string;
    predecessor_id: string;
    successor_id: string;
    dependency_type: DependencyType;
    lag_days: number;
}

// ── Activity / Audit Trail ──

export type ActivityEntityType = 'task' | 'project' | 'folder' | 'space';
export type ActivitySource = 'agent' | 'human' | 'system';

export interface PMActivity {
    id: string;
    user_id: string;
    entity_type: ActivityEntityType;
    entity_id: string;
    action_type: string;
    source: ActivitySource;
    source_name: string;
    content: string;
    metadata: Record<string, any>;
    created_at: string;
}

// ── Time Entry ──

export interface PMTimeEntry {
    id: string;
    user_id: string;
    task_id: string;
    start_time: string;
    end_time: string | null;
    duration_minutes: number | null;
    description: string;
    is_manual: boolean;
    is_running: boolean;
    created_at: string;
}

// ── Approval ──

export interface PMApproval {
    id: string;
    task_id: string;
    approver_type: 'human' | 'agent';
    approver_name: string;
    status: 'pending' | 'approved' | 'rejected';
    due_date: string | null;
    comment: string | null;
    file_ids: string[];
    resolved_at: string | null;
    created_at: string;
}

// ── Custom Field ──

export type CustomFieldType = 'text' | 'number' | 'currency' | 'person' | 'single_select' | 'multi_select' | 'date' | 'duration' | 'checkbox' | 'formula';

export interface PMCustomField {
    id: string;
    user_id: string;
    scope_type: 'global' | 'space' | 'folder' | 'project';
    scope_id: string | null;
    name: string;
    field_type: CustomFieldType;
    config: Record<string, any>;
    sort_order: number;
    created_at: string;
}

// ── File Attachment ──

export interface PMFile {
    id: string;
    user_id: string;
    task_id: string | null;
    space_id: string | null;
    file_name: string;
    file_type: string | null;
    file_url: string;
    file_size: number | null;
    thumbnail_url: string | null;
    created_at: string;
}

// ── View Types ──

export type PMViewType = 'table' | 'scheduler' | 'timeline' | 'files' | 'analytics' | 'stream';

// ── Sidebar Node (for hierarchical tree rendering) ──

export interface SidebarNode {
    type: 'space' | 'folder' | 'project';
    id: string;
    name: string;
    icon?: string;
    iconColor?: string;
    spaceId?: string;
    folderId?: string;
    children: SidebarNode[];
    taskCount: number;
}

// ── Task-Ops Fields (stored in custom_fields JSONB) ──

export type TaskOpsItemType = 'budget' | 'stack' | 'legal' | 'deadline' | 'custom';

export interface PMExecutionStep {
    id: string;
    text: string;
    order: number;
}

export interface PMTaskGoal {
    id: string;
    type: TaskOpsItemType;
    label: string;
}

export interface PMTaskConstraint {
    id: string;
    type: TaskOpsItemType;
    label: string;
}

export interface PMTaskAssignee {
    id: string;
    type: 'agent' | 'human';
}

export interface PMTaskCustomFields {
    type?: string;
    execution_plan?: PMExecutionStep[];
    system_prompt?: string;
    goals?: PMTaskGoal[];
    constraints?: PMTaskConstraint[];
    assignees?: PMTaskAssignee[];
    recurrence_days?: number | null; // null/0 = one-time, >0 = repeat every N days
    recurrence_mode?: 'start_to_start' | 'end_to_start' | null; // SS = overlapping, ES = sequential (default ES)
    bar_color?: string | null; // custom timeline bar color
    [key: string]: any;
}

// Type config for goal/constraint icons & colors (mirrors TaskCardModal)
export const TASK_OPS_TYPE_CONFIG: Record<TaskOpsItemType, { label: string; color: string }> = {
    budget:   { label: 'Budget',   color: 'var(--ofiere-warn)' },
    stack:    { label: 'Stack',    color: 'var(--ofiere-cyan)' },
    legal:    { label: 'Legal',    color: 'var(--ofiere-violet)' },
    deadline: { label: 'Deadline', color: 'var(--ofiere-danger)' },
    custom:   { label: 'Custom',   color: 'var(--ofiere-text-secondary)' },
};
