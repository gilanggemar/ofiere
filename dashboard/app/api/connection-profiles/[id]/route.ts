import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { encrypt } from '@/lib/encryption';
import { getAuthUserId } from '@/lib/auth';

// GET — Single profile (secrets redacted)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const { id } = await params;
    const { data: profile, error } = await db.from('connection_profiles').select('*').eq('user_id', userId).eq('id', id).single();
    if (error || !profile) {
        return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }
    return NextResponse.json({
        ...profile,
        openclaw_auth_token: profile.openclaw_auth_token ? '••••••••' : null,
        agent_zero_api_key: profile.agent_zero_api_key ? '••••••••' : null,
    });
}

// PUT — Update profile
export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    const { id } = await params;
    const body = await req.json();

    // Build update object — only include fields that were sent
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    // String fields (direct copy if present) — map camelCase body to snake_case DB
    const fieldMap: Record<string, string> = {
        name: 'name',
        description: 'description',
        openclawWsUrl: 'openclaw_ws_url',
        openclawHttpUrl: 'openclaw_http_url',
        openclawAuthMode: 'openclaw_auth_mode',
        agentZeroBaseUrl: 'agent_zero_base_url',
        agentZeroAuthMode: 'agent_zero_auth_mode',
        agentZeroTransport: 'agent_zero_transport',
    };
    for (const [bodyKey, dbKey] of Object.entries(fieldMap)) {
        if (body[bodyKey] !== undefined) updates[dbKey] = body[bodyKey];
    }

    // Boolean fields
    const boolMap: Record<string, string> = {
        openclawEnabled: 'openclaw_enabled',
        agentZeroEnabled: 'agent_zero_enabled',
    };
    for (const [bodyKey, dbKey] of Object.entries(boolMap)) {
        if (body[bodyKey] !== undefined) updates[dbKey] = body[bodyKey];
    }

    // Secret fields — only update if a new value is explicitly provided (not the redacted placeholder)
    if (body.openclawAuthToken !== undefined && body.openclawAuthToken !== '••••••••') {
        updates.openclaw_auth_token = encrypt(body.openclawAuthToken);
    }
    if (body.agentZeroApiKey !== undefined && body.agentZeroApiKey !== '••••••••') {
        updates.agent_zero_api_key = encrypt(body.agentZeroApiKey);
    }

    const { error } = await db.from('connection_profiles').update(updates).eq('user_id', userId).eq('id', id);
    if (error) return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    return NextResponse.json({ success: true });
}

// DELETE — Remove profile
export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    // Prevent deleting the active profile
    const { data: profile } = await db.from('connection_profiles').select('is_active').eq('user_id', userId).eq('id', id).single();
    if (profile && profile.is_active) {
        return NextResponse.json(
            { error: 'Cannot delete the active profile. Switch to another profile first.' },
            { status: 400 }
        );
    }
    await db.from('connection_profiles').delete().eq('user_id', userId).eq('id', id);
    return NextResponse.json({ success: true });
}
