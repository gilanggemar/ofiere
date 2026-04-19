/**
 * GET /api/tasks/dispatch-log
 *
 * Returns recent dispatch logs for the authenticated user.
 * Supports optional filters: ?taskId=xxx&limit=50
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('taskId');
        const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

        let query = db
            .from('task_dispatch_log')
            .select('*')
            .eq('user_id', userId)
            .order('dispatched_at', { ascending: false })
            .limit(limit);

        if (taskId) {
            query = query.eq('task_id', taskId);
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({
            logs: data || [],
            count: (data || []).length,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('GET /api/tasks/dispatch-log error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
