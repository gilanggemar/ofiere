// ─── Toolkit Executor ────────────────────────────────────────────────────────
// Tool selection and dispatch. Uses existing capability system.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { ToolkitData } from '@/types/workflow-nodes';

export class ToolkitExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as ToolkitData;
    const { broadcaster, supabase } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      // Load available tools from capability system
      const { data: mcpTools } = await supabase
        .from('capability_mcps')
        .select('name, description, tools, status')
        .eq('status', 'active');

      const availableToolNames = (mcpTools ?? []).map(t => t.name);

      // Filter to only the tools specified in the node config
      const selectedTools = data.availableTools?.length
        ? (mcpTools ?? []).filter(t => data.availableTools.includes(t.name))
        : mcpTools ?? [];

      context.set(`toolkit_${node.id}`, {
        tools: selectedTools.map(t => ({
          name: t.name,
          description: t.description,
          tools: t.tools,
        })),
        selectionMode: data.toolSelectionMode,
      });

      context.addLog('info',
        `Toolkit loaded ${selectedTools.length} tools (mode: ${data.toolSelectionMode})`,
        node.id
      );

      return {
        status: 'success',
        output: {
          loadedTools: selectedTools.map(t => t.name),
          selectionMode: data.toolSelectionMode,
          availableInSystem: availableToolNames,
        },
      };
    } catch (err) {
      return { status: 'error', error: err instanceof Error ? err.message : 'Toolkit failed' };
    }
  }
}
