// ─── Legacy Node Executors ───────────────────────────────────────────────────
// Executors for the original node types (trigger, agent, output, prompt,
// condition, transform, delay) so existing workflows actually run.

import type { Node } from '@xyflow/react';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { MissionContext } from '../MissionContext';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';

import { sendOpenClawMessage } from './openclawClient';

// ─── Trigger ─────────────────────────────────────────────────────────────────
export class LegacyTriggerExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const triggerType = (node.data.triggerType as string) || 'Manual';
    context.addLog('info', `[Trigger] ${triggerType} trigger fired`);

    // Pass any trigger input into the context
    const input = context.get('_triggerInput') ?? {};
    context.set('trigger_output', input);
    context.setNodeOutput(node.id, { triggerType, input, firedAt: new Date().toISOString() });

    return { status: 'success', output: input };
  }
}

// ─── Agent ───────────────────────────────────────────────────────────────────
export class LegacyAgentExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const agentName = (node.data.agentName as string) || 'Agent';
    const agentId = (node.data.agentId as string) || '';
    const provider = (node.data.provider as string) || 'Agent Zero';
    const instruction = (node.data.prompt as string) || '';

    if (!instruction) {
      context.addLog('error', `[Agent:${agentName}] No instruction provided`);
      return { status: 'error', error: 'No instruction set on agent node' };
    }

    // Collect upstream output as additional context
    const upstreamOutput = context.get('last_output');
    const fullPrompt = upstreamOutput
      ? `Context from previous step:\n${typeof upstreamOutput === 'string' ? upstreamOutput : JSON.stringify(upstreamOutput, null, 2)}\n\nInstruction: ${instruction}`
      : instruction;

    context.addLog('info', `[Agent:${agentName}] Sending to ${provider}: "${instruction}"`);

    try {
      let responseText: string;

      if (provider === 'Agent Zero') {
        responseText = await this.callAgentZero(fullPrompt, agentName);
      } else {
        context.addLog('info', `[Agent:${agentName}] Using OpenClaw WS server bridge...`);
        const sessionKey = `agent:${agentName.toLowerCase()}:workflow`;
        responseText = await sendOpenClawMessage(agentName, fullPrompt, sessionKey);
      }

      context.addLog('info', `[Agent:${agentName}] Response received (${responseText.length} chars)`);
      context.setNodeOutput(node.id, { agentName, response: responseText });
      context.set('agent_output', responseText);
      context.set('last_output', responseText);

      return { status: 'success', output: responseText };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Agent call failed';
      context.addLog('error', `[Agent:${agentName}] ${msg}`);
      return { status: 'error', error: msg };
    }
  }

  private async callAgentZero(prompt: string, agentName: string): Promise<string> {
    // Resolve connection from the user's active profile (matches /api/agent-zero/message pattern)
    const { agentZero } = await resolveActiveConnection(this.deps.userId);
    const baseUrl = agentZero.baseUrl;
    const apiKey = agentZero.apiKey;

    if (!agentZero.enabled || !baseUrl) {
      throw new Error('Agent Zero is not enabled or configured in the active connection profile');
    }

    if (!apiKey) {
      throw new Error('Agent Zero API key is not configured. Set it in your connection profile.');
    }

    const res = await fetch(`${baseUrl}/api_message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        message: prompt,
      }),
      signal: this.deps.signal,
    });

    if (!res.ok) {
      throw new Error(`Agent Zero returned ${res.status}: ${await res.text().catch(() => 'unknown')}`);
    }

    const data = await res.json();
    return data.response || data.message || data.content || JSON.stringify(data);
  }
}

// ─── Output ──────────────────────────────────────────────────────────────────
export class LegacyOutputExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const outputType = (node.data.outputType as string) || 'Notification';

    // Collect upstream output
    const result = context.get('last_output') ?? context.get('agent_output') ?? 'No output received';

    context.addLog('info', `[Output] Type: ${outputType}`);
    context.addLog('output', `📤 ${typeof result === 'string' ? result : JSON.stringify(result, null, 2)}`);

    context.setNodeOutput(node.id, { outputType, result });

    // If notification type, create a notification in Supabase
    if (outputType === 'Notification') {
      try {
        await this.deps.supabase.from('notifications').insert({
          type: 'workflow_output',
          title: 'Workflow Output',
          message: typeof result === 'string' ? result : JSON.stringify(result),
          user_id: this.deps.userId,
        });
      } catch {
        context.addLog('error', '[Output] Failed to save notification');
      }
    }

    return { status: 'success', output: result };
  }
}

// ─── Prompt ──────────────────────────────────────────────────────────────────
export class LegacyPromptExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    let template = (node.data.promptText as string) || '';

    // Simple variable substitution: {{variable}} → context data
    template = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const val = context.get(key);
      return val !== undefined ? String(val) : `{{${key}}}`;
    });

    context.addLog('info', `[Prompt] Template resolved (${template.length} chars)`);
    context.setNodeOutput(node.id, { resolved: template });
    context.set('last_output', template);

    return { status: 'success', output: template };
  }
}

// ─── Delay ───────────────────────────────────────────────────────────────────
export class LegacyDelayExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const delayMs = (node.data.delayMs as number) || 1000;
    context.addLog('info', `[Delay] Waiting ${delayMs}ms...`);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, delayMs);
      this.deps.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); });
    });

    context.addLog('info', `[Delay] Done`);
    return { status: 'success' };
  }
}

// ─── Condition ───────────────────────────────────────────────────────────────
export class LegacyConditionExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const expression = (node.data.expression as string) || 'true';
    context.addLog('info', `[Condition] Evaluating: ${expression}`);

    // Simple condition evaluation
    let result = true;
    try {
      // Replace {{variable}} with context values
      const resolved = expression.replace(/\{\{(\w+)\}\}/g, (_, key) => {
        const val = context.get(key);
        return JSON.stringify(val);
      });
      result = Boolean(new Function('return ' + resolved)());
    } catch {
      context.addLog('error', `[Condition] Failed to evaluate expression`);
      result = false;
    }

    context.setNodeOutput(node.id, { result, expression });
    return { status: 'success', output: { result, branch: result ? 'true' : 'false' } };
  }
}

// ─── Transform ───────────────────────────────────────────────────────────────
export class LegacyTransformExecutor implements NodeExecutor {
  constructor(private deps: ExecutorDeps) {}

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const code = (node.data.code as string) || '';
    if (!code) return { status: 'success', output: context.get('last_output') };

    context.addLog('info', `[Transform] Running code transform`);

    try {
      const input = context.get('last_output');
      const fn = new Function('input', 'context', code);
      const result = fn(input, { getData: (k: string) => context.get(k) });
      context.setNodeOutput(node.id, result);
      context.set('last_output', result);
      return { status: 'success', output: result };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Transform failed';
      context.addLog('error', `[Transform] ${msg}`);
      return { status: 'error', error: msg };
    }
  }
}
