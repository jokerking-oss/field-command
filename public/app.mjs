import {
  UNITS,
  TERRAINS,
  COMMANDERS,
  MAPS,
  createGame,
  reachable,
  attackable,
  previewCombat,
} from "./shared/engine.mjs";
import { createRenderer, TEAM_COLORS, TEAM_PALETTES } from "./renderer.mjs";
import { unitPortraitDataUrl } from "./unit-portrait.mjs";
import {
  mapsForPlayerCount,
  unitsForFacility,
  specialCommands,
  moveCommandAction,
} from "./shared/ui-options.mjs";
import { paintCombatScene, COMBAT_TIMING, combatDuration } from "./combat-scene.mjs";
import { commandMenuPosition } from "./shared/hud-layout.mjs";
import {
  HERO_FADE_OUT_MS,
  HERO_PERIOD,
  createHeroScenario,
  heroFrameAt,
  heroStateAt,
} from "./hero-cinematic.mjs";
import {
  AVATAR_COUNT,
  avatarSvg,
  clearRecords,
  loadProfile,
  loadRecords,
  recordMatch,
  saveProfile,
  statsFor,
} from "./profile.mjs";

const $ = (selector) => document.querySelector(selector);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const number = (value) => Number(value || 0).toLocaleString("zh-CN");
const names = ["赤焰军", "苍蓝军", "金叶军", "紫星军"];
const featureStats = document.querySelectorAll(".feature-stats > div");
if (featureStats.length >= 2) {
  featureStats[0].querySelector("strong").textContent = String(Object.keys(UNITS).length).padStart(2, "0");
  featureStats[0].querySelector("span").textContent = "陆海空兵种";
  featureStats[1].querySelector("strong").textContent = String(MAPS.length).padStart(2, "0");
}
let room = null,
  session = null,
  eventSource = null,
  screen = "landing",
  busy = false;
let selectedId = null,
  destination = null,
  targetId = null,
  selectedTile = null,
  hoveredTile = null,
  holdPreviewId = null,
  dragUnitId = null,
  dragArrowPath = null;
/* ---------- 公网 / 内网判定（2026-10-02） ----------
   公网部署后 location.hostname 是公网域名，此时邀请链接必须用 location.origin；
   只有在本机 / 内网打开时，才回退到服务探测到的局域网 IP。 */
function isLanHost(hostname) {
  const host = String(hostname || "")
    .replace(/^\[|\]$/g, "")
    .toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "::1" || /^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
  return false;
}
let serviceURLs = [],
  publicMode = false,
  previousTurn = null,
  victoryShown = null,
  soundEnabled = false,
  audioContext;
let lobbyMapQuery = "";
let storedSessions = loadJSON("field-command-sessions", {});
const modal = $("#modal");
let modalCleanup = null;
function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}
function store(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode can disable storage */
  }
}
function nickname() {
  return loadJSON("field-command-name", "") || loadProfile().callsign || "指挥官";
}
function toast(message, error = false) {
  const el = document.createElement("div");
  el.className = `toast${error ? " error" : ""}`;
  el.textContent = message;
  $("#toast-container").append(el);
  setTimeout(() => el.remove(), error ? 5500 : 3200);
}
function beep(type = "select") {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const osc = audioContext.createOscillator(),
      gain = audioContext.createGain();
    osc.type = "square";
    osc.frequency.value = type === "attack" ? 110 : type === "turn" ? 660 : 330;
    gain.gain.setValueAtTime(0.035, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audioContext.currentTime + 0.12,
    );
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.start();
    osc.stop(audioContext.currentTime + 0.13);
  } catch {
    /* audio is optional */
  }
}
function setNetwork(text, offline = false) {
  $("#network-status").innerHTML = `<i></i>${esc(text)}`;
  $("#network-status").classList.toggle("offline", offline);
}
function showScreen(next) {
  screen = next;
  for (const id of ["landing", "lobby", "battle"])
    $(`#${id}`).classList.toggle("hidden", id !== next);
  $(".nav-label").textContent =
    next === "landing"
      ? "作战大厅"
      : next === "lobby"
        ? "战前部署"
        : "战术指挥";
  requestAnimationFrame(() => {
    heroRenderer.resize();
    battleRenderer.resize();
  });
}
function openModal(title, body, eyebrow = "FIELD COMMAND") {
  closeModal();
  delete modal.dataset.turn;
  $("#modal-title").textContent = title;
  $("#modal-eyebrow").textContent = eyebrow;
  $("#modal-body").innerHTML = body;
  modal.showModal();
}
function openActionModal(title, body, eyebrow) {
  openModal(title, body, eyebrow);
  modal.dataset.turn = `${room.id}:${room.state.turn}`;
}
function closeModal() {
  if (modal.open) modal.close();
  if (modalCleanup) modalCleanup();
  modalCleanup = null;
}
$("#close-modal").onclick = closeModal;
modal.addEventListener("click", (event) => {
  if (event.target === modal) {
    const r = modal.getBoundingClientRect();
    if (
      event.clientX < r.left ||
      event.clientX > r.right ||
      event.clientY < r.top ||
      event.clientY > r.bottom
    )
      closeModal();
  }
});
modal.addEventListener("close", () => {
  if (modalCleanup) modalCleanup();
  modalCleanup = null;
});

/* ---------- 个人档案与战绩（全部存本机，服务端不参与） ---------- */

function paintAvatarButton() {
  const button = $("#profile-button");
  if (!button) return;
  const profile = loadProfile();
  button.innerHTML = avatarSvg(profile.avatar, 3, { className: "avatar-glyph" });
  button.title = `${profile.callsign || nickname()} · 我的档案与战绩`;
}

function recordOf(room_, state) {
  const me = state.players.find((player) => player.id === session.seat);
  if (!me || state.winner === null || state.winner === undefined) return null;
  const opponents = state.players
    .filter((player) => player.team !== me.team)
    .map((player) => player.name)
    .join("、");
  return {
    key: `${room_.id}:${state.turn}`,
    callsign: nickname(),
    seat: session.seat,
    won: me.team === state.winner,
    mapId: room_.mapId,
    mapName: getMap(room_.mapId).name,
    mode: room_.mode,
    playerCount: room_.playerCount,
    day: state.day,
    opponents: opponents || "—",
  };
}

function formatRecordTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getMonth() + 1}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function profileDialog() {
  const render = () => {
    const profile = loadProfile();
    const records = loadRecords();
    const stats = statsFor(records);
    const rows = records.slice(0, 12);
    openModal(
      "我的档案",
      `<div class="profile-head"><div class="profile-avatar-large" id="profile-avatar-preview"></div><div><h4 id="profile-callsign">${esc(profile.callsign || nickname())}</h4><p>本机档案 · 不联网、不上传</p></div></div>
      <label class="form-field" style="display:block;margin-bottom:14px"><span style="font-size:12px;opacity:.75">呼号</span><input id="profile-name-input" maxlength="18" value="${esc(profile.callsign || nickname())}" autocomplete="nickname"></label>
      <div class="profile-avatar-grid" id="profile-avatar-grid"></div>
      <div class="profile-stats"><div><strong>${stats.total}</strong><span>总局数</span></div><div><strong>${stats.wins}</strong><span>胜</span></div><div><strong>${stats.loses}</strong><span>负</span></div><div><strong>${stats.winRate}%</strong><span>胜率</span></div></div>
      <p class="muted" style="font-size:12px;margin:0 0 8px">常用战场：${esc(stats.favoriteMap)}${stats.streak > 1 ? ` · 当前连胜 ${stats.streak}` : ""}${stats.bestDay ? ` · 最长作战 ${stats.bestDay} 天` : ""}</p>
      <div class="profile-records">${
        rows.length
          ? `<table><thead><tr><th>时间</th><th>战场</th><th>对手</th><th>结果</th></tr></thead><tbody>${rows
              .map(
                (r) =>
                  `<tr><td>${formatRecordTime(r.at)}</td><td>${esc(r.mapName || r.mapId || "—")}</td><td>${esc(r.opponents || "—")}</td><td class="${r.won ? "win" : "lose"}">${r.won ? "胜利" : "失败"}</td></tr>`,
              )
              .join("")}</tbody></table>`
          : `<p class="profile-empty">还没有战绩。开一局，打完就会自动记在这里。</p>`
      }</div>
      <p class="profile-id">档案编号 ${esc(profile.id)}（存在本机浏览器，清除浏览器数据会丢失）</p>
      <div class="modal-buttons"><button class="button secondary" id="profile-clear">清空战绩</button><button class="button primary" id="profile-save">保存档案 →</button></div>`,
      "PLAYER RECORD / 个人档案",
    );
    $("#profile-avatar-preview").innerHTML = avatarSvg(profile.avatar, 7);
    $("#profile-avatar-grid").innerHTML = Array.from(
      { length: AVATAR_COUNT },
      (_, index) =>
        `<button type="button" data-avatar="${index}" aria-pressed="${index === profile.avatar}">${avatarSvg(index, 4)}</button>`,
    ).join("");
    const grid = $("#profile-avatar-grid");
    grid.onclick = (event) => {
      const button = event.target.closest("button[data-avatar]");
      if (!button) return;
      const index = Number(button.dataset.avatar);
      saveProfile({ avatar: index });
      for (const other of grid.querySelectorAll("button[data-avatar]"))
        other.setAttribute("aria-pressed", String(Number(other.dataset.avatar) === index));
      $("#profile-avatar-preview").innerHTML = avatarSvg(index, 7);
      paintAvatarButton();
      beep();
    };
    $("#profile-save").onclick = () => {
      const callsign = $("#profile-name-input").value.trim().slice(0, 18) || "指挥官";
      saveProfile({ callsign });
      store("field-command-name", callsign);
      paintAvatarButton();
      closeModal();
      toast(`档案已保存：${callsign}`);
    };
    $("#profile-clear").onclick = () => {
      openModal(
        "清空战绩？",
        `<p class="modal-description">将删除本机记录的全部 ${records.length} 条战绩，此操作无法撤销。</p><div class="modal-buttons"><button class="button secondary" id="cancel-clear">保留</button><button class="button primary" id="confirm-clear">确认清空</button></div>`,
        "CLEAR RECORDS",
      );
      $("#cancel-clear").onclick = closeModal;
      $("#confirm-clear").onclick = () => {
        clearRecords();
        toast("战绩已清空。");
        render();
      };
    };
  };
  render();
}

$("#profile-button").onclick = profileDialog;
paintAvatarButton();

