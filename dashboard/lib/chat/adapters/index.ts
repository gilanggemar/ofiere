// ─── Agent Adapter Registry ──────────────────────────────────────────────────
// Maps agent IDs to their respective adapters.
// OpenClaw agents use their accountId (e.g. "ivy", "rex", "kai").
// Agent Zero is always "agent-zero".

import type { AgentAdapter } from './types';
import { openClawAdapter } from './openClawAdapter';
import { agentZeroAdapter } from './agentZeroAdapter';

/**
 * Get the adapter for a given agent ID.
 * Returns the OpenClaw adapter by default (most agents are OpenClaw).
 */
export function getAdapterForAgent(agentId: string): AgentAdapter {
    if (agentId === 'agent-zero') {
        return agentZeroAdapter;
    }
    // All other agents (ivy, rex, kai, etc.) go through OpenClaw
    return openClawAdapter;
}
