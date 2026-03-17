import { NextResponse } from 'next/server';

/**
 * POST /api/openclaw-health
 * Server-side proxy to fetch health from the OpenClaw gateway.
 * Avoids CORS issues when the gateway is on a different origin (e.g. VPS via Tailscale).
 */
export async function POST(request: Request) {
    try {
        const { httpUrl, token } = await request.json();
        if (!httpUrl) {
            return NextResponse.json({ error: 'Missing httpUrl' }, { status: 400 });
        }

        const baseUrl = httpUrl.replace(/\/+$/, '');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`${baseUrl}/health`, {
            headers,
            signal: AbortSignal.timeout(5000),
        });

        if (!res.ok) {
            return NextResponse.json({ error: `Gateway returned ${res.status}` }, { status: 502 });
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('[/api/openclaw-health] Proxy error:', error?.message);
        return NextResponse.json({ error: 'Health fetch failed' }, { status: 502 });
    }
}
