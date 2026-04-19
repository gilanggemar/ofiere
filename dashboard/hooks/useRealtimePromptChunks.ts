"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePromptChunkStore } from "@/store/usePromptChunkStore";
import type { RealtimeChannel } from "@supabase/supabase-js";

/**
 * useRealtimePromptChunks — subscribes to Supabase Realtime on the `prompt_chunks` table.
 *
 * When any row is INSERT/UPDATE/DELETE'd (from any source — dashboard, plugin, direct API),
 * this hook updates the prompt chunk store so the UI reflects changes instantly.
 *
 * Mount this ONCE at the app layout level (AuthInitializer).
 */
export function useRealtimePromptChunks() {
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        const supabase = createClient();

        const channel = supabase
            .channel("realtime:prompt_chunks")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "prompt_chunks",
                },
                (payload) => {
                    const eventType = payload.eventType;
                    const newRecord = payload.new as Record<string, any> | undefined;
                    const oldRecord = payload.old as Record<string, any> | undefined;

                    if (eventType === "INSERT" && newRecord) {
                        usePromptChunkStore.setState((state) => {
                            if (state.chunks.some((c) => c.id === newRecord.id)) return state;
                            return { chunks: [...state.chunks, newRecord as any] };
                        });
                    } else if (eventType === "UPDATE" && newRecord) {
                        usePromptChunkStore.setState((state) => ({
                            chunks: state.chunks.map((c) =>
                                c.id === newRecord.id ? { ...c, ...newRecord } as any : c
                            ),
                        }));
                    } else if (eventType === "DELETE" && oldRecord) {
                        const id = oldRecord.id;
                        if (!id) return;
                        usePromptChunkStore.setState((state) => ({
                            chunks: state.chunks.filter((c) => c.id !== id),
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
