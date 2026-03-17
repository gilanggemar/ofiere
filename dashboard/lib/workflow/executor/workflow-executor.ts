// ============================================================
// NERV.OS Workflow V2 — Workflow Executor
// Walks the node graph, executes each step, yields events.
// ============================================================

import type {
  WorkflowDefinitionV2,
  WorkflowNodeDefinition,
  WorkflowEdgeDefinition,
  WorkflowExecutorEvent,
  WorkflowNodeType,
  StepResult,
  WorkflowAgentAdapter,
} from "../types";
import {
  executeManualTrigger,
  executeWebhookTrigger,
  executeScheduleTrigger,
  executeAgentStep,
  executeFormatterStep,
  executeHumanApproval,
  executeCondition,
  executeOutput,
} from "./step-executors";

export interface WorkflowExecutorOptions {
  definition: WorkflowDefinitionV2;
  runId: string;
  userId: string;
  adapter?: WorkflowAgentAdapter;
  nodeAdapters?: Record<string, WorkflowAgentAdapter>;
  triggerInput?: Record<string, any>;
}

/**
 * Async generator that walks the V2 workflow graph and yields events.
 * The caller (API route) wraps these events as SSE frames.
 */
export async function* executeWorkflowV2(
  options: WorkflowExecutorOptions
): AsyncGenerator<WorkflowExecutorEvent> {
  const { definition, runId, userId, adapter, nodeAdapters, triggerInput } = options;
  const { nodes, edges } = definition;

  const variables: Record<string, any> = {
    ...definition.globalVariables,
    ...triggerInput,
  };
  const priorOutputs: Record<string, StepResult> = {};
  const visited = new Set<string>();

  // Build adjacency map
  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceNodeId) || [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }

  // Find trigger nodes (entry points — only actual trigger-type nodes)
  const TRIGGER_TYPES = new Set(["manual_trigger", "webhook_trigger", "schedule_trigger", "trigger"]);
  const triggerNodes = nodes.filter(
    (n) => TRIGGER_TYPES.has(n.type)
  );

  if (triggerNodes.length === 0) {
    yield {
      type: "run:failed",
      error: "No trigger node found in workflow",
      timestamp: new Date().toISOString(),
    };
    return;
  }

  // BFS queue
  const queue: string[] = triggerNodes.map((n) => n.id);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    // Emit step:start
    yield {
      type: "step:start",
      stepId: node.id,
      nodeType: node.type,
      timestamp: new Date().toISOString(),
    };

    // Execute the step OR use frozenResult
    let result: StepResult;
    try {
      const config = node.config as any;
      if (config.isFrozen && config.frozenResult) {
        result = config.frozenResult;
        result.startedAt = new Date().toISOString();
        result.completedAt = new Date().toISOString();
        result.durationMs = 0;
        
        yield {
          type: "step:log",
          stepId: node.id,
          message: "❄️ Node is frozen. Using cached output.",
          timestamp: new Date().toISOString()
        };
      } else {
        result = await executeNode(node, {
          runId,
          userId,
          variables,
          priorOutputs,
          adapter: nodeAdapters?.[node.id] || adapter,
        });
      }
    } catch (e: any) {
      result = {
        stepId: node.id,
        nodeType: node.type,
        status: "failed",
        error: e.message || "Unknown execution error",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
    }

    priorOutputs[node.id] = result;

    // Handle human approval pause
    if (result.status === "pending_approval") {
      yield {
        type: "run:paused",
        stepId: node.id,
        timestamp: new Date().toISOString(),
      };
      return; // The caller should persist state and resume later
    }

    // Handle failure
    if (result.status === "failed" || result.status === "timeout") {
      yield {
        type: "step:failed",
        stepId: node.id,
        error: result.error,
        timestamp: new Date().toISOString(),
      };
      yield {
        type: "run:failed",
        error: `Step ${node.id} (${node.label}) failed: ${result.error || "unknown"}`,
        timestamp: new Date().toISOString(),
      };
      return;
    }

    // Emit step:completed
    yield {
      type: "step:completed",
      stepId: node.id,
      result,
      timestamp: new Date().toISOString(),
    };

    // Route to next nodes
    const nextEdges = outgoing.get(node.id) || [];

    if (node.type === "condition") {
      // Condition node — route based on branch
      const branch = (result as any).branch || "false";
      for (const edge of nextEdges) {
        const handle = edge.sourceHandle || "true";
        if (handle === branch) {
          queue.push(edge.targetNodeId);
        }
      }
    } else {
      // Regular node — follow all outgoing edges
      for (const edge of nextEdges) {
        queue.push(edge.targetNodeId);
      }
    }
  }

  // All steps completed
  yield {
    type: "run:completed",
    timestamp: new Date().toISOString(),
  };
}

