const socket = io();

const createRoomBtn = document.getElementById("createRoomBtn");
const leaveRoomBtn = document.getElementById("leaveRoomBtn");
const startBtn = document.getElementById("startBtn");
const foldBtn = document.getElementById("foldBtn");
const callBtn = document.getElementById("callBtn");
const raiseBtn = document.getElementById("raiseBtn");
const allInBtn = document.getElementById("allInBtn");
const showdownBtn = document.getElementById("showdownBtn");
const applySettingsBtn = document.getElementById("applySettingsBtn");

const playersLayer = document.getElementById("playersLayer");
const resultBox = document.getElementById("resultBox");
const potBox = document.getElementById("potBox");
const potCenterValue = document.getElementById("potCenterValue");
const turnBox = document.getElementById("turnBox");
const turnBanner = document.getElementById("turnBanner");
const streetBox = document.getElementById("streetBox");
const roomInfoBox = document.getElementById("roomInfoBox");
const blindBox = document.getElementById("blindBox");
const logBox = document.getElementById("logBox");
const logPanel = document.getElementById("logPanel");
const toggleLogPanelBtn = document.getElementById("toggleLogPanelBtn");

const nameInput = document.getElementById("name");
const roomCodeInput = document.getElementById("roomCodeInput");
const raiseAmountInput = document.getElementById("raiseAmount");
const raiseAmountText = document.getElementById("raiseAmountText");

const startingChipsInput = document.getElementById("startingChipsInput");
const smallBlindInput = document.getElementById("smallBlindInput");
const bigBlindInput = document.getElementById("bigBlindInput");

const revealDecisionModal = document.getElementById("revealDecisionModal");
const revealDecisionTitle = document.getElementById("revealDecisionTitle");
const revealDecisionMessage = document.getElementById("revealDecisionMessage");
const revealDecisionButtons = document.getElementById("revealDecisionButtons");
const revealDecisionWaiting = document.getElementById("revealDecisionWaiting");
const revealHandBtn = document.getElementById("revealHandBtn");
const hideHandBtn = document.getElementById("hideHandBtn");

let previousCommunity = ["", "", "", "", ""];
let latestState = null;
let latestRoomInfo = {
  inRoom: false,
  roomCode: "",
  playerCount: 0,
  isHost: false,
  hostName: "",
  settings: {
    startingChips: 10000,
    smallBlind: 100,
    bigBlind: 200
  }
};
let isLogPanelCollapsed = false;

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
    window.innerWidth <= 900 &&
    window.innerHeight > window.innerWidth;

  /* ==================================================
     모바일 세로 전용 좌석 (안쪽으로 강하게 당김)
     ================================================== */
  if (isPortraitMobile) {
    const portraitMap = {
      2: [
        { left: 50, top: 84 },
        { left: 50, top: 14 }
      ],

      3: [
        { left: 50, top: 84 },
        { left: 24, top: 18 },
        { left: 76, top: 18 }
      ],

      4: [
        { left: 50, top: 84 },
        { left: 20, top: 54 },
        { left: 20, top: 18 },
        { left: 80, top: 18 }
      ],

      5: [
        { left: 50, top: 84 },
        { left: 18, top: 58 },
        { left: 18, top: 30 },
        { left: 50, top: 12 },
        { left: 82, top: 30 }
      ],

      6: [
        { left: 50, top: 84 },
        { left: 18, top: 62 },
        { left: 18, top: 40 },
        { left: 18, top: 18 },
        { left: 82, top: 18 },
        { left: 82, top: 40 }
      ],

      7: [
        { left: 50, top: 84 },
        { left: 18, top: 64 },
        { left: 18, top: 46 },
        { left: 18, top: 26 },
        { left: 50, top: 10 },
        { left: 82, top: 26 },
        { left: 82, top: 46 }
      ],

      8: [
        { left: 50, top: 84 },
        { left: 18, top: 66 },
        { left: 18, top: 50 },
        { left: 18, top: 32 },
        { left: 28, top: 12 },
        { left: 72, top: 12 },
        { left: 82, top: 32 },
        { left: 82, top: 50 }
      ]
    };

    return portraitMap[count] || portraitMap[8];
  }

  /* ==================================================
     가로 / 데스크탑
     ================================================== */
  const desktopMap = {
    2: [
      { left: 50, top: 88 },
      { left: 50, top: 14 }
    ],

    3: [
      { left: 50, top: 88 },
      { left: 20, top: 20 },
      { left: 80, top: 20 }
    ],

    4: [
      { left: 50, top: 88 },
      { left: 17, top: 64 },
      { left: 17, top: 20 },
      { left: 83, top: 20 }
    ],

    5: [
      { left: 50, top: 88 },
      { left: 17, top: 69 },
      { left: 19, top: 24 },
      { left: 50, top: 14 },
      { left: 81, top: 24 }
    ],

    6: [
      { left: 50, top: 88 },
      { left: 16, top: 70 },
      { left: 16, top: 36 },
      { left: 33, top: 16 },
      { left: 67, top: 16 },
      { left: 84, top: 36 }
    ],

    7: [
      { left: 50, top: 88 },
      { left: 16, top: 72 },
      { left: 15, top: 44 },
      { left: 20, top: 20 },
      { left: 50, top: 13 },
      { left: 80, top: 20 },
      { left: 85, top: 44 }
    ],

    8: [
      { left: 50, top: 88 },
      { left: 16, top: 74 },
      { left: 14, top: 50 },
      { left: 17, top: 24 },
      { left: 35, top: 14 },
      { left: 65, top: 14 },
      { left: 83, top: 24 },
      { left: 86, top: 50 }
    ]
  };

  return desktopMap[count] || desktopMap[8];
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

  const min = Math.max(state.minRaiseAmount || state.settings.bigBlind || 200, 200);
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
  if (amountMatch && amountMatch.length > 0) amount = amountMatch[amountMatch.length - 1];

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
    group.entries.forEach(entry => globalEntries.push({ street: group.street, entry }));
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
}

