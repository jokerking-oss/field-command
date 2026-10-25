import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  EXPANSION_MAPS,
  expansionTiles,
  expansionSpawns,
} from "../public/shared/map-data.mjs";

const SIDES = ["red", "blue", "green", "yellow"];
const TERRAIN_TYPES = new Set([
  "plain", "road", "forest", "mountain", "water", "shoal", "bridge",
  "city", "factory", "hq", "port", "airport",
]);
const PROPERTY_TYPES = new Set(["city", "factory", "hq", "port", "airport"]);
const LAND_START_TYPES = new Set([
  "plain", "road", "forest", "bridge", "city", "factory", "hq",
]);

test("the shipped atlas contains 44 distinct maps with their intended seat counts", () => {
  assert.equal(EXPANSION_MAPS.length, 44);
  assert.equal(new Set(EXPANSION_MAPS.map((map) => map.id)).size, 44);
  assert.deepEqual(
    [2, 3, 4].map((count) => EXPANSION_MAPS.filter((map) => map.playerCount === count).length),
    [30, 9, 5],
  );
  assert.ok(EXPANSION_MAPS.every((map) =>
    map.players.length === 1 && map.players[0] === map.playerCount));
  assert.equal(expansionTiles("missing-map"), null);
  assert.equal(expansionSpawns("missing-map"), null);
});

test("every atlas layout decodes exactly and has usable opening positions", () => {
  for (const map of EXPANSION_MAPS) {
    const tiles = expansionTiles(map.id);
    const starts = expansionSpawns(map.id);
    assert.equal(tiles.length, map.width * map.height, map.id);
    assert.equal(starts.length, map.playerCount, map.id);
    assert.deepEqual(starts.map((start) => start.seat),
      Array.from({ length: map.playerCount }, (_, seat) => seat), map.id);

    const atlasTiles = tiles.map(({ x, y, type, owner }, index) => {
      assert.equal(x, index % map.width, map.id);
      assert.equal(y, Math.floor(index / map.width), map.id);
      assert.ok(TERRAIN_TYPES.has(type), `${map.id}: ${type}`);
      assert.ok(owner === null || (Number.isInteger(owner) &&
        owner >= 0 && owner < map.playerCount && PROPERTY_TYPES.has(type)), map.id);
      assert.equal(tiles[index].capture, 20, map.id);
      assert.equal(tiles[index].captureBy, null, map.id);
      return { x, y, type, ...(owner === null ? {} : { owner: SIDES[owner] }) };
    });
    const actualHash = createHash("sha256")
      .update(JSON.stringify(atlasTiles)).digest("hex").slice(0, 16);
    assert.equal(actualHash, map.sourceHash, `${map.id}: atlas source changed`);

    assert.equal(tiles.filter((tile) => tile.type === "hq").length,
      map.playerCount, map.id);
    for (const { seat, x, y } of starts) {
      assert.equal(tiles[y * map.width + x].type, "hq", map.id);
      assert.equal(tiles[y * map.width + x].owner, seat, map.id);
      assert.ok(tiles.some((tile) => tile.type === "factory" && tile.owner === seat),
        `${map.id}: seat ${seat} has no factory`);
      const nearbyLand = tiles.filter((tile) =>
        Math.abs(tile.x - x) + Math.abs(tile.y - y) <= 3 &&
        LAND_START_TYPES.has(tile.type));
      assert.ok(nearbyLand.length >= 4,
        `${map.id}: seat ${seat} has too few opening cells`);
    }
  }
});

test("each game receives independent tile and spawn objects", () => {
  const first = expansionTiles("atlas-01");
  const originalType = first[0].type;
  first[0].type = "water";
  first[0].owner = 1;
  const second = expansionTiles("atlas-01");
  assert.equal(second[0].type, originalType);
  assert.equal(second[0].owner, null);
  const starts = expansionSpawns("atlas-01");
  starts[0].x = -1;
  assert.equal(expansionSpawns("atlas-01")[0].x, 2);
});
