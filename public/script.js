const socket = io();

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const startBtn = document.getElementById("startBtn");
const foldBtn = document.getElementById("foldBtn");
const callBtn = document.getElementById("callBtn");
const raiseBtn = document.getElementById("raiseBtn");
const allInBtn = document.getElementById("allInBtn");
const showdownBtn = document.getElementById("showdownBtn");

const playersLayer = document.getElementById("playersLayer");
const resultBox = document.getElementById("resultBox");
const potBox = document.getElementById("potBox");
const potCenterValue = document.getElementById("potCenterValue");
const turnBox = document.getElementById("turnBox");
const turnBanner = document.getElementById("turnBanner");
const streetBox = document.getElementById("streetBox");
const roomInfoBox = document.getElementById("roomInfoBox");
const logBox = document.getElementById("logBox");
const logPanel = document.getElementById("logPanel");
const toggleLogPanelBtn = document.getElementById("toggleLogPanelBtn");

const nameInput = document.getElementById("name");
const roomCodeInput = document.getElementById("roomCodeInput");
const raiseAmountInput = document.getElementById("raiseAmount");
const raiseAmountText = document.getElementById("raiseAmountText");

let previousCommunity = ["", "", "", "", ""];
let latestState = null;
let latestRoomInfo = {
  inRoom: false,
  roomCode: "",
  playerCount: 0,
  isHost: false,
  hostName: ""
};
let isLogPanelCollapsed = false;

let previousStateForFx = null;
let chipFxLayer = null;

function ensureChipFxLayer() {
  const table = document.querySelector(".poker-table");
  if (!table) return null;

  let layer = table.querySelector(".chip-fx-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "chip-fx-layer";
    table.appendChild(layer);
  }
  chipFxLayer = layer;
  return layer;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR");
}

function formatCardHtml(card, visible) {
  if (!visible || card === "🂠") return "🂠";

  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  const isRed = suit === "♥" || suit === "♦";

  return `
    <span class="card-text ${isRed ? "red" : ""}">
      <span>${rank}</span><span>${suit}</span>
    </span>
  `;
}

