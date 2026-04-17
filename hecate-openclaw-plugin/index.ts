// index.ts — Hecate PM Plugin for OpenClaw
// Uses definePluginEntry from the official plugin-entry subpath (NOT the deprecated monolithic root)
// Pattern: https://docs.openclaw.ai/plugins/building-plugins#quick-start-tool-plugin

import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { parseHecateConfig } from "./src/config.js";
import { getSupabase } from "./src/supabase.js";
import { registerTools } from "./src/tools.js";
import { getSystemPrompt } from "./src/prompt.js";
import { registerCli } from "./src/cli.js";
import { seedAgentCache } from "./src/agent-resolver.js";

export default definePluginEntry({
  id: "hecate",
  name: "Hecate PM",
  description:
    "Manage Hecate PM tasks, agents, and projects directly from the agent. " +
    "Create tasks, update progress, assign agents — all synced to the dashboard in real time.",

  register(api) {
    const config = parseHecateConfig(api.pluginConfig);

    // Always register CLI (even if disabled — so user can run `openclaw hecate setup`)
    registerCli(api);

    if (!config.enabled) {
      api.logger.debug("[hecate] Plugin disabled via config");
      return;
    }

    if (!config.supabaseUrl || !config.serviceRoleKey) {
      api.logger.warn(
        "[hecate] Not configured. Run: openclaw hecate setup",
      );
      return;
    }

    if (!config.userId) {
      api.logger.warn(
        "[hecate] Missing userId. Run: openclaw hecate setup",
      );
      return;
    }

    // ── Pre-seed agent cache if HECATE_AGENT_ID is set (legacy mode) ──────
    if (config.agentId) {
      // Try to extract the calling agent's name from OpenClaw context
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

    // ── Hook: inject Hecate context into every agent prompt ────────────────
    // Uses api.registerHook (the documented API) instead of api.on shorthand
    api.registerHook(
      ["before_prompt_build"],
      () => ({
        prependSystemContext: getSystemPrompt(promptState),
      }),
    );

    // ── Connect to Supabase and register tools ────────────────────────────
    try {
      const supabase = getSupabase(config.supabaseUrl, config.serviceRoleKey);
      registerTools(api, supabase, config);
      promptState.toolCount = 5;
      promptState.ready = true;
      const agentLabel = config.agentId || "auto-detect";
      api.logger.info(
        `[hecate] Ready — 5 tools registered (agent: ${agentLabel})`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      promptState.connectError = msg;
      promptState.ready = true;
      api.logger.error(`[hecate] Failed to initialize: ${msg}`);
    }
  },
});
