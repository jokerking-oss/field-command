import test from "node:test";
import assert from "node:assert/strict";
import { MAPS, TERRAINS, UNITS } from "../public/shared/engine.mjs";
import {
  mapsForPlayerCount,
  moveCommandAction,
  specialCommands,
  unitsForFacility,
} from "../public/shared/ui-options.mjs";

const players = [
  { id: 0, team: 0 }, { id: 1, team: 0 }, { id: 2, team: 2 },
];
const makeState = (units, terrain = "plain") => ({
  width: 5, height: 5, players, units,
  tiles: Array.from({ length: 25 }, (_, index) => ({
    x: index % 5, y: Math.floor(index / 5), type: terrain,
  })),
});

test("map picker keeps classic maps and filters the 44 atlas maps by seats and search", () => {
  assert.equal(mapsForPlayerCount(MAPS, 2).length, 33);
  assert.equal(mapsForPlayerCount(MAPS, 3).length, 12);
  assert.equal(mapsForPlayerCount(MAPS, 4).length, 8);
  assert.deepEqual(mapsForPlayerCount(MAPS, 4, "荒海").map((map) => map.id), ["atlas-44"]);
  assert.deepEqual(mapsForPlayerCount(MAPS, 2, "荒海"), []);
});

test("production menus offer only units supported by the selected building", () => {
  assert.deepEqual(["factory", "airport", "port"].map((type) =>
    unitsForFacility(UNITS, type).length), [13, 6, 6]);
  for (const type of ["factory", "airport", "port"])
    assert.ok(unitsForFacility(UNITS, type).every(([, unit]) => unit.production === type));
});

test("special commands identify allied targets and make server-compatible actions", () => {
  const heli = { id: "u1", type: "transport_heli", owner: 0, x: 2, y: 2, cargo: [] };
  const infantry = { id: "u2", type: "infantry", owner: 1, x: 3, y: 2 };
  const enemy = { id: "u3", type: "infantry", owner: 2, x: 2, y: 3 };
  let state = makeState([heli, infantry, enemy]);
  assert.deepEqual(specialCommands(state, heli, heli, UNITS, TERRAINS)
    .filter((choice) => choice.command === "load").map((choice) => choice.targetId), ["u2"]);
  assert.deepEqual(moveCommandAction("u1", { x: 2, y: 2 }, "load", { targetId: "u2" }),
    { type: "move", unitId: "u1", x: 2, y: 2, command: "load", targetId: "u2" });

  heli.cargo = [infantry];
  state = makeState([heli, enemy]);
  const unload = specialCommands(state, heli, heli, UNITS, TERRAINS)
    .find((choice) => choice.command === "unload" && choice.targetX === 3 && choice.targetY === 2);
  assert.ok(unload);
  assert.deepEqual(moveCommandAction("u1", heli, "unload", unload),
    { type: "move", unitId: "u1", x: 2, y: 2,
      command: "unload", targetX: 3, targetY: 2 });

  const sub = { id: "u4", type: "submarine", owner: 0, x: 1, y: 1, submerged: false };
  assert.equal(specialCommands(makeState([sub]), sub, sub, UNITS, TERRAINS)[0].command,
    "submerge");
  sub.submerged = true;
  assert.equal(specialCommands(makeState([sub]), sub, sub, UNITS, TERRAINS)[0].command,
    "surface");

  const boat = { id: "u5", type: "repair_boat", owner: 0, x: 1, y: 1 };
  const ship = { id: "u6", type: "cruiser", owner: 1, x: 2, y: 1,
    hp: 8, fuel: 20, ammo: 2 };
  assert.deepEqual(specialCommands(makeState([boat, ship]), boat, boat, UNITS, TERRAINS)
    .map((choice) => choice.targetId), ["u6"]);
  assert.deepEqual(moveCommandAction("u5", boat, "repair", { targetId: "u6" }),
    { type: "move", unitId: "u5", x: 1, y: 1, command: "repair", targetId: "u6" });
});
