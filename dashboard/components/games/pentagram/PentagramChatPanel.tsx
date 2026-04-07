"use client";

import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import { usePentagramChatStore, type ChatMessage, type SamplingParams } from "@/stores/usePentagramChatStore";
import { usePentagramStore } from "@/stores/usePentagramStore";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
    MessageSquare, X, Send, Trash2, Save, FolderOpen,
    Settings2, Loader2, Eye, EyeOff, ChevronLeft,
    RotateCcw, Image as ImageIcon, Palette
} from "lucide-react";

// ─── Smart Text Formatter ────────────────────────────────────────────────────
// Converts raw model output (often line-per-phrase) into properly formatted
// paragraphs with inline action tags.

function formatCompanionText(raw: string): string {
    if (!raw) return raw;
    
    const lines = raw.split('\n');
    const result: string[] = [];
    let currentParagraph: string[] = [];

    const flushParagraph = () => {
        if (currentParagraph.length > 0) {
            result.push(currentParagraph.join(' '));
            currentParagraph = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Empty line = paragraph break
        if (!line) {
            flushParagraph();
            continue;
        }

        // If line is ONLY an action/emote (surrounded by * or _), keep as its own inline element
        // but merge it into the current paragraph flow
        const isActionOnly = /^\*[^*]+\*$/.test(line) || /^_[^_]+_$/.test(line);
        
        // Check if next line is also very short — indicates choppy formatting from model
        const nextLine = i + 1 < lines.length ? lines[i + 1]?.trim() : '';
        const isShortLine = line.length < 80;
        const isNextShortLine = nextLine && nextLine.length < 80 && nextLine !== '';
        
        // If this is a dialogue line (starts with quote), or an action line, or a short
        // continuation, merge into the current paragraph
        if (isShortLine && (isActionOnly || isNextShortLine || currentParagraph.length > 0)) {
            currentParagraph.push(line);
        } else if (line.startsWith('#') || line.startsWith('---') || line.startsWith('```')) {
            // Structural elements — keep separate
            flushParagraph();
            result.push(line);
        } else {
            // Normal text line
            currentParagraph.push(line);
        }
    }
    
    flushParagraph();
    return result.join('\n\n');
}

// ─── Simple Markdown Renderer ────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode {
    // First, reformat the text to fix choppy line-per-phrase output
    const formatted = formatCompanionText(text);
    
    // Split into paragraphs (double newline)
    const paragraphs = formatted.split(/\n\n+/);
    const elements: React.ReactNode[] = [];

    paragraphs.forEach((para, pIdx) => {
        const lines = para.split('\n');
        const lineElements: React.ReactNode[] = [];

        lines.forEach((line, i) => {
            // Process inline formatting
            const parts: React.ReactNode[] = [];
            let lastIndex = 0;
            
            // Use regex to find formatting patterns
            const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|__(.+?)__|_(.+?)_)/g;
            let match;

            while ((match = regex.exec(line)) !== null) {
                if (match.index > lastIndex) {
                    parts.push(line.slice(lastIndex, match.index));
                }

                if (match[2]) {
                    parts.push(<strong key={`${pIdx}-${i}-${match.index}`}><em>{match[2]}</em></strong>);
                } else if (match[3]) {
                    parts.push(<strong key={`${pIdx}-${i}-${match.index}`} className="font-bold text-white">{match[3]}</strong>);
                } else if (match[4]) {
                    parts.push(<em key={`${pIdx}-${i}-${match.index}`} className="italic text-white/60">{match[4]}</em>);
                } else if (match[5]) {
                    parts.push(<code key={`${pIdx}-${i}-${match.index}`} className="px-1 py-0.5 bg-white/10 rounded text-[11px] font-mono text-emerald-300">{match[5]}</code>);
                } else if (match[6]) {
                    parts.push(<strong key={`${pIdx}-${i}-${match.index}`} className="font-bold text-white">{match[6]}</strong>);
                } else if (match[7]) {
                    parts.push(<em key={`${pIdx}-${i}-${match.index}`} className="italic text-white/60">{match[7]}</em>);
                }

                lastIndex = match.index + match[0].length;
            }

            if (lastIndex < line.length) {
                parts.push(line.slice(lastIndex));
            }

            if (parts.length === 0) {
                parts.push(line);
            }

            lineElements.push(
                <span key={`${pIdx}-${i}`}>
                    {parts}
                    {i < lines.length - 1 && ' '}
                </span>
            );
        });

        elements.push(
            <p key={pIdx} className={pIdx > 0 ? "mt-2" : ""}>
                {lineElements}
            </p>
        );
    });

    return <>{elements}</>;
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────

