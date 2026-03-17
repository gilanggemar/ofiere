// ─── Gate Executor ───────────────────────────────────────────────────────────
// Human-in-the-loop approval gates, confidence thresholds, conditions, budget checks.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { GateData } from '@/types/workflow-nodes';

export class GateExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as GateData;
    const { broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    switch (data.gateType) {
      case 'human_approval':
        return this.handleHumanApproval(node, data, context);

      case 'confidence_threshold': {
        const allOutputs = context.getAllNodeOutputs();
        const outputValues = Object.values(allOutputs);
        const lastOutput = outputValues[outputValues.length - 1] as Record<string, unknown> | undefined;
        const confidence = (lastOutput?.confidence ?? lastOutput?.score ?? 0) as number;
        if (confidence >= (data.threshold ?? 0.8)) {
          context.addLog('info', `Gate passed: confidence ${confidence} >= ${data.threshold}`, node.id);
          return { status: 'success', output: { passed: true, confidence } };
        } else {
          context.addLog('warn', `Gate blocked: confidence ${confidence} < ${data.threshold}`, node.id);
          return { status: 'success', output: { passed: false, confidence, reason: 'Below threshold' } };
        }
      }

      case 'condition': {
        const result = context.evaluateCondition(data.condition ?? 'false');
        return { status: 'success', output: { passed: result } };
      }

      case 'budget_check': {
        const usage = context.getTokenUsage();
        const withinBudget = !context.isOverBudget();
        return { status: 'success', output: { passed: withinBudget, ...usage } };
      }

      default:
        return { status: 'error', error: `Unknown gate type: ${data.gateType}` };
    }
  }

  private async handleHumanApproval(
    node: Node,
    data: GateData,
    context: MissionContext
  ): Promise<NodeExecutionResult> {
    const { broadcaster, supabase, signal, userId } = this.deps;

    // Collect review data
    const reviewPayload: Record<string, unknown> = {};
    for (const key of (data.reviewData ?? [])) {
      reviewPayload[key] = context.get(key) ?? context.getNodeOutput(key);
    }

    // Create approval request in Supabase
    const { data: approvalRecord } = await supabase.from('workflow_gate_approvals').insert({
      run_id: (context.get('runId') as string) ?? 'unknown',
      node_id: node.id,
      status: 'pending',
      review_data: reviewPayload,
      timeout_minutes: data.timeoutMinutes ?? null,
      timeout_action: data.timeoutAction ?? 'escalate',
      created_at: new Date().toISOString(),
      user_id: userId,
    }).select().single();

    // Notify the frontend
    broadcaster.sendGateRequest(node.id, reviewPayload);

    // Poll for approval
    const approvalId = approvalRecord?.id;
    const timeoutMs = (data.timeoutMinutes ?? 60) * 60 * 1000;
    const startTime = Date.now();

    while (true) {
      if (signal.aborted) throw new Error('Execution aborted while waiting for gate approval');

      const { data: current } = await supabase
        .from('workflow_gate_approvals')
        .select('status, response')
        .eq('id', approvalId)
        .single();

      if (current?.status === 'approved') {
        context.addLog('info', 'Gate approved by human', node.id);
        return { status: 'success', output: { passed: true, response: current.response } };
      }

      if (current?.status === 'rejected') {
        context.addLog('info', 'Gate rejected by human', node.id);
        return { status: 'success', output: { passed: false, response: current.response } };
      }

      // Check timeout
      if (Date.now() - startTime > timeoutMs) {
        context.addLog('warn', `Gate timed out after ${data.timeoutMinutes} minutes`, node.id);
        const action = data.timeoutAction ?? 'escalate';
        if (action === 'approve') return { status: 'success', output: { passed: true, reason: 'timeout_auto_approved' } };
        if (action === 'reject') return { status: 'success', output: { passed: false, reason: 'timeout_auto_rejected' } };
        return { status: 'error', error: 'Gate timed out — escalation required' };
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}
