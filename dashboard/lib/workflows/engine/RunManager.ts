// ─── Run Manager ─────────────────────────────────────────────────────────────
// Top-level orchestrator for a workflow run. One instance per execution.

import { db } from '@/lib/db';
import { GraphWalker } from './GraphWalker';
import { MissionContext } from './MissionContext';
import { WebSocketBroadcaster } from './WebSocketBroadcaster';
import { NodeExecutorRegistry } from './executors';
import type { WorkflowDefinition, RunState } from '@/types/workflow-nodes';

export class RunManager {
  private runId: string;
  private workflowId: string;
  private userId: string;
  private walker: GraphWalker;
  private context: MissionContext;
  private broadcaster: WebSocketBroadcaster;
  private executors: NodeExecutorRegistry;
  private abortController: AbortController;

  constructor(config: {
    runId: string;
    workflowId: string;
    userId: string;
    workflow: WorkflowDefinition;
    triggerInput?: Record<string, unknown>;
    wsConnectionId: string;
    onEvent?: (event: string, payload: Record<string, unknown>) => void;
  }) {
    this.runId = config.runId;
    this.workflowId = config.workflowId;
    this.userId = config.userId;
    this.abortController = new AbortController();

    // WebSocket broadcaster for real-time UI updates
    this.broadcaster = new WebSocketBroadcaster({
      connectionId: config.wsConnectionId,
      runId: this.runId,
      onEvent: config.onEvent,
    });

    // Mission context = working memory
    this.context = new MissionContext({
      runId: this.runId,
      triggerInput: config.triggerInput ?? {},
      supabase: db,
      broadcaster: this.broadcaster,
    });

    // Executor registry
    this.executors = new NodeExecutorRegistry({
      context: this.context,
      broadcaster: this.broadcaster,
      supabase: db,
      userId: this.userId,
      signal: this.abortController.signal,
    });

    // Graph walker
    this.walker = new GraphWalker({
      nodes: config.workflow.nodes,
      edges: config.workflow.edges,
      executors: this.executors,
      context: this.context,
      broadcaster: this.broadcaster,
      signal: this.abortController.signal,
    });
  }

  async execute(): Promise<RunState> {
    try {
      // Persist run start
      await db.from('workflow_runs').insert({
        id: this.runId,
        workflow_id: this.workflowId,
        user_id: this.userId,
        status: 'running',
        started_at: new Date().toISOString(),
        context_snapshot: this.context.serialize(),
      });

      this.broadcaster.send('run:started', { runId: this.runId });

      // Walk the graph
      const result = await this.walker.run();

      // Persist run completion
      const finalStatus = result.success ? 'completed' : 'failed';
      await db.from('workflow_runs').update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        result: result.output,
        context_snapshot: this.context.serialize(),
      }).eq('id', this.runId);

      this.broadcaster.send('run:completed', {
        runId: this.runId,
        status: finalStatus,
        output: result.output,
      });

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown engine error';

      require('fs').appendFileSync('run_errors.log', `[${new Date().toISOString()}] Run ${this.runId} RunManager.execute catch: ${errorMsg}\n${error instanceof Error ? error.stack : ''}\n`);

      await db.from('workflow_runs').update({
        status: 'error',
        completed_at: new Date().toISOString(),
        error: errorMsg,
      }).eq('id', this.runId);

      this.broadcaster.send('run:error', {
        runId: this.runId,
        error: errorMsg,
      });

      return { success: false, output: null, error: errorMsg };
    }
  }

  abort() {
    this.abortController.abort();
    this.broadcaster.send('run:aborted', { runId: this.runId });
  }
}
