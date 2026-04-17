// src/agent-resolver.ts — Dynamic agent identity resolution
// Resolves an OpenClaw account name (e.g. "ivy") to a Ofiere agent UUID.
// Caches lookups so only the first call per agent hits Supabase.
// Auto-registers unknown agents so multi-agent setups work out of the box.

import type { SupabaseClient } from "@supabase/supabase-js";

const cache = new Map<string, string>();

/**
 * Resolves an OpenClaw accountId to a Ofiere agent UUID.
 *
 * Strategy:
 *   1. Check in-memory cache
 *   2. Look up by name (case-insensitive) in agents table
 *   3. If not found, auto-register a new agent record
 *   4. Cache the result for subsequent calls
 *
 * @param accountId - The OpenClaw account name (e.g. "ivy", "daisy")
 * @param userId    - The Ofiere user UUID who owns this agent
 * @param supabase  - Supabase client
 * @returns The Ofiere agent UUID
 */
export async function resolveAgentId(
  accountId: string,
  userId: string,
  supabase: SupabaseClient,
): Promise<string> {
  if (!accountId) return "";

  const cacheKey = `${userId}:${accountId}`;

  // 1. Cache hit
  if (cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // 2. Look up by name (case-insensitive)
  const { data: existing } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", accountId)
    .limit(1)
    .single();

  if (existing?.id) {
    cache.set(cacheKey, existing.id);
    return existing.id;
  }

  // 3. Also try matching by codename
  const { data: byCodename } = await supabase
    .from("agents")
    .select("id")
    .eq("user_id", userId)
    .ilike("codename", accountId)
    .limit(1)
    .single();

  if (byCodename?.id) {
    cache.set(cacheKey, byCodename.id);
    return byCodename.id;
  }

  // 4. Auto-register a new agent
  const newId = `agent-${accountId.toLowerCase()}-${Date.now()}`;
  const { data: created } = await supabase
    .from("agents")
    .insert({
      id: newId,
      user_id: userId,
      name: accountId.charAt(0).toUpperCase() + accountId.slice(1).toLowerCase(),
      codename: accountId.toLowerCase(),
      status: "active",
      role: "operative",
      level: 1,
      xp: 0,
      created_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  const resolvedId = created?.id || newId;
  cache.set(cacheKey, resolvedId);
  return resolvedId;
}

/**
 * Pre-warm the cache with a known mapping.
 * Used when OFIERE_AGENT_ID env var is set (legacy single-agent mode).
 */
export function seedAgentCache(accountId: string, userId: string, agentId: string): void {
  if (accountId && agentId) {
    cache.set(`${userId}:${accountId}`, agentId);
  }
}

/**
 * Clear the cache (useful for testing).
 */
export function clearAgentCache(): void {
  cache.clear();
}