function getSeatPositions(count) {
  const isPortraitMobile =
    window.innerWidth <= 900 && window.innerHeight > window.innerWidth;

  if (isPortraitMobile) {
    const portraitMap = {
      2: [
        { left: 50, top: 88 },
        { left: 50, top: 11 }
      ],
      3: [
        { left: 50, top: 88 },
        { left: 18, top: 18 },
        { left: 82, top: 18 }
      ],
      4: [
        { left: 50, top: 88 },
        { left: 14, top: 38 },
        { left: 14, top: 12 },
        { left: 86, top: 12 }
      ],
      5: [
        { left: 50, top: 88 },
        { left: 14, top: 50 },
        { left: 14, top: 22 },
        { left: 50, top: 10 },
        { left: 86, top: 22 }
      ],
      6: [
        { left: 50, top: 88 },
        { left: 14, top: 56 },
        { left: 14, top: 32 },
        { left: 14, top: 10 },
        { left: 86, top: 10 },
        { left: 86, top: 32 }
      ],
      7: [
        { left: 50, top: 88 },
        { left: 14, top: 58 },
        { left: 14, top: 38 },
        { left: 14, top: 18 },
        { left: 50, top: 8 },
        { left: 86, top: 18 },
        { left: 86, top: 38 }
      ],
      8: [
        { left: 50, top: 88 },
        { left: 14, top: 60 },
        { left: 14, top: 42 },
        { left: 14, top: 24 },
        { left: 32, top: 8 },
        { left: 68, top: 8 },
        { left: 86, top: 24 },
        { left: 86, top: 42 }
      ]
    };

    return portraitMap[count] || portraitMap[8];
  }

  const isMobileLandscape =
    window.innerWidth <= 950 && window.innerWidth > window.innerHeight;
  const isTablet = window.innerWidth <= 900 && !isMobileLandscape;

  const desktopMap = {
    2: [{ left: 50, top: 88 }, { left: 50, top: 14 }],
    3: [{ left: 50, top: 88 }, { left: 20, top: 20 }, { left: 80, top: 20 }],
    4: [{ left: 50, top: 88 }, { left: 17, top: 64 }, { left: 17, top: 20 }, { left: 83, top: 20 }],
    5: [{ left: 50, top: 88 }, { left: 17, top: 69 }, { left: 19, top: 24 }, { left: 50, top: 14 }, { left: 81, top: 24 }],
    6: [{ left: 50, top: 88 }, { left: 16, top: 70 }, { left: 16, top: 36 }, { left: 33, top: 16 }, { left: 67, top: 16 }, { left: 84, top: 36 }],
    7: [{ left: 50, top: 88 }, { left: 16, top: 72 }, { left: 15, top: 44 }, { left: 20, top: 20 }, { left: 50, top: 13 }, { left: 80, top: 20 }, { left: 85, top: 44 }],
    8: [{ left: 50, top: 88 }, { left: 16, top: 74 }, { left: 14, top: 50 }, { left: 17, top: 24 }, { left: 35, top: 14 }, { left: 65, top: 14 }, { left: 83, top: 24 }, { left: 86, top: 50 }]
  };

  const tabletMap = {
    2: [{ left: 50, top: 89 }, { left: 50, top: 15 }],
    3: [{ left: 50, top: 89 }, { left: 20, top: 21 }, { left: 80, top: 21 }],
    4: [{ left: 50, top: 89 }, { left: 17, top: 66 }, { left: 17, top: 21 }, { left: 83, top: 21 }],
    5: [{ left: 50, top: 89 }, { left: 17, top: 71 }, { left: 19, top: 25 }, { left: 50, top: 15 }, { left: 81, top: 25 }],
    6: [{ left: 50, top: 89 }, { left: 16, top: 72 }, { left: 16, top: 38 }, { left: 33, top: 17 }, { left: 67, top: 17 }, { left: 84, top: 38 }],
    7: [{ left: 50, top: 89 }, { left: 16, top: 74 }, { left: 15, top: 46 }, { left: 20, top: 21 }, { left: 50, top: 14 }, { left: 80, top: 21 }, { left: 85, top: 46 }],
    8: [{ left: 50, top: 89 }, { left: 16, top: 76 }, { left: 14, top: 52 }, { left: 17, top: 25 }, { left: 35, top: 15 }, { left: 65, top: 15 }, { left: 83, top: 25 }, { left: 86, top: 52 }]
  };

  const mobileLandscapeMap = {
    2: [{ left: 50, top: 90 }, { left: 50, top: 16 }],
    3: [{ left: 50, top: 90 }, { left: 21, top: 22 }, { left: 79, top: 22 }],
    4: [{ left: 50, top: 90 }, { left: 18, top: 67 }, { left: 18, top: 22 }, { left: 82, top: 22 }],
    5: [{ left: 50, top: 90 }, { left: 18, top: 72 }, { left: 20, top: 27 }, { left: 50, top: 17 }, { left: 80, top: 27 }],
    6: [{ left: 50, top: 90 }, { left: 17, top: 73 }, { left: 17, top: 40 }, { left: 34, top: 19 }, { left: 66, top: 19 }, { left: 83, top: 40 }],
    7: [{ left: 50, top: 90 }, { left: 17, top: 75 }, { left: 16, top: 48 }, { left: 21, top: 24 }, { left: 50, top: 16 }, { left: 79, top: 24 }, { left: 84, top: 48 }],
    8: [{ left: 50, top: 90 }, { left: 17, top: 76 }, { left: 15, top: 54 }, { left: 18, top: 28 }, { left: 35, top: 17 }, { left: 65, top: 17 }, { left: 82, top: 28 }, { left: 85, top: 54 }]
  };

  const map = isMobileLandscape
    ? mobileLandscapeMap
    : isTablet
      ? tabletMap
      : desktopMap;

  return map[count] || map[8];
}

function setRaiseAmount(value) {
  const min = Number(raiseAmountInput.min);
  const max = Number(raiseAmountInput.max);
  let next = Number(value);

  if (!Number.isFinite(next)) next = min;
  next = Math.round(next / 100) * 100;

  if (next < min) next = min;
  if (next > max) next = max;

  raiseAmountInput.value = next;
  raiseAmountText.textContent = formatNumber(next);
}

function updateRaiseUi(state) {
  if (!state) return;

  const min = Math.max(state.minRaiseAmount || 200, 200);
  const max = Math.max(state.myChips || min, min);

  raiseAmountInput.min = min;
  raiseAmountInput.max = max;
  raiseAmountInput.step = 100;

  let currentValue = Number(raiseAmountInput.value || min);
  currentValue = Math.round(currentValue / 100) * 100;

  if (currentValue < min) currentValue = min;
  if (currentValue > max) currentValue = max;

  setRaiseAmount(currentValue);
}

