/**
 * Settings Secrets API Route
 *
 * CRUD operations for encrypted connection secrets stored in the database.
 * Secrets are encrypted at rest using a server-side key.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';
import { getAuthUserId } from '@/lib/auth';

// Simple encryption using AES-256-GCM
// In production, use a proper key management system
const ENCRYPTION_KEY = process.env.SECRETS_ENCRYPTION_KEY ??
    crypto.createHash('sha256').update('ofiere-default-key').digest();

function encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format');
    }
    const [ivHex, authTagHex, encrypted] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

// GET /api/settings/secrets?service=<service>&key=<key>
export async function GET(req: NextRequest) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { searchParams } = new URL(req.url);
        const service = searchParams.get('service');
        const key = searchParams.get('key');

        if (!service) {
            // Return all secrets (metadata only, not values)
            const { data: secrets, error } = await db
                .from('connection_secrets')
                .select('id, service, key, created_at, updated_at');

            if (error) throw new Error(error.message);
            return NextResponse.json({ secrets });
        }

        // Return specific secret
        let query = db.from('connection_secrets').select('*').eq('user_id', userId).eq('service', service);
        if (key) query = query.eq('key', key);

        const { data: results, error } = await query;
        if (error) throw new Error(error.message);

        if (!results || results.length === 0) {
            return NextResponse.json({ error: 'Secret not found' }, { status: 404 });
        }

        // Decrypt values for return
        const decrypted = results.map((r: any) => ({
            id: r.id,
            service: r.service,
            key: r.key,
            value: decrypt(r.encrypted_value),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));

        return NextResponse.json({ secrets: key ? decrypted[0] : decrypted });
    } catch (error: any) {
        console.error('[Secrets API] GET error:', error.message);
        return NextResponse.json(
            { error: 'Failed to retrieve secrets', details: error.message },
            { status: 500 }
        );
    }
}

// POST /api/settings/secrets
// Body: { service: string, key: string, value: string }
export async function POST(req: NextRequest) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const body = await req.json();
        const { service, key, value } = body;

        if (!service || !key || !value) {
            return NextResponse.json(
                { error: 'Missing required fields: service, key, value' },
                { status: 400 }
            );
        }

        // Check if secret already exists
        const { data: existing } = await db
            .from('connection_secrets')
            .select('id')
            .eq('service', service)
            .eq('key', key);

        const encryptedValue = encrypt(value);

        if (existing && existing.length > 0) {
            // Update existing secret
            await db.from('connection_secrets')
                .update({ encrypted_value: encryptedValue, updated_at: new Date().toISOString() })
                .eq('id', existing[0].id);

            return NextResponse.json({
                message: 'Secret updated',
                id: existing[0].id,
            });
        }

        // Create new secret
        const id = crypto.randomUUID();
        await db.from('connection_secrets').insert({
            user_id: userId,
            id,
            service,
            key,
            encrypted_value: encryptedValue,
        });

        return NextResponse.json({
            message: 'Secret created',
            id,
        }, { status: 201 });
    } catch (error: any) {
        console.error('[Secrets API] POST error:', error.message);
        return NextResponse.json(
            { error: 'Failed to save secret', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE /api/settings/secrets?service=<service>&key=<key>
export async function DELETE(req: NextRequest) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });


    try {
        const { searchParams } = new URL(req.url);
        const service = searchParams.get('service');
        const key = searchParams.get('key');

        if (!service || !key) {
            return NextResponse.json(
                { error: 'Missing required params: service, key' },
                { status: 400 }
            );
        }

        await db.from('connection_secrets')
            .delete()
            .eq('service', service)
            .eq('key', key);

        return NextResponse.json({ message: 'Secret deleted' });
    } catch (error: any) {
        console.error('[Secrets API] DELETE error:', error.message);
        return NextResponse.json(
            { error: 'Failed to delete secret', details: error.message },
            { status: 500 }
        );
    }
}
