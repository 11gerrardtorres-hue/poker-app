const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

const STARTING_CHIPS = 10000;
const SMALL_BLIND = 100;
const BIG_BLIND = 200;
const NEXT_HAND_DELAY_MS = 3000;

const rankValues = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7,
  "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14
};

const valueNames = {
  14: "A", 13: "K", 12: "Q", 11: "J", 10: "10",
  9: "9", 8: "8", 7: "7", 6: "6", 5: "5", 4: "4", 3: "3", 2: "2"
};

const rooms = new Map();
const socketRoomMap = new Map();

function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoomState(roomCode) {
  return {
    roomCode,
    players: [],
    deck: [],
    community: ["", "", "", "", ""],
    pot: 0,
    currentBet: 0,
    currentTurnIndex: 0,
    street: "대기중",
    result: "",
    lastWinnerNames: [],
    bettingOpen: false,
    dealerIndex: -1,
    nextHandTimeout: null,
    lastFullRaiseSize: BIG_BLIND,
    actionLogs: [],
    mustActIds: [],
    canRaiseIds: []
  };
}

function getRoom(roomCode) {
  return rooms.get(roomCode);
}

function getRoomBySocket(socketId) {
  const roomCode = socketRoomMap.get(socketId);
  if (!roomCode) return null;
  return rooms.get(roomCode) || null;
}

function clearNextHandTimeout(room) {
  if (room.nextHandTimeout) {
    clearTimeout(room.nextHandTimeout);
    room.nextHandTimeout = null;
  }
}

function createDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  const d = [];
  for (const s of suits) {
    for (const r of ranks) d.push(`${r}${s}`);
  }
  return d;
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function getPlayerIndexById(room, id) {
  return room.players.findIndex((p) => p.id === id);
}

function getPlayerById(room, id) {
  return room.players.find((p) => p.id === id);
}

function playersWithChips(room) {
  return room.players.filter((p) => p.chips > 0);
}

function canStartAnotherHand(room) {
  return playersWithChips(room).length >= 2;
}

function activePlayers(room) {
  return room.players.filter((p) => !p.folded);
}

function isActionable(player) {
  return !!player && !player.folded && player.chips > 0;
}

function findNextActiveIndex(room, startIndex) {
  if (room.players.length === 0) return 0;
  for (let i = 1; i <= room.players.length; i++) {
    const idx = (startIndex + i) % room.players.length;
    if (!room.players[idx].folded) return idx;
  }
  return startIndex;
}

function getSmallBlindIndex(room) {
  if (room.players.length <= 1) return room.dealerIndex;
  if (room.players.length === 2) return room.dealerIndex;
  return findNextActiveIndex(room, room.dealerIndex);
}

function getBigBlindIndex(room) {
  if (room.players.length <= 1) return room.dealerIndex;
  if (room.players.length === 2) return findNextActiveIndex(room, room.dealerIndex);
  return findNextActiveIndex(room, getSmallBlindIndex(room));
}

function getFirstToActPreflop(room) {
  if (room.players.length === 2) return room.dealerIndex;
  return findNextActiveIndex(room, getBigBlindIndex(room));
}

function getFirstToActPostflop(room) {
  if (room.players.length === 2) return getBigBlindIndex(room);
  return findNextActiveIndex(room, room.dealerIndex);
}

function getPositionLabel(room, playerIndex) {
  const count = room.players.length;
  if (count < 2 || room.dealerIndex === -1) return "";

  const sbIndex = getSmallBlindIndex(room);
  const bbIndex = getBigBlindIndex(room);

  if (playerIndex === room.dealerIndex) return "";
  if (playerIndex === sbIndex) return "";
  if (playerIndex === bbIndex) return "";

  const order = [];
  let current = getFirstToActPreflop(room);

  for (let i = 0; i < count; i++) {
    if (current !== room.dealerIndex && current !== sbIndex && current !== bbIndex) {
      order.push(current);
    }
    current = findNextActiveIndex(room, current);
  }

  const pos = order.indexOf(playerIndex);
  if (pos === -1) return "";

  if (count === 3) return "UTG";
  if (count === 4) return ["UTG"][pos] || "";
  if (count === 5) return ["UTG", "CO"][pos] || "";
  if (count === 6) return ["UTG", "HJ", "CO"][pos] || "";
  if (count === 7) return ["UTG", "LJ", "HJ", "CO"][pos] || "";
  if (count === 8) return ["UTG", "UTG+1", "LJ", "HJ", "CO"][pos] || "";

  return "";
}

