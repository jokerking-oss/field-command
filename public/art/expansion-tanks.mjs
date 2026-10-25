// Original 40×40 artwork. Palette p is the game's TEAM_PALETTES entry.
// Geometry is drawn in native canvas pixels; no resized concept-image pixels are used.
const INK = '#23383b';
const TRACK = '#34474a';
const TRACK_LIGHT = '#778783';

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

function assaultTank(ctx, p) {
  const f = (points, color) => face(ctx, points, color);
  // Small, fast hull with a long pointed glacis and exposed compact tracks.
  f([[20,22],[34,22],[38,26],[34,29],[25,29]], INK);
  f([[21,23],[34,23],[36,26],[33,28],[26,28]], TRACK);
  f([[3,22],[15,19],[29,20],[38,25],[33,29],[5,27]], INK);
  f([[5,21],[15,18],[28,20],[36,24],[26,24],[5,23]], p[0]);
  f([[5,23],[26,24],[34,28],[8,27],[4,25]], p[1]);
  f([[26,24],[36,24],[38,25],[33,28],[30,27]], p[0]);
  f([[9,20],[16,18],[26,20],[25,22],[11,22]], p[1]);
  // One clear seam follows the wedge; shadows only sit below the bright armor.
  f([[7,24],[24,25],[29,27],[9,26]], p[2]);
  box(ctx, 31, 26, 2, 1, '#eed9a5');
  box(ctx, 35, 25, 2, 1, '#eed9a5');

  f([[3,26],[24,27],[29,30],[26,34],[5,31],[2,29]], INK);
  f([[5,27],[24,28],[27,30],[25,33],[5,30],[3,28]], TRACK);
  f([[5,27],[24,28],[24,29],[5,28]], TRACK_LIGHT);
  for (const [x, y] of [[6,28],[11,28],[16,29],[21,29]]) {
    box(ctx, x, y, 3, 3, '#182e32');
    box(ctx, x, y, 2, 2, '#879585');
    box(ctx, x, y, 1, 1, '#b2baa5');
  }
  f([[5,30],[25,33],[25,34],[5,31]], '#526765');
  f([[28,28],[35,27],[35,29],[29,31]], TRACK);

  // Turret is deliberately half the mass of the existing heavy tank's turret.
  f([[12,14],[16,11],[22,11],[26,14],[25,18],[13,20],[10,17]], INK);
  f([[13,14],[16,12],[22,12],[24,14],[23,16],[12,17]], p[0]);
  f([[12,17],[23,17],[24,18],[14,19]], p[1]);
  box(ctx, 17, 12, 4, 1, '#eddbac');
  box(ctx, 17, 13, 4, 1, p[2]);
  box(ctx, 10, 18, 4, 1, p[0]);

  // Long, slim single gun: a one-pixel highlight above a narrow steel barrel.
  f([[23,13],[36,8],[39,8],[39,10],[25,16],[23,16]], INK);
  f([[24,13],[37,9],[38,9],[25,15]], '#a9ae96');
  box(ctx, 37, 8, 2, 3, '#435955');
  box(ctx, 38, 9, 1, 1, '#172f30');
}

function siegeTank(ctx, p) {
  const f = (points, color) => face(ctx, points, color);
  // Broad tracks and a tall box casemate make a different silhouette at 1×.
  f([[21,21],[34,21],[38,25],[37,31],[28,34],[20,31]], INK);
  f([[22,22],[34,22],[37,25],[36,30],[29,33],[23,29]], TRACK);
  for (const [x, y] of [[29,27],[33,26]]) {
    box(ctx, x, y, 3, 4, '#1a3133');
    box(ctx, x, y, 2, 2, TRACK_LIGHT);
  }
  f([[2,22],[11,20],[30,22],[35,27],[29,35],[5,34],[1,29]], INK);
  f([[4,23],[28,23],[32,27],[28,33],[5,32],[3,28]], TRACK);
  f([[5,23],[27,24],[29,26],[5,25]], '#97a18e');
  for (const [x, y] of [[5,27],[10,28],[15,28],[20,29],[25,29]]) {
    box(ctx, x, y, 4, 4, '#192f32');
    box(ctx, x, y, 3, 3, '#687b76');
    box(ctx, x + 1, y, 1, 2, '#a8b29c');
  }
  f([[5,32],[29,34],[28,35],[5,34]], '#536865');

  // Slab-sided fighting compartment, no conventional rounded turret.
  f([[7,14],[13,9],[25,9],[30,13],[31,23],[26,28],[7,25],[5,20]], INK);
  f([[8,14],[13,10],[24,10],[28,13],[26,17],[8,17]], p[0]);
  f([[8,17],[26,17],[29,21],[25,25],[8,23]], p[1]);
  f([[26,17],[30,14],[30,23],[26,27],[25,25]], p[2]);
  f([[9,15],[13,11],[24,11],[26,13],[23,15]], p[1]);
  box(ctx, 14, 11, 6, 2, p[0]);
  // Tall armor panels and a protected viewing slit identify the casemate.
  box(ctx, 9, 18, 2, 5, p[0]);
  box(ctx, 15, 18, 2, 6, p[0]);
  box(ctx, 21, 18, 2, 6, p[0]);
  box(ctx, 15, 14, 7, 2, INK);
  box(ctx, 16, 14, 5, 1, '#a9b49f');
  f([[10,23],[26,25],[26,27],[9,25]], p[0]);
  // Very short, oversized siege muzzle, visually unlike the slim tank guns.
  f([[27,16],[33,15],[39,16],[39,22],[33,22],[28,20]], INK);
  f([[29,17],[34,16],[37,17],[37,20],[33,20],[29,19]], '#879285');
  box(ctx, 28, 16, 3, 2, p[0]);
  box(ctx, 36, 16, 3, 6, '#526560');
  box(ctx, 38, 17, 1, 4, '#182f32');
  box(ctx, 35, 17, 2, 4, '#263d3c');
  box(ctx, 30, 24, 2, 1, '#f3d79a');
}

export function paintExpansionTank(ctx, type, palette) {
  if (type === 'assault') return assaultTank(ctx, palette);
  if (type === 'siege') return siegeTank(ctx, palette);
  throw new Error(`Unknown preview unit: ${type}`);
}