function updateRoomInfo() {
  if (!latestRoomInfo.inRoom) {
    roomInfoBox.textContent = "방: -";
    blindBox.textContent = `블라인드: ${formatNumber(latestRoomInfo.settings.smallBlind)} / ${formatNumber(latestRoomInfo.settings.bigBlind)}`;
    return;
  }

  const hostText = latestRoomInfo.hostName ? ` / 방장: ${latestRoomInfo.hostName}` : "";
  roomInfoBox.textContent = `방: ${latestRoomInfo.roomCode} (${latestRoomInfo.playerCount}명${hostText})`;
  blindBox.textContent = `블라인드: ${formatNumber(latestRoomInfo.settings.smallBlind)} / ${formatNumber(latestRoomInfo.settings.bigBlind)}`;

  startingChipsInput.value = latestRoomInfo.settings.startingChips;
  smallBlindInput.value = latestRoomInfo.settings.smallBlind;
  bigBlindInput.value = latestRoomInfo.settings.bigBlind;
}

function updateSettingsControls(state) {
  const inRoom = latestRoomInfo.inRoom;
  const isHost = latestRoomInfo.isHost;
  const pendingReveal = !!state.revealDecision?.pending;
  const canEdit = inRoom && isHost && !pendingReveal && (state.street === "대기중" || state.street === "리버완료");

  startingChipsInput.disabled = !canEdit;
  smallBlindInput.disabled = !canEdit;
  bigBlindInput.disabled = !canEdit;
  applySettingsBtn.disabled = !canEdit;
}

function updateBottomButtons(state) {
  const inRoom = latestRoomInfo.inRoom;
  const isHost = latestRoomInfo.isHost;
  const canAct = !!state.myTurn && inRoom && !state.revealDecision?.pending;
  const canRaise = !!state.canRaise && inRoom && !state.revealDecision?.pending;
  const handFinished = state.street === "리버완료";
  const pendingReveal = !!state.revealDecision?.pending;

  startBtn.disabled = !inRoom || !isHost || handFinished || pendingReveal;
  leaveRoomBtn.disabled = !inRoom;

  foldBtn.disabled = !canAct || handFinished;
  callBtn.disabled = !canAct || handFinished;
  raiseBtn.disabled = !canRaise || handFinished;
  allInBtn.disabled = !canAct || handFinished || (state.myChips || 0) <= 0;

  if (handFinished) {
    showdownBtn.textContent = "다음 게임";
    showdownBtn.disabled = !inRoom || !isHost || pendingReveal;
  } else {
    showdownBtn.textContent = "다음 게임";
    showdownBtn.disabled = true;
  }

  raiseAmountInput.disabled = !canRaise || handFinished;
  updateSettingsControls(state);
}

