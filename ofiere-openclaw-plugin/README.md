# Ofiere PM Plugin for OpenClaw

Manage your Ofiere PM dashboard directly from OpenClaw agents. Create tasks, manage projects, build workflows, store knowledge — all synced to the dashboard in real time.

## Quick Install (One-Click)

```bash
curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s -- \
  --supabase-url "https://xxx.supabase.co" \
  --service-key "eyJ..." \
  --user-id "your-uuid"
```

Only 3 parameters needed. All agents get the plugin automatically.

## Uninstall

```bash
curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/uninstall.sh | bash
```

## How It Works

Once configured, the plugin connects to your Supabase database at gateway startup and registers 9 PM meta-tools directly into the agent. There's no separate MCP server process — it runs inside the OpenClaw gateway for maximum reliability.

Changes made by the agent are immediately visible on the Ofiere dashboard (Vercel) via Supabase real-time subscriptions.

## AI Meta-Tools

The plugin uses a scalable meta-tool architecture. Each tool handles one domain with an `action` parameter to select the operation.

| Tool | Actions | Description |
|---|---|---|
| `OFIERE_TASK_OPS` | `list`, `create`, `update`, `delete` | Rich task management with execution plans, goals, constraints |
| `OFIERE_AGENT_OPS` | `list` | Query available agents for task assignment |
| `OFIERE_PROJECT_OPS` | `list_spaces`, `create_space`, `create_folder`, `bulk_create_tasks`, etc. | Full project hierarchy: spaces → folders → tasks |
| `OFIERE_SCHEDULE_OPS` | `list`, `create`, `update`, `delete` | Calendar events with recurrence |
| `OFIERE_KNOWLEDGE_OPS` | `search`, `list`, `create`, `update`, `delete` | Knowledge library with full content retrieval |
| `OFIERE_WORKFLOW_OPS` | `list`, `get`, `create`, `update`, `delete`, `list_runs`, `trigger` | Visual workflow builder with 16 node types |
| `OFIERE_NOTIFY_OPS` | `list`, `mark_read`, `create` | In-app notifications |
| `OFIERE_MEMORY_OPS` | `list_conversations`, `search_knowledge` | Conversation history & agent memory |
| `OFIERE_PROMPT_OPS` | `list`, `get`, `create`, `update`, `delete` | System prompt chunk management |

### Example

```
// Create a task with execution plan
OFIERE_TASK_OPS({ action: "create", title: "Deploy v2", agent_id: "ivy",
  execution_plan: [{ step: 1, action: "Build", detail: "Run production build" }] })

// Create a workflow with nodes
OFIERE_WORKFLOW_OPS({ action: "create", name: "Deploy Pipeline",
  nodes: [
    { type: "agent_step", data: { label: "Build", task: "Run npm build" } },
    { type: "human_approval", data: { label: "Review", instructions: "Check build output" } },
    { type: "output", data: { label: "Done" } }
  ],
  edges: [
    { source: "agent_step-...", target: "human_approval-..." },
    { source: "human_approval-...", target: "output-..." }
  ]
})

// Search knowledge library
OFIERE_KNOWLEDGE_OPS({ action: "search", query: "API rate limits" })
```

## CLI Commands

```bash
openclaw ofiere setup     # Configure Supabase connection and agent identity
openclaw ofiere status    # View current configuration
openclaw ofiere doctor    # Test connection and list agents
```

## Configuration

Set via `openclaw ofiere setup` or environment variables:

| Option | Env Var | Description |
|---|---|---|
| `supabaseUrl` | `OFIERE_SUPABASE_URL` | Supabase project URL |
| `serviceRoleKey` | `OFIERE_SERVICE_ROLE_KEY` | Supabase service role key |
| `userId` | `OFIERE_USER_ID` | Your user UUID |
| `agentId` | `OFIERE_AGENT_ID` | This agent's ID (optional — auto-detected) |
| `enabled` | — | Enable/disable the plugin (default: `true`) |

## Architecture

```
OpenClaw Agent (VPS)
     │ plugin runs IN-PROCESS
Ofiere Plugin ──► Supabase (shared database)
                      ▲
Ofiere Dashboard ─────┘  (Vercel, real-time)
```

Both the agent plugin and the Vercel dashboard talk to the same Supabase instance. When the agent creates/updates a task, the dashboard sees it instantly through Supabase real-time subscriptions.

## Links

- [Ofiere Dashboard](https://github.com/gilanggemar/Ofiere)
- [OpenClaw](https://openclaw.ai)
- [Supabase](https://supabase.com)
