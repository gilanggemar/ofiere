import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { uploadImage, deleteImage, isStorageUrl, extractStoragePath } from '@/lib/supabaseStorage';
import { getAuthUserId } from '@/lib/auth';

// GET the background image for an agent
export async function GET(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

    try {
        const { data: agent } = await db.from('agents')
            .select('background_image')
            .eq('user_id', userId)
            .eq('id', agentId)
            .single();

        return NextResponse.json({ backgroundImage: agent?.background_image || null });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST a new background image for an agent
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const formData = await request.formData();
        const agentId = formData.get('agentId') as string;
        const bgFile = formData.get('backgroundImage') as File;

        if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });
        if (!bgFile) return NextResponse.json({ error: 'Missing backgroundImage file' }, { status: 400 });

        // Delete old background from storage if it exists
        const { data: currentAgent } = await db.from('agents')
            .select('background_image')
            .eq('user_id', userId)
            .eq('id', agentId)
            .single();

        if (currentAgent?.background_image && isStorageUrl(currentAgent.background_image)) {
            const oldPath = extractStoragePath(currentAgent.background_image);
            if (oldPath) {
                try { await deleteImage(oldPath); } catch (e) { console.warn('Failed to delete old bg:', e); }
            }
        }

        // Upload new background to Supabase Storage
        const buffer = Buffer.from(await bgFile.arrayBuffer());
        const base64 = buffer.toString('base64');
        const dataUri = `data:${bgFile.type};base64,${base64}`;

        const ext = bgFile.type.split('/')[1] || 'png';
        const path = `backgrounds/${agentId}-${Date.now()}.${ext}`;
        const imageUrl = await uploadImage(dataUri, path);

        // Ensure agent exists
        const { data: agentRow } = await db.from('agents').select('id').eq('user_id', userId).eq('id', agentId).single();
        if (!agentRow) {
            await db.from('agents').insert({ user_id: userId, id: agentId, name: agentId, status: 'idle' });
        }

        // Update agent with new background
        await db.from('agents').update({ background_image: imageUrl }).eq('user_id', userId).eq('id', agentId);

        return NextResponse.json({ success: true, backgroundImage: imageUrl });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE background image
export async function DELETE(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { agentId } = await request.json();
        if (!agentId) return NextResponse.json({ error: 'Missing agentId' }, { status: 400 });

        // Get current background
        const { data: agent } = await db.from('agents')
            .select('background_image')
            .eq('user_id', userId)
            .eq('id', agentId)
            .single();

        // Delete from storage
        if (agent?.background_image && isStorageUrl(agent.background_image)) {
            const storagePath = extractStoragePath(agent.background_image);
            if (storagePath) {
                try { await deleteImage(storagePath); } catch (e) { console.warn('Failed to delete bg:', e); }
            }
        }

        // Clear the column
        await db.from('agents').update({ background_image: null }).eq('user_id', userId).eq('id', agentId);

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
