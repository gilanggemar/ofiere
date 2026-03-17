import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { AgentTasks } from "./AgentTasks";
import { AvatarUpload } from "./agents/AvatarUpload";
import { AgentStatusIndicator } from "./AgentStatusIndicator";
import { AgentMastery } from "./AgentMastery";
import { useTaskStore } from "@/lib/useTaskStore";
import { useAgentAvatar, invalidateAvatarCache } from "@/hooks/useAgentAvatar";

interface Agent {
    id: string;
    name?: string;
    status?: 'idle' | 'working' | 'paused' | 'error' | 'offline';
    currentTask?: string;
    lastActive?: string;
    // Health telemetry fields
    channel?: string;
    accountId?: string;
    running?: boolean;
    connected?: boolean;
    configured?: boolean;
    linked?: boolean;
    probeOk?: boolean;
    botName?: string;
    lastError?: string | null;
}

interface AgentCardProps {
    agent: Agent;
}

/** Derive a display name from agent data */
function getAgentName(agent: Agent): string {
    if (agent.channel === 'slack' && agent.accountId && agent.accountId !== 'default') {
        return agent.accountId.charAt(0).toUpperCase() + agent.accountId.slice(1);
    }
    if (agent.name) return agent.name;
    if (agent.accountId && agent.accountId !== 'default') return agent.accountId;
    if (agent.botName) return agent.botName;
    if (agent.channel) return agent.channel;
    return agent.id;
}

/** Map health booleans to a status string */
function getAgentStatus(agent: Agent): 'online' | 'active' | 'thinking' | 'error' | 'offline' | 'external' {
    if (agent.lastError) return 'error';
    if (agent.status === 'working') return 'active';
    if (agent.status === 'error') return 'error';
    if (agent.running && agent.connected) return 'active';
    if (agent.probeOk) return 'online';
    if (agent.running) return 'online';
    return 'offline';
}

export function AgentCard({ agent }: AgentCardProps) {
    const status = getAgentStatus(agent);
    const name = getAgentName(agent);

    // Get task stats for mastery
    const { tasks } = useTaskStore();
    const stats = useMemo(() => {
        const agentTasks = tasks.filter(t => t.agentId === agent.id);
        const completed = agentTasks.filter(t => t.status === 'DONE').length;
        const failed = agentTasks.filter(t => t.status === 'FAILED').length;
        return { completed, failed };
    }, [tasks, agent.id]);

    const { avatarUri, invalidate: invalidateAvatar } = useAgentAvatar(agent.id);
    const [localAvatarUri, setLocalAvatarUri] = useState<string | null>(null);
    // Use local override if set (optimistic update), otherwise use hook value
    const displayAvatar = localAvatarUri || avatarUri;

    const isOnline = status !== 'offline' && status !== 'error';
    const [hasOpenPopover, setHasOpenPopover] = useState(false);
    const handlePopoverChange = useCallback((isOpen: boolean) => setHasOpenPopover(isOpen), []);

    return (
        <Card className={cn(
            "relative rounded-3xl backdrop-blur-sm transition-all duration-300 shadow-xl border border-border/40",
            isOnline ? "bg-card" : "bg-card/60",
            hasOpenPopover && "z-50"
        )}>
            {/* Header matching screenshot */}
            <CardHeader className="flex flex-row items-start justify-between p-6 pb-2 gap-3 space-y-0">
                <div className="flex gap-4 w-full">
                    <AvatarUpload
                        currentAvatar={displayAvatar}
                        agentName={name}
                        width={72}
                        height={96}
                        onAvatarChange={async (uri) => {
                            setLocalAvatarUri(uri); // Optimistic update with base64
                            try {
                                const res = await fetch('/api/agents/avatar', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ agentId: agent.id, avatar: uri })
                                });
                                const data = await res.json();
                                if (data.avatar) {
                                    setLocalAvatarUri(data.avatar); // Update with URL
                                    invalidateAvatarCache(agent.id); // Clear global cache
                                    invalidateAvatar(); // Refetch for other components
                                }
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                    />

                    <div className="flex flex-col gap-1.5 flex-1 min-w-0 pt-1">
                        <div className="flex items-center gap-2">
                            <h3 className="text-base font-semibold tracking-tight text-foreground truncate">{name}</h3>
                            <AgentStatusIndicator status={status} size="sm" />
                        </div>

                        <AgentMastery
                            agentId={agent.id}
                            agentName={name}
                            completedTasks={stats.completed}
                            failedTasks={stats.failed}
                            className="mt-1"
                        />
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                <AgentTasks agentId={agent.id} onPopoverChange={handlePopoverChange} />
            </CardContent>
        </Card >
    );
}
