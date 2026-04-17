import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

// OpenClaw config paths
const CONFIG_DIR = path.join(os.homedir(), ".openclaw");
const CONFIG_PATH = path.join(CONFIG_DIR, "openclaw.json");

function readConfig(): Record<string, unknown> {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  } catch {
    return {};
  }
}

function writeConfig(config: Record<string, unknown>): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

function getPluginConfig(): {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  userId?: string;
  agentId?: string;
  enabled?: boolean;
} {
  const config = readConfig();
  const plugins = config.plugins as Record<string, unknown> | undefined;
  const entries = plugins?.entries as Record<string, unknown> | undefined;
  const entry = entries?.hecate as Record<string, unknown> | undefined;
  const cfg = entry?.config as Record<string, unknown> | undefined;
  return {
    supabaseUrl: (cfg?.supabaseUrl as string) || process.env.HECATE_SUPABASE_URL || undefined,
    serviceRoleKey: (cfg?.serviceRoleKey as string) || process.env.HECATE_SERVICE_ROLE_KEY || undefined,
    userId: (cfg?.userId as string) || process.env.HECATE_USER_ID || undefined,
    agentId: (cfg?.agentId as string) || process.env.HECATE_AGENT_ID || undefined,
    enabled: (entry?.enabled as boolean) ?? true,
  };
}

// ── CLI Registration ─────────────────────────────────────────────────────────

interface PluginApi {
  registerCli: (
    registrar: (ctx: { program: any }) => void,
    opts?: { commands?: string[] },
  ) => void;
}

export function registerCli(api: PluginApi): void {
  api.registerCli(
    ({ program }: { program: any }) => {
      const cmd = program
        .command("hecate")
        .description("Hecate PM dashboard integration");

      // ── setup ────────────────────────────────────────────────────────────
      cmd
        .command("setup")
        .description("Configure Hecate PM connection")
        .option("--supabase-url <url>", "Supabase project URL")
        .option("--service-key <key>", "Supabase service role key")
        .option("--user-id <id>", "Hecate user UUID")
        .option("--agent-id <id>", "This agent's ID (e.g. 'sasha')")
        .action(async (opts: {
          supabaseUrl?: string;
          serviceKey?: string;
          userId?: string;
          agentId?: string;
        }) => {
          let supabaseUrl = opts.supabaseUrl?.trim();
          let serviceKey = opts.serviceKey?.trim();
          let userId = opts.userId?.trim();
          let agentId = opts.agentId?.trim();

          // Interactive mode if any field is missing
          if (!supabaseUrl || !serviceKey || !userId || !agentId) {
            console.log("\nHecate PM Setup\n");
            const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
            });

            if (!supabaseUrl) {
              supabaseUrl = (await ask(rl, "Supabase URL (https://xxx.supabase.co): ")).trim();
            }
            if (!serviceKey) {
              serviceKey = (await ask(rl, "Service role key: ")).trim();
            }
            if (!userId) {
              userId = (await ask(rl, "User ID (UUID): ")).trim();
            }
            if (!agentId) {
              agentId = (await ask(rl, "Agent ID (e.g. sasha): ")).trim();
            }

            rl.close();
          }

          if (!supabaseUrl || !serviceKey || !userId || !agentId) {
            console.log("\nAll fields are required. Setup cancelled.");
            return;
          }

          // Save to config
          const config = readConfig();
          if (!config.plugins) config.plugins = {};
          const plugins = config.plugins as Record<string, unknown>;
          if (!plugins.entries) plugins.entries = {};
          const entries = plugins.entries as Record<string, unknown>;
          entries.hecate = {
            ...(entries.hecate as Record<string, unknown> ?? {}),
            enabled: true,
            config: { supabaseUrl, serviceRoleKey: serviceKey, userId, agentId },
          };

          // Add hecate to tools.alsoAllow
          if (!config.tools) config.tools = {};
          const tools = config.tools as Record<string, unknown>;
          if (!Array.isArray(tools.alsoAllow)) tools.alsoAllow = [];
          const alsoAllow = tools.alsoAllow as string[];
          if (!alsoAllow.includes("hecate")) alsoAllow.push("hecate");

          writeConfig(config);

          console.log("\nDone. Saved to ~/.openclaw/openclaw.json");
          console.log(`  - Supabase URL: ${supabaseUrl}`);
          console.log(`  - User ID: ${userId}`);
          console.log(`  - Agent ID: ${agentId}`);
          console.log("  - Plugin enabled");
          console.log("\nRestart to apply: openclaw gateway restart\n");
        });

      // ── status ───────────────────────────────────────────────────────────
      cmd
        .command("status")
        .description("Show Hecate PM plugin configuration")
        .action(async () => {
          const cfg = getPluginConfig();
          console.log("\nHecate PM Status\n");

          if (!cfg.supabaseUrl) {
            console.log("  Not configured. Run: openclaw hecate setup\n");
            return;
          }

          const maskedKey = cfg.serviceRoleKey
            ? `${cfg.serviceRoleKey.slice(0, 10)}...${cfg.serviceRoleKey.slice(-4)}`
            : "not set";

          console.log(`  Supabase URL:    ${cfg.supabaseUrl}`);
          console.log(`  Service Key:     ${maskedKey}`);
          console.log(`  User ID:         ${cfg.userId || "not set"}`);
          console.log(`  Agent ID:        ${cfg.agentId || "not set"}`);
          console.log(`  Enabled:         ${cfg.enabled}`);
          console.log("");
        });

      // ── doctor ───────────────────────────────────────────────────────────
      cmd
        .command("doctor")
        .description("Test Hecate PM connection")
        .action(async () => {
          const cfg = getPluginConfig();
          console.log("\nHecate PM Doctor\n");

          if (!cfg.supabaseUrl || !cfg.serviceRoleKey || !cfg.userId) {
            console.log("  Not configured. Run: openclaw hecate setup\n");
            return;
          }

          console.log(`  Supabase URL:  ${cfg.supabaseUrl}`);
          console.log(`  Agent ID:      ${cfg.agentId}`);
          console.log("\n  Testing connection...");

          try {
            const sb = createClient(cfg.supabaseUrl, cfg.serviceRoleKey, {
              auth: { persistSession: false },
            });

            const { data, error } = await sb
              .from("agents")
              .select("id, name, status")
              .eq("user_id", cfg.userId)
              .order("name");

            if (error) {
              console.log(`\n  Connection failed: ${error.message}\n`);
              return;
            }

            console.log(`  Found ${(data || []).length} agents\n`);
            for (const agent of data || []) {
              const marker = agent.id === cfg.agentId ? " ← YOU" : "";
              console.log(`    ${agent.id} — ${agent.name} (${agent.status})${marker}`);
            }

            // Test tasks access
            const { count } = await sb
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", cfg.userId);

            console.log(`\n  Tasks accessible: ${count ?? 0}`);
            console.log("\n  Status: healthy ✓\n");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`\n  Connection failed: ${msg}`);
            console.log("\n  Possible causes:");
            console.log("    - Invalid Supabase URL or service key");
            console.log("    - Network issue reaching Supabase");
            console.log("    - Invalid user ID\n");
          }
        });
    },
    { commands: ["hecate"] },
  );
}
