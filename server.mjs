import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { networkInterfaces } from "node:os";
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  COMMANDERS,
  MAPS,
  createGame,
  applyAction,
  chooseAIAction,
  validateState,
} from "./public/shared/engine.mjs";
import { createSaveStore } from "./save-store.mjs";
import { actionAnimationDuration } from "./public/shared/animation-timing.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const PUBLIC = resolve(ROOT, "public");
const ROOM_LIMIT = 128;
const BODY_LIMIT = 64 * 1024;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const fail = (status, message) => {
  throw new HttpError(status, message);
};
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const newToken = () => randomBytes(32).toString("hex");
const knownCommander = (value) => Object.hasOwn(COMMANDERS, value);
const knownMap = (value) => MAPS.some((map) => map.id === value);
const mapSupportsPlayers = (mapId, playerCount) =>
  MAPS.some((map) => map.id === mapId && map.players.includes(playerCount));

function nameOf(value, fallback = "指挥官") {
  if (value !== undefined && typeof value !== "string")
    fail(400, "请输入有效的指挥官名称");
  return (
    [...(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim()]
      .slice(0, 20)
      .join("") || fallback
  );
}
function commanderOf(value = "vanguard") {
  if (typeof value !== "string" || !knownCommander(value))
    fail(400, "未知的指挥官");
  return value;
}
function mapOf(value = "river", playerCount) {
  if (typeof value !== "string" || !knownMap(value)) fail(400, "未知的战场");
  if (playerCount !== undefined && !mapSupportsPlayers(value, playerCount))
    fail(400, "该地图不支持此玩家人数");
  return value;
}
function modeOf(value = "ffa") {
  if (!["ffa", "teams"].includes(value)) fail(400, "未知的对战模式");
  return value;
}

function validateRooms(rooms) {
  if (!Array.isArray(rooms) || rooms.length > ROOM_LIMIT)
    throw new Error("房间列表无效");
  const ids = new Set();
  for (const room of rooms) {
    if (!isObject(room) || !/^[A-Z0-9]{6}$/.test(room.id) || ids.has(room.id))
      throw new Error("房间编号无效");
    ids.add(room.id);
    if (
      room.hostSeat !== 0 ||
      ![2, 3, 4].includes(room.playerCount) ||
      !["lobby", "playing", "finished"].includes(room.phase)
    )
      throw new Error("房间配置无效");
    if (!knownMap(room.mapId) || !["ffa", "teams"].includes(room.mode))
      throw new Error("房间战场配置无效");
    if (!mapSupportsPlayers(room.mapId, room.playerCount))
      throw new Error("房间战场不支持当前玩家人数");
    if (
      !Number.isSafeInteger(room.revision) ||
      room.revision < 1 ||
      typeof room.updatedAt !== "string"
    )
      throw new Error("房间版本无效");
    if (!Array.isArray(room.seats) || room.seats.length !== room.playerCount)
      throw new Error("玩家席位无效");
    const tokens = new Set();
    room.seats.forEach((seat, index) => {
      if (
        !isObject(seat) ||
        seat.id !== index ||
        !["human", "ai", "open"].includes(seat.controller)
      )
        throw new Error("玩家席位配置无效");
      if (
        typeof seat.name !== "string" ||
        seat.name.length > 80 ||
        !knownCommander(seat.commander)
      )
        throw new Error("玩家资料无效");
      if (seat.controller === "human") {
        if (!/^[a-f0-9]{64}$/.test(seat.token) || tokens.has(seat.token))
          throw new Error("玩家重连凭证无效");
        tokens.add(seat.token);
      } else if (seat.token !== undefined)
        throw new Error("电脑席位不能保存重连凭证");
    });
    if (room.seats[0].controller !== "human") throw new Error("房主席位无效");
    if (room.phase === "lobby") {
      if (room.state !== null) throw new Error("大厅不能包含进行中的战局");
    } else {
      if (validateState(room.state) === false) throw new Error("战局存档无效");
      if (
        room.state.phase !== room.phase ||
        room.state.mapId !== room.mapId ||
        room.state.players.length !== room.playerCount
      )
        throw new Error("战局与房间不匹配");
      room.state.players.forEach((player, index) => {
        const seat = room.seats[index];
        if (
          player.id !== seat.id ||
          player.controller !== seat.controller ||
          seat.controller === "open" ||
          player.commander !== seat.commander ||
          player.team !== (room.mode === "teams" ? index % 2 : index)
        )
          throw new Error("战局席位与房间不匹配");
      });
    }
  }
  return true;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
/** 去掉 IPv6 字面量的方括号并统一小写。 */
function bareHost(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "");
}
/** 从 Host / X-Forwarded-Host 取出不带端口的主机名；兼容逗号分隔的代理链。 */
function hostnameOf(value) {
  const first = String(value ?? "").split(",")[0].trim();
  if (!first) return "";
  try {
    return bareHost(new URL(`http://${first}`).hostname);
  } catch {
    return "";
  }
}
/**
 * 主机名是否属于「本机 / 内网」。
 * 2026-10-02：公网部署后 Host 是公网域名，此时不能再把房间列表和内网地址发出去。
 */
/** 接受 https://host 或裸 host 两种写法。 */
function originHostOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    return bareHost(new URL(raw).hostname);
  } catch {
    return hostnameOf(raw);
  }
}
/**
 * 反向代理部署时可用 ALLOWED_ORIGINS=host1,host2 显式声明本服务的公网主机名。
 * 不设置时依赖浏览器自带的 Sec-Fetch-Site（见请求处理里的来源校验）。
 */
