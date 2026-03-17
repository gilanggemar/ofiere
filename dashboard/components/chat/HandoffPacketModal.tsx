"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Package, Copy, CheckCircle2,
    AlertTriangle, FileText, Gauge, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

/* ─── Types ─── */
interface HandoffSection {
    title: string;
    content: string;
    editable?: boolean;
}

interface ReadinessItem {
    label: string;
    status: 'ready' | 'warning' | 'blocked';
    note?: string;
}

interface HandoffPacketModalProps {
    isOpen: boolean;
    onClose: () => void;
    conversationTitle?: string;
    agentName?: string;
    messageCount?: number;
    onGenerate?: () => Promise<{
        sections: HandoffSection[];
        readiness: ReadinessItem[];
    }>;
}

/* ─── Component ─── */
export const HandoffPacketModal: React.FC<HandoffPacketModalProps> = ({
    isOpen,
    onClose,
    conversationTitle,
    agentName,
    messageCount = 0,
    onGenerate,
}) => {
    const [activeTab, setActiveTab] = useState<'brief' | 'readiness'>('brief');
    const [sections, setSections] = useState<HandoffSection[]>([
        { title: 'Executive Summary', content: '', editable: true },
        { title: 'Key Decisions Made', content: '', editable: true },
        { title: 'Open Questions', content: '', editable: true },
        { title: 'Next Steps', content: '', editable: true },
        { title: 'Context Files', content: '', editable: false },
    ]);
    const [readiness, setReadiness] = useState<ReadinessItem[]>([
        { label: 'Goal defined', status: 'warning', note: 'No goal lock set' },
        { label: 'Constraints met', status: 'ready' },
        { label: 'Open questions resolved', status: 'blocked', note: '2 questions remain' },
        { label: 'Budget within limit', status: 'ready' },
    ]);
    const [isGenerating, setIsGenerating] = useState(false);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            if (onGenerate) {
                const result = await onGenerate();
                setSections(result.sections);
                setReadiness(result.readiness);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyAll = () => {
        const text = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
        navigator.clipboard.writeText(text);
    };

    const getStatusIcon = (status: ReadinessItem['status']) => {
        switch (status) {
            case 'ready': return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--nerv-success)' }} />;
            case 'warning': return <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--nerv-warn)' }} />;
            case 'blocked': return <Shield className="w-3.5 h-3.5" style={{ color: 'var(--nerv-danger)' }} />;
        }
    };

    const readyCount = readiness.filter(r => r.status === 'ready').length;
    const readinessPercent = readiness.length > 0 ? (readyCount / readiness.length) * 100 : 0;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <div className="flex items-center gap-2.5">
                        <Package className="w-4 h-4 text-primary" />
                        <div>
                            <DialogTitle className="text-[14px]">Handoff Packet</DialogTitle>
                            <span className="text-[10px] text-muted-foreground">
                                {conversationTitle || 'Untitled'} · {agentName} · {messageCount} messages
                            </span>
                        </div>
                    </div>
                </DialogHeader>

                {/* Tabs */}
                <div className="flex items-center gap-4 border-b border-border pb-0">
                    {[
                        { key: 'brief', label: 'Structured Brief', icon: <FileText className="w-3 h-3" /> },
                        { key: 'readiness', label: 'Readiness', icon: <Gauge className="w-3 h-3" /> },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className="flex items-center gap-1.5 pb-2 text-[11px] font-medium border-b-[1.5px] transition-all"
                            style={{
                                color: activeTab === tab.key ? 'var(--accent-base)' : 'var(--muted-foreground)',
                                borderColor: activeTab === tab.key ? 'var(--accent-base)' : 'transparent',
                            }}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                    {activeTab === 'brief' && (
                        <div className="space-y-4">
                            {sections.map((section, i) => (
                                <div key={i} className="space-y-1.5">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        {section.title}
                                    </span>
                                    {section.editable ? (
                                        <Textarea
                                            value={section.content}
                                            onChange={e => {
                                                const updated = [...sections];
                                                updated[i] = { ...section, content: e.target.value };
                                                setSections(updated);
                                            }}
                                            placeholder={`Enter ${section.title.toLowerCase()}…`}
                                            className="text-[12px] min-h-[60px] resize-none"
                                        />
                                    ) : (
                                        <p className="text-[12px] px-2.5 py-2 text-muted-foreground">
                                            {section.content || 'No content yet'}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {activeTab === 'readiness' && (
                        <div className="space-y-4">
                            {/* Runway meter */}
                            <div className="space-y-2">
                                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Ship Readiness
                                </span>
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-2 rounded-full overflow-hidden bg-muted">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${readinessPercent}%`,
                                                background: readinessPercent === 100 ? 'var(--nerv-success)' : readinessPercent > 50 ? 'var(--nerv-warn)' : 'var(--nerv-danger)',
                                            }}
                                        />
                                    </div>
                                    <span className="text-[11px] font-mono text-muted-foreground">
                                        {readyCount}/{readiness.length}
                                    </span>
                                </div>
                            </div>

                            {/* Readiness items */}
                            <div className="space-y-1">
                                {readiness.map((item, i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted"
                                    >
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(item.status)}
                                            <span className="text-[12px] text-foreground">
                                                {item.label}
                                            </span>
                                        </div>
                                        {item.note && (
                                            <span className="text-[9px] text-muted-foreground">
                                                {item.note}
                                            </span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </ScrollArea>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="text-xs h-8"
                    >
                        {isGenerating ? 'Generating…' : 'Auto-Generate from Chat'}
                    </Button>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleCopyAll} className="text-xs h-8 gap-1">
                            <Copy className="w-3 h-3" />
                            Copy
                        </Button>
                        <Button size="sm" onClick={onClose} className="text-xs h-8">
                            Done
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default HandoffPacketModal;
