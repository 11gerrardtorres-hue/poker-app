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

const minRaisePresetBtn = document.getElementById("minRaisePresetBtn");
const x2PresetBtn = document.getElementById("x2PresetBtn");
const x3PresetBtn = document.getElementById("x3PresetBtn");
const potPresetBtn = document.getElementById("potPresetBtn");
const allInPresetBtn = document.getElementById("allInPresetBtn");

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
let latestRoomInfo = { inRoom: false, roomCode: "", playerCount: 0 };
let isLogPanelCollapsed = false;
const collapsedStreetSet = new Set();

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
  if (currentValue < min) currentValue = min;
  if (currentValue > max) currentValue = max;

  setRaiseAmount(currentValue);
}

function updateLogPanelUi() {
  logPanel.classList.toggle("collapsed", isLogPanelCollapsed);
  toggleLogPanelBtn.textContent = isLogPanelCollapsed ? "펼치기" : "접기";
}

function toggleStreetCard(cardKey) {
  if (collapsedStreetSet.has(cardKey)) collapsedStreetSet.delete(cardKey);
  else collapsedStreetSet.add(cardKey);
}

function renderLogs(logs) {
  logBox.innerHTML = "";

  if (!logs || logs.length === 0) {
    logBox.innerHTML = `<div class="log-empty">아직 로그 없음</div>`;
    return;
  }

  const latestIndex = logs.length - 1;

  logs.forEach((group, index) => {
    const cardKey = `${group.street}-${index}`;

    if (index !== latestIndex && !collapsedStreetSet.has(cardKey) && collapsedStreetSet.size === 0) {
      collapsedStreetSet.add(cardKey);
    }

    const isCollapsed = collapsedStreetSet.has(cardKey);
    const streetDiv = document.createElement("div");
    streetDiv.className = `log-street-card ${isCollapsed ? "collapsed" : ""}`;

    const entriesHtml = group.entries.length > 0
      ? group.entries.map((entry) => `<div class="log-entry">${entry}</div>`).join("")
      : `<div class="log-empty">행동 없음</div>`;

    streetDiv.innerHTML = `
      <div class="log-street-header" data-street-key="${cardKey}">
        <div>
          <div class="log-street-title">${group.street}</div>
          <div class="log-street-meta">${group.entries.length}개 로그</div>
        </div>
        <button class="log-street-toggle" type="button">${isCollapsed ? "펼치기" : "접기"}</button>
      </div>
      <div class="log-street-body">
        ${entriesHtml}
      </div>
    `;

    const header = streetDiv.querySelector(".log-street-header");
    header.onclick = () => {
      toggleStreetCard(cardKey);
      renderLogs(logs);
    };

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
    return;
  }
  roomInfoBox.textContent = `방: ${latestRoomInfo.roomCode} (${latestRoomInfo.playerCount}명)`;
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

    wrap.innerHTML = `
      <div class="player-card">
        <div><b>${p.name}${p.isMe ? " (나)" : ""}</b></div>
        <div>칩: ${formatNumber(p.chips)}</div>
        <div class="player-badges">${badges.join("")}</div>

        <div class="player-cards">
          <div class="${p.cardsVisible ? "small-card" : "hidden-card"}">${formatCardHtml(p.cards[0], p.cardsVisible)}</div>
          <div class="${p.cardsVisible ? "small-card" : "hidden-card"}">${formatCardHtml(p.cards[1], p.cardsVisible)}</div>
        </div>

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

  const inRoom = latestRoomInfo.inRoom;
  const canAct = !!state.myTurn && inRoom;
  const canRaise = !!state.canRaise && inRoom;

  startBtn.disabled = !inRoom;
  leaveRoomBtn.disabled = !inRoom;

  foldBtn.disabled = !canAct;
  callBtn.disabled = !canAct;
  raiseBtn.disabled = !canRaise;
  allInBtn.disabled = !canAct || (state.myChips || 0) <= 0;
  showdownBtn.disabled = state.street !== "리버완료" || !inRoom;

  minRaisePresetBtn.disabled = !canRaise;
  x2PresetBtn.disabled = !canRaise;
  x3PresetBtn.disabled = !canRaise;
  potPresetBtn.disabled = !canRaise;
  allInPresetBtn.disabled = !canAct || (state.myChips || 0) <= 0;
}

raiseAmountInput.addEventListener("input", () => {
  raiseAmountText.textContent = formatNumber(raiseAmountInput.value);
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
showdownBtn.onclick = () => socket.emit("showdown");

minRaisePresetBtn.onclick = () => {
  if (!latestState) return;
  setRaiseAmount(latestState.minRaiseAmount || 200);
};

x2PresetBtn.onclick = () => {
  if (!latestState) return;
  const value = Math.max((latestState.currentBet || 0) * 2, latestState.minRaiseAmount || 200);
  setRaiseAmount(value);
};

x3PresetBtn.onclick = () => {
  if (!latestState) return;
  const value = Math.max((latestState.currentBet || 0) * 3, latestState.minRaiseAmount || 200);
  setRaiseAmount(value);
};

potPresetBtn.onclick = () => {
  if (!latestState) return;
  setRaiseAmount(latestState.pot || latestState.minRaiseAmount || 200);
};

allInPresetBtn.onclick = () => {
  if (!latestState) return;
  setRaiseAmount(latestState.myChips || latestState.minRaiseAmount || 200);
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
  }
});

socket.on("joinRoomError", (message) => {
  alert(message);
});

socket.on("state", (state) => {
  renderState(state);
});