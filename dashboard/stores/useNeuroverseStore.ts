// ============================================================
// stores/useNeuroverseStore.ts
// Zustand store for Neuroverse: game lifecycle, turn management,
// 1 human + up to 3 AI agents, commentary bubbles, event log.
// ============================================================

import { create } from "zustand";
import { NeuroverseAdapter, NeuroverseState } from "@/lib/games/adapters/neuroverse";
import { requestNeuroverseMove, getRandomValidAction, NeuroverseAgentResult, clearBriefedSessions } from "@/lib/games/neuroverse-agent-bridge";
import { computeOptimalMove } from "@/lib/games/neuroverse-computer-player";
import { GameAction, GameResult } from "@/lib/games/types";
import { BOARD, NETRUNNERS, NetrunnerId, PinType } from "@/lib/games/adapters/neuroverse-data";

// --- Types ---

export type NeuroverseView = "lobby" | "agent-select" | "playing";

export interface AgentSlot {
  playerId: string;  // "player-2", "player-3", "player-4"
  agentId: string;   // OpenClaw agent ID (e.g. "ivy", "daisy")
  agentName: string;  // Display name
}

export interface CommentaryBubble {
  id: string;
  playerId: string;
  agentName: string;
  text: string;
  timestamp: number;
}

export interface GameEvent {
  id: string;
  timestamp: number;
  round: number;
  text: string;
  playerId?: string;
  type: "move" | "buy" | "rent" | "card" | "build" | "system" | "victory" | "auction";
}

export interface GameAnnouncement {
  id: string;
  text: string;
  detail?: string;
  playerId?: string;
  type: "action" | "phase" | "event" | "thinking";
  timestamp: number;
}

interface NeuroverseStore {
  // View state
  view: NeuroverseView;
  setView: (v: NeuroverseView) => void;

  // Game state
  adapter: NeuroverseAdapter;
  gameState: NeuroverseState | null;
  result: GameResult | null;
  isRunning: boolean;
  isPaused: boolean;

  // Players
  humanPlayerId: string;
  agentSlots: AgentSlot[];
  setAgentSlots: (slots: AgentSlot[]) => void;

  // Pins
  pinAssignments: Record<string, PinType>;
  setPinAssignments: (pins: Record<string, PinType>) => void;

  // Commentary
  commentary: CommentaryBubble[];
  addCommentary: (bubble: CommentaryBubble) => void;
  clearCommentary: () => void;

  // Events
  events: GameEvent[];
  addEvent: (event: Omit<GameEvent, "id" | "timestamp">) => void;

  // Turn control
  turnDelayMs: number;
  setTurnDelay: (ms: number) => void;
  isAgentThinking: boolean;
  currentThinkingAgent: string | null;
  useRealAgents: boolean;
  setUseRealAgents: (v: boolean) => void;

  // Announcements
  announcement: GameAnnouncement | null;
  setAnnouncement: (text: string, type: GameAnnouncement["type"], playerId?: string, detail?: string) => void;
  clearAnnouncement: () => void;

  // Actions
  startGame: (agentSlots: AgentSlot[], gameConfig?: Record<string, unknown>) => void;
  processHumanAction: (action: GameAction) => void;
  processAgentTurn: () => Promise<void>;
  endGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetToLobby: () => void;

  // Internal
  _advanceTurn: () => void;
  _checkAndRunAgentTurn: () => void;
  _processAuctionAgents: () => Promise<void>;
}

// --- Helpers for human-readable announcements ---

