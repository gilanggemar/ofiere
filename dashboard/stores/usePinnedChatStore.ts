// ─── Pinned Chat Store ───────────────────────────────────────────────────────
// Manages state for the floating pinned chat orb.
// Supports one pinned chat at a time. Position persists to localStorage.

import { create } from 'zustand';

export type SnapPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface PinnedChat {
    agentId: string;
    agentName: string;
    conversationId: string;
    conversationTitle?: string;
    mode: 'agent' | 'companion';
}

interface PinnedChatState {
    pinnedChat: PinnedChat | null;
    snapPosition: SnapPosition;
    isPopoverOpen: boolean;
    unreadCount: number;

    pinChat: (chat: PinnedChat) => void;
    unpinChat: () => void;
    setSnapPosition: (pos: SnapPosition) => void;
    togglePopover: () => void;
    setPopoverOpen: (open: boolean) => void;
    incrementUnread: () => void;
    clearUnread: () => void;
}

const STORAGE_KEY = 'ofiere_pinned_chat_position';
const PINNED_STORAGE_KEY = 'ofiere_pinned_chat';

function loadSnapPosition(): SnapPosition {
    if (typeof window === 'undefined') return 'bottom-right';
    return (localStorage.getItem(STORAGE_KEY) as SnapPosition) || 'bottom-right';
}

function loadPinnedChat(): PinnedChat | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(PINNED_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

export const usePinnedChatStore = create<PinnedChatState>((set, get) => ({
    pinnedChat: loadPinnedChat(),
    snapPosition: loadSnapPosition(),
    isPopoverOpen: false,
    unreadCount: 0,

    pinChat: (chat: PinnedChat) => {
        localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify(chat));
        set({ pinnedChat: chat, isPopoverOpen: false, unreadCount: 0 });
    },

    unpinChat: () => {
        localStorage.removeItem(PINNED_STORAGE_KEY);
        set({ pinnedChat: null, isPopoverOpen: false, unreadCount: 0 });
    },

    setSnapPosition: (pos: SnapPosition) => {
        localStorage.setItem(STORAGE_KEY, pos);
        set({ snapPosition: pos });
    },

    togglePopover: () => {
        const wasOpen = get().isPopoverOpen;
        set({ isPopoverOpen: !wasOpen, unreadCount: wasOpen ? get().unreadCount : 0 });
    },

    setPopoverOpen: (open: boolean) => {
        set({ isPopoverOpen: open, ...(open ? { unreadCount: 0 } : {}) });
    },

    incrementUnread: () => {
        if (!get().isPopoverOpen) {
            set((s) => ({ unreadCount: s.unreadCount + 1 }));
        }
    },

    clearUnread: () => {
        set({ unreadCount: 0 });
    },
}));
