'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { usePinnedChatStore, SnapPosition } from '@/stores/usePinnedChatStore';
import { useChatRouter } from '@/lib/useChatRouter';
import { useSocketStore, ChatMessage } from '@/lib/useSocket';
import { useCompanionModeStore } from '@/stores/useCompanionModeStore';
import { useOpenClawModelStore } from '@/stores/useOpenClawModelStore';
import { useOpenClawStore } from '@/store/useOpenClawStore';
import { AgentAvatar } from '@/components/agents/AgentAvatar';
import { MessageRenderer } from '@/components/chat/MessageRenderer';
import { parseOpenClawToolCalls } from '@/lib/openclawToolParser';
import { tryParseAgentZeroJSON, AgentZeroMessageCard } from '@/components/chat/AgentZeroMessageCard';
import {
    X as XIcon, Send, Minimize2, MessageSquare, Loader2, ChevronDown
} from 'lucide-react';

/* ─── Simplified message content renderer ─── */
function renderPinnedContent(content: string) {
    if (!content) return null;
    const a0 = tryParseAgentZeroJSON(content);
    if (a0) return <AgentZeroMessageCard data={a0} />;
    const { cleanedText } = parseOpenClawToolCalls(content);
    let final = cleanedText
        .replace(/<\/?(?:final|function|tool|call|response)[^>]*>?\s*$/i, '')
        .replace(/<\/[a-zA-Z]*>?\s*$/i, '')
        .trim();
    final = final
        .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, '')
        .replace(/<thinking[\s>][\s\S]*$/gi, '')
        .replace(/<\/thinking>/gi, '')
        .replace(/<thinking\s*$/gi, '')
        .trim();
    if (!final) return null;
    return <MessageRenderer content={final} />;
}

/* ─── Strip system directive prefix from display ─── */
function stripSystemDirective(content: string): string {
    return content
        .replace(/^\[SYSTEM DIRECTIVE[^\]]*\]\s*/i, '')
        .replace(/^User is currently talking in Chat Workspace ID: [a-zA-Z0-9-]+\s*/i, '')
        .trim();
}