function describeAction(
  action: GameAction,
  state: NeuroverseState,
  agentName: string,
  playerId: string,
): string | null {
  const player = state.players.find(p => p.id === playerId);
  const space = player ? BOARD[player.position] : null;

  switch (action.type) {
    case "roll_dice":
      return `${agentName} rolls the dice`;
    case "choose_die": {
      const die = (action.payload as any)?.die ?? 0;
      const val = state.dice ? state.dice[die] : "?";
      return `${agentName} chose die ${val}`;
    }
    case "buy_property":
      return `${agentName} buys ${space?.name || "property"} for ¢${space?.price || "?"}`;
    case "decline_buy":
      return `${agentName} declines to buy → Auction`;
    case "auction_bid": {
      const amt = (action.payload as any)?.amount || "?";
      return `${agentName} bids ¢${amt}`;
    }
    case "auction_pass":
      return `${agentName} passed on auction`;
    case "build": {
      const sid = (action.payload as any)?.spaceId;
      const bSpace = sid != null ? BOARD[sid] : null;
      return `${agentName} builds on ${bSpace?.name || "?"}`;
    }
    case "skip_build":
      return `${agentName} skips building`;
    case "spend_voltage": {
      const ability = (action.payload as any)?.ability || "ability";
      return `${agentName} uses ${ability}`;
    }
    case "skip_voltage":
      return `${agentName} skips voltage`;
    case "end_turn":
      return `${agentName} ends turn`;
    case "exit_firewall": {
      const method = (action.payload as any)?.method || "pay";
      return `${agentName} attempts to exit Firewall (${method})`;
    }
    case "toll_choice": {
      const choice = (action.payload as any)?.choice || "pay";
      return `${agentName} ${choice === "draw" ? "draws a SIGNAL card" : "pays ¢50 toll"}`;
    }
    case "end_resolve":
      return null; // Not interesting enough to announce
    default:
      return null;
  }
}

function humanizeLog(log: string, agentSlots: AgentSlot[], humanPlayerId: string): string {
  // Replace ALL player IDs with display names
  let result = log.replace(new RegExp(humanPlayerId, "g"), "You");
  for (const slot of agentSlots) {
    result = result.replace(new RegExp(slot.playerId, "g"), slot.agentName);
  }
  return result;
}

const adapter = new NeuroverseAdapter();

