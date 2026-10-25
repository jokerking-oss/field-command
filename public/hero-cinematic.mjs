/**
 * 封面「循环战争」—— 一段无缝衔接的战场时间轴。
 *
 * ★ 为什么不是一段 mp4：
 *   封面要的是「一直在打、永远演不完」。视频文件做不到无缝（首尾帧不接会跳），
 *   而且要占几 MB、风格还未必对得上这套像素美术。而渲染器**本来就自带**
 *   移动补间、开火姿态、爆炸、载具殉爆（见 renderer.mjs 的 setScene 差分段）：
 *   它比的是「上一帧 state」和「这一帧 state」，自己推断出谁打了谁。
 *   所以我只要**按节拍推进 state**，画面就自己演——且与游戏内是同一套动画代码。
 *
 * ★ 时间轴是纯函数：
 *   createHeroScenario(state) 把初始布阵和事件表编译成「剧本」（含真实路径）；
 *   heroFrameAt(scenario, t) 给出 t 时刻的单位状态与覆盖层强度。
 *   没有任何 DOM / 计时器依赖，所以能直接在 node 里单测——这里的算术错一次
 *   就是「部队穿墙走」或「打了半天没伤害」，靠肉眼截图抓代价太大。
 *
 * ★ 无缝循环靠「烟雾里重置」：
 *   每轮末尾全屏硝烟涨到最浓，在最浓那一瞬把时间轴归零并换掉 mapId
 *   （渲染器只在 mapId 相同时做差分，换了就等于「新场景」，动画状态被清空）。
 *   于是观众看到的是「炮火覆盖 → 硝烟散开 → 新一批部队已经开进战场」，
 *   而不是「部队瞬间闪回出发位置」。
 */

import { reachable } from "./shared/engine.mjs";

/** 一轮的总时长（ms）。 */
export const HERO_PERIOD = 14000;
/** 逐格推进的节拍（ms）。略大于渲染器的 MOVE_STEP_MS=240，避免补间被下一格打断。 */
export const MOVE_STEP_MS = 260;
/** 开火后的「已行动」标记只挂这么久——挂久了每支部队头上都顶着黑块，画面会脏。 */
export const ACTED_MS = 600;

/**
 * 封面专用布阵：围绕地图正中的那座桥（9,3）摆一场攻防。
 *
 * 为什么不用 createGame 的默认布阵：默认是 18×14 全图上两军分踞对角，
 * 相距十几格，一次移动力根本走不到一起——「循环战争」会变成「循环行军」。
 * 封面要的是**热点**，所以把八支部队压到桥两侧，开演就能打起来。
 */
const DEPLOY = {
  u3: { x: 6, y: 3 }, // 红 · 先头坦克（突击桥头）
  u2: { x: 8, y: 3 }, // 红 · 步兵（接替突击）
  u1: { x: 7, y: 4 }, // 红 · 步兵（预备）
  u4: { x: 6, y: 6 }, // 红 · 侦察（侧翼）
  u7: { x: 11, y: 3 }, // 蓝 · 守桥坦克
  u5: { x: 10, y: 4 }, // 蓝 · 步兵（反冲击）
  u6: { x: 12, y: 3 }, // 蓝 · 步兵（预备）
  u8: { x: 13, y: 6 }, // 蓝 · 侦察（侧翼）
};

/**
 * 事件表。按时间升序，每一条都是「某一刻战场发生了什么」。
 *
 *   { at, move: { id, to } }                    → 某支部队开进到 to（路径由引擎算）
 *   { at, fire: { by, on, damage, counter } }   → by 向 on 开火；counter>0 表示遭到反击
 *
 * 伤害值刻意让「三发定生死」，节奏才紧：10 → 4 → 0。
 */
const EVENTS = [
  { at: 1200, move: { id: "u3", to: { x: 10, y: 3 } } }, // 红坦克强渡桥头
  { at: 3000, fire: { by: "u3", on: "u7", damage: 6, counter: 3 } },
  { at: 4200, fire: { by: "u7", on: "u3", damage: 7 } }, // 先头坦克殉爆在桥上
  { at: 5400, move: { id: "u2", to: { x: 10, y: 3 } } }, // 步兵踩着残骸顶上去
  { at: 6200, fire: { by: "u2", on: "u7", damage: 6, counter: 2 } }, // 守桥坦克被击毁
  { at: 8600, fire: { by: "u5", on: "u2", damage: 4, counter: 2 } }, // 蓝步兵自桥东压制
  { at: 9800, fire: { by: "u2", on: "u5", damage: 4, counter: 3 } },
  { at: 10600, fire: { by: "u5", on: "u2", damage: 6 } }, // 红步兵倒下
  { at: 11600, move: { id: "u5", to: { x: 9, y: 3 } } }, // 蓝军踏上桥面
];

