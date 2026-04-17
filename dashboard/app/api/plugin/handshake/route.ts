import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';

/**
 * POST /api/plugin/handshake
 *
 * Returns the install prompt text with embedded credentials.
 * The CLIENT sends it through the existing browser WebSocket connection
 * (which can reach Tailscale/private URLs since the browser is on the user's network).
 *
 * This avoids the "Vercel can't reach Tailscale" problem.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // ── Credentials to embed in the install prompt ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    const promptText = buildInstallPrompt({
        supabaseUrl: SUPABASE_URL,
        serviceRoleKey: SERVICE_ROLE_KEY,
        userId,
    });

    // Return the prompt to the client — the browser will send it via its own WebSocket
    return NextResponse.json({ success: true, prompt: promptText });
}

function buildInstallPrompt(creds: { supabaseUrl: string; serviceRoleKey: string; userId: string }): string {
    return `[SYSTEM DIRECTIVE: INSTALL OFIERE PM PLUGIN — AUTOMATED SETUP]

You are installing the Ofiere PM plugin to integrate this OpenClaw instance with the Ofiere dashboard.
This is a one-time setup. Follow EVERY step EXACTLY. Do NOT skip any step. Do NOT modify any content.

## IMPORTANT: Do NOT modify openclaw.json. Only write files and append to .env.

---

**Step 1: Detect your OpenClaw home directory**

Check which path exists:
- If \`/data/.openclaw/\` exists → use that (Docker)
- If \`~/.openclaw/\` exists → use that (native install)
- Otherwise → create \`~/.openclaw/\`

Call this path OPENCLAW_HOME for the remaining steps.

---

**Step 2: Download the Ofiere plugin files**

Run this command:
\`\`\`bash
mkdir -p /data/.openclaw/extensions && cd /tmp && rm -rf ofiere-plugin-tmp && git clone --depth 1 https://github.com/gilanggemar/Ofiere.git ofiere-plugin-tmp 2>/dev/null && rm -rf /data/.openclaw/extensions/ofiere && cp -r ofiere-plugin-tmp/ofiere-openclaw-plugin /data/.openclaw/extensions/ofiere && rm -rf ofiere-plugin-tmp && echo "Plugin files installed"
\`\`\`

If git is not available, try curl:
\`\`\`bash
mkdir -p /data/.openclaw/extensions && cd /tmp && curl -sSL https://github.com/gilanggemar/Ofiere/archive/refs/heads/main.tar.gz | tar xz && rm -rf /data/.openclaw/extensions/ofiere && cp -r Ofiere-main/ofiere-openclaw-plugin /data/.openclaw/extensions/ofiere && rm -rf Ofiere-main && echo "Plugin files installed"
\`\`\`

---

**Step 3: Configure environment variables**

Append these EXACT lines to \`/data/.openclaw/.env\` (create the file if it doesn't exist). 
If any of these variables already exist in the file, UPDATE their values instead of duplicating them.

\`\`\`
OFIERE_SUPABASE_URL=${creds.supabaseUrl}
OFIERE_SERVICE_ROLE_KEY=${creds.serviceRoleKey}
OFIERE_USER_ID=${creds.userId}
\`\`\`

---

**Step 4: Verify**

Confirm the following:
1. The directory \`/data/.openclaw/extensions/ofiere/\` exists and contains \`index.ts\` and \`src/\`
2. The file \`/data/.openclaw/.env\` contains all three \`OFIERE_*\` variables

---

**Step 5: Report back**

Tell the user:
- "✅ Ofiere PM plugin installed successfully!"
- "All agents on this OpenClaw instance now have access to 5 Ofiere tools: LIST_TASKS, CREATE_TASK, UPDATE_TASK, DELETE_TASK, LIST_AGENTS"
- "Please restart your gateway to activate the plugin (docker restart or openclaw gateway restart)"

Do NOT output the service role key in your response — keep it secure.
`;
}
