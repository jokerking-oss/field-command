// Original 40 × 40 artwork. The armor colors come directly from TEAM_PALETTES.
// Three exposed wheels on each side indicate the six-wheel chassis; four
// separate exposed missiles and a radar panel identify the long-range AA role.
const INK = '#23383b';
const STEEL = '#465b58';
const RIM = '#778783';
const METAL = '#a7b2a1';
const WARHEAD = '#f1e5bc';
const WARHEAD_LIGHT = '#fff4d2';

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function face(ctx, points, color) {
  const ys = points.map((point) => point[1]);
  for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
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

function wheel(ctx, x, y, far = false) {
  box(ctx, x + 1, y, 4, 7, INK);
  box(ctx, x, y + 2, 6, 4, INK);
  box(ctx, x + 1, y + 2, 4, 4, STEEL);
  box(ctx, x + 2, y + 2, 2, 3, far ? '#677974' : RIM);
  box(ctx, x + 2, y + 3, 1, 1, METAL);
  box(ctx, x + 3, y + 4, 1, 1, INK);
}

function missile(ctx, x, y, palette) {
  const f = (points, color) => face(ctx, points, color);
  // Four identical, upward-pointing missiles are exposed on a 2×2 rack.
  // Large cream tips cannot be mistaken for the dark open gun bores of #09.
  f([[x, y + 5], [x + 3, y + 2], [x + 11, y - 2], [x + 14, y - 3],
     [x + 17, y - 2], [x + 17, y], [x + 13, y + 2], [x + 4, y + 7],
     [x + 1, y + 7]], INK);
  f([[x + 1, y + 5], [x + 4, y + 3], [x + 11, y - 1],
     [x + 13, y - 1], [x + 13, y + 1], [x + 4, y + 6],
     [x + 1, y + 6]], palette[1]);
  f([[x + 3, y + 4], [x + 10, y], [x + 12, y - 1],
     [x + 11, y + 1], [x + 4, y + 5]], palette[0]);
  f([[x + 12, y - 3], [x + 17, y - 2], [x + 17, y],
     [x + 13, y + 2], [x + 11, y + 1]], WARHEAD);
  box(ctx, x + 15, y - 1, 2, 1, WARHEAD_LIGHT);
  f([[x + 2, y + 5], [x + 1, y + 1], [x + 4, y + 3],
     [x + 5, y + 5]], palette[2]);
  box(ctx, x, y + 5, 2, 2, STEEL);
}

export function paintSAM(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // Three wheels on the far side peek above the near-side armor.
  wheel(ctx, 12, 22, true);
  wheel(ctx, 22, 23, true);
  wheel(ctx, 31, 24, true);

  // Low, wedge-shaped armored hull. There is no tall truck cabin or turret.
  f([[3, 21], [10, 17], [28, 18], [36, 22], [37, 26],
     [32, 29], [5, 27], [2, 24]], INK);
  f([[5, 21], [10, 18], [27, 19], [34, 22], [28, 25], [5, 23]], p[0]);
  f([[5, 23], [28, 25], [29, 29], [5, 26]], p[1]);
  f([[28, 25], [35, 22], [36, 26], [31, 28], [29, 29]], p[2]);
  f([[7, 21], [13, 19], [27, 20], [30, 22], [24, 23]], p[1]);
  f([[5, 26], [29, 29], [28, 30], [6, 27]], p[3]);
  box(ctx, 32, 25, 2, 1, '#f2daa6');
  box(ctx, 35, 24, 1, 2, '#f2daa6');

  // A visible trio along the near side reads as 6×6 at map scale.
  wheel(ctx, 6, 26);
  wheel(ctx, 16, 27);
  wheel(ctx, 27, 28);
  f([[5, 27], [31, 31], [30, 32], [5, 29]], p[2]);
  box(ctx, 10, 27, 3, 1, p[0]);
  box(ctx, 21, 29, 3, 1, p[0]);

  // Radar sits below the preview's upper-left number badge, unobscured at 1×.
  box(ctx, 7, 16, 2, 6, INK);
  box(ctx, 8, 17, 1, 4, RIM);
  f([[2, 13], [5, 11], [10, 11], [13, 14], [10, 18], [5, 17]], INK);
  f([[3, 13], [6, 12], [10, 12], [11, 14], [9, 16], [5, 16]], RIM);
  box(ctx, 6, 13, 4, 2, '#c6cfb3');
  box(ctx, 7, 14, 2, 1, p[2]);

  // Compact open rack, with no enclosed launch box or oversized truck body.
  f([[16, 17], [24, 17], [28, 21], [26, 24], [15, 22], [14, 20]], INK);
  f([[16, 18], [23, 18], [26, 20], [24, 22], [16, 21]], p[2]);
  f([[15, 20], [22, 19], [24, 21], [18, 23]], p[0]);
  f([[16, 14], [31, 9], [32, 10], [17, 16]], STEEL);
  f([[16, 21], [33, 16], [34, 17], [17, 23]], STEEL);
  // Rear pair first, then front pair. Four light-colored tips are intentionally
  // separated by both x and y so they survive reduction to the native tile.
  missile(ctx, 22, 10, p);
  missile(ctx, 22, 18, p);
  missile(ctx, 15, 7, p);
  missile(ctx, 15, 15, p);
  box(ctx, 17, 21, 2, 1, p[0]);
  box(ctx, 23, 22, 2, 1, p[0]);
}

// Older standalone previews use this name; keeping it avoids breaking them.
export const paintMissileAA = paintSAM;
