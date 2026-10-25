/** Original procedural pixel artwork for Frontline Command. No external assets. */
import { UNITS, TERRAINS, reachable } from "./shared/engine.mjs";
import { paintUnitArtwork } from "./unit-art.mjs";
import { paintDirectionalMotion } from "./unit-direction.mjs";
import { COMBAT_TIMING, combatDuration } from "./combat-scene.mjs";
import { deathEffectKind, paintFallingSoldier, paintVehicleBlast } from "./unit-death.mjs";
import { MOVE_STEP_MS, MOVE_TURN_MS, movementDuration, captureDuration } from "./shared/animation-timing.mjs";
import { propertyFlagPose } from "./property-flag.mjs";

export { movementDuration } from "./shared/animation-timing.mjs";

export const TEAM_COLORS = ["#ef745e", "#64b7e8", "#edcb66", "#9c8ce6"];
const TILE = 40;
export const TEAM_PALETTES = [
  ["#f79a75", "#df634c", "#a83c36", "#713134"],
  ["#91d5ef", "#4ba5d1", "#2e668f", "#29415f"],
  ["#ffe499", "#dfbd56", "#a27b33", "#6a522d"],
  ["#c2acef", "#9278ce", "#634da0", "#44385f"],
];
const GRASS = ["#76966b", "#7d9e70", "#749468", "#809d71"];
const NEUTRAL = ["#e4ddbd", "#b7b89d", "#777f74", "#505f5a"];
const hash = (x, y, k = 0) =>
  Math.abs(((x * 92837111) ^ (y * 689287499) ^ (k * 283923481)) >>> 0);
const tileKey = (x, y) => `${x},${y}`;
const palette = (owner) =>
  owner == null ? NEUTRAL : TEAM_PALETTES[((owner % 4) + 4) % 4];

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
function line(ctx, points, color, width = 1) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++)
    ctx.lineTo(points[i][0], points[i][1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
function polygon(ctx, points, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++)
    ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}
function tree(ctx, x, y, size = 1, shade = 0) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  box(ctx, 0, 12, 12, 4, "#627c58");
  box(ctx, 5, 9, 3, 7, "#665b41");
  box(ctx, 2, 5, 11, 7, "#315e51");
  box(ctx, 0, 2, 13, 7, shade ? "#3e7059" : "#3c6e53");
  box(ctx, 3, -1, 8, 3, "#4e805c");
  box(ctx, 1, 3, 5, 3, "#619261");
  box(ctx, 5, 0, 5, 3, "#729d69");
  box(ctx, 10, 6, 3, 5, "#2e594b");
  ctx.restore();
}
function pine(ctx, x, y, size = 1) {
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale(size, size);
  box(ctx, 6, 15, 3, 6, "#6b6042");
  box(ctx, 0, 13, 15, 4, "#315c4c");
  box(ctx, 2, 8, 11, 5, "#376a50");
  box(ctx, 4, 4, 7, 5, "#46815c");
  box(ctx, 6, 0, 3, 5, "#669367");
  box(ctx, 3, 12, 3, 2, "#619461");
  ctx.restore();
}

