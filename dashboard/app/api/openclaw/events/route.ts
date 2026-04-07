// POST /api/openclaw/events — Receive tool-call events from plugin
// GET  /api/openclaw/events — SSE stream to push events to dashboard
//
// Auth: Bearer token in Authorization header (validated against OPENCLAW_WEBHOOK_SECRET)

import { NextRequest, NextResponse } from 'next/server';
import { emitToolEvent, onToolEvent, type ToolCallWebhookEvent } from '@/lib/toolEventBus';

const WEBHOOK_SECRET = process.env.OPENCLAW_WEBHOOK_SECRET || process.env.NERV_WEBHOOK_SECRET || 'nerv-dev-secret';

function validateAuth(req: NextRequest): boolean {
    const authHeader = req.headers.get('authorization') || '';
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7) === WEBHOOK_SECRET;
    }
    // Also accept X-Webhook-Secret header
    const webhookSecret = req.headers.get('x-webhook-secret') || '';
    return webhookSecret === WEBHOOK_SECRET;
}

// ─── POST: Receive tool-call events from OpenClaw plugin ───

export async function POST(req: NextRequest) {
    // Auth check
    if (!validateAuth(req)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();

        // Support both single event and batch
        const events: ToolCallWebhookEvent[] = Array.isArray(body) ? body : [body];

        let accepted = 0;
        for (const event of events) {
            // Validate required fields
            if (!event.type || !event.callId || !event.runId || !event.toolName) {
                console.warn('[Webhook] Skipping invalid event:', event);
                continue;
            }

            // Normalize
            const normalized: ToolCallWebhookEvent = {
                type: event.type,
                callId: event.callId,
                runId: event.runId,
                agentId: event.agentId || 'unknown',
                sessionKey: event.sessionKey || `agent:${event.agentId || 'unknown'}:main`,
                toolName: event.toolName,
                input: event.input,
                output: event.output,
                error: event.error,
                progress: event.progress,
                timestamp: event.timestamp || new Date().toISOString(),
                meta: event.meta,
            };

            // Broadcast to all SSE subscribers
            emitToolEvent(normalized);
            accepted++;
        }

        return NextResponse.json({ ok: true, accepted }, { status: 200 });
    } catch (err: any) {
        console.error('[Webhook] Parse error:', err);
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
}

// ─── GET: SSE stream for real-time tool-call events ───

export async function GET(req: NextRequest) {
    // Auth check (optional for SSE — can be opened by the dashboard without auth)
    // If you want to secure the SSE stream, uncomment the auth check below:
    // if (!validateAuth(req)) {
    //     return new Response('Unauthorized', { status: 401 });
    // }

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
        start(controller) {
            // Send initial keepalive
            controller.enqueue(encoder.encode(': connected\n\n'));

            // Subscribe to tool events
            const unsubscribe = onToolEvent((event) => {
                try {
                    const data = JSON.stringify(event);
                    controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (err) {
                    console.error('[SSE] Error encoding event:', err);
                }
            });

            // Keepalive ping every 15s
            const keepalive = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': ping\n\n'));
                } catch {
                    clearInterval(keepalive);
                }
            }, 15_000);

            // Cleanup on close
            req.signal.addEventListener('abort', () => {
                unsubscribe();
                clearInterval(keepalive);
                try { controller.close(); } catch { /* already closed */ }
            });
        },
    });

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}
