"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    SidebarGroup,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export type Route = {
    id: string;
    title: string;
    icon: React.ReactNode;
    link: string;
    status?: 'active' | 'error';
    badge?: boolean;
    subs?: { title: string; link: string; icon?: React.ReactNode }[];
};

export type RouteGroup = {
    group: string;
    defaultExpanded?: boolean;
    items: Route[];
};

export default function DashboardNavigation({
    topRoutes = [],
    groups = [],
    bottomRoutes = []
}: {
    topRoutes?: Route[],
    groups?: RouteGroup[],
    bottomRoutes?: Route[]
}) {
    const pathname = usePathname();

    // Read notification & workflow states for badge dots
    const unreadCount = useNotificationStore((s) => s.unreadCount);
    const notifications = useNotificationStore((s) => s.notifications);
    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);

    // Check for unread agent messages (notifications from agents = chat indicator)
    const hasUnreadAgentChat = notifications.some(n => !n.isRead && n.agentId);

    const renderRoute = (route: Route, isChild = false) => {
        // Improved active detection: exact match for root paths, startsWith for nested
        const isActive = route.link !== "#" && (
            pathname === route.link ||
            (route.link !== "/dashboard" && pathname?.startsWith(route.link + "/")) ||
            (route.link === "/dashboard" && pathname === "/dashboard")
        );

        // Dynamic badge: show dot on Notifications if unread or pending gates, on Chat if unread agent messages
        const showBadge = route.badge || (
            route.id === 'notifications' && (unreadCount > 0 || pendingGates.length > 0)
        ) || (
            route.id === 'chat' && hasUnreadAgentChat
        );

        return (
            <SidebarMenuItem key={route.id}>
                <SidebarMenuButton
                    asChild
                    tooltip={route.title}
                    isActive={isActive}
                    className={cn(
                        "transition-all rounded-lg",
                        isActive
                            ? "bg-sidebar-accent/80 text-sidebar-accent-foreground"
                            : "hover:bg-sidebar-accent/40"
                    )}
                >
                    <Link href={route.link} className="flex relative items-center w-full">
                        <span className="relative">
                            {route.icon}
                            {showBadge && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 ring-2 ring-sidebar" />
                            )}
                        </span>
                        <span className="text-[13px] ml-2 group-data-[collapsible=icon]:hidden">{route.title}</span>
                        {route.status === 'active' && (
                            <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse group-data-[collapsible=icon]:hidden" />
                        )}
                        {route.status === 'error' && (
                            <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-red-400 group-data-[collapsible=icon]:hidden" />
                        )}
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        );
    };

    const NavGroupItem = ({ group }: { group: RouteGroup }) => {
        const isGroupActive = group.items.some(item => pathname?.startsWith(item.link) && item.link !== "#");

        // Initialize with SSR-safe value (fallback to true like before)
        const [isOpen, setIsOpen] = React.useState(true);
        const [isMounted, setIsMounted] = React.useState(false);

        React.useEffect(() => {
            const saved = localStorage.getItem(`sidebar-group-${group.group}`);
            if (saved !== null) {
                setIsOpen(saved === "true");
            } else {
                setIsOpen(isGroupActive || group.defaultExpanded || false);
            }
            // Delay mounting flag slightly to prevent initial render animation jank
            const timer = setTimeout(() => setIsMounted(true), 50);
            return () => clearTimeout(timer);
        }, [group.group, isGroupActive]);

        const toggle = (newOpen: boolean) => {
            setIsOpen(newOpen);
            if (typeof window !== "undefined") {
                localStorage.setItem(`sidebar-group-${group.group}`, String(newOpen));
            }
        };

        return (
            <Collapsible
                open={isOpen}
                onOpenChange={toggle}
                className="group/collapsible"
            >
                <SidebarMenu>
                    <CollapsibleTrigger asChild>
                        <div className="flex items-center justify-between px-2 py-1.5 cursor-pointer hover:text-foreground text-[color:var(--sidebar-group-label)] transition-colors group-data-[collapsible=icon]:hidden">
                            <span className="text-[10px] uppercase font-semibold tracking-widest">{group.group}</span>
                            <ChevronRight className={cn("h-3.5 w-3.5 transition-transform duration-200", isOpen && "rotate-90")} />
                        </div>
                    </CollapsibleTrigger>
                    <AnimatePresence initial={false}>
                        {isOpen && (
                            <motion.div
                                key="sidebar-group-content"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={isMounted ? {
                                    height: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
                                    opacity: { duration: 0.15, ease: 'easeInOut' }
                                } : { duration: 0 }}
                                style={{ overflow: 'hidden' }}
                            >
                                <div className="py-1 space-y-1 mt-1">
                                    {group.items.map(route => renderRoute(route, true))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SidebarMenu>
            </Collapsible>
        );
    };

    return (
        <SidebarGroup className="flex flex-col gap-4">
            {/* Top Standalone Routes */}
            {topRoutes.length > 0 && (
                <SidebarMenu>
                    {topRoutes.map(route => renderRoute(route))}
                </SidebarMenu>
            )}

            {/* Grouped Routes */}
            {groups.map((group) => (
                <NavGroupItem key={group.group} group={group} />
            ))}

            {/* Bottom Standalone Routes */}
            {bottomRoutes.length > 0 && (
                <div className="mt-auto pt-4 border-t border-border/50">
                    <SidebarMenu>
                        {bottomRoutes.map(route => renderRoute(route))}
                    </SidebarMenu>
                </div>
            )}
        </SidebarGroup>
    );
}