function updateLogPanelUi() {
  logPanel.classList.toggle("collapsed", isLogPanelCollapsed);
  toggleLogPanelBtn.textContent = isLogPanelCollapsed ? "펼치기" : "접기";
}

function getActionType(entry) {
  if (entry.includes("폴드")) return "fold";
  if (entry.includes("체크")) return "check";
  if (entry.includes("콜")) return "call";
  if (entry.includes("레이즈")) return "raise";
  if (entry.includes("올인")) return "allin";
  if (entry.includes("SB") || entry.includes("BB")) return "blind";
  return "system";
}

function parseLogEntry(entry) {
  const words = entry.trim().split(/\s+/);
  if (words.length === 0) {
    return { type: "system", name: "", action: entry, amount: "" };
  }

  const type = getActionType(entry);

  if (type === "system") {
    return { type, name: "", action: entry, amount: "" };
  }

  const name = words[0] || "";
  let action = "";
  let amount = "";

  if (entry.includes("체크")) action = "CHECK";
  else if (entry.includes("콜")) action = "CALL";
  else if (entry.includes("레이즈")) action = "RAISE";
  else if (entry.includes("폴드")) action = "FOLD";
  else if (entry.includes("올인")) action = "ALL-IN";
  else if (entry.includes("SB")) action = "SB";
  else if (entry.includes("BB")) action = "BB";

  const amountMatch = entry.match(/(\d[\d,]*)/g);
  if (amountMatch && amountMatch.length > 0) {
    amount = amountMatch[amountMatch.length - 1];
  }

  return { type, name, action, amount };
}

function renderLogRow(entry, options = {}) {
  const parsed = parseLogEntry(entry);
  const classes = ["log-row"];
  if (options.isLatest) classes.push("latest");
  if (options.isMine) classes.push("mine");
  if (options.isImportant) classes.push("important");

  if (parsed.type === "system") {
    return `
      <div class="${classes.join(" ")}">
        <span class="log-pill system">${entry}</span>
      </div>
    `;
  }

  const amountHtml = parsed.amount
    ? `<span class="log-pill amount">${parsed.amount}</span>`
    : "";

  return `
    <div class="${classes.join(" ")}">
      <span class="log-pill name">${parsed.name}</span>
      <span class="log-pill ${parsed.type}">${parsed.action}</span>
      ${amountHtml}
    </div>
  `;
}

function renderLogs(logs) {
  logBox.innerHTML = "";

  if (!logs || logs.length === 0) {
    logBox.innerHTML = `<div class="log-empty">아직 로그 없음</div>`;
    return;
  }

  let globalEntries = [];
  logs.forEach(group => {
    group.entries.forEach(entry => {
      globalEntries.push({ street: group.street, entry });
    });
  });

  const latestEntry = globalEntries.length > 0 ? globalEntries[globalEntries.length - 1].entry : "";

  logs.forEach((group) => {
    const streetDiv = document.createElement("div");
    streetDiv.className = "log-street-card";

    const entriesHtml = group.entries.length > 0
      ? group.entries.map((entry) => {
          const parsed = parseLogEntry(entry);
          const myName = latestState?.players?.find(p => p.isMe)?.name || "";
          return renderLogRow(entry, {
            isLatest: entry === latestEntry,
            isMine: !!myName && parsed.name === myName,
            isImportant: parsed.type === "raise" || parsed.type === "allin"
          });
        }).join("")
      : `<div class="log-empty">행동 없음</div>`;

    streetDiv.innerHTML = `
      <div class="log-street-header">
        <div class="log-street-title">${group.street}</div>
      </div>
      <div class="log-street-body">
        ${entriesHtml}
      </div>
    `;

    logBox.appendChild(streetDiv);
  });
}

function updateCallButton(state) {
  const need = Math.max((state.currentBet || 0) - (state.myRoundBet || 0), 0);
  callBtn.textContent = need === 0 ? "Check" : `Call ${formatNumber(need)}`;
}

function updateTurnBanner(state) {
  const turnName = state.currentTurnName || "-";
  turnBox.textContent = `현재 턴: ${turnName}`;
  turnBanner.textContent = `현재 턴: ${turnName}`;

  if (state.myTurn) {
    turnBanner.classList.add("active");
  } else {
    turnBanner.classList.remove("active");
  }
}

