// Original landing craft, drawn directly at the game's native 40 × 40 size.
// palette: the game's [light, body, shade, deep] colors for either army.
const INK = '#23383b';
const STEEL = '#647976';
const DECK = '#485e5c';
const RAMP = '#b8c1aa';
const CARGO = '#d9c899';

function box(ctx, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function face(ctx, points, color) {
  const ys = points.map((point) => point[1]);
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
      const left = Math.ceil(hits[i] - .5);
      const right = Math.ceil(hits[i + 1] - .5);
      box(ctx, left, row, right - left, 1, color);
    }
  }
}

/** A broad, open cargo well with a small loaded vehicle and a lowered bow ramp. */
export function paintLandingShip(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // Broken wake, outside the square, shallow-draft hull.
  box(ctx, 1, 29, 5, 1, '#9ccfd1');
  box(ctx, 0, 31, 4, 1, '#78b9bf');
  box(ctx, 8, 32, 5, 1, '#9ccfd1');
  box(ctx, 34, 30, 3, 1, '#78b9bf');

  // The unpointed rectangular hull and near broadside differ from a cruiser.
  f([[2,21],[7,17],[29,16],[35,19],[37,23],[35,28],
     [30,31],[7,31],[2,28]], INK);
  f([[3,21],[8,18],[29,17],[34,20],[34,26],[29,29],
     [7,29],[3,27]], p[1]);
  f([[3,27],[7,29],[29,29],[35,26],[35,29],[30,32],
     [7,32],[3,29]], p[2]);
  box(ctx, 6, 30, 23, 1, p[3]);
  box(ctx, 7, 31, 21, 1, p[1]);

  // A real drive-through well: dark open floor, three conspicuous high walls.
  f([[7,20],[11,18],[28,18],[33,21],[31,25],[9,27],[6,25]], INK);
  f([[9,21],[12,19],[27,19],[31,21],[30,24],[9,25]], DECK);
  // Far railing and stern bulkhead frame the dark cargo well.
  f([[7,18],[11,16],[29,16],[34,19],[32,21],[28,18],[11,19],[7,22]], INK);
  f([[8,18],[12,17],[28,17],[32,19],[30,20],[27,18],[12,18],[8,20]], p[0]);
  box(ctx, 8, 20, 2, 6, p[3]);
  box(ctx, 9, 20, 1, 5, p[0]);
  // A small loaded armored car shows transport capacity even at 1× scale.
  // Its sandy neutral paint also separates cargo from the army-colored hull.
  box(ctx, 15, 21, 13, 4, INK);
  box(ctx, 16, 20, 9, 4, CARGO);
  box(ctx, 18, 18, 5, 3, INK);
  box(ctx, 19, 19, 4, 2, '#f0dda9');
  box(ctx, 23, 20, 4, 2, '#a39f7d');
  box(ctx, 16, 22, 11, 1, '#f0dda9');
  box(ctx, 17, 24, 3, 2, INK);
  box(ctx, 24, 24, 3, 2, INK);
  box(ctx, 18, 24, 1, 1, STEEL);
  box(ctx, 25, 24, 1, 1, STEEL);

  // The near wall overlaps the vehicle's wheels, placing it inside the well.
  // This team-colored broadside is deliberately uninterrupted by a gun.
  f([[7,25],[30,24],[33,22],[34,26],[30,29],[7,29],[5,27]], INK);
  f([[7,26],[29,25],[32,23],[32,26],[29,28],[7,28]], p[1]);
  box(ctx, 9, 26, 18, 1, p[0]);
  box(ctx, 10, 28, 16, 1, p[2]);

  // Open bow: two side posts, with the folded-down gate reaching the water.
  box(ctx, 31, 20, 3, 4, INK);
  box(ctx, 32, 20, 2, 3, p[0]);
  f([[32,23],[35,22],[39,28],[39,31],[36,30]], INK);
  f([[33,23],[35,23],[38,28],[38,30],[36,29]], RAMP);
  box(ctx, 35, 25, 1, 4, '#e5ddba');
  box(ctx, 37, 28, 1, 2, '#71857c');
  box(ctx, 33, 26, 2, 1, p[3]);
}
