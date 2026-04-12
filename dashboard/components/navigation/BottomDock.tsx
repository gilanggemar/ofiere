"use client";

import { cn } from "@/lib/utils";
import { useNavigationStore, NAV_GROUPS, type NavGroup } from "@/store/useNavigationStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { useRouter } from "next/navigation";
import {
    LayoutGrid, Briefcase, Brain, Settings, ChevronUp,
    Home, MessageSquare, Activity, Target, GitBranch, Terminal,
    ClipboardList, Calendar, Bell, Puzzle, Eye, FolderKanban,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLayoutStore } from "@/store/useLayoutStore";
import { useRef, useState, useCallback, useEffect } from "react";

import Link from "next/link";

const ICON_MAP: Record<string, typeof Home> = {
    Home, Package2: MessageSquare, Activity, Target, GitBranch, Store: Terminal,
    ClipboardList, Calendar, Bell, Puzzle, Eye, Brain, Settings, FolderKanban,
};

const DOCK_ITEMS: { group: NavGroup; icon: typeof LayoutGrid; label: string }[] = [
    { group: "PRIMARY", icon: LayoutGrid, label: "Primary" },
    { group: "OPERATIONS", icon: Briefcase, label: "Operations" },
    { group: "INTELLIGENCE", icon: Brain, label: "Intelligence" },
    { group: "SETTINGS", icon: Settings, label: "Settings" },
];

/* ── Blur overlay is handled by DashboardLayout ── */

export function BottomDock() {
    const activeGroup = useNavigationStore((s) => s.activeGroup);
    const setActiveGroup = useNavigationStore((s) => s.setActiveGroup);
    const activeSubPageId = useNavigationStore((s) => s.activeSubPageId);
    const setActiveSubPage = useNavigationStore((s) => s.setActiveSubPage);
    const router = useRouter();
    const isExpanded = useLayoutStore((s) => s.isBottomDockExpanded);
    const setExpanded = useLayoutStore((s) => s.setBottomDockExpanded);

    const [bloomGroup, setBloomGroup] = useState<NavGroup | null>(null);
    const intentRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const closeRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const notifications = useNotificationStore((s) => s.notifications);
    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);
    const hasUnreadAgentChat = notifications.some((n) => !n.isRead && n.agentId);

    const getShowBadge = (routeId: string): boolean => {
        if (routeId === "notifications" && (unreadCount > 0 || pendingGates.length > 0)) return true;
        if (routeId === "chat" && hasUnreadAgentChat) return true;
        return false;
    };

    const handleGroupClick = (group: NavGroup) => {
        setActiveGroup(group);
        const firstRoute = NAV_GROUPS[group][0];
        if (firstRoute) router.push(firstRoute.link);
        clearAll();
    };

    const openBloom = useCallback((group: NavGroup) => {
        if (closeRef.current) { clearTimeout(closeRef.current); closeRef.current = null; }
        if (intentRef.current) clearTimeout(intentRef.current);
        intentRef.current = setTimeout(() => setBloomGroup(group), 80);
    }, []);

    const cancelBloom = useCallback(() => {
        if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
        closeRef.current = setTimeout(() => setBloomGroup(null), 200);
    }, []);

    const keepBloom = useCallback(() => {
        if (closeRef.current) { clearTimeout(closeRef.current); closeRef.current = null; }
    }, []);

    const clearAll = useCallback(() => {
        setExpanded(false);
        if (intentRef.current) { clearTimeout(intentRef.current); intentRef.current = null; }
        if (closeRef.current) clearTimeout(closeRef.current);
        setBloomGroup(null);
    }, [setExpanded]);

    const bloomRoutes = bloomGroup ? NAV_GROUPS[bloomGroup] : [];
    const bloomLabel = bloomGroup ? DOCK_ITEMS.find(d => d.group === bloomGroup)?.label : "";

    return (
        <>

            <div
                className="fixed bottom-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pb-[8px] pt-8 px-12"
                onMouseEnter={() => setExpanded(true)}
                onMouseLeave={clearAll}
            >
                <AnimatePresence>
                    {isExpanded ? (
                        <motion.div
                            key="dock-content"
                            initial={{ opacity: 0, y: 52 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 52 }}
                            transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                            className="hecate-dock-stack"
                        >
                            <AnimatePresence>
                                {bloomGroup && (
                                    <motion.div
                                        key="bloom-rail"
                                        className="hecate-bloom-rail"
                                        initial={{ opacity: 0, y: 14 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 14 }}
                                        transition={{
                                            duration: 0.28,
                                            ease: [0.05, 0.7, 0.1, 1.0],
                                        }}
                                        onMouseEnter={keepBloom}
                                        onMouseLeave={cancelBloom}
                                    >
                                        <span className="hecate-bloom-label">
                                            {bloomLabel}
                                        </span>
                                        <div className="hecate-bloom-items">
                                            {bloomRoutes.map((route) => {
                                                const IconComp = ICON_MAP[route.iconName] || Home;
                                                const isSubActive = activeSubPageId === route.id;
                                                const showBadge = getShowBadge(route.id);

                                                return (
                                                    <Link
                                                        key={route.id}
                                                        href={route.link}
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setActiveGroup(bloomGroup!);
                                                            setActiveSubPage(route.id);
                                                            router.push(route.link);
                                                            clearAll();
                                                        }}
                                                        className={cn(
                                                            "hecate-bloom-tile",
                                                            isSubActive && "hecate-bloom-tile--active"
                                                        )}
                                                    >
                                                        <span className="hecate-bloom-tile__icon">
                                                            <IconComp className="w-4 h-4" />
                                                            {showBadge && (
                                                                <span className="absolute -top-0.5 -right-0.5 w-[5px] h-[5px] rounded-full bg-orange-500" />
                                                            )}
                                                        </span>
                                                        <span className="hecate-bloom-tile__label">{route.title}</span>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            <div className="hecate-dock-pill">
                                {DOCK_ITEMS.map(({ group, icon: Icon, label }) => {
                                    const isActive = activeGroup === group;
                                    const isBlooming = bloomGroup === group;

                                    return (
                                        <div
                                            key={group}
                                            className="hecate-dock-anchor"
                                            onMouseEnter={() => openBloom(group)}
                                            onMouseLeave={cancelBloom}
                                        >
                                            <motion.button
                                                onClick={() => handleGroupClick(group)}
                                                animate={isBlooming ? { y: -2 } : { y: 0 }}
                                                transition={{ duration: 0.15, ease: "easeOut" }}
                                                className={cn(
                                                    "hecate-dock-btn",
                                                    isActive && "hecate-dock-btn--active",
                                                    isBlooming && "hecate-dock-btn--blooming"
                                                )}
                                                aria-label={label}
                                                aria-current={isActive ? "page" : undefined}
                                            >
                                                <Icon className="w-[18px] h-[18px]" />
                                            </motion.button>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="dock-chevron"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-[8px] h-4 w-16 flex items-center justify-center cursor-pointer"
                            style={{ color: 'var(--accent-base, #FF6D29)', filter: 'drop-shadow(0 0 4px rgba(255,109,41,0.5))' }}
                        >
                            <ChevronUp className="w-4 h-4" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
