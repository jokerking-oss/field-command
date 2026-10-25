// Original 40×40 pixel battleship. `palette` is [light, body, shade, deep].
// The painting uses integer coordinates throughout; it is not scaled artwork.
const INK = '#223739';
const DECK = '#a9b7a4';
const METAL = '#d0cfb7';
const GLASS = '#8eb6b6';

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function face(ctx, points, color) {
  const ys = points.map((point) => point[1]);
  for (let y = Math.min(...ys); y < Math.max(...ys); y++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= y + .5 && b[1] > y + .5) ||
          (b[1] <= y + .5 && a[1] > y + .5)) {
        hits.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
      }
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const left = Math.ceil(hits[i] - .5);
      box(ctx, left, y, Math.ceil(hits[i + 1] - .5) - left, 1, color);
    }
  }
}

function mainBattery(ctx, x, y, p) {
  // A hard-edged gunhouse with two distinct, parallel long-calibre barrels.
  face(ctx, [[x,y+4],[x+2,y+1],[x+8,y],[x+10,y+2],
             [x+10,y+7],[x+7,y+9],[x+1,y+8]], INK);
  face(ctx, [[x+1,y+4],[x+3,y+2],[x+7,y+1],[x+9,y+3],
             [x+8,y+6],[x+2,y+7]], p[1]);
  box(ctx, x+3, y+2, 4, 1, p[0]);
  box(ctx, x+2, y+7, 6, 1, p[3]);

  // Both barrel silhouettes repeat the same six-pixel length and spacing.
  box(ctx, x+8, y+2, 8, 2, INK);
  box(ctx, x+9, y+2, 6, 1, METAL);
  box(ctx, x+8, y+5, 8, 2, INK);
  box(ctx, x+9, y+5, 6, 1, METAL);
  box(ctx, x+15, y+2, 1, 2, '#506362');
  box(ctx, x+15, y+5, 1, 2, '#506362');
}

/** Side-on three-quarter battleship facing right, for a native 40×40 tile. */
export function paintBattleship(ctx, palette) {
  const p = palette;
  // Wake remains below the hull and clear of the game's lower HP strip.
  box(ctx, 1, 31, 6, 1, '#9bcdd0');
  box(ctx, 3, 33, 4, 1, '#78b9bf');
  box(ctx, 30, 30, 7, 1, '#9bcdd0');

  // A broad, armored hull fills nearly the whole cell. The deck slopes up
  // toward the bow; heavy freeboard separates it from a low submarine.
  face(ctx, [[1,23],[7,19],[28,16],[37,19],[39,22],
             [37,27],[32,30],[8,33],[1,30]], INK);
  face(ctx, [[2,23],[8,20],[28,17],[36,20],[36,23],
             [32,26],[8,30],[2,28]], DECK);
  face(ctx, [[2,27],[8,30],[32,26],[38,22],[38,26],
             [33,29],[8,32],[2,30]], p[2]);
  face(ctx, [[3,23],[9,20],[28,18],[36,20],[31,23],[8,27]], p[0]);
  face(ctx, [[7,29],[33,25],[33,27],[8,31]], p[1]);
  box(ctx, 4, 27, 5, 1, METAL);
  box(ctx, 31, 24, 4, 1, METAL);

  // A tall central bridge is narrower than the hull, unlike a carrier deck.
  face(ctx, [[15,19],[17,12],[20,8],[24,8],[27,13],[26,21],[16,24]], INK);
  face(ctx, [[17,18],[19,12],[21,9],[24,9],[25,13],[24,20],[17,22]], p[2]);
  box(ctx, 19, 11, 5, 3, p[0]);
  box(ctx, 19, 14, 5, 2, GLASS);
  box(ctx, 18, 17, 7, 2, p[1]);
  box(ctx, 22, 4, 1, 5, INK);
  box(ctx, 19, 5, 7, 1, METAL);
  box(ctx, 23, 6, 2, 1, p[0]);

  // Widely spaced turrets make a gunship readable at its actual 40px size.
  // Rear gun crosses in front of the bridge; forward gun guards the bow.
  mainBattery(ctx, 3, 15, p);
  mainBattery(ctx, 23, 10, p);
  box(ctx, 5, 25, 4, 1, p[3]);
  box(ctx, 27, 22, 5, 1, p[3]);
}
