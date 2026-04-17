import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';

/**
 * POST /api/plugin/handshake
 *
 * Zero-terminal plugin installer. Sends a setup prompt to the user's
 * OpenClaw agent via WebSocket. The agent writes plugin files and
 * env vars — no SSH, no terminal, no user intervention.
 *
 * Body: { agentId: string }  — which agent should run the install
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { agentId } = body;

    if (!agentId) {
        return NextResponse.json({ error: 'Missing agentId — which agent should run the install?' }, { status: 400 });
    }

    // ── Credentials to embed in the install prompt ──
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: 'Server missing Supabase credentials' }, { status: 500 });
    }

    try {
        const activeConn = await resolveActiveConnection(userId);

        if (!activeConn.openclaw.enabled) {
            return NextResponse.json({ error: 'No OpenClaw connection configured. Go to Settings → Console to connect.' }, { status: 400 });
        }

        const adapter = getAdapterForAgent(agentId, 'openclaw', {
            baseUrl: activeConn.openclaw.wsUrl || activeConn.openclaw.httpUrl,
            wsToken: activeConn.openclaw.token,
            userId,
        });

        // ── Build the install prompt ──
        const promptText = buildInstallPrompt({
            supabaseUrl: SUPABASE_URL,
            serviceRoleKey: SERVICE_ROLE_KEY,
            userId,
        });

        await adapter.invoke({
            agentId,
            runId: `hecate-install-${Date.now()}`,
            stepId: 'plugin-install',
            task: promptText,
            sessionKeyOverride: `nchat:${agentId}`,
            responseMode: 'text',
        }).catch(err => console.error('[Hecate Plugin Install]', err));

        return NextResponse.json({ success: true, message: 'Plugin install sent to agent' });
    } catch (err: any) {
        console.error('Failed to trigger plugin install:', err);
        return NextResponse.json({ error: err.message || 'Failed' }, { status: 500 });
    }
}

function buildInstallPrompt(creds: { supabaseUrl: string; serviceRoleKey: string; userId: string }): string {
    return `[SYSTEM DIRECTIVE: INSTALL HECATE PM PLUGIN — AUTOMATED SETUP]

You are installing the Hecate PM plugin to integrate this OpenClaw instance with the Hecate dashboard.
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

**Step 2: Download the Hecate plugin files**

Run this command:
\`\`\`bash
mkdir -p $OPENCLAW_HOME/extensions && cd /tmp && rm -rf hecate-plugin-tmp && git clone --depth 1 https://github.com/gilanggemar/Hecate.git hecate-plugin-tmp 2>/dev/null && rm -rf $OPENCLAW_HOME/extensions/hecate && cp -r hecate-plugin-tmp/hecate-openclaw-plugin $OPENCLAW_HOME/extensions/hecate && rm -rf hecate-plugin-tmp && echo "✓ Plugin files installed"
\`\`\`

Replace $OPENCLAW_HOME with the actual path you detected in Step 1.

---

**Step 3: Configure environment variables**

Append these EXACT lines to \`$OPENCLAW_HOME/.env\` (create the file if it doesn't exist). 
If any of these variables already exist in the file, UPDATE their values instead of duplicating them.

\`\`\`
HECATE_SUPABASE_URL=${creds.supabaseUrl}
HECATE_SERVICE_ROLE_KEY=${creds.serviceRoleKey}
HECATE_USER_ID=${creds.userId}
\`\`\`

---

**Step 4: Verify**

Confirm the following:
1. The directory \`$OPENCLAW_HOME/extensions/hecate/\` exists and contains \`index.ts\`, \`src/\`, and \`openclaw.plugin.json\`
2. The file \`$OPENCLAW_HOME/.env\` contains all three \`HECATE_*\` variables

---

**Step 5: Report back**

Tell the user:
- "✅ Hecate PM plugin installed successfully!"
- "All agents on this OpenClaw instance now have access to 5 Hecate tools: LIST_TASKS, CREATE_TASK, UPDATE_TASK, DELETE_TASK, LIST_AGENTS"
- "Please restart your gateway to activate the plugin (docker restart or openclaw gateway restart)"

Do NOT output the service role key in your response — keep it secure.
`;
}
