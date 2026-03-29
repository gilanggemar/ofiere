import { NextResponse } from 'next/server';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAuthUserId } from '@/lib/auth';
import { probeAgentZeroHealth } from '@/lib/agentZeroProxy';

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { agentZero } = await resolveActiveConnection();
    const AGENT_ZERO_URL = agentZero.baseUrl;
    const AGENT_ZERO_API_KEY = agentZero.apiKey;

    if (!agentZero.enabled || !AGENT_ZERO_URL) {
        return NextResponse.json(
            { status: 'unconfigured', message: 'Agent Zero is not enabled in the active connection profile' },
            { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    const probe = await probeAgentZeroHealth(AGENT_ZERO_URL, AGENT_ZERO_API_KEY);

    if (!probe.reachable) {
        return NextResponse.json(
            {
                status: 'offline',
                error: probe.error || 'Connection failed',
                timestamp: Date.now(),
                latencyMs: probe.latencyMs,
            },
            { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    if (!probe.authenticated) {
        return NextResponse.json(
            {
                status: 'auth_failed',
                error: probe.error || 'Authentication failed',
                url: AGENT_ZERO_URL,
                timestamp: Date.now(),
                latencyMs: probe.latencyMs,
                workingMessagePath: probe.workingMessagePath,
            },
            { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }

    return NextResponse.json(
        {
            status: 'online',
            url: AGENT_ZERO_URL,
            timestamp: Date.now(),
            latencyMs: probe.latencyMs,
            workingMessagePath: probe.workingMessagePath,
        },
        { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
    );
}
