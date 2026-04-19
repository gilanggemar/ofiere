'use client';

// ConstellationHeader.tsx — Rewritten for Agent Architecture Canvas.
// Shows title, sync status, refresh button.

import { RefreshCw, Zap, Save, AlertCircle, CheckCircle } from 'lucide-react';
import { useConstellationStore } from '@/store/useConstellationStore';

export function ConstellationHeader() {
    const {
        syncStatus,
        isLoading,
        isSaving,
        loadAllAgents,
        saveAllDirtyAgents,
        hasUnsavedChanges,
        getDirtyAgents,
    } = useConstellationStore();

    const dirty = hasUnsavedChanges();
    const dirtyCount = getDirtyAgents().length;

    const statusConfig = {
        idle: { icon: <Zap className="size-3" />, text: 'Idle', color: 'text-white/30' },
        syncing: { icon: <RefreshCw className="size-3 animate-spin" />, text: 'Syncing...', color: 'text-amber-400/70' },
        synced: { icon: <CheckCircle className="size-3" />, text: 'Synced', color: 'text-emerald-400/70' },
        error: { icon: <AlertCircle className="size-3" />, text: 'Error', color: 'text-red-400/70' },
    };

    const status = statusConfig[syncStatus];

    return (
        <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-6 py-3">
            {/* Left: Title + Status */}
            <div className="flex items-center gap-4">
                <div>
                    <h1 className="text-sm font-bold font-mono tracking-wider text-white/90">
                        AGENT ARCHITECTURE
                    </h1>
                    <p className="text-[10px] font-mono text-white/30 mt-0.5">
                        Visual bridge to OpenClaw agent configuration
                    </p>
                </div>

                {/* Sync status */}
                <div className={`flex items-center gap-1.5 text-[10px] font-mono ${status.color}`}>
                    {status.icon}
                    <span>{status.text}</span>
                </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Dirty indicator */}
                {dirty && (
                    <span className="text-[10px] font-mono text-amber-400/60 mr-2 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-pulse" />
                        {dirtyCount} agent{dirtyCount > 1 ? 's' : ''} unsaved
                    </span>
                )}

                {/* Save button */}
                {dirty && (
                    <button
                        onClick={() => saveAllDirtyAgents()}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider
                            rounded-sm border transition-all duration-300 active:scale-95
                            bg-[#FF6D29]/10 border-[#FF6D29]/30 text-[#FF6D29]
                            hover:bg-[#FF6D29]/20 hover:border-[#FF6D29]/50
                            disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Save className={`size-3 ${isSaving ? 'animate-spin' : ''}`} />
                        {isSaving ? 'SAVING...' : 'SAVE ALL'}
                    </button>
                )}

                {/* Refresh */}
                <button
                    onClick={() => loadAllAgents()}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-mono font-bold tracking-wider
                        rounded-sm border border-white/10 text-white/50
                        bg-white/5 hover:bg-white/8 hover:text-white/80
                        transition-all duration-300 active:scale-95
                        disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <RefreshCw className={`size-3 ${isLoading ? 'animate-spin' : ''}`} />
                    REFRESH
                </button>
            </div>
        </div>
    );
}
