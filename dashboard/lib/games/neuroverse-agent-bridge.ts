// ============================================================
// lib/games/neuroverse-agent-bridge.ts
// Ultra-compact prompt builder + response parser for Neuroverse.
// Sends game state to AI agents via OpenClaw gateway.
// Session key: agent:{agentId}:ngames-neuroverse
// ============================================================

import { getGateway } from "@/lib/openclawGateway";
import { NeuroverseState, NeuroversePlayer, PropertyState } from "./adapters/neuroverse";
import { BOARD, COLOR_GROUPS, ColorGroup, NETRUNNERS, NetrunnerId } from "./adapters/neuroverse-data";
import { GameAction } from "./types";

// --- Rules Briefing (sent once per session) ---

export function buildRulesBriefing(agentName: string, netrunnerName: string): string {
  return `You are ${agentName}, playing NEUROVERSE — a cyberpunk Monopoly-style board game.

RULES SUMMARY:
- 28-space board loop. Roll 2 dice, CHOOSE one die for movement.
- Land on unowned property → BUY or DECLINE (triggers auction for all players).
- Land on owned property → pay rent to owner.
- Own all properties in a color group (Sector Lock) → can BUILD: Nodes→Tower→Megaframe.
- Corners: BOOT UP (salary ¢200+1V), FIREWALL (jail), TOLL ZONE (pay ¢50 or draw card), SYSTEM CRASH (go to Firewall).
- GLITCH spaces = disruptive cards. SIGNAL spaces = helpful cards.
- Voltage (V): second resource. Earn from passing Boot Up, doubles, completing groups.
- Victory: (1) DOMINANCE = own ¢800+ in properties + 1 Megaframe, (2) CONTROL = own 2+ complete color groups, (3) SCORE = highest Grid Score when rounds end.
- Bankruptcy = Reboot (¢250 + shield), not elimination.

YOUR NETRUNNER: ${netrunnerName}

RESPONSE FORMAT — ALWAYS reply with exactly one line:
ACTION|params|your one-sentence quip

Examples:
  ROLL||Let's see what the grid gives me
  CHOOSE|0|Going with the safe bet
  BUY||This district is mine
  DECLINE||Too expensive right now
  BID|85|I want this property
  PASS||Not worth it
  BUILD|5|Time to develop
  SKIP||Saving my credits
  END||Your move

IMPORTANT: First word must be the action keyword. Use | as separator. Keep quip to ONE short sentence.`;
}

// --- Per-Turn Prompt Builder ---

function abbrevRunner(id: string): string {
  const r = NETRUNNERS.find(n => n.id === id);
  return r ? r.name : id.toUpperCase();
}

function netrunnerInfo(id: NetrunnerId): string {
  const info: Record<string, string> = {
    ghost: "Passive:peek cards when passing GLITCH/SIGNAL. Active:Vanish(skip move,1x/game)",
    cipher: "Passive:¢250 salary instead of ¢200. Active:Market Crash(all pay ¢50,1x/game)",
    nova: "Passive:20% off building costs. Active:Overclock(free Node,1x/game)",
    glitch_char: "Passive:opponents lose 1V when you pay rent. Active:System Wipe(discard their cards,1x/game)",
    proxy: "Passive:buy properties at 80% price. Active:Hostile Takeover(force-buy their property,1x/game)",
    echo: "Passive:swap GLITCH→SIGNAL cards. Active:Reverb(copy another passive,3 rounds,1x/game)",
  };
  return info[id] || "";
}

function buildBoardSummary(board: PropertyState[], players: NeuroversePlayer[], agentName: string, playerId: string): string {
  const lines: string[] = [];
  for (const p of players) {
    const owned: string[] = [];
    for (let i = 0; i < board.length; i++) {
      if (board[i]?.ownerId !== p.id) continue;
      const sp = BOARD[i];
      let tag = sp.name;
      const pr = board[i];
      if (pr.hasMegaframe) tag += "(MF)";
      else if (pr.hasTower) tag += "(T)";
      else if (pr.nodes > 0) tag += `(${pr.nodes}N)`;
      owned.push(tag);
    }

    const isMe = p.id === playerId;
    const label = isMe ? `★ ${agentName}(you)` : `${abbrevRunner(p.netrunner)}`;
    const status = [
      `¢${p.cred}`,
      `V${p.voltage}`,
      `pos=${p.position}(${BOARD[p.position]?.name || "?"})`,
    ];
    if (p.inFirewall) status.push("IN_FIREWALL");
    if (p.rebootShield) status.push("SHIELDED");

    const propsStr = owned.length > 0 ? owned.join(", ") : "none";
    lines.push(`${label}: ${status.join(" ")} | owns: ${propsStr}`);
  }
  return lines.join("\n");
}

