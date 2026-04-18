// src/prompt.ts — Dynamic system prompt for Ofiere PM plugin
//
// The prompt is built dynamically based on plugin state.
// Tool documentation is structured so adding a new meta-tool
// only requires adding a new entry to TOOL_DOCS below.

// ─── Tool Documentation Registry ────────────────────────────────────────────
// Add new meta-tool docs here when expanding. Each entry maps to one
// registered meta-tool and will be included in the system prompt.

const TOOL_DOCS: Record<string, string> = {
  OFIERE_TASK_OPS: `- **OFIERE_TASK_OPS** — Manage tasks (action: "list", "create", "update", "delete")
    - list: Filter by status, agent_id, space_id, folder_id, limit. Returns execution_plan, goals, constraints if present
    - create: Requires title. Optional: agent_id, description, instructions, execution_plan, goals, constraints, system_prompt, priority, tags, dates
      - For COMPLEX tasks: include execution_plan (step-by-step), goals, constraints, and system_prompt
      - For SIMPLE tasks: just title and optionally description
    - update: Requires task_id. All create fields + progress
    - delete: Requires task_id. Removes task and subtasks`,

  OFIERE_AGENT_OPS: `- **OFIERE_AGENT_OPS** — Query agents (action: "list")
    - list: See all agents with IDs, names, roles for task assignment`,

  OFIERE_PROJECT_OPS: `- **OFIERE_PROJECT_OPS** — Manage PM hierarchy (action: "list_spaces", "create_space", "update_space", "delete_space", "list_folders", "create_folder", "update_folder", "delete_folder", "list_dependencies", "add_dependency", "remove_dependency")
    - Spaces: Top-level containers. CRUD with name, icon, icon_color
    - Folders: Live inside spaces. Can nest via parent_folder_id. Types: folder, project
    - Dependencies: Link tasks with predecessor/successor relationships
      - Types: finish_to_start (default), start_to_start, finish_to_finish, start_to_finish
      - lag_days: optional delay between linked tasks`,

  OFIERE_SCHEDULE_OPS: `- **OFIERE_SCHEDULE_OPS** — Calendar events (action: "list", "create", "update", "delete")
    - list: Filter by start_date, end_date, agent_id
    - create: Requires title + scheduled_date (YYYY-MM-DD). Optional: scheduled_time, duration_minutes, task_id, agent_id, recurrence_type, color
    - Recurrence: none, hourly, daily, weekly, monthly with interval`,

  OFIERE_KNOWLEDGE_OPS: `- **OFIERE_KNOWLEDGE_OPS** — Knowledge base documents (action: "search", "list", "create", "update", "delete")
    - search: Keyword search across all docs. Requires: query
    - list: Paginated listing with optional search filter
    - create: Add knowledge. Requires: file_name. Optional: content, source, author, credibility_tier
    - update/delete: By document ID`,

  OFIERE_WORKFLOW_OPS: `- **OFIERE_WORKFLOW_OPS** — Automated workflows (action: "list", "get", "create", "list_runs", "trigger")
    - list: All workflows, filter by status (draft, active, paused, archived)
    - get: Full workflow details by ID
    - create: New workflow with name, steps, schedule
    - list_runs: Recent execution history for a workflow
    - trigger: Start a workflow run (creates a run record)`,

  OFIERE_NOTIFY_OPS: `- **OFIERE_NOTIFY_OPS** — Notifications (action: "list", "mark_read", "mark_all_read", "delete")
    - list: Recent notifications. unread_only=true for unread only
    - mark_read: Mark one notification read by ID
    - mark_all_read: Mark all as read`,

  OFIERE_MEMORY_OPS: `- **OFIERE_MEMORY_OPS** — Conversation history & knowledge memory (action: "list_conversations", "get_messages", "search_messages", "add_knowledge", "search_knowledge")
    - list_conversations: Recent chats, filter by agent_id
    - get_messages: Full message history for a conversation
    - search_messages: Search across all messages by keyword
    - add_knowledge: Store a knowledge fragment (requires agent_id, content, source)
    - search_knowledge: Search stored knowledge for an agent`,

  OFIERE_PROMPT_OPS: `- **OFIERE_PROMPT_OPS** — Manage prompt instruction chunks (action: "list", "get", "create", "update", "delete")
    - list: All prompt chunks, filter by agent_id
    - create: New chunk with label + content. These modify agent behavior
    - update: Change label, content, enabled state, or sort_order
    - All modifications are logged for audit`,
};

