/**
 * resolveActiveConnection.ts
 *
 * Server-side helper that returns the active connection configuration.
 * SAFETY: Always falls back to environment variables if:
 *   - No active profile exists in the database
 *   - Database read fails
 *   - A service is disabled in the profile
 */

import { db } from './db';
import { decrypt } from './encryption';
import { getAuthUserId } from './auth';
import { normalizeBaseUrl } from './agentZeroProxy';

export interface ResolvedOpenClaw {
    enabled: boolean;
    wsUrl: string;
    httpUrl: string;
    token: string;
}

export interface ResolvedAgentZero {
    enabled: boolean;
    baseUrl: string;
    apiKey: string;
    transport: string;
}

export interface ResolvedConnection {
    profileName: string;
    openclaw: ResolvedOpenClaw;
    agentZero: ResolvedAgentZero;
}

// ── ENV VAR DEFAULTS (guaranteed fallback) ──

function envFallback(): ResolvedConnection {
    return {
        profileName: '(env vars)',
        openclaw: {
            enabled: true,
            wsUrl: process.env.NEXT_PUBLIC_OPENCLAW_WS_URL || process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_URL || 'ws://127.0.0.1:18789',
            httpUrl: process.env.NEXT_PUBLIC_OPENCLAW_HTTP_URL || 'http://127.0.0.1:18789',
            token: process.env.OPENCLAW_AUTH_TOKEN || process.env.NEXT_PUBLIC_OPENCLAW_GATEWAY_TOKEN || '',
        },
        agentZero: {
            enabled: !!process.env.AGENT_ZERO_URL,
            baseUrl: normalizeBaseUrl(process.env.AGENT_ZERO_URL || process.env.NEXT_PUBLIC_AGENT_ZERO_BASE_URL || 'http://127.0.0.1:80'),
            apiKey: process.env.AGENT_ZERO_API_KEY || '',
            transport: 'rest',
        },
    };
}

/**
 * Resolves the active connection profile from the database.
 * Falls back to env vars on any failure.
 */
export async function resolveActiveConnection(providedUserId?: string): Promise<ResolvedConnection> {
    try {
        const userId = providedUserId || await getAuthUserId();

        if (!userId) {
            console.warn('[resolveActiveConnection] No userId found, using env vars');
            return envFallback();
        }

        const { data: profiles } = await db
            .from('connection_profiles')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1);

        if (!profiles || profiles.length === 0) {
            // New or unconfigured user. Do NOT leak global env vars to them.
            return {
                profileName: 'Unconfigured',
                openclaw: { enabled: false, wsUrl: '', httpUrl: '', token: '' },
                agentZero: { enabled: false, baseUrl: '', apiKey: '', transport: 'rest' }
            };
        }

        const p = profiles[0];
        const fallback = envFallback();

        return {
            profileName: p.name,
            openclaw: {
                enabled: p.openclaw_enabled,
                wsUrl: p.openclaw_ws_url || fallback.openclaw.wsUrl,
                httpUrl: p.openclaw_http_url || fallback.openclaw.httpUrl,
                token: decrypt(p.openclaw_auth_token) || fallback.openclaw.token,
            },
            agentZero: {
                enabled: p.agent_zero_enabled,
                baseUrl: normalizeBaseUrl(p.agent_zero_base_url || fallback.agentZero.baseUrl),
                apiKey: decrypt(p.agent_zero_api_key) || fallback.agentZero.apiKey,
                transport: p.agent_zero_transport || 'rest',
            },
        };
    } catch (err) {
        console.warn('[resolveActiveConnection] DB read failed, using env vars:', err);
        return envFallback();
    }
}