function completedGroupsList(board: PropertyState[], playerId: string): string {
  const groups: string[] = [];
  for (const [color, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
    const owned = ids.filter(id => board[id]?.ownerId === playerId).length;
    if (owned === ids.length) groups.push(`${color}(✓)`);
    else if (owned > 0) groups.push(`${color}(${owned}/${ids.length})`);
  }
  return groups.length ? groups.join(", ") : "none";
}

function buildActions(state: NeuroverseState, playerId: string): string {
  const p = state.players.find(pp => pp.id === playerId);
  if (!p) return "";
  const phase = state.turnPhase;

  switch (phase) {
    case "roll":
      if (p.inFirewall) return "Actions: EXIT_FW pay(¢50) | EXIT_FW roll(attempt doubles) | EXIT_FW card(if held)";
      return "Actions: ROLL (roll both dice)";
    case "choose_die":
      if (!state.dice) return "Actions: CHOOSE|0 or CHOOSE|1";
      return `Actions: CHOOSE|0 (move ${state.dice[0]} spaces) | CHOOSE|1 (move ${state.dice[1]} spaces)`;
    case "resolve_space": {
      const sp = BOARD[p.position];
      const prop = state.board[p.position];
      if (sp?.price && !prop?.ownerId) {
        const cost = p.netrunner === "proxy" ? Math.floor((sp.price || 0) * 0.8 / 5) * 5 : sp.price;
        return `Actions: BUY (${sp.name} for ¢${cost}, you have ¢${p.cred}) | DECLINE (send to auction)`;
      }
      if (sp?.cornerKind === "toll_zone") return "Actions: TOLL pay(¢50) | TOLL draw(SIGNAL card)";
      return "Actions: OK (continue)";
    }
    case "auction": {
      const hi = state.auction?.highestBid || 0;
      const minBid = hi + 5;
      return `Actions: BID|amount (min ¢${minBid}, you have ¢${p.cred}) | PASS (drop out of auction)`;
    }
    case "build": {
      const buildable: string[] = [];
      for (const [color, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
        if (!ids.every(id => state.board[id]?.ownerId === playerId)) continue;
        for (const id of ids) {
          const prop = state.board[id];
          if (!prop?.hasMegaframe) buildable.push(`BUILD|${id}(${BOARD[id].name})`);
        }
      }
      if (buildable.length) return `Actions: ${buildable.join(" | ")} | SKIP`;
      return "Actions: SKIP (no buildable properties)";
    }
    case "voltage":
      if (p.noVoltageNextTurn || p.voltage <= 0) return "Actions: SKIP";
      return `Actions: VOLT|reroll(1V) | VOLT|boost(1V) | VOLT|shields_up(2V) | VOLT|hack(3V) | VOLT|surge(2V) | VOLT|scramble(1V) | VOLT|emp_burst(4V) | SKIP — you have ${p.voltage}V`;
    case "end_turn":
      return "Actions: END";
    default:
      return "Actions: END";
  }
}

/**
 * Build per-turn prompt. Readable but token-efficient (~200-350 tokens).
 */
export function buildNeuroversePrompt(
  state: NeuroverseState,
  playerId: string,
  agentName: string,
): string {
  const me = state.players.find(p => p.id === playerId)!;
  const runner = abbrevRunner(me.netrunner);

  let prompt = `=== NEUROVERSE R${state.round}/${state.maxRounds} ===\n`;
  prompt += `Phase: ${state.turnPhase.replace(/_/g, " ").toUpperCase()}\n`;

  // Dice if rolled
  if (state.dice) prompt += `Dice: [${state.dice[0]}, ${state.dice[1]}]\n`;

  // All players
  prompt += `\n--- PLAYERS ---\n`;
  prompt += buildBoardSummary(state.board, state.players, agentName, playerId);
  prompt += `\n`;

  // My color group progress
  prompt += `\nYour groups: ${completedGroupsList(state.board, playerId)}`;
  prompt += `\nYour runner: ${runner} — ${netrunnerInfo(me.netrunner)}\n`;

  // Auction context
  if (state.auction) {
    const aSpace = BOARD[state.auction.propertyId];
    prompt += `\nAUCTION: ${aSpace?.name || "?"} (¢${aSpace?.price || "?"}) — highest bid: ¢${state.auction.highestBid} by ${state.auction.highestBidder || "none"}, passed: [${state.auction.passed.join(",")}]\n`;
  }

  // Card drawn
  if (state.lastCardDrawn) prompt += `Card drawn: ${state.lastCardDrawn.name} — ${state.lastCardDrawn.description}\n`;

  // Available actions
  prompt += `\n${buildActions(state, playerId)}\n`;

  // Response instruction
  prompt += `\nReply: ACTION|params|quip (one sentence, be ${agentName}). Play to WIN.`;

  return prompt;
}

// --- Response Parser ---

export interface NeuroverseAgentResult {
  action: GameAction;
  commentary: string | null;
  source: "agent" | "fallback" | "computer";
}

/**
 * Parse agent response: "BUY||Nice district!" or "CHOOSE|1|Let's go far"
 */
export function parseNeuroverseResponse(
  text: string,
  state: NeuroverseState,
  playerId: string,
): { action: GameAction; commentary: string | null } | null {
  try {
    const clean = text.replace(/```[a-z]*\n?/g, "").replace(/```/g, "").trim();

    // Try pipe-delimited format: ACTION|params|quip
    const lines = clean.split("\n");
    for (const line of lines) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.startsWith(">")) continue;

      // Normalize ACTION:COMMAND format → ACTION|COMMAND (colon → pipe)
      // Matches: "ACTION:PASS", "ACTION:BUY", "ACTION:ROLL", etc.
      trimmed = trimmed.replace(/^ACTION\s*[:]\.?\s*/i, "ACTION|");

      // Look for action keywords
      const upper = trimmed.toUpperCase();
      const parts = trimmed.split("|").map(s => s.trim());
      let actionWord = parts[0]?.toUpperCase().replace(/[^A-Z_]/g, "");
      let params = parts[1] || "";
      // Handle "ACTION|ACTUAL_COMMAND|params|quip" format
      if (actionWord === "ACTION" && parts.length >= 2) {
        actionWord = parts[1]?.toUpperCase().replace(/[^A-Z_0-9]/g, "") || "SKIP";
        params = parts[2] || "";
        const rawQuip = parts.length >= 4 ? parts.slice(3).join("|").trim() : null;
        var quip: string | null = rawQuip && rawQuip.length > 0 ? rawQuip : null;
      } else {
        // Quip is ONLY text after the second pipe — never include ACTION or params
        const rawQuip = parts.length >= 3 ? parts.slice(2).join("|").trim() : null;
        var quip: string | null = rawQuip && rawQuip.length > 0 ? rawQuip : null;
      }

      switch (actionWord) {
        case "ROLL":
          return { action: { type: "roll_dice", payload: {} }, commentary: quip };
        case "CHOOSE": {
          const die = parseInt(params) || 0;
          return { action: { type: "choose_die", payload: { die } }, commentary: quip };
        }
        case "BUY":
          return { action: { type: "buy_property", payload: {} }, commentary: quip };
        case "DECLINE":
          return { action: { type: "decline_buy", payload: {} }, commentary: quip };
        case "BID": {
          const amount = parseInt(params) || 5;
          return { action: { type: "auction_bid", payload: { amount } }, commentary: quip };
        }
        case "PASS":
          return { action: { type: "auction_pass", payload: {} }, commentary: quip };
        case "BUILD": {
          const spaceId = parseInt(params);
          if (!isNaN(spaceId)) return { action: { type: "build", payload: { spaceId } }, commentary: quip };
          return { action: { type: "skip_build", payload: {} }, commentary: quip };
        }
        case "SKIP":
          if (state.turnPhase === "build") return { action: { type: "skip_build", payload: {} }, commentary: quip };
          if (state.turnPhase === "voltage") return { action: { type: "skip_voltage", payload: {} }, commentary: quip };
          return { action: { type: "end_turn", payload: {} }, commentary: quip };
        case "VOLT": {
          const ability = params.toLowerCase() || "reroll";
          return { action: { type: "spend_voltage", payload: { ability } }, commentary: quip };
        }
        case "END":
          return { action: { type: "end_turn", payload: {} }, commentary: quip };
        case "OK":
          return { action: { type: "end_resolve", payload: {} }, commentary: quip };
        case "TOLL": {
          const choice = params.toLowerCase().includes("draw") ? "draw" : "pay";
          return { action: { type: "toll_choice", payload: { choice } }, commentary: quip };
        }
        case "EXIT_FW":
        case "EXIT": {
          const method = params.toLowerCase().includes("card") ? "card" :
                         params.toLowerCase().includes("roll") ? "roll" : "pay";
          return { action: { type: "exit_firewall", payload: { method } }, commentary: quip };
        }
      }
    }

    // Fallback: extract any action keyword from free text — never use raw text as commentary
    const textUpper = clean.toUpperCase();
    if (textUpper.includes("BUY")) return { action: { type: "buy_property", payload: {} }, commentary: null };
    if (textUpper.includes("DECLINE")) return { action: { type: "decline_buy", payload: {} }, commentary: null };
    if (textUpper.includes("ROLL")) return { action: { type: "roll_dice", payload: {} }, commentary: null };
    if (textUpper.includes("PASS") || textUpper.includes("NO BID") || textUpper.includes("NO_BID")) {
      return { action: { type: "auction_pass", payload: {} }, commentary: null };
    }
    if (textUpper.includes("BID")) return { action: { type: "auction_bid", payload: { amount: 5 } }, commentary: null };
    if (textUpper.includes("SKIP")) {
      if (state.turnPhase === "build") return { action: { type: "skip_build", payload: {} }, commentary: null };
      return { action: { type: "skip_voltage", payload: {} }, commentary: null };
    }
    if (textUpper.includes("END")) return { action: { type: "end_turn", payload: {} }, commentary: null };

    return null;
  } catch {
    return null;
  }
}

