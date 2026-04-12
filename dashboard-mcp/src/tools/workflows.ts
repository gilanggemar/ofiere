// ─── Workflows Domain ────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "workflows";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all workflows with their status.",
        inputSchema: {
            status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("Filter by status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("workflows")
                .select("id, name, description, status, definition_version, created_at, updated_at")
                .eq("user_id", userId)
                .order("updated_at", { ascending: false });

            if (params.status) query = query.eq("status", params.status as string);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ workflows: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get",
        description: "Get a full workflow definition including nodes, edges, and steps.",
        inputSchema: {
            workflow_id: z.string().describe("Workflow ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("workflows")
                .select("*")
                .eq("id", params.workflow_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "create",
        description: "Create a new workflow definition.",
        inputSchema: {
            name: z.string().describe("Workflow name"),
            description: z.string().optional().describe("Workflow description"),
            nodes: z.string().describe("JSON stringified array of node objects").optional(),
            edges: z.string().describe("JSON stringified array of edge objects").optional(),
            steps: z.string().describe("JSON stringified array of step objects").optional(),
            status: z.enum(["draft", "active", "paused", "archived"]).optional().default("draft").describe("Initial status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("workflows")
                .insert({
                    id,
                    name: params.name,
                    description: params.description || null,
                    nodes: params.nodes ? JSON.parse(params.nodes as string) : [],
                    edges: params.edges ? JSON.parse(params.edges as string) : [],
                    steps: params.steps ? JSON.parse(params.steps as string) : [],
                    status: params.status || "draft",
                    definition_version: 1,
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
        description: "Update a workflow definition (name, nodes, edges, steps, status).",
        inputSchema: {
            workflow_id: z.string().describe("Workflow ID to update"),
            name: z.string().optional().describe("New name"),
            description: z.string().optional().describe("New description"),
            nodes: z.string().describe("JSON stringified array of new nodes").optional(),
            edges: z.string().describe("JSON stringified array of new edges").optional(),
            steps: z.string().describe("JSON stringified array of new steps").optional(),
            status: z.enum(["draft", "active", "paused", "archived"]).optional().describe("New status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            const fields = ["name", "description", "status"];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) updates[f] = (params as any)[f];
            }
            if (params.nodes !== undefined) updates.nodes = JSON.parse(params.nodes as string);
            if (params.edges !== undefined) updates.edges = JSON.parse(params.edges as string);
            if (params.steps !== undefined) updates.steps = JSON.parse(params.steps as string);
            const { data, error } = await supabase
                .from("workflows")
                .update(updates)
                .eq("id", params.workflow_id as string)
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
        description: "Delete a workflow and all its run history.",
        inputSchema: {
            workflow_id: z.string().describe("Workflow ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            // Delete runs first
            await supabase
                .from("workflow_runs")
                .delete()
                .eq("workflow_id", params.workflow_id as string)
                .eq("user_id", userId);

            const { error } = await supabase
                .from("workflows")
                .delete()
                .eq("id", params.workflow_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, workflow_id: params.workflow_id });
        },
    },
    {
        domain: DOMAIN,
        action: "trigger_run",
        description: "Execute a workflow by creating a new run. Returns the run ID for tracking.",
        inputSchema: {
            workflow_id: z.string().describe("Workflow ID to execute"),
            triggered_by: z.string().optional().default("mcp").describe("Who triggered the run"),
            global_variables: z.object({}).optional().describe("Initial global variables for the run"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const runId = crypto.randomUUID();
            const now = new Date().toISOString();
            const { data, error } = await supabase
                .from("workflow_runs")
                .insert({
                    id: runId,
                    workflow_id: params.workflow_id,
                    status: "running",
                    triggered_by: params.triggered_by || "mcp",
                    global_variables: params.global_variables ? JSON.parse(params.global_variables as string) : {},
                    step_results: [],
                    user_id: userId,
                    started_at: now,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "list_runs",
        description: "List workflow run history, optionally filtered by workflow or status.",
        inputSchema: {
            workflow_id: z.string().optional().describe("Filter by workflow ID"),
            status: z
                .enum(["pending", "running", "completed", "failed", "error", "aborted", "cancelled", "paused_approval"])
                .optional()
                .describe("Filter by run status"),
            limit: z.number().optional().default(20).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("workflow_runs")
                .select("id, workflow_id, status, triggered_by, started_at, completed_at, error, current_step_id")
                .eq("user_id", userId)
                .order("started_at", { ascending: false });

            if (params.workflow_id) query = query.eq("workflow_id", params.workflow_id as string);
            if (params.status) query = query.eq("status", params.status as string);
            query = query.limit((params.limit as number) || 20);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ runs: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get_run",
        description: "Get full details of a workflow run, including step results and global variables.",
        inputSchema: {
            run_id: z.string().describe("Run ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: run, error } = await supabase
                .from("workflow_runs")
                .select("*")
                .eq("id", params.run_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);

            // Also get step logs
            const { data: stepLogs } = await supabase
                .from("workflow_step_logs")
                .select("*")
                .eq("run_id", params.run_id as string)
                .eq("user_id", userId)
                .order("started_at", { ascending: true });

            // Also get gate approvals
            const { data: gates } = await supabase
                .from("workflow_gate_approvals")
                .select("*")
                .eq("run_id", params.run_id as string)
                .eq("user_id", userId);

            return ok({ ...run, stepLogs: stepLogs ?? [], gateApprovals: gates ?? [] });
        },
    },
];

registerTools(tools);
