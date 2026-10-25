// Original service boat drawn directly for one 40 × 40 map tile.
// palette is the game's [highlight, body, shadow, deep-shadow] team palette.
const INK = '#23383b';
const STEEL = '#536b69';
const WINDOW = '#a9d0ce';
const CREAM = '#f0dfae';
const GOLD = '#e6ca79';

function box(ctx, x, y, width, height, color) {
  if (width <= 0 || height <= 0) return;
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

function face(ctx, points, color) {
  const ys = points.map((point) => point[1]);
  for (let row = Math.min(...ys); row < Math.max(...ys); row++) {
    const intersections = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= row + .5 && b[1] > row + .5) ||
          (b[1] <= row + .5 && a[1] > row + .5)) {
        intersections.push(a[0] + (row + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      const left = Math.ceil(intersections[i] - .5);
      const right = Math.ceil(intersections[i + 1] - .5);
      box(ctx, left, row, right - left, 1, color);
    }
  }
}

/** A short crane-and-tool service vessel, facing the upper right. */
export function paintRepairBoat(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // A small wake and a stout, blunt hull distinguish this from a long warship.
  box(ctx, 2, 30, 5, 1, '#9bcdd0');
  box(ctx, 1, 32, 4, 1, '#78b9bf');
  box(ctx, 27, 32, 6, 1, '#9bcdd0');
  f([[5, 23], [9, 20], [27, 20], [34, 23], [35, 27],
     [31, 31], [8, 33], [4, 30]], INK);
  f([[6, 23], [10, 21], [27, 21], [33, 23], [32, 25],
     [8, 28], [5, 27]], p[0]);
  f([[5, 27], [8, 28], [32, 25], [34, 25], [34, 28],
     [30, 31], [8, 32], [5, 30]], p[1]);
  f([[8, 30], [30, 28], [30, 31], [8, 32]], p[2]);
  box(ctx, 7, 29, 8, 1, p[3]);
  box(ctx, 26, 29, 5, 1, p[3]);
  box(ctx, 31, 24, 2, 1, CREAM);

  // Squared-off workshop cabin: two windows, then a large repair cross.
  f([[7, 22], [8, 15], [11, 13], [17, 13], [20, 16],
     [21, 23], [18, 26], [7, 26]], INK);
  f([[9, 21], [10, 15], [12, 14], [17, 14], [19, 16],
     [19, 23], [17, 24], [8, 24]], p[1]);
  box(ctx, 10, 16, 4, 3, WINDOW);
  box(ctx, 15, 16, 3, 3, WINDOW);
  box(ctx, 10, 16, 8, 1, '#d6e4d7');
  box(ctx, 10, 20, 8, 4, p[2]);
  box(ctx, 13, 20, 2, 4, CREAM);
  box(ctx, 11, 21, 6, 2, CREAM);
  box(ctx, 13, 21, 2, 2, '#fff2ca');
  box(ctx, 9, 25, 10, 1, p[0]);

  // Open rear work deck: one unmistakable toolbox, not guns or passengers.
  box(ctx, 21, 23, 7, 5, INK);
  box(ctx, 22, 23, 5, 2, '#c5ba92');
  box(ctx, 22, 25, 5, 2, STEEL);
  box(ctx, 24, 25, 1, 2, CREAM);
  box(ctx, 23, 22, 3, 1, INK);

  // Clear yellow jib, vertical cable, and hooked end dominate the silhouette.
  box(ctx, 21, 17, 3, 7, INK);
  box(ctx, 22, 18, 1, 5, GOLD);
  f([[20, 18], [29, 6], [33, 6], [34, 9], [23, 22],
     [20, 22]], INK);
  f([[22, 18], [30, 7], [32, 7], [32, 9], [23, 20]], GOLD);
  box(ctx, 28, 9, 2, 2, CREAM);
  box(ctx, 32, 9, 2, 10, INK);
  box(ctx, 32, 10, 1, 9, '#aebbb1');
  box(ctx, 31, 19, 4, 2, INK);
  box(ctx, 32, 20, 2, 3, GOLD);
  box(ctx, 33, 22, 2, 2, INK);
  box(ctx, 34, 23, 1, 1, CREAM);
}
