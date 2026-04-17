// src/cli.ts — CLI registration for Ofiere PM plugin
// Uses api.registerCli with descriptors as documented:
//   https://docs.openclaw.ai/plugins/sdk-overview#cli-registration-metadata
//
// The descriptors array enables lazy plugin CLI registration and root help text.
// The async ({ program }) => {} pattern is shown in the official Matrix plugin example.

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import { createClient } from "@supabase/supabase-js";

// ── Config paths ─────────────────────────────────────────────────────────────

/** Auto-detect OpenClaw home for env file */
function getOpenClawHome(): string {
  if (fs.existsSync("/data/.openclaw")) return "/data/.openclaw";
  return path.join(os.homedir(), ".openclaw");
}

function getEnvFile(): string {
  return path.join(getOpenClawHome(), ".env");
}

/** Read env vars from the .env file */
function readEnvFile(): Record<string, string> {
  const envPath = getEnvFile();
  const result: Record<string, string> = {};
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) {
        result[match[1].trim()] = match[2].trim();
      }
    }
  } catch { /* file doesn't exist yet */ }
  return result;
}

/** Append or update env vars in the .env file (idempotent) */
function setEnvVars(vars: Record<string, string>): void {
  const envPath = getEnvFile();
  const dir = path.dirname(envPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf-8");
  } catch { /* file doesn't exist yet */ }

  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content.trimEnd() + `\n${key}=${value}`;
    }
  }

  fs.writeFileSync(envPath, content.trim() + "\n");
}

function getPluginConfig(): {
  supabaseUrl?: string;
  serviceRoleKey?: string;
  userId?: string;
  agentId?: string;
  enabled?: boolean;
} {
  const env = readEnvFile();
  return {
    supabaseUrl: process.env.OFIERE_SUPABASE_URL || env.OFIERE_SUPABASE_URL || undefined,
    serviceRoleKey: process.env.OFIERE_SERVICE_ROLE_KEY || env.OFIERE_SERVICE_ROLE_KEY || undefined,
    userId: process.env.OFIERE_USER_ID || env.OFIERE_USER_ID || undefined,
    agentId: process.env.OFIERE_AGENT_ID || env.OFIERE_AGENT_ID || undefined,
    enabled: true,
  };
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ── CLI Registration ─────────────────────────────────────────────────────────

export function registerCli(api: any): void {
  api.registerCli(
    // Async registrar — follows the pattern from the official Matrix plugin example
    async ({ program }: { program: any }) => {
      const cmd = program
        .command("ofiere")
        .description("Ofiere PM dashboard integration");

      // ── setup ──────────────────────────────────────────────────────────
      cmd
        .command("setup")
        .description("Configure Ofiere PM connection (writes to .env, never touches openclaw.json)")
        .option("--supabase-url <url>", "Supabase project URL")
        .option("--service-key <key>", "Supabase service role key")
        .option("--user-id <id>", "Ofiere user UUID")
        .action(async (opts: {
          supabaseUrl?: string;
          serviceKey?: string;
          userId?: string;
        }) => {
          let supabaseUrl = opts.supabaseUrl?.trim();
          let serviceKey = opts.serviceKey?.trim();
          let userId = opts.userId?.trim();

          // Interactive mode if any field is missing
          if (!supabaseUrl || !serviceKey || !userId) {
            console.log("\nOfiere PM Setup\n");
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

            rl.close();
          }

          if (!supabaseUrl || !serviceKey || !userId) {
            console.log("\nAll fields are required. Setup cancelled.");
            return;
          }

          // Write to .env file (NEVER touches openclaw.json)
          setEnvVars({
            OFIERE_SUPABASE_URL: supabaseUrl,
            OFIERE_SERVICE_ROLE_KEY: serviceKey,
            OFIERE_USER_ID: userId,
          });

          const envFile = getEnvFile();
          console.log(`\nDone. Saved to ${envFile}`);
          console.log(`  Supabase URL: ${supabaseUrl}`);
          console.log(`  User ID:      ${userId}`);
          console.log(`  Plugin:       enabled (global — all agents)`);
          console.log("\nRestart to apply: openclaw gateway restart\n");
        });

      // ── status ─────────────────────────────────────────────────────────
      cmd
        .command("status")
        .description("Show Ofiere PM plugin configuration")
        .action(async () => {
          const cfg = getPluginConfig();
          console.log("\nOfiere PM Status\n");

          if (!cfg.supabaseUrl) {
            console.log("  Not configured. Run: openclaw ofiere setup\n");
            return;
          }

          const maskedKey = cfg.serviceRoleKey
            ? `${cfg.serviceRoleKey.slice(0, 10)}...${cfg.serviceRoleKey.slice(-4)}`
            : "not set";

          console.log(`  Supabase URL:    ${cfg.supabaseUrl}`);
          console.log(`  Service Key:     ${maskedKey}`);
          console.log(`  User ID:         ${cfg.userId || "not set"}`);
          console.log(`  Agent ID:        ${cfg.agentId || "(auto-detect — all agents)"}`);
          console.log(`  Config Source:    ${getEnvFile()}`);
          console.log("");
        });

      // ── doctor ─────────────────────────────────────────────────────────
      cmd
        .command("doctor")
        .description("Test Ofiere PM connection")
        .action(async () => {
          const cfg = getPluginConfig();
          console.log("\nOfiere PM Doctor\n");

          if (!cfg.supabaseUrl || !cfg.serviceRoleKey || !cfg.userId) {
            console.log("  Not configured. Run: openclaw ofiere setup\n");
            return;
          }

          console.log(`  Supabase URL:  ${cfg.supabaseUrl}`);
          console.log(`  Agent Mode:    ${cfg.agentId ? `fixed (${cfg.agentId})` : "auto-detect (all agents)"}`);
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
              console.log(`\n  ✗ Connection failed: ${error.message}\n`);
              return;
            }

            console.log(`  ✓ Found ${(data || []).length} agents\n`);
            for (const agent of data || []) {
              const marker = agent.id === cfg.agentId ? " ← PINNED" : "";
              console.log(`    ${agent.id} — ${agent.name} (${agent.status})${marker}`);
            }

            const { count } = await sb
              .from("tasks")
              .select("id", { count: "exact", head: true })
              .eq("user_id", cfg.userId);

            console.log(`\n  Tasks accessible: ${count ?? 0}`);
            console.log("\n  Status: healthy ✓\n");
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            console.log(`\n  ✗ Connection failed: ${msg}`);
            console.log("\n  Possible causes:");
            console.log("    - Invalid Supabase URL or service key");
            console.log("    - Network issue reaching Supabase");
            console.log("    - Invalid user ID\n");
          }
        });
    },
    // Descriptors enable lazy registration and root help text
    {
      descriptors: [
        {
          name: "ofiere",
          description: "Manage Ofiere PM dashboard integration (setup, status, diagnostics)",
          hasSubcommands: true,
        },
      ],
    },
  );
}
