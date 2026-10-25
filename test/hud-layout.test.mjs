import test from "node:test";
import assert from "node:assert/strict";
import {
  commandMenuPosition,
  TOPBAR_H,
  COMMAND_BAR_H,
  EDGE_GAP,
  MIN_GAP,
  MAX_GAP,
} from "../public/shared/hud-layout.mjs";

// 一组典型参数：1440×900 下，两行中文按钮的命令菜单量出来约 176×104。
const VW = 1440,
  VH = 900,
  MENU_W = 176,
  MENU_H = 104,
  CELL = 40;
const box = (p, w = MENU_W, h = MENU_H) => ({
  left: p.cx - w / 2,
  right: p.cx + w / 2,
  top: p.cy - h / 2,
  bottom: p.cy + h / 2,
});
const place = (anchorX, anchorY, over = {}) =>
  commandMenuPosition({
    anchorX,
    anchorY,
    menuW: MENU_W,
    menuH: MENU_H,
    vw: VW,
    vh: VH,
    cell: CELL,
    ...over,
  });
const tile = (ax, ay, cell = CELL) => ({
  left: ax - cell / 2,
  right: ax + cell / 2,
  top: ay - cell / 2,
  bottom: ay + cell / 2,
});
const overlaps = (a, b) =>
  a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;

// ── 核心语义：跟随终点格，贴它的右上角 ────────────────────────────────

test("菜单贴在终点格的右上角（整体在格的上方、格的右侧）", () => {
  for (const [ax, ay] of [
    [300, 400],
    [420, 500],
    [600, 300],
  ]) {
    const p = place(ax, ay);
    const b = box(p);
    assert.equal(p.side, "right", `(${ax},${ay}) 应向右展开`);
    assert.equal(p.above, true, `(${ax},${ay}) 应向上展开`);
    assert.ok(
      b.left >= ax + CELL / 2,
      `菜单未在格右侧：left=${b.left} 格右=${ax + CELL / 2}`,
    );
    assert.ok(
      b.bottom <= ay - CELL / 2,
      `菜单未在格上方：bottom=${b.bottom} 格上=${ay - CELL / 2}`,
    );
  }
});

// ★ 用户的原始诉求：菜单不许压住终点框——他得看清、点得到自己选的落点。
test("菜单矩形与终点格永不相交", () => {
  for (const ax of [40, 151, 300, 720, 1100, 1380]) {
    for (const ay of [120, 260, 450, 660, 820]) {
      const b = box(place(ax, ay));
      assert.equal(
        overlaps(b, tile(ax, ay)),
        false,
        `终点格(${ax},${ay}) 被盖住：菜单 [${b.left},${b.top},${b.right},${b.bottom}]`,
      );
    }
  }
});

test("菜单与终点格之间留有缝，且在 8–16 之间", () => {
  const mid = place(300, 400);
  const mb = box(mid);
  const gap = Math.min(mb.left - (300 + CELL / 2), 400 - CELL / 2 - mb.bottom);
  assert.ok(gap >= MIN_GAP && gap <= MAX_GAP, `缝异常：${gap}`);
  // cover 放大后格宽 101px，缝应随格走并封顶在 16
  const big = box(place(352, 500, { cell: 101 }));
  assert.ok(big.left - (352 + 50.5) <= MAX_GAP + 0.001);
  assert.ok(big.left - (352 + 50.5) >= MIN_GAP);
});

// ── 翻边规则：都是视口逼的，不是偏好 ────────────────────────────────

test("终点格靠右、右侧装不下 → 翻到左上角，向左展开", () => {
  const p = place(1380, 400);
  const b = box(p);
  assert.equal(p.side, "left");
  assert.ok(b.right <= 1380 - CELL / 2, `翻面后仍压格：right=${b.right}`);
  assert.ok(b.left >= 0);
});

