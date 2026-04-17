import { supabaseAdmin } from './supabase'

const BUCKET = 'ofiere-images'

/**
 * Upload a base64 data URI to Supabase Storage.
 * Returns the public URL string.
 */
export async function uploadImage(
    base64DataUri: string,
    path: string
): Promise<string> {
    // Extract base64 data and mime type
    const matches = base64DataUri.match(/^data:(.+);base64,(.+)$/)
    if (!matches) throw new Error('Invalid base64 data URI')

    const mimeType = matches[1]
    const base64Data = matches[2]
    const buffer = Buffer.from(base64Data, 'base64')

    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(path, buffer, {
            contentType: mimeType,
            upsert: true,
        })

    if (error) throw new Error(`Storage upload failed: ${error.message}`)

    const { data: urlData } = supabaseAdmin.storage
        .from(BUCKET)
        .getPublicUrl(path)

    return urlData.publicUrl
}

/**
 * Delete an image from Supabase Storage.
 */
export async function deleteImage(path: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
        .from(BUCKET)
        .remove([path])

    if (error) throw new Error(`Storage delete failed: ${error.message}`)
}

/**
 * Check if a string is a base64 data URI (vs a URL)
 */
export function isBase64DataUri(str: string): boolean {
    return str.startsWith('data:')
}

/**
 * Check if a string is a Supabase Storage URL
 */
export function isStorageUrl(str: string): boolean {
    return str.includes('supabase') && str.includes('/storage/')
}

/**
 * Extract the storage path from a Supabase Storage public URL.
 * e.g., "https://xxx.supabase.co/storage/v1/object/public/ofiere-images/heroes/abc.png"
 * returns "heroes/abc.png"
 */
export function extractStoragePath(url: string): string | null {
    const match = url.match(/\/storage\/v1\/object\/public\/ofiere-images\/(.+)$/)
    return match ? match[1] : null
}
