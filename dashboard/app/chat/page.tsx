"use client";

import dynamic from "next/dynamic";
import { useSocketStore } from "@/lib/useSocket";
import { useChatRouter } from "@/lib/useChatRouter";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, UIEvent } from "react";
import {
    Bot, User, Loader2, MessageSquare, Activity, Terminal as TerminalIcon,
    Wifi, WifiOff, ArrowDown, PanelLeftOpen, PanelLeftClose, ArrowUpRight,
    FileText, Image as ImageIcon, X as XIcon, Package, Check, Pencil,
    Target, Shield, Compass
} from "lucide-react";
import {
    IconPlus, IconPaperclip, IconCode, IconWorld, IconHistory,
    IconWand, IconSend, IconChevronDown
} from "@tabler/icons-react";
import { MessageRenderer } from "@/components/chat/MessageRenderer";

import { AgentAvatar } from "@/components/agents/AgentAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PromptChunkTray } from "@/components/prompt-chunks/PromptChunkTray";
import { ChatInputWithChunks } from "@/components/prompt-chunks/ChatInputWithChunks";

const UnifiedProcessTree = dynamic(
    () => import("@/components/chat/UnifiedProcessTree").then(mod => mod.UnifiedProcessTree),
    { ssr: false }
);

const ChatHistorySidebar = dynamic(
    () => import("@/components/chat/ChatHistorySidebar").then(mod => mod.ChatHistorySidebar),
    { ssr: false }
);
import { usePromptChunkStore } from "@/store/usePromptChunkStore";
import { useMemoryStore } from "@/store/useMemoryStore";
import { useChatStore } from "@/stores/useChatStore";
import { useOpenClawStore } from "@/store/useOpenClawStore";

import { parseOpenClawToolCalls } from "@/lib/openclawToolParser";
import { AgentZeroMessageCard, tryParseAgentZeroJSON } from "@/components/chat/AgentZeroMessageCard";
import { MissionBar, MissionConfig, getMissionSystemPrompt } from "@/components/chat/MissionBar";
import { TimelineScrubber } from "@/components/chat/TimelineScrubber";
import { QuotedReplyBanner } from "@/components/chat/QuotedReplyBanner";
import { StrategyModeSwitcher, StrategyMode, getStrategySystemPrompt } from "@/components/chat/StrategyModeSwitcher";
import { NextBestActionChip } from "@/components/chat/NextBestActionChip";
import { HandoffPacketModal } from "@/components/chat/HandoffPacketModal";

/* ─── Message Content Renderer (Clean Text Only) ─── */
const renderMessageContent = (content: string) => {
    if (!content) return null;

    // Detect Agent Zero structured JSON → render as clean card
    const a0Data = tryParseAgentZeroJSON(content);
    if (a0Data) return <AgentZeroMessageCard data={a0Data} />;

    // Use brace-counting parser to strip inline tool markup cleanly
    const { cleanedText } = parseOpenClawToolCalls(content);

    // Also strip any residual XML-like tags
    let finalContent = cleanedText
        .replace(/<\/?(?:final|function|tool|call|response)[^>]*>?\s*$/i, '')
        .replace(/<\/[a-zA-Z]*>?\s*$/i, '')
        .trim();

    // Strip <thinking>...</thinking> blocks (thinking is shown in Process Hierarchy)
    finalContent = finalContent
        .replace(/<thinking[\s>][\s\S]*?<\/thinking>/gi, '')  // complete tags
        .replace(/<thinking[\s>][\s\S]*$/gi, '')               // unclosed tag at end
        .replace(/<\/thinking>/gi, '')                          // stray closing tag
        .replace(/<thinking\s*$/gi, '')                         // partial opening tag at end
        .trim();

    if (!finalContent) return null;
    return <MessageRenderer content={finalContent} />;
};

