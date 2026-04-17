"use client";

import { create } from "zustand";

/* ─── Route & Group Definitions ─── */

export type NavRoute = {
    id: string;
    title: string;
    link: string;
    iconName: string; // lucide icon name, resolved in component
};

export type NavGroup = "PRIMARY" | "OPERATIONS" | "INTELLIGENCE" | "SETTINGS";

export const NAV_GROUPS: Record<NavGroup, NavRoute[]> = {
    PRIMARY: [
        { id: "overview", title: "Agents", link: "/dashboard", iconName: "Home" },
        { id: "chat", title: "Chat", link: "/chat", iconName: "Package2" },
        { id: "summit", title: "The Summit", link: "/summit", iconName: "Activity" },
        { id: "games", title: "Games", link: "/dashboard/games", iconName: "Target" },
        { id: "constellation", title: "Constellation", link: "/dashboard/constellation", iconName: "GitBranch" },
        { id: "console", title: "Console", link: "/console", iconName: "Store" },
    ],
    OPERATIONS: [
        { id: "projects", title: "Projects", link: "/dashboard/projects", iconName: "FolderKanban" },
        { id: "task-ops", title: "Task-Ops", link: "/agents", iconName: "ClipboardList" },
        { id: "workflows", title: "Workflows", link: "/dashboard/workflows", iconName: "GitBranch" },
        { id: "notifications", title: "Notifications", link: "/dashboard/notifications", iconName: "Bell" },
    ],
    INTELLIGENCE: [
        { id: "capabilities", title: "Capabilities", link: "/dashboard/capabilities", iconName: "Puzzle" },
        { id: "observability", title: "Observability", link: "/dashboard/observability", iconName: "Eye" },
        { id: "knowledge", title: "Knowledge", link: "/dashboard/knowledge", iconName: "Brain" },
        { id: "audit", title: "Audit Trail", link: "/dashboard/audit", iconName: "ClipboardList" },
    ],
    SETTINGS: [
        { id: "settings", title: "Settings", link: "/settings", iconName: "Settings" },
    ],
};

/* ─── Resolve active group from a pathname ─── */
export function resolveGroupFromPath(pathname: string): NavGroup {
    for (const group of Object.keys(NAV_GROUPS) as NavGroup[]) {
        const routes = NAV_GROUPS[group];
        for (const route of routes) {
            if (
                pathname === route.link ||
                (route.link !== "/dashboard" && pathname.startsWith(route.link + "/")) ||
                (route.link === "/dashboard" && pathname === "/dashboard")
            ) {
                return group;
            }
        }
    }
    return "PRIMARY";
}

export function resolveSubPageFromPath(pathname: string, group: NavGroup): string {
    const routes = NAV_GROUPS[group];
    for (const route of routes) {
        if (
            pathname === route.link ||
            (route.link !== "/dashboard" && pathname.startsWith(route.link + "/")) ||
            (route.link === "/dashboard" && pathname === "/dashboard")
        ) {
            return route.id;
        }
    }
    return routes[0]?.id || "";
}

/* ─── Store ─── */

interface NavigationState {
    activeGroup: NavGroup;
    activeSubPageId: string;
    setActiveGroup: (group: NavGroup) => void;
    setActiveSubPage: (id: string) => void;
    syncFromPath: (pathname: string) => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
    activeGroup: "PRIMARY",
    activeSubPageId: "chat",
    setActiveGroup: (group) => {
        const firstItem = NAV_GROUPS[group][0];
        set({ activeGroup: group, activeSubPageId: firstItem?.id || "" });
    },
    setActiveSubPage: (id) => set({ activeSubPageId: id }),
    syncFromPath: (pathname) => {
        const group = resolveGroupFromPath(pathname);
        const subPage = resolveSubPageFromPath(pathname, group);
        set({ activeGroup: group, activeSubPageId: subPage });
    },
}));