function updateRoomInfo() {
  if (!latestRoomInfo.inRoom) {
    roomInfoBox.textContent = "방: -";
    return;
  }

  const hostText = latestRoomInfo.hostName ? ` / 방장: ${latestRoomInfo.hostName}` : "";
  roomInfoBox.textContent = `방: ${latestRoomInfo.roomCode} (${latestRoomInfo.playerCount}명${hostText})`;
}

function updateBottomButtons(state) {
  const inRoom = latestRoomInfo.inRoom;
  const isHost = latestRoomInfo.isHost;
  const canAct = !!state.myTurn && inRoom;
  const canRaise = !!state.canRaise && inRoom;
  const handFinished = state.street === "리버완료";

  startBtn.disabled = !inRoom || !isHost || handFinished;
  leaveRoomBtn.disabled = !inRoom;

  foldBtn.disabled = !canAct || handFinished;
  callBtn.disabled = !canAct || handFinished;
  raiseBtn.disabled = !canRaise || handFinished;
  allInBtn.disabled = !canAct || handFinished || (state.myChips || 0) <= 0;

  if (handFinished) {
    showdownBtn.textContent = "다음 게임";
    showdownBtn.disabled = !inRoom || !isHost;
  } else {
    showdownBtn.textContent = "다음 게임";
    showdownBtn.disabled = true;
  }

  raiseAmountInput.disabled = !canRaise || handFinished;
}

function buildLastAction(entry, playerName) {
  if (!entry || !playerName) return { text: "", type: "" };
  if (!entry.startsWith(playerName + " ")) return { text: "", type: "" };

  const parsed = parseLogEntry(entry);
  if (parsed.type === "system" || parsed.type === "blind") return { text: parsed.action, type: parsed.type };

  return {
    text: parsed.action,
    type: parsed.type
  };
}

function getLatestPlayerActions(actionLogs) {
  const map = new Map();
  if (!actionLogs) return map;

  actionLogs.forEach(group => {
    group.entries.forEach(entry => {
      const parsed = parseLogEntry(entry);
      if (!parsed.name) return;
      map.set(parsed.name, entry);
    });
  });

  return map;
}

function getPlayerSeatCenter(playerName) {
  const seats = [...document.querySelectorAll(".player-seat")];
  const target = seats.find(seat => {
    const nameEl = seat.querySelector(".player-name");
    return nameEl && nameEl.textContent.startsWith(playerName);
  });

  if (!target || !chipFxLayer) return null;

  const layerRect = chipFxLayer.getBoundingClientRect();
  const rect = target.getBoundingClientRect();

  return {
    x: rect.left - layerRect.left + rect.width / 2,
    y: rect.top - layerRect.top + rect.height / 2
  };
}

function getPotCenter() {
  if (!chipFxLayer) return null;
  const potEl = document.getElementById("potCenterValue");
  if (!potEl) return null;

  const layerRect = chipFxLayer.getBoundingClientRect();
  const rect = potEl.getBoundingClientRect();

  return {
    x: rect.left - layerRect.left + rect.width / 2,
    y: rect.top - layerRect.top + rect.height / 2
  };
}

function spawnChipFlight(from, to, count = 4, options = {}) {
  const layer = ensureChipFxLayer();
  if (!layer || !from || !to) return;

  for (let i = 0; i < count; i++) {
    const chip = document.createElement("div");
    chip.className = `chip-fx ${options.big ? "big" : ""}`;
    chip.style.left = `${from.x + (Math.random() * 8 - 4)}px`;
    chip.style.top = `${from.y + (Math.random() * 8 - 4)}px`;

    const dx = to.x - from.x + (Math.random() * 10 - 5);
    const dy = to.y - from.y + (Math.random() * 10 - 5);

    chip.style.setProperty("--chip-dx", `${dx}px`);
    chip.style.setProperty("--chip-dy", `${dy}px`);
    chip.style.setProperty("--chip-duration", `${options.duration || 520}ms`);

    chip.classList.add("fly");
    layer.appendChild(chip);

    setTimeout(() => chip.remove(), (options.duration || 520) + 80);
  }
}

