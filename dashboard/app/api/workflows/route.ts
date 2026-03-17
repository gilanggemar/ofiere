import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// GET /api/workflows — list all workflows
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data: rows, error } = await db.from('workflows').select('*').eq('user_id', userId).order('updated_at', { ascending: false });
        if (error) throw new Error(error.message);
        return NextResponse.json(rows);
    } catch (error: unknown) {
        console.error('Failed to list workflows:', error);
        return NextResponse.json({ error: 'Failed to list workflows' }, { status: 500 });
    }
}

// POST /api/workflows — create a new workflow
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { name, description, steps, schedule, status, nodes, edges, definition_version } = body;

        if (!name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const id = crypto.randomUUID();
        const defVersion = definition_version ?? 1;

        // Assign IDs to steps if provided (V1 legacy)
        const stepsWithIds = (steps || []).map((s: any, i: number) => ({
            ...s,
            id: s.id || `step-${i}`,
        }));

        const { data, error } = await db.from('workflows').insert({
            user_id: userId,
            id,
            name,
            description: description || null,
            steps: stepsWithIds,
            schedule: schedule || null,
            status: status || 'draft',
            nodes: nodes || [],
            edges: edges || [],
            definition_version: defVersion,
        }).select().single();

        if (error) throw new Error(error.message);

        return NextResponse.json(data, { status: 201 });
    } catch (error: unknown) {
        console.error('Failed to create workflow:', error);
        return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
    }
}
