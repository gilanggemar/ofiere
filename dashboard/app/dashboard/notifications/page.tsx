"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Bell, BellOff, CheckCheck, Trash2, Plus, Shield, AlertTriangle,
    Info, CheckCircle2, XCircle, Clock, Zap, Filter,
    Check, RefreshCw, X, Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { CONDITION_LABELS, SEVERITY_COLORS } from "@/lib/notifications/types";
import type { AlertRule, AlertCondition, AlertSeverity } from "@/lib/notifications/types";
import { AgentAvatar } from "@/components/agents/AgentAvatar";

type Tab = "inbox" | "alerts";

const TYPE_ICONS: Record<string, { icon: any; color: string }> = {
    info: { icon: Info, color: "text-blue-400" },
    success: { icon: CheckCircle2, color: "text-emerald-400" },
    warning: { icon: AlertTriangle, color: "text-amber-400" },
    error: { icon: XCircle, color: "text-red-400" },
    alert: { icon: Shield, color: "text-orange-400" },
};

export default function NotificationsPage() {
    const {
        notifications, alertRules, unreadCount,
        fetchNotifications, fetchAlertRules, markAllRead,
        markRead, deleteNotification,
    } = useNotificationStore();

    const pendingGates = useWorkflowBuilderStore((s) => s.pendingGates);
    const approveGate = useWorkflowBuilderStore((s) => s.approveGate);
    const retryGate = useWorkflowBuilderStore((s) => s.retryGate);
    const declineGate = useWorkflowBuilderStore((s) => s.declineGate);

    const [tab, setTab] = useState<Tab>("inbox");
    const [createAlertOpen, setCreateAlertOpen] = useState(false);

    useEffect(() => {
        fetchNotifications();
        fetchAlertRules();
    }, [fetchNotifications, fetchAlertRules]);

    const handleDeleteAlert = useCallback(async (id: string) => {
        try {
            await fetch(`/api/alerts/${id}`, { method: "DELETE" });
            fetchAlertRules();
        } catch (e) {
            console.error("Failed:", e);
        }
    }, [fetchAlertRules]);

    const handleToggleAlert = useCallback(async (rule: AlertRule) => {
        try {
            await fetch(`/api/alerts/${rule.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !rule.isActive }),
            });
            fetchAlertRules();
        } catch (e) {
            console.error("Failed:", e);
        }
    }, [fetchAlertRules]);

    return (
        <div className="flex flex-col h-full gap-5">
            <div className="flex items-center justify-between pb-3">
                <div className="flex items-center gap-3">
                    <h1 className="text-xl font-semibold tracking-tight text-foreground">Notifications</h1>
                    {unreadCount > 0 && (
                        <Badge className="rounded-full h-5 px-2 text-[10px] bg-red-500/10 text-red-400 border-red-500/20">
                            {unreadCount} unread
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {tab === "inbox" && unreadCount > 0 && (
                        <Button variant="ghost" size="sm"
                            className="h-8 px-3 text-xs rounded-full text-muted-foreground gap-1.5"
                            onClick={markAllRead}
                        >
                            <CheckCheck className="w-3 h-3" /> Mark all read
                        </Button>
                    )}
                    {tab === "alerts" && (
                        <Button size="sm"
                            className="rounded-full h-8 px-4 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5"
                            onClick={() => setCreateAlertOpen(true)}
                        >
                            <Plus className="w-3 h-3" /> New Rule
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 bg-accent/30 rounded-xl p-1 w-fit">
                <button
                    onClick={() => setTab("inbox")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "inbox" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Bell className="w-3.5 h-3.5 inline mr-1.5" />
                    Inbox
                </button>
                <button
                    onClick={() => setTab("alerts")}
                    className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-colors ${tab === "alerts" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                        }`}
                >
                    <Shield className="w-3.5 h-3.5 inline mr-1.5" />
                    Alert Rules
                </button>
            </div>

            <ScrollArea className="flex-1">
                {tab === "inbox" ? (
                    <div className="space-y-1.5 pb-6 max-w-2xl">
                        {/* Pending Workflow Approvals */}
                        {pendingGates.length > 0 && (
                            <div className="space-y-2 mb-4">
                                <p className="text-[10px] uppercase font-semibold tracking-widest text-orange-400 px-1">
                                    Pending Approvals
                                </p>
                                {pendingGates.map((gate, idx) => (
                                    <PendingApprovalCard
                                        key={`${gate.nodeId}-${gate.runId}-${gate.requestedAt}`}
                                        gate={gate}
                                        onApprove={approveGate}
                                        onRetry={retryGate}
                                        onDecline={declineGate}
                                    />
                                ))}
                            </div>
                        )}
                        {notifications.length === 0 && pendingGates.length === 0 ? (
                            <Card className="rounded-xl border-dashed border-border bg-card/50 shadow-none">
                                <CardContent className="p-8 text-center">
                                    <BellOff className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">No notifications.</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">You're all caught up!</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {notifications.map((n) => {
                                    const typeCfg = TYPE_ICONS[n.type] || TYPE_ICONS.info;
                                    const Icon = typeCfg.icon;
                                    return (
                                        <motion.div
                                            key={n.id}
                                            layout
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                        >
                                            <Card className={`rounded-xl border-border shadow-none py-0 gap-0 transition-colors ${n.isRead ? "bg-card" : "bg-accent/20 border-foreground/5"
                                                }`}>
                                                <CardContent className="p-3">
                                                    <div className="flex items-start gap-3">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-accent/50 ${typeCfg.color} shrink-0 mt-0.5`}>
                                                            <Icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className={`text-xs font-medium ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>
                                                                {n.title}
                                                            </p>
                                                            <p className="text-[11px] text-muted-foreground mt-0.5">{n.message}</p>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                {n.agentId && (
                                                                    <div className="flex items-center gap-1.5 bg-secondary/50 rounded-full px-1.5 py-0.5 text-foreground">
                                                                        <AgentAvatar agentId={n.agentId} size={12} />
                                                                        <span className="capitalize text-[9px] font-medium leading-none">{n.agentId}</span>
                                                                    </div>
                                                                )}
                                                                <span className="text-[9px] text-muted-foreground/40">
                                                                    {new Date(n.createdAt).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-0.5 shrink-0">
                                                            {!n.isRead && (
                                                                <Button variant="ghost" size="sm"
                                                                    className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                                                                    onClick={() => markRead(n.id)}
                                                                >
                                                                    <CheckCheck className="w-3 h-3" />
                                                                </Button>
                                                            )}
                                                            <Button variant="ghost" size="sm"
                                                                className="h-6 w-6 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                                onClick={() => deleteNotification(n.id)}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                ) : (
                    <div className="space-y-2 pb-6 max-w-2xl">
                        {alertRules.length === 0 ? (
                            <Card className="rounded-xl border-dashed border-border bg-card/50 shadow-none">
                                <CardContent className="p-8 text-center">
                                    <Shield className="w-8 h-8 mx-auto text-muted-foreground/40 mb-3" />
                                    <p className="text-sm text-muted-foreground">No alert rules configured.</p>
                                    <p className="text-xs text-muted-foreground/60 mt-1">Create rules to get notified about important events.</p>
                                </CardContent>
                            </Card>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {alertRules.map((rule) => {
                                    const conditionMeta = CONDITION_LABELS[rule.condition as AlertCondition];
                                    const sevColor = SEVERITY_COLORS[rule.severity as AlertSeverity] || "text-muted-foreground";
                                    return (
                                        <motion.div key={rule.id} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}>
                                            <Card className={`rounded-xl border-border shadow-none py-0 gap-0 ${rule.isActive ? "bg-card" : "bg-card/50 opacity-60"}`}>
                                                <CardContent className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-accent/50 ${sevColor} shrink-0`}>
                                                            <AlertTriangle className="w-4 h-4" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-0.5">
                                                                <p className="text-xs font-medium text-foreground">{rule.name}</p>
                                                                <Badge variant="secondary" className={`text-[9px] h-4 rounded px-1.5 font-normal ${sevColor}`}>
                                                                    {rule.severity}
                                                                </Badge>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                                                <span>{conditionMeta?.label || rule.condition} &gt; {rule.threshold}{conditionMeta?.unit || ''}</span>
                                                                <span>·</span>
                                                                {rule.agentId ? (
                                                                    <div className="flex items-center gap-1">
                                                                        <AgentAvatar agentId={rule.agentId} size={12} className="opacity-70" />
                                                                        <span className="capitalize">{rule.agentId}</span>
                                                                    </div>
                                                                ) : (
                                                                    <span>all agents</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-2 mt-1 text-[9px] text-muted-foreground/40">
                                                                <span className="flex items-center gap-0.5">
                                                                    <Clock className="w-2.5 h-2.5" /> Cooldown: {Math.round(rule.cooldownMs / 60000)}m
                                                                </span>
                                                                {rule.lastTriggeredAt && (
                                                                    <span>Last: {new Date(rule.lastTriggeredAt).toLocaleDateString()}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button variant="ghost" size="sm"
                                                                className={`h-7 px-2 rounded-lg text-xs gap-1 ${rule.isActive ? "text-emerald-400" : "text-muted-foreground"}`}
                                                                onClick={() => handleToggleAlert(rule)}
                                                            >
                                                                <Zap className="w-3 h-3" /> {rule.isActive ? "On" : "Off"}
                                                            </Button>
                                                            <Button variant="ghost" size="sm"
                                                                className="h-7 w-7 p-0 rounded-lg text-muted-foreground hover:text-red-400"
                                                                onClick={() => handleDeleteAlert(rule.id)}
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </motion.div>
                                    );
                                })}
                            </AnimatePresence>
                        )}
                    </div>
                )}
            </ScrollArea>

            <CreateAlertDialog open={createAlertOpen} onOpenChange={setCreateAlertOpen} onCreated={fetchAlertRules} />
        </div>
    );
}

/* ─── Pending Approval Card ─── */
function PendingApprovalCard({
    gate,
    onApprove,
    onRetry,
    onDecline,
}: {
    gate: { nodeId: string; workflowId: string; runId: string; workflowName?: string; reviewData: Record<string, unknown>; requestedAt: number };
    onApprove: (nodeId: string, instructions?: string) => Promise<void>;
    onRetry: (nodeId: string, instructions?: string) => Promise<void>;
    onDecline: (nodeId: string) => void;
}) {
    const [instructions, setInstructions] = useState("");
    const [loading, setLoading] = useState<string | null>(null);

    const handleApprove = async () => {
        setLoading("approve");
        await onApprove(gate.nodeId, instructions.trim() || undefined);
        setLoading(null);
        setInstructions("");
    };
    const handleRetry = async () => {
        setLoading("retry");
        await onRetry(gate.nodeId, instructions.trim() || undefined);
        setLoading(null);
        setInstructions("");
    };
    const handleDecline = () => {
        onDecline(gate.nodeId);
        setInstructions("");
    };

    return (
        <Card className="rounded-xl border-orange-500/30 bg-orange-500/5 shadow-none py-0 gap-0">
            <CardContent className="p-4">
                <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-orange-500/15 text-orange-400 shrink-0 mt-0.5">
                        <Users className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground">
                            Human Approval Required
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                            Workflow <span className="text-foreground font-medium">{gate.workflowName || "Untitled"}</span> is waiting for your review
                        </p>
                        <p className="text-[9px] text-muted-foreground/40 mt-0.5">
                            {new Date(gate.requestedAt).toLocaleString()}
                        </p>

                        {/* Instructions */}
                        <textarea
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            placeholder="Reviewer instructions (optional)…"
                            rows={2}
                            className="w-full mt-2.5 rounded-lg border border-border bg-background/60 text-xs text-foreground px-2.5 py-1.5 resize-y outline-none focus:border-orange-500/50 transition-colors placeholder:text-muted-foreground/50"
                        />

                        {/* Action buttons */}
                        <div className="flex gap-2 mt-2">
                            <Button
                                size="sm"
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                                onClick={handleApprove}
                                disabled={!!loading}
                            >
                                <Check className="w-3 h-3" />
                                {loading === "approve" ? "…" : "Approve"}
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold gap-1 bg-amber-600 hover:bg-amber-500 text-white"
                                onClick={handleRetry}
                                disabled={!!loading}
                            >
                                <RefreshCw className="w-3 h-3" />
                                {loading === "retry" ? "…" : "Retry"}
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-3 rounded-lg text-[11px] font-semibold gap-1 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                onClick={handleDecline}
                                disabled={!!loading}
                            >
                                <X className="w-3 h-3" />
                                Decline
                            </Button>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Create Alert Dialog ─── */
function CreateAlertDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; onCreated: () => void }) {
    const [name, setName] = useState("");
    const [condition, setCondition] = useState<string>("cost_exceeds");
    const [threshold, setThreshold] = useState("100");
    const [severity, setSeverity] = useState<string>("medium");
    const [saving, setSaving] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setSaving(true);
        try {
            await fetch("/api/alerts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: name.trim(), condition, threshold: parseFloat(threshold),
                    severity, channels: ["dashboard"], cooldownMs: 300000,
                }),
            });
            setName(""); setThreshold("100");
            onCreated();
            onOpenChange(false);
        } catch (e) {
            console.error("Failed:", e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-2xl">
                <DialogHeader>
                    <DialogTitle className="text-base">New Alert Rule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Name</label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="High cost alert"
                            className="h-8 text-[13px] rounded-xl border-border bg-background" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">Condition</label>
                            <Select value={condition} onValueChange={setCondition}>
                                <SelectTrigger className="h-8 text-[12px] rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    {Object.entries(CONDITION_LABELS).map(([k, v]) => (
                                        <SelectItem key={k} value={k} className="text-xs rounded-lg">{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">Threshold</label>
                            <Input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)}
                                className="h-8 text-[12px] rounded-xl border-border bg-background" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-[11px] text-muted-foreground">Severity</label>
                        <Select value={severity} onValueChange={setSeverity}>
                            <SelectTrigger className="h-8 text-[12px] rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="low" className="text-xs rounded-lg">Low</SelectItem>
                                <SelectItem value="medium" className="text-xs rounded-lg">Medium</SelectItem>
                                <SelectItem value="high" className="text-xs rounded-lg">High</SelectItem>
                                <SelectItem value="critical" className="text-xs rounded-lg">Critical</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="ghost" size="sm" className="rounded-full h-8 px-4 text-xs">Cancel</Button>
                    </DialogClose>
                    <Button size="sm" className="rounded-full h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={handleCreate} disabled={saving || !name.trim()}>
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
