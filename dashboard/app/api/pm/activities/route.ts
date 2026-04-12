import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET activities for an entity ────────────────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const entityType = searchParams.get('entity_type');
        const entityId = searchParams.get('entity_id');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = db
            .from('pm_activities')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (entityType) query = query.eq('entity_type', entityType);
        if (entityId) query = query.eq('entity_id', entityId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return NextResponse.json({ activities: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create an activity ─────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();

        const { data, error } = await db
            .from('pm_activities')
            .insert({
                user_id: userId,
                entity_type: body.entity_type || 'task',
                entity_id: body.entity_id,
                action_type: body.action_type,
                source: body.source || 'human',
                source_name: body.source_name || 'You',
                content: body.content || '',
                metadata: body.metadata || {},
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ activity: data }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
