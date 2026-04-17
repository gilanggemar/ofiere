"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, MessageSquareText, GitMerge, ChevronUp, X as XIcon } from 'lucide-react';
import { getGateway } from '@/lib/openclawGateway';
import { toast } from 'sonner';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface SessionConfigDropdownsProps {
    sessionKey: string | null;
    className?: string;
    activeConfigs: { thinking: boolean, verbose: boolean, reasoning: boolean };
    onCloseConfig: (key: 'thinking' | 'verbose' | 'reasoning') => void;
    autoOpenConfig: 'thinking' | 'verbose' | 'reasoning' | null;
}

const THINKING_OPTIONS = ['inherit', 'off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'adaptive'];
const VERBOSE_OPTIONS = ['inherit', 'off', 'on', 'full'];
const REASONING_OPTIONS = ['inherit', 'off', 'on', 'stream'];

export const SessionConfigDropdowns: React.FC<SessionConfigDropdownsProps> = ({ 
    sessionKey, 
    className,
    activeConfigs,
    onCloseConfig,
    autoOpenConfig
}) => {
    const [thinking, setThinking] = useState('inherit');
    const [verbose, setVerbose] = useState('inherit');
    const [reasoning, setReasoning] = useState('inherit');
    const [isUpdating, setIsUpdating] = useState(false);

    const updateConfig = async (key: 'thinking'|'verbose'|'reasoning', value: string) => {
        if (!sessionKey || isUpdating) return;
        setIsUpdating(true);

        const oldState = { thinking, verbose, reasoning };

        if (key === 'thinking') setThinking(value);
        if (key === 'verbose') setVerbose(value);
        if (key === 'reasoning') setReasoning(value);

        try {
            const payload: Record<string, any> = { key: sessionKey };
            const patchValue = value === 'inherit' ? null : value;
            if (key === 'thinking') payload.thinkingLevel = patchValue;
            if (key === 'verbose') payload.verboseLevel = patchValue;
            if (key === 'reasoning') payload.reasoningLevel = patchValue;

            await getGateway().request('sessions.patch', payload);
            if (value !== 'inherit') {
                toast.success(`Updated ${key} to ${value}`);
            }
        } catch (err: any) {
            if (key === 'thinking') setThinking(oldState.thinking);
            if (key === 'verbose') setVerbose(oldState.verbose);
            if (key === 'reasoning') setReasoning(oldState.reasoning);

            console.error('[OpenClaw Session Patch] Failed:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            toast.error(`Failed to update ${key}: Check console`);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleClose = async (key: 'thinking'|'verbose'|'reasoning', e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onCloseConfig(key);
        // Fire and forget updating back to inherit
        if ((key === 'thinking' && thinking !== 'inherit') ||
            (key === 'verbose' && verbose !== 'inherit') ||
            (key === 'reasoning' && reasoning !== 'inherit')) {
            updateConfig(key, 'inherit');
        }
    };

    return (
        <div className={cn("flex items-center gap-1.5", className)}>
            {/* Thinking Dropup */}
            {activeConfigs.thinking && (
                <div className="relative group/btn flex items-center">
                    <DropdownMenu defaultOpen={autoOpenConfig === 'thinking'}>
                        <DropdownMenuTrigger asChild>
                            <button
                                disabled={isUpdating}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-200 text-[10px] font-medium border bg-transparent hover:bg-white/5",
                                    thinking !== 'inherit' ? "border-[var(--ofiere-violet)] text-[var(--ofiere-violet)]" : "border-border text-muted-foreground",
                                    isUpdating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <Brain className="w-3 h-3" />
                                <span>Thinking: {thinking}</span>
                                <ChevronUp className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="min-w-0 w-32 pb-1 mb-1 ofiere-glass-3">
                            {THINKING_OPTIONS.map((opt) => (
                                <DropdownMenuItem 
                                    key={opt} 
                                    onClick={() => updateConfig('thinking', opt)}
                                    className={cn("text-xs py-1", thinking === opt && "bg-white/10")}
                                >
                                    {opt}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button 
                        onClick={(e) => handleClose('thinking', e)}
                        className="absolute -top-1.5 -right-1.5 bg-background border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-500/50 rounded-full p-0.5 opacity-0 group-hover/btn:opacity-100 shadow-sm transition-all"
                    >
                        <XIcon className="w-2.5 h-2.5" />
                    </button>
                </div>
            )}

            {/* Verbose Dropup */}
            {activeConfigs.verbose && (
                <div className="relative group/btn flex items-center">
                    <DropdownMenu defaultOpen={autoOpenConfig === 'verbose'}>
                        <DropdownMenuTrigger asChild>
                            <button
                                disabled={isUpdating}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-200 text-[10px] font-medium border bg-transparent hover:bg-white/5",
                                    verbose !== 'inherit' ? "border-[var(--accent-base)] text-[var(--accent-base)]" : "border-border text-muted-foreground",
                                    isUpdating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <MessageSquareText className="w-3 h-3" />
                                <span>Verbose: {verbose === 'off' ? 'off (explicit)' : verbose}</span>
                                <ChevronUp className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="min-w-0 w-32 pb-1 mb-1 ofiere-glass-3">
                            {VERBOSE_OPTIONS.map((opt) => (
                                <DropdownMenuItem 
                                    key={opt} 
                                    onClick={() => updateConfig('verbose', opt)}
                                    className={cn("text-xs py-1", verbose === opt && "bg-white/10")}
                                >
                                    {opt === 'off' ? 'off (explicit)' : opt}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button 
                        onClick={(e) => handleClose('verbose', e)}
                        className="absolute -top-1.5 -right-1.5 bg-background border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-500/50 rounded-full p-0.5 opacity-0 group-hover/btn:opacity-100 shadow-sm transition-all"
                    >
                        <XIcon className="w-2.5 h-2.5" />
                    </button>
                </div>
            )}

            {/* Reasoning Dropup */}
            {activeConfigs.reasoning && (
                <div className="relative group/btn flex items-center">
                    <DropdownMenu defaultOpen={autoOpenConfig === 'reasoning'}>
                        <DropdownMenuTrigger asChild>
                            <button
                                disabled={isUpdating}
                                className={cn(
                                    "flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors duration-200 text-[10px] font-medium border bg-transparent hover:bg-white/5",
                                    reasoning !== 'inherit' ? "border-emerald-500 text-emerald-500" : "border-border text-muted-foreground",
                                    isUpdating && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <GitMerge className="w-3 h-3" />
                                <span>Reasoning: {reasoning}</span>
                                <ChevronUp className="w-3 h-3 opacity-50" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent side="top" align="center" className="min-w-0 w-32 pb-1 mb-1 ofiere-glass-3">
                            {REASONING_OPTIONS.map((opt) => (
                                <DropdownMenuItem 
                                    key={opt} 
                                    onClick={() => updateConfig('reasoning', opt)}
                                    className={cn("text-xs py-1", reasoning === opt && "bg-white/10")}
                                >
                                    {opt}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <button 
                        onClick={(e) => handleClose('reasoning', e)}
                        className="absolute -top-1.5 -right-1.5 bg-background border border-border/50 text-muted-foreground hover:text-red-400 hover:border-red-500/50 rounded-full p-0.5 opacity-0 group-hover/btn:opacity-100 shadow-sm transition-all"
                    >
                        <XIcon className="w-2.5 h-2.5" />
                    </button>
                </div>
            )}
        </div>
    );
};