function runChipAnimations(prevState, nextState) {
  if (!prevState || !nextState) return;
  ensureChipFxLayer();

  const prevPot = Number(prevState.pot || 0);
  const nextPot = Number(nextState.pot || 0);

  // 베팅 칩 이동: 마지막 로그의 액터 -> 팟
  if (nextPot > prevPot) {
    const latestGroup = nextState.actionLogs?.[nextState.actionLogs.length - 1];
    const latestEntry = latestGroup?.entries?.[latestGroup.entries.length - 1] || "";
    const parsed = parseLogEntry(latestEntry);

    if (parsed.name) {
      const from = getPlayerSeatCenter(parsed.name);
      const to = getPotCenter();
      spawnChipFlight(from, to, parsed.type === "allin" ? 7 : 5, {
        duration: parsed.type === "allin" ? 620 : 500,
        big: parsed.type === "allin"
      });
    }
  }

  // 쇼다운 팟 이동: 팟 -> 승자
  const handFinishedNow =
    prevState.street !== "리버완료" && nextState.street === "리버완료";

  if (handFinishedNow && Array.isArray(nextState.winnerNames) && nextState.winnerNames.length > 0) {
    const pot = getPotCenter();
    nextState.winnerNames.forEach((winnerName, index) => {
      const to = getPlayerSeatCenter(winnerName);
      setTimeout(() => {
        spawnChipFlight(pot, to, 6, { duration: 700, big: true });
      }, index * 120);
    });
  }
}

function bindButtonPressFx() {
  const buttons = [
    createRoomBtn, joinRoomBtn, leaveRoomBtn, startBtn,
    foldBtn, callBtn, raiseBtn, allInBtn, showdownBtn, toggleLogPanelBtn
  ].filter(Boolean);

  buttons.forEach(btn => {
    if (btn.dataset.pressFxBound === "1") return;
    btn.dataset.pressFxBound = "1";

    const add = () => btn.classList.add("pressed");
    const remove = () => btn.classList.remove("pressed");

    btn.addEventListener("pointerdown", add);
    btn.addEventListener("pointerup", remove);
    btn.addEventListener("pointerleave", remove);
    btn.addEventListener("pointercancel", remove);
  });
}

function renderState(state) {
  latestState = state;
  updateRaiseUi(state);
  updateCallButton(state);
  updateTurnBanner(state);
  updateLogPanelUi();
  updateRoomInfo();

  potBox.textContent = `팟: ${formatNumber(state.pot)}`;
  potCenterValue.textContent = formatNumber(state.pot);
  streetBox.textContent = `단계: ${state.street}`;
  resultBox.textContent = state.result || "";

  renderLogs(state.actionLogs);

  playersLayer.innerHTML = "";

  const positions = getSeatPositions(state.players.length);
  const winnerNames = state.winnerNames || [];
  const latestPlayerActions = getLatestPlayerActions(state.actionLogs);

  state.players.forEach((p, index) => {
    const seat = positions[index];
    const wrap = document.createElement("div");
    wrap.className = "player-seat";

    if (p.isCurrentTurn) wrap.classList.add("current-turn");
    if (p.folded) wrap.classList.add("folded");
    if (winnerNames.includes(p.name)) wrap.classList.add("winner");

    wrap.style.left = `${seat.left}%`;
    wrap.style.top = `${seat.top}%`;

    const badges = [];
    if (p.positionLabel) badges.push(`<span class="badge">${p.positionLabel}</span>`);
    if (p.isDealer) badges.push(`<span class="badge dealer">D</span>`);
    if (p.isSmallBlind) badges.push(`<span class="badge sb">SB</span>`);
    if (p.isBigBlind) badges.push(`<span class="badge bb">BB</span>`);

    const handInfo = p.handName || "";
    const potWinInfo = p.potWinText || "";
    const roundBetInfo = p.roundBetText || "";
    const chipChange = p.chipChangeText || "";
    const chipColor =
      p.chipChangeValue > 0 ? "#86efac" :
      p.chipChangeValue < 0 ? "#fca5a5" :
      "#e5e7eb";

    const lastActionEntry = latestPlayerActions.get(p.name) || "";
    const lastAction = buildLastAction(lastActionEntry, p.name);

    const turnBadgeHtml = p.isCurrentTurn
      ? `<div class="current-turn-badge">CURRENT TURN</div>`
      : "";

    const winnerBadgeHtml = winnerNames.includes(p.name)
      ? `<div class="winner-badge">WINNER</div>`
      : "";

    const crownHtml = winnerNames.includes(p.name)
      ? `<span class="winner-crown">👑</span>`
      : "";

    const lastActionHtml = lastAction.text
      ? `<div class="player-last-action ${lastAction.type}">${lastAction.text}</div>`
      : "";

    wrap.innerHTML = `
      <div class="player-card">
        <div class="player-name-row">
          <div class="player-name">${p.name}${p.isMe ? " (나)" : ""}</div>
          ${crownHtml}
        </div>

        <div class="player-chip-row">
          <span class="player-chip-pill">칩 ${formatNumber(p.chips)}</span>
        </div>

        ${turnBadgeHtml}
        ${winnerBadgeHtml}

        <div class="player-badges">${badges.join("")}</div>

        <div class="player-cards">
          <div class="${p.cardsVisible ? "small-card" : "hidden-card"}">${formatCardHtml(p.cards[0], p.cardsVisible)}</div>
          <div class="${p.cardsVisible ? "small-card" : "hidden-card"}">${formatCardHtml(p.cards[1], p.cardsVisible)}</div>
        </div>

        ${lastActionHtml}
        <div class="player-extra">${roundBetInfo}</div>
        <div class="player-extra">${handInfo}</div>
        <div class="player-extra">${potWinInfo}</div>
        <div class="player-delta" style="color:${chipColor};">
          ${chipChange}
        </div>
      </div>
    `;

    playersLayer.appendChild(wrap);
  });

  const slots = document.querySelectorAll(".card-slot");

  slots.forEach((slot, i) => {
    const card = state.community[i] || "";
    if (card && previousCommunity[i] !== card) {
      slot.classList.remove("card-appear");
      void slot.offsetWidth;
      slot.classList.add("card-appear");
    }
    slot.innerHTML = card ? formatCardHtml(card, true) : "";
  });

  previousCommunity = [...state.community];

  updateBottomButtons(state);
  bindButtonPressFx();

  requestAnimationFrame(() => {
    runChipAnimations(previousStateForFx, state);
    previousStateForFx = JSON.parse(JSON.stringify(state));
  });
}

