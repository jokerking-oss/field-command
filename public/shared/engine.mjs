/** 前线指令 — deterministic, shared rules. No DOM, network, timers or randomness. */
import { BASE_DAMAGE } from "./combat-data.mjs";
import { EXPANSION_MAPS, expansionTiles, expansionSpawns } from "./map-data.mjs";

export const UNITS = {
  infantry: {
    name: "步兵",
    cost: 1000,
    move: 3,
    minRange: 1,
    maxRange: 1,
    maxAmmo: null,
    maxFuel: 99,
    movement: "foot",
    domain: "land",
    production: "factory",
    capture: true,
    description: "廉价占领部队。可穿越山地，占领城市、工厂与总部。",
  },
  mech: {
    name: "机动步兵",
    cost: 3000,
    move: 2,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 3,
    maxFuel: 70,
    movement: "foot",
    domain: "land",
    production: "factory",
    capture: true,
    description: "携带反装甲武器的步兵，可占领建筑、翻越山地。",
  },
  recon: {
    name: "侦察车",
    cost: 4000,
    move: 8,
    minRange: 1,
    maxRange: 1,
    maxAmmo: null,
    maxFuel: 80,
    movement: "wheel",
    domain: "land",
    production: "factory",
    description: "道路机动性极高，擅长压制步兵，但装甲薄弱。",
  },
  tank: {
    name: "轻型坦克",
    cost: 7000,
    move: 6,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 6,
    maxFuel: 70,
    movement: "track",
    domain: "land",
    production: "factory",
    description: "攻防均衡的直射主力，可在移动后攻击相邻敌人。",
  },
  heavy: {
    name: "重型坦克",
    cost: 16000,
    move: 4,
    minRange: 1,
    maxRange: 1,
    maxAmmo: 5,
    maxFuel: 50,
    movement: "track",
    domain: "land",
    production: "factory",
    description: "强大的反装甲火力与厚重装甲，代价是造价和机动性。",
  },
  artillery: {
    name: "自行火炮",
    cost: 6000,
    move: 5,
    minRange: 2,
    maxRange: 3,
    maxAmmo: 6,
    maxFuel: 50,
    movement: "track",
    domain: "land",
    production: "factory",
    indirect: true,
    description: "射程 2–3 格。攻击回合必须原地不动，无法反击。",
  },
  rocket: {
    name: "火箭炮",
    cost: 15000,
    move: 5,
    minRange: 3,
    maxRange: 5,
    maxAmmo: 6,
    maxFuel: 50,
    movement: "wheel",
    domain: "land",
    production: "factory",
    indirect: true,
    description: "射程 3–5 格的远程重火力。移动后无法开火，无法反击。",
  },
  apc: {
    name: "补给车",
    cost: 5000,
    move: 6,
    minRange: 0,
    maxRange: 0,
    maxAmmo: null,
    maxFuel: 80,
    movement: "track",
    domain: "land",
    production: "factory",
    description:
      "无武器。待机或补给时，为相邻友军补满燃料与弹药。首版不含运输。",
  },
  aa: { name: "防空车", cost: 9000, move: 6, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 60, movement: "track", domain: "land", production: "factory",
    description: "近距防空，也可攻击轻型地面单位。" },
  sam: { name: "防空导弹车", cost: 12000, move: 4, minRange: 2, maxRange: 4,
    maxAmmo: 4, maxFuel: 50, movement: "wheel", domain: "land", production: "factory",
    indirect: true, description: "远距防空，移动后不能开火。" },
  assault: { name: "突击坦克", cost: 11000, move: 7, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 65, movement: "track", domain: "land", production: "factory",
    description: "高速装甲突击单位。" },
  siege: { name: "攻城坦克", cost: 18000, move: 4, minRange: 2, maxRange: 3,
    maxAmmo: 5, maxFuel: 50, movement: "track", domain: "land", production: "factory",
    indirect: true, description: "压制坚固阵地与近岸舰船。" },
  rail: { name: "轨道炮车", cost: 25000, move: 4, minRange: 3, maxRange: 6,
    maxAmmo: 4, maxFuel: 50, movement: "track", domain: "land", production: "factory",
    indirect: true, description: "超远程穿甲火力。" },
  interceptor: { name: "截击机", cost: 19000, move: 8, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 70, movement: "air", domain: "air", production: "airport",
    description: "高速制空战机，不能攻击地面目标。" },
  bomber: { name: "轰炸机", cost: 22000, move: 7, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 70, movement: "air", domain: "air", production: "airport",
    description: "对地与对舰轰炸机。" },
  attack_heli: { name: "武装直升机", cost: 10000, move: 6, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 80, movement: "air", domain: "air", production: "airport",
    description: "近距对地、对空与有限对舰。" },
  transport_heli: { name: "运输直升机", cost: 5000, move: 6, minRange: 0, maxRange: 0,
    maxAmmo: null, maxFuel: 80, movement: "air", domain: "air", production: "airport",
    transport: 1, passengers: ["infantry", "mech"],
    description: "载运一队步兵跨越地形。" },
  stealth: { name: "隐形侦击机", cost: 24000, move: 7, minRange: 1, maxRange: 1,
    maxAmmo: 5, maxFuel: 65, movement: "air", domain: "air", production: "airport",
    description: "精确攻击空中、地面和海上目标。" },
  drone: { name: "爆破无人机", cost: 6000, move: 7, minRange: 1, maxRange: 1,
    maxAmmo: 1, maxFuel: 50, movement: "air", domain: "air", production: "airport",
    selfDestruct: true, description: "攻击单个目标后自爆。" },
  battleship: { name: "战列舰", cost: 28000, move: 5, minRange: 2, maxRange: 6,
    maxAmmo: 6, maxFuel: 70, movement: "sea", domain: "sea", production: "port",
    indirect: true, description: "远程舰炮，对陆对舰。" },
  cruiser: { name: "巡洋舰", cost: 18000, move: 6, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 80, movement: "sea", domain: "sea", production: "port",
    description: "反潜与舰队防空。" },
  lander: { name: "登陆舰", cost: 7000, move: 6, minRange: 0, maxRange: 0,
    maxAmmo: null, maxFuel: 80, movement: "sea", domain: "sea", production: "port",
    transport: 2, passengers: "land", description: "运送陆军跨越水域。" },
  submarine: { name: "潜艇", cost: 20000, move: 5, minRange: 1, maxRange: 1,
    maxAmmo: 6, maxFuel: 60, movement: "sea", domain: "sea", production: "port",
    description: "鱼雷攻击舰船，可下潜。" },
  repair_boat: { name: "维修艇", cost: 7000, move: 6, minRange: 0, maxRange: 0,
    maxAmmo: null, maxFuel: 80, movement: "sea", domain: "sea", production: "port",
    description: "为邻接海军恢复生命与补给。" },
  carrier: { name: "航空母舰", cost: 30000, move: 5, minRange: 2, maxRange: 4,
    maxAmmo: 6, maxFuel: 70, movement: "sea", domain: "sea", production: "port",
    indirect: true, description: "舰载机远程攻击陆海空目标。" },
};
export const TERRAINS = {
  plain: { name: "平原", defense: 1, costs: { foot: 1, track: 1, wheel: 2, air: 1 } },
  road: { name: "道路", defense: 0, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
  forest: { name: "森林", defense: 2, costs: { foot: 1, track: 2, wheel: 3, air: 1 } },
  mountain: { name: "山地", defense: 4, costs: { foot: 2, air: 1 } },
  water: { name: "水域", defense: 0, costs: { sea: 1, air: 1 } },
  sea: { name: "海域", defense: 0, costs: { sea: 1, air: 1 } },
  coast: { name: "海岸", defense: 0, costs: { foot: 1, sea: 1, air: 1 } },
  shoal: { name: "浅滩", defense: 0, costs: { foot: 2, sea: 1, air: 1 } },
  bridge: { name: "桥梁", defense: 0, costs: { foot: 1, track: 1, wheel: 1, sea: 1, air: 1 } },
  rail: { name: "铁路", defense: 0, costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
  city: {
    name: "城市",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  factory: {
    name: "工厂",
    defense: 3,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  hq: {
    name: "总部",
    defense: 4,
    income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 },
  },
  port: { name: "港口", defense: 2, income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, sea: 1, air: 1 } },
  airport: { name: "机场", defense: 1, income: 1000,
    costs: { foot: 1, track: 1, wheel: 1, air: 1 } },
};
export const COMMANDERS = {
  vanguard: {
    name: "林岚",
    title: "突击先锋",
    description: "全军攻击力常驻提升 10%。擅长快速突进，夺取战场主动权。",
    powerName: "疾风突击",
    superName: "破晓攻势",
    powerDescription: "本轮全军攻击力提升至 125%，移动力 +1。",
    superDescription: "本轮全军攻击力提升至 140%，移动力 +2。",
  },
  mechanic: {
    name: "周衡",
    title: "战地工程师",
    description: "全军防御力常驻提升 10%。维修与补给让部队持续作战。",
    powerName: "应急抢修",
    superName: "钢铁防线",
    powerDescription: "全军恢复 2 点生命，并补满弹药与燃料。",
    superDescription:
      "全军恢复 4 点生命并补满补给，本轮移动力 +1、防御力提升至 130%。",
  },
};
export const MAPS = [
  {
    id: "training",
    name: "晨曦平原",
    description: "紧凑平原与中央城市。适合熟悉占领、生产和兵种配合。",
    width: 14,
    height: 12,
    players: [2, 3, 4],
  },
  {
    id: "river",
    name: "双桥河谷",
    description: "双桥贯穿河谷，远程火力控制渡口，侧翼小路决定胜负。",
    width: 18,
    height: 14,
    players: [2, 3, 4],
  },
  {
    id: "crossroads",
    name: "十字要塞",
    description: "四角基地与中央工厂。多条战线适合混战或双人组队。",
    width: 18,
    height: 16,
    players: [2, 3, 4],
  },
  ...EXPANSION_MAPS,
];
const ISLAND_MAPS = new Set(["atlas-19", "atlas-21", "atlas-23", "atlas-25", "atlas-27",
  "atlas-28", "atlas-31", "atlas-33", "atlas-39"]);
const clone = (value) => structuredClone(value);
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const positionKey = (x, y) => `${x},${y}`;
const playerOf = (state, seat) => state.players.find((p) => p.id === seat);
const allied = (state, a, b) =>
  a != null &&
  b != null &&
  playerOf(state, a)?.team === playerOf(state, b)?.team;
const tileAt = (state, x, y) =>
  Number.isInteger(x) &&
  Number.isInteger(y) &&
  x >= 0 &&
  y >= 0 &&
  x < state.width &&
  y < state.height
    ? state.tiles[y * state.width + x]
    : null;
const unitAt = (state, x, y) => state.units.find((u) => u.x === x && u.y === y);
const requireRule = (condition, message) => {
  if (!condition) throw new Error(message);
};
const property = (tile) => !!TERRAINS[tile.type]?.income;
function log(state, message) {
  state.log.push(message);
  if (state.log.length > 70) state.log.splice(0, state.log.length - 70);
}
function movementBonus(player) {
  return player.commander === "vanguard"
    ? player.power === "super"
      ? 2
      : player.power === "power"
        ? 1
        : 0
    : player.power === "super"
      ? 1
      : 0;
}
function attackFactor(player) {
  return player.commander === "vanguard"
    ? player.power === "super"
      ? 1.4
      : player.power === "power"
        ? 1.25
        : 1.1
    : 1;
}
function defenseFactor(player) {
  return player.commander === "mechanic"
    ? player.power === "super"
      ? 1.3
      : 1.1
    : 1;
}
function newUnit(state, owner, type, x, y, acted = false) {
  const def = UNITS[type];
  return {
    id: `u${state.nextUnitId++}`,
    type,
    owner,
    x,
    y,
    hp: 10,
    ammo: def.maxAmmo,
    fuel: def.maxFuel,
    acted,
    cargo: def.transport ? [] : null,
    ...(type === "submarine" ? { submerged: false } : {}),
  };
}
const cargoOf = (unit) => Array.isArray(unit.cargo) ? unit.cargo : [];
const canCarry = (carrier, passenger) => {
  const def = UNITS[carrier.type];
  return def.transport && cargoOf(carrier).length < def.transport &&
    (def.passengers === "land" ? UNITS[passenger.type].domain === "land" :
      def.passengers.includes(passenger.type));
};
function resupply(unit) {
  unit.fuel = UNITS[unit.type].maxFuel;
  unit.ammo = UNITS[unit.type].maxAmmo;
}
function supplyNeighbors(state, supplier) {
  let count = 0;
  for (const u of state.units)
    if (
      u.id !== supplier.id &&
      allied(state, supplier.owner, u.owner) &&
      manhattan(u, supplier) === 1
    ) {
      if (u.fuel < UNITS[u.type].maxFuel || u.ammo !== UNITS[u.type].maxAmmo)
        count++;
      resupply(u);
    }
  return count;
}
function generateTiles(map) {
  const expansion = expansionTiles(map.id);
  if (expansion) return expansion;
  const { width, height, id } = map;
  const tiles = Array.from({ length: width * height }, (_, i) => ({
    x: i % width,
    y: Math.floor(i / width),
    type: "plain",
    owner: null,
    capture: 20,
    captureBy: null,
  }));
  const set = (x, y, type) => {
    if (x >= 0 && y >= 0 && x < width && y < height)
      tiles[y * width + x].type = type;
  };
  const midX = Math.floor(width / 2),
    midY = Math.floor(height / 2);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((x * 13 + y * 7) % 19 < 3) set(x, y, "forest");
      if ((x * 7 + y * 11) % 37 === 2 && x > 3 && x < width - 4)
        set(x, y, "mountain");
    }
  for (let x = 1; x < width - 1; x++) {
    set(x, 3, "road");
    set(x, height - 4, "road");
  }
  for (let y = 1; y < height - 1; y++) {
    set(3, y, "road");
    set(width - 4, y, "road");
  }
  if (id === "river") {
    for (let y = 0; y < height; y++) set(midX, y, "water");
    set(midX, 3, "bridge");
    set(midX, height - 4, "bridge");
    set(midX - 2, 5, "city");
    set(midX + 2, height - 6, "city");
    set(midX - 2, height - 5, "forest");
    set(midX + 2, 4, "forest");
    set(midX - 1, midY, "city");
    set(midX + 1, midY - 1, "city");
  } else {
    for (let x = 3; x <= width - 4; x++) set(x, midY, "road");
    for (let y = 3; y <= height - 4; y++) set(midX, y, "road");
    set(midX - 1, midY - 1, id === "crossroads" ? "factory" : "city");
    set(midX + 1, midY + 1, "city");
    set(midX - 2, midY + 1, "forest");
  }
  set(5, 3, "city");
  set(width - 6, height - 4, "city");
  set(3, midY, "city");
  set(width - 4, midY - 1, "city");
  return tiles;
}
export function createGame({
  mapId = "river",
  players = [
    {
      id: 0,
      name: "红方",
      team: 0,
      commander: "vanguard",
      controller: "human",
    },
    { id: 1, name: "蓝方", team: 1, commander: "mechanic", controller: "ai" },
  ],
} = {}) {
  const map = MAPS.find((m) => m.id === mapId);
  requireRule(map, "地图不存在");
  requireRule(
    Array.isArray(players) && players.length >= 2 && players.length <= 4,
    "需要 2 至 4 名玩家",
  );
  requireRule(map.players.includes(players.length), "该地图不支持此玩家人数");
  requireRule(
    new Set(players.map((p) => p.id)).size === players.length,
    "玩家编号不能重复",
  );
  requireRule(
    players.every(
      (p) =>
        Number.isInteger(p.id) &&
        p.id >= 0 &&
        p.id < 4 &&
        Object.hasOwn(COMMANDERS, p.commander || "vanguard") &&
        ["human", "ai"].includes(p.controller || "human"),
    ),
    "玩家配置无效",
  );
  const state = {
    version: 1,
    mapId,
    width: map.width,
    height: map.height,
    tiles: generateTiles(map),
    units: [],
    players: players.map((p) => ({
      id: p.id,
      name: String(p.name || `玩家 ${p.id + 1}`).slice(0, 24),
      team: p.team ?? p.id,
      commander: p.commander || "vanguard",
      controller: p.controller || "human",
      funds: 5000,
      energy: 0,
      power: null,
      defeated: false,
    })),
    currentPlayer: players[0].id,
    day: 1,
    turn: 1,
    phase: "playing",
    winner: null,
    log: [],
    nextUnitId: 1,
  };
  requireRule(
    new Set(state.players.map((p) => p.team)).size > 1,
    "至少需要两个不同队伍",
  );
  const mapSpawns = expansionSpawns(mapId);
  if (mapSpawns) {
    const seatToPlayer = new Map(players.map((p, index) => [index, p.id]));
    for (const tile of state.tiles)
      if (tile.owner != null) tile.owner = seatToPlayer.get(tile.owner) ?? null;
    state.players.forEach((p, index) => {
      const start = mapSpawns.find((s) => s.seat === index);
      requireRule(start && tileAt(state, start.x, start.y)?.type === "hq", "地图缺少总部出生点");
      const starters = ["infantry", "infantry", "tank", "recon"];
      for (const [starterIndex, type] of starters.entries()) {
        const port = ISLAND_MAPS.has(mapId) && starterIndex === 1 ?
          state.tiles.find((tile) => tile.type === "port" && tile.owner === p.id) : null;
        const candidates = state.tiles.filter((tile) =>
          TERRAINS[tile.type].costs[UNITS[type].movement] != null &&
          !unitAt(state, tile.x, tile.y) &&
          (port ? manhattan(tile, port) === 1 : manhattan(tile, start) <= 5),
        );
        candidates.sort((a, b) =>
          (property(a) ? 10 : 0) - (property(b) ? 10 : 0) ||
          manhattan(a, start) - manhattan(b, start) ||
          a.y - b.y || a.x - b.x,
        );
        requireRule(candidates.length > 0, "地图缺少合法开局位置");
        state.units.push(newUnit(state, p.id, type, candidates[0].x, candidates[0].y));
      }
    });
    beginTurn(state, true);
    log(state, `${map.name}：占领敌军总部，或击败所有敌对队伍。`);
    validateState(state);
    return state;
  }
  const corners = [
    { x: 1, y: 1, dx: 1, dy: 1 },
    { x: map.width - 2, y: map.height - 2, dx: -1, dy: -1 },
    { x: map.width - 2, y: 1, dx: -1, dy: 1 },
    { x: 1, y: map.height - 2, dx: 1, dy: -1 },
  ];
  state.players.forEach((p, index) => {
    const { x, y, dx, dy } = corners[index];
    for (let a = 0; a < 3; a++)
      for (let b = 0; b < 3; b++)
        tileAt(state, x + a * dx, y + b * dy).type = "plain";
    [
      [0, 0, "hq"],
      [1, 0, "factory"],
      [0, 1, "city"],
    ].forEach(([a, b, type]) => {
      const t = tileAt(state, x + a * dx, y + b * dy);
      t.type = type;
      t.owner = p.id;
    });
    [
      [0, 2, "infantry"],
      [2, 0, "infantry"],
      [1, 1, "tank"],
      [2, 2, "recon"],
    ].forEach(([a, b, type]) =>
      state.units.push(newUnit(state, p.id, type, x + a * dx, y + b * dy)),
    );
  });
  beginTurn(state, true);
  log(state, `${map.name}：占领敌军总部，或击败所有敌对队伍。`);
  validateState(state);
  return state;
}
/**
 * 搜索保险 #1：单次寻路的**出队**次数上限。
 * 思路搬自 xpgram/advance-wars (MIT) `pathIterableFrom` 的循环卫兵，
 * 但**数值必须自己定**——它那里的 200 是按「每个候选格跑一次 BFS」计的，
 * 我们这个 Dijkstra 每轮弹一格，语义完全不同。
 * 实测：正常地图单次寻路约 0.07ms、几十次出队；本机 8ms 预算下可容 4000 次出队。
 * 取 4000：既远高于任何正常棋盘的需求（不会误伤大地图），
 * 又能在数据损坏导致队列爆炸时兜底（不会死循环）。
 */
const SEARCH_MAX_STEPS = 4000;
/**
 * 搜索保险 #2：单次寻路的耗时上限（毫秒）。
 * 搬自 xpgram 的 `QueueSearch`——它给每个搜索任务挂了计时器，超时就中止并告警。
 * 这里用 8ms 是因为整帧预算约 16ms，寻路不能吃掉一半以上。
 */
const SEARCH_MAX_MS = 8;
/** Shortest legal routes. Allied tiles can be crossed, but never used as destinations. */
export function reachable(state, unitId) {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return [];
  const def = UNITS[unit.type];
  const limit = Math.min(
    def.move + movementBonus(playerOf(state, unit.owner)),
    unit.fuel,
  );
  const occupied = new Map(state.units.map((u) => [positionKey(u.x, u.y), u]));
  /*
   * 链式路径存储（搬自 xpgram 的 `square.arrowFrom` 方向字段做法）。
   *
   * 旧写法每扩展一格就 `[...current.path, {x, y}]`——一条长路径会被反复整体复制，
   * 内存和复制量都是 O(n²)。新写法每格只存 `prev` 指针指向来源格，
   * 寻路期间是 O(n)；只有在**对外返回**时才沿指针回溯展开成数组。
   *
   * 对外契约不变：调用方拿到的仍然是 `path: [{x,y}, ...]` 数组，
   * 含起点、含终点、顺序不变（test/engine.test.mjs 用 deepEqual 卡死了这一点）。
   */
  const first = {
    x: unit.x,
    y: unit.y,
    cost: 0,
    prev: null,
  };
  const queue = [first],
    best = new Map([[positionKey(unit.x, unit.y), first]]);
  const startedAt = Date.now();
  let steps = 0;
  while (queue.length) {
    if (++steps > SEARCH_MAX_STEPS || Date.now() - startedAt > SEARCH_MAX_MS) {
      // 数据异常或地图过大：截断搜索，返回已经确定的最优结果。
      break;
    }
    queue.sort((a, b) => a.cost - b.cost);
    const current = queue.shift();
    if (best.get(positionKey(current.x, current.y)) !== current) continue;
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      const x = current.x + dx,
        y = current.y + dy,
        tile = tileAt(state, x, y);
      if (!tile) continue;
      const occupant = occupied.get(positionKey(x, y));
      if (occupant && !allied(state, unit.owner, occupant.owner)) continue;
      const step = TERRAINS[tile.type].costs[def.movement];
      if (step == null) continue;
      const cost = current.cost + step,
        key = positionKey(x, y);
      if (cost > limit || (best.has(key) && best.get(key).cost <= cost))
        continue;
      const next = { x, y, cost, prev: current };
      best.set(key, next);
      queue.push(next);
    }
  }
  return [...best.values()]
    .filter((cell) => {
      const u = occupied.get(positionKey(cell.x, cell.y));
      return !u || u.id === unit.id;
    })
    .map((cell) => ({
      x: cell.x,
      y: cell.y,
      cost: cell.cost,
      // 把 `prev` 指针链回溯展开成对外契约要求的外显 path 数组。
      path: unwindPath(cell),
    }));
}
/**
 * 沿 `prev` 指针回溯出完整点列（含起点、含终点）。
 * 搬自 xpgram `pathIterableFrom` 的「由终点反向还原路线」思路，只是它存方向、我们存指针。
 */
