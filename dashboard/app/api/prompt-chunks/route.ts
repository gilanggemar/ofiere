import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { getAuthUserId } from '@/lib/auth';

export async function GET() {
    try {
        const userId = await getAuthUserId();
        if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const { data: chunks, error } = await db.from('prompt_chunks').select('*').eq('user_id', userId).order('order', { ascending: true });
        if (error) throw new Error(error.message);
        return NextResponse.json({ chunks });
    } catch (error) {
        console.error('Failed to list prompt chunks:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
export async function POST(req: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { name, content, color, category } = body;

        if (!name || typeof name !== 'string' || name.length > 30) {
            return NextResponse.json({ error: 'Invalid name (required, max 30 chars)' }, { status: 400 });
        }
        if (!content || typeof content !== 'string') {
            return NextResponse.json({ error: 'Invalid content (required)' }, { status: 400 });
        }
        if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
            return NextResponse.json({ error: 'Invalid color format' }, { status: 400 });
        }

        const id = crypto.randomUUID();

        // Get max order
        const { data: chunks } = await db.from('prompt_chunks').select('order').eq('user_id', userId);
        const maxOrder = chunks && chunks.length > 0 ? Math.max(...chunks.map((c: any) => c.order)) : -1;
        const newOrder = maxOrder + 1;

        const newChunk = {
            id,
            user_id: userId,
            name,
            content,
            color: color || '#6B7280',
            category: category || 'Uncategorized',
            order: newOrder,
        };

        const { error } = await db.from('prompt_chunks').insert(newChunk);
        if (error) throw new Error(error.message);

        return NextResponse.json({ chunk: newChunk });

    } catch (error) {
        console.error('Failed to create prompt chunk:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
