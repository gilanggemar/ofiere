import { NextResponse } from 'next/server';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAuthUserId } from '@/lib/auth';
import { fetchAgentZero } from '@/lib/agentZeroProxy';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { agentZero } = await resolveActiveConnection();

    if (!agentZero.enabled || !agentZero.baseUrl || !agentZero.apiKey) {
        return NextResponse.json({ error: 'Agent Zero is not configured' }, { status: 503 });
    }

    try {
        const body = await request.json();
        const { context_id } = body;

        if (!context_id) {
            return NextResponse.json({ error: 'context_id is required' }, { status: 400 });
        }

        const result = await fetchAgentZero({
            baseUrl: agentZero.baseUrl,
            apiKey: agentZero.apiKey,
            endpoint: 'terminate',
            method: 'POST',
            body: { context_id },
            timeoutMs: 10000,
        });

        if (!result.ok) {
            return NextResponse.json(
                { error: result.errorText || `Agent Zero returned status ${result.status}` },
                { status: result.status || 503 }
            );
        }

        return NextResponse.json(result.data, { status: 200 });
    } catch (error: any) {
        console.error('[Agent Zero Proxy] Terminate error:', error.message);
        return NextResponse.json(
            { error: 'Agent Zero is not reachable', details: error.message },
            { status: 503 }
        );
    }
}