function unwindPath(cell) {
  const points = [];
  for (let node = cell; node; node = node.prev) {
    points.push({ x: node.x, y: node.y });
  }
  points.reverse();
  return points;
}
export function attackable(state, unitId, from) {
  const unit = state.units.find((u) => u.id === unitId);
  if (!unit || UNITS[unit.type].maxRange === 0 || unit.ammo === 0) return [];
  const def = UNITS[unit.type],
    origin = from || unit;
  if (
    !tileAt(state, origin.x, origin.y) ||
    (def.indirect && manhattan(unit, origin) > 0)
  )
    return [];
  return state.units
    .filter(
      (enemy) =>
        !allied(state, unit.owner, enemy.owner) &&
        BASE_DAMAGE[unit.type][enemy.type] != null &&
        !(enemy.type === "submarine" && enemy.submerged &&
          !["cruiser", "submarine"].includes(unit.type)) &&
        manhattan(origin, enemy) >= def.minRange &&
        manhattan(origin, enemy) <= def.maxRange,
    )
    .map((u) => u.id);
}
function damage(state, attacker, defender, defenderTile, hp = attacker.hp) {
  const base = BASE_DAMAGE[attacker.type][defender.type];
  if (!base || attacker.ammo === 0 || hp <= 0) return 0;
  const terrainReduction =
    1 - ((UNITS[defender.type].domain === "air" ? 0 :
      TERRAINS[defenderTile.type].defense) * defender.hp) / 100;
  return Math.min(
    defender.hp,
    Math.max(
      1,
      Math.round(
        ((((base / 10) * hp) / 10) *
          attackFactor(playerOf(state, attacker.owner)) *
          terrainReduction) /
          defenseFactor(playerOf(state, defender.owner)),
      ),
    ),
  );
}
export function previewCombat(state, attackerId, defenderId, from) {
  const attacker = state.units.find((u) => u.id === attackerId),
    defender = state.units.find((u) => u.id === defenderId);
  if (
    !attacker ||
    !defender ||
    !attackable(state, attackerId, from).includes(defenderId)
  )
    return { damage: 0, counter: 0 };
  const origin = from || attacker;
  const dealt = damage(
    state,
    attacker,
    defender,
    tileAt(state, defender.x, defender.y),
  );
  const survivingDefender = { ...defender, hp: defender.hp - dealt };
  const counter =
    survivingDefender.hp > 0 &&
    !UNITS[attacker.type].selfDestruct &&
    !UNITS[defender.type].indirect &&
    UNITS[defender.type].maxRange > 0 &&
    manhattan(origin, defender) === 1 &&
    defender.ammo !== 0 &&
    BASE_DAMAGE[defender.type][attacker.type] != null &&
    !(attacker.type === "submarine" && attacker.submerged &&
      !["cruiser", "submarine"].includes(defender.type))
      ? damage(
          state,
          survivingDefender,
          attacker,
          tileAt(state, origin.x, origin.y),
        )
      : 0;
  return { damage: dealt, counter };
}
function resetCaptures(state) {
  for (const tile of state.tiles)
    if (tile.capture < 20) {
      const occupant = unitAt(state, tile.x, tile.y);
      if (
        !occupant ||
        occupant.owner !== tile.captureBy ||
        !UNITS[occupant.type].capture
      ) {
        tile.capture = 20;
        tile.captureBy = null;
      }
    }
}
function defeat(state, seat) {
  const player = playerOf(state, seat);
  if (!player || player.defeated) return;
  player.defeated = true;
  player.power = null;
  state.units = state.units.filter((u) => u.owner !== seat);
  for (const u of state.units)
    if (Array.isArray(u.cargo)) u.cargo = u.cargo.filter((passenger) => passenger.owner !== seat);
  for (const tile of state.tiles)
    if (tile.owner === seat) {
      tile.owner = null;
      tile.capture = 20;
      tile.captureBy = null;
    }
  log(state, `${player.name} 已退出战场。`);
}
function checkVictory(state) {
  for (const p of state.players)
    if (
      !p.defeated &&
      !state.units.some((u) => u.owner === p.id || cargoOf(u).some((passenger) => passenger.owner === p.id)) &&
      !state.tiles.some((t) => ["factory", "airport", "port"].includes(t.type) && t.owner === p.id)
    )
      defeat(state, p.id);
  const teams = [
    ...new Set(state.players.filter((p) => !p.defeated).map((p) => p.team)),
  ];
  if (teams.length <= 1) {
    state.phase = "finished";
    state.winner = teams[0] ?? null;
    log(
      state,
      teams.length
        ? `${state.players
            .filter((p) => !p.defeated)
            .map((p) => p.name)
            .join("、")} 获得胜利！`
        : "战斗结束。",
    );
  }
}
function beginTurn(state, initial = false) {
  const p = playerOf(state, state.currentPlayer);
  p.power = null;
  const income = state.tiles
    .filter((t) => t.owner === p.id && property(t))
    .reduce((sum, t) => sum + TERRAINS[t.type].income, 0);
  p.funds += income;
  for (const u of state.units.filter((u) => u.owner === p.id)) {
    u.acted = false;
    if (UNITS[u.type].domain === "air" || u.type === "submarine" && u.submerged)
      u.fuel = Math.max(0, u.fuel - (u.submerged ? 5 : 2));
    const tile = tileAt(state, u.x, u.y);
    const repairSite = UNITS[u.type].domain === "air" ? tile.type === "airport" :
      UNITS[u.type].domain === "sea" ? tile.type === "port" : property(tile);
    if (repairSite && allied(state, p.id, tile.owner)) {
      resupply(u);
      const hpCost = UNITS[u.type].cost / 10;
      const healed = Math.min(2, 10 - u.hp, Math.floor(p.funds / hpCost));
      u.hp += healed;
      p.funds -= healed * hpCost;
    }
  }
  const lost = state.units.filter((u) => UNITS[u.type].domain === "air" && u.owner === p.id && u.fuel === 0);
  if (lost.length) {
    state.units = state.units.filter((u) => !lost.includes(u));
    log(state, `${p.name} 有 ${lost.length} 支空军因燃料耗尽坠毁。`);
  }
  for (const u of state.units.filter(
    (u) => u.owner === p.id && u.type === "apc",
  ))
    supplyNeighbors(state, u);
  log(
    state,
    `${initial ? "作战开始" : `第 ${state.day} 天`} · ${p.name} 行动，收入 +${income}。`,
  );
}
function nextTurn(state) {
  checkVictory(state);
  if (state.phase !== "playing") return;
  const oldIndex = state.players.findIndex((p) => p.id === state.currentPlayer);
  let newIndex = oldIndex;
  do {
    newIndex = (newIndex + 1) % state.players.length;
  } while (state.players[newIndex].defeated);
  if (newIndex <= oldIndex) state.day++;
  state.currentPlayer = state.players[newIndex].id;
  state.turn++;
  beginTurn(state);
}
function gainEnergy(player, hpDamage, unitType) {
  if (!player.power)
    player.energy = Math.min(
      100,
      player.energy +
        Math.max(2, Math.ceil((hpDamage * UNITS[unitType].cost) / 1800)),
    );
}
export function applyAction(original, seat, action) {
  requireRule(original?.phase === "playing", "对局已经结束");
  requireRule(
    action && typeof action === "object" && !Array.isArray(action),
    "行动格式无效",
  );
  const originalPlayer = playerOf(original, seat);
  requireRule(originalPlayer && !originalPlayer.defeated, "玩家不存在或已战败");
  requireRule(original.currentPlayer === seat, "尚未轮到你行动");
  const state = clone(original),
    player = playerOf(state, seat);
  if (action.type === "endTurn") {
    nextTurn(state);
    return state;
  }
  if (action.type === "surrender") {
    defeat(state, seat);
    resetCaptures(state);
    nextTurn(state);
    return state;
  }
  if (action.type === "power") {
    requireRule(
      action.level === "power" || action.level === "super",
      "能力类型无效",
    );
    const cost = action.level === "super" ? 100 : 50;
    requireRule(!player.power, "本轮已经发动过指挥官能力");
    requireRule(player.energy >= cost, "指挥官能量不足");
    player.energy -= cost;
    player.power = action.level;
    if (player.commander === "mechanic")
      for (const u of state.units.filter((u) => u.owner === seat)) {
        u.hp = Math.min(10, u.hp + (action.level === "super" ? 4 : 2));
        resupply(u);
      }
    log(
      state,
      `${player.name} 发动「${COMMANDERS[player.commander][action.level === "super" ? "superName" : "powerName"]}」！`,
    );
    return state;
  }
  if (action.type === "build") {
    const def = UNITS[action.unitType],
      tile = tileAt(state, action.x, action.y);
    requireRule(Object.hasOwn(UNITS, action.unitType), "兵种不存在");
    requireRule(
      tile && tile.type === def.production && tile.owner === seat,
      `只能在己方${TERRAINS[def.production].name}生产`,
    );
    requireRule(!unitAt(state, tile.x, tile.y), "生产建筑已被单位占用");
    requireRule(player.funds >= def.cost, "资金不足");
    player.funds -= def.cost;
    state.units.push(
      newUnit(state, seat, action.unitType, tile.x, tile.y, true),
    );
    log(state, `${player.name} 生产了${def.name}（−${def.cost}）。`);
    return state;
  }
  requireRule(action.type === "move", "未知行动");
  const unit = state.units.find((u) => u.id === action.unitId);
  requireRule(unit && unit.owner === seat, "只能指挥己方单位");
  requireRule(!unit.acted, "该单位已经行动");
  requireRule(
    ["wait", "capture", "attack", "supply", "submerge", "surface", "repair", "load", "unload"].includes(action.command),
    "不支持此单位指令",
  );
  const destination = reachable(state, unit.id).find(
    (cell) => cell.x === action.x && cell.y === action.y,
  );
  requireRule(destination, "目标格无法到达");
  const moved = unit.x !== destination.x || unit.y !== destination.y;
  const def = UNITS[unit.type];
  if (action.command === "attack") {
    requireRule(!def.indirect || !moved, "间接火力移动后不能攻击");
    requireRule(
      attackable(state, unit.id, destination).includes(action.targetId),
      "目标不在可攻击范围内，或弹药不足",
    );
  }
  if (action.command === "capture") {
    const tile = tileAt(state, destination.x, destination.y);
    requireRule(def.capture, "只有步兵与机动步兵可以占领");
    requireRule(
      property(tile) && !allied(state, seat, tile.owner),
      "只能占领中立或敌方建筑",
    );
  }
  if (action.command === "supply")
    requireRule(unit.type === "apc", "只有补给车可以执行补给");
  if (action.command === "submerge" || action.command === "surface") {
    requireRule(unit.type === "submarine", "只有潜艇可以切换下潜状态");
    requireRule(unit.submerged !== (action.command === "submerge"), "潜艇已经处于该状态");
    if (action.command === "submerge") requireRule(unit.fuel - destination.cost >= 5, "下潜燃料不足");
  }
  let actionTarget;
  if (action.command === "repair") {
    requireRule(unit.type === "repair_boat", "只有维修艇可以修理舰船");
    actionTarget = state.units.find((u) => u.id === action.targetId);
    requireRule(actionTarget && actionTarget.id !== unit.id &&
      allied(state, unit.owner, actionTarget.owner) &&
      UNITS[actionTarget.type].domain === "sea" &&
      manhattan(destination, actionTarget) === 1, "只能修理相邻友方舰船");
  }
  if (action.command === "load") {
    requireRule(def.transport, "该单位不能载运部队");
    actionTarget = state.units.find((u) => u.id === action.targetId);
    requireRule(actionTarget && allied(state, unit.owner, actionTarget.owner) &&
      manhattan(destination, actionTarget) === 1 && canCarry(unit, actionTarget),
      "只能装载相邻的合适友军，且载员不能已满");
  }
  if (action.command === "unload") {
    requireRule(def.transport && cargoOf(unit).length > 0, "该单位没有可卸载的部队");
    const passenger = cargoOf(unit)[0],
      landing = tileAt(state, action.targetX, action.targetY);
    requireRule(landing && manhattan(destination, landing) === 1 &&
      TERRAINS[landing.type].costs[UNITS[passenger.type].movement] != null &&
      !unitAt(state, landing.x, landing.y) &&
      (landing.x !== destination.x || landing.y !== destination.y),
      "只能卸载到相邻的空闲合法地形");
  }
  unit.x = destination.x;
  unit.y = destination.y;
  unit.fuel -= destination.cost;
  unit.acted = true;
  if (action.command === "attack") {
    const enemy = state.units.find((u) => u.id === action.targetId);
    const opponent = playerOf(state, enemy.owner);
    const result = previewCombat(state, unit.id, enemy.id);
    enemy.hp -= result.damage;
    if (unit.ammo != null) unit.ammo--;
    if (result.counter > 0) {
      unit.hp -= result.counter;
      if (enemy.ammo != null) enemy.ammo--;
    }
    if (def.selfDestruct) unit.hp = 0;
    gainEnergy(player, result.damage, enemy.type);
    gainEnergy(opponent, result.damage, enemy.type);
    if (result.counter > 0) {
      gainEnergy(player, result.counter, unit.type);
      gainEnergy(opponent, result.counter, unit.type);
    }
    log(
      state,
      `${player.name}的${def.name}攻击${UNITS[enemy.type].name}：−${result.damage} HP${result.counter ? `，反击 −${result.counter} HP` : ""}${enemy.hp <= 0 ? "，目标被摧毁" : ""}。`,
    );
    state.units = state.units.filter((u) => u.hp > 0);
  } else if (action.command === "capture") {
    const tile = tileAt(state, unit.x, unit.y);
    if (tile.captureBy !== seat) tile.capture = 20;
    tile.captureBy = seat;
    tile.capture -= unit.hp;
    if (tile.capture <= 0) {
      const priorOwner = tile.owner;
      tile.owner = seat;
      tile.capture = 20;
      tile.captureBy = null;
      log(state, `${player.name} 占领了${TERRAINS[tile.type].name}！`);
      if (tile.type === "hq" && priorOwner != null) defeat(state, priorOwner);
    } else
      log(
        state,
        `${player.name} 正在占领${TERRAINS[tile.type].name}，剩余 ${tile.capture} 点。`,
      );
  } else if (action.command === "submerge" || action.command === "surface") {
    unit.submerged = action.command === "submerge";
    log(state, `${player.name}的潜艇${unit.submerged ? "下潜" : "上浮"}。`);
  } else if (action.command === "repair") {
    actionTarget.hp = Math.min(10, actionTarget.hp + 2);
    resupply(actionTarget);
    log(state, `${player.name}的维修艇修理了${UNITS[actionTarget.type].name}。`);
  } else if (action.command === "load") {
    actionTarget.acted = true;
    unit.cargo = [...cargoOf(unit), actionTarget];
    state.units = state.units.filter((u) => u.id !== actionTarget.id);
    log(state, `${player.name}的${def.name}装载了${UNITS[actionTarget.type].name}。`);
  } else if (action.command === "unload") {
    const [passenger, ...remaining] = cargoOf(unit);
    unit.cargo = remaining;
    Object.assign(passenger, { x: action.targetX, y: action.targetY, acted: true });
    state.units.push(passenger);
    log(state, `${player.name}的${def.name}卸载了${UNITS[passenger.type].name}。`);
  }
  if (
    unit.type === "apc" &&
    (action.command === "supply" || action.command === "wait")
  ) {
    const count = supplyNeighbors(state, unit);
    if (count || action.command === "supply")
      log(state, `${player.name}的补给车完成补给，恢复 ${count} 支部队。`);
  }
  resetCaptures(state);
  checkVictory(state);
  if (
    state.phase === "playing" &&
    playerOf(state, state.currentPlayer).defeated
  )
    nextTurn(state);
  return state;
}
function enemyLandingSites(state, seat, carrier) {
  const coast = [];
  const seen = new Set();
  const headquarters = state.tiles.filter((tile) => tile.type === "hq" && tile.owner != null &&
    !allied(state, seat, tile.owner));
  const queue = [...headquarters];
  for (const tile of queue) seen.add(positionKey(tile.x, tile.y));
  for (let index = 0; index < queue.length; index++) {
    const tile = queue[index];
    const neighbors = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dx, dy]) => tileAt(state, tile.x + dx, tile.y + dy)).filter(Boolean);
    if (TERRAINS[tile.type].costs.foot != null &&
      neighbors.some((neighbor) => TERRAINS[neighbor.type].costs.sea != null)) coast.push(tile);
    for (const next of neighbors) {
      const key = positionKey(next.x, next.y);
      if (TERRAINS[next.type].costs.foot == null || seen.has(key)) continue;
      seen.add(key);
      queue.push(next);
    }
  }
  let reachableCoast = coast;
  if (carrier && UNITS[carrier.type].domain === "sea") {
    const water = new Set([positionKey(carrier.x, carrier.y)]);
    const frontier = [{ x: carrier.x, y: carrier.y }];
    for (let index = 0; index < frontier.length; index++) {
      const cell = frontier[index];
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const next = tileAt(state, cell.x + dx, cell.y + dy);
        if (!next || TERRAINS[next.type].costs.sea == null) continue;
        const key = positionKey(next.x, next.y);
        if (water.has(key)) continue;
        water.add(key);
        frontier.push(next);
      }
    }
    reachableCoast = coast.filter((tile) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => water.has(positionKey(tile.x + dx, tile.y + dy))));
  }
  const distance = (tile) => Math.min(...headquarters.map((hq) => manhattan(tile, hq)));
  return reachableCoast.sort((a, b) => distance(a) - distance(b) || a.y - b.y || a.x - b.x);
}