async function api(path, data) {
  const response = await fetch(
    path,
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        },
  );
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error("服务暂时不可用，请确认房主的服务仍在运行。");
  }
  if (!response.ok) throw new Error(payload.error || "操作未完成，请重试。");
  return payload;
}
async function safe(task) {
  try {
    await task();
  } catch (error) {
    toast(error.message || "连接失败，请稍后重试。", true);
  }
}
function commanderOptions(selected = "vanguard") {
  return Object.entries(COMMANDERS)
    .map(
      ([id, c]) =>
        `<option value="${esc(id)}" ${id === selected ? "selected" : ""}>${esc(c.name)} · ${esc(c.title || "")}</option>`,
    )
    .join("");
}
function mapCategory(map) {
  return map.category || "经典战场";
}
function mapOptions(selected = "river", playerCount = 2, query = "") {
  const groups = new Map();
  for (const map of mapsForPlayerCount(MAPS, playerCount, query)) {
    const category = mapCategory(map);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(map);
  }
  if (!groups.size) return '<option value="">没有符合条件的战场</option>';
  return [...groups].map(([category, maps]) =>
    `<optgroup label="${esc(category)}">${maps.map((map) =>
      `<option value="${esc(map.id)}" ${map.id === selected ? "selected" : ""}>${esc(map.name)} · ${map.width}×${map.height}</option>`).join("")}</optgroup>`).join("");
}
function getMap(id) {
  return MAPS.find((map) => map.id === id) || MAPS[0];
}
const heroState = createGame({
  mapId: "river",
  players: [
    {
      id: 0,
      name: "赤焰军",
      team: 0,
      commander: "vanguard",
      controller: "human",
    },
    { id: 1, name: "苍蓝军", team: 1, commander: "mechanic", controller: "ai" },
  ],
});
// ★ 封面「循环战争」（F5）。
//
// 原来封面是一张静态战场图。现在换成一段**永远演不完**的桥头攻防：
// 红坦克强渡、双方轮流开火、装甲殉爆、蓝军反冲过桥，末尾炮火覆盖，
// 硝烟里换一批部队重新开打。
//
// 为什么不用 mp4：视频文件做不到首尾无缝（会跳帧），还要占几 MB、风格也未必
// 对得上这套像素美术。而渲染器**自带**移动补间、开火姿态、爆炸与殉爆——
// 它比较「上一帧 state」和「这一帧 state」自己推断谁打了谁。所以我们只要
// 按节拍推进 state，画面就自己演，且与游戏内是同一套动画代码。
// 时间轴的算术全部在 hero-cinematic.mjs 里，并且有单测钉住（见那个文件）。
const heroScenario = createHeroScenario(heroState);
const heroSmoke = $("#hero-smoke");
const heroFlash = $("#hero-flash");
const heroLanding = $("#landing");

// 起点跳过「上轮余烟淡出」那一段：首轮没有上一轮，否则一进页面先糊一脸烟。
let heroClock = HERO_FADE_OUT_MS;
let heroLastAt = performance.now();
let heroSelected = null;
let heroSignature = "";
let heroFrame = heroFrameAt(heroScenario, 0);

/** 把剧本的一帧推进渲染器；状态没变就什么都不做。 */
function paintHero() {
  const t = heroClock % HERO_PERIOD;
  const cycle = Math.floor(heroClock / HERO_PERIOD);
  const frame = heroFrameAt(heroScenario, t);
  heroFrame = frame;

  // 只有「看得见的东西变了」才重新提交场景。硝烟与闪光走 CSS 层，
  // 每帧直接改 opacity，不参与这里的判重。
  const signature =
    frame.units
      .map((u) => `${u.id}:${u.x},${u.y},${u.hp},${u.acted ? 1 : 0}`)
      .join("|") + `#${heroSelected ?? "-"}`;
  if (signature !== heroSignature) {
    heroSignature = signature;
    const { state } = heroStateAt(heroScenario, t, cycle, frame);
    heroRenderer.setScene({
      state,
      selectedId: heroSelected,
      reachable: [],
      targets: [],
      hoverTile: null,
      preview: null,
    });
  }

  if (heroSmoke) heroSmoke.style.opacity = frame.overlay.smoke.toFixed(3);
  if (heroFlash) heroFlash.style.opacity = frame.overlay.flash.toFixed(3);
}

function heroTick(now) {
  // 夹住单帧步长：标签页被挂起后引擎会一次性补上巨大的 delta，
  // 不夹住的话回到页面会看到战场「快进」一大段。
  const delta = Math.min(64, Math.max(0, now - heroLastAt));
  heroLastAt = now;
  // 只在主菜单可见时推进——进了对局就别再空转占 CPU。
  // 再加一道：写实视频模式下 canvas 已被隐藏，推进它纯属白烧（见下方 _filmMode）。
  if (!heroLanding?.classList.contains("hidden") && !_filmMode()) {
    heroClock += delta;
    paintHero();
  }
  requestAnimationFrame(heroTick);
}