function orderedActionableIdsFrom(room, startIndex, excludeId = null) {
  const ids = [];
  for (let offset = 0; offset < room.players.length; offset++) {
    const idx = (startIndex + offset) % room.players.length;
    const p = room.players[idx];
    if (!isActionable(p)) continue;
    if (excludeId && p.id === excludeId) continue;
    ids.push(p.id);
  }
  return ids;
}

function removeFromQueues(room, id) {
  room.mustActIds = room.mustActIds.filter((x) => x !== id);
  room.canRaiseIds = room.canRaiseIds.filter((x) => x !== id);
}

function setCurrentTurnFromMustAct(room) {
  if (!room.bettingOpen || room.mustActIds.length === 0) {
    room.currentTurnIndex = 0;
    return;
  }
  const idx = getPlayerIndexById(room, room.mustActIds[0]);
  room.currentTurnIndex = idx === -1 ? 0 : idx;
}

function startLogStreet(room, streetName) {
  room.actionLogs.push({ street: streetName, entries: [] });
}

function pushLogEntry(room, text) {
  if (room.actionLogs.length === 0) return;
  room.actionLogs[room.actionLogs.length - 1].entries.push(text);
}

function resetPotWinTexts(room) {
  room.players.forEach((p) => {
    p.potWinTexts = [];
    p.potWinText = "";
  });
}

function getCardRank(card) {
  return card.slice(0, -1);
}

function getCardSuit(card) {
  return card.slice(-1);
}

function getCardValue(card) {
  return rankValues[getCardRank(card)];
}

