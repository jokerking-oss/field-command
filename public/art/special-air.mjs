// Original aircraft. Coordinates are native 40 × 40 map pixels.
// The four armor colors always come from the game's TEAM_PALETTES entry.
const INK = '#23383b';
const SHADOW = '#465b58';
const METAL = '#93a5a0';
const GLASS = '#547478';
const GLASS_LIGHT = '#9dc5bd';
const CHARGE = '#edc56e';
const CHARGE_LIGHT = '#ffe0a0';

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

export function paintStealthReconJet(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // One clipped diamond wing with a small rear notch: no conventional tail
  // or long, slender interceptor wings. Its outline reads even at 1×.
  f([[3, 17], [10, 15], [6, 10], [15, 6], [26, 13], [32, 13],
     [38, 17], [38, 20], [32, 23], [26, 23], [15, 33], [6, 29],
     [10, 22], [3, 21]], INK);
  f([[5, 18], [12, 15], [8, 11], [15, 8], [26, 14], [35, 16],
     [37, 18], [35, 20], [26, 22], [15, 31], [8, 28], [12, 22],
     [5, 20]], p[2]);
  f([[8, 12], [15, 8], [25, 14], [19, 17], [11, 16]], p[0]);
  f([[10, 23], [19, 20], [26, 22], [15, 30], [9, 27]], p[1]);
  f([[5, 19], [18, 15], [27, 15], [36, 18], [27, 21], [18, 23],
     [5, 20]], p[1]);
  f([[11, 18], [19, 16], [28, 16], [35, 18], [27, 19], [18, 20],
     [11, 20]], p[0]);
  // Facet seams are angular, rather than curved or riveted.
  f([[12, 16], [18, 17], [19, 18], [12, 17]], p[3]);
  f([[12, 23], [18, 21], [19, 21], [15, 26]], p[3]);
  f([[21, 13], [25, 14], [28, 16], [23, 15]], p[3]);
  f([[20, 25], [25, 22], [28, 21], [25, 24]], p[3]);

  // Flush dark canopy and a tiny forward sensor; nothing protrudes above the
  // radar-quiet upper silhouette.
  f([[23, 16], [28, 16], [32, 18], [27, 19], [23, 19]], INK);
  f([[24, 16], [28, 17], [30, 18], [24, 18]], GLASS);
  box(ctx, 24, 16, 3, 1, GLASS_LIGHT);
  box(ctx, 34, 18, 2, 1, '#dfd2a8');
  box(ctx, 35, 19, 1, 1, p[3]);

  // Recessed exhaust is deliberately small; it cannot be mistaken for the
  // twin exposed engines of a fast interceptor.
  box(ctx, 4, 18, 4, 3, INK);
  box(ctx, 4, 19, 2, 1, SHADOW);
  box(ctx, 7, 18, 3, 2, p[3]);
  box(ctx, 14, 10, 3, 1, p[1]);
  box(ctx, 13, 27, 3, 1, p[0]);
}

function rotor(ctx, x, y, palette, far = false) {
  // A narrow propeller bar and a separate motor cap avoid the look of a wing.
  box(ctx, x - 4, y - 2, 9, 2, INK);
  box(ctx, x - 3, y - 2, 7, 1, far ? SHADOW : METAL);
  box(ctx, x - 2, y, 5, 3, INK);
  box(ctx, x - 1, y, 3, 2, palette[2]);
  box(ctx, x, y, 1, 1, palette[0]);
}

export function paintBlastDrone(ctx, palette) {
  const p = palette;
  const f = (points, color) => face(ctx, points, color);

  // Four exposed rotors around an X frame give a silhouette unlike any jet
  // or helicopter. Far arms sit behind the compact center housing.
  f([[16, 17], [7, 11], [6, 13], [14, 20]], INK);
  f([[16, 17], [8, 12], [8, 13], [15, 19]], p[1]);
  f([[23, 17], [32, 10], [34, 12], [25, 21]], INK);
  f([[23, 17], [32, 11], [32, 13], [24, 20]], p[1]);
  f([[16, 21], [6, 28], [7, 30], [19, 25]], INK);
  f([[16, 21], [8, 28], [9, 29], [18, 24]], p[1]);
  f([[23, 22], [32, 28], [33, 30], [21, 25]], INK);
  f([[23, 22], [31, 28], [31, 29], [22, 24]], p[1]);

  rotor(ctx, 7, 10, p, true);
  rotor(ctx, 32, 9, p, true);
  rotor(ctx, 7, 28, p);
  rotor(ctx, 32, 28, p);

  // Crewless fuselage: solid armor and a small targeting eye, no canopy.
  f([[14, 15], [20, 13], [26, 16], [28, 20], [25, 25],
     [18, 27], [12, 23], [11, 19]], INK);
  f([[15, 16], [20, 14], [25, 17], [26, 20], [18, 22], [13, 20]], p[0]);
  f([[13, 21], [18, 23], [26, 20], [24, 24], [18, 26], [13, 23]], p[2]);
  f([[17, 17], [22, 16], [24, 18], [20, 20], [16, 19]], p[1]);
  box(ctx, 24, 18, 2, 2, INK);
  box(ctx, 25, 18, 1, 1, '#bcd3bd');

  // Large exposed explosive charge hangs below the airframe. Warm hazard
  // bands make its single-use attack role readable in a crowded map.
  f([[15, 22], [22, 21], [27, 24], [27, 29], [23, 32],
     [17, 31], [13, 27]], INK);
  f([[16, 23], [22, 22], [26, 25], [26, 28], [22, 30],
     [17, 30], [14, 27]], CHARGE);
  f([[16, 23], [22, 22], [25, 24], [18, 25], [15, 25]], CHARGE_LIGHT);
  f([[18, 25], [20, 25], [18, 30], [16, 29]], INK);
  f([[23, 23], [25, 25], [22, 30], [20, 30]], INK);
  box(ctx, 19, 24, 3, 1, p[2]);
  box(ctx, 23, 29, 2, 1, '#a56143');
}
