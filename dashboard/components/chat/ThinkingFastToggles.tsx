"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Brain, Zap, Sparkles } from 'lucide-react';
import { getGateway } from '@/lib/openclawGateway';
import { toast } from 'sonner';

interface ThinkingFastTogglesProps {
    sessionKey: string | null;
    className?: string;
}

type AgentMode = 'thinking' | 'fast';

export const ThinkingFastToggles: React.FC<ThinkingFastTogglesProps> = ({ sessionKey, className }) => {
    const [mode, setMode] = useState<AgentMode>('fast');
    const [isUpdating, setIsUpdating] = useState(false);

    const handleCycleMode = async () => {
        if (!sessionKey || isUpdating) return;
        
        setIsUpdating(true);
        const nextMode = mode === 'thinking' ? 'fast' : 'thinking';
        const prevMode = mode;
        
        setMode(nextMode); // Optimistic UI
        
        try {
            await getGateway().request('sessions.patch', {
                sessionKey,
                config: { 
                    thinking_level: nextMode === 'thinking' ? 'high' : null,
                    fast_mode: nextMode === 'fast'
                }
            });
            toast.success(`${nextMode.charAt(0).toUpperCase() + nextMode.slice(1)} mode enabled`);
        } catch (err: any) {
            setMode(prevMode); // Revert
            
            // Console log the full error schema to diagnose why OpenClaw rejects the patch
            console.error('[OpenClaw Toggle] Failed to patch sessions:', JSON.stringify(err, Object.getOwnPropertyNames(err), 2));
            toast.error('Failed to patch session: Check console log');
        } finally {
            setIsUpdating(false);
        }
    };

    const getModeConfig = () => {
        switch (mode) {
            case 'thinking':
                return {
                    label: 'Thinking',
                    icon: <Brain className="w-3 h-3" />,
                    bg: 'bg-[color-mix(in_srgb,var(--ofiere-violet)_12%,transparent)]',
                    border: 'border-[color-mix(in_srgb,var(--ofiere-violet)_25%,transparent)]',
                    text: 'text-[var(--ofiere-violet)]'
                };
            case 'fast':
            default:
                return {
                    label: 'Fast',
                    icon: <Zap className="w-3 h-3" />,
                    bg: 'bg-[color-mix(in_srgb,var(--accent-base)_12%,transparent)]',
                    border: 'border-[color-mix(in_srgb,var(--accent-base)_25%,transparent)]',
                    text: 'text-[var(--accent-base)]'
                };
        }
    };

    const config = getModeConfig();

    return (
        <div className={cn("flex items-center", className)}>
            <button
                type="button"
                onClick={handleCycleMode}
                disabled={isUpdating}
                className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-colors duration-200 text-[10px] font-medium border",
                    config.bg, config.border, config.text,
                    isUpdating && "opacity-50 cursor-not-allowed"
                )}
                title={`Current Mode: ${config.label}. Click to cycle.`}
            >
                {config.icon}
                <span>{config.label}</span>
            </button>
        </div>
    );
};
