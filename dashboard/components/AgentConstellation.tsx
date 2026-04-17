"use client";

import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

export interface AgentNode {
    id: string;
    name: string;
    type: 'openclaw' | 'external';
    tasksCompleted: number;
    isActive: boolean;
    status: 'online' | 'offline' | 'error';
}

export interface AgentEdge {
    source: string | AgentNode;
    target: string | AgentNode;
    weight: number;
    type: 'collaboration' | 'delegation' | 'summit';
}

interface AgentConstellationProps {
    agents: AgentNode[];
    edges: AgentEdge[];
    width?: number;
    height?: number;
    onNodeClick?: (agentId: string) => void;
    className?: string;
}

const getAgentColor = (id: string, hex = false) => {
    switch (id.toLowerCase()) {
        case 'daisy': return hex ? '#7BC75F' : 'oklch(0.78 0.17 135)';
        case 'ivy': return hex ? '#3AADA8' : 'oklch(0.72 0.14 195)';
        case 'celia': return hex ? '#8B6BAD' : 'oklch(0.55 0.14 290)';
        case 'thalia': return hex ? '#D97045' : 'oklch(0.65 0.19 25)';
        case 'agent-zero': return hex ? '#4182B4' : 'oklch(0.55 0.15 232)';
        default: return hex ? '#D98A3A' : 'oklch(0.72 0.18 52)';
    }
};

const getEdgeColorObj = (type: string) => {
    switch (type) {
        case 'delegation': return { base: 'rgba(58, 173, 168, 0.25)', highlight: 'rgba(58, 173, 168, 0.8)' };
        case 'summit': return { base: 'rgba(139, 107, 173, 0.25)', highlight: 'rgba(139, 107, 173, 0.8)' };
        case 'collaboration':
        default: return { base: 'rgba(255, 255, 255, 0.15)', highlight: 'rgba(255, 255, 255, 0.8)' };
    }
};

