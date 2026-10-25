// Original 40 × 40 naval unit artwork used by the game.
// Stable IDs: battleship, cruiser, lander, submarine, repair_boat, carrier.
const INK = '#23383b';
const METAL = '#596d70';
const PALE = '#a7b8ac';
const DECK = '#899a8d';
function box(c, x, y, w, h, color) {
  if (w <= 0 || h <= 0) return;
  c.fillStyle = color;
  c.fillRect(x, y, w, h);
}
function face(c, points, color) {
  const ys = points.map(([_, y]) => y);
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
      const left = Math.ceil(hits[i] - .5), right = Math.ceil(hits[i + 1] - .5);
      box(c, left, row, right - left, 1, color);
    }
  }
}
function f(c, points, color) { face(c, points, color); }
function wake(c, small = false) {
  const light = '#9bcdd0';
  box(c, 2, 30, small ? 6 : 9, 1, light);
  box(c, 1, 32, small ? 4 : 6, 1, '#78b9bf');
  box(c, 11, 35, small ? 3 : 5, 1, light);
  box(c, 29, 29, 5, 1, light);
}
// Each surface ship has a separate hull construction. At 40px, the silhouette
// must carry its role before any tiny deck marking is considered.
function largeBattery(c, x, y, p) {
  // Nine-pixel turret body with broad twin barrels, one high and one low.
  f(c, [[x,y+3],[x+3,y],[x+8,y],[x+10,y+3],[x+9,y+8],[x+2,y+9]], INK);
  f(c, [[x+1,y+3],[x+3,y+1],[x+8,y+1],[x+9,y+4],[x+8,y+7],[x+2,y+7]], p[1]);
  box(c,x+3,y+1,5,2,p[0]);
  box(c,x+2,y+7,6,1,p[3]);
  box(c,x+9,y+3,7,2,INK);
  box(c,x+9,y+6,7,2,INK);
  box(c,x+10,y+3,6,1,PALE);
  box(c,x+10,y+6,6,1,PALE);
  box(c,x+15,y+3,1,2,'#43585b');
  box(c,x+15,y+6,1,2,'#43585b');
}
function battleship(c, p) {
  wake(c);
  // Deep armored broadside reaches both ends of the tile.
  f(c, [[1,23],[6,18],[28,16],[37,18],[39,23],[34,28],[9,33],[2,31]],INK);
  f(c, [[2,23],[7,19],[28,17],[36,19],[34,23],[8,29],[2,28]],'#8b9b93');
  f(c, [[2,28],[8,29],[34,23],[38,21],[38,25],[34,29],[9,33],[2,31]],p[2]);
  f(c, [[3,24],[9,20],[27,18],[34,19],[30,22],[8,27]],p[0]);
  f(c, [[9,30],[33,25],[33,28],[9,32]],p[1]);
  box(c,4,28,5,1,PALE);
  // Bridge sits between two unmistakably large gunhouses.
  f(c, [[15,16],[18,10],[24,9],[27,14],[26,20],[16,23]],INK);
  f(c, [[17,16],[19,11],[23,10],[25,14],[24,19],[17,21]],p[2]);
  box(c,18,12,6,3,p[0]);
  box(c,18,15,6,2,'#a2c1bb');
  box(c,21,6,1,4,INK);
  largeBattery(c,4,15,p);
  largeBattery(c,24,9,p);
}
function cruiser(c, p) {
  wake(c, true);
  // High freeboard with a steep red bow; unlike the low submarine, the
  // command bridge occupies the upper half of this surface warship.
  f(c, [[2,24],[9,20],[29,18],[35,13],[39,16],[39,26],[34,30],[8,33],[2,31]],INK);
  f(c, [[3,24],[10,21],[29,19],[35,15],[38,17],[38,22],[34,25],[9,29],[3,28]],p[0]);
  f(c, [[3,28],[9,29],[34,25],[38,22],[38,26],[34,30],[9,33],[3,31]],p[1]);
  f(c, [[10,30],[34,26],[34,29],[10,32]],p[2]);
  f(c, [[30,19],[35,15],[37,17],[37,23],[33,25]],p[3]);
  box(c,5,27,6,1,'#d7cbaa');
  // Big pale bridge and red roof make an unmistakably tall surface ship.
  f(c, [[10,21],[12,14],[17,9],[24,9],[28,15],[27,23],[14,27]],INK);
  f(c, [[12,20],[14,14],[18,10],[23,10],[26,15],[25,22],[15,25]],'#dddcc7');
  f(c, [[15,11],[18,9],[23,9],[26,12],[24,14],[14,14]],p[1]);
  box(c,15,15,4,3,'#385861');
  box(c,21,15,4,3,'#385861');
  box(c,15,15,4,1,'#a9cad0');
  box(c,21,15,4,1,'#a9cad0');
  box(c,18,20,5,3,p[0]);
  // Wide rotating radar head with a sturdy mast, not a periscope.
  box(c,19,3,3,7,INK);
  f(c, [[12,5],[15,3],[27,3],[30,5],[28,8],[14,8]],INK);
  box(c,15,4,12,2,'#d9ddc9');
  box(c,17,6,8,1,p[0]);
  box(c,20,7,2,2,INK);
  // Four-cell air-defence missile rack at the raised bow shoulder.
  f(c, [[27,18],[29,12],[35,12],[37,17],[35,22],[29,23]],INK);
  f(c, [[29,18],[30,13],[34,13],[35,17],[34,20],[29,21]],p[2]);
  for (const [x,y] of [[30,14],[33,14],[30,18],[33,18]]) {
    box(c,x,y,2,2,'#eee4c3');
    box(c,x+1,y+1,1,1,INK);
  }
}
function lander(c, p) {
  wake(c);
  // Wide square barge, not a pointed destroyer: vertical walls surround a
  // 19 x 9 dark drive-through well that stays open at native map size.
  f(c, [[2,18],[7,15],[34,15],[37,18],[37,28],[32,32],[6,33],[2,29]],INK);
  f(c, [[3,19],[8,16],[34,16],[35,27],[31,30],[7,30],[3,27]],p[1]);
  f(c, [[3,27],[7,30],[31,30],[36,27],[35,30],[31,33],[6,33],[3,30]],p[2]);
  box(c,10,18,20,10,INK);
  box(c,12,19,17,8,'#465956');
  box(c,11,17,20,2,p[0]);
  box(c,8,18,3,10,p[3]);
  box(c,30,18,3,10,p[3]);
  box(c,11,27,21,2,p[0]);
  // A carried vehicle is visible inside the otherwise empty black well.
  box(c,14,22,10,4,'#b2aa7f');
  box(c,16,20,5,2,'#c7c49f');
  box(c,14,25,3,2,INK);
  box(c,21,25,3,2,INK);
  // Square bow gate folds down past the hull into the sea.
  box(c,34,18,4,9,INK);
  f(c, [[34,23],[38,23],[39,32],[35,31]],INK);
  f(c, [[35,24],[37,24],[38,31],[36,30]],'#aeb9a8');
  box(c,36,25,1,5,'#e1d6ab');
}
function submarine(c, p) {
  wake(c, true);
  // Long, low closed cigar hull; no surface ship deck or exposed cargo.
  f(c, [[2,25],[8,21],[28,18],[37,20],[39,23],[34,27],[9,32],[2,29]], INK);
  f(c, [[4,25],[9,22],[28,19],[36,21],[37,23],[32,25],[9,30],[4,28]], p[2]);
  f(c, [[7,24],[27,20],[34,21],[26,23],[8,27]], p[1]);
  f(c, [[7,25],[25,21],[27,21],[8,27]], p[0]);
  f(c, [[10,29],[32,25],[31,27],[11,31]], p[3]);
  // Rounded sail and single periscope sit high above the otherwise low hull.
  f(c, [[16,18],[18,13],[23,11],[27,13],[28,18],[23,21],[17,21]], INK);
  f(c, [[18,17],[20,13],[23,12],[26,14],[26,18],[19,20]], p[1]);
  box(c, 20, 14, 4, 1, p[0]);
  box(c, 23, 6, 1, 7, INK);
  box(c, 23, 6, 4, 1, PALE);
  box(c, 33, 22, 2, 1, PALE);
}
function repairBoat(c, p) {
  wake(c,true);
  // Short, broad harbor workboat with a blunt nose, not a naval gunship.
  f(c, [[4,24],[7,20],[28,20],[33,23],[33,28],[28,32],[7,32],[4,29]],INK);
  f(c, [[5,24],[8,21],[27,21],[31,24],[29,27],[7,28],[5,27]],p[0]);
  f(c, [[5,27],[7,28],[29,27],[32,25],[32,28],[28,31],[7,31],[5,29]],p[2]);
  box(c,9,27,15,2,p[1]);
  // Tall protected service cabin carries a large emergency cross.
  f(c, [[7,21],[8,15],[12,12],[18,13],[20,18],[19,24],[9,25]],INK);
  f(c, [[9,20],[10,15],[13,13],[17,14],[19,18],[18,22],[10,23]],p[1]);
  box(c,11,15,6,3,'#9fc1bb');
  box(c,13,19,3,1,'#f4dfa9');
  box(c,14,18,1,3,'#f4dfa9');
  // Large triangular yellow crane rises outside the cargo boat's outline.
  f(c, [[19,21],[27,5],[31,4],[32,8],[23,22]],INK);
  f(c, [[21,19],[28,6],[30,6],[29,9],[23,20]],'#edcf78');
  f(c, [[24,15],[29,8],[31,8],[29,15]],'#b48c49');
  box(c,30,8,2,11,INK);
  box(c,30,9,1,10,'#f3d987');
  box(c,28,19,6,2,INK);
  box(c,29,21,4,4,'#e4d393');
  box(c,30,25,2,2,INK);
  // Supplies are visible on the aft working deck, behind the hook.
  box(c,22,24,6,4,'#796d53');
  box(c,23,23,5,2,'#ceb984');
  box(c,24,25,2,1,'#e7d6a6');
}
function carrier(c, p) {
  wake(c);
  // A near-rectangular 38 x 20 flight deck dominates the entire tile.
  // Its solid slate surface is the visual opposite of the landing ship's
  // black open cargo well.
  f(c, [[1,16],[5,11],[37,11],[39,14],[39,27],[35,30],[4,31],[1,28]],INK);
  f(c, [[2,16],[6,12],[37,12],[38,14],[38,26],[35,28],[4,29],[2,27]],'#435e61');
  f(c, [[2,27],[4,29],[35,28],[38,26],[38,29],[35,32],[4,32],[2,30]],p[2]);
  box(c,6,13,30,14,'#5e7775');
  box(c,6,13,30,2,p[0]);
  box(c,6,25,30,2,p[1]);
  box(c,12,16,24,1,'#e4d9b6');
  box(c,12,24,24,1,'#e4d9b6');
  for (const x of [12,17,33]) box(c,x,20,3,2,'#e9e3c6');
  // Large top-down fighter (20 x 13 pixels): pointed nose, paired wings,
  // slim fuselage and tail. It reads as an aircraft at the map's native 1x.
  f(c, [[16,19],[21,18],[24,13],[27,13],[28,17],[33,18],[37,20],[33,22],[28,23],[27,27],[24,27],[21,23],[16,22]],INK);
  f(c, [[18,19],[22,19],[25,15],[26,15],[27,19],[33,19],[35,20],[33,21],[27,21],[26,25],[25,25],[22,21],[18,21]],'#ecedd5');
  box(c,29,19,4,1,'#b7cbd0');
  box(c,20,17,2,6,'#d4d5c5');
  box(c,24,19,2,3,'#435b5c');
  // Side island projects above the runway but stays outside its center.
  f(c, [[3,15],[4,7],[8,4],[13,6],[14,15],[12,19],[4,19]],INK);
  f(c, [[5,14],[5,8],[8,5],[12,7],[12,15],[10,17],[5,17]],p[1]);
  box(c,6,9,6,4,'#d8dac8');
  box(c,7,10,4,2,'#7baab0');
  box(c,9,2,2,3,INK);
  box(c,8,2,5,1,PALE);
  box(c,4,20,2,5,p[3]);
}
export const SEA_UNIT_TYPES = Object.freeze([
  'battleship', 'cruiser', 'lander', 'submarine', 'repair_boat', 'carrier',
]);

export function paintSeaUnit(ctx, type, palette) {
  switch (type) {
    case 'battleship': return battleship(ctx, palette);
    case 'cruiser': return cruiser(ctx, palette);
    case 'lander': return lander(ctx, palette);
    case 'submarine': return submarine(ctx, palette);
    case 'repair_boat': return repairBoat(ctx, palette);
    case 'carrier': return carrier(ctx, palette);
    default: throw new RangeError(`Unknown sea unit: ${type}`);
  }
}