/** 硝烟开始涨 / 涨满的时刻。 */
const SMOKE_IN = 12400;
const SMOKE_FULL = 13600;
/**
 * 跨周期的硝烟淡出段（ms）。
 *
 * ★ 这里踩过一次坑：第一版只在周期内「末段涨到 1」，t 一归零 smoke 立刻变成 0。
 *   结果是——重置那一帧确实被烟盖住了，但**紧跟着烟啪一下消失**，
 *   观众看到的是「浓烟 / 突然清晰」的硬切，循环感全毁。
 *   修法：把淡出段放在**周期开头**，于是 t=14000⁻ 与 t=0 都是满烟，
 *   跨周期连续；重置发生在两者之间，始终被烟罩着。
 *   代价是「每轮开头有 600ms 是灰的」——但调用方把首轮的起点定在
 *   HERO_FADE_OUT_MS（见 app.mjs），所以第一次打开页面不会先糊一脸烟。
 */
export const HERO_FADE_OUT_MS = 600;
/** 开火闪光的余辉时长。 */
const FLASH_MS = 260;

const isWater = (type) => type === "water";

/**
 * 把初始 state 编译成剧本。
 *
 * 关键动作：**按时间顺序预演一遍移动**，每一步都调引擎的 `reachable()`
 * 取真实路径。这样部队永远不会穿墙、不会走进河里——路径是引擎自己算的。
 *
 * @param {object} state 引擎状态（会被读取，不被修改）
 * @returns {{period:number, tiles:Array, baseUnits:Array, events:Array,
 *            smokeIn:number, smokeFull:number}}
 */
export function createHeroScenario(state) {
  const baseUnits = state.units.map((unit) => {
    const spot = DEPLOY[unit.id];
    return spot ? { ...unit, ...spot, acted: false } : { ...unit, acted: false };
  });

  // 预演用的沙盘：位置会随事件推进而改变，用来给下一次移动算路径。
  const sandbox = {
    ...state,
    units: baseUnits.map((unit) => ({ ...unit })),
  };
  const events = [];

  for (const event of [...EVENTS].sort((a, b) => a.at - b.at)) {
    if (event.move) {
      const { id, to } = event.move;
      const actor = sandbox.units.find((unit) => unit.id === id);
      // 引擎算出来的可达格里找出目标格——找不到说明这一跳不合法，
      // 与其硬走（会穿墙）不如原地不动，并在测试里被抓住。
      const cell = actor
        ? reachable(sandbox, id).find((c) => c.x === to.x && c.y === to.y)
        : null;
      if (!actor || !cell) {
        events.push({ at: event.at, move: { id, path: null } });
        continue;
      }
      events.push({ at: event.at, move: { id, path: cell.path } });
      actor.x = to.x;
      actor.y = to.y;
    } else if (event.fire) {
      const { by, on, damage, counter = 0 } = event.fire;
      events.push({ at: event.at, fire: { by, on, damage, counter } });

      // 沙盘也要结算伤亡：**阵亡必须腾出格子**。
      // 第一版漏了这一步，于是「步兵踩着坦克残骸顶上桥」这条事件
      // 在沙盘里还认为桥头被占着 → reachable 找不到目标格 → 部队原地不动，
      // 而事件表却以为它已经到位，后面的交火全部落空。
      const attacker = sandbox.units.find((unit) => unit.id === by);
      const defender = sandbox.units.find((unit) => unit.id === on);
      if (attacker && counter > 0) {
        attacker.hp -= counter;
        if (attacker.hp <= 0)
          sandbox.units = sandbox.units.filter((unit) => unit.id !== by);
      }
      if (defender) {
        defender.hp -= damage;
        if (defender.hp <= 0)
          sandbox.units = sandbox.units.filter((unit) => unit.id !== on);
      }
    }
  }

  return {
    period: HERO_PERIOD,
    mapId: state.mapId,
    tiles: state.tiles,
    players: state.players,
    width: state.width,
    height: state.height,
    baseUnits,
    events,
    smokeIn: SMOKE_IN,
    smokeFull: SMOKE_FULL,
  };
}

