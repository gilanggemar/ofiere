"use client";

import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useReactFlow } from "@xyflow/react";
import { Search, X, Star } from "lucide-react";
import {
    Zap, Bot, MessageSquare, Wrench, GitBranch, Code, Flag, Timer, Users, Clock, Globe, Radio, Box,
} from "lucide-react";
import { useWorkflowBuilderStore } from "@/store/useWorkflowBuilderStore";
import { NODE_CATEGORIES, type NodePaletteItem } from "./nodes/nodeStyles";

const ICON_MAP: Record<string, React.ReactNode> = {
    Zap: <Zap size={16} />, Bot: <Bot size={16} />, MessageSquare: <MessageSquare size={16} />,
    Wrench: <Wrench size={16} />, GitBranch: <GitBranch size={16} />, Code: <Code size={16} />,
    Flag: <Flag size={16} />, Timer: <Timer size={16} />, Users: <Users size={16} />,
    Clock: <Clock size={16} />, Globe: <Globe size={16} />, Radio: <Radio size={16} />,
    Box: <Box size={16} />,
};

export default function NodePalette() {
    const open = useWorkflowBuilderStore((s) => s.nodePaletteOpen);
    const search = useWorkflowBuilderStore((s) => s.nodePaletteSearch);
    const setPaletteOpen = useWorkflowBuilderStore((s) => s.setPaletteOpen);
    const setSearch = useWorkflowBuilderStore((s) => s.setSearch);
    const addNode = useWorkflowBuilderStore((s) => s.addNode);
    const favoriteNodes = useWorkflowBuilderStore((s) => s.favoriteNodes);
    const toggleFavorite = useWorkflowBuilderStore((s) => s.toggleFavorite);
    const searchRef = useRef<HTMLInputElement>(null);

    let rf: ReturnType<typeof useReactFlow> | null = null;
    try { rf = useReactFlow(); } catch { }

    useEffect(() => { if (open && searchRef.current) setTimeout(() => searchRef.current?.focus(), 80); }, [open]);

    const filtered = useMemo(() => {
        if (!search.trim()) return NODE_CATEGORIES;
        const q = search.toLowerCase();
        return NODE_CATEGORIES.map((c) => ({
            ...c,
            items: c.items.filter((i) => i.label.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)),
        })).filter((c) => c.items.length > 0);
    }, [search]);

    const createGroupFromSelection = useWorkflowBuilderStore((s) => s.createGroupFromSelection);
    const hasSelection = useWorkflowBuilderStore((s) => s.nodes.filter((n) => n.selected && n.type !== 'group' && !n.parentId).length >= 2);

    const handleAdd = useCallback((item: NodePaletteItem) => {
        // If clicking "Group" and nodes are selected, group them
        if (item.type === 'group' && hasSelection) {
            createGroupFromSelection();
            return;
        }

        let pos = { x: 250, y: 250 };
        if (rf) {
            const b = document.querySelector('.react-flow')?.getBoundingClientRect();
            if (b) pos = rf.screenToFlowPosition({ x: b.width / 2, y: b.height / 2 });
        }
        const nodeId = `${item.type}-${Date.now()}`;
        addNode({
            id: nodeId, type: item.type, position: pos,
            data: { label: item.label, ...(item.defaultData || {}) },
            ...(item.type === 'group' ? { zIndex: -1, dragHandle: '.drag-handle', style: { width: 300, height: 200 } } : {}),
        });
        // Place on canvas only — do NOT open config panel
        setPaletteOpen(false);
    }, [addNode, rf, hasSelection, createGroupFromSelection, setPaletteOpen]);

    useEffect(() => {
        const h = (e: KeyboardEvent) => {
            if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
                const a = document.activeElement;
                if (a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || (a as HTMLElement).isContentEditable)) return;
                e.preventDefault();
                setPaletteOpen(!open);
            }
            if (e.key === "Escape" && open) setPaletteOpen(false);
        };
        window.addEventListener("keydown", h);
        return () => window.removeEventListener("keydown", h);
    }, [open, setPaletteOpen]);

    const getFavKey = (item: NodePaletteItem) => `${item.type}:${item.label}`;

    return (
        <AnimatePresence>
            {open && (
                <div style={{
                    position: "fixed", top: 0, left: 0, width: "100%", height: "100%",
                    zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center",
                    background: "oklch(0 0 0 / 0.4)", backdropFilter: "blur(4px)"
                }} onClick={() => setPaletteOpen(false)}>
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.95, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            width: 680, maxHeight: "70vh",
                            background: "oklch(0.11 0.005 0 / 0.95)",
                            backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
                            border: "1px solid oklch(1 0 0 / 0.10)", borderRadius: 16,
                            boxShadow: "0 10px 40px oklch(0 0 0 / 0.5)",
                            display: "flex", flexDirection: "column", overflow: "hidden",
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px 10px" }}>
                            <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text-muted)" }}>
                                NODE INVENTORY
                            </span>
                            <button onClick={() => setPaletteOpen(false)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: 2 }}>
                                <X size={14} />
                            </button>
                        </div>

                        {/* Search */}
                        <div style={{ padding: "0 16px 10px" }}>
                            <div style={{
                                display: "flex", alignItems: "center", gap: 8, padding: "6px 10px",
                                borderRadius: 10, background: "oklch(1 0 0 / 0.04)", border: "1px solid oklch(1 0 0 / 0.08)",
                            }}>
                                <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                                <input ref={searchRef} value={search} onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search nodes…" style={{
                                        background: "none", border: "none", outline: "none",
                                        color: "var(--text-primary)", fontSize: 12, width: "100%",
                                    }} />
                            </div>
                        </div>

                        {/* Grid Body */}
                        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 16px" }}>
                            {filtered.length === 0 && (
                                <div style={{ textAlign: "center", padding: "32px 0", fontSize: 12, color: "var(--text-muted)" }}>No matches</div>
                            )}
                            {filtered.map((cat) => (
                                <div key={cat.id} style={{ marginBottom: 14 }}>
                                    {/* Category header */}
                                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, paddingLeft: 3, borderLeft: `2px solid ${cat.accent}` }}>
                                        <span style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-secondary)", paddingLeft: 6 }}>
                                            {cat.label}
                                        </span>
                                        <span style={{ fontSize: 8, color: "var(--text-muted)", background: "oklch(1 0 0 / 0.04)", padding: "1px 5px", borderRadius: 3 }}>
                                            {cat.items.length}
                                        </span>
                                    </div>
                                    {/* Items grid */}
                                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 6 }}>
                                        {cat.items.map((item, i) => {
                                            const favKey = getFavKey(item);
                                            const isFav = favoriteNodes.has(favKey);
                                            return (
                                                <div key={`${item.type}-${i}`} style={{ position: "relative" }}>
                                                    <motion.button
                                                        whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }}
                                                        onClick={() => handleAdd(item)}
                                                        style={{
                                                            width: "100%", display: "flex", alignItems: "center", gap: 8,
                                                            padding: "10px 12px", borderRadius: 10,
                                                            background: "oklch(0.15 0.005 0 / 0.5)",
                                                            border: "1px solid oklch(1 0 0 / 0.06)",
                                                            cursor: "pointer", color: cat.accent, transition: "border-color 150ms, background 150ms",
                                                            textAlign: "left",
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = cat.accent; e.currentTarget.style.background = "oklch(0.15 0.005 0 / 0.8)"; }}
                                                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = "oklch(1 0 0 / 0.06)"; e.currentTarget.style.background = "oklch(0.15 0.005 0 / 0.5)"; }}
                                                    >
                                                        <div style={{ flexShrink: 0, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, background: "oklch(1 0 0 / 0.04)" }}>
                                                            {ICON_MAP[item.icon] || <Zap size={16} />}
                                                        </div>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                                {item.label}
                                                            </div>
                                                            {item.description && (
                                                                <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{item.description}</div>
                                                            )}
                                                        </div>
                                                    </motion.button>
                                                    {/* Fav star */}
                                                    <button onClick={(e) => { e.stopPropagation(); toggleFavorite(favKey); }}
                                                        style={{
                                                            position: "absolute", top: 4, right: 4,
                                                            background: "none", border: "none", cursor: "pointer", padding: 3,
                                                            color: isFav ? "var(--accent-base)" : "var(--text-muted)",
                                                            opacity: isFav ? 1 : 0.2, transition: "opacity 150ms, color 150ms",
                                                        }}
                                                        onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
                                                        onMouseLeave={(e) => { if (!isFav) e.currentTarget.style.opacity = "0.2"; }}
                                                    >
                                                        <Star size={10} fill={isFav ? "var(--accent-base)" : "none"} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
