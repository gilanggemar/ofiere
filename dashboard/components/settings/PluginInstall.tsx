"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Puzzle, Loader2, CheckCircle2, AlertCircle, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSocketStore, useSocket } from "@/lib/useSocket";
import { toast } from "sonner";

type InstallStatus = "idle" | "installing" | "success" | "error";

export function PluginInstall() {
    const { agents } = useSocketStore();
    const { sendChatMessage } = useSocket();
    const [status, setStatus] = useState<InstallStatus>("idle");
    const [errorMsg, setErrorMsg] = useState("");
    const [copied, setCopied] = useState(false);

    // Auto-pick the first available agent to execute the install
    // The user never needs to choose — the plugin installs globally for ALL agents
    const availableAgents = agents.filter(
        (a: any) => a.running || a.probeOk || a.connected
    );

    const effectiveAgent = availableAgents.length > 0
        ? (availableAgents[0].accountId || availableAgents[0].name || availableAgents[0].id)
        : "";

    const handleInstall = useCallback(async () => {
        if (!effectiveAgent) {
            toast.error("No agent available. Connect an agent first.");
            return;
        }

        setStatus("installing");
        setErrorMsg("");

        try {
            // 1. Fetch the install prompt from the server (contains embedded credentials)
            const res = await fetch("/api/plugin/handshake", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ agentId: effectiveAgent }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to generate install instructions");
            }

            if (!data.prompt) {
                throw new Error("Server returned empty install prompt");
            }

            // 2. Send the prompt to the agent via the BROWSER's existing WebSocket
            // This works because the browser IS on the user's network (Tailscale, LAN, etc.)
            const sessionKey = `agent:${effectiveAgent}:nchat`;
            sendChatMessage(effectiveAgent, data.prompt, sessionKey, undefined, true);

            setStatus("success");
            toast.success("Plugin install sent! Your agent is configuring it now.");

            // Reset after a bit
            setTimeout(() => setStatus("idle"), 12000);
        } catch (err: any) {
            setStatus("error");
            setErrorMsg(err.message || "Unknown error");
            toast.error(`Install failed: ${err.message}`);
        }
    }, [effectiveAgent, sendChatMessage]);

    const handleCopyCommand = useCallback(async () => {
        const cmd = `curl -sSL https://raw.githubusercontent.com/gilanggemar/Ofiere/main/ofiere-openclaw-plugin/install.sh | bash -s -- --supabase-url "$SUPABASE_URL" --service-key "$SERVICE_ROLE_KEY" --user-id "$USER_ID"`;
        await navigator.clipboard.writeText(cmd);
        setCopied(true);
        toast.success("Install command copied!");
        setTimeout(() => setCopied(false), 2000);
    }, []);

    return (
        <Card className="rounded-md border-border bg-card shadow-none py-0 gap-0">
            <CardContent className="p-4 space-y-4">
                {/* Main Row */}
                <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center bg-orange-500/10 text-orange-400 shrink-0 mt-0.5">
                            <Puzzle className="w-4.5 h-4.5" />
                        </div>
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <p className="text-sm font-medium text-foreground">
                                    Ofiere Plugin for OpenClaw
                                </p>
                                <StatusBadge status={status} />
                            </div>
                            <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md">
                                Gives all your agents the ability to create, update, and manage tasks directly from chat.
                                Install once — every agent gets the tools automatically.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            onClick={handleInstall}
                            disabled={status === "installing" || !effectiveAgent}
                            size="sm"
                            className="rounded-full h-8 px-4 text-xs bg-orange-500 hover:bg-orange-600 text-white gap-1.5"
                        >
                            {status === "installing" ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Installing...
                                </>
                            ) : status === "success" ? (
                                <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    Installed
                                </>
                            ) : (
                                <>
                                    <Puzzle className="w-3 h-3" />
                                    {status === "error" ? "Retry Install" : "Connect Plugin"}
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                {/* Error message */}
                <AnimatePresence>
                    {status === "error" && errorMsg && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 text-[11px] text-red-400 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2"
                        >
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            {errorMsg}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Success message */}
                <AnimatePresence>
                    {status === "success" && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/20 rounded-md px-3 py-2 space-y-1"
                        >
                            <p className="font-medium">✓ Install instructions sent to your agent!</p>
                            <p className="text-emerald-400/70">
                                Your agent is downloading and configuring the plugin now. 
                                After it finishes, restart your OpenClaw gateway to activate.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Fallback: manual install command */}
                {availableAgents.length === 0 && (
                    <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground/70">
                            No agents online. Connect an agent first, or install manually via terminal:
                        </p>
                        <div className="flex items-center gap-2">
                            <code className="text-[10px] text-muted-foreground bg-muted/30 border border-border/40 rounded-md px-2.5 py-1.5 flex-1 overflow-x-auto whitespace-nowrap font-mono">
                                curl -sSL https://raw.githubusercontent.com/.../install.sh | bash -s -- ...
                            </code>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopyCommand}
                                className="h-7 px-2 text-[10px] rounded-md shrink-0 gap-1"
                            >
                                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                                {copied ? "Copied" : "Copy"}
                            </Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function StatusBadge({ status }: { status: InstallStatus }) {
    if (status === "idle") return null;

    const config = {
        installing: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", label: "Installing..." },
        success: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", label: "Connected" },
        error: { color: "text-red-400 bg-red-500/10 border-red-500/20", label: "Error" },
    }[status];

    if (!config) return null;

    return (
        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded border ${config.color}`}>
            {config.label}
        </span>
    );
}
