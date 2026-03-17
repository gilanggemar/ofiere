import { NextResponse } from 'next/server';
import { RunManager } from '@/lib/workflows/engine/RunManager';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { executeWorkflowV2 } from '@/lib/workflow/executor/workflow-executor';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import type { WorkflowDefinitionV2, WorkflowAgentAdapter } from '@/lib/workflow/types';

// POST /api/workflows/[id]/run — trigger a workflow execution
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;

    try {
        // Read optional body (input + wsConnectionId)
        let body: { input?: Record<string, unknown>; wsConnectionId?: string } = {};
        try {
            body = await request.json();
        } catch {
            // No body is fine — manual trigger with no input
        }

        // Fetch the workflow definition
        const { data: workflow, error } = await db
            .from('workflows')
            .select('*')
            .eq('id', id)
            .eq('user_id', userId)
            .single();

        if (error || !workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        const definitionVersion = workflow.definition_version ?? 1;

        // ─── V2 Execution Path ───────────────────────────────────
        if (definitionVersion === 2) {
            return handleV2Run(workflow, userId, body);
        }

        // ─── V1 Execution Path (legacy — kept intact) ────────────
        const nodes = workflow.nodes ?? [];
        const edges = workflow.edges ?? [];

        if (nodes.length === 0) {
            return NextResponse.json({
                error: 'Workflow has no nodes. Please add nodes to the workflow canvas before running.',
            }, { status: 400 });
        }

        const runId = crypto.randomUUID();
        const encoder = new TextEncoder();

        const stream = new ReadableStream({
            async start(controller) {
                controller.enqueue(encoder.encode(`{"runId":"${runId}"}\n`));

                const runner = new RunManager({
                    runId,
                    workflowId: id,
                    userId,
                    workflow: { nodes, edges },
                    triggerInput: body.input ?? {},
                    wsConnectionId: body.wsConnectionId ?? 'none',
                    onEvent: (event, payload) => {
                        try {
                            controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
                        } catch (e) {
                            // ignore write errors if client disconnected
                        }
                    }
                });

                try {
                    await runner.execute();
                } catch (err) {
                    console.error(`[Workflow Run ${runId}] execution error:`, err);
                } finally {
                    try { controller.close(); } catch(e) {}
                }
            }
        });

        return new Response(stream, {
            status: 201,
            headers: {
                'Content-Type': 'application/x-ndjson',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            }
        });
    } catch (error: unknown) {
        console.error('Failed to trigger workflow run:', error);
        const message = error instanceof Error ? error.message : 'Failed to trigger run';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// ─── V2 Run Handler ──────────────────────────────────────────────

async function handleV2Run(
    workflow: any,
    userId: string,
    body: { input?: Record<string, unknown>; wsConnectionId?: string }
) {
    // Map React Flow format → WorkflowDefinitionV2 format
    const rfNodes = workflow.nodes ?? [];
    const rfEdges = workflow.edges ?? [];

    const definition: WorkflowDefinitionV2 = {
        version: 2,
        nodes: rfNodes.map((n: any) => ({
            id: n.id,
            type: n.type,
            label: n.data?.label || n.type || 'Untitled',
            config: n.data || {},
            position: n.position || { x: 0, y: 0 },
        })),
        edges: rfEdges.map((e: any) => ({
            id: e.id,
            sourceNodeId: e.source,
            targetNodeId: e.target,
            sourceHandle: e.sourceHandle || undefined,
        })),
        globalVariables: {},
    };

    if (definition.nodes.length === 0) {
        return NextResponse.json({
            error: 'Workflow has no nodes. Please add nodes to the canvas before running.',
        }, { status: 400 });
    }

    const runId = crypto.randomUUID();
    const encoder = new TextEncoder();

    // Create the run record in the database
    await db.from('workflow_runs').insert({
        id: runId,
        workflow_id: workflow.id,
        status: 'running',
        triggered_by: 'manual',
        step_results: [],
        user_id: userId,
    });

    // Determine which adapter to use for each agent_step node
    const nodeAdapters: Record<string, WorkflowAgentAdapter> = {};
    const agentNodes = definition.nodes.filter(n => n.type === 'agent_step');
    
    if (agentNodes.length > 0) {
        try {
            const activeConn = await resolveActiveConnection(userId);

            for (const node of agentNodes) {
                const agentConfig = node.config as any;
                const agentId = agentConfig?.agentId || '';
                const isAgentZero = agentId === 'agent-zero' || agentConfig?.provider === 'Agent Zero';

                if (isAgentZero) {
                    nodeAdapters[node.id] = getAdapterForAgent(agentId, 'agentzero', {
                        baseUrl: activeConn.agentZero.baseUrl,
                        apiKey: activeConn.agentZero.apiKey,
                    });
                } else {
                    nodeAdapters[node.id] = getAdapterForAgent(agentId, 'openclaw', {
                        baseUrl: activeConn.openclaw.wsUrl || activeConn.openclaw.httpUrl,
                        wsToken: activeConn.openclaw.token,
                    });
                }
            }
        } catch (e) {
            console.error('[V2 Run] Failed to resolve active connection:', e);
        }
    }

    const stream = new ReadableStream({
        async start(controller) {
            controller.enqueue(encoder.encode(`{"runId":"${runId}","version":2}\n`));

            const stepResults: any[] = [];

            try {
                for await (const event of executeWorkflowV2({
                    definition,
                    runId,
                    userId,
                    nodeAdapters,
                    triggerInput: (body.input ?? {}) as Record<string, any>,
                })) {
                    // Emit the event to the client
                    controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

                    // Track step results
                    if (event.type === 'step:completed') {
                        stepResults.push(event.result);
                    }

                    // Update run status on completion/failure/pause
                    if (event.type === 'run:completed') {
                        await db.from('workflow_runs').update({
                            status: 'completed',
                            step_results: stepResults,
                            completed_at: new Date().toISOString(),
                        }).eq('id', runId);

                        // Update workflow lastRunAt
                        await db.from('workflows').update({
                            updated_at: new Date().toISOString(),
                        }).eq('id', workflow.id);
                    }

                    if (event.type === 'run:failed') {
                        await db.from('workflow_runs').update({
                            status: 'failed',
                            step_results: stepResults,
                            error_message: event.error,
                            completed_at: new Date().toISOString(),
                        }).eq('id', runId);
                    }

                    if (event.type === 'run:paused') {
                        await db.from('workflow_runs').update({
                            status: 'paused_approval',
                            step_results: stepResults,
                            paused_at: new Date().toISOString(),
                            paused_step_id: event.stepId,
                            current_step_id: event.stepId,
                        }).eq('id', runId);
                    }
                }
            } catch (err) {
                console.error(`[V2 Workflow Run ${runId}] execution error:`, err);
                await db.from('workflow_runs').update({
                    status: 'failed',
                    error_message: err instanceof Error ? err.message : 'Unknown error',
                    completed_at: new Date().toISOString(),
                }).eq('id', runId);

                controller.enqueue(encoder.encode(`${JSON.stringify({
                    type: 'run:failed',
                    error: err instanceof Error ? err.message : 'Unknown error',
                    timestamp: new Date().toISOString(),
                })}\n`));
            } finally {
                try { controller.close(); } catch (e) {}
            }
        }
    });

    return new Response(stream, {
        status: 201,
        headers: {
            'Content-Type': 'application/x-ndjson',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        }
    });
}
