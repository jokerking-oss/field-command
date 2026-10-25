// Original 40×40 anti-aircraft gun artwork used by the game.
// `palette` is the game's four-color team palette [light, body, shade, deep].
const INK = '#23383b';
const TRACK = '#34474a';
const RIM = '#81948a';
const BARREL = '#a4b09f';
const BARREL_LIGHT = '#d0d0b3';

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

function cannon(ctx, dx, dy) {
  ctx.save();
  ctx.translate(dx, dy);
  // Both barrels use exactly this geometry; a pure translation keeps them
  // parallel at native map size rather than relying on hand-matched slopes.
  face(ctx, [[16, 16], [29, 3], [32, 3], [33, 4], [33, 6], [20, 19], [17, 19]], INK);
  face(ctx, [[18, 16], [29, 5], [31, 5], [19, 18]], BARREL);
  face(ctx, [[18, 16], [29, 5], [29, 6], [19, 17]], BARREL_LIGHT);
  box(ctx, 29, 3, 4, 4, INK);
  box(ctx, 30, 4, 2, 2, RIM);
  box(ctx, 31, 4, 1, 2, '#192f31');
  ctx.restore();
}

/** Draw a compact tracked anti-aircraft vehicle, facing upper-right. */
export function paintAntiAirGun(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // Rear track is lower and shorter in this three-quarter perspective.
  f([[23, 24], [34, 23], [38, 26], [37, 30], [30, 33], [23, 29]], INK);
  f([[25, 25], [34, 24], [36, 26], [35, 29], [29, 31], [25, 28]], TRACK);
  box(ctx, 32, 27, 3, 3, '#182e32');
  box(ctx, 33, 27, 2, 2, RIM);

  // Very low hull: the twin guns occupy more vertical space than the body.
  f([[4, 22], [10, 19], [27, 20], [36, 23], [37, 26], [31, 29], [5, 28], [2, 25]], INK);
  f([[5, 22], [11, 20], [27, 21], [34, 23], [30, 25], [6, 24]], p[0]);
  f([[5, 24], [30, 25], [35, 23], [35, 27], [30, 29], [5, 27]], p[1]);
  f([[5, 27], [30, 29], [30, 30], [6, 29]], p[2]);
  f([[30, 25], [35, 23], [36, 26], [31, 29], [30, 29]], p[3]);
  box(ctx, 7, 23, 9, 1, p[0]);
  box(ctx, 31, 24, 3, 1, '#f3dca7');
  box(ctx, 33, 26, 2, 1, '#f3dca7');

  // Near track has four visible wheels but remains below the red side plate.
  f([[4, 26], [29, 28], [31, 29], [29, 32], [6, 31], [2, 29]], INK);
  f([[5, 27], [28, 29], [29, 30], [28, 31], [6, 30], [3, 29]], TRACK);
  f([[5, 27], [28, 29], [28, 30], [5, 28]], RIM);
  for (const [x, y] of [[6, 28], [12, 28], [18, 29], [24, 29]]) {
    box(ctx, x, y, 3, 3, '#192f32');
    box(ctx, x, y, 2, 2, '#788d83');
    box(ctx, x, y, 1, 1, '#b4bba3');
  }
  f([[6, 30], [28, 31], [27, 32], [7, 32]], '#4c625e');

  // Open swivel ring and a small shield signal a rotating AA mount rather
  // than a sealed tank turret. No long horizontal anti-armor cannon is used.
  box(ctx, 13, 21, 15, 3, INK);
  box(ctx, 15, 21, 11, 2, '#667b70');
  box(ctx, 17, 22, 7, 1, p[3]);
  f([[11, 17], [16, 13], [22, 13], [27, 17], [26, 22], [14, 22], [10, 20]], INK);
  f([[12, 17], [16, 14], [22, 14], [24, 17], [17, 18], [12, 18]], p[0]);
  f([[12, 18], [24, 18], [25, 21], [14, 21]], p[1]);
  f([[23, 15], [27, 17], [26, 21], [23, 19]], p[3]);
  box(ctx, 16, 14, 4, 1, '#e7d7aa');
  box(ctx, 14, 20, 6, 1, p[2]);
  box(ctx, 10, 19, 2, 3, p[3]);
  box(ctx, 10, 19, 1, 2, p[0]);
  cannon(ctx, 0, 0);
  cannon(ctx, 5, 5);
  box(ctx, 17, 17, 4, 3, INK);
  box(ctx, 18, 17, 2, 1, p[0]);
}
