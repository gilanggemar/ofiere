"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ReactFlow,
    Background,
    MiniMap,
    Controls,
    useReactFlow,
    type Node,
    type Edge,
    type NodeTypes,
    type EdgeTypes,
    type Connection,
    BackgroundVariant,
    SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/base.css";

import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";

// V2 Node Components
import { ManualTriggerNode } from "./nodes/ManualTriggerNode";
import { WebhookTriggerNode } from "./nodes/WebhookTriggerNode";
import { ScheduleTriggerNode } from "./nodes/ScheduleTriggerNode";
import { AgentStepNode } from "./nodes/AgentStepNode";
import { FormatterStepNode } from "./nodes/FormatterStepNode";
import { HumanApprovalNode } from "./nodes/HumanApprovalNode";
import { ConditionNodeV2 } from "./nodes/ConditionNodeV2";
import { OutputNodeV2 } from "./nodes/OutputNodeV2";
import { GroupNode } from "./nodes/GroupNode";

import { DataEdge } from "./edges/DataEdge";
import { ExecutingEdge } from "./edges/ExecutingEdge";
import { ConditionalEdge } from "./edges/ConditionalEdge";

const nodeTypes: NodeTypes = {
    // V2 Nodes
    manual_trigger: ManualTriggerNode,
    webhook_trigger: WebhookTriggerNode,
    schedule_trigger: ScheduleTriggerNode,
    agent_step: AgentStepNode,
    formatter_step: FormatterStepNode,
    human_approval: HumanApprovalNode,
    condition: ConditionNodeV2,
    output: OutputNodeV2,
    group: GroupNode,
    // V1 backward-compatible aliases
    trigger: ManualTriggerNode,
    agent: AgentStepNode,
};

const edgeTypes: EdgeTypes = {
    data: DataEdge,
    executing: ExecutingEdge,
    conditional: ConditionalEdge,
};

const defaultEdgeOptions = { type: "data", animated: false };
const connectionLineStyle = { stroke: "var(--accent-base)", strokeWidth: 2 };

const minimapStyle: React.CSSProperties = {
    background: "oklch(0.1 0.005 0 / 0.6)",
    backdropFilter: "blur(12px)",
    borderRadius: 10,
    border: "1px solid oklch(1 0 0 / 0.08)",
    overflow: "hidden",
};

function nodeColor(node: Node) {
    const m: Record<string, string> = {
        manual_trigger: "oklch(0.78 0.17 135)",
        webhook_trigger: "oklch(0.75 0.18 55)",
        schedule_trigger: "oklch(0.72 0.14 195)",
        agent_step: "oklch(0.75 0.18 55)",
        formatter_step: "oklch(0.55 0.14 290)",
        human_approval: "oklch(0.65 0.19 25)",
        condition: "oklch(0.65 0.19 25)",
        output: "oklch(0.72 0.14 195)",
        group: "oklch(0.55 0.15 232)",
    };
    return m[node.type || ""] || "oklch(0.5 0 0)";
}

// ─── Topology validation for connections ─────────────────────
const TRIGGER_TYPES = new Set(["manual_trigger", "webhook_trigger", "schedule_trigger"]);

function isValidConnection(connection: Connection | Edge, nodes: Node[]): boolean {
    const sourceNode = nodes.find((n) => n.id === connection.source);
    const targetNode = nodes.find((n) => n.id === connection.target);
    if (!sourceNode || !targetNode) return false;

    // Output nodes cannot have outgoing connections
    if (sourceNode.type === "output") return false;
    // Trigger nodes cannot receive connections
    if (targetNode.type && TRIGGER_TYPES.has(targetNode.type)) return false;
    // No self-connections
    if (connection.source === connection.target) return false;

    return true;
}

// ─── MiniMap auto-hide idle timeout (ms) ─────────────────────
const MINIMAP_IDLE_TIMEOUT = 2000;
const MINIMAP_FADE_DURATION = 600;

