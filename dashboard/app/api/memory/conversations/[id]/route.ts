import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { estimateTokens } from '@/lib/memory/context';
import { getAuthUserId } from '@/lib/auth';

// GET /api/memory/conversations/[id] — get conversation with messages
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        const { data: convo, error } = await db.from('conversations').select('*').eq('user_id', userId).eq('id', id).single();
        if (error || !convo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        const { data: messages } = await db.from('conversation_messages')
            .select('*')
            .eq('conversation_id', id)
            .order('created_at', { ascending: true });

        return NextResponse.json({ ...convo, messages: messages || [] });
    } catch (error: unknown) {
        console.error('Failed to get conversation:', error);
        return NextResponse.json({ error: 'Failed to get conversation' }, { status: 500 });
    }
}

// POST /api/memory/conversations/[id] — add a message to conversation
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        const body = await request.json();
        const { role, content } = body;

        if (!role || !content) {
            return NextResponse.json({ error: 'role and content are required' }, { status: 400 });
        }

        const tokenCount = estimateTokens(content);

        await db.from('conversation_messages').insert({
            user_id: userId,
            conversation_id: id,
            role,
            content,
            token_count: tokenCount,
        });

        // Update conversation metadata
        const { count } = await db.from('conversation_messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', id);

        await db.from('conversations').update({
            updated_at: new Date().toISOString(),
            message_count: count || 0,
        }).eq('user_id', userId).eq('id', id);

        return NextResponse.json({ success: true, tokenCount }, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to add message:', error);
        return NextResponse.json({ error: 'Failed to add message' }, { status: 500 });
    }
}

// PATCH /api/memory/conversations/[id] — update conversation fields (rename, pin, archive)
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        const body = await request.json();
        const allowed = ['title', 'pinned', 'archived', 'mission_config'] as const;
        const updates: Record<string, any> = {};
        for (const key of allowed) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        if (Object.keys(updates).length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        updates.updated_at = new Date().toISOString();

        const { data, error } = await db.from('conversations')
            .update(updates)
            .eq('user_id', userId)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json(data);
    } catch (error: unknown) {
        console.error('Failed to update conversation:', error);
        return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 });
    }
}

// DELETE /api/memory/conversations/[id] — delete conversation and messages
export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    try {
        await db.from('conversation_messages').delete().eq('user_id', userId).eq('conversation_id', id);
        await db.from('conversations').delete().eq('user_id', userId).eq('id', id);
        return NextResponse.json({ success: true });
    } catch (error: unknown) {
        console.error('Failed to delete conversation:', error);
        return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 });
    }
}
