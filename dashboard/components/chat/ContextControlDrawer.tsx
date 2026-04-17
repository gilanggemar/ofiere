"use client";

import React, { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
    Brain, FileText, Target, Lock, MessageSquare,
    Eye, EyeOff, ChevronDown, ChevronUp, Gauge, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

/* ─── Types ─── */
interface ContextItem {
    id: string;
    type: 'memory' | 'file' | 'goal' | 'constraint' | 'recent_message';
    label: string;
    tokenEstimate: number;
    included: boolean;
}

interface ContextControlDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    maxTokenBudget?: number;
    contextItems: ContextItem[];
    onItemToggle: (id: string) => void;
    className?: string;
}

const TYPE_CONFIG = {
    memory: { icon: <Brain className="w-3 h-3" />, color: 'var(--ofiere-cyan)' },
    file: { icon: <FileText className="w-3 h-3" />, color: 'var(--ofiere-violet)' },
    goal: { icon: <Target className="w-3 h-3" />, color: 'var(--ofiere-success)' },
    constraint: { icon: <Lock className="w-3 h-3" />, color: 'var(--ofiere-warn)' },
    recent_message: { icon: <MessageSquare className="w-3 h-3" />, color: 'var(--ofiere-text-secondary)' },
};

/* ─── Component ─── */
export const ContextControlDrawer: React.FC<ContextControlDrawerProps> = ({
    isOpen,
    onClose,
    maxTokenBudget = 128000,
    contextItems,
    onItemToggle,
    className,
}) => {
    const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});

    // Calculate token usage
    const usedTokens = useMemo(() =>
        contextItems.filter(i => i.included).reduce((sum, i) => sum + i.tokenEstimate, 0),
        [contextItems]
    );
    const usagePercent = Math.min((usedTokens / maxTokenBudget) * 100, 100);
    const isOverBudget = usedTokens > maxTokenBudget;

    // Group items by type
    const grouped = useMemo(() => {
        const groups: Record<string, ContextItem[]> = {};
        for (const item of contextItems) {
            if (!groups[item.type]) groups[item.type] = [];
            groups[item.type].push(item);
        }
        return groups;
    }, [contextItems]);

    const estimateTokensFromChars = (chars: number) => Math.ceil(chars / 4);

    if (!isOpen) return null;

    return (
        <div
            className={cn(
                "absolute bottom-full left-0 right-0 z-50 transition-all duration-200 ease-out",
                className
            )}
            style={{
                maxHeight: '50vh',
                background: 'var(--ofiere-surface-2)',
                borderTop: '1px solid var(--ofiere-border-default)',
                borderLeft: '1px solid var(--ofiere-border-subtle)',
                borderRight: '1px solid var(--ofiere-border-subtle)',
                borderRadius: '12px 12px 0 0',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5" style={{ borderBottom: '1px solid var(--ofiere-border-subtle)' }}>
                <div className="flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5" style={{ color: 'var(--ofiere-cyan)' }} />
                    <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--ofiere-text-secondary)' }}>
                        Context Control
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    {/* Token Budget Meter */}
                    <div className="flex items-center gap-2">
                        <Gauge className="w-3 h-3" style={{ color: isOverBudget ? 'var(--ofiere-danger)' : 'var(--ofiere-text-tertiary)' }} />
                        <div className="flex items-center gap-1.5">
                            <div
                                className="w-20 h-1.5 rounded-full overflow-hidden"
                                style={{ background: 'var(--ofiere-surface-4)' }}
                            >
                                <div
                                    className="h-full rounded-full transition-all duration-300"
                                    style={{
                                        width: `${Math.min(usagePercent, 100)}%`,
                                        background: isOverBudget
                                            ? 'var(--ofiere-danger)'
                                            : usagePercent > 80
                                                ? 'var(--ofiere-warn)'
                                                : 'var(--ofiere-cyan)',
                                    }}
                                />
                            </div>
                            <span
                                className="text-[9px] font-mono"
                                style={{ color: isOverBudget ? 'var(--ofiere-danger)' : 'var(--ofiere-text-tertiary)' }}
                            >
                                {(usedTokens / 1000).toFixed(1)}k / {(maxTokenBudget / 1000).toFixed(0)}k
                            </span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-[10px] px-2 py-0.5 rounded hover:bg-white/5" style={{ color: 'var(--ofiere-text-tertiary)' }}>
                        Close
                    </button>
                </div>
            </div>

            {/* Context Surgeon */}
            <ScrollArea className="max-h-[40vh]">
                <div className="p-3 space-y-2">
                    {Object.entries(grouped).map(([type, items]) => {
                        const config = TYPE_CONFIG[type as keyof typeof TYPE_CONFIG];
                        const isCollapsed = groupCollapsed[type];
                        const includedCount = items.filter(i => i.included).length;

                        return (
                            <div key={type} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ofiere-border-subtle)' }}>
                                {/* Group header */}
                                <button
                                    onClick={() => setGroupCollapsed(prev => ({ ...prev, [type]: !prev[type] }))}
                                    className="flex items-center justify-between w-full px-3 py-2 text-left transition-colors"
                                    style={{ background: 'var(--ofiere-surface-3)' }}
                                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--ofiere-surface-4)')}
                                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--ofiere-surface-3)')}
                                >
                                    <div className="flex items-center gap-2">
                                        <span style={{ color: config.color }}>{config.icon}</span>
                                        <span className="text-[11px] font-medium capitalize" style={{ color: 'var(--ofiere-text-primary)' }}>
                                            {type.replace('_', ' ')}
                                        </span>
                                        <span className="text-[9px]" style={{ color: 'var(--ofiere-text-ghost)' }}>
                                            {includedCount}/{items.length}
                                        </span>
                                    </div>
                                    {isCollapsed
                                        ? <ChevronDown className="w-3 h-3" style={{ color: 'var(--ofiere-text-ghost)' }} />
                                        : <ChevronUp className="w-3 h-3" style={{ color: 'var(--ofiere-text-ghost)' }} />
                                    }
                                </button>

                                {/* Items */}
                                {!isCollapsed && (
                                    <div className="divide-y" style={{ borderColor: 'var(--ofiere-border-subtle)' }}>
                                        {items.map(item => (
                                            <div
                                                key={item.id}
                                                className="flex items-center justify-between px-3 py-1.5 cursor-pointer transition-colors"
                                                onClick={() => onItemToggle(item.id)}
                                                style={{ background: item.included ? 'transparent' : 'rgba(0,0,0,0.15)' }}
                                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ofiere-surface-4)')}
                                                onMouseLeave={e => (e.currentTarget.style.background = item.included ? 'transparent' : 'rgba(0,0,0,0.15)')}
                                            >
                                                <div className="flex items-center gap-2">
                                                    {item.included
                                                        ? <Eye className="w-3 h-3" style={{ color: config.color }} />
                                                        : <EyeOff className="w-3 h-3" style={{ color: 'var(--ofiere-text-ghost)' }} />
                                                    }
                                                    <span
                                                        className="text-[11px] truncate max-w-[200px]"
                                                        style={{
                                                            color: item.included ? 'var(--ofiere-text-primary)' : 'var(--ofiere-text-ghost)',
                                                            textDecoration: item.included ? 'none' : 'line-through',
                                                        }}
                                                    >
                                                        {item.label}
                                                    </span>
                                                </div>
                                                <span className="text-[9px] font-mono" style={{ color: 'var(--ofiere-text-ghost)' }}>
                                                    ~{item.tokenEstimate}t
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}

                    {contextItems.length === 0 && (
                        <div className="text-center py-8">
                            <span className="text-[11px]" style={{ color: 'var(--ofiere-text-tertiary)' }}>No context items in this conversation</span>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default ContextControlDrawer;
