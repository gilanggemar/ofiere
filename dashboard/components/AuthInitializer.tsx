'use client'

import { useEffect } from 'react'
import { useAuthStore } from '@/store/useAuthStore'
import { useRealtimeTasks } from '@/hooks/useRealtimeTasks'
import { useRealtimeWorkflows } from '@/hooks/useRealtimeWorkflows'
import { useRealtimePromptChunks } from '@/hooks/useRealtimePromptChunks'

export function AuthInitializer({ children }: { children: React.ReactNode }) {
    const initialize = useAuthStore((s) => s.initialize)

    useEffect(() => {
        initialize()
    }, [initialize])

    // Subscribe to Supabase Realtime — pushes INSERT/UPDATE/DELETE on `tasks`
    // into useTaskStore and usePMStore so agent changes appear instantly.
    useRealtimeTasks()

    // Subscribe to Supabase Realtime for workflows and prompt chunks
    // so agent-created items appear without page refresh.
    useRealtimeWorkflows()
    useRealtimePromptChunks()

    return <>{children}</>
}
