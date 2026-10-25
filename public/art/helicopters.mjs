// Original 40×40 helicopter artwork used by the game.
// palette is the game's four team colors, from light armor to deep shadow.
const INK = '#23383b';
const STEEL = '#6d8179';
const LIGHT_STEEL = '#b4c0aa';
const GLASS = '#315861';
const GLINT = '#a9c8b8';

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function face(ctx, points, color) {
  const ys = points.map(point => point[1]);
  for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= row + .5 && b[1] > row + .5) ||
          (b[1] <= row + .5 && a[1] > row + .5)) {
        hits.push(a[0] + (row + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const start = Math.ceil(hits[i] - .5);
      box(ctx, start, row, Math.ceil(hits[i + 1] - .5) - start, 1, color);
    }
  }
}

function rotor(ctx, mastX, y, left, right) {
  // A single uninterrupted hub and blade reads as a rotor rather than a roof rail.
  box(ctx, left, y + 1, right - left, 2, INK);
  box(ctx, left + 2, y, mastX - left - 4, 1, LIGHT_STEEL);
  box(ctx, mastX + 3, y, right - mastX - 5, 1, LIGHT_STEEL);
  box(ctx, mastX - 2, y, 5, 3, INK);
  box(ctx, mastX - 1, y, 3, 1, STEEL);
  box(ctx, mastX, y + 3, 2, 5, INK);
  box(ctx, mastX + 1, y + 3, 1, 4, LIGHT_STEEL);
}

function tailRotor(ctx, x, y) {
  box(ctx, x, y, 1, 7, INK);
  box(ctx, x - 2, y + 3, 5, 1, LIGHT_STEEL);
  box(ctx, x, y + 2, 2, 3, INK);
}

/** A narrow gunship: pointed canopy, chin gun and armed stub wings. */
export function paintAttackHelicopter(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // A small detached ground shadow keeps the helicopter visibly airborne.
  f([[11,33],[27,33],[31,35],[12,35]], 'rgba(25,49,45,.38)');

  // Thin tail boom and upright tail plane, behind the narrow crew fuselage.
  f([[3,17],[15,17],[19,19],[16,22],[5,21]], INK);
  f([[5,18],[15,18],[17,19],[14,20],[5,20]], p[1]);
  f([[4,15],[6,11],[8,12],[8,20],[5,21]], INK);
  f([[5,15],[6,13],[7,14],[7,19],[5,19]], p[0]);
  tailRotor(ctx, 3, 13);

  // Far wing and pod stay behind the cockpit; a second pod sits visibly lower.
  f([[17,20],[24,18],[30,20],[29,23],[19,24]], INK);
  f([[18,20],[24,19],[28,20],[27,22],[19,23]], p[2]);
  box(ctx, 24, 22, 7, 3, INK);
  box(ctx, 25, 22, 5, 1, STEEL);
  box(ctx, 29, 23, 2, 1, '#d5c895');

  // Angular tandem cockpit occupies the nose instead of the troop compartment.
  f([[13,15],[21,12],[29,15],[36,21],[36,24],[31,27],[18,26],[12,22]], INK);
  f([[14,16],[21,13],[28,16],[34,21],[29,23],[14,20]], p[0]);
  f([[13,20],[29,23],[34,22],[31,26],[18,25],[13,22]], p[1]);
  f([[22,15],[29,16],[34,21],[29,21],[24,19]], GLASS);
  f([[23,16],[28,16],[31,19],[27,18]], GLINT);
  f([[30,20],[34,21],[33,22],[30,22]], '#233f47');
  f([[15,16],[21,14],[22,16],[17,18]], p[1]);
  box(ctx, 20, 17, 2, 3, p[3]);
  f([[31,23],[36,22],[37,24],[33,26]], p[2]);

  // The short weapon wing and twin rockets make the ground-attack role legible.
  f([[17,21],[25,21],[27,25],[17,26]], INK);
  f([[18,22],[24,22],[25,24],[18,24]], p[0]);
  box(ctx, 18, 25, 5, 3, INK);
  box(ctx, 19, 25, 3, 1, LIGHT_STEEL);
  box(ctx, 24, 25, 6, 3, INK);
  box(ctx, 25, 25, 4, 1, LIGHT_STEEL);
  box(ctx, 28, 26, 2, 1, '#e2cf9e');
  // Chin cannon sits directly beneath the pointed cockpit.
  box(ctx, 32, 26, 2, 2, INK);
  box(ctx, 33, 27, 5, 2, INK);
  box(ctx, 35, 27, 3, 1, STEEL);
  box(ctx, 37, 28, 1, 1, '#142d31');

  // Slender skid gear is purposefully lighter than the transport's wheeled gear.
  box(ctx, 17, 27, 1, 4, INK);
  box(ctx, 30, 27, 1, 4, INK);
  box(ctx, 14, 31, 20, 2, INK);
  box(ctx, 16, 31, 16, 1, STEEL);
  rotor(ctx, 20, 5, 4, 36);
}

