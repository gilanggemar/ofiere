import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// Priority mapping: DB stores integers, frontend uses string labels
const PRIORITY_TO_LABEL: Record<number, string> = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL' };
const LABEL_TO_PRIORITY: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// ─── GET all tasks for the authenticated user ────────────────────────────────

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Map DB rows to frontend Task shape
        const tasks = (data || []).map((row: any) => ({
            id: row.id,
            title: row.title,
            description: row.description || undefined,
            agentId: row.agent_id || '',
            status: row.status || 'PENDING',
            priority: PRIORITY_TO_LABEL[row.priority] || 'LOW',
            logs: [],
            toolCalls: [],
            updatedAt: new Date(row.updated_at).getTime(),
            timestamp: new Date(row.updated_at).toLocaleTimeString(),
        }));

        return NextResponse.json({ tasks });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('GET /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create a new task ──────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const priorityVal = LABEL_TO_PRIORITY[String(body.priority || 'LOW').toUpperCase()] ?? 0;

        const insertData: Record<string, any> = {
            id,
            user_id: userId,
            agent_id: body.agentId || null,
            title: body.title,
            description: body.description || null,
            status: body.status || 'PENDING',
            priority: priorityVal,
        };

        const { error } = await db.from('tasks').insert(insertData);

        if (error) {
            // FK violation on agent_id — retry with null
            if (error.message?.includes('agent_id') || error.message?.includes('foreign key')) {
                console.warn('POST /api/tasks FK violation on agent_id, retrying with null');
                insertData.agent_id = null;
                const retry = await db.from('tasks').insert(insertData);
                if (retry.error) throw new Error(retry.error.message);
                return NextResponse.json({ id }, { status: 201 });
            }
            console.error('POST /api/tasks Supabase error:', error.message, error.details);
            throw new Error(error.message);
        }

        return NextResponse.json({ id }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('POST /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update a task ─────────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.status !== undefined) updates.status = body.status;
        if (body.agentId !== undefined) updates.agent_id = body.agentId;
        if (body.priority !== undefined) {
            updates.priority = LABEL_TO_PRIORITY[String(body.priority).toUpperCase()] ?? 0;
        }
        if (body.status === 'DONE') updates.completed_at = new Date().toISOString();

        const { error } = await db
            .from('tasks')
            .update(updates)
            .eq('id', body.id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('PATCH /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE a task ───────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        const { error } = await db
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('DELETE /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
