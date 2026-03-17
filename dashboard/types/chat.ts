// ─── Unified Chat Types ──────────────────────────────────────────────────────
// Shared between API routes, Zustand store, and UI components.
// Column names are snake_case to match Supabase row shapes exactly.

import type { MissionConfig } from '@/components/chat/MissionBar';

export interface Conversation {
    id: string;
    user_id: string;
    agent_id: string;
    title: string | null;
    pinned: boolean;
    archived: boolean;
    project_id: string | null;
    mission_config: MissionConfig | Record<string, any>;
    message_count: number;
    created_at: string;
    updated_at: string;
}

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
    id: string | number;
    conversation_id: string;
    role: MessageRole;
    content: string;
    branch_id: string;
    parent_message_id: string | null;
    version_group: string | null;
    version_index: number;
    is_checkpoint: boolean;
    checkpoint_label: string | null;
    token_count: number;
    metadata: Record<string, any>;
    created_at: string;
    // UI-only fields (not in DB)
    streaming?: boolean;
    timestamp?: string;
    agentId?: string;
    sessionKey?: string;
    tool_calls?: any[];
    attachments?: any[];
}
