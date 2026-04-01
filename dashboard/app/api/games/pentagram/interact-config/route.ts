import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — fetch all interact configs, or single by ?scene_id=X
export async function GET(req: NextRequest) {
    try {
        const sceneId = req.nextUrl.searchParams.get('scene_id');

        if (sceneId) {
            const { data, error } = await db
                .from('pentagram_interact_configs')
                .select('*')
                .eq('scene_id', sceneId)
                .single();
            if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
            return NextResponse.json(data || null);
        }

        const { data, error } = await db
            .from('pentagram_interact_configs')
            .select('*')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST — upsert interact config for a scene_id
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { scene_id, interact_config } = body;

        if (!scene_id || !interact_config) {
            return NextResponse.json({ error: 'scene_id and interact_config are required' }, { status: 400 });
        }

        const { data, error } = await db
            .from('pentagram_interact_configs')
            .upsert(
                { scene_id, interact_config, updated_at: new Date().toISOString() },
                { onConflict: 'scene_id' }
            )
            .select()
            .single();

        if (error) throw error;
        return NextResponse.json(data);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE — delete interact config by ?scene_id=X
export async function DELETE(req: NextRequest) {
    try {
        const sceneId = req.nextUrl.searchParams.get('scene_id');
        if (!sceneId) {
            return NextResponse.json({ error: 'scene_id is required' }, { status: 400 });
        }

        const { error } = await db
            .from('pentagram_interact_configs')
            .delete()
            .eq('scene_id', sceneId);

        if (error) throw error;
        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