/** Dispatch to the correct step executor based on node type. */
export async function executeNode(
  node: WorkflowNodeDefinition,
  ctx: {
    runId: string;
    userId: string;
    variables: Record<string, any>;
    priorOutputs: Record<string, StepResult>;
    adapter?: WorkflowAgentAdapter;
  }
): Promise<StepResult> {
  switch (node.type) {
    case "manual_trigger":
      return executeManualTrigger(node, ctx);
    case "webhook_trigger":
      return executeWebhookTrigger(node, ctx);
    case "schedule_trigger":
      return executeScheduleTrigger(node, ctx);
    case "agent_step":
      return executeAgentStep(node, ctx);
    case "formatter_step":
      return executeFormatterStep(node, ctx);
    case "human_approval":
      return executeHumanApproval(node, ctx);
    case "condition":
      return executeCondition(node, ctx);
    case "output":
      return executeOutput(node, ctx);
    default:
      return {
        stepId: node.id,
        nodeType: node.type,
        status: "failed",
        error: `Unknown node type: ${node.type}`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
      };
  }
}

// ============================================================
// Resume: continue execution from AFTER the approval node
// ============================================================

export interface ResumeWorkflowOptions extends WorkflowExecutorOptions {
  /** The node ID of the human_approval node that was approved */
  approvedNodeId: string;
  /** Optional human review instructions to carry forward */
  reviewInstructions?: string;
  /** Prior outputs from the original run up to the approval node */
  priorOutputsSnapshot: Record<string, StepResult>;
}

