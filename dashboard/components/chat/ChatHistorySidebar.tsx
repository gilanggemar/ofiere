"use client";

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
    MessageSquare, Plus, Trash2, Clock, Pin, PinOff, Archive,
    ArchiveRestore, Pencil, Search, X, Grid3X3, LayoutList, Loader2
} from 'lucide-react';

interface Conversation {
    id: string;
    agent_id: string;
    title: string | null;
    message_count: number;
    created_at: string;
    updated_at: string;
    pinned: boolean;
    archived: boolean;
    lastPreview?: string;
}


interface ChatHistorySidebarProps {
    agentId: string;
    agentName: string;
    allAgents?: Array<{ id: string; name: string }>;
    className?: string;
    onSelectConversation?: (conversationId: string) => void;
    activeConversationId?: string;
    onNewConversation?: () => void;
}

export const ChatHistorySidebar = ({
    agentId,
    agentName,
    allAgents = [],
    className,
    onSelectConversation,
    activeConversationId,
    onNewConversation,
    refreshTrigger,
}: ChatHistorySidebarProps & { refreshTrigger?: number }) => {
    const [allConversations, setAllConversations] = useState<Conversation[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllAgents, setShowAllAgents] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState('');
    const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const editInputRef = useRef<HTMLInputElement>(null);
    const contextMenuRef = useRef<HTMLDivElement>(null);

    // Fetch ALL conversations once, then filter client-side
    const fetchConversations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/chat/conversations?include_archived=true`);
            if (res.ok) {
                const data = await res.json();
                setAllConversations(data.conversations || []);
            }
        } catch (error) {
            console.error('Failed to fetch conversations:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchConversations(); }, [fetchConversations, refreshTrigger]);

    // Close context menu on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
                setContextMenu(null);
            }
        };
        if (contextMenu) document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [contextMenu]);

    // Focus edit input
    useEffect(() => {
        if (editingId && editInputRef.current) editInputRef.current.focus();
    }, [editingId]);

    // Client-side filtered list
    const filteredConversations = React.useMemo(() => {
        let list = allConversations;

        // Agent scope
        if (!showAllAgents) {
            list = list.filter(c => c.agent_id === agentId);
        }

        // Hide archived
        list = list.filter(c => !c.archived);

        // Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(c =>
                (c.title || '').toLowerCase().includes(q) ||
                (c.lastPreview || '').toLowerCase().includes(q)
            );
        }

        // Sort: pinned first, then by updated_at desc
        list = [...list].sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

        return list;
    }, [allConversations, agentId, showAllAgents, searchQuery]);

    const handleNewConversation = async () => {
        try {
            const targetAgentId = showAllAgents ? agentId : agentId;
            const res = await fetch('/api/chat/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agent_id: targetAgentId }),
            });
            if (res.ok) {
                const { conversation } = await res.json();
                setAllConversations(prev => [conversation, ...prev]);
                onSelectConversation?.(conversation.id);
            }
        } catch (err) {
            console.error('Failed to create new conversation:', err);
        }
    };

    // Auto-select the most recent conversation when switching to this agent
    // if no conversation is currently active
    useEffect(() => {
        if (!activeConversationId && filteredConversations.length > 0 && !loading) {
            // Select the first (most recent) conversation automatically
            onSelectConversation?.(filteredConversations[0].id);
        }
    }, [activeConversationId, filteredConversations, onSelectConversation, loading]);

    const patchConversation = async (id: string, updates: Record<string, any>) => {
        try {
            const res = await fetch(`/api/chat/conversations/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates)
            });
            if (res.ok) {
                const { conversation: updated } = await res.json();
                setAllConversations(prev => prev.map(c => c.id === id ? { ...c, ...updated } : c));
            }
        } catch (error) {
            console.error('Failed to update conversation:', error);
        }
    };

    const handleDelete = (id: string) => {
        setDeleteConfirmId(id);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmId) return;
        try {
            const res = await fetch(`/api/chat/conversations/${deleteConfirmId}`, { method: 'DELETE' });
            if (res.ok) {
                setAllConversations(prev => prev.filter(c => c.id !== deleteConfirmId));
                if (activeConversationId === deleteConfirmId) {
                    onSelectConversation?.(undefined as any);
                }
            }
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const handleRenameSubmit = async (id: string) => {
        if (editTitle.trim()) {
            await patchConversation(id, { title: editTitle.trim() });
        }
        setEditingId(null);
        setEditTitle('');
    };

    const formatDate = (timestamp: string) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays === 1) return 'yesterday';
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getAgentName = (aid: string) => {
        const agent = allAgents.find(a => a.id === aid);
        return agent?.name || aid;
    };


    return (
        <div className={cn(
            "flex flex-col h-full overflow-hidden",
            className
        )} style={{ background: 'transparent' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--nerv-border-default)' }}>
                <div className="flex items-center gap-2">
                    <span
                        className="text-[11px] font-semibold uppercase tracking-[0.1em]"
                        style={{ color: 'var(--nerv-text-tertiary)' }}
                    >
                        Sessions
                        {!showAllAgents && <span className="lowercase"> — {agentName}</span>}
                        {showAllAgents && <span className="lowercase"> — All</span>}
                    </span>
                    <button
                        onClick={() => setShowAllAgents(!showAllAgents)}
                        className="p-1 rounded transition-colors hover:bg-white/5"
                        title={showAllAgents ? 'Show agent sessions only' : 'Show all agents'}
                        aria-label="Toggle agent scope"
                    >
                        {showAllAgents
                            ? <Grid3X3 className="w-3 h-3" style={{ color: 'var(--nerv-cyan)' }} />
                            : <LayoutList className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
                        }
                    </button>
                </div>
                <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleNewConversation}
                    className="h-7 w-7 p-0 rounded-full hover:bg-orange-500/10"
                    aria-label="New conversation"
                >
                    <Plus className="w-3.5 h-3.5 text-orange-500" />
                </Button>
            </div>

            {/* Search */}
            <div className="px-3 pt-2 pb-1">
                <div
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-all"
                    style={{
                        background: 'transparent',
                        border: '1px solid var(--nerv-border-subtle)',
                    }}
                >
                    <Search className="w-3 h-3 shrink-0" style={{ color: 'var(--nerv-text-tertiary)' }} />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search conversations…"
                        className="flex-1 text-[11px] bg-transparent border-none outline-none"
                        style={{ color: 'var(--nerv-text-primary)' }}
                    />
                    {searchQuery && (
                        <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-white/5">
                            <X className="w-2.5 h-2.5" style={{ color: 'var(--nerv-text-tertiary)' }} />
                        </button>
                    )}
                </div>
            </div>


            {/* Session List */}
            <ScrollArea className="flex-1 overflow-hidden">
                <div className="p-2 space-y-0.5 w-full overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--nerv-text-tertiary)' }} />
                        </div>
                    ) : filteredConversations.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                            <MessageSquare className="w-6 h-6 mb-2" style={{ color: 'var(--nerv-text-ghost)' }} />
                            <span className="text-[11px]" style={{ color: 'var(--nerv-text-tertiary)' }}>
                                {searchQuery ? 'No matching conversations' : 'No conversations yet'}
                            </span>
                        </div>
                    ) : (
                        filteredConversations.map(convo => {
                            const isActive = activeConversationId === convo.id;
                            const isEditing = editingId === convo.id;

                            return (
                                <div
                                    key={convo.id}
                                    onClick={() => !isEditing && onSelectConversation?.(convo.id)}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        setContextMenu({ x: e.clientX, y: e.clientY, id: convo.id });
                                    }}
                                    className={cn(
                                        "group relative flex items-start px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 overflow-hidden",
                                    )}
                                    style={{
                                        background: isActive ? 'rgba(249, 115, 22, 0.12)' : 'transparent',
                                        opacity: isActive ? 1 : 0.65,
                                    }}
                                    onMouseEnter={e => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.background = 'rgba(249, 115, 22, 0.06)';
                                            (e.currentTarget as HTMLElement).style.opacity = '1';
                                        }
                                    }}
                                    onMouseLeave={e => {
                                        if (!isActive) {
                                            (e.currentTarget as HTMLElement).style.background = 'transparent';
                                            (e.currentTarget as HTMLElement).style.opacity = '0.65';
                                        }
                                    }}
                                >

                                    <div className="flex-1 min-w-0 overflow-hidden relative">
                                        {/* Hover Actions */}
                                        <div 
                                            className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0 z-10 transition-opacity bg-background/80 backdrop-blur-sm rounded-md"
                                        >
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); setEditingId(convo.id); setEditTitle(convo.title || ''); }}
                                                className="p-1.5 rounded-md transition-all hover:bg-white/[0.07]"
                                                title="Rename"
                                            >
                                                <Pencil className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDelete(convo.id); }}
                                                className="p-1.5 rounded-md transition-all hover:bg-white/[0.07]"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-3 h-3" style={{ color: 'var(--nerv-text-tertiary)' }} />
                                            </button>
                                        </div>

                                        {/* Top row: title + timestamp */}
                                        <div className="flex items-start w-full min-w-0 overflow-hidden gap-1">
                                            {isEditing ? (
                                                <input
                                                    ref={editInputRef}
                                                    value={editTitle}
                                                    onChange={e => setEditTitle(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRenameSubmit(convo.id);
                                                        if (e.key === 'Escape') { setEditingId(null); setEditTitle(''); }
                                                    }}
                                                    onBlur={() => handleRenameSubmit(convo.id)}
                                                    className="text-[12px] font-medium w-full flex-1 min-w-0 pr-14 focus:outline-none"
                                                    style={{ 
                                                        color: 'var(--nerv-text-primary)',
                                                        background: 'transparent',
                                                        border: 'none',
                                                        outline: 'none',
                                                        boxShadow: 'none'
                                                    }}
                                                />
                                            ) : (() => {
                                                const MAX_TITLE_LEN = 28;
                                                const rawTitle = convo.title || 'Untitled conversation';
                                                const displayTitle = rawTitle.length > MAX_TITLE_LEN 
                                                    ? rawTitle.slice(0, MAX_TITLE_LEN) + '…' 
                                                    : rawTitle;
                                                return (
                                                <div 
                                                    className="text-[12px] font-medium flex-1 min-w-0"
                                                    style={{ 
                                                        color: 'var(--nerv-text-primary)',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {convo.pinned && <Pin className="w-2.5 h-2.5 inline mr-1" style={{ color: 'var(--nerv-cyan)' }} />}
                                                    {displayTitle}
                                                </div>
                                                );
                                            })()
                                            }
                                            {!isEditing && (
                                                <div
                                                    className="text-[9px] shrink-0 mt-0.5 transition-opacity group-hover:opacity-0"
                                                    style={{ color: 'var(--nerv-text-ghost)' }}
                                                >
                                                    {formatDate(convo.updated_at)}
                                                </div>
                                            )}
                                        </div>

                                        {/* Agent name in all-agents mode */}
                                        {showAllAgents && (
                                            <span className="text-[9px]" style={{ color: 'var(--nerv-text-tertiary)' }}>
                                                {getAgentName(convo.agent_id)}
                                            </span>
                                        )}


                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </ScrollArea>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    ref={contextMenuRef}
                    className="fixed z-[100] rounded-xl overflow-hidden py-1 shadow-lg"
                    style={{
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: 'var(--nerv-surface-3)',
                        border: '1px solid var(--nerv-border-default)',
                        minWidth: 160,
                    }}
                >
                    {[
                        {
                            label: 'Rename',
                            icon: <Pencil className="w-3 h-3" />,
                            action: () => {
                                const convo = allConversations.find(c => c.id === contextMenu.id);
                                setEditingId(contextMenu.id);
                                setEditTitle(convo?.title || '');
                                setContextMenu(null);
                            }
                        },
                        {
                            label: allConversations.find(c => c.id === contextMenu.id)?.pinned ? 'Unpin' : 'Pin to top',
                            icon: allConversations.find(c => c.id === contextMenu.id)?.pinned
                                ? <PinOff className="w-3 h-3" />
                                : <Pin className="w-3 h-3" />,
                            action: () => {
                                const convo = allConversations.find(c => c.id === contextMenu.id);
                                patchConversation(contextMenu.id, { pinned: !convo?.pinned });
                                setContextMenu(null);
                            }
                        },
                        {
                            label: allConversations.find(c => c.id === contextMenu.id)?.archived ? 'Unarchive' : 'Archive',
                            icon: allConversations.find(c => c.id === contextMenu.id)?.archived
                                ? <ArchiveRestore className="w-3 h-3" />
                                : <Archive className="w-3 h-3" />,
                            action: () => {
                                const convo = allConversations.find(c => c.id === contextMenu.id);
                                patchConversation(contextMenu.id, { archived: !convo?.archived });
                                setContextMenu(null);
                            }
                        },
                        {
                            label: 'Delete',
                            icon: <Trash2 className="w-3 h-3" />,
                            danger: true,
                            action: () => {
                                handleDelete(contextMenu.id);
                                setContextMenu(null);
                            }
                        },
                    ].map((item, i) => (
                        <button
                            key={i}
                            onClick={item.action}
                            className="flex items-center gap-2.5 w-full px-3 py-2 text-[11px] text-left transition-colors"
                            style={{
                                color: (item as any).danger ? 'var(--nerv-danger)' : 'var(--nerv-text-secondary)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--nerv-surface-4)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}

            {/* ─── Custom Delete Confirmation Modal ─── */}
            {deleteConfirmId && (
                <div
                    className="absolute inset-0 z-50 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
                    onClick={() => setDeleteConfirmId(null)}
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
                            <span className="text-[13px] font-semibold" style={{ color: 'var(--nerv-text-primary)' }}>Delete conversation?</span>
                        </div>
                        <p className="text-[11px] mb-4" style={{ color: 'var(--nerv-text-secondary)', lineHeight: '1.5' }}>
                            This removes the stored chat history from the database. The agent session itself will not be affected.
                        </p>
                        <div className="flex gap-2 justify-end">
                            <button
                                onClick={() => setDeleteConfirmId(null)}
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
                                onClick={confirmDelete}
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

            {/* Footer */}
            <div className="px-4 py-2" style={{ borderTop: '1px solid var(--nerv-border-subtle)' }}>
                <span className="text-[9px] uppercase tracking-[0.08em]" style={{ color: 'var(--nerv-text-ghost)' }}>
                    {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    );
};

export default ChatHistorySidebar;
