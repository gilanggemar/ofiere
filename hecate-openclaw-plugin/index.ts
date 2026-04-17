import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { hecatePluginConfigSchema, parseHecateConfig } from "./src/config.js";
import { getSupabase } from "./src/supabase.js";
import { registerTools } from "./src/tools.js";
import { getSystemPrompt } from "./src/prompt.js";
import { registerCli } from "./src/cli.js";

const hecatePlugin = {
  id: "hecate",
  name: "Hecate PM",
  description: "Manage Hecate PM tasks, agents, and projects directly from the agent.",
  configSchema: hecatePluginConfigSchema,

  register(api: OpenClawPluginApi) {
    const config = parseHecateConfig(api.pluginConfig);

    // Always register CLI (even if disabled — so user can run setup)
    registerCli(api as any);

    if (!config.enabled) {
      api.logger.debug?.("[hecate] Plugin disabled");
      return;
    }

    if (!config.supabaseUrl || !config.serviceRoleKey) {
      api.logger.warn(
        "[hecate] Not configured. Run 'openclaw hecate setup' or set HECATE_SUPABASE_URL and HECATE_SERVICE_ROLE_KEY env vars."
      );
      return;
    }

    if (!config.userId) {
      api.logger.warn("[hecate] Missing user ID. Run 'openclaw hecate setup' to set it.");
      return;
    }

    const promptState = {
      toolCount: 0,
      agentId: config.agentId,
      connectError: "",
      ready: false,
    };

    // Inject system prompt into every agent conversation
    api.on("before_prompt_build", () => ({
      prependSystemContext: getSystemPrompt(promptState),
    }));

    // Connect to Supabase and register tools
    try {
      const supabase = getSupabase(config.supabaseUrl, config.serviceRoleKey);
      registerTools(api as any, supabase, config);
      promptState.toolCount = 5;
      promptState.ready = true;
      api.logger.info(`[hecate] Ready — 5 tools registered (agent: ${config.agentId})`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      promptState.connectError = msg;
      promptState.ready = true;
      api.logger.error(`[hecate] Failed to initialize: ${msg}`);
    }
  },
};

export default hecatePlugin;
