// ============================================================
// lib/games/neuroverse-computer-player.ts
// Heuristic-based computer player for Neuroverse (DRIFT rules).
// Evaluates game state and picks the best move to maximize 
// winning chances across all three victory paths.
// ============================================================

import { NeuroverseState, NeuroversePlayer, PropertyState } from "./adapters/neuroverse";
import { BOARD, COLOR_GROUPS, ColorGroup, DATASTREAM_IDS, SERVER_IDS, RENT_TABLE, BUILD_COSTS } from "./adapters/neuroverse-data";
import { GameAction } from "./types";

// --- Helpers ---

function getPlayer(state: NeuroverseState, pid: string): NeuroversePlayer {
  return state.players.find(p => p.id === pid)!;
}

function ownedInGroup(board: PropertyState[], pid: string, group: number[]): number {
  return group.filter(id => board[id]?.ownerId === pid).length;
}

function ownsFullGroup(board: PropertyState[], pid: string, group: number[]): boolean {
  return group.every(id => board[id]?.ownerId === pid);
}

function totalPropertyValue(board: PropertyState[], pid: string): number {
  let total = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i]?.ownerId === pid) total += (BOARD[i]?.price || 0);
  }
  return total;
}

function completedGroupCount(board: PropertyState[], pid: string): number {
  let count = 0;
  for (const ids of Object.values(COLOR_GROUPS)) {
    if (ownsFullGroup(board, pid, ids)) count++;
  }
  return count;
}

function hasMegaframe(board: PropertyState[], pid: string): boolean {
  return board.some((p, i) => p?.ownerId === pid && p.hasMegaframe);
}

