"use client";

import React from 'react';
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
                "flex items-start gap-2 px-3 py-2 rounded-md transition-all duration-200",
                className
            )}
            style={{
                background: 'color-mix(in srgb, rgb(234, 120, 47) 10%, transparent)',
                border: '1px solid color-mix(in srgb, rgb(234, 120, 47) 25%, transparent)',
            }}
        >
            <Quote className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: 'rgb(234, 120, 47)' }} />
            <div className="flex-1 min-w-0">
                <span className="text-[9px] uppercase tracking-wider font-semibold" style={{ color: 'rgb(234, 120, 47)' }}>
                    Replying to
                </span>
                <p
                    className="text-[11px] line-clamp-2 mt-0.5"
                    style={{ color: 'var(--ofiere-text-secondary)' }}
                >
                    {quotedText}
                </p>
            </div>
            <button
                onClick={onClear}
                className="p-0.5 rounded hover:bg-white/5 transition-colors shrink-0"
            >
                <X className="w-3 h-3" style={{ color: 'var(--ofiere-text-tertiary)' }} />
            </button>
        </div>
    );
};

export default QuotedReplyBanner;
