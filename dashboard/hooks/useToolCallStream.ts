// hooks/useToolCallStream.ts
//
// Client-side hook that subscribes to the SSE stream at /api/openclaw/events
// and feeds incoming tool-call events into the useOpenClawStore.

'use client';

import { useEffect, useRef } from 'react';
import { useOpenClawStore } from '@/store/useOpenClawStore';

/**
 * Subscribes to the tool-call SSE stream and injects events into the
 * OpenClaw store's `handleAgentEvent` method. This bridges the webhook
 * plugin pipeline with the existing process hierarchy UI.
 *
 * Call this hook once in a top-level layout or page component.
 */
export function useToolCallStream() {
    const handleAgentEvent = useOpenClawStore((s) => s.handleAgentEvent);
    const esRef = useRef<EventSource | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        let mounted = true;

        function connect() {
            if (!mounted) return;

            // Don't create duplicate connections
            if (esRef.current && esRef.current.readyState !== EventSource.CLOSED) return;

            const es = new EventSource('/api/openclaw/events');
            esRef.current = es;

            es.onmessage = (ev) => {
                try {
                    const event = JSON.parse(ev.data);

                    // Transform webhook event shape → OpenClaw store shape
                    // The store expects: { runId, sessionKey, stream, data }
                    const storePayload = {
                        runId: event.runId,
                        sessionKey: event.sessionKey || `agent:${event.agentId}:main`,
                        stream: 'tool',     // Always 'tool' stream for process hierarchy
                        data: {
                            toolCallId: event.callId,
                            toolName: event.toolName,
                            input: event.input,
                            output: event.output,
                            status: mapEventTypeToStatus(event.type),
                            error: event.error,
                            progress: event.progress,
                        },
                        // Also set top-level fields the store handler checks
                        toolCallId: event.callId,
                        toolName: event.toolName,
                    };

                    handleAgentEvent(storePayload);
                } catch (err) {
                    console.warn('[ToolCallStream] Failed to parse SSE event:', err);
                }
            };

            es.onerror = () => {
                es.close();
                esRef.current = null;

                // Reconnect after 3s
                if (mounted && !reconnectTimer.current) {
                    reconnectTimer.current = setTimeout(() => {
                        reconnectTimer.current = null;
                        connect();
                    }, 3000);
                }
            };
        }

        connect();

        return () => {
            mounted = false;
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
            if (reconnectTimer.current) {
                clearTimeout(reconnectTimer.current);
                reconnectTimer.current = null;
            }
        };
    }, [handleAgentEvent]);
}

/** Map plugin event types to the status the OpenClaw store expects */
function mapEventTypeToStatus(type: string): string {
    switch (type) {
        case 'tool_call_start':     return 'running';
        case 'tool_call_end':       return 'completed';
        case 'tool_call_error':     return 'error';
        case 'tool_call_progress':  return 'running';
        default:                    return 'running';
    }
}
