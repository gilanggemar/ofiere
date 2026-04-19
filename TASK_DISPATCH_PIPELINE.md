# Task Dispatch Pipeline — Ofiere → OpenClaw

> Automated task scheduling, dispatch, and execution across the Ofiere dashboard and OpenClaw agent ecosystem.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         OFIERE DASHBOARD                                │
│                         (Vercel / Next.js)                              │
│                                                                         │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐  │
│  │  Agent Chat   │   │  Task-Ops Panel  │   │  Manual Play ▶ Button  │  │
│  │  "Buy coffee  │   │  Create / Edit   │   │  Immediate dispatch    │  │
│  │   in 2 days"  │   │  tasks manually  │   │  via client-side WS    │  │
│  └──────┬───────┘   └───────┬──────────┘   └───────────┬────────────┘  │
│         │                   │                           │               │
│         ▼                   ▼                           │               │
│  ┌──────────────────────────────────┐                   │               │
│  │  OpenClaw Plugin (v3.2.0)        │                   │               │
│  │  OFIERE_TASK_OPS → create        │                   │               │
│  │  Auto-creates scheduler_event    │                   │               │
│  │  when start_date is provided     │                   │               │
│  └──────────────┬───────────────────┘                   │               │
│                 │                                       │               │
└─────────────────┼───────────────────────────────────────┼───────────────┘
                  │                                       │
                  ▼                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          SUPABASE                                       │
