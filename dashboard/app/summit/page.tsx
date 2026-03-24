"use client";

import { useSocket, useSocketStore, SummitMessage } from "@/lib/useSocket";
import { useTaskStore } from "@/lib/useTaskStore";
import { useConnectionStore } from "@/store/useConnectionStore";
import { useSummitTaskStore } from "@/store/useSummitTaskStore";
import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    Send, Bot, User, BrainCircuit, Loader2,
    Users, Check, X, RotateCcw, Zap, Play, Pause,
    MessageSquare, ChevronRight, FileText, Rocket, RefreshCw, Target, Puzzle, AlertTriangle,
    Pencil, ArrowDown, ArrowUpRight, Shield, Compass, Image as ImageIcon,
    PanelLeftClose, PanelLeftOpen, Trash2, Plus, Copy
} from "lucide-react";
import {
    IconPlus, IconPaperclip, IconWand, IconSend, IconCode, IconWorld, IconHistory
} from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ToolNodeCard } from "@/components/ToolNodeCard";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PromptChunkTray } from "@/components/prompt-chunks/PromptChunkTray";
import { ChatInputWithChunks } from "@/components/prompt-chunks/ChatInputWithChunks";
import { MissionBar, MissionConfig, getMissionSystemPrompt } from "@/components/chat/MissionBar";
import { StrategyModeSwitcher, StrategyMode, getStrategySystemPrompt } from "@/components/chat/StrategyModeSwitcher";
import { TimelineScrubber } from "@/components/chat/TimelineScrubber";
import { QuotedReplyBanner } from "@/components/chat/QuotedReplyBanner";
import { usePromptChunkStore } from "@/store/usePromptChunkStore";
import { useChatRouter } from "@/lib/useChatRouter";
import useAgentZeroStore from "@/store/useAgentZeroStore";
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";

/* ── Color palette for agent differentiation ── */
const AGENT_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {};
const COLOR_PALETTE = [
    { border: "border-blue-500/40", bg: "bg-blue-500/5", text: "text-blue-400", glow: "" },
    { border: "border-violet-500/40", bg: "bg-violet-500/5", text: "text-violet-400", glow: "" },
    { border: "border-amber-500/40", bg: "bg-amber-500/5", text: "text-amber-400", glow: "" },
    { border: "border-emerald-500/40", bg: "bg-emerald-500/5", text: "text-emerald-400", glow: "" },
    { border: "border-rose-500/40", bg: "bg-rose-500/5", text: "text-rose-400", glow: "" },
    { border: "border-cyan-500/40", bg: "bg-cyan-500/5", text: "text-cyan-400", glow: "" },
];

function getAgentColor(agentId: string, index: number) {
    if (!AGENT_COLORS[agentId]) {
        AGENT_COLORS[agentId] = COLOR_PALETTE[index % COLOR_PALETTE.length];
    }
    return AGENT_COLORS[agentId];
}

function agentDisplayName(agent: any): string {
    if (agent?.accountId && agent?.channel === 'slack') {
        return agent.accountId.charAt(0).toUpperCase() + agent.accountId.slice(1);
    }
    return agent?.name ?? agent?.id ?? 'Agent';
}

function rpcAgentId(agent: any): string {
    if (agent.channel === 'slack' && agent.accountId) {
        return agent.accountId;
    }
    return agent.id;
}

const stripTrailingTags = (content: string) => {
    let clean = content.replace(/<\/?(?:final|function|tool|call|response)[^>]*>?\s*$/i, '');
    return clean.replace(/<\/[a-zA-Z]*>?\s*$/i, '');
};

const renderSummitMessageContent = (content: string) => {
    if (!content) return null;

    const cleanContent = stripTrailingTags(content);

    const regex = new RegExp('([\\u{100085}<])?(call|response):([a-zA-Z0-9_]+)(\\{[\\s\\S]*?\\})([\\u{100086}>])?', 'gu');
    const parts: any[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(cleanContent)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: 'text', content: cleanContent.slice(lastIndex, match.index) });
        }
        parts.push({
            type: match[2],
            name: match[3],
            args: match[4]
        });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < cleanContent.length) {
        parts.push({ type: 'text', content: cleanContent.slice(lastIndex) });
    }

    return (
        <>
            {parts.map((part, idx) => {
                if (part.type === 'call') {
                    let out = undefined;
                    let isCompleted = false;
                    for (let j = idx + 1; j < parts.length; j++) {
                        if (parts[j].type === 'response' && parts[j].name === part.name) {
                            out = parts[j].args;
                            isCompleted = true;
                            parts[j].type = 'consumed_response';
                            break;
                        }
                    }

                    return (
                        <div key={idx} className="mt-3 mb-3 w-full pl-1">
                            <ToolNodeCard tc={{
                                id: `call-${idx}`,
                                status: isCompleted ? 'completed' : 'in_progress',
                                function: { name: part.name || 'unknown_tool', arguments: part.args || '' },
                                output: out
                            }} />
                        </div>
                    );
                } else if (part.type === 'response') {
                    return (
                        <div key={idx} className="mt-3 mb-3 w-full pl-1">
                            <ToolNodeCard tc={{
                                id: `resp-${idx}`,
                                status: 'completed',
                                function: { name: `${part.name} (Output)`, arguments: '{}' },
                                output: part.args
                            }} />
                        </div>
                    );
                } else if (part.type === 'consumed_response') {
                    return null;
                }
                return <div key={idx} className="w-full"><MessageRenderer content={part.content} /></div>;
            })}
        </>
    );
};

/* ── Context constants ── */
const RECENT_MSG_COUNT = 3;