/** A broad troop carrier: tall cabin, open side door, boarding step and wheels. */
export function paintTransportHelicopter(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  f([[9,34],[31,34],[34,36],[10,36]], 'rgba(25,49,45,.38)');

  // Tail is stronger and longer than the gunship's to support the cargo cabin.
  f([[2,17],[13,17],[18,20],[16,24],[4,22]], INK);
  f([[4,18],[13,18],[16,20],[13,22],[4,21]], p[1]);
  f([[4,16],[5,13],[8,12],[8,19],[5,20]], INK);
  f([[5,16],[6,14],[7,14],[7,18],[5,19]], p[0]);
  tailRotor(ctx, 3, 13);

  // A boxy, deep cabin gives a visibly different overall shape from the gunship.
  f([[11,13],[28,12],[34,15],[38,21],[37,27],[32,30],[12,29],[9,24]], INK);
  f([[12,14],[27,13],[33,16],[36,20],[30,22],[11,20]], p[0]);
  f([[10,20],[30,22],[33,27],[31,29],[12,27],[10,25]], p[1]);
  f([[30,22],[36,20],[37,26],[32,29]], p[2]);
  f([[13,14],[26,13],[29,15],[16,16]], p[1]);
  box(ctx, 13, 16, 1, 10, p[2]);

  // Tall side opening, visible bench/occupants and extended boarding step.
  // This is a troop hatch rather than a collection of vehicle windows.
  f([[16,17],[25,17],[27,20],[27,27],[16,27]], INK);
  f([[17,18],[24,18],[25,20],[25,26],[17,26]], '#2c4545');
  box(ctx, 18, 19, 2, 2, '#cfb38b');
  box(ctx, 22, 19, 2, 2, '#cfb38b');
  box(ctx, 18, 21, 2, 4, '#526659');
  box(ctx, 22, 21, 2, 4, '#526659');
  box(ctx, 17, 25, 8, 1, STEEL);
  box(ctx, 16, 27, 12, 2, INK);
  box(ctx, 17, 27, 10, 1, LIGHT_STEEL);
  box(ctx, 15, 18, 1, 9, p[3]);

  // Small forward cockpit; the troop doorway remains the dominant detail.
  f([[29,16],[33,16],[37,21],[34,22],[29,21]], GLASS);
  f([[30,17],[33,17],[35,20],[30,20]], GLINT);
  box(ctx, 34, 22, 2, 2, '#e6d09f');
  box(ctx, 32, 24, 3, 1, p[0]);

  // Two broad gear struts and wheels emphasize loaded transport weight.
  box(ctx, 14, 29, 2, 3, INK);
  box(ctx, 30, 29, 2, 3, INK);
  box(ctx, 12, 31, 6, 4, INK);
  box(ctx, 13, 32, 4, 2, STEEL);
  box(ctx, 29, 31, 6, 4, INK);
  box(ctx, 30, 32, 4, 2, STEEL);
  rotor(ctx, 21, 5, 2, 38);
}
