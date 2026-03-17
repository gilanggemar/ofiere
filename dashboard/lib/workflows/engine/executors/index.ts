// ─── Node Executor Interface & Registry ──────────────────────────────────────

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { WebSocketBroadcaster } from '../WebSocketBroadcaster';
import type { SupabaseClient } from '@supabase/supabase-js';

// ─── Common Interface ───
export interface NodeExecutionResult {
  status: 'success' | 'error' | 'skipped';
  output?: unknown;
  error?: string;
}

export interface NodeExecutor {
  execute(node: Node, context: MissionContext): Promise<NodeExecutionResult>;
}

export interface ExecutorDeps {
  context: MissionContext;
  broadcaster: WebSocketBroadcaster;
  supabase: SupabaseClient;
  userId: string;
  signal: AbortSignal;
}

// ─── Executor Implementations ───
import { MissionTriggerExecutor } from './MissionTriggerExecutor';
import { MissionObjectiveExecutor } from './MissionObjectiveExecutor';
import { PhaseExecutor } from './PhaseExecutor';
import { DelegationExecutor } from './DelegationExecutor';
import { ToolkitExecutor } from './ToolkitExecutor';
import { KnowledgeExecutor } from './KnowledgeExecutor';
import { GateExecutor } from './GateExecutor';
import { CheckpointExecutor } from './CheckpointExecutor';
import { LoopExecutor } from './LoopExecutor';
import { ConvergenceExecutor } from './ConvergenceExecutor';
// Legacy node executors
import {
  LegacyTriggerExecutor,
  LegacyAgentExecutor,
  LegacyOutputExecutor,
  LegacyPromptExecutor,
  LegacyDelayExecutor,
  LegacyConditionExecutor,
  LegacyTransformExecutor,
} from './LegacyExecutors';

// ─── Registry ───
export class NodeExecutorRegistry {
  private executors: Map<string, NodeExecutor>;

  constructor(deps: ExecutorDeps) {
    this.executors = new Map<string, NodeExecutor>([
      // Mission nodes
      ['missionTrigger',   new MissionTriggerExecutor(deps) as NodeExecutor],
      ['missionObjective', new MissionObjectiveExecutor(deps) as NodeExecutor],
      ['phase',            new PhaseExecutor(deps) as NodeExecutor],
      ['delegation',       new DelegationExecutor(deps) as NodeExecutor],
      ['toolkit',          new ToolkitExecutor(deps) as NodeExecutor],
      ['knowledge',        new KnowledgeExecutor(deps) as NodeExecutor],
      ['gate',             new GateExecutor(deps) as NodeExecutor],
      ['checkpoint',       new CheckpointExecutor(deps) as NodeExecutor],
      ['loop',             new LoopExecutor(deps) as NodeExecutor],
      ['convergence',      new ConvergenceExecutor(deps) as NodeExecutor],
      // Legacy nodes (so existing Trigger→Agent→Output workflows work)
      ['trigger',          new LegacyTriggerExecutor(deps) as NodeExecutor],
      ['agent',            new LegacyAgentExecutor(deps) as NodeExecutor],
      ['output',           new LegacyOutputExecutor(deps) as NodeExecutor],
      ['prompt',           new LegacyPromptExecutor(deps) as NodeExecutor],
      ['condition',        new LegacyConditionExecutor(deps) as NodeExecutor],
      ['transform',        new LegacyTransformExecutor(deps) as NodeExecutor],
      ['delay',            new LegacyDelayExecutor(deps) as NodeExecutor],
    ]);
  }

  getExecutor(nodeType: string): NodeExecutor | undefined {
    return this.executors.get(nodeType);
  }
}

