'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Thermometer } from 'lucide-react';
import type { AgentProfile } from '@/lib/agentRoster';

interface AgentStatBlockProps {
    agent: AgentProfile;
    level: number;
}

interface TelemetryData {
    successRate: number;
    avgLatency: number;
    totalOps: number;
    totalTokens: number;
    monthlyCost: number;
}

function StatBar({ value, max, color }: { value: number; max: number; color: string }) {
    const percent = Math.min(100, (value / max) * 100);
    return (
        <div className="w-full h-[3px] bg-white/8 rounded-full overflow-hidden mt-1">
            <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: color }}
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
            />
        </div>
    );
}

function getSuccessColor(rate: number) {
    if (rate >= 90) return '#4ade80';
    if (rate >= 70) return '#fbbf24';
    return '#f87171';
}

function getLatencyColor(ms: number) {
    if (ms <= 200) return '#4ade80';
    if (ms <= 800) return '#fbbf24';
    return '#f87171';
}

function getUplinkColor(pct: number) {
    if (pct >= 99) return '#4ade80';
    if (pct >= 95) return '#fbbf24';
    return '#f87171';
}

function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toString();
}

export function AgentStatBlock({ agent, level }: AgentStatBlockProps) {
    const [telemetry, setTelemetry] = useState<TelemetryData | null>(null);

    // Fetch telemetry for this agent
    useEffect(() => {
        fetch(`/api/telemetry?agentId=${agent.id}`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data) {
                    setTelemetry({
                        successRate: data.successRate ?? 0,
                        avgLatency: data.avgLatency ?? 0,
                        totalOps: data.totalOps ?? 0,
                        totalTokens: data.totalTokens ?? 0,
                        monthlyCost: data.monthlyCost ?? 0,
                    });
                }
            })
            .catch(() => {
                setTelemetry({
                    successRate: 0,
                    avgLatency: 0,
                    totalOps: 0,
                    totalTokens: 0,
                    monthlyCost: 0,
                });
            });
    }, [agent.id]);

    const stats = telemetry || { successRate: 0, avgLatency: 0, totalOps: 0, totalTokens: 0, monthlyCost: 0 };

    // Temperature display
    const tempValue = 0.7;
    const tempLabel = tempValue <= 0.3 ? 'precise' : tempValue <= 0.7 ? 'balanced' : 'creative';

    return (
        <div className="flex flex-col h-full overflow-y-auto identity-scrollbar p-5 space-y-5">
            {/* Performance Header */}
            <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/50">
                Performance
            </div>

            {/* Success Rate */}
            <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Success Rate</span>
                    <span className="text-lg font-mono tabular-nums text-white/90">{stats.successRate.toFixed(1)}%</span>
                </div>
                <StatBar value={stats.successRate} max={100} color={getSuccessColor(stats.successRate)} />
            </div>

            {/* Avg Latency */}
            <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Avg Latency</span>
                    <span className="text-lg font-mono tabular-nums text-white/90">{stats.avgLatency}ms</span>
                </div>
                <StatBar value={Math.max(0, 1000 - stats.avgLatency)} max={1000} color={getLatencyColor(stats.avgLatency)} />
            </div>

            {/* Uplink */}
            <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Uplink</span>
                    <span className="text-lg font-mono tabular-nums text-white/90">99.9%</span>
                </div>
                <StatBar value={99.9} max={100} color={getUplinkColor(99.9)} />
            </div>

            {/* Context Window */}
            <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Context Window</span>
                    <span className="text-lg font-mono tabular-nums text-white/90">200K tokens</span>
                </div>
            </div>

            {/* Temperature */}
            <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                    <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Temperature</span>
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-mono tabular-nums text-white/90">{tempValue}</span>
                        <span className="text-[10px] font-mono text-white/40">[{tempLabel}]</span>
                    </div>
                </div>
                <StatBar value={tempValue} max={1} color={agent.colorHex} />
            </div>

            {/* Totals Divider */}
            <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-mono text-white/30">Totals</span>
                <div className="h-px flex-1 bg-white/10" />
            </div>

            {/* Total Ops */}
            <div className="flex justify-between items-baseline">
                <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Total Ops</span>
                <span className="text-lg font-mono tabular-nums text-white/90">{stats.totalOps.toLocaleString()}</span>
            </div>

            {/* Tokens Used */}
            <div className="flex justify-between items-baseline">
                <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Tokens Used</span>
                <span className="text-lg font-mono tabular-nums text-white/90">{formatTokens(stats.totalTokens)}</span>
            </div>

            {/* Monthly Cost */}
            <div className="flex justify-between items-baseline">
                <span className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Cost (Month)</span>
                <span className="text-lg font-mono tabular-nums text-white/90">${stats.monthlyCost.toFixed(2)}</span>
            </div>
        </div>
    );
}
