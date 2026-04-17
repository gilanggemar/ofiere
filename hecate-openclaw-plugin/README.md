# Hecate PM Plugin for OpenClaw

Manage your Hecate PM dashboard directly from OpenClaw agents. Create tasks, update progress, assign agents — all synced to the dashboard in real time.

## Install

```bash
openclaw plugins install @hecate-ai/openclaw-plugin
```

Or install from the local repo (for development):

```bash
openclaw plugins install ./hecate-openclaw-plugin
```

Restart OpenClaw after installing.

## Setup

```bash
openclaw hecate setup --supabase-url "https://xxx.supabase.co" --service-key "eyJ..." --user-id "your-uuid" --agent-id "sasha"
```

Or run interactively:

```bash
openclaw hecate setup
```

Then restart the gateway:

```bash
openclaw gateway restart
```

## How it works

Once configured, the plugin connects to your Supabase database at gateway startup and registers PM tools directly into the agent. There's no separate MCP server process — it runs inside the OpenClaw gateway for maximum reliability.

Changes made by the agent are immediately visible on the Hecate dashboard (Vercel) via Supabase real-time subscriptions.

## AI Tools

| Tool | Description |
|---|---|
| `HECATE_LIST_TASKS` | List and filter PM tasks |
| `HECATE_CREATE_TASK` | Create a new task (auto-assigns to calling agent) |
| `HECATE_UPDATE_TASK` | Update task fields (status, priority, progress, etc.) |
| `HECATE_DELETE_TASK` | Delete a task and its subtasks |
| `HECATE_LIST_AGENTS` | List available agents for task assignment |

## CLI Commands

```bash
openclaw hecate setup     # Configure Supabase connection and agent identity
openclaw hecate status    # View current configuration
openclaw hecate doctor    # Test connection and list agents
```

## Configuration

Set via `openclaw hecate setup` or environment variables:

| Option | Env Var | Description |
|---|---|---|
| `supabaseUrl` | `HECATE_SUPABASE_URL` | Supabase project URL |
| `serviceRoleKey` | `HECATE_SERVICE_ROLE_KEY` | Supabase service role key |
| `userId` | `HECATE_USER_ID` | Your user UUID |
| `agentId` | `HECATE_AGENT_ID` | This agent's ID (e.g. `sasha`) |
| `enabled` | — | Enable/disable the plugin (default: `true`) |

## Architecture

```
OpenClaw Agent (VPS)
     │ plugin runs IN-PROCESS
Hecate Plugin ──► Supabase (shared database)
                      ▲
Hecate Dashboard ─────┘  (Vercel, real-time)
```

Both the agent plugin and the Vercel dashboard talk to the same Supabase instance. When the agent creates/updates a task, the dashboard sees it instantly through Supabase real-time subscriptions.

## Links

- [Hecate Dashboard](https://github.com/gilanggemar/Hecate)
- [OpenClaw](https://openclaw.ai)
- [Supabase](https://supabase.com)