const heroRenderer = createRenderer($("#hero-canvas"), {
  onTile(x, y) {
    const tile = tileAt(heroState, x, y);
    // 单位的位置每帧都在变，所以要从**当前这一帧**里找，而不是初始布阵，
    // 否则点到的和看到的对不上。
    const unit = (heroFrame?.units || heroState.units).find(
      (u) => u.x === x && u.y === y,
    );
    heroSelected = unit?.id || null;
    heroSignature = ""; // 逼下一帧重新提交，选中高亮立刻出现
    $("#hero-detail-title").textContent = unit
      ? `${UNITS[unit.type].name} · ${names[unit.owner]}`
      : TERRAINS[tile.type]?.name || tile.type;
    $("#hero-detail-text").textContent = unit
      ? `兵力 ${unit.hp}/10 · 移动 ${UNITS[unit.type].move} 格 · 射程 ${UNITS[unit.type].minRange}–${UNITS[unit.type].maxRange} · 点击「建立作战」开始`
      : `地形防御 ${TERRAINS[tile.type]?.defense || 0} ★ · 善用地形保护部队`;
    beep();
  },
  onHover() {},
});
paintHero();
// ★ F5-film：封面背景换成了写实视频，原来那套「像素循环战争」整体下线
// （canvas 被 CSS 隐藏）。这里把它停掉的理由很实在：像素战场是**每帧重绘
// canvas** 的，用户看不到它时它还在满速空转，白烧 CPU 和电。
//
// 为什么保留这套代码而不是删掉：视频素材是可替换的（换 public/media/
// intro-loop.mp4 即可，这也是将来商用时换成自有素材的入口），而且有人会因为
// 「减少动态效果」偏好退回到像素版。所以两边都留着，由 _filmMode() 统一判断。
//
// 判断依据取 canvas 的 computedStyle.display —— 让 CSS 当唯一事实来源，
// JS 不另外维护一份「现在是什么模式」的状态，避免两边不同步。
function _filmMode() {
  const cv = document.querySelector("#hero-canvas");
  return !!cv && getComputedStyle(cv).display === "none";
}
requestAnimationFrame(heroTick);
// 只读探针：给 _dragtest/herotake.mjs 用。截图必须按**剧本时刻**对齐，
// 盲抓只能靠墙钟猜——「开火那一瞬」这种只有 260ms 的窗口根本抓不住。
// toScreen 用来核对「CSS 镜头推近之后，点到的格与看到的格是否还是同一个」。
window.__hero = {
  clock: () => heroClock,
  frame: () => heroFrame,
  toScreen: (x, y) => heroRenderer.tileToScreen(x, y),
};
$("#hero-map-name").textContent = getMap("river").name;
const combatStage = $("#combat-stage");
const combatScene = $("#combat-scene");
const combatSceneCtx = combatScene.getContext("2d");
let combatTimers = [];
let combatFrame = null;
function hideCombat() {
  for (const timer of combatTimers) clearTimeout(timer);
  combatTimers = [];
  if (combatFrame !== null) cancelAnimationFrame(combatFrame);
  combatFrame = null;
  combatStage.hidden = true;
  combatStage.className = "combat-stage";
}
function afterCombat(delay, action) {
  combatTimers.push(setTimeout(action, delay));
}
function showCombat({ attacker, defender, damage, counter, attackerTerrain, defenderTerrain, delay = 0 }) {
  if (screen !== "battle") return;
  hideCombat();
  const battle = { attacker, defender, damage, counter, attackerTerrain, defenderTerrain };
  if (delay > 0) {
    afterCombat(delay, () => showCombat(battle));
    return;
  }
  combatStage.hidden = false;
  $("#combat-caption").textContent = "准备攻击";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    paintCombatScene(combatSceneCtx, { ...battle, elapsed: combatDuration(counter) });
    $("#combat-caption").textContent = `造成 ${damage} 点伤害${counter ? ` · 反击 ${counter} 点` : ""}`;
    afterCombat(850, hideCombat);
    return;
  }
  const started = performance.now();
  const animate = (now) => {
    if (combatStage.hidden) return;
    const elapsed = now - started;
    paintCombatScene(combatSceneCtx, { ...battle, elapsed });
    const caption = elapsed < COMBAT_TIMING.firstFire ? "准备攻击"
      : elapsed < COMBAT_TIMING.firstHit ? `${UNITS[attacker.type].name}开火！`
        : elapsed < COMBAT_TIMING.counterFire || !counter ? `命中 · 减少 ${damage} 点兵力`
          : elapsed < COMBAT_TIMING.counterHit ? `${UNITS[defender.type].name}反击！`
            : `反击 · 减少 ${counter} 点兵力`;
    $("#combat-caption").textContent = caption;
    if (elapsed >= combatDuration(counter)) {
      hideCombat();
      return;
    }
    combatFrame = requestAnimationFrame(animate);
  };
  combatFrame = requestAnimationFrame(animate);
}
$("#skip-combat").onclick = hideCombat;
let victoryTimer = null;
function clearVictoryDelay() {
  if (victoryTimer !== null) clearTimeout(victoryTimer);
  victoryTimer = null;
}
function onMapCapture(capture) {
  if (!capture.completed || room?.state?.phase !== "finished" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  clearVictoryDelay();
  victoryTimer = setTimeout(() => {
    victoryTimer = null;
    if (screen === "battle" && room?.state?.phase === "finished") showVictory();
  }, capture.delay + capture.duration);
}
const battleRenderer = createRenderer($("#battle-canvas"), {
  onTile: handleTile,
  onCombat: showCombat,
  onCapture: onMapCapture,
  onHold: handleHold,
  onDrag: handleDrag,
  onDragEnd: handleDragEnd,
  onHover(x, y) {
    hoveredTile = { x, y };
    if (!room?.state) return;
    const tile = tileAt(room.state, x, y),
      unit = room.state.units.find((u) => u.x === x && u.y === y);
    if (tile)
      $("#field-hover").textContent =
        `${String(x + 1).padStart(2, "0")}:${String(y + 1).padStart(2, "0")} · ${TERRAINS[tile.type]?.name || tile.type} · 防御 ${TERRAINS[tile.type]?.defense || 0}★${unit ? ` · ${UNITS[unit.type].name} ${unit.hp} HP` : ""}`;
  },
});
function tileAt(state, x, y) {
  return state.tiles[y * state.width + x];
}
function ownPlayer() {
  return room?.state?.players.find((p) => p.id === session?.seat);
}
function isMyTurn() {
  return (
    room?.state?.phase === "playing" &&
    room.state.currentPlayer === session?.seat &&
    !ownPlayer()?.defeated
  );
}
function selectedUnit() {
  return room?.state?.units.find((u) => u.id === selectedId);
}
function canCommand() {
  const unit = selectedUnit();
  return isMyTurn() && unit?.owner === session.seat && !unit.acted && !busy;
}
function effectivePosition(unit) {
  return destination || { x: unit.x, y: unit.y };
}
function validTargets(unit) {
  if (!unit || !canCommand()) return [];
  const pos = effectivePosition(unit);
  if (UNITS[unit.type].minRange > 1 && (pos.x !== unit.x || pos.y !== unit.y))
    return [];
  try {
    return attackable(room.state, unit.id, pos);
  } catch {
    return [];
  }
}
/**
 * 伤害预测浮标（参考资产 §2.4）。
 *
 * 只在「已预选攻击目标」时给出，浮在目标格上方。
 * 侧栏的 `.combat-preview` 仍然保留（信息更全，含反击），
 * 这里只是把**最关键的那个数字**搬到战场上，减少眼睛往返。
 */
function combatHintFor(unit) {
  if (!unit || !targetId) return null;
  const target = room.state.units.find((u) => u.id === targetId);
  if (!target) return null;
  try {
    const p = previewCombat(room.state, unit.id, targetId, effectivePosition(unit));
    if (!p || !Number.isFinite(p.damage)) return null;
    return { x: target.x, y: target.y, damage: p.damage, counter: p.counter };
  } catch {
    return null;
  }
}
function resetSelection() {
  selectedId = null;
  destination = null;
  targetId = null;
  selectedTile = null;
  holdPreviewId = null;
  dragUnitId = null;
  dragArrowPath = null;
  battleRenderer?.setHoverPreview(null);
  battleRenderer?.setArrowPath(null);
}
/**
 * 长按（按住不动约 0.1 秒）进入「拉拽箭头」模式。
 * 自己单位：铺范围 + 可拉箭头 + 松手后出命令；敌方单位：只读灰箭头，不出命令。
 * 这是预览，不改变 selectedId，也不影响点击选中与下令。
 */
function handleHold(x, y) {
  if (!room?.state || busy) return;
  const unit = room.state.units.find((u) => u.x === x && u.y === y);
  if (!unit) {
    clearHoldPreview();
    return;
  }
  // 只有轮到己方能下令的己方部队才有命令权；其余（敌方/已行动/非我回合）走只读
  const commandable = canCommandUnit(unit);
  let cells = [];
  try {
    cells = reachable(room.state, unit.id);
  } catch {
    cells = [];
  }
  holdPreviewId = unit.id;
  dragUnitId = unit.id;
  dragArrowPath = null;
  battleRenderer.setHoverPreview(cells);
  battleRenderer.setArrowPath(null, commandable ? "own" : "enemy");
  beep();
}
/** 该单位此刻是否有下达命令的权限（与 canCommand 同判据，但不依赖 selectedId）。 */
function canCommandUnit(unit) {
  return Boolean(
    unit && isMyTurn() && unit.owner === session.seat && !unit.acted && !busy,
  );
}
function clearHoldPreview() {
  if (holdPreviewId === null && dragUnitId === null) return;
  holdPreviewId = null;
  dragUnitId = null;
  dragArrowPath = null;
  battleRenderer.setHoverPreview(null);
  battleRenderer.setArrowPath(null);
}
/**
 * 拖拽中：把光标所在格换算成「合法落点」，并把真实路线交给渲染层画箭头。
 * 拖到范围外时钳制到「离光标最近的可达格」——箭头永远指着一个走得到的格子。
 */
function handleDrag(x, y) {
  if (!room?.state || busy || dragUnitId === null) return;
  const unit = room.state.units.find((u) => u.id === dragUnitId);
  if (!unit) return;
  let all = [];
  try {
    all = reachable(room.state, unit.id);
  } catch {
    return;
  }
  if (!all.length) return;
  // 沿上次的路径回退找合法落点（xpgram 的 recalculatePathToPoint 策略）
  const resolved = resolveDestination(all, x, y, dragArrowPath);
  if (!resolved?.path?.length) return;
  const path = [{ x: unit.x, y: unit.y }, ...resolved.path];
  dragArrowPath = path;
  battleRenderer.setArrowPath(
    path,
    canCommandUnit(unit) ? "own" : "enemy",
  );
}
/** 松手：钉住箭头并把落点记为预选目的地（此时部队还没行动）。 */
function handleDragEnd() {
  if (!room?.state || busy || dragUnitId === null) return;
  const unit = room.state.units.find((u) => u.id === dragUnitId);
  const path = dragArrowPath;
  dragUnitId = null;
  if (!unit || !path || path.length < 2) {
    dragArrowPath = null;
    battleRenderer.setArrowPath(null);
    renderBattle();
    return;
  }
  const last = path[path.length - 1];
  const can = canCommandUnit(unit);
  if (!can) {
    // 敌方只读：箭头保留供观察，但不产生任何命令
    holdPreviewId = unit.id;
    dragArrowPath = path;
    battleRenderer.setArrowPath(path, "enemy");
    renderBattle();
    return;
  }
  // 与点击选中一致：接管显示，进入正常的预选流程
  selectedId = unit.id;
  destination = { x: last.x, y: last.y };
  targetId = null;
  selectedTile = { x: last.x, y: last.y };
  holdPreviewId = null;
  dragArrowPath = path;
  battleRenderer.setHoverPreview(null);
  beep();
  renderBattle();
}
/**
 * 拖拽时把光标位置换算成「合法落点」。
 *
 * 算法搬自 xpgram/advance-wars (MIT) 的 `recalculatePathToPoint`：
 * 当目标点不可达时，**不自作主张跳到最近的格子**，而是沿着当前路径
 * 从末尾往前逐级回退（终点 → 前一步 → … → 起点），找到第一个仍然合法的位置。
 *
 * 效果差异（这是搬它的唯一理由）：
 *  - 旧做法：拖到河对岸 → 箭头「啪」地跳到旁边一个格，看不出为什么；
 *  - 新做法：拖到河对岸 → 箭头**顺着你来时的路线缩回来**，停在河这边最后一格，
 *            玩家一眼看懂「哦，过不去，只能到这儿」。
 *
 * @param cells 可达格（含各自 path）
 * @param x,y   光标所在格
 * @param prevPath 上一次的箭头路径（用于「沿原路回退」），可为空
 * @returns {{ cell: object, path: Array }|null}
 */
function resolveDestination(cells, x, y, prevPath) {
  if (!cells.length) return null;
  const at = (px, py) => cells.find((c) => c.x === px && c.y === py);

  // ① 光标正好落在某个可达格上 → 直接用它的真实路线
  const direct = at(x, y);
  if (direct) return { cell: direct, path: pathOfCell(direct) };

  // ② 否则：在「上一次的路径」上从末尾向前找，取第一个仍然可达的位置
  //    —— 这是 xpgram 的 pathIndices = [last, last-1, 1, 0] 回退策略。
  if (prevPath && prevPath.length) {
    for (let i = prevPath.length - 1; i >= 0; i--) {
      const p = prevPath[i];
      const cell = at(p.x, p.y);
      if (cell) return { cell, path: pathOfCell(cell) };
    }
  }

  // ③ 没有历史路径（第一次拖动就拖到外面）→ 退回旧的「最近格」策略
  const cell = nearestCell(cells, x, y);
  return cell ? { cell, path: pathOfCell(cell) } : null;
}
/** 把可达格自带的 path 展开成含起点的完整点列。 */
function pathOfCell(cell) {
  return cell?.path?.length ? [...cell.path] : [];
}
/** 从可达格里挑离 (x,y) 曼哈顿距离最近的格；同距离时取消耗更小的。 */
function nearestCell(cells, x, y) {
  let best = null,
    bestScore = Infinity;
  for (const cell of cells) {
    const score = Math.abs(cell.x - x) + Math.abs(cell.y - y);
    if (score < bestScore || (score === bestScore && cell.cost < best.cost)) {
      best = cell;
      bestScore = score;
    }
  }
  return best;
}
/** 还原「单位 → 落点」的完整路线点列（含起点）。 */
function pathOf(unit, cell, all) {
  const dest = all.find((t) => t.x === cell.x && t.y === cell.y) || cell;
  const raw = dest.path || [];
  return raw.length ? [{ x: unit.x, y: unit.y }, ...raw] : [{ x: unit.x, y: unit.y }, { x: cell.x, y: cell.y }];
}
function updateScene() {
  if (!room?.state) return;
  const unit = selectedUnit();
  let moves = [];
  if (canCommand()) {
    try {
      moves = reachable(room.state, unit.id);
    } catch {}
  }
  // 目的地已预选时，把钉住的真实路线交给渲染层（否则箭头会退化成直线）
  let arrowPath = dragArrowPath;
  if (!arrowPath && destination && unit) {
    const dest = moves.find(
      (c) => c.x === destination.x && c.y === destination.y,
    );
    if (dest?.path?.length)
      arrowPath = [{ x: unit.x, y: unit.y }, ...dest.path];
  }
  battleRenderer.setScene({
    state: room.state,
    // 光标配色需要知道"我是谁"（renderer 里的 cursorPose 用）。
    seat: session.seat,
    selectedId,
    reachable: ridesSurface(moves, destination, arrowPath),
    targets: validTargets(unit),
    hoverTile: selectedTile,
    preview: destination,
    // 伤害预测浮标：浮在目标格上方（参考资产 §2.4）
    combatHint: combatHintFor(unit),
  });
  battleRenderer.setArrowPath(
    arrowPath,
    unit?.owner === session.seat ? "own" : "enemy",
  );
}
/**
 * 目的地已确定时收缩青色的「可选格」提示，但仍保留路线经过的格，
 * 免得箭头下面空一片、看不出走法。
 */
function ridesSurface(moves, dest, arrowPath) {
  if (!dest || !arrowPath) return moves;
  const keep = new Set(arrowPath.map((t) => `${t.x},${t.y}`));
  return moves.filter((c) => keep.has(`${c.x},${c.y}`));
}
function handleTile(x, y) {
  if (!room?.state || busy) return;
  // 点击会接管显示：清掉长按留下的只读预览与拖拽箭头
  holdPreviewId = null;
  dragUnitId = null;
  dragArrowPath = null;
  battleRenderer.setHoverPreview(null);
  const state = room.state,
    unit = state.units.find((u) => u.x === x && u.y === y),
    selected = selectedUnit();
  selectedTile = { x, y };
  if (canCommand()) {
    if (unit && validTargets(selected).includes(unit.id)) {
      targetId = unit.id;
      beep();
      renderBattle();
      return;
    }
    if (!unit || unit.id === selected.id) {
      const moves = reachable(state, selected.id);
      if (moves.some((p) => p.x === x && p.y === y)) {
        // 已预选同一格 → 就是「再点一下」，直接执行移动并待机
        if (
          destination &&
          destination.x === x &&
          destination.y === y &&
          !targetId
        ) {
          performAction({
            type: "move",
            unitId: selected.id,
            x,
            y,
            command: "wait",
          });
          return;
        }
        destination = { x, y };
        targetId = null;
        dragArrowPath = null;
        beep();
        renderBattle();
        return;
      }
    }
  }
  selectedId = unit?.id || null;
  destination = null;
  targetId = null;
  dragArrowPath = null;
  beep();
  renderBattle();
}
function attachSession(result) {
  if (!result.room?.id || !result.token || !Number.isInteger(result.seat))
    throw new Error("房间凭证不完整，请重新加入。");
  session = { roomId: result.room.id, token: result.token, seat: result.seat };
  storedSessions[session.roomId] = session;
  store("field-command-sessions", storedSessions);
  store("field-command-last", session.roomId);
  connectEvents();
  receiveRoom(result.room);
  updateResume();
}
function connectEvents() {
  eventSource?.close();
  eventSource = new EventSource(
    `/api/rooms/${encodeURIComponent(session.roomId)}/events?token=${encodeURIComponent(session.token)}`,
  );
  const source = eventSource;
  eventSource.addEventListener("room", (event) => {
    if (eventSource !== source) return;
    try {
      receiveRoom(JSON.parse(event.data));
    } catch (error) {
      console.error("Room update failed", error);
      toast("房间数据更新失败，请刷新重连。", true);
    }
  });
  eventSource.onopen = () => {
    if (eventSource === source) setNetwork("房间已连接");
  };
  eventSource.onerror = () => {
    if (eventSource !== source) return;
    setNetwork("正在重连…", true);
    $("#save-status").textContent = "连接中断 · 正在自动重连";
  };
}
function receiveRoom(next) {
  if (!session || next.id !== session.roomId) return;
  if (room?.id === next.id && next.revision < room.revision) return;
  if (
    modal.dataset.turn &&
    modal.dataset.turn !== `${next.id}:${next.state?.turn}`
  )
    closeModal();
  const oldId = room?.id;
  room = next;
  if (room.phase === "lobby") {
    hideCombat();
    clearVictoryDelay();
    if (screen !== "lobby") closeModal();
    previousTurn = null;
    victoryShown = null;
    resetSelection();
    showScreen("lobby");
    renderLobby();
  } else {
    const current = room.state?.currentPlayer,
      turnKey = `${room.id}:${room.state?.turn}:${current}`;
    const unit = selectedUnit();
    if (turnKey !== previousTurn || (selectedId && (!unit || unit.acted)))
      resetSelection();
    showScreen("battle");
    renderBattle();
    if (turnKey !== previousTurn && room.state?.phase !== "finished") {
      previousTurn = turnKey;
      showTurnBanner();
    }
    if (room.state?.phase === "finished") {
      if (victoryTimer === null) showVictory();
    }
  }
  $("#footer-message").textContent =
    `房间 ${room.id} · ${room.mode === "teams" ? "联合行动" : "自由混战"} · 每一步都已同步`;
  if (oldId && oldId !== room.id) closeModal();
}
function renderLobbyMapOptions() {
  const host = $("#map-options");
  let search = host.querySelector("#lobby-map-search");
  if (!search) {
    host.innerHTML = '<label for="lobby-map-search">查找战场</label><input id="lobby-map-search" type="search" placeholder="名称、地形或战术" autocomplete="off"><div class="map-option-list"></div>';
    search = host.querySelector("#lobby-map-search");
    search.value = lobbyMapQuery;
    search.addEventListener("input", () => {
      lobbyMapQuery = search.value;
      renderLobbyMapOptions();
    });
  }
  const list = host.querySelector(".map-option-list");
  const maps = mapsForPlayerCount(MAPS, room.playerCount, lobbyMapQuery);
  if (!maps.length) {
    list.innerHTML = '<p class="map-picker-empty">没有符合条件的战场。</p>';
    return;
  }
  const groups = new Map();
  for (const map of maps) {
    const category = mapCategory(map);
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category).push(map);
  }
  list.innerHTML = [...groups].map(([category, group]) =>
    `<section class="map-option-group"><h3>${esc(category)}</h3><div class="map-option-grid">${group.map((map) =>
      `<button class="map-option ${map.id === room.mapId ? "active" : ""}" data-map="${esc(map.id)}" ${session.seat !== room.hostSeat ? "disabled" : ""} aria-pressed="${map.id === room.mapId}"><span>${esc(map.name)}</span><small>${map.width} × ${map.height} · ${map.playerCount || "2–4"} 人</small></button>`).join("")}</div></section>`).join("");
  list.querySelectorAll("button[data-map]").forEach((button) =>
    (button.onclick = () => safe(() => roomRequest("configure", { mapId: button.dataset.map }))));
}
function renderLobby() {
  $("#room-id").textContent = room.id;
  $("#lobby-count").textContent =
    `${room.seats.filter((s) => s.controller === "human").length} 名玩家 / ${room.playerCount} 席位`;
  const isHost = session.seat === room.hostSeat;
  $("#seat-list").innerHTML = room.seats
    .map(
      (seat) =>
        `<div class="seat" style="--seat-color:${TEAM_COLORS[seat.id]}"><div class="seat-color">${String(seat.id + 1).padStart(2, "0")}</div><div class="seat-info"><div class="seat-name">${esc(seat.controller === "open" ? "等待玩家加入" : seat.name)}${seat.id === session.seat ? "<small>你</small>" : ""}${seat.id === room.hostSeat ? "<small>房主</small>" : ""}</div><p>${esc(names[seat.id])} · ${room.mode === "teams" ? `第 ${(seat.id % 2) + 1} 队 · ` : ""}${esc(COMMANDERS[seat.commander]?.name || "")}</p></div>${seat.controller === "human" ? `<span class="seat-state"><i class="tiny-dot" style="background:${seat.connected ? "#a4c49b" : "#657c7a"}"></i>${seat.connected ? "已连接" : "等待连接"}</span>` : `<select data-seat="${seat.id}" aria-label="${names[seat.id]}席位" ${!isHost ? "disabled" : ""}><option value="ai" ${seat.controller === "ai" ? "selected" : ""}>电脑指挥官</option><option value="open" ${seat.controller === "open" ? "selected" : ""}>等待玩家</option></select>`}</div>`,
    )
    .join("");
  $("#seat-list")
    .querySelectorAll("select")
    .forEach(
      (select) =>
        (select.onchange = () =>
          safe(() =>
            roomRequest("configure", {
              slots: [
                { seat: Number(select.dataset.seat), controller: select.value },
              ],
            }),
          )),
    );
  const mySeat = room.seats.find((s) => s.id === session.seat);
  $("#my-commander").innerHTML = commanderOptions(mySeat.commander);
  $("#commander-description").textContent =
    COMMANDERS[mySeat.commander]?.description || "";
  renderLobbyMapOptions();
  $("#room-mode").value = room.mode;
  $("#room-mode").disabled = !isHost;
  $("#room-mode").querySelector('[value="teams"]').disabled =
    room.playerCount !== 4;
  $("#mode-description").textContent =
    room.mode === "teams"
      ? "赤焰与金叶一队，苍蓝与紫星一队。资金独立，队友共享胜利。"
      : getMap(room.mapId).description;
  $("#invite-url").value = inviteURL();
  $("#start-game").disabled =
    !isHost || room.seats.some((s) => s.controller === "open") || busy;
  $("#start-game").textContent = isHost
    ? "全员就位 · 开始作战 →"
    : "等待房主开始作战";
  $("#start-hint").textContent = room.seats.some((s) => s.controller === "open")
    ? "还有空席位：等待朋友加入，或将其设置为电脑。"
    : "朋友可在开局前加入电脑席位。开始后仍可断线重连。";
}
async function roomRequest(endpoint, data = {}) {
  const origin = session;
  if (!origin) throw new Error("请先加入房间。");
  const result = await api(
    `/api/rooms/${encodeURIComponent(origin.roomId)}/${endpoint}`,
    { token: origin.token, ...data },
  );
  if (session === origin && result.room) receiveRoom(result.room);
  return result;
}
function inviteURL() {
  /* 只有从内网打开时才用探测到的局域网地址；公网访问一律用当前域名。 */
  const lan = isLanHost(location.hostname)
    ? serviceURLs.find(
        (url) =>
          !url.includes("127.0.0.1") &&
          !url.includes("localhost") &&
          !url.includes("[::1]"),
      ) || location.origin
    : location.origin;
  return `${lan}/?room=${encodeURIComponent(room.id)}`;
}
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("邀请地址已复制");
  } catch {
    openModal(
      "分享房间",
      `<p class="modal-description">${
        publicMode ? "复制下方地址，发送给朋友。" : "复制下方地址，发送给同一局域网的朋友。"
      }</p><input style="width:100%" id="manual-copy" readonly value="${esc(text)}"><p class="muted">房间码：${esc(room?.id || "")}</p>`,
    );
    $("#manual-copy").select();
  }
}
$("#my-commander").onchange = () =>
  safe(() => roomRequest("seat", { commander: $("#my-commander").value }));
