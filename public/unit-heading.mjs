// Native 40px top views for the expanded roster. The approved side-facing
// artwork remains in unit-art.mjs; these frames keep masts, rotors and turrets
// upright when a unit travels north or south.
const INK = "#23383b";
const STEEL = "#526863";
const GLASS = "#acd0c1";
const GOLD = "#e9d49b";
const AIR = new Set(["interceptor", "bomber", "attack_heli", "transport_heli", "stealth", "drone"]);
const SEA = new Set(["battleship", "cruiser", "lander", "submarine", "repair_boat", "carrier"]);
const LAND = new Set(["aa", "sam", "assault", "siege", "rail"]);

function rect(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(0, Math.round(w)), Math.max(0, Math.round(h)));
}
function poly(ctx, points, color) {
  const ys = points.map((p) => p[1]);
  ctx.fillStyle = color;
  for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(39, Math.ceil(Math.max(...ys))); y++) {
    const hits = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y + .5 && b[1] > y + .5) || (b[1] <= y + .5 && a[1] > y + .5))
        hits.push(a[0] + (y + .5 - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      const x0 = Math.ceil(hits[i] - .5), x1 = Math.ceil(hits[i + 1] - .5);
      if (x1 > x0) ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }
}
function line(ctx, a, b, color, width = 1) {
  const n = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
  for (let i = 0; i <= n; i++) {
    const t = n ? i / n : 0;
    rect(ctx, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, width, width, color);
  }
}
function frame(ctx, direction) {
  const u = direction === "up" ? [0, -1] : [0, 1];
  const v = [-u[1], u[0]];
  const at = (a, b = 0) => [20 + u[0] * a + v[0] * b, 20 + u[1] * a + v[1] * b];
  return {
    at,
    hull(points, color) { poly(ctx, points.map(([a, b]) => at(a, b)), color); },
    stroke(a, b, color, width) { line(ctx, at(...a), at(...b), color, width); },
    mark(a, b, w, h, color) { const [x, y] = at(a, b); rect(ctx, x - w / 2, y - h / 2, w, h, color); },
  };
}
function land(ctx, type, p, f, phase, action) {
  const heavy = type === "siege" || type === "rail";
  const wheel = type === "sam" || type === "aa";
  const width = heavy ? 14 : 12;
  for (const side of [-1, 1]) {
    f.hull([[-15, side * (width - 2)], [-15, side * (width + 2)], [15, side * (width + 2)], [15, side * (width - 2)]], INK);
    f.stroke([-13, side * width], [13, side * width], STEEL, wheel ? 3 : 4);
    for (const station of [-10, 0, 10]) f.mark(station, side * width, wheel ? 4 : 3, 3,
      action === "move" && Math.floor(phase * 8) % 2 ? "#acb7a1" : "#899b8d");
  }
  f.hull([[-16,-width+2],[12,-width+2],[17,-7],[17,7],[12,width-2],[-16,width-2]], INK);
  f.hull([[-14,-width+3],[11,-width+3],[15,-6],[15,6],[11,width-3],[-14,width-3]], p[1]);
  f.hull([[4,-width+3],[13,-width+3],[16,-6],[16,6],[13,width-3],[4,width-3]], p[0]);
  f.stroke([-13,-width+4],[-13,width-4],p[3],2);
  if (type === "sam") {
    f.mark(-4,0,16,13,INK); f.mark(-4,0,14,11,p[2]);
    for (const side of [-1,1]) for (const station of [-8,0]) {
      f.hull([[station,side*3],[station+10,side*3],[station+10,side*6],[station,side*6]],INK);
      f.stroke([station+1,side*4],[station+8,side*4],"#e4dfbb",2);
    }
    f.mark(9,-8,7,5,INK); f.mark(9,-8,5,3,GLASS);
  } else if (type === "aa") {
    f.mark(-1,0,15,14,INK); f.mark(-1,0,12,11,p[2]);
    for (const side of [-3,3]) {
      f.stroke([4,side],[18,side],INK,3); f.stroke([5,side],[17,side],"#abb8aa",1);
    }
    f.mark(-5,-1,5,3,GLASS);
  } else if (type === "rail") {
    f.mark(-3,0,20,17,INK); f.mark(-3,0,18,15,p[2]);
    for (const side of [-4,4]) {
      f.stroke([-1,side],[19,side],INK,4); f.stroke([0,side],[17,side],"#b6c8bd",2);
    }
    f.mark(-8,0,6,5,"#a9e1d2");
  } else {
    const siege = type === "siege";
    f.mark(-2,0,siege ? 20 : 15,siege ? 17 : 13,INK);
    f.mark(-2,0,siege ? 18 : 13,siege ? 15 : 11,p[2]);
    f.mark(-5,-2,6,4,p[0]);
    f.stroke([2,0],[19,0],INK,siege ? 6 : 4);
    f.stroke([3,0],[17,0],"#b8bba4",siege ? 3 : 2);
  }
}
function air(ctx, type, p, f, phase, action) {
  const helicopter = type === "attack_heli" || type === "transport_heli";
  if (type === "drone") {
    for (const a of [-10,9]) for (const b of [-11,11]) {
      f.stroke([a*.35,b*.4],[a,b],INK,2);
      f.mark(a,b,7,5,INK); f.mark(a,b,5,3,p[2]);
      f.stroke([a-3,b],[a+3,b],phase < .5 ? p[0] : "#d4e2d3",1);
    }
    f.hull([[-14,-3],[10,-3],[16,0],[10,3],[-14,3]],INK);
    f.hull([[-12,-2],[9,-2],[14,0],[9,2],[-12,2]],p[1]);
    f.mark(-1,0,7,6,"#eab073");
    return;
  }
  if (helicopter) {
    const wide = type === "transport_heli";
    f.hull([[-18,-2],[-9,-2],[-7,wide?-7:-5],[8,wide?-7:-5],[17,-3],[19,0],
      [17,3],[8,wide?7:5],[-7,wide?7:5],[-9,2],[-18,2]],INK);
    f.hull([[-16,-1],[-8,-1],[-6,wide?-6:-4],[8,wide?-6:-4],[16,-2],[17,0],
      [16,2],[8,wide?6:4],[-6,wide?6:4],[-8,1],[-16,1]],p[1]);
    f.hull([[1,-4],[10,-4],[16,-1],[16,1],[10,4],[1,4]],p[0]);
    f.mark(11,-1,5,3,GLASS);
    if (wide) { f.mark(-4,4,9,5,STEEL); f.stroke([-8,7],[3,7],GOLD,2); }
    else for (const side of [-1,1]) { f.mark(2,side*8,8,3,INK); f.mark(4,side*8,4,2,GOLD); }
    const blade = Math.floor(phase * (action === "move" ? 8 : 5)) % 4;
    const a = blade % 2 ? [-13,-9] : [-2,-15], b = blade % 2 ? [10,9] : [2,15];
    f.stroke(a,b,INK,2); f.stroke(a,b,"#ced8c7",1);
    f.mark(-2,0,4,4,INK);
    return;
  }
  if (type === "stealth") {
    f.hull([[-16,-4],[-8,-10],[-2,-16],[7,-12],[19,0],[7,12],[-2,16],[-8,10],[-16,4]],INK);
    f.hull([[-14,-3],[-7,-9],[-1,-14],[7,-10],[17,0],[7,10],[-1,14],[-7,9],[-14,3]],p[1]);
    f.hull([[-10,-4],[4,-8],[14,0],[3,1]],p[0]);
    f.mark(9,0,5,3,GLASS);
    return;
  }
  const bomber = type === "bomber";
  for (const side of [-1,1]) {
    f.hull([[6,side*4],[-9,side*5],[-12,side*(bomber?17:15)],
      [bomber?2:-7,side*(bomber?17:15)],[9,side*5]],INK);
    f.hull([[5,side*5],[-8,side*6],[-10,side*(bomber?15:13)],
      [bomber?0:-6,side*(bomber?15:13)],[7,side*6]],p[1]);
    f.stroke([-7,side*(bomber?13:11)],[0,side*(bomber?13:11)],p[0]);
    if (bomber) f.mark(-3,side*8,8,5,STEEL);
    else f.hull([[-15,side*2],[-17,side*8],[-8,side*4]],p[2]);
  }
  f.hull([[-17,-4],[7,-4],[16,-2],[19,0],[16,2],[7,4],[-17,4]],INK);
  f.hull([[-15,-3],[7,-3],[14,-1],[17,0],[14,1],[7,3],[-15,3]],p[1]);
  f.stroke([-12,-1],[11,-1],p[0]);
  f.mark(9,0,5,4,GLASS);
}
function sea(ctx, type, p, f, phase, action) {
  const breadth = ({ battleship:11, cruiser:9, lander:12, submarine:7, repair_boat:9, carrier:14 })[type];
  const square = type === "lander" || type === "carrier";
  f.hull([[-16,-breadth+3],[-12,-breadth],[10,-breadth],[square?17:14,-breadth+2],
    [square?17:18,0],[square?17:14,breadth-2],[10,breadth],[-12,breadth],[-16,breadth-3]],INK);
  f.hull([[-14,-breadth+3],[-10,-breadth+2],[10,-breadth+2],[square?15:13,-breadth+2],
    [square?15:16,0],[square?15:13,breadth-2],[10,breadth-2],[-10,breadth-2],[-14,breadth-3]],p[2]);
  f.hull([[-11,-breadth+4],[12,-breadth+4],[12,breadth-4],[-11,breadth-4]],
    type === "carrier" ? STEEL : p[0]);
  if (type === "battleship") {
    for (const station of [-8,6]) {
      f.mark(station,0,9,8,INK); f.mark(station,0,7,6,p[1]);
      for (const side of [-2,2]) f.stroke([station+2,side],[station+10,side],INK,2);
    }
    f.mark(-1,-1,9,8,p[2]); f.mark(-2,-2,5,2,GLASS);
  } else if (type === "cruiser") {
    f.mark(-5,-1,11,10,INK); f.mark(-5,-1,9,8,"#d5d8c4");
    f.stroke([-6,-6],[-6,-12],INK,2); f.stroke([-11,-12],[-1,-12],GOLD,2);
    f.mark(8,0,8,7,p[1]);
  } else if (type === "lander") {
    f.mark(-1,0,20,15,INK); f.mark(-1,0,16,12,STEEL);
    f.mark(-6,-8,6,7,p[1]); f.stroke([15,-8],[15,8],GOLD,2);
  } else if (type === "submarine") {
    f.mark(-1,0,9,7,INK); f.mark(-1,0,7,5,p[1]);
    f.stroke([-1,-4],[-1,-10],INK,2); f.mark(0,-10,4,2,GLASS);
  } else if (type === "repair_boat") {
    f.mark(-6,-2,10,9,INK); f.mark(-6,-2,8,7,p[1]);
    f.stroke([-4,-3],[-4,1],GOLD,2); f.stroke([-6,-1],[-2,-1],GOLD,2);
    f.stroke([1,-6],[11,-10],INK,3); f.mark(10,-6,5,4,GOLD);
  } else {
    f.hull([[-12,-10],[13,-10],[13,10],[-12,10]],STEEL);
    for (const station of [-9,-2,5,12]) f.stroke([station,0],[station+2,0],GOLD,2);
    f.mark(-8,-11,8,7,INK); f.mark(-8,-11,6,5,p[1]);
    f.stroke([1,-6],[8,-6],INK,2); f.stroke([4,-11],[4,-1],"#e3ead6",2);
  }
  if (action === "move") {
    const drift = Math.floor(phase * 5);
    for (const side of [-1,1]) f.stroke([-18-drift,side*6],[-15-drift,side*6],"#b9dfd5");
  }
}

export function paintUnitHeading(ctx, type, palette, direction, phase = 0, action = "idle") {
  if (direction !== "up" && direction !== "down") return false;
  const f = frame(ctx, direction);
  ctx.save();
  if (action === "idle" && phase > .28 && phase < .58) ctx.translate(0, -1);
  if (action === "hit" && phase > .18 && phase < .46) ctx.filter = "brightness(1.9) saturate(.3)";
  if (LAND.has(type)) land(ctx, type, palette, f, phase, action);
  else if (AIR.has(type)) air(ctx, type, palette, f, phase, action);
  else if (SEA.has(type)) sea(ctx, type, palette, f, phase, action);
  else { ctx.restore(); return false; }
  ctx.restore();
  if (action === "attack" && phase > .32 && phase < .47) {
    const [x, y] = f.at(19, 0);
    rect(ctx, x - 3, y - 3, 7, 7, "#ffe3a2");
    rect(ctx, x - 1, y - 5, 3, 11, "#fff4c9");
  }
  return true;
}
