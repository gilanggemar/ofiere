import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns personalized install commands with embedded credentials.
 * Uses the install.sh script from GitHub so it always pulls the latest plugin code.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    // Build the one-liner install command that uses the install.sh script from GitHub
    const installCmd = [
        `curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s --`,
        `--supabase-url "${SUPABASE_URL}"`,
        `--service-key "${SERVICE_ROLE_KEY}"`,
        `--user-id "${userId}"`,
    ].join(' \\\n  ');

    return NextResponse.json({
        success: true,
        steps: [
            {
                label: 'Install / Update Ofiere plugin (downloads latest from GitHub)',
                command: installCmd,
            },
            {
                label: 'Restart OpenClaw gateway',
                command: 'openclaw gateway restart',
            },
        ],
    });
}
