"use client";

import dynamic from "next/dynamic";
import { useSocketStore } from "@/lib/useSocket";
import { useChatRouter } from "@/lib/useChatRouter";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect, useMemo, useCallback, UIEvent } from "react";
import {
    Bot, User, Loader2, MessageSquare, Activity, Terminal as TerminalIcon,
    Wifi, WifiOff, ArrowDown, PanelLeftOpen, PanelLeftClose, ArrowUpRight,
    FileText, Image as ImageIcon, X as XIcon, Package, Check, Pencil,
    Target, Shield, Compass, Copy, Square, Brain, MessageSquareText, GitMerge,
    Heart
} from "lucide-react";
import {
    IconPlus, IconPaperclip, IconCode, IconWorld, IconHistory,
    IconWand, IconSend, IconChevronDown, IconPlayerStop
} from "@tabler/icons-react";
import { MessageRenderer } from "@/components/chat/MessageRenderer";
import { getGateway } from "@/lib/openclawGateway";

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
import { useCompanionModeStore } from "@/stores/useCompanionModeStore";
import { useOpenClawModelStore } from "@/stores/useOpenClawModelStore";

import { parseOpenClawToolCalls } from "@/lib/openclawToolParser";
import { AgentZeroMessageCard, tryParseAgentZeroJSON } from "@/components/chat/AgentZeroMessageCard";
import { MissionBar, MissionConfig, getMissionSystemPrompt } from "@/components/chat/MissionBar";
import { TimelineScrubber } from "@/components/chat/TimelineScrubber";
import { QuotedReplyBanner } from "@/components/chat/QuotedReplyBanner";
import { StrategyModeSwitcher, StrategyMode, getStrategySystemPrompt } from "@/components/chat/StrategyModeSwitcher";
import { NextBestActionChip } from "@/components/chat/NextBestActionChip";
import { HandoffPacketModal } from "@/components/chat/HandoffPacketModal";
import { ProjectPanel } from "@/components/chat/ProjectPanel";
import { useProjectStore } from "@/store/useProjectStore";
import { SessionConfigDropdowns } from "@/components/chat/SessionConfigDropdowns";
import { SlashCommandMenu, SlashCommand } from "@/components/chat/SlashCommandMenu";
import { useToolCallStream } from "@/hooks/useToolCallStream";

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
    const { integratedAgents, getMessagesForAgent, dispatchMessage, isOpenClawConnected, sendToolsHandshake } = useChatRouter();
    const { sessions, setChatMessages } = useSocketStore();
    const router = useRouter();
    useToolCallStream(); // Subscribe to tool-call webhook events for process hierarchy
    const [message, setMessage] = useState("");
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [slashQuery, setSlashQuery] = useState("");
    const [selectedAgentId, setSelectedAgentId] = useState<string>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('nerv_active_agent') || "";
        }
        return "";
    });
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
            const sk = `agent:${selectedAgentId}:nchat`;
            setChatMessages([], sk);
            useOpenClawStore.getState().clearRunsForSession(sk);
            
            const gw = getGateway();
            if (gw.isConnected && selectedAgentId) {
                gw.request('chat.inject', {
                    sessionKey: sk,
                    message: `[SYSTEM DIRECTIVE: User has switched to Chat Workspace ID: ${activeConversationId}]`
                }).catch(() => { /* session may not exist yet — safe to ignore */ });
            }
        } else if (!activeConversationId) {
            const sk = `agent:${selectedAgentId}:nchat`;
            setChatMessages([], sk);
            useOpenClawStore.getState().clearRunsForSession(sk);
            setDbMessages([]);
            setStoreActiveConversation(null); // Clear storeConvoId so returning to this conversation triggers fetch

            const gw = getGateway();
            if (gw.isConnected && selectedAgentId) {
                gw.request('chat.inject', {
                    sessionKey: sk,
                    message: `[SYSTEM DIRECTIVE: User has closed the prior chat workspace and is currently in an uninitialized workspace.]`
                }).catch(() => { /* session may not exist yet — safe to ignore */ });
            }
        }
    }, [activeConversationId, storeConvoId, fetchMessages, setChatMessages, setDbMessages, setStoreActiveConversation, selectedAgentId]);
    const [displayLimit, setDisplayLimit] = useState(10);
    const [editDraft, setEditDraft] = useState("");
    
    // Reset pagination when conversation changes
    useEffect(() => {
        setDisplayLimit(10);
    }, [activeConversationId, selectedAgentId]);

    // Send Tools Handshake automatically per session
    useEffect(() => {
        const agent = integratedAgents.find(a => a.id === selectedAgentId);
        if (selectedAgentId && agent && agent.provider !== 'agent-zero' && isOpenClawConnected && sendToolsHandshake) {
            const sessionKey = `agent:${selectedAgentId}:nchat`;
            const handshakeKey = `hs_v7_${sessionKey}`; // v7: direct gateway injection
            if (!sessionStorage.getItem(handshakeKey)) {
                console.warn("[DEBUG] TRIGGERING DIRECT HANDSHAKE!", sessionKey);
                sendToolsHandshake(sessionKey, selectedAgentId);
                sessionStorage.setItem(handshakeKey, 'true');
            }
        }
    }, [selectedAgentId, integratedAgents, isOpenClawConnected, sendToolsHandshake]);

    const [showSidebar, setShowSidebar] = useState(true);
    const [processSidebarWidth, setProcessSidebarWidth] = useState(280);
    const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
    const [missionConfig, setMissionConfig] = useState<MissionConfig>({
        goalText: '',
        goalLocked: false,
        constraints: [],
    });

    const [activeSessionConfigs, setActiveSessionConfigs] = useState<{ thinking: boolean, verbose: boolean, reasoning: boolean }>({ thinking: false, verbose: false, reasoning: false });
    const [autoOpenConfig, setAutoOpenConfig] = useState<'thinking' | 'verbose' | 'reasoning' | null>(null);
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

    // Filter messages
    const filteredMessages = useMemo(() => {
        if (!selectedAgentId) return [];
        return getMessagesForAgent(selectedAgentId);
    }, [selectedAgentId, getMessagesForAgent, integratedAgents]);

    // ─── Persist completed assistant messages to Supabase ───
    // When a streaming message finishes (streaming → false), wait briefly to ensure it has fully stabilized, then save to DB.
    const persistedMsgIds = useRef<Set<string>>(new Set());
    const persistTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

    useEffect(() => {
        if (!activeConversationId) return;

        for (const msg of filteredMessages) {
            const rawContent = (msg.content || '').trim();
            // Do not persist background LLM Handoff Extractions
            if (msg.role === 'assistant' && /^\s*\{\s*"sections"\s*:/i.test(rawContent)) {
                continue;
            }

            if (
                msg.role === 'assistant' &&
                msg.streaming === false &&
                rawContent &&
                !persistedMsgIds.current.has(msg.id)
            ) {
                // If text is still changing (react hooks refiring), we clear and restart the timeout
                if (persistTimeouts.current.has(msg.id)) {
                    clearTimeout(persistTimeouts.current.get(msg.id)!);
                }

                const timeoutId = setTimeout(() => {
                    persistedMsgIds.current.add(msg.id);
                    persistTimeouts.current.delete(msg.id);

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
                }, 1500); // 1.5s debounce ensures no late-arriving completion chunks are missed

                persistTimeouts.current.set(msg.id, timeoutId);
            }
        }
    }, [filteredMessages, activeConversationId, selectedAgentId]);

    // Cleanup persist timeouts on unmount
    useEffect(() => {
        return () => {
            persistTimeouts.current.forEach(t => clearTimeout(t));
        };
    }, []);

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
            // Add a numeric sort key from created_at for reliable ordering
            hydrated._sortTime = hydrated.created_at
                ? new Date(hydrated.created_at).getTime()
                : 0;
            // Also use sequence_number if available for sub-second ordering
            hydrated._seqNum = hydrated.sequence_number ?? 0;
            return hydrated;
        }).filter(m => {
            // Scrub accidentally saved Handoff Packet JSONs from legacy UI loads
            const rawContent = (m.content || '').trim();
            if (m.role === 'assistant' && /^\s*\{\s*"sections"\s*:/i.test(rawContent)) {
                return false;
            }
            return true;
        });

        // Deduplicate DB messages themselves: same role + same content = keep first only
        const seenDbContent = new Set<string>();
        const dedupedDb = hydratedDb.filter((m: any) => {
            const key = `${m.role}::${(m.content || '').trim().toLowerCase()}`;
            if (seenDbContent.has(key)) return false;
            seenDbContent.add(key);
            return true;
        });

        const merged = [...dedupedDb];
        const dbIds = new Set(dedupedDb.map((m: any) => String(m.id)));
        const dbContents = new Set(dedupedDb.map((m: any) => (m.content || '').trim().toLowerCase()).filter(Boolean));

        for (const m of filteredMessages) {
             let rawContent = (m.content || '').trim();
             
             // Strip out injected background System Directives so they don't visually bleed into the UI
             rawContent = rawContent.replace(/^\[SYSTEM DIRECTIVE[^\]]*\]\s*([^]*)/i, (match, rest) => {
                 // The regex matches the directive and leading spaces/newlines.
                 // If the directive was followed by "User is currently talking in Chat Workspace ID: <id>\n\n",
                 // we want to strip that specific string too.
                 const prefixStrip = rest.replace(/^User is currently talking in Chat Workspace ID: [a-zA-Z0-9-]+\s*/i, '');
                 return prefixStrip;
             }).trim();

             // If the message is completely empty after stripping (e.g. it was just the pure context ping), skip rendering
             if (!rawContent && (!m.tool_calls || m.tool_calls.length === 0)) {
                 continue;
             }

             // Hide background extraction runs (Handoff JSON generation) from bleeding into the visual UI
             if (m.role === 'assistant' && /^\s*\{\s*"sections"\s*:/i.test(rawContent)) {
                 continue;
             }

             if (!dbIds.has(String(m.id))) {
                 const lowerContent = rawContent.toLowerCase();
                 
                 // Strict Deduplication: if the exact cleaned text already exists in our Supabase history,
                 // and this isn't an actively streaming message, skip rendering this redundant gateway payload.
                 if (dbContents.has(lowerContent) && m.streaming !== true) {
                     continue;
                 }

                 // Live messages: use _sortTime if set during optimistic add, otherwise use Date.now()
                 const liveMsg = { ...m, content: rawContent } as any;
                 if (!liveMsg._sortTime) {
                     liveMsg._sortTime = Date.now();
                 }
                 liveMsg._seqNum = liveMsg._seqNum ?? Number.MAX_SAFE_INTEGER;
                 merged.push(liveMsg);
             }
        }

        // Sort by _sortTime (primary), then _seqNum (tiebreaker for same-second messages)
        merged.sort((a: any, b: any) => {
            const timeDiff = (a._sortTime || 0) - (b._sortTime || 0);
            if (timeDiff !== 0) return timeDiff;
            return (a._seqNum || 0) - (b._seqNum || 0);
        });

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
        const sessionKey = `agent:${selectedAgentId}:nchat`;

        // ── Capture values BEFORE clearing UI ──
        let resolvedMessage = message;
        resolvedMessage = resolvedMessage.replace(/⟦([^⟧]+)⟧/g, (match, name) => {
            const chunk = chunks.find(c => c.name === name);
            return chunk ? chunk.content : match;
        });

        const cleanMessage = resolvedMessage.trim();
        const capturedQuotedReply = quotedReply;
        const capturedStrategyMode = strategyMode;
        const capturedMissionConfig = missionConfig;
        const capturedPendingFiles = [...pendingFiles];
        const capturedAgentName = selectedAgentName;
        const capturedAgentId = selectedAgentId;
        const capturedActiveAgent = activeAgent;
        const capturedConvoId = activeConversationId;

        // ── INSTANTLY clear input + UI state (no delay) ──
        setMessage("");
        setPendingFiles([]);
        setEditingMessageId(null);
        if (capturedQuotedReply) setQuotedReply(null);

        // ── Build the injected message (for agent, not for display) ──
        let finalMessage = cleanMessage;

        // Inject project context (custom instructions + file contents)
        const projectContext = useProjectStore.getState().getProjectContext();
        if (projectContext) {
            finalMessage = `${projectContext}${finalMessage}`;
        }

        // Inject NERV specific context to tag memory correctly in global nchat
        if (capturedConvoId) {
            finalMessage = `[SYSTEM DIRECTIVE — WORKSPACE CONTEXT]\nUser is currently talking in Chat Workspace ID: ${capturedConvoId}\n\n${finalMessage}`;
        }

        const strategyPrefix = getStrategySystemPrompt(capturedStrategyMode);
        if (strategyPrefix) {
            finalMessage = `${strategyPrefix}\n\n${finalMessage}`;
        }

        const missionPrefix = getMissionSystemPrompt(capturedMissionConfig);
        if (missionPrefix) {
            finalMessage = `${missionPrefix}\n\n${finalMessage}`;
        }

        if (capturedQuotedReply) {
            finalMessage = `> ${capturedQuotedReply.text}\n\n${finalMessage}`;
        }

        const modeIndicators = {
            hasGoal: !!capturedMissionConfig.goalText,
            hasConstraints: capturedMissionConfig.constraints.filter(c => c.locked).length > 0,
            hasStrategy: capturedStrategyMode !== 'off',
            strategyMode: capturedStrategyMode !== 'off' ? capturedStrategyMode : undefined,
        };

        // ── Convert to base64 Data URLs for dispatch and store ──
        const base64Attachments = await Promise.all(capturedPendingFiles.map(async pf => {
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

        // ── INSTANTLY add user message to the store (optimistic) ──
        if (capturedActiveAgent?.provider !== 'agent-zero') {
            const { addChatMessage: addToStore } = useSocketStore.getState();
            addToStore({
                id: `user-${crypto.randomUUID?.() || Date.now()}`,
                role: 'user',
                content: cleanMessage,
                timestamp: new Date().toLocaleTimeString(),
                agentId: capturedAgentId,
                sessionKey: sessionKey,
                streaming: false,
                attachments: base64Attachments.length > 0 ? base64Attachments : undefined,
                modeIndicators,
                _sortTime: Date.now(),
            } as any);

            // ── Check companion mode ──
            const isCompanion = useCompanionModeStore.getState().isCompanionMode(capturedAgentId);

            if (isCompanion) {
                // ═══ COMPANION MODE: bypass OpenClaw, call companion API directly ═══
                // Determine which companion sub-role to use based on content
                const modelStore = useOpenClawModelStore.getState();
                const hasImageAttachment = base64Attachments.length > 0 && base64Attachments.some(
                    (a: any) => a.type?.startsWith('image/') || a.name?.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)
                );

                // Pick the appropriate companion sub-role model
                const getCompanionModel = (role: string): string => {
                    return modelStore.activeModels[role as keyof typeof modelStore.activeModels]?.[capturedAgentId]
                        || modelStore.defaults[role as keyof typeof modelStore.defaults]
                        || '';
                };

                // Fallback chain: specialized → companion_chat → legacy companion → empty
                const chatModel = getCompanionModel('companion_chat') || getCompanionModel('companion') || '';
                let companionModelRef: string;
                let taskType = 'chat';

                if (hasImageAttachment) {
                    companionModelRef = getCompanionModel('companion_vision') || chatModel;
                    taskType = 'vision';
                } else {
                    companionModelRef = chatModel;
                }

                // Get companion profile markdown
                const { useCompanionProfileStore } = await import('@/stores/useCompanionProfileStore');
                const companionStore = useCompanionProfileStore.getState();
                const systemPrompt = companionStore.getCompiledMarkdown(capturedAgentId, capturedAgentName);

                // If companion profile is empty, warn the user instead of proceeding
                if (!systemPrompt.trim()) {
                    addToStore({
                        id: `companion-warning-${Date.now()}`,
                        role: 'assistant',
                        content: `⚠️ **Companion profile is empty.**\n\nYour COMPANION.md for **${capturedAgentName}** has no persona data yet. Without it, companion mode won't have any personality context.\n\n**To fix this:**\n1. Go to **Capabilities → Core Files**\n2. Select the agent and click **COMPANION.md**\n3. Click **"Sync from Agent"** to auto-populate the persona from their OpenClaw files (SOUL.md, IDENTITY.md, etc.)\n4. Come back here and try again!`,
                        timestamp: new Date().toLocaleTimeString(),
                        agentId: capturedAgentId,
                        sessionKey: sessionKey,
                        _sortTime: Date.now(),
                    } as any);
                    return;
                }

                // Build history from visible messages (last 20 for context)
                const history = visibleMessages.slice(-20).map(m => ({
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                }));

                // Add current message
                history.push({ role: 'user', content: cleanMessage });

                // Add streaming placeholder
                const streamingMsgId = `companion-${Date.now()}`;
                addToStore({
                    id: streamingMsgId,
                    role: 'assistant',
                    content: '',
                    timestamp: new Date().toLocaleTimeString(),
                    agentId: capturedAgentId,
                    sessionKey: sessionKey,
                    streaming: true,
                    _sortTime: Date.now(),
                } as any);

                // Auto-create conversation if needed (for companion mode)
                let convoId = capturedConvoId;
                if (!convoId) {
                    try {
                        const newId = await chatStore.createConversation(
                            capturedAgentId,
                            cleanMessage.substring(0, 60) || `Companion chat with ${capturedAgentName}`,
                            'companion'
                        );
                        if (newId) {
                            convoId = newId;
                            setActiveConversationId(newId);
                            setSidebarRefreshTrigger(prev => prev + 1);
                        }
                    } catch (err) {
                        console.error('Failed to auto-create companion conversation:', err);
                    }
                }

                // Persist user message
                if (convoId) {
                    fetch('/api/chat/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            conversation_id: convoId,
                            role: 'user',
                            content: cleanMessage,
                            metadata: { source: 'companion' },
                        }),
                    }).catch(err => console.error('Failed to persist companion user msg:', err));
                }

                // Call companion chat API
                try {
                    const res = await fetch('/api/companion-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            agent_id: capturedAgentId,
                            agent_name: capturedAgentName,
                            model_ref: companionModelRef,
                            system_prompt: systemPrompt,
                            messages: history,
                            conversation_id: convoId,
                            task_type: taskType,
                        }),
                    });

                    if (!res.ok) {
                        const errData = await res.json().catch(() => ({ error: 'Unknown error' }));
                        throw new Error(errData.error || `HTTP ${res.status}`);
                    }

                    // Stream response
                    const reader = res.body?.getReader();
                    const decoder = new TextDecoder();
                    let fullContent = '';

                    if (reader) {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;

                            const chunk = decoder.decode(value, { stream: true });
                            const lines = chunk.split('\n');

                            for (const line of lines) {
                                if (!line.startsWith('data: ')) continue;
                                const data = line.slice(6).trim();
                                try {
                                    const parsed = JSON.parse(data);
                                    if (parsed.content) {
                                        fullContent += parsed.content;
                                        // Update streaming content in the store
                                        const { updateChatMessage } = useSocketStore.getState();
                                        if (updateChatMessage) {
                                            updateChatMessage(streamingMsgId, { content: fullContent });
                                        }
                                    }
                                    if (parsed.done) {
                                        // Finalize the message
                                        const { updateChatMessage } = useSocketStore.getState();
                                        if (updateChatMessage) {
                                            updateChatMessage(streamingMsgId, { content: fullContent, streaming: false });
                                        }
                                    }
                                } catch {
                                    // skip
                                }
                            }
                        }
                    }
                } catch (err: any) {
                    console.error('[Companion chat error]', err);
                    // Show error as assistant message
                    const { updateChatMessage } = useSocketStore.getState();
                    if (updateChatMessage) {
                        updateChatMessage(streamingMsgId, {
                            content: `⚠️ Companion mode error: ${err.message || 'Failed to reach model'}`,
                            streaming: false,
                        });
                    }
                }
            } else {
                // ═══ AGENT MODE: dispatch through OpenClaw as before ═══
                dispatchMessage(capturedAgentId, finalMessage, sessionKey, base64Attachments.length > 0 ? base64Attachments : undefined, true);
            }
        } else {
            a0ModeIndicatorsRef.current.set(finalMessage, modeIndicators);
            dispatchMessage(capturedAgentId, finalMessage, sessionKey, base64Attachments.length > 0 ? base64Attachments : undefined);
        }

        // ── BACKGROUND: file upload, conversation creation, DB persistence ──
        // All of this runs in the background — the UI is already updated above.
        // NOTE: For companion mode, persistence is handled inline above.
        const isCompanionBg = useCompanionModeStore.getState().isCompanionMode(capturedAgentId);
        if (!isCompanionBg) {
            (async () => {
                try {
                    // 1. Read files to base64 + upload to Supabase Storage (background)
                    let publicAttachments: any[] | undefined = undefined;
                    if (base64Attachments.length > 0) {

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
                    }

                    // 2. Auto-create conversation if needed (background)
                    let convoId = capturedConvoId;
                    if (!convoId) {
                        try {
                            const newId = await chatStore.createConversation(
                                capturedAgentId,
                                cleanMessage.substring(0, 60) || `Chat with ${capturedAgentName}`
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

                    // 3. Persist user message to Supabase (background)
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
                                        strategyMode: capturedStrategyMode,
                                        quotedReply: capturedQuotedReply?.text,
                                        modeIndicators,
                                        attachments: publicAttachments?.map(a => ({
                                            name: a.name,
                                            type: a.type,
                                            url: a.publicUrl || a.url,
                                        })),
                                    },
                                }),
                            });
                        } catch (err) {
                            console.error('Failed to persist user message:', err);
                        }
                    }
                } catch (err) {
                    console.error('[Background persist error]', err);
                }
            })();
        }
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
    const isGlobalOrAgentConnected = activeAgent?.isOnline ?? false;
    const isAgentZero = activeAgent?.provider === 'agent-zero' || activeAgent?.provider === 'external';

    // Detect if the agent is currently processing (any active run in "running" state)
    const openClawActiveRuns = useOpenClawStore((s) => s.activeRuns);
    const { isAgentProcessing, activeRunId } = useMemo(() => {
        if (!selectedAgentId) return { isAgentProcessing: false, activeRunId: undefined as string | undefined };
        let processing = false;
        let runId: string | undefined;
        openClawActiveRuns.forEach((run) => {
            const sk = run.sessionKey || '';
            if ((sk.includes(selectedAgentId) || sk === 'unknown' || sk === 'agent:default:main') && run.status === 'running') {
                processing = true;
                runId = run.runId;
            }
        });
        return { isAgentProcessing: processing, activeRunId: runId };
    }, [openClawActiveRuns, selectedAgentId]);

    // Scroll to bottom when thinking placeholder appears
    useEffect(() => {
        if (isAgentProcessing) {
            const t = setTimeout(scrollToBottom, 80);
            return () => clearTimeout(t);
        }
    }, [isAgentProcessing]);

    // Handle selecting a conversation from the sidebar — syncs companion mode toggle
    const handleSelectConversation = useCallback(async (conversationId: string | undefined) => {
        if (!conversationId || !selectedAgentId) {
            setActiveConversationId(conversationId);
            return;
        }

        // Try to determine the conversation's mode from the chatStore conversations map
        const convo = chatStore.conversations[conversationId];
        if (convo && convo.mode) {
            const shouldBeCompanion = convo.mode === 'companion';
            const currentlyCompanion = useCompanionModeStore.getState().isCompanionMode(selectedAgentId);
            if (shouldBeCompanion !== currentlyCompanion) {
                useCompanionModeStore.getState().setCompanionMode(selectedAgentId, shouldBeCompanion);
            }
        } else {
            // Fallback: fetch conversation details from the API if not in local store
            try {
                const res = await fetch(`/api/chat/conversations/${conversationId}`);
                if (res.ok) {
                    const data = await res.json();
                    const mode = data.conversation?.mode || 'agent';
                    const shouldBeCompanion = mode === 'companion';
                    const currentlyCompanion = useCompanionModeStore.getState().isCompanionMode(selectedAgentId);
                    if (shouldBeCompanion !== currentlyCompanion) {
                        useCompanionModeStore.getState().setCompanionMode(selectedAgentId, shouldBeCompanion);
                    }
                }
            } catch {
                // Non-critical — toggle stays as-is
            }
        }

        setActiveConversationId(conversationId);
    }, [selectedAgentId, chatStore.conversations]);

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
        <div className="flex h-full gap-0 -mx-3">

            {/* ═══ LEFT: Chat History Sidebar (collapsible) ═══ */}
            <div
                className="shrink-0 h-full overflow-hidden transition-all duration-200 ease-out"
                style={{
                    width: showSidebar ? 280 : 0,
                    opacity: showSidebar ? 1 : 0,
                    marginLeft: showSidebar ? -8 : 0,
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
                        onSelectConversation={handleSelectConversation}
                        refreshTrigger={sidebarRefreshTrigger}
                    />
                )}
            </div>

            {/* ═══ CENTER: Main Chat Area ═══ */}
            <div className="flex flex-col flex-1 h-full gap-3 min-w-0">

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
                                        
                                        // Don't blank out the conversation. Instead, trigger a fresh state 
                                        // so the Sidebar and page load seamlessly.
                                        setActiveConversationId(undefined); 
                                        chatStore.setActiveAgent(agent.id);
                                    }}
                                    className={cn(
                                        "relative flex items-center text-xs h-8 px-4 gap-2.5 transition-all flex-shrink-0 rounded-sm",
                                        isSelected
                                            ? "bg-orange-500/15 text-orange-400 border border-orange-500/60"
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
                    </div>

                    {/* Companion Mode Toggle */}
                    {selectedAgentId && (
                        <CompanionToggle
                            agentId={selectedAgentId}
                            onModeSwitch={() => setSidebarRefreshTrigger(t => t + 1)}
                        />
                    )}
                </div>

                {/* ─── Main Content (Chat + Process Hierarchy) ─── */}
                <div className="flex-1 min-h-0 bg-transparent flex w-full">

                    {/* Chat column */}
                    <div 
                        className="flex-1 flex flex-col m-0 min-h-0 relative"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onPaste={handlePaste}
                    >
                        {isDraggingOver && (
                            <div className="absolute inset-0 z-50 m-2 rounded-md border-2 border-dashed border-orange-500/50 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none transition-all">
                                <div className="p-4 rounded-sm bg-orange-500/10 mb-2">
                                    <IconPaperclip className="w-8 h-8 text-orange-500" />
                                </div>
                                <p className="text-lg font-semibold text-foreground">Drop to add files</p>
                                <p className="text-sm text-muted-foreground">Attach images, documents, or data files</p>
                            </div>
                        )}

                        {/* ─── Mission Bar moved to input area ─── */}

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
                            ) : !isGlobalOrAgentConnected ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-60 gap-3">
                                    <Activity className="w-10 h-10" />
                                    <p className="text-sm">Agent is offline — Waiting for connection...</p>
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
                                        // Hide empty assistant messages — the thinking placeholder covers this
                                        if (msg.role === 'assistant' && (!msg.content || !msg.content.trim())) return null;

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
                                                                <Button size="icon" variant="ghost" onClick={() => setEditingMessageId(null)} className="h-6 w-6 rounded-sm hover:bg-white/10"><XIcon className="w-3.5 h-3.5 text-red-400" /></Button>
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
                                                                            const sk = `agent:${selectedAgentId}:nchat`;
                                                                            setChatMessages([], sk);

                                                                            // 3. Re-fetch DB messages so UI shows truncated history
                                                                            if (activeConversationId) {
                                                                                await fetchMessages(activeConversationId);
                                                                            }

                                                                            // 4. Dispatch the edited message as a new user message (will be persisted + sent to agent)
                                                                            const sessionKey = `agent:${selectedAgentId}:nchat`;

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
                                                                }} className="h-6 w-6 rounded-sm hover:bg-white/10"><Check className="w-3.5 h-3.5 text-green-400" /></Button>
                                                            </div>
                                                        </div>
                                                    ) : (renderMessageContent(isUser ? stripInjectedPrefixes(msg.content) : msg.content) || (msg.attachments && msg.attachments.length > 0)) && (
                                                        <div className="group/msg relative w-fit" style={{ maxWidth: 'calc(100% - 3px)' }}>
                                                            <div className={cn(
                                                                "px-[12px] py-[6px] text-[13px] leading-relaxed min-w-[80px] w-fit flex flex-col gap-2",
                                                                isUser
                                                                    ? "bg-accent text-foreground"
                                                                    : "bg-orange-500/35 text-white border border-orange-500/40",
                                                                isFirstInGroup ? "rounded-[6px]" : "rounded-tr-[6px] rounded-br-[6px] rounded-bl-[6px] rounded-tl-[2px]"
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
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-success) 12%, transparent)', color: 'var(--nerv-success)', border: '1px solid color-mix(in srgb, var(--nerv-success) 20%, transparent)' }} title="Goal active">
                                                                                    <Target className="w-2.5 h-2.5" />
                                                                                    <span>Goal</span>
                                                                                </div>
                                                                            )}
                                                                            {indicators.hasConstraints && (
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-warn) 12%, transparent)', color: 'var(--nerv-warn)', border: '1px solid color-mix(in srgb, var(--nerv-warn) 20%, transparent)' }} title="Constraints active">
                                                                                    <Shield className="w-2.5 h-2.5" />
                                                                                    <span>Constraints</span>
                                                                                </div>
                                                                            )}
                                                                            {indicators.hasStrategy && (
                                                                                <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-sm text-[9px] font-medium" style={{ background: 'color-mix(in srgb, var(--nerv-cyan) 12%, transparent)', color: 'var(--nerv-cyan)', border: '1px solid color-mix(in srgb, var(--nerv-cyan) 20%, transparent)' }} title={`Strategy: ${indicators.strategyMode || 'active'}`}>
                                                                                    <Compass className="w-2.5 h-2.5" />
                                                                                    <span>{indicators.strategyMode ? indicators.strategyMode.charAt(0).toUpperCase() + indicators.strategyMode.slice(1) : 'Strategy'}</span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            {/* ─── Usage Metrics Bar (assistant only, non-streaming) ─── */}
                                                            {!isUser && !msg.streaming && msg.content && (() => {
                                                                const modelStore = useOpenClawModelStore.getState();
                                                                const agentKey = selectedAgentId || '';
                                                                const modelRef = modelStore.activeModels?.primary?.[agentKey]
                                                                    || modelStore.defaults?.primary
                                                                    || '';
                                                                // Extract just the model name (after the slash)
                                                                const modelName = modelRef.includes('/') ? modelRef.split('/').pop() : modelRef;
                                                                // Shorten long model names for display
                                                                const shortModel = modelName
                                                                    ? modelName.replace(/^claude-/, 'c-').replace(/^gpt-/, 'gpt-').replace(/-20\d{6}$/, '')
                                                                    : null;

                                                                const contentLen = msg.content.length;
                                                                const estTokens = Math.ceil(contentLen / 4);
                                                                const fmtTokens = estTokens >= 1000 ? `${(estTokens / 1000).toFixed(1)}k` : `${estTokens}`;
                                                                const fmtChars = contentLen >= 1000 ? `${(contentLen / 1000).toFixed(1)}k` : `${contentLen}`;

                                                                return (
                                                                    <div className="flex items-center gap-2 mt-1 px-1 text-[10px] text-white/25 font-mono select-none">
                                                                        <span title="Estimated output tokens (~4 chars/token)">↓{fmtTokens}</span>
                                                                        <span className="text-white/10">·</span>
                                                                        <span title="Response size (characters)">R{fmtChars}</span>
                                                                        {shortModel && (
                                                                            <>
                                                                                <span className="text-white/10">·</span>
                                                                                <span title={`Model: ${modelRef}`} className="text-white/20">{shortModel}</span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                );
                                                            })()}
                                                            {/* Hover toolbar — Edit & Branch */}
                                                            <div className="absolute -top-7 right-0 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 flex items-center gap-0.5 px-1 py-0.5 rounded-lg z-10" style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                                                                <button onClick={() => handleCopyMessage(msg.content, msg.id)} className="p-1 rounded hover:bg-white/10 transition-colors" title="Copy message">
                                                                    {copiedMessageId === msg.id ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
                                                                </button>
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
                                    {/* ═══ THINKING PLACEHOLDER — shows while agent is processing ═══ */}
                                    {isAgentProcessing && (
                                        <div className="flex w-full justify-start nerv-chat-bubble-enter mt-[12px]">
                                            <div className="flex-shrink-0 mr-[12px] w-[42px] flex flex-col justify-start items-center relative mt-[5px]">
                                                <AgentAvatar agentId={selectedAgentId!} name={selectedAgentName} width={42} height={56} />
                                            </div>
                                            <div className="flex flex-col items-start min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 mb-[2px] px-1">
                                                    <span className="text-[13px] font-semibold text-foreground">{selectedAgentName}</span>
                                                </div>
                                                <div className="px-1 flex items-center gap-1.5">
                                                    <span
                                                        className="nerv-shimmer-text text-[13px] italic"
                                                    >
                                                        thinking
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}


                        </div>

                            {/* ═══ BRANCHING OVERLAY ═══ */}
                            {isBranching && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                                    <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-md" style={{ background: 'var(--popover)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
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
                                    className="absolute left-1/2 -translate-x-1/2 -top-12 z-50 p-2 rounded-sm bg-background/60 backdrop-blur-md border border-border/50 text-foreground shadow-lg hover:bg-accent transition-all flex items-center justify-center hover:-translate-y-1 hover:shadow-xl hover:scale-105"
                                    title="Jump to latest message"
                                    style={{
                                        boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                                    }}
                                >
                                    <ArrowDown className="w-4 h-4" style={{ color: 'var(--nerv-cyan)' }} />
                                </button>
                            )}

                            {/* ─── Mission Bar & Action Buttons ─── */}
                            <div className="flex items-center justify-between w-full mb-2">
                                <MissionBar
                                    conversationId={activeConversationId}
                                    missionConfig={missionConfig}
                                    onMissionChange={setMissionConfig}
                                    className="mx-0"
                                />

                                <div className="flex items-center gap-2 shrink-0">
                                    <Button
                                        onClick={handleEscalate}
                                        disabled={!selectedAgentId || filteredMessages.length === 0}
                                        variant="ghost"
                                        size="sm"
                                        className="text-[11px] h-8 px-3 gap-1.5 rounded-sm disabled:opacity-30 transition-all border border-transparent hover:border-border/50"
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
                                        className="text-[11px] h-8 px-3 gap-1.5 rounded-sm disabled:opacity-30 transition-all border border-transparent hover:border-border/50"
                                        style={{ color: 'var(--nerv-text-tertiary)' }}
                                    >
                                        <Package className="w-3 h-3" />
                                        Handoff
                                    </Button>

                                    {/* Project Selector */}
                                    {selectedAgentId && (
                                        <ProjectPanel
                                            agentId={selectedAgentId}
                                            agentName={selectedAgentName}
                                        />
                                    )}
                                </div>
                            </div>

                            {/* Quoted Reply Banner */}
                            {quotedReply && (
                                <QuotedReplyBanner
                                    quotedText={quotedReply.text}
                                    sourceMessageId={quotedReply.messageId}
                                    onClear={() => setQuotedReply(null)}
                                    className="mb-2"
                                />
                            )}

                            <div
                                className={cn(
                                    "bg-background border shadow-sm rounded-md transition-all relative",
                                    isAgentProcessing
                                        ? "border-orange-500/60"
                                        : "border-border"
                                )}
                                style={isAgentProcessing ? {
                                    animation: 'nervProcessingGlow 2s ease-in-out infinite',
                                    boxShadow: '0 0 15px rgba(249, 115, 22, 0.15), 0 0 30px rgba(249, 115, 22, 0.08), inset 0 0 8px rgba(249, 115, 22, 0.03)',
                                } : undefined}
                            >
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
                                                    className="absolute top-0.5 right-0.5 p-0.5 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                                    style={{ background: 'rgba(0,0,0,0.6)' }}
                                                >
                                                    <XIcon className="w-2.5 h-2.5 text-white" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="px-3 pt-3 pb-2 grow relative">
                                    {/* ─── Slash Command Menu ─── */}
                                    <SlashCommandMenu
                                        query={slashQuery}
                                        visible={showSlashMenu}
                                        onClose={() => setShowSlashMenu(false)}
                                        onSelect={(cmd: SlashCommand) => {
                                            setShowSlashMenu(false);
                                            if (cmd.instant && !cmd.args) {
                                                // Instant commands: dispatch directly to OpenClaw
                                                const sessionKey = `agent:${selectedAgentId}:nchat`;
                                                setMessage("");
                                                dispatchMessage(selectedAgentId, cmd.command, sessionKey);
                                            } else {
                                                // Commands with args: insert into input, let user type args
                                                setMessage(cmd.command + ' ');
                                            }
                                        }}
                                    />
                                    <form onSubmit={handleSendMessage}>
                                        <ChatInputWithChunks
                                            value={message}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                setMessage(val);
                                                // Detect slash command input
                                                if (val.startsWith('/')) {
                                                    setSlashQuery(val.slice(1));
                                                    setShowSlashMenu(true);
                                                } else {
                                                    setShowSlashMenu(false);
                                                }
                                            }}
                                            onSend={(e) => {
                                                if (showSlashMenu) {
                                                    // Don't send if slash menu is open — let slash menu handle it
                                                    return;
                                                }
                                                handleSendMessage(e);
                                            }}
                                            placeholder={activeAgent?.isOnline ? "Ask anything — type / for commands" : "Connection offline"}
                                            disabled={!activeAgent?.isOnline || !selectedAgentId}
                                            className="w-full bg-transparent p-0 border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground placeholder-muted-foreground resize-none border-none outline-none text-[13px] min-h-10 max-h-[25vh]"
                                            rows={2}
                                            onInput={(e) => {
                                                const target = e.target as HTMLTextAreaElement;
                                                target.style.height = "auto";
                                                target.style.height = target.scrollHeight + "px";
                                            }}
                                        />
                                    </form>
                                </div>

                                <div className="mb-[5px] px-2 flex items-center justify-between">
                                    <div className="flex items-center gap-1">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 w-7 p-0 rounded-sm hover:bg-accent text-orange-500 hover:text-orange-400"
                                                >
                                                    <IconPlus className="size-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="max-w-xs rounded-md p-1.5">
                                                <DropdownMenuGroup className="space-y-1">
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => fileInputRef.current?.click()}
                                                    >
                                                        <IconPaperclip size={16} className="opacity-60" />
                                                        Attach Files
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => {
                                                            setActiveSessionConfigs(prev => ({ ...prev, thinking: true }));
                                                            setAutoOpenConfig('thinking');
                                                        }}
                                                    >
                                                        <Brain size={16} className="opacity-60" />
                                                        Thinking Mode
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => {
                                                            setActiveSessionConfigs(prev => ({ ...prev, verbose: true }));
                                                            setAutoOpenConfig('verbose');
                                                        }}
                                                    >
                                                        <MessageSquareText size={16} className="opacity-60" />
                                                        Verbose Output
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="rounded-[calc(1rem-6px)] text-xs"
                                                        onClick={() => {
                                                            setActiveSessionConfigs(prev => ({ ...prev, reasoning: true }));
                                                            setAutoOpenConfig('reasoning');
                                                        }}
                                                    >
                                                        <GitMerge size={16} className="opacity-60" />
                                                        Reasoning Config
                                                    </DropdownMenuItem>
                                                </DropdownMenuGroup>
                                            </DropdownMenuContent>
                                        </DropdownMenu>


                                        <StrategyModeSwitcher
                                            activeMode={strategyMode}
                                            onModeChange={setStrategyMode}
                                        />
                                        {Object.values(activeSessionConfigs).some(Boolean) && (
                                            <div className="ml-1 w-px h-4 bg-border" />
                                        )}
                                        <SessionConfigDropdowns 
                                            sessionKey={`agent:${selectedAgentId}:nchat`}
                                            activeConfigs={activeSessionConfigs}
                                            onCloseConfig={(key) => setActiveSessionConfigs(prev => ({ ...prev, [key]: false }))}
                                            autoOpenConfig={autoOpenConfig}
                                        />

                                        <PromptChunkTray />
                                    </div>

                                    <div>
                                        {isAgentProcessing ? (
                                            <Button
                                                type="button"
                                                className="size-7 p-0 rounded-sm bg-orange-500 hover:bg-orange-600 transition-colors"
                                                style={{ animation: 'nervProcessingGlow 2s ease-in-out infinite' }}
                                                onClick={async () => {
                                                    if (!selectedAgentId) return;
                                                    const sessionKey = `agent:${selectedAgentId}:nchat`;

                                                    // 1. Try gateway interrupt RPC
                                                    try {
                                                        const gw = getGateway();
                                                        if (gw.isConnected) {
                                                            await gw.request('chat.interrupt', {
                                                                sessionKey,
                                                                ...(activeRunId ? { runId: activeRunId } : {}),
                                                            });
                                                            console.log('[NERV] Agent interrupted via chat.interrupt');
                                                        }
                                                    } catch {
                                                        // chat.interrupt may not be supported — that's fine
                                                        console.log('[NERV] chat.interrupt not available');
                                                    }

                                                    // 2. Always clear local processing state
                                                    useOpenClawStore.getState().clearRunsForSession(sessionKey);
                                                    console.log('[NERV] Cleared local runs for session:', sessionKey);
                                                }}
                                                title="Stop processing"
                                            >
                                                <IconPlayerStop className="size-3 text-white" />
                                            </Button>
                                        ) : (
                                            <Button
                                                type="submit"
                                                disabled={!message.trim() || !activeAgent?.isOnline}
                                                className="size-7 p-0 rounded-sm bg-primary disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={handleSendMessage}
                                            >
                                                <IconSend className="size-3 text-primary-foreground" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>


                </div>
            </div>

            {/* ═══ RIGHT: Process Hierarchy Sidebar (full-height) ═══ */}
            {selectedAgentId && (
                <div className="flex shrink-0 group relative -mt-1 -mb-1" style={{ width: processSidebarWidth, marginLeft: 8, height: 'calc(100% + 4px)' }}>
                    {/* Resize Handle */}
                    <div
                        className="absolute -left-1.5 top-0 bottom-0 w-3 cursor-col-resize z-10 flex items-center justify-center"
                        onMouseDown={() => setIsDraggingSidebar(true)}
                    >
                        <div className="w-0.5 h-12 bg-zinc-700/0 group-hover:bg-zinc-700/50 rounded-full transition-colors duration-300" />
                    </div>

                    <div className="w-full h-full border border-white/[0.06] rounded-md overflow-hidden" style={{ background: 'rgba(8,7,6,0.5)' }}>
                        <UnifiedProcessTree
                            agentId={selectedAgentId}
                            provider={activeAgent?.provider || 'openclaw'}
                            className="h-full"
                            messages={allConversationMessages}
                        />
                    </div>
                </div>
            )}

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
                onGenerate={async () => {
                    const resolvedConvoId = activeConversationId || storeConvoId;
                    const sk = `agent:${selectedAgentId}:nchat`;
                    const prompt = `[SYSTEM DIRECTIVE — HANDOFF PROTOCOL]
Please analyze ONLY the conversation that occurred strictly within "Chat Workspace ID: ${resolvedConvoId}". You MUST ignore all context, messages, and memories from previous or unrelated workspaces. Generate a structured Executive Handoff Packet for this specific workspace. 
Do not include markdown wrappers like \`\`\`json, just return raw JSON strictly matching this schema:
{
  "sections": [
    { "title": "Executive Summary", "content": "..." },
    { "title": "Key Decisions Made", "content": "..." },
    { "title": "Open Questions", "content": "..." },
    { "title": "Next Steps", "content": "..." }
  ],
  "readiness": [
    { "label": "Context Completeness", "status": "ready" }
  ]
}
Note: For readiness status, only use "ready", "warning", or "blocked".`;

                    return new Promise(async (resolve) => {
                        const gw = getGateway();
                        if (gw.isConnected) {
                            try {
                                console.log("[Handoff] Dispatching request. Agent replying in chat stream...");
                                const res = await gw.request('chat.send', {
                                    sessionKey: sk,
                                    message: prompt,
                                    idempotencyKey: `handoff-${Date.now()}`
                                });

                                if (res && res.runId) {
                                    const checkInterval = setInterval(() => {
                                        const msgs = useSocketStore.getState().chatMessages;
                                        const targetMsg = msgs.find(m => m.id === `reply-${res.runId}`);
                                        
                                        if (targetMsg && !targetMsg.streaming) {
                                            clearInterval(checkInterval);
                                            try {
                                                const jsonMatch = targetMsg.content.match(/\{[\s\S]*\}/);
                                                if (jsonMatch) {
                                                    const parsed = JSON.parse(jsonMatch[0]);
                                                    resolve({
                                                        sections: parsed.sections || [],
                                                        readiness: parsed.readiness || []
                                                    });
                                                } else {
                                                    console.warn("[Handoff] Failed to parse JSON from agent");
                                                    resolve({ sections: [], readiness: [] });
                                                }
                                            } catch (e) {
                                                console.error("[Handoff Parse Error]", e);
                                                resolve({ sections: [], readiness: [] });
                                            }
                                        }
                                    }, 500);
                                    return; // prevent fallback resolution
                                }
                            } catch (err) {
                                console.error("[Handoff Gen Error]", err);
                            }
                        }
                        resolve({ sections: [], readiness: [] });
                    });
                }}
            />
        </div>
    );
}