│                                                                         │
│  ┌──────────────┐  ┌───────────────────┐  ┌──────────────────────────┐ │
│  │    tasks      │  │ scheduler_events  │  │  task_dispatch_log       │ │
│  │              │  │                   │  │                          │ │
│  │  id          │  │  id               │  │  id                     │ │
│  │  title       │  │  task_id ────────►│  │  task_id                │ │
│  │  agent_id    │  │  agent_id         │  │  agent_id               │ │
│  │  status      │  │  next_run_at      │  │  dispatch_type          │ │
│  │  start_date  │  │  recurrence_type  │  │  status (dispatched/    │ │
│  │  custom_fields│ │  run_count        │  │          failed)        │ │
│  └──────────────┘  └────────┬──────────┘  │  prompt_preview         │ │
│                             │             │  error                  │ │
│                             │             └──────────────────────────┘ │
│                             │                                          │
│  ┌──────────────────────────┴──────────────────────────────┐           │
│  │  pg_cron job: "task-dispatcher-cron"                     │           │
│  │  Schedule: * * * * * (every minute)                      │           │
│  │  Action: net.http_post() → Edge Function                 │           │
│  └──────────────────────────┬──────────────────────────────┘           │
│                             │                                          │
│  ┌──────────────────────────▼──────────────────────────────┐           │
│  │  Edge Function: task-dispatcher (v6)                     │           │
│  │                                                          │           │
│  │  1. Query scheduler_events WHERE next_run_at <= now()    │           │
│  │  2. Query tasks WHERE start_date <= today AND PENDING    │           │
│  │  3. Build structured prompt from task data               │           │
│  │  4. Open WSS → gateway.ofiere.com                        │           │
│  │  5. Ed25519 handshake (connect.challenge → connect)      │           │
│  │  6. chat.send → agent                                    │           │
│  │  7. Log result to task_dispatch_log                      │           │
│  │  8. Update task status → IN_PROGRESS                     │           │
│  │  9. Compute next_run_at for recurring events             │           │
│  └──────────────────────────┬──────────────────────────────┘           │
│                             │                                          │
└─────────────────────────────┼──────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     PUBLIC GATEWAY                                       │
│                                                                         │
│  gateway.ofiere.com (DNS A record → 76.13.193.227)                     │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  nginx (port 443, SSL via Let's Encrypt)                         │   │
│  │  - WSS upgrade: proxy_set_header Upgrade / Connection            │   │
│  │  - proxy_pass → http://127.0.0.1:63966                          │   │
│  │  - proxy_read_timeout 86400s (24h for long-lived WS)             │   │
│  │  - Config: /etc/nginx/sites-available/openclaw-gateway           │   │
│  │  - SSL cert auto-renews via certbot                              │   │
│  └──────────────────────────┬───────────────────────────────────────┘   │
│                             │                                           │
│  ┌──────────────────────────▼───────────────────────────────────────┐   │
│  │  OpenClaw Gateway (Docker: openclaw-bvwc-openclaw-1)             │   │
│  │  Port: 63966 (mapped from Docker)                                │   │
│  │                                                                   │   │
│  │  Agents: ivy, celia, daisy, thalia, sasha                        │   │
│  │                                                                   │
│  │  Agent receives structured prompt → executes task → calls         │   │
│  │  OFIERE_TASK_OPS with status: "DONE" or "FAILED"                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dispatch Modes

### 1. Scheduled Dispatch (Fire-and-Forget)

**Trigger**: pg_cron fires every 60 seconds.

```
pg_cron → HTTP POST → Edge Function → query due events → WSS → OpenClaw → agent executes
```

- The Edge Function opens a WebSocket, sends the task prompt, closes after `chat.send` acknowledgment.
- Does **not** wait for the agent's response.
- Task status set to `IN_PROGRESS` immediately.
- Agent calls `OFIERE_TASK_OPS` with `status: "DONE"` or `"FAILED"` when finished.
- Recurring tasks: `next_run_at` is recomputed; same task ID is reused with status reset.

### 2. Manual Dispatch (Synchronous)

**Trigger**: User clicks the ▶ Play button in Task-Ops.

```
Play button → client-side WebSocket → OpenClaw → agent responds in real-time
             → POST /api/tasks/execute → Edge Function → dispatch log
```

- Primary: Client-side WebSocket dispatch (immediate, visible in chat UI).
- Secondary: Non-blocking POST to `/api/tasks/execute` for server-side logging.
- User sees a toast notification and the agent's response streams into the chat.

---

## Prompt Format

The Edge Function builds a structured markdown prompt from the task data:

```markdown
## SCHEDULED TASK: Buy coffee
**Task ID:** `task-abc123`

### Instructions
Buy some premium coffee from the local store.

### Execution Plan
1. Search for nearby coffee shops
2. Compare prices
3. Place the order

### Goals
- Get the best quality beans
- Stay under $30

### Constraints
- [BUDGET] Maximum $30
- Only organic/fair-trade

---
Execute this task now. Use your available tools and capabilities to complete it.

**IMPORTANT — Task Lifecycle:**
- When you **finish** this task successfully, call `OFIERE_TASK_OPS` with
  `action: "update"`, `task_id: "task-abc123"`, and `status: "DONE"`.
- If the task **fails** or you cannot complete it, call `OFIERE_TASK_OPS` with
  `action: "update"`, `task_id: "task-abc123"`, and `status: "FAILED"`.
- Report your progress and results in the chat.
```

---

## WebSocket Authentication

The Edge Function uses the **same Ed25519 handshake protocol** as the dashboard:

| Step | Description |
|---|---|
| 1. Connect | `new WebSocket("wss://gateway.ofiere.com")` |
| 2. Challenge | Server sends `connect.challenge` with `nonce` |
| 3. Sign | Edge Function signs `v3|deviceId|clientId|mode|role|scopes|signedAt|token|nonce|platform|deviceFamily` with Ed25519 private key |
| 4. Connect | Sends signed `connect` request with `client.id: "openclaw-control-ui"` |
| 5. Handshake OK | Server responds with `hello-ok` |
| 6. Chat | Sends `chat.send` with task prompt to the agent's session |
| 7. Close | Closes WebSocket after acknowledgment |

The keypair is generated on first run and persisted in the `task_dispatch_log` table (dispatch_type: `keypair`) to survive Edge Function cold starts.

---

## Database Tables

### `scheduler_events`

Created automatically by the plugin when a task has a `start_date`.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `user_id` | uuid | Owner |
| `task_id` | text | FK → tasks.id |
| `agent_id` | text | Which agent runs this |
| `next_run_at` | bigint | Unix epoch — when to fire |
| `recurrence_type` | text | `none`, `hourly`, `daily`, `weekly`, `monthly` |
| `recurrence_interval` | int | Every N units |
| `run_count` | int | Times dispatched |
| `status` | text | `scheduled`, `running`, `completed` |

### `task_dispatch_log`

Observability table for every dispatch attempt.

| Column | Type | Description |
|---|---|---|
| `id` | uuid | Primary key |
| `task_id` | text | Which task |
| `scheduler_event_id` | uuid | Which event triggered this |
| `agent_id` | text | Target agent |
| `dispatch_type` | text | `scheduled`, `recurring`, `manual` |
| `status` | text | `dispatched`, `failed` |
| `prompt_preview` | text | First 500 chars of prompt |
| `error` | text | Error message if failed |
| `dispatched_at` | timestamptz | When |
| `user_id` | uuid | Owner |

---

## Infrastructure

### DNS

```
gateway.ofiere.com  →  A  →  76.13.193.227  (TTL: 60s, Vercel DNS)
```

### nginx Configuration

**File**: `/etc/nginx/sites-available/openclaw-gateway`

- Listens on `76.13.193.227:443` (avoids conflict with Tailscale's `100.x.x.x:443`)
- SSL via Let's Encrypt (auto-renews, expires July 18, 2026)
- Proxies to `http://127.0.0.1:63966` (Docker OpenClaw container)
- 24-hour read/send timeout for long-lived WebSocket connections

### Edge Function Secrets

Set in **Supabase Dashboard → Edge Functions → Secrets**:

| Secret | Value |
|---|---|
| `OPENCLAW_WS_URL` | `wss://gateway.ofiere.com` |
| `OPENCLAW_AUTH_TOKEN` | *(gateway token from OpenClaw)* |
| `DISPATCH_SECRET` | `ofiere-dispatch-secret` |

### pg_cron Job

```sql
SELECT cron.schedule(
  'task-dispatcher-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://wcpqanwpngqnsstcvvis.supabase.co/functions/v1/task-dispatcher',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-dispatch-secret', 'ofiere-dispatch-secret'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

---

## Data Flow: End-to-End

```
1. USER    →  "Celia, buy coffee two days from now"
2. CELIA   →  calls OFIERE_TASK_OPS { action: "create", title: "Buy coffee", start_date: "2026-04-21" }
3. PLUGIN  →  INSERT INTO tasks (...) + INSERT INTO scheduler_events (next_run_at: 2026-04-21 09:00 UTC)
4. CRON    →  every minute, pg_cron fires HTTP POST to Edge Function
5. EDGE FN →  on April 21 at 09:00, finds the due event
6. EDGE FN →  builds prompt, opens WSS to gateway.ofiere.com
7. NGINX   →  proxies WSS to Docker port 63966
8. EDGE FN →  Ed25519 handshake → chat.send to celia
9. CELIA   →  receives prompt, executes the task
10. EDGE FN →  logs to task_dispatch_log, sets task status → IN_PROGRESS
11. CELIA   →  finishes, calls OFIERE_TASK_OPS { action: "update", status: "DONE" }
12. PLUGIN  →  updates task status → DONE in database
```

---

## Multi-Tenant Design (Future)

Each user configures their own OpenClaw gateway URL in dashboard settings. The dispatcher reads the gateway URL **per user** from the `connection_profiles` table.

```
User A  →  wss://their-gateway.example.com
User B  →  wss://another.server.io
You     →  wss://gateway.ofiere.com
```

The Edge Function resolves the correct WSS URL at dispatch time:

```
1. Find due event → get user_id
2. Look up connection_profiles for that user_id
3. Connect to their specific gateway URL
4. Dispatch the task
```

Users never touch DNS, nginx, or infrastructure. They just provide a reachable WebSocket URL.

---

## Verified: April 19, 2026

| Test | Result |
|---|---|
| DNS `gateway.ofiere.com` resolves to VPS | ✅ `76.13.193.227` |
| HTTPS returns OpenClaw login page | ✅ 200 OK |
| WSS upgrade through nginx | ✅ `connect.challenge` received |
| Ed25519 handshake | ✅ Authenticated |
| `chat.send` to Celia | ✅ Dispatched |
| `task_dispatch_log` entry created | ✅ `status: dispatched` |
| Task status updated to IN_PROGRESS | ✅ |
| pg_cron fires on schedule | ✅ Every 60 seconds |
| Prompt includes lifecycle instructions | ✅ OFIERE_TASK_OPS DONE/FAILED |