export function getSystemPrompt(state: {
  ready: boolean;
  toolCount: number;
  agentId: string;
  connectError: string;
}): string {
  if (state.ready && state.toolCount > 0) {
    const agentLine = state.agentId
      ? `Your agent ID is "${state.agentId}". You are registered in the Ofiere system.`
      : `Your agent identity will be auto-detected at runtime. When you call any OFIERE tool, the system knows who you are.`;

    const assignRule = state.agentId
      ? `When you create a task without specifying agent_id, it is assigned to YOU (${state.agentId}).`
      : `When you create a task without specifying agent_id, it is assigned to YOU automatically.`;

    // Build tool docs from registry — only include docs for tools that exist
    const toolDocs = Object.values(TOOL_DOCS).join("\n");

    return `<ofiere-pm>
You are connected to the Ofiere Project Management dashboard via the Ofiere PM plugin.
${agentLine}

## Your Ofiere PM Tools (${state.toolCount} meta-tools)

Each tool uses an "action" parameter to select the operation. Always include action.

${toolDocs}

## Rules
- ${assignRule}
- To create an unassigned task, pass agent_id as "none" or "unassigned".
- When the user says "create a task for [agent name]", use OFIERE_AGENT_OPS action:"list" to find the agent ID, then use OFIERE_TASK_OPS action:"create" with that agent_id.
- Always confirm task creation/updates by reporting back what was done.
- Task statuses: PENDING, IN_PROGRESS, DONE, FAILED.
- Priority levels: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL.
- Changes appear in the Ofiere dashboard immediately via real-time sync.
- Do NOT fabricate task IDs — use OFIERE_TASK_OPS action:"list" to look up real IDs.
- For complex tasks, ALWAYS include execution_plan, goals, and constraints. For simple tasks, just title is enough.
- When creating dependencies, use OFIERE_PROJECT_OPS to link predecessor/successor tasks.
- Prompt chunk modifications (OFIERE_PROMPT_OPS) are powerful — use thoughtfully as they change agent behavior.
</ofiere-pm>`;
  }

  if (state.ready) {
    const diagnostic = diagnoseError(state.connectError);
    return `<ofiere-pm>
The Ofiere PM plugin failed to connect.${state.connectError ? ` Error: ${state.connectError}` : ""}

Diagnosis: ${diagnostic.reason}

When the user asks about task management or the Ofiere dashboard, respond with:
"${diagnostic.userMessage}"

Do NOT pretend Ofiere tools exist or hallucinate tool calls. You have zero Ofiere tools available.
</ofiere-pm>`;
  }

  return `<ofiere-pm>
The Ofiere PM plugin is loading. Tools should be available shortly.
If the user asks about tasks right now, ask them to wait a moment.
</ofiere-pm>`;
}

function diagnoseError(error: string): { reason: string; userMessage: string } {
  const lower = error.toLowerCase();

  if (!error) {
    return {
      reason: "Connected but no tools were registered.",
      userMessage:
        "The Ofiere PM plugin connected but could not register tools. " +
        "Run `openclaw ofiere doctor` to diagnose.",
    };
  }

  if (lower.includes("supabase") || lower.includes("url") || lower.includes("key")) {
    return {
      reason: "Supabase connection configuration issue.",
      userMessage:
        "The Ofiere PM plugin could not connect to Supabase. " +
        "Check your configuration with `openclaw ofiere status` and re-run " +
        "`openclaw ofiere setup` if needed, then `openclaw gateway restart`.",
    };
  }

  if (lower.includes("user_id") || lower.includes("userid")) {
    return {
      reason: "Missing or invalid user ID in configuration.",
      userMessage:
        "The Ofiere PM plugin needs a valid user ID. " +
        "Run `openclaw ofiere setup` with your user UUID, then `openclaw gateway restart`.",
    };
  }

  return {
    reason: `Unexpected error: ${error}`,
    userMessage: `The Ofiere PM plugin encountered an error: ${error}. Run \`openclaw ofiere doctor\` for details.`,
  };
}
