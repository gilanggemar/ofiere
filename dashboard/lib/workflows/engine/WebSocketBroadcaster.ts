// ─── WebSocket Broadcaster ───────────────────────────────────────────────────
// Streams execution status to the frontend in real-time.
// Falls back to console.log if no gateway is available.

export class WebSocketBroadcaster {
  private connectionId: string;
  private runId: string;
  public onEvent?: (event: string, payload: Record<string, unknown>) => void;

  constructor(config: { connectionId: string; runId: string; onEvent?: (event: string, payload: Record<string, unknown>) => void }) {
    this.connectionId = config.connectionId;
    this.runId = config.runId;
    this.onEvent = config.onEvent;
  }

  send(event: string, payload: Record<string, unknown>): void {
    const message = {
      type: 'workflow_execution',
      event,
      runId: this.runId,
      connectionId: this.connectionId,
      timestamp: Date.now(),
      ...payload,
    };

    if (this.onEvent) {
        this.onEvent(event, message);
    }
    
    try {
      console.log(`[WF Engine] ${event}:`, JSON.stringify(message));
    } catch (err) {
      console.error('[WebSocketBroadcaster] Failed to send:', err);
    }
  }

  sendNodeLog(nodeId: string, level: string, message: string): void {
    this.send('node:log', { nodeId, level, message });
  }

  sendPhaseProgress(nodeId: string, iteration: number, maxIterations: number, summary: string): void {
    this.send('node:progress', { nodeId, iteration, maxIterations, summary });
  }

  sendGateRequest(nodeId: string, reviewData: Record<string, unknown>): void {
    this.send('gate:approval_requested', { nodeId, reviewData });
  }
}