/** AI chooses one atomic action; every unit acts at most once, and production sites fill. */
export function chooseAIAction(state, seat) {
  const p = playerOf(state, seat);
  if (
    !p ||
    p.defeated ||
    state.phase !== "playing" ||
    state.currentPlayer !== seat
  )
    return { type: "endTurn" };
  if (!p.power && p.energy >= 100) return { type: "power", level: "super" };
  if (
    !p.power &&
    p.energy >= 50 &&
    p.commander === "mechanic" &&
    state.units
      .filter((u) => u.owner === seat)
      .reduce((sum, u) => sum + 10 - u.hp, 0) >= 5
  )
    return { type: "power", level: "power" };
  const enemies = state.units.filter((u) => !allied(state, seat, u.owner));
  const targets = state.tiles.filter(
    (t) => property(t) && !allied(state, seat, t.owner),
  );
  const ownUnits = state.units.filter((u) => u.owner === seat);
  const hasLander = ownUnits.some((u) => u.type === "lander");
  if (ISLAND_MAPS.has(state.mapId) && !hasLander) {
    const blockedPort = state.tiles.find((tile) => tile.type === "port" && tile.owner === seat &&
      unitAt(state, tile.x, tile.y)?.owner === seat &&
      !unitAt(state, tile.x, tile.y).acted);
    if (blockedPort) {
      const blocker = unitAt(state, blockedPort.x, blockedPort.y);
      const escape = reachable(state, blocker.id)
        .filter((cell) => cell.x !== blockedPort.x || cell.y !== blockedPort.y)
        .sort((a, b) => a.cost - b.cost || a.y - b.y || a.x - b.x)[0];
      if (escape) return { type: "move", unitId: blocker.id, x: escape.x,
        y: escape.y, command: "wait" };
    }
  }
  const vacantPort = state.tiles.find((tile) => tile.type === "port" && tile.owner === seat &&
    !unitAt(state, tile.x, tile.y));
  if (ISLAND_MAPS.has(state.mapId) && vacantPort &&
    !hasLander && p.funds >= UNITS.lander.cost)
    return { type: "build", unitType: "lander", x: vacantPort.x, y: vacantPort.y };
  const needsEscort = ISLAND_MAPS.has(state.mapId) && hasLander &&
    !ownUnits.some((u) => u.type === "cruiser");
  if (needsEscort && vacantPort && p.funds >= UNITS.cruiser.cost)
    return { type: "build", unitType: "cruiser", x: vacantPort.x, y: vacantPort.y };
  const units = state.units
    .filter((u) => u.owner === seat && !u.acted)
    .sort(
      (a, b) =>
        Number(!!UNITS[b.type].transport) - Number(!!UNITS[a.type].transport) ||
        Number(!!UNITS[b.type].capture) - Number(!!UNITS[a.type].capture) ||
        Number(!!UNITS[b.type].indirect) - Number(!!UNITS[a.type].indirect),
    );
  for (const unit of units) {
    const cells = reachable(state, unit.id),
      def = UNITS[unit.type];
    if (def.transport) {
      const cargo = cargoOf(unit);
      if (cargo.length) {
        const landings = enemyLandingSites(state, seat, unit)
          .filter((tile) => !unitAt(state, tile.x, tile.y) &&
            TERRAINS[tile.type].costs[UNITS[cargo[0].type].movement] != null);
        const landingRank = new Map(landings.map((tile, rank) => [tile, rank]));
        const drop = landings
          .flatMap((tile) => cells.filter((cell) => manhattan(tile, cell) === 1)
            .map((cell) => ({ tile, cell })))
          .sort((a, b) => landingRank.get(a.tile) - landingRank.get(b.tile) ||
            a.cell.cost - b.cell.cost)[0];
        if (drop) return { type: "move", unitId: unit.id, x: drop.cell.x, y: drop.cell.y,
          command: "unload", targetX: drop.tile.x, targetY: drop.tile.y };
      } else {
        const passengers = state.units.filter((candidate) => candidate.id !== unit.id &&
          allied(state, unit.owner, candidate.owner) &&
          canCarry(unit, candidate));
        const pickup = passengers.flatMap((passenger) =>
          cells.filter((cell) => manhattan(cell, passenger) === 1)
            .map((cell) => ({ cell, passenger })))
          .sort((a, b) =>
            Number(!!UNITS[b.passenger.type].capture) - Number(!!UNITS[a.passenger.type].capture) ||
            a.cell.cost - b.cell.cost)[0];
        if (pickup) return { type: "move", unitId: unit.id, x: pickup.cell.x,
          y: pickup.cell.y, command: "load", targetId: pickup.passenger.id };
      }
    }
    if (unit.type === "repair_boat") {
      const needy = state.units.filter((other) => other.id !== unit.id &&
        allied(state, seat, other.owner) && UNITS[other.type].domain === "sea" &&
        (other.hp < 10 || other.ammo != null && other.ammo < UNITS[other.type].maxAmmo ||
          other.fuel < UNITS[other.type].maxFuel));
      const repair = needy.flatMap((target) => cells.filter((cell) => manhattan(cell, target) === 1)
        .map((cell) => ({ cell, target })))
        .sort((a, b) => a.cell.cost - b.cell.cost)[0];
      if (repair) return { type: "move", unitId: unit.id, x: repair.cell.x, y: repair.cell.y,
        command: "repair", targetId: repair.target.id };
    }
    if (ISLAND_MAPS.has(state.mapId) && def.capture &&
      state.units.some((transport) => transport.owner === seat &&
        transport.type === "lander" && !cargoOf(transport).length &&
        manhattan(unit, transport) === 1))
      return { type: "move", unitId: unit.id, x: unit.x, y: unit.y, command: "wait" };
    let best = null,
      bestScore = -Infinity;
    const consider = (score, cell, command, targetId) => {
      if (score > bestScore) {
        bestScore = score;
        best = {
          type: "move",
          unitId: unit.id,
          x: cell.x,
          y: cell.y,
          command,
          ...(targetId ? { targetId } : {}),
        };
      }
    };
    for (const cell of cells) {
      const tile = tileAt(state, cell.x, cell.y);
      if (def.capture && property(tile) && !allied(state, seat, tile.owner)) {
        const enemyThreat = enemies.reduce(
          (sum, e) => sum + (manhattan(e, cell) <= 2 ? 1 : 0),
          0,
        );
        const finish =
          tile.captureBy === seat ? tile.capture <= unit.hp : 20 <= unit.hp;
        consider(
          65 +
            (tile.type === "hq" && tile.owner != null
              ? 90
              : tile.type === "factory"
                ? 12
                : 0) +
            (finish ? 35 : 0) +
            (tile.captureBy === seat ? 20 : 0) -
            enemyThreat * 3,
          cell,
          "capture",
        );
      }
      for (const id of attackable(state, unit.id, cell)) {
        const enemy = state.units.find((u) => u.id === id),
          result = previewCombat(state, unit.id, id, cell);
        const value =
          result.damage * Math.sqrt(UNITS[enemy.type].cost / 1000) -
          result.counter * Math.sqrt(def.cost / 1000) * 0.65;
        const kill = result.damage >= enemy.hp ? 22 : 0;
        const invader =
          tileAt(state, enemy.x, enemy.y).owner === seat &&
          UNITS[enemy.type].capture
            ? 30
            : 0;
        consider(
          40 +
            value * 3 +
            kill +
            invader +
            TERRAINS[tile.type].defense -
            cell.cost * 0.2,
          cell,
          "attack",
          id,
        );
      }
    }
    if (best && bestScore >= 45) return best;
    // Build reverse terrain distances, so river crossings and obstacles are navigated.
    let goals = def.capture ? targets : enemies;
    if (def.transport && cargoOf(unit).length) {
      const landings = enemyLandingSites(state, seat, unit);
      goals = state.tiles.filter((tile) => TERRAINS[tile.type].costs[def.movement] != null &&
        landings.some((landing) => manhattan(tile, landing) === 1));
    } else if (def.transport) {
      const passengers = state.units.filter((candidate) =>
        allied(state, seat, candidate.owner) && canCarry(unit, candidate));
      goals = state.tiles.filter((tile) => TERRAINS[tile.type].costs[def.movement] != null &&
        passengers.some((passenger) => manhattan(tile, passenger) === 1));
    } else if (unit.type === "repair_boat") {
      const ships = state.units.filter((candidate) => allied(state, seat, candidate.owner) &&
        candidate.id !== unit.id && UNITS[candidate.type].domain === "sea");
      goals = state.tiles.filter((tile) => TERRAINS[tile.type].costs.sea != null &&
        ships.some((ship) => manhattan(tile, ship) === 1));
    } else if (def.domain === "sea") {
      goals = state.tiles.filter((tile) => TERRAINS[tile.type].costs.sea != null &&
        enemies.some((enemy) => manhattan(tile, enemy) <= def.maxRange ||
          def.maxRange === 0 && manhattan(tile, enemy) === 1));
    }
    if (unit.type === "apc") {
      const depleted = state.units.filter(
        (u) =>
          u.owner === seat &&
          u.id !== unit.id &&
          (u.fuel < UNITS[u.type].maxFuel * 0.65 ||
            (u.ammo != null && u.ammo <= 2)),
      );
      goals = depleted.length
        ? depleted
        : state.units.filter(
            (u) =>
              u.owner === seat &&
              ["tank", "heavy", "artillery"].includes(u.type),
          );
    }
    if (!goals.length) goals = targets;
    const recovery = state.tiles.filter(
      (t) => property(t) && allied(state, seat, t.owner),
    );
    if ((unit.hp <= 4 || unit.ammo === 0 || unit.fuel <= 8) && recovery.length)
      goals = recovery;
    const distances = distanceField(state, unit, goals);
    let chosen = cells[0],
      moveScore = -Infinity;
    for (const cell of cells) {
      const tile = tileAt(state, cell.x, cell.y);
      let score =
        -(distances.get(positionKey(cell.x, cell.y)) ?? 1000) * 6 +
        TERRAINS[tile.type].defense * 0.6 -
        cell.cost * 0.05;
      if (["factory", "airport", "port"].includes(tile.type) && tile.owner === seat) score -= 8;
      // Leave capturable buildings free for our infantry, especially a blockaded HQ.
      if (!def.capture && property(tile) && !allied(state, seat, tile.owner))
        score -= 45;
      if (unit.hp <= 4 && property(tile) && allied(state, seat, tile.owner))
        score += 50;
      if (def.indirect) {
        const nearest = enemies.length
          ? Math.min(...enemies.map((e) => manhattan(e, cell)))
          : 99;
        if (nearest >= def.minRange && nearest <= def.maxRange) score += 28;
        if (nearest < def.minRange) score -= 25;
      }
      if (unit.type === "apc")
        score +=
          state.units.filter(
            (u) =>
              u.owner === seat &&
              u.id !== unit.id &&
              manhattan(u, cell) === 1 &&
              (u.fuel < UNITS[u.type].maxFuel ||
                u.ammo !== UNITS[u.type].maxAmmo),
          ).length * 35;
      if (score > moveScore) {
        moveScore = score;
        chosen = cell;
      }
    }
    return {
      type: "move",
      unitId: unit.id,
      x: chosen.x,
      y: chosen.y,
      command: unit.type === "apc" ? "supply" :
        unit.type === "submarine" && !unit.submerged && unit.fuel - chosen.cost >= 5 ?
          "submerge" : "wait",
    };
  }
  for (const tile of state.tiles.filter(
    (t) => t.type === "factory" && t.owner === seat && !unitAt(state, t.x, t.y),
  )) {
    if (needsEscort && p.funds < UNITS.cruiser.cost) continue;
    const owned = state.units.filter((u) => u.owner === seat);
    const count = (type) => owned.filter((u) => u.type === type).length;
    let preference;
    if (
      owned.filter((u) => UNITS[u.type].capture).length <
      Math.min(4, Math.max(2, Math.ceil(targets.length / 3)))
    )
      preference = ["infantry"];
    else if (count("tank") < 2) preference = ["tank", "mech", "infantry"];
    else if (count("artillery") < Math.ceil(count("tank") / 2))
      preference = ["artillery", "mech", "infantry"];
    else if (
      count("apc") < 1 &&
      owned.some((u) => u.ammo != null && u.ammo <= 2)
    )
      preference = ["apc"];
    else if (count("heavy") < Math.max(1, Math.floor(count("tank") / 2)))
      preference = ["heavy"];
    else if (count("rocket") < 1 && count("heavy") >= 1)
      preference = ["rocket"];
    else if (count("recon") < 1) preference = ["recon", "infantry"];
    else preference = ["tank", "mech", "infantry"];
    if (owned.length >= 24) continue;
    const unitType = preference.find((type) => UNITS[type].cost <= p.funds);
    if (unitType) return { type: "build", unitType, x: tile.x, y: tile.y };
  }
  for (const tile of state.tiles.filter((t) => ["airport", "port"].includes(t.type) &&
    t.owner === seat && !unitAt(state, t.x, t.y))) {
    const owned = state.units.filter((u) => u.owner === seat);
    const enemyAir = enemies.some((u) => UNITS[u.type].domain === "air");
    const preference = tile.type === "airport" ?
      (enemyAir ? ["interceptor", "attack_heli", "transport_heli", "drone"] :
        ["attack_heli", "drone", "bomber", "interceptor", "transport_heli", "stealth"]) :
      (ISLAND_MAPS.has(state.mapId) ?
        (!owned.some((u) => u.type === "lander") ? ["lander"] :
          owned.filter((u) => u.type === "cruiser").length < 2 ? ["cruiser"] :
            !owned.some((u) => u.type === "submarine") ? ["submarine"] :
              !owned.some((u) => u.type === "repair_boat") ? ["repair_boat"] :
                ["battleship", "carrier"]) :
        ["cruiser", "submarine", "lander", "repair_boat", "battleship", "carrier"]);
    if (owned.length >= 24) continue;
    const unitType = preference.find((type) => UNITS[type].cost <= p.funds);
    if (unitType) return { type: "build", unitType, x: tile.x, y: tile.y };
  }
  return { type: "endTurn" };
}
function distanceField(state, unit, goals) {
  const def = UNITS[unit.type],
    distances = new Map(),
    queue = [];
  for (const goal of goals) {
    const key = positionKey(goal.x, goal.y);
    if (distances.has(key)) continue;
    distances.set(key, 0);
    queue.push({ x: goal.x, y: goal.y, cost: 0 });
  }
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cell = queue.shift();
    if (distances.get(positionKey(cell.x, cell.y)) !== cell.cost) continue;
    const cost =
      TERRAINS[tileAt(state, cell.x, cell.y).type].costs[def.movement];
    if (cost == null) continue;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const x = cell.x + dx,
        y = cell.y + dy,
        t = tileAt(state, x, y);
      if (!t || TERRAINS[t.type].costs[def.movement] == null) continue;
      const nextCost = cell.cost + cost,
        key = positionKey(x, y);
      if (distances.has(key) && distances.get(key) <= nextCost) continue;
      distances.set(key, nextCost);
      queue.push({ x, y, cost: nextCost });
    }
  }
  return distances;
}
/** Strict structural validation for persisted games, never repairs corrupted data. */
export function validateState(state) {
  requireRule(state && state.version === 1, "存档版本不兼容");
  const map = MAPS.find((m) => m.id === state.mapId);
  requireRule(
    map && state.width === map.width && state.height === map.height,
    "存档地图尺寸无效",
  );
  requireRule(
    Array.isArray(state.players) &&
      state.players.length >= 2 &&
      state.players.length <= 4,
    "存档玩家数量无效",
  );
  const seats = new Set();
  for (const p of state.players) {
    requireRule(
      Number.isInteger(p.id) && p.id >= 0 && p.id < 4 && !seats.has(p.id),
      "存档玩家编号无效",
    );
    seats.add(p.id);
    requireRule(
      typeof p.name === "string" &&
        p.name.length <= 100 &&
        Object.hasOwn(COMMANDERS, p.commander) &&
        ["human", "ai"].includes(p.controller),
      "存档玩家信息无效",
    );
    requireRule(
      Number.isInteger(p.team) && p.team >= 0 && p.team < 4,
      "存档队伍无效",
    );
    requireRule(
      Number.isFinite(p.funds) &&
        p.funds >= 0 &&
        p.funds <= 1000000000 &&
        Number.isInteger(p.energy) &&
        p.energy >= 0 &&
        p.energy <= 100,
      "存档资源无效",
    );
    requireRule(
      typeof p.defeated === "boolean" &&
        [null, "power", "super"].includes(p.power),
      "存档玩家状态无效",
    );
  }
  requireRule(
    Array.isArray(state.tiles) &&
      state.tiles.length === state.width * state.height,
    "存档地形数据缺失",
  );
  state.tiles.forEach((t, i) => {
    requireRule(
      t &&
        t.x === i % state.width &&
        t.y === Math.floor(i / state.width) &&
        Object.hasOwn(TERRAINS, t.type),
      "存档地形坐标无效",
    );
    requireRule(
      t.owner === null ||
        (seats.has(t.owner) &&
          property(t) &&
          !playerOf(state, t.owner).defeated),
      "存档建筑归属无效",
    );
    requireRule(
      Number.isInteger(t.capture) &&
        t.capture >= 1 &&
        t.capture <= 20 &&
        (t.captureBy === null || seats.has(t.captureBy)) &&
        (t.capture === 20
          ? t.captureBy === null
          : property(t) &&
            t.captureBy !== null &&
            !allied(state, t.owner, t.captureBy)),
      "存档占领状态无效",
    );
  });
  requireRule(
    Array.isArray(state.units) && state.units.length <= state.tiles.length,
    "存档单位列表无效",
  );
  const ids = new Set(),
    occupied = new Set();
  let maxId = 0;
  for (const u of state.units) {
    const def = UNITS[u.type];
    requireRule(
      typeof u.id === "string" &&
        /^u[1-9]\d*$/.test(u.id) &&
        !ids.has(u.id) &&
        Object.hasOwn(UNITS, u.type) &&
        seats.has(u.owner) &&
        !playerOf(state, u.owner).defeated,
      "存档单位身份无效",
    );
    ids.add(u.id);
    maxId = Math.max(maxId, Number(u.id.slice(1)));
    const tile = tileAt(state, u.x, u.y),
      key = positionKey(u.x, u.y);
    requireRule(
      tile &&
        TERRAINS[tile.type].costs[def.movement] != null &&
        !occupied.has(key),
      "存档单位位置无效",
    );
    occupied.add(key);
    requireRule(
      Number.isInteger(u.hp) &&
        u.hp >= 1 &&
        u.hp <= 10 &&
        Number.isInteger(u.fuel) &&
        u.fuel >= 0 &&
        u.fuel <= def.maxFuel,
      "存档单位生命或燃料无效",
    );
    requireRule(
      def.maxAmmo === null
        ? u.ammo === null
        : Number.isInteger(u.ammo) && u.ammo >= 0 && u.ammo <= def.maxAmmo,
      "存档单位弹药无效",
    );
    requireRule(typeof u.acted === "boolean" &&
      (u.type === "submarine" ? u.submerged === undefined || typeof u.submerged === "boolean" :
        u.submerged === undefined), "存档单位行动状态无效");
    if (def.transport) {
      requireRule(Array.isArray(u.cargo) && u.cargo.length <= def.transport,
        "存档运输单位载员无效");
      for (const passenger of u.cargo) {
        const passengerDef = UNITS[passenger?.type];
        requireRule(passengerDef &&
          typeof passenger.id === "string" && /^u[1-9]\d*$/.test(passenger.id) &&
          !ids.has(passenger.id) && seats.has(passenger.owner) &&
          !playerOf(state, passenger.owner).defeated &&
          allied(state, u.owner, passenger.owner) &&
          canCarry({ ...u, cargo: [] }, passenger) &&
          Number.isInteger(passenger.hp) && passenger.hp >= 1 && passenger.hp <= 10 &&
          Number.isInteger(passenger.fuel) && passenger.fuel >= 0 && passenger.fuel <= passengerDef.maxFuel &&
          (passengerDef.maxAmmo === null ? passenger.ammo === null :
            Number.isInteger(passenger.ammo) && passenger.ammo >= 0 && passenger.ammo <= passengerDef.maxAmmo) &&
          passenger.acted === true && passenger.cargo == null,
          "存档运输单位载员无效");
        ids.add(passenger.id);
        maxId = Math.max(maxId, Number(passenger.id.slice(1)));
      }
    } else requireRule(u.cargo == null, "存档单位行动状态无效");
  }
  for (const t of state.tiles)
    if (t.capture < 20) {
      const u = unitAt(state, t.x, t.y);
      requireRule(
        u && UNITS[u.type].capture && u.owner === t.captureBy,
        "存档占领单位缺失",
      );
    }
  requireRule(
    Number.isInteger(state.nextUnitId) &&
      state.nextUnitId > maxId &&
      Number.isSafeInteger(state.nextUnitId),
    "存档单位序号无效",
  );
  requireRule(
    ["playing", "finished"].includes(state.phase) &&
      seats.has(state.currentPlayer),
    "存档回合状态无效",
  );
  requireRule(
    Number.isSafeInteger(state.day) &&
      state.day >= 1 &&
      Number.isSafeInteger(state.turn) &&
      state.turn >= 1,
    "存档回合计数无效",
  );
  requireRule(
    Array.isArray(state.log) &&
      state.log.length <= 100 &&
      state.log.every((s) => typeof s === "string" && s.length <= 1000),
    "存档日志无效",
  );
  if (state.phase === "playing")
    requireRule(
      !playerOf(state, state.currentPlayer).defeated &&
        state.winner === null &&
        new Set(state.players.filter((p) => !p.defeated).map((p) => p.team))
          .size > 1,
      "存档当前行动方或胜负状态无效",
    );
  else
    requireRule(
      state.winner === null ||
        (Number.isInteger(state.winner) &&
          state.players.some((p) => p.team === state.winner && !p.defeated)),
      "存档胜利队伍无效",
    );
  return true;
}