const ChatBubble = memo(function ChatBubble({ message, agentName, agentColor, animate = true }: {
    message: ChatMessage;
    agentName: string;
    agentColor: string;
    animate?: boolean;
}) {
    const isUser = message.role === 'user';
    const isSystem = message.role === 'system';

    // System messages (errors, status)
    if (isSystem) {
        return (
            <div className="flex mb-2 justify-center">
                <div className="max-w-[90%] rounded-xl px-3 py-1.5 text-[11px] leading-[1.4] bg-amber-500/10 border border-amber-500/20 text-amber-300/80 text-center backdrop-blur-sm">
                    {message.content}
                </div>
            </div>
        );
    }

    // Non-animated bubble (for older messages loaded from history)
    if (!animate) {
        return (
            <div className={cn("flex mb-2.5", isUser ? "justify-end" : "justify-start")}>
                <div
                    className={cn(
                        "max-w-[95%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.55] backdrop-blur-sm",
                        isUser
                            ? "bg-black/60 backdrop-blur-md text-white/90 rounded-br-md border border-white/[0.06]"
                            : "bg-black/70 backdrop-blur-md text-white/85 rounded-bl-md border"
                    )}
                    style={!isUser ? { borderColor: `${agentColor}25` } : undefined}
                >
                    {!isUser && (
                        <span
                            className="text-[9px] font-black uppercase tracking-[0.15em] block mb-0.5"
                            style={{ color: agentColor }}
                        >
                            {agentName}
                        </span>
                    )}
                    <div>{renderMarkdown(message.content)}</div>
                    <span className={cn(
                        "text-[8px] mt-0.5 block font-mono",
                        isUser ? "text-white/20 text-right" : "text-white/15"
                    )}>
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                </div>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 6, x: isUser ? 8 : -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            transition={{ duration: 0.25 }}
            className={cn("flex mb-2.5", isUser ? "justify-end" : "justify-start")}
        >
            <div
                className={cn(
                    "max-w-[95%] rounded-2xl px-3.5 py-2 text-[13px] leading-[1.55] backdrop-blur-sm",
                    isUser
                        ? "bg-black/60 backdrop-blur-md text-white/90 rounded-br-md border border-white/[0.06]"
                        : "bg-black/70 backdrop-blur-md text-white/85 rounded-bl-md border"
                )}
                style={!isUser ? { borderColor: `${agentColor}25` } : undefined}
            >
                {!isUser && (
                    <span
                        className="text-[9px] font-black uppercase tracking-[0.15em] block mb-0.5"
                        style={{ color: agentColor }}
                    >
                        {agentName}
                    </span>
                )}
                <div>{renderMarkdown(message.content)}</div>
                <span className={cn(
                    "text-[8px] mt-0.5 block font-mono",
                    isUser ? "text-white/20 text-right" : "text-white/15"
                )}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
            </div>
        </motion.div>
    );
}, (prev, next) => {
    // Custom comparator — only re-render if the message content changes
    return prev.message.id === next.message.id 
        && prev.message.content === next.message.content
        && prev.agentColor === next.agentColor;
});

// ─── Streaming Bubble ────────────────────────────────────────────────────────

function StreamingBubble({ content, agentName, agentColor }: {
    content: string;
    agentName: string;
    agentColor: string;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 6, x: -8 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            className="flex mb-2.5 justify-start"
        >
            <div
                className="max-w-[95%] rounded-2xl rounded-bl-md px-3.5 py-2 text-[13px] leading-[1.55] bg-black/70 backdrop-blur-md border"
                style={{ borderColor: `${agentColor}25` }}
            >
                <span
                    className="text-[9px] font-black uppercase tracking-[0.15em] block mb-0.5"
                    style={{ color: agentColor }}
                >
                    {agentName}
                </span>
                <div className="text-white/85">{content ? renderMarkdown(content) : '...'}</div>
                <span className="flex items-center gap-1 text-[8px] text-white/15 mt-0.5 font-mono">
                    <Loader2 className="w-2 h-2 animate-spin" /> typing
                </span>
            </div>
        </motion.div>
    );
}

// ─── Sampling Parameter Slider ───────────────────────────────────────────────

function ParamSlider({ label, paramKey, value, min, max, step, description }: {
    label: string;
    paramKey: keyof SamplingParams;
    value: number;
    min: number;
    max: number;
    step: number;
    description?: string;
}) {
    const updateParam = usePentagramChatStore(s => s.updateSamplingParam);

    return (
        <div className="mb-3">
            <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] uppercase tracking-wider text-white/50 font-mono">{label}</span>
                <span className="text-[10px] font-mono text-white/40">{value}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={(e) => updateParam(paramKey, parseFloat(e.target.value))}
                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-cyan-500"
            />
            {description && (
                <span className="text-[8px] text-white/25 mt-0.5 block">{description}</span>
            )}
        </div>
    );
}

