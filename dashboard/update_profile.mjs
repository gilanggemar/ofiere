import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

// Load env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase env vars');
}

const db = createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } });

// Encryption Logic matching lib/encryption.ts
const ENCRYPTION_KEY_HEX =
    process.env.NERV_ENCRYPTION_KEY ||
    crypto.createHash('sha256').update('nerv-os-default-key-change-me').digest('hex');
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
const IV_LENGTH = 12;

function encrypt(plaintext) {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

async function updateProfile() {
    console.log('Fetching active connection profiles...');
    // We update ALL profiles just to match the new one
    const { data: profiles, error } = await db.from('connection_profiles').select('*');
    if (error) {
        console.error('Error fetching profiles:', error);
        return;
    }

    if (!profiles || profiles.length === 0) {
        console.log('No profiles found to update. (User might need to login first)');
        return;
    }

    const openclawWsUrl = 'wss://srv1335911.tailececae.ts.net';
    const openclawHttpUrl = 'https://srv1335911.tailececae.ts.net';
    const openclawAuthTokenPlain = 'tHu1pVua4nosFlCTXREgDRbrBkGiyQqa';
    const openclawAuthTokenEncrypted = encrypt(openclawAuthTokenPlain);

    for (const p of profiles) {
        console.log(`Updating profile ${p.name} (${p.id})...`);
        const { error: updErr } = await db.from('connection_profiles').update({
            openclaw_ws_url: openclawWsUrl,
            openclaw_http_url: openclawHttpUrl,
            openclaw_auth_token: openclawAuthTokenEncrypted,
            openclaw_enabled: true,
            is_active: true
        }).eq('id', p.id);
        
        if (updErr) {
            console.error(`Failed to update profile ${p.id}:`, updErr);
        } else {
            console.log(`Successfully updated profile ${p.id}.`);
        }
    }
}

updateProfile();
