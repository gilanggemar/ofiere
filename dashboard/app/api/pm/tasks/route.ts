import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET PM tasks (with hierarchy filters) ───────────────────────────────────

export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const taskId = searchParams.get('id');
        const spaceId = searchParams.get('space_id');
        const folderId = searchParams.get('folder_id');

        // Direct lookup by task ID (used by sync)
        if (taskId) {
            const { data, error } = await db
                .from('tasks')
                .select('*')
                .eq('id', taskId)
                .eq('user_id', userId)
                .single();
            if (error) throw new Error(error.message);
            return NextResponse.json({ tasks: data ? [data] : [] });
        }

        let query = db
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false });

        if (spaceId) query = query.eq('space_id', spaceId);
        if (folderId) query = query.eq('folder_id', folderId);

        const { data, error } = await query;
        if (error) throw new Error(error.message);

        return NextResponse.json({ tasks: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create PM task ─────────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const id = body.id || `task-${Date.now()}`;

        const insertData: Record<string, any> = {
            id,
            user_id: userId,
            title: body.title || 'Untitled Task',
            description: body.description || null,
            status: body.status || 'PENDING',
            priority: body.priority ?? 1,
            agent_id: body.agent_id || null,
            assignee_type: body.assignee_type || 'agent',
            space_id: body.space_id || null,
            folder_id: body.folder_id || null,
            project_id: body.project_id || null,
            parent_task_id: body.parent_task_id || null,
            start_date: body.start_date || null,
            due_date: body.due_date || null,
            progress: body.progress || 0,
            sort_order: body.sort_order || 0,
            custom_fields: body.custom_fields || {},
            tags: body.tags || [],
        };

        const { error } = await db.from('tasks').insert(insertData);

        if (error) {
            // FK violation on agent_id — retry with null
            if (error.message?.includes('agent_id') || error.message?.includes('foreign key')) {
                insertData.agent_id = null;
                const retry = await db.from('tasks').insert(insertData);
                if (retry.error) throw new Error(retry.error.message);
                return NextResponse.json({ id }, { status: 201 });
            }
            throw new Error(error.message);
        }

        return NextResponse.json({ id, task: insertData }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update PM task ────────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };

        // Standard fields
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.status !== undefined) {
            updates.status = body.status;
            if (body.status === 'DONE') updates.completed_at = new Date().toISOString();
        }
        if (body.priority !== undefined) updates.priority = body.priority;
        if (body.agent_id !== undefined) updates.agent_id = body.agent_id;
        if (body.assignee_type !== undefined) updates.assignee_type = body.assignee_type;

        // PM-specific fields
        if (body.space_id !== undefined) updates.space_id = body.space_id;
        if (body.folder_id !== undefined) updates.folder_id = body.folder_id;
        if (body.project_id !== undefined) updates.project_id = body.project_id;
        if (body.parent_task_id !== undefined) updates.parent_task_id = body.parent_task_id;
        if (body.start_date !== undefined) updates.start_date = body.start_date;
        if (body.due_date !== undefined) updates.due_date = body.due_date;
        if (body.progress !== undefined) updates.progress = body.progress;
        if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
        if (body.custom_fields !== undefined) updates.custom_fields = body.custom_fields;
        if (body.tags !== undefined) updates.tags = body.tags;

        const { error } = await db
            .from('tasks')
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

// ─── DELETE a PM task ────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        // Cascade-delete any scheduler events referencing this task
        await db.from('scheduler_events').delete().eq('task_id', id).then(() => {});

        // Also delete subtasks first (they reference parent through parent_task_id)
        const { data: subtasks } = await db.from('tasks').select('id').eq('parent_task_id', id).eq('user_id', userId);
        if (subtasks && subtasks.length > 0) {
            for (const sub of subtasks) {
                await db.from('scheduler_events').delete().eq('task_id', sub.id).then(() => {});
            }
            await db.from('tasks').delete().in('id', subtasks.map((s: any) => s.id)).eq('user_id', userId);
        }

        const { error } = await db
            .from('tasks')
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
