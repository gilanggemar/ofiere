"use client";

// ============================================================
// components/games/NeuroverseBoardPanel.tsx
// Full-screen game overlay — escapes ALL shell containers via
// useEffect DOM manipulation. Players at 4 corners, actions in
// center, floating log between P3 & P4 on right side.
// ============================================================

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNeuroverseStore, CommentaryBubble, GameEvent, GameAnnouncement } from "@/stores/useNeuroverseStore";
import { NeuroverseBoard } from "./NeuroverseBoard";
import { NeuroverseEventLog } from "./NeuroverseEventLog";
import { BOARD, COLOR_GROUPS, ColorGroup, NETRUNNERS } from "@/lib/games/adapters/neuroverse-data";
import { NeuroversePlayer, PropertyState } from "@/lib/games/adapters/neuroverse";
import { ArrowLeft, Info, Pause, Play, RotateCcw, Terminal, X } from "lucide-react";

const P_COLORS = ["#22c55e", "#06b6d4", "#f59e0b", "#ec4899"];
const P_GLOW = ["rgba(34,197,94,0.25)", "rgba(6,182,212,0.25)", "rgba(245,158,11,0.25)", "rgba(236,72,153,0.25)"];
const GROUP_COLORS: Record<ColorGroup, string> = {
  crimson: "#ef4444", gold: "#f59e0b", cyan: "#06b6d4",
  violet: "#8b5cf6", white: "#e2e8f0", neon_pink: "#ec4899",
};

const TOAST_COLORS: Record<string, string> = {
  buy: "#22c55e", rent: "#f59e0b", card: "#8b5cf6", build: "#06b6d4",
  move: "#94a3b8", system: "#ef4444", victory: "#f59e0b",
};

function isSignificant(e: GameEvent): boolean {
  return ["buy", "rent", "card", "build", "victory"].includes(e.type) ||
    e.text.includes("FIREWALL") || e.text.includes("REBOOT") || e.text.includes("CRASH");
}

// ======================== FULLSCREEN HOOK ========================
/** Strips content-viewport padding only. Top-rail & bottom-dock stay visible. */
function useGameFullscreen() {
  useEffect(() => {
    const viewport = document.querySelector<HTMLElement>(".ofiere-content-viewport");
    const orig = {
      padding: viewport?.style.padding,
      overflow: viewport?.style.overflow,
      overflowY: viewport?.style.overflowY,
    };
    if (viewport) {
      viewport.style.padding = "0";
      viewport.style.overflow = "hidden";
      viewport.style.overflowY = "hidden";
    }
    return () => {
      if (viewport) {
        viewport.style.padding = orig.padding || "";
        viewport.style.overflow = orig.overflow || "";
        viewport.style.overflowY = orig.overflowY || "";
      }
    };
  }, []);
}

// ======================== TOAST ========================
function EventToast({ event, onDone, nameMap }: { event: GameEvent; onDone: () => void; nameMap?: Record<string, string> }) {
  // Humanize player IDs in text
  let displayText = event.text;
  if (nameMap) {
    for (const [pid, name] of Object.entries(nameMap)) {
      displayText = displayText.replaceAll(pid, name);
    }
  }
  const [vis, setVis] = useState(false);
  const [exit, setExit] = useState(false);
  useEffect(() => {
    requestAnimationFrame(() => setVis(true));
    const t1 = setTimeout(() => setExit(true), 3500);
    const t2 = setTimeout(onDone, 4200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [onDone]);
  if (!isSignificant(event)) { requestAnimationFrame(onDone); return null; }
  const color = TOAST_COLORS[event.type] || "#94a3b8";
  const typeIcons: Record<string, string> = { buy: "🏠", rent: "💰", card: "🃏", build: "🏗️", victory: "🏆", system: "⚠️" };
  const icon = typeIcons[event.type] || "📢";
  return (
    <div style={{
      padding: "14px 28px", borderRadius: "14px",
      background: `linear-gradient(135deg, ${color}22, rgba(15,23,42,0.95))`,
      border: `2px solid ${color}60`,
      backdropFilter: "blur(16px)",
      boxShadow: `0 12px 40px ${color}30, 0 0 20px ${color}15`,
      transform: vis && !exit ? "translateY(0) scale(1)" : "translateY(-18px) scale(0.92)",
      opacity: vis && !exit ? 1 : 0,
      transition: "all 0.5s cubic-bezier(0.34,1.56,0.64,1)",
      display: "flex", alignItems: "center", gap: "10px",
      minWidth: "280px", maxWidth: "420px",
    }}>
      <span style={{ fontSize: "22px" }}>{icon}</span>
      <div>
        <div style={{ fontSize: "8px", fontWeight: 800, color: `${color}`, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "2px" }}>
          {event.type}
        </div>
        <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", lineHeight: 1.3 }}>
          {displayText}
        </div>
      </div>
    </div>
  );
}

// ======================== COMMENTARY ========================
function CommentaryBubbleUI({ bubble }: { bubble: CommentaryBubble }) {
  return (
    <div style={{
      padding: "8px 14px", borderRadius: "10px",
      background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(6,182,212,0.06))",
      border: "1px solid rgba(139,92,246,0.2)",
      backdropFilter: "blur(12px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
      maxWidth: "320px",
      animation: "nv-fadeUp 0.4s ease",
    }}>
      <div style={{ fontSize: "9px", fontWeight: 700, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "2px" }}>
        {bubble.agentName}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 500, color: "#e2e8f0", lineHeight: 1.4, fontStyle: "italic" }}>
        &ldquo;{bubble.text}&rdquo;
      </div>
    </div>
  );
}

