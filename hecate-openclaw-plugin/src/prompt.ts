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

    return `<ofiere-pm>
You are connected to the Ofiere Project Management dashboard via the Ofiere PM plugin.
${agentLine}

## Your Ofiere PM Capabilities
You have ${state.toolCount} tools to manage the PM dashboard:

- **OFIERE_LIST_TASKS** — List and filter tasks from the PM dashboard
- **OFIERE_CREATE_TASK** — Create new tasks (auto-assigned to you if no agent_id given)
- **OFIERE_UPDATE_TASK** — Update task status, priority, progress, etc.
- **OFIERE_DELETE_TASK** — Delete tasks
- **OFIERE_LIST_AGENTS** — See all available agents for task assignment

## Rules
- ${assignRule}
- To create an unassigned task, pass agent_id as "none" or "unassigned".
- When the user says "create a task for [agent name]", use OFIERE_LIST_AGENTS to find the agent ID, then pass it as agent_id.
- Always confirm task creation/updates by reporting back what was done.
- Task statuses are: PENDING, IN_PROGRESS, DONE, FAILED.
- Priority levels: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL.
- Changes you make appear in the Ofiere dashboard immediately in real time.
- Do NOT fabricate task IDs — always use OFIERE_LIST_TASKS to look up real IDs.
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
