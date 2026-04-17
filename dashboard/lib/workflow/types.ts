// ============================================================
// Ofiere Workflow V2 — Canonical Type Definitions
// DO NOT MODIFY these interfaces without updating this document.
// ============================================================

/** Declares what a connected agent can do in workflow mode. */
export interface AgentCapabilities {
  invoke: boolean;
  stream: boolean;
  structuredOutput: boolean;
  cancel: boolean;
  pauseResume: boolean;
  humanCheckpoint: boolean;
  toolCallEvents: boolean;
}

/** The normalized input payload sent to any agent during a workflow step. */
export interface WorkflowInvokeInput {
  agentId: string;
  agentName?: string;
  runId: string;
  stepId: string;
  task: string;
  context?: Record<string, any>;
  variables?: Record<string, any>;
  sessionKeyOverride?: string;
  priorStepOutputs?: Record<string, StepResult>;
  timeoutSec?: number;
  responseMode: "text" | "json";
  outputSchema?: Record<string, any>; // optional JSON Schema for structured output
}

/** The normalized output payload returned by any agent after a workflow step. */
export interface WorkflowInvokeResult {
  status: "completed" | "failed" | "timeout" | "cancelled";
  outputText?: string;
  outputJson?: any;
  events?: WorkflowStepEvent[];
  error?: string;
  usage?: {
    durationMs?: number;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
  };
}

/** An individual event emitted during agent execution (for logging). */
export interface WorkflowStepEvent {
  type: "log" | "tool_call" | "tool_result" | "thinking" | "error";
  timestamp: string; // ISO 8601
  data: any;
}

/** The result stored per-step after execution completes. */
export interface StepResult {
  stepId: string;
  nodeType: WorkflowNodeType;
  status: "completed" | "failed" | "timeout" | "skipped" | "pending_approval";
  outputText?: string;
  outputJson?: any;
  error?: string;
  durationMs?: number;
  startedAt: string; // ISO 8601
  completedAt?: string; // ISO 8601
}

/** All allowed node types in Workflow V2. Exactly 8. No more. */
export type WorkflowNodeType =
  | "manual_trigger"
  | "webhook_trigger"
  | "schedule_trigger"
  | "agent_step"
  | "formatter_step"
  | "human_approval"
  | "condition"
  | "output"
  | "delay"
  | "variable_set"
  | "http_request"
  | "loop"
  | "note"
  | "checkpoint";

/** Represents a single node in the workflow definition. */
export interface WorkflowNodeDefinition {
  id: string; // unique within the workflow, e.g. "step_1"
  type: WorkflowNodeType;
  label: string;
  config: Record<string, any>; // node-type-specific config (detailed below per type)
  position: { x: number; y: number }; // React Flow canvas position
}

/** Represents a connection between two nodes. */
export interface WorkflowEdgeDefinition {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string; // for condition nodes: "true" | "false"
}

/** The complete serialized workflow definition stored in the DB. */
export interface WorkflowDefinitionV2 {
  version: 2;
  nodes: WorkflowNodeDefinition[];
  edges: WorkflowEdgeDefinition[];
  globalVariables?: Record<string, any>;
}

/** Runtime state of a single workflow run. */
export type WorkflowRunStatus =
  | "idle"
  | "queued"
  | "running"
  | "paused_approval"
  | "completed"
  | "failed"
  | "cancelled";

/** The abstract adapter interface. Each agent integration implements this. */
export interface WorkflowAgentAdapter {
  getCapabilities(agentId: string): Promise<AgentCapabilities>;
  invoke(input: WorkflowInvokeInput): Promise<WorkflowInvokeResult>;
  cancel?(runId: string, stepId: string): Promise<void>;
}

/** Events yielded by the workflow executor during a run. */
export type WorkflowExecutorEvent =
  | { type: "step:start"; stepId: string; nodeType: WorkflowNodeType; timestamp: string }
  | { type: "step:completed"; stepId: string; result: StepResult; timestamp: string }
  | { type: "step:failed"; stepId: string; error?: string; timestamp: string }
  | { type: "step:log"; stepId: string; message: string; timestamp: string }
  | { type: "run:paused"; stepId: string; timestamp: string }
  | { type: "run:completed"; timestamp: string }
  | { type: "run:failed"; error?: string; timestamp: string };

// ============================================================
// Node Config Type Reference (Appendix)
// ============================================================

export interface ManualTriggerConfig {}

export interface WebhookTriggerConfig {
  webhookPayload?: Record<string, any>; // injected at runtime
}

export interface ScheduleTriggerConfig {
  cron: string; // e.g. "0 9 * * 1"
}

export interface AgentStepConfig {
  agentId: string;
  task: string;
  responseMode: "text" | "json";
  timeoutSec: number; // default 120
  outputSchema?: Record<string, any>;
  contextTemplate?: string;
}

export interface FormatterStepConfig {
  template: string;
  outputKey?: string;
  formatMode?: "template" | "uppercase" | "lowercase" | "extract_json" | "remove_whitespace";
}

export interface HumanApprovalConfig {
  instructions?: string;
  notifyChannels?: ("dashboard" | "email")[];
}

export interface ConditionConfig {
  expression: string; // "{{prev.step_id.field}} == value"
}

export interface OutputConfig {
  outputMode: "return" | "webhook" | "log" | "notification";
  webhookUrl?: string;
  template?: string;
}

export interface DelayConfig {
  delaySec: number; // seconds to wait
}

export interface VariableSetConfig {
  variableName: string;
  variableValue: string; // supports {{prev.stepId.outputText}} interpolation
  operation?: 'set' | 'append' | 'prepend';
}

export interface HttpRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string; // supports {{variable}} interpolation
  headers?: Record<string, string>;
  body?: string; // supports interpolation
  timeoutSec?: number;
}

export interface LoopConfig {
  loopType: 'count' | 'for_each';
  maxIterations: number;
  iterateOver?: string; // variable name or {{prev.stepId.outputText}}
}

export interface CheckpointConfig {}

export type NodeConfigMap = {
  manual_trigger: ManualTriggerConfig;
  webhook_trigger: WebhookTriggerConfig;
  schedule_trigger: ScheduleTriggerConfig;
  agent_step: AgentStepConfig;
  formatter_step: FormatterStepConfig;
  human_approval: HumanApprovalConfig;
  condition: ConditionConfig;
  output: OutputConfig;
  delay: DelayConfig;
  variable_set: VariableSetConfig;
  http_request: HttpRequestConfig;
  loop: LoopConfig;
  checkpoint: CheckpointConfig;
};
