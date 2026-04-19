'use client';

// AgentDetailDrawer.tsx
// Side drawer for viewing and editing agent properties.
// Tabs: Overview, Doctrine, Files, Build Score, Relationships.

import { useCallback, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Shield, BookOpen, FileText, BarChart3, GitBranch,
    Save, RotateCcw, ChevronDown, ChevronUp, Plus, Trash2, Loader2, Download
} from 'lucide-react';
import { useConstellationStore } from '@/store/useConstellationStore';
import type { AgentArchitecture, BuildScore } from '@/lib/constellation/agentSchema';

// ─── Tab Config ─────────────────────────────────────────────────────────────

const TABS = [
    { id: 'overview' as const, label: 'Overview', icon: Shield },
    { id: 'doctrine' as const, label: 'Doctrine', icon: BookOpen },
    { id: 'files' as const, label: 'Files', icon: FileText },
    { id: 'build' as const, label: 'Build Score', icon: BarChart3 },
    { id: 'relationships' as const, label: 'Relations', icon: GitBranch },
];

const BUILD_SCORE_LABELS: { key: keyof BuildScore; label: string; description: string }[] = [
    { key: 'roleClarity', label: 'Role Clarity', description: 'How well-defined is the role charter?' },
    { key: 'doctrineDepth', label: 'Doctrine Depth', description: 'Frameworks, criteria, anti-patterns present?' },
    { key: 'operationalization', label: 'Operationalization', description: 'Default behavior and routing defined?' },
    { key: 'proceduralCapability', label: 'Procedural Skills', description: 'Playbooks and step-by-step flows?' },
    { key: 'memoryMaturity', label: 'Memory Maturity', description: 'Memory policy and retention rules?' },
    { key: 'characterDistinctness', label: 'Character', description: 'Unique voice, tone, and personality?' },
    { key: 'handoffIntegrity', label: 'Handoff Integrity', description: 'Boundaries and cross-agent routing?' },
];

// ─── Component ──────────────────────────────────────────────────────────────

