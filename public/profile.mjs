/**
 * 个人档案与战绩 —— 全部存在本机浏览器（localStorage）。
 *
 * 为什么不做服务端账号：这游戏是「局域网自建服务器」形态，公网部署后如果档案存在
 * 服务端，所有访客的记录会堆在同一个 data/*.json 里（既串数据也涉隐私）。存在本机
 * 则零后端改动、不传任何个人信息出去、断网也能看。代价是换浏览器会丢档案，
 * 这在当前取舍下可以接受。
 */

const PROFILE_KEY = "field-command-profile";
const RECORDS_KEY = "field-command-records";
const MAX_RECORDS = 200;

export const AVATAR_COUNT = 12;

/** 像素徽章配色：底 / 主 / 亮，向 hw-ui 的冷灰蓝 + 军械黄体系靠拢。 */
const PALETTES = [
  ["#3C4450", "#E8B44A", "#F5DFA0"],
  ["#33475A", "#7FC8E8", "#D6F0FA"],
  ["#4A3B34", "#E08A5A", "#F7D3B8"],
  ["#2F4A3E", "#6FC99A", "#CFF0E0"],
  ["#4A3A4E", "#C08AD8", "#EDD6F7"],
  ["#5A3A3A", "#E8705F", "#F8C9BF"],
  ["#3B4A52", "#9FB4C4", "#E4EDF3"],
  ["#4C4433", "#D8C05A", "#F4E9AE"],
  ["#2E3E4C", "#5E9BD8", "#C3DDF5"],
  ["#453A2E", "#C99A62", "#EFD8B8"],
  ["#31424A", "#58C2C0", "#C6EFEE"],
  ["#42384C", "#9A86E0", "#DCD3F7"],
];

function read(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* 无痕模式可能禁用存储 */
  }
}

function newId() {
  const raw =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
  return raw.replace(/-/g, "").slice(0, 16);
}

/** 8×8 左右镜像的像素图案，同一个 index 永远画同一张。 */
function patternFor(index) {
  const seed = (index + 1) * 2654435761;
  const cells = [];
  for (let y = 0; y < 8; y++) {
    const row = [];
    for (let x = 0; x < 4; x++) {
      const n = (seed >>> (y * 3 + x)) ^ (seed * (x + 2) + y * 7919);
      row.push((n >>> (x + 1)) & 1);
    }
    cells.push([...row, ...[...row].reverse()]);
  }
  // 保底：至少要像个人样，别出现全空或全满
  const filled = cells.flat().filter(Boolean).length;
  if (filled < 12 || filled > 52) {
    cells[2] = [0, 1, 1, 0, 0, 1, 1, 0];
    cells[3] = [0, 1, 0, 0, 0, 0, 1, 0];
    cells[4] = [0, 0, 1, 0, 0, 1, 0, 0];
    cells[5] = [0, 1, 1, 0, 0, 1, 1, 0];
  }
  return cells;
}

/** 返回一个可直接塞进 innerHTML 的 SVG 字符串。 */
export function avatarSvg(index, pixelSize = 4, options = {}) {
  const id = ((Number(index) || 0) % AVATAR_COUNT + AVATAR_COUNT) % AVATAR_COUNT;
  const [base, mid, light] = PALETTES[id];
  const cells = patternFor(id);
  const size = pixelSize * 8 + pixelSize * 2;
  const pad = pixelSize;
  const rects = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if (!cells[y][x]) continue;
      const onEdge = x === 0 || y === 0 || x === 7 || y === 7;
      const color = onEdge ? mid : light;
      rects.push(
        `<rect x="${pad + x * pixelSize}" y="${pad + y * pixelSize}" width="${pixelSize}" height="${pixelSize}" fill="${color}"/>`,
      );
    }
  }
  const cls = options.className ? ` class="${options.className}"` : "";
  return `<svg${cls} viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="个人徽章 ${id + 1}"><rect width="${size}" height="${size}" fill="${base}"/>${rects.join("")}</svg>`;
}

export function loadProfile() {
  const stored = read(PROFILE_KEY, null);
  if (stored && typeof stored === "object" && stored.id) {
    return { avatar: 0, callsign: "", createdAt: "", ...stored };
  }
  const created = {
    id: newId(),
    avatar: Math.floor(Math.random() * AVATAR_COUNT),
    callsign: "",
    createdAt: new Date().toISOString(),
  };
  write(PROFILE_KEY, created);
  return created;
}

export function saveProfile(patch) {
  const next = { ...loadProfile(), ...patch };
  write(PROFILE_KEY, next);
  return next;
}

export function hasProfile() {
  const stored = read(PROFILE_KEY, null);
  return Boolean(stored && stored.id);
}

export function loadRecords() {
  const records = read(RECORDS_KEY, []);
  return Array.isArray(records) ? records : [];
}

/** 同一局只记一次（key 用 房间号:回合数）。返回是否写入了新记录。 */
export function recordMatch(entry) {
  const records = loadRecords();
  if (entry?.key && records.some((r) => r.key === entry.key)) return false;
  records.unshift({ at: new Date().toISOString(), ...entry });
  write(RECORDS_KEY, records.slice(0, MAX_RECORDS));
  return true;
}

export function clearRecords() {
  write(RECORDS_KEY, []);
}

export function statsFor(records = loadRecords()) {
  const total = records.length;
  const wins = records.filter((r) => r.won).length;
  const loses = total - wins;
  const days = records.map((r) => Number(r.day) || 0);
  const byMap = new Map();
  for (const r of records) {
    const name = r.mapName || r.mapId || "未知战场";
    byMap.set(name, (byMap.get(name) || 0) + 1);
  }
  let streak = 0;
  for (const r of records) {
    if (r.won) streak++;
    else break;
  }
  return {
    total,
    wins,
    loses,
    winRate: total ? Math.round((wins / total) * 100) : 0,
    bestDay: days.length ? Math.max(...days) : 0,
    favoriteMap: [...byMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || "—",
    streak,
  };
}