function buildLastAction(entry, playerName) {
  if (!entry || !playerName) return { text: "", type: "" };
  if (!entry.startsWith(playerName + " ")) return { text: "", type: "" };

  const parsed = parseLogEntry(entry);
  if (parsed.type === "system" || parsed.type === "blind") return { text: parsed.action, type: parsed.type };

  return { text: parsed.action, type: parsed.type };
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

function updateRevealModal(state) {
  const reveal = state.revealDecision;

  if (!reveal || !reveal.pending || !reveal.canDecide) {
    revealDecisionModal.classList.add("hidden");
    return;
  }

  revealDecisionModal.classList.remove("hidden");
  revealDecisionTitle.textContent = reveal.title || "쇼다운";
  revealDecisionMessage.textContent = reveal.message || "";

  revealDecisionButtons.classList.remove("hidden");
  revealDecisionWaiting.classList.add("hidden");
  revealDecisionWaiting.textContent = "";
}

function renderState(state) {
  latestState = state;
  updateRaiseUi(state);
  updateCallButton(state);
  updateTurnBanner(state);
  updateLogPanelUi();
  updateRoomInfo();
  updateRevealModal(state);

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
}

raiseAmountInput.addEventListener("input", () => {
  setRaiseAmount(raiseAmountInput.value);
});

toggleLogPanelBtn.onclick = () => {
  isLogPanelCollapsed = !isLogPanelCollapsed;
  updateLogPanelUi();
};

applySettingsBtn.onclick = () => {
  const startingChips = Number(startingChipsInput.value);
  const smallBlind = Number(smallBlindInput.value);
  const bigBlind = Number(bigBlindInput.value);

  if (!Number.isFinite(startingChips) || startingChips < 1000) {
    alert("시작칩은 1000 이상이어야 합니다");
    return;
  }
  if (!Number.isFinite(smallBlind) || smallBlind < 1) {
    alert("SB는 1 이상이어야 합니다");
    return;
  }
  if (!Number.isFinite(bigBlind) || bigBlind < smallBlind) {
    alert("BB는 SB 이상이어야 합니다");
    return;
  }

  socket.emit("updateSettings", { startingChips, smallBlind, bigBlind });
};

revealHandBtn.onclick = () => {
  socket.emit("chooseHandReveal", { action: "reveal" });
};

hideHandBtn.onclick = () => {
  socket.emit("chooseHandReveal", { action: "hide" });
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
  if (latestState.street === "리버완료" && !latestState.revealDecision?.pending) {
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
    blindBox.textContent = `블라인드: ${formatNumber(roomInfo.settings.smallBlind)} / ${formatNumber(roomInfo.settings.bigBlind)}`;
    logBox.innerHTML = `<div class="log-empty">방에 입장하면 로그가 표시됩니다</div>`;
    revealDecisionModal.classList.add("hidden");

    startBtn.disabled = true;
    leaveRoomBtn.disabled = true;
    foldBtn.disabled = true;
    callBtn.disabled = true;
    raiseBtn.disabled = true;
    allInBtn.disabled = true;
    showdownBtn.disabled = true;
    showdownBtn.textContent = "다음 게임";
    raiseAmountInput.disabled = true;

    startingChipsInput.value = roomInfo.settings.startingChips;
    smallBlindInput.value = roomInfo.settings.smallBlind;
    bigBlindInput.value = roomInfo.settings.bigBlind;

    startingChipsInput.disabled = true;
    smallBlindInput.disabled = true;
    bigBlindInput.disabled = true;
    applySettingsBtn.disabled = true;
  }
});

socket.on("joinRoomError", (message) => {
  alert(message);
});

socket.on("state", (state) => {
  renderState(state);
});