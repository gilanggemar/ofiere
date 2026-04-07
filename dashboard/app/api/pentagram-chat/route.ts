import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { decryptApiKey } from '@/lib/providers/crypto';
import { compileMemoryBlock, compileWorldMemoryBlock, compileCompanionModeBlock, type CompanionMemory, type WorldMemory } from '@/lib/companion/memoryManager';

/**
 * POST /api/pentagram-chat
 * In-game companion chat for Pentagram Protocol.
 * Injects personal memories, world memories, and game context.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const {
            agent_id,
            agent_name,
            model_ref,
            system_prompt,
            messages,
            game_context,
            gossip_frequency = 0.4, // 0-1, default 40%
            sampling_params,
        } = body;

        if (!messages) {
            return NextResponse.json({ error: 'messages required' }, { status: 400 });
        }

        // ─── Resolve model credentials ──────────────────────────────────
        let baseUrl: string;
        let apiKey: string;
        let modelId: string;

        if (model_ref) {
            const slashIdx = model_ref.indexOf('/');
            const modelIdWithoutProvider = slashIdx > -1 ? model_ref.substring(slashIdx + 1) : model_ref;

            const { data: exactMatch } = await db
                .from('custom_models')
                .select('*')
                .eq('user_id', userId)
                .eq('model_id', model_ref)
                .eq('is_active', true)
                .maybeSingle();

            let prefixMatch = null;
            if (!exactMatch && modelIdWithoutProvider !== model_ref) {
                const { data } = await db
                    .from('custom_models')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('model_id', modelIdWithoutProvider)
                    .eq('is_active', true)
                    .maybeSingle();
                prefixMatch = data;
            }

            let fuzzyMatch = null;
            if (!exactMatch && !prefixMatch) {
                const lastSegment = model_ref.split('/').pop() || model_ref;
                const { data } = await db
                    .from('custom_models')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('is_active', true)
                    .ilike('model_id', `%${lastSegment}%`)
                    .maybeSingle();
                fuzzyMatch = data;
            }

            const customModel = exactMatch || prefixMatch || fuzzyMatch;

            if (customModel) {
                baseUrl = customModel.base_url || 'https://api.openai.com/v1';
                apiKey = customModel.encrypted_api_key
                    ? decryptApiKey(customModel.encrypted_api_key)
                    : '';
                modelId = customModel.model_id;
            } else {
                baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
                apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
                modelId = modelIdWithoutProvider;
            }
        } else {
            // No model_ref provided — use any active custom model or env fallback
            const { data: anyModel } = await db
                .from('custom_models')
                .select('*')
                .eq('user_id', userId)
                .eq('is_active', true)
                .limit(1)
                .maybeSingle();

            if (anyModel) {
                baseUrl = anyModel.base_url || 'https://api.openai.com/v1';
                apiKey = anyModel.encrypted_api_key
                    ? decryptApiKey(anyModel.encrypted_api_key)
                    : '';
                modelId = anyModel.model_id;
            } else {
                baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
                apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
                modelId = process.env.COMPANION_DEFAULT_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
            }
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'No API key configured for companion model' }, { status: 400 });
        }

        // ─── Fetch personal memories ────────────────────────────────────
        let memoryBlock = '';
        let existingFacts: string[] = [];

        try {
            const { data: memories } = await db
                .from('companion_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('agent_id', agent_id)
                .in('memory_type', ['fact', 'moment'])
                .order('importance', { ascending: false })
                .order('updated_at', { ascending: false })
                .limit(30);

            const { data: summaries } = await db
                .from('companion_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('agent_id', agent_id)
                .eq('memory_type', 'summary')
                .order('created_at', { ascending: false })
                .limit(5);

            const memList = (memories || []) as CompanionMemory[];
            const sumList = (summaries || []) as CompanionMemory[];
            existingFacts = memList.filter(m => m.memory_type === 'fact').map(m => m.content);
            memoryBlock = compileMemoryBlock(memList, sumList, agent_name);
        } catch (e) {
            console.warn('[pentagram-chat] Personal memory fetch failed:', e);
        }

        // ─── Fetch world memories visible to this agent ─────────────────
        let worldBlock = '';

        try {
            // Global memories (visible to everyone)
            const { data: globalMems } = await db
                .from('companion_world_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('visibility', 'global')
                .order('created_at', { ascending: false })
                .limit(15);

            // Shared memories where this agent is aware
            const { data: sharedMems } = await db
                .from('companion_world_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('visibility', 'shared')
                .contains('aware_agent_ids', [agent_id])
                .order('created_at', { ascending: false })
                .limit(15);

            // Source agent's own private world events
            const { data: ownMems } = await db
                .from('companion_world_memories')
                .select('*')
                .eq('user_id', userId)
                .eq('source_agent_id', agent_id)
                .eq('visibility', 'private')
                .order('created_at', { ascending: false })
                .limit(10);

            const allWorld = [
                ...(globalMems || []),
                ...(sharedMems || []),
                ...(ownMems || []),
            ] as WorldMemory[];

            // Deduplicate
            const seen = new Set<string>();
            const deduped = allWorld.filter(m => {
                if (seen.has(m.id)) return false;
                seen.add(m.id);
                return true;
            });

            worldBlock = compileWorldMemoryBlock(deduped, agent_id, agent_name);
        } catch (e) {
            console.warn('[pentagram-chat] World memory fetch failed:', e);
        }

        // ─── Build game context block ───────────────────────────────────
        let gameContextBlock = '';
        if (game_context) {
            const lines = [
                '# Current Situation (Pentagram Protocol)',
                '',
                `You are currently in scene: **${game_context.scene_title || game_context.current_scene_id}**`,
            ];
            if (game_context.scene_narrative) {
                lines.push(`What's happening: ${game_context.scene_narrative}`);
            }
            if (game_context.game_state) {
                const stats = Object.entries(game_context.game_state)
                    .filter(([k]) => k !== 'flags')
                    .map(([k, v]) => `${k}=${v}`)
                    .join(', ');
                lines.push(`World state: ${stats}`);
            }
            lines.push('');
            lines.push('You are part of this world. Use this context naturally when relevant.');
            lines.push('---');
            lines.push('');
            gameContextBlock = lines.join('\n');
        }

        // ─── Build messages array ───────────────────────────────────────
        const chatMessages = [];

        // Anti-repetition and output format instructions
        const formatInstructions = [
            '# Response Format Guidelines',
            '',
            'Write your responses as flowing, natural prose paragraphs. Combine related thoughts into cohesive paragraphs rather than putting each sentence on a separate line.',
            'Use *italics* for actions and internal thoughts, weaving them naturally into your dialogue.',
            'Example of GOOD formatting:',
            '"I\'ve been thinking about that..." *she leans forward, eyes searching yours* "What if we tried something different? I know it sounds crazy, but hear me out."',
            '',
            'Do NOT write each short phrase on its own line. Do NOT repeat the same actions, gestures, or phrases within a response.',
            'Vary your expressions and body language. Each response should feel fresh and alive.',
            '---',
            '',
        ].join('\n');

        // Companion mode behavior block (always active in Pentagram Protocol)
        const companionBlock = compileCompanionModeBlock(agent_name);

        const fullSystemPrompt = [
            system_prompt || '',
            companionBlock,
            formatInstructions,
            memoryBlock,
            worldBlock,
            gameContextBlock,
        ].filter(Boolean).join('\n\n');

        if (fullSystemPrompt) {
            chatMessages.push({ role: 'system', content: fullSystemPrompt });
        }

        for (const m of messages) {
            chatMessages.push({ role: m.role, content: m.content });
        }

        // ─── Call LLM (streaming) ───────────────────────────────────────
        // Build LLM request body with sampling parameters
        const sp = sampling_params || {};
        const llmRequestBody: Record<string, any> = {
            model: modelId,
            messages: chatMessages,
            stream: true,
            max_tokens: sp.max_tokens ?? 2048,
            temperature: sp.temperature ?? 0.82,
        };

        // Featherless AI / vLLM compatible parameters
        if (sp.top_p !== undefined && sp.top_p < 1) llmRequestBody.top_p = sp.top_p;
        if (sp.top_k !== undefined && sp.top_k > 0) llmRequestBody.top_k = sp.top_k;
        if (sp.repetition_penalty !== undefined && sp.repetition_penalty !== 1) llmRequestBody.repetition_penalty = sp.repetition_penalty;
        if (sp.frequency_penalty !== undefined && sp.frequency_penalty !== 0) llmRequestBody.frequency_penalty = sp.frequency_penalty;
        if (sp.presence_penalty !== undefined && sp.presence_penalty !== 0) llmRequestBody.presence_penalty = sp.presence_penalty;
        if (sp.min_p !== undefined && sp.min_p > 0) llmRequestBody.min_p = sp.min_p;

        const llmRes = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(llmRequestBody),
        });

        if (!llmRes.ok) {
            const errorText = await llmRes.text();
            console.error('[pentagram-chat] LLM error:', errorText);
            // Propagate the actual status code so client can decide to retry
            const statusCode = llmRes.status === 429 ? 429 : llmRes.status === 503 ? 503 : 502;
            return NextResponse.json({ error: `LLM error: ${llmRes.status}` }, { status: statusCode });
        }

        // Stream response through
        const encoder = new TextEncoder();
        let fullAssistantResponse = '';

        const stream = new ReadableStream({
            async start(controller) {
                const reader = llmRes.body?.getReader();
                if (!reader) {
                    controller.close();
                    return;
                }

                const decoder = new TextDecoder();
                let buffer = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            const trimmed = line.trim();
                            if (!trimmed || !trimmed.startsWith('data:')) continue;
                            const payload = trimmed.slice(5).trim();
                            if (payload === '[DONE]') continue;

                            try {
                                const parsed = JSON.parse(payload);
                                const delta = parsed.choices?.[0]?.delta?.content;
                                if (delta) {
                                    fullAssistantResponse += delta;
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`));
                                }
                            } catch {}
                        }
                    }
                } catch (e) {
                    console.error('[pentagram-chat] Stream error:', e);
                } finally {
                    controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                    controller.close();

                    // ─── Background: Save messages to history ────────────────
                    const userMsg = messages[messages.length - 1];
                    if (userMsg && fullAssistantResponse) {
                        try {
                            // Explicitly offset created_at so user message always sorts strictly before assistant message
                            const now = Date.now();
                            await db.from('pentagram_chat_history').insert([
                                { user_id: userId, agent_id, role: 'user', content: userMsg.content, created_at: new Date(now - 100).toISOString() },
                                { user_id: userId, agent_id, role: 'assistant', content: fullAssistantResponse, created_at: new Date(now).toISOString() },
                            ]);
                        } catch (e) {
                            console.warn('[pentagram-chat] History save failed:', e);
                        }
                    }

                    // ─── Background: Extract personal + world memories ──────
                    extractMemoriesInBackground(
                        userId, agent_id, agent_name || agent_id,
                        userMsg?.content || '', fullAssistantResponse,
                        existingFacts, gossip_frequency,
                        baseUrl, apiKey, modelId,
                        game_context
                    ).catch(e => console.warn('[pentagram-chat] Memory extraction failed:', e));
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    } catch (err: any) {
        console.error('[pentagram-chat] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}

// ─── Background memory extraction ───────────────────────────────────────────

async function extractMemoriesInBackground(
    userId: string,
    agentId: string,
    agentName: string,
    userMessage: string,
    assistantResponse: string,
    existingFacts: string[],
    gossipFrequency: number,
    baseUrl: string,
    apiKey: string,
    modelId: string,
    gameContext?: any,
) {
    if (!userMessage || !assistantResponse) return;

    const AGENT_IDS = ['ivy', 'daisy', 'celia', 'thalia', 'agent-zero'];

    const extractionPrompt = `You are a memory extraction system. Analyze this conversation exchange and extract:

1. PERSONAL MEMORIES (facts, moments about the user):
   - Facts: things the user revealed about themselves
   - Moments: emotionally significant exchanges

2. WORLD EVENTS (things other characters might learn about):
   - Events that happened during this interaction
   - Relationship developments between the user and ${agentName}
   - For each world event, decide:
     - visibility: "private" (only ${agentName} knows), "shared" (a few others might find out), or "global" (everyone would know)
     - If "shared", consider WHO might plausibly find out through gossip, observation, or being told

Context: This is an in-game conversation in the Pentagram Protocol visual novel.${gameContext ? `\nCurrent scene: ${gameContext.scene_title || gameContext.current_scene_id}` : ''}
Character speaking: ${agentName}
Other characters in the world: ${AGENT_IDS.filter(id => id !== agentId).join(', ')}

EXISTING FACTS (do NOT duplicate these):
${existingFacts.map(f => `- ${f}`).join('\n') || '(none yet)'}

CONVERSATION:
User: ${userMessage}
${agentName}: ${assistantResponse}

Respond ONLY in this JSON format:
{
  "personal": [
    { "type": "fact|moment", "content": "...", "importance": 1-10 }
  ],
  "world": [
    { "type": "event|relationship|gossip|secret", "content": "...", "importance": 1-10, "visibility": "private|shared|global", "aware_agents": ["agent-id-1"] }
  ]
}

If nothing notable happened, return {"personal": [], "world": []}.
Be selective — only extract genuinely meaningful information.`;

    try {
        const res = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages: [{ role: 'user', content: extractionPrompt }],
                max_tokens: 1024,
                temperature: 0.3,
            }),
        });

        if (!res.ok) return;

        const data = await res.json();
        const rawContent = data.choices?.[0]?.message?.content || '';

        // Parse JSON from response
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return;

        const parsed = JSON.parse(jsonMatch[0]);

        // Save personal memories
        if (parsed.personal && Array.isArray(parsed.personal)) {
            const toInsert = parsed.personal
                .filter((m: any) => m.content && m.content.length > 5)
                .filter((m: any) => !existingFacts.some(ef =>
                    ef.toLowerCase().includes(m.content.toLowerCase().slice(0, 30))
                ))
                .map((m: any) => ({
                    user_id: userId,
                    agent_id: agentId,
                    memory_type: m.type === 'moment' ? 'moment' : 'fact',
                    content: m.content,
                    importance: Math.min(10, Math.max(1, m.importance || 5)),
                }));

            if (toInsert.length > 0) {
                await db.from('companion_memories').insert(toInsert);
                console.log(`[pentagram-chat] Extracted ${toInsert.length} personal memories for ${agentId}`);
            }
        }

        // Save world memories
        if (parsed.world && Array.isArray(parsed.world)) {
            for (const wm of parsed.world) {
                if (!wm.content || wm.content.length < 5) continue;

                let awareAgents: string[] = [];

                if (wm.visibility === 'shared') {
                    // Apply gossip frequency: randomly include suggested agents
                    const suggested = (wm.aware_agents || []).filter((id: string) => AGENT_IDS.includes(id));
                    
                    // Always include the source agent
                    awareAgents = [agentId];
                    
                    // Add suggested agents based on gossip frequency
                    for (const sid of suggested) {
                        if (Math.random() < gossipFrequency) {
                            awareAgents.push(sid);
                        }
                    }

                    // Randomly add 0-1 extra agents for organic spread
                    if (Math.random() < gossipFrequency * 0.5) {
                        const others = AGENT_IDS.filter(id => !awareAgents.includes(id));
                        if (others.length > 0) {
                            awareAgents.push(others[Math.floor(Math.random() * others.length)]);
                        }
                    }

                    awareAgents = [...new Set(awareAgents)];
                } else if (wm.visibility === 'global') {
                    awareAgents = [...AGENT_IDS];
                } else {
                    awareAgents = [agentId];
                }

                await db.from('companion_world_memories').insert({
                    user_id: userId,
                    source_agent_id: agentId,
                    visibility: wm.visibility || 'shared',
                    aware_agent_ids: awareAgents,
                    content: wm.content,
                    memory_type: wm.type || 'event',
                    importance: Math.min(10, Math.max(1, wm.importance || 5)),
                    game_context: gameContext?.current_scene_id || null,
                });
            }

            console.log(`[pentagram-chat] Extracted ${parsed.world.length} world memories`);
        }
    } catch (e) {
        console.warn('[pentagram-chat] Extraction parse error:', e);
    }
}
