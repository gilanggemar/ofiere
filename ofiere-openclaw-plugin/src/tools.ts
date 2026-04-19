// src/tools.ts — Meta-tool registration for Ofiere PM plugin
// Architecture: Each meta-tool handles one domain (tasks, agents, etc.)
// with an "action" parameter that routes to the correct handler.
//
// To add a new domain:
//   1. Create a handler function (e.g. registerProjectOps)
//   2. Add it to the registerAllTools() call at the bottom
//   3. Update prompt.ts to document the new meta-tool
//
// This pattern keeps the tool count low (1 tool per domain)
// while supporting unlimited operations within each domain.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { OfiereConfig } from "./types.js";
import { resolveAgentId } from "./agent-resolver.js";

// ─── Tool result shape (matches OpenClaw SDK) ────────────────────────────────

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
}

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
  };
}

// ─── Helper: extract calling agent's accountId from OpenClaw context ─────────

// Module-level: set once at registration time from index.ts
let _registrationAgentName = "";
export function setRegistrationAgentName(name: string) {
  if (name && !_registrationAgentName) _registrationAgentName = name;
}

function getCallingAgentName(api: any): string {
  // OpenClaw passes agent context in various ways — try ALL known paths
  try {
    const candidates = [
      api?.agentContext?.accountId,
      api?.agentContext?.name,
      api?.agentContext?.id,
      api?.currentAgent?.accountId,
      api?.currentAgent?.name,
      api?.currentAgent?.id,
      api?.agent?.accountId,
      api?.agent?.name,
      api?.agent?.id,
      api?.agentId,
      api?.agentName,
      api?.accountId,
      api?.name,
      api?.id,
      api?.metadata?.agentId,
      api?.metadata?.accountId,
      api?.metadata?.agentName,
      api?.context?.agentId,
      api?.context?.accountId,
      api?.context?.agent?.name,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  } catch {
    // ignore
  }
  return "";
}

/**
 * Probe the API object for any agent identity info. Called once at registration.
 * Logs ALL available keys for debugging.
 */
export function probeApiForAgentName(api: any, logger?: any): string {
  // Direct detection
  const name = getCallingAgentName(api);
  if (name) {
    logger?.info?.(`[ofiere] Detected agent from API: "${name}"`);
    setRegistrationAgentName(name);
    return name;
  }

  // Log all top-level keys for future debugging
  try {
    const keys = Object.keys(api || {});
    logger?.debug?.(`[ofiere] API object keys: ${JSON.stringify(keys)}`);
    // Check if any key looks like it contains agent info
    for (const key of keys) {
      const val = api[key];
      if (typeof val === "string" && val.length > 0 && val.length < 50) {
        logger?.debug?.(`[ofiere] API.${key} = "${val}"`);
      }
    }
  } catch {
    // ignore
  }
  return "";
}

// ─── Shared: Agent ID Resolution ─────────────────────────────────────────────

// System/plugin names that should never be treated as real agent identifiers.
// These come from the OpenClaw gateway registration context, not from actual agents.
const SYSTEM_NAME_BLOCKLIST = new Set([
  "ofiere pm", "ofiere", "openclaw", "system", "plugin", "gateway", "admin",
  "ofiere pm plugin", "ofiere-openclaw-plugin",
]);

function isSystemName(name: string): boolean {
  return SYSTEM_NAME_BLOCKLIST.has(name.toLowerCase().trim());
}

function createAgentResolver(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
) {
  /**
   * Resolve the agent ID for the calling agent.
   * Priority: explicit param > env var > DB fallback
   *
   * NOTE: We intentionally skip runtime/registration detection because the
   * OpenClaw api object returns the PLUGIN name ("Ofiere PM"), not the
   * calling agent's name. Each agent must pass its own name via agent_id.
   */
  return async function resolveAgent(explicitId?: string): Promise<string | null> {
    // 1. Explicit agent_id passed by the LLM (e.g. "ivy", "celia", or a UUID)
    if (explicitId && explicitId.trim()) {
      const trimmed = explicitId.trim();

      // Block system names from being used as agent IDs
      if (isSystemName(trimmed)) {
        // Fall through to DB fallback
      } else if (trimmed.match(/^[0-9a-f]{8}-/) || trimmed.match(/^agent-/)) {
        // Looks like a UUID or our ID format — use directly
        return trimmed;
      } else {
        // Treat as a name and resolve to the actual agent ID
        try {
          const resolved = await resolveAgentId(trimmed, userId, supabase);
          if (resolved && !isSystemName(resolved)) return resolved;
        } catch {
          // Fall through
        }
      }
    }

    // 2. Env var fallback (OFIERE_AGENT_ID — legacy single-agent mode)
    if (fallbackAgentId) return fallbackAgentId;

    // 3. Nuclear fallback: query the FIRST agent for this user
    try {
      const { data } = await supabase
        .from("agents")
        .select("id")
        .eq("user_id", userId)
        .order("name", { ascending: true })
        .limit(1)
        .single();
      if (data?.id) return data.id;
    } catch {
      // ignore
    }

    return null;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 1: OFIERE_TASK_OPS — Task Management
// ═══════════════════════════════════════════════════════════════════════════════

function registerTaskOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  resolveAgent: (id?: string) => Promise<string | null>,
): void {
  api.registerTool({
    name: "OFIERE_TASK_OPS",
    label: "Ofiere Task Operations",
    description:
      `Manage tasks in the Ofiere PM dashboard. All task operations go through this tool.\n\n` +
      `Actions:\n` +
      `- "list": List/filter tasks. Optional: status, agent_id, space_id, folder_id, limit\n` +
      `- "create": Create a task. Required: title. Optional: agent_id, description, status, priority, space_id, folder_id, start_date, due_date, tags, instructions, execution_plan, goals, constraints, system_prompt\n` +
      `- "update": Update a task. Required: task_id. Optional: all create fields + progress\n` +
      `- "delete": Delete task + subtasks. Required: task_id\n\n` +
      `For complex tasks, fill in execution_plan (step-by-step plan), goals, constraints, and system_prompt to help the executing agent.\n` +
      `For simple tasks, just provide title and optionally description.\n` +
      `agent_id: Pass your name to self-assign, another agent's name, or 'none'.\n` +
      `Status: PENDING, IN_PROGRESS, DONE, FAILED | Priority: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list", "create", "update", "delete"],
        },
        task_id: { type: "string", description: "Task ID (required for update, delete)" },
        title: { type: "string", description: "Task title (required for create)" },
        description: { type: "string", description: "Task description" },
        instructions: { type: "string", description: "Detailed instructions for the agent executing this task" },
        agent_id: {
          type: "string",
          description: "Agent name or ID. Your name to self-assign, 'none' for unassigned.",
        },
        status: {
          type: "string",
          description: "Task status",
          enum: ["PENDING", "IN_PROGRESS", "DONE", "FAILED"],
        },
        priority: { type: "number", description: "Priority: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL" },
        progress: { type: "number", description: "Progress percentage 0-100 (update only)" },
        space_id: { type: "string", description: "PM Space ID" },
        folder_id: { type: "string", description: "PM Folder ID" },
        start_date: { type: "string", description: "Start date (ISO 8601)" },
        due_date: { type: "string", description: "Due date (ISO 8601)" },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Tags for the task",
        },
        execution_plan: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Step description" },
            },
            required: ["text"],
          },
          description: "Ordered execution steps for complex tasks. Each step: { text: '...' }",
        },
        goals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["budget", "stack", "legal", "deadline", "custom"], description: "Goal category" },
              label: { type: "string", description: "Goal description" },
            },
            required: ["label"],
          },
          description: "Task goals. Each: { type?: 'budget'|'stack'|'legal'|'deadline'|'custom', label: '...' }",
        },
        constraints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["budget", "stack", "legal", "deadline", "custom"], description: "Constraint category" },
              label: { type: "string", description: "Constraint description" },
            },
            required: ["label"],
          },
          description: "Task constraints. Each: { type?: 'budget'|'stack'|'legal'|'deadline'|'custom', label: '...' }",
        },
        system_prompt: { type: "string", description: "Custom system prompt injection for the executing agent" },
        limit: { type: "number", description: "Max results for list (default 50)" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list":
          return handleListTasks(supabase, userId, params);
        case "create":
          return handleCreateTask(supabase, userId, resolveAgent, params);
        case "update":
          return handleUpdateTask(supabase, userId, params);
        case "delete":
          return handleDeleteTask(supabase, userId, params);
        default:
          return err(
            `Unknown action "${action}". Valid actions: list, create, update, delete`,
          );
      }
    },
  });
}

// ── Task action handlers ─────────────────────────────────────────────────────

async function handleListTasks(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    let query = supabase
      .from("tasks")
      .select(
        "id, title, description, status, priority, agent_id, space_id, folder_id, " +
        "start_date, due_date, progress, tags, custom_fields, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (params.space_id) query = query.eq("space_id", params.space_id as string);
    if (params.folder_id) query = query.eq("folder_id", params.folder_id as string);
    if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
    if (params.status) query = query.eq("status", params.status as string);
    query = query.limit((params.limit as number) || 50);

    const { data, error } = await query;
    if (error) return err(error.message);

    // Unpack custom_fields for readability
    const tasks = (data || []).map((t: any) => {
      const cf = t.custom_fields || {};
      return {
        ...t,
        execution_plan: cf.execution_plan || undefined,
        goals: cf.goals || undefined,
        constraints: cf.constraints || undefined,
        system_prompt: cf.system_prompt || undefined,
        instructions: cf.instructions || t.description || undefined,
      };
    });

    return ok({ tasks, count: tasks.length });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleCreateTask(
  supabase: SupabaseClient,
  userId: string,
  resolveAgent: (id?: string) => Promise<string | null>,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.title) return err("Missing required field: title");

    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date().toISOString();

    // Handle explicit "none"/"unassigned"
    const rawAgentId = params.agent_id as string | undefined;
    const isUnassigned =
      rawAgentId &&
      ["none", "unassigned", "null", ""].includes(rawAgentId.toLowerCase().trim());

    const assignee = isUnassigned ? null : await resolveAgent(rawAgentId);

    // Build custom_fields from task-ops extended fields
    const cf: Record<string, unknown> = {};

    if (params.execution_plan && Array.isArray(params.execution_plan) && (params.execution_plan as any[]).length > 0) {
      cf.execution_plan = (params.execution_plan as any[]).map((step: any, i: number) => ({
        id: `step-${Date.now()}-${i}`,
        text: typeof step === "string" ? step : step.text || String(step),
        order: i,
      }));
    }

    if (params.goals && Array.isArray(params.goals) && (params.goals as any[]).length > 0) {
      cf.goals = (params.goals as any[]).map((g: any, i: number) => ({
        id: `goal-${Date.now()}-${i}`,
        type: g.type || "custom",
        label: typeof g === "string" ? g : g.label || String(g),
      }));
    }

    if (params.constraints && Array.isArray(params.constraints) && (params.constraints as any[]).length > 0) {
      cf.constraints = (params.constraints as any[]).map((c: any, i: number) => ({
        id: `cstr-${Date.now()}-${i}`,
        type: c.type || "custom",
        label: typeof c === "string" ? c : c.label || String(c),
      }));
    }

    if (params.system_prompt) cf.system_prompt = params.system_prompt;
    if (params.instructions) cf.instructions = params.instructions;

    const insertData: Record<string, unknown> = {
      id,
      user_id: userId,
      title: params.title,
      description: (params.description as string) || (params.instructions as string) || null,
      agent_id: assignee,
      assignee_type: "agent",
      status: (params.status as string) || "PENDING",
      priority: params.priority !== undefined ? params.priority : 1,
      space_id: (params.space_id as string) || null,
      folder_id: (params.folder_id as string) || null,
      start_date: (params.start_date as string) || null,
      due_date: (params.due_date as string) || null,
      tags: (params.tags as string[]) || [],
      progress: 0,
      sort_order: 0,
      custom_fields: Object.keys(cf).length > 0 ? cf : {},
      created_at: now,
      updated_at: now,
    };

    const { error } = await supabase.from("tasks").insert(insertData);

    if (error) {
      if (error.message?.includes("agent_id") || error.message?.includes("foreign key")) {
        insertData.agent_id = null;
        const retry = await supabase.from("tasks").insert(insertData);
        if (retry.error) return err(retry.error.message);
        return ok({
          id,
          message: `Task "${params.title}" created (agent_id "${assignee}" was invalid, assigned to none)`,
          task: insertData,
        });
      }
      return err(error.message);
    }

    // ── Auto-create scheduler event if task has a start_date ──────────────
    // This bridges the plugin → scheduler so the pg_cron task-dispatcher
    // Edge Function picks up the task at the right time.
    const startDate = params.start_date as string | undefined;
    const effectiveAgentId = (insertData.agent_id as string) || assignee;
    if (startDate && effectiveAgentId) {
      try {
        // Parse start_date robustly — it can be:
        //   "2026-04-19"                    (date only)
        //   "2026-04-19T18:45:00"           (local datetime)
        //   "2026-04-19 11:45:00+00"        (Supabase timestamptz)
        //   "2026-04-19T11:45:00.000Z"      (ISO UTC)
        const parsedDate = new Date(startDate);
        const explicitScheduledTime = params.scheduled_time as string | undefined;

        let nextRunAtEpoch: number;
        let scheduledTimeFinal: string;
        let scheduledDateFinal: string;

        if (!isNaN(parsedDate.getTime())) {
          // Valid date — check if it includes a meaningful time component
          const hasTimeInfo = /[T ]\d{2}:\d{2}/.test(startDate);

          if (explicitScheduledTime) {
            // Agent explicitly passed a scheduled_time — use date from start_date + explicit time
            const dateStr = parsedDate.toISOString().split("T")[0]; // YYYY-MM-DD
            const dt = new Date(`${dateStr}T${explicitScheduledTime}:00Z`);
            nextRunAtEpoch = Math.floor(dt.getTime() / 1000);
            scheduledTimeFinal = explicitScheduledTime;
            scheduledDateFinal = dateStr;
          } else if (hasTimeInfo) {
            // start_date already contains time — use it directly
            nextRunAtEpoch = Math.floor(parsedDate.getTime() / 1000);
            scheduledTimeFinal = `${String(parsedDate.getUTCHours()).padStart(2, "0")}:${String(parsedDate.getUTCMinutes()).padStart(2, "0")}`;
            scheduledDateFinal = parsedDate.toISOString().split("T")[0];
          } else {
            // Date only, no time — default to 09:00 UTC
            const dateStr = parsedDate.toISOString().split("T")[0];
            const dt = new Date(`${dateStr}T09:00:00Z`);
            nextRunAtEpoch = Math.floor(dt.getTime() / 1000);
            scheduledTimeFinal = "09:00";
            scheduledDateFinal = dateStr;
          }
        } else {
          // Unparseable date — fallback to now + 60s
          nextRunAtEpoch = Math.floor(Date.now() / 1000) + 60;
          scheduledTimeFinal = "00:00";
          scheduledDateFinal = new Date().toISOString().split("T")[0];
        }

        // Safety net: if computed time is in the past, schedule for now + 60s
        const nowEpoch = Math.floor(Date.now() / 1000);
        if (nextRunAtEpoch <= nowEpoch) {
          nextRunAtEpoch = nowEpoch + 60;
        }

        await supabase.from("scheduler_events").insert({
          id: crypto.randomUUID(),
          user_id: userId,
          task_id: id,
          agent_id: effectiveAgentId,
          title: params.title,
          description: (params.description as string) || (params.instructions as string) || null,
          scheduled_date: scheduledDateFinal,
          scheduled_time: scheduledTimeFinal,
          duration_minutes: 30,
          recurrence_type: "none",
          recurrence_interval: 1,
          status: "scheduled",
          next_run_at: nextRunAtEpoch,
          run_count: 0,
          priority: params.priority !== undefined ? params.priority : 1,
        });
      } catch (schedErr) {
        // Non-fatal: task was created, just the scheduler event failed
        console.error("[ofiere] Failed to auto-create scheduler event:", schedErr);
      }
    }

    const extras = [];
    if (cf.execution_plan) extras.push(`${(cf.execution_plan as any[]).length} execution steps`);
    if (cf.goals) extras.push(`${(cf.goals as any[]).length} goals`);
    if (cf.constraints) extras.push(`${(cf.constraints as any[]).length} constraints`);
    if (cf.system_prompt) extras.push("custom system prompt");
    if (startDate) extras.push(`scheduled for ${startDate}`);
    const extrasStr = extras.length > 0 ? ` with ${extras.join(", ")}` : "";

    return ok({
      id,
      message: `Task "${params.title}" created and assigned to ${assignee || "no one"}${extrasStr}`,
      task: insertData,
      scheduledExecution: startDate ? `Will auto-execute on ${startDate}` : undefined,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleUpdateTask(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.task_id) return err("Missing required field: task_id");

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    const fields = [
      "title", "description", "status", "priority", "progress",
      "agent_id", "start_date", "due_date", "tags",
    ];
    for (const f of fields) {
      if (params[f] !== undefined) updates[f] = params[f];
    }
    if (params.status === "DONE") updates.completed_at = new Date().toISOString();

    // Handle custom_fields updates (execution_plan, goals, constraints, system_prompt, instructions)
    const hasCustomFields = params.execution_plan !== undefined ||
      params.goals !== undefined ||
      params.constraints !== undefined ||
      params.system_prompt !== undefined ||
      params.instructions !== undefined;

    if (hasCustomFields) {
      // Fetch existing custom_fields to merge
      const { data: existing } = await supabase
        .from("tasks")
        .select("custom_fields")
        .eq("id", params.task_id as string)
        .eq("user_id", userId)
        .single();

      const existingCf = (existing?.custom_fields || {}) as Record<string, any>;
      const mergedCf = { ...existingCf };

      if (params.execution_plan !== undefined) {
        mergedCf.execution_plan = Array.isArray(params.execution_plan)
          ? (params.execution_plan as any[]).map((step: any, i: number) => ({
              id: step.id || `step-${Date.now()}-${i}`,
              text: typeof step === "string" ? step : step.text || String(step),
              order: i,
            }))
          : [];
      }

      if (params.goals !== undefined) {
        mergedCf.goals = Array.isArray(params.goals)
          ? (params.goals as any[]).map((g: any, i: number) => ({
              id: g.id || `goal-${Date.now()}-${i}`,
              type: g.type || "custom",
              label: typeof g === "string" ? g : g.label || String(g),
            }))
          : [];
      }

      if (params.constraints !== undefined) {
        mergedCf.constraints = Array.isArray(params.constraints)
          ? (params.constraints as any[]).map((c: any, i: number) => ({
              id: c.id || `cstr-${Date.now()}-${i}`,
              type: c.type || "custom",
              label: typeof c === "string" ? c : c.label || String(c),
            }))
          : [];
      }

      if (params.system_prompt !== undefined) mergedCf.system_prompt = params.system_prompt;
      if (params.instructions !== undefined) mergedCf.instructions = params.instructions;

      updates.custom_fields = mergedCf;
    }

    const { data, error } = await supabase
      .from("tasks")
      .update(updates)
      .eq("id", params.task_id as string)
      .eq("user_id", userId)
      .select("id, title, status, priority, agent_id, start_date, due_date, progress, updated_at")
      .single();

    if (error) return err(error.message);
    return ok({ message: `Task "${data?.title}" updated`, task: data });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

async function handleDeleteTask(
  supabase: SupabaseClient,
  userId: string,
  params: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    if (!params.task_id) return err("Missing required field: task_id");
    const taskId = params.task_id as string;

    await supabase.from("scheduler_events").delete().eq("task_id", taskId);

    const { data: subtasks } = await supabase
      .from("tasks")
      .select("id")
      .eq("parent_task_id", taskId)
      .eq("user_id", userId);

    if (subtasks && subtasks.length > 0) {
      for (const sub of subtasks) {
        await supabase.from("scheduler_events").delete().eq("task_id", sub.id);
      }
      await supabase
        .from("tasks")
        .delete()
        .in("id", subtasks.map((s: { id: string }) => s.id))
        .eq("user_id", userId);
    }

    const { error } = await supabase
      .from("tasks")
      .delete()
      .eq("id", taskId)
      .eq("user_id", userId);

    if (error) return err(error.message);
    return ok({ message: `Task ${taskId} deleted`, deleted: true });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 2: OFIERE_AGENT_OPS — Agent Management
// ═══════════════════════════════════════════════════════════════════════════════

function registerAgentOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
): void {
  api.registerTool({
    name: "OFIERE_AGENT_OPS",
    label: "Ofiere Agent Operations",
    description:
      `Query agents in the Ofiere PM system.\n\n` +
      `Actions:\n` +
      `- "list": List all available agents with their IDs, names, roles, and status. Use this to find the correct agent_id for task assignment.`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list"],
        },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      switch (action) {
        case "list":
          return handleListAgents(api, supabase, userId, fallbackAgentId);
        default:
          return err(`Unknown action "${action}". Valid actions: list`);
      }
    },
  });
}

async function handleListAgents(
  api: any,
  supabase: SupabaseClient,
  userId: string,
  fallbackAgentId: string,
): Promise<ToolResult> {
  try {
    // Resolve calling agent's ID for the "your_agent_id" hint
    const callerName = getCallingAgentName(api);
    let yourAgentId = fallbackAgentId || "";
    if (callerName && !yourAgentId) {
      try {
        yourAgentId = await resolveAgentId(callerName, userId, supabase);
      } catch { /* ignore */ }
    }

    const { data, error } = await supabase
      .from("agents")
      .select("id, name, codename, role, status")
      .eq("user_id", userId)
      .order("name");

    if (error) return err(error.message);
    return ok({
      agents: data || [],
      count: (data || []).length,
      your_agent_id: yourAgentId,
    });
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 3: OFIERE_PROJECT_OPS — Spaces, Folders & Dependencies
// ═══════════════════════════════════════════════════════════════════════════════

function registerProjectOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_PROJECT_OPS",
    label: "Ofiere Project Operations",
    description:
      `Manage PM hierarchy: spaces, folders, and task dependencies.\n\n` +
      `Actions:\n` +
      `- "list_spaces": List all PM spaces\n` +
      `- "create_space": Create a space. Required: name. Optional: description, icon, icon_color\n` +
      `- "update_space": Update a space. Required: id. Optional: name, description, icon, icon_color, sort_order\n` +
      `- "delete_space": Delete a space. Required: id\n` +
      `- "list_folders": List folders. Optional: space_id to filter\n` +
      `- "create_folder": Create. Required: name, space_id. Optional: parent_folder_id, folder_type\n` +
      `- "update_folder": Update. Required: id. Optional: name, space_id, parent_folder_id, sort_order\n` +
      `- "delete_folder": Delete. Required: id\n` +
      `- "list_dependencies": List task dependencies. Optional: task_id\n` +
      `- "add_dependency": Link tasks. Required: predecessor_id, successor_id. Optional: dependency_type, lag_days\n` +
      `- "remove_dependency": Unlink. Required: dependency_id\n` +
      `dependency_type: finish_to_start (default), start_to_start, finish_to_finish, start_to_finish`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: {
          type: "string",
          description: "The operation to perform",
          enum: ["list_spaces", "create_space", "update_space", "delete_space",
                 "list_folders", "create_folder", "update_folder", "delete_folder",
                 "list_dependencies", "add_dependency", "remove_dependency"],
        },
        id: { type: "string", description: "Space, folder, or dependency ID" },
        name: { type: "string", description: "Name for space/folder" },
        description: { type: "string", description: "Description" },
        icon: { type: "string", description: "Emoji icon for space" },
        icon_color: { type: "string", description: "Hex color for space icon" },
        space_id: { type: "string", description: "Parent space ID" },
        parent_folder_id: { type: "string", description: "Parent folder ID for nesting" },
        folder_type: { type: "string", enum: ["folder", "project"], description: "Folder type" },
        sort_order: { type: "number", description: "Sort order" },
        predecessor_id: { type: "string", description: "Task that must complete first" },
        successor_id: { type: "string", description: "Task that depends on predecessor" },
        dependency_type: {
          type: "string",
          enum: ["finish_to_start", "start_to_start", "finish_to_finish", "start_to_finish"],
          description: "Type of dependency link",
        },
        lag_days: { type: "number", description: "Days of lag between tasks (default 0)" },
        task_id: { type: "string", description: "Filter dependencies by task ID" },
        dependency_id: { type: "string", description: "Dependency ID to remove" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        // ── Spaces ──
        case "list_spaces": {
          const { data, error } = await supabase.from("pm_spaces").select("*").eq("user_id", userId).order("sort_order");
          if (error) return err(error.message);
          return ok({ spaces: data || [], count: (data || []).length });
        }
        case "create_space": {
          if (!params.name) return err("Missing required: name");
          const { data, error } = await supabase.from("pm_spaces").insert({
            user_id: userId,
            name: params.name,
            description: (params.description as string) || "",
            icon: (params.icon as string) || "📁",
            icon_color: (params.icon_color as string) || "#FF6D29",
            access_type: "private",
            sort_order: (params.sort_order as number) || 0,
          }).select().single();
          if (error) return err(error.message);
          return ok({ message: `Space "${params.name}" created`, space: data });
        }
        case "update_space": {
          if (!params.id) return err("Missing required: id");
          const upd: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const f of ["name", "description", "icon", "icon_color", "sort_order"]) {
            if ((params as any)[f] !== undefined) upd[f] = (params as any)[f];
          }
          const { error } = await supabase.from("pm_spaces").update(upd).eq("id", params.id).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Space updated", ok: true });
        }
        case "delete_space": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("pm_spaces").delete().eq("id", params.id).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Space deleted", ok: true });
        }
        // ── Folders ──
        case "list_folders": {
          let q = supabase.from("pm_folders").select("*").eq("user_id", userId).order("sort_order");
          if (params.space_id) q = q.eq("space_id", params.space_id as string);
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ folders: data || [], count: (data || []).length });
        }
        case "create_folder": {
          if (!params.name || !params.space_id) return err("Missing required: name, space_id");
          const { data, error } = await supabase.from("pm_folders").insert({
            user_id: userId,
            space_id: params.space_id,
            parent_folder_id: (params.parent_folder_id as string) || null,
            name: params.name,
            description: "",
            folder_type: (params.folder_type as string) || "folder",
            sort_order: (params.sort_order as number) || 0,
          }).select().single();
          if (error) return err(error.message);
          return ok({ message: `Folder "${params.name}" created`, folder: data });
        }
        case "update_folder": {
          if (!params.id) return err("Missing required: id");
          const upd: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const f of ["name", "description", "space_id", "parent_folder_id", "folder_type", "sort_order"]) {
            if ((params as any)[f] !== undefined) upd[f] = (params as any)[f];
          }
          const { error } = await supabase.from("pm_folders").update(upd).eq("id", params.id).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Folder updated", ok: true });
        }
        case "delete_folder": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("pm_folders").delete().eq("id", params.id).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Folder deleted", ok: true });
        }
        // ── Dependencies ──
        case "list_dependencies": {
          let q = supabase.from("pm_dependencies").select("*").eq("user_id", userId);
          if (params.task_id) {
            q = supabase.from("pm_dependencies").select("*").eq("user_id", userId)
              .or(`predecessor_id.eq.${params.task_id},successor_id.eq.${params.task_id}`);
          }
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ dependencies: data || [], count: (data || []).length });
        }
        case "add_dependency": {
          if (!params.predecessor_id || !params.successor_id) return err("Missing required: predecessor_id, successor_id");
          const { data, error } = await supabase.from("pm_dependencies").insert({
            user_id: userId,
            predecessor_id: params.predecessor_id,
            successor_id: params.successor_id,
            dependency_type: (params.dependency_type as string) || "finish_to_start",
            lag_days: (params.lag_days as number) || 0,
          }).select().single();
          if (error) return err(error.message);
          return ok({ message: "Dependency created", dependency: data });
        }
        case "remove_dependency": {
          const depId = (params.dependency_id || params.id) as string;
          if (!depId) return err("Missing required: dependency_id");
          const { error } = await supabase.from("pm_dependencies").delete().eq("id", depId).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Dependency removed", ok: true });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 4: OFIERE_SCHEDULE_OPS — Calendar & Scheduler Events
// ═══════════════════════════════════════════════════════════════════════════════

function registerScheduleOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_SCHEDULE_OPS",
    label: "Ofiere Schedule Operations",
    description:
      `Manage calendar events and schedule tasks on the timeline.\n\n` +
      `Actions:\n` +
      `- "list": List events. Optional: start_date, end_date, agent_id\n` +
      `- "create": Schedule an event. Required: title, scheduled_date. Optional: task_id, agent_id, scheduled_time, duration_minutes, recurrence_type, recurrence_interval, color, priority\n` +
      `- "update": Update event. Required: id. Optional: title, scheduled_date, scheduled_time, duration_minutes, status, recurrence_type\n` +
      `- "delete": Remove event. Required: id\n` +
      `recurrence_type: none, hourly, daily, weekly, monthly\n` +
      `priority: 0=low, 1=medium, 2=high, 3=critical`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list", "create", "update", "delete"] },
        id: { type: "string", description: "Event ID" },
        title: { type: "string", description: "Event title" },
        description: { type: "string" },
        task_id: { type: "string", description: "Link to a task" },
        agent_id: { type: "string", description: "Assigned agent" },
        scheduled_date: { type: "string", description: "Date (YYYY-MM-DD)" },
        scheduled_time: { type: "string", description: "Time (HH:MM)" },
        start_date: { type: "string", description: "List filter: start (YYYY-MM-DD)" },
        end_date: { type: "string", description: "List filter: end (YYYY-MM-DD)" },
        duration_minutes: { type: "number", description: "Duration in minutes (default 30)" },
        recurrence_type: { type: "string", enum: ["none", "hourly", "daily", "weekly", "monthly"] },
        recurrence_interval: { type: "number", description: "Repeat every N periods" },
        color: { type: "string", description: "Hex color" },
        priority: { type: "number", description: "0-3" },
        status: { type: "string", enum: ["scheduled", "completed", "cancelled"] },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        case "list": {
          let q = supabase.from("scheduler_events").select("*").eq("user_id", userId)
            .order("scheduled_date", { ascending: true });
          if (params.start_date) q = q.gte("scheduled_date", params.start_date as string);
          if (params.end_date) q = q.lte("scheduled_date", params.end_date as string);
          if (params.agent_id) q = q.eq("agent_id", params.agent_id as string);
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ events: data || [], count: (data || []).length });
        }
        case "create": {
          if (!params.title || !params.scheduled_date) return err("Missing required: title, scheduled_date");
          const evtId = crypto.randomUUID();
          const priorityMap: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
          const pVal = typeof params.priority === "number" ? params.priority
            : priorityMap[String(params.priority || "").toLowerCase()] ?? 0;
          const insertData: Record<string, any> = {
            id: evtId,
            user_id: userId,
            task_id: (params.task_id as string) || null,
            agent_id: (params.agent_id as string) || null,
            title: params.title,
            description: (params.description as string) || null,
            scheduled_date: params.scheduled_date,
            scheduled_time: (params.scheduled_time as string) || null,
            duration_minutes: (params.duration_minutes as number) || 30,
            recurrence_type: (params.recurrence_type as string) || "none",
            recurrence_interval: (params.recurrence_interval as number) || 1,
            status: "scheduled",
            run_count: 0,
            color: (params.color as string) || null,
            priority: pVal,
          };
          const { error } = await supabase.from("scheduler_events").insert(insertData);
          if (error) return err(error.message);
          return ok({ message: `Event "${params.title}" scheduled for ${params.scheduled_date}`, id: evtId });
        }
        case "update": {
          if (!params.id) return err("Missing required: id");
          const upd: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const f of ["title", "description", "scheduled_date", "scheduled_time", "duration_minutes",
                           "recurrence_type", "recurrence_interval", "status", "color", "priority", "agent_id"]) {
            if ((params as any)[f] !== undefined) upd[f] = (params as any)[f];
          }
          const { error } = await supabase.from("scheduler_events").update(upd).eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Event updated", ok: true });
        }
        case "delete": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("scheduler_events").delete().eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Event deleted", ok: true });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 5: OFIERE_KNOWLEDGE_OPS — Knowledge Base
// ═══════════════════════════════════════════════════════════════════════════════

function registerKnowledgeOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_KNOWLEDGE_OPS",
    label: "Ofiere Knowledge Operations",
    description:
      `Access the Ofiere Knowledge Library — the stored knowledge base in the dashboard. ` +
      `Use this tool whenever the user mentions "knowledge base", "knowledge library", "knowledge entries", or asks to retrieve stored knowledge.\n\n` +
      `Actions:\n` +
      `- "search": Search the knowledge library by keyword. Required: query. Optional: limit\n` +
      `- "list": List recent entries from the knowledge library. Optional: page, page_size, search\n` +
      `- "create": Add a document to the knowledge library. Required: file_name. Optional: content, text, source, source_type, author, credibility_tier\n` +
      `- "update": Edit a document. Required: id. Optional: file_name, content, text, source, source_type, author\n` +
      `- "delete": Remove a document. Required: id`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["search", "list", "create", "update", "delete"] },
        id: { type: "string", description: "Document ID" },
        query: { type: "string", description: "Search query" },
        file_name: { type: "string", description: "Document name" },
        content: { type: "string", description: "Raw content" },
        text: { type: "string", description: "Processed text" },
        source: { type: "string", description: "Source URL or reference" },
        source_type: { type: "string", description: "e.g. web, pdf, manual" },
        author: { type: "string", description: "Author name" },
        credibility_tier: { type: "string", description: "Credibility level" },
        page: { type: "number", description: "Page number (default 1)" },
        page_size: { type: "number", description: "Results per page (default 20)" },
        search: { type: "string", description: "Filter for list action" },
        limit: { type: "number", description: "Max results for search" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        case "search": {
          if (!params.query) return err("Missing required: query");
          const lim = (params.limit as number) || 20;
          const searchTerm = `%${params.query}%`;
          const { data, error } = await supabase
            .from("knowledge_documents")
            .select("id, file_name, file_type, content, source, source_type, author, credibility_tier")
            .or(`file_name.ilike.${searchTerm},content.ilike.${searchTerm},author.ilike.${searchTerm},source.ilike.${searchTerm}`)
            .order("created_at", { ascending: false })
            .limit(lim);
          if (error) return err(error.message);
          return ok({ documents: data || [], count: (data || []).length, query: params.query });
        }
        case "list": {
          const page = Math.max(1, (params.page as number) || 1);
          const pageSize = Math.min(100, Math.max(1, (params.page_size as number) || 20));
          const from = (page - 1) * pageSize;
          const to = from + pageSize - 1;
          let q = supabase.from("knowledge_documents")
            .select("id, file_name, file_type, content, text, source, source_type, author, credibility_tier, created_at", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(from, to);
          if (params.search) {
            const s = `%${params.search}%`;
            q = q.or(`file_name.ilike.${s},content.ilike.${s},author.ilike.${s}`);
          }
          const { data, count, error } = await q;
          if (error) return err(error.message);
          return ok({ documents: data || [], total: count || 0, page, page_size: pageSize });
        }
        case "create": {
          if (!params.file_name) return err("Missing required: file_name");
          const docId = crypto.randomUUID();
          const { error } = await supabase.from("knowledge_documents").insert({
            id: docId,
            user_id: userId,
            file_name: params.file_name,
            file_type: (params.file_type as string) || null,
            content: (params.content as string) || null,
            text: (params.text as string) || null,
            source: (params.source as string) || null,
            source_type: (params.source_type as string) || null,
            author: (params.author as string) || null,
            credibility_tier: (params.credibility_tier as string) || null,
            size_bytes: params.content ? new TextEncoder().encode(params.content as string).length : 0,
            indexed: false,
          });
          if (error) return err(error.message);
          return ok({ message: `Knowledge doc "${params.file_name}" created`, id: docId });
        }
        case "update": {
          if (!params.id) return err("Missing required: id");
          const allowed = ["file_name", "file_type", "content", "text", "source", "source_type", "author", "credibility_tier"];
          const upd: Record<string, any> = {};
          for (const k of allowed) if ((params as any)[k] !== undefined) upd[k] = (params as any)[k];
          if (Object.keys(upd).length === 0) return err("No valid fields to update");
          const { error } = await supabase.from("knowledge_documents").update(upd).eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Document updated", ok: true });
        }
        case "delete": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("knowledge_documents").delete().eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Document deleted", ok: true });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 6: OFIERE_WORKFLOW_OPS — Workflow Management & Execution
// ═══════════════════════════════════════════════════════════════════════════════

function registerWorkflowOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_WORKFLOW_OPS",
    label: "Ofiere Workflow Operations",
    description:
      `Manage, build, and trigger automated workflows in the Ofiere dashboard.\n\n` +
      `Actions:\n` +
      `- "list": List all workflows. Optional: status\n` +
      `- "get": Get workflow details. Required: id\n` +
      `- "create": Create a workflow WITH nodes and edges. Required: name. Optional: description, nodes, edges, schedule, status\n` +
      `- "update": Update a workflow. Required: id. Optional: name, description, status, nodes, edges, schedule\n` +
      `- "delete": Delete a workflow and its run history. Required: id\n` +
      `- "list_runs": List recent runs. Required: workflow_id. Optional: limit\n` +
      `- "trigger": Start a workflow run. Required: workflow_id\n\n` +
      `NODE TYPES (use these exact types when creating nodes):\n` +
      `  TRIGGERS (start of workflow — pick one):\n` +
      `    - "manual_trigger": User clicks Execute to start\n` +
      `    - "webhook_trigger": External HTTP request triggers it\n` +
      `    - "schedule_trigger": Runs on cron schedule. data: { label, cron: "0 9 * * 1-5" }\n` +
      `  STEPS (the work):\n` +
      `    - "agent_step": Delegates task to an AI agent. data: { label, agentId, task, responseMode: "text", timeoutSec: 120 }\n` +
      `    - "http_request": Calls an external API. data: { label, method: "GET"|"POST", url }\n` +
      `    - "formatter_step": Formats/transforms text or JSON. data: { label, template }\n` +
      `    - "task_call": Runs a saved task. data: { label, agentId, taskId }\n` +
      `    - "variable_set": Stores data in a variable. data: { label, variableName, variableValue }\n` +
      `  CONTROL FLOW:\n` +
      `    - "condition": If/else branch. data: { label, expression }\n` +
      `    - "human_approval": Pauses for human approval. data: { label, instructions }\n` +
      `    - "delay": Waits for a set time. data: { label, delaySec: 5 }\n` +
      `    - "loop": Repeats actions. data: { label, loopType: "count", maxIterations: 3 }\n` +
      `    - "convergence": Waits for multiple parallel inputs. data: { label, mergeStrategy: "wait_all" }\n` +
      `  END:\n` +
      `    - "output": Returns final result. data: { label, outputMode: "return" }\n` +
      `  SPECIAL:\n` +
      `    - "checkpoint": Loop target marker. data: { label }\n` +
      `    - "note": Sticky note annotation. data: { label, noteText }\n\n` +
      `Each node: { type, data: { label, ... }, position?: { x, y } }. IDs and positions are auto-generated if omitted.\n` +
      `Each edge: { source: "node_id", target: "node_id" }. IDs auto-generated.\n` +
      `A manual_trigger node is always auto-prepended if no trigger node is included.`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list", "get", "create", "update", "delete", "list_runs", "trigger"] },
        id: { type: "string", description: "Workflow ID" },
        workflow_id: { type: "string", description: "Workflow ID for runs/trigger" },
        name: { type: "string", description: "Workflow name" },
        description: { type: "string" },
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Node ID (auto-generated if omitted)" },
              type: { type: "string", enum: ["manual_trigger", "webhook_trigger", "schedule_trigger", "agent_step", "formatter_step", "http_request", "task_call", "variable_set", "condition", "human_approval", "delay", "loop", "convergence", "output", "checkpoint", "note"] },
              position: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
              data: { type: "object", description: "Node config — always include a 'label' field. See NODE TYPES above for type-specific fields." },
            },
          },
          description: "Workflow graph nodes",
        },
        edges: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Edge ID (auto-generated if omitted)" },
              source: { type: "string", description: "Source node ID" },
              target: { type: "string", description: "Target node ID" },
            },
          },
          description: "Connections between nodes. Each edge: { source, target }",
        },
        steps: { type: "array", items: { type: "object" }, description: "Legacy V1 step definitions" },
        schedule: { type: "string", description: "Cron expression or schedule" },
        status: { type: "string", enum: ["draft", "active", "paused", "archived"] },
        limit: { type: "number", description: "Max results" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;

      // Default data for each node type — ensures dashboard renders them properly
      const NODE_DEFAULTS: Record<string, Record<string, any>> = {
        manual_trigger: { label: "Execute Trigger" },
        webhook_trigger: { label: "Webhook Trigger" },
        schedule_trigger: { label: "Schedule Trigger", cron: "0 9 * * 1-5" },
        agent_step: { label: "Agent Step", agentId: "", task: "", responseMode: "text", timeoutSec: 120 },
        formatter_step: { label: "Formatter", template: "" },
        http_request: { label: "HTTP Request", method: "GET", url: "" },
        task_call: { label: "Task", agentId: "", taskId: "", taskTitle: "", agentName: "" },
        variable_set: { label: "Set Variable", variableName: "", variableValue: "" },
        condition: { label: "Condition", expression: "" },
        human_approval: { label: "Human Approval", instructions: "" },
        delay: { label: "Delay", delaySec: 5 },
        loop: { label: "Loop", loopType: "count", maxIterations: 3 },
        convergence: { label: "Convergence", mergeStrategy: "wait_all" },
        output: { label: "Output", outputMode: "return" },
        checkpoint: { label: "Checkpoint" },
        note: { label: "Note", noteText: "" },
      };

      // Valid node types
      const VALID_TYPES = new Set(Object.keys(NODE_DEFAULTS));

      // Helper: normalize a single node with defaults and auto-ID
      function normalizeNode(n: any, i: number) {
        let type = n.type || "agent_step";
        if (!VALID_TYPES.has(type)) type = "agent_step"; // fallback invalid types
        const defaults = NODE_DEFAULTS[type] || {};
        return {
          id: n.id || `${type}-${Date.now()}-${i}`,
          type,
          position: n.position || { x: 250, y: 80 + i * 150 },
          data: { ...defaults, ...(n.data || {}), label: n.data?.label || defaults.label || type },
        };
      }

      switch (action) {
        case "list": {
          let q = supabase.from("workflows").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
          if (params.status) q = q.eq("status", params.status as string);
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ workflows: data || [], count: (data || []).length });
        }
        case "get": {
          const wfId = (params.id || params.workflow_id) as string;
          if (!wfId) return err("Missing required: id");
          const { data, error } = await supabase.from("workflows").select("*").eq("id", wfId).eq("user_id", userId).single();
          if (error) return err(error.message);
          return ok({ workflow: data });
        }
        case "create": {
          if (!params.name) return err("Missing required: name");
          const wfId = crypto.randomUUID();
          const stepsWithIds = ((params.steps as any[]) || []).map((s: any, i: number) => ({
            ...s, id: s.id || `step-${i}`,
          }));

          // Build nodes — normalize provided nodes
          let rawNodes = (params.nodes as any[]) || [];
          let finalNodes = rawNodes.map((n, i) => normalizeNode(n, i));

          // Auto-prepend a trigger node if none is present
          const hasTrigger = finalNodes.some(n => n.type.includes("trigger"));
          if (!hasTrigger) {
            const triggerNode = {
              id: `manual_trigger-${Date.now()}`,
              type: "manual_trigger",
              position: { x: 100, y: 200 },
              data: { label: "Execute Trigger" },
            };
            // Shift all other nodes to the right
            finalNodes = finalNodes.map(n => ({
              ...n,
              position: { x: (n.position?.x || 250) + 200, y: n.position?.y || 200 },
            }));
            finalNodes.unshift(triggerNode);
          }

          // Build edges — ensure IDs exist
          let finalEdges = (params.edges as any[]) || [];
          finalEdges = finalEdges.map((e: any, i: number) => ({
            id: e.id || `edge-${Date.now()}-${i}`,
            source: e.source,
            target: e.target,
            ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
            ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
          }));

          // Auto-wire trigger to first non-trigger node if no edge connects from trigger
          if (hasTrigger === false && finalNodes.length > 1 && finalEdges.length === 0) {
            // No edges at all — auto-connect trigger → first step
          } else if (hasTrigger === false && finalNodes.length > 1) {
            const triggerId = finalNodes[0].id;
            const firstStepId = finalNodes[1].id;
            const triggerHasEdge = finalEdges.some(e => e.source === triggerId);
            if (!triggerHasEdge) {
              finalEdges.unshift({
                id: `edge-trigger-${Date.now()}`,
                source: triggerId,
                target: firstStepId,
              });
            }
          }

          const { data, error } = await supabase.from("workflows").insert({
            id: wfId, user_id: userId,
            name: params.name,
            description: (params.description as string) || null,
            steps: stepsWithIds,
            schedule: (params.schedule as string) || null,
            status: (params.status as string) || "draft",
            nodes: finalNodes,
            edges: finalEdges,
            definition_version: 2,
          }).select().single();
          if (error) return err(error.message);
          return ok({
            message: `Workflow "${params.name}" created with ${finalNodes.length} node(s) and ${finalEdges.length} edge(s)`,
            workflow: data,
          });
        }
        case "update": {
          const wfId = (params.id || params.workflow_id) as string;
          if (!wfId) return err("Missing required: id");
          const upd: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const f of ["name", "description", "status", "steps", "schedule", "nodes", "edges"]) {
            if ((params as any)[f] !== undefined) upd[f] = (params as any)[f];
          }
          // Normalize nodes using the same defaults as create
          if (upd.nodes && Array.isArray(upd.nodes)) {
            upd.nodes = upd.nodes.map((n: any, i: number) => normalizeNode(n, i));
          }
          if (upd.edges && Array.isArray(upd.edges)) {
            upd.edges = upd.edges.map((e: any, i: number) => ({
              id: e.id || `edge-${Date.now()}-${i}`,
              source: e.source,
              target: e.target,
            }));
          }
          const { data, error } = await supabase.from("workflows").update(upd).eq("id", wfId).eq("user_id", userId).select().single();
          if (error) return err(error.message);
          return ok({ message: "Workflow updated", workflow: data });
        }
        case "delete": {
          const wfId = (params.id || params.workflow_id) as string;
          if (!wfId) return err("Missing required: id");
          // Delete associated runs first
          await supabase.from("workflow_runs").delete().eq("workflow_id", wfId);
          const { error } = await supabase.from("workflows").delete().eq("id", wfId).eq("user_id", userId);
          if (error) return err(error.message);
          return ok({ message: "Workflow and associated runs deleted", ok: true });
        }
        case "list_runs": {
          const wfId = (params.workflow_id || params.id) as string;
          if (!wfId) return err("Missing required: workflow_id");
          const { data, error } = await supabase.from("workflow_runs").select("*")
            .eq("workflow_id", wfId)
            .order("created_at", { ascending: false })
            .limit((params.limit as number) || 20);
          if (error) return err(error.message);
          return ok({ runs: data || [], count: (data || []).length });
        }
        case "trigger": {
          const wfId = (params.workflow_id || params.id) as string;
          if (!wfId) return err("Missing required: workflow_id");
          const runId = crypto.randomUUID();
          const { error } = await supabase.from("workflow_runs").insert({
            id: runId,
            workflow_id: wfId,
            status: "running",
            started_at: new Date().toISOString(),
            trigger_type: "agent",
          });
          if (error) return err(error.message);
          return ok({ message: `Workflow run triggered`, run_id: runId, workflow_id: wfId });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 7: OFIERE_NOTIFY_OPS — Notifications
// ═══════════════════════════════════════════════════════════════════════════════

function registerNotifyOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_NOTIFY_OPS",
    label: "Ofiere Notification Operations",
    description:
      `Read and manage notifications.\n\n` +
      `Actions:\n` +
      `- "list": List notifications. Optional: unread_only (true/false), limit\n` +
      `- "mark_read": Mark one as read. Required: id\n` +
      `- "mark_all_read": Mark all as read\n` +
      `- "delete": Delete a notification. Required: id`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list", "mark_read", "mark_all_read", "delete"] },
        id: { type: "string", description: "Notification ID" },
        unread_only: { type: "boolean", description: "Only show unread" },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        case "list": {
          let q = supabase.from("notifications").select("*")
            .order("created_at", { ascending: false })
            .limit((params.limit as number) || 50);
          if (params.unread_only === true) q = q.eq("read", false);
          const { data, error } = await q;
          if (error) return err(error.message);
          const unread = (data || []).filter((n: any) => !n.read).length;
          return ok({ notifications: data || [], count: (data || []).length, unread_count: unread });
        }
        case "mark_read": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("notifications").update({ read: true }).eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Notification marked as read", ok: true });
        }
        case "mark_all_read": {
          const { error } = await supabase.from("notifications").update({ read: true }).eq("read", false);
          if (error) return err(error.message);
          return ok({ message: "All notifications marked as read", ok: true });
        }
        case "delete": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("notifications").delete().eq("id", params.id);
          if (error) return err(error.message);
          return ok({ message: "Notification deleted", ok: true });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 8: OFIERE_MEMORY_OPS — Conversations & Knowledge Fragments
// ═══════════════════════════════════════════════════════════════════════════════

function registerMemoryOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_MEMORY_OPS",
    label: "Ofiere Memory Operations",
    description:
      `Access conversation history and knowledge memory.\n\n` +
      `Actions:\n` +
      `- "list_conversations": List recent conversations. Optional: agent_id, limit\n` +
      `- "get_messages": Get messages from a conversation. Required: conversation_id. Optional: limit\n` +
      `- "search_messages": Search all messages. Required: query. Optional: agent_id, limit\n` +
      `- "add_knowledge": Store a knowledge fragment. Required: agent_id, content, source. Optional: tags, importance\n` +
      `- "search_knowledge": Search knowledge. Required: agent_id, query. Optional: limit`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list_conversations", "get_messages", "search_messages", "add_knowledge", "search_knowledge"] },
        conversation_id: { type: "string" },
        agent_id: { type: "string" },
        query: { type: "string", description: "Search query" },
        content: { type: "string", description: "Knowledge content to store" },
        source: { type: "string", description: "Source of knowledge" },
        tags: { type: "array", items: { type: "string" } },
        importance: { type: "number", description: "1-10 importance scale" },
        limit: { type: "number", description: "Max results" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        case "list_conversations": {
          let q = supabase.from("conversations")
            .select("id, agent_id, title, created_at, updated_at")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false })
            .limit((params.limit as number) || 20);
          if (params.agent_id) q = q.eq("agent_id", params.agent_id as string);
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ conversations: data || [], count: (data || []).length });
        }
        case "get_messages": {
          if (!params.conversation_id) return err("Missing required: conversation_id");
          const { data, error } = await supabase.from("conversation_messages")
            .select("id, role, content, created_at")
            .eq("conversation_id", params.conversation_id as string)
            .order("created_at", { ascending: true })
            .limit((params.limit as number) || 100);
          if (error) return err(error.message);
          return ok({ messages: data || [], count: (data || []).length });
        }
        case "search_messages": {
          if (!params.query) return err("Missing required: query");
          const searchTerm = `%${params.query}%`;
          let q = supabase.from("conversation_messages")
            .select("id, conversation_id, role, content, created_at")
            .ilike("content", searchTerm)
            .order("created_at", { ascending: false })
            .limit((params.limit as number) || 20);
          const { data, error } = await q;
          if (error) return err(error.message);
          return ok({ messages: data || [], count: (data || []).length, query: params.query });
        }
        case "add_knowledge": {
          if (!params.agent_id || !params.content || !params.source) return err("Missing required: agent_id, content, source");
          const fragId = crypto.randomUUID();
          const { error } = await supabase.from("knowledge_fragments").insert({
            id: fragId,
            agent_id: params.agent_id,
            content: params.content,
            source: params.source,
            tags: (params.tags as string[]) || [],
            importance: (params.importance as number) || 5,
          });
          if (error) return err(error.message);
          return ok({ message: "Knowledge stored", id: fragId });
        }
        case "search_knowledge": {
          if (!params.agent_id || !params.query) return err("Missing required: agent_id, query");
          const searchTerm = `%${params.query}%`;
          const { data, error } = await supabase.from("knowledge_fragments")
            .select("id, content, source, tags, importance, created_at")
            .eq("agent_id", params.agent_id as string)
            .ilike("content", searchTerm)
            .order("importance", { ascending: false })
            .limit((params.limit as number) || 20);
          if (error) return err(error.message);
          return ok({ fragments: data || [], count: (data || []).length });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// META-TOOL 9: OFIERE_PROMPT_OPS — System Prompt Chunk Management
// ═══════════════════════════════════════════════════════════════════════════════

function registerPromptOps(
  api: any,
  supabase: SupabaseClient,
  userId: string,
): void {
  api.registerTool({
    name: "OFIERE_PROMPT_OPS",
    label: "Ofiere Prompt Operations",
    description:
      `Manage system prompt instruction chunks. These are the building blocks of agent behavior.\n\n` +
      `Actions:\n` +
      `- "list": List all prompt chunks\n` +
      `- "get": Get a specific chunk. Required: id\n` +
      `- "create": Create a new chunk. Required: name, content. Optional: color (hex), category\n` +
      `- "update": Update a chunk. Required: id. Optional: name, content, color, category, order\n` +
      `- "delete": Delete a chunk. Required: id`,
    parameters: {
      type: "object",
      required: ["action"],
      properties: {
        action: { type: "string", enum: ["list", "get", "create", "update", "delete"] },
        id: { type: "string", description: "Chunk ID" },
        name: { type: "string", description: "Chunk name/label (max 30 chars)" },
        content: { type: "string", description: "Prompt chunk content text" },
        color: { type: "string", description: "Hex color for display (e.g. #6B7280)" },
        category: { type: "string", description: "Category grouping (e.g. Personality, Instructions)" },
        order: { type: "number", description: "Display order (0-based)" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      const action = params.action as string;
      switch (action) {
        case "list": {
          const { data, error } = await supabase.from("prompt_chunks").select("*").eq("user_id", userId).order("order", { ascending: true });
          if (error) return err(error.message);
          return ok({ chunks: data || [], count: (data || []).length });
        }
        case "get": {
          if (!params.id) return err("Missing required: id");
          const { data, error } = await supabase.from("prompt_chunks").select("*").eq("id", params.id).eq("user_id", userId).single();
          if (error) return err(error.message);
          return ok({ chunk: data });
        }
        case "create": {
          if (!params.name || !params.content) return err("Missing required: name, content");
          const chunkName = String(params.name).slice(0, 30);
          const chunkId = crypto.randomUUID();

          // Get current max order to append at end
          const { data: existing } = await supabase
            .from("prompt_chunks")
            .select("order")
            .eq("user_id", userId);
          const maxOrder = existing && existing.length > 0
            ? Math.max(...existing.map((c: any) => c.order ?? 0))
            : -1;

          const { data, error } = await supabase.from("prompt_chunks").insert({
            id: chunkId,
            user_id: userId,
            name: chunkName,
            content: params.content,
            color: (params.color as string) || "#6B7280",
            category: (params.category as string) || "Uncategorized",
            order: (params.order as number) ?? maxOrder + 1,
          }).select().single();
          if (error) return err(error.message);
          api.logger?.info?.(`[ofiere] Prompt chunk created: "${chunkName}" by agent`);
          return ok({ message: `Prompt chunk "${chunkName}" created`, chunk: data });
        }
        case "update": {
          if (!params.id) return err("Missing required: id");
          const upd: Record<string, any> = { updated_at: new Date().toISOString() };
          for (const f of ["name", "content", "color", "category", "order"]) {
            if ((params as any)[f] !== undefined) upd[f] = (params as any)[f];
          }
          if (upd.name) upd.name = String(upd.name).slice(0, 30);
          const { data, error } = await supabase.from("prompt_chunks").update(upd).eq("id", params.id).eq("user_id", userId).select().single();
          if (error) return err(error.message);
          api.logger?.info?.(`[ofiere] Prompt chunk ${params.id} updated by agent`);
          return ok({ message: "Prompt chunk updated", chunk: data });
        }
        case "delete": {
          if (!params.id) return err("Missing required: id");
          const { error } = await supabase.from("prompt_chunks").delete().eq("id", params.id).eq("user_id", userId);
          if (error) return err(error.message);
          api.logger?.info?.(`[ofiere] Prompt chunk ${params.id} deleted by agent`);
          return ok({ message: "Prompt chunk deleted", ok: true });
        }
        default:
          return err(`Unknown action "${action}".`);
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// Public: Register All Meta-Tools
// ═══════════════════════════════════════════════════════════════════════════════
// This is the single entry point called by index.ts.
// Returns the number of tools registered for dynamic prompt generation.

export function registerTools(
  api: any, // OpenClawPluginApi — typed as any to avoid import-path issues at install time
  supabase: SupabaseClient,
  config: OfiereConfig,
): number {
  const userId = config.userId;
  const fallbackAgentId = config.agentId; // May be empty — that's fine

  const resolveAgent = createAgentResolver(api, supabase, userId, fallbackAgentId);

  // ── Register each domain meta-tool ──
  registerTaskOps(api, supabase, userId, resolveAgent);       // 1
  registerAgentOps(api, supabase, userId, fallbackAgentId);   // 2
  registerProjectOps(api, supabase, userId);                  // 3
  registerScheduleOps(api, supabase, userId);                 // 4
  registerKnowledgeOps(api, supabase, userId);                // 5
  registerWorkflowOps(api, supabase, userId);                 // 6
  registerNotifyOps(api, supabase, userId);                   // 7
  registerMemoryOps(api, supabase, userId);                   // 8
  registerPromptOps(api, supabase, userId);                   // 9

  // ── Count and log ──
  const toolCount = 9;
  const callerName = getCallingAgentName(api);
  const agentLabel = fallbackAgentId || callerName || "auto-detect";
  api.logger.info(`[ofiere] ${toolCount} meta-tools registered (agent: ${agentLabel})`);

  return toolCount;
}
