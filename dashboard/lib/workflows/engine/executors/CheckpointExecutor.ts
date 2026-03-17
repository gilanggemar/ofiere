// ─── Checkpoint Executor ─────────────────────────────────────────────────────
// Persists mission state to Supabase for resumability.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { CheckpointData } from '@/types/workflow-nodes';

export class CheckpointExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as CheckpointData;
    const { broadcaster, userId } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      await context.saveCheckpoint(data.checkpointName, data.captureKeys ?? [], userId);

      context.addLog('info', `Checkpoint "${data.checkpointName}" saved`, node.id);

      return {
        status: 'success',
        output: {
          checkpointName: data.checkpointName,
          capturedKeys: data.captureKeys,
          savedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Checkpoint failed' };
    }
  }
}
