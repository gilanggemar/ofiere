import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { supabaseAdmin } from '@/lib/supabase';
import { AGENT_ROSTER } from '@/lib/agentRoster';
import { getAuthUserId } from '@/lib/auth';

const BUCKET = 'ofiere-images';

/**
 * Ensures an agent exists in the agents table
 */
async function ensureAgentExists(agentId: string, userId: string): Promise<boolean> {
    // Check if agent exists
    const { data: existing } = await db.from('agents')
        .select('id')
        .eq('user_id', userId)
        .eq('id', agentId)
        .single();

    if (existing) return true;

    // Find agent in roster for default values
    const rosterAgent = AGENT_ROSTER.find(a => a.id === agentId);

    // Create the agent
    const { error } = await db.from('agents').insert({
        user_id: userId,
        id: agentId,
        name: rosterAgent?.name || agentId,
        status: 'idle',
    });

    return !error;
}

/**
 * GET /api/storage/sync
 * Syncs hero images from Supabase Storage to the hero_images table.
 * This is a utility endpoint to fix missing database records.
 */
export async function GET() {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        // First, ensure all roster agents exist in the database
        const agentsCreated: string[] = [];
        for (const agent of AGENT_ROSTER) {
            const created = await ensureAgentExists(agent.id, userId);
            if (created) agentsCreated.push(agent.id);
        }

        // List all files in the heroes folder
        const { data: files, error: listError } = await supabaseAdmin.storage
            .from(BUCKET)
            .list('heroes', { limit: 500 });

        if (listError) {
            return NextResponse.json({ error: listError.message }, { status: 500 });
        }

        if (!files || files.length === 0) {
            return NextResponse.json({ message: 'No files found in heroes folder', synced: 0, agentsCreated });
        }

        const results: { file: string; agentId: string; status: string }[] = [];

        for (const file of files) {
            if (!file.name || file.name === '.emptyFolderPlaceholder') continue;

            // Extract agentId from filename (format: agentId-timestamp.ext)
            const match = file.name.match(/^(.+?)-\d+\.\w+$/);
            if (!match) {
                results.push({ file: file.name, agentId: 'unknown', status: 'skipped - invalid format' });
                continue;
            }

            const agentId = match[1];
            const path = `heroes/${file.name}`;

            // Ensure this specific agent exists (in case not in roster)
            await ensureAgentExists(agentId, userId);

            // Get public URL
            const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
            const imageUrl = urlData.publicUrl;

            // Check if this URL already exists in hero_images
            const { data: existing } = await db.from('hero_images')
                .select('id')
                .eq('user_id', userId)
                .eq('image_data', imageUrl)
                .single();

            if (existing) {
                results.push({ file: file.name, agentId, status: 'already exists' });
                continue;
            }

            // Get next sort order for this agent
            const { data: existingImages } = await db.from('hero_images')
                .select('sort_order')
                .eq('user_id', userId)
                .eq('agent_id', agentId)
                .order('sort_order', { ascending: false })
                .limit(1);

            const nextSort = existingImages && existingImages.length > 0
                ? existingImages[0].sort_order + 1
                : 0;

            // Insert new record
            const { error: insertError } = await db.from('hero_images').insert({
                user_id: userId,
                agent_id: agentId,
                image_data: imageUrl,
                sort_order: nextSort,
            });

            if (insertError) {
                results.push({ file: file.name, agentId, status: `error: ${insertError.message}` });
            } else {
                results.push({ file: file.name, agentId, status: 'synced' });

                // Update agent's hero_image if this is the first one
                if (nextSort === 0) {
                    await db.from('agents')
                        .update({ hero_image: imageUrl, active_hero_index: 0 })
                        .eq('user_id', userId)
                        .eq('id', agentId);
                }
            }
        }

        const synced = results.filter(r => r.status === 'synced').length;
        return NextResponse.json({ message: `Sync complete`, synced, total: files.length, results });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
