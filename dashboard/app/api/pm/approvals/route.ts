import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET approvals ───────────────────────────────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        let query = db
            .from('pm_approvals')
            .select('*')
            .order('created_at', { ascending: false });

        if (taskId) query = query.eq('task_id', taskId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ approvals: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create approval request ────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const id = `appr-${Date.now()}`;

        const insertData = {
            id,
            task_id: body.task_id,
            approver_type: body.approver_type || 'human',
            approver_name: body.approver_name || 'You',
            status: 'pending',
            due_date: body.due_date || null,
            comment: body.comment || null,
            file_ids: body.file_ids || [],
        };

        const { error } = await db.from('pm_approvals').insert(insertData);
        if (error) throw new Error(error.message);

        return NextResponse.json({ id, approval: insertData }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH resolve approval ──────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing approval id' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (body.status !== undefined) updates.status = body.status;
        if (body.comment !== undefined) updates.comment = body.comment;
        if (['approved', 'rejected'].includes(body.status)) {
            updates.resolved_at = new Date().toISOString();
        }

        const { error } = await db
            .from('pm_approvals')
            .update(updates)
            .eq('id', body.id);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
