import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { clearPathCache } from '@/lib/agentZeroProxy';

/**
 * POST /api/agent-zero/csrf
 * Clears the endpoint discovery cache so fresh probing happens on next request.
 * Called after saving connection profile settings.
 */
export async function POST() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    clearPathCache();
    return NextResponse.json({ success: true, message: 'Endpoint cache cleared' });
}
