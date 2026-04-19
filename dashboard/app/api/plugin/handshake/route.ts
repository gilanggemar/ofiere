import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns personalized install AND uninstall commands with embedded credentials.
 * Provides both Docker and native variants since OpenClaw may run
 * in either environment.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    const baseUrl = 'https://raw.githubusercontent.com/gilanggemar/ofiere/main/ofiere-openclaw-plugin';

    // ── Install Commands ──
    const installArgs = `--supabase-url "${SUPABASE_URL}" --service-key "${SERVICE_ROLE_KEY}" --user-id "${userId}"`;
    const nativeInstall = `curl -sSL ${baseUrl}/install.sh | bash -s -- ${installArgs}`;
    const innerInstall = `curl -sSL ${baseUrl}/install.sh | bash -s -- ${installArgs} --no-restart`;
    const dockerInstall = [
        'CONTAINER=$(docker ps --filter "name=openclaw" --format "{{.Names}}" | head -1)',
        `docker exec -i $CONTAINER bash -c '${innerInstall}'`,
        'docker restart $CONTAINER',
    ].join(' && ');

    // ── Uninstall Commands ──
    const nativeUninstall = `curl -sSL ${baseUrl}/uninstall.sh | bash`;
    const innerUninstall = `curl -sSL ${baseUrl}/uninstall.sh | bash -s -- --no-restart`;
    const dockerUninstall = [
        'CONTAINER=$(docker ps --filter "name=openclaw" --format "{{.Names}}" | head -1)',
        `docker exec -i $CONTAINER bash -c '${innerUninstall}'`,
        'docker restart $CONTAINER',
    ].join(' && ');

    return NextResponse.json({
        success: true,
        // Install
        dockerCommand: dockerInstall,
        nativeCommand: nativeInstall,
        // Uninstall
        dockerUninstall,
        nativeUninstall,
        steps: [
            {
                label: 'Docker (most common)',
                command: dockerInstall,
                uninstall: dockerUninstall,
                description: 'If OpenClaw runs in Docker, paste this on your VPS host',
            },
            {
                label: 'Native',
                command: nativeInstall,
                uninstall: nativeUninstall,
                description: 'If OpenClaw runs directly (no Docker), paste this on your server',
            },
        ],
    });
}
