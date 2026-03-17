# NERV.OS Chat Features - Deep Analysis & Technical Overview

This document provides a detailed technical analysis of the Chat domain within the NERV.OS application. The chat feature acts as the primary interface for users to interact with various AI agents (e.g., OpenClaw, Agent Zero) and features an advanced architecture bridging rich user interfaces with multiple disparate agent backends.

## 1. Core Architecture & Routing

The chat system is designed to be **provider-agnostic** on the surface while maintaining highly specialized connections in the background.

- **`useChatRouter.ts`**: This acts as the central traffic controller. It merges agents from different providers (OpenClaw via WebSockets, Agent Zero via REST/Polling, and external agents) into a unified `IntegratedAgent` interface.
  - Exposes `dispatchMessage(agentId, message, sessionKey)`, which abstracts routing the message either to `useSocket` (for OpenClaw) or `useAgentZeroStore` (for Agent Zero).
  - Supplies the filtered `getMessagesForAgent()` to display the active timeline.

## 2. Frontend Layout & UI Components (`app/chat/page.tsx`)

The main Chat page utilizes a dynamic, multi-panel layout optimizing for both casual chat and technical supervision:

### A. The Conversation Interface
- Relies on an auto-scrolling container containing user and assistant bubbles.
- Integrates specialized renderers for deep markdown and structural data.
- Employs a sticky footer input powered by `ChatInputWithChunks`, enabling users to insert advanced snippets.

### B. Message Renderers
- **`MessageRenderer.tsx`**: A robust `react-markdown` implementation utilizing `remark-gfm`, `rehype-highlight`, and custom components to render highly styled code blocks (with copy functionality), tables, and typography.
- **`AgentZeroMessageCard.tsx`**: Specifically designed for Agent Zero, it attempts to parse Agent Zero's structured JSON outputs. Elements such as `headline`, `tool_name`, `thoughts` (step-by-step logic), and `tool_args` (rendered in a mini code block) are mapped into visually distinct, specialized UI cards.
- **`ThinkingPanel.tsx`**: Handles rendering streaming `<thinking>` tags (often utilized by Claude 3.5 Sonnet) into an expandable, pulsing "Thought Process" drop-down.

### C. The Unified Process Tree (`UnifiedProcessTree.tsx`)
A critical component for technical visibility. It visually translates the agent's internal workings into an expandable tree view on the right-hand panel.
- Parses real-time tool calls (`tool_call`, `tool_response`, `task.progress`) and reasoning (`thoughts`) occurring in the background.
- Employs dual logic routes depending on the provider: 
  - For **Agent Zero**: Builds the tree straight from polled background logs (`useAgentZeroStore.logs`).
  - For **OpenClaw**: Reconstructs the tree dynamically via live WebSocket metadata (`useOpenClawStore.activeRuns`) and Historical fallbacks (parsing inline brace-format strings like `call:Exec{...}` from older messages).

### D. Chat History Sidebar (`ChatHistorySidebar.tsx`)
Provides historical chat navigation. It interfaces with `/api/memory/conversations` via standard REST calls to load previous threads, create new threads, or delete historical context on a per-agent basis.

## 3. Advanced Inputs: Prompt Chunks

- **`ChatInputWithChunks.tsx`**: This replaces the standard HTML `<textarea>` with a deeply customized `contentEditable` `div`.
- Facilitates the "Prompt Chunk" system (usable chunks of pre-written prompt logic).
- Handles advanced DOM manipulations:
  - Drag-and-drop of `data-id` tokens (Chunks) directly into the text stream.
  - Transforms raw text strings containing `⟦ChunkName⟧` syntax into rich, interactive, and draggable pill badges using `react-dom/client` `createRoot`.
  - Cleans the DOM back out to clean raw text containing `⟦ChunkName⟧` when extracting the value for submission.

## 4. State Management & Data Stores

### OpenClaw Store (`useSocket.ts` / `useOpenClawStore.ts`)
- Utilizes Zustand to track the highly complex WebSocket events emitted by the NERV.OS OpenClaw Gateway.
- Bridges the low-level events (`health`, `chat`, `agent` lifecycle streams) into accessible arrays of `ChatMessage`.
- Subscribes to telemetry actions, meticulously logging metrics (e.g., token usage estimates, latency ms, agent status) at the completion of streams.

### Agent Zero Store (`useAgentZeroStore.ts`)
- Manages the REST-based state for Agent Zero integration.
- Relies on a polling strategy (`startLogPolling`) to continually fetch intermediate execution logs from the backend while a long-running message resolves.
- Bridges the disconnect between traditional Server-Sent Events (SSE) and Agent Zero's unique architecture (which outputs the final message strictly when done, requiring a side-channel log poll to see live status).

## 5. Backend Integrations

### `/api/agent-zero/message/route.ts`
- Functions as a secure Next.js Edge proxy to forward user messages to the actual Agent Zero VPS instance located at `AGENT_ZERO_BASE_URL`.
- Enforces a 300-second (5 min) timeout `AbortController` due to the unpredictable latency of complex Agent Zero chains solving code problems.
- Intercepts telemetry automatically on response (tracking `inputTokens` and `outputTokens` parsed from the Agent Zero payload).

### `/api/memory/conversations/route.ts`
- Interacts with Supabase (`db.from('conversations')`) validating the `getAuthUserId()`.
- Standard CRUD logic to fetch conversations sorted by recent activity or spawn new blank records holding agent pointers.

---
**Summary**: The chat architecture seamlessly blends a standard UI chatting experience with deep technical monitoring (Unified Tree/Thinking panel). It treats differing AI backend protocols (Sockets vs REST polling) as equal citizens utilizing Zustand abstractions, and offers power-user mechanics utilizing the custom prompt chunk text-editor.