/* ─── Strip injected prefixes from user messages for display ─── */
const stripInjectedPrefixes = (content: string): string => {
    if (!content) return content;
    let cleaned = content;
    // Strip [STRATEGY: ...] prefix line
    cleaned = cleaned.replace(/^\[STRATEGY:\s*\w+\]\s*—[^\n]*\n\n/i, '');
    // Strip [SYSTEM DIRECTIVE — MISSION GOAL] block
    cleaned = cleaned.replace(/^\[SYSTEM DIRECTIVE — MISSION GOAL\][\s\S]*?(?=\n\n\[|\n\n[^\[\n])/i, '');
    // Strip [SYSTEM DIRECTIVE — HARD CONSTRAINTS] block
    cleaned = cleaned.replace(/^\[SYSTEM DIRECTIVE — HARD CONSTRAINTS\][\s\S]*?(?=\n\n\[|\n\n[^\[\n])/i, '');
    // Strip legacy [MISSION GOAL] / [CONSTRAINTS] formats
    cleaned = cleaned.replace(/^\[MISSION GOAL\][^\n]*\n\n/i, '');
    cleaned = cleaned.replace(/^\[CONSTRAINTS\]\n(?:-[^\n]*\n)*\n/i, '');
    // Clean up leading whitespace
    cleaned = cleaned.replace(/^\n+/, '');
    return cleaned.trim();
};

/* ─── Detect mode indicators from message content (fallback for legacy messages) ─── */
const detectModeIndicators = (content: string) => {
    if (!content) return null;
    const hasGoal = /\[SYSTEM DIRECTIVE — MISSION GOAL\]/m.test(content) || /^\[MISSION GOAL\]/m.test(content);
    const hasConstraints = /\[SYSTEM DIRECTIVE — HARD CONSTRAINTS\]/m.test(content) || /^\[CONSTRAINTS\]/m.test(content);
    const hasStrategy = /^\[STRATEGY:/m.test(content);
    const strategyMatch = content.match(/^\[STRATEGY:\s*(\w+)\]/m);
    if (!hasGoal && !hasConstraints && !hasStrategy) return null;
    return {
        hasGoal,
        hasConstraints,
        hasStrategy,
        strategyMode: strategyMatch ? strategyMatch[1].toLowerCase() : undefined,
    };
};

/* ─── Page Component ─── */
export default function ChatPage() {
    const { integratedAgents, getMessagesForAgent, dispatchMessage, isOpenClawConnected } = useChatRouter();
    const { sessions, setChatMessages } = useSocketStore();
    const router = useRouter();
    const [message, setMessage] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('nerv_active_agent') || "";
        }
        return "";
    });
    const [selectedSessionKey, setSelectedSessionKey] = useState<string>("");
    const [activeConversationId, setActiveConversationId] = useState<string | undefined>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('nerv_active_conversation') || undefined;
        }
        return undefined;
    });

    // ─── Unified Chat Store (DB persistence layer) ───
    const chatStore = useChatStore();

    useEffect(() => {
        if (activeConversationId) {
            localStorage.setItem('nerv_active_conversation', activeConversationId);
        } else {
            localStorage.removeItem('nerv_active_conversation');
        }
    }, [activeConversationId]);

    // Sync agent selection into unified store for DB operations
    useEffect(() => {
        if (selectedAgentId) {
            localStorage.setItem('nerv_active_agent', selectedAgentId);
            if (selectedAgentId !== chatStore.activeAgentId) {
                chatStore.setActiveAgent(selectedAgentId);
            }
        } else {
            localStorage.removeItem('nerv_active_agent');
        }
    }, [selectedAgentId]);

    // Sync conversation selection into unified store
    useEffect(() => {
        if (activeConversationId !== (chatStore.activeConversationId || undefined)) {
            chatStore.setActiveConversation(activeConversationId || null);
        }
    }, [activeConversationId]);
    
    // DB History Fetching and Pagination
    const { fetchMessages, messages: dbMessages, activeConversationId: storeConvoId, setMessages: setDbMessages, isLoading: isDbLoading, setActiveConversation: setStoreActiveConversation } = useMemoryStore();
    useEffect(() => {
        if (activeConversationId && activeConversationId !== storeConvoId) {
            fetchMessages(activeConversationId);
            // Clear live socket messages and process tree runs so they don't bleed into the new conversation
            const sk = selectedSessionKey || `agent:${selectedAgentId}:webchat`;
            setChatMessages([], sk);
            useOpenClawStore.getState().clearRunsForSession(sk);
        } else if (!activeConversationId) {
            const sk = selectedSessionKey || `agent:${selectedAgentId}:webchat`;
            setChatMessages([], sk);
            useOpenClawStore.getState().clearRunsForSession(sk);
            setDbMessages([]);
            setStoreActiveConversation(null); // Clear storeConvoId so returning to this conversation triggers fetch
        }
    }, [activeConversationId, storeConvoId, fetchMessages, setChatMessages, setDbMessages, setStoreActiveConversation, selectedSessionKey, selectedAgentId]);
    const [displayLimit, setDisplayLimit] = useState(10);
    const [editDraft, setEditDraft] = useState("");
    
    // Reset pagination when conversation changes
    useEffect(() => {
        setDisplayLimit(10);
    }, [activeConversationId, selectedAgentId]);
    const [showSidebar, setShowSidebar] = useState(false);
    const [processSidebarWidth, setProcessSidebarWidth] = useState(350);
    const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
    const [missionConfig, setMissionConfig] = useState<MissionConfig>({
        goalText: '',
        goalLocked: false,
        constraints: [],
    });
    const [pendingFiles, setPendingFiles] = useState<{ file: File; previewUrl?: string }[]>([]);
    const [quotedReply, setQuotedReply] = useState<{ text: string; messageId?: string } | null>(null);
    const [strategyMode, setStrategyMode] = useState<StrategyMode>('off');
    const [showHandoff, setShowHandoff] = useState(false);
    const [nextBestAction, setNextBestAction] = useState<string | null>(null);

    // Track mode indicators for Agent Zero messages (keyed by message content)
    const a0ModeIndicatorsRef = useRef<Map<string, any>>(new Map());

    const scrollRef = useRef<HTMLDivElement>(null);
    const isInteractingRef = useRef(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { chunks } = usePromptChunkStore();
    const [selectionPopup, setSelectionPopup] = useState<{ text: string; messageId: string; x: number; y: number } | null>(null);
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [sidebarRefreshTrigger, setSidebarRefreshTrigger] = useState(0);
    const [isBranching, setIsBranching] = useState(false);

    const handleFilesSelected = (files: File[]) => {
        if (files.length === 0) return;
        const newPending = files.map(file => ({
            file,
            previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
        }));
        setPendingFiles(prev => [...prev, ...newPending]);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Ignore if leaving to a child element within the dropzone
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsDraggingOver(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFilesSelected(files);
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = Array.from(e.clipboardData.items);
        const files = items
            .filter(item => item.kind === 'file')
            .map(item => item.getAsFile())
            .filter(Boolean) as File[];
            
        if (files.length > 0) {
            e.preventDefault();
            handleFilesSelected(files);
        }
    };

    // Sidebar resize logic
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingSidebar) return;
            const newWidth = document.body.clientWidth - e.clientX;
            setProcessSidebarWidth(Math.max(250, Math.min(newWidth, 800)));
        };

        const handleMouseUp = () => setIsDraggingSidebar(false);

        if (isDraggingSidebar) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDraggingSidebar]);

    // Text selection → floating quote icon
    useEffect(() => {
        const handleMouseUp = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.toString().trim()) {
                setSelectionPopup(null);
                return;
            }

            // Check if selection is inside a message bubble
            const range = sel.getRangeAt(0);
            const container = range.commonAncestorContainer as HTMLElement;
            const msgEl = (container.nodeType === 3 ? container.parentElement : container)?.closest('[data-msg-idx]');
            if (!msgEl) { setSelectionPopup(null); return; }

            const msgId = msgEl.getAttribute('data-msg-idx') || '';
            const rect = range.getBoundingClientRect();
            setSelectionPopup({
                text: sel.toString().slice(0, 200),
                messageId: msgId,
                x: rect.left + rect.width / 2,
                y: rect.top - 8,
            });
        };

        const handleMouseDown = (e: MouseEvent) => {
            // Dismiss if clicking outside the popup
            const popup = document.getElementById('nerv-selection-quote');
            if (popup && !popup.contains(e.target as Node)) {
                setSelectionPopup(null);
            }
        };

        document.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mousedown', handleMouseDown);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('mousedown', handleMouseDown);
        };
    }, []);

    // Sync selected agent
    useEffect(() => {
        if (!selectedAgentId && integratedAgents.length > 0) {
            setSelectedAgentId(integratedAgents[0].id);
        }
    }, [integratedAgents, selectedAgentId]);

    // Agent sessions
    const agentSessions = useMemo(() => {
        if (!selectedAgentId) return [];
        return sessions.filter((s: any) => s.agentId === selectedAgentId);
    }, [sessions, selectedAgentId]);

    // Default to webchat session
    useEffect(() => {
        if (agentSessions.length > 0 && !selectedSessionKey) {
            const webchat = agentSessions.find((s: any) => s.key?.includes('webchat'));
            setSelectedSessionKey(webchat?.key || agentSessions[0]?.key || "");
        }
    }, [agentSessions, selectedSessionKey]);

    // Filter messages
    const filteredMessages = useMemo(() => {
        if (!selectedAgentId) return [];
        return getMessagesForAgent(selectedAgentId);
    }, [selectedAgentId, getMessagesForAgent, integratedAgents]);

    // ─── Persist completed assistant messages to Supabase ───
    // When a streaming message finishes (streaming → false), save it to DB
    const persistedMsgIds = useRef<Set<string>>(new Set());
    useEffect(() => {
        if (!activeConversationId) return;

        for (const msg of filteredMessages) {
            // Only persist completed assistant messages that haven't been saved yet
            if (
                msg.role === 'assistant' &&
                msg.streaming === false &&
                msg.content &&
                msg.content.trim() &&
                !persistedMsgIds.current.has(msg.id)
            ) {
                persistedMsgIds.current.add(msg.id);

                // Fire-and-forget persist to Supabase
                fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: activeConversationId,
                        role: 'assistant',
                        content: msg.content,
                        metadata: {
                            agentId: msg.agentId || selectedAgentId,
                            tool_calls: msg.tool_calls?.length || 0,
                            source: 'streaming',
                        },
                    }),
                }).catch(err => console.error('[Persist assistant msg]', err));
            }
        }
    }, [filteredMessages, activeConversationId, selectedAgentId]);

    // Build the master list by merging DB history + live socket messages
    const allConversationMessages = useMemo(() => {
        if (!activeConversationId) return filteredMessages;

        // Hydrate DB messages: pull attachments from metadata so they render correctly
        const hydratedDb = dbMessages.map(m => {
            const meta = (m as any).metadata;
            const hydrated: any = { ...m };
            if (meta?.attachments && Array.isArray(meta.attachments)) {
                hydrated.attachments = meta.attachments;
            }
            // Normalize timestamp for rendering
            if (!hydrated.timestamp && hydrated.created_at) {
                hydrated.timestamp = new Date(hydrated.created_at).toLocaleTimeString();
            }
            return hydrated;
        });

        const merged = [...hydratedDb];
        const dbIds = new Set(hydratedDb.map(m => String(m.id)));
        for (const m of filteredMessages) {
             if (!dbIds.has(String(m.id))) merged.push(m);
        }
        return merged;
    }, [activeConversationId, dbMessages, filteredMessages]);

    // Apply pagination slice
    const visibleMessages = useMemo(() => {
        return allConversationMessages.slice(-displayLimit);
    }, [allConversationMessages, displayLimit]);

    const [showScrollBottom, setShowScrollBottom] = useState(false);

    // Auto-scroll
    const msgLength = visibleMessages.length;
    const lastMsgContent = visibleMessages[msgLength - 1]?.content;

    useEffect(() => {
        if (scrollRef.current) {
            // Prevent auto-scroll if user is currently highlighting/selecting text
            if (isInteractingRef.current) return;
            const selection = window.getSelection();
            if (selection && selection.toString().trim().length > 0) return;

            const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight <= 150;
            if (isNearBottom) {
                scrollRef.current.scrollTop = scrollHeight;
            }
        }
    }, [msgLength, lastMsgContent]);

    const handleScroll = (e: UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        const distFromBottom = scrollHeight - scrollTop - clientHeight;
        setShowScrollBottom(distFromBottom > 200);

        if (scrollTop === 0 && displayLimit < allConversationMessages.length) {
            const oldScrollHeight = scrollHeight;
            setDisplayLimit(prev => prev + 10);
            requestAnimationFrame(() => {
                if (scrollRef.current) {
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight - oldScrollHeight;
                }
            });
        }
    };

    const scrollToBottom = () => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    };

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeAgent = integratedAgents.find(a => a.id === selectedAgentId);
        const isAgentOnline = activeAgent?.isOnline;

        if (!message.trim() || !isAgentOnline || !selectedAgentId) return;
        const sessionKey = selectedSessionKey || `agent:${selectedAgentId}:webchat`;

        let resolvedMessage = message;
        resolvedMessage = resolvedMessage.replace(/⟦([^⟧]+)⟧/g, (match, name) => {
            const chunk = chunks.find(c => c.name === name);
            return chunk ? chunk.content : match;
        });

        // Clean user message (what the user actually typed) — for display only
        const cleanMessage = resolvedMessage.trim();

        // Build the injected message (sent to agent in background)
        let finalMessage = cleanMessage;

        // Inject strategy mode prefix
        const strategyPrefix = getStrategySystemPrompt(strategyMode);
        if (strategyPrefix) {
            finalMessage = `${strategyPrefix}\n\n${finalMessage}`;
        }

        // Inject mission config (goal + constraints)
        const missionPrefix = getMissionSystemPrompt(missionConfig);
        if (missionPrefix) {
            finalMessage = `${missionPrefix}\n\n${finalMessage}`;
        }

        // Inject quoted reply context
        if (quotedReply) {
            finalMessage = `> ${quotedReply.text}\n\n${finalMessage}`;
            setQuotedReply(null);
        }

        // Build mode indicators metadata for this message
        const modeIndicators = {
            hasGoal: !!missionConfig.goalText,
            hasConstraints: missionConfig.constraints.filter(c => c.locked).length > 0,
            hasStrategy: strategyMode !== 'off',
            strategyMode: strategyMode !== 'off' ? strategyMode : undefined,
        };

        // Process attachments: read to base64 for local display, upload to Supabase Storage for public URL
        let attachments: any[] | undefined = undefined;
        let publicAttachments: any[] | undefined = undefined;
        if (pendingFiles.length > 0) {
            // Step 1: Read files to base64 for immediate local rendering
            const base64Attachments = await Promise.all(pendingFiles.map(async pf => {
                return new Promise<any>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve({
                            name: pf.file.name,
                            type: pf.file.type,
                            size: pf.file.size,
                            url: reader.result as string // base64 data URL for local display
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(pf.file);
                });
            }));

            // Step 2: Upload each to Supabase Storage to get public https:// URLs
            publicAttachments = await Promise.all(base64Attachments.map(async (att) => {
                try {
                    const res = await fetch('/api/chat/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: att.name, type: att.type, data: att.url }),
                    });
                    if (res.ok) {
                        const { url: publicUrl } = await res.json();
                        return { ...att, publicUrl };
                    }
                } catch (err) {
                    console.error('[Upload attachment]', err);
                }
                return { ...att, publicUrl: null };
            }));

            // Use base64 URLs for local socket store display
            attachments = base64Attachments;
        }



        // Auto-create conversation via unified store if none is active
        let convoId = activeConversationId;
        if (!convoId) {
            try {
                const newId = await chatStore.createConversation(
                    selectedAgentId,
                    cleanMessage.substring(0, 60) || `Chat with ${selectedAgentName}`
                );
                if (newId) {
                    convoId = newId;
                    setActiveConversationId(newId);
                    setSidebarRefreshTrigger(prev => prev + 1);
                }
            } catch (err) {
                console.error('Failed to auto-create conversation:', err);
            }
        }

        // Persist user message to Supabase — store CLEAN message (no injected prefixes)
        if (convoId) {
            try {
                await fetch('/api/chat/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conversation_id: convoId,
                        role: 'user',
                        content: cleanMessage,
                        metadata: {
                            strategyMode,
                            quotedReply: quotedReply?.text,
                            modeIndicators,
                            attachments: publicAttachments?.map(a => ({
                                name: a.name,
                                type: a.type,
                                url: a.publicUrl || a.url, // prefer public URL, fallback to base64
                            })),
                        },
                    }),
                });
            } catch (err) {
                console.error('Failed to persist user message:', err);
            }
        }

        // Manually add the CLEAN user message to the socket store for display (with mode indicators)
        // Then dispatch the INJECTED message to the agent with skipStoreAdd=true
        if (activeAgent?.provider !== 'agent-zero') {
            const { addChatMessage: addToStore } = useSocketStore.getState();
            addToStore({
                id: `user-${crypto.randomUUID?.() || Date.now()}`,
                role: 'user',
                content: cleanMessage,
                timestamp: new Date().toLocaleTimeString(),
                agentId: selectedAgentId,
                sessionKey: sessionKey,
                streaming: false,
                attachments: attachments || publicAttachments,
                modeIndicators,
            } as any);
            // Dispatch injected message to agent — skip adding to store (we already added the clean version)
            dispatchMessage(selectedAgentId, finalMessage, sessionKey, publicAttachments || attachments, true);
        } else {
            // For Agent Zero: sendA0Message adds its own user message to the A0 store.
            // We store mode indicators in a ref map so the renderer can look them up.
            a0ModeIndicatorsRef.current.set(finalMessage, modeIndicators);
            dispatchMessage(selectedAgentId, finalMessage, sessionKey, publicAttachments || attachments);
        }

        setMessage("");
        setPendingFiles([]);
        setEditingMessageId(null);
    };

    const handleEscalate = () => {
        if (!selectedAgentId) return;
        const context = visibleMessages.slice(-5).map(m => m.content).join('\n');
        sessionStorage.setItem('nerv_escalation_topic', `[ESCALATION from ${selectedAgentId}]:\n${context}`);
        router.push('/summit');
    };

    // Get display name for selected agent
    const selectedAgentName = useMemo(() => {
        const agent = integratedAgents.find((a: any) => a.id === selectedAgentId);
        return agent?.name || 'Agent';
    }, [integratedAgents, selectedAgentId]);

    const activeAgent = integratedAgents.find(a => a.id === selectedAgentId);
    const isGlobalOrAgentConnected = activeAgent?.provider === 'agent-zero' ? activeAgent.isOnline : isOpenClawConnected;
    const isAgentZero = activeAgent?.provider === 'agent-zero' || activeAgent?.provider === 'external';

    // Build allAgents list for sidebar
    const allAgentsList = useMemo(() =>
        integratedAgents.map(a => ({ id: a.id, name: a.name })),
        [integratedAgents]
    );

    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return <div className="flex h-full gap-0" />;
    }

    return (
        <div className="flex h-full gap-0">

            {/* ═══ LEFT: Chat History Sidebar (collapsible) ═══ */}
            <div
                className="shrink-0 h-full overflow-hidden transition-all duration-200 ease-out"
                style={{
                    width: showSidebar ? 280 : 0,
                    opacity: showSidebar ? 1 : 0,
                    marginLeft: showSidebar ? -20 : 0,
                    marginRight: showSidebar ? 12 : 0,
                    borderRight: showSidebar ? '1px solid var(--border)' : 'none',
                }}
            >
                {showSidebar && selectedAgentId && (
                    <ChatHistorySidebar
                        agentId={selectedAgentId}
                        agentName={selectedAgentName}
                        allAgents={allAgentsList}
                        className="w-[280px] h-full"
                        activeConversationId={activeConversationId}
                        onSelectConversation={setActiveConversationId}
                        refreshTrigger={sidebarRefreshTrigger}
                    />
                )}
            </div>

            {/* ═══ CENTER: Main Chat Area ═══ */}
            <div className="flex flex-col flex-1 h-full gap-4 min-w-0">

                {/* ─── Top Bar: Sidebar Toggle | Agent Tabs | Session | Escalate ─── */}
                <div className="flex items-center justify-between pb-2">
                    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide shrink-0">
                        {/* Sidebar toggle */}
                        <button
                            onClick={() => setShowSidebar(!showSidebar)}
                            className="p-1.5 rounded-lg transition-colors hover:bg-white/5 shrink-0"
                            aria-label={showSidebar ? 'Close history sidebar' : 'Open history sidebar'}
                        >
                            {showSidebar
                                ? <PanelLeftClose className="w-4 h-4" style={{ color: 'var(--nerv-cyan)' }} />
                                : <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--nerv-text-tertiary)' }} />
                            }
                        </button>

                        {/* Agent tabs */}
                        {integratedAgents.map((agent: any) => {
                            const isSelected = selectedAgentId === agent.id;
                            const isOnline = agent.isOnline;

                            return (
                                <button
                                    key={agent.id}
                                    onClick={() => {
                                        setSelectedAgentId(agent.id);
                                        
                                        // Auto-select the default webchat session
                                        const webchatKey = `agent:${agent.id}:webchat`;
                                        const hasWebchat = agentSessions.some((s: any) => s.key === webchatKey);
                                        const newSessionKey = hasWebchat ? webchatKey : agentSessions.find((s:any) => s.agentId === agent.id)?.key || "";
                                        setSelectedSessionKey(newSessionKey);
                                        
                                        // Don't blank out the conversation. Instead, trigger a fresh state 
                                        // so the Sidebar and page load seamlessly.
                                        setActiveConversationId(undefined); 
                                        chatStore.setActiveAgent(agent.id);
                                    }}
                                    className={cn(
                                        "relative flex items-center text-xs h-8 px-4 gap-2.5 transition-all flex-shrink-0 rounded-full",
                                        isSelected
                                            ? "bg-orange-500/15 text-orange-400 border-2 border-orange-500/50 ring-2 ring-orange-500/20"
                                            : "bg-zinc-900/60 text-muted-foreground border border-zinc-800 hover:border-zinc-600 hover:text-foreground hover:bg-zinc-800/60"
                                    )}
                                >
                                    <div className={cn(
                                        "w-1.5 h-1.5 rounded-full shrink-0 transition-all",
                                        isOnline ? "bg-emerald-400" : "bg-zinc-600"
                                    )} />
                                    <span className="font-medium">{agent.name}</span>
                                </button>
                            );
                        })}

                        {/* Session selector */}
                        {(() => {
                            const items = [...agentSessions];
                            const webchatKey = `agent:${selectedAgentId}:webchat`;
                            if (!items.some((s: any) => s.key === webchatKey)) {
                                items.unshift({ key: webchatKey, kind: 'default', channel: 'webchat', displayName: 'webchat' } as any);
                            }
                            const displayKey = selectedSessionKey || webchatKey;
                            return (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 px-3 rounded-full text-xs text-muted-foreground hover:text-foreground ml-1"
                                        >
                                            <span>{displayKey?.split(':')?.[2] || 'session'}</span>
                                            <IconChevronDown className="size-3" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="rounded-2xl p-1.5">
                                        <DropdownMenuGroup className="space-y-1">
                                            {items.map((s: any) => (
                                                <DropdownMenuItem
                                                    key={s.key}
                                                    className="rounded-[calc(1rem-6px)] text-xs"
                                                    onClick={() => setSelectedSessionKey(s.key)}
                                                >
                                                    {s.key?.split(':')?.[2] || s.key || 'session'}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuGroup>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            );
                        })()}
                    </div>

                    {/* Right side: Escalate to Summit */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            onClick={handleEscalate}
                            disabled={!selectedAgentId || filteredMessages.length === 0}
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-3 gap-1.5 rounded-full disabled:opacity-30 transition-all"
                            style={{ color: 'var(--nerv-text-tertiary)' }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 12px var(--nerv-cyan-glow)';
                                (e.currentTarget as HTMLElement).style.color = 'var(--nerv-cyan)';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                (e.currentTarget as HTMLElement).style.color = 'var(--nerv-text-tertiary)';
                            }}
                        >
                            <ArrowUpRight className="w-3 h-3" />
                            Escalate to Summit
                        </Button>
                        <Button
                            onClick={() => setShowHandoff(true)}
                            disabled={!selectedAgentId || visibleMessages.length === 0}
                            variant="ghost"
                            size="sm"
                            className="text-xs h-8 px-3 gap-1.5 rounded-full disabled:opacity-30 transition-all"
                            style={{ color: 'var(--nerv-text-tertiary)' }}
                        >
                            <Package className="w-3 h-3" />
                            Handoff
                        </Button>
                    </div>
                </div>

                {/* ─── Main Content (Chat + Process Hierarchy) ─── */}
                <div className="flex-1 min-h-0 bg-transparent flex w-full gap-2">

                    {/* Chat column */}
                    <div 
                        className="flex-1 flex flex-col m-0 min-h-0 relative"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onPaste={handlePaste}
                    >
                        {isDraggingOver && (
                            <div className="absolute inset-0 z-50 m-2 rounded-2xl border-2 border-dashed border-orange-500/50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all">
                                <div className="p-4 rounded-full bg-orange-500/10 mb-2">
                                    <IconPaperclip className="w-8 h-8 text-orange-500" />
                                </div>
                                <p className="text-lg font-semibold text-foreground">Drop to add files</p>
                                <p className="text-sm text-muted-foreground">Attach images, documents, or data files</p>
                            </div>
                        )}

                        {/* ─── Mission Bar ─── */}
                        <MissionBar
                            conversationId={activeConversationId}
                            missionConfig={missionConfig}
                            onMissionChange={setMissionConfig}
                            className="mx-0 mb-2"
                        />

                        {/* Messages row: scroll + timeline scrubber */}
                        <div className="flex-1 min-h-0 flex">
                            <div 
                                ref={scrollRef} 
                                onScroll={handleScroll} 
                                onMouseDown={() => { isInteractingRef.current = true; }}
                                onMouseUp={() => { setTimeout(() => { isInteractingRef.current = false; }, 200); }}
                                className="flex-1 overflow-y-auto scrollbar-hide w-full pr-[4px] pb-5 relative flex flex-col pt-5"
                            >
                            {isDbLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 gap-3">
                                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--nerv-cyan)' }} />
                                    <p className="text-sm">Loading Neural Archives...</p>
                                </div>
                            ) : visibleMessages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 gap-3">
                                    <MessageSquare className="w-10 h-10" />
                                    <p className="text-sm">
                                        {selectedAgentId ? "No messages yet — start a conversation" : "Select an agent to begin"}
                                    </p>
                                </div>
                            ) : (
                                <div className="flex flex-col mt-auto w-full justify-end">
                                    {visibleMessages.map((msg, idx) => {
                                        const isFirstInGroup = idx === 0 || visibleMessages[idx - 1].role !== msg.role;
                                        const isUser = msg.role === 'user';
                                        const displayName = isUser ? 'You' : selectedAgentName;

                                        return (
                                            <div key={msg.id} data-msg-idx={idx} className={cn("flex w-full justify-start nerv-chat-bubble-enter", isFirstInGroup ? "mt-[12px]" : "mt-[4px]")}
                                                style={{ animationDelay: `${Math.min(idx * 30, 200)}ms` }}
                                            >
                                                <div className="flex-shrink-0 mr-[12px] w-[42px] flex flex-col justify-start items-center relative mt-[5px]">
                                                    {isFirstInGroup ? (
                                                        isUser ? (
                                                            <div className="w-[42px] h-[56px] rounded-[8px] flex items-center justify-center bg-orange-500/20 border border-orange-500/30">
                                                                <User className="w-5 h-5 text-orange-500" />
                                                            </div>
                                                        ) : (
                                                            <AgentAvatar agentId={selectedAgentId!} name={selectedAgentName} width={42} height={56} />
                                                        )
                                                    ) : (
                                                        <div className="w-[42px]" />
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-start min-w-0 flex-1">
                                                    {isFirstInGroup && (
                                                        <div className="flex items-center gap-1.5 mb-[2px] px-1">
                                                            <span className="text-[13px] font-semibold text-foreground">{displayName}</span>
                                                            <span className="text-[11px] text-muted-foreground">· {msg.timestamp}</span>
                                                        </div>
                                                    )}

                                                    {editingMessageId === msg.id ? (
                                                        <div className="flex flex-col gap-2 w-full mt-1 min-w-[200px]">
                                                            <Textarea 
                                                                autoFocus
                                                                value={editDraft} 
                                                                onChange={(e) => setEditDraft(e.target.value)}
                                                                className="text-[13px] bg-background text-foreground resize-none border-border/50 focus-visible:ring-1 focus-visible:ring-orange-500/50"
                                                                rows={4}
                                                            />
                                                            <div className="flex items-center gap-1 self-end mt-1">
                                                                <Button size="icon" variant="ghost" onClick={() => setEditingMessageId(null)} className="h-6 w-6 rounded-full hover:bg-white/10"><XIcon className="w-3.5 h-3.5 text-red-400" /></Button>
                                                                <Button size="icon" variant="ghost" onClick={async () => {
                                                                    if (editDraft.trim()) {
                                                                        const msgIndex = allConversationMessages.findIndex(m => m.id === msg.id);
                                                                        if (msgIndex >= 0) {
                                                                            // 1. Truncate DB messages from this point onward
                                                                            if (activeConversationId && msg.id) {
                                                                                try {
                                                                                    await fetch('/api/chat/messages', {
                                                                                        method: 'DELETE',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({
                                                                                            conversation_id: activeConversationId,
                                                                                            from_message_id: msg.id,
                                                                                        }),
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error('[Edit truncate DB]', err);
                                                                                }
                                                                            }

                                                                            // 2. Clear socket messages for this session
                                                                            const sk = selectedSessionKey || `agent:${selectedAgentId}:webchat`;
                                                                            setChatMessages([], sk);

                                                                            // 3. Re-fetch DB messages so UI shows truncated history
                                                                            if (activeConversationId) {
                                                                                await fetchMessages(activeConversationId);
                                                                            }

                                                                            // 4. Dispatch the edited message as a new user message (will be persisted + sent to agent)
                                                                            const sessionKey = selectedSessionKey || `agent:${selectedAgentId}:webchat`;

                                                                            // Persist edited user message to DB
                                                                            if (activeConversationId) {
                                                                                try {
                                                                                    await fetch('/api/chat/messages', {
                                                                                        method: 'POST',
                                                                                        headers: { 'Content-Type': 'application/json' },
                                                                                        body: JSON.stringify({
                                                                                            conversation_id: activeConversationId,
                                                                                            role: 'user',
                                                                                            content: editDraft,
                                                                                            metadata: { edited: true, original_message_id: msg.id },
                                                                                        }),
                                                                                    });
                                                                                } catch (err) {
                                                                                    console.error('[Edit persist]', err);
                                                                                }
                                                                            }

                                                                            // Send to agent for a regenerated response
                                                                            dispatchMessage(selectedAgentId, editDraft, sessionKey);
                                                                        }
                                                                    }
                                                                    setEditingMessageId(null);
                                                                }} className="h-6 w-6 rounded-full hover:bg-white/10"><Check className="w-3.5 h-3.5 text-green-400" /></Button>
                                                            </div>
                                                        </div>
                                                    ) : (renderMessageContent(isUser ? stripInjectedPrefixes(msg.content) : msg.content) || (msg.attachments && msg.attachments.length > 0)) && (
                                                        <div className="group/msg relative w-fit max-w-[85%]">
                                                            <div className={cn(
                                                                "px-[12px] py-[6px] text-[13px] leading-relaxed min-w-[80px] w-fit flex flex-col gap-2",
                                                                isUser
                                                                    ? "bg-accent text-foreground"
                                                                    : "bg-orange-500/35 text-white border border-orange-500/40",
                                                                isFirstInGroup ? "rounded-[12px]" : "rounded-tr-[12px] rounded-br-[12px] rounded-bl-[12px] rounded-tl-[4px]"
                                                            )}>
                                                                {msg.attachments && msg.attachments.length > 0 && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {msg.attachments.map((att: any, i: number) => (
                                                                            att.type?.startsWith('image/') ? (
                                                                                <img key={i} src={att.url || att} alt="attachment" className="max-w-[200px] max-h-[200px] rounded-md object-contain border border-border/50" />
                                                                            ) : (
                                                                                <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-background/50 border border-border/50 text-xs text-foreground">
                                                                                    <FileText className="w-4 h-4" />
                                                                                    <span className="truncate max-w-[150px]">{att.name || 'Document'}</span>
                                                                                </div>
                                                                            )
                                                                        ))}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-end gap-1">
                                                                    {renderMessageContent(isUser ? stripInjectedPrefixes(msg.content) : msg.content)}
                                                                    {msg.streaming && <Loader2 className="inline-block w-3 h-3 ml-1 text-muted-foreground animate-spin" />}
                                                                </div>
                                                                {/* Mode indicators for user messages */}
                                                                {isUser && (() => {
                                                                    const indicators = (msg as any).modeIndicators
                                                                        || (msg as any).metadata?.modeIndicators
                                                                        || a0ModeIndicatorsRef.current.get(msg.content)
                                                                        || detectModeIndicators(msg.content);
                                                                    const hasAny = indicators?.hasGoal || indicators?.hasConstraints || indicators?.hasStrategy;
                                                                    if (!hasAny) return null;
                                                                    return (
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            {indicators.hasGoal && (
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-success) 12%, transparent)', color: 'var(--nerv-success)', border: '1px solid color-mix(in srgb, var(--nerv-success) 20%, transparent)' }} title="Goal active">
                                                                                    <Target className="w-2.5 h-2.5" />
                                                                                    <span>Goal</span>
                                                                                </div>
                                                                            )}
                                                                            {indicators.hasConstraints && (
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-warn) 12%, transparent)', color: 'var(--nerv-warn)', border: '1px solid color-mix(in srgb, var(--nerv-warn) 20%, transparent)' }} title="Constraints active">
                                                                                    <Shield className="w-2.5 h-2.5" />
                                                                                    <span>Constraints</span>
                                                                                </div>
                                                                            )}
                                                                            {indicators.hasStrategy && (
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-cyan) 12%, transparent)', color: 'var(--nerv-cyan)', border: '1px solid color-mix(in srgb, var(--nerv-cyan) 20%, transparent)' }} title={`Strategy: ${indicators.strategyMode || 'active'}`}>
                                                                                    <Compass className="w-2.5 h-2.5" />
                                                                                    <span>{indicators.strategyMode ? indicators.strategyMode.charAt(0).toUpperCase() + indicators.strategyMode.slice(1) : 'Strategy'}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            {/* Hover toolbar — Edit & Branch */}
                                                            <div className="absolute -top-7 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 px-1 py-0.5 rounded-lg z-10" style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                                                <button onClick={() => { setEditDraft(msg.content); setEditingMessageId(msg.id); }} className="p-1 rounded hover:bg-white/10 transition-colors" title="Edit message"><Pencil className="w-3 h-3" style={{ color: 'var(--nerv-warn)' }} /></button>
                                                                <button onClick={async () => {
                                                                    if (!activeConversationId || !selectedAgentId || isBranching) return;
                                                                    setIsBranching(true);
                                                                    try {
                                                                        // 1. Create a new conversation for this branch
                                                                        const branchTitle = `Branch: ${(msg.content || '').slice(0, 40).trim() || 'Untitled'}…`;
                                                                        const res = await fetch('/api/chat/conversations', {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ agent_id: selectedAgentId, title: branchTitle }),
                                                                        });
                                                                        if (!res.ok) throw new Error('Failed to create branch conversation');
                                                                        const { conversation: newConvo } = await res.json();

                                                                        // 2. Copy all messages up to and including the branch point
                                                                        const msgIndex = allConversationMessages.findIndex(m => m.id === msg.id);
                                                                        const messagesToCopy = allConversationMessages.slice(0, msgIndex + 1);

                                                                        for (const m of messagesToCopy) {
                                                                            await fetch('/api/chat/messages', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({
                                                                                    conversation_id: newConvo.id,
                                                                                    role: m.role,
                                                                                    content: m.content,
                                                                                    metadata: { ...(m.metadata || {}), branched_from: activeConversationId },
                                                                                }),
                                                                            });
                                                                        }

                                                                        // 3. Switch to the new branched conversation
                                                                        setActiveConversationId(newConvo.id);
                                                                        setSidebarRefreshTrigger(prev => prev + 1);
                                                                    } catch (err) {
                                                                        console.error('[Branch from here]', err);
                                                                    } finally {
                                                                        setIsBranching(false);
                                                                    }
                                                                }} className="p-1 rounded hover:bg-white/10 transition-colors" title="Branch from here"><ArrowUpRight className="w-3 h-3" style={{ color: 'var(--nerv-cyan)' }} /></button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}


                        </div>

                            {/* ═══ BRANCHING OVERLAY ═══ */}
                            {isBranching && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                                    <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl" style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                                        <span className="text-[13px] font-medium text-foreground">Branching conversation…</span>
                                        <span className="text-[11px] text-muted-foreground">Copying messages to new branch</span>
                                    </div>
                                </div>
                            )}

                            {/* ═══ TIMELINE SCRUBBER ═══ */}
                            {selectedAgentId && visibleMessages.length > 0 && (
                                <div className="shrink-0 overflow-y-auto">
                                    <TimelineScrubber
                                        messages={visibleMessages}
                                        activeIndex={visibleMessages.length - 1}
                                        agentName={selectedAgentName}
                                        onScrubTo={(idx) => {
                                            const container = scrollRef.current;
                                            if (!container) return;
                                            const messageEls = container.querySelectorAll('[data-msg-idx]');
                                            const el = messageEls[idx];
                                            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* ─── Chat Input ─── */}
                        <div className="pt-2 pb-0 w-full relative">
                            {showScrollBottom && (
                                <button
                                    onClick={scrollToBottom}
                                    className="absolute left-1/2 -translate-x-1/2 -top-12 z-50 p-2 rounded-full bg-background/60 backdrop-blur-md border border-border/50 text-foreground shadow-lg hover:bg-accent transition-all flex items-center justify-center hover:-translate-y-1 hover:shadow-xl hover:scale-105"
                                    title="Jump to latest message"
                                    style={{
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    <ArrowDown className="w-4 h-4" style={{ color: 'var(--nerv-cyan)' }} />
                                </button>
                            )}

                            {/* Quoted Reply Banner */}
                            {quotedReply && (
                                <QuotedReplyBanner
                                    quotedText={quotedReply.text}
                                    sourceMessageId={quotedReply.messageId}
                                    onClear={() => setQuotedReply(null)}
                                    className="mb-2"
                                />
                            )}

                            <div className="bg-background border border-border shadow-sm rounded-3xl focus-within:ring-1 focus-within:ring-border/50 transition-all relative">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    className="sr-only"
                                    accept="image/*,.pdf,.txt,.md,.csv,.json,.doc,.docx,.xlsx"
                                    onChange={(e) => {
                                        const files = Array.from(e.target.files || []);
                                        handleFilesSelected(files);
                                        e.target.value = ''; // reset for re-select
                                    }}
                                />

                                {/* Attachment Preview Strip */}
                                {pendingFiles.length > 0 && (
                                    <div className="flex items-center gap-2 px-3 pt-3 pb-1 overflow-x-auto">
                                        {pendingFiles.map((pf, i) => (
                                            <div
                                                key={i}
                                                className="relative shrink-0 group rounded-lg overflow-hidden"
                                                style={{
                                                    width: 64, height: 64,
                                                    background: 'var(--nerv-surface-3)',
                                                    border: '1px solid var(--nerv-border-default)',
                                                }}
                                            >
                                                {pf.previewUrl ? (
                                                    <img src={pf.previewUrl} alt={pf.file.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center gap-0.5">
                                                        <FileText className="w-4 h-4" style={{ color: 'var(--nerv-text-tertiary)' }} />
                                                        <span className="text-[8px] truncate max-w-[56px] px-1" style={{ color: 'var(--nerv-text-ghost)' }}>
                                                            {pf.file.name.split('.').pop()}
                                                        </span>
                                                    </div>
                                                )}
                                                <button
                                                    onClick={() => {
                                                        if (pf.previewUrl) URL.revokeObjectURL(pf.previewUrl);
                                                        setPendingFiles(prev => prev.filter((_, j) => j !== i));
                                                    }}
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ background: 'rgba(0,0,0,0.6)' }}
                                                >
                                                    <XIcon className="w-2.5 h-2.5 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="px-3 pt-3 pb-2 grow">
                                    <form onSubmit={handleSendMessage}>
                                        <ChatInputWithChunks
                                            value={message}
                                            onChange={(e) => setMessage(e.target.value)}
                                            onSend={handleSendMessage}
                                            placeholder={activeAgent?.isOnline ? "Ask anything" : "Connection offline"}
                                            disabled={!activeAgent?.isOnline || !selectedAgentId}
                                            className="w-full bg-transparent! p-0 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground resize-none border-none outline-none text-[13px] min-h-10 max-h-[25vh]"
                                            rows={1}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = "auto";
                                                target.style.height = target.scrollHeight + "px";
                                            }}
                                        />
                                    </form>
                                </div>

                                <div className="mb-2 px-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 rounded-full border border-border hover:bg-accent"
                                                >
                                                    <IconPlus className="size-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="max-w-xs rounded-2xl p-1.5">
                                                <DropdownMenuGroup className="space-y-1">
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <IconPaperclip size={16} className="opacity-60" />
                                                        Attach Files
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs">
                                                        <IconCode size={16} className="opacity-60" />
                                                        Code Interpreter
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem className="rounded-[calc(1rem-6px)] text-xs">
                                                        <IconWorld size={16} className="opacity-60" />
                                                        Web Search
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => setShowSidebar(true)}
                                                    >
                                                        <IconHistory size={16} className="opacity-60" />
                                                        Chat History
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        <div className="ml-1 w-px h-0" />
                                        <StrategyModeSwitcher
                                            activeMode={strategyMode}
                                            onModeChange={setStrategyMode}
                                        />
                                        <div className="ml-1 w-px h-4 bg-border" />
                                        <PromptChunkTray />
                                    </div>

                                    <div>
                                        <Button
                                            type="submit"
                                            disabled={!message.trim() || !activeAgent?.isOnline}
                                            className="size-7 p-0 rounded-full bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                            onClick={handleSendMessage}
                                        >
                                            <IconSend className="size-3 text-primary-foreground" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ═══ RIGHT: Process Hierarchy Sidebar — UNCHANGED ═══ */}
                    {selectedAgentId && (
                        <div className="flex h-full shrink-0 group relative" style={{ width: processSidebarWidth }}>
                            {/* Resize Handle */}
                            <div
                                className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-10 flex items-center justify-center"
                                onMouseDown={() => setIsDraggingSidebar(true)}
                            >
                                <div className="w-0.5 h-12 bg-zinc-700/0 group-hover:bg-zinc-700/50 rounded-full transition-colors duration-300" />
                            </div>

                            <div className="w-full h-full border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900/30">
                                <UnifiedProcessTree
                                    agentId={selectedAgentId}
                                    provider={activeAgent?.provider || 'openclaw'}
                                    className="h-full"
                                    messages={allConversationMessages}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ═══ FLOATING TEXT SELECTION QUOTE ICON ═══ */}
            {selectionPopup && (
                <div
                    id="nerv-selection-quote"
                    className="fixed z-[300] flex items-center"
                    style={{
                        left: selectionPopup.x - 14,
                        top: selectionPopup.y - 28,
                    }}
                >
                    <button
                        onClick={() => {
                            setQuotedReply({ text: selectionPopup.text, messageId: selectionPopup.messageId });
                            setSelectionPopup(null);
                            window.getSelection()?.removeAllRanges();
                        }}
                        className="p-1.5 rounded-lg shadow-lg transition-transform hover:scale-110"
                        style={{
                            background: 'var(--popover)',
                            border: '1px solid var(--border)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                        }}
                        title="Quote selected text"
                    >
                        <MessageSquare className="w-3.5 h-3.5" style={{ color: 'var(--nerv-violet)' }} />
                    </button>
                </div>
            )}

            {/* ═══ HANDOFF PACKET MODAL ═══ */}
            <HandoffPacketModal
                isOpen={showHandoff}
                onClose={() => setShowHandoff(false)}
                conversationTitle={`Chat with ${selectedAgentName}`}
                agentName={selectedAgentName}
                messageCount={visibleMessages.length}
            />
        </div>
    );
}