/* ─── Companion Mode Toggle ─── */
function CompanionToggle({ agentId, onModeSwitch }: { agentId: string; onModeSwitch?: () => void }) {
    const isCompanion = useCompanionModeStore((s) => s.isCompanionMode(agentId));
    const setCompanionMode = useCompanionModeStore((s) => s.setCompanionMode);
    const chatStore = useChatStore();
    const [showModal, setShowModal] = useState(false);
    const [switching, setSwitching] = useState(false);
    const targetMode = isCompanion ? 'agent' : 'companion';

    const handleClick = () => {
        setShowModal(true);
    };

    const handleConfirm = async () => {
        setSwitching(true);
        try {
            // Toggle the mode
            setCompanionMode(agentId, !isCompanion);

            // Create a new conversation with the target mode
            const newMode = targetMode;
            const convId = await chatStore.createConversation(agentId, undefined, newMode);

            if (convId) {
                await chatStore.setActiveConversation(convId);
            }

            // Trigger sidebar refresh
            onModeSwitch?.();
        } catch (err) {
            console.error('[CompanionToggle] mode switch failed:', err);
        } finally {
            setSwitching(false);
            setShowModal(false);
        }
    };

    return (
        <>
            <button
                onClick={handleClick}
                className={cn(
                    "relative flex items-center gap-1.5 h-8 px-3 rounded-sm text-xs font-medium transition-all duration-200 shrink-0 border",
                    isCompanion
                        ? "bg-pink-500/15 text-pink-400 border-pink-500/40 ring-1 ring-pink-500/20"
                        : "bg-zinc-900/60 text-muted-foreground border-zinc-800 hover:border-zinc-600 hover:text-foreground hover:bg-zinc-800/60"
                )}
                title={isCompanion ? "Companion Mode — click to switch to Agent Mode" : "Agent Mode — click to switch to Companion Mode"}
            >
                {isCompanion ? (
                    <Heart className="w-3.5 h-3.5 fill-pink-400" />
                ) : (
                    <Bot className="w-3.5 h-3.5" />
                )}
                <span
                    className={cn(
                        "w-1.5 h-1.5 rounded-full transition-colors",
                        isCompanion ? "bg-pink-400 animate-pulse" : "bg-zinc-600"
                    )}
                />
            </button>

            {/* Confirmation Modal */}
            {showModal && (
                <div
                    className="fixed inset-0 z-[100] flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
                    onClick={() => !switching && setShowModal(false)}
                >
                    <div
                        className="mx-4 p-5 rounded-md w-full max-w-[340px]"
                        style={{
                            background: 'var(--nerv-surface-3, #1a1a1a)',
                            border: `1px solid ${targetMode === 'companion' ? 'rgba(236,72,153,0.3)' : 'rgba(100,100,120,0.3)'}`,
                            boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-2.5 mb-3">
                            {targetMode === 'companion' ? (
                                <div className="p-1.5 rounded-sm bg-pink-500/15 border border-pink-500/20">
                                    <Heart className="w-4 h-4 text-pink-400 fill-pink-400/30" />
                                </div>
                            ) : (
                                <div className="p-1.5 rounded-sm bg-zinc-700/30 border border-zinc-600/30">
                                    <Bot className="w-4 h-4 text-zinc-400" />
                                </div>
                            )}
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--nerv-text-primary, #fff)' }}>
                                Switch to {targetMode === 'companion' ? 'Companion' : 'Agent'} Mode?
                            </span>
                        </div>

                        <p className="text-[11px] mb-4 leading-relaxed" style={{ color: 'var(--nerv-text-secondary, #aaa)' }}>
                            {targetMode === 'companion'
                                ? 'This will start a new conversation using your Companion profile. OpenClaw agent files will be bypassed and the companion model will be used instead.'
                                : 'This will start a new conversation using the standard OpenClaw agent configuration.'
                            }
                        </p>

                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setShowModal(false)}
                                disabled={switching}
                                className="px-3 py-1.5 rounded-sm text-[11px] font-medium transition-colors"
                                style={{
                                    color: 'var(--nerv-text-secondary, #aaa)',
                                    background: 'var(--nerv-surface-4, #252525)',
                                    border: '1px solid var(--nerv-border-subtle, #333)',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={switching}
                                className={cn(
                                    "px-3 py-1.5 rounded-sm text-[11px] font-medium transition-all flex items-center gap-1.5",
                                    targetMode === 'companion'
                                        ? "bg-pink-500/20 text-pink-400 border border-pink-500/30 hover:bg-pink-500/30"
                                        : "bg-zinc-700/30 text-zinc-300 border border-zinc-600/30 hover:bg-zinc-700/50"
                                )}
                            >
                                {switching && <Loader2 className="w-3 h-3 animate-spin" />}
                                {switching ? 'Switching…' : `Switch to ${targetMode === 'companion' ? 'Companion' : 'Agent'}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

