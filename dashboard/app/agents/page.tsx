"use client";

import { useSocketStore } from "@/lib/useSocket";
import { useConnectionStore } from "@/store/useConnectionStore";
import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";
import { AgentCard } from "@/components/AgentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plug2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AgentsPage() {
    const { agents: socketAgents } = useSocketStore();
    const { activeProfile } = useConnectionStore();
    const { hiddenAgentIds } = useAgentSettingsStore();

    // Inject Agent Zero into the roster if it's enabled in the active connection profile
    let availableAgents = [...socketAgents];
    if (activeProfile?.agentZeroEnabled) {
        if (!availableAgents.find(a => a.id === 'agent-zero')) {
            availableAgents.push({
                id: 'agent-zero',
                name: 'Zero',
                status: 'idle',
                channel: 'system',
                accountId: 'agent-zero',
                configured: true,
                running: true,
                connected: true,
                linked: true,
                probeOk: true,
            });
        }
    }

    // Filter out hidden agents
    availableAgents = availableAgents.filter((a: any) => {
        const id = a.accountId || a.name || a.id;
        return !hiddenAgentIds.includes(id);
    });

    const onlineCount = availableAgents.filter(
        (a: any) => a.running || a.probeOk || a.connected
    ).length;

    return (
        <div className="flex flex-col h-full gap-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Agents</h1>
                    <span className="text-xs text-muted-foreground">
                        {onlineCount} online · {availableAgents.length} total
                    </span>
                </div>
            </div>

            {availableAgents.length === 0 ? (
                <div className="flex flex-col items-center justify-center flex-1 pb-20 border border-dashed rounded-3xl border-white/5 bg-foreground/5">
                    <div className="text-5xl mb-6 opacity-80">👻</div>
                    <h3 className="text-xl font-semibold tracking-tight text-foreground mb-2">No Agents Connected</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-6 text-sm">
                        It looks like your roster is empty. Please connect an external engine in your Console settings to wake up your agents.
                    </p>
                    <Link href="/settings/bridges">
                        <Button variant="secondary" className="gap-2 rounded-full px-6">
                            <Plug2 className="size-4" />
                            Connect Engine
                        </Button>
                    </Link>
                </div>
            ) : (
                <ScrollArea className="flex-1 pr-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 items-start gap-6 pb-4">
                        {availableAgents.map((agent: any) => (
                            <div key={agent.id}>
                                <AgentCard agent={agent} />
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            )}
        </div>
    );
}
