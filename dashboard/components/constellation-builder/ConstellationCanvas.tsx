'use client';

// ConstellationCanvas.tsx — Agent Architecture Canvas
// Displays agents as interactive nodes on a ReactFlow canvas.
// CEO apex node + filtered agent nodes with smart edge routing.

import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
    ReactFlow,
    Background,
    Controls,
    useNodesState,
    useEdgesState,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    type OnNodesChange,
    BackgroundVariant,
    ConnectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useConstellationStore } from '@/store/useConstellationStore';
import { useAgentSettingsStore } from '@/store/useAgentSettingsStore';
import { AgentNode } from './nodes/AgentNode';
import { CEONode } from './nodes/CEONode';
import { DelegationEdge } from './edges/DelegationEdge';
import { AgentDetailDrawer } from './AgentDetailDrawer';


// ─── Node/Edge Type Registration ────────────────────────────────────────────

const nodeTypes: NodeTypes = {
    agentNode: AgentNode as any,
    ceoNode: CEONode as any,
};

const edgeTypes: EdgeTypes = {
    delegationEdge: DelegationEdge as any,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function ConstellationCanvas() {
    const {
        agents,
        relationships,
        selectedAgentId,
        isLoading,
        ceoConfig,
        initialize,
        openDrawer,
        selectAgent,
        updateAgentPosition,
        updateCEOConfig,
    } = useConstellationStore();

    const hiddenAgentIds = useAgentSettingsStore(s => s.hiddenAgentIds);

    // Track CEO position in a ref so it doesn't reset on re-render
    const ceoPositionRef = useRef({ x: 420, y: 30 });

    // Initialize on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // Filter out hidden agents
    const visibleAgents = useMemo(() => {
        return Object.values(agents).filter(a => !hiddenAgentIds.includes(a.id));
    }, [agents, hiddenAgentIds]);

    // Convert store agents → ReactFlow nodes (+ CEO node)
    const buildNodes = useCallback((): Node[] => {
        const ceoNode: Node = {
            id: '__ceo__',
            type: 'ceoNode',
            position: ceoPositionRef.current,
            data: {
                ...ceoConfig,
                onUpdate: (field: string, value: string) => updateCEOConfig(field, value),
            },
            selectable: false,
            draggable: true,
        };

        const agentNodes: Node[] = visibleAgents.map(agent => ({
            id: agent.id,
            type: 'agentNode',
            position: agent.position,
            data: {
                agent,
                isSelected: selectedAgentId === agent.id,
                onOpenDrawer: (id: string) => openDrawer(id),
            },
            selectable: true,
            draggable: true,
        }));

        return [ceoNode, ...agentNodes];
    }, [visibleAgents, selectedAgentId, openDrawer, ceoConfig, updateCEOConfig]);

    // Convert relationships → edges with type flags
    const buildEdges = useCallback((): Edge[] => {
        const visibleIds = new Set(visibleAgents.map(a => a.id));

        // CEO → all visible agents (hierarchy edges — smooth step, solid)
        const ceoLabels: Record<string, string> = {
            ivy: 'Operations',
            daisy: 'Intelligence',
            celia: 'Engineering',
            thalia: 'Distribution',
        };
        const ceoEdges: Edge[] = visibleAgents.map(a => ({
            id: `ceo-${a.id}`,
            source: '__ceo__',
            target: a.id,
            type: 'delegationEdge',
            data: {
                type: 'delegation',
                label: ceoLabels[a.id] || 'Delegate',
                isHierarchy: true,
            },
            animated: false,
        }));

        // Agent-to-agent edges (inter-agent — bezier, dotted)
        const agentEdges: Edge[] = relationships
            .filter(rel => visibleIds.has(rel.sourceAgentId) && visibleIds.has(rel.targetAgentId))
            .map(rel => ({
                id: rel.id,
                source: rel.sourceAgentId,
                target: rel.targetAgentId,
                type: 'delegationEdge',
                data: {
                    type: rel.type,
                    label: rel.label,
                    isHierarchy: false,
                },
                animated: false,
            }));

        return [...ceoEdges, ...agentEdges];
    }, [visibleAgents, relationships]);

    const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes());
    const [edges, setEdges, onEdgesChange] = useEdgesState(buildEdges());

    // Sync store → ReactFlow nodes (preserve CEO position via ref)
    useEffect(() => {
        setNodes(prev => {
            const newNodes = buildNodes();
            // Preserve CEO position from current ReactFlow state
            const currentCeo = prev.find(n => n.id === '__ceo__');
            if (currentCeo) {
                const ceIdx = newNodes.findIndex(n => n.id === '__ceo__');
                if (ceIdx >= 0) {
                    newNodes[ceIdx] = { ...newNodes[ceIdx], position: currentCeo.position };
                }
            }
            return newNodes;
        });
    }, [agents, selectedAgentId, openDrawer, hiddenAgentIds, ceoConfig, setNodes, buildNodes]);

    // Sync relationships → edges
    useEffect(() => {
        setEdges(buildEdges());
    }, [relationships, hiddenAgentIds, setEdges, buildEdges]);

    // Handle node changes — persist positions
    const handleNodesChange: OnNodesChange = useCallback(
        (changes) => {
            onNodesChange(changes);

            for (const change of changes) {
                if (change.type === 'position' && change.position && change.id) {
                    if (change.id === '__ceo__') {
                        // Track CEO position in ref (not store)
                        ceoPositionRef.current = change.position;
                    } else {
                        updateAgentPosition(change.id, change.position);
                    }
                }
            }
        },
        [onNodesChange, updateAgentPosition]
    );

    // Handle click on empty canvas
    const handlePaneClick = useCallback(() => {
        selectAgent(null);
    }, [selectAgent]);

    // Handle node click
    const handleNodeClick = useCallback(
        (_: React.MouseEvent, node: Node) => {
            if (node.id !== '__ceo__') {
                selectAgent(node.id);
            }
        },
        [selectAgent]
    );

    return (
        <div className="absolute inset-0">
            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-white/20 border-t-[#FF6D29] rounded-full animate-spin" />
                        <span className="text-xs font-mono text-white/50">
                            Loading agent architecture...
                        </span>
                    </div>
                </div>
            )}

            {/* ReactFlow Canvas */}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodesChange={handleNodesChange}
                onEdgesChange={onEdgesChange}
                onPaneClick={handlePaneClick}
                onNodeClick={handleNodeClick}
                connectionMode={ConnectionMode.Loose}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                minZoom={0.3}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
                className="!bg-transparent"
                defaultEdgeOptions={{
                    type: 'delegationEdge',
                }}
            >
                <Background
                    variant={BackgroundVariant.Dots}
                    gap={24}
                    size={1}
                    color="rgba(255,255,255,0.03)"
                />

                {/* Center radial glow */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: -1 }}>
                    <defs>
                        <radialGradient id="centerGlow" cx="50%" cy="45%" r="40%">
                            <stop offset="0%" stopColor="#FF6D29" stopOpacity="0.04" />
                            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                        </radialGradient>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#centerGlow)" />
                </svg>

                <Controls
                    className="!bg-[rgba(10,10,14,0.9)] !border-white/10 !rounded-sm !shadow-2xl [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-white/40 [&>button:hover]:!text-white/80 [&>button:hover]:!bg-white/5"
                    showInteractive={false}
                />
            </ReactFlow>

            {/* Agent Detail Drawer */}
            <AgentDetailDrawer />
        </div>
    );
}
