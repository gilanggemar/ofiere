import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';


// GET /api/workflows/runs — list run history
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { searchParams } = new URL(request.url);
        const workflowId = searchParams.get('workflowId');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = db.from('workflow_runs').select('*').eq('user_id', userId).order('started_at', { ascending: false }).limit(limit);
        if (workflowId) query = query.eq('workflow_id', workflowId);

        const { data: rows, error } = await query;
        if (error) throw new Error(error.message);
        
        // Map snake_case database columns to camelCase frontend properties
        const formattedRows = rows.map((row) => ({
            id: row.id,
            workflowId: row.workflow_id,
            status: row.status,
            stepResults: Array.isArray(row.step_results) ? row.step_results : JSON.parse(row.step_results),
            triggeredBy: row.triggered_by,
            startedAt: row.started_at,
            completedAt: row.completed_at ?? undefined,
        }));
        
        return NextResponse.json(formattedRows);
    } catch (error: unknown) {
        console.error('Failed to list workflow runs:', error);
        return NextResponse.json({ error: 'Failed to list runs' }, { status: 500 });
    }
}
