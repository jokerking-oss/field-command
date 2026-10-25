import test from "node:test";
import assert from "node:assert/strict";
import { createGame, UNITS } from "../public/shared/engine.mjs";
import {
  createHeroScenario,
  heroFrameAt,
  heroStateAt,
  HERO_PERIOD,
  HERO_FADE_OUT_MS,
  MOVE_STEP_MS,
} from "../public/hero-cinematic.mjs";

// 封面剧本是「看不见的算术」：事件表里任何一个坐标写错，屏幕上就是
// 「部队穿墙走」或「对峙半天不开火」，而封面又不好截图回归。
// 所以这里把它的几条硬约束全部钉死。
function build() {
  const state = createGame({
    mapId: "river",
    players: [
      { id: 0, name: "赤焰军", team: 0, commander: "vanguard", controller: "human" },
      { id: 1, name: "苍蓝军", team: 1, commander: "mechanic", controller: "ai" },
    ],
  });
  return { state, plan: createHeroScenario(state) };
}
const tileType = (plan, x, y) =>
  plan.tiles.find((t) => t.x === x && t.y === y)?.type;
const moves = (plan) => plan.events.filter((e) => e.move);
const fires = (plan) => plan.events.filter((e) => e.fire);
const unitAt = (plan, t, id) =>
  heroFrameAt(plan, t).units.find((u) => u.id === id) || null;

test("布阵：八支部队各就各位，且全部落在陆地上", () => {
  const { plan } = build();
  assert.equal(plan.baseUnits.length, 8);
  const seen = new Set();
  for (const unit of plan.baseUnits) {
    const key = `${unit.x},${unit.y}`;
    assert.equal(seen.has(key), false, `${unit.id} 与友军重叠在 ${key}`);
    seen.add(key);
    assert.notEqual(
      tileType(plan, unit.x, unit.y),
      "water",
      `${unit.id} 布阵在水里 (${unit.x},${unit.y})`,
    );
  }
});

test("每次移动都有引擎算出来的合法路径，且不穿水、不跳格", () => {
  const { plan } = build();
  const list = moves(plan);
  assert.ok(list.length >= 3, "剧本里的移动太少");
  for (const { at, move } of list) {
    assert.ok(move.path, `${move.id} 在 ${at}ms 的移动不可达（reachable 没找到目标格）`);
    assert.ok(move.path.length > 1, `${move.id} 的路径没有前进`);
    for (let i = 1; i < move.path.length; i++) {
      const a = move.path[i - 1];
      const b = move.path[i];
      assert.equal(
        Math.abs(a.x - b.x) + Math.abs(a.y - b.y),
        1,
        `${move.id} 在路径第 ${i} 步跳格：${a.x},${a.y} → ${b.x},${b.y}`,
      );
      assert.notEqual(
        tileType(plan, b.x, b.y),
        "water",
        `${move.id} 走进了水里 (${b.x},${b.y})`,
      );
    }
  }
});

test("路径首尾与事件表一致：从上一站出发，走到指定格", () => {
  const { plan } = build();
  const order = plan.events.filter((e) => e.move);
  // 每支部队按时间累积自己的位置，路径起点必须接得上。
  const cursor = new Map(plan.baseUnits.map((u) => [u.id, { x: u.x, y: u.y }]));
  for (const { move } of order) {
    const from = cursor.get(move.id);
    const head = move.path[0];
    assert.deepEqual(
      { x: head.x, y: head.y },
      { x: from.x, y: from.y },
      `${move.id} 的路径起点 ${head.x},${head.y} 与当前位置 ${from.x},${from.y} 不符`,
    );
    const tail = move.path[move.path.length - 1];
    cursor.set(move.id, { x: tail.x, y: tail.y });
  }
});