function countByValue(cards) {
  const counts = {};
  cards.forEach((card) => {
    const value = getCardValue(card);
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

function getUniqueSortedValues(cards) {
  return [...new Set(cards.map(getCardValue))].sort((a, b) => b - a);
}

function findStraightHigh(values) {
  const uniqueAsc = [...new Set(values)].sort((a, b) => a - b);
  if (uniqueAsc.includes(14)) uniqueAsc.unshift(1);

  let run = 1;
  let bestHigh = 0;

  for (let i = 1; i < uniqueAsc.length; i++) {
    if (uniqueAsc[i] === uniqueAsc[i - 1] + 1) {
      run++;
      if (run >= 5) bestHigh = uniqueAsc[i] === 1 ? 14 : uniqueAsc[i];
    } else if (uniqueAsc[i] !== uniqueAsc[i - 1]) {
      run = 1;
    }
  }
  return bestHigh;
}

function getFlushCards(cards) {
  const suits = {};
  cards.forEach((card) => {
    const suit = getCardSuit(card);
    if (!suits[suit]) suits[suit] = [];
    suits[suit].push(card);
  });

  for (const suit in suits) {
    if (suits[suit].length >= 5) {
      return suits[suit].slice().sort((a, b) => getCardValue(b) - getCardValue(a));
    }
  }

  return null;
}

function evaluateSevenCards(cards) {
  const counts = countByValue(cards);
  const uniqueValuesDesc = getUniqueSortedValues(cards);

  const valuesByCount = Object.keys(counts)
    .map((v) => ({ value: Number(v), count: counts[v] }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.value - a.value;
    });

  const flushCards = getFlushCards(cards);
  const straightHigh = findStraightHigh(cards.map(getCardValue));

  let straightFlushHigh = 0;
  if (flushCards) straightFlushHigh = findStraightHigh(flushCards.map(getCardValue));

  if (straightFlushHigh) {
    return { name: "스트레이트 플러쉬", rank: 9, tiebreak: [straightFlushHigh] };
  }

  const four = valuesByCount.find((x) => x.count === 4);
  if (four) {
    const kicker = uniqueValuesDesc.find((v) => v !== four.value) || 0;
    return { name: "포카드", rank: 8, tiebreak: [four.value, kicker] };
  }

  const triples = valuesByCount.filter((x) => x.count === 3).map((x) => x.value);
  const pairs = valuesByCount.filter((x) => x.count === 2).map((x) => x.value);

  if (triples.length >= 1 && (pairs.length >= 1 || triples.length >= 2)) {
    const topTriple = triples[0];
    const fullHousePair = triples.length >= 2 ? triples[1] : pairs[0];
    return { name: "풀하우스", rank: 7, tiebreak: [topTriple, fullHousePair] };
  }

  if (flushCards) {
    return { name: "플러쉬", rank: 6, tiebreak: flushCards.slice(0, 5).map(getCardValue) };
  }

  if (straightHigh) {
    return { name: "스트레이트", rank: 5, tiebreak: [straightHigh] };
  }

  if (triples.length >= 1) {
    const topTriple = triples[0];
    const kickers = uniqueValuesDesc.filter((v) => v !== topTriple).slice(0, 2);
    return { name: "트리플", rank: 4, tiebreak: [topTriple, ...kickers] };
  }

  if (pairs.length >= 2) {
    const topPair = pairs[0];
    const secondPair = pairs[1];
    const kicker = uniqueValuesDesc.find((v) => v !== topPair && v !== secondPair) || 0;
    return { name: "투페어", rank: 3, tiebreak: [topPair, secondPair, kicker] };
  }

  if (pairs.length === 1) {
    const pair = pairs[0];
    const kickers = uniqueValuesDesc.filter((v) => v !== pair).slice(0, 3);
    return { name: "원페어", rank: 2, tiebreak: [pair, ...kickers] };
  }

  return { name: "하이카드", rank: 1, tiebreak: uniqueValuesDesc.slice(0, 5) };
}

function getHandLabel(evaluation) {
  if (!evaluation) return "";
  if (evaluation.name === "하이카드") return `${valueNames[evaluation.tiebreak[0]]}하이`;
  if (evaluation.name === "원페어") return `원페어(${valueNames[evaluation.tiebreak[0]]})`;
  if (evaluation.name === "투페어") return `투페어(${valueNames[evaluation.tiebreak[0]]}와 ${valueNames[evaluation.tiebreak[1]]})`;
  if (evaluation.name === "트리플") return `트리플(${valueNames[evaluation.tiebreak[0]]})`;
  if (evaluation.name === "스트레이트") return `스트레이트(${valueNames[evaluation.tiebreak[0]]}하이)`;
  if (evaluation.name === "플러쉬") return `플러쉬(${valueNames[evaluation.tiebreak[0]]}하이)`;
  if (evaluation.name === "풀하우스") return `풀하우스(${valueNames[evaluation.tiebreak[0]]} 풀 ${valueNames[evaluation.tiebreak[1]]})`;
  if (evaluation.name === "포카드") return `포카드(${valueNames[evaluation.tiebreak[0]]})`;
  if (evaluation.name === "스트레이트 플러쉬") return `스트플(${valueNames[evaluation.tiebreak[0]]}하이)`;
  return evaluation.name;
}

function compareEvaluations(a, b) {
  if (a.rank !== b.rank) return a.rank - b.rank;
  const max = Math.max(a.tiebreak.length, b.tiebreak.length);
  for (let i = 0; i < max; i++) {
    const av = a.tiebreak[i] || 0;
    const bv = b.tiebreak[i] || 0;
    if (av !== bv) return av - bv;
  }
  return 0;
}

function buildSidePots(room) {
  const committedValues = room.players.map((p) => p.totalCommitted || 0).filter((v) => v > 0);
  const uniqueLevels = [...new Set(committedValues)].sort((a, b) => a - b);
  const pots = [];
  let prev = 0;

  for (const level of uniqueLevels) {
    const contributors = room.players.filter((p) => (p.totalCommitted || 0) >= level);
    const amount = (level - prev) * contributors.length;
    const eligibleIds = activePlayers(room)
      .filter((p) => (p.totalCommitted || 0) >= level)
      .map((p) => p.id);

    if (amount > 0) pots.push({ amount, eligibleIds });
    prev = level;
  }

  return pots;
}

function distributeAmountAmongWinners(winners, amount) {
  if (winners.length === 0 || amount <= 0) return;

  const baseShare = Math.floor(amount / winners.length);
  const remainder = amount % winners.length;

  for (let i = 0; i < winners.length; i++) {
    winners[i].chips += baseShare;
    if (i < remainder) winners[i].chips += 1;
  }
}

function finalizeChipChangeTexts(room) {
  room.players.forEach((p) => {
    const diff = p.chips - p.startChips;
    p.chipChangeValue = diff;
    if (diff > 0) p.chipChangeText = `+${diff}`;
    else if (diff < 0) p.chipChangeText = `${diff}`;
    else p.chipChangeText = "±0";
  });
}

function scheduleNextHand(room) {
  clearNextHandTimeout(room);
  if (!canStartAnotherHand(room)) return;

  room.nextHandTimeout = setTimeout(() => {
    startHand(room, false);
    sendState(room);
  }, NEXT_HAND_DELAY_MS);
}

function showdown(room) {
  const alive = activePlayers(room);
  room.lastWinnerNames = [];
  resetPotWinTexts(room);

  if (alive.length === 0) return;

  room.players.forEach((p) => {
    if (p.folded) {
      p.lastHandName = "폴드";
      p.potWinText = "폴드";
    } else {
      const evaluation = evaluateSevenCards([...p.cards, ...room.community]);
      p.lastHandName = getHandLabel(evaluation);
    }
  });

  if (alive.length === 1) {
    alive[0].chips += room.pot;
    room.lastWinnerNames = [alive[0].name];
    alive[0].potWinText = "팟 승리";
    room.result = `${alive[0].name} 승리!`;
    pushLogEntry(room, `${alive[0].name} 승리`);

    room.pot = 0;
    room.bettingOpen = false;
    room.mustActIds = [];
    room.canRaiseIds = [];
    room.street = "리버완료";
    finalizeChipChangeTexts(room);
    scheduleNextHand(room);
    return;
  }

  const sidePots = buildSidePots(room);
  const summaryLines = [];

  if (sidePots.length === 0) {
    const evaluatedAlive = alive.map((player) => ({
      player,
      evaluation: evaluateSevenCards([...player.cards, ...room.community])
    }));

    let bestEvaluation = evaluatedAlive[0].evaluation;
    let winners = [evaluatedAlive[0].player];

    for (let i = 1; i < evaluatedAlive.length; i++) {
      const current = evaluatedAlive[i];
      const cmp = compareEvaluations(current.evaluation, bestEvaluation);
      if (cmp > 0) {
        bestEvaluation = current.evaluation;
        winners = [current.player];
      } else if (cmp === 0) {
        winners.push(current.player);
      }
    }

    distributeAmountAmongWinners(winners, room.pot);
    room.lastWinnerNames = winners.map((p) => p.name);

    winners.forEach((winner) => {
      winner.potWinTexts.push(winners.length === 1 ? "팟 승리" : "팟 공동승리");
    });

    if (winners.length === 1) {
      room.result = `${winners[0].name} 승리! (${getHandLabel(bestEvaluation)})`;
    } else {
      room.result = `${winners.map((p) => p.name).join(", ")} 공동 승리! (${getHandLabel(bestEvaluation)})`;
    }

    pushLogEntry(room, room.result);
  } else {
    sidePots.forEach((sidePot, index) => {
      const eligiblePlayers = activePlayers(room).filter((p) => sidePot.eligibleIds.includes(p.id));
      if (eligiblePlayers.length === 0) return;

      const evaluatedEligible = eligiblePlayers.map((player) => ({
        player,
        evaluation: evaluateSevenCards([...player.cards, ...room.community])
      }));

      let bestEvaluation = evaluatedEligible[0].evaluation;
      let winners = [evaluatedEligible[0].player];

      for (let i = 1; i < evaluatedEligible.length; i++) {
        const current = evaluatedEligible[i];
        const cmp = compareEvaluations(current.evaluation, bestEvaluation);
        if (cmp > 0) {
          bestEvaluation = current.evaluation;
          winners = [current.player];
        } else if (cmp === 0) {
          winners.push(current.player);
        }
      }

      distributeAmountAmongWinners(winners, sidePot.amount);

      const potLabel = index === 0 ? "메인팟" : `사이드팟${index}`;
      winners.forEach((winner) => {
        winner.potWinTexts.push(winners.length === 1 ? `${potLabel} 승리` : `${potLabel} 공동승리`);
      });

      winners.forEach((winner) => {
        if (!room.lastWinnerNames.includes(winner.name)) room.lastWinnerNames.push(winner.name);
      });

      if (winners.length === 1) {
        summaryLines.push(`${potLabel}: ${winners[0].name} (${getHandLabel(bestEvaluation)})`);
      } else {
        summaryLines.push(`${potLabel}: ${winners.map((p) => p.name).join(", ")} (${getHandLabel(bestEvaluation)})`);
      }
    });

    room.result = summaryLines.join(" | ");
    pushLogEntry(room, room.result);
  }

  room.players.forEach((p) => {
    if (!p.folded) p.potWinText = (p.potWinTexts || []).join(", ");
  });

  room.pot = 0;
  room.bettingOpen = false;
  room.mustActIds = [];
  room.canRaiseIds = [];
  room.street = "리버완료";
  finalizeChipChangeTexts(room);
  scheduleNextHand(room);
}

function startStreet(room, firstActorIndex) {
  room.players.forEach((p) => {
    p.roundBet = 0;
    p.actedSinceFullRaise = p.folded;
  });

  room.currentBet = 0;
  room.lastFullRaiseSize = BIG_BLIND;
  room.bettingOpen = true;

  room.mustActIds = orderedActionableIdsFrom(room, firstActorIndex);
  room.canRaiseIds = [...room.mustActIds];
  setCurrentTurnFromMustAct(room);
}

function openActionAfterFullRaise(room, actorIndex, actorId, newCurrentBet, raiseSize) {
  room.currentBet = newCurrentBet;
  room.lastFullRaiseSize = raiseSize;

  room.players.forEach((p) => {
    if (isActionable(p)) p.actedSinceFullRaise = false;
  });

  const actor = getPlayerById(room, actorId);
  if (actor) actor.actedSinceFullRaise = true;

  const nextIndex = (actorIndex + 1) % room.players.length;
  room.mustActIds = orderedActionableIdsFrom(room, nextIndex, actorId);
  room.canRaiseIds = [...room.mustActIds];
  setCurrentTurnFromMustAct(room);
}

function openActionAfterShortAllIn(room, actorIndex, actorId, newCurrentBet) {
  room.currentBet = newCurrentBet;

  const nextIndex = (actorIndex + 1) % room.players.length;
  const ordered = orderedActionableIdsFrom(room, nextIndex, actorId);

  room.mustActIds = ordered.filter((id) => {
    const p = getPlayerById(room, id);
    if (!p) return false;
    return !p.actedSinceFullRaise || p.roundBet < room.currentBet;
  });

  room.canRaiseIds = room.mustActIds.filter((id) => {
    const p = getPlayerById(room, id);
    if (!p) return false;
    return !p.actedSinceFullRaise;
  });

  setCurrentTurnFromMustAct(room);
}

function postBlinds(room) {
  const sbIndex = getSmallBlindIndex(room);
  const bbIndex = getBigBlindIndex(room);

  const sbPlayer = room.players[sbIndex];
  const bbPlayer = room.players[bbIndex];

  const sbAmount = Math.min(SMALL_BLIND, sbPlayer.chips);
  const bbAmount = Math.min(BIG_BLIND, bbPlayer.chips);

  sbPlayer.chips -= sbAmount;
  bbPlayer.chips -= bbAmount;

  sbPlayer.roundBet = sbAmount;
  bbPlayer.roundBet = bbAmount;

  sbPlayer.totalCommitted += sbAmount;
  bbPlayer.totalCommitted += bbAmount;

  sbPlayer.actedSinceFullRaise = false;
  bbPlayer.actedSinceFullRaise = false;

  room.pot += sbAmount + bbAmount;
  room.currentBet = bbAmount;
  room.lastFullRaiseSize = BIG_BLIND;
  room.bettingOpen = true;

  pushLogEntry(room, `${sbPlayer.name} SB ${sbAmount}`);
  pushLogEntry(room, `${bbPlayer.name} BB ${bbAmount}`);

  const firstActorIndex = getFirstToActPreflop(room);
  room.mustActIds = orderedActionableIdsFrom(room, firstActorIndex);
  room.canRaiseIds = [...room.mustActIds];
  setCurrentTurnFromMustAct(room);
}

function advanceStreet(room) {
  if (room.street === "프리플랍") {
    room.street = "플랍";
    room.community[0] = room.deck.pop();
    room.community[1] = room.deck.pop();
    room.community[2] = room.deck.pop();
    startLogStreet(room, "플랍");
    startStreet(room, getFirstToActPostflop(room));
    return;
  }

  if (room.street === "플랍") {
    room.street = "턴";
    room.community[3] = room.deck.pop();
    startLogStreet(room, "턴");
    startStreet(room, getFirstToActPostflop(room));
    return;
  }

  if (room.street === "턴") {
    room.street = "리버";
    room.community[4] = room.deck.pop();
    startLogStreet(room, "리버");
    startStreet(room, getFirstToActPostflop(room));
    return;
  }

  if (room.street === "리버") {
    showdown(room);
  }
}

function maybeAdvanceRound(room) {
  if (room.mustActIds.length === 0) {
    advanceStreet(room);
  } else {
    setCurrentTurnFromMustAct(room);
  }
}

function startHand(room, resetStacks) {
  clearNextHandTimeout(room);

  if (resetStacks) {
    room.players.forEach((p) => {
      p.chips = STARTING_CHIPS;
    });
  }

  if (!canStartAnotherHand(room)) {
    room.result = "칩이 있는 플레이어가 2명 이상 있어야 시작할 수 있습니다";
    room.lastWinnerNames = [];
    room.bettingOpen = false;
    room.mustActIds = [];
    room.canRaiseIds = [];
    room.street = "대기중";
    return;
  }

  room.deck = createDeck();
  shuffle(room.deck);

  room.community = ["", "", "", "", ""];
  room.pot = 0;
  room.currentBet = 0;
  room.result = "";
  room.lastWinnerNames = [];
  room.street = "프리플랍";
  room.bettingOpen = true;
  room.mustActIds = [];
  room.canRaiseIds = [];
  room.lastFullRaiseSize = BIG_BLIND;
  room.actionLogs = [];

  room.dealerIndex = room.dealerIndex === -1 ? 0 : (room.dealerIndex + 1) % room.players.length;

  room.players.forEach((p) => {
    p.folded = p.chips <= 0;
    p.cards = p.folded ? ["", ""] : [room.deck.pop(), room.deck.pop()];
    p.roundBet = 0;
    p.totalCommitted = 0;
    p.actedSinceFullRaise = p.folded;
    p.lastHandName = "";
    p.potWinTexts = [];
    p.potWinText = "";
    p.startChips = p.chips;
    p.chipChangeValue = 0;
    p.chipChangeText = "";
  });

  startLogStreet(room, "프리플랍");
  postBlinds(room);
}

function getMinRaiseAmount(room, player, canRaise) {
  if (!player || !canRaise) return 0;
  const minTarget = Math.max(room.currentBet + room.lastFullRaiseSize, player.roundBet + room.lastFullRaiseSize);
  return Math.min(player.chips, minTarget);
}

function sendRoomInfo(socket, room) {
  if (!room) {
    socket.emit("roomInfo", {
      inRoom: false,
      roomCode: "",
      playerCount: 0
    });
    return;
  }

  socket.emit("roomInfo", {
    inRoom: true,
    roomCode: room.roomCode,
    playerCount: room.players.length
  });
}

function sendState(room) {
  const sbIndex = room.players.length >= 2 ? getSmallBlindIndex(room) : -1;
  const bbIndex = room.players.length >= 2 ? getBigBlindIndex(room) : -1;

  room.players.forEach((player) => {
    const socket = io.sockets.sockets.get(player.id);
    if (!socket) return;

    const meId = socket.id;
    const me = getPlayerById(room, meId);
    const myTurn = room.bettingOpen && room.mustActIds.length > 0 && room.mustActIds[0] === meId;
    const myCanRaise = myTurn && room.canRaiseIds.includes(meId);

    sendRoomInfo(socket, room);

    socket.emit("state", {
      pot: room.pot,
      street: room.street,
      result: room.result,
      actionLogs: room.actionLogs,
      winnerNames: room.street === "리버완료" ? room.lastWinnerNames : [],
      currentTurnName: room.bettingOpen && room.mustActIds.length > 0 ? (getPlayerById(room, room.mustActIds[0])?.name || "-") : "-",
      myTurn,
      canRaise: myCanRaise,
      myChips: me ? me.chips : 0,
      currentBet: room.currentBet,
      myRoundBet: me ? me.roundBet : 0,
      minRaiseAmount: getMinRaiseAmount(room, me, myCanRaise),
      community: room.community,
      players: room.players.map((p, i) => ({
        name: p.name,
        chips: p.chips,
        folded: p.folded,
        isCurrentTurn: room.bettingOpen && room.mustActIds.length > 0 && room.mustActIds[0] === p.id,
        isMe: p.id === meId,
        isDealer: i === room.dealerIndex,
        isSmallBlind: i === sbIndex,
        isBigBlind: i === bbIndex,
        positionLabel: getPositionLabel(room, i),
        roundBetText: room.street !== "리버완료" && p.roundBet > 0 ? `이번 라운드: ${p.roundBet}` : "",
        handName: room.street === "리버완료" ? p.lastHandName : "",
        potWinText: room.street === "리버완료" ? p.potWinText : "",
        chipChangeValue: room.street === "리버완료" ? p.chipChangeValue : 0,
        chipChangeText: room.street === "리버완료" ? p.chipChangeText : "",
        cardsVisible: p.id === meId || room.street === "리버완료",
        cards: p.id === meId || room.street === "리버완료" ? p.cards : ["🂠", "🂠"]
      }))
    });
  });
}

function cleanupRoomIfEmpty(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (room.players.length === 0) {
    clearNextHandTimeout(room);
    rooms.delete(roomCode);
  }
}

function leaveCurrentRoom(socket) {
  const roomCode = socketRoomMap.get(socket.id);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  socket.leave(roomCode);
  socketRoomMap.delete(socket.id);

  if (!room) {
    sendRoomInfo(socket, null);
    return;
  }

  const removedIndex = room.players.findIndex((p) => p.id === socket.id);

  room.mustActIds = room.mustActIds.filter((id) => id !== socket.id);
  room.canRaiseIds = room.canRaiseIds.filter((id) => id !== socket.id);
  room.players = room.players.filter((p) => p.id !== socket.id);

  if (room.players.length === 0) {
    cleanupRoomIfEmpty(roomCode);
    sendRoomInfo(socket, null);
    return;
  }

  if (removedIndex !== -1) {
    if (room.dealerIndex > removedIndex) {
      room.dealerIndex -= 1;
    } else if (room.dealerIndex === removedIndex) {
      room.dealerIndex = room.dealerIndex % room.players.length;
    }
  }

  if (activePlayers(room).length === 1 && room.pot > 0) {
    showdown(room);
    sendState(room);
    sendRoomInfo(socket, null);
    return;
  }

  if (room.bettingOpen) {
    maybeAdvanceRound(room);
  }

  sendState(room);
  sendRoomInfo(socket, null);
}

io.on("connection", (socket) => {
  sendRoomInfo(socket, null);

  socket.on("createRoom", ({ name }) => {
    const trimmedName = String(name || "").trim();
    if (!trimmedName) return;

    leaveCurrentRoom(socket);

    let roomCode = generateRoomCode();
    while (rooms.has(roomCode)) {
      roomCode = generateRoomCode();
    }

    const room = createRoomState(roomCode);
    rooms.set(roomCode, room);

    room.players.push({
      id: socket.id,
      name: trimmedName,
      chips: STARTING_CHIPS,
      cards: ["?", "?"],
      folded: false,
      roundBet: 0,
      totalCommitted: 0,
      actedSinceFullRaise: false,
      lastHandName: "",
      potWinTexts: [],
      potWinText: "",
      startChips: STARTING_CHIPS,
      chipChangeValue: 0,
      chipChangeText: ""
    });

    socket.join(roomCode);
    socketRoomMap.set(socket.id, roomCode);
    sendState(room);
  });

  socket.on("joinRoom", ({ roomCode, name }) => {
    const trimmedName = String(name || "").trim();
    const normalizedCode = String(roomCode || "").trim().toUpperCase();
    if (!trimmedName || !normalizedCode) return;

    const room = rooms.get(normalizedCode);
    if (!room) {
      socket.emit("joinRoomError", "존재하지 않는 방 코드입니다");
      return;
    }

    leaveCurrentRoom(socket);

    room.players.push({
      id: socket.id,
      name: trimmedName,
      chips: STARTING_CHIPS,
      cards: ["?", "?"],
      folded: false,
      roundBet: 0,
      totalCommitted: 0,
      actedSinceFullRaise: false,
      lastHandName: "",
      potWinTexts: [],
      potWinText: "",
      startChips: STARTING_CHIPS,
      chipChangeValue: 0,
      chipChangeText: ""
    });

    socket.join(normalizedCode);
    socketRoomMap.set(socket.id, normalizedCode);
    sendState(room);
  });

  socket.on("leaveRoom", () => {
    leaveCurrentRoom(socket);
  });

  socket.on("startGame", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (room.players.length < 2) return;
    startHand(room, true);
    sendState(room);
  });

  socket.on("call", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!room.bettingOpen || room.mustActIds.length === 0) return;

    const actorId = room.mustActIds[0];
    if (actorId !== socket.id) return;

    const actorIndex = getPlayerIndexById(room, actorId);
    const p = room.players[actorIndex];
    if (!p || p.folded) return;

    const need = room.currentBet - p.roundBet;
    if (need > p.chips) return;

    const isCheck = need === 0;

    p.chips -= need;
    room.pot += need;
    p.roundBet = room.currentBet;
    p.totalCommitted += need;
    p.actedSinceFullRaise = true;

    pushLogEntry(room, isCheck ? `${p.name} 체크` : `${p.name} 콜 ${need}`);

    removeFromQueues(room, p.id);
    maybeAdvanceRound(room);
    sendState(room);
  });

  socket.on("raise", (raiseTargetAmount) => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!room.bettingOpen || room.mustActIds.length === 0) return;

    const actorId = room.mustActIds[0];
    if (actorId !== socket.id) return;
    if (!room.canRaiseIds.includes(actorId)) return;

    const actorIndex = getPlayerIndexById(room, actorId);
    const p = room.players[actorIndex];
    if (!p || p.folded) return;

    const target = Number(raiseTargetAmount);
    if (!Number.isFinite(target)) return;

    const minTarget = Math.max(room.currentBet + room.lastFullRaiseSize, p.roundBet + room.lastFullRaiseSize);
    if (target < minTarget) return;

    const need = target - p.roundBet;
    if (need > p.chips) return;

    const oldBet = room.currentBet;
    const raiseSize = target - oldBet;

    p.chips -= need;
    room.pot += need;
    p.roundBet = target;
    p.totalCommitted += need;
    p.actedSinceFullRaise = true;

    pushLogEntry(room, `${p.name} 레이즈 ${target}`);

    openActionAfterFullRaise(room, actorIndex, p.id, target, raiseSize);
    maybeAdvanceRound(room);
    sendState(room);
  });

  socket.on("allIn", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!room.bettingOpen || room.mustActIds.length === 0) return;

    const actorId = room.mustActIds[0];
    if (actorId !== socket.id) return;

    const actorIndex = getPlayerIndexById(room, actorId);
    const p = room.players[actorIndex];
    if (!p || p.folded || p.chips <= 0) return;

    const target = p.roundBet + p.chips;

    if (target <= room.currentBet) {
      const amount = p.chips;
      room.pot += amount;
      p.roundBet = target;
      p.totalCommitted += amount;
      p.chips = 0;
      p.actedSinceFullRaise = true;

      pushLogEntry(room, `${p.name} 올인 ${target} (콜)`);

      removeFromQueues(room, p.id);
      maybeAdvanceRound(room);
      sendState(room);
      return;
    }

    const oldBet = room.currentBet;
    const raiseSize = target - oldBet;
    const need = target - p.roundBet;

    p.chips -= need;
    room.pot += need;
    p.roundBet = target;
    p.totalCommitted += need;
    p.chips = 0;
    p.actedSinceFullRaise = true;

    const isFullRaise = raiseSize >= room.lastFullRaiseSize;

    pushLogEntry(
      room,
      isFullRaise
        ? `${p.name} 올인 ${target} (정상 레이즈)`
        : `${p.name} 올인 ${target} (짧은 올인)`
    );

    if (isFullRaise) {
      openActionAfterFullRaise(room, actorIndex, p.id, target, raiseSize);
    } else {
      openActionAfterShortAllIn(room, actorIndex, p.id, target);
    }

    maybeAdvanceRound(room);
    sendState(room);
  });

  socket.on("fold", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (!room.bettingOpen || room.mustActIds.length === 0) return;

    const actorId = room.mustActIds[0];
    if (actorId !== socket.id) return;

    const actorIndex = getPlayerIndexById(room, actorId);
    const p = room.players[actorIndex];
    if (!p || p.folded) return;

    p.folded = true;
    p.actedSinceFullRaise = true;
    pushLogEntry(room, `${p.name} 폴드`);

    removeFromQueues(room, p.id);

    if (activePlayers(room).length === 1) {
      showdown(room);
      sendState(room);
      return;
    }

    maybeAdvanceRound(room);
    sendState(room);
  });

  socket.on("showdown", () => {
    const room = getRoomBySocket(socket.id);
    if (!room) return;
    if (room.street !== "리버완료") return;
    if (room.pot <= 0) return;
    showdown(room);
    sendState(room);
  });

  socket.on("disconnect", () => {
    leaveCurrentRoom(socket);
  });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`server running ${PORT}`);
});