raiseAmountInput.addEventListener("input", () => {
  setRaiseAmount(raiseAmountInput.value);
});

toggleLogPanelBtn.onclick = () => {
  isLogPanelCollapsed = !isLogPanelCollapsed;
  updateLogPanelUi();
};

window.addEventListener("resize", () => {
  if (latestState) renderState(latestState);
});

createRoomBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) {
    alert("이름을 입력하세요");
    return;
  }
  socket.emit("createRoom", { name });
};

joinRoomBtn.onclick = () => {
  const name = nameInput.value.trim();
  const roomCode = roomCodeInput.value.trim().toUpperCase();

  if (!name) {
    alert("이름을 입력하세요");
    return;
  }
  if (!roomCode) {
    alert("방 코드를 입력하세요");
    return;
  }

  socket.emit("joinRoom", { roomCode, name });
};

leaveRoomBtn.onclick = () => {
  socket.emit("leaveRoom");
};

startBtn.onclick = () => socket.emit("startGame");
foldBtn.onclick = () => socket.emit("fold");
callBtn.onclick = () => socket.emit("call");
raiseBtn.onclick = () => socket.emit("raise", Number(raiseAmountInput.value));
allInBtn.onclick = () => socket.emit("allIn");

showdownBtn.onclick = () => {
  if (!latestState) return;
  if (latestState.street === "리버완료") {
    socket.emit("nextHand");
  }
};

socket.on("roomInfo", (roomInfo) => {
  latestRoomInfo = roomInfo;
  updateRoomInfo();

  if (!roomInfo.inRoom) {
    playersLayer.innerHTML = "";
    resultBox.textContent = "";
    potBox.textContent = "팟: 0";
    potCenterValue.textContent = "0";
    turnBox.textContent = "현재 턴: -";
    turnBanner.textContent = "현재 턴: -";
    streetBox.textContent = "단계: 대기중";
    logBox.innerHTML = `<div class="log-empty">방에 입장하면 로그가 표시됩니다</div>`;

    startBtn.disabled = true;
    leaveRoomBtn.disabled = true;
    foldBtn.disabled = true;
    callBtn.disabled = true;
    raiseBtn.disabled = true;
    allInBtn.disabled = true;
    showdownBtn.disabled = true;
    showdownBtn.textContent = "다음 게임";
    raiseAmountInput.disabled = true;
  }
});

socket.on("joinRoomError", (message) => {
  alert(message);
});

socket.on("state", (state) => {
  renderState(state);
});