// ─── Mission Context ─────────────────────────────────────────────────────────
// Shared working memory for a workflow run. Every node reads from and writes to this.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { WebSocketBroadcaster } from './WebSocketBroadcaster';

interface ContextConfig {
  runId: string;
  triggerInput: Record<string, unknown>;
  supabase: SupabaseClient;
  broadcaster?: WebSocketBroadcaster;
}

export class MissionContext {
  private runId: string;
  private data: Map<string, unknown>;
  private nodeOutputs: Map<string, unknown>;
  private logs: Array<{ level: string; message: string; timestamp: string; nodeId?: string }>;
  private supabase: SupabaseClient;
  private broadcaster?: WebSocketBroadcaster;
  private tokenBudget: { used: number; limit: number };
  private startedAt: number;

  constructor(config: ContextConfig) {
    this.runId = config.runId;
    this.data = new Map(Object.entries(config.triggerInput));
    this.nodeOutputs = new Map();
    this.logs = [];
    this.supabase = config.supabase;
    this.broadcaster = config.broadcaster;
    this.tokenBudget = { used: 0, limit: Infinity };
    this.startedAt = Date.now();
  }

  // ─── Data Access ───
  get(key: string): unknown {
    return this.data.get(key);
  }

  set(key: string, value: unknown): void {
    this.data.set(key, value);
  }

  getAll(): Record<string, unknown> {
    return Object.fromEntries(this.data);
  }

  // ─── Node Outputs ───
  setNodeOutput(nodeId: string, output: unknown): void {
    this.nodeOutputs.set(nodeId, output);
  }

  getNodeOutput(nodeId: string): unknown {
    return this.nodeOutputs.get(nodeId);
  }

  getAllNodeOutputs(): Record<string, unknown> {
    return Object.fromEntries(this.nodeOutputs);
  }

  // ─── Condition Evaluation ───
  evaluateCondition(expression: string): boolean {
    try {
      const evalContext = {
        ...Object.fromEntries(this.data),
        outputs: Object.fromEntries(this.nodeOutputs),
        tokenBudget: this.tokenBudget,
        elapsedMinutes: (Date.now() - this.startedAt) / 60000,
      };
      const func = new Function(...Object.keys(evalContext), `return (${expression})`);
      return !!func(...Object.values(evalContext));
    } catch {
      this.addLog('warn', `Condition evaluation failed: "${expression}"`);
      return false;
    }
  }

  // ─── Token Budget ───
  addTokenUsage(tokens: number): void {
    this.tokenBudget.used += tokens;
  }

  setTokenLimit(limit: number): void {
    this.tokenBudget.limit = limit;
  }

  isOverBudget(): boolean {
    return this.tokenBudget.used >= this.tokenBudget.limit;
  }

  getTokenUsage(): { used: number; limit: number } {
    return { ...this.tokenBudget };
  }

  // ─── Logging ───
  addLog(level: string, message: string, nodeId?: string): void {
    const logEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      nodeId,
    };
    this.logs.push(logEntry);
    
    if (this.broadcaster) {
      this.broadcaster.send('node:log', logEntry);
    }
  }

  getLogs() {
    return [...this.logs];
  }

  // ─── Serialization ───
  serialize(): string {
    return JSON.stringify({
      runId: this.runId,
      data: Object.fromEntries(this.data),
      nodeOutputs: Object.fromEntries(this.nodeOutputs),
      logs: this.logs,
      tokenBudget: this.tokenBudget,
      startedAt: this.startedAt,
    });
  }

  static deserialize(json: string, supabase: SupabaseClient): MissionContext {
    const parsed = JSON.parse(json);
    const ctx = new MissionContext({
      runId: parsed.runId,
      triggerInput: parsed.data,
      supabase,
    });
    ctx.nodeOutputs = new Map(Object.entries(parsed.nodeOutputs));
    ctx.logs = parsed.logs;
    ctx.tokenBudget = parsed.tokenBudget;
    ctx.startedAt = parsed.startedAt;
    return ctx;
  }

  // ─── Checkpoint ───
  async saveCheckpoint(checkpointName: string, captureKeys: string[], userId: string): Promise<void> {
    const snapshot: Record<string, unknown> = {};
    for (const key of captureKeys) {
      if (this.data.has(key)) snapshot[key] = this.data.get(key);
      if (this.nodeOutputs.has(key)) snapshot[key] = this.nodeOutputs.get(key);
    }

    await this.supabase.from('workflow_checkpoints').upsert({
      run_id: this.runId,
      checkpoint_name: checkpointName,
      snapshot: JSON.stringify(snapshot),
      full_context: this.serialize(),
      created_at: new Date().toISOString(),
      user_id: userId,
    });
  }

  async loadCheckpoint(checkpointName: string): Promise<boolean> {
    const { data } = await this.supabase
      .from('workflow_checkpoints')
      .select('full_context')
      .eq('run_id', this.runId)
      .eq('checkpoint_name', checkpointName)
      .single();

    if (data?.full_context) {
      const restored = JSON.parse(data.full_context);
      this.data = new Map(Object.entries(restored.data));
      this.nodeOutputs = new Map(Object.entries(restored.nodeOutputs));
      return true;
    }
    return false;
  }
}
