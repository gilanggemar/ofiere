// ─── Centralized Configuration ────────────────────────────────────────────────
// Change TOOL_PREFIX here to rebrand all 70+ tools at once.
// e.g. change TOOL_PREFIX to rebrand all 70+ tools (currently "ofiere")
// ──────────────────────────────────────────────────────────────────────────────

export const TOOL_PREFIX = "ofiere";

/** Build a namespaced tool name: `{prefix}_{domain}_{action}` */
export function toolName(domain: string, action: string): string {
    return `${TOOL_PREFIX}_${domain}_${action}`;
}

/** Get user ID from env — required for scoping all Supabase queries */
export function getUserId(): string {
    const id = process.env.OFIERE_USER_ID;
    if (!id) throw new Error("OFIERE_USER_ID environment variable is required");
    return id;
}

/** Server metadata */
export const SERVER_NAME = "ofiere-dashboard";
export const SERVER_VERSION = "1.0.0";
export const SERVER_DESCRIPTION =
    "MCP server for full programmatic control of the Ofiere dashboard. " +
    "Provides 70+ tools across tasks, agents, workflows, chat, and more.";
