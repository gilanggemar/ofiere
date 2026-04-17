export function getSystemPrompt(state: {
  ready: boolean;
  toolCount: number;
  agentId: string;
  connectError: string;
}): string {
  if (state.ready && state.toolCount > 0) {
    return `<hecate-pm>
You are connected to the Hecate Project Management dashboard via the Hecate PM plugin.
Your agent ID is "${state.agentId}". You are registered in the Hecate system.

## Your Hecate PM Capabilities
You have ${state.toolCount} tools to manage the PM dashboard:

- **HECATE_LIST_TASKS** — List and filter tasks from the PM dashboard
- **HECATE_CREATE_TASK** — Create new tasks (auto-assigned to you if no agent_id given)
- **HECATE_UPDATE_TASK** — Update task status, priority, progress, etc.
- **HECATE_DELETE_TASK** — Delete tasks
- **HECATE_LIST_AGENTS** — See all available agents for task assignment

## Rules
- When you create a task without specifying agent_id, it is assigned to YOU (${state.agentId}).
- When the user says "create a task for [agent name]", use HECATE_LIST_AGENTS to find the agent ID, then pass it as agent_id.
- Always confirm task creation/updates by reporting back what was done.
- Task statuses are: PENDING, IN_PROGRESS, DONE, FAILED.
- Priority levels: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL.
- Changes you make appear in the Hecate dashboard immediately in real time.
- Do NOT fabricate task IDs — always use HECATE_LIST_TASKS to look up real IDs.
</hecate-pm>`;
  }

  if (state.ready) {
    const diagnostic = diagnoseError(state.connectError);
    return `<hecate-pm>
The Hecate PM plugin failed to connect.${state.connectError ? ` Error: ${state.connectError}` : ""}

Diagnosis: ${diagnostic.reason}

When the user asks about task management or the Hecate dashboard, respond with:
"${diagnostic.userMessage}"

Do NOT pretend Hecate tools exist or hallucinate tool calls. You have zero Hecate tools available.
</hecate-pm>`;
  }

  return `<hecate-pm>
The Hecate PM plugin is loading. Tools should be available shortly.
If the user asks about tasks right now, ask them to wait a moment.
</hecate-pm>`;
}

function diagnoseError(error: string): { reason: string; userMessage: string } {
  const lower = error.toLowerCase();

  if (!error) {
    return {
      reason: "Connected but no tools were registered.",
      userMessage:
        "The Hecate PM plugin connected but could not register tools. " +
        "Run `openclaw hecate doctor` to diagnose.",
    };
  }

  if (lower.includes("supabase") || lower.includes("url") || lower.includes("key")) {
    return {
      reason: "Supabase connection configuration issue.",
      userMessage:
        "The Hecate PM plugin could not connect to Supabase. " +
        "Check your configuration with `openclaw hecate status` and re-run " +
        "`openclaw hecate setup` if needed, then `openclaw gateway restart`.",
    };
  }

  if (lower.includes("user_id") || lower.includes("userid")) {
    return {
      reason: "Missing or invalid user ID in configuration.",
      userMessage:
        "The Hecate PM plugin needs a valid user ID. " +
        "Run `openclaw hecate setup` with your user UUID, then `openclaw gateway restart`.",
    };
  }

  return {
    reason: `Unexpected error: ${error}`,
    userMessage: `The Hecate PM plugin encountered an error: ${error}. Run \`openclaw hecate doctor\` for details.`,
  };
}
