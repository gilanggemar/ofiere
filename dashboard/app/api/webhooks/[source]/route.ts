import { NextResponse } from 'next/server';
import { createNotification } from '@/lib/notifications/engine';
import { getAuthUserId } from '@/lib/auth';

// POST /api/webhooks/[source] — receive incoming webhook
export async function POST(
    request: Request,
    { params }: { params: Promise<{ source: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { source } = await params;
    try {
        const payload = await request.json();

        // Create a notification for the webhook event
        await createNotification(
            userId,
            'info',
            `Webhook: ${source}`,
            `Received ${payload.action || payload.event || 'event'} from ${source}`,
            undefined,
            undefined
        );

        return NextResponse.json({ received: true });
    } catch (error: unknown) {
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