/** 某支部队在 t 时刻走到路径的第几格（逐格跳，平滑交给渲染器补间）。 */
function stepIndex(path, elapsed) {
  if (elapsed <= 0) return 0;
  return Math.min(path.length - 1, Math.floor(elapsed / MOVE_STEP_MS) + 1);
}

/**
 * t 时刻的战场快照。
 *
 * @param {object} scenario createHeroScenario() 的产物
 * @param {number} t 本轮的毫秒数（调用方负责对 period 取模）
 * @returns {{units:Array, overlay:{smoke:number, flash:number, phase:string}}}
 */
export function heroFrameAt(scenario, t) {
  const byId = new Map(scenario.baseUnits.map((unit) => [unit.id, { ...unit }]));
  let flash = 0;
  let lastBeat = -1;

  for (const event of scenario.events) {
    if (event.at > t) break;
    lastBeat = event.at;

    if (event.move) {
      const unit = byId.get(event.move.id);
      if (!unit || !event.move.path) continue;
      const spot = event.move.path[stepIndex(event.move.path, t - event.at)];
      if (spot) {
        unit.x = spot.x;
        unit.y = spot.y;
      }
      continue;
    }

    const { by, on, damage, counter } = event.fire;
    const attacker = byId.get(by);
    const defender = byId.get(on);
    // 三次机会：开火者已阵亡、目标已阵亡，都说明这条事件过期了。
    if (!attacker || !defender) continue;

    if (counter > 0) {
      attacker.hp -= counter;
      if (attacker.hp <= 0) byId.delete(by);
    }
    // 开火者活着的话挂上「已行动」标记，让渲染器认得出这次交火；
    // 过了 ACTED_MS 就摘掉，免得半透明和黑块留在画面上。
    if (byId.has(by)) {
      const current = byId.get(by);
      current.acted = t - event.at < ACTED_MS;
    }

    defender.hp -= damage;
    if (defender.hp <= 0) byId.delete(on);

    if (t - event.at < FLASH_MS) flash = Math.max(flash, 1 - (t - event.at) / FLASH_MS);
  }

  // 硝烟：开头淡出上一轮的余烟，末尾再涨满。两段接起来正好跨周期连续，
  // 而「重置」就发生在那道最浓的烟里。
  const smoke =
    t < HERO_FADE_OUT_MS
      ? 1 - t / HERO_FADE_OUT_MS
      : t <= scenario.smokeIn
        ? 0
        : Math.min(
            1,
            (t - scenario.smokeIn) / (scenario.smokeFull - scenario.smokeIn),
          );

  return {
    units: [...byId.values()],
    overlay: {
      smoke,
      flash,
      phase:
        t < 1200
          ? "deploy"
          : t < 4200
            ? "advance"
            : t < 10600
              ? "clash"
              : t < scenario.smokeIn
                ? "aftermath"
                : "smoke",
      lastBeat,
    },
  };
}

/**
 * 把剧本的一帧包成渲染器认的 state。
 *
 * `mapId` 带上一轮的序号是**故意的**：渲染器只在 mapId 相同时做「上一帧 → 这一帧」
 * 的差分（renderer.mjs setScene 里那条 `previousState.mapId === state.mapId`）。
 * 换个后缀就等于告诉它「这是新战场」，它会清掉所有补间与爆炸状态、干净重绘，
 * 于是归零那一帧不会出现「全军瞬移回出发点」。
 */
export function heroStateAt(scenario, t, cycle = 0, frame = null) {
  const current = frame || heroFrameAt(scenario, t);
  return {
    state: {
      mapId: `${scenario.mapId}#cinema${cycle}`,
      width: scenario.width,
      height: scenario.height,
      tiles: scenario.tiles,
      players: scenario.players,
      units: current.units,
    },
    frame: current,
  };
}

/** 地图里有没有水——测试用，确认布阵点都在陆地上。 */
export function isWalkableTile(tile) {
  return !!tile && !isWater(tile.type);
}
