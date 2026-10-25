// Original 40×40 rail artillery artwork used by the game.
// The four-color team palette must be passed from renderer.mjs (TEAM_PALETTES).
const INK = '#23383b';
const STEEL = '#4d6461';
const RIM = '#9ea997';
const COIL = '#8bcfc2';

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

/** Draw one rail-mounted gun in native map pixels, facing upper-right. */
export function paintRailUnit(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // Separate guide shoes and square rail clamps: no tank tread or truck wheels.
  for (const [x, y] of [[5, 25], [12, 26], [25, 27], [32, 26]]) {
    box(ctx, x, y, 5, 6, INK);
    box(ctx, x + 1, y + 1, 3, 2, RIM);
    box(ctx, x + 1, y + 4, 3, 1, STEEL);
    box(ctx, x, y + 5, 2, 2, INK);
    box(ctx, x + 3, y + 5, 2, 2, INK);
  }

  // Long, level rail carriage with a squared front rather than a tank nose.
  f([[3, 21], [7, 19], [33, 19], [37, 22], [37, 27], [33, 29], [5, 29], [2, 26]], INK);
  f([[5, 21], [9, 20], [32, 20], [35, 22], [5, 23]], p[0]);
  f([[4, 23], [35, 23], [35, 27], [5, 27]], p[1]);
  f([[5, 27], [35, 27], [33, 29], [5, 29]], p[2]);
  f([[35, 22], [37, 23], [37, 27], [35, 28]], p[3]);
  box(ctx, 7, 24, 24, 1, p[0]);
  for (const x of [8, 14, 30]) box(ctx, x, 26, 3, 1, RIM);
  box(ctx, 34, 24, 2, 1, '#f1d7a4');

  // Foreground U-brackets remain readable above the game's health label.
  // Their feet wrap below the raised twin rail rather than turning into wheels.
  for (const x of [6, 30]) {
    box(ctx, x, 24, 1, 7, INK);
    box(ctx, x + 4, 24, 1, 7, INK);
    box(ctx, x, 30, 5, 1, INK);
    box(ctx, x + 1, 25, 3, 1, RIM);
    box(ctx, x + 1, 28, 3, 1, p[3]);
  }

  // A long, double-rail emitter: parallel beams, cyan gap, three coil collars.
  // Kept narrow at map scale to avoid the large wedge of an ordinary cannon.
  f([[15, 12], [36, 5], [39, 5], [39, 7], [18, 15], [15, 14]], INK);
  f([[16, 12], [36, 6], [38, 6], [18, 13]], RIM);
  f([[16, 16], [36, 9], [39, 9], [39, 11], [18, 18], [16, 18]], INK);
  f([[17, 16], [36, 10], [38, 10], [18, 17]], STEEL);
  f([[20, 14], [35, 9], [37, 9], [22, 15]], COIL);
  for (const [x, y] of [[23, 10], [28, 8], [33, 7]]) {
    box(ctx, x, y, 2, 7, INK);
    box(ctx, x, y + 1, 1, 4, p[0]);
    box(ctx, x + 2, y + 3, 1, 2, COIL);
  }
  box(ctx, 37, 4, 3, 8, INK);
  box(ctx, 38, 5, 1, 6, RIM);
  box(ctx, 39, 7, 1, 2, '#173034');

  // Fixed breech, power housing and a small sight. This has no rotating turret.
  f([[9, 15], [15, 11], [23, 14], [27, 18], [25, 23], [9, 22], [7, 18]], INK);
  f([[10, 15], [15, 12], [21, 14], [23, 17], [9, 17]], p[0]);
  f([[9, 18], [23, 18], [25, 21], [10, 21]], p[1]);
  f([[23, 15], [27, 18], [25, 22], [22, 19]], p[3]);
  box(ctx, 11, 15, 3, 2, INK);
  box(ctx, 11, 15, 2, 1, '#b3d6bf');
  box(ctx, 13, 20, 7, 1, p[2]);
  box(ctx, 20, 18, 2, 2, COIL);
  box(ctx, 20, 20, 3, 1, '#4b998d');
}
