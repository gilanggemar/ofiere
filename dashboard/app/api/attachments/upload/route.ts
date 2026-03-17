import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUserId } from '@/lib/auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'application/pdf',
    'text/plain', 'text/markdown', 'text/csv',
    'application/json',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const conversationId = formData.get('conversationId') as string | null;
        const messageId = formData.get('messageId') as string | null;

        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        if (!conversationId || !messageId) {
            return NextResponse.json({ error: 'conversationId and messageId are required' }, { status: 400 });
        }
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB)` }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: `File type not allowed: ${file.type}` }, { status: 400 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);

        // Generate storage path
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `${userId}/${conversationId}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;

        // Upload to Supabase Storage
        const buffer = Buffer.from(await file.arrayBuffer());
        const { error: uploadError } = await supabase.storage
            .from('chat-attachments')
            .upload(storagePath, buffer, {
                contentType: file.type,
                upsert: false,
            });

        if (uploadError) {
            console.error('Storage upload failed:', uploadError);
            return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from('chat-attachments').getPublicUrl(storagePath);
        const publicUrl = urlData.publicUrl;

        // Basic text extraction for plain text files
        let extractedText: string | null = null;
        if (file.type.startsWith('text/') || file.type === 'application/json') {
            extractedText = await file.text();
            if (extractedText.length > 50000) {
                extractedText = extractedText.slice(0, 50000) + '\n...(truncated)';
            }
        }

        // Store metadata in chat_attachments table
        const { data, error: dbError } = await supabase
            .from('chat_attachments')
            .insert({
                conversation_id: conversationId,
                message_id: messageId,
                user_id: userId,
                filename: file.name,
                mime_type: file.type,
                size_bytes: file.size,
                storage_path: storagePath,
                public_url: publicUrl,
                extracted_text: extractedText,
            })
            .select()
            .single();

        if (dbError) {
            console.error('DB insert failed:', dbError);
            return NextResponse.json({ error: 'Failed to save attachment metadata' }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    } catch (error: unknown) {
        console.error('Attachment upload error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
