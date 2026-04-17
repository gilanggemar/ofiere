"use client";

import { useEffect, useState, useCallback } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
    Search, Home, Eye, ClipboardList, Calendar, GitBranch, Brain,
    Bell, Plug, Plug2, Settings, MessageSquare, Users, Activity,
    Zap, ArrowRight,
} from "lucide-react";

interface CommandItem {
    id: string;
    label: string;
    icon: any;
    action: () => void;
    group: string;
    keywords?: string;
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const router = useRouter();

    // Cmd+K / Ctrl+K to toggle
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "k") {
                e.preventDefault();
                setOpen((o) => !o);
            }
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, []);

    const navigate = useCallback((path: string) => {
        router.push(path);
        setOpen(false);
    }, [router]);

    const items: CommandItem[] = [
        // Navigation
        { id: "home", label: "Mission Control", icon: Home, action: () => navigate("/dashboard"), group: "Navigate", keywords: "home dashboard" },
        { id: "console", label: "Console", icon: Activity, action: () => navigate("/dashboard/console"), group: "Navigate", keywords: "console logs" },
        { id: "chat", label: "Agent Chat", icon: MessageSquare, action: () => navigate("/dashboard/chat"), group: "Navigate", keywords: "chat message" },
        { id: "summit", label: "The Summit", icon: Users, action: () => navigate("/dashboard/summit"), group: "Navigate", keywords: "summit deliberation" },
        { id: "observability", label: "Observability", icon: Eye, action: () => navigate("/dashboard/observability"), group: "Navigate", keywords: "metrics cost tokens" },
        { id: "audit", label: "Audit Trail", icon: ClipboardList, action: () => navigate("/dashboard/audit"), group: "Navigate", keywords: "audit logs actions" },
        { id: "scheduler", label: "Scheduler", icon: Calendar, action: () => navigate("/dashboard/projects"), group: "Navigate", keywords: "cron schedule webhook" },
        { id: "workflows", label: "Workflows", icon: GitBranch, action: () => navigate("/dashboard/workflows"), group: "Navigate", keywords: "workflow pipeline" },
        { id: "knowledge", label: "Knowledge", icon: Brain, action: () => navigate("/dashboard/knowledge"), group: "Navigate", keywords: "memory knowledge" },
        { id: "notifications", label: "Notifications", icon: Bell, action: () => navigate("/dashboard/notifications"), group: "Navigate", keywords: "alerts notifications" },
        { id: "providers", label: "Providers", icon: Plug, action: () => navigate("/settings/providers"), group: "Settings", keywords: "provider api key" },
        { id: "mcp", label: "MCP Servers", icon: Plug2, action: () => navigate("/settings/mcp-servers"), group: "Settings", keywords: "mcp tools" },
        { id: "settings", label: "Settings", icon: Settings, action: () => navigate("/settings"), group: "Settings", keywords: "config preferences" },
        // Quick actions
        { id: "start-summit", label: "Start Summit", icon: Zap, action: () => navigate("/dashboard/summit"), group: "Actions", keywords: "summit start deliberation" },
    ];

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

            {/* Dialog */}
            <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
                <Command
                    className="rounded-md border border-border bg-card shadow-2xl overflow-hidden"
                    label="Command Palette"
                >
                    <div className="flex items-center gap-2 px-4 border-b border-border">
                        <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                        <Command.Input
                            placeholder="Search commands..."
                            className="flex-1 h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                        />
                        <kbd className="text-[9px] text-muted-foreground/50 bg-accent/50 px-1.5 py-0.5 rounded font-mono">ESC</kbd>
                    </div>

                    <Command.List className="max-h-80 overflow-y-auto p-2">
                        <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
                            No results found.
                        </Command.Empty>

                        {["Navigate", "Settings", "Actions"].map((group) => {
                            const groupItems = items.filter((i) => i.group === group);
                            if (groupItems.length === 0) return null;
                            return (
                                <Command.Group
                                    key={group}
                                    heading={group}
                                    className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground/50 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
                                >
                                    {groupItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <Command.Item
                                                key={item.id}
                                                value={`${item.label} ${item.keywords || ""}`}
                                                onSelect={item.action}
                                                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-foreground cursor-pointer transition-colors data-[selected=true]:bg-accent/50 data-[selected=true]:text-foreground"
                                            >
                                                <Icon className="w-4 h-4 text-muted-foreground" />
                                                <span className="flex-1">{item.label}</span>
                                                <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                                            </Command.Item>
                                        );
                                    })}
                                </Command.Group>
                            );
                        })}
                    </Command.List>

                    <div className="border-t border-border px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground/40">
                        <span>Navigate with ↑↓ · Select with ↵</span>
                        <span>⌘K to toggle</span>
                    </div>
                </Command>
            </div>
        </div>
    );
}
