"use client";

import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    MessageSquare,
    Settings,
    Activity,
    Cpu,
    Terminal,
    Wifi,
    WifiOff
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSocket, useSocketStore } from "@/lib/useSocket";
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";
import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";

const NAV_ITEMS = [
    { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
    { icon: Activity, label: "The Summit", href: "/summit" },
    { icon: MessageSquare, label: "Chat", href: "/chat" },
    { icon: Cpu, label: "Agents & Ops", href: "/agents" },
    { icon: Terminal, label: "Console", href: "/console" },
    { icon: Settings, label: "Settings", href: "/settings" },
];

export function AppSidebar() {
    const pathname = usePathname();
    const { isConnected, agents, lastPing } = useSocketStore();
    const { hiddenAgentIds } = useAgentSettingsStore();
    useSocket(); // Initialize socket connection
    
    // Filter agents by hidden status
    const visibleAgentsCount = agents.filter((a: any) => {
        const id = a.accountId || a.name || a.id;
        return !hiddenAgentIds.includes(id);
    }).length;

    return (
        <aside className="w-72 h-screen bg-background border-r border-border flex flex-col text-sm tracking-wide">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-semibold text-foreground tracking-tight">OFIERE</h1>
                        <p className="text-xs text-muted-foreground mt-1">Agent Orchestration</p>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full", isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" : "bg-zinc-600")} />
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
                {NAV_ITEMS.map((item) => {
                    const isActive = pathname?.startsWith(item.href);
                    return (
                        <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                                <Link
                                    href={item.href}
                                    className={cn(
                                        "flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group",
                                        isActive
                                            ? "bg-accent text-foreground font-medium"
                                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                                    )}
                                >
                                    <item.icon className={cn("w-4 h-4", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                                    <span>{item.label}</span>
                                </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right" sideOffset={8}>
                                {item.label}
                            </TooltipContent>
                        </Tooltip>
                    );
                })}
            </nav>

            <Separator className="bg-border" />

            {/* Telemetry Footer */}
            <div className="p-4 text-xs space-y-3">

                {/* Connection Status */}
                <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Gateway</span>
                    <div className="flex items-center gap-2">
                        <Badge
                            variant="outline"
                            className={cn(
                                "text-[10px] font-medium px-2 py-0 h-5 rounded-full border",
                                isConnected
                                    ? "text-emerald-500 border-emerald-500/30 bg-emerald-500/5"
                                    : "text-muted-foreground border-border bg-muted"
                            )}
                        >
                            {isConnected ? "Connected" : "Offline"}
                        </Badge>
                        {isConnected ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-muted-foreground" />}
                    </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2">
                    <Card className="bg-accent/50 border-border rounded-md py-0 gap-0 shadow-none">
                        <CardContent className="p-2.5 px-3">
                            <span className="text-muted-foreground block mb-0.5 text-[10px]">Agents</span>
                            <span className="text-foreground font-semibold text-lg">{visibleAgentsCount}</span>
                        </CardContent>
                    </Card>
                    <Card className="bg-accent/50 border-border rounded-md py-0 gap-0 shadow-none">
                        <CardContent className="p-2.5 px-3">
                            <span className="text-muted-foreground block mb-0.5 text-[10px]">Latency</span>
                            <span className="text-foreground font-semibold">{lastPing ? "< 40ms" : "--"}</span>
                        </CardContent>
                    </Card>
                </div>

                <div className="text-center pt-1">
                    <span className="text-muted-foreground/50 text-[10px]">HCT-001 · v4.0.0</span>
                </div>
            </div>
        </aside>
    );
}