$("#room-mode").onchange = () =>
  safe(() => roomRequest("configure", { mode: $("#room-mode").value }));
$("#copy-invite").onclick = () => copyText(inviteURL());
$("#start-game").onclick = () =>
  safe(async () => {
    busy = true;
    renderLobby();
    try {
      await roomRequest("start");
    } finally {
      busy = false;
      if (screen === "lobby") renderLobby();
      else renderBattle();
    }
  });
function renderBattle() {
  if (!room?.state) return;
  const state = room.state,
    active = state.players.find((p) => p.id === state.currentPlayer),
    me = ownPlayer(),
    mine = isMyTurn();
  $("#battle-map-title").textContent = getMap(room.mapId).name;
  $("#day-number").textContent = String(state.day).padStart(2, "0");
  $("#active-player").textContent =
    state.phase === "finished" ? "作战结束" : `${active?.name || ""}的回合`;
  $("#active-player").style.color = TEAM_COLORS[active?.id || 0];
  $("#turn-status").textContent =
    state.phase === "finished"
      ? "查看战后报告"
      : mine
        ? "轮到你了，指挥官"
        : active?.controller === "ai"
          ? "电脑正在部署部队…"
          : "等待对方行动";
  $("#field-status").innerHTML =
    `<i class="tiny-dot"></i> ${state.phase === "finished" ? "作战结束" : mine ? "你的回合 · 下达指令" : "观察战场 · 等待回合"}`;
  const co = COMMANDERS[me.commander];
  $("#co-name").textContent = co.name;
  $("#commander-avatar").textContent = me.commander === "mechanic" ? "M" : "V";
  $("#commander-avatar").style.borderColor = TEAM_COLORS[me.id];
  $("#my-faction").textContent =
    `${names[me.id]}${room.mode === "teams" ? ` / 第 ${me.team + 1} 队` : ""}`;
  $("#funds").textContent = number(me.funds);
  $("#energy-value").textContent = `${Math.floor(me.energy || 0)} / 100`;
  $("#energy-fill").style.width = `${Math.min(100, me.energy || 0)}%`;
  $("#power-button").innerHTML =
    `${esc(co.powerName || "普通能力")} <span>50</span>`;
  $("#super-button").innerHTML =
    `${esc(co.superName || "超级能力")} <span>100</span>`;
  $("#power-button").disabled = !mine || busy || me.energy < 50 || !!me.power;
  $("#super-button").disabled = !mine || busy || me.energy < 100 || !!me.power;
  $("#end-turn").disabled = state.phase === "finished" ? false : !mine || busy;
  $("#end-turn").innerHTML =
    `${state.phase === "finished" ? "查看战后报告" : mine ? "结束我的回合" : me.defeated ? "你的部队已退出" : "等待对方回合"} <b>→</b>`;
  $("#player-strip").innerHTML = state.players
    .map(
      (player) =>
        `<div class="player-card ${player.id === state.currentPlayer ? "active" : ""} ${player.defeated ? "defeated" : ""}" style="--player-color:${TEAM_COLORS[player.id]}"><div class="player-name"><i></i>${esc(player.name)}${player.id === session.seat ? " · 你" : ""}</div><small>${player.defeated ? "已退出" : `${state.units.filter((u) => u.owner === player.id).length} 部队 · ${state.tiles.filter((t) => t.owner === player.id && ["city", "factory", "hq", "port", "airport"].includes(t.type)).length} 据点`}${room.mode === "teams" ? ` · 队${player.team + 1}` : ""}</small></div>`,
    )
    .join("");
  $("#event-log").innerHTML = (state.log || [])
    .slice(-5)
    .reverse()
    .map(
      (line) =>
        `<li>${esc(typeof line === "string" ? line : line.message || JSON.stringify(line))}</li>`,
    )
    .join("");
  $("#save-status").textContent = busy
    ? "正在同步行动…"
    : "行动自动保存 · 支持刷新重连";
  renderSelection();
  updateScene();
}
/**
 * 底部说明栏文案（F5）。
 *
 * 高级战争界面底部常驻一条说明栏，实时解释当前高亮项——这是它
 * 「不啰嗦但信息全」的关键。原来我们把这些解释写成段落塞在右侧栏，
 * 既占版面又像网页正文。现在收成一行。
 */