function paintGround(ctx, tile) {
  const { x, y } = tile;
  box(ctx, 0, 0, TILE, TILE, GRASS[hash(x, y) % GRASS.length]);
  for (let i = 0; i < 12; i++) {
    const px = 2 + (hash(x, y, i + 2) % 36);
    const py = 2 + (hash(y, x, i + 30) % 35);
    box(ctx, px, py, 2 + (i % 2), 1, i % 3 ? "#86a675" : "#6b8b62");
    if (i % 4 === 0) box(ctx, px + 1, py - 1, 1, 1, "#91ac7c");
  }
}
function paintWater(ctx, tile, neighbors) {
  box(ctx, 0, 0, TILE, TILE, "#578f9c");
  box(ctx, 0, 0, TILE, 2, "#609aa4");
  const land = (t) => t && !["water", "sea", "shoal", "bridge", "port"].includes(t.type);
  if (land(neighbors.up)) {
    box(ctx, 0, 0, TILE, 5, "#a7b185");
    box(ctx, 0, 5, TILE, 2, "#8fb4ad");
    box(ctx, 4, 3, 9, 2, "#bdbe8d");
    box(ctx, 26, 3, 8, 2, "#bdbe8d");
  }
  if (land(neighbors.down)) {
    box(ctx, 0, 35, TILE, 5, "#a7b185");
    box(ctx, 0, 33, TILE, 2, "#8fb4ad");
  }
  if (land(neighbors.left)) {
    box(ctx, 0, 0, 5, TILE, "#a7b185");
    box(ctx, 5, 0, 2, TILE, "#8fb4ad");
  }
  if (land(neighbors.right)) {
    box(ctx, 35, 0, 5, TILE, "#a7b185");
    box(ctx, 33, 0, 2, TILE, "#8fb4ad");
  }
}
function paintRoad(ctx, neighbors, bridge = false) {
  const connects = (t) =>
    t && ["road", "bridge", "city", "factory", "hq", "airport", "port"].includes(t.type);
  let u = connects(neighbors.up),
    d = connects(neighbors.down);
  let l = connects(neighbors.left),
    r = connects(neighbors.right);
  if (!u && !d && !l && !r) l = r = true;
  const surface = bridge ? "#b5b298" : "#b4ad89";
  const edge = bridge ? "#5e6862" : "#8d9272";
  box(ctx, 7, 7, 26, 26, edge);
  box(ctx, 9, 9, 22, 22, surface);
  if (u) {
    box(ctx, 7, 0, 26, 20, edge);
    box(ctx, 9, 0, 22, 20, surface);
  }
  if (d) {
    box(ctx, 7, 20, 26, 20, edge);
    box(ctx, 9, 20, 22, 20, surface);
  }
  if (l) {
    box(ctx, 0, 7, 20, 26, edge);
    box(ctx, 0, 9, 20, 22, surface);
  }
  if (r) {
    box(ctx, 20, 7, 20, 26, edge);
    box(ctx, 20, 9, 20, 22, surface);
  }
  if (bridge) {
    const horizontal = (l || r) && !(u || d);
    if (horizontal) {
      box(ctx, 0, 5, 40, 3, "#d8d4ae");
      box(ctx, 0, 32, 40, 3, "#464f4c");
      for (let x = 0; x < 40; x += 8) {
        box(ctx, x, 5, 2, 5, "#e2dab4");
        box(ctx, x, 30, 2, 6, "#979780");
      }
      for (let x = 4; x < 40; x += 8) box(ctx, x, 11, 1, 18, "#a09f89");
    } else {
      box(ctx, 5, 0, 3, 40, "#d8d4ae");
      box(ctx, 32, 0, 3, 40, "#464f4c");
      for (let y = 0; y < 40; y += 8) {
        box(ctx, 5, y, 5, 2, "#e2dab4");
        box(ctx, 30, y, 6, 2, "#979780");
      }
      for (let y = 4; y < 40; y += 8) box(ctx, 11, y, 18, 1, "#a09f89");
    }
  } else {
    if (u) box(ctx, 19, 2, 2, 5, "#d6cfac");
    if (d) box(ctx, 19, 34, 2, 4, "#d6cfac");
    if (l) box(ctx, 2, 19, 5, 2, "#d6cfac");
    if (r) box(ctx, 34, 19, 4, 2, "#d6cfac");
    box(ctx, 12, 13, 2, 1, "#c4bd99");
    box(ctx, 26, 25, 3, 1, "#a49f81");
  }
}
function paintMountain(ctx, tile) {
  const flip = hash(tile.x, tile.y) % 2;
  if (flip) {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  polygon(
    ctx,
    [
      [3, 34],
      [3, 30],
      [7, 30],
      [7, 24],
      [12, 24],
      [12, 17],
      [16, 17],
      [16, 10],
      [20, 10],
      [20, 5],
      [23, 5],
      [23, 10],
      [27, 10],
      [27, 17],
      [31, 17],
      [31, 25],
      [35, 25],
      [35, 31],
      [38, 31],
      [38, 36],
    ],
    "#536a56",
  );
  polygon(
    ctx,
    [
      [5, 32],
      [9, 24],
      [14, 24],
      [18, 15],
      [21, 8],
      [23, 8],
      [23, 31],
      [33, 35],
      [10, 35],
    ],
    "#a7aa84",
  );
  polygon(
    ctx,
    [
      [23, 8],
      [26, 15],
      [28, 20],
      [31, 26],
      [36, 33],
      [25, 34],
      [20, 30],
    ],
    "#7c8a70",
  );
  polygon(
    ctx,
    [
      [16, 17],
      [20, 9],
      [21, 5],
      [23, 5],
      [26, 14],
      [27, 17],
      [23, 15],
      [21, 18],
      [19, 15],
    ],
    "#e4dfbd",
  );
  box(ctx, 10, 28, 5, 2, "#bdba91");
  box(ctx, 15, 23, 3, 3, "#c6c29b");
  box(ctx, 27, 29, 3, 2, "#607660");
}
function paintBuilding(ctx, tile) {
  const p = palette(tile.owner);
  box(ctx, 3, 10, 34, 28, "#78876e");
  box(ctx, 4, 9, 32, 27, "#b2b294");
  box(ctx, 7, 12, 26, 21, "#c3c1a2");
  box(ctx, 29, 17, 7, 19, "#8b917b");
  if (tile.type === "factory") {
    box(ctx, 6, 16, 27, 17, "#777f70");
    box(ctx, 6, 12, 8, 6, p[2]);
    box(ctx, 14, 9, 8, 9, p[1]);
    box(ctx, 22, 12, 11, 6, p[2]);
    box(ctx, 7, 12, 7, 2, p[0]);
    box(ctx, 15, 9, 7, 2, p[0]);
    box(ctx, 23, 12, 9, 2, p[0]);
    box(ctx, 10, 22, 19, 11, "#394f4a");
    box(ctx, 12, 22, 15, 2, "#a6af9e");
    box(ctx, 12, 26, 15, 1, "#7f9585");
    box(ctx, 12, 29, 15, 1, "#7f9585");
    box(ctx, 29, 4, 4, 10, "#6f7a6a");
    box(ctx, 28, 3, 6, 3, "#b5b59a");
    box(ctx, 29, 4, 4, 1, "#455b50");
    box(ctx, 5, 32, 28, 3, "#d9cd9a");
    for (let x = 7; x < 32; x += 6) box(ctx, x, 33, 3, 2, "#8a835f");
  } else if (tile.type === "hq") {
    box(ctx, 8, 14, 23, 19, "#d5ccb0");
    box(ctx, 7, 12, 25, 5, p[2]);
    box(ctx, 10, 10, 19, 3, p[1]);
    box(ctx, 14, 6, 11, 5, p[0]);
    box(ctx, 9, 17, 3, 13, "#f3e3b7");
    box(ctx, 27, 17, 3, 13, "#b2b498");
    box(ctx, 17, 22, 7, 10, "#3e5855");
    box(ctx, 16, 18, 9, 2, "#799187");
    box(ctx, 7, 32, 26, 3, "#eddfb6");
    box(ctx, 5, 35, 30, 2, "#c7bd96");
    // The two-tone star is a distinct command-post insignia.
    box(ctx, 19, 10, 3, 6, "#ffe7aa");
    box(ctx, 17, 12, 7, 2, "#ffe7aa");
  } else {
    box(ctx, 7, 13, 12, 18, "#e3d5b0");
    box(ctx, 6, 10, 14, 6, p[2]);
    box(ctx, 8, 8, 10, 3, p[1]);
    box(ctx, 8, 9, 10, 1, p[0]);
    box(ctx, 21, 18, 12, 15, "#cecaab");
    box(ctx, 20, 15, 14, 5, p[2]);
    box(ctx, 22, 13, 10, 3, p[1]);
    box(ctx, 22, 14, 10, 1, p[0]);
    for (const [x, y] of [
      [9, 18],
      [15, 18],
      [9, 24],
      [23, 22],
      [29, 22],
    ]) {
      box(ctx, x, y, 3, 4, "#587575");
      box(ctx, x, y, 3, 1, "#385655");
    }
    box(ctx, 14, 25, 4, 7, "#6d7968");
    box(ctx, 25, 28, 4, 5, "#6d7968");
    box(ctx, 4, 33, 31, 2, "#d4c8a3");
  }
}
function paintShoal(ctx, tile, neighbors) {
  paintWater(ctx, tile, neighbors);
  box(ctx, 3, 29, 16, 5, "#9cbdab");
  box(ctx, 5, 27, 10, 2, "#c3c9a7");
  box(ctx, 22, 8, 12, 3, "#9ac5bb");
  box(ctx, 27, 5, 5, 2, "#d4d1af");
  for (const [x,y] of [[5,16],[17,20],[26,29],[32,17]]) box(ctx,x,y,4,1,"#c7e2d4");
}
function paintPort(ctx, tile, neighbors) {
  paintWater(ctx, tile, neighbors);
  const p = palette(tile.owner);
  box(ctx, 0, 1, 16, 39, "#a5b29a");
  box(ctx, 0, 2, 14, 37, "#c8bf9f");
  for (let y = 3; y < 39; y += 8) box(ctx, 3, y, 11, 1, "#928a70");
  box(ctx, 13, 0, 3, 40, "#536e6d");
  box(ctx, 16, 28, 23, 4, "#465c5d");
  box(ctx, 18, 25, 18, 5, p[2]);
  box(ctx, 21, 24, 11, 2, p[0]);
  box(ctx, 20, 32, 15, 2, "#2b535e");
  box(ctx, 7, 7, 2, 19, "#435e61");
  box(ctx, 8, 7, 15, 2, p[1]);
  box(ctx, 20, 8, 2, 12, "#435e61");
  box(ctx, 18, 18, 6, 3, "#e4d4a3");
}
function paintAirport(ctx, tile) {
  const p = palette(tile.owner);
  box(ctx, 0, 0, 40, 40, "#799575");
  box(ctx, 17, 0, 16, 40, "#4d6261");
  box(ctx, 18, 0, 13, 40, "#6c7770");
  for (let y = 3; y < 39; y += 9) box(ctx, 24, y, 2, 5, "#e6d9ae");
  box(ctx, 1, 12, 15, 23, "#4e6b66");
  box(ctx, 3, 10, 13, 23, "#d4c9a8");
  box(ctx, 2, 8, 15, 5, p[2]);
  box(ctx, 4, 6, 12, 3, p[1]);
  box(ctx, 4, 6, 9, 1, p[0]);
  box(ctx, 5, 17, 9, 9, "#668581");
  box(ctx, 5, 17, 9, 2, "#354f55");
  box(ctx, 34, 22, 4, 12, "#60746e");
  box(ctx, 33, 19, 6, 3, "#e2dbb9");
}
function paintRail(ctx) {
  box(ctx, 0, 9, 40, 22, "#9e9d7d");
  for (let x = 1; x < 40; x += 7) box(ctx, x, 11, 3, 18, "#786b57");
  box(ctx, 0, 14, 40, 2, "#425b5c");
  box(ctx, 0, 24, 40, 2, "#425b5c");
  box(ctx, 0, 14, 40, 1, "#adaba0");
  box(ctx, 0, 24, 40, 1, "#adaba0");
}
function paintTile(ctx, tile, neighbors) {
  ctx.save();
  ctx.translate(tile.x * TILE, tile.y * TILE);
  paintGround(ctx, tile);
  switch (tile.type) {
    case "water":
    case "sea":
      paintWater(ctx, tile, neighbors);
      break;
    case "shoal":
      paintShoal(ctx, tile, neighbors);
      break;
    case "bridge":
      paintWater(ctx, tile, neighbors);
      paintRoad(ctx, neighbors, true);
      break;
    case "road":
      paintRoad(ctx, neighbors);
      break;
    case "rail":
      paintRail(ctx);
      break;
    case "coast":
      box(ctx, 0, 26, 40, 14, "#c4ba91");
      box(ctx, 0, 23, 40, 3, "#ddcca0");
      box(ctx, 2, 21, 11, 2, "#edf1d2");
      box(ctx, 23, 20, 12, 2, "#edf1d2");
      break;
    case "forest":
      tree(ctx, 22, 4, 1, 1);
      tree(ctx, 2, 2);
      pine(ctx, 14, 12);
      tree(ctx, 2, 20, 0.9, 1);
      tree(ctx, 26, 24, 0.8);
      break;
    case "mountain":
      paintMountain(ctx, tile);
      break;
    case "city":
    case "factory":
    case "hq":
      paintBuilding(ctx, tile);
      break;
    case "port":
      paintPort(ctx, tile, neighbors);
      break;
    case "airport":
      paintAirport(ctx, tile);
      break;
    default:
      if (hash(tile.x, tile.y, 5) % 9 === 0) {
        box(ctx, 29, 30, 3, 2, "#b9b68b");
        box(ctx, 31, 29, 3, 2, "#a7a87c");
      }
  }
  // Fine tile seams stay quiet even beneath deployment overlays.
  box(ctx, 39, 0, 1, 40, "rgba(31,59,51,.08)");
  box(ctx, 0, 39, 40, 1, "rgba(31,59,51,.08)");
  ctx.restore();
}

function paintUnit(ctx, unit, x, y, motion) {
  const p = palette(unit.owner);
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  const resting = motion.action === "idle";
  if (unit.acted && resting) ctx.globalAlpha = 0.74;
  if (unit.submerged) ctx.globalAlpha *= motion.action === "submerge"
    ? 1 - .45 * motion.phase : .55;
  else if (motion.action === "surface") ctx.globalAlpha *= .55 + .45 * motion.phase;
  box(ctx, 6, 29, 29, 4, "rgba(24,45,42,.25)");
  box(ctx, 10, 33, 20, 1, "rgba(24,45,42,.15)");
  paintDirectionalMotion(ctx, unit.type, p, motion.direction || "right", motion.phase, motion.action);
  ctx.globalAlpha = 1;
  if (unit.acted && resting) {
    box(ctx, 3, 4, 9, 7, "rgba(27,48,43,.85)");
    box(ctx, 5, 7, 2, 2, "#d4ddbb");
    box(ctx, 7, 5, 3, 2, "#d4ddbb");
  }
  // Show the whole unit's strength, including the full 10/10 state.
  box(ctx, 9, 32, 29, 7, "#253f3e");
  box(ctx, 10, 33, Math.max(1, Math.ceil((27 * unit.hp) / 10)), 1, p[0]);
  ctx.fillStyle = unit.hp <= 3 ? "#ffad87" : "#fff2cf";
  ctx.font = "bold 8px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.ceil(unit.hp)}/10`, 23.5, 36.5);
  if (unit.cargo && (!Array.isArray(unit.cargo) || unit.cargo.length > 0)) {
    box(ctx, 3, 27, 7, 8, "#263f3b");
    box(ctx, 5, 28, 3, 2, "#ffe4a3");
    box(ctx, 4, 31, 5, 3, "#ffe4a3");
  }
  if (unit.type === "submarine" && (unit.submerged || motion.action === "surface" || motion.action === "submerge")) {
    box(ctx, 5, 11, 3, 2, "#a5d6d5");
    box(ctx, 10, 7 + Math.floor(motion.phase * 3), 2, 2, "#c4e6dd");
  }
  if (unit.ammo === 0 || unit.fuel === 0) {
    box(ctx, 30, 3, 7, 8, "#ffe1a2");
    box(ctx, 33, 4, 1, 4, "#9c503d");
    box(ctx, 33, 9, 1, 1, "#9c503d");
  }
  ctx.restore();
}

/**
 * 伤害预测浮标 —— 战场上的小标签。
 *
 * ★ 2026-09-30 新增（参考资产 §2.4）。
 * 高级战争的 `damage-forecast-pane.png` 只有 32×23，说明它**不是面板**，
 * 而是一个**浮在目标格上方的小牌子**：顶部深色条写 `DAMAGE`，
 * 下方亮绿大数字 `87%`，底部一个尖角指向目标格（对话气泡造型）。
 *
 * 采样配色：
 *   牌头  深灰蓝（约 rgb(48,56,64)）
 *   数字底 亮绿（约 rgb(80,255,120)）
 *   文字  黑
 *
 * 我们不用百分比，用本作的 −HP 制（更符合已有数值体系）。
 * 目标：**信息出现在战场上，而不是屏幕边上的卡片里**。
 */
function damageBubble(ctx, cellX, cellY, label, value, tone, canvasW = 0) {
  const cx = cellX * TILE + TILE / 2;
  const bubbleW = 46;
  const bubbleH = 28;
  // 默认浮在目标格**上方偏右**：偏右是为了避开脚下的环形光标
  // （光标半径 TILE*0.66，正上方会被环压住）。
  // 若会顶出画布上沿则翻到下方；若右侧越界则靠左贴边。
  const above = cellY > 1;
  const by = above ? cellY * TILE - bubbleH - 4 : cellY * TILE + TILE + 4;
  let bx = Math.round(cx - bubbleW * 0.35);
  if (canvasW > 0) bx = Math.max(2, Math.min(bx, canvasW - bubbleW - 2));
  // 阴影
  box(ctx, bx + 2, by + 2, bubbleW, bubbleH, "rgba(0,0,0,.35)");
  // 牌头（深色条）
  box(ctx, bx, by, bubbleW, 11, "rgba(38,48,54,.96)");
  // 牌身（亮色底）
  box(ctx, bx, by + 11, bubbleW, bubbleH - 11, tone.body);
  // 外描边
  box(ctx, bx, by, bubbleW, 1, "rgba(0,0,0,.6)");
  box(ctx, bx, by + bubbleH - 1, bubbleW, 1, "rgba(0,0,0,.6)");
  box(ctx, bx, by, 1, bubbleH, "rgba(0,0,0,.6)");
  box(ctx, bx + bubbleW - 1, by, 1, bubbleH, "rgba(0,0,0,.6)");
  // 尖角：从牌子下沿指向目标格
  polygon(
    ctx,
    [
      [cx - 5, above ? by + bubbleH - 1 : by + 1],
      [cx + 5, above ? by + bubbleH - 1 : by + 1],
      [cx, above ? by + bubbleH + 4 : by - 4],
    ],
    tone.body,
  );
  // 文字（用 canvas 直接写，字号与像素风对齐）
  ctx.save();
  ctx.font = "700 7px ui-monospace, monospace";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(180,196,204,.95)";
  ctx.fillText(label, bx + 4, by + 6);
  ctx.font = "700 12px ui-monospace, monospace";
  ctx.fillStyle = tone.text;
  ctx.fillText(value, bx + 4, by + 19);
  ctx.restore();
}

function corners(ctx, x, y, color, inset = 1, length = 7, thickness = 2) {
  const s = TILE - inset * 2;
  x += inset;
  y += inset;
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + s, y, -1, 1],
    [x, y + s, 1, -1],
    [x + s, y + s, -1, -1],
  ]) {
    box(
      ctx,
      dx < 0 ? cx - length : cx,
      dy < 0 ? cy - thickness : cy,
      length,
      thickness,
      color,
    );
    box(
      ctx,
      dx < 0 ? cx - thickness : cx,
      dy < 0 ? cy - length : cy,
      thickness,
      length,
      color,
    );
  }
}
/**
 * 移动/攻击范围格。
 *
 * ★ 2026-09-30 改（参考《高级战争》`docs/demo-reels/attack-animation.gif` 第 60 帧，见
 *   `参考资产-结构分析.md` §2.1）：
 *   旧实现每格画 `corners()` —— 四角描边 + 中点白点，读起来像「表格里涂色」。
 *   高级战争的范围块**没有任何描边**，是纯粹的整块半透明色罩，像「地面打了光」。
 *   去掉描边 + 颜色调亮，是「从 PPT 到战场」最便宜的一刀。
 *
 *   采样参考色（同一帧，格内约 rgb(144,216,170) 罩在草地上）：
 *     移动 = 青绿偏黄，攻击 = 暖红。
 */
