import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function ensureBucket() {
    await supabase.storage.createBucket('pentagram-assets', { public: true }).catch(() => {});
}

async function uploadFile(buffer: ArrayBuffer, fileName: string, contentType: string) {
    let { data, error } = await supabase.storage
        .from("pentagram-assets")
        .upload(fileName, buffer, { contentType, upsert: false });

    if (error) {
        await ensureBucket();
        const retry = await supabase.storage
            .from("pentagram-assets")
            .upload(fileName, buffer, { contentType, upsert: false });
        error = retry.error;
        data = retry.data;

        if (error) {
            throw new Error(`Storage upload failed: ${error.message}`);
        }
    }

    const { data: { publicUrl } } = supabase.storage
        .from("pentagram-assets")
        .getPublicUrl(fileName);

    return publicUrl;
}

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const type = formData.get("type") as string | null;

        if (!type) {
            return NextResponse.json({ error: "type is required" }, { status: 400 });
        }

        // ── SEQUENCE FRAME UPLOAD (single or bulk) ──
        if (type === 'sequence_frame' || type === 'sequence_bulk') {
            const sequenceId = formData.get("sequence_id") as string;
            if (!sequenceId) {
                return NextResponse.json({ error: "sequence_id is required for sequence uploads" }, { status: 400 });
            }

            const files: File[] = [];
            // Support both single 'file' and multiple 'files' fields
            const singleFile = formData.get("file") as File | null;
            if (singleFile) files.push(singleFile);

            const allEntries = formData.getAll("files");
            for (const entry of allEntries) {
                if (entry instanceof File) files.push(entry);
            }

            if (files.length === 0) {
                return NextResponse.json({ error: "No files provided" }, { status: 400 });
            }

            // Sort files by filename (natural numeric sort) to ensure correct frame order
            files.sort((a, b) => {
                return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
            });

            // Validate ALL files are webp
            for (const file of files) {
                const ext = file.name.split('.').pop()?.toLowerCase();
                if (ext !== 'webp' && file.type !== 'image/webp') {
                    return NextResponse.json({
                        error: `Invalid format: "${file.name}" is not a .webp file. Please convert all images to WebP format to avoid lag and ensure optimal performance.`,
                        invalidFile: file.name
                    }, { status: 400 });
                }
            }

            const urls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const buffer = await file.arrayBuffer();
                const paddedIndex = String(i).padStart(4, '0');
                const fileName = `sequences/${sequenceId}/frame_${paddedIndex}.webp`;
                const url = await uploadFile(buffer, fileName, 'image/webp');
                urls.push(url);
            }

            return NextResponse.json({ urls, count: urls.length });
        }

        // ── STANDARD UPLOAD (background / hero) ──
        const file = formData.get("file") as File | null;
        if (!file) {
            return NextResponse.json({ error: "File is required" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const ext = file.name.split('.').pop() || 'png';
        const fileName = `${type}_${Date.now()}.${ext}`;

        const publicUrl = await uploadFile(buffer, fileName, file.type);

        // Record it in the DB
        await supabase.from("pentagram_assets").insert({
            asset_type: type,
            file_name: file.name,
            data_url: publicUrl,
            is_active: true
        });

        return NextResponse.json({ url: publicUrl });

    } catch (e: any) {
        console.error("Upload error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
