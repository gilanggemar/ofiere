import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabase(supabaseUrl: string, serviceRoleKey: string): SupabaseClient {
  if (_client) return _client;

  _client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  return _client;
}
