import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET dependencies for a task or all ──────────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('task_id');

        let query = db
            .from('pm_dependencies')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        // If task_id provided, get dependencies where this task is either predecessor or successor
        if (taskId) {
            query = db
                .from('pm_dependencies')
                .select('*')
                .eq('user_id', userId)
                .or(`predecessor_id.eq.${taskId},successor_id.eq.${taskId}`)
                .order('created_at', { ascending: false });
        }

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ dependencies: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create dependency ─────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { predecessor_id, successor_id, dependency_type, lag_days } = body;

        if (!predecessor_id || !successor_id) {
            return NextResponse.json({ error: 'Both predecessor_id and successor_id are required' }, { status: 400 });
        }

        if (predecessor_id === successor_id) {
            return NextResponse.json({ error: 'A task cannot depend on itself' }, { status: 400 });
        }

        const id = `dep-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const { error } = await db.from('pm_dependencies').insert({
            id,
            user_id: userId,
            predecessor_id,
            successor_id,
            dependency_type: dependency_type || 'finish_to_start',
            lag_days: lag_days || 0,
        });

        if (error) {
            if (error.message?.includes('unique_dependency')) {
                return NextResponse.json({ error: 'This dependency already exists' }, { status: 409 });
            }
            throw new Error(error.message);
        }

        return NextResponse.json({ id }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update dependency (e.g. change type or lag) ──────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing dependency id' }, { status: 400 });

        const updates: Record<string, any> = {};
        if (body.dependency_type !== undefined) updates.dependency_type = body.dependency_type;
        if (body.lag_days !== undefined) updates.lag_days = body.lag_days;

        const { error } = await db
            .from('pm_dependencies')
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

// ─── DELETE remove dependency ───────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing dependency id' }, { status: 400 });

        const { error } = await db
            .from('pm_dependencies')
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
