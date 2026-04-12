import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET time entries ────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        let query = db
            .from('pm_time_entries')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (taskId) query = query.eq('task_id', taskId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ entries: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create/start time entry ────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const id = `te-${Date.now()}`;

        const insertData = {
            id,
            user_id: userId,
            task_id: body.task_id,
            start_time: body.start_time || new Date().toISOString(),
            end_time: body.end_time || null,
            duration_minutes: body.duration_minutes || null,
            description: body.description || '',
            is_manual: body.is_manual || false,
            is_running: body.is_running ?? !body.end_time,
        };

        const { error } = await db.from('pm_time_entries').insert(insertData);
        if (error) throw new Error(error.message);

        return NextResponse.json({ id, entry: insertData }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update/stop time entry ────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing entry id' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (body.end_time !== undefined) updates.end_time = body.end_time;
        if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes;
        if (body.description !== undefined) updates.description = body.description;
        if (body.is_running !== undefined) updates.is_running = body.is_running;

        const { error } = await db
            .from('pm_time_entries')
            .update(updates)
            .eq('id', body.id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE time entry ───────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { error } = await db
            .from('pm_time_entries')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
