import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET — list all image sequences
export async function GET() {
    try {
        const { data, error } = await db
            .from('pentagram_image_sequences')
            .select('*')
            .order('updated_at', { ascending: false });
        if (error) throw error;
        return NextResponse.json(data || []);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// POST — create or update an image sequence
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { id, name, description, frame_count, frame_width, frame_height, frame_urls, thumbnail_url } = body;

        if (!name) {
            return NextResponse.json({ error: 'name is required' }, { status: 400 });
        }

        const record: any = {
            name,
            description: description || null,
            frame_count: frame_count || 0,
            frame_width: frame_width || null,
            frame_height: frame_height || null,
            frame_urls: frame_urls || [],
            thumbnail_url: thumbnail_url || null,
            updated_at: new Date().toISOString(),
        };

        if (id) {
            // Update existing
            const { data, error } = await db
                .from('pentagram_image_sequences')
                .update(record)
                .eq('id', id)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json(data);
        } else {
            // Create new
            const { data, error } = await db
                .from('pentagram_image_sequences')
                .insert(record)
                .select()
                .single();
            if (error) throw error;
            return NextResponse.json(data);
        }
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

// DELETE — delete image sequence by ?id=X (also removes storage files)
export async function DELETE(req: NextRequest) {
    try {
        const id = req.nextUrl.searchParams.get('id');
        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400 });
        }

        // 1. Get the sequence to find its frame URLs
        const { data: seq } = await db
            .from('pentagram_image_sequences')
            .select('frame_urls')
            .eq('id', id)
            .single();

        // 2. Remove storage files if they exist
        if (seq?.frame_urls && Array.isArray(seq.frame_urls) && seq.frame_urls.length > 0) {
            // Extract file names from URLs
            const fileNames = (seq.frame_urls as string[])
                .map(url => {
                    try {
                        const parts = url.split('/pentagram-assets/');
                        return parts[1] || '';
                    } catch { return ''; }
                })
                .filter(Boolean);

            if (fileNames.length > 0) {
                const { createClient } = await import('@supabase/supabase-js');
                const supabase = createClient(
                    process.env.NEXT_PUBLIC_SUPABASE_URL!,
                    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
                );
                await supabase.storage.from('pentagram-assets').remove(fileNames);
            }
        }

        // 3. Delete the DB record
        const { error } = await db
            .from('pentagram_image_sequences')
            .delete()
            .eq('id', id);
        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