export default function SummitPage() {
    const { agents, summitMessages, summitParticipants, summitActive, summitRound } = useSocketStore();
    const {
        addSummitMessage, setSummitParticipants, setSummitActive,
        incrementSummitRound, clearSummit
    } = useSocketStore();
    const { sendSummitMessage } = useSocket();
    const { integratedAgents, isOpenClawConnected } = useChatRouter();
    const { addTask } = useTaskStore();
    const router = useRouter();
    const { hiddenAgentIds } = useAgentSettingsStore();

    const [message, setMessage] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [autoDeliberate, setAutoDeliberate] = useState(false);
    const [maxRounds, setMaxRounds] = useState(999);
    const [summitTopic, setSummitTopic] = useState("");
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [agentContextMap, setAgentContextMap] = useState<Record<string, string>>({});
    const [showPhase2, setShowPhase2] = useState(false);
    const [deliberationRound, setDeliberationRound] = useState(0);
    const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
    const [speakerQueue, setSpeakerQueue] = useState<string[]>([]);
    const [refinementContext, setRefinementContext] = useState("");
    // @ mention state
    const [mentionQuery, setMentionQuery] = useState<string | null>(null);
    const [mentionIdx, setMentionIdx] = useState(0);
    const [taggedAgentId, setTaggedAgentId] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const autoDelibTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const speakerStreamStartedRef = useRef(false);
    const speakerQueueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const speakerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const SPEAKER_TIMEOUT_MS = 45_000;

    // ── Chat-parity state ──
    const [missionConfig, setMissionConfig] = useState<MissionConfig>({ goalText: '', goalLocked: false, constraints: [] });
    const [strategyMode, setStrategyMode] = useState<StrategyMode>('off');
    const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl?: string }[]>([]);
    const [quotedReply, setQuotedReply] = useState<{ text: string; messageId?: string } | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
    const [editDraft, setEditDraft] = useState("");
    const [visibleWindow, setVisibleWindow] = useState(50);
    const [showScrollBottom, setShowScrollBottom] = useState(false);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [selectionPopup, setSelectionPopup] = useState<{ text: string; messageId: string; x: number; y: number } | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isInteractingRef = useRef(false);

    const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

    const handleCopyMessage = async (content: string, id: string) => {
        // Strip out trailing XML tags when copying, to match what is displayed
        let finalContent = content
            .replace(/<\/?(?:final|function|tool|call|response)[^>]*>?\s*$/i, '')
            .replace(/<\/[a-zA-Z]*>?\s*$/i, '')
            .trim();
        
        finalContent = finalContent
            .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, '')
            .replace(/<thinking[\s>][\s\S]*$/gi, '')
            .replace(/<\/thinking>/gi, '')
            .replace(/<thinking\s*$/gi, '')
            .trim();

        await navigator.clipboard.writeText(finalContent);
        setCopiedMessageId(id);
        setTimeout(() => setCopiedMessageId(null), 2000);
    };

    // ── Summit History Sidebar ──
    const [showHistorySidebar, setShowHistorySidebar] = useState(true);
    const [summitSessions, setSummitSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

    useEffect(() => {
        fetch('/api/summit/sessions').then(r => r.json()).then(d => {
            if (d.sessions) setSummitSessions(d.sessions);
        }).catch(() => {});
    }, []);

    const loadHistoricalSession = async (id: string) => {
        try {
            const res = await fetch(`/api/summit/sessions/${id}`);
            const data = await res.json();
            if (data.session) {
                setSummitTopic(data.session.topic || data.session.title || '');
                if (data.session.config?.agentContextMap) {
                    setAgentContextMap(data.session.config.agentContextMap);
                }
                if (data.session.participants && Array.isArray(data.session.participants)) {
                    setSelectedIds(new Set(data.session.participants.map((pid: string) => {
                        const a = agents.find(ag => rpcAgentId(ag) === pid);
                        return a ? a.id : pid;
                    })));
                }
                if (data.session.deliberation_round) {
                    setDeliberationRound(data.session.deliberation_round);
                }
                if (data.messages) {
                    const loadedMessages: SummitMessage[] = data.messages.map((m: any) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content || '',
                        timestamp: new Date(m.created_at).toLocaleTimeString(),
                        agentId: m.agent_id || 'ivy',
                        roundNumber: m.round_number,
                        tool_calls: m.tool_calls || []
                    }));
                    useSocketStore.setState({ summitMessages: loadedMessages, summitRound: loadedMessages.length });
                }
            }
        } catch (err) {
            console.error("Failed to load historical session", err);
        }
    };

    // Auto-save messages to DB
    useEffect(() => {
        if (!activeSessionId || summitMessages.length === 0) return;
        
        const lastMsg = summitMessages[summitMessages.length - 1];
        if (lastMsg.streaming) return;

        const timeout = setTimeout(() => {
            fetch('/api/summit/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: activeSessionId,
                    messages: summitMessages.map((m, idx) => ({
                        id: m.id,
                        role: m.role,
                        agent_id: m.agentId,
                        content: m.content,
                        round_number: m.roundNumber || idx,
                        tool_calls: m.tool_calls
                    }))
                })
            }).catch(err => console.error("Failed to sync summit messages:", err));
            
            if (summitActive) {
                fetch(`/api/summit/sessions/${activeSessionId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: summitTopic.trim() || 'Untitled Summit',
                        topic: summitTopic.trim() || null,
                        config: { agentContextMap },
                        participants: summitParticipants,
                        deliberation_round: deliberationRound,
                        message_count: summitMessages.length
                    })
                }).catch(err => console.error("Failed to sync summit session state:", err));
            }
        }, 2000);

        return () => clearTimeout(timeout);
    }, [summitMessages, activeSessionId, summitActive, summitTopic, agentContextMap, summitParticipants, deliberationRound]);

    const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
    const [editSessionTitle, setEditSessionTitle] = useState("");
    const [deleteSessionConfirmId, setDeleteSessionConfirmId] = useState<string | null>(null);
    const editSessionInputRef = useRef<HTMLInputElement>(null);

    const patchSummitSession = async (id: string, updates: Record<string, any>) => {
        try {
            const res = await fetch(`/api/summit/sessions/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const { session: updated } = await res.json();
                setSummitSessions(prev => prev.map(s => s.id === id ? { ...s, ...updated } : s));
            }
        } catch (error) {
            console.error('Failed to update session:', error);
        }
    };

    const deleteSummitSession = async (id: string) => {
        try {
            const res = await fetch(`/api/summit/sessions/${id}`, { method: 'DELETE' });
            if (res.ok) {
                setSummitSessions(prev => prev.filter(s => s.id !== id));
                if (activeSessionId === id) {
                    setActiveSessionId(null);
                    clearSummit();
                }
            }
        } catch (error) {
            console.error('Failed to delete session:', error);
        } finally {
            setDeleteSessionConfirmId(null);
        }
    };

    const handleSessionRenameSubmit = async (id: string) => {
        if (editSessionTitle.trim()) {
            await patchSummitSession(id, { title: editSessionTitle.trim() });
        }
        setEditingSessionId(null);
        setEditSessionTitle('');
    };

    useEffect(() => {
        if (editingSessionId && editSessionInputRef.current) {
            editSessionInputRef.current.focus();
        }
    }, [editingSessionId]);

    const { chunks } = usePromptChunkStore();

    const roundInFlight = currentSpeaker !== null || speakerQueue.length > 0;

    const { activeProfile } = useConnectionStore();
    // Use gateway isConnected OR fallback to agents being available
    const isConnected = isOpenClawConnected || agents.length > 0;

    const onlineAgents = useMemo(() => {
        // Merge OpenClaw agents from store with integrated agents (which includes Agent Zero)
        const storeAgents = [...agents].filter(a => a.status !== 'offline');
        
        // Add Agent Zero from integratedAgents if not already present
        const agentZero = integratedAgents.find(a => a.id === 'agent-zero' && a.isOnline);
        if (agentZero && !storeAgents.find(a => (a as any).accountId === 'agent-zero' || a.id === 'agent-zero')) {
            storeAgents.push({
                id: 'agent-zero',
                accountId: 'agent-zero',
                name: 'Agent Zero',
                model: 'configurable',
                status: 'online',
                running: true,
                connected: true,
                probeOk: true,
            } as any);
        }

        // Filter hidden agents
        return storeAgents.filter(a => !hiddenAgentIds.includes((a as any).accountId || a.name || a.id));
    }, [agents, integratedAgents, hiddenAgentIds]);

    useEffect(() => {
        const escalatedTopic = sessionStorage.getItem('nerv_escalation_topic');
        if (escalatedTopic) {
            setSummitTopic(escalatedTopic);
            sessionStorage.removeItem('nerv_escalation_topic');
        }
    }, []);

    useEffect(() => {
        // We no longer auto-select agents on mount.
        // User must manually select agents to start a session.
    }, []);

    useEffect(() => {
        if (scrollRef.current) {
            if (isInteractingRef.current) return;
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight <= 150;
            if (isNearBottom) scrollRef.current.scrollTop = scrollHeight;
        }
    }, [summitMessages]);

    useEffect(() => {
        if (!summitActive) return;

        const warningMsg = 'The Summit is in progress. Leaving now will stop the deliberation and any unsaved results will be lost. Are you sure you want to leave?';

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = warningMsg;
        };
        window.addEventListener('beforeunload', handleBeforeUnload);

        const originalPushState = history.pushState.bind(history);
        const originalReplaceState = history.replaceState.bind(history);

        history.pushState = function (...args: Parameters<typeof history.pushState>) {
            if (window.confirm(warningMsg)) {
                return originalPushState(...args);
            }
        };
        history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
            if (window.confirm(warningMsg)) {
                return originalReplaceState(...args);
            }
        };

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            history.pushState = originalPushState;
            history.replaceState = originalReplaceState;
        };
    }, [summitActive]);

    /* ── File attachment handlers ── */
    const handleFilesSelected = (files: File[]) => {
        if (files.length === 0) return;
        const newPending = files.map(file => ({
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }));
        setPendingFiles(prev => [...prev, ...newPending]);
    };

    const handleDragOverFiles = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(true); };
    const handleDragLeaveFiles = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget.contains(e.relatedTarget as Node)) return; setIsDraggingOver(false); };
    const handleDropFiles = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); setIsDraggingOver(false); const files = Array.from(e.dataTransfer.files); if (files.length > 0) handleFilesSelected(files); };
    const handlePasteFiles = (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const files = items.filter(item => item.kind === 'file').map(item => item.getAsFile()).filter(Boolean) as File[];
        if (files.length > 0) { e.preventDefault(); handleFilesSelected(files); }
    };

    /* ── Text selection → floating quote icon ── */
    useEffect(() => {
        const handleMouseUp = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) { setSelectionPopup(null); return; }
            const range = sel.getRangeAt(0);
            const container = range.commonAncestorContainer as HTMLElement;
            const msgEl = (container.nodeType === 3 ? container.parentElement : container)?.closest('[data-msg-idx]');
            if (!msgEl) { setSelectionPopup(null); return; }
            const msgId = msgEl.getAttribute('data-msg-idx') || '';
            const rect = range.getBoundingClientRect();
            setSelectionPopup({ text: sel.toString().slice(0, 200), messageId: msgId, x: rect.left + rect.width / 2, y: rect.top - 8 });
        };
        const handleMouseDown = (e: MouseEvent) => {
            const popup = document.getElementById('nerv-summit-selection-quote');
            if (popup && !popup.contains(e.target as Node)) setSelectionPopup(null);
        };
        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousedown', handleMouseDown);
        return () => { document.removeEventListener('mouseup', handleMouseUp); document.removeEventListener('mousedown', handleMouseDown); };
    }, []);

    /* ── Scroll handler ── */
    const handleScrollMessages = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        setShowScrollBottom(scrollHeight - scrollTop - clientHeight > 200);
    };
    const scrollToBottom = () => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; };

    const toggleAgent = useCallback((id: string) => {
        if (summitActive) return;
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, [summitActive]);

    const startSession = useCallback(async () => {
        if (selectedIds.size < 2) return;

        const participantRpcIds = onlineAgents
            .filter(a => selectedIds.has(a.id))
            .map(a => rpcAgentId(a));

        if (activeSessionId && summitMessages.length > 0) {
            const existingRpcIds = new Set(
                summitMessages
                    .filter(m => m.role === 'assistant')
                    .map(m => m.agentId)
            );
            
            const newlyAddedRpcIds = participantRpcIds.filter(id => !existingRpcIds.has(id));
            
            if (newlyAddedRpcIds.length > 0) {
                const names = newlyAddedRpcIds.map(id => {
                    const a = onlineAgents.find(oa => rpcAgentId(oa) === id);
                    return a ? agentDisplayName(a) : id;
                }).join(', ');
                
                addSummitMessage({
                    id: crypto.randomUUID(),
                    role: 'user',
                    content: `[SYSTEM NOTICE] ${names} ${newlyAddedRpcIds.length > 1 ? 'have' : 'has'} joined the Summit.`,
                    timestamp: new Date().toLocaleTimeString(),
                    agentId: 'operator',
                    roundNumber: summitRound,
                } as any);
            }
        }

        if (!activeSessionId) {
            clearSummit();
            try {
                const res = await fetch('/api/summit/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        title: summitTopic.trim() || 'Untitled Summit',
                        topic: summitTopic.trim() || null,
                        deliberationRound: 1,
                        messages: []
                    })
                });
                if (res.ok) {
                    const data = await res.json();
                    setSummitSessions(prev => [data.session, ...prev]);
                    setActiveSessionId(data.session.id);
                }
            } catch (err) {
                console.error("Failed to create session", err);
            }
        }

        setSummitParticipants(participantRpcIds);
        setSummitActive(true);
    }, [selectedIds, onlineAgents, clearSummit, setSummitParticipants, setSummitActive, activeSessionId, summitTopic]);

    const endSession = useCallback(() => {
        setSummitActive(false);
        setAutoDeliberate(false);
        if (autoDelibTimerRef.current) clearTimeout(autoDelibTimerRef.current);
    }, [setSummitActive]);

    const findAgent = useCallback((rpcId: string) => {
        return onlineAgents.find(a => rpcAgentId(a) === rpcId);
    }, [onlineAgents]);

    const buildContextMessage = useCallback((newUserText?: string, forAgent?: string): string => {
        const getName = (rpcId: string): string => {
            const a = findAgent(rpcId);
            return a ? agentDisplayName(a) : rpcId;
        };

        const currentAgentName = forAgent ? getName(forAgent) : 'Agent';
        const participantNames = summitParticipants.map(getName).join(', ');
        const hasTopic = summitTopic.trim().length > 0;
        const isDeliberation = !newUserText;
        const topicStr = hasTopic ? summitTopic.trim() : 'Open discussion';

        const completed = summitMessages.filter(m => !m.streaming && m.agentId !== 'system');
        const splitAt = Math.max(0, completed.length - RECENT_MSG_COUNT);
        const olderMessages = completed.slice(0, splitAt);
        const recentMessages = completed.slice(splitAt);

        let summaryBlock = '';
        if (olderMessages.length > 0) {
            const lines = olderMessages.map(m => {
                const name = m.role === 'user' ? 'Operator' : getName(m.agentId);
                const cleanMsg = stripTrailingTags(m.content);
                const firstSentence = cleanMsg.split(/(?<=[.!?])\s/)[0] ?? cleanMsg;
                return `${name}: ${firstSentence}`;
            });
            summaryBlock = `\n<PREVIOUS_ROUNDS_SUMMARY>\n${lines.join('\n')}\n</PREVIOUS_ROUNDS_SUMMARY>`;
        }

        let recentBlock = '';
        if (recentMessages.length > 0) {
            const lines = recentMessages.map(m => {
                const name = m.role === 'user' ? 'Operator' : getName(m.agentId);
                return `[${name}]: ${stripTrailingTags(m.content)}`;
            });
            recentBlock = `\n<RECENT_LOG>\n${lines.join('\n')}\n</RECENT_LOG>`;
        }

        const roleDesc = hasTopic && isDeliberation
            ? `You are ${currentAgentName}. Multi-agent deliberation with ${participantNames}. Operator is observing only — do NOT address the Operator.`
            : `You are ${currentAgentName}. Group chat with ${participantNames} and the Operator (human).`;

        const driftRule = hasTopic && isDeliberation
            ? `RULE 3 (DRIFT PREVENTION): Strictly discuss direct implications of the TOPIC ANCHOR. Do NOT introduce absent agents, hypothetical scenarios, or unrelated tangents. If the previous speaker drifted, forcefully pivot back.`
            : `RULE 3 (NATURAL FLOW): Respond naturally. You may agree, disagree, or build on ideas.`;

        const missionPrompt = getMissionSystemPrompt(missionConfig);
        const strategyPrompt = getStrategySystemPrompt(strategyMode);
        const customInstruction = agentContextMap[forAgent || ''];

        const systemDirective = [
            `<SYSTEM_DIRECTIVE>`,
            `ROLE: ${roleDesc}`,
            `RULE 1 (STRICT CONCISENESS): Respond in 1-3 short sentences. No fluff.`,
            `RULE 2 (TOPIC ANCHOR): The current immutable topic is: "${topicStr}"`,
            driftRule,
            refinementContext ? `RULE 4 (REFINEMENT CONTEXT): The <PRIOR_AGREEMENT> block contains a concatenated transcript of all previous statements. Read it silently to understand the full context of the debate so far.` : '',
            customInstruction ? `RULE 5 (CUSTOM BEHAVIOR from Operator): ${customInstruction}\nAdhere strictly to this behavior instruction during this session.` : '',
            missionPrompt || '',
            strategyPrompt || '',
            `</SYSTEM_DIRECTIVE>`,
        ].filter(Boolean).join('\n');

        let refinementBlock = '';
        if (refinementContext) {
            refinementBlock = `\n<PRIOR_AGREEMENT>\n${refinementContext}\n</PRIOR_AGREEMENT>`;
        }

        const lastNonSelf = [...recentMessages].reverse().find(m => m.agentId !== forAgent);
        const lastSpeakerName = lastNonSelf
            ? (lastNonSelf.role === 'user' ? 'Operator' : getName(lastNonSelf.agentId))
            : null;

        let turnAction: string;
        if (newUserText) {
            turnAction = `The Operator just said: "${newUserText}"\nAction: Respond to the Operator, adhering to the SYSTEM_DIRECTIVE.`;
        } else if (refinementContext) {
            turnAction = `Action: Review the <PRIOR_AGREEMENT>. If there are unresolved conflicts, continue the debate to reach a unified agreement. If an agreement has already been made, briefly confirm the consensus and outline the final stance. IMPORTANT: You must adhere strictly to RULE 1 (1-3 short sentences). DO NOT output a long summary paragraph.`;
        } else if (lastSpeakerName) {
            turnAction = `Action: Reply to ${lastSpeakerName}, adhering strictly to the SYSTEM_DIRECTIVE.`;
        } else {
            turnAction = `Action: Open the discussion on the topic, adhering to the SYSTEM_DIRECTIVE.`;
        }

        const yourTurn = `\n<YOUR_TURN>\nAgent: ${currentAgentName}\n${turnAction}\nResponse:\n</YOUR_TURN>`;

        return `${systemDirective}${refinementBlock}${summaryBlock}${recentBlock}${yourTurn}`;
    }, [summitMessages, summitParticipants, deliberationRound, summitTopic, refinementContext, findAgent, missionConfig, strategyMode]);

    const startSequentialRound = useCallback((agents: string[], userText?: string) => {
        if (agents.length === 0) return;
        const [first, ...rest] = agents;
        setCurrentSpeaker(first);
        setSpeakerQueue(rest);
        speakerStreamStartedRef.current = false;
        sendSummitMessage([first], buildContextMessage(userText, first));
    }, [sendSummitMessage, buildContextMessage]);

    const handleSend = useCallback(async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!message.trim() || !summitActive || !isConnected || summitParticipants.length === 0) return;
        if (roundInFlight) return;

        // Resolve prompt chunk tokens
        let resolvedMessage = message;
        resolvedMessage = resolvedMessage.replace(/⟦([^⟧]+)⟧/g, (match, name) => {
            const chunk = chunks.find(c => c.name === name);
            return chunk ? chunk.content : match;
        });
        const userText = resolvedMessage.trim();
        const capturedQuotedReply = quotedReply;

        // Build mode indicators
        const modeIndicators = {
            hasGoal: !!missionConfig.goalText,
            hasConstraints: missionConfig.constraints.filter(c => c.locked).length > 0,
            hasStrategy: strategyMode !== 'off',
            strategyMode: strategyMode !== 'off' ? strategyMode : undefined,
        };

        // Build attachment metadata
        const base64Attachments = await Promise.all(pendingFiles.map(async pf => {
            return new Promise<any>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    resolve({
                        name: pf.file.name,
                        type: pf.file.type,
                        size: pf.file.size,
                        url: reader.result as string,
                    });
                };
                reader.onerror = reject;
                reader.readAsDataURL(pf.file);
            });
        }));

        // Build injected text for agents
        let injectedText = userText;
        if (capturedQuotedReply) injectedText = `> ${capturedQuotedReply.text}\n\n${injectedText}`;
        if (base64Attachments.length > 0) {
            const fileList = base64Attachments.map(a => a.name).join(', ');
            injectedText = `[Attached files: ${fileList}]\n\n${injectedText}`;
        }

        addSummitMessage({
            id: crypto.randomUUID(),
            role: 'user',
            content: userText,
            timestamp: new Date().toLocaleTimeString(),
            agentId: 'operator',
            roundNumber: summitRound + 1,
            modeIndicators,
            attachments: base64Attachments.length > 0 ? base64Attachments : undefined,
        } as any);

        // Clear UI state immediately
        setMessage("");
        setPendingFiles([]);
        if (capturedQuotedReply) setQuotedReply(null);

        incrementSummitRound();

        // If a specific agent is tagged via @mention, only send to that agent
        if (taggedAgentId && summitParticipants.includes(taggedAgentId)) {
            startSequentialRound([taggedAgentId], injectedText);
        } else {
            startSequentialRound(summitParticipants, injectedText);
        }
        setTaggedAgentId(null);
    }, [message, summitActive, isConnected, summitParticipants, summitRound, roundInFlight, addSummitMessage, incrementSummitRound, startSequentialRound, chunks, quotedReply, missionConfig, strategyMode, pendingFiles, taggedAgentId, agentContextMap]);

    const handleContinue = useCallback(() => {
        if (!summitActive || !isConnected || summitParticipants.length === 0) return;
        if (deliberationRound >= maxRounds) return;
        if (roundInFlight) return;

        const nextDelib = deliberationRound + 1;

        addSummitMessage({
            id: crypto.randomUUID(),
            role: 'user',
            content: `▸ Deliberation — Round ${nextDelib}`,
            timestamp: new Date().toLocaleTimeString(),
            agentId: 'system',
            roundNumber: nextDelib,
        });

        setDeliberationRound(nextDelib);
        startSequentialRound(summitParticipants);
    }, [summitActive, isConnected, summitParticipants, deliberationRound, maxRounds, roundInFlight, addSummitMessage, startSequentialRound]);

    const streamingCount = useMemo(() => summitMessages.filter(m => m.streaming).length, [summitMessages]);
    const assistantMsgCount = useMemo(() => summitMessages.filter(m => m.role === 'assistant').length, [summitMessages]);
    const displayMessages = useMemo(() => summitMessages.filter(m => !m.content.startsWith('[SYSTEM NOTICE]')), [summitMessages]);

    const advanceQueue = useCallback(() => {
        if (speakerTimeoutRef.current) { clearTimeout(speakerTimeoutRef.current); speakerTimeoutRef.current = null; }
        speakerStreamStartedRef.current = false;

        if (speakerQueue.length > 0) {
            const [next, ...rest] = speakerQueue;
            if (speakerQueueTimerRef.current) clearTimeout(speakerQueueTimerRef.current);
            speakerQueueTimerRef.current = setTimeout(() => {
                setCurrentSpeaker(next);
                setSpeakerQueue(rest);
                speakerStreamStartedRef.current = false;
                sendSummitMessage([next], buildContextMessage(undefined, next));
            }, 600);
        } else {
            setCurrentSpeaker(null);
        }
    }, [speakerQueue, sendSummitMessage, buildContextMessage]);

    useEffect(() => {
        if (!currentSpeaker) return;

        const speakerStreaming = summitMessages.some(
            m => m.agentId === currentSpeaker && m.streaming
        );

        if (speakerStreaming) {
            speakerStreamStartedRef.current = true;

            if (!speakerTimeoutRef.current) {
                speakerTimeoutRef.current = setTimeout(() => {
                    console.warn(`[Summit] Speaker ${currentSpeaker} timed out after ${SPEAKER_TIMEOUT_MS / 1000}s — force-advancing queue`);
                    const stuckMsg = summitMessages.find(m => m.agentId === currentSpeaker && m.streaming);
                    if (stuckMsg) {
                        addSummitMessage({ ...stuckMsg, streaming: false, content: stuckMsg.content + '\n[response timed out]' });
                    }
                    advanceQueue();
                }, SPEAKER_TIMEOUT_MS);
            }
        }

        if (speakerStreamStartedRef.current && !speakerStreaming) {
            advanceQueue();
        }
    }, [summitMessages, currentSpeaker, advanceQueue, addSummitMessage]);

    useEffect(() => {
        return () => {
            if (speakerQueueTimerRef.current) clearTimeout(speakerQueueTimerRef.current);
            if (speakerTimeoutRef.current) clearTimeout(speakerTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        if (autoDelibTimerRef.current) {
            clearTimeout(autoDelibTimerRef.current);
            autoDelibTimerRef.current = null;
        }

        if (autoDeliberate && !roundInFlight && streamingCount === 0 && assistantMsgCount > 0 && deliberationRound < maxRounds && summitActive) {
            autoDelibTimerRef.current = setTimeout(() => {
                handleContinue();
            }, 2500);
        }

        return () => {
            if (autoDelibTimerRef.current) clearTimeout(autoDelibTimerRef.current);
        };
    }, [autoDeliberate, roundInFlight, streamingCount, assistantMsgCount, deliberationRound, maxRounds, summitActive, handleContinue]);

    const agentColorMap = useMemo(() => {
        const map: Record<string, ReturnType<typeof getAgentColor>> = {};
        onlineAgents.forEach((a, i) => {
            map[rpcAgentId(a)] = getAgentColor(rpcAgentId(a), i);
        });
        return map;
    }, [onlineAgents]);

    const agentMsgCounts = useMemo(() => {
        const counts: Record<string, number> = {};
        summitMessages.filter(m => m.role === 'assistant').forEach(m => {
            counts[m.agentId] = (counts[m.agentId] || 0) + 1;
        });
        return counts;
    }, [summitMessages]);

    const isAnyStreaming = streamingCount > 0;

    return (
        <div className="flex h-full gap-0 flex-row">
            {/* Summit History Sidebar */}
            {showHistorySidebar && (
                <div className="w-64 border-r border-border bg-transparent flex flex-col flex-shrink-0 mr-3 -ml-5 h-full">
                    <div className="p-3 px-4 border-b border-border flex items-center justify-between">
                        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Summit History</span>
                        <div className="flex items-center gap-1">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                    if (summitActive) {
                                        window.alert("A session is active. Please end the current session before creating a new one.");
                                        return;
                                    }
                                    setActiveSessionId(null);
                                    clearSummit();
                                }}
                                className="h-6 w-6 p-0 rounded-full hover:bg-orange-500/10"
                                aria-label="New session"
                            >
                                <Plus className="w-3.5 h-3.5 text-orange-500" />
                            </Button>
                            <button onClick={() => setShowHistorySidebar(false)} className="p-1.5 rounded hover:bg-accent transition-colors">
                                <PanelLeftClose className="w-3.5 h-3.5 text-muted-foreground" />
                            </button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide">
                        {summitSessions.map((s) => {
                            const isEditing = editingSessionId === s.id;
                            const isActive = activeSessionId === s.id;
                            const isBlocked = summitActive && !isActive;

                            return (
                                <div
                                    key={s.id}
                                        onClick={() => {
                                        if (isEditing) return;
                                        if (summitActive) {
                                            if (!isActive) window.alert("A session is active. Please end the current session before switching.");
                                            return;
                                        }
                                        setActiveSessionId(s.id);
                                        loadHistoricalSession(s.id);
                                    }}
                                    className={cn(
                                        "group relative w-full text-left p-2.5 rounded-xl text-xs transition-colors overflow-hidden",
                                        isActive
                                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/30"
                                            : isBlocked
                                                ? "text-muted-foreground opacity-50 cursor-not-allowed border border-transparent"
                                                : "text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent cursor-pointer"
                                    )}
                                >
                                    {/* Hover Actions */}
                                    {!isBlocked && !isEditing && (
                                        <div 
                                            className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 z-10 transition-opacity bg-background/80 backdrop-blur-sm rounded-md"
                                        >
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingSessionId(s.id); setEditSessionTitle(s.title || ''); }}
                                                className="p-1.5 rounded-md transition-all hover:bg-white/[0.07]"
                                                title="Rename"
                                            >
                                                <Pencil className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setDeleteSessionConfirmId(s.id); }}
                                                className="p-1.5 rounded-md transition-all hover:bg-white/[0.07]"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
                                            </button>
                                        </div>
                                    )}

                                    {isEditing ? (
                                        <input
                                            ref={editSessionInputRef}
                                            value={editSessionTitle}
                                            onChange={e => setEditSessionTitle(e.target.value)}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleSessionRenameSubmit(s.id);
                                                if (e.key === 'Escape') { setEditingSessionId(null); setEditSessionTitle(''); }
                                            }}
                                            onBlur={() => handleSessionRenameSubmit(s.id)}
                                            className="text-[12px] font-medium w-full min-w-0 pr-14 focus:outline-none"
                                            style={{ 
                                                color: 'var(--nerv-text-primary)',
                                                background: 'transparent',
                                                border: 'none',
                                                outline: 'none',
                                                boxShadow: 'none'
                                            }}
                                        />
                                    ) : (
                                        <div className="font-medium text-foreground truncate pr-12">{s.title || 'Untitled Summit'}</div>
                                    )}
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span>{new Date(s.created_at).toLocaleDateString()}</span>
                                        <span>· {s.message_count || 0} msgs</span>
                                    </div>
                                </div>
                            );
                        })}
                        {summitSessions.length === 0 && (
                            <div className="text-center text-muted-foreground text-[11px] py-6 opacity-60">
                                No previous sessions
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Main Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header Toolbar */}
                <div className="flex-shrink-0">
                    <div className="flex items-center justify-between px-0 pb-3">
                        <div className="flex items-center gap-3">
                            {!showHistorySidebar && (
                                <button onClick={() => setShowHistorySidebar(true)} className="p-1.5 rounded-lg hover:bg-accent transition-colors" title="Show history">
                                    <PanelLeftOpen className="w-4 h-4 text-muted-foreground" />
                                </button>
                            )}
                            <h1 className="text-xl font-semibold tracking-tight text-foreground">The Summit</h1>
                            <p className="text-xs text-muted-foreground">
                                {summitActive
                                    ? `Active · Round ${summitRound} · Deliberation ${deliberationRound} · ${summitParticipants.length} participants`
                                    : "Multi-agent deliberation"}
                            </p>
                        </div>

                        <div className="flex items-center gap-2">
                            {!summitActive ? (
                                <Button
                                    onClick={startSession}
                                    disabled={selectedIds.size < 2 || !isConnected}
                                    size="sm"
                                    className={cn(
                                        "rounded-full text-xs h-8 px-4 gap-2",
                                        selectedIds.size >= 2 && isConnected
                                            ? "bg-orange-500 text-white hover:bg-orange-600"
                                            : "bg-accent text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    <Zap className="w-3 h-3" />
                                    {summitMessages.length > 0 && activeSessionId ? "Continue Session" : "Start Session"}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => {
                                            setAutoDeliberate(false);
                                            setShowPhase2(true);
                                        }}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-xs h-8 px-4 gap-2 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10"
                                    >
                                        <Check className="w-3 h-3" />
                                        Force Agree
                                    </Button>
                                    <Button
                                        onClick={endSession}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full text-xs h-8 px-4 gap-2 text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                                    >
                                        <X className="w-3 h-3" />
                                        Stop Summit
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Agent Selector (only visible before session starts) */}
                    {!summitActive && (
                        <div className="px-6 pb-0 pt-3 flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-muted-foreground mr-1">Participants:</span>
                            {onlineAgents.map((agent, i) => {
                                const color = getAgentColor(rpcAgentId(agent), i);
                                const isSelected = selectedIds.has(agent.id);
                                return (
                                    <button
                                        key={agent.id}
                                        onClick={() => toggleAgent(agent.id)}
                                        className={cn(
                                            "px-4 py-1.5 rounded-full text-xs transition-all flex items-center gap-2 border",
                                            isSelected
                                                ? `${color.bg} ${color.text} ${color.border}`
                                                : "bg-transparent text-muted-foreground border-border hover:border-foreground/30"
                                        )}
                                    >
                                        {isSelected && <Check className="w-2.5 h-2.5" />}
                                        {agentDisplayName(agent)}
                                    </button>
                                );
                            })}
                            {onlineAgents.length === 0 && (
                                <span className="text-xs text-muted-foreground italic">No agents online</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Messages Area + Timeline */}
                <div className="flex-1 min-h-0 flex relative" onDragOver={handleDragOverFiles} onDragLeave={handleDragLeaveFiles} onDrop={handleDropFiles} onPaste={handlePasteFiles}>
                    {isDraggingOver && (
                        <div className="absolute inset-0 z-50 m-2 rounded-2xl border-2 border-dashed border-orange-500/50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all">
                            <div className="p-4 rounded-full bg-orange-500/10 mb-2"><IconPaperclip className="w-8 h-8 text-orange-500" /></div>
                            <p className="text-lg font-semibold text-foreground">Drop to add files</p>
                            <p className="text-sm text-muted-foreground">Attach images, documents, or data files</p>
                        </div>
                    )}
                <div ref={scrollRef} onScroll={handleScrollMessages} onMouseDown={() => { isInteractingRef.current = true; }} onMouseUp={() => { setTimeout(() => { isInteractingRef.current = false; }, 200); }} className="flex-1 overflow-y-auto p-6 space-y-4 min-h-0 scrollbar-hide">
                    {!summitActive && displayMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 opacity-50">
                            <Users className="w-16 h-16" />
                            <p className="text-sm font-medium">Select agents & start a session</p>
                            <p className="text-xs text-muted-foreground max-w-md text-center">
                                Choose at least 2 agents, then start a session. Your messages will be
                                broadcast to all participants simultaneously.
                            </p>
                        </div>
                    ) : summitActive && displayMessages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-muted-foreground space-y-4 opacity-70">
                            <BrainCircuit className="w-12 h-12 animate-pulse text-foreground/30" />
                            <p className="text-sm text-foreground/50">Session active — awaiting input</p>
                            <Button
                                onClick={handleContinue}
                                variant="outline"
                                className="mt-4 rounded-full text-xs"
                            >
                                <Zap className="w-3.5 h-3.5" />
                                Start Deliberation
                            </Button>
                        </div>
                    ) : (
                        <>
                        {displayMessages.length > visibleWindow && (
                            <div className="flex justify-center py-2">
                                <button onClick={() => setVisibleWindow(prev => prev + 50)} className="text-[11px] text-muted-foreground hover:text-foreground px-3 py-1 rounded-full border border-border hover:bg-accent transition-colors">
                                    Load {Math.min(50, displayMessages.length - visibleWindow)} older messages
                                </button>
                            </div>
                        )}
                        {displayMessages.slice(-visibleWindow).map((msg, idx) => {
                            const globalIdx = Math.max(0, displayMessages.length - visibleWindow) + idx;
                            const windowedMessages = displayMessages.slice(-visibleWindow);
                            const isFirstInGroup = idx === 0 || windowedMessages[idx - 1].role !== msg.role || windowedMessages[idx - 1].agentId !== msg.agentId;

                            if (msg.agentId === 'system') {
                                return (
                                    <div key={msg.id} className="flex items-center gap-3 my-4">
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                            <ChevronRight className="w-2.5 h-2.5" />
                                            {msg.content}
                                        </span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>
                                );
                            }

                            const isUser = msg.role === 'user';
                            const color = !isUser ? (agentColorMap[msg.agentId] ?? COLOR_PALETTE[0]) : null;
                            const agent = !isUser ? findAgent(msg.agentId) : null;
                            const displayName = isUser ? 'You' : (agent ? agentDisplayName(agent) : msg.agentId);

                            return (
                                <div key={msg.id} data-msg-idx={globalIdx} className={cn("flex w-full justify-start nerv-chat-bubble-enter", isFirstInGroup ? "mt-[12px]" : "mt-[4px]")}
                                    style={{ animationDelay: `${Math.min(globalIdx * 30, 200)}ms` }}
                                >
                                    {/* Avatar column */}
                                    <div className="flex-shrink-0 mr-[12px] w-[42px] flex flex-col justify-start items-center relative mt-[5px]">
                                        {isFirstInGroup ? (
                                            isUser ? (
                                                <div className="w-[42px] h-[56px] rounded-[8px] flex items-center justify-center bg-orange-500/20 border border-orange-500/30">
                                                    <User className="w-5 h-5 text-orange-500" />
                                                </div>
                                            ) : (
                                                <AgentAvatar agentId={msg.agentId} name={displayName} width={42} height={56} />
                                            )
                                        ) : (
                                            <div className="w-[42px]" />
                                        )}
                                    </div>

                                    {/* Content column */}
                                    <div className="flex flex-col items-start min-w-0 flex-1">
                                        {isFirstInGroup && (
                                            <div className="flex items-center gap-1.5 mb-[2px] px-1">
                                                <span className={cn("text-[13px] font-semibold", isUser ? "text-foreground" : color?.text || "text-foreground")}>{displayName}</span>
                                                <span className="text-[11px] text-muted-foreground">· {msg.timestamp}</span>
                                                {!isUser && msg.roundNumber != null && (
                                                    <span className="text-[10px] text-muted-foreground">· Round {msg.roundNumber}</span>
                                                )}
                                            </div>
                                        )}

                                        {editingMessageId === msg.id ? (
                                            <div className="flex flex-col gap-2 w-full mt-1 min-w-[200px]">
                                                <Textarea autoFocus value={editDraft} onChange={(e) => setEditDraft(e.target.value)} className="text-[13px] bg-background text-foreground resize-none border-border/50 focus-visible:ring-1 focus-visible:ring-orange-500/50" rows={4} />
                                                <div className="flex items-center gap-1 self-end mt-1">
                                                    <Button size="icon" variant="ghost" onClick={() => setEditingMessageId(null)} className="h-6 w-6 rounded-full hover:bg-white/10"><X className="w-3.5 h-3.5 text-red-400" /></Button>
                                                    <Button size="icon" variant="ghost" onClick={() => { setEditingMessageId(null); }} className="h-6 w-6 rounded-full hover:bg-white/10"><Check className="w-3.5 h-3.5 text-green-400" /></Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="group/msg relative w-fit max-w-[85%]">
                                                {/* Tool calls (agent only) */}
                                                {!isUser && msg.tool_calls && msg.tool_calls.length > 0 && (
                                                    <div className="flex flex-col gap-2 mb-2 w-full">
                                                        {msg.tool_calls.map((tc: any, tcIdx: number) => {
                                                            let argsDisplay = tc.function?.arguments || JSON.stringify(tc);
                                                            try {
                                                                const p = JSON.parse(argsDisplay);
                                                                argsDisplay = p.command || p.code || JSON.stringify(p, null, 2);
                                                            } catch {}
                                                            const status = tc.status || 'completed';
                                                            const isError = status === 'failed';
                                                            const inProgress = status === 'in_progress';
                                                            return (
                                                                <div key={tcIdx} className={cn("bg-accent border rounded-xl p-3 w-full text-sm mt-1", isError ? "border-red-500/30" : "border-border")}>
                                                                    <div className="flex items-center justify-between mb-2">
                                                                        <div className="flex items-center gap-2 text-foreground text-xs font-medium">
                                                                            {inProgress ? <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin" /> : <Puzzle className={cn("w-3.5 h-3.5", isError ? "text-red-400" : "text-muted-foreground")} />}
                                                                            {tc.function?.name || 'tool_call'}
                                                                        </div>
                                                                        {inProgress ? <span className="text-[10px] text-blue-400 font-medium animate-pulse">Running</span> : isError ? <AlertTriangle className="w-3.5 h-3.5 text-red-500/80" /> : <Check className="w-3.5 h-3.5 text-emerald-500/80" />}
                                                                    </div>
                                                                    <div className="text-muted-foreground text-xs mb-2 break-all whitespace-pre-wrap pl-6">{argsDisplay}</div>
                                                                    {(tc.output || tc.progress) && (
                                                                        <div className="mt-2 pl-6">
                                                                            <div className={cn("text-xs p-2 rounded-lg bg-background border whitespace-pre-wrap break-all", isError ? "text-red-400 border-red-500/20" : "text-muted-foreground border-border")}>
                                                                                {tc.progress ? `Progress: ${tc.progress}` : tc.output}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {/* Message bubble */}
                                                <div className={cn(
                                                    "px-[12px] py-[6px] text-[13px] leading-relaxed min-w-[80px] w-fit flex flex-col gap-2",
                                                    isUser
                                                        ? "bg-accent text-foreground"
                                                        : "bg-orange-500/35 text-white border border-orange-500/40",
                                                    isFirstInGroup ? "rounded-[12px]" : "rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px] rounded-tl-[4px]"
                                                )}>
                                                    {/* Attachments */}
                                                    {(msg as any).attachments && (msg as any).attachments.length > 0 && (
                                                        <div className="flex flex-wrap gap-2">
                                                            {(msg as any).attachments.map((att: any, i: number) => (
                                                                att.type?.startsWith('image/') ? (
                                                                    <img key={i} src={att.url || att} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-md object-contain border border-border/50" />
                                                                ) : (
                                                                    <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/50 text-xs text-foreground">
                                                                        <FileText className="w-4 h-4" /><span className="truncate max-w-[150px]">{att.name || 'Document'}</span>
                                                                    </div>
                                                                )
                                                            ))}
                                                        </div>
                                                    )}
                                                    <div className="flex items-end gap-1">
                                                        {renderSummitMessageContent(msg.content)}
                                                        {msg.streaming && <Loader2 className="inline-block w-3 h-3 ml-1 text-muted-foreground animate-spin" />}
                                                    </div>
                                                    {/* Mode indicators */}
                                                    {isUser && (() => {
                                                        const indicators = (msg as any).modeIndicators;
                                                        const hasAny = indicators?.hasGoal || indicators?.hasConstraints || indicators?.hasStrategy;
                                                        if (!hasAny) return null;
                                                        return (
                                                            <div className="flex items-center gap-1 mt-1">
                                                                {indicators.hasGoal && (<div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-success) 12%, transparent)', color: 'var(--nerv-success)', border: '1px solid color-mix(in srgb, var(--nerv-success) 20%, transparent)' }}><Target className="w-2.5 h-2.5" /><span>Goal</span></div>)}
                                                                {indicators.hasConstraints && (<div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-warn) 12%, transparent)', color: 'var(--nerv-warn)', border: '1px solid color-mix(in srgb, var(--nerv-warn) 20%, transparent)' }}><Shield className="w-2.5 h-2.5" /><span>Constraints</span></div>)}
                                                                {indicators.hasStrategy && (<div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-cyan) 12%, transparent)', color: 'var(--nerv-cyan)', border: '1px solid color-mix(in srgb, var(--nerv-cyan) 20%, transparent)' }}><Compass className="w-2.5 h-2.5" /><span>{indicators.strategyMode ? indicators.strategyMode.charAt(0).toUpperCase() + indicators.strategyMode.slice(1) : 'Strategy'}</span></div>)}
                                                            </div>
                                                        );
                                                    })()}
                                                </div>

                                                {/* Hover toolbar */}
                                                <div className="absolute -top-7 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 px-1 py-0.5 rounded-lg z-10" style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                                    <button onClick={() => handleCopyMessage(msg.content, msg.id)} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy message">
                                                        {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                                                    </button>
                                                    <button onClick={() => { setEditDraft(msg.content); setEditingMessageId(msg.id); }} className="p-1 rounded hover:bg-white/10 transition-colors" title="Edit message"><Pencil className="w-3 h-3" style={{ color: 'var(--nerv-warn)' }} /></button>
                                                    <button onClick={() => setQuotedReply({ text: msg.content.slice(0, 100), messageId: msg.id })} className="p-1 rounded hover:bg-white/10 transition-colors" title="Quote reply"><ArrowUpRight className="w-3 h-3 text-muted-foreground" /></button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                        }

                    {/* Continue card — when rounds reached */}
                    {summitActive && deliberationRound >= maxRounds && !isAnyStreaming && !roundInFlight && (
                        <div className="flex justify-center my-4 w-full">
                            <Button onClick={() => setMaxRounds(prev => prev + 10)} variant="outline" className="text-xs h-8 rounded-full gap-1.5">
                                <Play className="w-3 h-3" /> Continue (+10 rounds)
                            </Button>
                        </div>
                    )}

                    {/* Scroll to bottom */}
                    {showScrollBottom && (
                        <button onClick={scrollToBottom} className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium shadow-lg transition-all hover:scale-105" style={{ background: 'var(--popover)', border: '1px solid var(--border)', color: 'var(--foreground)' }}>
                            <ArrowDown className="w-3 h-3" /> New messages
                        </button>
                    )}
                        </>
                    )}
                </div>

                    {/* Timeline Scrubber */}
                    {summitMessages.length > 4 && (
                        <div className="shrink-0 overflow-y-auto">
                            <TimelineScrubber
                                messages={summitMessages.map(m => ({ id: m.id, role: m.role, content: m.content }))}
                                activeIndex={summitMessages.length - 1}
                                onScrubTo={(msgIdx) => {
                                    const container = scrollRef.current;
                                    if (!container) return;
                                    const messageEls = container.querySelectorAll('[data-msg-idx]');
                                    const el = messageEls[msgIdx];
                                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                }}
                            />
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="pt-2 pb-0 w-full">
                    {/* Mission Bar - inside input area */}
                    <MissionBar missionConfig={missionConfig} onMissionChange={setMissionConfig} className="mx-0 mb-2" />
                    <div className="bg-background border border-border shadow-sm rounded-3xl focus-within:ring-1 focus-within:ring-border/50 transition-all relative">
                        <div className="px-3 pt-3 pb-2 grow relative">
                            {(isAnyStreaming || currentSpeaker) && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2 animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    {currentSpeaker ? (() => {
                                        const agent = findAgent(currentSpeaker);
                                        const name = agent ? agentDisplayName(agent) : currentSpeaker;
                                        return `${name} is speaking... (${speakerQueue.length} waiting)`;
                                    })() : `${streamingCount} agent${streamingCount > 1 ? 's' : ''} responding...`}
                                </div>
                            )}

                            {/* Quoted Reply Banner */}
                            {quotedReply && (
                                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs" style={{ background: 'var(--accent)', border: '1px solid var(--border)' }}>
                                    <ArrowUpRight className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="truncate text-muted-foreground italic flex-1">"{quotedReply.text}"</span>
                                    <button onClick={() => setQuotedReply(null)} className="p-0.5 rounded hover:bg-white/10"><X className="w-3 h-3 text-muted-foreground" /></button>
                                </div>
                            )}

                            {/* Tagged Agent Badge */}
                            {taggedAgentId && (
                                <div className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg text-xs bg-orange-500/10 border border-orange-500/30">
                                    <span className="text-orange-400 font-medium">@{(() => {
                                        const ag = onlineAgents.find(a => a.id === taggedAgentId || (a as any).accountId === taggedAgentId);
                                        return ag ? agentDisplayName(ag) : taggedAgentId;
                                    })()}</span>
                                    <span className="text-muted-foreground">will respond exclusively</span>
                                    <button onClick={() => setTaggedAgentId(null)} className="p-0.5 rounded hover:bg-white/10 ml-auto"><X className="w-3 h-3 text-orange-400" /></button>
                                </div>
                            )}

                            {/* Attachment Preview Strip */}
                            {pendingFiles.length > 0 && (
                                <div className="flex items-center gap-2 mb-2 overflow-x-auto scrollbar-hide">
                                    {pendingFiles.map((pf, i) => (
                                        <div key={i} className="relative group shrink-0">
                                            {pf.previewUrl ? (
                                                <img src={pf.previewUrl} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                                            ) : (
                                                <div className="w-16 h-16 rounded-lg border border-border flex flex-col items-center justify-center bg-accent gap-1">
                                                    <FileText className="w-5 h-5 text-muted-foreground" />
                                                    <span className="text-[8px] text-muted-foreground truncate max-w-[56px] px-1">{pf.file.name}</span>
                                                </div>
                                            )}
                                            <button onClick={() => { if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl); setPendingFiles(prev => prev.filter((_, idx) => idx !== i)); }} className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"><X className="w-2.5 h-2.5 text-white" /></button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <form onSubmit={handleSend} className="relative">
                                <ChatInputWithChunks
                                    value={message}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setMessage(val);
                                        // @ mention detection
                                        // match @ followed by up to 20 chars (excluding @) at the end of string
                                        const cursorPos = val.length; 
                                        const textBefore = val.slice(0, cursorPos);
                                        const match = textBefore.match(/(?:^|\s)@([^@\r\n]{0,20})$/);
                                        
                                        if (match) {
                                            setMentionQuery(match[1].toLowerCase());
                                            setMentionIdx(0);
                                        } else {
                                            setMentionQuery(null);
                                        }
                                    }}
                                    onSend={handleSend}
                                    placeholder={
                                        !isConnected ? "Connection offline"
                                            : !summitActive ? "Start a session first..."
                                                : autoDeliberate ? "🖐️ Interject as stakeholder..."
                                                    : deliberationRound >= maxRounds ? "Rounds reached — click + to extend, or keep chatting..."
                                                        : taggedAgentId ? `Addressing @${summitParticipants.find(p => p === taggedAgentId) || taggedAgentId}...`
                                                            : "Address the council..."
                                    }
                                    disabled={!isConnected || !summitActive}
                                    className="w-full bg-transparent p-0 text-foreground text-[13px] min-h-10 max-h-[25vh]"
                                    rows={2}
                                />
                                {/* @ Mention Popup */}
                                {mentionQuery !== null && (() => {
                                    const searchPool = summitParticipants.length > 0 ? summitParticipants : onlineAgents.map(a => a.id);
                                    const filtered = searchPool
                                        .map(pid => {
                                            const ag = onlineAgents.find(a => a.id === pid || (a as any).accountId === pid);
                                            return ag ? { id: pid, name: agentDisplayName(ag) } : { id: pid, name: pid };
                                        })
                                        .filter(a => a.name.toLowerCase().includes(mentionQuery));
                                    if (filtered.length === 0) return null;
                                    return (
                                        <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded-xl shadow-xl p-1 min-w-[180px] z-50">
                                            {filtered.map((a, i) => (
                                                <button
                                                    key={a.id}
                                                    type="button"
                                                    className={cn(
                                                        "w-full text-left px-3 py-1.5 rounded-lg text-xs flex items-center gap-2 transition-colors",
                                                        i === mentionIdx ? "bg-orange-500/20 text-orange-400" : "text-foreground hover:bg-accent"
                                                    )}
                                                    onClick={() => {
                                                        setTaggedAgentId(a.id);
                                                        setMessage(prev => prev.replace(/@\w*$/, ''));
                                                        setMentionQuery(null);
                                                    }}
                                                >
                                                    <span className="font-medium">@{a.name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    );
                                })()}
                            </form>
                        </div>

                        <div className="mb-2 px-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                {/* Attach button */}
                                <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files) handleFilesSelected(Array.from(e.target.files)); e.target.value = ''; }} />
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-accent" disabled={!summitActive}>
                                            <IconPlus className="w-4 h-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="min-w-[160px]">
                                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                                            <IconPaperclip className="w-4 h-4 mr-2" /> Attach Files
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                {/* Strategy Mode */}
                                <StrategyModeSwitcher activeMode={strategyMode} onModeChange={setStrategyMode} />

                                {/* Prompt Chunk Tray */}
                                <PromptChunkTray />

                                {/* Continue button */}
                                {summitActive && !isAnyStreaming && !roundInFlight && summitMessages.length > 0 && deliberationRound < maxRounds && (
                                    <Button
                                        type="button"
                                        onClick={handleContinue}
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-3 rounded-full border border-orange-500/30 text-orange-500 hover:bg-orange-500/10 gap-1.5"
                                    >
                                        <Play className="w-3 h-3" />
                                        <span className="text-xs">Continue</span>
                                    </Button>
                                )}
                            </div>

                            <div>
                                <Button
                                    type="submit"
                                    disabled={!message.trim() || !isConnected || !summitActive}
                                    className="size-8 p-0 rounded-full bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                    onClick={handleSend}
                                >
                                    <IconSend className="size-3 text-primary-foreground" />
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Floating Quote Popup */}
                {selectionPopup && (
                    <div id="nerv-summit-selection-quote" className="fixed z-[9999] flex items-center gap-1 px-2 py-1 rounded-full shadow-lg cursor-pointer transition-all hover:scale-105" style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)', background: 'var(--popover)', border: '1px solid var(--border)' }} onClick={() => { setQuotedReply({ text: selectionPopup.text, messageId: selectionPopup.messageId }); setSelectionPopup(null); window.getSelection()?.removeAllRanges(); }}>
                        <ArrowUpRight className="w-3 h-3 text-foreground" />
                        <span className="text-[10px] font-medium text-foreground">Quote</span>
                    </div>
                )}
            </div>

            {/* Right Panel: Participants */}
            <div className="w-64 border-l border-border bg-transparent flex flex-col flex-shrink-0 ml-3 -mr-5 h-full">
                <div className="p-3 px-4 border-b border-border">
                    <h3 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground mb-4">Council Members</h3>

                    {/* Topic of Discussion */}
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground block">Topic & Behaviors</label>
                        <div 
                            onClick={() => setShowTopicModal(true)}
                            className="bg-transparent border border-border text-foreground text-xs rounded-xl p-3 cursor-pointer hover:bg-white/5 transition-colors min-h-[44px] flex items-center"
                        >
                            {summitTopic.trim() ? (
                                <span className="line-clamp-2 text-foreground/90 leading-snug">{summitTopic}</span>
                            ) : (
                                <span className="text-muted-foreground/50">e.g. Budget allocation for Q3...</span>
                            )}
                        </div>
                        {summitTopic.trim() && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                <Target className="w-2.5 h-2.5" /> Topic active — agents will focus on this
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 scrollbar-hide">
                    {summitActive ? (
                        summitParticipants.map((rpcId, i) => {
                            const agent = findAgent(rpcId);
                            const color = agentColorMap[rpcId] ?? COLOR_PALETTE[i % COLOR_PALETTE.length];
                            const label = agent ? agentDisplayName(agent) : rpcId;
                            const msgCount = agentMsgCounts[rpcId] ?? 0;
                            const isStreaming = summitMessages.some(m => m.agentId === rpcId && m.streaming);

                            return (
                                <div
                                    key={rpcId}
                                    className={cn(
                                        "p-1.5 px-2 border rounded-xl transition-all",
                                        color.border, color.bg
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-5 h-5 rounded-full flex items-center justify-center border shrink-0",
                                            color.border, "bg-background"
                                        )}>
                                            <span className={cn("text-[9px] font-semibold", color.text)}>
                                                {label.charAt(0).toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={cn("text-[11px] font-medium block truncate", color.text)}>
                                                {label}
                                            </span>
                                        </div>
                                        {isStreaming && (
                                            <Loader2 className={cn("w-3 h-3 animate-spin shrink-0", color.text)} />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        onlineAgents.map((agent, i) => {
                            const isSelected = selectedIds.has(agent.id);
                            const color = getAgentColor(rpcAgentId(agent), i);
                            return (
                                <Button
                                    key={agent.id}
                                    onClick={() => toggleAgent(agent.id)}
                                    variant="ghost"
                                    className={cn(
                                        "w-full p-2.5 h-auto border rounded-xl text-left justify-start",
                                        isSelected
                                            ? `${color.border} ${color.bg}`
                                            : "border-border bg-transparent hover:border-foreground/20"
                                    )}
                                >
                                    <div className="flex items-center gap-2 w-full">
                                        <div className={cn(
                                            "w-6 h-6 rounded-full flex items-center justify-center border shrink-0",
                                            isSelected ? `${color.border} bg-background` : "border-border bg-background"
                                        )}>
                                            {isSelected ? (
                                                <Check className={cn("w-3 h-3", color.text)} />
                                            ) : (
                                                <span className="text-[10px] text-muted-foreground font-semibold">
                                                    {agentDisplayName(agent).charAt(0).toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <span className={cn(
                                                "text-xs font-medium block truncate",
                                                isSelected ? color.text : "text-muted-foreground"
                                            )}>
                                                {agentDisplayName(agent)}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {agent.status === 'working' ? 'Working' : 'Idle'}
                                            </span>
                                        </div>
                                        <div className={cn(
                                            "w-2 h-2 rounded-full shrink-0",
                                            agent.status === 'working' ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                                        )} />
                                    </div>
                                </Button>
                            );
                        })
                    )}

                    {onlineAgents.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground text-xs italic">
                            No agents detected
                        </div>
                    )}
                </div>

                {/* Session Controls */}
                {summitActive && (
                    <div className="p-3 border-t border-border space-y-2 flex-shrink-0">
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2">
                            <div className="bg-transparent p-2 border border-border rounded-xl text-center">
                                <span className="text-[10px] text-muted-foreground block">Session</span>
                                <span className="text-foreground font-semibold text-sm">{summitRound}</span>
                            </div>
                            <div className="bg-transparent p-2 border border-border rounded-xl text-center">
                                <span className="text-[10px] text-muted-foreground block">Delib</span>
                                <span className="text-foreground font-semibold text-sm">{deliberationRound}</span>
                            </div>
                            <div className="bg-transparent p-2 border border-border rounded-xl text-center">
                                <span className="text-[10px] text-muted-foreground block">Replies</span>
                                <span className="text-foreground font-semibold text-sm">
                                    {assistantMsgCount}
                                </span>
                            </div>
                        </div>

                        {/* Max Rounds Control */}
                        <div className="flex items-center justify-between bg-transparent p-2 border border-border rounded-xl">
                            <span className="text-[10px] text-muted-foreground">Max Rounds</span>
                            <div className="flex items-center gap-1">
                                <Button
                                    onClick={() => setMaxRounds(prev => Math.max(1, prev - 10))}
                                    variant="ghost"
                                    size="icon-xs"
                                    className="w-5 h-5 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground"
                                >-</Button>
                                <input 
                                    type="text"
                                    value={maxRounds === 999 ? '∞' : maxRounds}
                                    onChange={(e) => {
                                        let val = e.target.value.replace(/\D/g, '');
                                        if (val.length > 3) val = val.slice(0, 3);
                                        if (val === '') {
                                            setMaxRounds(999);
                                        } else {
                                            const num = parseInt(val, 10);
                                            setMaxRounds(num > 0 ? Math.min(num, 999) : 999);
                                        }
                                    }}
                                    onFocus={(e) => { if (maxRounds === 999) e.target.value = ''; }}
                                    className="text-foreground text-xs font-semibold w-8 text-center bg-transparent border-none outline-none focus:ring-0 p-0"
                                />
                                <Button
                                    onClick={() => setMaxRounds(prev => Math.min(999, prev + 10))}
                                    variant="ghost"
                                    size="icon-xs"
                                    className="w-5 h-5 rounded-full bg-background border border-border text-muted-foreground hover:text-foreground"
                                >+</Button>
                            </div>
                        </div>

                        {/* Auto-Deliberate Toggle */}
                        <Button
                            onClick={() => setAutoDeliberate(prev => !prev)}
                            variant="outline"
                            className={cn(
                                "w-full h-auto p-2 rounded-xl text-xs flex items-center justify-center gap-2",
                                autoDeliberate
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                                    : "bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                            )}
                        >
                            {autoDeliberate ? (
                                <><Pause className="w-3 h-3" /> Auto-Deliberate On</>
                            ) : (
                                <><Play className="w-3 h-3" /> Auto-Deliberate</>
                            )}
                        </Button>

                        {autoDeliberate && (
                            <p className="text-[10px] text-emerald-500/70 text-center">
                                Auto-firing rounds (no limit)
                            </p>
                        )}

                        {/* Reset */}
                        <Button
                            onClick={() => { clearSummit(); setSelectedIds(new Set()); setAutoDeliberate(false); }}
                            variant="outline"
                            className="w-full h-auto p-1.5 rounded-xl text-xs bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                        >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Reset Session
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Phase 2: Resolution Modal ── */}
            {showPhase2 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowPhase2(false)}>
                    <div className="w-full max-w-2xl mx-4 h-[80vh] flex flex-col overflow-hidden bg-background border border-border rounded-2xl shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        
                        {/* Static Header Section */}
                        <div className="shrink-0 flex flex-col">
                            {/* Header */}
                            <div className="p-6 border-b border-border">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-accent border border-border flex items-center justify-center">
                                        <FileText className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div>
                                        <h2 className="text-sm font-semibold text-foreground">Phase 2: The Plan</h2>
                                        <p className="text-[10px] text-muted-foreground">
                                            {deliberationRound} deliberation rounds · {summitParticipants.length} participants · {assistantMsgCount} total replies
                                        </p>
                                    </div>
                                    <Button
                                        onClick={() => setShowPhase2(false)}
                                        variant="ghost"
                                        size="icon-xs"
                                        className="ml-auto text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="w-4 h-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Topic */}
                            {summitTopic.trim() && (
                                <div className="px-6 py-3 border-b border-border bg-accent/50">
                                    <span className="text-[10px] text-muted-foreground">Topic</span>
                                    <p className="text-xs text-foreground mt-0.5">"{summitTopic.trim()}"</p>
                                </div>
                            )}
                        </div>

                        {/* Scrollable Middle Section */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                            {/* Deliberation Summary */}
                            <div className="p-6 space-y-3">
                                <h3 className="text-xs font-semibold text-muted-foreground">Deliberation Summary</h3>
                                <div className="space-y-4 pb-4">
                                    {summitParticipants.map((rpcId) => {
                                        const agent = findAgent(rpcId);
                                        const name = agent ? agentDisplayName(agent) : rpcId;
                                        const color = agentColorMap[rpcId] ?? COLOR_PALETTE[0];
                                        const msgCount = agentMsgCounts[rpcId] ?? 0;
                                        const agentMsgs = summitMessages.filter(m => m.agentId === rpcId && m.role === 'assistant' && !m.streaming);
                                        return (
                                            <div key={rpcId} className={cn("p-4 border rounded-xl", color.border, "bg-accent/30")}>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className={cn("text-sm font-medium", color.text)}>{name}</span>
                                                    <span className="text-[10px] text-muted-foreground">{msgCount} contribution{msgCount !== 1 ? 's' : ''}</span>
                                                </div>
                                                {agentMsgs.length > 0 ? (
                                                    <p className="text-xs text-muted-foreground leading-relaxed max-h-48 overflow-y-auto pr-2">
                                                        {agentMsgs.map(msg => stripTrailingTags(msg.content).trim()).join(' ')}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-muted-foreground italic">No contributions recorded</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Static Footer Section */}
                        <div className="shrink-0 p-6 flex flex-col sm:flex-row items-center gap-3 border-t border-border bg-background/50 backdrop-blur mt-auto">
                            <Button
                                onClick={() => {
                                    const summaryLines: string[] = [];

                                    summitParticipants.forEach(rpcId => {
                                        const agent = findAgent(rpcId);
                                        const name = agent ? agentDisplayName(agent) : rpcId;
                                        const agentMsgs = summitMessages.filter(m => m.agentId === rpcId && m.role === 'assistant' && !m.streaming);

                                        if (agentMsgs.length > 0) {
                                            const combinedText = agentMsgs.map(msg => stripTrailingTags(msg.content).trim()).join(' ');
                                            summaryLines.push(`${name}: ${combinedText}`);
                                        }
                                    });

                                    useSummitTaskStore.getState().openModal(summaryLines.join('\n'), summitParticipants);

                                    setShowPhase2(false);
                                    setSummitActive(false);
                                    clearSummit();
                                    router.push("/agents");
                                }}
                                className="flex-1 h-auto p-3 rounded-xl text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 w-full sm:w-auto"
                            >
                                <Rocket className="w-4 h-4 mr-1.5" />
                                Execute the Plan
                            </Button>

                            <Button
                                onClick={() => {
                                    const summaryLines: string[] = [];

                                    summitParticipants.forEach(rpcId => {
                                        const agent = findAgent(rpcId);
                                        const name = agent ? agentDisplayName(agent) : rpcId;
                                        const agentMsgs = summitMessages.filter(m => m.agentId === rpcId && m.role === 'assistant' && !m.streaming);

                                        if (agentMsgs.length > 0) {
                                            const combinedText = agentMsgs.map(msg => stripTrailingTags(msg.content).trim()).join(' ');
                                            summaryLines.push(`${name}: ${combinedText}`);
                                        }
                                    });

                                    setRefinementContext(summaryLines.join('\n'));
                                    setShowPhase2(false);
                                    setMaxRounds(prev => prev + 3);
                                }}
                                variant="outline"
                                className="flex-1 h-auto p-3 rounded-xl text-xs font-medium w-full sm:w-auto"
                            >
                                <RefreshCw className="w-4 h-4 mr-1.5" />
                                Refine (+3 Rounds)
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Session Modal ── */}
            {deleteSessionConfirmId && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setDeleteSessionConfirmId(null)}
                >
                    <div
                        className="mx-4 p-4 rounded-xl w-full max-w-[240px]"
                        style={{
                            background: 'var(--nerv-surface-3)',
                            border: '1px solid var(--nerv-border-default)',
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2 mb-2">
                            <Trash2 className="w-4 h-4" style={{ color: 'var(--nerv-danger)' }} />
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--nerv-text-primary)' }}>Delete session?</span>
                        </div>
                        <p className="text-[11px] mb-4" style={{ color: 'var(--nerv-text-secondary)', lineHeight: '1.5' }}>
                            This completely removes the summit session and its messages from the database.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setDeleteSessionConfirmId(null)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                                style={{
                                    color: 'var(--nerv-text-secondary)',
                                    background: 'var(--nerv-surface-4)',
                                    border: '1px solid var(--nerv-border-subtle)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--nerv-border-default)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'var(--nerv-surface-4)')}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => deleteSummitSession(deleteSessionConfirmId)}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                                style={{
                                    color: '#fff',
                                    background: 'var(--nerv-danger)',
                                    border: '1px solid var(--nerv-danger)',
                                }}
                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
                                onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Topic Configuration Modal ── */}
            {showTopicModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setShowTopicModal(false)}
                >
                    <div
                        className="mx-4 rounded-xl w-full max-w-lg overflow-hidden flex flex-col bg-background border border-border"
                        style={{
                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                            maxHeight: '85vh'
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--nerv-border-default)' }}>
                            <div className="flex items-center gap-2">
                                <Target className="w-5 h-5 text-orange-500" />
                                <h3 className="text-sm font-semibold text-foreground">Topic & Behaviors</h3>
                            </div>
                            <Button variant="ghost" size="icon-xs" onClick={() => setShowTopicModal(false)} className="text-muted-foreground hover:text-foreground">
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* Body - Scrollable */}
                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            {/* Main Topic */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium text-foreground">Session Topic</label>
                                <p className="text-[10px] text-muted-foreground">This defines the core subject. All agents will strongly anchor to this topic.</p>
                                <Textarea
                                    value={summitTopic}
                                    onChange={(e) => setSummitTopic(e.target.value)}
                                    placeholder="Enter the main deliberation topic..."
                                    rows={3}
                                    className="bg-background border-border text-foreground text-[13px] resize-none focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                />
                            </div>

                            {/* Agent Behaviors */}
                            <div className="space-y-3">
                                <label className="text-xs font-medium text-foreground">Custom Agent Behaviors</label>
                                <p className="text-[10px] text-muted-foreground">Inject specific prompts, roles, or instructions for individual participants taking part in this session.</p>
                                
                                <div className="space-y-2">
                                    {(summitActive ? summitParticipants : Array.from(selectedIds)).map((rpcId) => {
                                        const agent = findAgent(rpcId);
                                        const name = agent ? agentDisplayName(agent) : rpcId;
                                        const color = agentColorMap[rpcId] ?? COLOR_PALETTE[0];
                                        return (
                                            <div key={rpcId} className="p-3 border border-border rounded-xl space-y-2 bg-transparent">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-semibold text-foreground">{name}</span>
                                                </div>
                                                <Textarea
                                                    value={agentContextMap[rpcId] || ''}
                                                    onChange={(e) => setAgentContextMap(prev => ({ ...prev, [rpcId]: e.target.value }))}
                                                    placeholder={`Enter custom instruction for ${name}...`}
                                                    rows={1}
                                                    className="bg-transparent border-border text-foreground text-[11px] resize-y min-h-8 focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                                />
                                            </div>
                                        );
                                    })}
                                    {(!summitActive && selectedIds.size === 0) && (
                                        <div className="text-[11px] text-muted-foreground italic py-2 text-center border rounded-xl border-dashed">
                                            Select agents first to set custom behaviors
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t flex justify-end" style={{ borderColor: 'var(--nerv-border-default)', background: 'var(--nerv-surface-3)' }}>
                            <Button onClick={() => setShowTopicModal(false)} className="bg-orange-500 text-white hover:bg-orange-600 rounded-lg h-9 px-6 text-xs">
                                Apply & Close
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
