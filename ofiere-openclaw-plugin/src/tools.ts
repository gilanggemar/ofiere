// src/tools.ts — Tool registration for Ofiere PM plugin
// Uses api.registerTool(tool, opts?) as documented:
//   https://docs.openclaw.ai/plugins/sdk-overview#tools-and-commands
//   https://docs.openclaw.ai/plugins/building-plugins#registering-agent-tools
//
// - Required tools: always available (no opts)
// - Optional tools: { optional: true } — user must allowlist or allowlist the plugin id

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

// ─── Tool Registration ───────────────────────────────────────────────────────

export function registerTools(
  api: any, // OpenClawPluginApi — typed as any to avoid import-path issues at install time
  supabase: SupabaseClient,
  config: OfiereConfig,
): void {
  const userId = config.userId;
  const fallbackAgentId = config.agentId; // May be empty — that's fine

  /**
   * Resolve the agent ID for the calling agent.
   * Priority: explicit param > runtime context > registration-time detection > env var > DB fallback
   */
  async function resolveAgent(explicitId?: string): Promise<string | null> {
    // 1. Explicit agent_id passed by the LLM (e.g. "ivy", "daisy", or a UUID)
    if (explicitId && explicitId.trim()) {
      const trimmed = explicitId.trim();
      // If it looks like a UUID or our ID format, use directly
      if (trimmed.match(/^[0-9a-f]{8}-/) || trimmed.match(/^agent-/)) {
        return trimmed;
      }
      // Otherwise treat as a name and resolve to the actual agent ID
      try {
        return await resolveAgentId(trimmed, userId, supabase);
      } catch {
        return trimmed; // fallback: use as-is
      }
    }

    // 2. Runtime: read calling agent's name from OpenClaw context
    const callerName = getCallingAgentName(api);
    if (callerName) {
      try {
        return await resolveAgentId(callerName, userId, supabase);
      } catch {
        // Fall through
      }
    }

    // 3. Registration-time detection (set when plugin was loaded)
    if (_registrationAgentName) {
      try {
        return await resolveAgentId(_registrationAgentName, userId, supabase);
      } catch {
        // Fall through
      }
    }

    // 4. Env var fallback (OFIERE_AGENT_ID — legacy single-agent mode)
    if (fallbackAgentId) return fallbackAgentId;

    // 5. Nuclear fallback: query the FIRST agent for this user
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
  }

  // ── OFIERE_LIST_TASKS — Required (read-only, no side effects) ────────

  api.registerTool({
    name: "OFIERE_LIST_TASKS",
    label: "List Ofiere Tasks",
    description:
      "List tasks from the Ofiere PM dashboard. " +
      "Optionally filter by space_id, folder_id, agent_id, or status. " +
      "Returns an array of task objects with their details.",
    parameters: {
      type: "object",
      properties: {
        space_id: { type: "string", description: "Filter by PM space ID" },
        folder_id: { type: "string", description: "Filter by PM folder ID" },
        agent_id: { type: "string", description: "Filter by assigned agent ID" },
        status: {
          type: "string",
          description: "Filter by status: PENDING, IN_PROGRESS, DONE, FAILED",
          enum: ["PENDING", "IN_PROGRESS", "DONE", "FAILED"],
        },
        limit: { type: "number", description: "Max results (default 50)" },
      },
    },
    async execute(_id: string, params: Record<string, unknown>) {
      try {
        let query = supabase
          .from("tasks")
          .select(
            "id, title, description, status, priority, agent_id, space_id, folder_id, " +
            "start_date, due_date, progress, created_at, updated_at",
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
        return ok({ tasks: data || [], count: (data || []).length });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  });

  // ── OFIERE_CREATE_TASK — Optional (has side effects: writes to DB) ───

  api.registerTool(
    {
      name: "OFIERE_CREATE_TASK",
      label: "Create Ofiere Task",
      description:
        "Create a new task in the Ofiere PM dashboard. " +
        "IMPORTANT: You MUST always pass your own name as agent_id (e.g. 'ivy', 'daisy') to assign the task to yourself. " +
        "If you want to assign to a different agent, pass their name instead. " +
        "Pass agent_id as 'none' or 'unassigned' to create an unassigned task. " +
        "The task will appear in the dashboard immediately via real-time sync.",
      parameters: {
        type: "object",
        required: ["title", "agent_id"],
        properties: {
          title: { type: "string", description: "Task title (required)" },
          description: { type: "string", description: "Task description" },
          agent_id: {
            type: "string",
            description:
              "REQUIRED. Your own agent name (e.g. 'ivy', 'daisy', 'celia') to self-assign, " +
              "or another agent's name to assign to them. " +
              "Pass 'none' or 'unassigned' to create a task with no assignee.",
          },
          status: {
            type: "string",
            description: "Initial status (default: PENDING)",
            enum: ["PENDING", "IN_PROGRESS", "DONE", "FAILED"],
          },
          priority: {
            type: "number",
            description: "Priority: 0=LOW, 1=MEDIUM, 2=HIGH, 3=CRITICAL (default: 1)",
          },
          space_id: { type: "string", description: "PM Space ID to place the task in" },
          folder_id: { type: "string", description: "PM Folder ID to place the task in" },
          start_date: { type: "string", description: "Start date (ISO 8601 format)" },
          due_date: { type: "string", description: "Due date (ISO 8601 format)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for the task",
          },
        },
      },
      async execute(_id: string, params: Record<string, unknown>) {
        try {
          if (!params.title) return err("Missing required field: title");

          const id = `task-${Date.now()}`;
          const now = new Date().toISOString();

          // Handle explicit "none"/"unassigned"
          const rawAgentId = params.agent_id as string | undefined;
          const isUnassigned =
            rawAgentId &&
            ["none", "unassigned", "null", ""].includes(rawAgentId.toLowerCase().trim());

          const assignee = isUnassigned ? null : await resolveAgent(rawAgentId);

          const insertData: Record<string, unknown> = {
            id,
            user_id: userId,
            title: params.title,
            description: (params.description as string) || null,
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
            custom_fields: {},
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

          return ok({
            id,
            message: `Task "${params.title}" created and assigned to ${assignee || "no one"}`,
            task: insertData,
          });
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      },
    },
  );

  // ── OFIERE_UPDATE_TASK — Optional (has side effects) ─────────────────

  api.registerTool(
    {
      name: "OFIERE_UPDATE_TASK",
      label: "Update Ofiere Task",
      description:
        "Update an existing task in the Ofiere PM dashboard. Only provided fields are changed. " +
        "Changes appear in the dashboard immediately via real-time sync.",
      parameters: {
        type: "object",
        required: ["task_id"],
        properties: {
          task_id: { type: "string", description: "The task ID to update (required)" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          status: {
            type: "string",
            description: "New status",
            enum: ["PENDING", "IN_PROGRESS", "DONE", "FAILED"],
          },
          priority: { type: "number", description: "New priority (0-3)" },
          progress: { type: "number", description: "Progress percentage (0-100)" },
          agent_id: { type: "string", description: "Reassign to a different agent" },
          start_date: { type: "string", description: "New start date (ISO 8601)" },
          due_date: { type: "string", description: "New due date (ISO 8601)" },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "New tags",
          },
        },
      },
      async execute(_id: string, params: Record<string, unknown>) {
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

          const { data, error } = await supabase
            .from("tasks")
            .update(updates)
            .eq("id", params.task_id as string)
            .eq("user_id", userId)
            .select("id, title, status, priority, agent_id")
            .single();

          if (error) return err(error.message);
          return ok({ message: `Task "${data?.title}" updated`, task: data });
        } catch (e) {
          return err(e instanceof Error ? e.message : String(e));
        }
      },
    },
  );

  // ── OFIERE_DELETE_TASK — Optional (destructive side effect) ──────────

  api.registerTool(
    {
      name: "OFIERE_DELETE_TASK",
      label: "Delete Ofiere Task",
      description:
        "Delete a task from the Ofiere PM dashboard. Also removes subtasks and linked scheduler events.",
      parameters: {
        type: "object",
        required: ["task_id"],
        properties: {
          task_id: { type: "string", description: "The task ID to delete (required)" },
        },
      },
      async execute(_id: string, params: Record<string, unknown>) {
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
      },
    },
  );

  // ── OFIERE_LIST_AGENTS — Required (read-only, no side effects) ───────

  api.registerTool({
    name: "OFIERE_LIST_AGENTS",
    label: "List Ofiere Agents",
    description:
      "List all available agents in the Ofiere system. " +
      "Shows agent IDs, names, roles, and current status. " +
      "Use this to find the right agent_id for task assignment.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute(_id: string, _params: Record<string, unknown>) {
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
    },
  });

  const callerName = getCallingAgentName(api);
  const agentLabel = fallbackAgentId || callerName || "auto-detect";
  api.logger.info(`[ofiere] 5 tools registered (agent: ${agentLabel})`);
}
