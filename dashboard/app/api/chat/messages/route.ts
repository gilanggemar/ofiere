import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/chat/messages?conversation_id={id}&branch_id={branchId}
 * Fetch messages for a conversation, ordered by created_at ASC.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const conversationId = searchParams.get('conversation_id');
        const branchId = searchParams.get('branch_id') || 'main';

        if (!conversationId) {
            return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
        }

        // Verify conversation belongs to user
        const { data: convo, error: convoErr } = await db
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('id', conversationId)
            .single();

        if (convoErr || !convo) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        const { data: messages, error } = await db
            .from('conversation_messages')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('branch_id', branchId)
            .order('sequence_number', { ascending: true })
            .order('created_at', { ascending: true });

        if (error) throw new Error(error.message);
        return NextResponse.json({ messages: messages || [] });
    } catch (error: unknown) {
        console.error('[chat/messages GET]', error);
        return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }
}

/**
 * POST /api/chat/messages
 * Create a new message in a conversation.
 * Body: { conversation_id, role, content, metadata?, branch_id? }
 * Also updates conversation's updated_at and auto-generates title on first user message.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            conversation_id,
            role,
            content,
            metadata = {},
            branch_id = 'main',
        } = body;

        if (!conversation_id || !role || content === undefined) {
            return NextResponse.json(
                { error: 'conversation_id, role, and content are required' },
                { status: 400 }
            );
        }

        // Verify conversation belongs to user
        const { data: convo, error: convoErr } = await db
            .from('conversations')
            .select('id, title, message_count')
            .eq('user_id', userId)
            .eq('id', conversation_id)
            .single();

        if (convoErr || !convo) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Rough token estimate (1 token ≈ 4 chars)
        const tokenCount = Math.ceil((content || '').length / 4);

        // Compute next sequence_number for this conversation
        let nextSeq = 1;
        try {
            const { data: maxRow } = await db
                .from('conversation_messages')
                .select('sequence_number')
                .eq('conversation_id', conversation_id)
                .order('sequence_number', { ascending: false })
                .limit(1)
                .single();
            if (maxRow?.sequence_number) {
                nextSeq = maxRow.sequence_number + 1;
            }
        } catch { /* first message — use 1 */ }

        // Insert the message
        const { data: message, error: msgErr } = await db
            .from('conversation_messages')
            .insert({
                user_id: userId,
                conversation_id,
                role,
                content,
                token_count: tokenCount,
                metadata,
                branch_id,
                sequence_number: nextSeq,
            })
            .select()
            .single();

        if (msgErr) throw new Error(msgErr.message);

        // Update conversation's updated_at + message_count
        const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
            message_count: (convo.message_count || 0) + 1,
        };

        // Auto-generate title on first user message if no title set
        if (role === 'user' && !convo.title && (convo.message_count || 0) === 0) {
            updates.title = content.slice(0, 50).trim() + (content.length > 50 ? '…' : '');
        }

        await db
            .from('conversations')
            .update(updates)
            .eq('id', conversation_id);

        return NextResponse.json({ message, title_updated: !!updates.title }, { status: 201 });
    } catch (error: unknown) {
        console.error('[chat/messages POST]', error);
        return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
    }
}

/**
 * DELETE /api/chat/messages
 * Truncate messages from a given message onward (inclusive).
 * Body: { conversation_id, from_message_id }
 * Deletes the message with from_message_id and all messages created after it.
 */
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { conversation_id, from_message_id } = body;

        if (!conversation_id || !from_message_id) {
            return NextResponse.json(
                { error: 'conversation_id and from_message_id are required' },
                { status: 400 }
            );
        }

        // Verify conversation belongs to user
        const { data: convo, error: convoErr } = await db
            .from('conversations')
            .select('id')
            .eq('user_id', userId)
            .eq('id', conversation_id)
            .single();

        if (convoErr || !convo) {
            return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
        }

        // Get the target message to find its created_at timestamp
        const { data: targetMsg, error: targetErr } = await db
            .from('conversation_messages')
            .select('id, created_at')
            .eq('id', from_message_id)
            .eq('conversation_id', conversation_id)
            .single();

        if (targetErr || !targetMsg) {
            return NextResponse.json({ error: 'Message not found' }, { status: 404 });
        }

        // Delete all messages with created_at >= target message's created_at
        const { error: deleteErr, count } = await db
            .from('conversation_messages')
            .delete({ count: 'exact' })
            .eq('conversation_id', conversation_id)
            .gte('created_at', targetMsg.created_at);

        if (deleteErr) throw new Error(deleteErr.message);

        // Update conversation message count
        const { data: remaining } = await db
            .from('conversation_messages')
            .select('id', { count: 'exact' })
            .eq('conversation_id', conversation_id);

        await db
            .from('conversations')
            .update({
                updated_at: new Date().toISOString(),
                message_count: remaining?.length || 0,
            })
            .eq('id', conversation_id);

        return NextResponse.json({ deleted: count || 0 });
    } catch (error: unknown) {
        console.error('[chat/messages DELETE]', error);
        return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 });
    }
}