test("终点格靠顶、上方装不下 → 翻到右下角，向下展开", () => {
  const p = place(300, 56);
  const b = box(p);
  assert.equal(p.above, false);
  assert.ok(b.top >= 56 + CELL / 2, `翻面后仍压格：top=${b.top}`);
  assert.ok(b.top >= TOPBAR_H, `顶穿顶栏：${b.top}`);
});

test("翻面绝不发生「甩到屏幕另一头」——菜单始终与终点格相邻", () => {
  // 曾经的错解：压住单位就翻到对面，cx 从 100 跳到 1218，鼠标横穿整屏。
  for (const ax of [20, 40, 120, 1380, 1420]) {
    for (const ay of [60, 400, 860]) {
      const p = place(ax, ay);
      assert.ok(
        Math.abs(p.cx - ax) <= VW * 0.5 + MENU_W,
        `(${ax},${ay}) 菜单甩太远：cx=${p.cx}`,
      );
    }
  }
});

// ── 边界与退化 ──────────────────────────────────────────────────────

test("菜单始终完整落在顶栏与说明栏之间", () => {
  for (const ay of [0, 40, 56, 300, 700, 880, 1000]) {
    const b = box(place(300, ay));
    assert.ok(b.top >= TOPBAR_H, `顶部落到 ${b.top}`);
    assert.ok(b.bottom <= VH - COMMAND_BAR_H, `底部落到 ${b.bottom}`);
  }
});

test("菜单始终完整落在左右视口内", () => {
  for (const ax of [0, 20, 200, 720, 1200, 1420, 1440]) {
    const b = box(place(ax, 420));
    assert.ok(b.left >= 0, `左边越界 ${b.left}`);
    assert.ok(b.right <= VW, `右边越界 ${b.right}`);
  }
});

test("垂直方向跟随终点格高度（未触顶/触底时严格线性）", () => {
  for (const ay of [250, 400, 550, 700]) {
    assert.equal(box(place(300, ay)).bottom, ay - CELL / 2 - MIN_GAP);
  }
});

test("视口过矮 / 过窄时退化为夹紧，不产生 NaN", () => {
  for (const over of [{ vh: 120 }, { vw: 120 }, { vw: 200, vh: 160 }]) {
    const p = place(300, 400, over);
    const b = box(p);
    for (const v of [p.cx, p.cy, b.left, b.top, b.right, b.bottom])
      assert.ok(Number.isFinite(v), `${JSON.stringify(over)} 产生非有限值`);
  }
});

test("宽菜单（400px）下不压终点格，且落在视口内", () => {
  for (const ax of [300, 1000]) {
    const p = place(ax, 400, { menuW: 400 });
    const b = box(p, 400);
    assert.ok(b.left >= 0 && b.right <= VW, `越界 [${b.left}, ${b.right}]`);
    assert.equal(overlaps(b, tile(ax, 400)), false, `x=${ax} 被宽菜单盖住`);
  }
});

test("真实格宽（cover 放大到 101px）下仍然不压终点格", () => {
  // 实测：1440×900 视口用 cover 铺满 15×11 的地图时，一格约 101px。
  const cell = 101;
  for (const ax of [151, 352, 1200]) {
    for (const ay of [151, 352, 600]) {
      const p = place(ax, ay, { cell });
      const b = box(p);
      assert.equal(
        overlaps(b, tile(ax, ay, cell)),
        false,
        `cell=${cell} 终点格(${ax},${ay}) 被盖住：菜单 [${b.left},${b.top},${b.right},${b.bottom}]`,
      );
    }
  }
});

test("cell 缺省时按 40 处理，不炸", () => {
  const p = commandMenuPosition({
    anchorX: 400,
    anchorY: 400,
    menuW: MENU_W,
    menuH: MENU_H,
    vw: VW,
    vh: VH,
  });
  assert.equal(overlaps(box(p), tile(400, 400)), false);
  assert.equal(p.side, "right");
});

test("EDGE_GAP 只在夹紧时生效，不参与贴格定位", () => {
  const p = place(300, 400);
  assert.ok(box(p).left > EDGE_GAP, "贴格定位时不该被 EDGE_GAP 拉走");
});
