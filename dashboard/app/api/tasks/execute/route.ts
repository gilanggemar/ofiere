/**
 * POST /api/tasks/execute
 *
 * Manual task execution trigger. Receives { taskId } and dispatches the task
 * to the assigned agent via the Supabase Edge Function (task-dispatcher).
 *
 * Unlike cron dispatch (fire-and-forget), manual dispatch returns the
 * dispatch result synchronously so the UI can show feedback.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { taskId } = await request.json();
        if (!taskId) {
            return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
        }

        // Verify the task belongs to this user
        const { data: task, error: taskError } = await db
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .eq('user_id', userId)
            .single();

        if (taskError || !task) {
            return NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }

        if (!task.agent_id) {
            return NextResponse.json({ error: 'Task has no assigned agent' }, { status: 400 });
        }

        // Call the Edge Function for single-task dispatch
        const edgeFnUrl = `${SUPABASE_URL}/functions/v1/task-dispatcher`;
        const dispatchRes = await fetch(edgeFnUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({ taskId }),
        });

        const result = await dispatchRes.json().catch(() => ({}));

        if (!dispatchRes.ok) {
            console.error('[Execute] Edge Function error:', result);
            return NextResponse.json({
                error: result.error || 'Dispatch failed',
                details: result.details,
            }, { status: 500 });
        }

        return NextResponse.json({
            ok: true,
            message: `Task "${task.title}" dispatched to agent ${task.agent_id}`,
            ...result,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Execute] Error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
