import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/chat/upload
 * Upload a file (base64 data URL) to Supabase Storage and return a public URL.
 * Body: { name: string, type: string, data: string (base64 data URL) }
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { name, type, data } = await request.json();

        if (!data || !name) {
            return NextResponse.json({ error: 'Missing name or data' }, { status: 400 });
        }

        // Strip the data URL prefix to get raw base64
        const base64Match = data.match(/^data:[^;]+;base64,(.+)$/);
        if (!base64Match) {
            return NextResponse.json({ error: 'Invalid data URL format' }, { status: 400 });
        }
        const base64Data = base64Match[1];
        const buffer = Buffer.from(base64Data, 'base64');

        // Generate a unique path: userId/timestamp-filename
        const timestamp = Date.now();
        const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `${userId}/${timestamp}-${safeName}`;

        const { data: uploadData, error: uploadError } = await db.storage
            .from('chat-attachments')
            .upload(storagePath, buffer, {
                contentType: type || 'application/octet-stream',
                upsert: false,
            });

        if (uploadError) {
            console.error('[chat/upload] Storage error:', uploadError);
            return NextResponse.json({ error: uploadError.message }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = db.storage
            .from('chat-attachments')
            .getPublicUrl(storagePath);

        return NextResponse.json({
            url: urlData.publicUrl,
            path: storagePath,
            name,
            type,
        });
    } catch (error: unknown) {
        console.error('[chat/upload]', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
