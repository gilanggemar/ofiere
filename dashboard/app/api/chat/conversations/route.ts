import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * GET /api/chat/conversations?agent_id={agentId}&include_archived={boolean}
 * Lists conversations for the authenticated user, scoped to an agent.
 */
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const agentId = searchParams.get('agent_id');
        const includeArchived = searchParams.get('include_archived') === 'true';

        let query = db
            .from('conversations')
            .select('*')
            .eq('user_id', userId);

        if (agentId) {
            query = query.eq('agent_id', agentId);
        }

        if (!includeArchived) {
            query = query.eq('archived', false);
        }

        query = query.order('pinned', { ascending: false })
                     .order('updated_at', { ascending: false });

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ conversations: data || [] });
    } catch (error: unknown) {
        console.error('[chat/conversations GET]', error);
        return NextResponse.json({ error: 'Failed to list conversations' }, { status: 500 });
    }
}

/**
 * POST /api/chat/conversations
 * Creates a new conversation.
 * Body: { agent_id: string, title?: string, project_id?: string }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { agent_id, title, project_id } = body;

        if (!agent_id) {
            return NextResponse.json({ error: 'agent_id is required' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const { data, error } = await db
            .from('conversations')
            .insert({
                id,
                user_id: userId,
                agent_id,
                title: title || null,
                project_id: project_id || null,
                message_count: 0,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ conversation: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('[chat/conversations POST]', error);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
    }
}