export default function WorkflowCanvas() {
    const nodes = useWorkflowBuilderStore((s) => s.nodes);
    const edges = useWorkflowBuilderStore((s) => s.edges);
    const onNodesChange = useWorkflowBuilderStore((s) => s.onNodesChange);
    const onEdgesChange = useWorkflowBuilderStore((s) => s.onEdgesChange);
    const onConnect = useWorkflowBuilderStore((s) => s.onConnect);
    const setSelectedNode = useWorkflowBuilderStore((s) => s.setSelectedNode);
    const setConfigPanelOpen = useWorkflowBuilderStore((s) => s.setConfigPanelOpen);
    const removeSelectedNodes = useWorkflowBuilderStore((s) => s.removeSelectedNodes);
    const setFavoritesModalOpen = useWorkflowBuilderStore((s) => s.setFavoritesModalOpen);
    const setHoveredGroupId = useWorkflowBuilderStore((s) => s.setHoveredGroupId);
    const addNodesToGroup = useWorkflowBuilderStore((s) => s.addNodesToGroup);
    const autoResizeGroup = useWorkflowBuilderStore((s) => s.autoResizeGroup);
    const hoveredGroupIdRef = useRef<string | null>(null);
    const nodeDoubleClickedRef = useRef(false);
    const { getNodes } = useReactFlow();

    // ─── Shift key for snap-to-grid ──────────────────────────────
    const [shiftHeld, setShiftHeld] = useState(false);

    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(true); };
        const onKeyUp = (e: KeyboardEvent) => { if (e.key === "Shift") setShiftHeld(false); };
        window.addEventListener("keydown", onKeyDown);
        window.addEventListener("keyup", onKeyUp);
        return () => {
            window.removeEventListener("keydown", onKeyDown);
            window.removeEventListener("keyup", onKeyUp);
        };
    }, []);

    // ─── MiniMap auto-hide on idle ───────────────────────────────
    const [minimapVisible, setMinimapVisible] = useState(true);
    const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const resetMinimapIdle = useCallback(() => {
        setMinimapVisible(true);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
            setMinimapVisible(false);
        }, MINIMAP_IDLE_TIMEOUT);
    }, []);

    // Start idle timer on mount
    useEffect(() => {
        resetMinimapIdle();
        return () => { if (idleTimerRef.current) clearTimeout(idleTimerRef.current); };
    }, [resetMinimapIdle]);

    // ─── Edge Cutting State ──────────────────────────────────────────
    const [isCutting, setIsCutting] = useState(false);
    const [cutLine, setCutLine] = useState<{ x: number; y: number }[]>([]);
    const [edgesToCut, setEdgesToCut] = useState<string[]>([]);

    // ─── Node Click: select only, explicitly close config panel ──────
    const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
        setSelectedNode(node.id);
        setConfigPanelOpen(false); // Single click never opens config
    }, [setSelectedNode, setConfigPanelOpen]);

    // ─── Node Double Click: open config panel ────────────────────────
    const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
        nodeDoubleClickedRef.current = true;
        setSelectedNode(node.id);
        setConfigPanelOpen(true);
    }, [setSelectedNode, setConfigPanelOpen]);

    // ─── Pane Click: deselect + close config ─────────────────────────
    const handlePaneClick = useCallback(() => {
        setSelectedNode(null);
        setConfigPanelOpen(false);
    }, [setSelectedNode, setConfigPanelOpen]);

    // Connection validation
    const handleIsValidConnection = useCallback((connection: Edge | Connection) => {
        return isValidConnection(connection, useWorkflowBuilderStore.getState().nodes);
    }, []);

    // Delete key support
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Delete" || e.key === "Backspace") {
                const active = document.activeElement;
                if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || (active as HTMLElement).isContentEditable)) return;
                removeSelectedNodes();
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [removeSelectedNodes]);

    // Escape key support to cancel cutting
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isCutting) {
                setIsCutting(false);
                setCutLine([]);
                setEdgesToCut([]);
            }
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [isCutting]);

    // Double-click on empty pane = open favorites (skip if node was double-clicked)
    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        if (nodeDoubleClickedRef.current) {
            nodeDoubleClickedRef.current = false;
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        setFavoritesModalOpen(true);
    }, [setFavoritesModalOpen]);

    // ─── Edge Cutting Logic ──────────────────────────────────────────
    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
    }, []);

    const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button === 2) { // Right click
            e.preventDefault();
            setIsCutting(true);
            const rect = e.currentTarget.getBoundingClientRect();
            setCutLine([{ x: e.clientX - rect.left, y: e.clientY - rect.top }]);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
    }, []);

    const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!isCutting) return;
        
        const rect = e.currentTarget.getBoundingClientRect();
        setCutLine(prev => [...prev, { x: e.clientX - rect.left, y: e.clientY - rect.top }]);

        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
            const edgeEl = el.closest('.react-flow__edge');
            if (edgeEl) {
                const edgeId = edgeEl.getAttribute('data-id');
                if (edgeId) {
                    setEdgesToCut(prev => prev.includes(edgeId) ? prev : [...prev, edgeId]);
                }
            }
        }
    }, [isCutting]);

    const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (isCutting) {
            if (edgesToCut.length > 0) {
                onEdgesChange(edgesToCut.map(id => ({ type: 'remove', id })));
            }
            setIsCutting(false);
            setCutLine([]);
            setEdgesToCut([]);
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    }, [isCutting, edgesToCut, onEdgesChange]);

    // ─── Node drag: detect hover-over-group OR auto-resize parent group ──────
    const handleNodeDrag = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        resetMinimapIdle(); // Reset minimap idle on drag
        if (draggedNode.type === "group") return;

        const allNodes = useWorkflowBuilderStore.getState().nodes;

        if (!draggedNode.parentId) {
            const groups = allNodes.filter((n) => n.type === "group");
            const dragW = draggedNode.measured?.width || 200;
            const dragH = draggedNode.measured?.height || 80;
            const dragCx = draggedNode.position.x + dragW / 2;
            const dragCy = draggedNode.position.y + dragH / 2;

            let foundGroup: string | null = null;
            for (const g of groups) {
                const gw = Number(g.style?.width) || 300;
                const gh = Number(g.style?.height) || 200;
                if (
                    dragCx > g.position.x &&
                    dragCx < g.position.x + gw &&
                    dragCy > g.position.y &&
                    dragCy < g.position.y + gh
                ) {
                    foundGroup = g.id;
                    break;
                }
            }

            if (foundGroup !== hoveredGroupIdRef.current) {
                hoveredGroupIdRef.current = foundGroup;
                setHoveredGroupId(foundGroup);
            }
            return;
        }

        autoResizeGroup(draggedNode.parentId);
    }, [setHoveredGroupId, autoResizeGroup, resetMinimapIdle]);

    // ─── Node drag stop: drop-to-group OR finalize child auto-resize ─────────
    const handleNodeDragStop = useCallback((_event: React.MouseEvent, draggedNode: Node) => {
        const hgId = hoveredGroupIdRef.current;

        if (hgId && draggedNode.type !== "group" && !draggedNode.parentId) {
            const absPositions: Record<string, { x: number; y: number }> = {};
            const draggedIds: string[] = [];

            absPositions[draggedNode.id] = { ...draggedNode.position };
            draggedIds.push(draggedNode.id);

            const rfNodes = getNodes();
            for (const rfn of rfNodes) {
                if (rfn.id !== draggedNode.id && rfn.selected && rfn.type !== "group" && !rfn.parentId) {
                    absPositions[rfn.id] = { ...rfn.position };
                    draggedIds.push(rfn.id);
                }
            }

            addNodesToGroup(draggedIds, hgId, absPositions);
        }

        if (draggedNode.parentId) {
            autoResizeGroup(draggedNode.parentId);
        }

        hoveredGroupIdRef.current = null;
        setHoveredGroupId(null);
    }, [addNodesToGroup, setHoveredGroupId, autoResizeGroup]);

    const renderEdges = React.useMemo(() => {
        if (edgesToCut.length === 0) return edges;
        return edges.map(e => {
            if (edgesToCut.includes(e.id)) {
                return {
                    ...e,
                    style: {
                        ...e.style,
                        stroke: "var(--status-error)",
                        strokeWidth: 4,
                        filter: "drop-shadow(0 0 6px var(--status-error))",
                        zIndex: 1000
                    },
                    animated: true
                };
            }
            return e;
        });
    }, [edges, edgesToCut]);

    return (
        <div 
            style={{ width: "100%", height: "100%", position: "relative" }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onContextMenu={handleContextMenu}
            onMouseMove={resetMinimapIdle}
        >
            <ReactFlow
                nodes={nodes}
                edges={renderEdges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
                onPaneClick={handlePaneClick}
                onNodeDrag={handleNodeDrag}
                onNodeDragStop={handleNodeDragStop}
                onMoveStart={resetMinimapIdle}
                onMove={resetMinimapIdle}
                isValidConnection={handleIsValidConnection}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                defaultEdgeOptions={defaultEdgeOptions}
                connectionLineStyle={connectionLineStyle}
                snapToGrid={shiftHeld}
                snapGrid={[20, 20]}
                fitView
                fitViewOptions={{ maxZoom: 1 }}
                proOptions={{ hideAttribution: true }}
                selectionMode={SelectionMode.Partial}
                panOnDrag={[1]}
                selectionOnDrag={true}
                selectNodesOnDrag={true}
                deleteKeyCode={null}
                onDoubleClick={handleDoubleClick}
                zoomOnDoubleClick={false}
            >
                <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="oklch(1 0 0 / 0.06)" />
                <div style={{
                    opacity: minimapVisible ? 1 : 0,
                    transition: `opacity ${MINIMAP_FADE_DURATION}ms ease`,
                    pointerEvents: minimapVisible ? "auto" : "none",
                }}>
                    <MiniMap style={minimapStyle} nodeColor={nodeColor} maskColor="oklch(0 0 0 / 0.5)" position="bottom-right" />
                </div>
                <Controls position="bottom-left" showInteractive={false} style={{
                    background: "oklch(0.1 0.005 0 / 0.6)", backdropFilter: "blur(12px)",
                    borderRadius: 10, border: "1px solid oklch(1 0 0 / 0.08)", overflow: "hidden",
                }} />
            </ReactFlow>

            {isCutting && cutLine.length > 1 && (
                <svg
                    style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        height: "100%",
                        pointerEvents: "none",
                        zIndex: 50,
                    }}
                >
                    <polyline
                        points={cutLine.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="var(--status-error)"
                        strokeWidth={3}
                        strokeDasharray="6 4"
                        style={{
                            filter: "drop-shadow(0 0 6px var(--status-error))",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                        }}
                    />
                </svg>
            )}
        </div>
    );
}
