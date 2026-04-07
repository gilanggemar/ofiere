"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Compass, Crosshair, Zap, ShieldCheck, Power } from 'lucide-react';

/* ─── Types ─── */
export type StrategyMode = 'off' | 'explore' | 'decide' | 'execute' | 'verify';

interface StrategyConfig {
    mode: StrategyMode;
    label: string;
    icon: React.ReactNode;
    color: string;
    description: string;
    systemPrompt: string;
}

const STRATEGIES: StrategyConfig[] = [
    {
        mode: 'off',
        label: 'Auto',
        icon: <Power className="w-3 h-3" />,
        color: 'var(--muted-foreground)',
        description: 'No strategy injection — default behavior',
        systemPrompt: '',
    },
    {
        mode: 'explore',
        label: 'Explore',
        icon: <Compass className="w-3 h-3" />,
        color: 'var(--nerv-cyan)',
        description: 'Divergent thinking, brainstorming, wide search',
        systemPrompt: '[STRATEGY: EXPLORE] — Prioritize divergent thinking. Offer multiple perspectives, ask probing questions, surface non-obvious connections. Avoid premature convergence.',
    },
    {
        mode: 'decide',
        label: 'Decide',
        icon: <Crosshair className="w-3 h-3" />,
        color: 'var(--nerv-violet)',
        description: 'Compare options, weigh trade-offs, recommend',
        systemPrompt: '[STRATEGY: DECIDE] — Help the user converge on a decision. Present structured comparisons, highlight trade-offs, and provide a clear recommendation with reasoning.',
    },
    {
        mode: 'execute',
        label: 'Execute',
        icon: <Zap className="w-3 h-3" />,
        color: 'var(--accent-base)',
        description: 'Action-oriented, step-by-step, ship it',
        systemPrompt: '[STRATEGY: EXECUTE] — Be action-oriented. Provide concrete next steps, code, commands, or templates. Minimize discussion, maximize output.',
    },
    {
        mode: 'verify',
        label: 'Verify',
        icon: <ShieldCheck className="w-3 h-3" />,
        color: 'var(--nerv-success)',
        description: 'Review, validate, challenge assumptions',
        systemPrompt: '[STRATEGY: VERIFY] — Challenge assumptions. Look for gaps, risks, edge cases, and logical errors. Apply "Assumption Breaker" analysis to the most recent claims.',
    },
];

interface StrategyModeSwitcherProps {
    activeMode: StrategyMode;
    onModeChange: (mode: StrategyMode) => void;
    className?: string;
}

export const StrategyModeSwitcher: React.FC<StrategyModeSwitcherProps> = ({
    activeMode,
    onModeChange,
    className,
}) => {
    const [expanded, setExpanded] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const activeConfig = STRATEGIES.find(s => s.mode === activeMode)!;

    // Click outside to close
    useEffect(() => {
        if (!expanded) return;
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setExpanded(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [expanded]);

    return (
        <div ref={containerRef} className={cn("relative", className)}>
            {/* Active mode chip */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-center gap-1.5 px-2.5 h-7 rounded-sm transition-colors duration-200 text-[10px] font-medium",
                    activeMode === 'off' ? "bg-transparent border border-border hover:bg-accent hover:text-accent-foreground text-foreground" : "hover:brightness-110"
                )}
                style={activeMode !== 'off' ? {
                    background: `color-mix(in srgb, ${activeConfig.color} 12%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${activeConfig.color} 25%, transparent)`,
                    color: activeConfig.color,
                } : undefined}
            >
                {activeConfig.icon}
                <span>{activeConfig.label}</span>
            </button>

            {/* Dropdown panel — matches shadcn dropdown styling */}
            {expanded && (
                <div
                    className="absolute bottom-full left-0 mb-2 z-50 rounded-md overflow-hidden shadow-md"
                    style={{
                        background: 'var(--popover)',
                        border: '1px solid var(--border)',
                        minWidth: 240,
                    }}
                >
                    <div className="p-1">
                        {STRATEGIES.map(strat => {
                            const isActive = activeMode === strat.mode;
                            return (
                                <button
                                    key={strat.mode}
                                    onClick={() => {
                                        onModeChange(strat.mode);
                                        setExpanded(false);
                                    }}
                                    className="flex items-start gap-2.5 w-full px-2 py-1.5 rounded-sm text-left text-sm transition-colors"
                                    style={{
                                        background: isActive ? 'var(--accent)' : 'transparent',
                                        color: isActive ? strat.color : 'var(--popover-foreground)',
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) (e.currentTarget.style.background = 'var(--accent)');
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) (e.currentTarget.style.background = 'transparent');
                                    }}
                                >
                                    <span className="mt-0.5 shrink-0" style={{ color: strat.color }}>{strat.icon}</span>
                                    <div>
                                        <span
                                            className="text-[11px] font-medium block"
                                            style={{ color: isActive ? strat.color : 'inherit' }}
                                        >
                                            {strat.label}
                                        </span>
                                        <span className="text-[9px] block mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
                                            {strat.description}
                                        </span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

// Export strategy system prompts for injection
export const getStrategySystemPrompt = (mode: StrategyMode): string => {
    return STRATEGIES.find(s => s.mode === mode)?.systemPrompt || '';
};

export default StrategyModeSwitcher;
