import { NextResponse } from 'next/server';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAuthUserId } from '@/lib/auth';
import { fetchAgentZero } from '@/lib/agentZeroProxy';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { paths } = body;

        if (!paths || !Array.isArray(paths) || paths.length === 0) {
            return NextResponse.json(
                { error: 'A non-empty array of paths is required' },
                { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const { agentZero } = await resolveActiveConnection();

        if (!agentZero.enabled || !agentZero.baseUrl || !agentZero.apiKey) {
            return NextResponse.json(
                { error: 'Agent Zero is not configured' },
                { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        const result = await fetchAgentZero({
            baseUrl: agentZero.baseUrl,
            apiKey: agentZero.apiKey,
            endpoint: 'files',
            method: 'POST',
            body: { paths },
            timeoutMs: 30000,
        });

        if (!result.ok) {
            return NextResponse.json(
                { error: result.errorText || `Agent Zero returned status ${result.status}` },
                { status: result.status || 503, headers: { 'Access-Control-Allow-Origin': '*' } }
            );
        }

        return NextResponse.json(result.data, {
            status: 200,
            headers: { 'Access-Control-Allow-Origin': '*' },
        });
    } catch (error: any) {
        console.error('[Agent Zero Proxy] Files proxy error:', error);
        return NextResponse.json(
            { error: 'Agent Zero is not reachable', details: error.message },
            { status: 503, headers: { 'Access-Control-Allow-Origin': '*' } }
        );
    }
}
