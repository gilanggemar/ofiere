# Ofiere Maintenance Log

## Project Architecture Overview

Ofiere is a Next.js (React) front-end web dashboard that acts as the Command and Control center for the **OpenClaw** gateway. It connects to the OpenClaw backend exclusively via WebSockets to stream agent interactions, tool calls, and health telemetry.

### Core Stack
*   **Next.js 15+** (App Router)
*   **React 19**
*   **TailwindCSS** for styling, adhering to a "Neuromancer" green-and-black aesthetic.
*   **Lucide-React** for iconography.
*   **Zustand** for global client-side state management (`useSocketStore`, `useTaskStore`).

### Essential Files
1.  **`lib/useSocket.ts`**: The beating heart of the application. It establishes and maintains the WebSocket connection to `ws://127.0.0.1:18789`. It handles all parsing of chat deltas, nested tool definitions (`<call:...>`), Summit routing, and session caching.
2.  **`lib/useTaskStore.ts`**: Manages the Operations Pipeline tasks array. Is hooked into `useSocket` to automatically shift tasks from `IN_PROGRESS` to `DONE` when an agent finishes its chat stream.
3.  **`app/chat/page.tsx`**: Single-agent interface. Listens to specific `agentId` messages.
4.  **`app/summit/page.tsx`**: Multi-agent deliberation dashboard. Manages sequential turns between participating agents.
5.  **`app/tasks/page.tsx`**: Features the Execution Monitor, parsing real-time logs from assigned agents executing predefined tasks.
6.  **`app/settings/page.tsx`**: Handles Agent configuration dispatch events and Dashboard aesthetic preferences.

## Known Issues & Workarounds

*   **WebSocket Payload Changes**: The OpenClaw websocket payload structures (especially `tool_call` arrays vs inline XML elements) can be volatile. Currently, the dashboard parses a dual-standard, supporting both the newer `.state === 'tool_call'` blocks AND legacy XML trailing tags inside text content chunks. If tool display starts breaking, start debugging the `renderMessageContent` function located in Chat, Summit, and Tasks pages.
*   **Agent Identity Sync**: Ofiere expects certain agent identities defined in `openclaw.json` (e.g., `ivy-slack`, `daisy-slack`). The `useSocket` discovers active sessions dynamically, but if the gateway drops these sessions, messages will default to routing into a "system" scope until the initial chat handshake restores the `sessionKey`.

## Recent Modifications (Phase 4 & 5)
*   **Execution Monitor Integration**: We enhanced the Operations Pipeline to natively slide out a "Live Monitor", bridging `useTaskStore` execution triggers (`sendChatMessage`) directly into `useSocket` responses without leaving the page.
*   **Auto-Completion**: Introduced listener hooks in `useSocket.ts` checking for `state: 'done'` to proactively auto-resolve running tasks back in `useTaskStore`.
*   **TypeScript Stabilization**: Stripped all implicit arrays and optional object assertions to ensure a strict compilation threshold (no explicit `any` types emitted without annotation).

## OpenClaw Configuration File
The `openclaw.json` config defines the LLM roles. Ensure any added models in that JSON are mirrored in the Dashboard's mock definitions or fetched directly via `agent.list` (if the RCP endpoint is unblocked).