const EXTRA_ORIGIN_HOSTS = new Set(
  String(process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((item) => originHostOf(item))
    .filter(Boolean),
);

function isLocalHostname(hostname) {
  const host = bareHost(hostname);
  if (!host) return true;
  if (LOOPBACK_HOSTS.has(host)) return true;
  if (/^127\./.test(host)) return true;
  if (/^10\./.test(host)) return true;
  if (/^192\.168\./.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return true;
  if (host.endsWith(".local") || host.endsWith(".localhost")) return true;
  return false;
}

async function readBody(req) {
  if (
    !(req.headers["content-type"] ?? "")
      .toLowerCase()
      .startsWith("application/json")
  )
    fail(415, "请求必须使用 JSON 格式");
  if (Number(req.headers["content-length"]) > BODY_LIMIT)
    fail(413, "请求内容过大");
  const buffers = [];
  let size = 0;
  for await (const buffer of req) {
    size += buffer.length;
    if (size > BODY_LIMIT) fail(413, "请求内容过大");
    buffers.push(buffer);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(buffers).toString("utf8"));
  } catch {
    fail(400, "无法读取请求 JSON");
  }
  if (!isObject(body)) fail(400, "请求内容必须是 JSON 对象");
  return body;
}

/** Starts a LAN server; pass port:0 for tests. close() drains saves and SSE clients. */
export async function createServer({
  port = 4173,
  host = "0.0.0.0",
  dataDir = resolve(ROOT, "data"),
  aiDelay = 500,
  aiAnimationPacing = true,
} = {}) {
  const rooms = new Map();
  const connections = new Map();
  const aiTimers = new Map();
  const aiSteps = new Map();
  let closing = false;
  let mutationQueue = Promise.resolve();
  /* 公网限流：只在内网以外的部署上生效，不影响本地/局域网对局与测试。 */
  const rateHits = new Map();
  const RATE_RULES = {
    create: { limit: 12, windowMs: 60 * 60 * 1000 },
    join: { limit: 30, windowMs: 60 * 1000 },
  };
  function clientAddress(req) {
    const forwarded = String(req.headers["x-forwarded-for"] ?? "")
      .split(",")[0]
      .trim();
    return forwarded || req.socket.remoteAddress || "unknown";
  }
  function rateLimit(req, kind, publicMode) {
    if (!publicMode) return;
    const rule = RATE_RULES[kind];
    if (!rule) return;
    const now = Date.now();
    const key = `${kind}:${clientAddress(req)}`;
    const hits = (rateHits.get(key) ?? []).filter(
      (at) => now - at < rule.windowMs,
    );
    if (hits.length >= rule.limit) fail(429, "操作过于频繁，请稍后再试");
    hits.push(now);
    rateHits.set(key, hits);
    if (rateHits.size > 4000)
      for (const [existing, times] of rateHits)
        if (!times.some((at) => now - at < 60_000)) rateHits.delete(existing);
  }
  const store = await createSaveStore({
    dataDir,
    validate: validateRooms,
    onRecovery: ({ slot }) => console.warn(`已从备份恢复 ${slot} 存档。`),
  });
  const restored = await store.load();
  for (const room of restored?.rooms ?? []) rooms.set(room.id, room);

  function publicRoom(room) {
    return {
      id: room.id,
      hostSeat: room.hostSeat,
      phase: room.phase,
      seats: room.seats.map(({ id, name, controller, commander }) => ({
        id,
        name,
        controller,
        commander,
        connected:
          controller === "ai" ||
          (connections.get(room.id)?.get(id)?.size ?? 0) > 0,
      })),
      mapId: room.mapId,
      mode: room.mode,
      playerCount: room.playerCount,
      state: room.state,
      revision: room.revision,
      updatedAt: room.updatedAt,
    };
  }
  function broadcast(room) {
    const message = `event: room\nid: ${room.revision}\ndata: ${JSON.stringify(publicRoom(room))}\n\n`;
    for (const clients of connections.get(room.id)?.values() ?? []) {
      for (const client of clients)
        if (!client.destroyed && !client.writableEnded) client.write(message);
    }
  }
  function authenticate(room, token) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token))
      fail(403, "重连凭证无效，请使用原来的浏览器加入");
    const supplied = Buffer.from(token, "hex");
    const seat = room.seats.find(
      (candidate) =>
        candidate.controller === "human" &&
        timingSafeEqual(Buffer.from(candidate.token, "hex"), supplied),
    );
    if (!seat) fail(403, "你没有这个房间的操作权限");
    return seat;
  }
  function hostOnly(room, seat) {
    if (room.hostSeat !== seat.id) fail(403, "只有房主可以执行此操作");
  }
  function lobbyOnly(room) {
    if (room.phase !== "lobby") fail(409, "对局已经开始，无法更改大厅配置");
  }
  function findRoom(id) {
    const room = rooms.get(id.toUpperCase());
    if (!room) fail(404, "没有找到这个房间");
    return room;
  }
  function mutate(fn) {
    const operation = mutationQueue.then(() => {
      if (closing) fail(503, "服务正在关闭");
      return fn();
    });
    mutationQueue = operation.catch(() => {});
    return operation;
  }
  async function commit(room, { isNew = false, nextAiDelay = aiDelay } = {}) {
    if (!isNew) room.revision += 1;
    room.updatedAt = new Date().toISOString();
    const snapshot = [...rooms.values()].map((current) =>
      current.id === room.id ? room : current,
    );
    if (isNew) snapshot.push(room);
    // Publish only after durable save; readers never observe a rolled-back action.
    await store.save(snapshot);
    rooms.set(room.id, room);
    broadcast(room);
    scheduleAI(room, nextAiDelay);
    return publicRoom(room);
  }
  function scheduleAI(room, delay = aiDelay) {
    clearTimeout(aiTimers.get(room.id));
    aiTimers.delete(room.id);
    if (
      closing ||
      room.phase !== "playing" ||
      room.seats[room.state.currentPlayer]?.controller !== "ai"
    )
      return;
    const timer = setTimeout(() => {
      aiTimers.delete(room.id);
      mutate(async () => {
        const current = rooms.get(room.id);
        if (
          !current ||
          current.phase !== "playing" ||
          current.seats[current.state.currentPlayer]?.controller !== "ai"
        )
          return;
        const seat = current.state.currentPlayer;
        let steps = aiSteps.get(current.id);
        if (!steps || steps.turn !== current.state.turn)
          steps = { turn: current.state.turn, count: 0 };
        steps.count += 1;
        aiSteps.set(current.id, steps);
        const next = structuredClone(current);
        let action;
        try {
          action =
            steps.count > 80
              ? { type: "endTurn" }
              : chooseAIAction(next.state, seat);
          next.state = applyAction(next.state, seat, action);
        } catch (error) {
          console.warn(`电脑指挥失效，结束当前回合：${error.message}`);
          next.state = applyAction(next.state, seat, { type: "endTurn" });
        }
        next.phase = next.state.phase;
        const animation = aiAnimationPacing && action
          ? actionAnimationDuration(current.state, next.state, action)
          : 0;
        await commit(next, { nextAiDelay: Math.max(aiDelay, animation + 150) });
      }).catch((error) => console.error(`电脑回合未能保存：${error.message}`));
    }, delay);
    timer.unref();
    aiTimers.set(room.id, timer);
  }
  function lanUrls(boundPort) {
    const urls = new Set([`http://localhost:${boundPort}`]);
    for (const interfaces of Object.values(networkInterfaces())) {
      for (const network of interfaces ?? []) {
        if (network.family === "IPv4" && !network.internal)
          urls.add(`http://${network.address}:${boundPort}`);
      }
    }
    return [...urls];
  }
  function json(res, status, value) {
    res.writeHead(status, {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(JSON.stringify(value));
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
      /* 2026-10-02 公网部署：Host 决定「内网 / 公网」两种模式。
         反向代理常会改写 Host（端口甚至域名），所以：
         ① 额外接受 X-Forwarded-Host；
         ② Origin 只比主机名、不比端口 —— 否则隧道后面会整片 403。 */
      const requestHost = hostnameOf(req.headers.host);
      const forwardedHost = hostnameOf(req.headers["x-forwarded-host"]);
      const publicMode =
        process.env.PUBLIC_MODE === "1" ||
        (process.env.PUBLIC_MODE !== "0" &&
          !isLocalHostname(forwardedHost || requestHost));
      if (url.pathname.startsWith("/api/")) {
        /**
         * 来源校验（2026-10-02 改为代理兼容版）。
         * 反向代理会在终止 TLS 之后改写 Host，服务看不到自己的公网域名，
         * 所以「Origin 必须等于 Host」这种写法会让整站接口在代理后面全部 403。
         * 现在的顺序：
         *   ① Origin 能对上 Host / X-Forwarded-Host / ALLOWED_ORIGINS —— 放行；
         *   ② 对不上时，只有浏览器自带的同源戳（Sec-Fetch-Site: same-origin）才放行。
         * Sec-Fetch-* 由浏览器生成、脚本无法改写，跨站页面发来的请求是 cross-site，
         * 因此这层防护依然拦得住 CSRF；而本服务的写操作要么是建房、要么必须带上
         * 只有房内浏览器才知道的 64 位重连凭证，本身没有 Cookie 会话可被盗用。
         */
        if (req.headers.origin) {
          let origin;
          try {
            origin = new URL(req.headers.origin);
          } catch {
            fail(403, "请求来源无效");
          }
          if (!["http:", "https:"].includes(origin.protocol))
            fail(403, "请从本游戏页面发起请求");
          const originHost = bareHost(origin.hostname);
          const allowed = new Set(
            [requestHost, forwardedHost, ...EXTRA_ORIGIN_HOSTS].filter(Boolean),
          );
          if (
            !allowed.has(originHost) &&
            req.headers["sec-fetch-site"] !== "same-origin"
          )
            fail(403, "请从本游戏页面发起请求");
        }
        if (url.pathname === "/api/rooms") {
          if (req.method === "GET") {
            /* 公网模式下不公开房间列表与内网地址：知道房间码才能加入。 */
            json(res, 200, {
              publicMode,
              rooms: publicMode
                ? []
                : [...rooms.values()].map((room) => ({
                    id: room.id,
                    mapId: room.mapId,
                    phase: room.phase,
                    playerCount: room.playerCount,
                    humanCount: room.seats.filter(
                      (seat) => seat.controller === "human",
                    ).length,
                    hostName: room.seats[0].name,
                  })),
              urls: publicMode ? [] : lanUrls(server.address().port),
            });
            return;
          }
          if (req.method === "POST") {
            rateLimit(req, "create", publicMode);
            const body = await readBody(req);
            const result = await mutate(async () => {
              if (rooms.size >= ROOM_LIMIT)
                fail(409, "房间数量已达上限，请重启前清理旧存档");
              const playerCount = body.playerCount ?? 2;
              if (![2, 3, 4].includes(playerCount))
                fail(400, "支持 2 至 4 名玩家");
              let id;
              do {
                id = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
              } while (rooms.has(id));
              const token = newToken();
              const room = {
                id,
                hostSeat: 0,
                phase: "lobby",
                mapId: mapOf(body.mapId, playerCount),
                mode: modeOf(body.mode),
                playerCount,
                state: null,
                revision: 1,
                updatedAt: "",
                seats: Array.from({ length: playerCount }, (_, seat) =>
                  seat === 0
                    ? {
                        id: 0,
                        name: nameOf(body.name),
                        controller: "human",
                        commander: commanderOf(body.commander),
                        token,
                      }
                    : {
                        id: seat,
                        name: `电脑 ${seat + 1}`,
                        controller: "ai",
                        commander: seat % 2 ? "mechanic" : "vanguard",
                      },
                ),
              };
              return {
                room: await commit(room, { isNew: true }),
                token,
                seat: 0,
              };
            });
            json(res, 201, result);
            return;
          }
          fail(405, "不支持的请求方法");
        }

        const matched = url.pathname.match(
          /^\/api\/rooms\/([A-Za-z0-9]{6})(?:\/(join|configure|seat|start|action|save|rematch|events))?$/,
        );
        if (!matched) fail(404, "没有找到这个接口");
        const [, id, operation] = matched;
        let room = findRoom(id);
        if (req.method === "GET" && !operation) {
          const seat = authenticate(room, url.searchParams.get("token"));
          json(res, 200, { room: publicRoom(room), seat: seat.id });
          return;
        }
        if (req.method === "GET" && operation === "events") {
          const seat = authenticate(room, url.searchParams.get("token"));
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            "X-Content-Type-Options": "nosniff",
          });
          res.flushHeaders();
          res.write("retry: 1500\n\n");
          if (!connections.has(room.id)) connections.set(room.id, new Map());
          const roomConnections = connections.get(room.id);
          if (!roomConnections.has(seat.id))
            roomConnections.set(seat.id, new Set());
          const clients = roomConnections.get(seat.id);
          clients.add(res);
          broadcast(room);
          const keepalive = setInterval(() => {
            if (!res.destroyed) res.write(": heartbeat\n\n");
          }, 20_000);
          keepalive.unref();
          res.on("close", () => {
            clearInterval(keepalive);
            clients.delete(res);
            if (!clients.size) roomConnections.delete(seat.id);
            if (!roomConnections.size) connections.delete(room.id);
            const current = rooms.get(room.id);
            if (current && !closing) broadcast(current);
          });
          return;
        }
        if (req.method !== "POST" || !operation || operation === "events")
          fail(405, "不支持的请求方法");
        const body = await readBody(req);
        const result = await mutate(async () => {
          room = findRoom(id);
          const next = structuredClone(room);
          if (operation === "join") {
            rateLimit(req, "join", publicMode);
            lobbyOnly(room);
            const openSeat =
              next.seats.find((seat) => seat.controller === "open") ??
              next.seats.find((seat) => seat.controller === "ai");
            if (!openSeat) fail(409, "房间已满");
            const token = newToken();
            Object.assign(openSeat, {
              controller: "human",
              name: nameOf(body.name),
              commander: commanderOf(body.commander),
              token,
            });
            return { room: await commit(next), token, seat: openSeat.id };
          }
          const seat = authenticate(room, body.token);
          if (operation === "configure") {
            hostOnly(room, seat);
            lobbyOnly(room);
            if (body.mapId !== undefined)
              next.mapId = mapOf(body.mapId, next.playerCount);
            if (body.mode !== undefined) next.mode = modeOf(body.mode);
            if (body.slots !== undefined) {
              if (
                !Array.isArray(body.slots) ||
                body.slots.length > next.playerCount
              )
                fail(400, "席位配置无效");
              const changed = new Set();
              for (const setting of body.slots) {
                if (
                  !isObject(setting) ||
                  !Number.isInteger(setting.seat) ||
                  !next.seats[setting.seat] ||
                  !["open", "ai"].includes(setting.controller) ||
                  changed.has(setting.seat)
                )
                  fail(400, "席位配置无效");
                changed.add(setting.seat);
                const target = next.seats[setting.seat];
                if (target.controller === "human")
                  fail(409, "不能移除已加入的玩家");
                target.controller = setting.controller;
                target.name =
                  setting.controller === "ai"
                    ? `电脑 ${target.id + 1}`
                    : "等待加入";
              }
            }
            return { room: await commit(next) };
          }
          if (operation === "seat") {
            lobbyOnly(room);
            if (body.name !== undefined)
              next.seats[seat.id].name = nameOf(body.name);
            if (body.commander !== undefined)
              next.seats[seat.id].commander = commanderOf(body.commander);
            return { room: await commit(next) };
          }
          if (operation === "start") {
            hostOnly(room, seat);
            lobbyOnly(room);
            if (next.seats.some((candidate) => candidate.controller === "open"))
              fail(409, "还有空位，请等待玩家加入或将空位设为电脑");
            next.state = createGame({
              mapId: next.mapId,
              players: next.seats.map((candidate) => ({
                id: candidate.id,
                name: candidate.name,
                team: next.mode === "teams" ? candidate.id % 2 : candidate.id,
                commander: candidate.commander,
                controller: candidate.controller,
              })),
            });
            next.phase = next.state.phase;
            return { room: await commit(next) };
          }
          if (operation === "action") {
            if (room.phase !== "playing") fail(409, "当前没有进行中的对局");
            if (room.state.currentPlayer !== seat.id)
              fail(403, "还没有轮到你行动");
            if (body.revision !== undefined && body.revision !== room.revision)
              fail(409, "战局已更新，请等待同步后重试");
            if (!isObject(body.action)) fail(400, "缺少有效的行动指令");
            try {
              next.state = applyAction(room.state, seat.id, body.action);
            } catch (error) {
              fail(400, error.message);
            }
            next.phase = next.state.phase;
            return { room: await commit(next) };
          }
          if (operation === "save") {
            await store.save([room], `manual-${room.id}`);
            return { ok: true };
          }
          if (operation === "rematch") {
            hostOnly(room, seat);
            if (room.phase === "playing")
              fail(409, "请先结束当前对局，再返回大厅");
            if (room.phase === "lobby") fail(409, "已经在大厅中");
            next.state = null;
            next.phase = "lobby";
            return { room: await commit(next) };
          }
          fail(404, "没有找到这个接口");
        });
        json(res, 200, result);
        return;
      }

      if (!["GET", "HEAD"].includes(req.method)) fail(405, "不支持的请求方法");
      let pathname;
      try {
        pathname = decodeURIComponent(url.pathname);
      } catch {
        fail(400, "地址格式无效");
      }
      if (
        pathname.split("/").some((segment) => segment.startsWith(".")) ||
        pathname.includes("\0") ||
        pathname.includes("\\")
      )
        fail(404, "没有找到这个文件");
      const path = resolve(
        PUBLIC,
        `.${pathname === "/" ? "/index.html" : pathname}`,
      );
      if (!path.startsWith(`${PUBLIC}${sep}`)) fail(404, "没有找到这个文件");
      let info;
      try {
        info = await stat(path);
      } catch {
        fail(404, "没有找到这个文件");
      }
      if (!info.isFile()) fail(404, "没有找到这个文件");
      const data = req.method === "HEAD" ? null : await readFile(path);
      res.writeHead(200, {
        "Content-Type": MIME[extname(path)] ?? "application/octet-stream",
        "Content-Length": info.size,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(data);
    } catch (error) {
      if (res.headersSent) {
        res.end();
        return;
      }
      if (!error.status) console.error(`服务请求失败：${error.message}`);
      json(res, error.status ?? 500, {
        error: error.status
          ? error.message
          : "服务器暂时无法保存或处理操作，请稍后重试",
      });
    }
  });
  server.requestTimeout = 15_000;
  server.headersTimeout = 10_000;
  await new Promise((resolveListening, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolveListening();
    });
  });
  for (const room of rooms.values()) scheduleAI(room);
  const boundPort = server.address().port;
  const urls = lanUrls(boundPort);
  return {
    server,
    rooms,
    urls,
    url: `http://127.0.0.1:${boundPort}`,
    async close() {
      if (closing) return;
      closing = true;
      for (const timer of aiTimers.values()) clearTimeout(timer);
      aiTimers.clear();
      for (const roomConnections of connections.values())
        for (const clients of roomConnections.values())
          for (const client of clients) client.end();
      await mutationQueue;
      await store.flush();
      await new Promise((resolveClosed, reject) =>
        server.close((error) => (error ? reject(error) : resolveClosed())),
      );
    },
  };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  createServer({
    port: Number(process.env.PORT || 4173),
    host: process.env.HOST || "0.0.0.0",
    dataDir: process.env.DATA_DIR || resolve(ROOT, "data"),
  })
    .then((app) => {
      console.log("\n前线指令 · 局域网战术终端\n");
      console.log(
        app.urls
          .map((url, index) => `${index ? "局域网" : "本机"}：${url}`)
          .join("\n"),
      );
      console.log(
        `\n已恢复 ${app.rooms.size} 个房间。保持此终端运行，其他玩家即可通过局域网地址加入。\n`,
      );
      for (const signal of ["SIGINT", "SIGTERM"])
        process.once(signal, () => {
          app
            .close()
            .then(() => process.exit(0))
            .catch((error) => {
              console.error(error.message);
              process.exit(1);
            });
        });
    })
    .catch((error) => {
      console.error(
        error.code === "EADDRINUSE"
          ? "端口已被占用。请关闭旧服务，或使用 PORT=其他端口 npm start。"
          : `启动失败：${error.message}`,
      );
      process.exitCode = 1;
    });
}