// ======================== CORNER PLAYER CARD ========================
function CornerPlayerCard({ player, board, isActive, isHuman, name, rank, posStyle }: {
  player: NeuroversePlayer; board: PropertyState[]; isActive: boolean;
  isHuman: boolean; name: string; rank: number;
  posStyle: React.CSSProperties;
}) {
  const idx = parseInt(player.id.split("-")[1]) - 1;
  const color = P_COLORS[idx] || "#94a3b8";
  const glow = P_GLOW[idx] || "transparent";
  const runner = NETRUNNERS.find(r => r.id === player.netrunner);
  const ownedProps = board.map((p, i) => ({ ...p, spaceId: i })).filter(p => p.ownerId === player.id);
  const propCount = ownedProps.length;
  const voltPct = Math.min(100, (player.voltage / 8) * 100);
  const ordinals = ["1st", "2nd", "3rd", "4th"];
  const rankColors = ["#f59e0b", "#94a3b8", "#cd7f32", "#64748b"];

  // Net worth calculation
  const netWorth = player.cred + ownedProps.reduce((sum, p) => {
    const space = BOARD[p.spaceId];
    return sum + (space?.price || 0) + p.nodes * 30 + (p.hasTower ? 100 : 0) + (p.hasMegaframe ? 200 : 0);
  }, 0);

  // Owned color groups
  const ownedGroups: { color: string; count: number; total: number }[] = [];
  for (const [cg, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
    const owned = ids.filter(id => board[id]?.ownerId === player.id).length;
    if (owned > 0) {
      const gc = GROUP_COLORS[cg];
      ownedGroups.push({ color: gc, count: owned, total: ids.length });
    }
  }

  // Buildings count
  const nodes = ownedProps.reduce((s, p) => s + p.nodes, 0);
  const towers = ownedProps.filter(p => p.hasTower).length;
  const megas = ownedProps.filter(p => p.hasMegaframe).length;

  return (
    <div style={{
      position: "absolute", ...posStyle,
      padding: "12px 14px", borderRadius: "12px",
      background: isActive
        ? `linear-gradient(135deg, ${color}15, rgba(15,23,42,0.92))`
        : "rgba(15,23,42,0.88)",
      border: `1.5px solid ${isActive ? `${color}80` : "rgba(148,163,184,0.08)"}`,
      backdropFilter: "blur(16px)",
      boxShadow: isActive ? `0 0 24px ${glow}, 0 8px 24px rgba(0,0,0,0.4)` : "0 4px 16px rgba(0,0,0,0.4)",
      transition: "all 0.4s ease",
      zIndex: 10,
      width: "200px",
    }}>
      {/* Rank badge */}
      <div style={{
        position: "absolute", top: "-8px", right: "10px",
        padding: "2px 10px", borderRadius: "4px",
        background: "rgba(15,23,42,0.95)",
        border: `1px solid ${rankColors[rank - 1]}50`,
        fontSize: "9px", fontWeight: 800, color: rankColors[rank - 1],
        textTransform: "uppercase", letterSpacing: "0.5px",
      }}>
        {ordinals[rank - 1]}
      </div>

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <div style={{
          width: "28px", height: "28px", borderRadius: "50%",
          background: `linear-gradient(135deg, ${color}, ${color}80)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "10px", fontWeight: 800, color: "#000",
          boxShadow: isActive ? `0 0 10px ${glow}` : "none",
          flexShrink: 0,
        }}>
          {isHuman ? "P1" : name[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "13px", fontWeight: 800, color: "#e2e8f0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {isHuman ? "You" : name}
          </div>
          <div style={{ fontSize: "9px", fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {runner?.name || player.netrunner}
          </div>
        </div>
      </div>

      {/* Credits + Net Worth */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
        <span style={{ fontSize: "16px", fontWeight: 900, color: "#f59e0b", fontFamily: "monospace" }}>¢{player.cred}</span>
        <span style={{ fontSize: "9px", color: "#475569", fontFamily: "monospace" }}>NW: ¢{netWorth}</span>
      </div>

      {/* Voltage bar */}
      <div style={{ marginBottom: "6px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
          <span style={{ fontSize: "8px", color: "#475569", fontWeight: 700 }}>VOLTAGE</span>
          <span style={{ fontSize: "8px", color: color, fontWeight: 800, fontFamily: "monospace" }}>{player.voltage}/8</span>
        </div>
        <div style={{ height: "4px", borderRadius: "2px", background: "rgba(148,163,184,0.08)" }}>
          <div style={{
            height: "100%", width: `${voltPct}%`, borderRadius: "2px",
            background: `linear-gradient(90deg, ${color}, ${color}80)`,
            boxShadow: `0 0 6px ${glow}`, transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Properties + Buildings */}
      <div style={{ display: "flex", gap: "8px", fontSize: "10px", fontWeight: 700, fontFamily: "monospace", marginBottom: "6px" }}>
        <span style={{ color: "#94a3b8" }}>{propCount} prop{propCount !== 1 ? "s" : ""}</span>
        {nodes > 0 && <span style={{ color: "#06b6d4" }}>{nodes}N</span>}
        {towers > 0 && <span style={{ color: "#a78bfa" }}>{towers}T</span>}
        {megas > 0 && <span style={{ color: "#f59e0b" }}>{megas}M</span>}
      </div>

      {/* Color group dots */}
      {ownedGroups.length > 0 && (
        <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
          {ownedGroups.map((g, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: "2px",
              padding: "1px 4px", borderRadius: "3px",
              background: `${g.color}15`, border: `1px solid ${g.color}30`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: g.color }} />
              <span style={{ fontSize: "8px", color: g.color, fontWeight: 800 }}>{g.count}/{g.total}</span>
            </div>
          ))}
        </div>
      )}

      {/* Status badges */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {player.inFirewall && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(239,68,68,0.2)" }}>
            🔒 FIREWALL
          </span>
        )}
        {player.rebootShield && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(34,197,94,0.2)" }}>
            🛡️ SHIELD
          </span>
        )}
        {player.heldCards.includes("escape_firewall") && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#06b6d4", background: "rgba(6,182,212,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(6,182,212,0.2)" }}>
            🔑 ESCAPE
          </span>
        )}
        {player.heldCards.includes("vpn_shield") && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#a78bfa", background: "rgba(139,92,246,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(139,92,246,0.2)" }}>
            🛡 VPN
          </span>
        )}
        {player.heldCards.includes("half_rent") && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(245,158,11,0.2)" }}>
            ½ RENT
          </span>
        )}
        {player.noVoltageNextTurn && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(239,68,68,0.2)" }}>
            ⚡✕ NO VOLT
          </span>
        )}
        {player.rentBoostThisRound > 0 && (
          <span style={{ fontSize: "8px", fontWeight: 800, color: "#22c55e", background: "rgba(34,197,94,0.1)", padding: "1px 6px", borderRadius: "3px", border: "1px solid rgba(34,197,94,0.2)" }}>
            📈 +¢{player.rentBoostThisRound}
          </span>
        )}
      </div>
    </div>
  );
}

// ======================== MAIN PANEL ========================
export function NeuroverseBoardPanel() {
  useGameFullscreen(); // Strip shell padding, hide top-rail & bottom-dock

  const {
    gameState, result, isRunning, isPaused, events, commentary, announcement,
    humanPlayerId, agentSlots, isAgentThinking, currentThinkingAgent,
    processHumanAction, pauseGame, resumeGame, resetToLobby, turnDelayMs, setTurnDelay,
  } = useNeuroverseStore();

  const [activeCommentary, setActiveCommentary] = useState<CommentaryBubble | null>(null);
  const [toastQueue, setToastQueue] = useState<GameEvent[]>([]);
  const [activeToast, setActiveToast] = useState<GameEvent | null>(null);
  const [showLog, setShowLog] = useState(false);
  const prevEvtCount = useRef(events.length);
  const [boardZoom, setBoardZoom] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState("50% 50%");
  const prevPositions = useRef<string>("");
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);

  // Map tile ID to approximate screen position % on the isometric diamond
  function getTileScreenOrigin(tileId: number): string {
    // Isometric diamond corners (in screen %):
    // Tile 0 (Boot Up/top): 50% 18%
    // Tile 7 (right corner): 84% 50%
    // Tile 14 (Firewall/bottom): 50% 82%
    // Tile 21 (left corner): 16% 50%
    if (tileId >= 0 && tileId <= 7) {
      const t = tileId / 7;
      return `${50 + t * 34}% ${18 + t * 32}%`;
    }
    if (tileId >= 8 && tileId <= 13) {
      const t = (tileId - 8) / 5;
      return `${84 - t * 34}% ${50 + t * 32}%`;
    }
    if (tileId >= 14 && tileId <= 21) {
      const t = (tileId - 14) / 7;
      return `${50 - t * 34}% ${82 - t * 32}%`;
    }
    // 22-27
    const t = (tileId - 22) / 5;
    return `${16 + t * 34}% ${50 - t * 32}%`;
  }

  // Camera zoom follows the active player's pin when position changes
  useEffect(() => {
    if (!gameState) return;
    const posKey = gameState.players.map(p => p.position).join(",");
    if (prevPositions.current && prevPositions.current !== posKey) {
      // Find which player moved
      const activePlayer = gameState.players[gameState.activePlayerIndex];
      if (activePlayer) {
        setZoomOrigin(getTileScreenOrigin(activePlayer.position));
      }
      setBoardZoom(true);
      const t = setTimeout(() => setBoardZoom(false), 1600);
      return () => clearTimeout(t);
    }
    prevPositions.current = posKey;
  }, [gameState?.players.map(p => p.position).join(",")]);

  useEffect(() => {
    if (commentary.length === 0) return;
    const latest = commentary[commentary.length - 1];
    if (!latest.text) return;
    setActiveCommentary(latest);
    const t = setTimeout(() => setActiveCommentary(null), 4500);
    return () => clearTimeout(t);
  }, [commentary.length]);

  useEffect(() => {
    if (events.length > prevEvtCount.current) {
      const newEvts = events.slice(prevEvtCount.current).filter(isSignificant);
      if (newEvts.length > 0) {
        setToastQueue(prev => {
          const lastInQueue = prev.length > 0 ? prev[prev.length - 1].text : "";
          const deduped = newEvts.filter((e, i) => {
            if (i === 0) return e.text !== lastInQueue;
            return e.text !== newEvts[i - 1].text;
          });
          return [...prev, ...deduped];
        });
      }
    }
    prevEvtCount.current = events.length;
  }, [events.length]);

  useEffect(() => {
    if (activeToast || toastQueue.length === 0) return;
    const [next, ...rest] = toastQueue;
    setActiveToast(next);
    setToastQueue(rest);
  }, [activeToast, toastQueue]);

  const handleToastDone = useCallback(() => setActiveToast(null), []);

  if (!gameState) return null;

  const activePlayerId = gameState.turnOrder[gameState.activePlayerIndex];
  const isHumanTurn = activePlayerId === humanPlayerId;
  const player = gameState.players.find(p => p.id === humanPlayerId);
  const agentNames: Record<string, string> = { [humanPlayerId]: "You" };
  agentSlots.forEach(s => { agentNames[s.playerId] = s.agentName; });

  const ranked = [...gameState.players].sort((a, b) => {
    const aw = a.cred + gameState.board.filter(p => p?.ownerId === a.id).length * 50;
    const bw = b.cred + gameState.board.filter(p => p?.ownerId === b.id).length * 50;
    return bw - aw;
  });
  const rankMap: Record<string, number> = {};
  ranked.forEach((p, i) => { rankMap[p.id] = i + 1; });

  // P1 bottom-left, P2 top-left, P3 top-right, P4 bottom-right
  const cornerPos: React.CSSProperties[] = [
    { bottom: "16px", left: "16px" },
    { top: "40px", left: "16px" },
    { top: "40px", right: "16px" },
    { bottom: "16px", right: "16px" },
  ];

  const phase = gameState.turnPhase;
  const space = BOARD[player?.position ?? 0];
  const prop = gameState.board[player?.position ?? 0];

  return (
    <div style={{
      position: "relative",
      width: "100%", height: "100%",
      background: "linear-gradient(180deg, #020617 0%, #0f172a 50%, #020617 100%)",
      overflow: "hidden",
      animation: "nv-launchIn 1.2s cubic-bezier(0.25,0.46,0.45,0.94)",
    }}>
      {/* ═══ TOP BAR ═══ */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "6px 16px", zIndex: 8,
        background: "linear-gradient(180deg, rgba(2,6,23,0.8) 0%, transparent 100%)",
      }}>
        {/* Center cluster: Exit | NEUROVERSE | Round | Speed | Pause */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button onClick={() => isRunning ? setShowExitConfirm(true) : resetToLobby()} style={{
            display: "flex", alignItems: "center", gap: "4px",
            padding: "4px 10px", borderRadius: "6px",
            background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)",
            color: "#64748b", fontSize: "10px", fontWeight: 600, cursor: "pointer",
          }}>
            <ArrowLeft size={10} /> Exit
          </button>
          <div style={{ width: "1px", height: "12px", background: "rgba(148,163,184,0.15)" }} />
          <div style={{
            fontSize: "11px", fontWeight: 800, letterSpacing: "1px",
            color: "#475569", textTransform: "uppercase",
          }}>
            Neuroverse
          </div>
          <div style={{ width: "1px", height: "12px", background: "rgba(148,163,184,0.15)" }} />
          <div style={{ fontSize: "10px", fontWeight: 700, color: "#475569", fontFamily: "monospace" }}>
            Round {gameState.round}/{gameState.maxRounds}
          </div>
          <div style={{ width: "1px", height: "12px", background: "rgba(148,163,184,0.15)" }} />
          <select value={turnDelayMs} onChange={e => setTurnDelay(Number(e.target.value))} style={{
            padding: "3px 6px", borderRadius: "4px",
            background: "rgba(148,163,184,0.06)", border: "1px solid rgba(148,163,184,0.1)",
            color: "#64748b", fontSize: "9px", cursor: "pointer",
          }}>
            <option value={500}>Fast</option>
            <option value={1500}>Normal</option>
            <option value={3000}>Slow</option>
          </select>
          {isRunning && (
            <button onClick={isPaused ? resumeGame : pauseGame} style={{
              padding: "3px 8px", borderRadius: "4px",
              background: isPaused ? "rgba(34,197,94,0.08)" : "rgba(249,115,22,0.08)",
              border: `1px solid ${isPaused ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)"}`,
              color: isPaused ? "#22c55e" : "#f97316",
              fontSize: "9px", cursor: "pointer", display: "flex", alignItems: "center", gap: "3px",
            }}>
              {isPaused ? <><Play size={9} /> Go</> : <><Pause size={9} /> ||</>}
            </button>
          )}
        </div>
      </div>

      {/* ═══ BOARD ═══ */}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "transform 1.0s cubic-bezier(0.25,0.46,0.45,0.94)",
        transform: boardZoom ? "scale(1.35)" : "scale(1)",
        transformOrigin: zoomOrigin,
      }}>
        <NeuroverseBoard state={gameState} humanPlayerId={humanPlayerId} />
      </div>

      {/* ═══ CENTER OVERLAY — events above dice, actions below ═══ */}
      <div style={{
        position: "absolute",
        top: "50%", left: "50%",
        transform: "translate(-50%, -50%)", zIndex: 8,
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: "8px",
        pointerEvents: "none",
      }}>
        {/* ─── EVENT NOTIFICATION (above dice) ─── */}
        {activeToast && (
          <EventToast key={`toast-${activeToast.text}-${activeToast.round}`} event={activeToast} onDone={handleToastDone} nameMap={agentNames} />
        )}

        {gameState.dice && (
          <div style={{ display: "flex", gap: "6px", pointerEvents: "none" }}>
            <DieVisual value={gameState.dice[0]} />
            <DieVisual value={gameState.dice[1]} />
          </div>
        )}
        {isHumanTurn && isRunning && !result && player && (
          <div key={phase} style={{
            pointerEvents: "auto",
            padding: "14px 18px", borderRadius: "12px",
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(34,197,94,0.25)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            minWidth: "220px",
            animation: "nv-phaseSlide 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <div style={{
              fontSize: "9px", fontWeight: 700, color: "#22c55e",
              textTransform: "uppercase", letterSpacing: "0.5px",
              marginBottom: "6px", textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#22c55e", animation: "nv-pulse 1s infinite" }} />
              Your Turn — {phase}
            </div>
            <CenterActions phase={phase} player={player} space={space} prop={prop} gameState={gameState} processAction={processHumanAction} />
          </div>
        )}
        {/* Auction UI — shows bid/pass even when it's NOT the human's turn */}
        {!isHumanTurn && isRunning && !result && gameState.turnPhase === "auction" && gameState.auction && player && !isAgentThinking &&
          !gameState.auction.passed.includes(humanPlayerId) && gameState.auction.highestBidder !== humanPlayerId && (
          <div key="auction-human" style={{
            pointerEvents: "auto",
            padding: "14px 18px", borderRadius: "12px",
            background: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(245,158,11,0.3)",
            backdropFilter: "blur(16px)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            minWidth: "220px",
            animation: "nv-phaseSlide 0.4s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <div style={{
              fontSize: "9px", fontWeight: 700, color: "#f59e0b",
              textTransform: "uppercase", letterSpacing: "0.5px",
              marginBottom: "6px", textAlign: "center",
              display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
            }}>
              <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#f59e0b", animation: "nv-pulse 1s infinite" }} />
              Auction — Your Bid
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <button
                onClick={() => processHumanAction({ type: "auction_bid", payload: { amount: (gameState.auction?.highestBid || 0) + 10 } })}
                style={{
                  padding: "10px 16px", borderRadius: "8px",
                  background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
                  color: "#22c55e", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Bid ¢{(gameState.auction?.highestBid || 0) + 10}
              </button>
              <button
                onClick={() => processHumanAction({ type: "auction_pass", payload: {} })}
                style={{
                  padding: "10px 16px", borderRadius: "8px",
                  background: "rgba(148,163,184,0.05)", border: "1px solid rgba(148,163,184,0.15)",
                  color: "#94a3b8", fontSize: "12px", fontWeight: 700, cursor: "pointer",
                  textAlign: "center",
                }}
              >
                Pass
              </button>
            </div>
          </div>
        )}
        {isAgentThinking && (() => {
          const ann = announcement;
          const agentIdx = gameState.players.findIndex(p => agentSlots.some(s => s.playerId === p.id && s.agentName === currentThinkingAgent));
          const agentColor = P_COLORS[agentIdx >= 0 ? agentIdx : 1] || "#a78bfa";
          const displayText = ann?.text || `${currentThinkingAgent} thinking...`;
          const isThinking = !ann || ann.type === "thinking";
          const typeIcon = ann?.type === "action" ? "⚡" : ann?.type === "phase" ? "🎯" : ann?.type === "event" ? "📢" : "✦";

          return (
            <div key={ann?.id || "thinking"} style={{
              pointerEvents: "none",
              padding: "10px 20px", borderRadius: "10px",
              background: `linear-gradient(135deg, ${agentColor}15, rgba(15,23,42,0.92))`,
              border: `1.5px solid ${agentColor}40`,
              backdropFilter: "blur(14px)",
              boxShadow: `0 8px 32px ${agentColor}20, 0 2px 8px rgba(0,0,0,0.4)`,
              maxWidth: "380px", textAlign: "center",
              animation: "nv-annSlide 0.35s cubic-bezier(0.34,1.56,0.64,1)",
            }}>
              <div style={{
                fontSize: "9px", fontWeight: 700, color: agentColor,
                textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: "4px",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "4px",
              }}>
                {isThinking && (
                  <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: agentColor, animation: "nv-pulse 1s infinite" }} />
                )}
                {currentThinkingAgent}
                {ann?.detail && <span style={{ color: "#64748b", fontWeight: 600 }}> · {ann.detail}</span>}
              </div>
              <div style={{
                fontSize: "13px", fontWeight: 700, color: "#e2e8f0",
                lineHeight: 1.4, display: "flex", alignItems: "center",
                justifyContent: "center", gap: "6px",
              }}>
                <span style={{ fontSize: "14px" }}>{typeIcon}</span> {displayText}
              </div>
            </div>
          );
        })()}
      </div>

      {/* ═══ CORNER PLAYERS ═══ */}
      {gameState.players.map((p, i) => (
        <CornerPlayerCard
          key={p.id} player={p} board={gameState.board}
          isActive={p.id === activePlayerId}
          isHuman={p.id === humanPlayerId}
          name={agentNames[p.id] || p.id}
          rank={rankMap[p.id] || i + 1}
          posStyle={cornerPos[i]}
        />
      ))}

      {/* ═══ LOG TOGGLE — small button between P3 and P4 on right ═══ */}
      {!showLog && (
        <button onClick={() => setShowLog(true)} style={{
          position: "absolute", right: "16px", top: "50%",
          transform: "translateY(-50%)",
          padding: "6px", borderRadius: "8px",
          background: "rgba(148,163,184,0.06)",
          border: "1px solid rgba(148,163,184,0.1)",
          color: "#475569", cursor: "pointer", zIndex: 10,
          display: "flex", alignItems: "center", gap: "4px",
          fontSize: "9px", fontWeight: 600,
        }}>
          <Terminal size={10} />
        </button>
      )}

      {/* ═══ FLOATING LOG — between P3 (top-right) and P4 (bottom-right) ═══ */}
      {showLog && (
        <div style={{
          position: "absolute",
          top: "calc(40px + 100px + 12px)", // below P3 card
          right: "16px",
          bottom: "calc(16px + 100px + 12px)", // above P4 card
          width: "170px",
          background: "rgba(2,6,23,0.92)",
          border: "1px solid rgba(148,163,184,0.08)",
          borderRadius: "10px",
          backdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column",
          zIndex: 12,
          overflow: "hidden",
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
        }}>
          <div style={{
            padding: "6px 8px",
            borderBottom: "1px solid rgba(148,163,184,0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <div style={{ fontSize: "9px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "3px" }}>
              <Terminal size={9} /> Log
            </div>
            <button onClick={() => setShowLog(false)} style={{
              background: "none", border: "none", color: "#475569", cursor: "pointer",
              padding: "1px", display: "flex",
            }}>
              <X size={10} />
            </button>
          </div>
          <div style={{ flex: 1, overflow: "hidden", padding: "3px" }}>
            <NeuroverseEventLog events={events} />
          </div>
        </div>
      )}

      {/* ═══ GAME INSTRUCTIONS ICON ═══ */}
      <button onClick={() => setShowInstructions(true)} style={{
        position: "absolute", left: "16px", top: "50%",
        transform: "translateY(-50%)", zIndex: 10,
        width: "36px", height: "36px", borderRadius: "50%",
        background: "rgba(139,92,246,0.1)", border: "1.5px solid rgba(139,92,246,0.3)",
        color: "#a78bfa", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(8px)",
        boxShadow: "0 2px 12px rgba(139,92,246,0.15)",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(139,92,246,0.2)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.5)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "rgba(139,92,246,0.1)"; e.currentTarget.style.borderColor = "rgba(139,92,246,0.3)"; }}>
        <Info size={16} />
      </button>

      {/* ═══ COMMENTARY ═══ */}
      {activeCommentary && (() => {
        // Find which player index this agent corresponds to
        const agentName = activeCommentary.agentName;
        let pIdx = -1;
        for (let i = 0; i < gameState.players.length; i++) {
          const pid = gameState.players[i].id;
          if (agentNames[pid] === agentName) { pIdx = i; break; }
        }
        // Position near the player's corner card
        // P0: bottom-left → bubble above-right, P1: top-left → bubble below-right
        // P2: top-right → bubble below-left, P3: bottom-right → bubble above-left
        const posMap: React.CSSProperties[] = [
          { bottom: "160px", left: "16px" },   // P1 bottom-left → above their card
          { top: "180px", left: "16px" },       // P2 top-left → below their card
          { top: "180px", right: "16px" },      // P3 top-right → below their card
          { bottom: "160px", right: "16px" },   // P4 bottom-right → above their card
        ];
        const pos = pIdx >= 0 ? posMap[pIdx] : { bottom: "60px", left: "50%", transform: "translateX(-50%)" };

        return (
          <div style={{
            position: "absolute", zIndex: 10, ...pos,
          }}>
            <CommentaryBubbleUI bubble={activeCommentary} />
          </div>
        );
      })()}

      {/* ═══ RESULT OVERLAY ═══ */}
      {result && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 10,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          animation: "nv-fadeIn 0.5s ease",
        }}>
          <div style={{
            fontSize: "56px", marginBottom: "12px",
            animation: "nv-bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            {result.winnerId === humanPlayerId ? "🏆" : "💀"}
          </div>
          <div style={{
            fontSize: "36px", fontWeight: 900,
            background: result.winnerId === humanPlayerId
              ? "linear-gradient(135deg, #22c55e, #06b6d4)"
              : "linear-gradient(135deg, #ef4444, #f97316)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            marginBottom: "8px", textTransform: "uppercase",
          }}>
            {result.winnerId === humanPlayerId ? "Victory!" : "Defeated"}
          </div>
          <div style={{ fontSize: "13px", color: "#94a3b8", marginBottom: "24px", textAlign: "center", maxWidth: "400px" }}>
            {(() => {
              let reason = result.reason;
              reason = reason.replace(new RegExp(humanPlayerId, "g"), "You");
              agentSlots.forEach(s => { reason = reason.replace(new RegExp(s.playerId, "g"), s.agentName); });
              return reason;
            })()}
          </div>
          <button onClick={resetToLobby} style={{
            padding: "10px 28px", borderRadius: "8px",
            background: "linear-gradient(135deg, #06b6d4, #8b5cf6)",
            color: "#fff", fontWeight: 700, fontSize: "14px",
            border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: "6px",
            boxShadow: "0 4px 16px rgba(6,182,212,0.3)",
          }}>
            <RotateCcw size={14} /> Play Again
          </button>
        </div>
      )}

      {/* ═══ EXIT CONFIRMATION ═══ */}
      {showExitConfirm && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "nv-fadeIn 0.2s ease",
        }}>
          <div style={{
            padding: "28px 36px", borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,20,50,0.95))",
            border: "1.5px solid rgba(239,68,68,0.2)",
            boxShadow: "0 16px 64px rgba(0,0,0,0.6)",
            textAlign: "center", maxWidth: "340px",
            animation: "nv-bounceIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
          }}>
            <div style={{ fontSize: "28px", marginBottom: "12px" }}>⚠️</div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#e2e8f0", marginBottom: "6px" }}>
              Exit Game?
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "20px", lineHeight: 1.5 }}>
              Are you sure you want to exit? All progress will be lost.
            </div>
            <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
              <button onClick={() => setShowExitConfirm(false)} style={{
                padding: "8px 20px", borderRadius: "8px",
                background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)",
                color: "#94a3b8", fontSize: "12px", fontWeight: 700, cursor: "pointer",
              }}>
                Cancel
              </button>
              <button onClick={() => { setShowExitConfirm(false); resetToLobby(); }} style={{
                padding: "8px 20px", borderRadius: "8px",
                background: "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.08))",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444", fontSize: "12px", fontWeight: 700, cursor: "pointer",
              }}>
                Exit Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ GAME INSTRUCTIONS MODAL ═══ */}
      {showInstructions && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 50,
          background: "rgba(0,0,0,0.85)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          animation: "nv-fadeIn 0.2s ease",
        }} onClick={() => setShowInstructions(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "600px", maxWidth: "90vw", maxHeight: "80vh",
            borderRadius: "16px",
            background: "linear-gradient(135deg, rgba(15,23,42,0.98), rgba(30,20,50,0.95))",
            border: "1.5px solid rgba(139,92,246,0.2)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.7), 0 0 40px rgba(139,92,246,0.1)",
            display: "flex", flexDirection: "column",
            animation: "nv-bounceIn 0.3s cubic-bezier(0.34,1.56,0.64,1)",
            overflow: "hidden",
          }}>
            {/* Modal Header */}
            <div style={{
              padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between",
              borderBottom: "1px solid rgba(139,92,246,0.15)", flexShrink: 0,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "50%",
                  background: "linear-gradient(135deg, #8b5cf6, #06b6d4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Info size={14} color="#fff" />
                </div>
                <span style={{ fontSize: "16px", fontWeight: 800, color: "#e2e8f0", letterSpacing: "0.5px" }}>HOW TO PLAY</span>
              </div>
              <button onClick={() => setShowInstructions(false)} style={{
                background: "rgba(148,163,184,0.08)", border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: "6px", padding: "4px 8px", color: "#94a3b8", cursor: "pointer",
                display: "flex", alignItems: "center", gap: "4px", fontSize: "10px", fontWeight: 600,
              }}>
                <X size={12} /> Close
              </button>
            </div>
            {/* Modal Body — scrollable */}
            <div style={{
              flex: 1, overflowY: "auto", padding: "20px",
              lineHeight: 1.6, color: "#cbd5e1", fontSize: "12px",
            }}>
              {/* Turn Structure */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#a78bfa", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  ⚡ Turn Structure
                </div>
                <div style={{ background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.1)", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                    {["Roll Dice", "Choose Die", "Resolve Space", "Build", "Voltage", "End Turn"].map((step, i) => (
                      <React.Fragment key={step}>
                        <span style={{
                          padding: "3px 8px", borderRadius: "4px",
                          background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.2)",
                          fontSize: "10px", fontWeight: 700, color: "#c4b5fd",
                        }}>{step}</span>
                        {i < 5 && <span style={{ color: "#475569" }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ marginTop: "8px", fontSize: "11px", color: "#94a3b8" }}>
                    Roll both dice, then <b>choose one</b> for movement. Resolve where you land, build if you own a full color group, optionally spend Voltage, then end turn.
                  </div>
                </div>
              </div>

              {/* How to Win */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#22c55e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  🏆 How to Win (3 Paths)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {[
                    { name: "DOMINANCE", desc: "Own properties worth ¢800+ AND have at least 1 Megaframe.", color: "#f59e0b" },
                    { name: "CONTROL", desc: "Complete 2 or more color groups (own every property in each group).", color: "#06b6d4" },
                    { name: "SCORE", desc: "Have the highest Grid Score when the Countdown Clock hits Round 12.", color: "#8b5cf6" },
                  ].map(v => (
                    <div key={v.name} style={{ padding: "8px 12px", borderRadius: "8px", background: `${v.color}08`, border: `1px solid ${v.color}20` }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, color: v.color, letterSpacing: "0.5px" }}>{v.name}</span>
                      <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>{v.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Building */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#06b6d4", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  🏗️ Building System
                </div>
                <div style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.1)", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    {[
                      { name: "Nodes (×3)", desc: "Small upgrades", color: "#22c55e" },
                      { name: "Tower (×1)", desc: "Replaces 3 Nodes", color: "#3b82f6" },
                      { name: "Megaframe (×1)", desc: "Replaces Tower", color: "#ef4444" },
                    ].map((b, i) => (
                      <React.Fragment key={b.name}>
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: "10px", fontWeight: 800, color: b.color }}>{b.name}</div>
                          <div style={{ fontSize: "9px", color: "#64748b" }}>{b.desc}</div>
                        </div>
                        {i < 2 && <span style={{ color: "#475569", fontSize: "14px" }}>→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                  <div style={{ marginTop: "6px", fontSize: "11px", color: "#94a3b8" }}>
                    You must own <b>all properties</b> in a color group before building. Build evenly across the group.
                  </div>
                </div>
              </div>

              {/* Voltage Abilities */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  ⚡ Voltage Abilities
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                  {[
                    { name: "Reroll", cost: "1V", desc: "Re-roll both dice" },
                    { name: "Boost", cost: "1V", desc: "+1 or -1 to chosen die" },
                    { name: "Shields Up", cost: "2V", desc: "Halve rent owed" },
                    { name: "Surge", cost: "2V", desc: "Double rent on 1 property" },
                    { name: "Hack", cost: "3V", desc: "Steal unimproved property" },
                    { name: "EMP Burst", cost: "4V", desc: "Downgrade enemy building" },
                  ].map(a => (
                    <div key={a.name} style={{ padding: "5px 8px", borderRadius: "6px", background: "rgba(245,158,11,0.06)", border: "1px solid rgba(245,158,11,0.1)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span style={{ fontSize: "10px", fontWeight: 700, color: "#fbbf24" }}>{a.name}</span>
                        <span style={{ fontSize: "9px", fontWeight: 800, color: "#92400e", background: "rgba(245,158,11,0.15)", padding: "0 4px", borderRadius: "3px" }}>{a.cost}</span>
                      </div>
                      <div style={{ fontSize: "9px", color: "#94a3b8" }}>{a.desc}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: "6px", fontSize: "10px", color: "#64748b" }}>Max 8 Voltage. Earn from BOOT UP, doubles, ⚡ die faces, completing groups.</div>
              </div>

              {/* Special Spaces */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ec4899", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  📍 Special Spaces
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {[
                    { name: "BOOT UP", desc: "Collect ¢200 + 1V when passing. Land exactly: +2V.", icon: "▶" },
                    { name: "FIREWALL", desc: "Trapped until you escape: pay ¢50, use card, or roll doubles (2 attempts).", icon: "🔒" },
                    { name: "TOLL ZONE", desc: "Pay ¢50 OR draw a SIGNAL card.", icon: "💰" },
                    { name: "SYSTEM CRASH", desc: "Go directly to FIREWALL. No salary.", icon: "💥" },
                    { name: "GLITCH", desc: "Draw GLITCH card — disruptive events.", icon: "⚠" },
                    { name: "SIGNAL", desc: "Draw SIGNAL card — beneficial effects.", icon: "📡" },
                  ].map(sp => (
                    <div key={sp.name} style={{ display: "flex", gap: "8px", alignItems: "flex-start", padding: "4px 0" }}>
                      <span style={{ fontSize: "12px", flexShrink: 0, width: "18px", textAlign: "center" }}>{sp.icon}</span>
                      <div>
                        <span style={{ fontSize: "10px", fontWeight: 800, color: "#e2e8f0" }}>{sp.name}</span>
                        <span style={{ fontSize: "10px", color: "#94a3b8", marginLeft: "4px" }}>{sp.desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* What to Avoid */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  ⛔ What to Avoid
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  {[
                    "Going bankrupt — you get ONE reboot (¢250 + shield), then you're out.",
                    "Landing on SYSTEM CRASH — sends you straight to FIREWALL.",
                    "Hoarding Voltage over 8 — excess is lost. Spend it!",
                    "Ignoring color groups — you can't build without owning the full set.",
                    "Overspending on properties — keep ¢80+ reserve for rent emergencies.",
                  ].map((tip, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                      <span style={{ color: "#ef4444", fontSize: "10px", fontWeight: 900, flexShrink: 0 }}>•</span>
                      <span style={{ fontSize: "10px", color: "#94a3b8" }}>{tip}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* GLITCH Cards */}
              <div style={{ marginBottom: "20px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#f59e0b", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  ⚠️ GLITCH Cards (16)
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "6px" }}>Drawn on GLITCH spaces. Mostly disruptive — watch out!</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {[
                    { name: "System Error", desc: "Go to FIREWALL" },
                    { name: "Data Leak", desc: "Pay ¢75 to bank" },
                    { name: "Worm Virus", desc: "Pay ¢25 per Megaframe owned" },
                    { name: "Grid Surge", desc: "Move to nearest Datastream, pay double rent if owned" },
                    { name: "Power Outage", desc: "Lose 2 Voltage" },
                    { name: "Backdoor Found", desc: "Move back 3 spaces" },
                    { name: "Corporate Raid", desc: "Pay ¢25 to each other player" },
                    { name: "Infrastructure Tax", desc: "Pay ¢20/Node, ¢40/Tower, ¢80/Megaframe" },
                    { name: "Firewall Breach", desc: "Keep: Use to escape Firewall for free" },
                    { name: "Packet Loss", desc: "Your next rent collection is halved" },
                    { name: "Blackhat Alert", desc: "Move to The Spire (may owe rent!)" },
                    { name: "Signal Jam", desc: "Cannot use Voltage on your next turn" },
                    { name: "Forced Reboot", desc: "Return to BOOT UP, collect salary" },
                    { name: "Ransomware", desc: "Richest opponent pays you ¢50" },
                    { name: "Memory Wipe", desc: "Discard all held Escape Firewall cards" },
                    { name: "DDoS Attack", desc: "Remove 1 Node from an opponent's property" },
                  ].map(c => (
                    <div key={c.name} style={{ display: "flex", gap: "6px", padding: "3px 8px", borderRadius: "4px", background: "rgba(245,158,11,0.04)", border: "1px solid rgba(245,158,11,0.08)" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#fbbf24", minWidth: "90px", flexShrink: 0 }}>{c.name}</span>
                      <span style={{ fontSize: "9px", color: "#94a3b8" }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* SIGNAL Cards */}
              <div style={{ marginBottom: "8px" }}>
                <div style={{ fontSize: "13px", fontWeight: 800, color: "#8b5cf6", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  📡 SIGNAL Cards (16)
                </div>
                <div style={{ fontSize: "10px", color: "#64748b", marginBottom: "6px" }}>Drawn on SIGNAL spaces or Toll Zone. Mostly beneficial!</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  {[
                    { name: "Anonymous Donor", desc: "Collect ¢150" },
                    { name: "Bug Bounty", desc: "Collect ¢100" },
                    { name: "Crypto Windfall", desc: "Collect ¢75 + gain 1 Voltage" },
                    { name: "Street Cred", desc: "Collect ¢25 from each other player" },
                    { name: "Firewall Key", desc: "Keep: Use to escape Firewall for free" },
                    { name: "Grid Dividend", desc: "Collect ¢10 per property you own" },
                    { name: "Data Mining", desc: "Gain 3 Voltage" },
                    { name: "Neon Jackpot", desc: "Collect ¢200" },
                    { name: "Free Upgrade", desc: "Place 1 free Node on any eligible property" },
                    { name: "VPN Shield", desc: "Keep: Skip your next rent payment" },
                    { name: "Advance to BOOT UP", desc: "Go to BOOT UP, collect salary + 1V" },
                    { name: "Insider Info", desc: "Peek at top 3 cards of any deck" },
                    { name: "Proxy Server", desc: "+¢25 to all your rent this round" },
                    { name: "Happy Client", desc: "Collect ¢50" },
                    { name: "Tax Refund", desc: "Collect ¢100" },
                    { name: "Supply Run", desc: "Gain 2 Voltage + ¢25" },
                  ].map(c => (
                    <div key={c.name} style={{ display: "flex", gap: "6px", padding: "3px 8px", borderRadius: "4px", background: "rgba(139,92,246,0.04)", border: "1px solid rgba(139,92,246,0.08)" }}>
                      <span style={{ fontSize: "9px", fontWeight: 800, color: "#c4b5fd", minWidth: "100px", flexShrink: 0 }}>{c.name}</span>
                      <span style={{ fontSize: "9px", color: "#94a3b8" }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes nv-fadeUp { from { opacity:0; transform: translateY(10px); } to { opacity:1; transform: translateY(0); } }
        @keyframes nv-fadeIn { from { opacity:0; } to { opacity:1; } }
        @keyframes nv-bounceIn { from { opacity:0; transform: scale(0.5); } to { opacity:1; transform: scale(1); } }
        @keyframes nv-pulse { 0%,100%{opacity:1;} 50%{opacity:0.3;} }
        @keyframes nv-diceRoll { 
          0% { transform: rotate(0deg) scale(1); } 
          25% { transform: rotate(8deg) scale(1.05); } 
          50% { transform: rotate(-6deg) scale(0.95); } 
          75% { transform: rotate(4deg) scale(1.03); } 
          100% { transform: rotate(0deg) scale(1); } 
        }
        @keyframes nv-diceLand { 
          0% { transform: scale(1.3) rotate(10deg); opacity: 0.7; } 
          50% { transform: scale(0.9) rotate(-2deg); } 
          100% { transform: scale(1) rotate(0deg); opacity: 1; } 
        }
        @keyframes nv-launchIn {
          0% { opacity: 0; transform: scale(0.8); filter: blur(8px) brightness(2); }
          40% { opacity: 1; filter: blur(0) brightness(1.5); }
          100% { transform: scale(1); filter: blur(0) brightness(1); }
        }
        @keyframes nv-phaseSlide {
          0% { opacity: 0; transform: translateY(12px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes nv-cashFloat {
          0% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-40px) scale(1.2); }
        }
        @keyframes nv-pinDrop {
          0% { transform: translateY(-20px) scale(0.6); opacity: 0; }
          50% { transform: translateY(4px) scale(1.1); opacity: 1; }
          70% { transform: translateY(-3px) scale(0.95); }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes nv-pinBounce {
          0% { transform: scale(1); }
          30% { transform: scale(1.3) translateY(-6px); }
          60% { transform: scale(0.9) translateY(2px); }
          100% { transform: scale(1) translateY(0); }
        }
        @keyframes nv-annSlide {
          0% { opacity: 0; transform: translateY(8px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ======================== DIE VISUAL ========================
function DieVisual({ value }: { value: number }) {
  const [displayVal, setDisplayVal] = useState(value);
  const [isRolling, setIsRolling] = useState(true);

  useEffect(() => {
    setIsRolling(true);
    let frame = 0;
    const interval = setInterval(() => {
      setDisplayVal(Math.floor(Math.random() * 6) + 1);
      frame++;
      if (frame >= 12) {
        clearInterval(interval);
        setDisplayVal(value);
        setIsRolling(false);
      }
    }, 70);
    return () => clearInterval(interval);
  }, [value]);

  const dots: Record<number, [number,number][]> = {
    1: [[1,1]], 2: [[0,2],[2,0]], 3: [[0,2],[1,1],[2,0]],
    4: [[0,0],[0,2],[2,0],[2,2]], 5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
    6: [[0,0],[0,1],[0,2],[2,0],[2,1],[2,2]],
  };
  return (
    <div style={{
      width: "48px", height: "48px", borderRadius: "10px",
      background: "linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.15))",
      border: "2px solid rgba(6,182,212,0.4)",
      boxShadow: isRolling
        ? "0 0 20px rgba(6,182,212,0.4), 0 4px 12px rgba(0,0,0,0.5)"
        : "0 2px 8px rgba(0,0,0,0.4)",
      display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gridTemplateRows: "repeat(3, 1fr)",
      padding: "8px", gap: "2px",
      animation: isRolling ? "nv-diceRoll 0.15s ease infinite" : "nv-diceLand 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      transition: "box-shadow 0.3s",
    }}>
      {Array.from({ length: 9 }).map((_, i) => {
        const r = Math.floor(i / 3), c = i % 3;
        const active = (dots[displayVal] || []).some(([dr,dc]) => dr === r && dc === c);
        return <div key={i} style={{
          borderRadius: "50%",
          background: active ? "#e2e8f0" : "transparent",
          boxShadow: active ? "0 0 6px rgba(255,255,255,0.6)" : "none",
          transition: isRolling ? "none" : "all 0.2s",
        }} />;
      })}
    </div>
  );
}

// ======================== CENTER ACTIONS ========================
function CenterActions({ phase, player, space, prop, gameState, processAction }: {
  phase: string; player: NeuroversePlayer;
  space: import("@/lib/games/adapters/neuroverse-data").BoardSpace;
  prop: PropertyState;
  gameState: import("@/lib/games/adapters/neuroverse").NeuroverseState;
  processAction: (action: import("@/lib/games/types").GameAction) => void;
}) {
  const btn = (label: string, action: () => void, color = "#64748b", uid?: string) => (
    <button key={uid || label} onClick={action} style={{
      padding: "8px 14px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
      background: `linear-gradient(135deg, ${color}20, ${color}08)`,
      border: `1.5px solid ${color}40`, color,
      cursor: "pointer", transition: "all 0.2s",
      width: "100%", textAlign: "center",
    }}
    onMouseEnter={e => {
      e.currentTarget.style.background = `linear-gradient(135deg, ${color}35, ${color}18)`;
      e.currentTarget.style.borderColor = `${color}70`;
      e.currentTarget.style.transform = "scale(1.02)";
    }}
    onMouseLeave={e => {
      e.currentTarget.style.background = `linear-gradient(135deg, ${color}20, ${color}08)`;
      e.currentTarget.style.borderColor = `${color}40`;
      e.currentTarget.style.transform = "scale(1)";
    }}>
      {label}
    </button>
  );

  switch (phase) {
    case "roll":
      if (player.inFirewall) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {player.cred >= 50 && btn("Pay ¢50 to Exit", () => processAction({ type: "exit_firewall", payload: { method: "pay" } }), "#f59e0b")}
            {btn("Roll Doubles", () => processAction({ type: "exit_firewall", payload: { method: "roll" } }), "#3b82f6")}
            {player.heldCards.includes("escape_firewall") && btn("Use Escape Card", () => processAction({ type: "exit_firewall", payload: { method: "card" } }), "#22c55e")}
          </div>
        );
      }
      return btn("Roll Dice", () => processAction({ type: "roll_dice", payload: {} }), "#3b82f6");

    case "choose_die":
      if (!gameState.dice) return null;
      return (
        <div style={{ display: "flex", gap: "6px" }}>
          {btn(`Use ${gameState.dice[0]}`, () => processAction({ type: "choose_die", payload: { die: 0 } }), "#06b6d4", "die-0")}
          {btn(`Use ${gameState.dice[1]}`, () => processAction({ type: "choose_die", payload: { die: 1 } }), "#8b5cf6", "die-1")}
        </div>
      );

    case "resolve_space":
      if (space?.price && !prop?.ownerId) {
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {player.cred >= (space.price || 0) && btn(`Buy ${space.name} (¢${space.price})`, () => processAction({ type: "buy_property", payload: {} }), "#22c55e")}
            {btn("Decline → Auction", () => processAction({ type: "decline_buy", payload: {} }), "#ef4444")}
          </div>
        );
      }
      if (space?.cornerKind === "toll_zone") {
        return (
          <div style={{ display: "flex", gap: "6px" }}>
            {btn("Pay ¢50", () => processAction({ type: "toll_choice", payload: { choice: "pay" } }), "#f59e0b")}
            {btn("Draw SIGNAL", () => processAction({ type: "toll_choice", payload: { choice: "draw" } }), "#a78bfa")}
          </div>
        );
      }
      return btn("Continue", () => processAction({ type: "end_resolve", payload: {} }), "#22c55e");

    case "auction":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {btn(`Bid ¢${(gameState.auction?.highestBid || 0) + 10}`, () => processAction({ type: "auction_bid", payload: { amount: (gameState.auction?.highestBid || 0) + 10 } }), "#f59e0b")}
          {btn("Pass", () => processAction({ type: "auction_pass", payload: {} }), "#64748b")}
        </div>
      );

    case "build": {
      const buildable: number[] = [];
      for (const [color, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
        if (!ids.every(id => gameState.board[id]?.ownerId === player.id)) continue;
        for (const id of ids) {
          if (!gameState.board[id]?.hasMegaframe) buildable.push(id);
        }
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {buildable.map(id => btn(`Build on ${BOARD[id].name}`, () => processAction({ type: "build", payload: { spaceId: id } }), "#06b6d4"))}
          {btn("Skip Build", () => processAction({ type: "skip_build", payload: {} }), "#64748b")}
        </div>
      );
    }

    case "voltage":
      if (player.noVoltageNextTurn || player.voltage <= 0) {
        return btn("Skip Voltage", () => processAction({ type: "skip_voltage", payload: {} }), "#64748b");
      }
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          {player.voltage >= 1 && btn("Reroll (1V)", () => processAction({ type: "spend_voltage", payload: { ability: "reroll" } }), "#a78bfa")}
          {player.voltage >= 2 && btn("Shields Up (2V)", () => processAction({ type: "spend_voltage", payload: { ability: "shields_up" } }), "#a78bfa")}
          {btn("Skip Voltage", () => processAction({ type: "skip_voltage", payload: {} }), "#64748b")}
        </div>
      );

    case "end_turn":
      return btn("End Turn", () => processAction({ type: "end_turn", payload: {} }), "#22c55e");

    default: return null;
  }
}
