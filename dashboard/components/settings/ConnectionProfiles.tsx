'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipTrigger,
    TooltipContent,
} from '@/components/ui/tooltip';
import {
    useConnectionStore,
    type ConnectionProfileClient,
    type ConnectionTestResult,
} from '@/store/useConnectionStore';
import {
    Plus, Pencil, FlaskConical, Power, Trash2,
    Loader2, CheckCircle2, XCircle, Wifi,
    Eye, EyeOff, Server, Bot, Zap, Cloud, Container,
    Monitor, ChevronDown, ChevronRight, AlertTriangle,
    Activity, Clock, Signal, WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════
// QUICK PRESETS
// ═══════════════════════════════════════════════════

const PRESETS = {
    local: {
        label: 'Local Default',
        icon: Monitor,
        openclawWsUrl: 'ws://127.0.0.1:18789',
        openclawHttpUrl: 'http://127.0.0.1:18789',
        agentZeroBaseUrl: 'http://127.0.0.1:80',
    },
    vps: {
        label: 'VPS Template',
        icon: Cloud,
        openclawWsUrl: 'wss://your-domain.com/ws',
        openclawHttpUrl: 'https://your-domain.com',
        agentZeroBaseUrl: 'http://your-vps-ip',
    },
    docker: {
        label: 'Docker Compose',
        icon: Container,
        openclawWsUrl: 'ws://openclaw:18789',
        openclawHttpUrl: 'http://openclaw:18789',
        agentZeroBaseUrl: 'http://agent-zero:80',
    },
};

// ═══════════════════════════════════════════════════
// HEALTH DOT
// ═══════════════════════════════════════════════════

function HealthDot({ status }: { status: string | null }) {
    const color =
        status === 'healthy' ? 'bg-emerald-400' :
            status === 'degraded' ? 'bg-amber-400 animate-pulse' :
                status === 'offline' ? 'bg-red-400' :
                    'bg-zinc-500';
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <div className={cn('w-2 h-2 rounded-full shrink-0', color)} />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs capitalize">{status ?? 'Untested'}</TooltipContent>
        </Tooltip>
    );
}

// ═══════════════════════════════════════════════════
// PASSWORD INPUT
// ═══════════════════════════════════════════════════

