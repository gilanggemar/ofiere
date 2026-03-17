// ─── Delegation Executor ─────────────────────────────────────────────────────
// Agent-to-agent handoff using Agent Zero REST API.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { DelegationData } from '@/types/workflow-nodes';
import { getAgentZeroUrl, getAgentZeroApiKeyOptional } from '@/lib/config';

export class DelegationExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as DelegationData;
    const { broadcaster, signal } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });
    broadcaster.send('delegation:started', {
      nodeId: node.id,
      targetAgent: data.targetAgentId,
      delegationType: data.delegationType,
    });

    try {
      // Build delegate context
      const delegateContext: Record<string, unknown> = {};
      for (const key of (data.contextPassthrough || [])) {
        delegateContext[key] = context.get(key) ?? context.getNodeOutput(key);
      }

      // Timeout handling
      const timeoutMs = data.timeout ? data.timeout * 60 * 1000 : 5 * 60 * 1000;

      const delegateResult = await Promise.race([
        this.dispatchToAgent(data, delegateContext),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Delegation timed out')), timeoutMs)
        ),
      ]);

      broadcaster.send('delegation:completed', {
        nodeId: node.id,
        targetAgent: data.targetAgentId,
      });

      return { status: 'success', output: delegateResult };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Delegation failed';
      context.addLog('error', errorMsg, node.id);

      switch (data.fallbackBehavior) {
        case 'retry':
          context.addLog('info', 'Delegation failed — retrying once', node.id);
          try {
            const retryResult = await this.dispatchToAgent(data, context.getAll());
            return { status: 'success', output: retryResult };
          } catch {
            return { status: 'error', error: `Delegation failed after retry: ${errorMsg}` };
          }
        case 'skip':
          return { status: 'skipped' };
        case 'abort':
          return { status: 'error', error: errorMsg };
        case 'escalate':
        default:
          return { status: 'error', error: `Delegation requires escalation: ${errorMsg}` };
      }
    }
  }

  private async dispatchToAgent(
    data: DelegationData,
    delegateContext: Record<string, unknown>
  ): Promise<unknown> {
    const agentZeroUrl = getAgentZeroUrl();
    const apiKey = getAgentZeroApiKeyOptional();

    const delegationPrompt = [
      `You are receiving a ${data.delegationType} delegation.`,
      ``,
      `## Briefing`,
      data.briefing,
      ``,
      `## Expected Output`,
      data.expectedOutput,
      ``,
      `## Context`,
      '```json',
      JSON.stringify(delegateContext, null, 2),
      '```',
    ].join('\n');

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (apiKey) headers['X-API-KEY'] = apiKey;

    const res = await fetch(`${agentZeroUrl}/message`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: delegationPrompt,
        context_id: `workflow-delegation-${data.targetAgentId}-${Date.now()}`,
      }),
    });

    if (!res.ok) {
      throw new Error(`Agent delegation failed: ${res.status} ${await res.text()}`);
    }

    const result = await res.json();
    return result.response || result;
  }
}
