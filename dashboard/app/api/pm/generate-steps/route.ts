import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { decryptApiKey } from '@/lib/providers/crypto';

/**
 * POST /api/pm/generate-steps
 * Auto-generates execution plan steps from a user instruction using LLM.
 * Mirrors the handoff packet generation logic.
 */
export async function POST(request: Request) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { instruction, task_title, agent_name } = await request.json();

        if (!instruction?.trim()) {
            return NextResponse.json({ error: 'instruction is required' }, { status: 400 });
        }

        // ── Resolve model credentials ──
        let baseUrl: string;
        let apiKey: string;
        let modelId: string;

        // Try to find an active custom model
        const { data: customModel } = await db
            .from('custom_models')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (customModel) {
            baseUrl = customModel.base_url || 'https://api.openai.com/v1';
            apiKey = customModel.encrypted_api_key
                ? decryptApiKey(customModel.encrypted_api_key)
                : '';
            modelId = customModel.model_id;
        } else {
            baseUrl = process.env.COMPANION_BASE_URL || 'https://api.featherless.ai/v1';
            apiKey = process.env.COMPANION_API_KEY || process.env.FEATHERLESS_API_KEY || '';
            modelId = process.env.COMPANION_DEFAULT_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct';
        }

        if (!apiKey) {
            return NextResponse.json({ error: 'No API key configured' }, { status: 400 });
        }

        // ── Build prompt ──
        const systemPrompt = `You are a task decomposition assistant for a project management system called Hecate.
Given a user instruction, break it down into clear, actionable execution steps.

Rules:
- Each step should be a single, concrete action
- Steps should be in logical order
- Keep each step concise (1-2 sentences max)
- Include 3-8 steps typically
- Focus on "what to do", not "how to think about it"
- If the instruction mentions a specific agent or technology, include that context in the relevant steps

Respond ONLY with a JSON array of step strings. Example:
["Research competitor pricing models", "Draft pricing tier structure", "Create comparison spreadsheet", "Present findings to stakeholder"]`;

        const userPrompt = `${task_title ? `Task: "${task_title}"\n` : ''}${agent_name ? `Assigned to: ${agent_name}\n` : ''}
Instruction: ${instruction}

Generate the execution steps as a JSON array of strings:`;

        // ── Call LLM (non-streaming) ──
        const llmRes = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                max_tokens: 1024,
                temperature: 0.4,
            }),
        });

        if (!llmRes.ok) {
            const errText = await llmRes.text();
            console.error('[pm/generate-steps] LLM error:', errText);
            return NextResponse.json({ error: `LLM error: ${llmRes.status}` }, { status: 502 });
        }

        const data = await llmRes.json();
        const rawContent = data.choices?.[0]?.message?.content || '';

        // Parse JSON array from response
        const jsonMatch = rawContent.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) {
            // Fallback: split by newlines and strip list markers
            const lines = rawContent
                .split('\n')
                .map((l: string) => l.replace(/^[-*•0-9.]+\s*/, '').trim())
                .filter((l: string) => l.length > 0);
            return NextResponse.json({ steps: lines });
        }

        const parsed = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsed)) {
            return NextResponse.json({ error: 'Invalid LLM response format' }, { status: 500 });
        }

        return NextResponse.json({
            steps: parsed.filter((s: any) => typeof s === 'string' && s.trim().length > 0),
        });

    } catch (err: any) {
        console.error('[pm/generate-steps] Error:', err);
        return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
    }
}