/**
 * Get a fallback random valid action for the current phase.
 */
export function getRandomValidAction(state: NeuroverseState, playerId: string): GameAction {
  const p = state.players.find(pp => pp.id === playerId);
  if (!p) return { type: "end_turn", payload: {} };

  switch (state.turnPhase) {
    case "roll":
      if (p.inFirewall) return { type: "exit_firewall", payload: { method: "pay" } };
      return { type: "roll_dice", payload: {} };
    case "choose_die":
      return { type: "choose_die", payload: { die: Math.random() < 0.5 ? 0 : 1 } };
    case "resolve_space": {
      const sp = BOARD[p.position];
      const prop = state.board[p.position];
      if (sp?.price && !prop?.ownerId && p.cred >= (sp.price || 0)) {
        return { type: "buy_property", payload: {} };
      }
      if (sp?.price && !prop?.ownerId) return { type: "decline_buy", payload: {} };
      if (sp?.cornerKind === "toll_zone") return { type: "toll_choice", payload: { choice: "pay" } };
      return { type: "end_resolve", payload: {} };
    }
    case "auction":
      return { type: "auction_pass", payload: {} };
    case "build":
      return { type: "skip_build", payload: {} };
    case "voltage":
      return { type: "skip_voltage", payload: {} };
    case "end_turn":
      return { type: "end_turn", payload: {} };
    default:
      return { type: "end_turn", payload: {} };
  }
}

