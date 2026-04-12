import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

// ─── GET agents (from existing agents table) for PM assignee dropdown ────────

export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { data, error } = await db
            .from('agents')
            .select('id, name, codename, role, avatar, status')
            .eq('user_id', userId)
            .order('name', { ascending: true });

        if (error) throw new Error(error.message);
        return NextResponse.json({ agents: data || [] });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