function setCommandBar(text) {
  const el = $("#command-bar-text");
  if (el) el.textContent = text || "";
}

/** 命令说明表。AW 的说明栏就是这种「一句话到底」的写法。 */
const COMMAND_DESCRIPTIONS = {
  attack: "对目标发起攻击。确认后立即结算，双方可能互相造成伤害。",
  wait: "结束这支部队本回合的行动，下个己方回合恢复。",
  capture: "占领脚下据点。占领值降到 0 后据点归你所有。",
  supply: "为相邻的己方部队补充弹药与燃料。",
  cancel: "取消当前预选，回到未选定状态。",
  build: "在己方生产据点部署一支新部队，新部队下个回合才能行动。",
  submerge: "潜艇下潜，避开普通水面火力。",
  surface: "潜艇浮出水面。",
  repair: "维修相邻海军，并补满弹药和燃料。",
  load: "将相邻友军装入运输单位。",
  unload: "将载员卸到相邻可通行的空格。",
};

/** 当前命令菜单该贴在哪个格子（由 renderSelection 各分支设置）。 */
let menuAnchor = null;

/**
 * 把命令菜单贴到屏幕边缘（F5 修订二）。
 *
 * 坐标由渲染器给出（`tileToScreen`，与命中测试**同源**），所以 cover/contain
 * 切换、窗口缩放、DPR 变化都不会错位。
 *
 * ★ 为什么从「单位下方居中」改成「贴边」：
 *   旧版把菜单挂在单位正下方、水平居中。实测（用户截图）选中部队后，
 *   移动范围高亮正在单位四周铺开，菜单正好糊在这一片范围格上——
 *   用户想点目的地却点到了菜单，主观感受就是「会挡住」。
 *
 * ★ 为什么不是「贴单位侧边」（本函数的第一版修订）：
 *   算过账——菜单中心放在单位格左/右外侧 31px 处时，菜单内边缘仍会
 *   压住相邻格（reach 只有 31px，而菜单半宽 88px），范围照样被切。
 *   只要菜单挨着单位，就必然吃掉范围的一部分。
 *   **唯一真正不挖洞的位置是战场中央之外的死区**，也就是屏幕边缘。
 *
 * ★ 为什么按「单位在哪半边」选边：贴边虽然不挡操作，但离单位越远、
 *   鼠标行程越长。单位在左半屏就贴左边缘、在右半屏就贴右边缘，
 *   是「不挡」和「就近」的折中点；同时菜单出现位置可预测（永远在自家那侧），
 *   比忽左忽右更好用。
 */
function positionCommandMenu(menu, tileX, tileY) {
  if (!menu) return;
  if (!Number.isFinite(tileX) || !Number.isFinite(tileY)) return;
  const anchor =
    typeof battleRenderer?.tileToScreen === "function"
      ? battleRenderer.tileToScreen(tileX, tileY)
      : null;
  if (!anchor) {
    // 画布还没布局完（首次渲染），退回 CSS 里的居中兜底值
    menu.style.removeProperty("--menu-left");
    menu.style.removeProperty("--menu-top");
    return;
  }
  const place = () => {
    const box = menu.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const { cx, cy, side, above } = commandMenuPosition({
      anchorX: anchor.x,
      anchorY: anchor.y,
      menuW: box.width,
      menuH: box.height,
      vw: window.innerWidth,
      vh: window.innerHeight,
      cell: anchor.cell,
    });
    menu.style.setProperty("--menu-left", `${Math.round(cx)}px`);
    menu.style.setProperty("--menu-top", `${Math.round(cy)}px`);
    // 把实际锚点回读到 DOM 上：端到端验证（_dragtest/cdpcheck.mjs）要靠它
    // 断言「菜单真的贴在终点框右上角」，否则只能靠肉眼看截图。
    // 开销是几个字符串赋值，只在菜单出现时执行。
    menu.dataset.anchorX = Math.round(anchor.x);
    menu.dataset.anchorY = Math.round(anchor.y);
    menu.dataset.anchorCell = Math.round(anchor.cell);
    menu.dataset.side = side;
    menu.dataset.above = String(above);
  };
  place();
  // 点阵字体 swap 进来后高度会变，再量一次
  requestAnimationFrame(place);
}

/** 给命令按钮挂上「悬停/聚焦 → 更新底部说明栏」。 */
function wireCommandDescriptions(list) {
  list.querySelectorAll("[data-command]").forEach((button) => {
    // 按钮上的 data-desc 优先（文案随状态变化时用得到），否则查表
    const desc =
      button.dataset.desc || COMMAND_DESCRIPTIONS[button.dataset.command];
    if (!desc) return;
    const show = () => setCommandBar(desc);
    button.addEventListener("mouseenter", show);
    button.addEventListener("focus", show);
  });
}

/**
 * 指挥室抽屉（F5）。
 * 高级战争平时屏幕上**没有** CO 信息面板——那是「按需打开」的菜单项。
 * 所以把指挥官 / 能量 / 战况电台收进抽屉，默认全隐藏，
 * 只留右侧边缘一个小按钮随时开合。关掉时屏幕上只剩战场。
 */
function roomOpen() {
  return !!document.querySelector(".command-sidebar.room-open");
}
function toggleRoom(open) {
  const sidebar = document.querySelector(".command-sidebar");
  if (!sidebar) return;
  const next =
    open === undefined ? !sidebar.classList.contains("room-open") : !!open;
  sidebar.classList.toggle("room-open", next);
  $("#drawer-toggle")?.setAttribute("aria-pressed", String(next));
}
$("#drawer-toggle")?.addEventListener("click", () => toggleRoom());