// ★ 这条最重要：渲染器从「敌我距离是否在射程内」推断这一帧到底打没打。
//   距离不对，交火就静悄悄地不发生——画面变成「两边站着不动」，
//   而这在封面上极难被发现。所以必须按引擎里的真实射程校验。
test("每次交火都发生在射程之内（否则渲染器根本不会演出这一枪）", () => {
  const { plan } = build();
  const list = fires(plan);
  assert.ok(list.length >= 4, "剧本里的交火太少");
  for (const { at, fire } of list) {
    // 要在**扣血之前**取位置：heroFrameAt(plan, at) 已经把这一枪结算了，
    // 目标当场阵亡就会从场上消失（这正是渲染器据以播放殉爆的信号）。
    const probe = at - 1;
    const attacker = unitAt(plan, probe, fire.by);
    const defender = unitAt(plan, probe, fire.on);
    assert.ok(attacker, `${fire.by} 在 ${at}ms 已经不在场上了`);
    assert.ok(defender, `${fire.on} 在 ${at}ms 已经不在场上了`);
    const range = UNITS[attacker.type];
    const distance =
      Math.abs(attacker.x - defender.x) + Math.abs(attacker.y - defender.y);
    assert.ok(
      distance >= range.minRange && distance <= range.maxRange,
      `${fire.by}(${attacker.type}) 打 ${fire.on}：距离 ${distance} 不在 ${range.minRange}–${range.maxRange} 内`,
    );
  }
});

test("一整轮打完双方都有伤亡，且不会有人复活", () => {
  const { plan } = build();
  const counts = [0, 1400, 4400, 6400, 10800, 12000].map((t) => {
    const ids = heroFrameAt(plan, t).units.map((u) => u.id);
    assert.equal(new Set(ids).size, ids.length, `${t}ms 出现重复单位`);
    return ids.length;
  });
  for (let i = 1; i < counts.length; i++)
    assert.ok(counts[i] <= counts[i - 1], `单位数回升：${counts[i - 1]} → ${counts[i]}`);
  assert.ok(counts[0] === 8, "开局不是满编");
  assert.ok(counts[counts.length - 1] <= 6, "打了一整轮却几乎没减员，剧本太温");
});

test("hp 只降不升，且降幅与事件表一致", () => {
  const { plan } = build();
  const track = new Map();
  for (let t = 0; t <= HERO_PERIOD; t += 100) {
    for (const unit of heroFrameAt(plan, t).units) {
      const before = track.get(unit.id);
      if (before !== undefined)
        assert.ok(unit.hp <= before, `${unit.id} 在 ${t}ms 血量回升 ${before} → ${unit.hp}`);
      track.set(unit.id, unit.hp);
    }
  }
});

// ★ 无缝循环的技术保证：重置发生在硝烟最浓处，且跨周期连续。
//   曾经的做法只在周期内涨满，t 一归零 smoke 立刻归 0——重置那帧确实被盖住了，
//   但紧跟着烟「啪」地消失，成了「浓烟 / 突然清晰」的硬切。这里把两条都钉死。
test("硝烟跨周期连续：上一轮末尾与新一轮开头都是满烟", () => {
  const { plan } = build();
  assert.equal(heroFrameAt(plan, HERO_PERIOD - 1).overlay.smoke, 1, "轮末烟没涨满，重置会露馅");
  assert.equal(heroFrameAt(plan, 0).overlay.smoke, 1, "轮首烟不足，接缝会闪");
  // 淡出段结束后必须干净
  assert.equal(heroFrameAt(plan, HERO_FADE_OUT_MS).overlay.smoke, 0);
  assert.equal(heroFrameAt(plan, plan.smokeIn).overlay.smoke, 0);
  assert.equal(heroFrameAt(plan, plan.smokeFull).overlay.smoke, 1);
});

test("硝烟只有两段单调：开头淡出、末尾涨满，中间恒为 0", () => {
  const { plan } = build();
  let last = 1.0001;
  for (let t = 0; t <= HERO_FADE_OUT_MS; t += 50) {
    const s = heroFrameAt(plan, t).overlay.smoke;
    assert.ok(s <= last + 1e-9, `淡出段在 ${t}ms 回升了`);
    last = s;
  }
  for (let t = HERO_FADE_OUT_MS; t <= plan.smokeIn; t += 200)
    assert.equal(heroFrameAt(plan, t).overlay.smoke, 0, `中段在 ${t}ms 起烟了`);
  last = -1;
  for (let t = plan.smokeIn; t <= HERO_PERIOD; t += 100) {
    const s = heroFrameAt(plan, t).overlay.smoke;
    assert.ok(s >= last, `涨烟段在 ${t}ms 回落了`);
    last = s;
  }
});

