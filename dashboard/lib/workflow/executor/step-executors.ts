// ============================================================
// Ofiere Workflow V2 — Step Executors
// Each function handles a single node type in the V2 workflow.
// ============================================================

import type {
  WorkflowNodeDefinition,
  StepResult,
  WorkflowAgentAdapter,
  WorkflowInvokeInput,
  AgentStepConfig,
  FormatterStepConfig,
  HumanApprovalConfig,
  ConditionConfig,
  OutputConfig,
  DelayConfig,
  VariableSetConfig,
  HttpRequestConfig,
  LoopConfig,
} from "../types";
import { createNotification } from "@/lib/notifications/engine";

type StepContext = {
  runId: string;
  userId: string;
  variables: Record<string, any>;
  priorOutputs: Record<string, StepResult>;
  adapter?: WorkflowAgentAdapter;
};

/** Interpolate {{variables}} and {{prev.stepId.field}} in a template string. */
function interpolate(template: string, ctx: StepContext): string {
  let result = template;

  // Replace {{prev.stepId.field}} — e.g. {{prev.step_1.outputText}}
  result = result.replace(/\{\{prev\.([^.]+)\.([^}]+)\}\}/g, (_, stepId, field) => {
    const prior = ctx.priorOutputs[stepId];
    if (!prior) return `[no output from ${stepId}]`;
    if (field === "outputText") return prior.outputText || "";
    if (field === "error") return prior.error || "";
    if (field === "outputJson" && prior.outputJson) {
      return typeof prior.outputJson === "string" ? prior.outputJson : JSON.stringify(prior.outputJson);
    }
    return `[unknown field: ${field}]`;
  });

  // Replace {{variables.key}}
  result = result.replace(/\{\{variables\.([^}]+)\}\}/g, (_, key) => {
    return ctx.variables[key] !== undefined ? String(ctx.variables[key]) : "";
  });

  // Replace bare {{key}} with variables
  result = result.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
    if (ctx.variables[key] !== undefined) return String(ctx.variables[key]);
    return `{{${key}}}`;
  });

  return result;
}

// ─── TRIGGER EXECUTORS ───────────────────────────────────────

export async function executeManualTrigger(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  return {
    stepId: node.id,
    nodeType: "manual_trigger",
    status: "completed",
    outputText: "Workflow triggered manually",
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  };
}

export async function executeWebhookTrigger(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const payload = (node.config as any)?.webhookPayload;
  return {
    stepId: node.id,
    nodeType: "webhook_trigger",
    status: "completed",
    outputText: payload ? JSON.stringify(payload) : "Webhook triggered",
    outputJson: payload,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  };
}

export async function executeScheduleTrigger(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const cron = (node.config as any)?.cron;
  return {
    stepId: node.id,
    nodeType: "schedule_trigger",
    status: "completed",
    outputText: `Schedule trigger fired (cron: ${cron || "N/A"})`,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
  };
}

// ─── AGENT STEP ──────────────────────────────────────────────

export async function executeAgentStep(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as AgentStepConfig;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  if (!ctx.adapter) {
    return {
      stepId: node.id,
      nodeType: "agent_step",
      status: "failed",
      error: "No adapter available for agent step",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    };
  }

  if (!config.agentId) {
    return {
      stepId: node.id,
      nodeType: "agent_step",
      status: "failed",
      error: "No agent selected for this step",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    };
  }

  // Build the task with interpolation
  let task = interpolate(config.task || "", ctx);
  const contextTemplate = config.contextTemplate
    ? interpolate(config.contextTemplate, ctx)
    : undefined;

  // Auto-inject prior outputs if the user didn't explicitly reference them 
  // (great UX for non-coders who just stack nodes)
  if (!config.task || !config.task.includes("{{prev.")) {
    const priorStrings = Object.entries(ctx.priorOutputs)
      .filter(([id, r]) => r.status === "completed" && r.outputText && !id.includes("trigger"))
      .map(([id, r]) => `[Output from step ${id}]:\n${r.outputText}`)
      .join("\n\n");
      
    if (priorStrings) {
      task = `Context from previous steps:\n${priorStrings}\n\n---\n\nTask instruction:\n${task}`;
    }
  }

  const invokeInput: WorkflowInvokeInput = {
    agentId: config.agentId,
    agentName: (config as any).agentName,
    runId: ctx.runId,
    stepId: node.id,
    task,
    context: contextTemplate ? { template: contextTemplate } : undefined,
    variables: ctx.variables,
    priorStepOutputs: ctx.priorOutputs,
    timeoutSec: config.timeoutSec || 120,
    responseMode: config.responseMode || "text",
    outputSchema: config.outputSchema,
  };

  try {
    const result = await ctx.adapter.invoke(invokeInput);
    return {
      stepId: node.id,
      nodeType: "agent_step",
      status: result.status === "completed" ? "completed" : "failed",
      outputText: result.outputText,
      outputJson: result.outputJson,
      error: result.error,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: result.usage?.durationMs || (Date.now() - startMs),
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "agent_step",
      status: "failed",
      error: e.message || "Agent invocation failed",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    };
  }
}

