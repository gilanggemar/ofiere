"use client";

import React from 'react';
import { cn } from '@/lib/utils';
import { Sparkles, ArrowRight } from 'lucide-react';

interface NextBestActionChipProps {
    action: string | null;
    onAccept?: () => void;
    className?: string;
}

export const NextBestActionChip: React.FC<NextBestActionChipProps> = ({
    action,
    onAccept,
    className,
}) => {
    if (!action) return null;

    return (
        <button
            onClick={onAccept}
            className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full transition-all duration-200 group",
                className
            )}
            style={{
                background: 'var(--nerv-surface-3)',
                border: '1px solid var(--nerv-border-default)',
            }}
            onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'color-mix(in srgb, var(--accent-base) 8%, transparent)';
                (e.currentTarget as HTMLElement).style.borderColor = 'color-mix(in srgb, var(--accent-base) 25%, transparent)';
            }}
            onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--nerv-surface-3)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--nerv-border-default)';
            }}
        >
            <Sparkles className="w-3 h-3 shrink-0" style={{ color: 'var(--accent-base)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--nerv-text-secondary)' }}>
                {action}
            </span>
            <ArrowRight
                className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: 'var(--accent-base)' }}
            />
        </button>
    );
};

export default NextBestActionChip;