export const useNeuroverseStore = create<NeuroverseStore>((set, get) => ({
  view: "lobby",
  setView: (v) => set({ view: v }),

  adapter,
  gameState: null,
  result: null,
  isRunning: false,
  isPaused: false,

  humanPlayerId: "player-1",
  agentSlots: [],
  setAgentSlots: (slots) => set({ agentSlots: slots }),

  pinAssignments: {},
  setPinAssignments: (pins) => set({ pinAssignments: pins }),

  commentary: [],
  addCommentary: (bubble) => set(s => ({
    commentary: [...s.commentary.slice(-10), bubble],
  })),
  clearCommentary: () => set({ commentary: [] }),

  events: [],
  addEvent: (event) => set(s => ({
    events: [...s.events, {
      ...event,
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }],
  })),

  turnDelayMs: 1500,
  setTurnDelay: (ms) => set({ turnDelayMs: ms }),
  isAgentThinking: false,
  currentThinkingAgent: null,
  useRealAgents: true,
  setUseRealAgents: (v) => set({ useRealAgents: v }),

  announcement: null,
  setAnnouncement: (text, type, playerId, detail) => set({
    announcement: {
      id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      text, type, playerId, detail,
      timestamp: Date.now(),
    },
  }),
  clearAnnouncement: () => set({ announcement: null }),

  startGame: (agentSlots, gameConfig) => {
    const playerCount = 1 + agentSlots.length; // 1 human + N agents
    const state = adapter.createInitialState({ playerCount, ...gameConfig });

    // Store pin assignments
    const pins = (gameConfig?.pinAssignments as Record<string, PinType>) || {};

    // Reassign netrunner names for display
    const events: GameEvent[] = [];
    state.players.forEach((p, i) => {
      const runner = NETRUNNERS.find(r => r.id === p.netrunner);
      events.push({
        id: `init-${i}`,
        timestamp: Date.now(),
        round: 1,
        text: `${i === 0 ? "You" : agentSlots[i - 1]?.agentName || `Agent ${i}`} assigned ${runner?.name || p.netrunner}`,
        playerId: p.id,
        type: "system",
      });
    });

    set({
      gameState: state,
      agentSlots,
      pinAssignments: pins,
      result: null,
      isRunning: true,
      isPaused: false,
      view: "playing",
      events,
      commentary: [],
      isAgentThinking: false,
      currentThinkingAgent: null,
    });

    // If first player is human, wait for input. If agent, start their turn.
    const firstPlayer = state.turnOrder[state.activePlayerIndex];
    if (firstPlayer !== "player-1") {
      setTimeout(() => get()._checkAndRunAgentTurn(), 500);
    }
  },

  processHumanAction: (action) => {
    const { gameState, adapter, humanPlayerId, agentSlots } = get();
    if (!gameState || !get().isRunning) return;

    const validation = adapter.validateAction(gameState, humanPlayerId, action);
    if (!validation.valid) {
      console.warn("[Neuroverse] Invalid human action:", (validation as any).reason);
      return;
    }

    const { newState, nextActivePlayerId } = adapter.applyAction(gameState, humanPlayerId, action);

    // Log events from game log diff
    const newLogs = newState.gameLog.slice(gameState.gameLog.length);
    for (const log of newLogs) {
      get().addEvent({
        round: newState.round,
        text: humanizeLog(log, agentSlots, humanPlayerId),
        playerId: humanPlayerId,
        type: log.includes("bought") ? "buy" : log.includes("rent") ? "rent" : log.includes("drew") ? "card" : log.includes("built") ? "build" : "move",
      });
    }

    const result = adapter.checkResult(newState);
    set({
      gameState: newState,
      result,
      isRunning: !result,
    });

    if (result) {
      get().addEvent({
        round: newState.round,
        text: humanizeLog(result.reason, agentSlots, humanPlayerId),
        type: "victory",
      });
      return;
    }

    // If it's still the human's turn (multi-phase), wait for next input
    // BUT if we're in auction, we need to cycle AI agents through their bid/pass
    if (nextActivePlayerId === humanPlayerId && newState.turnPhase !== "auction") return;

    // ─── Auction Agent Cycling ───
    if (newState.turnPhase === "auction" && newState.auction) {
      // Run all AI agent auction decisions
      setTimeout(() => get()._processAuctionAgents(), 400);
      return;
    }

    // Otherwise, start agent turn after delay
    setTimeout(() => get()._checkAndRunAgentTurn(), get().turnDelayMs);
  },

  processAgentTurn: async () => {
    const { gameState, adapter, agentSlots, humanPlayerId } = get();
    if (!gameState || !get().isRunning || get().isPaused) return;

    const activePlayerId = gameState.turnOrder[gameState.activePlayerIndex];
    if (activePlayerId === humanPlayerId) return; // Not agent's turn

    const slot = agentSlots.find(s => s.playerId === activePlayerId);
    if (!slot) {
      console.error("[Neuroverse] No agent slot for", activePlayerId);
      return;
    }

    set({ isAgentThinking: true, currentThinkingAgent: slot.agentName });
    get().setAnnouncement(`${slot.agentName}'s turn`, "phase", activePlayerId);
    await new Promise(r => setTimeout(r, 600));

    try {
      // Keep processing phases until it's no longer this agent's turn
      let currentState = gameState;
      let iterations = 0;
      const MAX_ITERATIONS = 20; // Safety valve

      while (iterations < MAX_ITERATIONS) {
        iterations++;
        // Safety: stop if game was reset/exited
        if (!get().isRunning) break;
        const currentActiveId = currentState.turnOrder[currentState.activePlayerIndex];
        if (currentActiveId !== activePlayerId) break;

        // Show thinking announcement for current phase
        const phaseLabel = currentState.turnPhase.replace(/_/g, " ");
        get().setAnnouncement(`${slot.agentName} thinking...`, "thinking", activePlayerId, phaseLabel);

        let result: NeuroverseAgentResult;

        if (get().useRealAgents) {
          // Real AI agent — send prompt to gateway
          result = await requestNeuroverseMove(
            currentState,
            activePlayerId,
            slot.agentId,
            slot.agentName,
          );
        } else {
          // Computer player — local heuristic
          await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
          const computed = computeOptimalMove(currentState, activePlayerId);
          result = {
            action: computed.action,
            commentary: computed.commentary,
            source: "computer",
          };
        }

        // Show commentary bubble
        if (result.commentary) {
          get().addCommentary({
            id: `cmt-${Date.now()}`,
            playerId: activePlayerId,
            agentName: slot.agentName,
            text: result.commentary,
            timestamp: Date.now(),
          });
        }

        // Validate and apply
        const validation = adapter.validateAction(currentState, activePlayerId, result.action);
        const actionToApply = validation.valid
          ? result.action
          : getRandomValidAction(currentState, activePlayerId);

        // Announce the action before applying
        const actionAnn = describeAction(actionToApply, currentState, slot.agentName, activePlayerId);
        if (actionAnn) {
          get().setAnnouncement(actionAnn, "action", activePlayerId);
          await new Promise(r => setTimeout(r, 800));
        }

        const { newState, nextActivePlayerId } = adapter.applyAction(
          currentState,
          activePlayerId,
          actionToApply,
        );

        // Announce events from game log diff (rent, card draws, etc.)
        const newLogs2 = newState.gameLog.slice(currentState.gameLog.length);
        for (const logMsg of newLogs2) {
          // Skip generic entries already covered by the action announcement
          if (!logMsg.includes("rolled") && !logMsg.includes("moved")) {
            get().setAnnouncement(humanizeLog(logMsg, agentSlots, humanPlayerId), "event", activePlayerId);
            await new Promise(r => setTimeout(r, 600));
          }
        }

        // Log events
        const newLogs = newState.gameLog.slice(currentState.gameLog.length);
        for (const log of newLogs) {
          get().addEvent({
            round: newState.round,
            text: humanizeLog(log, agentSlots, humanPlayerId),
            playerId: activePlayerId,
            type: log.includes("bought") ? "buy" : log.includes("rent") ? "rent" : log.includes("drew") ? "card" : log.includes("built") ? "build" : "move",
          });
        }

        // Check game end
        const gameResult = adapter.checkResult(newState);
        if (gameResult) {
          set({
            gameState: newState,
            result: gameResult,
            isRunning: false,
            isAgentThinking: false,
            currentThinkingAgent: null,
          });
          get().addEvent({
            round: newState.round,
            text: humanizeLog(gameResult.reason, agentSlots, humanPlayerId),
            type: "victory",
          });
          return;
        }

        currentState = newState;
        set({ gameState: newState });

        // If an auction started from this agent's decline, delegate to multi-round auction handler
        if (currentState.turnPhase === "auction" && currentState.auction) {
          set({ gameState: currentState, isAgentThinking: false, currentThinkingAgent: null, announcement: null });
          await get()._processAuctionAgents();
          return; // _processAuctionAgents handles resuming after auction
        }

        // Small delay between agent sub-actions for visual feedback
        if (nextActivePlayerId === activePlayerId) {
          await new Promise(r => setTimeout(r, 400));
        }
      }
    } catch (err) {
      console.error("[Neuroverse] Agent turn error:", err);
      // Apply fallback
      const fallbackAction = getRandomValidAction(get().gameState!, activePlayerId);
      const { newState } = adapter.applyAction(get().gameState!, activePlayerId, fallbackAction);
      set({ gameState: newState });
    }

    set({ isAgentThinking: false, currentThinkingAgent: null, announcement: null });

    // Check if next player is also an agent
    setTimeout(() => get()._checkAndRunAgentTurn(), get().turnDelayMs);
  },

  _advanceTurn: () => {
    // Called internally after a full turn completes
    setTimeout(() => get()._checkAndRunAgentTurn(), get().turnDelayMs);
  },

  // Auto-cycle all AI agents through auction bid/pass (multi-round)
  _processAuctionAgents: async () => {
    const { adapter, agentSlots, humanPlayerId } = get();
    let currentState = get().gameState;
    if (!currentState || !get().isRunning || currentState.turnPhase !== "auction" || !currentState.auction) return;

    // Loop until auction resolves or human needs to act
    while (currentState.auction && currentState.turnPhase === "auction" && get().isRunning) {
      let anyAgentActed = false;

      for (const slot of agentSlots) {
        if (!get().isRunning || !currentState.auction) break;

        // Skip agents who have already passed (they're out)
        if (currentState.auction.passed.includes(slot.playerId)) continue;

        get().setAnnouncement(`${slot.agentName} deciding...`, "thinking", slot.playerId, "auction");
        
        let action: GameAction;
        let commentary: string | null = null;

        if (get().useRealAgents) {
          const result = await requestNeuroverseMove(currentState, slot.playerId, slot.agentId, slot.agentName);
          action = result.action;
          commentary = result.commentary;
        } else {
          await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
          const computed = computeOptimalMove(currentState, slot.playerId);
          action = computed.action;
          commentary = computed.commentary;
        }

        if (commentary) {
          get().addCommentary({ id: `cmt-${Date.now()}`, playerId: slot.playerId, agentName: slot.agentName, text: commentary, timestamp: Date.now() });
        }

        const validation = adapter.validateAction(currentState, slot.playerId, action);
        const actionToApply = validation.valid ? action : getRandomValidAction(currentState, slot.playerId);
        const { newState } = adapter.applyAction(currentState, slot.playerId, actionToApply);

        const newLogs = newState.gameLog.slice(currentState.gameLog.length);
        for (const log of newLogs) {
          get().addEvent({ round: newState.round, text: humanizeLog(log, agentSlots, humanPlayerId), playerId: slot.playerId, type: "auction" });
        }

        currentState = newState;
        set({ gameState: currentState });
        anyAgentActed = true;

        await new Promise(r => setTimeout(r, 300));
      }

      // If auction resolved after agents acted, break
      if (!currentState.auction || currentState.turnPhase !== "auction") break;

      // Check if human needs to act
      const humanIsHighest = currentState.auction.highestBidder === humanPlayerId;
      const humanHasPassed = currentState.auction.passed.includes(humanPlayerId);
      
      if (!humanHasPassed && !humanIsHighest) {
        set({ announcement: null });
        return; // Wait for human input — after human acts, processHumanAction will call us again
      }

      // If no agent acted this cycle (all passed), and human doesn't need to act, 
      // but auction is still somehow open (shouldn't happen), break safety loop
      if (!anyAgentActed) break;
    }

    set({ announcement: null });

    // Auction resolved — continue normal flow
    if (currentState.turnPhase !== "auction") {
      const activeId = currentState.turnOrder[currentState.activePlayerIndex];
      if (activeId !== humanPlayerId) {
        setTimeout(() => get().processAgentTurn(), get().turnDelayMs);
      }
    }
  },

  _checkAndRunAgentTurn: () => {
    const { gameState, humanPlayerId, isRunning, isPaused } = get();
    if (!gameState || !isRunning || isPaused) return;

    const activePlayerId = gameState.turnOrder[gameState.activePlayerIndex];
    if (activePlayerId !== humanPlayerId) {
      get().processAgentTurn();
    }
  },

  endGame: () => set({ isRunning: false }),

  pauseGame: () => set({ isPaused: true }),

  resumeGame: () => {
    set({ isPaused: false });
    get()._checkAndRunAgentTurn();
  },

  resetToLobby: () => {
    clearBriefedSessions();
    set({
      view: "lobby",
      gameState: null,
      result: null,
      announcement: null,
      isRunning: false,
      isPaused: false,
      agentSlots: [],
      events: [],
      commentary: [],
      isAgentThinking: false,
      currentThinkingAgent: null,
    });
  },
}));
