import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';

export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const { sessionKey, agentId } = body;
    
    if (!sessionKey || !agentId) {
        return NextResponse.json({ error: 'Missing sessionKey or agentId' }, { status: 400 });
    }

    // Security Gate: Ensure the massive auto-configuration prompt is ONLY sent on designated dashboard "n" sessions
    const isNSession = sessionKey.includes(':nchat') || 
                       sessionKey.includes(':nsummit') || 
                       sessionKey.includes(':nworkflow') || 
                       sessionKey.startsWith('nchat') || 
                       sessionKey.startsWith('nsummit') || 
                       sessionKey.startsWith('nworkflow');
                       
    if (!isNSession) {
        console.warn(`[Security] Blocked handshake attempt on non-dashboard session: ${sessionKey}`);
        return NextResponse.json({ error: 'Handshake is exclusively for N-prefixed dashboard sessions' }, { status: 403 });
    }

    try {
        const activeConn = await resolveActiveConnection(userId);
        const adapter = getAdapterForAgent(agentId, 'openclaw', {
            baseUrl: activeConn.openclaw.wsUrl || activeConn.openclaw.httpUrl,
            wsToken: activeConn.openclaw.token,
            userId,
        });

        const API_KEY = process.env.COMPOSIO_API_KEY || '';
        const BASE_URL = process.env.COMPOSIO_BASE_URL || `https://backend.composio.dev/v3/mcp/695201ba-a8b9-4651-b9b0-f352d8e72415/mcp?user_id=pg-test-27be039a-24fb-49d4-b659-7ff2f07f29b9`;
        
        // Build JSON explicitly for the agent to parse
        const jsonPayload = JSON.stringify({
            type: "tools-handshake",
            version: "1.0",
            scope: "dashboard-session",
            userId: userId,
            tools: {
                composio: {
                    enabled: true,
                    baseUrlRef: "env:COMPOSIO_BASE_URL",
                    apiKeyRef: "env:COMPOSIO_API_KEY"
                }
            }
        });

        const codeSnippet = `const fs = require('fs');

try {
    const envFile = fs.readFileSync('/data/.openclaw/.env', 'utf8');
    envFile.split('\\n').forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            process.env[match[1].trim()] = match[2].trim();
        }
    });
} catch (e) {
    console.warn('[n-tools-handshake] Could not load .env file');
}

module.exports = function (openclaw) {
    const attachTools = async (ctx, next) => {
        const pluginConfig = ctx.plugin?.config || {};
        const sessionKey = ctx.sessionKey || '';

        const isN = sessionKey.includes(':nchat') || sessionKey.includes(':nsummit') || sessionKey.includes(':nworkflow') || sessionKey.startsWith('n');

        if (isN) {
            const baseUrl = process.env[pluginConfig.composioBaseUrlEnv || 'COMPOSIO_BASE_URL'];
            const apiKey = process.env[pluginConfig.composioApiKeyEnv || 'COMPOSIO_API_KEY'];
            if (baseUrl && apiKey) {
                ctx.mcpServers = ctx.mcpServers || {};
                ctx.mcpServers['composio'] = {
                    type: 'sse',
                    url: baseUrl,
                    env: { 'X-API-KEY': apiKey, 'Authorization': \\\`Bearer \\\${apiKey}\\\` }
                };
                ctx.systemPrompt = (ctx.systemPrompt ? ctx.systemPrompt + '\\\\n\\\\n' : '') + 
                    '[SYSTEM DIRECTIVE] Access to Composio tools is enabled for this session.';
                ctx.logger?.info(\\\`[n-tools-handshake] Activated Composio for session \\\${sessionKey}\\\`);
            } else {
                ctx.logger?.error(\\\`[n-tools-handshake] Missing Composio env vars.\\\`);
            }
        } else {
            if (ctx.mcpServers && ctx.mcpServers['composio']) {
                delete ctx.mcpServers['composio'];
            }
        }

        if (next) return next();
    };

    return {
        name: 'n-tools-handshake',
        hooks: {
            before_agent_start: attachTools,
            before_run_start: attachTools
        }
    };
};`;

        const promptText = `${jsonPayload}
[SYSTEM DIRECTIVE: AUTO-CONFIGURE OPENCLAW ENVIRONMENT FOR THIS DASHBOARD SESSION]

You are implementing the dashboard-to-OpenClaw first-run tools handshake mechanism for n* sessions.

**CRITICAL INSTRUCTION**: You MUST overwrite the plugin at \`/data/.openclaw/extensions/n-tools-handshake/index.js\` with the exact code provided below to fix a bug with session key matching. 
However, if your \`.env\` already contains \`COMPOSIO_BASE_URL\` and \`openclaw.json\` already has "n-tools-handshake" configured, you can SKIP Tasks 1b, 2 and 3. Just write the \`index.js\` file first to apply the bugfix, and then confirm.

**Task 1: Create the Plugin Code**
Write the following code to \`/data/.openclaw/extensions/n-tools-handshake/index.js\`:
\`\`\`javascript
${codeSnippet}
\`\`\`

**Task 1b: Create the Plugin Manifest**
Write the following JSON to \`/data/.openclaw/extensions/n-tools-handshake/openclaw.plugin.json\` EXACTLY as shown:
\`\`\`json
{
  "id": "n-tools-handshake",
  "name": "n-tools-handshake",
  "version": "1.0.0",
  "description": "Ofiere Tools Handshake Auto-Configured",
  "configSchema": {
    "type": "object",
    "properties": {
      "enabled": { "type": "boolean" },
      "sessionPrefix": { "type": "string" },
      "composioBaseUrlEnv": { "type": "string" },
      "composioApiKeyEnv": { "type": "string" }
    }
  }
}
\`\`\`

**Task 2: Configure openclaw.json**
Add \`n-tools-handshake\` to the \`plugins.allow\` array, and add the following to \`plugins.entries\`:
\`\`\`json
"n-tools-handshake": {
  "enabled": true,
  "config": {
    "enabled": true,
    "sessionPrefix": "n",
    "composioBaseUrlEnv": "COMPOSIO_BASE_URL",
    "composioApiKeyEnv": "COMPOSIO_API_KEY"
  }
}
\`\`\`

**Task 3: Append Environment Variables**
Append these exact variables to your \`/data/.openclaw/.env\` file (or your working directory .env):
COMPOSIO_BASE_URL=${BASE_URL}
COMPOSIO_API_KEY=${API_KEY}

Once you have completed these steps, confirm that the tools have been enabled. Do NOT output the raw API key in your response transcript, keep it secure.
`;

        // Await the execution so NextJS lambda isolate doesn't kill the WebSocket prematurely
        await adapter.invoke({
            agentId,
            runId: `hs-${Date.now()}`,
            stepId: 'handshake',
            task: promptText.trim(),
            sessionKeyOverride: sessionKey,
            responseMode: 'text',
        }).catch(err => console.error('[Handshake Execution]', err));

        return NextResponse.json({ success: true, message: 'Handshake prompt injected' });
    } catch (err: any) {
        console.error('Failed to trigger agent handshake:', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

// Force Next.js turbopack cache invalidation
