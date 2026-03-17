import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/chat/conversations/:id
 * Fetch a single conversation (verifies ownership).
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        const { data, error } = await db
            .from('conversations')
            .select('*')
            .eq('user_id', userId)
            .eq('id', id)
            .single();

        if (error || !data) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        return NextResponse.json({ conversation: data });
    } catch (error: unknown) {
        console.error('[chat/conversations/:id GET]', error);
        return NextResponse.json({ error: 'Failed to get conversation' }, { status: 500 });
    }
}

/**
 * PATCH /api/chat/conversations/:id
 * Update conversation fields: title, pinned, archived, mission_config.
 */
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        const body = await request.json();
        const allowed = ['title', 'pinned', 'archived', 'mission_config', 'project_id'] as const;
        const updates: Record<string, any> = {};
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await db
            .from('conversations')
            .update(updates)
            .eq('user_id', userId)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ conversation: data });
    } catch (error: unknown) {
        console.error('[chat/conversations/:id PATCH]', error);
        return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }
}

/**
 * DELETE /api/chat/conversations/:id
 * Delete conversation and all messages (CASCADE handles messages).
 */
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        // Delete messages first (in case CASCADE isn't set up)
        await db
            .from('conversation_messages')
            .delete()
            .eq('conversation_id', id);

        const { error } = await db
            .from('conversations')
            .delete()
            .eq('user_id', userId)
            .eq('id', id);

        if (error) throw new Error(error.message);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('[chat/conversations/:id DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
}
