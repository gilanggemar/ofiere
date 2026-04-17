"use client";

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import {
    Package, Copy, CheckCircle2,
    AlertTriangle, FileText, Gauge, Shield, Sparkles, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { TaskCardModal } from '@/components/TaskCardModal';
import { Task, ExecutionStep, useTaskStore } from '@/lib/useTaskStore';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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
    agentId?: string;
    messageCount?: number;
    availableAgents?: { id: string; name: string }[];
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
    agentId,
    messageCount = 0,
    availableAgents,
    onGenerate,
}) => {
    const router = useRouter();
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
    const [showTaskCard, setShowTaskCard] = useState(false);
    const [generatedTaskData, setGeneratedTaskData] = useState<Partial<Task> | null>(null);

    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            if (onGenerate) {
                const result = await onGenerate();
                setSections(result.sections);
                setReadiness(result.readiness);

                // Parse the generated sections into a task card
                const summary = result.sections.find(s => s.title === 'Executive Summary')?.content || '';
                const nextSteps = result.sections.find(s => s.title === 'Next Steps')?.content || '';

                // Parse next steps into execution plan
                const stepLines = nextSteps.split('\n').map(l => l.replace(/^[-*•0-9.]+\s*/, '').trim()).filter(l => l.length > 0);
                const executionPlan: ExecutionStep[] = stepLines.map((text, i) => ({
                    id: `step-gen-${Date.now()}-${i}`,
                    text,
                    order: i,
                }));

                // Build task title from either the summary or conversation title
                const taskTitle = summary
                    ? (summary.length > 80 ? summary.slice(0, 77) + '…' : summary)
                    : `Handoff: ${conversationTitle || 'Untitled'}`;

                setGeneratedTaskData({
                    title: taskTitle,
                    agentId: agentId || '',
                    executionPlan,
                    description: summary,
                    source: 'handoff',
                });

                // Auto-open the task card modal
                setShowTaskCard(true);
            }
        } finally {
            setIsGenerating(false);
        }
    };

    const handleCopyAll = () => {
        const text = sections.map(s => `## ${s.title}\n${s.content}`).join('\n\n');
        navigator.clipboard.writeText(text);
    };

    const handleTaskHandoff = (task: Task) => {
        // Close the handoff modal
        onClose();

        // Show notification toast with "Go to task-ops" button
        toast.success('Task added successfully', {
            description: `"${task.title}" assigned to ${agentName || task.agentId}`,
            duration: 6000,
            position: 'bottom-left',
            action: {
                label: 'Go to task-ops',
                onClick: () => router.push('/summit'),
            },
            style: {
                background: 'var(--ofiere-surface-2, #141414)',
                border: '1px solid var(--ofiere-border-subtle, #262626)',
                color: 'var(--foreground)',
            },
        });
    };

    const handleOpenTaskCardManually = () => {
        // Open task card without generation — let user fill it manually
        setGeneratedTaskData({
            title: '',
            agentId: agentId || '',
            executionPlan: [],
            source: 'handoff',
        });
        setShowTaskCard(true);
    };

    const getStatusIcon = (status: ReadinessItem['status']) => {
        switch (status) {
            case 'ready': return <CheckCircle2 className="w-3.5 h-3.5" style={{ color: 'var(--ofiere-success)' }} />;
            case 'warning': return <AlertTriangle className="w-3.5 h-3.5" style={{ color: 'var(--ofiere-warn)' }} />;
            case 'blocked': return <Shield className="w-3.5 h-3.5" style={{ color: 'var(--ofiere-danger)' }} />;
        }
    };

    const readyCount = readiness.filter(r => r.status === 'ready').length;
    const readinessPercent = readiness.length > 0 ? (readyCount / readiness.length) * 100 : 0;

    return (
        <>
            <Dialog open={isOpen && !showTaskCard} onOpenChange={(open) => { if (!open) onClose(); }}>
                <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
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
                    <div className="flex-1 overflow-y-auto min-h-0 -mx-6 px-6">
                        <div className="pb-6">
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
                                                    background: readinessPercent === 100 ? 'var(--ofiere-success)' : readinessPercent > 50 ? 'var(--ofiere-warn)' : 'var(--ofiere-danger)',
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
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex shrink-0 items-center justify-between pt-4 pb-1 bg-background z-10 relative">
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="text-xs h-8 gap-1.5"
                            >
                                {isGenerating ? (
                                    <><Loader2 className="w-3 h-3 animate-spin" /> Generating…</>
                                ) : (
                                    <><Sparkles className="w-3 h-3" /> Auto-Generate</>
                                )}
                            </Button>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleCopyAll} className="text-xs h-8 gap-1">
                                <Copy className="w-3 h-3" />
                                Copy
                            </Button>
                            <Button variant="ghost" size="sm" onClick={handleOpenTaskCardManually} className="text-xs h-8 gap-1">
                                <Sparkles className="w-3 h-3" />
                                Create Task Card
                            </Button>
                            <Button size="sm" onClick={onClose} className="text-xs h-8">
                                Done
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Task Card Modal (opened via Auto-Generate or Create Task Card) */}
            <TaskCardModal
                isOpen={showTaskCard}
                onClose={() => { setShowTaskCard(false); }}
                initialData={generatedTaskData || undefined}
                defaultAgentId={agentId}
                availableAgents={availableAgents}
                onHandoff={handleTaskHandoff}
                mode="create"
            />
        </>
    );
};

export default HandoffPacketModal;
