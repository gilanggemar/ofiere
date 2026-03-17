// ─── Mission Trigger Executor ────────────────────────────────────────────────
// Validates trigger input against schema and seeds the context.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { MissionTriggerData } from '@/types/workflow-nodes';

export class MissionTriggerExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as MissionTriggerData;
    const { broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      // Validate trigger input against schema if defined
      const triggerInput = context.getAll();

      if (data.inputSchema) {
        for (const [key, expectedType] of Object.entries(data.inputSchema)) {
          const value = triggerInput[key];
          if (value === undefined) {
            context.addLog('warn', `Expected input "${key}" (${expectedType}) not provided`, node.id);
          }
        }
      }

      // Store trigger metadata in context
      context.set('triggerType', data.triggerType);
      context.set('triggerNodeId', node.id);
      context.set('triggerTimestamp', Date.now());

      context.addLog('info', `Mission triggered via ${data.triggerType}`, node.id);

      return {
        status: 'success',
        output: {
          triggerType: data.triggerType,
          input: triggerInput,
          startedAt: new Date().toISOString(),
        },
      };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Trigger failed' };
    }
  }
}
