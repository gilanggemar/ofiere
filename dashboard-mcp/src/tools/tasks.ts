// ─── Tasks Domain ────────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "tasks";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description:
            "List all tasks. Optionally filter by agent_id, status, or priority. " +
            "Returns an array of task objects sorted by most recently updated.",
        inputSchema: {
            agent_id: z.string().optional().describe("Filter by agent ID"),
            status: z
                .enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED"])
                .optional()
                .describe("Filter by status"),
            priority: z.number().optional().describe("Filter by priority (0-based, higher = more important)"),
            limit: z.number().optional().default(50).describe("Max results (default 50)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("tasks")
                .select("*")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });

            if (params.agent_id) query = query.eq("agent_id", params.agent_id as string);
            if (params.status) query = query.eq("status", params.status as string);
            if (params.priority !== undefined) query = query.eq("priority", params.priority as number);
            query = query.limit((params.limit as number) || 50);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ tasks: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get",
        description:
            "Get a single task by ID, including its log entries.",
        inputSchema: {
            task_id: z.string().describe("The task ID to retrieve"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: task, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("id", params.task_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);

            const { data: logs } = await supabase
                .from("task_logs")
                .select("*")
                .eq("task_id", params.task_id as string)
                .eq("user_id", userId)
                .order("timestamp", { ascending: true });

            return ok({ ...task, logs: logs ?? [] });
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description:
            "Create a new task and assign it to an agent. Returns the created task.",
        inputSchema: {
            title: z.string().describe("Task title"),
            description: z.string().optional().describe("Task description"),
            agent_id: z.string().describe("Agent ID to assign the task to"),
            priority: z.number().optional().default(0).describe("Priority (0 = normal, higher = more important)"),
            status: z
                .enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED"])
                .optional()
                .default("PENDING")
                .describe("Initial status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("tasks")
                .insert({
                    id,
                    title: params.title,
                    description: params.description || null,
                    agent_id: params.agent_id,
                    status: params.status || "PENDING",
                    priority: params.priority ?? 0,
                    user_id: userId,
                    created_at: now,
                    updated_at: now,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "update",
        description:
            "Update one or more fields on an existing task. Only provided fields are changed.",
        inputSchema: {
            task_id: z.string().describe("The task ID to update"),
            title: z.string().optional().describe("New title"),
            description: z.string().optional().describe("New description"),
            status: z
                .enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED"])
                .optional()
                .describe("New status"),
            priority: z.number().optional().describe("New priority"),
            agent_id: z.string().optional().describe("Reassign to a different agent"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (params.title !== undefined) updates.title = params.title;
            if (params.description !== undefined) updates.description = params.description;
            if (params.status !== undefined) updates.status = params.status;
            if (params.priority !== undefined) updates.priority = params.priority;
            if (params.agent_id !== undefined) updates.agent_id = params.agent_id;

            // If completing, set completed_at
            if (params.status === "DONE") updates.completed_at = new Date().toISOString();

            const { data, error } = await supabase
                .from("tasks")
                .update(updates)
                .eq("id", params.task_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "delete",
        description: "Delete a task by ID. Also removes associated task logs.",
        inputSchema: {
            task_id: z.string().describe("The task ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // Delete logs first (FK constraint)
            await supabase
                .from("task_logs")
                .delete()
                .eq("task_id", params.task_id as string)
                .eq("user_id", userId);

            const { error } = await supabase
                .from("tasks")
                .delete()
                .eq("id", params.task_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, task_id: params.task_id });
        },
    },
    {
        domain: DOMAIN,
        action: "append_log",
        description: "Append a log entry to a task's activity log.",
        inputSchema: {
            task_id: z.string().describe("The task ID to append a log to"),
            content: z.string().describe("Log message content"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("task_logs")
                .insert({
                    task_id: params.task_id,
                    content: params.content,
                    user_id: userId,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "bulk_update_status",
        description:
            "Update the status of multiple tasks at once. Useful for batch operations.",
        inputSchema: {
            task_ids: z.string().describe("Comma-separated list of task IDs to update"),
            status: z
                .enum(["PENDING", "IN_PROGRESS", "DONE", "FAILED"])
                .describe("New status for all specified tasks"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const ids = (params.task_ids as string).split(',').map(id => id.trim());
            const now = new Date().toISOString();
            const updates: Record<string, unknown> = {
                status: params.status,
                updated_at: now,
            };
            if (params.status === "DONE") updates.completed_at = now;

            const { data, error } = await supabase
                .from("tasks")
                .update(updates)
                .in("id", ids)
                .eq("user_id", userId)
                .select();
            if (error) return err(error.message);
            return ok({ updated: data?.length ?? 0, tasks: data });
        },
    },
];

registerTools(tools);
