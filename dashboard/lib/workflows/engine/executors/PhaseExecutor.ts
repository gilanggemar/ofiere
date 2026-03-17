// ─── Phase Executor ──────────────────────────────────────────────────────────
// The most important executor — where agents do actual work.
// Uses the existing Agent Zero REST API integration.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { PhaseData } from '@/types/workflow-nodes';
import { getAgentZeroUrl, getAgentZeroApiKeyOptional } from '@/lib/config';

export class PhaseExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as PhaseData;
    const { broadcaster, signal } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      // Build phase context based on contextWindowPolicy
      let phaseContext: Record<string, unknown>;

      switch (data.contextWindowPolicy) {
        case 'full':
          phaseContext = context.getAll();
          break;
        case 'summary':
          phaseContext = {
            summary: this.summarizeContext(context),
            triggerInput: context.get('triggerInput'),
          };
          break;
        case 'relevant_only':
          phaseContext = this.getRelevantContext(context);
          break;
        default:
          phaseContext = context.getAll();
      }

      // Build system prompt
      const systemPrompt = this.buildPhaseSystemPrompt(data, phaseContext);

      // Execute via Agent Zero REST API
      const agentId = data.agentId ?? 'default';
      let iterationCount = 0;
      const maxIterations = data.maxIterations ?? 10;
      let phaseOutput: unknown = null;
      let phaseComplete = false;

      while (!phaseComplete && iterationCount < maxIterations) {
        if (signal.aborted) throw new Error('Execution aborted');

        iterationCount++;
        broadcaster.sendPhaseProgress(node.id, iterationCount, maxIterations, 'Agent reasoning...');

        const agentResponse = await this.callAgent({
          agentId,
          systemPrompt,
          userMessage: iterationCount === 1
            ? data.instructions
            : `Continue phase execution. Iteration ${iterationCount}/${maxIterations}. Previous result: ${JSON.stringify(phaseOutput)}`,
          model: data.model,
          context: phaseContext,
        });

        if (agentResponse.tokenUsage) {
          context.addTokenUsage(agentResponse.tokenUsage);
        }

        phaseOutput = agentResponse.output;

        // Check required outputs
        if (data.requiredOutputs && data.requiredOutputs.length > 0) {
          const outputObj = typeof phaseOutput === 'object' && phaseOutput !== null
            ? phaseOutput as Record<string, unknown>
            : {};
          const allPresent = data.requiredOutputs.every(key => key in outputObj);
          if (allPresent) {
            phaseComplete = true;
          } else {
            context.addLog('info', `Phase iteration ${iterationCount}: missing required outputs, continuing`, node.id);
          }
        } else {
          if (data.autonomyLevel === 'strict') {
            phaseComplete = true;
          } else {
            phaseComplete = agentResponse.isComplete ?? true;
          }
        }
      }

      if (!phaseComplete) {
        context.addLog('warn', `Phase hit max iterations (${maxIterations}) without completing`, node.id);
      }

      return { status: 'success', output: phaseOutput };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Phase execution failed';
      context.addLog('error', errorMsg, node.id);
      return { status: 'error', error: errorMsg };
    }
  }

  private buildPhaseSystemPrompt(data: PhaseData, phaseContext: Record<string, unknown>): string {
    const autonomyInstructions = {
      strict: 'Follow the instructions exactly. Do not deviate.',
      guided: 'Follow the general direction of the instructions. You may adapt your approach but explain any deviations.',
      autonomous: 'The instructions describe the goal. You decide the best approach to achieve it. Focus on results.',
    };

    return [
      `## Mission Phase: ${data.name}`,
      ``,
      `### Your Instructions`,
      data.instructions,
      ``,
      `### Operating Mode`,
      autonomyInstructions[data.autonomyLevel],
      ``,
      `### Available Context`,
      '```json',
      JSON.stringify(phaseContext, null, 2),
      '```',
      ``,
      data.requiredOutputs
        ? `### Required Outputs\nYou MUST include these keys in your JSON response: ${data.requiredOutputs.join(', ')}`
        : '',
      ``,
      `Respond with a JSON object containing your output. If you need more iterations to complete, include "isComplete": false.`,
    ].filter(Boolean).join('\n');
  }

  /**
   * Call Agent Zero via its REST API (server-side proxy route pattern).
   * This uses the same API that the chat feature uses.
   */
  private async callAgent(config: {
    agentId: string;
    systemPrompt: string;
    userMessage: string;
    model?: string;
    context: Record<string, unknown>;
  }): Promise<{ output: unknown; isComplete?: boolean; tokenUsage?: number }> {
    const agentZeroUrl = getAgentZeroUrl();
    const apiKey = getAgentZeroApiKeyOptional();

    // Compose the full message for Agent Zero
    const fullMessage = `${config.systemPrompt}\n\n---\n\n${config.userMessage}`;

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['X-API-KEY'] = apiKey;
      }

      const res = await fetch(`${agentZeroUrl}/v1/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: config.model || 'default',
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: config.userMessage },
          ],
        }),
      });

      if (!res.ok) {
        // Fallback: try the simpler /message endpoint used by Agent Zero
        const fallbackRes = await fetch(`${agentZeroUrl}/message`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            message: fullMessage,
            context_id: `workflow-phase-${config.agentId}`,
          }),
        });

        if (!fallbackRes.ok) {
          throw new Error(`Agent returned ${fallbackRes.status}: ${await fallbackRes.text()}`);
        }

        const fallbackData = await fallbackRes.json();
        return {
          output: fallbackData.response || fallbackData,
          isComplete: true,
        };
      }

      const data = await res.json();

      // Parse OpenAI-compatible response
      const responseContent = data.choices?.[0]?.message?.content || data.response || JSON.stringify(data);
      const tokenUsage = (data.usage?.total_tokens) || undefined;

      // Try to parse as JSON
      let parsedOutput: unknown;
      try {
        parsedOutput = JSON.parse(responseContent);
      } catch {
        parsedOutput = { response: responseContent };
      }

      const outputObj = typeof parsedOutput === 'object' && parsedOutput !== null
        ? parsedOutput as Record<string, unknown>
        : { response: parsedOutput };

      return {
        output: outputObj,
        isComplete: outputObj.isComplete as boolean | undefined ?? true,
        tokenUsage,
      };
    } catch (err) {
      throw new Error(
        `[PhaseExecutor] Agent call failed: ${err instanceof Error ? err.message : String(err)}. ` +
        `Agent: ${config.agentId}, URL: ${agentZeroUrl}`
      );
    }
  }

  private summarizeContext(context: MissionContext): string {
    const all = context.getAll();
    const keys = Object.keys(all);
    return `Mission context contains ${keys.length} keys: ${keys.join(', ')}`;
  }

  private getRelevantContext(context: MissionContext): Record<string, unknown> {
    return context.getAll();
  }
}
