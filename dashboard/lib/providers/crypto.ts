// ─── AES-256-GCM Encryption for API Keys ─────────────────────────────────────
//
// Server-side only (used in API routes). Keys are encrypted before storage
// in SQLite and decrypted only when needed for provider connections.

import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = 'nerv-os-provider-salt'; // static salt for key derivation

function getEncryptionKey(): Buffer {
    const secret = process.env.OFIERE_ENCRYPTION_KEY || 'nerv-dev-key-do-not-use-in-prod';
    return scryptSync(secret, SALT, 32);
}

/**
 * Encrypt a plaintext API key.
 * Returns a base64 string containing: IV + AuthTag + Ciphertext
 */
export function encryptApiKey(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    // Pack: IV(16) + AuthTag(16) + Ciphertext
    const packed = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'hex'),
    ]);

    return packed.toString('base64');
}

/**
 * Decrypt a previously encrypted API key.
 * Expects a base64 string in the format produced by encryptApiKey.
 */
export function decryptApiKey(ciphertext: string): string {
    const key = getEncryptionKey();
    const packed = Buffer.from(ciphertext, 'base64');

    const iv = packed.subarray(0, IV_LENGTH);
    const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}

/**
 * Mask an API key for display (e.g., "sk-...abc123")
 */
export function maskApiKey(key: string): string {
    if (key.length <= 8) return '••••••••';
    return key.slice(0, 4) + '•••' + key.slice(-4);
}
