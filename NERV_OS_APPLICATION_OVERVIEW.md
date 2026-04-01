# NERV.OS — Complete Application Overview

> **Last Updated:** March 31, 2026  
> **Version:** 0.1.0  
> **Status:** Active Development (Deployed to Vercel)  
> **Repository:** `gilanggemar/NERV`

---

## Table of Contents

1. [What is NERV.OS?](#what-is-nervos)
2. [Application Type & Purpose](#application-type--purpose)
3. [Technology Stack](#technology-stack)
4. [Project Structure](#project-structure)
5. [Architecture Overview](#architecture-overview)
6. [Authentication & Security](#authentication--security)
7. [Database System](#database-system)
8. [State Management](#state-management)
9. [Agent System](#agent-system)
10. [Core Features](#core-features)
11. [UI/UX Design System](#uiux-design-system)
12. [External Integrations](#external-integrations)
13. [API Layer](#api-layer)
14. [Real-Time Communication](#real-time-communication)
15. [Gamification System](#gamification-system)
16. [Games & Interactive Features](#games--interactive-features)
17. [Deployment & Infrastructure](#deployment--infrastructure)
18. [Environment Configuration](#environment-configuration)

---

## What is NERV.OS?

**NERV.OS** (Neural Execution & Response Virtualization — Operating System) is a **full-stack AI agent orchestration dashboard**. It serves as a command-and-control interface for managing, monitoring, and interacting with multiple AI agents in real-time. The application provides a sophisticated, dark-themed "mission control" style interface where users can chat with AI agents, build workflows, manage tasks, and observe agent operations — all through a premium, visually immersive web experience.

Think of it as **a mission control center for AI agents** — where each agent has a unique personality, role, and set of capabilities, and the user acts as the "operator" commanding a fleet of autonomous AI workers.

---

## Application Type & Purpose

| Attribute | Detail |
|---|---|
| **Type** | Full-Stack Web Application (SPA with SSR) |
| **Category** | AI Agent Orchestration Dashboard / Command Center |
| **Primary Function** | Manage, monitor, and interact with multiple AI agents |
| **Target Users** | AI operators, developers, power users |
| **Deployment Model** | Cloud-hosted (Vercel) with external VPS connections |

### Core Value Propositions

- **Multi-Agent Management** — Control a fleet of specialized AI agents from a single dashboard
- **Real-Time Communication** — WebSocket-based live streaming of agent thoughts, actions, and tool usage
- **Visual Workflow Builder** — Drag-and-drop node editor for designing multi-step AI workflows
- **Agent Personalization** — Custom avatars, hero images, backgrounds, and color themes per agent
- **Gamification Layer** — XP, levels, streaks, achievements, and daily missions to track agent activity
- **Multi-Provider Support** — Switch between OpenAI, Anthropic, Google, Groq, Mistral, DeepSeek, xAI, Ollama, and more
- **Interactive Games** — Built-in games (Neuroverse board game, Pentagram Protocol visual novel) for entertainment and agent testing

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|---|---|---|
| **Next.js** | 16.1.6 | React meta-framework (App Router, SSR, API Routes) |
| **React** | 19.2.3 | UI component library |
| **TypeScript** | 5.x | Type-safe development |
| **Tailwind CSS** | 4.x | Utility-first CSS framework |
| **Framer Motion** | 12.34.3 | Animations and transitions |
| **Zustand** | 5.0.11 | Client-side state management |
| **Radix UI** | 1.4.3 | Accessible headless UI primitives |
| **shadcn/ui** | New York style | Pre-built component library (dialog, popover, tabs, etc.) |
| **Lucide React** | 0.575.0 | Icon library |
| **Tabler Icons React** | 3.37.1 | Additional icon library |
| **Recharts** | 3.7.0 | Charting and data visualization |
| **XY Flow (React Flow)** | 12.10.1 | Node-based visual workflow editor |
| **React Force Graph 2D** | 1.29.1 | Force-directed graph visualization |
| **D3 Force / D3 Scale** | 3.x / 4.x | Physics-based graph layouts |
| **tsParticles** | 3.x | Particle effects and animations |
| **Three.js** | 0.167.1 | 3D rendering (ambient effects) |
| **React Markdown** | 10.1.0 | Markdown rendering in chat |
| **Remark GFM** | 4.0.1 | GitHub Flavored Markdown support |
| **Rehype Highlight** | 7.0.2 | Syntax highlighting in markdown |
| **Highlight.js** | 11.11.1 | Code syntax highlighting engine |
| **cmdk** | 1.1.1 | Command palette (⌘K) |
| **Sonner** | 2.0.7 | Toast notifications |
| **date-fns** | 4.1.0 | Date utility library |
| **html2canvas** | 1.4.1 | Screenshot/export functionality |
| **react-easy-crop** | 5.5.6 | Image cropping |
| **DnD Kit** | 6.x / 10.x | Drag and drop functionality |

### Backend & Data

| Technology | Version | Purpose |
|---|---|---|
| **Next.js API Routes** | 16.1.6 | Server-side API endpoints |
| **Supabase** | 2.98.0 | PostgreSQL database, auth, storage |
| **Supabase SSR** | 0.9.0 | Server-side Supabase client |
| **Drizzle ORM** | 0.45.1 | Type-safe SQL query builder |
| **Drizzle Kit** | 0.31.9 | Database migration tool |
| **Anthropic SDK** | 0.78.0 | Claude API integration |

### Communication

| Technology | Version | Purpose |
|---|---|---|
| **WebSocket (native)** | — | OpenClaw Gateway protocol (JSON-RPC) |
| **Socket.io Client** | 4.8.3 | Agent Zero real-time connection |
| **ws** | 8.19.0 | WebSocket utilities |
| **ssh2** | 1.17.0 | SSH tunneling for VPS connections |

### Fonts

| Font | Purpose |
|---|---|
| **Outfit** | Primary UI font (headings, body text) |
| **JetBrains Mono** | Monospace font (code blocks, terminal, logs) |

### Build & DevOps

| Technology | Purpose |
|---|---|
| **Turbopack** | Next.js dev server (fast HMR) |
| **PostCSS** | CSS processing pipeline |
| **ESLint** | Code linting |
| **Vercel** | Production hosting & deployment |
| **GitHub** | Source control |

---

## Project Structure

```
NERV.OS/
├── architecture/              # Architecture documentation
│   ├── database_schema.md     # Database schema docs
│   ├── frontend_state.md      # State management docs
│   └── websocket_events.md    # WebSocket protocol docs
├── docs/                      # User-facing documentation
│   ├── Chat_Features_Deep_Analysis.md
│   ├── MAINTENANCE.md
│   └── USER_GUIDE.md
├── tools/                     # DevOps & debug utilities
│   ├── check_dashboard_access.js
│   ├── check_gateway.js
│   ├── check_ws_gateway.js
│   ├── debug_scopes.js
│   ├── list_agents.js
│   ├── probe_api.js
│   ├── update_vercel_project.js
│   └── upload_vercel_env.js
└── dashboard/                 # ← Main Next.js Application
    ├── app/                   # Next.js App Router pages
    │   ├── (auth)/            # Auth routes (login, signup)
    │   ├── agents/            # Agent management page
    │   ├── api/               # 35+ API route handlers
    │   ├── api-reference/     # API documentation page
    │   ├── chat/              # Chat interface page
    │   ├── console/           # System console page
    │   ├── dashboard/         # Main dashboard (Command Center)
    │   │   ├── audit/         # Audit log viewer
    │   │   ├── capabilities/  # Agent capabilities browser
    │   │   ├── constellation/ # Constellation builder
    │   │   ├── games/         # Games arena
    │   │   ├── knowledge/     # Knowledge base
    │   │   ├── memory/        # Memory system
    │   │   ├── notifications/ # Notifications center
    │   │   ├── observability/ # Telemetry & metrics
    │   │   ├── scheduler/     # Calendar & scheduler
    │   │   └── workflows/     # Workflow builder
    │   ├── settings/          # Settings pages
    │   │   ├── bridges/       # Platform bridge config
    │   │   └── providers/     # AI provider config
    │   └── summit/            # Multi-agent summit page
    ├── components/            # React components
    │   ├── ui/                # 28 shadcn/ui base components
    │   ├── navigation/        # Shell frame, dock, top rail
    │   ├── command-center/    # Dashboard overview widgets
    │   ├── agent-showcase/    # Agent identity & customization
    │   ├── agent-zero/        # Agent Zero terminal/process tree
    │   ├── chat/              # Chat interface components
    │   ├── workflow-builder/  # Visual workflow canvas
    │   ├── constellation-builder/ # Agent constellation editor
    │   ├── games/             # Game components
    │   │   └── pentagram/     # Pentagram Protocol visual novel
    │   ├── observability/     # Telemetry charts
    │   ├── prompt-chunks/     # Prompt chunk system
    │   ├── scheduler/         # Calendar/scheduler components
    │   ├── settings/          # Connection profile management
    │   ├── landing/           # Landing page
    │   └── overview/          # Overview dashboard widgets
    ├── store/                 # Zustand stores (24 stores)
    ├── stores/                # Additional Zustand stores (8 stores)
    ├── hooks/                 # Custom React hooks (9 hooks)
    ├── lib/                   # Shared utilities & services
    │   ├── supabase/          # Supabase client/server/middleware
    │   ├── providers/         # AI provider adapters (10 adapters)
    │   ├── openclaw/          # OpenClaw capability parser
    │   ├── mcp/               # MCP server client
    │   ├── gamification/      # XP engine, missions, achievements
    │   ├── memory/            # Conversation memory system
    │   ├── workflow/          # Workflow execution engine
    │   ├── chat/              # Chat adapter system
    │   ├── bridges/           # Platform bridge integrations
    │   ├── notifications/     # Notification system
    │   ├── telemetry/         # Telemetry tracking
    │   └── scheduler/         # Scheduling logic
    ├── drizzle/               # Database schema & migrations
    │   ├── schema.ts          # Full PostgreSQL schema (466 lines)
    │   └── migrations/        # SQL migration files
    ├── types/                 # TypeScript type definitions
    ├── scripts/               # Utility scripts
    └── public/                # Static assets
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        NERV.OS Dashboard                        │
│                    (Next.js 16 — App Router)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│   │  Landing  │  │   Chat   │  │ Workflow  │  │   Command    │  │
│   │   Page    │  │Interface │  │ Builder   │  │   Center     │  │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬───────┘  │
│        │              │              │               │          │
│   ┌────┴──────────────┴──────────────┴───────────────┴──────┐  │
│   │              Zustand State Management (32 stores)        │  │
│   └────┬──────────────┬──────────────┬───────────────┬──────┘  │
│        │              │              │               │          │
│   ┌────┴──────────────┴──────────────┴───────────────┴──────┐  │
│   │              Next.js API Routes (35+ endpoints)          │  │
│   └────┬──────────────┬──────────────┬───────────────┬──────┘  │
│        │              │              │               │          │
├────────┼──────────────┼──────────────┼───────────────┼──────────┤
│        ▼              ▼              ▼               ▼          │
│   ┌─────────┐   ┌──────────┐  ┌──────────┐   ┌───────────┐   │
│   │Supabase │   │ OpenClaw │  │Agent Zero│   │    MCP    │   │
│   │ (Auth,  │   │ Gateway  │  │ (REST +  │   │  Servers  │   │
│   │ DB,     │   │(WebSocket│  │  Socket  │   │  (SSE)    │   │
│   │Storage) │   │ JSON-RPC)│  │  .io)    │   │           │   │
│   └─────────┘   └──────────┘  └──────────┘   └───────────┘   │
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐  │
│   │           AI Provider Adapters (10 providers)            │  │
│   │  OpenAI · Anthropic · Google · Groq · Mistral · xAI     │  │
│   │  DeepSeek · Together · Ollama · OpenClaw                 │  │
│   └─────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Core Architecture Patterns

1. **Next.js App Router** — File-system based routing with React Server Components
2. **API Proxy Pattern** — All external calls (Agent Zero, OpenClaw, providers) go through `/api/*` routes — never directly from the browser
3. **WebSocket + Polling Hybrid** — OpenClaw uses native WebSocket with JSON-RPC; Agent Zero uses Socket.io + REST polling fallback
4. **Zustand State Slices** — 32 independent stores for agents, chat, workflows, gamification, etc.
5. **Provider Adapter Pattern** — Unified interface for 10+ AI model providers via interchangeable adapters
6. **Connection Profiles** — Users can configure and switch between multiple VPS/backend connection profiles

---

## Authentication & Security

### Authentication Provider: Supabase Auth

- **Login Methods:** Email + Password (via Supabase Auth)
- **Session Management:** Cookie-based sessions managed through Next.js middleware
- **Middleware:** Every request (except static assets) passes through `middleware.ts` which calls `updateSession()` to refresh/validate the Supabase auth cookie
- **Server-Side Auth:** API routes extract user ID via `getAuthUserId()` helper
- **Auth UI:** Custom dark-luxury themed login/signup pages at `/(auth)/login` and `/(auth)/signup`

### Security Features

- **API Key Encryption:** Provider API keys are encrypted before storage using Web Crypto API
- **Ed25519 Device Authentication:** OpenClaw Gateway uses Ed25519 keypair-based challenge-response authentication
- **Device Identity Persistence:** Keypairs are stored in `localStorage` with a derived device ID (SHA-256 hash of public key)
- **Multi-Scope Authorization:** OpenClaw connections request specific scopes (`operator.read`, `operator.write`, `operator.admin`, `operator.approvals`)
- **Connection Secrets:** Encrypted storage for VPS connection credentials in the `connection_secrets` table
- **Exec Approval System:** Commands requiring system execution present an approval modal before proceeding

---

## Database System

### Primary Database: Supabase (PostgreSQL)

The application uses **Supabase** as its managed PostgreSQL database, accessed via:
- **Supabase Client** (`@supabase/supabase-js`) for runtime queries
- **Drizzle ORM** (`drizzle-orm`) for type-safe schema definitions and migrations

### Schema Overview (13 Domain Areas, 30+ Tables)

#### 1. Agent System
| Table | Purpose |
|---|---|
| `agents` | Core agent profiles (name, codename, role, avatar, hero image, specialty, temperature, status) |
| `hero_images` | Gallery of hero images per agent (image data, sort order) |
| `agent_provider_config` | Per-agent AI provider + model configuration |
| `agent_xp` | Agent experience points, level, rank progression |

#### 2. Task & Summit System
| Table | Purpose |
|---|---|
| `tasks` | Task assignments with status tracking (PENDING, IN_PROGRESS, DONE, FAILED) |
| `task_logs` | Streaming log entries attached to tasks |
| `summit_sessions` | Multi-agent deliberation sessions (topic, participants, rounds) |
| `summit_messages` | Transcript of summit discussions with round-based structure |

#### 3. Provider System
| Table | Purpose |
|---|---|
| `providers` | Configured AI providers (OpenAI, Anthropic, etc.) with encrypted API keys |
| `provider_models` | Available models per provider (context window, pricing, capabilities) |

#### 4. Telemetry & Audit
| Table | Purpose |
|---|---|
| `telemetry_logs` | Token usage, cost tracking, latency metrics per API call |
| `audit_logs` | System-wide audit trail (actions, diffs, session/summit references) |

#### 5. Memory System
| Table | Purpose |
|---|---|
| `conversations` | Conversation threads per agent |
| `conversation_messages` | Individual messages within conversations |
| `knowledge_fragments` | Agent knowledge base entries (tagged, importance-weighted) |
| `knowledge_documents` | Uploaded documents for agent context |

#### 6. Workflow System
| Table | Purpose |
|---|---|
| `workflows` | Workflow definitions (name, steps as JSON, schedule, status) |
| `workflow_runs` | Execution history for workflows |
| `workflow_templates` | Pre-built workflow templates |

#### 7. Constellation System
| Table | Purpose |
|---|---|
| `constellations` | Agent constellation graphs (nodes/edges as JSON) |

#### 8. Notifications & Alerts
| Table | Purpose |
|---|---|
| `notifications` | System notifications (type, title, message, read status) |
| `alert_rules` | Configurable alert triggers (conditions, thresholds, channels, cooldowns) |

#### 9. Scheduler & Webhooks
| Table | Purpose |
|---|---|
| `scheduled_tasks` | Cron-based recurring agent tasks |
| `scheduler_events` | Calendar events with recurrence support |
| `webhook_configs` | Inbound webhook configurations |

#### 10. Platform Integrations
| Table | Purpose |
|---|---|
| `mcp_servers` | MCP (Model Context Protocol) server connections |
| `platform_bridges` | External platform integrations (Discord, Slack, etc.) |
| `api_keys` | API keys for programmatic access (hashed, permissioned) |

#### 11. Games
| Table | Purpose |
|---|---|
| `games_sessions` | Game session records |
| `games_events` | Game event timeline |

#### 12. Prompt Chunks
| Table | Purpose |
|---|---|
| `prompt_chunks` | Reusable prompt fragments (color-coded, categorized, orderable) |

#### 13. Connection & Security
| Table | Purpose |
|---|---|
| `connection_secrets` | Encrypted VPS connection credentials |
| `connection_profiles` | Named connection profiles for OpenClaw/Agent Zero backends |

#### 14. Gamification
| Table | Purpose |
|---|---|
| `xp_events` | XP award log per agent |
| `daily_missions` | Generated daily missions with targets and rewards |
| `achievements` | Achievement definitions (conditions, rarity, XP rewards) |
| `unlocked_achievements` | Per-agent achievement unlock records |
| `operations_streak` | Operations streak tracking (current, longest, history) |

---

## State Management

The application uses **Zustand** for all client-side state, organized into **32 independent stores** across two directories:

### Primary Stores (`/store/` — 24 stores)

| Store | Purpose |
|---|---|
| `useAgentStore` | Live agent status tracking |
| `useAgentSettingsStore` | Agent configuration state |
| `useAgentZeroStore` | Agent Zero connection + process state |
| `useAuthStore` | Authentication session state |
| `useAuditStore` | Audit log data |
| `useBridgesStore` | Platform bridge state |
| `useConnectionStore` | VPS connection profile management |
| `useConstellationStore` | Constellation builder graph state |
| `useGamificationStore` | XP, streaks, missions, achievements |
| `useLayoutStore` | UI layout state (dock expanded, sidebar, etc.) |
| `useMemoryStore` | Conversation memory and knowledge |
| `useNavigationStore` | Navigation state and routing |
| `useNotificationStore` | Notification queue and read state |
| `useOpenClawStore` | OpenClaw Gateway connection + event state |
| `useProjectStore` | Project management |
| `usePromptChunkStore` | Prompt chunk library |
| `useProviderStore` | AI provider configuration |
| `useSchedulerStore` | Calendar events and scheduling |
| `useSummitTaskStore` | Summit task modal state |
| `useTaskStore` | Task pipeline management |
| `useTelemetryStore` | Telemetry metrics |
| `useThemeStore` | Theme preferences |
| `useWorkflowBuilderStore` | Workflow canvas state (nodes, edges, config) |
| `useWorkflowStore` | Workflow definitions and runs |

### Secondary Stores (`/stores/` — 8 stores)

| Store | Purpose |
|---|---|
| `useChatStore` | Active chat sessions and message streams |
| `useGameStore` | Neuroverse board game state |
| `useGameXPStore` | Game XP tracking |
| `useNeuroverseStore` | Neuroverse game logic |
| `useOpenClawCapabilitiesStore` | OpenClaw agent capability discovery |
| `useOpenClawModelStore` | OpenClaw model selection |
| `usePentagramStore` | Pentagram Protocol visual novel state |
| `useVignetteStore` | Vignette overlay state |

---

## Agent System

### Pre-Configured Agent Roster

NERV.OS ships with **5 pre-configured AI agents**, each with a unique identity:

| Agent | Codename | Role | Color | Specialties |
|---|---|---|---|---|
| **Daisy** | DAISY | Research Analyst | `#a3e635` (Lime) | Research, Writing, Summarization |
| **Ivy** | IVY | Code Architect | `#22d3ee` (Cyan) | Code, Analysis, Debugging |
| **Celia** | CELIA | Creative Director | `#a78bfa` (Violet) | Creative, Strategy, UX |
| **Thalia** | THALIA | Operations Lead | `#fb7185` (Pink) | Planning, Coordination, Logistics |
| **Zero** | ZERO | Core System | `#38bdf8` (Sky Blue) | Core System, Overseer, All |

### Agent Features

- **Custom Avatars** — Upload and crop custom avatar images per agent
- **Hero Image Gallery** — Multiple hero images per agent with gallery management, cropping, and positioning
- **Custom Backgrounds** — Full-screen background images per agent with crop and position controls
- **Vignette Tuning** — Fine-tune the vignette overlay on agent backgrounds
- **Dynamic Colors** — UI adapts color scheme based on the active agent's accent color
- **Identity Plate** — Detailed agent profile card showing name, codename, role, and stats
- **XP & Leveling** — Each agent earns XP through operations, with levels and rank titles
- **Model Selection** — Per-agent AI model assignment with provider switching
- **Status Tracking** — Real-time status indicators (ONLINE, WORKING, THINKING, QUEUED, OFFLINE, IN_SUMMIT, PAUSED)
- **Capability Browser** — Discover and inspect agent capabilities from OpenClaw

---

## Core Features

### 1. Command Center (Dashboard Homepage)

The main dashboard is an immersive **"Command Center"** with:
- **Agent Showcase** — Full-screen agent portrait with layered backgrounds, hero images, and atmospheric effects
- **Agent Carousel** — Navigate between agents with animated transitions
- **Fleet Status Cards** — Live status overview of all agents
- **Hero Metrics** — Key performance stats (fleet power, current streak)
- **XP Progress Ring** — Visual XP bar with animated progress
- **Ops Streak Badge** — Current operations streak display
- **Dashboard Assembly Animation** — Cinematic loading screen after login showing the dashboard being "assembled" piece by piece

### 2. Chat Interface

A sophisticated chat interface supporting:
- **Multi-Agent Chat** — Chat with any individual agent or route messages to the best agent automatically
- **Real-Time Streaming** — Token-by-token response streaming via WebSocket
- **Markdown Rendering** — Full GFM support with syntax-highlighted code blocks
- **Prompt Chunks** — Insert reusable prompt fragments into messages (color-coded pills)
- **Chat History Sidebar** — Browse and resume previous conversations
- **Context Control Drawer** — Configure chat context window, temperature, and system prompts
- **Strategy Mode Switcher** — Toggle between different agent reasoning strategies
- **Thinking/Fast Toggles** — Control agent thinking depth
- **Thinking Panel** — Expandable panel showing agent's reasoning process
- **Output Adaptation Bar** — Control response format and style
- **Session Config Dropdowns** — Configure model, provider, and session settings inline
- **Timeline Scrubber** — Navigate through conversation history with a visual timeline
- **Unified Process Tree** — Hierarchical view of agent operations during a conversation
- **Mission Bar** — Active mission tracking within chat
- **Handoff Packet Modal** — Transfer conversation context between agents
- **Quoted Reply Banner** — Quote and reply to specific messages
- **Next Best Action Chip** — AI-suggested follow-up actions
- **Agent Zero Message Cards** — Specialized message cards for Agent Zero responses
- **Project Panel** — Context-aware project management sidebar within chat

### 3. Multi-Agent Summit

A unique **deliberation system** where multiple agents debate and collaborate:
- **Round-Based Discussion** — Agents take turns contributing to topic analysis
- **Mode Indicators** — Track agent sentiment (AGREE, DISAGREE, PROPOSE)
- **Consensus Scoring** — Automatic consensus/agreement scoring across agents
- **Summit Task Modal** — Create and manage summit-derived action items

### 4. Visual Workflow Builder

A full drag-and-drop **node-based workflow editor** powered by React Flow (XY Flow):
- **Canvas Toolbar** — Layout controls, zoom, and alignment tools
- **Node Palette** — Library of available workflow nodes to drag onto canvas
- **Node Config Panel** — Detailed configuration panel for each node (56KB of config options)
- **Custom Nodes** — Specialized node types for different workflow operations
- **Custom Edges** — Animated connection edges between nodes
- **Execution Log** — Real-time execution log panel during workflow runs
- **Favorites Modal** — Save and manage favorite workflow templates
- **Workflow Templates** — Pre-built workflow starting points
- **Workflow Runs** — Track execution history and results

### 5. Constellation Builder

An **agent graph visualization** system:
- **Force-Directed Layout** — Physics-based graph visualization using D3 Force
- **Custom Nodes** — Visual agent nodes with status indicators
- **Constellation Header** — Controls for the constellation view
- **Interactive Canvas** — Pan, zoom, and drag agent nodes

### 6. Scheduler & Calendar

A full **calendar and scheduling system**:
- **Calendar Timeline** — Date-range visualization with day columns
- **Date Columns** — Per-day event display
- **Create Event Modal** — Rich event creation form with recurrence options
- **Event Detail Panel** — Expanded event view with editing
- **Scheduler Header** — Date range navigation and view controls
- **Task Cards** — Draggable task cards within the calendar
- **Task Card Tray** — Sidebar tray for unscheduled tasks
- **Cron Scheduling** — Cron expression-based recurring task support

### 7. System Console

A **terminal-style system console** with:
- **Log Terminal** — Real-time streaming log viewer
- **Console Filters** — Filter logs by severity, agent, and time range

### 8. Observability & Telemetry

An **analytics and monitoring dashboard**:
- **Observability Charts** — Recharts-powered visualizations of token usage, costs, and latency
- **Telemetry Logs** — Detailed per-call telemetry records
- **System Health Bar** — Live system health indicator

### 9. Agent Capabilities Browser

- **OpenClaw Capabilities** — Discover available agent tools, skills, and capabilities
- **Skill Fetch API** — Query and browse agent skills

### 10. Knowledge & Memory

- **Knowledge Fragments** — Agent knowledge base with tagged, importance-weighted entries
- **Knowledge Documents** — Upload and index documents for agent context
- **Conversation Memory** — Browsable conversation history per agent
- **Context Window Management** — Configure how much conversation history agents retain

### 11. Settings & Configuration

- **Connection Profiles** — Create, switch, and manage multiple VPS connection profiles (OpenClaw + Agent Zero)
- **VPS Connection Settings** — Configure WebSocket URLs, HTTP URLs, auth tokens, and transport modes
- **AI Provider Management** — Add/remove/configure AI providers with API key management
- **Platform Bridges** — Connect external platforms (Discord, Slack, etc.)
- **API Key Management** — Create and manage programmatic API keys

### 12. Notifications & Alerts

- **Notification Center** — Bell icon notification feed
- **Alert Rules** — Configurable alert triggers with severity levels, channels, and cooldowns
- **Toast Notifications** — Sonner-powered inline notifications

### 13. API Reference

- **Auto-generated API docs** — Interactive reference for the dashboard's REST API

### 14. Command Palette

- **⌘K Quick Actions** — `cmdk`-powered command palette for fast navigation and actions
- **Keyboard Shortcuts** — Full keyboard shortcut system (Alt+C, Alt+S, Alt+T, Alt+H, Alt+Shift+E)

### 15. Audit System

- **Audit Logs** — Complete action audit trail
- **Diff Viewer** — Side-by-side diff viewer for tracked changes

---

## UI/UX Design System

### Design Philosophy

The app follows a **"Dark Luxury" / "Mission Control"** aesthetic with:
- **Deep Dark Backgrounds** — Near-black base (`#080706`) with subtle warm undertones
- **Orange Accent System** — Primary accent: `#FF6D29` with `#FFBA08` secondary gold
- **Agent Color Theming** — UI dynamically adapts to each agent's unique color
- **Glassmorphism** — Custom `.nerv-glass-3` classes for frosted-glass panels
- **Ambient Effects** — Radial glows, particle systems, nebula backgrounds
- **Premium Typography** — Outfit (sans-serif) + JetBrains Mono (monospace)
- **Micro-Animations** — Framer Motion throughout for hover, tap, page transitions
- **42KB Global CSS** — Extensive custom CSS with design tokens, animations, and responsive layouts

### Navigation System

The app uses a unique **borderless shell frame** design:
- **SVG Shell Frame** — Viewport-fixed SVG path that traces a border around the entire app with U-shaped notches for the avatar and dock
- **Top Rail** — Horizontal navigation bar with page tabs and agent status indicators
- **Top-Right User Menu** — Avatar + profile dropdown with settings access
- **Bottom Dock** — Animated macOS-style dock with primary actions (Chat, Summit, Tasks, Search, Status, Emergency)
- **Submenu Rail** — Vertical slide-up submenu that blooms from the dock for sub-navigation
- **Radial Blur Overlay** — Gaussian blur effect behind the expanded dock with noise texture

### Component Library

Built on **shadcn/ui (New York style)** with 28 base components:
- Alert Dialog, Avatar, Badge, Button, Card, Checkbox, Collapsible, Dialog
- Direction-Aware Tabs, Dropdown Menu, Input, Popover, Popover Form, Scroll Area
- Select, Separator, Sheet, Sidebar, Skeleton, Slider, Sonner, Sortable List
- Switch, Tabs, Textarea, Toggle, Toggle Group, Tooltip

---

## External Integrations

### 1. OpenClaw Gateway

The primary AI agent backend — an autonomous agent orchestration engine:
- **Protocol:** Native WebSocket with JSON-RPC text frames (NOT Socket.io)
- **Authentication:** Ed25519 challenge-response with device keypair
- **Connection Flow:** WebSocket → `connect.challenge` event → Ed25519 signed response → `hello-ok`
- **Features:** Real-time chat streaming, agent status events, tool call notifications, exec approval requests
- **Tool Parsing:** Dedicated `openclawToolParser.ts` (15KB) for parsing agent tool usage
- **Auto-Reconnect:** Exponential backoff reconnection (configurable delay, default 3s)
- **Singleton Pattern:** Single gateway instance shared across the app

### 2. Agent Zero

An alternative autonomous agent framework:
- **Protocol:** REST API (proxied through `/api/agent-zero/*`) + Socket.io polling fallback
- **Authentication:** API key-based (`X-API-KEY` header)
- **Features:** Message sending, log polling, chat reset/terminate, file access
- **Two-Channel Communication:**
  - Channel 1: REST commands through Next.js API proxy
  - Channel 2: 4Hz polling for live state (WebSocket upgrade planned)
- **Process Tree:** Hierarchical view of Agent Zero's process execution

### 3. MCP (Model Context Protocol) Servers

- **Transport:** SSE (Server-Sent Events)
- **Features:** Tool discovery, tool execution, server management
- **Configuration:** Per-server tool and agent assignment

### 4. AI Model Providers (10 Adapters)

Each provider has a dedicated adapter in `lib/providers/adapters/`:

| Provider | File | Key Features |
|---|---|---|
| OpenAI | `openai.ts` | GPT-4, GPT-4o, o1, embeddings |
| Anthropic | `anthropic.ts` | Claude 3.5, Claude 3 Opus/Sonnet |
| Google | `google.ts` | Gemini Pro, Gemini Ultra |
| Groq | `groq.ts` | Llama, Mixtral (fast inference) |
| Mistral | `mistral.ts` | Mistral Large, Medium |
| xAI | `xai.ts` | Grok models |
| DeepSeek | `deepseek.ts` | DeepSeek Coder, Chat |
| Together | `together.ts` | Open-source model hosting |
| Ollama | `ollama.ts` | Local model inference |
| OpenClaw | `openclaw.ts` | OpenClaw native models |

### 5. Supabase Storage

- **File Uploads:** Agent avatars, hero images, backgrounds, knowledge documents
- **Secure URLs:** Signed URLs for private file access

---

## API Layer

The application exposes **35+ API route handlers** under `/api/`:

| Route Group | Endpoints | Purpose |
|---|---|---|
| `/api/agents/` | CRUD | Agent profile management |
| `/api/agent-zero/` | health, message, logs, reset, terminate, poll, files | Agent Zero proxy |
| `/api/alerts/` | CRUD | Alert rule management |
| `/api/api-keys/` | CRUD | API key management |
| `/api/attachments/` | Upload/Download | File attachment handling |
| `/api/audit/` | Read | Audit log retrieval |
| `/api/bridges/` | CRUD | Platform bridge config |
| `/api/chat/` | Send/Stream | Chat message routing |
| `/api/connection-profiles/` | CRUD | VPS connection profiles |
| `/api/constellation/` | CRUD | Constellation graph data |
| `/api/games/` | CRUD | Game session management |
| `/api/gamification/` | Read/Write | XP, missions, achievements |
| `/api/knowledge-documents/` | CRUD | Knowledge base documents |
| `/api/mcp/` | CRUD | MCP server management |
| `/api/memory/` | Read/Write | Conversation memory |
| `/api/notifications/` | CRUD | Notification management |
| `/api/onboarding/` | Read | Onboarding flow |
| `/api/openclaw-health/` | Health check | OpenClaw status |
| `/api/openclaw-proxy/` | Proxy | OpenClaw HTTP proxy |
| `/api/projects/` | CRUD | Project management |
| `/api/prompt-chunks/` | CRUD | Prompt chunk library |
| `/api/providers/` | CRUD | Provider configuration |
| `/api/scheduler/` | CRUD | Calendar events |
| `/api/settings/` | Read/Write | App settings |
| `/api/skill-fetch/` | Read | Agent skill discovery |
| `/api/storage/` | Upload/Download | File storage |
| `/api/summit/` | CRUD | Summit sessions |
| `/api/synthesize/` | Process | AI synthesis operations |
| `/api/tasks/` | CRUD | Task pipeline |
| `/api/telemetry/` | Read/Write | Telemetry data |
| `/api/v1/` | External API | Public API v1 |
| `/api/webhooks/` | Inbound | Webhook receivers |
| `/api/wipe-db/` | Admin | Database reset (admin only) |
| `/api/workflows/` | CRUD | Workflow management |

---

## Real-Time Communication

### OpenClaw WebSocket Protocol

```
Client                                     OpenClaw Gateway
  │                                              │
  │──── WebSocket Connect ──────────────────────►│
  │◄─── connect.challenge (nonce) ──────────────│
  │──── connect (Ed25519 signed) ──────────────►│
  │◄─── hello-ok (session) ─────────────────────│
  │                                              │
  │──── chat.send (message) ───────────────────►│
  │◄─── agent stream events (token deltas) ─────│
  │◄─── agent status events ─────────────────────│
  │◄─── tool.call events ───────────────────────│
  │◄─── exec.approval events ───────────────────│
  │                                              │
```

### Agent Zero Communication

```
Browser ──► /api/agent-zero/* ──► Agent Zero VPS
              (Next.js Proxy)       (REST API)

Browser ◄── Socket.io polling ◄── Agent Zero
              (4Hz fallback)        (Live State)
```

---

## Gamification System

NERV.OS features a comprehensive **gamification layer** to make AI operations engaging:

### XP Engine

- **XP Events** — Agents earn XP for completing tasks, conversations, summits, and operations
- **XP Rules** — Configurable XP amounts per action type
- **Level System** — Progressive leveling with increasing XP requirements
- **Rank Titles** — Named ranks (e.g., INITIATE → higher tiers) that evolve with level

### Operations Streak

- **Daily Streak** — Track consecutive days of agent operations
- **Streak History** — Historical streak data with calendar visualization
- **Streak Check** — Automatic 2-hour periodic streak verification

### Daily Missions

- **Auto-Generated** — New missions generated daily
- **Mission Types** — Various tasks targeting different agent activities
- **XP Rewards** — Missions award XP upon completion
- **Difficulty Levels** — Normal, hard, and legendary missions

### Achievements

- **Achievement Library** — Predefined achievements with conditions
- **Rarity Tiers** — Common, uncommon, rare, epic, legendary
- **Achievement Toast** — Animated celebration toast when unlocked
- **Achievement Checker** — Automatic condition evaluation engine

---

## Games & Interactive Features

### 1. Neuroverse Board Game

A **strategic board game** where AI agents compete:
- **Board Layout** — Grid-based game board with physics-based rendering
- **Player Panels** — Agent identity panels with stats
- **Event Log** — Real-time game event timeline
- **Agent Commentary** — AI-generated commentary during gameplay
- **Agent Status Bars** — Health/energy tracking per agent
- **Game Controls** — Start, pause, and configure game settings
- **XP Award Modal** — Post-game XP distribution

### 2. Pentagram Protocol (Visual Novel)

A **branching narrative visual novel** engine:
- **Visual Novel Screen** — Full-screen narrative display with character portraits and dialogue (35KB component)
- **Branching Narrative Graph** — Scene graph with choice-driven paths
- **Dev Tools Panel** — Development tools for testing narrative paths, managing game state, and overriding assets (42KB component)
- **Scene Management** — Create, edit, and link narrative scenes
- **Asset Cropping** — Custom image cropping for scene backgrounds

### 3. Tic-Tac-Toe

- **Agent vs Agent** — AI agents play against each other
- **Interactive Board** — Animated game board

---

## Deployment & Infrastructure

### Hosting: Vercel

- **Platform:** Vercel (Edge Network)
- **Framework Detection:** Next.js with Turbopack
- **Build Command:** `next build`
- **Dev Command:** `next dev --turbopack`
- **Output:** Server-side rendered + static pages

### Performance Optimizations

- **Webpack Chunk Splitting** — Heavy libraries split into separate chunks:
  - `xyflow` — React Flow (workflow builder)
  - `recharts` + D3 — Charting libraries
  - `forcegraph` — Force graph visualization
  - `tsparticles` — Particle effects
  - `highlightjs` — Code highlighting
  - `markdown` — React Markdown + plugins
- **Dynamic Imports** — Heavy components loaded with `next/dynamic` (SSR disabled for client-only components)
- **Asset Prefetching** — Agent backgrounds, heroes, and avatars prefetched on dashboard load
- **Server Actions** — 50MB body size limit for large file uploads

### Build Configuration

- **React Strict Mode:** Disabled (to prevent double-mounting of WebSocket connections)
- **Turbopack:** Enabled for development
- **Server External Packages:** Configured for Node.js-only modules

---

## Environment Configuration

### Required Environment Variables

| Variable | Type | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Supabase admin key (server-only) |
| `DATABASE_URL` | Secret | PostgreSQL connection string |

### Optional Environment Variables

| Variable | Type | Purpose |
|---|---|---|
| `NEXT_PUBLIC_OPENCLAW_WS_URL` | Public | OpenClaw WebSocket URL |
| `NEXT_PUBLIC_OPENCLAW_HTTP_URL` | Public | OpenClaw HTTP URL |
| `NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN` | Public | OpenClaw auth token |
| `OPENCLAW_AUTH_TOKEN` | Secret | OpenClaw server-side token |
| `NEXT_PUBLIC_AGENT_ZERO_BASE_URL` | Public | Agent Zero base URL |
| `NEXT_PUBLIC_AGENT_ZERO_URL` | Public | Agent Zero URL (alias) |
| `NEXT_PUBLIC_AGENT_ZERO_WS_ENABLED` | Public | Enable Agent Zero WebSocket |
| `AGENT_ZERO_API_KEY` | Secret | Agent Zero API key |
| `AGENT_ZERO_URL` | Secret | Agent Zero server-side URL |
| `AGENT_ZERO_USERNAME` | Secret | Agent Zero login username |
| `AGENT_ZERO_PASSWORD` | Secret | Agent Zero login password |

---

## Summary

NERV.OS is a **large-scale, full-stack AI agent orchestration dashboard** built with modern web technologies. At its core, it provides a premium, visually immersive interface for managing a fleet of specialized AI agents through real-time chat, visual workflow building, and comprehensive monitoring. 

The application is notable for its:

- **Scale** — 30+ database tables, 32 Zustand stores, 35+ API routes, 100+ React components
- **Design Quality** — Premium dark-luxury aesthetic with extensive animations and dynamic theming
- **Integration Depth** — 10 AI provider adapters, 2 agent backends (OpenClaw + Agent Zero), MCP protocol support
- **Feature Breadth** — Chat, workflows, scheduling, gamification, games, constellation builder, knowledge base, and more
- **Security** — Ed25519 device auth, encrypted API keys, Supabase auth with middleware-enforced sessions

The project follows a phased development approach, with the current state representing a mature but evolving platform with some features marked as "Coming in Phase 4."
