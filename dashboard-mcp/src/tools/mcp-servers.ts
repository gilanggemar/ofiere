// ─── MCP Servers Domain ──────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "mcp_servers";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description: "List all registered MCP servers with their status and assigned agents.",
        inputSchema: {},
        handler: async () => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("mcp_servers")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });
            if (error) return err(error.message);
            return ok({ servers: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "add",
        description: "Register a new MCP server.",
        inputSchema: {
            name: z.string().describe("Server display name"),
            url: z.string().describe("Server URL or command"),
            transport: z.enum(["stdio", "sse", "http"]).optional().default("sse").describe("Transport type"),
            description: z.string().optional().describe("Server description"),
            assigned_agents: z.string().describe("Comma-separated agent IDs to assign").optional(),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const id = crypto.randomUUID();
            const { data, error } = await supabase
                .from("mcp_servers")
                .insert({
                    id,
                    name: params.name,
                    url: params.url,
                    transport: params.transport || "sse",
                    description: params.description || null,
                    status: "disconnected",
                    tools: [],
                    assigned_agents: params.assigned_agents ? (params.assigned_agents as string).split(',').map(a => a.trim()) : [],
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
        action: "update",
        description: "Update an MCP server's config (name, URL, transport, assigned agents).",
        inputSchema: {
            server_id: z.string().describe("Server ID to update"),
            name: z.string().optional().describe("New name"),
            url: z.string().optional().describe("New URL"),
            transport: z.enum(["stdio", "sse", "http"]).optional().describe("New transport"),
            description: z.string().optional().describe("New description"),
            status: z.enum(["connected", "disconnected", "error", "testing"]).optional().describe("New status"),
            assigned_agents: z.string().describe("Comma-separated updated agent assignments").optional(),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            const fields = ["name", "url", "transport", "description", "status"];
            for (const f of fields) {
                if ((params as any)[f] !== undefined) updates[f] = (params as any)[f];
            }
            if (params.assigned_agents !== undefined) updates.assigned_agents = (params.assigned_agents as string).split(',').map(a => a.trim());
            const { data, error } = await supabase
                .from("mcp_servers")
                .update(updates)
                .eq("id", params.server_id as string)
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
        description: "Remove a registered MCP server.",
        inputSchema: {
            server_id: z.string().describe("Server ID to delete"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { error } = await supabase
                .from("mcp_servers")
                .delete()
                .eq("id", params.server_id as string)
                .eq("user_id", userId);
            if (error) return err(error.message);
            return ok({ deleted: true, server_id: params.server_id });
        },
    },
];

registerTools(tools);
