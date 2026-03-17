// ─── Convergence Executor ────────────────────────────────────────────────────
// Merges results from parallel branches.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { ConvergenceData } from '@/types/workflow-nodes';

export class ConvergenceExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as ConvergenceData;
    const { broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      const allOutputs = context.getAllNodeOutputs();
      let merged: unknown;

      switch (data.mergeFunction) {
        case 'concatenate': {
          merged = Object.values(allOutputs);
          break;
        }

        case 'agent_synthesize': {
          // For now, concatenate. When agent synthesis is wired,
          // this will send all branch outputs to an agent for summarization.
          merged = {
            branches: allOutputs,
            synthesized: data.synthesisInstructions
              ? `Synthesis pending: ${data.synthesisInstructions}`
              : Object.values(allOutputs),
          };
          break;
        }

        case 'custom':
        default:
          merged = allOutputs;
      }

      context.addLog('info',
        `Convergence merged ${Object.keys(allOutputs).length} branch outputs via ${data.mergeFunction}`,
        node.id
      );

      return { status: 'success', output: merged };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Convergence failed' };
    }
  }
}
