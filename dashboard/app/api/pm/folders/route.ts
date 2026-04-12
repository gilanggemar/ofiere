import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET all folders (optionally filtered by space_id) ───────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const spaceId = searchParams.get('space_id');

        let query = db
            .from('pm_folders')
            .select('*')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true });

        if (spaceId) query = query.eq('space_id', spaceId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return NextResponse.json({ folders: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create a folder ────────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.space_id) return NextResponse.json({ error: 'space_id required' }, { status: 400 });

        const { data, error } = await db
            .from('pm_folders')
            .insert({
                user_id: userId,
                space_id: body.space_id,
                parent_folder_id: body.parent_folder_id || null,
                name: body.name || 'New Folder',
                description: body.description || '',
                folder_type: body.folder_type || 'folder',
                sort_order: body.sort_order || 0,
            })
            .select()
            .single();

        if (error) throw new Error(error.message);
        return NextResponse.json({ folder: data }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update a folder ───────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.name !== undefined) updates.name = body.name;
        if (body.description !== undefined) updates.description = body.description;
        if (body.parent_folder_id !== undefined) updates.parent_folder_id = body.parent_folder_id;
        if (body.folder_type !== undefined) updates.folder_type = body.folder_type;
        if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
        if (body.space_id !== undefined) updates.space_id = body.space_id;

        const { error } = await db
            .from('pm_folders')
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

// ─── DELETE a folder ─────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

        const { error } = await db
            .from('pm_folders')
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