// ─── Settings Overlay ────────────────────────────────────────────────────────

function SettingsOverlay({ onClose }: { onClose: () => void }) {
    const gossipFrequency = usePentagramChatStore(s => s.gossipFrequency);
    const setGossipFrequency = usePentagramChatStore(s => s.setGossipFrequency);
    const characters = usePentagramChatStore(s => s.characters);
    const toggleVis = usePentagramChatStore(s => s.toggleCharacterVisibility);
    const samplingParams = usePentagramChatStore(s => s.samplingParams);
    const resetSampling = usePentagramChatStore(s => s.resetSamplingParams);
    const activeCharacterId = usePentagramChatStore(s => s.activeCharacterId);
    const characterAssets = usePentagramChatStore(s => s.characterAssets);
    const setCharacterAsset = usePentagramChatStore(s => s.setCharacterAsset);
    const clearCharacterAsset = usePentagramChatStore(s => s.clearCharacterAsset);

    const [tab, setTab] = useState<'model' | 'characters' | 'assets'>('model');

    const labels: Record<string, string> = {
        '0.1': 'Subtle',
        '0.2': 'Cautious',
        '0.4': 'Active',
        '0.6': 'Chatty',
        '0.8': 'Chaotic',
        '1.0': 'Omniscient',
    };

    const closest = Object.keys(labels).reduce((prev, curr) =>
        Math.abs(parseFloat(curr) - gossipFrequency) < Math.abs(parseFloat(prev) - gossipFrequency) ? curr : prev
    );

    const activeAssets = activeCharacterId ? (characterAssets[activeCharacterId] || {}) : {};
    const activeChar = characters.find(c => c.id === activeCharacterId);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-md rounded-2xl p-4 flex flex-col overflow-hidden"
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Settings</h3>
                <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3">
                {(['model', 'characters', 'assets'] as const).map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={cn(
                            "px-2.5 py-1 rounded-md text-[9px] uppercase tracking-wider font-bold transition-all",
                            tab === t
                                ? "bg-white/10 text-white/80"
                                : "text-white/25 hover:text-white/50"
                        )}
                    >
                        {t === 'model' ? '⚙ Model' : t === 'characters' ? '👥 Characters' : '🎨 Assets'}
                    </button>
                ))}
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {/* ── Model Tab ── */}
                {tab === 'model' && (
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[9px] uppercase tracking-wider text-cyan-400/70 font-mono">
                                Sampling Parameters
                            </label>
                            <button
                                onClick={resetSampling}
                                className="flex items-center gap-1 text-[8px] text-white/30 hover:text-white/60 transition-colors"
                            >
                                <RotateCcw className="w-2.5 h-2.5" /> Reset
                            </button>
                        </div>

                        <ParamSlider label="Temperature" paramKey="temperature" value={samplingParams.temperature} min={0.1} max={2} step={0.05} description="Creativity. Lower = focused, higher = creative" />
                        <ParamSlider label="Top P" paramKey="top_p" value={samplingParams.top_p} min={0.1} max={1} step={0.05} description="Nucleus sampling cutoff" />
                        <ParamSlider label="Top K" paramKey="top_k" value={samplingParams.top_k} min={-1} max={200} step={1} description="Token candidates (-1 = all)" />
                        <ParamSlider label="Repetition Penalty" paramKey="repetition_penalty" value={samplingParams.repetition_penalty} min={1} max={2} step={0.05} description="Higher = less repetition (1.1-1.3 recommended)" />
                        <ParamSlider label="Frequency Penalty" paramKey="frequency_penalty" value={samplingParams.frequency_penalty} min={0} max={2} step={0.05} description="Penalize frequent tokens" />
                        <ParamSlider label="Presence Penalty" paramKey="presence_penalty" value={samplingParams.presence_penalty} min={0} max={2} step={0.05} description="Encourage new topics" />
                        <ParamSlider label="Min P" paramKey="min_p" value={samplingParams.min_p} min={0} max={0.5} step={0.01} description="Minimum probability filter" />
                        <ParamSlider label="Max Tokens" paramKey="max_tokens" value={samplingParams.max_tokens} min={256} max={8192} step={256} description="Maximum response length" />

                        <div className="mt-4 pt-3 border-t border-white/5">
                            <label className="text-[9px] uppercase tracking-wider text-orange-400/70 font-mono mb-1.5 block">
                                Gossip Frequency — {Math.round(gossipFrequency * 100)}%
                            </label>
                            <input
                                type="range" min="0" max="1" step="0.05"
                                value={gossipFrequency}
                                onChange={(e) => setGossipFrequency(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-orange-500"
                            />
                            <span className="text-[9px] text-orange-400/50 mt-0.5 block">{labels[closest] || 'Custom'}</span>
                        </div>
                    </div>
                )}

                {/* ── Characters Tab ── */}
                {tab === 'characters' && (
                    <div>
                        <label className="text-[9px] uppercase tracking-wider text-cyan-400/70 font-mono mb-1.5 block">Characters</label>
                        <div className="space-y-1">
                            {characters.map(c => (
                                <button
                                    key={c.id}
                                    onClick={() => toggleVis(c.id)}
                                    className={cn(
                                        "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-[11px] transition-all",
                                        c.hidden ? "text-white/25" : "text-white/70"
                                    )}
                                >
                                    {c.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" style={{ color: c.colorHex }} />}
                                    <span>{c.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* ── Assets Tab (per-character bindings) ── */}
                {tab === 'assets' && (
                    <div>
                        <label className="text-[9px] uppercase tracking-wider text-purple-400/70 font-mono mb-2 block">
                            {activeChar ? `Assets for ${activeChar.name}` : 'Select a character first'}
                        </label>

                        {activeCharacterId && (
                            <div className="space-y-3">
                                {/* Hero Image URL */}
                                <div>
                                    <label className="text-[9px] uppercase tracking-wider text-white/40 font-mono mb-1 block flex items-center gap-1">
                                        <ImageIcon className="w-3 h-3" /> Hero Image URL
                                    </label>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            value={activeAssets.heroUrl || ''}
                                            onChange={(e) => setCharacterAsset(activeCharacterId, { heroUrl: e.target.value || undefined })}
                                            placeholder="https://..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder-white/20 focus:border-purple-500 focus:outline-none font-mono"
                                        />
                                        {activeAssets.heroUrl && (
                                            <button
                                                onClick={() => clearCharacterAsset(activeCharacterId, 'heroUrl')}
                                                className="px-1.5 text-rose-400/50 hover:text-rose-400"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {activeAssets.heroUrl && (
                                        <div className="mt-1 w-full h-16 rounded-md bg-black/50 overflow-hidden">
                                            <img src={activeAssets.heroUrl} alt="Hero preview" className="w-full h-full object-contain" />
                                        </div>
                                    )}
                                </div>

                                {/* Background URL */}
                                <div>
                                    <label className="text-[9px] uppercase tracking-wider text-white/40 font-mono mb-1 block flex items-center gap-1">
                                        <Palette className="w-3 h-3" /> Background URL
                                    </label>
                                    <div className="flex gap-1">
                                        <input
                                            type="text"
                                            value={activeAssets.backgroundUrl || ''}
                                            onChange={(e) => setCharacterAsset(activeCharacterId, { backgroundUrl: e.target.value || undefined })}
                                            placeholder="https://..."
                                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[10px] text-white placeholder-white/20 focus:border-purple-500 focus:outline-none font-mono"
                                        />
                                        {activeAssets.backgroundUrl && (
                                            <button
                                                onClick={() => clearCharacterAsset(activeCharacterId, 'backgroundUrl')}
                                                className="px-1.5 text-rose-400/50 hover:text-rose-400"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        )}
                                    </div>
                                    {activeAssets.backgroundUrl && (
                                        <div className="mt-1 w-full h-16 rounded-md bg-black/50 overflow-hidden">
                                            <img src={activeAssets.backgroundUrl} alt="BG preview" className="w-full h-full object-cover" />
                                        </div>
                                    )}
                                </div>

                                {/* Hero Transform */}
                                <div>
                                    <label className="text-[9px] uppercase tracking-wider text-white/40 font-mono mb-1 block">
                                        Hero Position & Scale
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        <div>
                                            <span className="text-[8px] text-white/30 block mb-0.5">Scale %</span>
                                            <input
                                                type="number"
                                                value={activeAssets.heroTransform?.scale ?? 100}
                                                onChange={(e) => setCharacterAsset(activeCharacterId, {
                                                    heroTransform: { ...(activeAssets.heroTransform || { scale: 100, x: 50, y: 0 }), scale: parseInt(e.target.value) || 100 }
                                                })}
                                                className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white font-mono focus:border-purple-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-white/30 block mb-0.5">X %</span>
                                            <input
                                                type="number"
                                                value={activeAssets.heroTransform?.x ?? 50}
                                                onChange={(e) => setCharacterAsset(activeCharacterId, {
                                                    heroTransform: { ...(activeAssets.heroTransform || { scale: 100, x: 50, y: 0 }), x: parseInt(e.target.value) || 50 }
                                                })}
                                                className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white font-mono focus:border-purple-500 focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <span className="text-[8px] text-white/30 block mb-0.5">Y %</span>
                                            <input
                                                type="number"
                                                value={activeAssets.heroTransform?.y ?? 0}
                                                onChange={(e) => setCharacterAsset(activeCharacterId, {
                                                    heroTransform: { ...(activeAssets.heroTransform || { scale: 100, x: 50, y: 0 }), y: parseInt(e.target.value) || 0 }
                                                })}
                                                className="w-full bg-white/5 border border-white/10 rounded px-1.5 py-1 text-[10px] text-white font-mono focus:border-purple-500 focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <p className="text-[8px] text-white/20 italic mt-2">
                                    These assets are bound to {activeChar?.name}. When you switch characters, their own assets will load automatically.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </motion.div>
    );
}

// ─── Save/Load Overlay ───────────────────────────────────────────────────────

function SaveLoadOverlay({
    onClose, onSave, onLoad
}: {
    onClose: () => void;
    onSave: (name: string) => void;
    onLoad: (saveId: string) => void;
}) {
    const saves = usePentagramChatStore(s => s.saves);
    const loadSaves = usePentagramChatStore(s => s.loadSaves);
    const saveId = usePentagramStore(s => s.saveId);
    const deleteSave = usePentagramChatStore(s => s.deleteSave);
    const [saveName, setSaveName] = useState('');
    const [confirmLoadId, setConfirmLoadId] = useState<string | null>(null);

    useEffect(() => { loadSaves(); }, [loadSaves]);

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md rounded-2xl p-4 flex flex-col overflow-y-auto"
        >
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-white/50">Save / Load</h3>
                <button onClick={onClose} className="text-white/30 hover:text-white"><X className="w-3.5 h-3.5" /></button>
            </div>

            <div className="flex gap-2 mb-3">
                <input
                    type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                    placeholder="Save name..."
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-[11px] text-white placeholder-white/25 focus:border-emerald-500 focus:outline-none"
                />
                <button
                    onClick={() => { if (saveName.trim()) { onSave(saveName.trim()); setSaveName(''); } }}
                    disabled={!saveName.trim()}
                    className="px-2.5 py-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-[10px] font-bold hover:bg-emerald-500/30 disabled:opacity-30 transition-all flex items-center gap-1"
                >
                    <Save className="w-3 h-3" /> Save
                </button>
            </div>

            <div className="space-y-1.5 flex-1">
                {saves.length === 0 && <p className="text-[10px] text-white/20 text-center py-4 font-mono">No saves</p>}
                {saves.map(s => (
                    <div key={s.id} className="bg-white/5 rounded-lg p-2 flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                            <div className="text-[11px] text-white/70 truncate">{s.save_name}</div>
                            <div className="text-[9px] text-white/25 font-mono">{new Date(s.updated_at).toLocaleString()}</div>
                        </div>
                        {confirmLoadId === s.id ? (
                            <div className="flex items-center gap-1">
                                <span className="text-[9px] text-rose-400">Overwrite?</span>
                                <button onClick={() => { onLoad(s.id); setConfirmLoadId(null); }} className="px-1.5 py-0.5 bg-rose-500/20 text-rose-400 rounded text-[9px]">Yes</button>
                                <button onClick={() => setConfirmLoadId(null)} className="px-1.5 py-0.5 bg-white/5 text-white/40 rounded text-[9px]">No</button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => setConfirmLoadId(s.id)} className="p-1 text-cyan-400/60 hover:text-cyan-400 rounded" title="Load"><FolderOpen className="w-3 h-3" /></button>
                                <button onClick={() => { if (confirm('Delete?')) deleteSave(s.id); }} className="p-1 text-rose-400/30 hover:text-rose-400 rounded" title="Delete"><Trash2 className="w-3 h-3" /></button>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </motion.div>
    );
}

// ─── Main Chat Panel ─────────────────────────────────────────────────────────

interface PentagramChatPanelProps {
    onSaveGame: (saveName: string) => void;
    onLoadGame: (saveId: string) => Promise<void>;
}

export function PentagramChatPanel({ onSaveGame, onLoadGame }: PentagramChatPanelProps) {
    const {
        characters, activeCharacterId, conversations,
        isStreaming, streamingContent,
        setActiveCharacter, clearConversation, sendMessage,
    } = usePentagramChatStore();

    const [input, setInput] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [showSaveLoad, setShowSaveLoad] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const visibleChars = characters.filter(c => !c.hidden);

    useEffect(() => {
        if (!activeCharacterId && visibleChars.length > 0) {
            setActiveCharacter(visibleChars[0].id);
        }
    }, [activeCharacterId, visibleChars, setActiveCharacter]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [conversations, activeCharacterId, streamingContent]);

    const activeChar = characters.find(c => c.id === activeCharacterId);
    const activeMessages = activeCharacterId ? (conversations[activeCharacterId] || []) : [];

    // ─── Message windowing ─── only render the last WINDOW_SIZE messages
    // Older messages are hidden behind a "load older" button
    const WINDOW_SIZE = 50;
    const LOAD_MORE_CHUNK = 30;
    const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE);

    // Reset visible count when switching characters
    useEffect(() => {
        setVisibleCount(WINDOW_SIZE);
    }, [activeCharacterId]);

    // Compute windowed messages
    const { windowedMessages, hasOlder, totalCount } = useMemo(() => {
        const total = activeMessages.length;
        const startIdx = Math.max(0, total - visibleCount);
        return {
            windowedMessages: activeMessages.slice(startIdx),
            hasOlder: startIdx > 0,
            totalCount: total,
        };
    }, [activeMessages, visibleCount]);

    // Index of the first animated message (only animate last 3, rest are static)
    const animateFromIndex = Math.max(0, windowedMessages.length - 3);

    const handleSend = useCallback(() => {
        if (!input.trim() || isStreaming) return;
        const store = usePentagramStore.getState();
        const gameCtx = {
            game: 'pentagram_protocol',
            current_scene_id: store.currentSceneId,
            scene_title: '',
            scene_narrative: '',
            game_state: store.gameState,
        };
        sendMessage(input.trim(), gameCtx);
        setInput('');
    }, [input, isStreaming, sendMessage]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <>
        {/* Left corner tools */}
        <div className="absolute left-4 bottom-4 z-40 flex flex-col items-center gap-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-1.5 py-3 pointer-events-auto shadow-2xl w-[52px]">
            <button onClick={() => setShowSaveLoad(true)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-cyan-400 hover:bg-white/5 rounded-lg transition-all" title="Save/Load">
                <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setShowSettings(true)} className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-orange-400 hover:bg-white/5 rounded-lg transition-all" title="Settings">
                <Settings2 className="w-4 h-4" />
            </button>
            {activeCharacterId && (
                <button
                    onClick={() => { if (confirm(`Clear chat with ${activeChar?.name}?\nMemories will be kept.`)) clearConversation(activeCharacterId); }}
                    className="w-10 h-10 flex items-center justify-center text-white/40 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-all" title="Clear history"
                >
                    <Trash2 className="w-4 h-4" />
                </button>
            )}
        </div>

        <motion.div
            initial={{ opacity: 0, x: "-50%", y: 20 }}
            animate={{ opacity: 1, x: "-50%", y: 0 }}
            exit={{ opacity: 0, x: "-50%", y: 20 }}
            transition={{ duration: 0.3 }}
            className="absolute top-[60px] bottom-4 z-40 pointer-events-auto flex flex-col"
            style={{ width: '45%', minWidth: 380, maxWidth: 640, left: '26%' }}
        >
            <div className="w-full h-full flex flex-col relative">

                {/* Overlays */}
                <AnimatePresence>
                    {showSettings && <SettingsOverlay onClose={() => setShowSettings(false)} />}
                    {showSaveLoad && (
                        <SaveLoadOverlay
                            onClose={() => setShowSaveLoad(false)}
                            onSave={(name) => { onSaveGame(name); setShowSaveLoad(false); }}
                            onLoad={async (id) => { await onLoadGame(id); setShowSaveLoad(false); }}
                        />
                    )}
                </AnimatePresence>

                {/* ─── Messages (floating bubbles, no background) ────────── */}
                <div className="flex-1 overflow-y-auto px-1 pb-2 scrollbar-hide">
                    {activeMessages.length === 0 && !isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-center px-4">
                            <p className="text-[11px] text-white/20 font-mono">
                                {activeChar ? `Talk to ${activeChar.name}...` : 'Select a character'}
                            </p>
                            <p className="text-[9px] text-white/10 mt-1 italic">
                                They remember everything.
                            </p>
                        </div>
                    )}

                    {/* Load older messages button */}
                    {hasOlder && (
                        <div className="flex justify-center py-2">
                            <button
                                onClick={() => setVisibleCount(v => v + LOAD_MORE_CHUNK)}
                                className="text-[9px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/30 hover:text-white/60 hover:bg-white/10 transition-all font-mono"
                            >
                                ↑ Load {Math.min(LOAD_MORE_CHUNK, totalCount - visibleCount)} older messages ({totalCount - visibleCount} hidden)
                            </button>
                        </div>
                    )}

                    {windowedMessages.map((msg, idx) => (
                        <ChatBubble
                            key={msg.id}
                            message={msg}
                            agentName={activeChar?.name || 'Agent'}
                            agentColor={activeChar?.colorHex || '#666'}
                            animate={idx >= animateFromIndex}
                        />
                    ))}

                    {isStreaming && (
                        <StreamingBubble
                            content={streamingContent}
                            agentName={activeChar?.name || 'Agent'}
                            agentColor={activeChar?.colorHex || '#666'}
                        />
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* ─── Input (floating at bottom) ────────────────────────── */}
                <div className="flex-shrink-0 px-1 pb-1">
                    <div className="flex items-end gap-2 bg-black/40 backdrop-blur-md rounded-2xl px-3 py-2 border border-white/[0.06]">
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={activeChar ? `Message ${activeChar.name}...` : 'Select a character...'}
                            disabled={!activeCharacterId || isStreaming}
                            rows={1}
                            className="flex-1 bg-transparent text-[13px] text-white/90 placeholder-white/20 resize-none focus:outline-none disabled:opacity-30 max-h-20 overflow-y-auto scrollbar-hide"
                            style={{ minHeight: '24px' }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || !activeCharacterId || isStreaming}
                            className={cn(
                                "p-1.5 rounded-xl transition-all flex-shrink-0",
                                input.trim() && activeCharacterId && !isStreaming
                                    ? "text-white/70 hover:text-white hover:bg-white/10"
                                    : "text-white/15 cursor-not-allowed"
                            )}
                        >
                            {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
        </>
    );
}