// --- Gateway Communication ---

function extractContent(val: unknown): string {
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .filter((b: any) => b.type === "text" || typeof b === "string")
      .map((b: any) => (typeof b === "string" ? b : b.text || ""))
      .join("");
  }
  return "";
}

// Track which sessions have received the rules briefing
const briefedSessions = new Set<string>();

/** Clear all briefed sessions (call on game reset) */
export function clearBriefedSessions() {
  briefedSessions.clear();
}

/**
 * Send game state to an agent and get their action back.
 * Auto-sends rules briefing on first contact per session.
 * Uses session: agent:{agentId}:ngames-neuroverse
 */
export async function requestNeuroverseMove(
  state: NeuroverseState,
  playerId: string,
  agentId: string,
  agentName: string,
  timeoutMs = 35000,
): Promise<NeuroverseAgentResult> {
  const gw = getGateway();

  if (!gw.isConnected) {
    return {
      action: getRandomValidAction(state, playerId),
      commentary: null,
      source: "fallback",
    };
  }

  const sessionKey = `agent:${agentId}:ngames-neuroverse`;

  // Auto-send rules briefing on first contact
  if (!briefedSessions.has(sessionKey)) {
    briefedSessions.add(sessionKey);
    const me = state.players.find(p => p.id === playerId);
    const runner = NETRUNNERS.find(n => n.id === me?.netrunner);
    const briefing = buildRulesBriefing(agentName, runner?.name || "Unknown");
    try {
      await gw.request("chat.send", {
        sessionKey,
        message: briefing,
        idempotencyKey: crypto.randomUUID(),
      });
      // Wait for briefing to be processed
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.warn("[NV-Bridge] Failed to send rules briefing:", e);
    }
  }

  const prompt = buildNeuroversePrompt(state, playerId, agentName);

  try {
    const sendResult = await gw.request("chat.send", {
      sessionKey,
      message: prompt,
      idempotencyKey: crypto.randomUUID(),
    });

    const runId = sendResult?.runId;
    console.log("[NV-Bridge] sent to", agentId, "runId:", runId);

    const responseText = await new Promise<string>((resolve, reject) => {
      let chatText = "";
      let agentText = "";
      let resolved = false;

      const best = () => agentText.length >= chatText.length ? agentText : chatText;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          unsubChat();
          unsubAgent();
          const t = best();
          resolve(t || "");
        }
      }, timeoutMs);

      const done = (finalText: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        unsubChat();
        unsubAgent();
        resolve(finalText);
      };

      const unsubChat = gw.on("chat", (p: any) => {
        const pRunId = p?.runId ?? p?.requestId;
        if (runId && pRunId && pRunId !== runId) return;

        if (p.text) {
          const s = extractContent(p.text);
          if (s.length >= chatText.length) chatText = s;
        } else if (p.delta) {
          chatText += extractContent(p.delta);
        }
        if (p.message?.content) {
          const s = extractContent(p.message.content);
          if (s.length > chatText.length) chatText = s;
        }

        const isDone = p?.state === "done" || p?.state === "stop" || p?.state === "complete" ||
          p?.state === "end" || p?.type === "done" || p?.type === "message_end" ||
          p?.done === true || p?.finished === true;

        if (isDone) {
          const t = best();
          if (t) done(t);
        }
      });

      const unsubAgent = gw.on("agent", (p: any) => {
        const pRunId = p?.runId;
        if (runId && pRunId && pRunId !== runId) return;

        if (p.stream === "assistant" && (p.data?.text || p.data?.delta)) {
          const s = p.data.text || p.data.delta;
          if (s.length >= agentText.length) agentText = s;
        }

        if (p.stream === "lifecycle" && p.data?.phase === "end") {
          const t = best();
          if (t) done(t);
        }
      });
    });

    const parsed = parseNeuroverseResponse(responseText, state, playerId);
    if (parsed) {
      console.log("[NV-Bridge] ✅", parsed.action.type, "Say:", parsed.commentary);
      return { action: parsed.action, commentary: parsed.commentary, source: "agent" };
    }

    console.warn("[NV-Bridge] ❌ Parse failed. Raw:", responseText.slice(0, 300));
    return {
      action: getRandomValidAction(state, playerId),
      commentary: responseText.slice(0, 100) || null,
      source: "fallback",
    };
  } catch (err) {
    console.error("[NV-Bridge] Error:", err);
    return {
      action: getRandomValidAction(state, playerId),
      commentary: null,
      source: "fallback",
    };
  }
}