function rangeTile(ctx, x, y, isTarget, index) {
  const ox = x * TILE,
    oy = y * TILE;
  // 参考资产实测：AW 的范围是 rgb(144,216,170) 盖在草地上、**无边框**。
  //
  // ★ 调参记录（别凭感觉改，这是两次实测的结果）：
  //   .30 → 单格 距离30/亮度+18，偏淡；
  //   .42 → 单格 距离41/亮度+25，单看很清楚，**但成片铺开后把地形纹理糊掉了**
  //         （范围常有 20~40 格，大面积叠加会让人看不清哪里是森林/城市/山地）。
  //   → 定 .34：单格仍然可辨（距离≈35），成片时地形仍能透出来。
  //   另一处关键：范围只画**底色**，不再叠任何边框/斜纹 —— 保持"光"的感觉。
  box(
    ctx,
    ox,
    oy,
    TILE,
    TILE,
    isTarget ? "rgba(240,104,78,.38)" : "rgba(122,224,168,.34)",
  );
  // 站在可移动格上时，用极淡的内描边勾出格子轮廓（仅在放大后可见），
  // 让人能数清格子，但远看仍是一片连续的光。
  if (!isTarget) {
    box(ctx, ox, oy, TILE, 1, "rgba(190,255,220,.10)");
    box(ctx, ox, oy, 1, TILE, "rgba(190,255,220,.10)");
  }
  // 只保留「可攻击目标」的中心准星，这是功能性提示而非装饰。
  if (isTarget) {
    box(ctx, ox + 17, oy + 6, 6, 2, "rgba(255,213,180,.92)");
    box(ctx, ox + 6, oy + 17, 2, 6, "rgba(255,213,180,.92)");
    box(ctx, ox + TILE / 2 - 1, oy + TILE / 2 - 1, 2, 2, "#ffd5b4");
  }
}

function heading(from, to) {
  if (to.x > from.x) return "right";
  if (to.x < from.x) return "left";
  return to.y > from.y ? "down" : "up";
}

export function movementPosition(path, elapsed, startFacing = "right") {
  if (!path?.length) return null;
  if (path.length === 1)
    return { ...path[0], direction: startFacing, turning: false, done: true };
  let remaining = Math.max(0, elapsed), previous = startFacing;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const direction = heading(from, to);
    if (direction !== previous) {
      if (remaining < MOVE_TURN_MS)
        return {
          x: from.x, y: from.y,
          direction: remaining < MOVE_TURN_MS / 2 ? previous : direction,
          turning: true, done: false,
        };
      remaining -= MOVE_TURN_MS;
    }
    if (remaining < MOVE_STEP_MS) {
      const local = remaining / MOVE_STEP_MS;
      const eased = local - (Math.sin(local * Math.PI * 2) * .35) / (Math.PI * 2);
      return {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
        direction, turning: false, done: false,
      };
    }
    remaining -= MOVE_STEP_MS;
    previous = direction;
  }
  return { ...path[path.length - 1], direction: previous, turning: false, done: true };
}

// Reconstruct one exchange from consecutive authoritative game states. This also
// works for AI and LAN actions, where the local client has no pending command.
export function capturesFromStates(before, after) {
  if (!before || !after || before.mapId !== after.mapId) return [];
  const oldUnits = new Map(before.units.map((unit) => [unit.id, unit]));
  const oldTiles = new Map((before.tiles || []).map((tile) => [tileKey(tile.x, tile.y), tile]));
  const tiles = new Map((after.tiles || []).map((tile) => [tileKey(tile.x, tile.y), tile]));
  return after.units.flatMap((unit) => {
    const old = oldUnits.get(unit.id);
    const key = tileKey(unit.x, unit.y);
    const tile = tiles.get(key), previous = oldTiles.get(key);
    if (!old || old.acted || !unit.acted || !UNITS[unit.type]?.capture ||
      !tile || !previous || !["city", "factory", "hq", "port", "airport"].includes(tile.type)) return [];
    if (tile.capture === previous.capture && tile.captureBy === previous.captureBy &&
      tile.owner === previous.owner) return [];
    return [{ unit, tile, previousTile: previous }];
  });
}

