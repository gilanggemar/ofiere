import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// GET /api/workflows/[id]
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const { id } = await params;
    try {
        const { data: row, error } = await db.from('workflows').select('*').eq('user_id', userId).eq('id', id).single();
        if (error || !row) return NextResponse.json({ error: 'Not found' }, { status: 404 });
        // steps and schedule are already parsed (jsonb)
        return NextResponse.json(row);
    } catch (error: unknown) {
        console.error('Failed to get workflow:', error);
        return NextResponse.json({ error: 'Failed to get workflow' }, { status: 500 });
    }
}

// PUT /api/workflows/[id]
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const { id } = await params;
    try {
        const body = await request.json();
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

        if (body.name) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.steps) updates.steps = body.steps; // jsonb — pass as object
        if (body.schedule !== undefined) updates.schedule = body.schedule || null;
        if (body.status) updates.status = body.status;
        if (body.nodes !== undefined) updates.nodes = body.nodes;
        if (body.edges !== undefined) updates.edges = body.edges;

        await db.from('workflows').update(updates).eq('id', id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to update workflow:', error);
        return NextResponse.json({ error: 'Failed to update workflow' }, { status: 500 });
    }
}

// DELETE /api/workflows/[id]
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const { id } = await params;
    try {
        // Cascade should handle runs, but be explicit
        await db.from('workflow_runs').delete().eq('user_id', userId).eq('workflow_id', id);
        await db.from('workflows').delete().eq('user_id', userId).eq('id', id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to delete workflow:', error);
        return NextResponse.json({ error: 'Failed to delete workflow' }, { status: 500 });
    }
}
