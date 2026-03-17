// ─── Workflow Mission Node Type Definitions ──────────────────────────────────
// These define the structured `data` each React Flow node carries.

import type { Node, Edge } from '@xyflow/react';

// ─── Mission Trigger ─────────────────────────────────────────────────────────
export interface MissionTriggerData {
  triggerType: 'manual' | 'schedule' | 'webhook' | 'event' | 'agent_request';
  schedule?: string;
  webhookPath?: string;
  eventName?: string;
  inputSchema?: Record<string, 'string' | 'number' | 'boolean' | 'json'>;
  [key: string]: unknown;
}

// ─── Mission Objective ───────────────────────────────────────────────────────
export interface MissionObjectiveData {
  objective: string;
  successCriteria: string[];
  constraints: string[];
  maxDurationMinutes?: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
  [key: string]: unknown;
}

// ─── Phase ───────────────────────────────────────────────────────────────────
export interface PhaseData {
  name: string;
  instructions: string;
  agentId?: string;
  model?: string;
  autonomyLevel: 'strict' | 'guided' | 'autonomous';
  maxIterations?: number;
  requiredOutputs?: string[];
  contextWindowPolicy: 'full' | 'summary' | 'relevant_only';
  [key: string]: unknown;
}

// ─── Delegation ──────────────────────────────────────────────────────────────
export interface DelegationData {
  targetAgentId: string;
  delegationType: 'full' | 'subtask' | 'consultation';
  briefing: string;
  contextPassthrough: string[];
  expectedOutput: string;
  timeout?: number;
  fallbackBehavior: 'retry' | 'escalate' | 'skip' | 'abort';
  [key: string]: unknown;
}

// ─── Toolkit ─────────────────────────────────────────────────────────────────
export interface ToolkitData {
  availableTools: string[];
  toolSelectionMode: 'agent_choice' | 'sequential' | 'all';
  toolConfigs?: Record<string, Record<string, unknown>>;
  [key: string]: unknown;
}

// ─── Knowledge ───────────────────────────────────────────────────────────────
export interface KnowledgeData {
  source: 'pgvector' | 'supabase_table' | 'file' | 'url' | 'agent_memory';
  collectionName?: string;
  query?: string;
  queryMode: 'static' | 'agent_generated';
  topK?: number;
  similarityThreshold?: number;
  injectAs: 'system_context' | 'user_message' | 'tool_result';
  [key: string]: unknown;
}

// ─── Gate ────────────────────────────────────────────────────────────────────
export interface GateData {
  gateType: 'human_approval' | 'confidence_threshold' | 'condition' | 'budget_check';
  condition?: string;
  threshold?: number;
  timeoutMinutes?: number;
  timeoutAction: 'approve' | 'reject' | 'escalate';
  notifyChannels?: string[];
  reviewData?: string[];
  [key: string]: unknown;
}

// ─── Checkpoint ──────────────────────────────────────────────────────────────
export interface CheckpointData {
  checkpointName: string;
  persistTo: 'supabase' | 'local';
  captureKeys: string[];
  resumable: boolean;
  ttlHours?: number;
  [key: string]: unknown;
}

// ─── Loop ────────────────────────────────────────────────────────────────────
export interface LoopData {
  loopType: 'retry_on_failure' | 'iterate_until' | 'for_each';
  maxIterations: number;
  exitCondition?: string;
  iterateOver?: string;
  delayBetweenMs?: number;
  onMaxReached: 'proceed' | 'abort' | 'escalate';
  [key: string]: unknown;
}

// ─── Convergence ─────────────────────────────────────────────────────────────
export interface ConvergenceData {
  mergeStrategy: 'wait_all' | 'wait_any' | 'wait_n';
  requiredCount?: number;
  mergeFunction: 'concatenate' | 'agent_synthesize' | 'custom';
  synthesisInstructions?: string;
  timeoutMinutes?: number;
  [key: string]: unknown;
}

// ─── Workflow Definition ─────────────────────────────────────────────────────
export interface WorkflowDefinition {
  nodes: Node[];
  edges: Edge[];
}

// ─── Run State ───────────────────────────────────────────────────────────────
export interface RunState {
  success: boolean;
  output: unknown;
  error?: string;
}

// ─── Union of all node data types ────────────────────────────────────────────
export type MissionNodeData =
  | MissionTriggerData
  | MissionObjectiveData
  | PhaseData
  | DelegationData
  | ToolkitData
  | KnowledgeData
  | GateData
  | CheckpointData
  | LoopData
  | ConvergenceData;
