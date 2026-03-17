// ─── Graph Walker ────────────────────────────────────────────────────────────
// The heart of the execution engine — walks the React Flow graph topology,
// handles branching, parallelism, convergence, and conditional edges.

import type { Node, Edge } from '@xyflow/react';
import type { NodeExecutorRegistry } from './executors';
import type { MissionContext } from './MissionContext';
import type { WebSocketBroadcaster } from './WebSocketBroadcaster';

type NodeStatus = 'idle' | 'queued' | 'running' | 'success' | 'error' | 'skipped' | 'waiting';

interface WalkerConfig {
  nodes: Node[];
  edges: Edge[];
  executors: NodeExecutorRegistry;
  context: MissionContext;
  broadcaster: WebSocketBroadcaster;
  signal: AbortSignal;
}

export class GraphWalker {
  private nodes: Map<string, Node>;
  private adjacency: Map<string, Edge[]>;  // nodeId → outgoing edges
  private reverseAdj: Map<string, Edge[]>; // nodeId → incoming edges
  private executors: NodeExecutorRegistry;
  private context: MissionContext;
  private broadcaster: WebSocketBroadcaster;
  private signal: AbortSignal;
  private nodeStatus: Map<string, NodeStatus>;

  constructor(config: WalkerConfig) {
    this.executors = config.executors;
    this.context = config.context;
    this.broadcaster = config.broadcaster;
    this.signal = config.signal;

    // Build lookup maps
    this.nodes = new Map(config.nodes.map(n => [n.id, n]));
    this.adjacency = new Map();
    this.reverseAdj = new Map();
    this.nodeStatus = new Map();

    // Initialize adjacency lists
    for (const node of config.nodes) {
      this.adjacency.set(node.id, []);
      this.reverseAdj.set(node.id, []);
      this.nodeStatus.set(node.id, 'idle');
    }
    for (const edge of config.edges) {
      this.adjacency.get(edge.source)?.push(edge);
      this.reverseAdj.get(edge.target)?.push(edge);
    }
  }

  async run(): Promise<{ success: boolean; output: unknown }> {
    // Find entry points — only trigger nodes should be entry points
    const TRIGGER_TYPES = new Set(['manual_trigger', 'webhook_trigger', 'schedule_trigger', 'trigger']);
    const entryNodes = Array.from(this.nodes.values()).filter(
      n => TRIGGER_TYPES.has(n.type || '')
    );

    if (entryNodes.length === 0) {
      throw new Error('Workflow has no entry point (no trigger node found)');
    }

    // Execute starting from all trigger nodes
    const results = await Promise.all(
      entryNodes.map(node => this.executeNode(node.id))
    );

    // Find terminal nodes — nodes with no outgoing edges
    const terminalNodes = Array.from(this.nodes.values()).filter(
      n => (this.adjacency.get(n.id)?.length ?? 0) === 0
    );

    // Gather final outputs
    const finalOutput: Record<string, unknown> = {};
    for (const terminal of terminalNodes) {
      const status = this.nodeStatus.get(terminal.id);
      if (status === 'success') {
        finalOutput[terminal.id] = this.context.getNodeOutput(terminal.id);
      }
    }

    const allSucceeded = results.every(r => r);
    return { success: allSucceeded, output: finalOutput };
  }

  private async executeNode(nodeId: string): Promise<boolean> {
    if (this.signal.aborted) return false;

    const node = this.nodes.get(nodeId);
    if (!node) return false;

    // Skip if already processed
    const currentStatus = this.nodeStatus.get(nodeId);
    if (currentStatus === 'success' || currentStatus === 'running') return true;
    if (currentStatus === 'error') return false;

    // === CONVERGENCE CHECK ===
    const incomingEdges = this.reverseAdj.get(nodeId) ?? [];
    if (incomingEdges.length > 1) {
      const isConvergence = node.type === 'convergence';

      if (isConvergence) {
        const mergeStrategy = (node.data as Record<string, unknown>)?.mergeStrategy as string ?? 'wait_all';
        const predecessorsDone = this.checkConvergence(nodeId, mergeStrategy);
        if (!predecessorsDone) {
          this.setStatus(nodeId, 'waiting');
          return true;
        }
      } else {
        const allDone = incomingEdges.every(e =>
          this.nodeStatus.get(e.source) === 'success' ||
          this.nodeStatus.get(e.source) === 'skipped'
        );
        if (!allDone) {
          this.setStatus(nodeId, 'waiting');
          return true;
        }
      }
    }

    // === EXECUTE THIS NODE ===
    this.setStatus(nodeId, 'running');

    try {
      const executor = this.executors.getExecutor(node.type!);
      if (!executor) {
        throw new Error(`No executor registered for node type: ${node.type}`);
      }

      const result = await executor.execute(node, this.context);

      if (result.status === 'success') {
        this.context.setNodeOutput(nodeId, result.output);
        this.setStatus(nodeId, 'success');
      } else if (result.status === 'skipped') {
        this.setStatus(nodeId, 'skipped');
      } else {
        this.setStatus(nodeId, 'error');
        this.context.addLog('error', `Node ${nodeId} (${node.type}) failed: ${result.error}`, nodeId);
        return false;
      }
    } catch (err) {
      this.setStatus(nodeId, 'error');
      this.context.addLog('error', `Node ${nodeId} threw: ${err instanceof Error ? err.message : String(err)}`, nodeId);
      return false;
    }

    // === PROPAGATE TO CHILDREN ===
    const outgoingEdges = this.adjacency.get(nodeId) ?? [];

    if (outgoingEdges.length === 0) {
      return true; // Terminal node
    }

    // Handle conditional edges
    const resolvedEdges = outgoingEdges.filter(edge => {
      if (edge.type === 'conditional') {
        const conditionKey = (edge.data as Record<string, unknown>)?.condition as string | undefined;
        if (conditionKey) {
          return this.context.evaluateCondition(conditionKey);
        }
      }
      return true;
    });

    // Execute children
    if (resolvedEdges.length === 1) {
      return this.executeNode(resolvedEdges[0].target);
    } else if (resolvedEdges.length > 1) {
      const branchResults = await Promise.all(
        resolvedEdges.map(edge => this.executeNode(edge.target))
      );
      return branchResults.every(r => r);
    }

    return true;
  }

  private checkConvergence(nodeId: string, strategy: string): boolean {
    const incoming = this.reverseAdj.get(nodeId) ?? [];
    const predecessorStatuses = incoming.map(e => this.nodeStatus.get(e.source));

    switch (strategy) {
      case 'wait_all':
        return predecessorStatuses.every(s => s === 'success' || s === 'skipped');
      case 'wait_any':
        return predecessorStatuses.some(s => s === 'success');
      case 'wait_n': {
        const node = this.nodes.get(nodeId);
        const required = (node?.data as Record<string, unknown>)?.requiredCount as number ?? 1;
        return predecessorStatuses.filter(s => s === 'success').length >= required;
      }
      default:
        return predecessorStatuses.every(s => s === 'success' || s === 'skipped');
    }
  }

  private setStatus(nodeId: string, status: NodeStatus) {
    this.nodeStatus.set(nodeId, status);
    this.broadcaster.send('node:status', { nodeId, status });
  }
}
