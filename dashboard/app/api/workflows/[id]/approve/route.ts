import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUserId } from '@/lib/auth';
import { resumeWorkflowV2, retryWorkflowV2 } from '@/lib/workflow/executor/workflow-executor';
import { getAdapterForAgent } from '@/lib/workflow/adapter-registry';
import { resolveActiveConnection } from '@/lib/resolveActiveConnection';
import type { WorkflowDefinitionV2, WorkflowAgentAdapter, StepResult } from '@/lib/workflow/types';

// POST /api/workflows/[id]/approve — handle human approval actions
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const userId = await getAuthUserId();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: workflowId } = await params;

    try {
        const body = await request.json();
        const { runId, nodeId, action, instructions } = body as {
            runId: string;
            nodeId: string;
            action: 'approve' | 'retry' | 'decline';
            instructions?: string;
        };

        if (!runId || !nodeId || !action) {
            return NextResponse.json({ error: 'Missing runId, nodeId, or action' }, { status: 400 });
        }

        // Fetch the workflow definition
        const { data: workflow, error: wfError } = await db
            .from('workflows')
            .select('*')
            .eq('id', workflowId)
            .eq('user_id', userId)
            .single();

        if (wfError || !workflow) {
            return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
        }

        // Fetch run record to get prior outputs
        const { data: run, error: runError } = await db
            .from('workflow_runs')
            .select('*')
            .eq('id', runId)
            .single();

        if (runError || !run) {
            return NextResponse.json({ error: 'Run not found' }, { status: 404 });
        }

        // ─── DECLINE ───────────────────────────────────────────────
        if (action === 'decline') {
            await db.from('workflow_runs').update({
                status: 'declined',
                completed_at: new Date().toISOString(),
            }).eq('id', runId);

            return NextResponse.json({ status: 'declined', runId });
        }

        // Build definition for executor
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

        // Resolve adapters for agent_step nodes
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
                console.error('[Approve] Failed to resolve active connection:', e);
            }
        }

        // Get prior outputs from the run's step_results
        const priorOutputsSnapshot: Record<string, StepResult> = {};
        const stepResults = run.step_results || [];
        for (const sr of stepResults) {
            if (sr.stepId) {
                priorOutputsSnapshot[sr.stepId] = sr;
            }
        }

        // Also reconstruct from the context_snapshot if available
        if (run.context_snapshot) {
            const ctx = typeof run.context_snapshot === 'string'
                ? JSON.parse(run.context_snapshot)
                : run.context_snapshot;
            if (ctx.nodeOutputs) {
                for (const [nid, output] of Object.entries(ctx.nodeOutputs)) {
                    if (!priorOutputsSnapshot[nid]) {
                        priorOutputsSnapshot[nid] = output as StepResult;
                    }
                }
            }
        }

        // Update run status
        await db.from('workflow_runs').update({
            status: 'running',
        }).eq('id', runId);

        const encoder = new TextEncoder();

        // ─── APPROVE: resume from after the approval node ──────────
        if (action === 'approve') {
            const stream = new ReadableStream({
                async start(controller) {
                    controller.enqueue(encoder.encode(`{"runId":"${runId}","action":"approve","version":2}\n`));
                    const stepResults: any[] = [...(run.step_results || [])];
                    try {
                        for await (const event of resumeWorkflowV2({
                            definition,
                            runId,
                            userId,
                            nodeAdapters,
                            approvedNodeId: nodeId,
                            reviewInstructions: instructions || undefined,
                            priorOutputsSnapshot,
                        })) {
                            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                            if (event.type === 'step:completed') {
                                const existingIdx = stepResults.findIndex(r => r.stepId === event.result.stepId);
                                if (existingIdx !== -1) {
                                    stepResults[existingIdx] = event.result;
                                } else {
                                    stepResults.push(event.result);
                                }
                            }
                            if (event.type === 'run:completed') {
                                await db.from('workflow_runs').update({
                                    status: 'completed', step_results: stepResults,
                                    completed_at: new Date().toISOString(),
                                }).eq('id', runId);
                            }
                            if (event.type === 'run:failed') {
                                await db.from('workflow_runs').update({
                                    status: 'failed', step_results: stepResults,
                                    error_message: event.error,
                                    completed_at: new Date().toISOString(),
                                }).eq('id', runId);
                            }
                            if (event.type === 'run:paused') {
                                await db.from('workflow_runs').update({
                                    status: 'paused_approval', step_results: stepResults,
                                    paused_step_id: event.stepId,
                                }).eq('id', runId);
                            }
                        }
                    } catch (err) {
                        console.error(`[Approve Resume] error:`, err);
                        controller.enqueue(encoder.encode(`${JSON.stringify({
                            type: 'run:failed',
                            error: err instanceof Error ? err.message : 'Unknown error',
                            timestamp: new Date().toISOString(),
                        })}\n`));
                    } finally {
                        try { controller.close(); } catch {}
                    }
                }
            });

            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
            });
        }

        // ─── RETRY: restart from after trigger ─────────────────────
        if (action === 'retry') {
            const stream = new ReadableStream({
                async start(controller) {
                    controller.enqueue(encoder.encode(`{"runId":"${runId}","action":"retry","version":2}\n`));
                    const stepResults: any[] = [];
                    try {
                        for await (const event of retryWorkflowV2({
                            definition,
                            runId,
                            userId,
                            nodeAdapters,
                            reviewInstructions: instructions || undefined,
                            priorOutputsSnapshot,
                        })) {
                            controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
                            if (event.type === 'step:completed') stepResults.push(event.result);
                            if (event.type === 'run:completed') {
                                await db.from('workflow_runs').update({
                                    status: 'completed', step_results: stepResults,
                                    completed_at: new Date().toISOString(),
                                }).eq('id', runId);
                            }
                            if (event.type === 'run:failed') {
                                await db.from('workflow_runs').update({
                                    status: 'failed', step_results: stepResults,
                                    error_message: event.error,
                                    completed_at: new Date().toISOString(),
                                }).eq('id', runId);
                            }
                            if (event.type === 'run:paused') {
                                await db.from('workflow_runs').update({
                                    status: 'paused_approval', step_results: stepResults,
                                    paused_step_id: event.stepId,
                                }).eq('id', runId);
                            }
                        }
                    } catch (err) {
                        console.error(`[Approve Retry] error:`, err);
                        controller.enqueue(encoder.encode(`${JSON.stringify({
                            type: 'run:failed',
                            error: err instanceof Error ? err.message : 'Unknown error',
                            timestamp: new Date().toISOString(),
                        })}\n`));
                    } finally {
                        try { controller.close(); } catch {}
                    }
                }
            });

            return new Response(stream, {
                status: 200,
                headers: { 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-cache' },
            });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error: unknown) {
        console.error('Approval handler error:', error);
        const message = error instanceof Error ? error.message : 'Approval failed';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
