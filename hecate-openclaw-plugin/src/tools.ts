import type { SupabaseClient } from "@supabase/supabase-js";
import type { HecateConfig } from "./types.js";

// ─── Types matching OpenClaw plugin SDK ──────────────────────────────────────

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  details: null;
}

interface PluginApi {
  registerTool: (tool: {
    name: string;
    label: string;
    description: string;
    parameters: Record<string, unknown>;
    execute: (toolCallId: string, params: Record<string, unknown>) => Promise<ToolResult>;
  }) => void;
  logger: { info: (msg: string) => void; error: (msg: string) => void; debug?: (msg: string) => void };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
    details: null,
  };
}

function err(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    details: null,
  };
}

// ─── Tool Registration ───────────────────────────────────────────────────────

export function registerTools(
  api: PluginApi,
  supabase: SupabaseClient,
  config: HecateConfig,
): void {
  const userId = config.userId;
  const selfAgentId = config.agentId;

  // ── HECATE_LIST_TASKS ────────────────────────────────────────────────────

  api.registerTool({
    name: "HECATE_LIST_TASKS",
    label: "List Hecate Tasks",
    description:
      "List tasks from the Hecate PM dashboard. " +
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
    execute: async (_id: string, params: Record<string, unknown>) => {
      try {
        let query = supabase
          .from("tasks")
          .select("id, title, description, status, priority, agent_id, space_id, folder_id, start_date, due_date, progress, created_at, updated_at")
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

  // ── HECATE_CREATE_TASK ───────────────────────────────────────────────────

  api.registerTool({
    name: "HECATE_CREATE_TASK",
    label: "Create Hecate Task",
    description:
      "Create a new task in the Hecate PM dashboard. " +
      "If agent_id is not provided, the task is automatically assigned to you (the calling agent). " +
      "The task will appear in the dashboard immediately via real-time sync.",
    parameters: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", description: "Task title (required)" },
        description: { type: "string", description: "Task description" },
        agent_id: {
          type: "string",
          description:
            "Agent ID to assign the task to. If omitted, assigns to yourself. " +
            "Use HECATE_LIST_AGENTS to see available agents.",
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
    execute: async (_id: string, params: Record<string, unknown>) => {
      try {
        if (!params.title) return err("Missing required field: title");

        const id = `task-${Date.now()}`;
        const now = new Date().toISOString();
        // Auto-assign to calling agent if no agent_id specified
        const assignee = (params.agent_id as string) || selfAgentId || null;

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
          // FK violation on agent_id — retry without agent
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
  });

  // ── HECATE_UPDATE_TASK ───────────────────────────────────────────────────

  api.registerTool({
    name: "HECATE_UPDATE_TASK",
    label: "Update Hecate Task",
    description:
      "Update an existing task in the Hecate PM dashboard. Only provided fields are changed. " +
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
    execute: async (_id: string, params: Record<string, unknown>) => {
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
  });

  // ── HECATE_DELETE_TASK ───────────────────────────────────────────────────

  api.registerTool({
    name: "HECATE_DELETE_TASK",
    label: "Delete Hecate Task",
    description:
      "Delete a task from the Hecate PM dashboard. Also removes subtasks and linked scheduler events.",
    parameters: {
      type: "object",
      required: ["task_id"],
      properties: {
        task_id: { type: "string", description: "The task ID to delete (required)" },
      },
    },
    execute: async (_id: string, params: Record<string, unknown>) => {
      try {
        if (!params.task_id) return err("Missing required field: task_id");
        const taskId = params.task_id as string;

        // Delete linked scheduler events
        await supabase.from("scheduler_events").delete().eq("task_id", taskId);

        // Delete subtasks
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

        // Delete the task itself
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
  });

  // ── HECATE_LIST_AGENTS ───────────────────────────────────────────────────

  api.registerTool({
    name: "HECATE_LIST_AGENTS",
    label: "List Hecate Agents",
    description:
      "List all available agents in the Hecate system. " +
      "Shows agent IDs, names, roles, and current status. " +
      "Use this to find the right agent_id for task assignment.",
    parameters: {
      type: "object",
      properties: {},
    },
    execute: async (_id: string, _params: Record<string, unknown>) => {
      try {
        const { data, error } = await supabase
          .from("agents")
          .select("id, name, codename, role, status")
          .eq("user_id", userId)
          .order("name");

        if (error) return err(error.message);
        return ok({
          agents: data || [],
          count: (data || []).length,
          your_agent_id: selfAgentId,
        });
      } catch (e) {
        return err(e instanceof Error ? e.message : String(e));
      }
    },
  });

  api.logger.info(`[hecate] 5 tools registered (agent: ${selfAgentId})`);
}
