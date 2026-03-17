"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { X, Quote } from 'lucide-react';

interface QuotedReplyBannerProps {
    quotedText: string;
    sourceMessageId?: string;
    onClear: () => void;
    className?: string;
}

export const QuotedReplyBanner: React.FC<QuotedReplyBannerProps> = ({
    quotedText,
    sourceMessageId,
    onClear,
    className,
}) => {
    if (!quotedText) return null;

    return (
        <div
            className={cn(
                "flex items-start gap-2 px-3 py-2 rounded-xl transition-all duration-200",
                className
            )}
            style={{
                background: 'var(--nerv-violet-dim)',
                border: '1px solid var(--nerv-violet-glow)',
                borderLeft: '3px solid var(--nerv-violet)',
            }}
        >
            <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'var(--nerv-violet)' }} />
            <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'var(--nerv-violet)' }}>
                    Replying to
                </span>
                <p
                    className="text-[11px] line-clamp-2 mt-0.5"
                    style={{ color: 'var(--nerv-text-secondary)' }}
                >
                    {quotedText}
                </p>
            </div>
            <button
                onClick={onClear}
                className="p-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
            >
                <X className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
            </button>
        </div>
    );
};

export default QuotedReplyBanner;