export default function AgentConstellation({
    agents,
    edges,
    width,
    height,
    onNodeClick,
    className = ""
}: AgentConstellationProps) {
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: width || 800, height: height || 400 });
    const [hoverNode, setHoverNode] = useState<AgentNode | null>(null);

    // Resize observer for dynamic width and height
    useEffect(() => {
        const observer = new ResizeObserver(entries => {
            if (entries[0]) {
                setDimensions({
                    width: width || entries[0].contentRect.width,
                    height: height || entries[0].contentRect.height
                });
            }
        });
        if (containerRef.current) {
            let parent = containerRef.current.parentElement;
            if (parent) observer.observe(parent);
        }
        return () => observer.disconnect();
    }, [width, height]);

    const graphData = useMemo(() => {
        // Create a map to keep references stable
        return {
            nodes: agents.map(a => ({ ...a })),
            links: edges.map(e => ({ ...e }))
        };
    }, [agents, edges]);

    // Extract link IDs for quick lookup during hover
    const getLinksForNode = useCallback((nodeId: string) => {
        return graphData.links.filter(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return s === nodeId || t === nodeId;
        });
    }, [graphData.links]);

    useEffect(() => {
        // The graph may not be mounted immediately due to width > 0 condition
        // Use a small timeout or depend on dimensions to configure forces
        const timer = setTimeout(() => {
            if (fgRef.current) {
                fgRef.current.d3Force('charge').strength(-200);
                fgRef.current.d3Force('link').distance(120);
            }
        }, 100);
        return () => clearTimeout(timer);
    }, [dimensions.width]);

    const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
        const isHovered = hoverNode && hoverNode.id === node.id;
        const isConnected = hoverNode && getLinksForNode(hoverNode.id).some(l => {
            const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
            const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
            return s === node.id || t === node.id;
        });

        // Dim nodes if unassociated during hover
        const opacity = hoverNode && !isHovered && !isConnected ? 0.3 : 1;

        // Radius calc
        const baseRadius = 12;
        const sizeMod = (node.tasksCompleted / 50) * 8;
        const radius = Math.min(baseRadius + sizeMod, 28);

        // Color
        const hexColor = getAgentColor(node.id, true);

        ctx.globalAlpha = opacity;

        // Pulse ring for active
        if (node.isActive) {
            const pulse = Math.sin(Date.now() / 500) * 2;
            const ringRadius = radius + 4 + pulse;

            ctx.beginPath();
            ctx.arc(node.x, node.y, ringRadius, 0, 2 * Math.PI);
            ctx.strokeStyle = hexColor;
            ctx.globalAlpha = opacity * 0.3;
            ctx.lineWidth = 2 / globalScale;
            ctx.stroke();
            ctx.globalAlpha = opacity;
        }

        // Outer circle for external
        if (node.type === 'external') {
            ctx.beginPath();
            ctx.arc(node.x, node.y, radius + 2, 0, 2 * Math.PI);
            ctx.strokeStyle = hexColor;
            ctx.setLineDash([4 / globalScale, 4 / globalScale]);
            ctx.lineWidth = 1 / globalScale;
            ctx.stroke();
            ctx.setLineDash([]); // Reset
        }

        // Main node circle
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = hexColor;
        ctx.fill();

        // Error triangle (above the node)
        if (node.status === 'error') {
            const triSize = 6;
            ctx.beginPath();
            ctx.moveTo(node.x, node.y - radius - triSize - 2);
            ctx.lineTo(node.x - triSize, node.y - radius - 2);
            ctx.lineTo(node.x + triSize, node.y - radius - 2);
            ctx.closePath();
            ctx.fillStyle = '#f87171'; // Red
            ctx.fill();
        }

        // Label
        const fontSize = 11 / globalScale;
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = `rgba(255, 255, 255, ${0.7 * opacity})`;
        ctx.fillText(node.name, node.x, node.y + radius + 4);

        // Reset alpha
        ctx.globalAlpha = 1;
    }, [hoverNode, getLinksForNode]);

    const paintNodePointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
        // Must match the radius logic in paintNode
        const baseRadius = 12;
        const sizeMod = (node.tasksCompleted / 50) * 8;
        const radius = Math.min(baseRadius + sizeMod, 28);

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fill();
    }, []);

    return (
        <div ref={containerRef} className={`relative rounded-md border border-border bg-black/5 overflow-hidden ${className}`} style={{ height: height ? height : '100%', width: width ? width : '100%' }}>
            {/* Legend & Labels */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="ofiere-section text-muted-foreground">Agent Constellation</h3>
            </div>

            <div className="absolute bottom-4 right-4 z-10 pointer-events-none flex flex-col gap-2 items-end bg-background/50 backdrop-blur-sm p-3 rounded-lg border border-border/50">
                <div className="flex items-center gap-2">
                    <span className="ofiere-caption">Collaboration</span>
                    <div className="w-8 h-[2px] bg-[rgba(255,255,255,0.4)]" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="ofiere-caption">Delegation</span>
                    <div className="w-8 h-[2px] bg-[rgba(58,173,168,0.6)]" />
                </div>
                <div className="flex items-center gap-2">
                    <span className="ofiere-caption">Summit</span>
                    <div className="w-8 h-[2px] bg-[rgba(139,107,173,0.6)]" />
                </div>
            </div>

            {hoverNode && (
                <div className="absolute top-4 right-4 bg-background/80 backdrop-blur-md border border-border p-3 rounded-lg pointer-events-none z-10 min-w-[150px] shadow-lg">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getAgentColor(hoverNode.id, true) }} />
                        <span className="font-semibold text-sm">{hoverNode.name}</span>
                    </div>
                    <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                        <span className="capitalize">Type: {hoverNode.type}</span>
                        <span className="capitalize">Status: {hoverNode.status}</span>
                        <span>Tasks: {hoverNode.tasksCompleted}</span>
                        <span>{hoverNode.isActive ? 'Active Task' : 'Idle'}</span>
                    </div>
                </div>
            )}

            {dimensions.width > 0 && typeof window !== 'undefined' && (
                <ForceGraph2D
                    ref={fgRef}
                    graphData={graphData}
                    width={dimensions.width}
                    height={dimensions.height}
                    backgroundColor="rgba(0,0,0,0)"
                    d3VelocityDecay={0.3}
                    d3AlphaDecay={0.02}

                    nodeCanvasObject={paintNode}
                    nodePointerAreaPaint={paintNodePointerArea}

                    linkWidth={(link: any) => Math.max(1, Math.min(1 + (link.weight * 4), 5))}
                    linkColor={(link: any) => {
                        const colors = getEdgeColorObj(link.type);
                        const isHovered = hoverNode && (
                            (typeof link.source === 'object' ? link.source.id : link.source) === hoverNode.id ||
                            (typeof link.target === 'object' ? link.target.id : link.target) === hoverNode.id
                        );

                        if (hoverNode && !isHovered) {
                            return 'rgba(255,255,255,0.05)';
                        }
                        return isHovered ? colors.highlight : colors.base;
                    }}

                    linkDirectionalParticles={(link: any) => link.weight > 0.5 ? 2 : 0}
                    linkDirectionalParticleSpeed={0.005}
                    linkDirectionalParticleWidth={2}
                    linkDirectionalParticleColor={(link: any) => getEdgeColorObj(link.type).highlight}

                    onNodeHover={(node: any) => {
                        setHoverNode(node || null);
                        if (containerRef.current) {
                            containerRef.current.style.cursor = node ? 'pointer' : 'default';
                        }
                    }}
                    onNodeClick={(node: any) => {
                        if (onNodeClick) onNodeClick(node.id);
                    }}
                />
            )}
        </div>
    );
}
