'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, Eye, Brain, MessageCircle, Globe, Flame, Sparkles, Terminal,
    ChevronDown, ChevronRight, Maximize2, Save, Loader2, RotateCcw, Heart,
    CheckCircle2, RefreshCw, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCompanionProfileStore, type CompanionSections, EMPTY_SECTIONS } from '@/stores/useCompanionProfileStore';
import { ExpandedEditor } from './ExpandedEditor';

// ─── Section Definitions ────────────────────────────────────────────────────

interface SectionField {
    key: string;
    label: string;
    placeholder: string;
    rows?: number;
}

interface SectionDef {
    key: keyof CompanionSections;
    label: string;
    icon: React.ElementType;
    iconColor: string;
    fields: SectionField[];
}

const SECTION_DEFS: SectionDef[] = [
    {
        key: 'concept_backstory',
        label: 'Concept & Backstory',
        icon: BookOpen,
        iconColor: 'text-amber-400',
        fields: [
            { key: 'core_wound', label: 'Core Wound / Motivation', placeholder: 'What drives this character? Their deepest wound, obsession, or unfulfilled need...', rows: 3 },
            { key: 'motivation', label: 'Driving Goal', placeholder: 'What are they actively pursuing? Their conscious mission or purpose...', rows: 2 },
            { key: 'life_story', label: 'Life Story / Backstory', placeholder: 'Key events, traumas, victories that shaped who they are today...', rows: 5 },
            { key: 'growth_arc', label: 'Growth Arc Potential', placeholder: 'How can this character evolve? What would change them?', rows: 3 },
        ],
    },
    {
        key: 'appearance',
        label: 'Appearance & Physicality',
        icon: Eye,
        iconColor: 'text-cyan-400',
        fields: [
            { key: 'physical', label: 'Physical Description', placeholder: 'Height, build, hair, eyes, distinguishing features, body language...', rows: 4 },
            { key: 'clothing', label: 'Clothing & Outfits', placeholder: 'Default outfit, style preferences, accessories...', rows: 3 },
            { key: 'sensory', label: 'Sensory Details', placeholder: 'Scent, texture of skin/hair, warmth, voice quality...', rows: 3 },
        ],
    },
    {
        key: 'personality',
        label: 'Personality & Psychology',
        icon: Brain,
        iconColor: 'text-violet-400',
        fields: [
            { key: 'big_five', label: 'Big Five Traits', placeholder: 'Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism...', rows: 3 },
            { key: 'contradictions', label: 'Contradictions', placeholder: 'Internal paradoxes — e.g., acts cold but craves connection...', rows: 3 },
            { key: 'triggers', label: 'Triggers & Reactions', placeholder: 'What makes them angry, sad, defensive? How do they express it?', rows: 3 },
            { key: 'flaws', label: 'Flaws & Vulnerabilities', placeholder: 'Real weaknesses, blind spots, toxic traits...', rows: 3 },
        ],
    },
    {
        key: 'speech_patterns',
        label: 'Speech Patterns & Mannerisms',
        icon: MessageCircle,
        iconColor: 'text-green-400',
        fields: [
            { key: 'quirks', label: 'Voice & Quirks', placeholder: 'Vocabulary, slang, speech rhythm, catchphrases...', rows: 3 },
            { key: 'mannerisms', label: 'Mannerisms', placeholder: 'Gestures, habits, tics, how they move in space...', rows: 3 },
            { key: 'example_dialogue', label: 'Example Dialogue (Ali:Chat)', placeholder: '{{char}}: *leans against the wall, arms folded* "You really don\'t get it, do you?"', rows: 5 },
        ],
    },
    {
        key: 'scenario_world',
        label: 'Scenario & World',
        icon: Globe,
        iconColor: 'text-blue-400',
        fields: [
            { key: 'scenario', label: 'Scenario Context', placeholder: 'The opening scene or situation. Where are they? What just happened?', rows: 4 },
            { key: 'world_info', label: 'World Info / Lorebook', placeholder: 'Key lore, rules, factions, locations relevant to this character\'s world...', rows: 4 },
            { key: 'user_dynamics', label: 'User Dynamics', placeholder: 'How does {{char}} perceive {{user}}? Relationship, power dynamic, history...', rows: 3 },
        ],
    },
    {
        key: 'nsfw_layer',
        label: 'Intimate / Explicit Layer',
        icon: Flame,
        iconColor: 'text-rose-400',
        fields: [
            { key: 'preferences', label: 'Preferences', placeholder: 'What they enjoy, how they behave in intimate scenarios...', rows: 3 },
            { key: 'boundaries', label: 'Boundaries & Consent', placeholder: 'Hard limits, consent dynamics, things they would never do...', rows: 3 },
            { key: 'physical_reactions', label: 'Physical Reactions', placeholder: 'How their body responds — breathing, tension, involuntary reactions...', rows: 3 },
            { key: 'emotional_tie', label: 'Emotional Tie-In', placeholder: 'How intimacy connects to their emotional state and character arc...', rows: 3 },
        ],
    },
    {
        key: 'advanced',
        label: 'Advanced Human Touches',
        icon: Sparkles,
        iconColor: 'text-pink-400',
        fields: [
            { key: 'internal_conflict', label: 'Internal Conflict', placeholder: 'Ongoing dilemmas, moral questions they wrestle with...', rows: 3 },
            { key: 'sensory_rp', label: 'Sensory RP', placeholder: 'How they experience the world — textures, temperatures, sounds that ground them...', rows: 3 },
            { key: 'evolution_notes', label: 'Evolution Notes', placeholder: 'How the character should grow or change over the course of RP...', rows: 3 },
            { key: 'randomness', label: 'Randomness & Quirks', placeholder: 'Unpredictable behaviors, weird habits, things they do for no reason...', rows: 3 },
        ],
    },
    {
        key: 'system_greeting',
        label: 'System & Greeting',
        icon: Terminal,
        iconColor: 'text-emerald-400',
        fields: [
            { key: 'system_prompt', label: 'System Prompt Override', placeholder: 'Custom system-level instructions that override default behavior...', rows: 5 },
            { key: 'first_message', label: 'First Message / Greeting', placeholder: 'The opening message when this character enters a new conversation...', rows: 5 },
            { key: 'creator_notes', label: 'Creator Notes', placeholder: 'Private notes about design decisions, intended behavior, version history...', rows: 3 },
        ],
    },
];

