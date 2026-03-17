// ─── Loop Executor ───────────────────────────────────────────────────────────
// Retry-on-failure, iterate-until, and for-each patterns.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { LoopData } from '@/types/workflow-nodes';

export class LoopExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as LoopData;
    const { broadcaster, signal } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      switch (data.loopType) {
        case 'retry_on_failure':
          return { status: 'success', output: { type: 'retry', maxIterations: data.maxIterations } };

        case 'iterate_until': {
          let iteration = 0;
          while (iteration < data.maxIterations) {
            if (signal.aborted) throw new Error('Loop aborted');
            iteration++;

            if (data.exitCondition && context.evaluateCondition(data.exitCondition)) {
              context.addLog('info', `Loop exited at iteration ${iteration}: condition met`, node.id);
              return { status: 'success', output: { iterations: iteration, exitReason: 'condition_met' } };
            }

            context.set(`loop_${node.id}_iteration`, iteration);

            if (data.delayBetweenMs) {
              await new Promise(r => setTimeout(r, data.delayBetweenMs));
            }
          }

          context.addLog('warn', `Loop hit max iterations: ${data.maxIterations}`, node.id);

          if (data.onMaxReached === 'abort') {
            return { status: 'error', error: `Loop exceeded max iterations (${data.maxIterations})` };
          }

          return { status: 'success', output: { iterations: iteration, exitReason: 'max_reached' } };
        }

        case 'for_each': {
          const collection = context.get(data.iterateOver ?? '') as unknown[];
          if (!Array.isArray(collection)) {
            return { status: 'error', error: `for_each target "${data.iterateOver}" is not an array` };
          }

          const results: unknown[] = [];
          for (let i = 0; i < Math.min(collection.length, data.maxIterations); i++) {
            if (signal.aborted) throw new Error('Loop aborted');
            context.set(`loop_${node.id}_item`, collection[i]);
            context.set(`loop_${node.id}_index`, i);
            results.push(collection[i]);
          }

          return { status: 'success', output: { items: results, count: results.length } };
        }

        default:
          return { status: 'error', error: `Unknown loop type: ${data.loopType}` };
      }
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Loop failed' };
    }
  }
}
