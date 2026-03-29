import { NextResponse } from 'next/server';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAuthUserId } from '@/lib/auth';
import { fetchAgentZero } from '@/lib/agentZeroProxy';

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { agentZero } = await resolveActiveConnection();

    if (!agentZero.enabled || !agentZero.baseUrl || !agentZero.apiKey) {
        return NextResponse.json({ error: 'Agent Zero is not configured' }, { status: 503 });
    }

    const result = await fetchAgentZero({
        baseUrl: agentZero.baseUrl,
        apiKey: agentZero.apiKey,
        endpoint: 'poll',
        method: 'GET',
        timeoutMs: 5000,
    });

    if (!result.ok) {
        return NextResponse.json(
            { error: result.errorText || `Agent Zero returned status ${result.status}` },
            { status: result.status || 503 }
        );
    }

    return NextResponse.json(result.data, { status: 200 });
}
