"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, Volume2, ChevronDown, Loader2 } from 'lucide-react';

/* ─── Types ─── */
type AudiencePreset = 'executive' | 'technical' | 'non-technical' | 'legal';
type TonePreset = 'concise' | 'detailed' | 'persuasive' | 'cautious';

interface OutputAdaptationBarProps {
    onAdapt: (audience: AudiencePreset, tone: TonePreset) => Promise<void>;
    className?: string;
}

const AUDIENCES: { key: AudiencePreset; label: string }[] = [
    { key: 'executive', label: 'Executive' },
    { key: 'technical', label: 'Technical' },
    { key: 'non-technical', label: 'Non-Technical' },
    { key: 'legal', label: 'Legal/Compliance' },
];

const TONES: { key: TonePreset; label: string }[] = [
    { key: 'concise', label: 'Concise' },
    { key: 'detailed', label: 'Detailed' },
    { key: 'persuasive', label: 'Persuasive' },
    { key: 'cautious', label: 'Cautious' },
];

/* ─── Component ─── */
export const OutputAdaptationBar: React.FC<OutputAdaptationBarProps> = ({
    onAdapt,
    className,
}) => {
    const [showAudience, setShowAudience] = useState(false);
    const [showTone, setShowTone] = useState(false);
    const [isAdapting, setIsAdapting] = useState(false);
    const [selectedAudience, setSelectedAudience] = useState<AudiencePreset>('executive');
    const [selectedTone, setSelectedTone] = useState<TonePreset>('concise');

    const handleAdapt = async (audience: AudiencePreset, tone: TonePreset) => {
        setIsAdapting(true);
        try {
            await onAdapt(audience, tone);
        } finally {
            setIsAdapting(false);
            setShowAudience(false);
            setShowTone(false);
        }
    };

    return (
        <div
            className={cn(
                "flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
                className
            )}
        >
            {isAdapting && <Loader2 className="w-3 h-3 animate-spin" style={{ color: 'var(--ofiere-text-ghost)' }} />}

            {/* Audience selector */}
            <div className="relative">
                <button
                    onClick={() => { setShowAudience(!showAudience); setShowTone(false); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] transition-colors"
                    style={{
                        color: 'var(--ofiere-text-ghost)',
                        background: showAudience ? 'var(--ofiere-surface-4)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ofiere-text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ofiere-text-ghost)')}
                >
                    <Users className="w-2.5 h-2.5" />
                    <span>Recast</span>
                </button>
                {showAudience && (
                    <div
                        className="absolute bottom-full left-0 mb-1 z-50 rounded-lg overflow-hidden py-0.5"
                        style={{
                            background: 'var(--ofiere-surface-3)',
                            border: '1px solid var(--ofiere-border-default)',
                            minWidth: 130,
                        }}
                    >
                        {AUDIENCES.map(a => (
                            <button
                                key={a.key}
                                onClick={() => handleAdapt(a.key, selectedTone)}
                                className="block w-full text-left px-3 py-1.5 text-[10px] transition-colors"
                                style={{ color: 'var(--ofiere-text-secondary)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ofiere-surface-4)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                {a.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Tone selector */}
            <div className="relative">
                <button
                    onClick={() => { setShowTone(!showTone); setShowAudience(false); }}
                    className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] transition-colors"
                    style={{
                        color: 'var(--ofiere-text-ghost)',
                        background: showTone ? 'var(--ofiere-surface-4)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--ofiere-text-secondary)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--ofiere-text-ghost)')}
                >
                    <Volume2 className="w-2.5 h-2.5" />
                    <span>Tone</span>
                </button>
                {showTone && (
                    <div
                        className="absolute bottom-full left-0 mb-1 z-50 rounded-lg overflow-hidden py-0.5"
                        style={{
                            background: 'var(--ofiere-surface-3)',
                            border: '1px solid var(--ofiere-border-default)',
                            minWidth: 120,
                        }}
                    >
                        {TONES.map(t => (
                            <button
                                key={t.key}
                                onClick={() => handleAdapt(selectedAudience, t.key)}
                                className="block w-full text-left px-3 py-1.5 text-[10px] transition-colors"
                                style={{ color: 'var(--ofiere-text-secondary)' }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--ofiere-surface-4)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default OutputAdaptationBar;
