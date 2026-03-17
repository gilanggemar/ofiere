"use client";

import { cn } from "@/lib/utils";
import { useNavigationStore, NAV_GROUPS } from "@/store/useNavigationStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useLayoutStore } from "@/store/useLayoutStore";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import {
    Home,
    MessageSquare,
    Activity,
    Target,
    GitBranch,
    Terminal,
    ClipboardList,
    Calendar,
    Bell,
    Puzzle,
    Eye,
    Brain,
    Settings,
    ChevronDown,
} from "lucide-react";

/* Icon map: resolve iconName from store to actual React component */
const ICON_MAP: Record<string, typeof Home> = {
    Home, Package2: MessageSquare, Activity, Target, GitBranch, Store: Terminal,
    ClipboardList, Calendar, Bell, Puzzle, Eye, Brain, Settings,
};

export function TopRail() {
    const activeGroup = useNavigationStore((s) => s.activeGroup);
    const activeSubPageId = useNavigationStore((s) => s.activeSubPageId);
    const setActiveSubPage = useNavigationStore((s) => s.setActiveSubPage);
    const syncFromPath = useNavigationStore((s) => s.syncFromPath);
    const pathname = usePathname();

    // Badge indicators
    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const notifications = useNotificationStore((s) => s.notifications);
    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);
    const hasUnreadAgentChat = notifications.some(n => !n.isRead && n.agentId);

    // Sync navigation state from URL on mount and route changes
    useEffect(() => {
        if (pathname) {
            syncFromPath(pathname);
        }
    }, [pathname, syncFromPath]);

    const items = NAV_GROUPS[activeGroup] || [];

    const getShowBadge = (routeId: string): boolean => {
        if (routeId === 'notifications' && (unreadCount > 0 || pendingGates.length > 0)) return true;
        if (routeId === 'chat' && hasUnreadAgentChat) return true;
        return false;
    };

    const isExpanded = useLayoutStore((s) => s.isTopRailExpanded);
    const setExpanded = useLayoutStore((s) => s.setTopRailExpanded);

    return (
        <div 
            className="fixed top-0 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pt-[10px] pb-6 px-12"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
        >
            <AnimatePresence>
                {isExpanded ? (
                    <motion.div
                        key="rail-content"
                        initial={{ opacity: 0, y: -48 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -48 }}
                        transition={{ duration: 0.25, ease: [0.25, 1, 0.5, 1] }}
                        className="nerv-top-rail relative"
                    >
                        <motion.div
                            key={activeGroup}
                            className="nerv-rail-items"
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
                        >
                            {items.map((route) => {
                                const isActive = activeSubPageId === route.id;
                                const showBadge = getShowBadge(route.id);
                                const IconComp = ICON_MAP[route.iconName] || Home;

                                return (
                                    <Tooltip key={route.id}>
                                        <TooltipTrigger asChild>
                                            <Link
                                                href={route.link}
                                                onClick={() => setActiveSubPage(route.id)}
                                                className={cn(
                                                    "nerv-rail-item",
                                                    isActive && "nerv-rail-item--active"
                                                )}
                                            >
                                                <span className="relative flex items-center justify-center w-8 h-8">
                                                    <IconComp className="w-4 h-4 flex-shrink-0" />
                                                    {showBadge && (
                                                        <span className="absolute top-0 right-0 w-1.5 h-1.5 rounded-full bg-orange-500" />
                                                    )}
                                                </span>
                                            </Link>
                                        </TooltipTrigger>
                                        <TooltipContent 
                                            side="bottom" 
                                            sideOffset={15}
                                            className="bg-[var(--accent-base)] text-black font-semibold border-[var(--accent-base)]"
                                        >
                                            {route.title}
                                        </TooltipContent>
                                    </Tooltip>
                                );
                            })}
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="rail-chevron"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="absolute top-[8px] h-4 w-16 flex items-center justify-center text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                    >
                        <ChevronDown className="w-4 h-4" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
