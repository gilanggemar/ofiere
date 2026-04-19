"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkflowStore } from "@/store/useWorkflowStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useRealtimeWorkflows — subscribes to Supabase Realtime on the `workflows` table.
 *
 * When any row is INSERT/UPDATE/DELETE'd (from any source — dashboard, plugin, direct API),
 * this hook updates the workflow store so the UI reflects changes instantly.
 *
 * Mount this ONCE at the app layout level (AuthInitializer).
 */
export function useRealtimeWorkflows() {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("realtime:workflows")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "workflows",
                },
                (payload) => {
                    const eventType = payload.eventType;
                    const newRecord = payload.new as Record<string, any> | undefined;
                    const oldRecord = payload.old as Record<string, any> | undefined;

                    if (eventType === "INSERT" && newRecord) {
                        useWorkflowStore.setState((state) => {
                            if (state.workflows.some((w) => w.id === newRecord.id)) return state;
                            return { workflows: [newRecord as any, ...state.workflows] };
                        });
                    } else if (eventType === "UPDATE" && newRecord) {
                        useWorkflowStore.setState((state) => ({
                            workflows: state.workflows.map((w) =>
                                w.id === newRecord.id ? { ...w, ...newRecord } as any : w
                            ),
                        }));
                    } else if (eventType === "DELETE" && oldRecord) {
                        const id = oldRecord.id;
                        if (!id) return;
                        useWorkflowStore.setState((state) => ({
                            workflows: state.workflows.filter((w) => w.id !== id),
                        }));
                    }
                }
            )
            .subscribe();

        channelRef.current = channel;

        return () => {
            channel.unsubscribe();
            channelRef.current = null;
        };
    }, []);
}