// ─── FORMATTER STEP ──────────────────────────────────────────

export async function executeFormatterStep(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as FormatterStepConfig;
  const startedAt = new Date().toISOString();

  try {
    let output = interpolate(config.template || "", ctx);

    const mode = config.formatMode || "template";
    if (mode === "uppercase") {
      output = output.toUpperCase();
    } else if (mode === "lowercase") {
      output = output.toLowerCase();
    } else if (mode === "remove_whitespace") {
      output = output.replace(/\s+/g, " ").trim();
    } else if (mode === "extract_json") {
      const startObj = output.indexOf("{");
      const startArr = output.indexOf("[");
      let startIdx = -1;
      let endIdx = -1;

      if (startObj !== -1 && startArr !== -1) {
        startIdx = Math.min(startObj, startArr);
      } else if (startObj !== -1) {
        startIdx = startObj;
      } else if (startArr !== -1) {
        startIdx = startArr;
      }

      if (startIdx !== -1) {
        const expectedEndChar = output[startIdx] === "{" ? "}" : "]";
        endIdx = output.lastIndexOf(expectedEndChar);
      }

      if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
        try {
          const jsonStr = output.substring(startIdx, endIdx + 1);
          const parsed = JSON.parse(jsonStr);
          output = JSON.stringify(parsed, null, 2);
        } catch (e) {
          console.warn("Extracted string wasn't valid JSON in Formatter node");
        }
      }
    }

    // If outputKey is set, store it in variables
    if (config.outputKey) {
      ctx.variables[config.outputKey] = output;
    }

    return {
      stepId: node.id,
      nodeType: "formatter_step",
      status: "completed",
      outputText: output,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "formatter_step",
      status: "failed",
      error: e.message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
}

// ─── HUMAN APPROVAL ──────────────────────────────────────────

export async function executeHumanApproval(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  // This step PAUSES the workflow — the executor must handle this signal.
  return {
    stepId: node.id,
    nodeType: "human_approval",
    status: "pending_approval",
    outputText: (node.config as HumanApprovalConfig)?.instructions || "Waiting for human approval",
    startedAt: new Date().toISOString(),
    durationMs: 0,
  };
}

// ─── CONDITION ───────────────────────────────────────────────

export async function executeCondition(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult & { branch: "true" | "false" }> {
  const config = node.config as ConditionConfig & { varCheck?: string; operator?: string; varMatch?: string };
  const startedAt = new Date().toISOString();

  try {
    let result = false;

    // Use native evaluation if operator and target variables are provided (safest)
    if (config.operator && config.varCheck !== undefined) {
      const left = interpolate(config.varCheck, ctx);
      const right = interpolate(config.varMatch || "", ctx);
      
      switch (config.operator) {
        case "==": result = left === right; break;
        case "!=": result = left !== right; break;
        case "contains": result = left.includes(right); break;
        case "not_contains": result = !left.includes(right); break;
        case "starts_with": result = left.startsWith(right); break;
        case "ends_with": result = left.endsWith(right); break;
        case "is_empty": result = left.trim().length === 0; break;
        case "not_empty": result = left.trim().length > 0; break;
        default: result = left === right;
      }
    } else {
      // Fallback to legacy raw code expression evaluation
      const expr = interpolate(config.expression || "true", ctx);
      try {
        result = !!eval(expr);
      } catch {
        result = expr === "true" || expr === "1";
      }
    }

    return {
      stepId: node.id,
      nodeType: "condition",
      status: "completed",
      outputText: String(result),
      branch: result ? "true" : "false",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "condition",
      status: "failed",
      error: e.message,
      branch: "false",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
}

// ─── OUTPUT ──────────────────────────────────────────────────

export async function executeOutput(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as OutputConfig;
  const startedAt = new Date().toISOString();

  try {
    let outputText = "";

    if (config.template) {
      outputText = interpolate(config.template, ctx);
    } else {
      // Default: aggregate all prior outputs
      const outputs = Object.entries(ctx.priorOutputs)
        .filter(([_, r]) => r.status === "completed" && r.outputText)
        .map(([id, r]) => `[${id}]: ${r.outputText}`)
        .join("\n");
      outputText = outputs || "No prior outputs available";
    }

    if (config.outputMode === "webhook" && config.webhookUrl) {
      try {
        await fetch(config.webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: ctx.runId,
            stepId: node.id,
            output: outputText,
            variables: ctx.variables,
          }),
        });
      } catch (e: any) {
        console.error("[OutputExecutor] Webhook failed:", e.message);
      }
    } else if (config.outputMode === "notification") {
      try {
        await createNotification(ctx.userId, "success", "Workflow Output", outputText);
      } catch (e: any) {
        console.error("[OutputExecutor] Notification failed:", e.message);
      }
    }

    return {
      stepId: node.id,
      nodeType: "output",
      status: "completed",
      outputText,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "output",
      status: "failed",
      error: e.message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
}

// ─── DELAY ───────────────────────────────────────────────────

export async function executeDelay(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as DelayConfig;
  const delaySec = config.delaySec || 5;
  const startedAt = new Date().toISOString();

  await new Promise((resolve) => setTimeout(resolve, delaySec * 1000));

  return {
    stepId: node.id,
    nodeType: "delay",
    status: "completed",
    outputText: `Waited ${delaySec} seconds`,
    startedAt,
    completedAt: new Date().toISOString(),
    durationMs: delaySec * 1000,
  };
}

// ─── VARIABLE SET ────────────────────────────────────────────

export async function executeVariableSet(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as VariableSetConfig;
  const startedAt = new Date().toISOString();

  try {
    const name = config.variableName || "";
    let value = interpolate(config.variableValue || "", ctx);

    if (name) {
      const operation = config.operation || "set";
      if (operation === "append") {
        ctx.variables[name] = (ctx.variables[name] || "") + value;
      } else if (operation === "prepend") {
        ctx.variables[name] = value + (ctx.variables[name] || "");
      } else {
        ctx.variables[name] = value;
      }
    }

    return {
      stepId: node.id,
      nodeType: "variable_set",
      status: "completed",
      outputText: `Set ${name} = ${ctx.variables[name] || value}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "variable_set",
      status: "failed",
      error: e.message,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
}

// ─── HTTP REQUEST ────────────────────────────────────────────

export async function executeHttpRequest(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult> {
  const config = node.config as HttpRequestConfig;
  const startedAt = new Date().toISOString();
  const startMs = Date.now();

  try {
    const url = interpolate(config.url || "", ctx);
    if (!url) throw new Error("No URL configured for HTTP request");

    const method = (config.method || "GET").toUpperCase();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.headers) {
      for (const [k, v] of Object.entries(config.headers)) {
        headers[k] = interpolate(v, ctx);
      }
    }

    const fetchOptions: RequestInit = { method, headers };
    if (config.body && method !== "GET") {
      fetchOptions.body = interpolate(config.body, ctx);
    }

    const controller = new AbortController();
    const timeout = (config.timeoutSec || 30) * 1000;
    const timer = setTimeout(() => controller.abort(), timeout);
    fetchOptions.signal = controller.signal;

    const res = await fetch(url, fetchOptions);
    clearTimeout(timer);

    const responseText = await res.text();
    let outputJson: any = undefined;
    try { outputJson = JSON.parse(responseText); } catch {}

    return {
      stepId: node.id,
      nodeType: "http_request",
      status: res.ok ? "completed" : "failed",
      outputText: responseText,
      outputJson,
      error: res.ok ? undefined : `HTTP ${res.status}: ${res.statusText}`,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    };
  } catch (e: any) {
    return {
      stepId: node.id,
      nodeType: "http_request",
      status: "failed",
      error: e.name === "AbortError" ? "Request timed out" : (e.message || "HTTP request failed"),
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: Date.now() - startMs,
    };
  }
}

// ─── LOOP ────────────────────────────────────────────────────

export async function executeLoop(
  node: WorkflowNodeDefinition,
  ctx: StepContext
): Promise<StepResult & { branch: "loop_body" | "done" }> {
  const config = node.config as LoopConfig;
  const startedAt = new Date().toISOString();

  // Track loop iteration count in variables
  const iterKey = `_loop_${node.id}_iteration`;
  const currentIter = (ctx.variables[iterKey] || 0) as number;
  const maxIter = config.maxIterations || 3;

  if (currentIter < maxIter) {
    ctx.variables[iterKey] = currentIter + 1;
    ctx.variables[`_loop_${node.id}_index`] = currentIter;

    return {
      stepId: node.id,
      nodeType: "loop",
      status: "completed",
      outputText: `Iteration ${currentIter + 1} of ${maxIter}`,
      branch: "loop_body",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  } else {
    // Reset counter for potential re-runs
    ctx.variables[iterKey] = 0;

    return {
      stepId: node.id,
      nodeType: "loop",
      status: "completed",
      outputText: `Loop completed after ${maxIter} iterations`,
      branch: "done",
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs: 0,
    };
  }
}
