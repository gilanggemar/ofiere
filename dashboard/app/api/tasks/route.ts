import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// Priority mapping: DB stores integers, frontend uses string labels
const PRIORITY_TO_LABEL: Record<number, string> = { 0: 'LOW', 1: 'MEDIUM', 2: 'HIGH', 3: 'CRITICAL' };
const LABEL_TO_PRIORITY: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// ─── GET all tasks for the authenticated user ────────────────────────────────

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('tasks')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);

        // Map DB rows to frontend Task shape
        // Filter out PM-only tasks (they shouldn't appear in task-ops)
        // Also exclude tasks that belong to PM hierarchy (have space_id)
        const tasks = (data || [])
            .filter((row: any) => {
                const cf = row.custom_fields;
                if (cf && typeof cf === 'object' && cf.pm_only === true) return false;
                if (row.space_id) return false; // PM hierarchy task
                return true;
            })
            .map((row: any) => {
                const cf = row.custom_fields;
                return {
                    id: row.id,
                    title: row.title,
                    description: row.description || undefined,
                    agentId: row.agent_id || '',
                    status: row.status || 'PENDING',
                    priority: PRIORITY_TO_LABEL[row.priority] || 'LOW',
                    spaceId: row.space_id || null,
                    logs: [],
                    toolCalls: [],
                    updatedAt: new Date(row.updated_at).getTime(),
                    timestamp: new Date(row.updated_at).toLocaleTimeString(),
                    // Include task-ops extended fields for sync
                    executionPlan: cf?.execution_plan || [],
                    systemPrompt: cf?.system_prompt || '',
                    goals: cf?.goals || [],
                    constraints: cf?.constraints || [],
                };
            });

        return NextResponse.json({ tasks });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('GET /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── POST create a new task ──────────────────────────────────────────────────

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const id = body.id || crypto.randomUUID();
        const priorityVal = LABEL_TO_PRIORITY[String(body.priority || 'LOW').toUpperCase()] ?? 0;

        const insertData: Record<string, any> = {
            id,
            user_id: userId,
            agent_id: body.agentId || null,
            title: body.title,
            description: body.description || null,
            status: body.status || 'PENDING',
            priority: priorityVal,
        };

        // Build custom_fields from task-ops fields
        const cf: Record<string, any> = {};
        if (body.executionPlan && Array.isArray(body.executionPlan) && body.executionPlan.length > 0) cf.execution_plan = body.executionPlan;
        if (body.systemPrompt) cf.system_prompt = body.systemPrompt;
        if (body.goals && Array.isArray(body.goals) && body.goals.length > 0) cf.goals = body.goals;
        if (body.constraints && Array.isArray(body.constraints) && body.constraints.length > 0) cf.constraints = body.constraints;
        if (Object.keys(cf).length > 0) insertData.custom_fields = cf;

        const { error } = await db.from('tasks').insert(insertData);

        if (error) {
            // FK violation on agent_id — retry with null
            if (error.message?.includes('agent_id') || error.message?.includes('foreign key')) {
                console.warn('POST /api/tasks FK violation on agent_id, retrying with null');
                insertData.agent_id = null;
                const retry = await db.from('tasks').insert(insertData);
                if (retry.error) throw new Error(retry.error.message);
                return NextResponse.json({ id }, { status: 201 });
            }
            console.error('POST /api/tasks Supabase error:', error.message, error.details);
            throw new Error(error.message);
        }

        return NextResponse.json({ id }, { status: 201 });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('POST /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── PATCH update a task ─────────────────────────────────────────────────────

export async function PATCH(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        if (!body.id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        const updates: Record<string, any> = { updated_at: new Date().toISOString() };
        if (body.title !== undefined) updates.title = body.title;
        if (body.description !== undefined) updates.description = body.description;
        if (body.status !== undefined) updates.status = body.status;
        if (body.agentId !== undefined) updates.agent_id = body.agentId;
        if (body.priority !== undefined) {
            updates.priority = LABEL_TO_PRIORITY[String(body.priority).toUpperCase()] ?? 0;
        }
        if (body.status === 'DONE') updates.completed_at = new Date().toISOString();

        // Support custom_fields updates (execution plan, system prompt, goals, constraints)
        if (body.custom_fields !== undefined) {
            updates.custom_fields = body.custom_fields;
        } else if (body.executionPlan !== undefined || body.systemPrompt !== undefined || body.goals !== undefined || body.constraints !== undefined) {
            // Also support flat field updates from task-ops UI
            // Fetch existing custom_fields first to merge
            const { data: existing } = await db.from('tasks').select('custom_fields').eq('id', body.id).eq('user_id', userId).single();
            const existingCf = (existing?.custom_fields || {}) as Record<string, any>;
            const mergedCf = { ...existingCf };
            if (body.executionPlan !== undefined) mergedCf.execution_plan = body.executionPlan;
            if (body.systemPrompt !== undefined) mergedCf.system_prompt = body.systemPrompt;
            if (body.goals !== undefined) mergedCf.goals = body.goals;
            if (body.constraints !== undefined) mergedCf.constraints = body.constraints;
            updates.custom_fields = mergedCf;
        }

        const { error } = await db
            .from('tasks')
            .update(updates)
            .eq('id', body.id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('PATCH /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}

// ─── DELETE a task ───────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) return NextResponse.json({ error: 'Missing task id' }, { status: 400 });

        // Cascade-delete any scheduler events referencing this task
        await db.from('scheduler_events').delete().eq('task_id', id).then(() => {});

        const { error } = await db
            .from('tasks')
            .delete()
            .eq('id', id)
            .eq('user_id', userId);

        if (error) throw new Error(error.message);
        return NextResponse.json({ ok: true });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('DELETE /api/tasks error:', msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
