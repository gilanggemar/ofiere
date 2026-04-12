# Hecate Dashboard MCP Server

A Model Context Protocol (MCP) server that gives AI agents **full programmatic control** over the Hecate dashboard.

## 🔮 What It Does

When installed as an MCP server, your OpenClaw agents can:
- Create, update, and manage **tasks** across all agents
- Control **agent status**, XP, and configuration
- Trigger and monitor **workflows** and **scheduled events**
- Send **chat messages** and manage conversations
- Run **multi-agent summit sessions**
- Manage **projects**, **knowledge documents**, and **prompt chunks**
- Award **XP**, track **achievements**, and monitor **streaks**
- View **telemetry** and write **audit logs**
- Manage **MCP servers** and **connection profiles**

## 📦 70+ Tools Across 15 Domains

| Domain | Tools | Description |
|--------|-------|-------------|
| Tasks | 7 | Full CRUD + log management |
| Agents | 6 | Status, XP, config |
| Notifications | 5 | Dashboard notifications |
| Scheduler | 6 | Event scheduling |
| Workflows | 8 | Workflow lifecycle |
| Chat | 6 | Conversations & messages |
| Summit | 5 | Multi-agent deliberation |
| Projects | 5 | Project management |
| Knowledge | 5 | Document & fragment search |
| Telemetry | 3 | Usage stats & logging |
| Gamification | 5 | XP, missions, streaks |
| Audit | 2 | Observability logging |
| Prompt Chunks | 4 | Reusable prompt management |
| MCP Servers | 4 | Server registry |
| Connections | 4 | Connection profiles |

## 🚀 Setup

### 1. Install dependencies
```bash
cd dashboard-mcp
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your Supabase credentials
```

### 3. Build
```bash
npm run build
```

### 4. Configure in your agent
Add to your agent's MCP config (e.g. `mcp_settings.json`):

```json
{
  "mcpServers": {
    "hecate-dashboard": {
      "command": "npx",
      "args": ["-y", "@hecate-ai/dashboard-mcp"],
      "env": {
        "SUPABASE_URL": "https://your-project.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key",
        "HECATE_USER_ID": "your-user-uuid"
      }
    }
  }
}
```

## 🏗️ Extensibility

**Adding a new tool domain is 2 steps:**

1. Create `src/tools/my-domain.ts` following the pattern:
```typescript
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const tools: ToolDefinition[] = [
    {
        domain: "my_domain",
        action: "my_action",
        description: "What this tool does",
        inputSchema: {
            param: z.string().describe("Parameter description"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // ... your logic
            return ok({ result: "done" });
        },
    },
];

registerTools(tools);
```

2. Add one import to `src/index.ts`:
```typescript
import "./tools/my-domain.js";
```

## 🔄 Rebranding

To change the tool prefix (e.g. `hecate_tasks_list` → `hecate_tasks_list`):

Edit **one line** in `src/config.ts`:
```typescript
export const TOOL_PREFIX = "hecate"; // was "hecate"
```

Rebuild, and all 70+ tools are rebranded.

## 🧪 Testing

```bash
# Test with MCP Inspector
npm run inspect
```