export async function* resumeWorkflowV2(
  options: ResumeWorkflowOptions
): AsyncGenerator<WorkflowExecutorEvent> {
  const { definition, runId, userId, adapter, nodeAdapters, approvedNodeId, reviewInstructions, priorOutputsSnapshot } = options;
  const { nodes, edges } = definition;

  const variables: Record<string, any> = {
    ...definition.globalVariables,
    ...(options.triggerInput ?? {}),
  };
  const priorOutputs: Record<string, StepResult> = { ...priorOutputsSnapshot };
  const visited = new Set<string>();

  // Mark the approval node as completed
  priorOutputs[approvedNodeId] = {
    stepId: approvedNodeId,
    nodeType: "human_approval",
    status: "completed",
    outputText: reviewInstructions || "Approved by human",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  };

  // If instructions provided, inject into variables for downstream nodes
  if (reviewInstructions) {
    variables["_humanReviewInstructions"] = reviewInstructions;
  }

  // Mark all already-completed nodes as visited
  for (const [nodeId, result] of Object.entries(priorOutputs)) {
    if (result.status === "completed") {
      visited.add(nodeId);
    }
  }

  yield {
    type: "step:completed",
    stepId: approvedNodeId,
    result: priorOutputs[approvedNodeId],
    timestamp: new Date().toISOString(),
  };

  // Build adjacency map
  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceNodeId) || [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }

  // BFS from the approval node's children
  const nextEdges = outgoing.get(approvedNodeId) || [];
  const queue: string[] = nextEdges.map(e => e.targetNodeId);

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    yield {
      type: "step:start",
      stepId: node.id,
      nodeType: node.type,
      timestamp: new Date().toISOString(),
    };

    let result: StepResult;
    try {
      const config = node.config as any;
      if (config.isFrozen && config.frozenResult) {
        result = config.frozenResult;
        result.startedAt = new Date().toISOString();
        result.completedAt = new Date().toISOString();
        result.durationMs = 0;
      } else {
        result = await executeNode(node, {
          runId, userId, variables, priorOutputs,
          adapter: nodeAdapters?.[node.id] || adapter,
        });
      }
    } catch (e: any) {
      result = {
        stepId: node.id, nodeType: node.type, status: "failed",
        error: e.message || "Unknown execution error",
        startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationMs: 0,
      };
    }

    priorOutputs[node.id] = result;

    if (result.status === "pending_approval") {
      yield { type: "run:paused", stepId: node.id, timestamp: new Date().toISOString() };
      return;
    }

    if (result.status === "failed" || result.status === "timeout") {
      yield { type: "step:failed", stepId: node.id, error: result.error, timestamp: new Date().toISOString() };
      yield { type: "run:failed", error: `Step ${node.id} failed: ${result.error}`, timestamp: new Date().toISOString() };
      return;
    }

    yield { type: "step:completed", stepId: node.id, result, timestamp: new Date().toISOString() };

    const childEdges = outgoing.get(node.id) || [];
    if (node.type === "condition") {
      const branch = (result as any).branch || "false";
      for (const edge of childEdges) {
        if ((edge.sourceHandle || "true") === branch) queue.push(edge.targetNodeId);
      }
    } else {
      for (const edge of childEdges) queue.push(edge.targetNodeId);
    }
  }

  yield { type: "run:completed", timestamp: new Date().toISOString() };
}

// ============================================================
// Retry: restart from the first node AFTER the trigger,
// carrying the data that reached the approval node as context
// ============================================================

export interface RetryWorkflowOptions extends WorkflowExecutorOptions {
  /** Optional human review instructions */
  reviewInstructions?: string;
  /** The prior outputs from the original run (the reviewed data) */
  priorOutputsSnapshot: Record<string, StepResult>;
}

