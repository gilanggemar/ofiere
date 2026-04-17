"use client";

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarTrigger,
    useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import {
    Activity,
    Home,
    Package2,
    PieChart,
    Settings,
    Store,
    Plug,
    Eye,
    ClipboardList,
    Brain,
    GitBranch,
    Bell,
    Calendar,
    Plug2,
    Code2,
    Link,
    Target,
    Puzzle,
    LogOut,
    FolderKanban,
} from "lucide-react";
import { Logo } from "./logo";
import type { Route } from "./nav-main";
import DashboardNavigation from "./nav-main";
import { NotificationsPopover } from "./nav-notifications";
import { TeamSwitcher } from "./team-switcher";
import { ThemeToggle } from "./ThemeToggle";
import { useAuthStore } from "@/store/useAuthStore";
import { useRouter } from "next/navigation";

const sampleNotifications = [
    {
        id: "1",
        avatar: "/avatars/01.png",
        fallback: "OM",
        text: "New action required.",
        time: "10m ago",
    },
    {
        id: "2",
        avatar: "/avatars/02.png",
        fallback: "JL",
        text: "Agent deployment completed.",
        time: "1h ago",
    },
];

export type RouteGroup = {
    group: string;
    items: Route[];
};

const standaloneTopRoutes: Route[] = [];

const dashboardRouteGroups: RouteGroup[] = [
    {
        group: "PRIMARY",
        items: [
            { id: "overview", title: "Agents", icon: <Home className="size-3.5" />, link: "/dashboard" },
            { id: "chat", title: "Chat", icon: <Package2 className="size-3.5" />, link: "/chat" },
            { id: "summit", title: "The Summit", icon: <Activity className="size-3.5" />, link: "/summit" },
            { id: "games", title: "Games", icon: <Target className="size-3.5" />, link: "/dashboard/games" },
            { id: "constellation", title: "Constellation", icon: <GitBranch className="size-3.5" />, link: "/dashboard/constellation" },
            { id: "console", title: "Console", icon: <Store className="size-3.5" />, link: "/console", status: 'active' },
        ]
    },
    {
        group: "OPERATIONS",
        items: [
            { id: "projects", title: "Projects", icon: <FolderKanban className="size-3.5" />, link: "/dashboard/projects" },
            { id: "task-ops", title: "Task-Ops", icon: <ClipboardList className="size-3.5" />, link: "/agents" },
            { id: "workflows", title: "Workflows", icon: <GitBranch className="size-3.5" />, link: "/dashboard/workflows" },
            { id: "notifications", title: "Notifications", icon: <Bell className="size-3.5" />, link: "/dashboard/notifications" }
        ]
    },
    {
        group: "INTELLIGENCE",
        items: [
            { id: "capabilities", title: "Capabilities", icon: <Puzzle className="size-3.5" />, link: "/dashboard/capabilities" },
            { id: "observability", title: "Observability", icon: <Eye className="size-3.5" />, link: "/dashboard/observability" },
            { id: "knowledge", title: "Knowledge", icon: <Brain className="size-3.5" />, link: "/dashboard/knowledge" },
            { id: "audit", title: "Audit Trail", icon: <ClipboardList className="size-3.5" />, link: "/dashboard/audit" },
        ]
    }
];

const standaloneBottomRoutes: Route[] = [
    {
        id: "settings",
        title: "Settings",
        icon: <Settings className="size-3.5" />,
        link: "/settings",
    }
];

const teams = [
    { id: "1", name: "Ofiere", logo: Logo, plan: "Pro" },
];

export function DashboardSidebar() {
    const { state } = useSidebar();
    const isCollapsed = state === "collapsed";
    const user = useAuthStore((s) => s.user);
    const signOut = useAuthStore((s) => s.signOut);
    const router = useRouter();

    const handleSignOut = async () => {
        await signOut();
        window.location.href = '/login';
    };

    return (
        <Sidebar variant="floating" collapsible="icon">
            <SidebarHeader
                className={cn(
                    "flex md:pt-3.5",
                    isCollapsed
                        ? "flex-row items-center justify-between gap-y-4 md:flex-col md:items-center md:justify-center"
                        : "flex-row items-center justify-between"
                )}
            >
                <div className={cn("flex items-center gap-2.5", isCollapsed ? "justify-center w-full" : "px-2")}>
                    <Logo className="h-7 w-7 text-foreground" />
                    {!isCollapsed && (
                        <span className="text-xl font-bold text-foreground tracking-tight">
                            OFIERE
                        </span>
                    )}
                </div>

                <motion.div
                    key={isCollapsed ? "header-collapsed" : "header-expanded"}
                    className={cn(
                        "flex items-center",
                        isCollapsed ? "flex-row md:flex-col-reverse" : "flex-row"
                    )}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.8 }}
                >
                    <SidebarTrigger />
                </motion.div>
            </SidebarHeader>
            <SidebarContent className={cn("gap-0 py-2", !isCollapsed && "px-2")}>
                <DashboardNavigation
                    topRoutes={standaloneTopRoutes}
                    groups={dashboardRouteGroups}
                    bottomRoutes={standaloneBottomRoutes}
                />
            </SidebarContent>
            <SidebarFooter className={cn("flex gap-2", isCollapsed ? "justify-center items-center" : "px-4", "py-4")}>
                {/* User info + Sign out */}
                {!isCollapsed && user && (
                    <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={user.email || ''}>
                            {user.email}
                        </span>
                        <button
                            onClick={handleSignOut}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                            title="Sign Out"
                        >
                            <LogOut className="size-3.5" />
                        </button>
                    </div>
                )}
                {isCollapsed && user && (
                    <button
                        onClick={handleSignOut}
                        className="flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                        title="Sign Out"
                    >
                        <LogOut className="size-3.5" />
                    </button>
                )}
                <ThemeToggle />
            </SidebarFooter>
        </Sidebar>
    );
}
