'use client';

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    Terminal, Focus, EyeOff, Square, RotateCcw, Plus,
    Minimize2, Trash2, Zap, Search, FileText, Settings,
    Activity, Download, List
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════
   OpenClaw Slash Command Definitions
   
   These map 1:1 to OpenClaw Gateway deterministic commands.
   They are dispatched via chat.send — the gateway intercepts
   messages starting with "/" and processes them server-side.
   ═══════════════════════════════════════════════════════ */

export interface SlashCommand {
    command: string;
    args?: string;
    description: string;
    category: 'SESSION' | 'TOOLS' | 'SYSTEM';
    icon: React.ReactNode;
    instant?: boolean;       // True = executes immediately, no extra args needed
    dangerous?: boolean;     // True = shown with red accent (destructive actions)
}

export const SLASH_COMMANDS: SlashCommand[] = [
    // ── SESSION ──
    {
        command: '/session',
        args: '[action] [value]',
        description: 'Manage session-level settings (e.g. /session idle)',
        category: 'SESSION',
        icon: <Settings size={14} />,
    },
    {
        command: '/focus',
        args: '[target]',
        description: 'Bind this thread to a session target',
        category: 'SESSION',
        icon: <Focus size={14} />,
    },
    {
        command: '/unfocus',
        description: 'Remove the current thread/session binding',
        category: 'SESSION',
        icon: <EyeOff size={14} />,
        instant: true,
    },
    {
        command: '/stop',
        description: 'Stop the current run',
        category: 'SESSION',
        icon: <Square size={14} />,
        instant: true,
    },
    {
        command: '/reset',
        description: 'Reset the current session',
        category: 'SESSION',
        icon: <RotateCcw size={14} />,
        instant: true,
    },
    {
        command: '/new',
        description: 'Start a new session',
        category: 'SESSION',
        icon: <Plus size={14} />,
        instant: true,
    },
    {
        command: '/compact',
        args: '[instructions]',
        description: 'Compact the session context',
        category: 'SESSION',
        icon: <Minimize2 size={14} />,
    },
    {
        command: '/clear',
        description: 'Clear chat history',
        category: 'SESSION',
        icon: <Trash2 size={14} />,
        instant: true,
        dangerous: true,
    },

    // ── TOOLS ──
    {
        command: '/tools',
        description: 'List available tools for this agent',
        category: 'TOOLS',
        icon: <Zap size={14} />,
        instant: true,
    },
    {
        command: '/search',
        args: '[query]',
        description: 'Search the agent\'s memory and context',
        category: 'TOOLS',
        icon: <Search size={14} />,
    },

    // ── SYSTEM ──
    {
        command: '/status',
        description: 'Show agent and session status',
        category: 'SYSTEM',
        icon: <Activity size={14} />,
        instant: true,
    },
    {
        command: '/history',
        description: 'Display session history summary',
        category: 'SYSTEM',
        icon: <List size={14} />,
        instant: true,
    },
    {
        command: '/export',
        description: 'Export the current conversation',
        category: 'SYSTEM',
        icon: <Download size={14} />,
        instant: true,
    },
    {
        command: '/help',
        description: 'Show all available slash commands',
        category: 'SYSTEM',
        icon: <FileText size={14} />,
        instant: true,
    },
];

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

interface SlashCommandMenuProps {
    query: string;           // The current text after '/' (for filtering)
    visible: boolean;
    onSelect: (cmd: SlashCommand) => void;
    onClose: () => void;
}

