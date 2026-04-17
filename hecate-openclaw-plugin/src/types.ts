export interface OfiereConfig {
  enabled: boolean;
  supabaseUrl: string;
  serviceRoleKey: string;
  userId: string;
  /** Optional — if not set, agent identity is resolved at runtime from OpenClaw context */
  agentId: string;
}
