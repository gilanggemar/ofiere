// ─── Knowledge Executor ──────────────────────────────────────────────────────
// RAG injection from pgvector, Supabase tables, or agent memory.

import type { Node } from '@xyflow/react';
import type { MissionContext } from '../MissionContext';
import type { NodeExecutor, NodeExecutionResult, ExecutorDeps } from './index';
import type { KnowledgeData } from '@/types/workflow-nodes';

export class KnowledgeExecutor implements NodeExecutor {
  private deps: ExecutorDeps;

  constructor(deps: ExecutorDeps) {
    this.deps = deps;
  }

  async execute(node: Node, context: MissionContext): Promise<NodeExecutionResult> {
    const data = node.data as KnowledgeData;
    const { supabase, broadcaster } = this.deps;

    broadcaster.send('node:status', { nodeId: node.id, status: 'running' });

    try {
      let query: string;

      if (data.queryMode === 'agent_generated') {
        const objective = (context.get('missionObjective') as string) ?? '';
        query = objective;
      } else {
        query = data.query ?? '';
        query = query.replace(/\{\{(\w+)\}\}/g, (_, key) => {
          const val = context.get(key);
          return val !== undefined ? String(val) : `{{${key}}}`;
        });
      }

      let results: unknown[] = [];

      switch (data.source) {
        case 'pgvector': {
          const { data: vectors, error } = await supabase.rpc('match_documents', {
            query_text: query,
            match_count: data.topK ?? 5,
            similarity_threshold: data.similarityThreshold ?? 0.7,
            collection_name: data.collectionName ?? 'default',
          });
          if (error) throw new Error(`pgvector search failed: ${error.message}`);
          results = vectors ?? [];
          break;
        }

        case 'supabase_table': {
          const { data: rows, error } = await supabase
            .from(data.collectionName ?? 'knowledge_documents')
            .select('*')
            .textSearch('content', query)
            .limit(data.topK ?? 5);
          if (error) throw new Error(`Supabase query failed: ${error.message}`);
          results = rows ?? [];
          break;
        }

        case 'agent_memory': {
          const { data: memories, error } = await supabase
            .from('knowledge_fragments')
            .select('*')
            .textSearch('content', query)
            .limit(data.topK ?? 5);
          if (error) throw new Error(`Agent memory query failed: ${error.message}`);
          results = memories ?? [];
          break;
        }

        default:
          context.addLog('warn', `Knowledge source "${data.source}" not yet supported, skipping`, node.id);
          return { status: 'success', output: { query, results: [], resultCount: 0, source: data.source } };
      }

      const knowledgePayload = {
        query,
        results,
        resultCount: results.length,
        source: data.source,
      };

      context.set(`knowledge_${node.id}`, knowledgePayload);
      context.set('lastKnowledgeResults', results);
      context.set('lastKnowledgeInjectAs', data.injectAs);

      context.addLog('info', `Knowledge node retrieved ${results.length} results from ${data.source}`, node.id);

      return { status: 'success', output: knowledgePayload };

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Knowledge retrieval failed';
      return { status: 'error', error: errorMsg };
    }
  }
}
