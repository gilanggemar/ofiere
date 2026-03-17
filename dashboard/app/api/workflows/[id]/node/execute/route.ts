import { NextResponse } from 'next/server';
import { getAuthUserId } from '@/lib/auth';
import { executeNode } from '@/lib/workflow/executor/workflow-executor';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import { db } from '@/lib/db';
import type { WorkflowNodeDefinition, StepResult } from '@/lib/workflow/types';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: workflowId } = await params;

    try {
        const body = await request.json();
        const { node, priorOutputs } = body as {
            node: WorkflowNodeDefinition;
            priorOutputs: Record<string, StepResult>;
        };

        if (!node || !node.id || !node.type) {
            return NextResponse.json({ error: 'Invalid node payload' }, { status: 400 });
        }

        // Verify workflow exists and belongs to user
        const { data: workflow, error } = await db
            .from('workflows')
            .select('id')
            .eq('id', workflowId)
            .eq('user_id', userId)
            .single();

        if (error || !workflow) {
            return NextResponse.json({ error: 'Workflow not found or unauthorized' }, { status: 404 });
        }

        const runId = `preview-${Date.now()}`;
        
        let adapter;
        if (node.type === 'agent_step') {
            const agentConfig = node.config as any;
            const agentId = agentConfig?.agentId || '';
            const isAgentZero = agentId === 'agent-zero' || agentConfig?.provider === 'Agent Zero';
            
            try {
                const activeConn = await resolveActiveConnection(userId);
                if (isAgentZero) {
                    adapter = getAdapterForAgent(agentId, 'agentzero', {
                        baseUrl: activeConn.agentZero.baseUrl,
                        apiKey: activeConn.agentZero.apiKey,
                    });
                } else {
                    adapter = getAdapterForAgent(agentId, 'openclaw', {
                        baseUrl: activeConn.openclaw.wsUrl || activeConn.openclaw.httpUrl,
                        wsToken: activeConn.openclaw.token,
                    });
                }
            } catch (e) {
                console.error('[Single Node Execution] Failed to resolve active connection:', e);
            }
        }
        
        const result = await executeNode(node, {
            runId,
            userId,
            variables: {}, // Can optionally pass global variables here
            priorOutputs: priorOutputs || {},
            adapter
        });

        return NextResponse.json({ result });
    } catch (error: any) {
        console.error('[Single Node Execution] Error:', error);
        return NextResponse.json({ error: error.message || 'Execution failed' }, { status: 500 });
    }
}
