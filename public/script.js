const socket = io();
const CLIENT_ID_STORAGE_KEY = "pokerAppClientId";

function createClientId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getClientId() {
  let clientId = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
  if (!clientId) {
    clientId = createClientId();
    localStorage.setItem(CLIENT_ID_STORAGE_KEY, clientId);
  }
  return clientId;
}

const clientId = getClientId();

const createRoomBtn = document.getElementById("createRoomBtn");
const joinRoomBtn = document.getElementById("joinRoomBtn");
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
const potCenterValue = document.getElementById("potCenterValue");
const roomInfoBox = document.getElementById("roomInfoBox");
const blindBox = document.getElementById("blindBox");

const nameInput = document.getElementById("name");
const roomCodeInput = document.getElementById("roomCodeInput");
const raiseAmountInput = document.getElementById("raiseAmount");
const raiseAmountText = document.getElementById("raiseAmountText");

const smallBlindInput = document.getElementById("smallBlindInput");
const bigBlindInput = document.getElementById("bigBlindInput");
const playerChipSettings = document.getElementById("playerChipSettings");

const revealDecisionModal = document.getElementById("revealDecisionModal");
const revealDecisionTitle = document.getElementById("revealDecisionTitle");
const revealDecisionMessage = document.getElementById("revealDecisionMessage");
const revealDecisionButtons = document.getElementById("revealDecisionButtons");
const revealDecisionWaiting = document.getElementById("revealDecisionWaiting");
const revealHandBtn = document.getElementById("revealHandBtn");
const hideHandBtn = document.getElementById("hideHandBtn");

const HEARTBEAT_INTERVAL_MS = 25000;
const OPPONENT_AVATAR_DEFAULT = "assets/player-default.png";
const OPPONENT_AVATAR_WIN = "assets/player-win.jpeg";
const OPPONENT_AVATAR_LOSE = "assets/player-lose.webp";

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