function PasswordInput({ value, onChange, placeholder }: {
    value: string; onChange: (v: string) => void; placeholder?: string;
}) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <Input
                type={show ? 'text' : 'password'} value={value}
                onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
                className="pr-9 font-mono text-[13px] rounded-xl border-border bg-background"
            />
            <Button type="button" variant="ghost" size="icon"
                className="absolute right-0 top-0 h-full w-9 rounded-r-xl text-muted-foreground hover:text-foreground"
                onClick={() => setShow(!show)}
            >
                {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </Button>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// COLLAPSIBLE SECTION
// ═══════════════════════════════════════════════════

function Section({ title, icon: Icon, defaultOpen = true, children }: {
    title: string; icon: React.ElementType; defaultOpen?: boolean; children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="space-y-3">
            <button type="button" className="flex items-center gap-2 w-full text-left group"
                onClick={() => setOpen(!open)}>
                {open ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{title}</span>
            </button>
            {open && <div className="pl-6 space-y-3">{children}</div>}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// PROFILE CARD (Left column — compact)
// ═══════════════════════════════════════════════════

function ProfileCard({ profile, isSelected, onClick }: {
    profile: ConnectionProfileClient; isSelected: boolean; onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'w-full text-left p-3 rounded-xl border transition-all duration-150 group',
                isSelected
                    ? 'border-emerald-500/30 bg-emerald-500/[0.04] ring-1 ring-emerald-500/20'
                    : 'border-border/40 bg-card/40 hover:bg-card/70 hover:border-border/60'
            )}
        >
            <div className="flex items-center gap-2.5">
                <HealthDot status={profile.lastHealthStatus} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{profile.name}</span>
                        {profile.isActive && (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[9px] h-4 px-1.5">
                                ACTIVE
                            </Badge>
                        )}
                    </div>
                    {profile.description && (
                        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{profile.description}</p>
                    )}
                </div>
            </div>
            {/* Service badges row */}
            <div className="flex items-center gap-1.5 mt-2 pl-[18px]">
                {profile.openclawEnabled && (
                    <Badge variant="outline" className="gap-1 text-[9px] h-4 px-1.5 text-muted-foreground border-border/40">
                        <Server className="w-2.5 h-2.5" /> OC
                    </Badge>
                )}
                {profile.agentZeroEnabled && (
                    <Badge variant="outline" className="gap-1 text-[9px] h-4 px-1.5 text-muted-foreground border-border/40">
                        <Bot className="w-2.5 h-2.5" /> A0
                    </Badge>
                )}
                {!profile.openclawEnabled && !profile.agentZeroEnabled && (
                    <span className="text-[10px] text-muted-foreground/50 italic">No services</span>
                )}
            </div>
        </button>
    );
}

// ═══════════════════════════════════════════════════
// TEST RESULTS PANEL (inside right column)
// ═══════════════════════════════════════════════════

function TestResultsPanel({ result }: { result: ConnectionTestResult | null }) {
    if (!result) return null;

    const ResultRow = ({ label, tested, reachable, latencyMs, error, extra }: {
        label: string; tested: boolean; reachable: boolean;
        latencyMs: number | null; error: string | null; extra?: React.ReactNode;
    }) => (
        <div className="space-y-1.5 p-3 rounded-xl bg-background/40 border border-border/30">
            <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-foreground">{label}</span>
                {!tested ? (
                    <Badge variant="outline" className="text-[9px] h-4">Skipped</Badge>
                ) : reachable ? (
                    <Badge className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[9px] h-4">
                        <CheckCircle2 className="w-2.5 h-2.5" /> OK
                    </Badge>
                ) : (
                    <Badge className="gap-1 bg-red-500/15 text-red-400 border-red-500/25 text-[9px] h-4">
                        <XCircle className="w-2.5 h-2.5" /> Fail
                    </Badge>
                )}
            </div>
            {tested && (
                <div className="space-y-1">
                    {latencyMs !== null && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5" /> <span className="font-mono text-foreground">{latencyMs}ms</span>
                        </p>
                    )}
                    {error && (
                        <p className="text-[10px] text-red-400 flex items-start gap-1">
                            <AlertTriangle className="w-2.5 h-2.5 mt-0.5 shrink-0" /> {error}
                        </p>
                    )}
                    {extra}
                </div>
            )}
        </div>
    );

    // Extract diagnostics from the extended result type
    const azResult = result.agentZero as any;
    const diagnostics = azResult?.diagnostics as string | null;
    const detectedEndpoint = azResult?.detectedEndpoint as string | null;

    return (
        <div className="space-y-2 mt-4">
            <h4 className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Signal className="w-3 h-3" /> Last Test Results
            </h4>
            <ResultRow label="OpenClaw Gateway" tested={result.openclaw.tested} reachable={result.openclaw.reachable}
                latencyMs={result.openclaw.latencyMs} error={result.openclaw.error}
                extra={result.openclaw.wsHandshake && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><Wifi className="w-2.5 h-2.5" /> WS handshake OK</p>}
            />
            <ResultRow label="Agent Zero" tested={result.agentZero.tested} reachable={result.agentZero.reachable}
                latencyMs={result.agentZero.latencyMs} error={result.agentZero.error}
                extra={<>
                    {result.agentZero.apiKeyValid && <p className="text-[10px] text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-2.5 h-2.5" /> API key valid</p>}
                    {detectedEndpoint && <p className="text-[10px] text-blue-400 flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> Endpoint: <span className="font-mono">{detectedEndpoint}</span></p>}
                    {diagnostics && (
                        <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
                            💡 {diagnostics}
                        </p>
                    )}
                </>}
            />
        </div>
    );
}

// ═══════════════════════════════════════════════════
// RIGHT PANEL — Detail / Editor
// ═══════════════════════════════════════════════════

interface FormData {
    name: string; description: string;
    openclawEnabled: boolean; openclawWsUrl: string; openclawHttpUrl: string;
    openclawAuthMode: string; openclawAuthToken: string;
    agentZeroEnabled: boolean; agentZeroBaseUrl: string;
    agentZeroAuthMode: string; agentZeroApiKey: string; agentZeroTransport: string;
}

const defaultForm: FormData = {
    name: '', description: '',
    openclawEnabled: true, openclawWsUrl: 'ws://127.0.0.1:18789', openclawHttpUrl: 'http://127.0.0.1:18789',
    openclawAuthMode: 'token', openclawAuthToken: '',
    agentZeroEnabled: false, agentZeroBaseUrl: 'http://127.0.0.1:80',
    agentZeroAuthMode: 'api_key', agentZeroApiKey: '', agentZeroTransport: 'rest',
};

function RightPanel({
    profile, isEditing, testResult, isTesting,
    onStartEdit, onCancelEdit, onSave, onTest, onActivate, onDelete,
    isCreating, onCancelCreate, onCreateSave,
}: {
    profile: ConnectionProfileClient | null;
    isEditing: boolean; isCreating: boolean;
    testResult?: ConnectionTestResult;
    isTesting: boolean;
    onStartEdit: () => void;
    onCancelEdit: () => void;
    onSave: (data: FormData) => void;
    onTest: () => void;
    onActivate: () => void;
    onDelete: () => void;
    onCancelCreate: () => void;
    onCreateSave: (data: FormData) => void;
}) {
    const [form, setForm] = useState<FormData>(defaultForm);
    const [isSaving, setIsSaving] = useState(false);

    // Sync form with selected profile when entering edit mode
    useEffect(() => {
        if (isCreating) {
            setForm(defaultForm);
        } else if (profile && isEditing) {
            setForm({
                name: profile.name, description: profile.description ?? '',
                openclawEnabled: profile.openclawEnabled, openclawWsUrl: profile.openclawWsUrl,
                openclawHttpUrl: profile.openclawHttpUrl, openclawAuthMode: profile.openclawAuthMode,
                openclawAuthToken: '', agentZeroEnabled: profile.agentZeroEnabled,
                agentZeroBaseUrl: profile.agentZeroBaseUrl, agentZeroAuthMode: profile.agentZeroAuthMode,
                agentZeroApiKey: '', agentZeroTransport: profile.agentZeroTransport,
            });
        }
    }, [profile, isEditing, isCreating]);

    const setField = <K extends keyof FormData>(key: K, value: FormData[K]) =>
        setForm((f) => ({ ...f, [key]: value }));

    const applyPreset = (key: keyof typeof PRESETS) => {
        const p = PRESETS[key];
        setForm((f) => ({ ...f, openclawWsUrl: p.openclawWsUrl, openclawHttpUrl: p.openclawHttpUrl, agentZeroBaseUrl: p.agentZeroBaseUrl }));
    };

    const handleSubmit = async () => {
        if (!form.name.trim()) return;
        setIsSaving(true);
        if (isCreating) await onCreateSave(form);
        else await onSave(form);
        setIsSaving(false);
    };

    // ── EMPTY STATE ──
    if (!profile && !isCreating) {
        return (
            <div className="flex items-center justify-center h-full text-center">
                <div className="space-y-2">
                    <Signal className="w-8 h-8 text-muted-foreground/20 mx-auto" />
                    <p className="text-xs text-muted-foreground/50">Select a profile to view details</p>
                </div>
            </div>
        );
    }

    // ── EDIT / CREATE MODE ──
    if (isEditing || isCreating) {
        return (
            <div className="space-y-4 p-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-medium">{isCreating ? 'New Profile' : `Editing: ${profile?.name}`}</h3>
                </div>

                <Section title="General" icon={Zap} defaultOpen>
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">Profile Name *</label>
                            <Input value={form.name} onChange={(e) => setField('name', e.target.value)}
                                placeholder="e.g. Production VPS" className="text-[13px] rounded-xl border-border bg-background" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[11px] text-muted-foreground">Description</label>
                            <Input value={form.description} onChange={(e) => setField('description', e.target.value)}
                                placeholder="Optional notes..." className="text-[13px] rounded-xl border-border bg-background" />
                        </div>
                    </div>
                </Section>

                <Separator className="bg-border/40" />

                <Section title="OpenClaw Gateway" icon={Server} defaultOpen>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Enable OpenClaw</span>
                        <Switch checked={form.openclawEnabled} onCheckedChange={(v) => setField('openclawEnabled', v)} />
                    </div>
                    {form.openclawEnabled && (
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">WebSocket URL</label>
                                    <Input value={form.openclawWsUrl} onChange={(e) => setField('openclawWsUrl', e.target.value)}
                                        placeholder="ws://127.0.0.1:18789" className="font-mono text-[13px] rounded-xl border-border bg-background" />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">HTTP URL</label>
                                    <Input value={form.openclawHttpUrl} onChange={(e) => setField('openclawHttpUrl', e.target.value)}
                                        placeholder="http://127.0.0.1:18789" className="font-mono text-[13px] rounded-xl border-border bg-background" />
                                </div>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">Auth Mode</label>
                                    <Select value={form.openclawAuthMode} onValueChange={(v) => setField('openclawAuthMode', v)}>
                                        <SelectTrigger className="h-9 text-[13px] rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="token" className="text-xs rounded-xl">Token</SelectItem>
                                            <SelectItem value="none" className="text-xs rounded-xl">None</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {form.openclawAuthMode === 'token' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-muted-foreground">Auth Token</label>
                                        <PasswordInput value={form.openclawAuthToken} onChange={(v) => setField('openclawAuthToken', v)}
                                            placeholder={!isCreating ? '(unchanged)' : 'Enter token...'} />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </Section>

                <Separator className="bg-border/40" />

                <Section title="Agent Zero" icon={Bot} defaultOpen>
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Enable Agent Zero</span>
                        <Switch checked={form.agentZeroEnabled} onCheckedChange={(v) => setField('agentZeroEnabled', v)} />
                    </div>
                    {form.agentZeroEnabled && (
                        <div className="space-y-3">
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground">Base URL</label>
                                <Input value={form.agentZeroBaseUrl} onChange={(e) => setField('agentZeroBaseUrl', e.target.value)}
                                    placeholder="http://127.0.0.1:80" className="font-mono text-[13px] rounded-xl border-border bg-background" />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <label className="text-[11px] text-muted-foreground">Auth Mode</label>
                                    <Select value={form.agentZeroAuthMode} onValueChange={(v) => setField('agentZeroAuthMode', v)}>
                                        <SelectTrigger className="h-9 text-[13px] rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                                        <SelectContent className="rounded-2xl">
                                            <SelectItem value="api_key" className="text-xs rounded-xl">API Key</SelectItem>
                                            <SelectItem value="none" className="text-xs rounded-xl">None</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {form.agentZeroAuthMode === 'api_key' && (
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] text-muted-foreground">API Key</label>
                                        <PasswordInput value={form.agentZeroApiKey} onChange={(v) => setField('agentZeroApiKey', v)}
                                            placeholder={!isCreating ? '(unchanged)' : 'Enter API key...'} />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[11px] text-muted-foreground">Transport</label>
                                <Select value={form.agentZeroTransport} onValueChange={(v) => setField('agentZeroTransport', v)}>
                                    <SelectTrigger className="h-9 text-[13px] rounded-xl border-border bg-background"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-2xl">
                                        <SelectItem value="rest" className="text-xs rounded-xl">REST Polling</SelectItem>
                                        <SelectItem value="websocket" className="text-xs rounded-xl">WebSocket (Socket.IO)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    )}
                </Section>

                <Separator className="bg-border/40" />

                {/* Quick Presets */}
                <div className="space-y-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Quick Presets</p>
                    <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(PRESETS) as (keyof typeof PRESETS)[]).map((key) => {
                            const preset = PRESETS[key]; const Icon = preset.icon;
                            return (
                                <Button key={key} type="button" variant="outline" size="sm"
                                    className="rounded-xl h-7 text-[11px] gap-1 border-border/40 text-muted-foreground hover:text-foreground px-2.5"
                                    onClick={() => applyPreset(key)}>
                                    <Icon className="w-3 h-3" /> {preset.label}
                                </Button>
                            );
                        })}
                    </div>
                </div>

                <Separator className="bg-border/40" />

                <div className="flex items-center gap-2">
                    <Button onClick={handleSubmit} disabled={isSaving || !form.name.trim()} size="sm"
                        className="rounded-xl h-8 px-5 text-xs bg-foreground text-background hover:bg-foreground/90 gap-1.5">
                        {isSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                        {isCreating ? 'Create Profile' : 'Save Changes'}
                    </Button>
                    <Button variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-xs text-muted-foreground"
                        onClick={isCreating ? onCancelCreate : onCancelEdit}>
                        Cancel
                    </Button>
                </div>
            </div>
        );
    }

    // ── VIEW MODE ── (selected profile, not editing)
    if (!profile) return null;

    const InfoRow = ({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) => (
        <div className="flex items-start justify-between gap-4">
            <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
            <span className={cn('text-[11px] text-foreground text-right truncate', mono && 'font-mono')}>{value || '—'}</span>
        </div>
    );

    return (
        <div className="space-y-4 p-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <HealthDot status={profile.lastHealthStatus} />
                    <h3 className="text-sm font-medium truncate">{profile.name}</h3>
                    {profile.isActive && (
                        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/25 text-[9px] h-4 px-1.5">ACTIVE</Badge>
                    )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={onStartEdit}>
                            <Pencil className="w-3.5 h-3.5" />
                        </Button>
                    </TooltipTrigger><TooltipContent className="text-xs">Edit</TooltipContent></Tooltip>

                    <Tooltip><TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={onTest} disabled={isTesting}>
                            {isTesting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5" />}
                        </Button>
                    </TooltipTrigger><TooltipContent className="text-xs">Test</TooltipContent></Tooltip>

                    {!profile.isActive && (
                        <>
                            <Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10" onClick={onActivate}>
                                    <Power className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger><TooltipContent className="text-xs">Activate</TooltipContent></Tooltip>

                            <Tooltip><TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10" onClick={onDelete}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger><TooltipContent className="text-xs">Delete</TooltipContent></Tooltip>
                        </>
                    )}
                </div>
            </div>

            {profile.description && (
                <p className="text-[11px] text-muted-foreground">{profile.description}</p>
            )}

            <Separator className="bg-border/40" />

            {/* OpenClaw section */}
            <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                    <Server className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">OpenClaw Gateway</span>
                    {profile.openclawEnabled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] h-4 px-1">ON</Badge>
                    ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground/50">OFF</Badge>
                    )}
                </div>
                {profile.openclawEnabled && (
                    <div className="space-y-1 pl-[18px]">
                        <InfoRow label="WebSocket" value={profile.openclawWsUrl} mono />
                        <InfoRow label="HTTP" value={profile.openclawHttpUrl} mono />
                        <InfoRow label="Auth" value={profile.openclawAuthMode} />
                        <InfoRow label="Token" value={profile.openclawAuthToken ? '••••••••' : 'Not set'} />
                    </div>
                )}
            </div>

            <Separator className="bg-border/40" />

            {/* Agent Zero section */}
            <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                    <Bot className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Agent Zero</span>
                    {profile.agentZeroEnabled ? (
                        <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[9px] h-4 px-1">ON</Badge>
                    ) : (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 text-muted-foreground/50">OFF</Badge>
                    )}
                </div>
                {profile.agentZeroEnabled && (
                    <div className="space-y-1 pl-[18px]">
                        <InfoRow label="Base URL" value={profile.agentZeroBaseUrl} mono />
                        <InfoRow label="Auth" value={profile.agentZeroAuthMode} />
                        <InfoRow label="API Key" value={profile.agentZeroApiKey ? '••••••••' : 'Not set'} />
                        <InfoRow label="Transport" value={profile.agentZeroTransport} />
                    </div>
                )}
            </div>

            {/* Test results */}
            {testResult && (
                <>
                    <Separator className="bg-border/40" />
                    <TestResultsPanel result={testResult} />
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════
// MAIN COMPONENT — TWO-COLUMN LAYOUT
// ═══════════════════════════════════════════════════

export default function ConnectionProfiles() {
    const {
        profiles, isLoading, error, testResults, testingIds,
        fetchProfiles, createProfile, updateProfile, deleteProfile,
        activateProfile, testProfile, clearError,
    } = useConnectionStore();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

    // Auto-select the active profile on load
    useEffect(() => {
        if (!selectedId && profiles.length > 0) {
            const active = profiles.find((p) => p.isActive);
            setSelectedId(active?.id ?? profiles[0].id);
        }
    }, [profiles, selectedId]);

    const selectedProfile = profiles.find((p) => p.id === selectedId) ?? null;

    const handleSave = useCallback(async (data: FormData) => {
        if (!selectedId) return;
        const payload: Record<string, unknown> = {
            name: data.name, description: data.description || null,
            openclawEnabled: data.openclawEnabled, openclawWsUrl: data.openclawWsUrl,
            openclawHttpUrl: data.openclawHttpUrl, openclawAuthMode: data.openclawAuthMode,
            agentZeroEnabled: data.agentZeroEnabled, agentZeroBaseUrl: data.agentZeroBaseUrl,
            agentZeroAuthMode: data.agentZeroAuthMode, agentZeroTransport: data.agentZeroTransport,
        };
        if (data.openclawAuthToken) payload.openclawAuthToken = data.openclawAuthToken;
        if (data.agentZeroApiKey) payload.agentZeroApiKey = data.agentZeroApiKey;
        await updateProfile(selectedId, payload);
        setIsEditing(false);
    }, [selectedId, updateProfile]);

    const handleCreate = useCallback(async (data: FormData) => {
        const payload: Record<string, unknown> = {
            name: data.name, description: data.description || null,
            openclawEnabled: data.openclawEnabled, openclawWsUrl: data.openclawWsUrl,
            openclawHttpUrl: data.openclawHttpUrl, openclawAuthMode: data.openclawAuthMode,
            agentZeroEnabled: data.agentZeroEnabled, agentZeroBaseUrl: data.agentZeroBaseUrl,
            agentZeroAuthMode: data.agentZeroAuthMode, agentZeroTransport: data.agentZeroTransport,
        };
        if (data.openclawAuthToken) payload.openclawAuthToken = data.openclawAuthToken;
        if (data.agentZeroApiKey) payload.agentZeroApiKey = data.agentZeroApiKey;
        const newId = await createProfile(payload);
        setIsCreating(false);
        if (newId) setSelectedId(newId);
    }, [createProfile]);

    const handleDelete = async () => {
        if (!selectedId) return;
        if (!window.confirm('Delete this connection profile?')) return;
        await deleteProfile(selectedId);

        // Select the next active one or clear
        const active = profiles.find((p) => p.isActive && p.id !== selectedId);
        setSelectedId(active ? active.id : null);
    };

    return (
        <div className="space-y-3">
            {/* Error banner */}
            {error && (
                <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> <span>{error}</span>
                    </div>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={clearError}>Dismiss</Button>
                </div>
            )}

            {/* Two-column layout */}
            <div className="grid grid-cols-[280px_1fr] gap-4 min-h-[420px]">
                {/* LEFT — Profile list */}
                <div className="space-y-2">
                    <Button onClick={() => { setIsCreating(true); setIsEditing(false); setSelectedId(null); }}
                        variant="outline" size="sm"
                        className="rounded-xl h-8 text-xs gap-1.5 border-dashed border-border/40 text-muted-foreground hover:text-foreground w-full">
                        <Plus className="w-3.5 h-3.5" /> New Profile
                    </Button>

                    {isLoading && profiles.length === 0 ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    ) : profiles.length === 0 && !isCreating ? (
                        <div className="text-center py-8">
                            <WifiOff className="w-6 h-6 text-muted-foreground/20 mx-auto mb-1" />
                            <p className="text-[11px] text-muted-foreground/50">No profiles yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-1.5">
                            {profiles.map((p) => (
                                <ProfileCard key={p.id} profile={p}
                                    isSelected={selectedId === p.id && !isCreating}
                                    onClick={() => { setSelectedId(p.id); setIsCreating(false); setIsEditing(false); }}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* RIGHT — Detail / Editor */}
                <Card className="rounded-xl border-border/40 bg-card/30 shadow-none overflow-hidden py-0 gap-0">
                    <RightPanel
                        profile={selectedProfile}
                        isEditing={isEditing}
                        isCreating={isCreating}
                        testResult={selectedId ? testResults[selectedId] : undefined}
                        isTesting={selectedId ? testingIds.has(selectedId) : false}
                        onStartEdit={() => setIsEditing(true)}
                        onCancelEdit={() => setIsEditing(false)}
                        onSave={handleSave}
                        onTest={() => selectedId && testProfile(selectedId)}
                        onActivate={() => selectedId && activateProfile(selectedId)}
                        onDelete={handleDelete}
                        onCancelCreate={() => setIsCreating(false)}
                        onCreateSave={handleCreate}
                    />
                </Card>
            </div>
        </div>
    );
}
