#!/usr/bin/env node
// ─── Ofiere Dashboard MCP Server ────────────────────────────────────────────
// Entry point. Auto-discovers all tool domains and serves them over stdio.
// ──────────────────────────────────────────────────────────────────────────────

import "dotenv/config";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { SERVER_NAME, SERVER_VERSION, SERVER_DESCRIPTION } from "./config.js";
import { getAllTools, zodShapeToJsonSchema } from "./registry.js";

// ─── Import all tool domains ─────────────────────────────────────────────────
// To add a new domain: create tools/my-domain.ts, then add one import here.
import "./tools/tasks.js";
import "./tools/agents.js";
import "./tools/notifications.js";
import "./tools/scheduler.js";
import "./tools/workflows.js";
import "./tools/chat.js";
import "./tools/summit.js";
import "./tools/projects.js";
import "./tools/knowledge.js";
import "./tools/telemetry.js";
import "./tools/audit.js";
import "./tools/prompt-chunks.js";
import "./tools/mcp-servers.js";
import "./tools/connections.js";
import "./tools/gamification.js";

// ─── Create Server ───────────────────────────────────────────────────────────

const server = new Server(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } }
);

// ─── List Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getAllTools();
    return {
        tools: Array.from(tools.entries()).map(([name, def]) => ({
            name,
            description: def.description,
            inputSchema: zodShapeToJsonSchema(def.inputSchema),
        })),
    };
});

// ─── Call Tool ───────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request): Promise<any> => {
    const { name, arguments: args } = request.params;
    const tools = getAllTools();
    const tool = tools.get(name);

    if (!tool) {
        return {
            content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
            isError: true,
        };
    }

    try {
        // Validate input with Zod
        const schema = z.object(tool.inputSchema);
        const parsed = schema.parse(args || {});
        return await tool.handler(parsed);
    } catch (error: any) {
        // Zod validation errors
        if (error.name === "ZodError") {
            return {
                content: [{
                    type: "text" as const,
                    text: JSON.stringify({
                        error: "Invalid input",
                        details: error.errors,
                    }),
                }],
                isError: true,
            };
        }
        // Runtime errors
        return {
            content: [{
                type: "text" as const,
                text: JSON.stringify({
                    error: error.message || "Internal error",
                }),
            }],
            isError: true,
        };
    }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    const toolCount = getAllTools().size;
    console.error(`🔮 ${SERVER_NAME} v${SERVER_VERSION} started — ${toolCount} tools registered`);
}

main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
});
