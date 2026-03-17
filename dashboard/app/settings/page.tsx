"use client";

import { useSocket, useSocketStore } from "@/lib/useSocket";
import { cn } from "@/lib/utils";
import { useState, useEffect, useCallback } from "react";
import {
    Settings, Save, RotateCcw, Shield, Bell,
    Cpu, Wifi, AlertTriangle, Server, Eye
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from "@/components/ui/tooltip";
import ConnectionProfiles from "@/components/settings/ConnectionProfiles";

import { useAgentSettingsStore } from "@/store/useAgentSettingsStore";

export default function SettingsPage() {
    const { agents, isConnected } = useSocketStore();
    const { sendConfigUpdate } = useSocket();
    const { hiddenAgentIds, setAgentVisibility } = useAgentSettingsStore();

    const [selectedAgentId, setSelectedAgentId] = useState<string>("");
    const [systemPrompt, setSystemPrompt] = useState("");
    const [model, setModel] = useState("gpt-4o");
    const [autoRestart, setAutoRestart] = useState(true);
    const [notifyOnError, setNotifyOnError] = useState(true);
    const [saveStatus, setSaveStatus] = useState<string | null>(null);

    useEffect(() => {
        if (!selectedAgentId && agents.length > 0) {
            const firstId = agents[0]?.accountId || agents[0]?.name || agents[0]?.id;
            setSelectedAgentId(firstId);
        }
    }, [agents, selectedAgentId]);

    const handleSave = useCallback(() => {
        if (!selectedAgentId) return;
        sendConfigUpdate(selectedAgentId, {
            systemPrompt,
            model,
            autoRestart,
            notifyOnError,
        });
        setSaveStatus("Saved");
        setTimeout(() => setSaveStatus(null), 2000);
    }, [selectedAgentId, systemPrompt, model, autoRestart, notifyOnError, sendConfigUpdate]);

    const handleEmergencyShutdown = () => {
        if (!window.confirm("⚠ This will terminate all active agents. Continue?")) return;
        agents.forEach((agent: any) => {
            const id = agent.accountId || agent.name || agent.id;
            sendConfigUpdate(id, { shutdown: true });
        });
    };

    return (
        <div className="flex flex-col h-full gap-5">
            {/* Header */}
            <div className="flex items-center justify-between pb-3">
                <h1 className="text-xl font-semibold tracking-tight text-foreground">Settings</h1>
                <div className="flex items-center gap-2">
                    {saveStatus && (
                        <span className="text-xs text-emerald-500 animate-pulse">{saveStatus}</span>
                    )}
                    <Button
                        onClick={handleSave}
                        disabled={!selectedAgentId}
                        size="sm"
                        className="rounded-full h-9 px-5 text-xs bg-foreground text-background hover:bg-foreground/90 disabled:opacity-30 gap-2"
                    >
                        <Save className="w-3 h-3" />
                        Save Changes
                    </Button>
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="space-y-6 pb-6">

                    {/* Connection Profiles */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Server className="w-3.5 h-3.5" /> Connection Profiles
                        </h2>
                        <ConnectionProfiles />
                    </section>

                    <Separator className="bg-border" />

                    {/* Agent Configuration */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Cpu className="w-3.5 h-3.5" /> Agent Configuration
                        </h2>

                        <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                            <CardContent className="p-4 space-y-4">
                                {/* Agent Selector */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">Target Agent</label>
                                    <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                                        <SelectTrigger className="h-9 text-[13px] rounded-xl border-border bg-background">
                                            <SelectValue placeholder="Select agent" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            {agents.map((a: any) => {
                                                const id = a.accountId || a.name || a.id;
                                                const label = a.accountId
                                                    ? a.accountId.charAt(0).toUpperCase() + a.accountId.slice(1)
                                                    : a.name || a.id;
                                                return (
                                                    <SelectItem key={id} value={id} className="text-xs rounded-xl">
                                                        {label}
                                                    </SelectItem>
                                                );
                                            })}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Model */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">Model</label>
                                    <Select value={model} onValueChange={setModel}>
                                        <SelectTrigger className="h-9 text-[13px] rounded-xl border-border bg-background">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="gpt-4o" className="text-xs rounded-xl">GPT-4o</SelectItem>
                                            <SelectItem value="gpt-4o-mini" className="text-xs rounded-xl">GPT-4o Mini</SelectItem>
                                            <SelectItem value="claude-3.5-sonnet" className="text-xs rounded-xl">Claude 3.5 Sonnet</SelectItem>
                                            <SelectItem value="claude-3-opus" className="text-xs rounded-xl">Claude 3 Opus</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* System Prompt */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">System Prompt</label>
                                    <Textarea
                                        value={systemPrompt}
                                        onChange={(e) => setSystemPrompt(e.target.value)}
                                        placeholder="Override the default system prompt for this agent..."
                                        rows={4}
                                        className="text-[13px] rounded-xl border-border bg-background resize-none"
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <Separator className="bg-border" />

                    {/* Preferences */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Settings className="w-3.5 h-3.5" /> Preferences
                        </h2>

                        <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                            <CardContent className="p-4 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Auto-Restart Agents</p>
                                        <p className="text-[11px] text-muted-foreground">Automatically restart agents after crash</p>
                                    </div>
                                    <Switch checked={autoRestart} onCheckedChange={setAutoRestart} />
                                </div>

                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-foreground">Error Notifications</p>
                                        <p className="text-[11px] text-muted-foreground">Get notified when agents encounter errors</p>
                                    </div>
                                    <Switch checked={notifyOnError} onCheckedChange={setNotifyOnError} />
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    <Separator className="bg-border" />

                    {/* Displayed Agents */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Eye className="w-3.5 h-3.5" /> Displayed Agents
                        </h2>

                        <Card className="rounded-xl border-border bg-card shadow-none py-0 gap-0">
                            <CardContent className="p-4 space-y-4">
                                {agents.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">No agents available.</p>
                                ) : (
                                    agents.map((a: any) => {
                                        const id = a.accountId || a.name || a.id;
                                        const label = a.accountId
                                            ? a.accountId.charAt(0).toUpperCase() + a.accountId.slice(1)
                                            : a.name || a.id;
                                        const isHidden = hiddenAgentIds.includes(id);
                                        return (
                                            <div key={id} className="flex items-center justify-between">
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-medium text-foreground">{label}</p>
                                                    <p className="text-[11px] text-muted-foreground">Show this agent on the dashboard</p>
                                                </div>
                                                <Switch 
                                                    checked={!isHidden} 
                                                    onCheckedChange={(checked) => setAgentVisibility(id, !checked)} 
                                                />
                                            </div>
                                        );
                                    })
                                )}
                            </CardContent>
                        </Card>
                    </section>

                    <Separator className="bg-border" />

                    {/* Danger Zone */}
                    <section className="space-y-4">
                        <h2 className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <Shield className="w-3.5 h-3.5" /> Danger Zone
                        </h2>

                        <Card className="rounded-xl border-red-500/20 bg-red-500/5 shadow-none py-0 gap-0">
                            <CardContent className="p-4">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3 h-3" /> Emergency Shutdown
                                        </p>
                                        <p className="text-[11px] text-muted-foreground">Terminate all active agents immediately</p>
                                    </div>
                                    <Button
                                        onClick={handleEmergencyShutdown}
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full h-8 px-4 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300"
                                    >
                                        Shutdown All
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </ScrollArea>
        </div>
    );
}