test("开火瞬间有闪光，且很快衰减掉", () => {
  const { plan } = build();
  const first = fires(plan)[0];
  assert.ok(heroFrameAt(plan, first.at).overlay.flash > 0.5, "开火没有闪光");
  assert.equal(heroFrameAt(plan, first.at + 400).overlay.flash, 0, "闪光不会衰减");
});

test("换场景：mapId 随轮次变化，这是让渲染器清掉补间的信号", () => {
  const { plan } = build();
  const a = heroStateAt(plan, 500, 0);
  const b = heroStateAt(plan, 500, 1);
  assert.equal(a.state.mapId, `${plan.mapId}#cinema0`);
  assert.notEqual(a.state.mapId, b.state.mapId, "轮次之间 mapId 没变，会看到部队瞬移");
  // 地形与玩家信息必须原样带过去，否则渲染器画不出地图。
  assert.equal(a.state.width, plan.width);
  assert.equal(a.state.tiles.length, plan.tiles.length);
  assert.equal(a.state.players.length, 2);
});

test("任何时刻都不产生 NaN，越界时间也不崩", () => {
  const { plan } = build();
  for (const t of [-500, 0, 7, 1234, 6000, HERO_PERIOD, HERO_PERIOD + 9999]) {
    const frame = heroFrameAt(plan, t);
    assert.ok(Array.isArray(frame.units));
    for (const unit of frame.units) {
      for (const key of ["x", "y", "hp"])
        assert.ok(Number.isFinite(unit[key]), `t=${t} ${unit.id}.${key} 非有限值`);
    }
    for (const key of ["smoke", "flash"])
      assert.ok(Number.isFinite(frame.overlay[key]), `t=${t} overlay.${key} 非有限值`);
  }
});

test("逐格推进：一格的位移只花一拍，且不会瞬移多格", () => {
  const { plan } = build();
  const move = moves(plan)[0];
  const seen = new Set();
  for (let t = move.at; t <= move.at + MOVE_STEP_MS * (move.move.path.length + 2); t += 40) {
    const unit = unitAt(plan, t, move.move.id);
    if (unit) seen.add(`${unit.x},${unit.y}`);
  }
  for (const key of seen) {
    const [x, y] = key.split(",").map(Number);
    assert.ok(
      move.move.path.some((c) => c.x === x && c.y === y),
      `${move.move.id} 走到了路径之外的格 ${key}`,
    );
  }
  assert.ok(seen.size >= 3, `移动过程中只经过了 ${seen.size} 格，路径没走完`);
});

test("剧本是确定性的：同一时刻算两次结果完全一致", () => {
  const { plan } = build();
  for (const t of [0, 3000, 4200, 6200, 10600, 12000]) {
    assert.deepEqual(heroFrameAt(plan, t), heroFrameAt(plan, t), `${t}ms 不确定`);
  }
});

test("不修改传入的引擎状态", () => {
  const state = createGame({
    mapId: "river",
    players: [
      { id: 0, name: "赤焰军", team: 0, commander: "vanguard", controller: "human" },
      { id: 1, name: "苍蓝军", team: 1, commander: "mechanic", controller: "ai" },
    ],
  });
  const snapshot = JSON.stringify(state.units.map((u) => [u.id, u.x, u.y, u.hp]));
  createHeroScenario(state);
  heroFrameAt(createHeroScenario(state), 8000);
  assert.equal(
    JSON.stringify(state.units.map((u) => [u.id, u.x, u.y, u.hp])),
    snapshot,
    "引擎状态被剧本改写了",
  );
});
