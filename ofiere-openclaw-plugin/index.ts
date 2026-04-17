// index.ts — Ofiere PM Plugin for OpenClaw
// Matches Composio plugin pattern: plain object export + api.on()

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { parseOfiereConfig } from "./src/config.js";
import { getSupabase } from "./src/supabase.js";
import { registerTools, probeApiForAgentName } from "./src/tools.js";
import { getSystemPrompt } from "./src/prompt.js";
import { registerCli } from "./src/cli.js";
import { seedAgentCache } from "./src/agent-resolver.js";

const ofierePlugin = {
  id: "ofiere",
  name: "Ofiere PM",
  description:
    "Manage Ofiere PM tasks, agents, and projects directly from the agent. " +
    "Create tasks, update progress, assign agents — all synced to the dashboard in real time.",

  register(api: OpenClawPluginApi) {
    const config = parseOfiereConfig(api.pluginConfig);

    // Always register CLI (even if disabled — so user can run `openclaw ofiere setup`)
    registerCli(api);

    if (!config.enabled) {
      api.logger.debug?.("[ofiere] Plugin disabled via config");
      return;
    }

    if (!config.supabaseUrl || !config.serviceRoleKey) {
      api.logger.warn(
        "[ofiere] Not configured. Run: openclaw ofiere setup",
      );
      return;
    }

    if (!config.userId) {
      api.logger.warn(
        "[ofiere] Missing userId. Run: openclaw ofiere setup",
      );
      return;
    }

    // ── Pre-seed agent cache if OFIERE_AGENT_ID is set (legacy mode) ──────
    if (config.agentId) {
      const callerName =
        (api as any)?.agentContext?.accountId ||
        (api as any)?.agentContext?.name ||
        (api as any)?.currentAgent?.accountId ||
        "";
      if (callerName) {
        seedAgentCache(callerName, config.userId, config.agentId);
      }
    }

    // ── State for system prompt injection ──────────────────────────────────
    const promptState = {
      toolCount: 0,
      agentId: config.agentId,
      connectError: "",
      ready: false,
    };

    // ── Hook: inject Ofiere context into every agent prompt ────────────────
    // Using api.on() — same pattern as Composio
    api.on("before_prompt_build", () => ({
      prependSystemContext: getSystemPrompt(promptState),
    }));

    // ── Connect to Supabase and register tools ────────────────────────────
    try {
      const supabase = getSupabase(config.supabaseUrl, config.serviceRoleKey);

      // Probe the api object for any agent identity info (for debugging + fallback)
      probeApiForAgentName(api, api.logger);

      registerTools(api, supabase, config);
      promptState.toolCount = 5;
      promptState.ready = true;
      const agentLabel = config.agentId || "auto-detect";
      api.logger.info(
        `[ofiere] Ready — 5 tools registered (agent: ${agentLabel})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      promptState.connectError = msg;
      promptState.ready = true;
      api.logger.error(`[ofiere] Failed to initialize: ${msg}`);
    }
  },
};

export default ofierePlugin;
