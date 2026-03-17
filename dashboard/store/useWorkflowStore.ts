import { create } from 'zustand';
import type { Workflow, WorkflowRun } from '@/lib/workflows/types';

interface WorkflowState {
    workflows: Workflow[];
    runs: WorkflowRun[];
    activeWorkflowId: string | null;
    isLoading: boolean;

    setWorkflows: (wfs: Workflow[]) => void;
    setRuns: (runs: WorkflowRun[]) => void;
    setActiveWorkflow: (id: string | null) => void;
    setLoading: (loading: boolean) => void;

    fetchWorkflows: () => Promise<void>;
    fetchRuns: (workflowId?: string) => Promise<void>;
    triggerRun: (workflowId: string) => Promise<void>;
    deleteRun: (runId: string) => Promise<void>;
    cancelRun: (runId: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
    workflows: [],
    runs: [],
    activeWorkflowId: null,
    isLoading: false,

    setWorkflows: (workflows) => set({ workflows }),
    setRuns: (runs) => set({ runs }),
    setActiveWorkflow: (id) => set({ activeWorkflowId: id }),
    setLoading: (loading) => set({ isLoading: loading }),

    fetchWorkflows: async () => {
        set({ isLoading: true });
        try {
            const res = await fetch('/api/workflows');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) set({ workflows: data });
            }
        } catch (e) {
            console.error('Failed to fetch workflows:', e);
        } finally {
            set({ isLoading: false });
        }
    },

    fetchRuns: async (workflowId) => {
        try {
            const params = workflowId ? `?workflowId=${workflowId}` : '';
            const res = await fetch(`/api/workflows/runs${params}`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) set({ runs: data });
            }
        } catch (e) {
            console.error('Failed to fetch runs:', e);
        }
    },

    triggerRun: async (workflowId) => {
        try {
            const res = await fetch(`/api/workflows/${workflowId}/run`, { method: 'POST' });
            if (!res.ok || !res.body) return;

            // Start reading the NDJSON stream in the background (non-blocking)
            const reader = res.body.getReader();
            const decoder = new TextDecoder();

            // Process stream in background — don't block the caller
            (async () => {
                let buffer = '';
                let runId = '';

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        buffer += decoder.decode(value, { stream: true });
                        const lines = buffer.split('\n');
                        buffer = lines.pop() || '';

                        for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                                const event = JSON.parse(line);

                                // Capture runId from first event and add run to local state immediately
                                if (event.runId && !runId) {
                                    runId = event.runId;
                                    const wf = get().workflows.find(w => w.id === workflowId);
                                    set((s) => ({
                                        runs: [{
                                            id: runId,
                                            workflowId,
                                            workflowName: wf?.name,
                                            status: 'running' as const,
                                            stepResults: [],
                                            triggeredBy: 'manual' as const,
                                            startedAt: Date.now(),
                                        }, ...s.runs],
                                    }));
                                }

                                // Update step results live
                                if (event.type === 'step:completed' && event.result && runId) {
                                    set((s) => ({
                                        runs: s.runs.map(r =>
                                            r.id === runId
                                                ? { ...r, stepResults: [...r.stepResults, event.result] }
                                                : r
                                        ),
                                    }));
                                }

                                // Update step status live (step:started → running indicator)
                                if (event.type === 'step:started' && runId) {
                                    const stepId = event.nodeId || event.stepId || '';
                                    if (stepId) {
                                        set((s) => ({
                                            runs: s.runs.map(r =>
                                                r.id === runId
                                                    ? {
                                                        ...r,
                                                        stepResults: [
                                                            ...r.stepResults.filter(sr => sr.stepId !== stepId),
                                                            { stepId, status: 'running' as const, startedAt: Date.now() },
                                                        ],
                                                    }
                                                    : r
                                            ),
                                        }));
                                    }
                                }

                                // Detect approval gate → push to builder store's pendingGates
                                if (event.type === 'gate:approval_requested' || event.type === 'run:paused') {
                                    const { useWorkflowBuilderStore } = await import('@/store/useWorkflowBuilderStore');
                                    const store = useWorkflowBuilderStore.getState();

                                    const wf = get().workflows.find(w => w.id === workflowId);
                                    const wfName = wf?.name || 'Untitled';
                                    const nodeId = event.nodeId || event.stepId || '';
                                    const alreadyExists = store.pendingGates.some(g => g.nodeId === nodeId && g.runId === runId);

                                    if (!alreadyExists && nodeId) {
                                        useWorkflowBuilderStore.setState({
                                            pendingGates: [...store.pendingGates, {
                                                nodeId,
                                                workflowId,
                                                runId,
                                                workflowName: wfName,
                                                reviewData: event.reviewData || {},
                                                requestedAt: Date.now(),
                                            }],
                                        });
                                    }

                                    // Mark run as paused locally
                                    if (runId) {
                                        set((s) => ({
                                            runs: s.runs.map(r =>
                                                r.id === runId ? { ...r, status: 'running' as const } : r
                                            ),
                                        }));
                                    }
                                }

                                // Update local run status on completion/failure
                                if (event.type === 'run:completed' && runId) {
                                    set((s) => ({
                                        runs: s.runs.map(r =>
                                            r.id === runId ? { ...r, status: 'completed' as const, completedAt: Date.now() } : r
                                        ),
                                    }));
                                }
                                if (event.type === 'run:failed' && runId) {
                                    set((s) => ({
                                        runs: s.runs.map(r =>
                                            r.id === runId ? { ...r, status: 'failed' as const, completedAt: Date.now() } : r
                                        ),
                                    }));
                                }
                            } catch {}
                        }
                    }
                } catch (e) {
                    console.error('[triggerRun stream]', e);
                }
            })();

            // Return immediately — stream is processed in background
        } catch (e) {
            console.error('Failed to trigger run:', e);
        }
    },

    deleteRun: async (runId) => {
        try {
            const res = await fetch(`/api/workflows/runs/${runId}`, { method: 'DELETE' });
            if (res.ok) {
                // Remove from local state immediately for snappy UI
                set((state) => ({ runs: state.runs.filter(r => r.id !== runId) }));
            }
        } catch (e) {
            console.error('Failed to delete run:', e);
        }
    },

    cancelRun: async (runId) => {
        try {
            const res = await fetch(`/api/workflows/runs/${runId}/cancel`, { method: 'POST' });
            if (res.ok) {
                // Update local status for snappy UI
                set((state) => ({
                    runs: state.runs.map(r =>
                        r.id === runId ? { ...r, status: 'cancelled' as const, completedAt: Date.now() } : r
                    )
                }));
            }
        } catch (e) {
            console.error('Failed to cancel run:', e);
        }
    }
}));