// Evaluate how valuable a property is to buy
function propertyBuyScore(state: NeuroverseState, spaceId: number, pid: string): number {
  const space = BOARD[spaceId];
  if (!space || !space.price) return 0;

  let score = 50; // Base desire to buy

  // Check if it's a datastream or server
  if (DATASTREAM_IDS.includes(spaceId)) {
    const ownedDs = DATASTREAM_IDS.filter(id => state.board[id]?.ownerId === pid).length;
    score += 20 + ownedDs * 25; // Datastreams get more valuable in groups
    return score;
  }
  if (SERVER_IDS.includes(spaceId)) {
    const ownedSv = SERVER_IDS.filter(id => state.board[id]?.ownerId === pid).length;
    score += 15 + ownedSv * 30;
    return score;
  }

  // District property — check color group progress
  for (const [color, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
    if (!ids.includes(spaceId)) continue;
    const owned = ownedInGroup(state.board, pid, ids);
    const groupSize = ids.length;

    // Would complete the group?
    if (owned === groupSize - 1) {
      score += 100; // Massive bonus for completing a group
    } else if (owned > 0) {
      score += 30 * owned; // Good to have progress
    }

    // Check if opponents are close to completing this group
    for (const other of state.players) {
      if (other.id === pid) continue;
      const theirOwned = ownedInGroup(state.board, other.id, ids);
      if (theirOwned === groupSize - 1) {
        score += 60; // Block them from completing
      }
    }

    // Cheaper properties = better ROI early game
    if (state.round <= 4) score += Math.max(0, 30 - Math.floor((space.price || 0) / 10));
    break;
  }

  return score;
}

// --- Main Decision Function ---

export function computeOptimalMove(
  state: NeuroverseState,
  playerId: string,
): { action: GameAction; commentary: string | null } {
  const me = getPlayer(state, playerId);
  const phase = state.turnPhase;

  switch (phase) {
    // ─── ROLL ───
    case "roll": {
      if (me.inFirewall) {
        // Pay to get out if we can afford it, otherwise try rolling
        if (me.cred >= 100) {
          return { action: { type: "exit_firewall", payload: { method: "pay" } }, commentary: "Paying to break out." };
        }
        if (me.heldCards.includes("escape_firewall")) {
          return { action: { type: "exit_firewall", payload: { method: "card" } }, commentary: "Using my escape key." };
        }
        return { action: { type: "exit_firewall", payload: { method: "roll" } }, commentary: "Rolling for freedom." };
      }
      return { action: { type: "roll_dice", payload: {} }, commentary: "Let's roll." };
    }

    // ─── CHOOSE DIE ───
    case "choose_die": {
      if (!state.dice) return { action: { type: "choose_die", payload: { die: 0 } }, commentary: null };

      // Evaluate each die by what landing space offers
      let bestDie = 0;
      let bestScore = -Infinity;

      for (let d = 0; d < 2; d++) {
        const landPos = (me.position + state.dice[d]) % BOARD.length;
        const space = BOARD[landPos];
        const prop = state.board[landPos];
        let score = 0;

        // Unowned property we can afford
        if (space?.price && !prop?.ownerId) {
          if (me.cred >= (space.price || 0)) {
            score += propertyBuyScore(state, landPos, playerId) * 1.5;
          } else {
            score += 10; // Can still auction
          }
        }
        // Our own property — safe
        else if (prop?.ownerId === playerId) {
          score += 20;
        }
        // Opponent's property — we'd pay rent
        else if (prop?.ownerId && prop.ownerId !== playerId) {
          // Estimate rent danger
          const rentInfo = RENT_TABLE[landPos];
          if (rentInfo) {
            const baseRent = rentInfo[0] || 0;
            score -= baseRent * 2; // Avoid high-rent spaces
            if (prop.hasMegaframe) score -= 200;
            else if (prop.hasTower) score -= 100;
            else if (prop.nodes > 0) score -= prop.nodes * 30;
          }
        }
        // BOOT UP — collect salary
        else if (space?.cornerKind === "boot_up" || (me.position + state.dice[d]) >= BOARD.length) {
          score += 60; // Pass GO bonus
        }
        // SIGNAL space — usually beneficial
        else if (space?.type === "signal") {
          score += 25;
        }
        // GLITCH space — risky
        else if (space?.type === "glitch") {
          score -= 15;
        }
        // SYSTEM CRASH — avoid!
        else if (space?.cornerKind === "system_crash") {
          score -= 150;
        }
        // TOLL ZONE
        else if (space?.cornerKind === "toll_zone") {
          score -= 10;
        }

        if (score > bestScore) {
          bestScore = score;
          bestDie = d;
        }
      }

      return {
        action: { type: "choose_die", payload: { die: bestDie } },
        commentary: `Moving ${state.dice[bestDie]} spaces.`,
      };
    }

    // ─── RESOLVE SPACE ───
    case "resolve_space": {
      const space = BOARD[me.position];
      const prop = state.board[me.position];

      // Unowned property — buy or decline?
      if (space?.price && !prop?.ownerId) {
        const buyScore = propertyBuyScore(state, me.position, playerId);
        const canAfford = me.cred >= (space.price || 0);
        const keepReserve = me.cred - (space.price || 0);

        // Buy if we can afford it and it's valuable, keeping ≥80 reserve
        if (canAfford && buyScore >= 40 && keepReserve >= 80) {
          return { action: { type: "buy_property", payload: {} }, commentary: `Buying ${space.name}.` };
        }
        // Buy even if tight if it completes a group
        if (canAfford && buyScore >= 100) {
          return { action: { type: "buy_property", payload: {} }, commentary: `Must have ${space.name}!` };
        }
        // Decline — let it go to auction
        return { action: { type: "decline_buy", payload: {} }, commentary: "Sending to auction." };
      }

      // Toll zone
      if (space?.cornerKind === "toll_zone") {
        // Draw SIGNAL card if we have enough cred, otherwise pay
        if (me.cred > 200) {
          return { action: { type: "toll_choice", payload: { choice: "draw" } }, commentary: "Drawing a card." };
        }
        return { action: { type: "toll_choice", payload: { choice: "pay" } }, commentary: "Paying the toll." };
      }

      // Default resolve
      return { action: { type: "end_resolve", payload: {} }, commentary: null };
    }

    // ─── AUCTION ───
    case "auction": {
      if (!state.auction) {
        return { action: { type: "auction_pass", payload: {} }, commentary: "Passing." };
      }

      const auctionSpace = BOARD[state.auction.propertyId];
      const buyScore = propertyBuyScore(state, state.auction.propertyId, playerId);
      const currentBid = state.auction.highestBid || 0;
      const maxWillingToPay = Math.floor((auctionSpace?.price || 0) * (buyScore >= 80 ? 1.2 : 0.8));

      // Don't bid more than we can afford or want to pay
      if (currentBid >= maxWillingToPay || currentBid >= me.cred - 50) {
        return { action: { type: "auction_pass", payload: {} }, commentary: "Too rich for me." };
      }

      // Bid modestly above current
      const bidAmount = Math.min(currentBid + 5 + Math.floor(Math.random() * 15), maxWillingToPay, me.cred - 50);
      if (bidAmount <= currentBid) {
        return { action: { type: "auction_pass", payload: {} }, commentary: "Dropping out." };
      }

      return {
        action: { type: "auction_bid", payload: { amount: bidAmount } },
        commentary: `Bidding ¢${bidAmount}.`,
      };
    }

    // ─── BUILD ───
    case "build": {
      // Find the best buildable space
      let bestBuildId: number | null = null;
      let bestBuildScore = 0;

      for (const [color, ids] of Object.entries(COLOR_GROUPS) as [ColorGroup, number[]][]) {
        if (!ownsFullGroup(state.board, playerId, ids)) continue;

        for (const id of ids) {
          const prop = state.board[id];
          if (prop?.hasMegaframe) continue;

          const costs = BUILD_COSTS[color as ColorGroup];
          if (!costs) continue;

          let cost = 0;
          if (!prop?.hasTower && prop?.nodes === 3) cost = costs[1];
          else if (prop?.hasTower) cost = costs[2];
          else cost = costs[0];

          if (me.cred - cost < 80) continue; // Keep reserve

          // Score: higher rent increase = better
          let score = 30;
          if (prop?.hasTower) score = 80; // Megaframe is big power spike
          else if (prop?.nodes === 3) score = 60; // Tower upgrade
          else score = 20 + (prop?.nodes || 0) * 10;

          // Victory path: DOMINANCE needs a megaframe
          if (!hasMegaframe(state.board, playerId) && prop?.hasTower) score += 50;

          if (score > bestBuildScore) {
            bestBuildScore = score;
            bestBuildId = id;
          }
        }
      }

      if (bestBuildId !== null) {
        return {
          action: { type: "build", payload: { spaceId: bestBuildId } },
          commentary: `Building on ${BOARD[bestBuildId]?.name || "property"}.`,
        };
      }

      return { action: { type: "skip_build", payload: {} }, commentary: "Nothing to build." };
    }

    // ─── VOLTAGE ───
    case "voltage": {
      if (me.noVoltageNextTurn || me.voltage <= 0) {
        return { action: { type: "skip_voltage", payload: {} }, commentary: null };
      }

      // Strategic voltage use:
      // 1. Reroll (1V) — if we just rolled something bad (in firewall, etc)
      // 2. Shields Up (2V) — save for defense when landing on expensive property
      // 3. Hack (3V) — steal unimproved enemy property we're standing on
      // 4. EMP Burst (4V) — downgrade enemy buildings

      // Check for hack opportunity
      if (me.voltage >= 3) {
        const space = BOARD[me.position];
        const prop = state.board[me.position];
        if (prop?.ownerId && prop.ownerId !== playerId && !prop.hasMegaframe && !prop.hasTower && prop.nodes === 0) {
          // Unimproved enemy property — hack it!
          return {
            action: { type: "spend_voltage", payload: { ability: "hack" } },
            commentary: "Hacking this property!",
          };
        }
      }

      // EMP Burst — target the leader's best property
      if (me.voltage >= 4) {
        const leader = state.players
          .filter(p => p.id !== playerId)
          .sort((a, b) => b.cred - a.cred)[0];
        if (leader) {
          const leaderProps = state.board
            .map((p, i) => ({ prop: p, id: i }))
            .filter(x => x.prop?.ownerId === leader.id && (x.prop.hasMegaframe || x.prop.hasTower || x.prop.nodes > 0));
          if (leaderProps.length > 0) {
            return {
              action: { type: "spend_voltage", payload: { ability: "emp_burst" } },
              commentary: "EMP Burst on the leader!",
            };
          }
        }
      }

      // Otherwise save voltage
      return { action: { type: "skip_voltage", payload: {} }, commentary: "Saving voltage." };
    }

    // ─── END TURN ───
    case "end_turn":
      return { action: { type: "end_turn", payload: {} }, commentary: "Done." };

    default:
      return { action: { type: "end_turn", payload: {} }, commentary: null };
  }
}