function renderSelection() {
  const panel = $("#selection-panel"),
    state = room.state,
    unit = selectedUnit(),
    can = canCommand();
  if (unit) {
    const definition = UNITS[unit.type],
      pos = effectivePosition(unit),
      tile = tileAt(state, pos.x, pos.y),
      player = state.players.find((p) => p.id === unit.owner);
    let commands = "",
      combat = "";
    if (can) {
      const tileOwner = state.players.find((p) => p.id === tile.owner);
      const canCapture =
        definition.capture &&
        ["city", "factory", "hq", "port", "airport"].includes(tile.type) &&
        tile.owner !== unit.owner &&
        (!tileOwner || tileOwner.team !== player.team);
      if (targetId) {
        const target = state.units.find((u) => u.id === targetId);
        if (target) {
          const p = previewCombat(state, unit.id, targetId, pos);
          combat = `<div class="combat-preview"><span>${esc(UNITS[target.type].name)}<strong>−${p.damage} HP</strong></span><span>预计反击<strong>−${p.counter} HP</strong></span></div>`;
          commands += `<button class="attack-command" data-command="attack">确认攻击</button>`;
        }
      }
      if (!targetId) {
        const moving = destination && (pos.x !== unit.x || pos.y !== unit.y);
        // ★ 只有「落点已确认」（destination 存在）才铺指令。
        //   之前是选中即弹，菜单会长期挂在屏幕上压住战场——用户反馈
        //   「不要这样一直出现」。高级战争的实际节奏也是：先移动、
        //   落点定下来，指令菜单才出现。
        //   原地待机没被砍掉：点部队自己所在格同样写 destination
        //   （它在 reachable 里），菜单里就是「原地待机」。
        if (destination) {
          commands += `<button data-command="wait" data-desc="${moving ? "移动到目的地后结束这支部队本回合的行动。" : "原地不动，结束这支部队本回合的行动。"}">${moving ? "移动并待机" : "原地待机"}</button>`;
          if (canCapture)
            commands +=
              '<button data-command="capture">⚑ 占领据点</button>';
          if (unit.type === "apc")
            commands += '<button data-command="supply">补给邻近部队</button>';
          for (const choice of specialCommands(state, unit, pos, UNITS, TERRAINS)) {
            commands += `<button data-command="${choice.command}" data-desc="${esc(choice.description)}"${choice.targetId ? ` data-target-id="${esc(choice.targetId)}"` : ""}${choice.targetX === undefined ? "" : ` data-target-x="${choice.targetX}" data-target-y="${choice.targetY}"`}>${esc(choice.label)}</button>`;
          }
        }
      }
      // 没有可下达的指令就连「取消」也不给——整块菜单收起来，
      // 屏幕上只剩战场（`.command-list:empty{display:none}` 会兜住）。
      if (commands)
        commands += `<button data-command="cancel">${destination || targetId ? "取消预选" : "取消选择"}</button>`;
    }
    const cargo = Array.isArray(unit.cargo) ? unit.cargo : [];
    const status = [
      unit.type === "submarine" ? (unit.submerged ? "状态：下潜中" : "状态：水面航行") : "",
      ["transport_heli", "lander"].includes(unit.type)
        ? `载员：${cargo.length} / ${unit.type === "lander" ? 2 : 1}${cargo.length ? ` · ${cargo.map((passenger) => UNITS[passenger.type]?.name || passenger.type).join("、")}` : ""}`
        : "",
    ].filter(Boolean).map((line) => `<p class="unit-status">${esc(line)}</p>`).join("");
    panel.innerHTML = `<div class="selection-top"><div><span class="eyebrow">${esc(names[unit.owner])} / UNIT ${esc(unit.id)}</span><h2>${esc(definition.name)}</h2></div><span class="hp-badge">${unit.hp}<small>兵力 / 10</small></span></div><div class="selection-content"><div class="unit-stats"><div><span>移动 / 射程</span><strong>${definition.move} / ${definition.minRange}–${definition.maxRange}</strong></div><div><span>弹药 / 燃料</span><strong>${unit.ammo === null || unit.ammo === undefined ? "∞" : unit.ammo} / ${Math.floor(unit.fuel || 0)}</strong></div><div><span>地形防御</span><strong>${TERRAINS[tile.type]?.defense || 0} ★</strong></div></div>${status}${combat}<p>${can ? (targetId ? "确认后结算伤害与反击。" : destination ? "目的地已预选。再点一次目的地即可移动，或点红色目标攻击。" : "按住部队拖出红色箭头选路线，或点击青色格预选移动。") : unit.acted ? "该部队已行动，下个己方回合恢复。" : unit.owner !== session.seat ? "观察敌我部署，利用射程与地形安排推进。" : "等待己方回合后可下达指令。"}</p>${["city", "factory", "hq", "port", "airport"].includes(tile.type) ? `<p>据点：${tile.owner === null ? "中立" : esc(names[tile.owner])} · 剩余占领值 ${tile.capture ?? 20}</p>` : ""}<div class="command-list">${commands}</div></div>`;
    // ★ F5：命令菜单跟随**选定的终点格**弹出 + 底部说明栏给默认文案
    //
    // 锚点必须是终点、不是部队：菜单这时还没出现（要先落点确认），
    // 玩家刚点的就是终点框，注意力在那儿。锚在部队身上菜单会停在起点，
    // 与终点隔开大半屏，视线要来回跳——用户原话是「跟随会不会？」。
    // 没有预选落点（原地待机）时 destination 就是部队脚下那格，行为一致。
    menuAnchor = destination
      ? { x: destination.x, y: destination.y }
      : { x: pos.x, y: pos.y };
    wireCommandDescriptions(panel);
    setCommandBar(
      can
        ? targetId
          ? COMMAND_DESCRIPTIONS.attack
          : destination
            ? "落点已确认：选择指令，或点别的青格改选落点。"
            : "拖动部队拉出路线，或点击青色格预选落点；点部队自己可原地待机。"
        : unit.acted
          ? "这支部队本回合已经行动过了，下个己方回合恢复。"
          : unit.owner !== session.seat
            ? `敌方 ${esc(definition.name)}：观察部署，注意它的射程与所在地形。`
            : "等待己方回合后再下达指令。",
    );
    panel.querySelectorAll("[data-command]").forEach(
      (button) =>
        (button.onclick = () => {
          const command = button.dataset.command;
          if (command === "cancel") {
            if (destination || targetId) {
              destination = null;
              targetId = null;
            } else resetSelection();
            renderBattle();
          } else
            performAction(moveCommandAction(unit.id, pos, command, {
              targetId: command === "attack" ? targetId : button.dataset.targetId,
              targetX: button.dataset.targetX,
              targetY: button.dataset.targetY,
            }));
        }),
    );
  } else if (selectedTile) {
    const tile = tileAt(state, selectedTile.x, selectedTile.y),
      type = TERRAINS[tile.type] || { name: tile.type, defense: 0 },
      facility = ["factory", "airport", "port"].includes(tile.type) && tile.owner === session.seat,
      owner = tile.owner === null ? "中立区域" : names[tile.owner];
    const property = ["city", "factory", "hq", "port", "airport"].includes(tile.type);
    const terrainHint = facility
      ? `选择新部队部署到${type.name}。新生产的单位下个回合才能行动。`
      : ["water", "shoal"].includes(tile.type)
        ? "陆军无法穿越水域，请寻找桥梁或使用运输单位。"
        : tile.type === "mountain"
          ? "步兵可登山，车辆需要绕行。"
          : "地形会影响移动消耗与防御。";
    panel.innerHTML = `<div class="selection-top"><div><span class="eyebrow">TERRAIN / ${selectedTile.x + 1}:${selectedTile.y + 1}</span><h2>${esc(type.name)}</h2></div><span class="hp-badge">${type.defense || 0}<small>防御星级</small></span></div><div class="selection-content"><p>${esc(owner)}${property ? " · 据点每回合提供资金与补给。" : ""}</p><p>${esc(terrainHint)}</p>${facility ? `<div class="command-list"><button id="open-build" ${!isMyTurn() || busy ? "disabled" : ""}>＋ 部署部队</button></div>` : ""}</div>`;
    // ★ F5：地形的说明也进底部说明栏（原来是面板里的两段散文）
    menuAnchor = { x: selectedTile.x, y: selectedTile.y };
    const buildButton = panel.querySelector("#open-build");
    if (buildButton) buildButton.dataset.desc = COMMAND_DESCRIPTIONS.build;
    wireCommandDescriptions(panel);
    setCommandBar(
      facility
        ? `己方${type.name}：可以部署新部队。`
        : `${type.name}｜${esc(owner)}${
            property
              ? " · 据点每回合提供资金与补给"
              : ""
          }`,
    );
    if (facility)
      $("#open-build").onclick = () =>
        showBuild(selectedTile.x, selectedTile.y);
  } else {
    menuAnchor = null;
    panel.innerHTML = `<div class="selection-hint"><div class="crosshair">⌖</div><h3>${isMyTurn() ? "选择一支部队" : "观察战场"}</h3><p>${isMyTurn() ? "点击己方单位查看行动范围。<br>点击空闲的己方工厂、机场或港口生产部队。" : "查看部队与地形，规划下一回合。<br>其他玩家的行动会实时同步。"}</p></div>`;
    setCommandBar(
      isMyTurn()
        ? "点击己方部队开始行动；点击己方工厂、机场或港口生产新部队。"
        : "观察战场，规划下一回合。其他玩家的行动会实时同步。",
    );
  }

  // ★ F5：把命令菜单搬到面板外（`#command-menu-host`）再定位。
  //
  // 为什么必须搬：`.command-sidebar .panel` 带 `backdrop-filter`，
  // 而 backdrop-filter 会为 fixed 定位的后代**建立包含块**，
  // 于是菜单的 left/top 变成相对面板算，而不是视口 → 菜单跑到屏幕外。
  // 第一版就踩了这个坑：测试全绿，菜单却根本看不见。
  // 搬到 `.battle-layout` 下（祖先无 transform/filter），坐标才是真·视口坐标。
  const menuHost = $("#command-menu-host");
  const menu = panel.querySelector(".command-list");
  if (menuHost) menuHost.replaceChildren();
  if (menuHost && menu) {
    menuHost.appendChild(menu);
    positionCommandMenu(menu, menuAnchor?.x, menuAnchor?.y);
  }
}
async function performAction(action) {
  if (busy || !session || !room?.state) return;
  const origin = session;
  busy = true;
  renderBattle();
  try {
    await roomRequest("action", { action, revision: room.revision });
    if (session !== origin) return;
    resetSelection();
    beep(action.command === "attack" ? "attack" : "select");
  } catch (error) {
    if (session !== origin) return;
    toast(error.message, true);
    try {
      const fresh = await api(
        `/api/rooms/${encodeURIComponent(origin.roomId)}?token=${encodeURIComponent(origin.token)}`,
      );
      if (session === origin && fresh.room) receiveRoom(fresh.room);
    } catch {}
  } finally {
    busy = false;
    renderBattle();
  }
}
function showBuild(x, y) {
  const tile = tileAt(room.state, x, y);
  if (tile.owner !== session.seat || !["factory", "airport", "port"].includes(tile.type)) return;
  const funds = ownPlayer().funds;
  const facilityName = TERRAINS[tile.type].name;
  const portraits = new Set(["infantry", "mech", "recon", "tank", "heavy", "artillery", "rocket", "apc"]);
  const choices = unitsForFacility(UNITS, tile.type);
  openActionModal(
    "部署新部队",
    `<p class="modal-description">${esc(facilityName)} ${x + 1}:${y + 1} · 可用资金 <strong>${number(funds)}</strong></p><div class="build-list">${choices
      .map(
        ([type, unit]) => {
          const portrait = portraits.has(type)
            ? `/media/units/${type}.webp`
            : unitPortraitDataUrl(type, TEAM_PALETTES[session.seat]);
          return `<button class="build-option" data-unit="${esc(type)}" ${unit.cost > funds ? "disabled" : ""}><img class="build-symbol unit-portrait" src="${esc(portrait)}" alt="${esc(unit.name)}" width="44" height="44" loading="lazy" /><span><strong>${esc(unit.name)}</strong><small>移动 ${unit.move} · 射程 ${unit.minRange}–${unit.maxRange} · ${esc(unit.description || "")}</small></span><span class="cost">${number(unit.cost)}</span></button>`;
        },
      )
      .join("")}</div>`,
    "REINFORCEMENTS / 部队生产",
  );
  $("#modal-body")
    .querySelectorAll("[data-unit]")
    .forEach(
      (button) =>
        (button.onclick = () => {
          closeModal();
          performAction({ type: "build", unitType: button.dataset.unit, x, y });
        }),
    );
}
function endTurnDialog() {
  if (room?.state?.phase === "finished") {
    showVictory(true);
    return;
  }
  if (!isMyTurn() || busy) return;
  const unacted = room.state.units.filter(
    (u) => u.owner === session.seat && !u.acted,
  ).length;
  if (!unacted) {
    performAction({ type: "endTurn" });
    return;
  }
  openActionModal(
    "结束本回合？",
    `<p class="modal-description">还有 <strong>${unacted}</strong> 支部队尚未行动。结束后将轮到下一位指挥官。</p><div class="modal-buttons"><button class="button secondary" id="keep-turn">继续部署</button><button class="button primary" id="confirm-end">结束回合 →</button></div>`,
    "PASS THE COMMAND",
  );
  $("#keep-turn").onclick = closeModal;
  $("#confirm-end").onclick = () => {
    closeModal();
    performAction({ type: "endTurn" });
  };
}
$("#end-turn").onclick = endTurnDialog;
function powerDialog(level) {
  if (!isMyTurn() || busy) return;
  const co = COMMANDERS[ownPlayer().commander];
  openActionModal(
    level === "super" ? co.superName : co.powerName,
    `<p class="modal-description">${esc(level === "super" ? co.superDescription : co.powerDescription)}</p><p class="muted">消耗 ${level === "super" ? 100 : 50} 点指挥能量。强化持续到下个己方回合开始。</p><div class="modal-buttons"><button class="button secondary" id="cancel-power">稍后使用</button><button class="button primary" id="confirm-power">发动能力 ⚡</button></div>`,
    "CO POWER / 指挥官能力",
  );
  $("#cancel-power").onclick = closeModal;
  $("#confirm-power").onclick = () => {
    closeModal();
    performAction({ type: "power", level });
  };
}
$("#power-button").onclick = () => powerDialog("power");
$("#super-button").onclick = () => powerDialog("super");
function showTurnBanner() {
  const active = room.state.players.find(
      (p) => p.id === room.state.currentPlayer,
    ),
    banner = $("#turn-banner");
  banner.innerHTML = `${esc(active.name)}的回合<small>DAY ${String(room.state.day).padStart(2, "0")} · ${isMyTurn() ? "AWAITING YOUR ORDERS" : "COMMAND IN PROGRESS"}</small>`;
  banner.style.borderColor = TEAM_COLORS[active.id];
  banner.classList.remove("hidden");
  clearTimeout(showTurnBanner.timer);
  showTurnBanner.timer = setTimeout(() => banner.classList.add("hidden"), 1900);
  if (isMyTurn()) beep("turn");
}
function showVictory(force = false) {
  const key = `${room.id}:${room.state.turn}`;
  if (victoryShown === key && !force) return;
  victoryShown = key;
  const record = recordOf(room, room.state);
  if (record && recordMatch(record)) {
    paintAvatarButton();
    toast(record.won ? "本局已记入战绩：胜利" : "本局已记入战绩：失败");
  }
  const won = ownPlayer().team === room.state.winner,
    state = room.state,
    winners = state.players
      .filter((p) => p.team === state.winner)
      .map((p) => p.name)
      .join(" & ");
  openModal(
    won ? "战术奏效。胜利属于你。" : "作战结束，整装再来。",
    `<div class="result-medal">${won ? "⚑" : "⌖"}</div><p class="result-subtitle">${esc(winners || "本局")}获胜<br>每一次部署，都是下一次胜利的经验。</p><div class="result-stats"><div><strong>${state.day}</strong><span>作战天数</span></div><div><strong>${state.units.filter((u) => u.owner === session.seat).length}</strong><span>剩余部队</span></div><div><strong>${state.tiles.filter((t) => t.owner === session.seat).length}</strong><span>控制据点</span></div></div><div class="modal-buttons"><button class="button secondary" id="review-field">查看战场</button>${session.seat === room.hostSeat ? '<button class="button primary" id="rematch">重新部署 →</button>' : ""}</div>`,
    "AFTER ACTION REPORT / 战后报告",
  );
  $("#review-field").onclick = closeModal;
  if ($("#rematch"))
    $("#rematch").onclick = () =>
      safe(async () => {
        closeModal();
        await roomRequest("rematch");
      });
}
$("#save-game").onclick = () =>
  safe(async () => {
    await roomRequest("save");
    toast("整场对局已保存，房主重启服务后也可继续。");
  });