export function SlashCommandMenu({ query, visible, onSelect, onClose }: SlashCommandMenuProps) {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const menuRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<Map<number, HTMLDivElement>>(new Map());

    // Filter commands based on query
    const filteredCommands = useMemo(() => {
        if (!query) return SLASH_COMMANDS;
        const q = query.toLowerCase();
        return SLASH_COMMANDS.filter(
            cmd => cmd.command.toLowerCase().includes(q) ||
                   cmd.description.toLowerCase().includes(q) ||
                   cmd.category.toLowerCase().includes(q)
        );
    }, [query]);

    // Group by category
    const groupedCommands = useMemo(() => {
        const groups: { category: string; commands: (SlashCommand & { globalIndex: number })[] }[] = [];
        const categoryOrder = ['SESSION', 'TOOLS', 'SYSTEM'];
        let globalIdx = 0;

        for (const cat of categoryOrder) {
            const cmds = filteredCommands
                .filter(c => c.category === cat)
                .map(c => ({ ...c, globalIndex: globalIdx++ }));
            if (cmds.length > 0) {
                groups.push({ category: cat, commands: cmds });
            }
        }
        return groups;
    }, [filteredCommands]);

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    // Scroll selected item into view
    useEffect(() => {
        const el = itemRefs.current.get(selectedIndex);
        if (el) {
            el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }, [selectedIndex]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: KeyboardEvent) => {
        if (!visible || filteredCommands.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(i => Math.max(i - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            e.stopPropagation();
            const cmd = filteredCommands[selectedIndex];
            if (cmd) onSelect(cmd);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    }, [visible, filteredCommands, selectedIndex, onSelect, onClose]);

    useEffect(() => {
        if (visible) {
            window.addEventListener('keydown', handleKeyDown, true);
            return () => window.removeEventListener('keydown', handleKeyDown, true);
        }
    }, [visible, handleKeyDown]);

    // Click outside to close
    useEffect(() => {
        if (!visible) return;
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [visible, onClose]);

    if (!visible || filteredCommands.length === 0) return null;

    return (
        <div
            ref={menuRef}
            className="absolute bottom-full left-0 right-0 mb-1 z-50"
            style={{
                maxHeight: '320px',
                overflowY: 'auto',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                borderRadius: '6px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04)',
                backdropFilter: 'blur(16px)',
            }}
        >
            {groupedCommands.map(group => (
                <div key={group.category}>
                    {/* Category header */}
                    <div
                        className="px-3 pt-2.5 pb-1 sticky top-0"
                        style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            letterSpacing: '0.1em',
                            color: 'var(--text-muted)',
                            background: 'var(--bg-elevated)',
                        }}
                    >
                        {group.category}
                    </div>

                    {/* Commands */}
                    {group.commands.map(cmd => {
                        const isSelected = cmd.globalIndex === selectedIndex;
                        return (
                            <div
                                key={cmd.command}
                                ref={el => { if (el) itemRefs.current.set(cmd.globalIndex, el); }}
                                className="flex items-center justify-between px-3 py-1.5 mx-1 cursor-pointer transition-colors duration-75"
                                style={{
                                    borderRadius: '4px',
                                    background: isSelected ? 'var(--accent-subtle)' : 'transparent',
                                }}
                                onMouseEnter={() => setSelectedIndex(cmd.globalIndex)}
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onSelect(cmd);
                                }}
                            >
                                {/* Left: Icon + Command + Args */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="flex-shrink-0"
                                        style={{
                                            color: cmd.dangerous
                                                ? 'var(--status-error)'
                                                : 'var(--accent-base)',
                                            opacity: 0.8,
                                        }}
                                    >
                                        {cmd.icon}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '13px',
                                            fontWeight: 600,
                                            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                            color: cmd.dangerous
                                                ? 'var(--status-error)'
                                                : 'var(--text-primary)',
                                        }}
                                    >
                                        {cmd.command}
                                    </span>
                                    {cmd.args && (
                                        <span
                                            style={{
                                                fontSize: '12px',
                                                fontFamily: "'JetBrains Mono', monospace",
                                                color: 'var(--text-muted)',
                                            }}
                                        >
                                            {cmd.args}
                                        </span>
                                    )}
                                </div>

                                {/* Right: Description + Instant badge */}
                                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                                    <span
                                        className="hidden sm:inline"
                                        style={{
                                            fontSize: '11px',
                                            color: 'var(--text-secondary)',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {cmd.description}
                                    </span>
                                    {cmd.instant && (
                                        <span
                                            style={{
                                                fontSize: '9px',
                                                fontWeight: 700,
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.06em',
                                                padding: '2px 6px',
                                                borderRadius: '3px',
                                                background: cmd.dangerous
                                                    ? 'rgba(239,68,68,0.15)'
                                                    : 'var(--accent-subtle)',
                                                color: cmd.dangerous
                                                    ? 'var(--status-error)'
                                                    : 'var(--accent-base)',
                                            }}
                                        >
                                            instant
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ))}

            {/* Footer hint */}
            <div
                className="px-3 py-1.5 flex items-center gap-3 border-t"
                style={{
                    borderColor: 'var(--border-subtle)',
                    fontSize: '10px',
                    color: 'var(--text-muted)',
                }}
            >
                <span><kbd style={{ padding: '1px 4px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '9px' }}>↑↓</kbd> navigate</span>
                <span><kbd style={{ padding: '1px 4px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '9px' }}>↵</kbd> select</span>
                <span><kbd style={{ padding: '1px 4px', borderRadius: '2px', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', fontSize: '9px' }}>esc</kbd> close</span>
            </div>
        </div>
    );
}