// ─── Component ──────────────────────────────────────────────────────────────

interface CompanionEditorProps {
    agentId: string;
    agentName?: string;
}

export function CompanionEditor({ agentId, agentName }: CompanionEditorProps) {
    const {
        loadProfile,
        saveProfile,
        syncFromAgent,
        updateField,
        isDirty,
        getDraft,
        isLoading: loadingMap,
        isSaving: savingMap,
        errors: errorMap,
    } = useCompanionProfileStore();

    const isLoading = loadingMap[agentId] ?? false;
    const isSaving = savingMap[agentId] ?? false;
    const error = errorMap[agentId] ?? null;
    const dirty = isDirty(agentId);
    const draft = getDraft(agentId);

    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
    const [expandedField, setExpandedField] = useState<{ sectionKey: string; fieldKey: string; label: string } | null>(null);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncSuccess, setSyncSuccess] = useState(false);
    const [showOverwriteConfirm, setShowOverwriteConfirm] = useState(false);

    // Load profile on mount
    useEffect(() => {
        loadProfile(agentId);
    }, [agentId, loadProfile]);

    const toggleSection = useCallback((key: string) => {
        setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);

    const handleSave = async () => {
        await saveProfile(agentId, agentName);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
    };

    const profileHasContent = (): boolean => {
        if (!draft) return false;
        for (const sectionKey of Object.keys(draft) as (keyof typeof draft)[]) {
            const section = draft[sectionKey] as Record<string, string>;
            for (const val of Object.values(section)) {
                if (val && val.trim().length > 0) return true;
            }
        }
        return false;
    };

    const handleSyncFromAgent = () => {
        if (profileHasContent()) {
            setShowOverwriteConfirm(true);
            return;
        }
        executeSyncFromAgent();
    };

    const executeSyncFromAgent = async () => {
        setShowOverwriteConfirm(false);
        setIsSyncing(true);
        const ok = await syncFromAgent(agentId);
        setIsSyncing(false);
        if (ok) {
            setSyncSuccess(true);
            setTimeout(() => setSyncSuccess(false), 2500);
        }
    };

    const handleExpandField = (sectionKey: string, fieldKey: string, label: string) => {
        setExpandedField({ sectionKey, fieldKey, label });
    };

    const sectionHasContent = (sectionKey: keyof CompanionSections): boolean => {
        const section = draft[sectionKey] as Record<string, string>;
        return Object.values(section).some(v => v && v.trim().length > 0);
    };

    const getFieldPreview = (sectionKey: keyof CompanionSections): string => {
        const section = draft[sectionKey] as Record<string, string>;
        const firstNonEmpty = Object.values(section).find(v => v && v.trim().length > 0);
        if (!firstNonEmpty) return 'Empty — click to expand';
        return firstNonEmpty.slice(0, 80) + (firstNonEmpty.length > 80 ? '…' : '');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="size-5 text-pink-400/60 animate-spin" />
                <span className="ml-2 text-xs font-mono text-white/40">Loading companion profile…</span>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3 rounded-md border border-white/10 bg-white/[0.02] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-sm bg-pink-500/15 border border-pink-500/20">
                        <Heart className="size-4 text-pink-400 fill-pink-400/30" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-white/90">COMPANION.md</h3>
                        <p className="text-[10px] font-mono text-white/35 mt-0.5">
                            Structured character profile — Stored in Ofiere
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {dirty && (
                        <span className="text-[10px] font-mono text-amber-400/70">Unsaved changes</span>
                    )}
                    <button
                        onClick={handleSyncFromAgent}
                        disabled={isSyncing}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono transition-all
                            bg-violet-500/10 text-violet-400/80 border border-violet-500/20 hover:bg-violet-500/20 hover:text-violet-300"
                        title="Auto-fill from agent's OpenClaw persona files (SOUL.md, IDENTITY.md, etc.)"
                    >
                        {isSyncing ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : syncSuccess ? (
                            <CheckCircle2 className="size-3 text-emerald-400" />
                        ) : (
                            <RefreshCw className="size-3" />
                        )}
                        {isSyncing ? 'Syncing…' : syncSuccess ? 'Synced' : 'Sync from Agent'}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!dirty || isSaving}
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-mono transition-all",
                            dirty
                                ? "bg-pink-500/15 text-pink-400 border border-pink-500/30 hover:bg-pink-500/25"
                                : "bg-white/5 text-white/30 border border-white/10 cursor-not-allowed"
                        )}
                    >
                        {isSaving ? (
                            <Loader2 className="size-3 animate-spin" />
                        ) : saveSuccess ? (
                            <CheckCircle2 className="size-3 text-emerald-400" />
                        ) : (
                            <Save className="size-3" />
                        )}
                        {isSaving ? 'Saving…' : saveSuccess ? 'Saved' : 'Save'}
                    </button>
                </div>
            </div>

            {/* Overwrite Confirmation Dialog */}
            {showOverwriteConfirm && (
                <div className="mx-4 px-4 py-3 rounded-md border border-amber-500/30 bg-amber-500/5 backdrop-blur-sm">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle className="size-4 text-amber-400 mt-0.5 shrink-0" />
                        <div className="flex-1">
                            <p className="text-xs font-semibold text-amber-300/90 mb-1">Overwrite Companion Profile?</p>
                            <p className="text-[11px] text-white/50 leading-relaxed">
                                Syncing from agent will <span className="text-amber-400/80 font-medium">overwrite all existing companion data</span> with
                                content mapped from the agent's OpenClaw files (SOUL.md, IDENTITY.md, AGENTS.md, etc.).
                                This action cannot be undone.
                            </p>
                            <div className="flex items-center gap-2 mt-2.5">
                                <button
                                    onClick={executeSyncFromAgent}
                                    className="px-3 py-1 rounded-sm text-[11px] font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all"
                                >
                                    Yes, overwrite
                                </button>
                                <button
                                    onClick={() => setShowOverwriteConfirm(false)}
                                    className="px-3 py-1 rounded-sm text-[11px] font-mono bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-all"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="mx-4 px-3 py-2 rounded-sm border border-red-500/20 bg-red-500/5 text-xs font-mono text-red-400/80">
                    {error}
                </div>
            )}

            {/* Sections */}
            <div className="px-4 pb-4 space-y-2">
                {SECTION_DEFS.map((section) => {
                    const isOpen = expandedSections[section.key] ?? false;
                    const hasContent = sectionHasContent(section.key);
                    const Icon = section.icon;

                    return (
                        <div
                            key={section.key}
                            className={cn(
                                "rounded-sm border transition-all",
                                isOpen
                                    ? "border-white/15 bg-white/[0.03]"
                                    : "border-white/8 bg-transparent hover:border-white/12"
                            )}
                        >
                            {/* Section Header */}
                            <button
                                onClick={() => toggleSection(section.key)}
                                className="w-full flex items-center gap-3 px-3 py-2.5 text-left group"
                            >
                                {isOpen ? (
                                    <ChevronDown className="size-3.5 text-white/40 shrink-0" />
                                ) : (
                                    <ChevronRight className="size-3.5 text-white/30 shrink-0 group-hover:text-white/40" />
                                )}
                                <Icon className={cn("size-3.5 shrink-0", section.iconColor)} />
                                <span className="text-xs font-medium text-white/80 flex-1">{section.label}</span>

                                {/* Content indicator dot */}
                                {hasContent && (
                                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", section.iconColor.replace('text-', 'bg-'))} />
                                )}
                                {!isOpen && (
                                    <span className="text-[10px] font-mono text-white/20 max-w-[200px] truncate">
                                        {getFieldPreview(section.key)}
                                    </span>
                                )}
                            </button>

                            {/* Section Content */}
                            <AnimatePresence>
                                {isOpen && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="px-3 pb-3 space-y-3 border-t border-white/5 pt-3">
                                            {section.fields.map((field) => {
                                                const value = (draft[section.key] as Record<string, string>)[field.key] || '';
                                                return (
                                                    <div key={field.key} className="space-y-1">
                                                        <div className="flex items-center justify-between">
                                                            <label className="text-[11px] font-mono font-medium text-white/50">
                                                                {field.label}
                                                            </label>
                                                            <button
                                                                onClick={() => handleExpandField(section.key, field.key, field.label)}
                                                                className="flex items-center gap-1 text-[10px] font-mono text-white/25 hover:text-white/50 transition-colors"
                                                                title="Open in expanded editor"
                                                            >
                                                                <Maximize2 className="size-2.5" />
                                                                Expand
                                                            </button>
                                                        </div>
                                                        <textarea
                                                            value={value}
                                                            onChange={(e) => updateField(agentId, section.key, field.key, e.target.value)}
                                                            placeholder={field.placeholder}
                                                            rows={field.rows || 3}
                                                            className="w-full bg-black/20 border border-white/8 rounded-sm px-3 py-2
                                                                text-xs font-mono text-white/80 placeholder:text-white/15
                                                                focus:outline-none focus:border-pink-500/30 focus:ring-1 focus:ring-pink-500/10
                                                                resize-none transition-all"
                                                        />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    );
                })}
            </div>

            {/* Footer */}
            <div className="px-4 pb-3">
                <div className="flex items-start gap-2 rounded-sm border border-pink-500/15 bg-pink-500/5 px-3 py-2">
                    <Heart className="size-3 shrink-0 text-pink-400/50 mt-0.5" />
                    <p className="text-[10px] font-mono text-pink-400/50 leading-relaxed">
                        Companion profiles are stored in your Ofiere dashboard (Supabase).
                        When companion mode is active, this profile replaces all OpenClaw agent files.
                    </p>
                </div>
            </div>

            {/* Expanded Editor Modal */}
            {expandedField && (
                <ExpandedEditorWrapper
                    agentId={agentId}
                    sectionKey={expandedField.sectionKey as keyof CompanionSections}
                    fieldKey={expandedField.fieldKey}
                    fieldLabel={expandedField.label}
                    onClose={() => setExpandedField(null)}
                />
            )}
        </div>
    );
}

// ─── Expanded Editor Wrapper ────────────────────────────────────────────────
// Bridges the CompanionEditor field to the existing ExpandedEditor component

function ExpandedEditorWrapper({
    agentId,
    sectionKey,
    fieldKey,
    fieldLabel,
    onClose,
}: {
    agentId: string;
    sectionKey: keyof CompanionSections;
    fieldKey: string;
    fieldLabel: string;
    onClose: () => void;
}) {
    const { getDraft, updateField } = useCompanionProfileStore();
    const draft = getDraft(agentId);
    const value = (draft[sectionKey] as Record<string, string>)[fieldKey] || '';

    const handleConfirm = (newContent: string) => {
        updateField(agentId, sectionKey, fieldKey, newContent);
        onClose();
    };

    return (
        <ExpandedEditor
            fileName={`COMPANION.md — ${fieldLabel}`}
            filePath={null}
            initialContent={value}
            onConfirm={handleConfirm}
            onCancel={onClose}
        />
    );
}
