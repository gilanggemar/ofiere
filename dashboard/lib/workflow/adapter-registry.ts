// ============================================================
// Ofiere Workflow V2 — Adapter Registry
// Factory function to get the correct adapter for an agent.
// ============================================================

import type { WorkflowAgentAdapter } from "./types";
import { OpenClawWorkflowAdapter } from "./adapters/openclaw-adapter";
import { AgentZeroWorkflowAdapter } from "./adapters/agentzero-adapter";

/**
 * Returns the correct WorkflowAgentAdapter based on the connection type.
 * 
 * @param agentId - The agent identifier
 * @param connectionType - Either "openclaw" or "agentzero"
 * @param connectionConfig - Connection-specific configuration
 */
export function getAdapterForAgent(
  agentId: string,
  connectionType: "openclaw" | "agentzero",
  connectionConfig: any
): WorkflowAgentAdapter {
  switch (connectionType) {
    case "openclaw":
      return new OpenClawWorkflowAdapter(connectionConfig);
    case "agentzero":
      return new AgentZeroWorkflowAdapter(connectionConfig);
    default:
      throw new Error(`Unsupported connection type: ${connectionType}`);
  }
}
