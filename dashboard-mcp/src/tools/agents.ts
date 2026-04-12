// ─── Agents Domain ───────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "agents";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list",
        description:
            "List all agents with their status, model, role, and specialties.",
        inputSchema: {
            status: z.string().optional().describe("Filter by status (ONLINE, OFFLINE, WORKING, etc.)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("agents")
                .select("*")
                .eq("user_id", userId)
                .order("name");

            if (params.status) query = query.eq("status", params.status as string);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ agents: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get",
        description:
            "Get detailed info for a single agent by ID, including XP data and provider config.",
        inputSchema: {
            agent_id: z.string().describe("The agent ID"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: agent, error } = await supabase
                .from("agents")
                .select("*")
                .eq("id", params.agent_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);

            // Also fetch XP
            const { data: xp } = await supabase
                .from("agent_xp")
                .select("*")
                .eq("agent_id", params.agent_id as string)
                .eq("user_id", userId)
                .single();

            // Also fetch provider config
            const { data: provider } = await supabase
                .from("agent_provider_config")
                .select("*")
                .eq("agent_id", params.agent_id as string)
                .eq("user_id", userId)
                .single();

            return ok({ ...agent, xp: xp || null, providerConfig: provider || null });
        },
    },
    {
        domain: DOMAIN,
        action: "update",
        description:
            "Update agent fields such as name, codename, role, specialty, temperature, or status.",
        inputSchema: {
            agent_id: z.string().describe("The agent ID to update"),
            name: z.string().optional().describe("New display name"),
            codename: z.string().optional().describe("New codename"),
            role: z.string().optional().describe("New role description"),
            status: z.string().optional().describe("New status (ONLINE, OFFLINE, WORKING, THINKING, QUEUED, IN_SUMMIT, PAUSED)"),
            temperature: z.number().optional().describe("LLM temperature (0.0 - 2.0)"),
            specialty: z.string().describe("Comma separated list of specialties").optional(),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
            if (params.name !== undefined) updates.name = params.name;
            if (params.codename !== undefined) updates.codename = params.codename;
            if (params.role !== undefined) updates.role = params.role;
            if (params.status !== undefined) updates.status = params.status;
            if (params.temperature !== undefined) updates.temperature = params.temperature;
            if (params.specialty !== undefined) updates.specialty = (params.specialty as string).split(',').map(s => s.trim());

            const { data, error } = await supabase
                .from("agents")
                .update(updates)
                .eq("id", params.agent_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "set_status",
        description:
            "Quick shorthand to set an agent's status. Lighter than full update.",
        inputSchema: {
            agent_id: z.string().describe("The agent ID"),
            status: z
                .enum(["ONLINE", "OFFLINE", "WORKING", "THINKING", "QUEUED", "IN_SUMMIT", "PAUSED"])
                .describe("New status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("agents")
                .update({ status: params.status, updated_at: new Date().toISOString() })
                .eq("id", params.agent_id as string)
                .eq("user_id", userId)
                .select("id, name, status")
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "set_hero_image",
        description: "Set or update a hero image for an agent.",
        inputSchema: {
            agent_id: z.string().describe("The agent ID"),
            image_data: z.string().describe("Image data URL or public URL"),
            sort_order: z.number().optional().default(0).describe("Sort order for the image"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("hero_images")
                .insert({
                    agent_id: params.agent_id,
                    image_data: params.image_data,
                    sort_order: params.sort_order ?? 0,
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
        action: "get_xp",
        description:
            "Get the XP, level, rank, and recent XP events for an agent.",
        inputSchema: {
            agent_id: z.string().describe("The agent ID"),
            event_limit: z.number().optional().default(10).describe("Max recent XP events to return"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: xp, error } = await supabase
                .from("agent_xp")
                .select("*")
                .eq("agent_id", params.agent_id as string)
                .eq("user_id", userId)
                .single();

            const { data: events } = await supabase
                .from("xp_events")
                .select("*")
                .eq("agent_id", params.agent_id as string)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .limit((params.event_limit as number) || 10);

            if (error) return err(error.message);
            return ok({ xp: xp || { total_xp: 0, level: 1, rank: "INITIATE" }, recentEvents: events ?? [] });
        },
    },
];

registerTools(tools);