export async function* retryWorkflowV2(
  options: RetryWorkflowOptions
): AsyncGenerator<WorkflowExecutorEvent> {
  const { definition, runId, userId, adapter, nodeAdapters, reviewInstructions, priorOutputsSnapshot } = options;
  const { nodes, edges } = definition;

  const variables: Record<string, any> = {
    ...definition.globalVariables,
    ...(options.triggerInput ?? {}),
  };

  // Inject the reviewed data and optional instructions into variables
  if (reviewInstructions) {
    variables["_humanReviewInstructions"] = reviewInstructions;
  }

  // Collect all prior output text as review context for agents
  const reviewedDataParts: string[] = [];
  for (const [stepId, result] of Object.entries(priorOutputsSnapshot)) {
    if (result.status === "completed" && result.outputText && !stepId.includes("trigger")) {
      reviewedDataParts.push(`[Previous output from ${stepId}]:\n${result.outputText}`);
    }
  }
  if (reviewedDataParts.length > 0) {
    variables["_priorRunData"] = reviewedDataParts.join("\n\n");
  }

  const priorOutputs: Record<string, StepResult> = {};
  const visited = new Set<string>();

  // Build adjacency map
  const outgoing = new Map<string, WorkflowEdgeDefinition[]>();
  for (const edge of edges) {
    const list = outgoing.get(edge.sourceNodeId) || [];
    list.push(edge);
    outgoing.set(edge.sourceNodeId, list);
  }

  // Find trigger nodes and execute them first (they complete instantly)
  const TRIGGER_TYPES = new Set(["manual_trigger", "webhook_trigger", "schedule_trigger", "trigger"]);
  const triggerNodes = nodes.filter(n => TRIGGER_TYPES.has(n.type));

  if (triggerNodes.length === 0) {
    yield { type: "run:failed", error: "No trigger node found", timestamp: new Date().toISOString() };
    return;
  }

  // Execute triggers
  for (const trigger of triggerNodes) {
    visited.add(trigger.id);
    const result = await executeNode(trigger, { runId, userId, variables, priorOutputs, adapter });
    priorOutputs[trigger.id] = result;

    yield {
      type: "step:start",
      stepId: trigger.id,
      nodeType: trigger.type,
      timestamp: new Date().toISOString(),
    };
    yield {
      type: "step:completed",
      stepId: trigger.id,
      result,
      timestamp: new Date().toISOString(),
    };
  }

  // BFS from trigger children
  const queue: string[] = [];
  for (const trigger of triggerNodes) {
    const childEdges = outgoing.get(trigger.id) || [];
    for (const edge of childEdges) queue.push(edge.targetNodeId);
  }

  // Inject review context: for agent_step nodes, prepend review info to their task
  // This is done at execution time in the step executor via priorOutputs and variables

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const node = nodes.find((n) => n.id === nodeId);
    if (!node) continue;

    yield {
      type: "step:start",
      stepId: node.id,
      nodeType: node.type,
      timestamp: new Date().toISOString(),
    };

    let result: StepResult;
    try {
      // For agent_step on retry: inject the review context into the task
      let nodeForExecution = node;
      if (node.type === "agent_step" && (variables["_priorRunData"] || reviewInstructions)) {
        const config = { ...(node.config as any) };
        let retryContext = "";
        if (variables["_priorRunData"]) {
          retryContext += `\n\n--- PREVIOUS RUN OUTPUT (for review) ---\n${variables["_priorRunData"]}`;
        }
        if (reviewInstructions) {
          retryContext += `\n\n--- HUMAN REVIEWER FEEDBACK ---\n${reviewInstructions}`;
        }
        config.task = (config.task || "") + retryContext;
        nodeForExecution = { ...node, config };
      }

      const execConfig = nodeForExecution.config as any;
      if (execConfig.isFrozen && execConfig.frozenResult) {
        result = execConfig.frozenResult;
        result.startedAt = new Date().toISOString();
        result.completedAt = new Date().toISOString();
        result.durationMs = 0;
      } else {
        result = await executeNode(nodeForExecution, {
          runId, userId, variables, priorOutputs,
          adapter: nodeAdapters?.[node.id] || adapter,
        });
      }
    } catch (e: any) {
      result = {
        stepId: node.id, nodeType: node.type, status: "failed",
        error: e.message || "Unknown execution error",
        startedAt: new Date().toISOString(), completedAt: new Date().toISOString(), durationMs: 0,
      };
    }

    priorOutputs[node.id] = result;

    if (result.status === "pending_approval") {
      yield { type: "run:paused", stepId: node.id, timestamp: new Date().toISOString() };
      return;
    }

    if (result.status === "failed" || result.status === "timeout") {
      yield { type: "step:failed", stepId: node.id, error: result.error, timestamp: new Date().toISOString() };
      yield { type: "run:failed", error: `Step ${node.id} failed: ${result.error}`, timestamp: new Date().toISOString() };
      return;
    }

    yield { type: "step:completed", stepId: node.id, result, timestamp: new Date().toISOString() };

    const childEdges = outgoing.get(node.id) || [];
    if (node.type === "condition") {
      const branch = (result as any).branch || "false";
      for (const edge of childEdges) {
        if ((edge.sourceHandle || "true") === branch) queue.push(edge.targetNodeId);
      }
    } else {
      for (const edge of childEdges) queue.push(edge.targetNodeId);
    }
  }

  yield { type: "run:completed", timestamp: new Date().toISOString() };
}
