'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronUp, Cpu, Sparkles, Server, ChevronRight } from 'lucide-react';
import { useCapabilitiesStore } from '@/store/useCapabilitiesStore';
import { useAgentStore } from '@/store/useAgentStore';
import { useRouter } from 'next/navigation';
import type { AgentProfile } from '@/lib/agentRoster';

interface AgentCapabilitiesProps {
    agent: AgentProfile;
}

export function AgentCapabilities({ agent }: AgentCapabilitiesProps) {
    const router = useRouter();
    const {
        mcps, skills, assignments, fetchMcps, fetchSkills, fetchAssignmentsForAgent,
        getToolCountForAgent, getMcpCountForAgent, getSkillCountForAgent,
        getAssignedMcpsForAgent, getAssignedSkillsForAgent,
    } = useCapabilitiesStore();
    const storeAgent = useAgentStore((s) => s.agents[agent.id]);
    const [showAllTools, setShowAllTools] = useState(false);
    const [showAllSkills, setShowAllSkills] = useState(false);

    const modelName = storeAgent?.model || 'Not configured';

    useEffect(() => {
        if (mcps.length === 0) fetchMcps();
        if (skills.length === 0) fetchSkills();
    }, [mcps.length, skills.length, fetchMcps, fetchSkills]);

    useEffect(() => {
        fetchAssignmentsForAgent(agent.id);
    }, [agent.id, fetchAssignmentsForAgent]);

    const totalTools = useMemo(() => getToolCountForAgent(agent.id), [agent.id, assignments, mcps]);
    const mcpCount = useMemo(() => getMcpCountForAgent(agent.id), [agent.id, assignments]);
    const skillCount = useMemo(() => getSkillCountForAgent(agent.id), [agent.id, assignments]);
    const assignedMcps = useMemo(() => getAssignedMcpsForAgent(agent.id), [agent.id, assignments, mcps]);
    const assignedSkills = useMemo(() => getAssignedSkillsForAgent(agent.id), [agent.id, assignments, skills]);

    const mcpNames = assignedMcps.map(m => m.name);
    const displayMcps = showAllTools ? mcpNames : mcpNames.slice(0, 3);
    const mcpExtraCount = mcpNames.length - 3;

    const skillNames = assignedSkills.map(s => s.name);
    const displaySkills = showAllSkills ? skillNames : skillNames.slice(0, 3);
    const skillExtraCount = skillNames.length - 3;

    return (
        <div className="px-5 pb-4 space-y-4">
            {/* Section Header */}
            <div className="text-[11px] uppercase tracking-[0.2em] font-mono text-white/50">
                Agent Capabilities
            </div>

            {/* Model Badge */}
            <div className="space-y-1.5">
                <div className="text-[11px] uppercase tracking-[0.15em] font-mono text-white/40">Model</div>
                <div
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-mono"
                    style={{
                        background: `${agent.colorHex}15`,
                        border: `1px solid ${agent.colorHex}40`,
                    }}
                >
                    <Cpu size={14} style={{ color: agent.colorHex }} />
                    <span className="text-white/90">{modelName}</span>
                </div>
            </div>

            {/* Capabilities Section */}
            <div className="space-y-3">
                <button
                    onClick={() => router.push('/dashboard/capabilities')}
                    className="flex items-center gap-1 text-[11px] uppercase tracking-[0.15em] font-mono text-white/40 hover:text-white/60 transition-colors pointer-events-auto"
                >
                    Capabilities <ChevronRight size={10} />
                </button>

                {/* MCP Tools */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Server size={12} className="text-white/40" />
                        <span className="text-[11px] uppercase tracking-[0.12em] font-mono text-white/40">MCP Tools</span>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/capabilities')}
                        className="text-sm font-mono text-white/70 hover:text-white/90 transition-colors pointer-events-auto"
                    >
                        {totalTools} tools from {mcpCount} servers
                    </button>
                    {mcpNames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {displayMcps.map(name => (
                                <span
                                    key={name}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-white/60 border border-white/10 bg-white/5"
                                    style={{ borderColor: `${agent.colorHex}30` }}
                                >
                                    {name}
                                </span>
                            ))}
                            {!showAllTools && mcpExtraCount > 0 && (
                                <button
                                    onClick={() => setShowAllTools(true)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-blue-400/80 border border-blue-400/20 bg-blue-400/5 cursor-pointer hover:bg-blue-400/10 transition-colors pointer-events-auto"
                                >
                                    +{mcpExtraCount} more
                                </button>
                            )}
                            {showAllTools && mcpExtraCount > 0 && (
                                <button
                                    onClick={() => setShowAllTools(false)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-white/40 cursor-pointer pointer-events-auto"
                                >
                                    <ChevronUp size={10} />
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Skills */}
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <Sparkles size={12} className="text-violet-400/60" />
                        <span className="text-[11px] uppercase tracking-[0.12em] font-mono text-white/40">Skills</span>
                    </div>
                    <button
                        onClick={() => router.push('/dashboard/capabilities')}
                        className="text-sm font-mono text-white/70 hover:text-white/90 transition-colors pointer-events-auto"
                    >
                        {skillCount} skills assigned
                    </button>
                    {skillNames.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {displaySkills.map(name => (
                                <span
                                    key={name}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-violet-400/70 border border-violet-400/20 bg-violet-400/5"
                                >
                                    {name}
                                </span>
                            ))}
                            {!showAllSkills && skillExtraCount > 0 && (
                                <button
                                    onClick={() => setShowAllSkills(true)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-violet-400/80 border border-violet-400/20 bg-violet-400/5 cursor-pointer hover:bg-violet-400/10 transition-colors pointer-events-auto"
                                >
                                    +{skillExtraCount} more
                                </button>
                            )}
                            {showAllSkills && skillExtraCount > 0 && (
                                <button
                                    onClick={() => setShowAllSkills(false)}
                                    className="px-2 py-0.5 rounded-full text-[10px] font-mono text-white/40 cursor-pointer pointer-events-auto"
                                >
                                    <ChevronUp size={10} />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
