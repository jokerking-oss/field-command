/** Choices shared by the room picker and the in-battle menus. */
export function mapsForPlayerCount(maps, playerCount, query = "") {
  const needle = String(query).trim().toLocaleLowerCase();
  return maps.filter((map) =>
    map.players.includes(playerCount) &&
    (!needle || [map.name, map.category, map.description, map.hook, map.id]
      .some((value) => String(value || "").toLocaleLowerCase().includes(needle))));
}

export function unitsForFacility(units, facilityType) {
  return Object.entries(units).filter(([, unit]) =>
    (unit.production || "factory") === facilityType);
}

const distance = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function allied(state, first, second) {
  const firstTeam = state.players.find((player) => player.id === first)?.team;
  const secondTeam = state.players.find((player) => player.id === second)?.team;
  return firstTeam !== undefined && firstTeam === secondTeam;
}

export function specialCommands(state, unit, position, units, terrains) {
  const choices = [];
  if (unit.type === "submarine") {
    choices.push(unit.submerged
      ? { command: "surface", label: "上浮", description: "潜艇浮出水面。" }
      : { command: "submerge", label: "下潜", description: "潜艇下潜，避开普通水面火力。" });
  }

  if (unit.type === "repair_boat") {
    for (const target of state.units) {
      const definition = units[target.type];
      if (!allied(state, target.owner, unit.owner) || definition?.domain !== "sea" ||
          distance(position, target) !== 1) continue;
      if (target.hp >= 10 && target.fuel >= definition.maxFuel &&
          (definition.maxAmmo == null || target.ammo >= definition.maxAmmo)) continue;
      choices.push({ command: "repair", targetId: target.id,
        label: `维修 ${definition.name}`, description: `维修相邻的${definition.name}并补满弹药和燃料。` });
    }
  }

  const transport = units[unit.type];
  const capacity = transport?.transport || 0;
  if (!capacity) return choices;
  const cargo = Array.isArray(unit.cargo) ? unit.cargo : [];
  if (cargo.length < capacity) {
    for (const target of state.units) {
      if (target.id === unit.id || !allied(state, target.owner, unit.owner) ||
          distance(position, target) !== 1) continue;
      const allowed = transport.passengers === "land"
        ? units[target.type]?.domain === "land"
        : transport.passengers.includes(target.type);
      if (!allowed) continue;
      choices.push({ command: "load", targetId: target.id,
        label: `装载 ${units[target.type].name}`,
        description: `把相邻的${units[target.type].name}装入${units[unit.type].name}。` });
    }
  }
  if (!cargo.length) return choices;
  const passenger = cargo[0];
  const movement = units[passenger.type]?.movement;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const x = position.x + dx, y = position.y + dy;
    if (x < 0 || y < 0 || x >= state.width || y >= state.height ||
        state.units.some((other) => other.x === x && other.y === y)) continue;
    const tile = state.tiles[y * state.width + x];
    if (terrains[tile.type]?.costs[movement] == null) continue;
    choices.push({ command: "unload", targetX: x, targetY: y,
      label: `卸载至 ${x + 1}:${y + 1}`,
      description: `把${units[passenger.type].name}卸到 ${x + 1}:${y + 1}。` });
  }
  return choices;
}

export function moveCommandAction(unitId, position, command, extras = {}) {
  return {
    type: "move", unitId, x: position.x, y: position.y, command,
    ...(["attack", "repair", "load"].includes(command)
      ? { targetId: extras.targetId } : {}),
    ...(command === "unload"
      ? { targetX: Number(extras.targetX), targetY: Number(extras.targetY) } : {}),
  };
}
