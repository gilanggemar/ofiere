import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET all spaces ──────────────────────────────────────────────────────────

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('pm_spaces')
            .select('*')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true });

        if (error) throw new Error(error.message);
        return NextResponse.json({ spaces: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create a space ─────────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { data, error } = await db
            .from('pm_spaces')
            .insert({
                user_id: userId,
                name: body.name || 'New Space',
                description: body.description || '',
                icon: body.icon || '📁',
                icon_color: body.icon_color || '#FF6D29',
                access_type: body.access_type || 'private',
                sort_order: body.sort_order || 0,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ space: data }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update a space ────────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.icon !== undefined) updates.icon = body.icon;
        if (body.icon_color !== undefined) updates.icon_color = body.icon_color;
        if (body.access_type !== undefined) updates.access_type = body.access_type;
        if (body.sort_order !== undefined) updates.sort_order = body.sort_order;

        const { error } = await db
            .from('pm_spaces')
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

// ─── DELETE a space ──────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { error } = await db
            .from('pm_spaces')
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
