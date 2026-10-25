import test from "node:test";
import assert from "node:assert/strict";
import { BASE_DAMAGE, UNIT_IDS } from "../public/shared/combat-data.mjs";
import { expansionTiles } from "../public/shared/map-data.mjs";
import { UNITS, TERRAINS, MAPS, createGame, reachable, attackable,
  previewCombat, applyAction, chooseAIAction, validateState } from "../public/shared/engine.mjs";

const players = (count = 2) => Array.from({ length: count }, (_, id) => ({
  id, team: id, commander: id % 2 ? "mechanic" : "vanguard", controller: "ai",
}));
function fixture() {
  const state = createGame({ mapId: "training", players: players() });
  for (const tile of state.tiles)
    Object.assign(tile, { type: "plain", owner: null, capture: 20, captureBy: null });
  state.units = [];
  state.nextUnitId = 1;
  Object.assign(state.tiles[0], { type: "factory", owner: 0 });
  Object.assign(state.tiles[1], { type: "factory", owner: 1 });
  for (const player of state.players) player.funds = 100000;
  return state;
}
const tileAt = (state, x, y) => state.tiles[y * state.width + x];
function add(state, type, owner, x, y, extra = {}) {
  const def = UNITS[type];
  const unit = { id: `u${state.nextUnitId++}`, type, owner, x, y, hp: 10,
    ammo: def.maxAmmo, fuel: def.maxFuel, acted: false,
    cargo: def.transport ? [] : null,
    ...(type === "submarine" ? { submerged: false } : {}), ...extra };
  state.units.push(unit);
  return unit;
}
const move = (unit, command = "wait", extra = {}) => ({
  type: "move", unitId: unit.id, x: unit.x, y: unit.y, command, ...extra,
});

test("all 25 units have complete production and movement rules, and 625 attack pairs follow the combat matrix", () => {
  assert.equal(UNIT_IDS.length, 25);
  assert.deepEqual(Object.keys(UNITS), UNIT_IDS);
  const state = fixture();
  for (const attackerType of UNIT_IDS) {
    const def = UNITS[attackerType];
    assert.ok(Number.isInteger(def.cost) && def.cost > 0);
    assert.ok(Number.isInteger(def.move) && def.move > 0);
    assert.ok(Number.isInteger(def.maxFuel) && def.maxFuel > 0);
    assert.ok(["factory", "airport", "port"].includes(def.production));
    assert.ok(["land", "air", "sea"].includes(def.domain));
    assert.equal(def.domain === "land" ? "factory" : def.domain === "air" ? "airport" : "port",
      def.production);
    for (const defenderType of UNIT_IDS) {
      const distance = Math.max(1, def.minRange);
      state.units = [
        { ...addUnit(attackerType, 0, 3, 3) },
        { ...addUnit(defenderType, 1, 3 + distance, 3) },
      ];
      const [attacker, defender] = state.units;
      const legal = attackable(state, attacker.id).includes(defender.id);
      assert.equal(legal, BASE_DAMAGE[attackerType][defenderType] !== null,
        `${attackerType} -> ${defenderType}`);
      const preview = previewCombat(state, attacker.id, defender.id);
      assert.equal(preview.damage > 0, legal, `${attackerType} -> ${defenderType}`);
    }
  }
});

function addUnit(type, owner, x, y) {
  const def = UNITS[type];
  return { id: owner ? "u2" : "u1", type, owner, x, y, hp: 10,
    ammo: def.maxAmmo, fuel: def.maxFuel, acted: false, cargo: null };
}

test("all 44 atlas starts preserve their map layouts and create valid armies", () => {
  const maps = MAPS.filter((map) => map.id.startsWith("atlas-"));
  assert.equal(maps.length, 44);
  for (const map of maps) {
    const state = createGame({ mapId: map.id, players: players(map.players[0]) });
    assert.deepEqual(state.tiles, expansionTiles(map.id), map.id);
    assert.equal(state.units.length, map.players[0] * 4, map.id);
    assert.equal(validateState(state), true, map.id);
    for (const player of state.players)
      assert.equal(state.tiles.filter((tile) => tile.type === "hq" && tile.owner === player.id).length, 1);
  }
});

test("factory, airport and port production each create only their own domain", () => {
  for (const [type, site] of [["aa", "factory"], ["interceptor", "airport"],
    ["lander", "port"]]) {
    const state = fixture();
    Object.assign(tileAt(state, 3, 3), { type: site, owner: 0 });
    const built = applyAction(state, 0, { type: "build", unitType: type, x: 3, y: 3 });
    assert.equal(built.units[0].type, type);
    assert.equal(validateState(built), true);
    const wrong = site === "factory" ? "airport" : "factory";
    tileAt(state, 3, 3).type = wrong;
    assert.throws(() => applyAction(state, 0, { type: "build", unitType: type, x: 3, y: 3 }), /只能在/);
  }
});