export function AgentDetailDrawer() {
    const {
        agents,
        selectedAgentId,
        drawerOpen,
        drawerTab,
        isSaving,
        relationships,
        doctrineLoaded,
        doctrineLoadingId,
        closeDrawer,
        setDrawerTab,
        updateAgentField,
        updateAgentFileContent,
        saveAgentFiles,
        loadDoctrine,
        saveDoctrine,
    } = useConstellationStore();

    const agent = selectedAgentId ? agents[selectedAgentId] : null;

    if (!drawerOpen || !agent) return null;

    return (
        <AnimatePresence>
            <motion.div
                key="drawer"
                initial={{ x: 420, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 420, opacity: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-0 right-0 w-[420px] h-full z-40 flex flex-col
                    border-l backdrop-blur-2xl overflow-hidden"
                style={{
                    background: 'rgba(8, 8, 12, 0.95)',
                    borderColor: `${agent.colorHex}20`,
                }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ background: agent.colorHex, boxShadow: `0 0 8px ${agent.colorHex}60` }}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold" style={{ color: agent.colorHex }}>
                                    {agent.name}
                                </span>
                                <span className="text-[9px] font-mono font-bold tracking-[0.2em] text-white/30">
                                    {agent.codename}
                                </span>
                            </div>
                            <span className="text-[10px] font-mono text-white/30">
                                {agent.executiveRole}
                            </span>
                        </div>
                    </div>
                    <button
                        onClick={closeDrawer}
                        className="p-1.5 rounded-sm hover:bg-white/5 text-white/40 hover:text-white/80 transition-colors"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/5 px-2">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setDrawerTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono tracking-wider transition-all relative
                                ${drawerTab === tab.id ? 'text-white/90' : 'text-white/30 hover:text-white/60'}`}
                        >
                            <tab.icon className="size-3" />
                            {tab.label}
                            {drawerTab === tab.id && (
                                <motion.div
                                    layoutId="drawer-tab"
                                    className="absolute bottom-0 left-2 right-2 h-px"
                                    style={{ background: agent.colorHex }}
                                />
                            )}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                    {drawerTab === 'overview' && <OverviewTab agent={agent} onUpdate={updateAgentField} />}
                    {drawerTab === 'doctrine' && (
                        <DoctrineTab
                            agent={agent}
                            onUpdate={updateAgentField}
                            isLoaded={!!doctrineLoaded[agent.id]}
                            isLoading={doctrineLoadingId === agent.id}
                            onLoadDoctrine={() => loadDoctrine(agent.id)}
                            onSaveDoctrine={() => saveDoctrine(agent.id)}
                            isSaving={isSaving}
                        />
                    )}
                    {drawerTab === 'files' && (
                        <FilesTab
                            agent={agent}
                            onContentChange={updateAgentFileContent}
                            onSave={() => saveAgentFiles(agent.id)}
                            isSaving={isSaving}
                        />
                    )}
                    {drawerTab === 'build' && <BuildScoreTab agent={agent} />}
                    {drawerTab === 'relationships' && <RelationshipsTab agent={agent} relationships={relationships} />}
                </div>

            </motion.div>
        </AnimatePresence>
    );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({
    agent,
    onUpdate,
}: {
    agent: AgentArchitecture;
    onUpdate: <K extends keyof AgentArchitecture>(id: string, field: K, value: AgentArchitecture[K]) => void;
}) {
    const rc = agent.roleCharter;
    const b = agent.boundaries;

    // Helper: only render a field if it has content (or is a primary field)
    const conditionalField = (label: string, value: string, onChange: (v: string) => void, primary = false) => {
        if (!primary && !value.trim()) return null;
        return (
            <EditableField
                label={label}
                value={value}
                onChange={onChange}
                multiline
            />
        );
    };

    return (
        <div className="space-y-5">
            {/* Role Charter */}
            <Section title="Role Charter" color={agent.colorHex}>
                {conditionalField('Mission', rc.mission,
                    (v) => onUpdate(agent.id, 'roleCharter', { ...rc, mission: v }), true)}
                {conditionalField('Scope of Responsibility', rc.scopeOfResponsibility,
                    (v) => onUpdate(agent.id, 'roleCharter', { ...rc, scopeOfResponsibility: v }), true)}
                {conditionalField('Why This Role Exists', rc.whyThisRoleExists,
                    (v) => onUpdate(agent.id, 'roleCharter', { ...rc, whyThisRoleExists: v }))}
                {conditionalField('Cost of Weakness', rc.costOfWeakness,
                    (v) => onUpdate(agent.id, 'roleCharter', { ...rc, costOfWeakness: v }))}
            </Section>

            {/* Boundaries — only show lists that have items */}
            <Section title="Boundaries" color={agent.colorHex}>
                {b.owns.length > 0 && (
                    <ListEditor label="Owns (Primary Domain)" items={b.owns} color={agent.colorHex}
                        onChange={(items) => onUpdate(agent.id, 'boundaries', { ...b, owns: items })} />
                )}
                {b.advisesOn.length > 0 && (
                    <ListEditor label="Advises On" items={b.advisesOn} color={agent.colorHex}
                        onChange={(items) => onUpdate(agent.id, 'boundaries', { ...b, advisesOn: items })} />
                )}
                {b.staysOutOf.length > 0 && (
                    <ListEditor label="Stays Out Of" items={b.staysOutOf} color={agent.colorHex}
                        onChange={(items) => onUpdate(agent.id, 'boundaries', { ...b, staysOutOf: items })} />
                )}
                {b.defersTo.length > 0 && (
                    <ListEditor label="Defers To" items={b.defersTo} color={agent.colorHex}
                        onChange={(items) => onUpdate(agent.id, 'boundaries', { ...b, defersTo: items })} />
                )}
                {b.owns.length === 0 && b.advisesOn.length === 0 && b.staysOutOf.length === 0 && b.defersTo.length === 0 && (
                    <p className="text-[10px] font-mono text-white/20 py-2">No boundary data parsed from AGENTS.md</p>
                )}
            </Section>
        </div>
    );
}

// ─── Doctrine Tab ───────────────────────────────────────────────────────────

function DoctrineTab({
    agent,
    onUpdate,
    isLoaded,
    isLoading,
    onLoadDoctrine,
    onSaveDoctrine,
    isSaving,
}: {
    agent: AgentArchitecture;
    onUpdate: <K extends keyof AgentArchitecture>(id: string, field: K, value: AgentArchitecture[K]) => void;
    isLoaded: boolean;
    isLoading: boolean;
    onLoadDoctrine: () => void;
    onSaveDoctrine: () => void;
    isSaving: boolean;
}) {
    // Find doctrine file info for size display
    const doctrineFile = agent.files.find(
        f => f.name === `${agent.codename}.md`
    );
    const fileSizeKb = doctrineFile ? (doctrineFile.size / 1024).toFixed(1) : '0';

    // Auto-load doctrine when the tab is first rendered
    useEffect(() => {
        if (!isLoaded && !isLoading) {
            onLoadDoctrine();
        }
    }, [isLoaded, isLoading, onLoadDoctrine]);

    // Show loading state
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Loader2 className="size-6 animate-spin" style={{ color: agent.colorHex }} />
                <div className="text-center">
                    <p className="text-xs font-mono text-white/50">Loading {agent.codename}.md...</p>
                    <p className="text-[9px] font-mono text-white/25 mt-1">{fileSizeKb}kb doctrine file</p>
                </div>
            </div>
        );
    }

    // Show load button if not yet loaded (shouldn't normally appear due to auto-load)
    if (!isLoaded) {
        return (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <BookOpen className="size-8 text-white/10" />
                <div className="text-center">
                    <p className="text-xs font-mono text-white/50 mb-1">
                        {agent.codename}.md — {fileSizeKb}kb
                    </p>
                    <p className="text-[9px] font-mono text-white/25">
                        Doctrine files are loaded on demand
                    </p>
                </div>
                <button
                    onClick={onLoadDoctrine}
                    className="flex items-center gap-2 px-4 py-2 text-[10px] font-mono font-bold tracking-wider
                        rounded-sm border transition-all duration-300"
                    style={{
                        color: agent.colorHex,
                        borderColor: `${agent.colorHex}30`,
                        background: `${agent.colorHex}08`,
                    }}
                >
                    <Download className="size-3" />
                    LOAD DOCTRINE
                </button>
            </div>
        );
    }

    // Doctrine is loaded — show editable form
    return (
        <div className="space-y-5">
            {/* Save button */}
            <div className="flex items-center justify-between">
                <span className="text-[9px] font-mono text-white/25">
                    {agent.codename}.md — {fileSizeKb}kb
                </span>
                <button
                    onClick={onSaveDoctrine}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider
                        rounded-sm border transition-all disabled:opacity-50"
                    style={{
                        color: agent.colorHex,
                        borderColor: `${agent.colorHex}30`,
                        background: `${agent.colorHex}08`,
                    }}
                >
                    <Save className="size-3" />
                    {isSaving ? 'SAVING...' : 'SAVE TO OPENCLAW'}
                </button>
            </div>

            <Section title={`${agent.codename} Doctrine`} color={agent.colorHex}>
                <EditableField
                    label="Mission"
                    value={agent.doctrine.mission}
                    onChange={(v) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, mission: v })}
                    multiline
                />
                <ListEditor label="Decision Frameworks" items={agent.doctrine.decisionFrameworks} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, decisionFrameworks: items })} />
                <ListEditor label="Non-Goals" items={agent.doctrine.nonGoals} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, nonGoals: items })} />
                <ListEditor label="Evaluation Criteria" items={agent.doctrine.evaluationCriteria} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, evaluationCriteria: items })} />
                <ListEditor label="Metrics" items={agent.doctrine.metrics} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, metrics: items })} />
                <ListEditor label="Standard Deliverables" items={agent.doctrine.standardDeliverables} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, standardDeliverables: items })} />
                <ListEditor label="Anti-Patterns" items={agent.doctrine.antiPatterns} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, antiPatterns: items })} />
                <ListEditor label="Handoff Rules" items={agent.doctrine.handoffRules} color={agent.colorHex}
                    onChange={(items) => onUpdate(agent.id, 'doctrine', { ...agent.doctrine, handoffRules: items })} />
            </Section>
        </div>
    );
}

// ─── Files Tab ──────────────────────────────────────────────────────────────

function FilesTab({
    agent,
    onContentChange,
    onSave,
    isSaving,
}: {
    agent: AgentArchitecture;
    onContentChange: (agentId: string, fileName: string, content: string) => void;
    onSave: () => void;
    isSaving: boolean;
}) {
    const [expandedFile, setExpandedFile] = useState<string | null>(null);

    const mdFiles = agent.files.filter(f => f.name.endsWith('.md'));
    const hasDirty = mdFiles.some(f => f.isDirty);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-white/30">
                    {mdFiles.length} markdown files
                </span>
                {hasDirty && (
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-mono font-bold tracking-wider
                            rounded-sm border bg-[#FF6D29]/10 border-[#FF6D29]/30 text-[#FF6D29]
                            hover:bg-[#FF6D29]/20 transition-all disabled:opacity-50"
                    >
                        <Save className="size-3" />
                        {isSaving ? 'SAVING...' : 'SAVE'}
                    </button>
                )}
            </div>

            {mdFiles.map(file => (
                <div
                    key={file.name}
                    className="rounded-sm border border-white/5 overflow-hidden"
                >
                    <button
                        onClick={() => setExpandedFile(expandedFile === file.name ? null : file.name)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-white/3 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="size-3 text-white/30" />
                            <span className="text-xs font-mono text-white/70">{file.name}</span>
                            {file.isDirty && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60" />
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-white/20">
                                {file.size > 0 ? `${(file.size / 1024).toFixed(1)}kb` : 'empty'}
                            </span>
                            {expandedFile === file.name
                                ? <ChevronUp className="size-3 text-white/30" />
                                : <ChevronDown className="size-3 text-white/30" />
                            }
                        </div>
                    </button>

                    {expandedFile === file.name && (
                        <div className="border-t border-white/5">
                            <textarea
                                value={file.draftContent ?? file.content}
                                onChange={(e) => onContentChange(agent.id, file.name, e.target.value)}
                                className="w-full min-h-[200px] p-3 bg-transparent text-xs font-mono text-white/70 resize-y
                                    focus:outline-none focus:text-white/90 placeholder:text-white/15"
                                placeholder="Empty file..."
                                spellCheck={false}
                            />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

// ─── Build Score Tab ────────────────────────────────────────────────────────

function BuildScoreTab({ agent }: { agent: AgentArchitecture }) {
    const total = Object.values(agent.buildScore).reduce((a, b) => a + b, 0);
    const max = BUILD_SCORE_LABELS.length * 5;
    const pct = Math.round((total / max) * 100);

    return (
        <div className="space-y-4">
            {/* Overall */}
            <div className="p-4 rounded-sm border border-white/5 bg-white/[0.02]">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono font-bold text-white/70">Overall Build Score</span>
                    <span className="text-lg font-mono font-bold" style={{ color: agent.colorHex }}>
                        {pct}%
                    </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: agent.colorHex, opacity: 0.7 }}
                    />
                </div>
                <p className="text-[9px] font-mono text-white/25 mt-1.5">
                    {total}/{max} points across {BUILD_SCORE_LABELS.length} categories
                </p>
            </div>

            {/* Per-category */}
            {BUILD_SCORE_LABELS.map(({ key, label, description }) => {
                const val = agent.buildScore[key];
                return (
                    <div key={key} className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-mono text-white/60">{label}</span>
                                <p className="text-[9px] font-mono text-white/20">{description}</p>
                            </div>
                            <span className="text-xs font-mono font-bold" style={{ color: val >= 3 ? agent.colorHex : 'rgba(255,255,255,0.3)' }}>
                                {val}/5
                            </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-500"
                                style={{
                                    width: `${(val / 5) * 100}%`,
                                    background: val >= 3 ? agent.colorHex : 'rgba(255,255,255,0.15)',
                                    opacity: val > 0 ? 0.7 : 0,
                                }}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// ─── Relationships Tab ──────────────────────────────────────────────────────

function RelationshipsTab({
    agent,
    relationships,
}: {
    agent: AgentArchitecture;
    relationships: { id: string; sourceAgentId: string; targetAgentId: string; type: string; label: string }[];
}) {
    const agentRels = relationships.filter(
        r => r.sourceAgentId === agent.id || r.targetAgentId === agent.id
    );

    const typeColors: Record<string, string> = {
        delegation: '#f97316',
        collaboration: '#22d3ee',
        handoff: '#a78bfa',
        advisory: '#64748b',
    };

    return (
        <div className="space-y-3">
            <p className="text-[10px] font-mono text-white/30 mb-2">
                {agentRels.length} relationship{agentRels.length !== 1 ? 's' : ''}
            </p>

            {agentRels.map(rel => {
                const isSource = rel.sourceAgentId === agent.id;
                const otherAgent = isSource ? rel.targetAgentId : rel.sourceAgentId;
                const direction = isSource ? '→' : '←';
                const color = typeColors[rel.type] || '#64748b';

                return (
                    <div
                        key={rel.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-sm border border-white/5 bg-white/[0.02]"
                    >
                        <span
                            className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm"
                            style={{ color, background: `${color}15`, border: `1px solid ${color}25` }}
                        >
                            {rel.type}
                        </span>
                        <span className="text-xs font-mono text-white/50">
                            {agent.name} {direction}{' '}
                            <span className="text-white/70 capitalize">{otherAgent}</span>
                        </span>
                        <span className="flex-1 text-[9px] font-mono text-white/25 text-right truncate">
                            {rel.label}
                        </span>
                    </div>
                );
            })}

            {agentRels.length === 0 && (
                <div className="text-center py-8 text-xs font-mono text-white/20">
                    No relationships defined yet
                </div>
            )}
        </div>
    );
}

// ─── Reusable: Section ──────────────────────────────────────────────────────

function Section({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 rounded-full" style={{ background: color }} />
                <span className="text-xs font-mono font-bold text-white/70 tracking-wider">{title}</span>
            </div>
            <div className="space-y-3 pl-3 border-l border-white/5">{children}</div>
        </div>
    );
}

// ─── Reusable: EditableField ────────────────────────────────────────────────

function EditableField({
    label,
    value,
    onChange,
    multiline = false,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    multiline?: boolean;
}) {
    return (
        <div>
            <label className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{label}</label>
            {multiline ? (
                <textarea
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={3}
                    className="w-full mt-1 px-2.5 py-2 rounded-sm border border-white/5 bg-white/[0.02]
                        text-xs font-mono text-white/70 resize-y
                        focus:outline-none focus:border-white/15 focus:text-white/90
                        placeholder:text-white/15 transition-colors"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                />
            ) : (
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 rounded-sm border border-white/5 bg-white/[0.02]
                        text-xs font-mono text-white/70
                        focus:outline-none focus:border-white/15 focus:text-white/90
                        placeholder:text-white/15 transition-colors"
                    placeholder={`Enter ${label.toLowerCase()}...`}
                />
            )}
        </div>
    );
}

// ─── Reusable: ListEditor ───────────────────────────────────────────────────

function ListEditor({
    label,
    items,
    color,
    onChange,
}: {
    label: string;
    items: string[];
    color: string;
    onChange: (items: string[]) => void;
}) {
    const [newItem, setNewItem] = useState('');

    const handleAdd = () => {
        if (newItem.trim()) {
            onChange([...items, newItem.trim()]);
            setNewItem('');
        }
    };

    const handleRemove = (index: number) => {
        onChange(items.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAdd();
        }
    };

    return (
        <div>
            <label className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{label}</label>
            <div className="mt-1 space-y-1">
                {items.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 group">
                        <span
                            className="flex-1 text-[11px] font-mono px-2 py-1 rounded-sm border"
                            style={{ color: `${color}cc`, borderColor: `${color}15`, background: `${color}05` }}
                        >
                            {item}
                        </span>
                        <button
                            onClick={() => handleRemove(i)}
                            className="opacity-0 group-hover:opacity-100 p-0.5 text-red-400/50 hover:text-red-400 transition-all"
                        >
                            <Trash2 className="size-3" />
                        </button>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <input
                        type="text"
                        value={newItem}
                        onChange={(e) => setNewItem(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="flex-1 px-2 py-1 rounded-sm border border-white/5 bg-transparent
                            text-[11px] font-mono text-white/50 focus:outline-none focus:border-white/15
                            placeholder:text-white/15"
                        placeholder="Add item..."
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newItem.trim()}
                        className="p-1 text-white/20 hover:text-white/60 transition-colors disabled:opacity-30"
                    >
                        <Plus className="size-3" />
                    </button>
                </div>
            </div>
        </div>
    );
}