export function combatFromStates(before, after) {
  if (!before || !after || before.mapId !== after.mapId) return null;
  const capturing = new Set(capturesFromStates(before, after).map(({ unit }) => unit.id));
  const next = new Map(after.units.map((unit) => [unit.id, unit]));
  const damaged = before.units.filter((unit) => {
    const current = next.get(unit.id);
    return !current || current.hp < unit.hp;
  });
  const actors = before.units.filter((unit) => {
    const current = next.get(unit.id);
    return !unit.acted && (current?.acted || (!current && damaged.length > 1));
  });
  for (const attacker of actors) {
    if (capturing.has(attacker.id)) continue;
    const current = next.get(attacker.id);
    const definition = UNITS[attacker.type];
    for (const defender of damaged) {
      if (defender.owner === attacker.owner || defender.id === attacker.id)
        continue;
      const inRange = (position) => {
        const distance = Math.abs(position.x - defender.x) + Math.abs(position.y - defender.y);
        return distance >= definition.minRange && distance <= definition.maxRange;
      };
      let origin = current || attacker;
      if (!inRange(origin) && !current && before.players && before.tiles)
        origin = reachable(before, attacker.id).find(inRange);
      if (origin && !inRange(origin)) origin = null;
      if (!origin) continue;
      const defenderAfter = next.get(defender.id);
      return {
        attacker: { ...attacker, x: origin.x, y: origin.y, hpAfter: current?.hp ?? 0 },
        defender: { ...defender, hpAfter: defenderAfter?.hp ?? 0 },
        damage: defender.hp - (defenderAfter?.hp ?? 0),
        counter: attacker.type === "drone" ? 0 : attacker.hp - (current?.hp ?? 0),
      };
    }
  }
  return null;
}

// Keep the old sprite and HP on the map until that side is hit in the duel.
export function combatDisplayUnits(state, visual, time) {
  if (!visual || time >= visual.endAt) return state.units;
  const units = state.units.slice();
  for (const { unit, hitAt } of [
    { unit: visual.attacker, hitAt: visual.counterHitAt },
    { unit: visual.defender, hitAt: visual.defenderHitAt },
  ]) {
    if (time >= hitAt) continue;
    const index = units.findIndex((item) => item.id === unit.id);
    if (index < 0) units.push({ ...unit });
    else units[index] = { ...units[index], hp: unit.hp, acted: unit.acted };
  }
  return units;
}

