// ─── Summit Domain ───────────────────────────────────────────────────────────
import { z } from "zod";
import { registerTools, ok, err, db, type ToolDefinition } from "../registry.js";

const DOMAIN = "summit";

const tools: ToolDefinition[] = [
    {
        domain: DOMAIN,
        action: "list_sessions",
        description: "List all summit (multi-agent deliberation) sessions.",
        inputSchema: {
            status: z.enum(["active", "completed", "archived"]).optional().describe("Filter by session status"),
            limit: z.number().optional().default(20).describe("Max results"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            let query = supabase
                .from("summit_sessions")
                .select("*")
                .eq("user_id", userId)
                .order("created_at", { ascending: false });

            if (params.status) query = query.eq("status", params.status as string);
            query = query.limit((params.limit as number) || 20);

            const { data, error } = await query;
            if (error) return err(error.message);
            return ok({ sessions: data, count: data?.length ?? 0 });
        },
    },
    {
        domain: DOMAIN,
        action: "get_session",
        description: "Get a summit session with all its messages.",
        inputSchema: {
            session_id: z.string().describe("Summit session ID (UUID)"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data: session, error } = await supabase
                .from("summit_sessions")
                .select("*")
                .eq("id", params.session_id as string)
                .eq("user_id", userId)
                .single();
            if (error) return err(error.message);

            const { data: messages } = await supabase
                .from("summit_messages")
                .select("*")
                .eq("session_id", params.session_id as string)
                .order("created_at", { ascending: true });

            return ok({ ...session, messages: messages ?? [] });
        },
    },
    {
        domain: DOMAIN,
        action: "create_session",
        description: "Start a new multi-agent summit session.",
        inputSchema: {
            title: z.string().describe("Summit title"),
            topic: z.string().optional().describe("Discussion topic"),
            participants: z.string().describe("Comma-separated list of agent IDs to participate").optional(),
            config: z.string().describe("JSON stringified Summit configuration").optional(),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("summit_sessions")
                .insert({
                    user_id: userId,
                    title: params.title,
                    topic: params.topic || null,
                    participants: params.participants ? (params.participants as string).split(',').map(p => p.trim()) : [],
                    config: params.config ? JSON.parse(params.config as string) : {},
                    status: "active",
                    deliberation_round: 0,
                    message_count: 0,
                })
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "add_message",
        description: "Post a message into an active summit session.",
        inputSchema: {
            session_id: z.string().describe("Summit session ID"),
            role: z.enum(["user", "assistant", "system"]).describe("Message role"),
            agent_id: z.string().optional().describe("Agent ID posting the message"),
            content: z.string().describe("Message content"),
            round_number: z.number().optional().describe("Deliberation round number"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("summit_messages")
                .insert({
                    session_id: params.session_id,
                    role: params.role,
                    agent_id: params.agent_id || null,
                    content: params.content,
                    round_number: params.round_number || null,
                })
                .select()
                .single();
            if (error) return err(error.message);

            // Update session message count (manual increment)
            const { data: sess } = await supabase
                .from("summit_sessions")
                .select("message_count")
                .eq("id", params.session_id as string)
                .single();
            if (sess) {
                await supabase
                    .from("summit_sessions")
                    .update({
                        message_count: (sess.message_count || 0) + 1,
                        updated_at: new Date().toISOString(),
                    })
                    .eq("id", params.session_id as string);
            }

            return ok(data);
        },
    },
    {
        domain: DOMAIN,
        action: "update_status",
        description: "Update a summit session's status (e.g. complete or archive it).",
        inputSchema: {
            session_id: z.string().describe("Summit session ID"),
            status: z.enum(["active", "completed", "archived"]).describe("New status"),
        },
        handler: async (params) => {
            const { supabase, userId } = db();
            const { data, error } = await supabase
                .from("summit_sessions")
                .update({ status: params.status, updated_at: new Date().toISOString() })
                .eq("id", params.session_id as string)
                .eq("user_id", userId)
                .select()
                .single();
            if (error) return err(error.message);
            return ok(data);
        },
    },
];

registerTools(tools);