$("#battle-invite").onclick = () => {
  const url = inviteURL();
  openModal(
    `房间 ${room.id}`,
    `<p class="modal-description">${esc(getMap(room.mapId).name)} · ${room.mode === "teams" ? "2v2 联合行动" : "自由混战"}<br>对局开始后保留原有席位。已加入的玩家可通过原浏览器恢复连接。</p><div class="copy-row"><input readonly id="room-info-url" value="${esc(url)}"><button class="button small" id="copy-room-info">复制</button></div><p class="muted">浏览器可关闭后重新加入；提供服务的房主电脑需保持运行。服务重启后会从最近存档恢复。</p><div class="modal-buttons"><button class="button secondary" id="return-hall">返回大厅</button><button class="button subtle" id="surrender" ${!isMyTurn() ? "disabled" : ""}>认输退出本局</button></div>`,
    "LAN SESSION",
  );
  $("#copy-room-info").onclick = () => copyText(url);
  $("#return-hall").onclick = () => {
    closeModal();
    goHome();
  };
  $("#surrender").onclick = () => {
    openActionModal(
      "确认认输？",
      '<p class="modal-description">你将退出这场作战，剩余部队会从战场移除。此操作无法撤销。</p><div class="modal-buttons"><button class="button secondary" id="cancel-surrender">继续战斗</button><button class="button primary" id="confirm-surrender">确认认输</button></div>',
    );
    $("#cancel-surrender").onclick = closeModal;
    $("#confirm-surrender").onclick = () => {
      closeModal();
      performAction({ type: "surrender" });
    };
  };
};
function goHome() {
  hideCombat();
  clearVictoryDelay();
  eventSource?.close();
  eventSource = null;
  session = null;
  room = null;
  previousTurn = null;
  victoryShown = null;
  resetSelection();
  showScreen("landing");
  setNetwork("作战服务就绪");
  $("#footer-message").textContent = "保持观察，等待你的机会。";
  updateResume();
}
$("#home-button").onclick = () => {
  if (screen === "landing") return;
  openModal(
    "返回作战大厅？",
    '<p class="modal-description">当前对局会保留。你可以通过「继续上次作战」重新加入，其他人的游戏不会中断。</p><div class="modal-buttons"><button class="button secondary" id="stay-here">留在这里</button><button class="button primary" id="leave-here">返回大厅</button></div>',
  );
  $("#stay-here").onclick = closeModal;
  $("#leave-here").onclick = () => {
    closeModal();
    goHome();
  };
};
$("#lobby-back").onclick = goHome;
function createDialog() {
  openModal(
    "建立作战",
    `<p class="modal-description">选好战场即可出击。空位由电脑接管，朋友可随时加入。</p><form id="create-form"><div class="form-grid"><div class="form-field"><label for="create-name">你的呼号</label><input id="create-name" maxlength="18" required value="${esc(nickname())}" autocomplete="nickname"></div><div class="form-field"><label for="create-count">作战人数</label><select id="create-count"><option value="2">2 人</option><option value="3">3 人混战</option><option value="4">4 人</option></select></div><div class="form-field"><label for="create-map-search">查找战场</label><input id="create-map-search" type="search" placeholder="名称、地形或战术" autocomplete="off"><label for="create-map">战场</label><select id="create-map" required>${mapOptions()}</select><small id="create-map-info" class="map-picker-info"></small></div><div class="form-field"><label for="create-co">指挥官</label><select id="create-co">${commanderOptions()}</select></div></div><div class="form-error" id="create-error"></div><button class="button primary large" type="submit">出击 <b>→</b></button></form>`,
    "CREATE OPERATION / 战前集结",
  );
  const mapSelect = $("#create-map");
  const describeMap = () => {
    const map = MAPS.find((candidate) => candidate.id === mapSelect.value);
    $("#create-map-info").textContent = map
      ? `${mapCategory(map)} · ${map.description}`
      : "调整人数或搜索词以查找战场。";
  };
  const refreshMaps = () => {
    const count = Number($("#create-count").value);
    const choices = mapsForPlayerCount(MAPS, count, $("#create-map-search").value);
    const selected = choices.some((map) => map.id === mapSelect.value)
      ? mapSelect.value : choices[0]?.id || "";
    mapSelect.innerHTML = mapOptions(selected, count, $("#create-map-search").value);
    mapSelect.value = selected;
    describeMap();
  };
  $("#create-count").addEventListener("change", refreshMaps);
  $("#create-map-search").addEventListener("input", refreshMaps);
  mapSelect.addEventListener("change", describeMap);
  describeMap();
  $("#create-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    try {
      const name = $("#create-name").value.trim() || "指挥官";
      store("field-command-name", name);
      const result = await api("/api/rooms", {
        name,
        playerCount: Number($("#create-count").value),
        mapId: $("#create-map").value,
        commander: $("#create-co").value,
        mode: "ffa",
      });
      closeModal();
      attachSession(result);
    } catch (error) {
      $("#create-error").textContent = error.message;
      button.disabled = false;
    }
  };
}
$("#create-room").onclick = createDialog;
function joinDialog(prefill = "") {
  openModal(
    "加入作战房间",
    `<p class="modal-description">${
      publicMode
        ? "在房主给你的地址打开本页，输入房间码加入。"
        : "在房主的服务地址打开本页，输入房间码加入。两台设备需要处于同一局域网。"
    }</p><form id="join-form"><div class="form-grid"><div class="form-field"><label for="join-code">房间码</label><input id="join-code" maxlength="12" placeholder="例如 AB12CD" required value="${esc(prefill)}" style="text-transform:uppercase" autocomplete="off"></div><div class="form-field"><label for="join-name">你的呼号</label><input id="join-name" maxlength="18" required value="${esc(nickname())}" autocomplete="nickname"></div><div class="form-field wide"><label for="join-co">指挥官</label><select id="join-co">${commanderOptions("mechanic")}</select></div></div><div class="form-error" id="join-error"></div><button class="button primary large" type="submit">加入战场 <b>→</b></button></form><div class="room-list" id="available-rooms"></div>`,
    "JOIN OPERATION / 接入战场",
  );
  $("#join-form").onsubmit = async (event) => {
    event.preventDefault();
    event.submitter.disabled = true;
    try {
      const id = $("#join-code").value.trim().toUpperCase(),
        name = $("#join-name").value.trim() || "指挥官";
      store("field-command-name", name);
      if (storedSessions[id]) {
        await resumeSession(id);
        closeModal();
        return;
      }
      const result = await api(`/api/rooms/${encodeURIComponent(id)}/join`, {
        name,
        commander: $("#join-co").value,
      });
      closeModal();
      attachSession(result);
    } catch (error) {
      if ($("#join-error")) $("#join-error").textContent = error.message;
      if (event.submitter) event.submitter.disabled = false;
    }
  };
  api("/api/rooms")
    .then((result) => {
      publicMode = !!result.publicMode;
      const list = $("#available-rooms");
      if (!list) return;
      const waiting = (result.rooms || []).filter((r) => r.phase === "lobby");
      if (!waiting.length) {
        list.innerHTML = `<p class="muted">${
          publicMode
            ? "公网作战不列出公开房间。请向房主索取房间码，在上方输入即可加入。"
            : "当前没有等待中的房间。房主启动服务并建房后，这里会显示可加入的房间。"
        }</p>`;
        return;
      }
      list.innerHTML = waiting
        .slice(0, 5)
        .map(
          (r) =>
            `<button data-room="${esc(r.id)}"><span>${esc(r.hostName)}的房间 · ${esc(r.id)}</span><small>${r.humanCount}/${r.playerCount} 玩家</small></button>`,
        )
        .join("");
      list.querySelectorAll("button").forEach(
        (button) =>
          (button.onclick = () => {
            $("#join-code").value = button.dataset.room;
          }),
      );
    })
    .catch(() => {});
}
$("#join-room").onclick = () => joinDialog();
function updateResume() {
  const id = loadJSON("field-command-last", null);
  $("#resume-game").classList.toggle("hidden", !id || !storedSessions[id]);
}
async function resumeSession(id) {
  const saved = storedSessions[id];
  if (!saved) throw new Error("此浏览器没有该房间的席位记录。");
  try {
    const result = await api(
      `/api/rooms/${encodeURIComponent(id)}?token=${encodeURIComponent(saved.token)}`,
    );
    attachSession({
      ...result,
      token: saved.token,
      seat: result.seat ?? saved.seat,
    });
  } catch (error) {
    if (/不存在|凭证|失效|无效|找到/.test(error.message)) {
      delete storedSessions[id];
      store("field-command-sessions", storedSessions);
      updateResume();
    }
    throw error;
  }
}
$("#resume-game").onclick = () =>
  safe(() => resumeSession(loadJSON("field-command-last", null)));