export function createRenderer(
  canvas,
  { onTile = () => {}, onHover = () => {}, onHold = () => {}, onDrag = () => {}, onDragEnd = () => {}, onCombat = () => {}, onCapture = () => {}, paintPropertyFlag = null, previewUnitMotion = null } = {},
) {
  if (!canvas || typeof canvas.getContext !== "function")
    throw new Error("需要 Canvas 画布");
  const ctx = canvas.getContext("2d", { alpha: false });
  const terrainCanvas = document.createElement("canvas");
  const terrainCtx = terrainCanvas.getContext("2d", { alpha: false });
  // ★ F3：垫在战场后面的「无限延伸」层（消除黑边感）。
  // 从 DOM 里取同容器下的 #map-fill；拿不到就自动降级（不影响主渲染）。
  const mapFillCanvas = document.getElementById("map-fill");
  const fillCtx = mapFillCanvas ? mapFillCanvas.getContext("2d") : null;
  let scene = {
    state: null,
    // 光标配色需要知道"我是谁"（cursorPose 用）；由 app.mjs 通过 setScene 传入。
    seat: 0,
    // 伤害预测浮标：{ x, y, damage, counter }（参考资产 §2.4）。
    // 由 app.mjs 在预选攻击目标时传入，绘制在目标格上方，**不进侧栏**。
    combatHint: null,
    selectedId: null,
    reachable: [],
    targets: [],
    hoverTile: null,
    preview: null,
    hoverPreview: null,
    arrowPath: null,
    arrowTone: "own",
  };
  let frame = null,
    destroyed = false,
    terrainDirty = true,
    // ★ F3：容器尺寸变化时需重画背景延伸层（它是按容器尺寸铺满的）。
    mapFillDirty = true,
    lastFrameTime = 0;
  let logicalWidth = 0,
    logicalHeight = 0,
    dpr = 1,
    lastPointerKey = null;
  // 长按/拖拽：按住不动 HOLD_MS 进入箭头模式，此后拖动即拉出箭头。
  //
  // 阈值调参依据（2026-09-30 实测，别凭感觉改）：
  //  - HOLD_MS：原 120ms 会让「快手」(按下到抬起 50~110ms) 全部漏掉。
  //    实测 50/70/90/110ms 四次快抬手，旧阈值 4 个全漏。
  //    人的极快点击（mousedown→mouseup）约 40~90ms，而「意图长按」一般在 100ms 后就稳定。
  //    取 60ms：快点击边缘能覆盖，同时常规点击(>60ms)不会误触发拖拽。
  //  - HOLD_SLOP：原 6px 太小，按住时手/鼠标的轻微抖动(4~12px)会把长按取消掉。
  //    实测 4px 和 12px 抖动各取消过一次。放到 14px：
  //    既容得下手抖，又能在「明显想滑动」时正常取消。
  const HOLD_MS = 60,
    HOLD_SLOP = 14;
  let pressTimer = null,
    pressOrigin = { x: 0, y: 0 },
    pressTile = null,
    longPressed = false,
    suppressClick = false,
    dragPath = null,
    dragging = false,
    // 拖拽上报去重用的「上一次光标格」。与 dragPath（渲染结果）分开，
    // 见 pressMove 里的说明。
    lastDragKey = null;

  /**
   * 光标配色 / 尺寸，按单位状态切换。
   *
   * ★ 2026-09-30 新增（参考资产 §2.3）。
   * 高级战争有 4 种动画光标（`MapCursor/mapcursor{,-arrow,-wrench,-wrong}`），
   * 尺寸 22×22（TILE=16，即约 1.4 格）。这里按状态给出等价配色：
   *
   *   ready  可指挥 —— 暖白（对应 mapcursor）
   *   fight  可攻击 —— 亮红（对应 mapcursor-arrow）
   *   spent  已行动 —— 冷灰（对应 mapcursor-wrong）
   *   foe    敌方只读 —— 暗红（与己方区分）
   */
  const CURSOR_POSES = {
    ready: { outer: "#1f3a34", inner: "#fff2c0", hot: "#fffbe8" },
    fight: { outer: "#4a1d16", inner: "#ff9a72", hot: "#ffd3b8" },
    spent: { outer: "#26302f", inner: "#899492", hot: "#aab4b2" },
    foe: { outer: "#3a1f22", inner: "#e08a86", hot: "#f4c0bc" },
  };
  /**
   * 判定当前该用哪种光标。这一层只做展示，不改变任何可指挥性逻辑
   * （真正的可指挥判定仍在上层 `canCommand()` / `canCommandUnit()`）。
   *
   * ⚠️ 必须定义在 createRenderer 闭包内：它要读 scene.seat / scene.targets，
   *    而 scene 是闭包内的局部变量，放在模块作用域会直接 ReferenceError。
   */
  function cursorPose(unit) {
    const mine = unit.owner === scene.seat;
    if (!mine) return CURSOR_POSES.foe;
    if (unit.acted) return CURSOR_POSES.spent;
    // 有可攻击目标 → 红色战斗光标
    if ((scene.targets?.length || 0) > 0) return CURSOR_POSES.fight;
    return CURSOR_POSES.ready;
  }
  /**
   * 环形光标：单位格外的**马蹄形光环**，左右开口，不做闭合方框。
   *
   * 参考里的形状是「八边形/圆角环」——用逐段短横线拼出一个近似圆，
   * 左右两侧留缺口（读起来像一对括号，而不是一个框）。
   * 尺寸按 TILE 等比换算：参考 22px / 16px 格 ≈ 1.375 格。
   */
  function ringCursor(ctx2, tileX, tileY, outerColor, innerColor) {
    const cx = tileX + TILE / 2;
    const cy = tileY + TILE / 2;
    const outerR = TILE * 0.60;
    const innerR = TILE * 0.50;
    // 用 24 段拼环；跳过左右各 2 段，形成明显的"马蹄形"开口。
    // 段数少会让环变成粗糙的多边形（读起来像齿轮），段数多才像光环。
    const SEGMENTS = 24;
    const OPEN = new Set([5, 6, 7, 17, 18, 19]); // 左右开口
    const drawRing = (radius, color, thickness) => {
      // 用连续线段画弧，而不是逐段填方块 —— 后者会在接缝处叠出毛刺。
      ctx2.strokeStyle = color;
      ctx2.lineWidth = thickness;
      ctx2.lineCap = "butt";
      ctx2.beginPath();
      let pen = false;
      for (let i = 0; i <= SEGMENTS; i++) {
        if (OPEN.has(i)) {
          pen = false;
          continue;
        }
        const a = (i / SEGMENTS) * Math.PI * 2 - Math.PI / 2;
        const px = cx + Math.cos(a) * radius;
        const py = cy + Math.sin(a) * radius;
        if (!pen) {
          ctx2.moveTo(px, py);
          pen = true;
        } else {
          ctx2.lineTo(px, py);
        }
      }
      ctx2.stroke();
    };
    // 外环压深、内环提亮 → 制造"光标是立体的"错觉（参考里就是双层描边）
    drawRing(outerR, outerColor, Math.max(2, Math.round(TILE * 0.055)));
    drawRing(innerR, innerColor, Math.max(1, Math.round(TILE * 0.035)));
    ctx2.lineCap = "butt";
  }

  function cancelPressTimer() {
    if (pressTimer) {
      clearTimeout(pressTimer);
      pressTimer = null;
    }
  }
  let previousState = null;
  let movement = new Map();
  let explosions = [];
  let actionEvents = [];
  let captureVisuals = new Map();
  let combatVisual = null;
  let unitById = new Map();
  let lastTerrainSignature = "";
  const reducedMotion =
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  canvas.style.imageRendering = "pixelated";
  canvas.style.touchAction = "manipulation";
  canvas.style.display = "block";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "战术地图，点击格子选择单位与行动");

  function size() {
    if (!scene.state) return;
    const width = scene.state.width * TILE,
      height = scene.state.height * TILE;
    const newDpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    if (width !== logicalWidth || height !== logicalHeight || dpr !== newDpr) {
      logicalWidth = width;
      logicalHeight = height;
      dpr = newDpr;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.aspectRatio = `${width} / ${height}`;
      terrainCanvas.width = width;
      terrainCanvas.height = height;
      terrainDirty = true;
    }
    ctx.imageSmoothingEnabled = false;
  }
  function rebuildTerrain() {
    const state = scene.state;
    if (!state) return;
    terrainCtx.imageSmoothingEnabled = false;
    terrainCtx.fillStyle = "#789669";
    terrainCtx.fillRect(0, 0, logicalWidth, logicalHeight);
    const lookup = new Map(state.tiles.map((t) => [tileKey(t.x, t.y), t]));
    for (const tile of state.tiles) {
      const visual = captureVisuals.get(tileKey(tile.x, tile.y));
      const paintedTile = visual?.completed
        ? { ...tile, owner: visual.previousOwner } : tile;
      paintTile(terrainCtx, paintedTile, {
        up: lookup.get(tileKey(tile.x, tile.y - 1)),
        down: lookup.get(tileKey(tile.x, tile.y + 1)),
        left: lookup.get(tileKey(tile.x - 1, tile.y)),
        right: lookup.get(tileKey(tile.x + 1, tile.y)),
      });
    }
    terrainDirty = false;
  }

  /**
   * ★ F3 新增：给"黑边"解药。
   *
   * 为什么需要它：地图是 4:3、屏幕是 16:9，用 contain 保住全部可点格，
   * 代价是左右/上下留出空白。**用 cover 硬裁会砍掉 33% 的地图**（实测），
   * 那是功能损坏，不能做。
   *
   * 所以换思路：把已经画好的地形整体**放大 + 模糊 + 压暗**，铺满整个容器，
   * 垫在战场后面。于是地图边界之外不是黑边，而是"战场的延续"。
   * 这是"伪无限战场"——零裁切、零信息损失，但黑边感消失。
   */
  function paintMapFill() {
    if (!mapFillCanvas || !fillCtx) return;
    if (!logicalWidth || !logicalHeight) return;
    const rect = canvas.getBoundingClientRect();
    const boxW = Math.max(1, Math.round(rect.width));
    const boxH = Math.max(1, Math.round(rect.height));
    const fillDpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    if (
      mapFillCanvas.width !== Math.round(boxW * fillDpr) ||
      mapFillCanvas.height !== Math.round(boxH * fillDpr)
    ) {
      mapFillCanvas.width = Math.round(boxW * fillDpr);
      mapFillCanvas.height = Math.round(boxH * fillDpr);
    }
    fillCtx.setTransform(fillDpr, 0, 0, fillDpr, 0, 0);
    fillCtx.clearRect(0, 0, boxW, boxH);

    // 放大到「铺满容器」的比例（cover 式），保证没有一处露底
    const scale = Math.max(boxW / logicalWidth, boxH / logicalHeight);
    const dw = logicalWidth * scale;
    const dh = logicalHeight * scale;
    const dx = (boxW - dw) / 2;
    const dy = (boxH - dh) / 2;

    fillCtx.save();
    // ★ 亮度是关键参数（2026-09-30 实测定的，别凭感觉改）：
    //   原 brightness(0.42) 出来的延伸层亮度只有 41~47，而地图内是 143，
    //   中间是**一道 3.5 倍的亮度断崖** → 看上去就是"黑边/信箱框"。
    //   提到 0.9 后延伸层 ≈ 125，与地图同量级，边界自然溶解，
    //   读起来才像"战场在屏幕外继续"，而不是"视频黑边"。
    //   模糊半径同时加大到 18，避免和地图内容产生重影。
    fillCtx.filter = "blur(18px) brightness(0.9) saturate(0.72)";
    // 放大一点再画，避免 blur 在边缘透出底色
    fillCtx.drawImage(terrainCanvas, dx - 24, dy - 24, dw + 48, dh + 48);
    fillCtx.restore();
  }

  /**
   * 地图本体的边界：外 2px 硬黑 + 内 1px 亮青。
   *
   * 为什么需要它：消除黑边感之后，延伸层和地图的亮度接近了，
   * 玩家反而分不清"可行动区域到哪为止"。所以边界必须**显式画出来**。
   * 这不是装饰，是功能边界——和 AW 里"菜单框必须有一圈亮边"同一个理由。
   */
  function paintMapBorder() {
    if (!logicalWidth || !logicalHeight) return;
    const W = logicalWidth,
      H = logicalHeight;
    const OUT = "#000000";
    const EDGE = "rgba(0,255,197,.5)";
    // 外侧硬黑框（往外扩 2px，压住延伸层的过渡）
    box(ctx, -2, -2, W + 4, 2, OUT);
    box(ctx, -2, H, W + 4, 2, OUT);
    box(ctx, -2, -2, 2, H + 4, OUT);
    box(ctx, W, -2, 2, H + 4, OUT);
    // 内侧亮边（1px，画在地图像素的最外圈上）
    box(ctx, 0, 0, W, 1, EDGE);
    box(ctx, 0, H - 1, W, 1, EDGE);
    box(ctx, 0, 0, 1, H, EDGE);
    box(ctx, W - 1, 0, 1, H, EDGE);
  }

  function setScene(next) {
    if (destroyed) return;
    const state = next.state || scene.state;
    if (state && state !== previousState) {
      const now = performance.now();
      if (
        !reducedMotion &&
        previousState &&
        previousState.mapId === state.mapId &&
        previousState.width === state.width
      ) {
        const exchange = combatFromStates(previousState, state);
        const oldUnits = new Map(previousState.units.map((u) => [u.id, u]));
        for (const u of state.units) {
          const old = oldUnits.get(u.id);
          if (old && (old.x !== u.x || old.y !== u.y)) {
            const route = reachable(previousState, old.id).find(
              (cell) => cell.x === u.x && cell.y === u.y,
            );
            if (route?.path.length > 1)
              movement.set(u.id, {
                path: route.path,
                start: now,
                startFacing: "right",
                duration: movementDuration(route.path),
              });
          }
          if (old && old.type === "apc" && !old.acted && u.acted) {
            const move = movement.get(u.id);
            const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
            actionEvents.push({ id: u.id, action: "supply", start: now + delay, duration: 1050 });
          }
          if (old && old.type === "repair_boat" && !old.acted && u.acted) {
            const move = movement.get(u.id);
            const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
            actionEvents.push({ id: u.id, action: "supply", start: now + delay, duration: 1050 });
          }
          if (old && old.type === "submarine" && old.submerged !== u.submerged) {
            const move = movement.get(u.id);
            const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
            actionEvents.push({ id: u.id, action: u.submerged ? "submerge" : "surface",
              start: now + delay, duration: 1050 });
          }
        }
        for (const { unit, tile, previousTile } of capturesFromStates(previousState, state)) {
          const move = movement.get(unit.id);
          const delay = move ? Math.max(0, move.start + move.duration - now) : 0;
          const completed = tile.owner === unit.owner && previousTile.owner !== unit.owner;
          const capture = {
            owner: unit.owner,
            previousOwner: previousTile.owner,
            progressBefore: previousTile.captureBy === unit.owner ? 20 - previousTile.capture : 0,
            progressAfter: completed ? 20 : 20 - tile.capture,
            completed,
            start: now + delay,
            duration: captureDuration(completed),
          };
          captureVisuals.set(tileKey(tile.x, tile.y), capture);
          if (completed) terrainDirty = true;
          onCapture({
            unit,
            tile,
            previousOwner: capture.previousOwner,
            progressBefore: capture.progressBefore,
            progressAfter: capture.progressAfter,
            completed,
            delay,
            duration: capture.duration,
          });
        }
        const attackingMove = exchange ? movement.get(exchange.attacker.id) : null;
        const travelDelay = attackingMove
          ? Math.max(0, attackingMove.start + attackingMove.duration - now)
          : 0;
        const battleStart = now + travelDelay;
        if (exchange) {
          const attackerAt = state.units.find((unit) => unit.id === exchange.attacker.id) || exchange.attacker;
          const terrainAt = (unit) => state.tiles.find((tile) => tile.x === unit.x && tile.y === unit.y)?.type || "plain";
          combatVisual = {
            attacker: { ...exchange.attacker, x: attackerAt.x, y: attackerAt.y },
            defender: exchange.defender,
            defenderHitAt: battleStart + COMBAT_TIMING.firstHit,
            counterHitAt: exchange.counter > 0 ? battleStart + COMBAT_TIMING.counterHit
              : exchange.attacker.type === "drone" ? battleStart + COMBAT_TIMING.firstHit : Infinity,
            endAt: battleStart + combatDuration(exchange.counter),
          };
          onCombat({
            ...exchange,
            attackerTerrain: terrainAt(attackerAt),
            defenderTerrain: terrainAt(exchange.defender),
            delay: travelDelay,
          });
        }
        if (exchange) {
          const { attacker, defender, counter } = exchange;
          const attackerAt = state.units.find((unit) => unit.id === attacker.id) || attacker;
          actionEvents.push({
            id: attacker.id, action: "attack", start: battleStart + COMBAT_TIMING.firstFire - 180, duration: 450,
            direction: heading(attackerAt, defender),
          });
          actionEvents.push({ id: defender.id, action: "hit", start: combatVisual.defenderHitAt, duration: 500 });
          if (counter > 0) {
            actionEvents.push({
              id: defender.id, action: "attack", start: battleStart + COMBAT_TIMING.counterFire - 180, duration: 450,
              direction: heading(defender, attackerAt),
            });
            actionEvents.push({ id: attacker.id, action: "hit", start: combatVisual.counterHitAt, duration: 500 });
          }
        }
        for (const u of state.units) {
          const old = oldUnits.get(u.id);
          if (old && old.hp > u.hp) {
            const start = exchange?.defender.id === u.id
              ? combatVisual.defenderHitAt
                : exchange?.attacker.id === u.id && (exchange.counter > 0 || exchange.attacker.type === "drone")
                ? combatVisual.counterHitAt : now;
            explosions.push({ x: u.x, y: u.y, start, destroyed: false });
          }
        }
        for (const old of oldUnits.values()) {
          if (exchange && (old.id === exchange.attacker.id || old.id === exchange.defender.id) &&
            !state.units.some((u) => u.id === old.id)) {
            const position = old.id === exchange.attacker.id ? combatVisual.attacker : old;
            explosions.push({
              x: position.x, y: position.y, type: old.type, owner: old.owner, destroyed: true,
              start: exchange?.defender.id === old.id
                ? combatVisual.defenderHitAt
                : exchange?.attacker.id === old.id && (exchange.counter > 0 || exchange.attacker.type === "drone")
                  ? combatVisual.counterHitAt : now,
            });
          }
        }
        for (const id of movement.keys())
          if (!state.units.some((u) => u.id === id) && combatVisual?.attacker.id !== id) movement.delete(id);
      } else {
        movement.clear();
        explosions = [];
        actionEvents = [];
        captureVisuals.clear();
        combatVisual = null;
      }
      unitById = new Map(state.units.map((u) => [u.id, u]));
      previousState = state;
    }
    scene = { ...scene, ...next, state };
    if (state) {
      const signature =
        `${state.width}:${state.height}:` +
        state.tiles.map((t) => `${t.type}:${t.owner ?? "-"}`).join("|");
      if (signature !== lastTerrainSignature) {
        terrainDirty = true;
        lastTerrainSignature = signature;
      }
      size();
      canvas.setAttribute(
        "aria-label",
        `战术地图 ${state.width} 列 ${state.height} 行，第 ${state.day || 1} 天。点击格子选择单位与行动。`,
      );
    }
    draw(performance.now());
  }
  function paintDynamics(time) {
    const state = scene.state;
    for (const tile of state.tiles) {
      const x = tile.x * TILE,
        y = tile.y * TILE;
      if (["water", "sea", "shoal", "bridge", "port"].includes(tile.type)) {
        if (["water", "sea", "shoal"].includes(tile.type)) {
          const wave = Math.floor(time / 700 + (hash(tile.x, tile.y) % 5)) % 4;
          const shift = wave > 1 ? 2 : 0;
          box(ctx, x + 12 + shift, y + 12, 8, 1, "#7ab0b4");
          box(ctx, x + 18 + shift, y + 13, 4, 1, "#689fa9");
          box(ctx, x + 23 - shift, y + 28, 7, 1, "#79afb4");
          box(ctx, x + 9, y + 31, 3, 1, "#4e8796");
        }
      }
      if (["city", "factory", "hq", "port", "airport"].includes(tile.type)) {
        if (paintPropertyFlag?.(ctx, tile, time) !== true) {
          const pose = propertyFlagPose(tile, captureVisuals.get(tileKey(tile.x, tile.y)), time);
          if (pose.owner != null) {
            const p = palette(pose.owner);
            const fy = Math.round(y + pose.offset);
            box(ctx, x + 4, y - 17, 2, 35, "#304b43");
            box(ctx, x + 3, y - 18, 4, 2, "#eee1ba");
            box(ctx, x + 6, fy, 11, 7, p[2]);
            box(ctx, x + 6, fy, 10, 3, p[0]);
            box(ctx, x + 14, fy + 3, 4, 3, p[1]);
            box(ctx, x + 6, fy + 6, 8, 1, p[3]);
          }
        }
        if (tile.capture < 20 && tile.captureBy != null) {
          box(ctx, x + 5, y + 36, 30, 3, "#324d44");
          box(
            ctx,
            x + 5,
            y + 36,
            Math.round((30 * (20 - tile.capture)) / 20),
            3,
            TEAM_COLORS[tile.captureBy % 4],
          );
        }
      }
    }
  }
  /**
   * 拉拽箭头配色。
   *
   * ★ 2026-09-30 重做（参考 `attack-animation.gif` 第 60 帧，见 `参考资产-结构分析.md` §2.2）。
   *
   * 旧配色是「深色描边 + 亮色芯线」两层带描边，读起来像 UI 控件。
   * 采样高级战争的箭头后发现做法完全不同：
   *
   *   主线   rgb(144,216,255)   ← 极浅的青蓝
   *   高光   rgb(180,216,255)   ← 主线**上侧**一条更细的亮边
   *   极亮   rgb(180,252,255)   ← 转折/端点
   *
   * 特征：**没有描边**、**只走直角**、线细、靠"上侧高光"制造发光感。
   * 描边会带来控件感；无描边 + 上侧高光才像"地面上的光"。
   */
  const ARROW_TONES = {
    own: {
      core: "rgba(255,145,100,.92)",  // 主线：暖橙
      gloss: "rgba(255,214,182,.85)", // 上侧高光
      hot: "rgba(255,240,222,.95)",   // 起点
      head: "rgba(255,206,168,.98)",  // 末端方块箭头
    },
    enemy: {
      core: "rgba(176,190,196,.9)",
      gloss: "rgba(230,238,242,.85)",
      hot: "rgba(246,250,252,.95)",
      head: "rgba(222,232,236,.95)",
    },
  };
  function arrowTone() {
    return ARROW_TONES[scene.arrowTone] || ARROW_TONES.own;
  }
  /**
   * 画「移动箭头」——《高级战争》那套贴地路线箭头。
   * 优先用上层钉住/正在拖拽的 arrowPath；没有时退回旧的 preview 单点逻辑。
   */
  function paintPath() {
    const pinned = scene.arrowPath;
    let cells = null;
    if (pinned && pinned.length >= 2) {
      cells = pinned;
    } else {
      const preview = scene.preview;
      if (!preview || !scene.selectedId) return;
      const unit = unitById.get(scene.selectedId);
      if (!unit) return;
      const destination = scene.reachable?.find(
        (t) => t.x === preview.x && t.y === preview.y,
      );
      const raw = destination?.path || [];
      cells = raw.length
        ? [{ x: unit.x, y: unit.y }, ...raw]
        : [{ x: unit.x, y: unit.y }, preview];
      if (cells.length < 2) return;
    }
    paintArrowCells(cells, arrowTone());
  }
  /**
   * 按格绘制箭头：主线 + 上侧高光，无描边，只走直角。
   *
   * ★ 逐格绘制（参考 `MovementArrow/movement-arrow-0101.png` 的位掩码命名，见 §3）：
   * 高级战争用 14 张图覆盖「箭头在这个格怎么拐弯」的全部情形（4 位 = 上右下左是否连接）。
   * 我们不需要 14 张图，但**思路要抄**：按格中心相连，天然就是直角折线，
   * 严丝合缝贴着格子走，而不是一条斜线盖上去。
   */
  function paintArrowCells(cells, tone) {
    const half = TILE / 2;
    const pts = cells.map((t) => [t.x * TILE + half, t.y * TILE + half]);
    const coreW = Math.max(3, Math.round(TILE * 0.10));
    const glossW = Math.max(1, Math.round(TILE * 0.045));
    line(ctx, pts, tone.core, coreW);
    // 上侧高光：整体上移一点，画一条更细的亮线 → 像光从上方打下来
    const glossPts = pts.map(([x, y]) => [x, y - (coreW - glossW) / 2]);
    line(ctx, glossPts, tone.gloss, glossW);
    // 起点方块：标记"从这里出发"
    const [startX, startY] = pts[0];
    box(ctx, startX - 3, startY - 3, 6, 6, tone.hot);
    // 末端箭头
    const [endX, endY] = pts[pts.length - 1];
    const [prevX, prevY] = pts[pts.length - 2] || [endX - TILE, endY];
    arrowHeadBlock(ctx, prevX, prevY, endX, endY, tone);
  }
  /**
   * 末端箭头：高级战争用的是**短粗方块箭头**，不是细长三角。
   * 强制轴对齐（横或竖），避免斜向箭头带来的"UI 控件感"。
   */
  function arrowHeadBlock(ctx, fromX, fromY, toX, toY, tone) {
    const horizontal = Math.abs(toX - fromX) >= Math.abs(toY - fromY);
    const size = Math.round(TILE * 0.30);
    if (horizontal) {
      const forward = toX >= fromX;
      box(ctx, toX - (forward ? 0 : size), toY - size / 2, size, size, tone.head);
    } else {
      const forward = toY >= fromY;
      box(ctx, toX - size / 2, toY - (forward ? 0 : size), size, size, tone.head);
    }
  }
  function draw(time = performance.now()) {
    if (destroyed || !scene.state || !logicalWidth) return;
    if (reducedMotion) time = 0;
    const state = scene.state;
    for (const [key, visual] of captureVisuals)
      if (time >= visual.start + visual.duration) {
        captureVisuals.delete(key);
        if (visual.completed) terrainDirty = true;
      }
    // ⚠️ 顺序要紧：rebuildTerrain() 内部会把 terrainDirty 置回 false，
    //    所以必须先取一份脏标记，再重建、再据此刷新背景层。
    const terrainWasDirty = terrainDirty;
    if (terrainWasDirty) rebuildTerrain();
    // ★ F3：地形变了就同步刷新背景延伸层（消除黑边）。
    // 走 blur 有成本，只在真正需要时做，不能每帧。
    if (terrainWasDirty || mapFillDirty) {
      paintMapFill();
      mapFillDirty = false;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(terrainCanvas, 0, 0);
    // ★ 地图边界（2026-09-30）。
    //   背景延伸层让"世界"看起来在屏幕外继续，但玩家必须一眼看出
    //   **哪一块是可行动区域**。所以给地图本体加一圈硬边：
    //   外 2px 纯黑 + 内 1px 亮青。这不是装饰——是功能边界。
    //   用硬边而不是柔和描边，正是 AW 的语言（深底 + 亮边 + 硬黑外框）。
    paintMapBorder();
    paintDynamics(time);
    for (let i = 0; i < (scene.reachable?.length || 0); i++) {
      const t = scene.reachable[i];
      rangeTile(ctx, t.x, t.y, false, i);
    }
    for (let i = 0; i < (scene.hoverPreview?.length || 0); i++) {
      const t = scene.hoverPreview[i];
      rangeTile(ctx, t.x, t.y, false, i);
    }
    for (const target of scene.targets || []) {
      const u = typeof target === "string" ? unitById.get(target) : target;
      if (u) rangeTile(ctx, u.x, u.y, true, 0);
    }
    paintPath();
    // 伤害预测浮标（参考资产 §2.4）——画在所有格层之上、单位之下，
    // 这样它"浮"在战场上但不遮住单位本身。
    if (scene.combatHint) {
      const hint = scene.combatHint;
      damageBubble(
        ctx,
        hint.x,
        hint.y,
        "DAMAGE",
        `−${hint.damage}`,
        { body: "#5df08c", text: "#0d2416" },
        logicalWidth,
      );
    }
    actionEvents = actionEvents.filter((event) => time < event.start + event.duration);
    if (combatVisual && time >= combatVisual.endAt) combatVisual = null;
    const displayUnits = combatDisplayUnits(state, combatVisual, time);
    const loadedIds = new Set(
      state.units
        .filter((u) => u.cargo)
        .map((u) => (typeof u.cargo === "string" ? u.cargo : u.cargo.id)),
    );
    const units = displayUnits
      .filter((u) => !loadedIds.has(u.id) && !u.carriedBy && !u.transportId)
      .slice()
      .sort((a, b) => a.y - b.y || a.x - b.x);
    for (const u of units) {
      let ux = u.x * TILE,
        uy = u.y * TILE;
      let motion = {
        action: "idle",
        phase: (time / (u.type === "mech" ? 2100 : 1500) + (hash(u.x, u.y) % 7) / 7) % 1,
        direction: "right",
      };
      const move = movement.get(u.id);
      let moving = false;
      if (move) {
        const elapsed = Math.max(0, time - move.start);
        const position = movementPosition(move.path, elapsed, move.startFacing);
        ux = position.x * TILE;
        uy = position.y * TILE;
        if (position.done) movement.delete(u.id);
        else {
          const gaitMs = u.type === "mech" ? 600
            : u.type === "infantry" ? 480 : 400;
          motion = {
            action: position.turning ? "turn" : "move",
            phase: (elapsed % gaitMs) / gaitMs,
            direction: position.direction,
          };
          moving = true;
        }
      }
      const event = [...actionEvents].reverse().find((item) =>
        item.id === u.id && time >= item.start && time < item.start + item.duration,
      );
      if (event && !moving)
        motion = {
          action: event.action,
          phase: (time - event.start) / event.duration,
          direction: event.direction || "right",
        };
      paintUnit(ctx, u, ux, uy, previewUnitMotion?.(u, time) || motion);
    }
    explosions = explosions.filter((e) => time - e.start < (e.destroyed ? 1450 : 430));
    for (const e of explosions) {
      if (time < e.start) continue;
      if (e.destroyed) {
        const age = time - e.start;
        if (deathEffectKind(e.type) === "fall")
          paintFallingSoldier(ctx, e.type, palette(e.owner), age, e.x * TILE, e.y * TILE);
        else
          paintVehicleBlast(ctx, age, e.x * TILE + 20, e.y * TILE + 20, .55);
        continue;
      }
      const t = (time - e.start) / 430;
      const cx = e.x * TILE + 20,
        cy = e.y * TILE + 20;
      ctx.globalAlpha = 1 - t;
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        box(
          ctx,
          cx + Math.cos(angle) * t * 20 - 2,
          cy + Math.sin(angle) * t * 20 - 2,
          4,
          4,
          i % 2 ? "#ffdc90" : "#fff4ce",
        );
      }
      if (t < 0.4) {
        box(ctx, cx - 4, cy - 12, 8, 24, "#ffdf9c");
        box(ctx, cx - 12, cy - 4, 24, 8, "#fff0ba");
      }
      ctx.globalAlpha = 1;
    }
    const selected = scene.selectedId ? unitById.get(scene.selectedId) : null;
    if (selected) {
      // ★ 2026-09-30 改：方框高亮 → **环形光标**（参考资产 §2.3）。
      //   高级战争最标志性的元素不是方框，是单位外圈那个**马蹄形光环**：
      //   白色到浅灰的像素环、左右两侧开口、5 帧循环动画，而且**按状态换色**：
      //     普通移动 mapcursor / 可攻击 mapcursor-arrow / 可补给 mapcursor-wrench
      //     / 不可行动 mapcursor-wrong
      //   我们的等价状态：可指挥=暖黄、已行动=灰、被选中的敌方=红。
      const pose = cursorPose(selected);
      // 呼吸：每 360ms 在内环的**亮色/常规色**之间切换（对齐参考里的逐帧感）。
      // 注意别对 hex 字符串做 `+ 1` —— 那会拼出 "#fff2c01" 这种非法颜色。
      const beat = Math.floor(time / 360) % 2;
      ringCursor(
        ctx,
        selected.x * TILE,
        selected.y * TILE,
        pose.outer,
        beat ? pose.hot : pose.inner,
      );
    }
    if (scene.preview)
      corners(
        ctx,
        scene.preview.x * TILE,
        scene.preview.y * TILE,
        "#edffe0",
        2,
        9,
        2,
      );
    if (
      scene.hoverTile &&
      (!selected ||
        scene.hoverTile.x !== selected.x ||
        scene.hoverTile.y !== selected.y)
    ) {
      const t = scene.hoverTile;
      corners(ctx, t.x * TILE, t.y * TILE, "rgba(255,246,210,.8)", 1, 7, 1);
    }
    // A slim map-edge bevel anchors the board without obstructing tiles.
    box(ctx, 0, 0, logicalWidth, 1, "rgba(229,236,190,.3)");
    box(ctx, 0, logicalHeight - 1, logicalWidth, 1, "rgba(23,47,44,.25)");
  }
  function tick(time) {
    if (destroyed) return;
    // 帧率上限：原为 `> 32`（约 30fps），是「极速拖动时画面跟不上手」的原因之一。
    // 实测单帧 draw() 仅 0.115ms（地形走离屏缓存），完全没有压到 30fps 的必要。
    // 放到 `> 8`（约 120fps）——不是要跑满 120，而是让每个 rAF 都能刷新，
    // 由浏览器自己的 vsync 决定实际帧率（通常 60fps）。这消除的是「人为降帧」，
    // 真正的渲染成本仍由单帧 0.115ms 决定，不会因此吃满 CPU。
    if (
      !reducedMotion &&
      time - lastFrameTime > 8 &&
      !document.hidden &&
      (!canvas.getClientRects || canvas.getClientRects().length)
    ) {
      draw(time);
      lastFrameTime = time;
    }
    frame = requestAnimationFrame(tick);
  }
  function eventTile(event) {
    const state = scene.state;
    if (!state) return null;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    // CSS may constrain the element's height independently from its width.
    // Hit testing follows the actual object-fit content, excluding letterboxes.
    const style =
      typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
    const px = (name) => parseFloat(style?.[name]) || 0;
    const leftInset = px("borderLeftWidth") + px("paddingLeft");
    const topInset = px("borderTopWidth") + px("paddingTop");
    const boxWidth =
      rect.width - leftInset - px("borderRightWidth") - px("paddingRight");
    const boxHeight =
      rect.height - topInset - px("borderBottomWidth") - px("paddingBottom");
    let contentWidth = boxWidth,
      contentHeight = boxHeight;
    let contentLeft = rect.left + leftInset,
      contentTop = rect.top + topInset;
    if (
      style?.objectFit === "contain" ||
      style?.objectFit === "cover" ||
      style?.objectFit === "scale-down"
    ) {
      const ratios = [boxWidth / logicalWidth, boxHeight / logicalHeight];
      const ratio =
        style.objectFit === "cover" ? Math.max(...ratios) : Math.min(...ratios);
      contentWidth = logicalWidth * ratio;
      contentHeight = logicalHeight * ratio;
      const position = (style.objectPosition || "50% 50%").split(/\s+/);
      const offset = (value, space) => {
        if (value === "left" || value === "top") return 0;
        if (value === "right" || value === "bottom") return space;
        if (!value || value === "center") return space / 2;
        return value.endsWith("%")
          ? ((parseFloat(value) || 0) * space) / 100
          : parseFloat(value) || 0;
      };
      contentLeft += offset(position[0], boxWidth - contentWidth);
      contentTop += offset(position[1], boxHeight - contentHeight);
    }
    const x = Math.floor(
      ((event.clientX - contentLeft) / contentWidth) * state.width,
    );
    const y = Math.floor(
      ((event.clientY - contentTop) / contentHeight) * state.height,
    );
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) return null;
    return { x, y };
  }
  function click(event) {
    if (suppressClick) return;
    const tile = eventTile(event);
    if (tile) onTile(tile.x, tile.y);
  }
  function hover(event) {
    if (event.pointerType === "touch") return;
    const tile = eventTile(event);
    const key = tile ? tileKey(tile.x, tile.y) : null;
    if (key === lastPointerKey) return;
    lastPointerKey = key;
    if (tile) onHover(tile.x, tile.y);
    else {
      scene.hoverTile = null;
      draw();
    }
  }
  function leave() {
    lastPointerKey = null;
    scene.hoverTile = null;
    draw();
  }
  // 长按/拖拽：按住不动 HOLD_MS 进入箭头模式，此后拖动即拉出箭头。
  function pressStart(event) {
    if (event.button != null && event.button !== 0) return;
    const tile = eventTile(event);
    if (!tile) return;
    pressOrigin = { x: event.clientX, y: event.clientY };
    pressTile = tile;
    dragPath = null;
    dragging = false;
    lastDragKey = null;
    cancelPressTimer();
    pressTimer = setTimeout(() => {
      pressTimer = null;
      longPressed = true;
      dragging = true;
      canvas.classList.add("dragging");
      onHold(tile.x, tile.y);
    }, HOLD_MS);
  }
  function pressMove(event) {
    if (pressTimer) {
      // 还没进入箭头模式：移动超过容差即视为滑动，取消长按
      if (
        Math.abs(event.clientX - pressOrigin.x) > HOLD_SLOP ||
        Math.abs(event.clientY - pressOrigin.y) > HOLD_SLOP
      )
        cancelPressTimer();
      return;
    }
    if (!dragging) return;
    // 已进入箭头模式：拖动不再取消，转为把光标位置喂给上层算箭头。
    //
    // ★ 去重口径（2026-09-30 修正，这里原先是「极速拖动没反应」的元凶）：
    // 旧代码用 `dragPath` 的**终点**去重。但上层 setArrowPath 存进 dragPath 的是
    // 「回退后的合法落点」——快速划过一片不可达区域时，连续多次 pointermove 算出的
    // 合法落点完全相同 → 第 2 次起全被 return 掉。实测 100 次 move 只过了 4 次。
    //
    // 正确口径：按**光标所在格**去重。光标格真的变了就必须上报，
    // 否则上层没法更新「玩家现在指哪儿」。用独立的 lastDragKey 记录，
    // 不再和 dragPath（那是渲染结果）混用。
    const tile = eventTile(event);
    if (!tile) return;
    const key = tileKey(tile.x, tile.y);
    if (key === lastDragKey) return;
    lastDragKey = key;
    onDrag(tile.x, tile.y);
  }
  function pressEnd() {
    const wasDragging = dragging;
    // ★ 抑制 click 的真实判据：这次按下**是否真的拖拽过**（光标是否移动过）。
    //
    // 原先用 `longPressed`（=是否进入过长按模式）当判据，在 HOLD_MS 降到 60ms 后出问题：
    // 一次普通的「慢慢点击」（按住 80~150ms）也会被判成长按 → suppressClick=true
    // → 紧随其后的 click 被吃掉 → 表现成「点一下没反应，兵不走 / 取消不了选择」。
    //
    // 正确口径：只有「长按 + 光标确实移动过」才算拖拽，才需要抑制 click。
    // 单纯按住不动再松手（没拖）= 仍然是一次点击，必须放行。
    const reallyDragged = wasDragging && lastDragKey !== null;
    cancelPressTimer();
    dragging = false;
    longPressed = false;
    dragPath = null;
    lastDragKey = null;
    canvas.classList.remove("dragging");
    // 长按且真的拖动过时，抑制紧随其后的 click（避免被当成"点了一下"）
    if (reallyDragged) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    if (wasDragging) onDragEnd();
  }
  canvas.addEventListener("click", click);
  canvas.addEventListener("pointermove", hover);
  canvas.addEventListener("pointermove", pressMove);
  canvas.addEventListener("pointerleave", leave);
  canvas.addEventListener("pointerdown", pressStart);
  canvas.addEventListener("pointerup", pressEnd);
  canvas.addEventListener("pointercancel", pressEnd);
  const observer =
    typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => {
          size();
          // ★ F3：容器尺寸变了 → 背景延伸层必须跟着重铺。
          mapFillDirty = true;
          draw();
        })
      : null;
  observer?.observe(canvas);
  const onWindowResize = () => {
    size();
    // ★ F3：背景延伸层是按容器尺寸铺满的，容器变了必须重画。
    mapFillDirty = true;
    draw();
  };
  window.addEventListener("resize", onWindowResize);
  frame = requestAnimationFrame(tick);
  return {
    setScene,
    /**
     * 格坐标 → 视口坐标（★ 2026-09-30 新增）。
     *
     * 用途：UI 层要把「命令菜单」贴在单位旁边（高级战争就是这么做的——
     * 菜单紧贴单位弹出，不是固定在屏幕角落）。所以 UI 需要一个
     * 「这一格现在画在屏幕哪儿」的换算。
     *
     * 算式与 eventTile() **完全同源**：同样按 object-fit（contain/cover）
     * 与 object-position 求内容框，再取格子中心。这样 cover 裁切、
     * 窗口缩放、DPR 变化都不会让菜单和格子错位。
     * 两份算式必须一起改，别只改一边。
     */
    tileToScreen(tileX, tileY) {
      const state = scene.state;
      if (!state) return null;
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return null;
      const style =
        typeof getComputedStyle === "function" ? getComputedStyle(canvas) : null;
      const px = (name) => parseFloat(style?.[name]) || 0;
      const leftInset = px("borderLeftWidth") + px("paddingLeft");
      const topInset = px("borderTopWidth") + px("paddingTop");
      const boxWidth =
        rect.width - leftInset - px("borderRightWidth") - px("paddingRight");
      const boxHeight =
        rect.height - topInset - px("borderBottomWidth") - px("paddingBottom");
      let contentWidth = boxWidth,
        contentHeight = boxHeight;
      let contentLeft = rect.left + leftInset,
        contentTop = rect.top + topInset;
      if (
        style?.objectFit === "contain" ||
        style?.objectFit === "cover" ||
        style?.objectFit === "scale-down"
      ) {
        const ratios = [boxWidth / logicalWidth, boxHeight / logicalHeight];
        const ratio =
          style.objectFit === "cover" ? Math.max(...ratios) : Math.min(...ratios);
        contentWidth = logicalWidth * ratio;
        contentHeight = logicalHeight * ratio;
        const position = (style.objectPosition || "50% 50%").split(/\s+/);
        const offset = (value, space) => {
          if (value === "left" || value === "top") return 0;
          if (value === "right" || value === "bottom") return space;
          if (!value || value === "center") return space / 2;
          return value.endsWith("%")
            ? ((parseFloat(value) || 0) * space) / 100
            : parseFloat(value) || 0;
        };
        contentLeft += offset(position[0], boxWidth - contentWidth);
        contentTop += offset(position[1], boxHeight - contentHeight);
      }
      const cell = contentWidth / state.width;
      return {
        x: contentLeft + (tileX + 0.5) * cell,
        y: contentTop + (tileY + 0.5) * cell,
        cell,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      };
    },
    setHoverPreview(cells) {
      if (destroyed) return;
      const next = cells && cells.length ? cells : null;
      const prev = scene.hoverPreview;
      if (!next && !prev) return;
      if (
        next &&
        prev &&
        next.length === prev.length &&
        next[0]?.x === prev[0]?.x &&
        next[0]?.y === prev[0]?.y &&
        next[next.length - 1]?.x === prev[prev.length - 1]?.x &&
        next[next.length - 1]?.y === prev[prev.length - 1]?.y
      )
        return;
      scene.hoverPreview = next;
      draw(performance.now());
    },
    setArrowPath(path, tone = "own") {
      if (destroyed) return;
      const next = path && path.length >= 2 ? path : null;
      scene.arrowPath = next;
      scene.arrowTone = tone;
      // 记录给拖拽去重使用
      dragPath = next;
      draw(performance.now());
    },
    render: () => draw(performance.now()),
    resize: () => {
      size();
      mapFillDirty = true;
      draw(performance.now());
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frame);
      cancelPressTimer();
      dragging = false;
      dragPath = null;
      lastDragKey = null;
      canvas.classList.remove("dragging");
      observer?.disconnect();
      canvas.removeEventListener("click", click);
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointermove", pressMove);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", pressStart);
      canvas.removeEventListener("pointerup", pressEnd);
      canvas.removeEventListener("pointercancel", pressEnd);
      window.removeEventListener("resize", onWindowResize);
      movement.clear();
      explosions = [];
      actionEvents = [];
      captureVisuals.clear();
    },
  };
}
