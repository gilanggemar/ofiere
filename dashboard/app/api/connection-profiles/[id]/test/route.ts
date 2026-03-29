import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { decrypt } from '@/lib/encryption';
import { getAuthUserId } from '@/lib/auth';
import { probeAgentZeroHealth, normalizeBaseUrl, clearPathCache } from '@/lib/agentZeroProxy';

interface TestResult {
    openclaw: {
        tested: boolean;
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
        wsHandshake: boolean;
    };
    agentZero: {
        tested: boolean;
        reachable: boolean;
        latencyMs: number | null;
        error: string | null;
        apiKeyValid: boolean;
        detectedEndpoint: string | null;
        diagnostics: string | null;
    };
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data: profile, error } = await db.from('connection_profiles').select('*').eq('user_id', userId).eq('id', id).single();
    if (error || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const result: TestResult = {
        openclaw: { tested: false, reachable: false, latencyMs: null, error: null, wsHandshake: false },
        agentZero: { tested: false, reachable: false, latencyMs: null, error: null, apiKeyValid: false, detectedEndpoint: null, diagnostics: null },
    };

    // --- Test OpenClaw ---
    if (profile.openclaw_enabled) {
        result.openclaw.tested = true;
        const startOC = Date.now();
        try {
            const httpUrl = profile.openclaw_http_url;
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const headers: Record<string, string> = { 'Content-Type': 'application/json' };
            const token = decrypt(profile.openclaw_auth_token);
            if (token && profile.openclaw_auth_mode === 'token') {
                headers['Authorization'] = `Bearer ${token}`;
            }

            const resp = await fetch(httpUrl, { headers, signal: controller.signal });
            clearTimeout(timeout);

            result.openclaw.latencyMs = Date.now() - startOC;
            result.openclaw.reachable = resp.ok || resp.status === 401 || resp.status === 403;
            if (resp.ok) {
                result.openclaw.wsHandshake = true;
            } else if (resp.status === 401 || resp.status === 403) {
                result.openclaw.error = 'Server reachable but authentication failed. Check your token.';
            }
        } catch (err: any) {
            result.openclaw.latencyMs = Date.now() - startOC;
            result.openclaw.error = err.name === 'AbortError'
                ? 'Connection timed out after 8 seconds.'
                : `Connection failed: ${err.message}`;
        }
    }

    // --- Test Agent Zero (comprehensive probe) ---
    if (profile.agent_zero_enabled) {
        result.agentZero.tested = true;
        const baseUrl = normalizeBaseUrl(profile.agent_zero_base_url || '');
        const apiKey = decrypt(profile.agent_zero_api_key) || '';

        // Clear any cached paths so we do a fresh probe
        clearPathCache(baseUrl);

        if (!baseUrl) {
            result.agentZero.error = 'Base URL is empty. Enter your Agent Zero URL.';
        } else {
            const probe = await probeAgentZeroHealth(baseUrl, apiKey);
            result.agentZero.latencyMs = probe.latencyMs;
            result.agentZero.reachable = probe.reachable;
            result.agentZero.apiKeyValid = probe.authenticated;
            result.agentZero.detectedEndpoint = probe.workingMessagePath || null;

            if (!probe.reachable) {
                result.agentZero.error = probe.error || 'Cannot reach Agent Zero server.';
                result.agentZero.diagnostics = 'Check that the Base URL is correct and Agent Zero is running. Common issues: wrong port, firewall blocking, or Agent Zero not started.';
            } else if (!probe.authenticated) {
                result.agentZero.error = probe.error || 'Authentication failed.';
                result.agentZero.diagnostics = 'Server is reachable but API key validation failed. Get a fresh API key from Agent Zero → Settings → External Services, then paste it here.';
            } else {
                if (probe.workingMessagePath) {
                    result.agentZero.diagnostics = `Connected successfully. API endpoint: ${probe.workingMessagePath}`;
                }
            }
        }
    }

    // Update profile metadata
    const healthStatus = (() => {
        const ocOk = !profile.openclaw_enabled || result.openclaw.reachable;
        const azOk = !profile.agent_zero_enabled || result.agentZero.reachable;
        if (ocOk && azOk) return 'healthy';
        if (ocOk || azOk) return 'degraded';
        return 'offline';
    })();

    await db.from('connection_profiles').update({
        last_connected_at: new Date().toISOString(),
        last_health_status: healthStatus,
        updated_at: new Date().toISOString(),
    }).eq('user_id', userId).eq('id', id);

    return NextResponse.json(result);
}