function sendKeepAlive() {
  if (socket.connected) {
    socket.emit("clientHeartbeat", { clientId, sentAt: Date.now() });
  }

  fetch(`/healthz?t=${Date.now()}`, {
    cache: "no-store",
    keepalive: true
  }).catch(() => {});
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
    const seats = [{ left: 50, top: 86 }];
    const opponentCount = Math.max(count - 1, 0);
    const startAngle = 200;
    const endAngle = 340;
    const centerX = 50;
    const centerY = 50;
    const radiusX = 42;
    const radiusY = 40;

    for (let i = 0; i < opponentCount; i += 1) {
      const ratio = opponentCount === 1 ? 0.5 : i / (opponentCount - 1);
      const angle = (startAngle + (endAngle - startAngle) * ratio) * Math.PI / 180;
      seats.push({
        left: Number((centerX + radiusX * Math.cos(angle)).toFixed(1)),
        top: Number((centerY + radiusY * Math.sin(angle)).toFixed(1))
      });
    }

    return seats;
  }

  const desktopMap = {
    2: [{ left: 50, top: 88 }, { left: 50, top: 14 }],
    3: [{ left: 50, top: 88 }, { left: 20, top: 20 }, { left: 80, top: 20 }],
    4: [{ left: 50, top: 88 }, { left: 17, top: 64 }, { left: 17, top: 20 }, { left: 83, top: 20 }],
    5: [{ left: 50, top: 88 }, { left: 17, top: 69 }, { left: 19, top: 24 }, { left: 50, top: 14 }, { left: 81, top: 24 }],
    6: [{ left: 50, top: 88 }, { left: 16, top: 70 }, { left: 16, top: 36 }, { left: 33, top: 16 }, { left: 67, top: 16 }, { left: 84, top: 36 }],
    7: [{ left: 50, top: 88 }, { left: 16, top: 72 }, { left: 15, top: 44 }, { left: 20, top: 20 }, { left: 50, top: 13 }, { left: 80, top: 20 }, { left: 85, top: 44 }],
    8: [{ left: 50, top: 88 }, { left: 16, top: 74 }, { left: 14, top: 50 }, { left: 17, top: 24 }, { left: 35, top: 14 }, { left: 65, top: 14 }, { left: 83, top: 24 }, { left: 86, top: 50 }]
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

function updateCallButton(state) {
  const need = Math.max((state.currentBet || 0) - (state.myRoundBet || 0), 0);
  if (need === 0) {
    callBtn.textContent = "Check";
    return;
  }

  if (need > (state.myChips || 0)) {
    callBtn.textContent = `All-in Call ${formatNumber(state.myChips)}`;
    return;
  }

  callBtn.textContent = `Call ${formatNumber(need)}`;
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

  smallBlindInput.value = latestRoomInfo.settings.smallBlind;
  bigBlindInput.value = latestRoomInfo.settings.bigBlind;
}

function updateSettingsControls(state) {
  const inRoom = latestRoomInfo.inRoom;
  const isHost = latestRoomInfo.isHost;
  const pendingReveal = !!state.revealDecision?.pending;
  const canEdit = inRoom && isHost && !pendingReveal && state.street === "대기중";

  smallBlindInput.disabled = !canEdit;
  bigBlindInput.disabled = !canEdit;
  applySettingsBtn.disabled = !canEdit;
}

function renderPlayerChipSettings(state) {
  if (!playerChipSettings) return;

  const canEdit =
    latestRoomInfo.inRoom &&
    latestRoomInfo.isHost &&
    !state.revealDecision?.pending &&
    state.street === "대기중";

  playerChipSettings.classList.toggle("hidden", !canEdit);
  if (!canEdit) {
    playerChipSettings.innerHTML = "";
    return;
  }

  playerChipSettings.innerHTML = state.players.map((player) => `
    <label class="player-chip-setting">
      <span>${player.name}</span>
      <input
        class="player-starting-chip-input"
        data-player-id="${player.id}"
        type="number"
        min="1000"
        step="100"
        value="${player.startingChips || player.chips}"
      >
    </label>
  `).join("");
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

  const text = parsed.amount ? `${parsed.action} ${parsed.amount}` : parsed.action;
  return { text, type: parsed.type };
}

function getOpponentAvatarSrc(player, state, winnerNames) {
  if (state.street !== "리버완료") return OPPONENT_AVATAR_DEFAULT;
  return winnerNames.includes(player.name) ? OPPONENT_AVATAR_WIN : OPPONENT_AVATAR_LOSE;
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

  if (!reveal || !reveal.pending) {
    revealDecisionModal.classList.add("hidden");
    return;
  }

  revealDecisionModal.classList.remove("hidden");
  revealDecisionTitle.textContent = reveal.title || "쇼다운";

  if (reveal.canDecide) {
    revealDecisionMessage.textContent = reveal.message || "";
    revealDecisionButtons.classList.remove("hidden");
    revealDecisionWaiting.classList.add("hidden");
  } else {
    revealDecisionButtons.classList.add("hidden");
    revealDecisionWaiting.classList.remove("hidden");
    revealDecisionWaiting.textContent = reveal.waitingMessage || "상대가 선택 중입니다";
    revealDecisionMessage.textContent = "";
  }
}

function renderState(state) {
  latestState = state;
  updateRaiseUi(state);
  updateCallButton(state);
  updateRoomInfo();
  updateRevealModal(state);
  renderPlayerChipSettings(state);

  potCenterValue.textContent = formatNumber(state.pot);
  resultBox.textContent = state.result || "";

  playersLayer.innerHTML = "";

  const orderedPlayers = [...state.players];
  const meIndex = orderedPlayers.findIndex((p) => p.isMe);
  if (meIndex > 0) {
    orderedPlayers.push(...orderedPlayers.splice(0, meIndex));
  }

  const positions = getSeatPositions(orderedPlayers.length);
  const winnerNames = state.winnerNames || [];
  const latestPlayerActions = getLatestPlayerActions(state.actionLogs);

  orderedPlayers.forEach((p, index) => {
    const seat = positions[index];
    const wrap = document.createElement("div");
    wrap.className = "player-seat";

    if (p.isMe) wrap.classList.add("me-seat");
    if (p.cardsVisible) wrap.classList.add("cards-visible");
    if (p.isCurrentTurn) wrap.classList.add("current-turn");
    if (p.folded) wrap.classList.add("folded");
    if (winnerNames.includes(p.name)) wrap.classList.add("winner");

    wrap.style.left = `${seat.left}%`;
    wrap.style.top = `${seat.top}%`;

    let positionBadge = "";
    if (p.isSmallBlind) positionBadge = `<span class="badge sb">SB</span>`;
    else if (p.isBigBlind) positionBadge = `<span class="badge bb">BB</span>`;
    else if (p.isDealer) positionBadge = `<span class="badge dealer">D</span>`;
    else if (p.positionLabel) positionBadge = `<span class="badge">${p.positionLabel}</span>`;

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

    if (!p.isMe) {
      const opponentAvatarSrc = getOpponentAvatarSrc(p, state, winnerNames);
      const opponentCardsHtml = p.cardsVisible
        ? `
          <div class="opponent-avatar-cards">
            <div class="small-card">${formatCardHtml(p.cards[0], true)}</div>
            <div class="small-card">${formatCardHtml(p.cards[1], true)}</div>
          </div>
        `
        : "";

      wrap.innerHTML = `
        <div class="opponent-avatar-card">
          <img class="opponent-avatar-img" src="${opponentAvatarSrc}" alt="${p.name}">
          <div class="opponent-avatar-info">
            <div class="opponent-avatar-name">${p.name}</div>
            <div class="opponent-avatar-chips">${formatNumber(p.chips)}</div>
          </div>
          <div class="player-badges">${positionBadge}</div>
          ${opponentCardsHtml}
          ${lastActionHtml}
          ${winnerBadgeHtml}
        </div>
      `;

      playersLayer.appendChild(wrap);
      return;
    }

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

        <div class="player-badges">${positionBadge}</div>

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

applySettingsBtn.onclick = () => {
  const smallBlind = Number(smallBlindInput.value);
  const bigBlind = Number(bigBlindInput.value);
  const playerStartingChips = [...document.querySelectorAll(".player-starting-chip-input")].map((input) => ({
    playerId: input.dataset.playerId,
    chips: Number(input.value)
  }));

  if (!Number.isFinite(smallBlind) || smallBlind < 1) {
    alert("SB는 1 이상이어야 합니다");
    return;
  }
  if (!Number.isFinite(bigBlind) || bigBlind < smallBlind) {
    alert("BB는 SB 이상이어야 합니다");
    return;
  }
  if (playerStartingChips.some((entry) => !Number.isFinite(entry.chips) || entry.chips < 1000)) {
    alert("각 플레이어 시작칩은 1000 이상이어야 합니다");
    return;
  }

  socket.emit("updateSettings", { smallBlind, bigBlind, playerStartingChips });
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
  socket.emit("createRoom", { name, clientId });
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

  socket.emit("joinRoom", { roomCode, name, clientId });
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
    potCenterValue.textContent = "0";
    blindBox.textContent = `블라인드: ${formatNumber(roomInfo.settings.smallBlind)} / ${formatNumber(roomInfo.settings.bigBlind)}`;
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

    smallBlindInput.value = roomInfo.settings.smallBlind;
    bigBlindInput.value = roomInfo.settings.bigBlind;

    smallBlindInput.disabled = true;
    bigBlindInput.disabled = true;
    applySettingsBtn.disabled = true;
    if (playerChipSettings) {
      playerChipSettings.classList.add("hidden");
      playerChipSettings.innerHTML = "";
    }
  }
});

socket.on("joinRoomError", (message) => {
  alert(message);
});

socket.on("connect", () => {
  socket.emit("resumeSession", { clientId });
  sendKeepAlive();
});

if (socket.connected) {
  socket.emit("resumeSession", { clientId });
  sendKeepAlive();
}

setInterval(sendKeepAlive, HEARTBEAT_INTERVAL_MS);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    sendKeepAlive();
  }
});

socket.on("state", (state) => {
  renderState(state);
});
