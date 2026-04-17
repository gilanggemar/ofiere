// ============================================================
// Ofiere Workflow V2 — Agent Zero Workflow Adapter
// Uses HTTP POST/poll pattern. Does NOT modify useAgentZeroStore.
// ============================================================

import type {
  WorkflowAgentAdapter,
  WorkflowInvokeInput,
  WorkflowInvokeResult,
  AgentCapabilities,
  WorkflowStepEvent,
} from "../types";

export class AgentZeroWorkflowAdapter implements WorkflowAgentAdapter {
  private baseUrl: string;
  private apiKey?: string;
  private csrfToken?: string;

  constructor(connectionConfig: { baseUrl: string; apiKey?: string; csrfToken?: string }) {
    this.baseUrl = connectionConfig.baseUrl.replace(/\/+$/, "");
    this.apiKey = connectionConfig.apiKey;
    this.csrfToken = connectionConfig.csrfToken;
  }

  async getCapabilities(): Promise<AgentCapabilities> {
    return {
      invoke: true,
      stream: false,
      structuredOutput: false,
      cancel: true,
      pauseResume: true,
      humanCheckpoint: false,
      toolCallEvents: false,
    };
  }

  async invoke(input: WorkflowInvokeInput): Promise<WorkflowInvokeResult> {
    const startTime = Date.now();
    const events: WorkflowStepEvent[] = [];

    try {
      // Send the message to Agent Zero
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["X-API-KEY"] = this.apiKey;
      }
      if (this.csrfToken) {
        headers["X-CSRF-Token"] = this.csrfToken;
      }

      const sendRes = await fetch(`${this.baseUrl}/api_message`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: input.task,
          context_id: undefined, // pass input.runId if we wanted context isolation
        }),
      });

      if (!sendRes.ok) {
        return {
          status: "failed",
          error: `Agent Zero returned HTTP ${sendRes.status}: ${await sendRes.text()}`,
          events,
          usage: { durationMs: Date.now() - startTime },
        };
      }

      const sendData = await sendRes.json();
      const contextId = sendData.context_id;

      // If we got a direct response, return it immediately
      if (sendData.response) {
        let outputJson: any = undefined;
        if (input.responseMode === "json") {
          try {
            outputJson = JSON.parse(sendData.response);
          } catch {
            outputJson = null;
          }
        }
        return {
          status: "completed",
          outputText: sendData.response,
          outputJson,
          events,
          usage: { durationMs: Date.now() - startTime },
        };
      }

      // Poll for completion
      const pollInterval = 2000; // 2 seconds
      const maxPollTime = (input.timeoutSec || 120) * 1000;
      const pollStart = Date.now();

      while (Date.now() - pollStart < maxPollTime) {
        await new Promise((r) => setTimeout(r, pollInterval));

        try {
          const pollRes = await fetch(
            `${this.baseUrl}/poll?context_id=${contextId}`,
            { headers }
          );

          if (!pollRes.ok) continue;

          const pollData = await pollRes.json();

          // Check if the agent has completed
          if (pollData.response || pollData.status === "completed" || pollData.done) {
            const responseText = pollData.response || pollData.text || pollData.output || "";
            let outputJson: any = undefined;
            if (input.responseMode === "json" && responseText) {
              try {
                outputJson = JSON.parse(responseText);
              } catch {
                outputJson = null;
              }
            }
            return {
              status: "completed",
              outputText: responseText,
              outputJson,
              events,
              usage: { durationMs: Date.now() - startTime },
            };
          }

          // Check for errors
          if (pollData.error || pollData.status === "error") {
            return {
              status: "failed",
              error: pollData.error || "Agent Zero reported an error",
              events,
              usage: { durationMs: Date.now() - startTime },
            };
          }

          // Log polling events
          if (pollData.log?.items) {
            for (const item of pollData.log.items) {
              events.push({
                type: "log",
                timestamp: new Date().toISOString(),
                data: item,
              });
            }
          }
        } catch {
          // Polling failure — continue trying
        }
      }

      // Timeout
      return {
        status: "timeout",
        error: `Agent did not respond within ${input.timeoutSec || 120}s`,
        events,
        usage: { durationMs: Date.now() - startTime },
      };
    } catch (e: any) {
      return {
        status: "failed",
        error: e.message || "Failed to invoke Agent Zero",
        events,
        usage: { durationMs: Date.now() - startTime },
      };
    }
  }

  async cancel(runId: string, stepId: string): Promise<void> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.apiKey) {
        headers["X-API-KEY"] = this.apiKey;
      }
      if (this.csrfToken) {
        headers["X-CSRF-Token"] = this.csrfToken;
      }

      await fetch(`${this.baseUrl}/terminate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ run_id: runId, step_id: stepId }),
      });
    } catch (e) {
      console.error("[AgentZeroAdapter] Failed to cancel:", e);
    }
  }
}
