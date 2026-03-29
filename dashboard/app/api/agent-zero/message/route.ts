import { NextResponse } from 'next/server';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { logTelemetry } from '@/lib/telemetry/logger';
import { createTelemetryEntry } from '@/lib/telemetry/costs';
import { getAuthUserId } from '@/lib/auth';
import { fetchAgentZero, normalizeBaseUrl } from '@/lib/agentZeroProxy';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { message, context_id } = body;

        if (!message || typeof message !== 'string' || message.trim() === '') {
            return NextResponse.json(
                { error: 'Message is required' },
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const { agentZero } = await resolveActiveConnection();
        const AGENT_ZERO_URL = agentZero.baseUrl;
        const AGENT_ZERO_API_KEY = agentZero.apiKey;

        if (!agentZero.enabled || !AGENT_ZERO_URL || !AGENT_ZERO_API_KEY) {
            return NextResponse.json(
                { error: 'Agent Zero is not configured. Go to Settings → Connection Profiles to set up your Agent Zero connection.' },
                { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const { attachments, lifetime_hours = 24, project } = body;

        const requestBody: Record<string, any> = {
            message,
            lifetime_hours,
        };
        if (context_id) requestBody.context_id = context_id;
        if (attachments) requestBody.attachments = attachments;
        if (project) requestBody.project = project;

        const startTime = Date.now();

        const result = await fetchAgentZero({
            baseUrl: AGENT_ZERO_URL,
            apiKey: AGENT_ZERO_API_KEY,
            endpoint: 'message',
            method: 'POST',
            body: requestBody,
            timeoutMs: 300000, // 5 min — A0 can take a while
        });

        const latencyMs = Date.now() - startTime;

        if (!result.ok) {
            console.error(`[Agent Zero Proxy] Message failed:`, result.errorText);

            // Log error telemetry
            try {
                await logTelemetry(createTelemetryEntry({
                    agentId: 'agent-zero',
                    provider: 'agent-zero',
                    model: 'agent-zero',
                    inputTokens: 0,
                    outputTokens: 0,
                    latencyMs,
                    status: 'error',
                    errorMessage: result.errorText || 'Unknown error',
                }));
            } catch (e) { /* ignore telemetry errors */ }

            // Provide actionable error messages
            let userError = result.errorText || 'Unknown error';
            if (result.status === 401 || result.status === 403) {
                userError = 'API key is invalid or expired. Go to Settings → Connection Profiles and update your Agent Zero API key.';
            } else if (result.status === 0) {
                userError = 'Agent Zero is not reachable. Check that the Base URL in Settings → Connection Profiles is correct and Agent Zero is running.';
            }

            return NextResponse.json(
                { error: userError, details: result.errorText },
                { status: result.status || 503, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const fwData = result.data;

        // Log success telemetry
        try {
            const inputTokens = fwData.usage?.input_tokens || fwData.tokens_in || 0;
            const outputTokens = fwData.usage?.output_tokens || fwData.tokens_out || 0;
            await logTelemetry(createTelemetryEntry({
                agentId: 'agent-zero',
                provider: 'agent-zero',
                model: fwData.model || 'agent-zero',
                inputTokens,
                outputTokens,
                latencyMs,
                status: 'success',
            }));
        } catch (e) { /* ignore telemetry errors */ }

        if (result.discoveredPath) {
            console.log(`[Agent Zero Proxy] Using message endpoint: ${result.discoveredPath}`);
        }

        return NextResponse.json(
            { response: fwData.response, context_id: fwData.context_id },
            { status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }
        );

    } catch (error: any) {
        console.error('[Agent Zero Proxy] Message proxy error:', error);

        return NextResponse.json(
            { error: "Agent Zero is not reachable. Check your connection settings.", details: error.message },
            { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}
