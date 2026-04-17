"use client";

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { 
    User, Bot, GitBranch, Flag, Pencil, 
    ChevronUp, ChevronDown, Map
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/* ─── Types ─── */
interface TimelineNode {
    id: string;
    type: 'user' | 'assistant' | 'edit' | 'branch' | 'checkpoint';
    label?: string;
    messageIndex: number;
    isActive?: boolean;
}

interface TimelineScrubberProps {
    messages: Array<{
        id: string;
        role: string;
        content?: string;
        isCheckpoint?: boolean;
        checkpointLabel?: string;
        versionIndex?: number;
        branchId?: string;
    }>;
    activeIndex?: number;
    onScrubTo?: (messageIndex: number) => void;
    className?: string;
    agentName?: string;
}

/* ─── Component ─── */
export const TimelineScrubber: React.FC<TimelineScrubberProps> = ({
    messages,
    activeIndex,
    onScrubTo,
    className,
    agentName = 'Agent',
}) => {
    const railRef = useRef<HTMLDivElement>(null);
    const [isMiniMap, setIsMiniMap] = useState(false);
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    // Build timeline nodes from messages
    const nodes: TimelineNode[] = useMemo(() => {
        return messages.map((msg, idx) => {
            let type: TimelineNode['type'] = msg.role === 'user' ? 'user' : 'assistant';
            if (msg.isCheckpoint) type = 'checkpoint';
            if ((msg.versionIndex ?? 0) > 0) type = 'edit';
            if (msg.branchId && msg.branchId !== 'main') type = 'branch';

            return {
                id: msg.id,
                type,
                label: msg.checkpointLabel,
                messageIndex: idx,
                isActive: idx === activeIndex,
            };
        });
    }, [messages, activeIndex]);

    // Auto-switch to mini-map for long threads
    useEffect(() => {
        setIsMiniMap(messages.length > 50);
    }, [messages.length]);

    const getNodeStyle = (node: TimelineNode) => {
        const base = {
            user: { color: 'var(--accent-base)', bg: 'var(--accent-subtle)', size: 8 },
            assistant: { color: 'var(--ofiere-cyan)', bg: 'var(--ofiere-cyan-dim)', size: 8 },
            edit: { color: 'var(--ofiere-warn)', bg: 'var(--ofiere-warn-dim)', size: 6 },
            branch: { color: 'var(--ofiere-violet)', bg: 'var(--ofiere-violet-dim)', size: 10 },
            checkpoint: { color: 'var(--ofiere-success)', bg: 'var(--ofiere-success-dim)', size: 10 },
        };
        return base[node.type];
    };

    const getNodeIcon = (type: TimelineNode['type']) => {
        switch (type) {
            case 'user': return <User className="w-2 h-2" />;
            case 'assistant': return <Bot className="w-2 h-2" />;
            case 'edit': return <Pencil className="w-2 h-2" />;
            case 'branch': return <GitBranch className="w-2 h-2" />;
            case 'checkpoint': return <Flag className="w-2 h-2" />;
        }
    };

    if (messages.length === 0) return null;

    return (
        <div
            className={cn(
                "flex flex-col items-center h-full py-3 shrink-0 select-none relative",
                className
            )}
            style={{ width: 48 }}
        >
            {/* Top label */}
            <div className="flex flex-col items-center gap-1 mb-2">
                <span
                    className="text-[8px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--ofiere-text-ghost)', writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}
                >
                    Timeline
                </span>
            </div>

            {/* Rail */}
            <div ref={railRef} className="flex-1 relative flex flex-col items-center overflow-hidden">
                {/* Vertical line */}
                <div
                    className="absolute top-0 bottom-0 w-px"
                    style={{ background: 'var(--ofiere-border-subtle)' }}
                />

                {/* Nodes */}
                <div className={cn(
                    "flex flex-col items-center w-full relative z-10 overflow-y-auto scrollbar-hide pb-[10px]",
                    isMiniMap ? "gap-[2px]" : "gap-[6px]"
                )}>
                    <TooltipProvider delayDuration={0}>
                        {nodes.map((node, i) => {
                            const style = getNodeStyle(node);
                            const isHovered = hoveredIndex === i;
                            const isActive = node.isActive;

                            return (
                                <Tooltip key={node.id}>
                                    <TooltipTrigger asChild>
                                        <div
                                            className="relative flex flex-col items-center justify-center cursor-pointer transition-all duration-150"
                                            style={{
                                                width: isMiniMap ? 4 : style.size + 8,
                                                height: isMiniMap ? 3 : style.size + 8,
                                                flexShrink: 0,
                                            }}
                                            onClick={() => onScrubTo?.(node.messageIndex)}
                                            onMouseEnter={() => setHoveredIndex(i)}
                                            onMouseLeave={() => setHoveredIndex(null)}
                                        >
                                            {/* Node dot */}
                                            <div
                                                className="rounded-full transition-all duration-150"
                                                style={{
                                                    width: isMiniMap ? 3 : (isHovered || isActive ? style.size + 4 : style.size),
                                                    height: isMiniMap ? 2 : (isHovered || isActive ? style.size + 4 : style.size),
                                                    background: isActive ? style.color : style.bg,
                                                    border: isActive ? `2px solid ${style.color}` : 'none',
                                                    boxShadow: isActive ? `0 0 8px ${style.color}40` : 'none',
                                                }}
                                            />

                                            {/* Checkpoint label (always visible) */}
                                            {node.type === 'checkpoint' && node.label && !isMiniMap && (
                                                <div
                                                    className="absolute right-[calc(100%+4px)] px-1.5 py-0.5 rounded text-[8px] font-semibold whitespace-nowrap"
                                                    style={{
                                                        background: 'var(--ofiere-success-dim)',
                                                        color: 'var(--ofiere-success)',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)'
                                                    }}
                                                >
                                                    {node.label}
                                                </div>
                                            )}
                                        </div>
                                    </TooltipTrigger>
                                    
                                    {/* Hover tooltip */}
                                    <TooltipContent 
                                        side="left" 
                                        sideOffset={12} 
                                        className="px-2 py-1.5 rounded-md text-[10px] font-medium z-50 flex flex-col items-start min-w-0"
                                        style={{
                                            background: 'var(--popover)',
                                            border: '1px solid var(--border)',
                                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                                            width: 'max-content',
                                            maxWidth: '200px'
                                        }}
                                    >
                                        <div className="flex items-center gap-1 mb-1 opacity-80" style={{ color: style.color }}>
                                            {getNodeIcon(node.type)}
                                            <span className="uppercase tracking-widest text-[8px]">
                                                {node.type === 'assistant' ? agentName : (node.type === 'user' ? 'You' : node.type)}
                                            </span>
                                        </div>
                                        <div className="text-white truncate max-w-full" style={{ color: 'var(--popover-foreground)' }}>
                                            {messages[i]?.content || '...'}
                                        </div>
                                    </TooltipContent>
                                </Tooltip>
                            );
                        })}
                    </TooltipProvider>
                </div>
            </div>

            {/* Bottom controls */}
            <div className="flex flex-col items-center gap-1 mt-2 mb-1">
                {messages.length > 50 && (
                    <button
                        onClick={() => setIsMiniMap(!isMiniMap)}
                        className="p-1 rounded transition-colors hover:bg-white/5"
                        title={isMiniMap ? 'Expand timeline' : 'Collapse to mini-map'}
                    >
                        <Map
                            className="w-3 h-3"
                            style={{ color: isMiniMap ? 'var(--ofiere-cyan)' : 'var(--ofiere-text-ghost)' }}
                        />
                    </button>
                )}
                <span className="text-[8px]" style={{ color: 'var(--ofiere-text-ghost)' }}>
                    {messages.length}
                </span>
            </div>
        </div>
    );
};

export default TimelineScrubber;
