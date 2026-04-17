import { z } from "zod";
import type { HecateConfig } from "./types.js";

export const HecateConfigSchema = z.object({
  enabled: z.boolean().default(true),
  supabaseUrl: z.string().default(""),
  serviceRoleKey: z.string().default(""),
  userId: z.string().default(""),
  agentId: z.string().default(""),
});

export function parseHecateConfig(value: unknown): HecateConfig {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  const configObj = raw.config as Record<string, unknown> | undefined;

  // Support both nested (config.supabaseUrl) and flat (supabaseUrl) access
  // Also fall back to env vars
  const supabaseUrl =
    (typeof configObj?.supabaseUrl === "string" && configObj.supabaseUrl.trim()) ||
    (typeof raw.supabaseUrl === "string" && raw.supabaseUrl.trim()) ||
    process.env.HECATE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "";

  const serviceRoleKey =
    (typeof configObj?.serviceRoleKey === "string" && configObj.serviceRoleKey.trim()) ||
    (typeof raw.serviceRoleKey === "string" && raw.serviceRoleKey.trim()) ||
    process.env.HECATE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "";

  const userId =
    (typeof configObj?.userId === "string" && configObj.userId.trim()) ||
    (typeof raw.userId === "string" && raw.userId.trim()) ||
    process.env.HECATE_USER_ID ||
    "";

  const agentId =
    (typeof configObj?.agentId === "string" && configObj.agentId.trim()) ||
    (typeof raw.agentId === "string" && raw.agentId.trim()) ||
    process.env.HECATE_AGENT_ID ||
    "";

  return HecateConfigSchema.parse({
    ...raw,
    supabaseUrl,
    serviceRoleKey,
    userId,
    agentId,
  });
}