test("aircraft cross all terrain, ships cross water and shallows, land units stay on legal ground", () => {
  const state = fixture();
  const aircraft = add(state, "attack_heli", 0, 2, 2);
  const ship = add(state, "cruiser", 0, 7, 7);
  const tank = add(state, "tank", 0, 10, 7);
  tileAt(state, 7, 7).type = "port";
  tileAt(state, 8, 7).type = "water";
  tileAt(state, 9, 7).type = "shoal";
  tileAt(state, 10, 8).type = "water";
  tileAt(state, 2, 3).type = "mountain";
  tileAt(state, 3, 2).type = "water";
  assert.ok(reachable(state, aircraft.id).some((cell) => cell.x === 3 && cell.y === 2));
  assert.ok(reachable(state, aircraft.id).some((cell) => cell.x === 2 && cell.y === 3));
  assert.ok(reachable(state, ship.id).some((cell) => cell.x === 9 && cell.y === 7));
  assert.ok(!reachable(state, ship.id).some((cell) => cell.x === 7 && cell.y === 6));
  assert.ok(!reachable(state, tank.id).some((cell) => cell.x === 10 && cell.y === 8));
  assert.equal(TERRAINS.port.income, 1000);
  assert.equal(TERRAINS.airport.income, 1000);
});

test("submergence blocks ordinary weapons, and a drone is removed after its single strike", () => {
  let state = fixture();
  const sub = add(state, "submarine", 0, 3, 3);
  const cruiser = add(state, "cruiser", 1, 4, 3);
  const battleship = add(state, "battleship", 1, 5, 3);
  for (let x = 3; x <= 5; x++) tileAt(state, x, 3).type = "water";
  state = applyAction(state, 0, move(sub, "submerge"));
  assert.equal(state.units.find((unit) => unit.id === sub.id).submerged, true);
  assert.ok(attackable(state, cruiser.id).includes(sub.id));
  assert.ok(!attackable(state, battleship.id).includes(sub.id));
  assert.equal(validateState(state), true);

  state = fixture();
  const drone = add(state, "drone", 0, 3, 3);
  const heavy = add(state, "heavy", 1, 4, 3);
  const preview = previewCombat(state, drone.id, heavy.id);
  assert.ok(preview.damage > 0);
  assert.equal(preview.counter, 0);
  state = applyAction(state, 0, move(drone, "attack", { targetId: heavy.id }));
  assert.ok(!state.units.some((unit) => unit.id === drone.id));
  assert.equal(validateState(state), true);
});

test("a lander carries a live unit across water, unloads it, and a repair boat restores a ship", () => {
  let state = fixture();
  const lander = add(state, "lander", 0, 2, 3);
  const infantry = add(state, "infantry", 0, 2, 2);
  tileAt(state, 2, 3).type = "port";
  tileAt(state, 3, 3).type = "water";
  state = applyAction(state, 0, move(lander, "load", { targetId: infantry.id }));
  assert.equal(state.units.some((unit) => unit.id === infantry.id), false);
  assert.equal(state.units.find((unit) => unit.id === lander.id).cargo[0].id, infantry.id);
  assert.equal(validateState(state), true);
  state.units.find((unit) => unit.id === lander.id).acted = false;
  state = applyAction(state, 0, move(lander, "unload", { x: 3, y: 3, targetX: 4, targetY: 3 }));
  assert.equal(state.units.find((unit) => unit.id === infantry.id).x, 4);
  assert.equal(state.units.find((unit) => unit.id === infantry.id).acted, true);
  assert.equal(validateState(state), true);

  const repairBoat = add(state, "repair_boat", 0, 7, 7);
  const damaged = add(state, "cruiser", 0, 8, 7, { hp: 5, ammo: 1, fuel: 2 });
  tileAt(state, 7, 7).type = "water";
  tileAt(state, 8, 7).type = "water";
  state = applyAction(state, 0, move(repairBoat, "repair", { targetId: damaged.id }));
  const repaired = state.units.find((unit) => unit.id === damaged.id);
  assert.deepEqual([repaired.hp, repaired.ammo, repaired.fuel], [7, 6, 80]);
  assert.equal(validateState(state), true);
});

test("all island AIs ferry units across water using valid load and unload actions", () => {
  for (const mapId of ["atlas-19", "atlas-21", "atlas-23", "atlas-25", "atlas-27",
    "atlas-28", "atlas-31", "atlas-33", "atlas-39"]) {
    const map = MAPS.find((item) => item.id === mapId);
    let state = createGame({ mapId, players: players(map.players[0]) });
    const first = chooseAIAction(state, 0);
    assert.equal(first.type, "build", mapId);
    assert.equal(first.unitType, "lander", mapId);
    const commands = new Set();
    for (let i = 0; i < 320 && state.day <= 12 && state.phase === "playing"; i++) {
      const seat = state.currentPlayer;
      const action = chooseAIAction(state, seat);
      commands.add(action.command);
      state = applyAction(state, seat, action);
      assert.equal(validateState(state), true, `${mapId}: ${JSON.stringify(action)}`);
    }
    assert.ok(commands.has("load"), `${mapId}: AI did not load a passenger`);
    assert.ok(commands.has("unload"), `${mapId}: AI did not land a passenger`);
  }
});