function help() {
  openModal(
    "战地手册",
    `<section class="help-section"><h3>01 / 下达第一条指令</h3><p><strong>按住</strong>己方部队约 0.1 秒，青色行动范围展开；<strong>别松手直接拖</strong>，会拉出一条红色移动箭头，随你的光标沿真实路线拐弯。松手钉住箭头，再点地图上的目的地（或点右侧「移动并待机」）部队才会前进。也可以沿用老办法：点单位 → 点青色格 → 选命令。攻击则为：预选落点后点红色敌军，再点「确认攻击」。预选移动可以取消；执行后的指令不可撤销。</p></section><section class="help-section"><h3>02 / 用地形与射程赢得交换</h3><p>单位每回合行动一次。森林、山地和据点提供防御。步兵可登山，车辆必须绕行。火炮与火箭炮具有最小射程，移动后不能开火；近战单位会在条件允许时反击。</p></section><section class="help-section"><h3>03 / 占领、生产与补给</h3><p>步兵与机步兵能占领城市、工厂、机场、港口与总部，单次占领推进量取决于剩余血量。点击空闲的己方工厂、机场或港口，分别生产陆军、空军或海军。占领据点带来收入；己方据点能维修和补给。补给车可补充邻近部队的弹药与燃料。</p></section><section class="help-section"><h3>04 / 指挥官与胜利条件</h3><p>交战积累指挥能量，50 点可发动普通能力，100 点可发动超级能力。占领敌方总部可使其出局；失去全部单位与工厂也会出局。最后存活的一方或队伍获胜。2v2 中队友资金独立。</p></section><section class="help-section"><h3>05 / 局域网与存档</h3><p>房主创建房间，把邀请地址发给同一局域网内的朋友。支持 2–4 人，空闲电脑席位可在开局前被玩家加入。每次行动自动保存，「保存对局」另存手动快照。断线后使用原浏览器重连，原席位会保留。房主浏览器可以关闭，运行服务的电脑需保持在线。</p></section><section class="help-section"><h3>06 / 操作与当前内容</h3><p><span class="key">Esc</span> 取消预选 / 关闭弹窗　<span class="key">Space</span> 结束回合</p><p>本版提供 25 种陆海空兵种、47 张地图与 2 名原创指挥官，全图可见。运输直升机可载步兵，登陆舰可载陆军；潜艇可下潜，维修艇可修复相邻舰船。补给车暂不载兵。战争迷雾与战役剧情留待后续扩展。</p></section>`,
    "FIELD MANUAL / 指挥入门",
  );
}
$("#help-button").onclick = help;
$("#sound-button").onclick = () => {
  soundEnabled = !soundEnabled;
  $(".sound-slash").classList.toggle("hidden", soundEnabled);
  $("#sound-button").title = soundEnabled ? "关闭音效" : "开启音效";
  $("#sound-button").setAttribute("aria-label", $("#sound-button").title);
  beep();
};
document.addEventListener("keydown", (event) => {
  if (["INPUT", "SELECT", "TEXTAREA"].includes(event.target.tagName)) return;
  if (modal.open) return;
  if (screen !== "battle") return;
  if (event.key === "Escape") {
    if (roomOpen()) {
      // 指挥室抽屉开着时，Esc 先关抽屉（就近原则）
      toggleRoom(false);
      return;
    }
    if (holdPreviewId !== null || dragArrowPath) {
      // 长按预览/拖拽箭头最临时，Esc 优先清它
      clearHoldPreview();
      renderBattle();
      return;
    }
    if (destination || targetId) {
      destination = null;
      targetId = null;
      dragArrowPath = null;
    } else resetSelection();
    renderBattle();
  }
  if (event.code === "Space") {
    event.preventDefault();
    endTurnDialog();
  }
});
window.addEventListener("online", () =>
  setNetwork(session ? "重新连接房间…" : "作战服务就绪"),
);
window.addEventListener("offline", () => setNetwork("网络已断开", true));
updateResume();
api("/api/rooms")
  .then((result) => {
    publicMode = !!result.publicMode;
    serviceURLs = result.urls || [];
    setNetwork("作战服务就绪");
    const code = new URLSearchParams(location.search).get("room");
    if (code) {
      const normalized = code.trim().toUpperCase();
      if (storedSessions[normalized]) safe(() => resumeSession(normalized));
      else joinDialog(normalized);
    }
  })
  .catch(() => {
    setNetwork("服务未连接", true);
    toast("无法连接游戏服务，请确认启动窗口仍在运行。", true);
  });

// ============================================================================
// HW UI · 3D 倾斜与追光（2026-10-01）
// ----------------------------------------------------------------------------
// 起因：背景换成写实视频后，UI 还是"扁平色块"，两层质感对不上。
// 用户要求 UI「3D 化、真实化」。材质本身由 hw-ui.css 负责（斜切面 + 厚度），
// 这里只补一个 JS 才能做到的事：**跟随鼠标的倾斜与追光**。
//
// 边界（想清楚再动）：
//   · 倾斜只给"卡片类"元素（兵种卡、地图卡）。按钮不做倾斜——点了会晕，
//     而且按钮的"实体感"已经由 CSS 的厚度 + 按压缩进实现，不需要倾斜。
//   · 角度封顶 ±8deg。超过 10deg 就会出现明显的透视拉伸，文字会糊。
//   · 只在 pointermove 时改 CSS 变量，不做逐帧 rAF —— 鼠标不动就不计算。
//   · 触屏 / 减少动态效果偏好下直接不启用。
// ============================================================================
(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;

  const MAX_TILT = 8; // deg，超过这个角度文字会开始糊

  /** 给一个元素装上"倾斜 + 追光"。重复调用是幂等的。 */
  function attachTilt(el) {
    if (!el || el.dataset.hwTilt === "on") return;
    el.dataset.hwTilt = "on";
    el.classList.add("hw-tilt");

    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      const px = (event.clientX - box.left) / box.width;
      const py = (event.clientY - box.top) / box.height;
      // 鼠标在右半边 → 卡片向右侧转（Y 轴正角度），像被"推"了一下
      el.style.setProperty("--hw-ry", ((px - 0.5) * MAX_TILT * 2).toFixed(2) + "deg");
      el.style.setProperty("--hw-rx", ((0.5 - py) * MAX_TILT * 2).toFixed(2) + "deg");
      el.style.setProperty("--hw-gx", (px * 100).toFixed(1) + "%");
      el.style.setProperty("--hw-gy", (py * 100).toFixed(1) + "%");
      el.style.setProperty("--hw-gl", "1");
    });

    // 离开时回正。用 transition 收回去，不要瞬间弹回（会显得很跳）。
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--hw-rx", "0deg");
      el.style.setProperty("--hw-ry", "0deg");
      el.style.setProperty("--hw-gl", "0");
    });
  }

  /** 给一个元素装上"只跟光、不倾斜"的效果（按钮用）。 */
  function attachGlow(el) {
    if (!el || el.dataset.hwGlow === "on") return;
    el.dataset.hwGlow = "on";
    el.classList.add("hw-glow");

    el.addEventListener("pointermove", (event) => {
      const box = el.getBoundingClientRect();
      if (!box.width || !box.height) return;
      el.style.setProperty("--hw-gx", (((event.clientX - box.left) / box.width) * 100).toFixed(1) + "%");
      el.style.setProperty("--hw-gy", (((event.clientY - box.top) / box.height) * 100).toFixed(1) + "%");
      el.style.setProperty("--hw-gl", "1");
    });
    el.addEventListener("pointerleave", () => {
      el.style.setProperty("--hw-gl", "0");
    });
  }

  /**
   * 扫一遍页面，给该装效果的元素装上。
   * 为什么要"扫描"而不是在创建时挂载：这些元素由很多条不同的渲染路径生成
   *    （开场页是静态 HTML，战内面板是 renderBattle 每次重建的），
   * 逐个去改每条路径既散又容易漏。用 MutationObserver 兜住"后生成的"部分。
   */
  function sweep() {
    // 卡片类：倾斜 + 追光
    for (const el of document.querySelectorAll(
      ".hero-panel .feature-stats > div, .unit-card, .map-card, .player-card",
    )) attachTilt(el);

    // 按钮类：只跟光
    for (const el of document.querySelectorAll(
      ".button, .turn-button, .end-turn-button, .command-menu button, .hero-badge",
    )) attachGlow(el);
  }

  sweep();

  // 战内面板是每次 renderBattle 重建的，所以用 observer 兜住新节点。
  // 只观察 childList（结构变化），不观察 attributes —— 否则我们改 CSS 变量
  // 会触发自己，形成回调风暴。
  const observer = new MutationObserver(() => sweep());
  observer.observe(document.body, { childList: true, subtree: true });
})();
