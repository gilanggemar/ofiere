# Ofiere User Guide

Welcome to the Ofiere Multi-Agent System Control Dashboard. 

This environment connects directly to your OpenClaw Gateway instance, providing real-time oversight, deliberation management, and manual overrides for your autonomous agents.

## Navigation

*   **🏢 Overview**: Your macro view. Displays high-level health telemetry and the connection status to the OpenClaw websocket.
*   **💬 Chat Interface**: Isolated chat environments for 1-on-1 interaction with specific models (Ivy, Daisy, Celia, Thalia). Includes tool execution tracking.
*   **🌐 The Summit**: A synchronized multi-agent deliberation room. Agents can converse and debate topics. You can set the participant list in the top header menu (`Setup Summit`).
*   **📋 Task Manager (Operations Pipeline)**: A queue of operational directives. Here you can execute tasks and watch an agent's real-time thought process directly in the Execution Monitor panel on the right.
*   **⚙️ Settings**: Toggles for global UX preferences (Audio Feedback, High Contrast) and controls for dispatching new system configurations or triggering an emergency system-wide halt.

## Standard Operating Procedures (SOP)

### How to Monitor Task Execution
1. Navigate to the **Task Manager**.
2. Locate a `PENDING` task in the table.
3. Click the **Execute** button (the play symbol next to the task).
4. A panel will automatically slide out on the right side of the screen.
5. Watch the agent evaluate the task, invoke underlying tools (highlighted in orange), and ultimately resolve the task logic.
6. The task will shift to `DONE` automatically once the agent submits its final response.

### How to Run a Deliberation (The Summit)
1. Navigate to **The Summit**.
2. Assuming you have not initialized it, click the initial setup button or the **⚙️ Setup** gear in the top right.
3. Type out your main directive or topic of discussion in the Topic input box.
4. Select which agents should participate.
5. Click **Initialize Summit**. The interface will handle rotating the speaking floor between the agents.
6. You can interject into the conversation manually using the bottom command terminal.

### Identifying Tools in the UI
Whenever an agent utilizes an internal MCP system tool (like searching a document or checking the weather) through the OpenClaw back-end, Ofiere will capture this and display an **Amber/Orange Tool Card**. It will say `[IN_PROGRESS]` while awaiting a response, and resolve to `[COMPLETED]` with a JSON dump of the output when successfully executed.

## Troubleshooting

- **No Connection / Red Status Indicator**: Ensure the OpenClaw Gateway is actively running on `localhost:18789`.
- **Agents are Silent**: Ensure the `openclaw.json` configuration is loaded correctly in the gateway backend.
- **Summit Hung**: If deliberation hangs, use the command bar terminal at the bottom of the Summit to "bump" the conversation by issuing a directive like `[System: Please continue your analysis]`, or halt it entirely via Settings.
