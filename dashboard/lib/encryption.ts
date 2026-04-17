import crypto from 'crypto';

// The encryption key is derived from an environment variable.
// If not set, falls back to a deterministic key derived from a default passphrase.
// For production, ALWAYS set OFIERE_ENCRYPTION_KEY in .env.local (32-byte hex string).
const ENCRYPTION_KEY_HEX =
    process.env.OFIERE_ENCRYPTION_KEY ||
    crypto.createHash('sha256').update('nerv-os-default-key-change-me').digest('hex');
const ENCRYPTION_KEY = Buffer.from(ENCRYPTION_KEY_HEX, 'hex');
const IV_LENGTH = 12; // GCM standard
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts a plaintext string. Returns a hex-encoded string containing IV + authTag + ciphertext.
 * Returns null if input is null/undefined/empty.
 */
export function encrypt(plaintext: string | null | undefined): string | null {
    if (!plaintext) return null;
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext
    return Buffer.concat([iv, authTag, encrypted]).toString('hex');
}

/**
 * Decrypts a hex-encoded string produced by encrypt().
 * Returns null if input is null/undefined/empty.
 */
export function decrypt(encryptedHex: string | null | undefined): string | null {
    if (!encryptedHex) return null;
    const data = Buffer.from(encryptedHex, 'hex');
    const iv = data.subarray(0, IV_LENGTH);
    const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
}
