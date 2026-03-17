// ─── Mission Objective Executor ──────────────────────────────────────────────
// Stores objective, success criteria, constraints into context.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { MissionObjectiveData } from '@/types/workflow-nodes';

export class MissionObjectiveExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as MissionObjectiveData;
    const { broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    // Store mission parameters in context
    context.set('missionObjective', data.objective);
    context.set('successCriteria', data.successCriteria);
    context.set('constraints', data.constraints);
    context.set('missionPriority', data.priority);

    // Set token budget based on constraints
    if (data.maxDurationMinutes) {
      context.set('maxDurationMinutes', data.maxDurationMinutes);
    }

    // Look for a token budget in constraints
    for (const constraint of (data.constraints || [])) {
      const match = constraint.match(/budget:\s*(\d+)k?\s*tokens/i);
      if (match) {
        const limit = parseInt(match[1]) * (constraint.toLowerCase().includes('k') ? 1000 : 1);
        context.setTokenLimit(limit);
      }
    }

    context.addLog('info', `Mission objective set: "${data.objective}" (${data.priority} priority)`, node.id);

    return {
      status: 'success',
      output: {
        objective: data.objective,
        successCriteria: data.successCriteria,
        constraints: data.constraints,
        priority: data.priority,
      },
    };
  }
}
