import { reachable } from "./engine.mjs";

export const MOVE_STEP_MS = 240;
export const MOVE_TURN_MS = 90;
export const COMBAT_TIMING = Object.freeze({
  firstFire: 390,
  firstHit: 760,
  counterFire: 1510,
  counterHit: 1880,
  endWithoutCounter: 1650,
  endWithCounter: 2700,
});

export function combatDuration(counter) {
  return counter > 0 ? COMBAT_TIMING.endWithCounter : COMBAT_TIMING.endWithoutCounter;
}

export function captureDuration(completed) {
  return completed ? 3400 : 3100;
}

export function movementDuration(path, startFacing = "right") {
  if (!path?.length || path.length === 1) return 0;
  let duration = 0, previous = startFacing;
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i], to = path[i + 1];
    const direction = to.x > from.x ? "right" : to.x < from.x ? "left"
      : to.y > from.y ? "down" : "up";
    if (direction !== previous) duration += MOVE_TURN_MS;
    duration += MOVE_STEP_MS;
    previous = direction;
  }
  return duration;
}

// The server schedules the next AI command against the same timeline that
// clients use for movement, combat, supply, and capture playback.
export function actionAnimationDuration(before, after, action) {
  if (action.type !== "move") return 0;
  const unit = before.units.find((item) => item.id === action.unitId);
  if (!unit) return 0;
  const path = reachable(before, unit.id).find(
    (cell) => cell.x === action.x && cell.y === action.y,
  )?.path;
  const travel = movementDuration(path);
  if (action.command === "attack") {
    const survivor = after.units.find((item) => item.id === unit.id);
    // A drone is consumed by its own strike; that loss is not a counterattack.
    const counterDamage = unit.type === "drone" ? 0 : unit.hp - (survivor?.hp ?? 0);
    return travel + combatDuration(counterDamage);
  }
  if (action.command === "capture") {
    const prior = before.tiles.find((tile) => tile.x === action.x && tile.y === action.y);
    const current = after.tiles.find((tile) => tile.x === action.x && tile.y === action.y);
    return travel + captureDuration(current?.owner === unit.owner && prior?.owner !== unit.owner);
  }
  if (unit.type === "apc" && ["supply", "wait"].includes(action.command))
    return travel + 1050;
  if (["submerge", "surface", "repair", "load", "unload"].includes(action.command))
    return travel + 1050;
  return travel;
}
