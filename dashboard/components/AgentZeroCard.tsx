"use client";

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bot, Send, RefreshCw, Trash2, ExternalLink, Activity, Terminal as TerminalIcon, MessageSquare } from 'lucide-react';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import useAgentZeroStore from '@/store/useAgentZeroStore';
import AgentStatusIndicator from '@/components/AgentStatusIndicator';
import { cn } from '@/lib/utils';
import { AgentStatusIndicatorProps } from '@/components/AgentStatusIndicator';
import { ProcessTree } from './agent-zero/ProcessTree';
import { TerminalWindow } from './agent-zero/TerminalWindow';

export interface AgentZeroCardProps {
    className?: string;
    compact?: boolean;
}

export const AgentZeroCard = ({ className, compact }: AgentZeroCardProps) => {
    const {
        status,
        connectionMode,
        messages,
        notifications,
        isResponding,
        contextId,
        checkConnection,
        sendMessage,
        clearMessages,
        resetChat,
        terminateChat,
        snapshot
    } = useAgentZeroStore();

    const [inputValue, setInputValue] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);
    const lastNotificationCount = useRef(0);

    // Auto-check health on mount
    useEffect(() => {
        if (status === 'unconfigured' || status === 'offline') {
            checkConnection();
        }
    }, [checkConnection, status]);

    const handleSend = () => {
        if (!inputValue.trim() || status !== 'online' || isResponding) return;
        sendMessage(inputValue.trim());
        setInputValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSend();
        }
    };

    const isOnline = status === 'online';

    const mapStatusToIndicator = (): AgentStatusIndicatorProps['status'] => {
        switch (status) {
            case 'online': return 'external';
            case 'connecting': return 'active';
            case 'unconfigured': return 'offline';
            case 'error': return 'error';
            default: return 'offline';
        }
    };

    return (
        <Card
            className={cn("ofiere-glass-1 ofiere-glow-border flex flex-col", className)}
            style={{ '--glow-color': 'var(--accent-ocean)' } as React.CSSProperties}
        >
            <CardHeader className="pb-3 border-b border-white/5 flex flex-row items-center justify-between">
                <div className="flex items-center gap-3">
                    <Bot size={20} className="text-[var(--accent-ocean)]" />
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="ofiere-h2">Agent Zero</span>
                            <Badge
                                variant="outline"
                                style={{
                                    backgroundColor: 'var(--accent-ocean-ultra)',
                                    color: 'var(--accent-ocean)',
                                    borderColor: 'var(--accent-ocean-soft)',
                                    fontWeight: 600,
                                    fontSize: '10px'
                                }}
                            >
                                External
                            </Badge>
                        </div>
                        <span className="ofiere-caption">Socket.IO • REST API</span>
                    </div>
                </div>

                <AgentStatusIndicator size="md" status={mapStatusToIndicator()} showLabel={true} />
            </CardHeader>

            <CardContent className="flex flex-col flex-1 p-0 sm:p-4 sm:pt-4">
                <Tabs defaultValue="chat" className="w-full h-full flex flex-col gap-3">
                    <TabsList className="grid w-full grid-cols-3 bg-black/20 h-auto p-1 sticky sm:relative top-0 z-10">
                        <TabsTrigger value="chat" className="text-xs py-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                            <MessageSquare className="w-3.5 h-3.5 mr-1.5" /> Chat
                        </TabsTrigger>
                        <TabsTrigger value="process" className="text-xs py-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                            <Activity className="w-3.5 h-3.5 mr-1.5" /> Process
                        </TabsTrigger>
                        <TabsTrigger value="terminal" className="text-xs py-1.5 data-[state=active]:bg-white/10 data-[state=active]:text-white">
                            <TerminalIcon className="w-3.5 h-3.5 mr-1.5" /> Terminal
                        </TabsTrigger>
                    </TabsList>

                    {/* Chat Tab */}
                    <TabsContent value="chat" className="flex flex-col h-[280px] sm:h-[350px] m-0 outline-none gap-3 data-[state=inactive]:hidden">
                        {status === 'online' ? (
                            <>
                                <ScrollArea className="h-full w-full rounded-md flex-1 bg-black/20 border border-white/5">
                                    <div className="flex flex-col gap-3 p-3">
                                        {messages.length === 0 ? (
                                            <div className="h-full min-h-[150px] flex items-center justify-center text-center opacity-50 text-xs">
                                                Connected. Send a prompt to run Agent Zero.
                                            </div>
                                        ) : (
                                            <AnimatePresence>
                                                {messages.map((msg) => (
                                                    <motion.div
                                                        key={msg.id}
                                                        initial={{ opacity: 0, y: 8 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ duration: 0.2 }}
                                                        className={cn(
                                                            "flex flex-col max-w-[85%] rounded-lg px-3 py-2 border",
                                                            msg.role === 'user'
                                                                ? "self-end bg-[oklch(from_var(--accent-base)_l_c_h/0.10)] border-[var(--accent-base)]/20"
                                                                : "self-start bg-[var(--accent-ocean-ultra)] border-[var(--accent-ocean)]/20"
                                                        )}
                                                    >
                                                        <span className="ofiere-body-sm leading-relaxed whitespace-pre-wrap">{msg.content}</span>
                                                        <span className="ofiere-caption text-[9px] mt-1.5 opacity-40 uppercase tracking-widest">
                                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                        </span>
                                                    </motion.div>
                                                ))}
                                                <div ref={scrollRef} />
                                            </AnimatePresence>
                                        )}
                                    </div>
                                </ScrollArea>
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4 bg-black/20 rounded-md border border-white/5">
                                <Bot size={32} className="opacity-20" />
                                <div className="flex flex-col gap-1">
                                    <span className="ofiere-body font-medium">Agent Zero Offline</span>
                                    <span className="ofiere-caption text-muted-foreground max-w-[200px]">Waiting for connection to the Agent Zero VPS. Ensure URL and API Key are set in .env.local</span>
                                </div>
                                <div className="flex items-center gap-2 w-full max-w-[250px] justify-center mt-2">
                                    <Button size="sm" onClick={checkConnection} disabled={status === 'connecting'} className="h-8 w-32">
                                        {status === 'connecting' ? 'Checking...' : 'Check Connection'}
                                    </Button>
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-2 mt-auto">
                            <div className="relative flex-1">
                                <Input
                                    placeholder={status === 'online' ? "Command Agent Zero..." : "Offline..."}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    disabled={!isOnline || isResponding}
                                    className="pl-3 pr-10 border-l-[3px] border-l-[var(--accent-ocean)] focus-visible:ring-[var(--accent-ocean-soft)] h-10"
                                />
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="absolute right-1 top-1.5 h-7 w-7 text-muted-foreground hover:text-[var(--accent-ocean)]"
                                    disabled={!isOnline || isResponding || !inputValue.trim()}
                                    onClick={handleSend}
                                >
                                    <Send size={14} />
                                </Button>
                            </div>
                        </div>
                    </TabsContent>

                    {/* Process Tree Tab */}
                    <TabsContent value="process" className="h-[280px] sm:h-[350px] m-0 outline-none data-[state=inactive]:hidden">
                        <ProcessTree />
                    </TabsContent>

                    {/* Terminal Tab */}
                    <TabsContent value="terminal" className="h-[280px] sm:h-[350px] m-0 outline-none data-[state=inactive]:hidden">
                        <TerminalWindow />
                    </TabsContent>

                    {/* Footer Actions */}
                    <div className="flex items-center gap-2 pt-3 mt-1 border-t border-white/5">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-[10px] sm:text-xs text-muted-foreground hover:text-foreground h-7"
                            onClick={() => checkConnection()}
                            disabled={status === 'connecting'}
                        >
                            <motion.div
                                animate={status === 'connecting' ? { rotate: 360 } : { rotate: 0 }}
                                transition={{ duration: 1, repeat: status === 'connecting' ? Infinity : 0, ease: "linear" }}
                            >
                                <RefreshCw size={12} className="mr-1.5" />
                            </motion.div>
                            {status === 'offline' ? 'Connect' : 'Reconnect'}
                        </Button>

                        {messages.length > 0 && (
                            <div className="flex items-center gap-1">
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[10px] sm:text-xs text-muted-foreground hover:text-[var(--accent-coral)] h-7"
                                    onClick={() => resetChat()}
                                    title="Clear chat history but keep context"
                                >
                                    <Trash2 size={12} className="mr-1.5" />
                                    Clear Chat
                                </Button>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-[10px] sm:text-xs text-muted-foreground hover:text-destructive h-7 px-2"
                                    onClick={() => terminateChat()}
                                    title="Completely terminate this chat instance"
                                >
                                    Terminate
                                </Button>
                            </div>
                        )}

                        <Button
                            size="sm"
                            variant="ghost"
                            className="text-[10px] sm:text-xs text-muted-foreground hover:text-accent-cyan ml-auto h-7"
                            onClick={() => window.open(process.env.NEXT_PUBLIC_AGENT_ZERO_URL || 'http://76.13.193.227:5081', '_blank')}
                        >
                            <ExternalLink size={12} className="mr-1.5" />
                            <span className="hidden sm:inline">Open Native</span>
                            <span className="sm:hidden">UI</span>
                        </Button>
                    </div>

                </Tabs>
            </CardContent>
        </Card>
    );
};

export default AgentZeroCard;