/* ─── Detect background JSON bleed (same pattern as chat page) ─── */
function isBackgroundJSON(content: string): boolean {
    return /^\s*\{\s*"(sections|title|steps|systemPrompt)"\s*:/i.test(content);
}

/* ─── Position anchoring logic (absolute top+left, consistent with orb) ─── */
function getPopoverPosition(snap: SnapPosition): React.CSSProperties {
    const W = 340;
    const H = 620;
    const MARGIN = 24;
    const ORB = 52;
    const GAP = 12;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;
    const maxH = vh - MARGIN * 2 - ORB - GAP - 20;

    switch (snap) {
        case 'bottom-right':
            return { top: vh - MARGIN - ORB - GAP - Math.min(H, maxH), left: vw - MARGIN - W, width: W, maxHeight: maxH, height: H };
        case 'bottom-left':
            return { top: vh - MARGIN - ORB - GAP - Math.min(H, maxH), left: MARGIN, width: W, maxHeight: maxH, height: H };
        case 'top-right':
            return { top: MARGIN + ORB + GAP, left: vw - MARGIN - W, width: W, maxHeight: maxH, height: H };
        case 'top-left':
            return { top: MARGIN + ORB + GAP, left: MARGIN, width: W, maxHeight: maxH, height: H };
    }
}

export function PinnedChatPopover() {
    const { pinnedChat, isPopoverOpen, setPopoverOpen, snapPosition, unpinChat, incrementUnread } = usePinnedChatStore();
    const { integratedAgents, dispatchMessage } = useChatRouter();

    // Close animation state
    const [isVisible, setIsVisible] = useState(false);
    const [isClosing, setIsClosing] = useState(false);

    // Animate open/close
    useEffect(() => {
        if (isPopoverOpen && pinnedChat) {
            setIsClosing(false);
            // Small delay for mount-then-animate
            requestAnimationFrame(() => setIsVisible(true));
        } else if (!isPopoverOpen && isVisible) {
            // Trigger close animation
            setIsClosing(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsClosing(false);
            }, 180);
            return () => clearTimeout(timer);
        }
    }, [isPopoverOpen, pinnedChat]);

    // Close with Escape key
    useEffect(() => {
        if (!isVisible) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setPopoverOpen(false);
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [isVisible, setPopoverOpen]);

    const handleMinimize = useCallback(() => {
        setPopoverOpen(false);
    }, [setPopoverOpen]);

    // Local message state
    const [dbMessages, setDbMessages] = useState<any[]>([]);
    const [localMessages, setLocalMessages] = useState<any[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const [isAgentThinking, setIsAgentThinking] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    // Track message count at send time so we can detect new socket messages
    const socketMsgCountAtSend = useRef<number>(0);
    const lastSendAgentId = useRef<string>('');
    // Track which assistant messages have been persisted to DB already
    const persistedMsgIds = useRef(new Set<string>());
    const persistTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    // ─── Listen to socket store reactively for agent responses ───
    const socketMessages = useSocketStore((s) => s.chatMessages);

    // Watch for new agent messages from the socket store
    useEffect(() => {
        if (!pinnedChat || pinnedChat.mode !== 'agent' || !lastSendAgentId.current) return;

        const agentId = lastSendAgentId.current;
        // Find messages from this agent that appeared AFTER our send
        const relevantMsgs = socketMessages.filter(
            (m, idx) => idx >= socketMsgCountAtSend.current &&
                m.role === 'assistant' &&
                (m.agentId === agentId ||
                 (m.agentId && agentId && (m.agentId.includes(agentId) || agentId.includes(m.agentId))))
        );

        if (relevantMsgs.length > 0) {
            setLocalMessages(prev => {
                const existingIds = new Set(prev.map(m => m.id));
                let changed = false;
                const updated = [...prev];

                for (const socketMsg of relevantMsgs) {
                    const existingIdx = updated.findIndex(m => m.id === socketMsg.id);
                    if (existingIdx >= 0) {
                        // Update content if changed
                        if (updated[existingIdx].content !== socketMsg.content ||
                            updated[existingIdx].streaming !== socketMsg.streaming) {
                            updated[existingIdx] = {
                                ...updated[existingIdx],
                                content: socketMsg.content,
                                streaming: socketMsg.streaming,
                                tool_calls: socketMsg.tool_calls,
                            };
                            changed = true;
                        }
                    } else {
                        updated.push({
                            ...socketMsg,
                            _sortTime: Date.now(),
                        });
                        changed = true;

                        // Increment unread if popover is closed
                        if (!socketMsg.streaming) {
                            incrementUnread();
                        }
                    }
                }

                if (!changed) return prev;
                return updated;
            });

            // Check if still streaming
            const anyStreaming = relevantMsgs.some(m => m.streaming);
            setIsAgentThinking(anyStreaming);
            if (!anyStreaming && relevantMsgs.length > 0) {
                setIsSending(false);
            }

            // ─── Persist completed assistant messages to DB ───
            for (const msg of relevantMsgs) {
                if (
                    msg.role === 'assistant' &&
                    msg.streaming === false &&
                    msg.content &&
                    !persistedMsgIds.current.has(msg.id)
                ) {
                    // Debounce: clear any existing timeout for this msg
                    if (persistTimeouts.current.has(msg.id)) {
                        clearTimeout(persistTimeouts.current.get(msg.id)!);
                    }
                    const timeoutId = setTimeout(() => {
                        persistedMsgIds.current.add(msg.id);
                        persistTimeouts.current.delete(msg.id);
                        fetch('/api/chat/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                conversation_id: pinnedChat!.conversationId,
                                role: 'assistant',
                                content: msg.content,
                                metadata: {
                                    agentId: msg.agentId || pinnedChat!.agentId,
                                    tool_calls: msg.tool_calls?.length || 0,
                                    source: 'pinned-agent',
                                },
                            }),
                        }).catch(err => console.error('[Pinned persist assistant msg]', err));
                    }, 1500);
                    persistTimeouts.current.set(msg.id, timeoutId);
                }
            }
        }
    }, [socketMessages, pinnedChat]);

    // ─── Also detect "thinking" state from OpenClaw active runs ───
    const openClawActiveRuns = useOpenClawStore((s) => s.activeRuns);
    useEffect(() => {
        if (!pinnedChat || pinnedChat.mode !== 'agent') return;
        let found = false;
        openClawActiveRuns.forEach((run: any) => {
            const sk = run.sessionKey || '';
            if ((sk.includes(pinnedChat.agentId) || sk === 'unknown') && run.status === 'running') {
                found = true;
            }
        });
        if (found && !isAgentThinking) {
            setIsAgentThinking(true);
        }
    }, [openClawActiveRuns, pinnedChat]);

    // Fetch conversation history when popover opens
    useEffect(() => {
        if (!isPopoverOpen || !pinnedChat) {
            return;
        }

        let cancelled = false;
        setIsLoadingHistory(true);

        fetch(`/api/chat/messages?conversation_id=${encodeURIComponent(pinnedChat.conversationId)}`)
            .then(res => res.ok ? res.json() : { messages: [] })
            .then(data => {
                if (!cancelled) {
                    setDbMessages(data.messages || []);
                    setLocalMessages([]);
                    setIsLoadingHistory(false);
                }
            })
            .catch(() => {
                if (!cancelled) setIsLoadingHistory(false);
            });

        return () => { cancelled = true; };
    }, [isPopoverOpen, pinnedChat?.conversationId]);

    // Merged messages (DB + local live)
    const allMessages = useMemo(() => {
        const dbIds = new Set(dbMessages.map((m: any) => String(m.id)));
        const merged = [...dbMessages];

        for (const m of localMessages) {
            if (!dbIds.has(String(m.id))) {
                merged.push(m);
            }
        }

        merged.sort((a: any, b: any) => {
            const ta = a.created_at ? new Date(a.created_at).getTime() : (a._sortTime || 0);
            const tb = b.created_at ? new Date(b.created_at).getTime() : (b._sortTime || 0);
            return ta - tb;
        });

        return merged;
    }, [dbMessages, localMessages]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            if (scrollHeight - scrollTop - clientHeight <= 120) {
                requestAnimationFrame(() => {
                    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                });
            }
        }
    }, [allMessages.length, allMessages[allMessages.length - 1]?.content]);

    const scrollToBottom = useCallback(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, []);

    // Initial scroll to bottom on open
    useEffect(() => {
        if (isPopoverOpen && !isLoadingHistory && allMessages.length > 0) {
            setTimeout(scrollToBottom, 100);
        }
    }, [isPopoverOpen, isLoadingHistory]);

    const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 120);
    }, []);

    // ─── Send Message ───
    const handleSend = useCallback(async () => {
        if (!message.trim() || !pinnedChat || isSending) return;
        const cleanMsg = message.trim();
        setMessage('');
        setIsSending(true);
        setIsAgentThinking(true);

        // Reset textarea height
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        const msgId = `pinned-user-${Date.now()}`;
        const userMsg = {
            id: msgId,
            role: 'user',
            content: cleanMsg,
            timestamp: new Date().toLocaleTimeString(),
            _sortTime: Date.now(),
        };
        setLocalMessages(prev => [...prev, userMsg]);

        const isCompanion = pinnedChat.mode === 'companion';

        if (isCompanion) {
            // ═══ COMPANION MODE ═══
            const streamId = `pinned-companion-${Date.now()}`;
            const streamMsg = {
                id: streamId,
                role: 'assistant',
                content: '',
                streaming: true,
                _sortTime: Date.now() + 1,
            };
            setLocalMessages(prev => [...prev, streamMsg]);

            try {
                const { useCompanionProfileStore } = await import('@/stores/useCompanionProfileStore');
                const compStore = useCompanionProfileStore.getState();
                const systemPrompt = compStore.getCompiledMarkdown(pinnedChat.agentId, pinnedChat.agentName);

                const modelStore = useOpenClawModelStore.getState();
                const getModel = (role: string) =>
                    modelStore.activeModels[role as keyof typeof modelStore.activeModels]?.[pinnedChat.agentId]
                    || modelStore.defaults[role as keyof typeof modelStore.defaults]
                    || '';
                const companionModel = getModel('companion_chat') || getModel('companion') || '';

                const history = allMessages.slice(-20).map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));
                history.push({ role: 'user', content: cleanMsg });

                // Persist user message
                fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: pinnedChat.conversationId,
                        role: 'user',
                        content: cleanMsg,
                        metadata: { source: 'pinned-companion' },
                    }),
                }).catch(() => {});

                const res = await fetch('/api/companion-chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        agent_id: pinnedChat.agentId,
                        agent_name: pinnedChat.agentName,
                        model_ref: companionModel,
                        system_prompt: systemPrompt,
                        messages: history,
                        conversation_id: pinnedChat.conversationId,
                        task_type: 'chat',
                    }),
                });

                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let full = '';

                setIsAgentThinking(false);

                if (reader) {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value, { stream: true });
                        for (const line of chunk.split('\n')) {
                            if (!line.startsWith('data: ')) continue;
                            try {
                                const parsed = JSON.parse(line.slice(6).trim());
                                if (parsed.content) {
                                    full += parsed.content;
                                    setLocalMessages(prev =>
                                        prev.map(m => m.id === streamId
                                            ? { ...m, content: full }
                                            : m
                                        )
                                    );
                                }
                                if (parsed.done) {
                                    setLocalMessages(prev =>
                                        prev.map(m => m.id === streamId
                                            ? { ...m, content: full, streaming: false }
                                            : m
                                        )
                                    );
                                }
                            } catch {}
                        }
                    }
                }

                // Persist assistant message
                if (full) {
                    fetch('/api/chat/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            conversation_id: pinnedChat.conversationId,
                            role: 'assistant',
                            content: full,
                            metadata: { source: 'pinned-companion' },
                        }),
                    }).catch(() => {});

                    // Increment unread if popover was closed during streaming
                    incrementUnread();
                }
            } catch (err: any) {
                setLocalMessages(prev =>
                    prev.map(m => m.id === streamId
                        ? { ...m, content: `⚠️ Error: ${err.message}`, streaming: false }
                        : m
                    )
                );
            }
            setIsSending(false);
            setIsAgentThinking(false);
        } else {
            // ═══ AGENT MODE ═══
            // Record socket message count BEFORE sending so we can detect new responses
            socketMsgCountAtSend.current = useSocketStore.getState().chatMessages.length;
            lastSendAgentId.current = pinnedChat.agentId;

            const sessionKey = `agent:${pinnedChat.agentId}:nchat`;

            // Build the message with system directive (same as chat page)
            let finalMessage = cleanMsg;
            if (pinnedChat.conversationId) {
                finalMessage = `[SYSTEM DIRECTIVE — WORKSPACE CONTEXT]\nUser is currently talking in Chat Workspace ID: ${pinnedChat.conversationId}\n\n${finalMessage}`;
            }

            // Persist user message to DB (clean content, without workspace directive)
            fetch('/api/chat/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: pinnedChat.conversationId,
                    role: 'user',
                    content: cleanMsg,
                    metadata: { source: 'pinned-agent' },
                }),
            }).catch(() => {});

            // Dispatch through OpenClaw with system directive — let socket handle the response
            // skipStoreAdd=true because we already have the user message in localMessages
            dispatchMessage(pinnedChat.agentId, finalMessage, sessionKey, undefined, true);

            // isSending remains true — will be cleared by socket message watcher
            // Auto-clear safety net (60s timeout)
            setTimeout(() => {
                setIsSending(false);
                setIsAgentThinking(false);
            }, 60000);
        }
    }, [message, pinnedChat, isSending, allMessages, dispatchMessage, incrementUnread]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }, [handleSend]);

    if (!isVisible && !isPopoverOpen) return null;
    if (!pinnedChat) return null;

    const posStyle = getPopoverPosition(snapPosition);
    const agent = integratedAgents.find(a => a.id === pinnedChat.agentId);

    return (
        <div
            className="ofiere-pinned-popover"
            style={{
                position: 'fixed',
                ...posStyle,
                zIndex: 9997,
                display: 'flex',
                flexDirection: 'column',
                borderRadius: 6,
                overflow: 'hidden',
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                boxShadow: '0 12px 48px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.3)',
                animation: isClosing
                    ? 'ofiere-popover-close 180ms ease-in forwards'
                    : 'scaleIn 150ms ease-out both',
            }}
        >
            {/* ─── Header ─── */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 12px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--popover)',
                flexShrink: 0,
            }}>
                <AgentAvatar
                    agentId={pinnedChat.agentId}
                    name={pinnedChat.agentName}
                    size={28}
                    showStatus
                    isOnline={agent?.isOnline ?? false}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--popover-foreground)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                    }}>
                        {pinnedChat.agentName}
                    </div>
                    <div style={{
                        fontSize: 10,
                        color: 'var(--muted-foreground)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        letterSpacing: '0.02em',
                    }}>
                        <MessageSquare style={{ width: 9, height: 9, flexShrink: 0, opacity: 0.7 }} />
                        {pinnedChat.conversationTitle || 'Pinned Chat'}
                        {pinnedChat.mode === 'companion' && (
                            <span style={{
                                marginLeft: 4,
                                fontSize: 9,
                                padding: '0px 4px',
                                borderRadius: 2,
                                background: 'rgba(236,72,153,0.12)',
                                color: '#f472b6',
                            }}>♥ Companion</span>
                        )}
                    </div>
                </div>
                <button
                    onClick={handleMinimize}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted-foreground)',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                        (e.target as HTMLElement).style.background = 'var(--accent)';
                        (e.target as HTMLElement).style.color = 'var(--popover-foreground)';
                    }}
                    onMouseLeave={e => {
                        (e.target as HTMLElement).style.background = 'transparent';
                        (e.target as HTMLElement).style.color = 'var(--muted-foreground)';
                    }}
                    title="Minimize"
                >
                    <Minimize2 style={{ width: 12, height: 12 }} />
                </button>
                <button
                    onClick={() => { setPopoverOpen(false); unpinChat(); }}
                    style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--muted-foreground)',
                        transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                        (e.target as HTMLElement).style.background = 'rgba(239,68,68,0.12)';
                        (e.target as HTMLElement).style.color = '#ef4444';
                    }}
                    onMouseLeave={e => {
                        (e.target as HTMLElement).style.background = 'transparent';
                        (e.target as HTMLElement).style.color = 'var(--muted-foreground)';
                    }}
                    title="Close & Unpin"
                >
                    <XIcon style={{ width: 12, height: 12 }} />
                </button>
            </div>

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

            {/* ─── Messages ─── */}
            <div
                ref={scrollRef}
                onScroll={handleScroll}
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    scrollbarWidth: 'thin',
                    scrollbarColor: 'var(--border) transparent',
                }}
            >
                {isLoadingHistory && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        padding: 16,
                        color: 'var(--muted-foreground)',
                        fontSize: 11,
                    }}>
                        <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                        Loading history…
                    </div>
                )}

                {!isLoadingHistory && allMessages.length === 0 && (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flex: 1,
                        gap: 6,
                        color: 'var(--muted-foreground)',
                        fontSize: 11,
                        textAlign: 'center',
                        padding: 16,
                        opacity: 0.5,
                    }}>
                        <MessageSquare style={{ width: 20, height: 20 }} />
                        <span>No messages yet</span>
                    </div>
                )}

                {allMessages.map((msg: any, idx: number) => {
                    const isUser = msg.role === 'user';
                    const content = (msg.content || '').trim();
                    const displayContent = isUser ? stripSystemDirective(content) : content;

                    // Hide background JSON bleed (same as chat page)
                    if (!isUser && isBackgroundJSON(displayContent)) return null;
                    if (!displayContent && !msg.streaming) return null;
                    // Hide handoff protocol prompts
                    if (isUser && displayContent.includes('[SYSTEM DIRECTIVE \u2014 HANDOFF PROTOCOL]')) return null;

                    return (
                        <div
                            key={msg.id || idx}
                            style={{
                                display: 'flex',
                                justifyContent: isUser ? 'flex-end' : 'flex-start',
                                animation: idx >= allMessages.length - 2 ? 'ofiere-chat-slide-in 0.25s ease-out both' : 'none',
                            }}
                        >
                            <div style={{
                                maxWidth: '82%',
                                padding: '6px 10px',
                                borderRadius: isUser ? '8px 8px 2px 8px' : '8px 8px 8px 2px',
                                background: isUser
                                    ? 'rgba(255,109,41,0.1)'
                                    : 'var(--accent)',
                                border: `1px solid ${isUser
                                    ? 'rgba(255,109,41,0.15)'
                                    : 'var(--border)'}`,
                                fontSize: 12,
                                lineHeight: 1.5,
                                color: 'var(--popover-foreground)',
                                wordBreak: 'break-word',
                                overflowWrap: 'anywhere',
                            }}>
                                {msg.streaming && !displayContent ? (
                                    <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>
                                        Thinking
                                        <span style={{ animation: 'ofiereDot1 1.4s infinite' }}>.</span>
                                        <span style={{ animation: 'ofiereDot2 1.4s infinite' }}>.</span>
                                        <span style={{ animation: 'ofiereDot3 1.4s infinite' }}>.</span>
                                    </span>
                                ) : isUser ? (
                                    <span style={{ opacity: 0.9 }}>{displayContent}</span>
                                ) : (
                                    renderPinnedContent(displayContent)
                                )}
                            </div>
                        </div>
                    );
                })}

                {/* ─── Thinking Indicator ─── */}
                {isAgentThinking && !allMessages.some(m => m.streaming && m.role === 'assistant') && (
                    <div style={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        animation: 'ofiere-chat-slide-in 0.25s ease-out both',
                    }}>
                        <div style={{
                            padding: '8px 14px',
                            borderRadius: '8px 8px 8px 2px',
                            background: 'var(--accent)',
                            border: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                        }}>
                            <div className="ofiere-thinking-dots">
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-base, #FF6D29)', display: 'inline-block', animation: 'ofiere-thinking-bounce 1.4s ease-in-out infinite', animationDelay: '0s' }} />
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-base, #FF6D29)', display: 'inline-block', animation: 'ofiere-thinking-bounce 1.4s ease-in-out infinite', animationDelay: '0.2s', marginLeft: 3 }} />
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-base, #FF6D29)', display: 'inline-block', animation: 'ofiere-thinking-bounce 1.4s ease-in-out infinite', animationDelay: '0.4s', marginLeft: 3 }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Scroll-to-bottom button */}
            {showScrollBtn && (
                <div style={{
                    position: 'absolute',
                    bottom: 56,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 2,
                }}>
                    <button
                        onClick={scrollToBottom}
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--muted-foreground)',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        }}
                    >
                        <ChevronDown style={{ width: 12, height: 12 }} />
                    </button>
                </div>
            )}

            {/* ─── Divider ─── */}
            <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />

            {/* ─── Input ─── */}
            <div style={{
                padding: '8px 12px',
                background: 'var(--popover)',
                flexShrink: 0,
            }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 6,
                    background: 'transparent',
                    borderRadius: 6,
                    padding: '0',
                }}>
                    <textarea
                        ref={textareaRef}
                        value={message}
                        onChange={e => {
                            setMessage(e.target.value);
                            const el = e.target;
                            el.style.height = 'auto';
                            el.style.height = Math.min(el.scrollHeight, 80) + 'px';
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder={`Message ${pinnedChat.agentName}…`}
                        rows={1}
                        style={{
                            flex: 1,
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            fontSize: 12,
                            lineHeight: 1.45,
                            color: 'var(--popover-foreground)',
                            maxHeight: 80,
                            minHeight: 18,
                            fontFamily: 'inherit',
                            opacity: 0.8,
                        }}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!message.trim() || isSending}
                        style={{
                            width: 26,
                            height: 26,
                            borderRadius: 4,
                            background: message.trim()
                                ? 'var(--accent-base, #FF6D29)'
                                : 'transparent',
                            border: 'none',
                            cursor: message.trim() ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: message.trim()
                                ? 'white'
                                : 'var(--muted-foreground)',
                            transition: 'all 0.15s',
                            flexShrink: 0,
                        }}
                    >
                        {isSending
                            ? <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />
                            : <Send style={{ width: 12, height: 12 }} />
                        }
                    </button>
                </div>
            </div>

            {/* Animations */}
            <style jsx>{`
                @keyframes scaleIn {
                    from { opacity: 0; transform: scale(0.95) translateY(8px); }
                    to { opacity: 1; transform: scale(1) translateY(0); }
                }
                @keyframes ofiere-popover-close {
                    from { opacity: 1; transform: scale(1) translateY(0); }
                    to { opacity: 0; transform: scale(0.95) translateY(8px); }
                }
            `}</style>
        </div>
    );
}
