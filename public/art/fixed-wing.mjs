// Original artwork for two 40 × 40 fixed-wing aircraft.
// All colored armor comes from renderer.mjs's TEAM_PALETTES palette argument.
const INK = '#23383b';
const STEEL = '#536b69';
const STEEL_LIGHT = '#9eafa1';
const CANOPY = '#83b1ad';
const CANOPY_LIGHT = '#c3d9bf';
const DETAIL = '#e8d19b';

function box(ctx, x, y, w, h, color) {
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
      const start = Math.ceil(hits[i] - .5);
      box(ctx, start, row, Math.ceil(hits[i + 1] - .5) - start, 1, color);
    }
  }
}

// A light, high-speed air-superiority fighter: a narrow pointed fuselage, two
// strongly swept wings and two unmistakable dark jet outlets at its rear.
export function paintInterceptor(ctx, p) {
  const f = (points, color) => face(ctx, points, color);
  // Far wing climbs sharply away from the slender body.
  f([[16,18],[24,17],[12,5],[8,4],[10,11],[11,18]], INK);
  f([[16,17],[21,17],[11,6],[9,6],[12,17]], p[1]);
  f([[12,10],[18,17],[20,17],[13,12]], p[0]);
  f([[9,13],[13,16],[14,20],[7,17],[6,11]], INK); // far tailfin
  f([[8,13],[12,17],[10,17],[7,14]], p[2]);

  // Rigid centreline and spear-shaped nose; the nose is deliberately sharper
  // than the bomber's blunt, deep fuselage.
  f([[5,16],[14,16],[29,16],[36,18],[39,20],[39,22],[35,24],
    [27,25],[12,25],[5,23]], INK);
  f([[7,18],[14,17],[28,17],[35,19],[38,20],[35,22],
    [27,23],[12,23],[7,22]], p[1]);
  f([[8,17],[28,17],[36,19],[32,20],[9,20]], p[0]);
  f([[8,23],[28,23],[35,22],[31,24],[11,24]], p[2]);
  // Near wing is a separate, rearward-swept triangle rather than one flying wing.
  f([[18,21],[28,22],[14,31],[6,31],[11,26]], INK);
  f([[18,23],[25,23],[13,29],[9,29],[12,26]], p[1]);
  f([[18,23],[24,23],[14,27],[12,27]], p[0]);
  f([[7,23],[13,24],[10,28],[7,29],[5,27]], INK); // near tailfin
  f([[8,24],[11,25],[8,28],[7,27]], p[2]);
  // Canopy stays distinct from the wing even at true map scale.
  f([[26,17],[31,17],[34,19],[32,21],[26,21]], INK);
  f([[27,18],[31,18],[32,19],[30,20],[27,20]], CANOPY);
  box(ctx, 28, 18, 2, 1, CANOPY_LIGHT);
  // The two outlets, one above the other, are the fighter's rear identifier.
  box(ctx, 3, 17, 5, 3, INK); box(ctx, 3, 22, 5, 3, INK);
  box(ctx, 4, 18, 2, 1, STEEL_LIGHT); box(ctx, 4, 23, 2, 1, STEEL_LIGHT);
  box(ctx, 6, 20, 2, 2, p[3]);
  box(ctx, 36, 20, 2, 1, DETAIL);
}

// Heavy land/sea strike bomber: broad almost-straight wings, two nacelles,
// a blocky passenger-scale fuselage, and a visible ventral bomb-bay stripe.
export function paintBomber(ctx, p) {
  const f = (points, color) => face(ctx, points, color);
  // Two thick, almost straight wings make a cross-shaped silhouette at 1×.
  // Draw them before the central fuselage so they read as attached wings,
  // never as a raised cab and ground-vehicle chassis.
  f([[6,4],[20,4],[29,17],[10,18],[5,12]], INK);
  f([[7,6],[19,6],[26,16],[11,16],[7,12]], p[1]);
  f([[7,6],[19,6],[21,8],[7,8]], p[0]);
  box(ctx, 11, 10, 2, 5, p[2]);
  f([[10,21],[29,21],[18,33],[4,33],[5,27]], INK);
  f([[11,23],[26,23],[17,31],[6,31],[7,27]], p[1]);
  f([[10,23],[26,23],[22,26],[7,26]], p[0]);
  box(ctx, 11, 27, 2, 4, p[2]);

  // The nacelles are inset within the wings and visible on both sides.
  f([[17,9],[22,9],[23,12],[23,17],[16,17],[16,12]], INK);
  f([[18,10],[21,10],[22,12],[22,16],[17,16],[17,12]], p[2]);
  box(ctx, 18, 11, 3, 1, STEEL_LIGHT);
  box(ctx, 18, 15, 3, 1, STEEL);
  f([[16,24],[23,24],[23,29],[22,31],[16,31]], INK);
  f([[17,25],[22,25],[22,29],[21,30],[17,30]], p[2]);
  box(ctx, 18, 26, 3, 1, STEEL_LIGHT);
  box(ctx, 18, 29, 3, 1, STEEL);

  // The straight fuselage visually joins the wings. It is noticeably thicker
  // and blunter than the interceptor, yet cannot be mistaken for a truck.
  f([[3,16],[11,16],[14,17],[28,17],[34,18],[39,20],[39,22],
    [35,24],[28,25],[12,25],[3,24]], INK);
  f([[5,17],[13,18],[28,18],[34,19],[37,20],[37,21],
    [34,23],[27,23],[12,23],[5,22]], p[1]);
  f([[6,17],[28,18],[34,19],[33,20],[12,20],[6,19]], p[0]);
  f([[5,22],[28,23],[35,22],[32,24],[12,24],[5,23]], p[2]);
  box(ctx, 4, 17, 3, 2, p[0]);
  box(ctx, 4, 21, 3, 2, p[3]);
  // Cockpit and bomb bay are small, high-contrast functional markers.
  f([[29,18],[34,18],[37,20],[37,22],[29,22]], INK);
  f([[30,19],[34,19],[35,20],[35,21],[30,21]], CANOPY);
  box(ctx, 31, 19, 2, 1, CANOPY_LIGHT);
  box(ctx, 25, 23, 8, 2, INK);
  box(ctx, 26, 23, 6, 1, DETAIL);
  box(ctx, 36, 21, 2, 1, p[0]);
}
