import { paintUnitArtwork } from "./unit-art.mjs";

const sprites = new Map();
const infantry = new Set(["infantry", "mech"]);
const tracked = new Set(["tank", "heavy", "artillery", "apc", "assault", "siege", "rail"]);
const wheeled = new Set(["recon", "rocket", "aa", "sam"]);
const helicopters = new Set(["attack_heli", "transport_heli"]);
const aircraft = new Set(["interceptor", "bomber", "stealth", "drone", ...helicopters]);
const ships = new Set(["battleship", "cruiser", "lander", "submarine", "repair_boat", "carrier"]);

function box(ctx, x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

function leg(ctx, x, knee, foot, shade) {
  box(ctx, x, 25, 5, 3, "#243b3c");
  box(ctx, x + 1, 26, 3, 2, shade);
  box(ctx, knee, 28, 4, 3, "#243b3c");
  box(ctx, knee + 1, 28, 2, 2, shade);
  box(ctx, foot, 31, 7, 2, "#243b3c");
  box(ctx, foot + 1, 31, 4, 1, "#83917a");
}

function sprite(type, palette, gait = -1) {
  const key = `${type}:${palette[0]}:${gait}`;
  if (sprites.has(key)) return sprites.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 40;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  paintUnitArtwork(ctx, type, palette);
  // The approved helicopter drawing has a fixed rotor for still previews.
  // Remove that strip so the live blade can genuinely change angle.
  if (helicopters.has(type)) ctx.clearRect(0, 4, 40, 6);
  if (gait >= 0 && infantry.has(type)) {
    ctx.clearRect(10, 26, 20, 8);
    const steps = [
      [-2, 3, 1, -1], [0, 2, 2, -2], [2, 1, 4, -3],
      [2, -2, 3, -1], [0, -3, 1, 2], [-2, -1, -1, 3],
    ];
    const [near, far, nearFoot, farFoot] = steps[gait % 6];
    leg(ctx, 12, 12 + near, 10 + nearFoot, "#52655a");
    leg(ctx, 21, 21 + far, 22 + farFoot, "#718171");
    if (type === "mech") {
      const sway = gait < 3 ? 0 : 1;
      box(ctx, 8 + sway, 23 + (gait % 3 === 2 ? 1 : 0), 3, 3, "#64765d");
      box(ctx, 9 + sway, 24 + (gait % 3 === 2 ? 1 : 0), 1, 1, "#b8be97");
    }
  } else if (gait >= 0 && tracked.has(type)) {
    for (let x = 6; x < 27; x += 5)
      box(ctx, x + (gait % 2), 29, 2, 1, "#b7bba3");
  } else if (gait >= 0 && wheeled.has(type)) {
    for (const x of type === "recon" ? [8, 24] : [6, 14, 26])
      box(ctx, x + (gait % 2), 29, 2, 1, "#d1d4b0");
  }
  sprites.set(key, canvas);
  return canvas;
}

function rotor(ctx, type, phase) {
  const hub = type === "transport_heli" ? 21 : 20;
  const half = type === "transport_heli" ? 18 : 16;
  const blade = Math.floor(phase * 8) % 4;
  const points = blade === 0 ? [[hub-half,6],[hub+half,6]]
    : blade === 1 ? [[hub-half+2,8],[hub+half-2,4]]
      : blade === 2 ? [[hub,2],[hub,10]]
        : [[hub-half+2,4],[hub+half-2,8]];
  const [a,b] = points;
  const steps = Math.max(Math.abs(a[0]-b[0]),Math.abs(a[1]-b[1]));
  for (let i=0;i<=steps;i++) {
    const t=steps?i/steps:0;
    box(ctx,a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,2,1,"#d8e0cd");
  }
  box(ctx,hub-2,5,5,3,"#23383b");
  box(ctx,hub-1,5,3,1,"#a8b6a9");
  const tail = Math.floor(phase*12)%2;
  box(ctx,3,11+tail,1,6,"#d8e0cd");
  box(ctx,1,14,5,1,"#d8e0cd");
}

function spark(ctx, x, y, size = 3) {
  box(ctx, x - size, y - 1, size * 2 + 1, 3, "#f7cf83");
  box(ctx, x - 1, y - size, 3, size * 2 + 1, "#fff0ae");
  box(ctx, x, y, 2, 2, "#fff9d6");
}

function smoke(ctx, x, y, progress) {
  ctx.globalAlpha = Math.max(0, 1 - progress);
  box(ctx, x + Math.round(progress * 7), y - Math.round(progress * 8), 4, 3, "#e4e1c0");
  ctx.globalAlpha = 1;
}

function attackEffect(ctx, type, phase) {
  if (phase < .3 || phase > .78) return;
  const fire = (phase - .3) / .48;
  const muzzle = {
    infantry: [34, 18], mech: [36, 16], recon: [35, 22],
    tank: [38, 13], heavy: [38, 15], artillery: [35, 7], rocket: [25, 10],
    aa: [36, 15], sam: [31, 10], assault: [38, 12], siege: [39, 11], rail: [38, 14],
    interceptor: [38, 19], bomber: [36, 23], attack_heli: [38, 27], stealth: [37, 18], drone: [37, 18],
    battleship: [38, 13], cruiser: [37, 18], submarine: [36, 19], carrier: [35, 14],
  }[type];
  if (!muzzle) return;
  const [x, y] = muzzle;
  if (["rocket", "sam", "attack_heli", "carrier"].includes(type)) {
    for (let i = 0; i < 3; i++) {
      const flight = fire * 3 - i;
      if (flight < 0 || flight > 1) continue;
      const px = x + Math.round(flight * 30);
      const py = y - Math.round(flight * 15) + i * 4;
      box(ctx, px - 6, py + 1, 6, 2, "#f7b76e");
      box(ctx, px, py, 7, 3, "#d6dbba");
      box(ctx, px + 5, py, 2, 3, "#273f3d");
    }
    smoke(ctx, 18, 16, fire);
  } else if (["artillery", "siege", "battleship"].includes(type)) {
    if (fire < .3) spark(ctx, x, y, 4);
    box(ctx, x + Math.round(fire * 24), y - Math.round(fire * 16), 5, 3, "#344a45");
    smoke(ctx, x - 4, y + 4, fire);
  } else if (type === "mech") {
    if (fire < .25) spark(ctx, x, y, 3);
    const px = x + Math.round(fire * 25);
    box(ctx, px - 5, y + 1, 5, 2, "#f5ac6b");
    box(ctx, px, y, 7, 3, "#d5d9bb");
    smoke(ctx, 7, 18, fire);
  } else if (["recon", "aa", "cruiser", "interceptor"].includes(type)) {
    if (Math.floor(fire * 6) % 2 === 0) spark(ctx, x, y, 2);
  } else {
    if (fire < .32) spark(ctx, x, y, ["heavy", "rail"].includes(type) ? 6 : ["tank", "assault"].includes(type) ? 4 : 2);
    if (["tank", "heavy", "assault", "rail", "submarine"].includes(type)) {
      const px = x + Math.round(fire * 19);
      box(ctx, px, y + 1, 6, 2, "#d8d8be");
      box(ctx, px + 5, y, 2, 4, "#3b534d");
    } else if (type === "infantry" && fire < .55) {
      box(ctx, x + Math.round(fire * 15), y + 1, 5, 1, "#fff0bc");
    }
  }
}

function supplyEffect(ctx, palette, phase) {
  if (phase < .18 || phase > .9) return;
  const progress = (phase - .18) / .72;
  box(ctx, 13, 9, 13, 4, "#243b3c");
  box(ctx, 15, 8, 9, 3, palette[0]);
  box(ctx, 8, 17, 5, 9, palette[3]);
  const px = 31 + Math.round(progress * 22);
  const py = 23 - Math.round(Math.sin(progress * Math.PI) * 5);
  box(ctx, px, py, 8, 6, "#343f37");
  box(ctx, px + 1, py + 1, 6, 4, "#d6bd88");
  box(ctx, px + 3, py + 1, 2, 4, "#edf0d2");
  if (progress > .25) {
    const crewX = 7 - Math.round(Math.min(1, (progress - .25) * 2) * 10);
    box(ctx, crewX, 20, 4, 4, "#243b3c");
    box(ctx, crewX + 1, 20, 2, 2, "#e5bd90");
    box(ctx, crewX, 24, 4, 5, palette[1]);
    box(ctx, crewX, 29, 2, 3, "#263b3b");
    box(ctx, crewX + 3, 29, 2, 3, "#263b3b");
  }
  if (progress > .48) {
    box(ctx, 34, 4, 3, 9, "#d9f3bf");
    box(ctx, 31, 7, 9, 3, "#d9f3bf");
  }
}

export function paintCaptureEffect(ctx, palette, phase) {
  const raised = Math.max(0, Math.min(1, (phase - .12) / .44));
  const height = Math.round(24 * raised);
  if (!height) return;
  const top = 31 - height;
  // The soldier plants a pole, then unfurls the army flag over the building.
  box(ctx, 28, 22, 6, 3, "#243b3c");
  box(ctx, 30, 23, 4, 1, palette[0]);
  box(ctx, 33, top, 2, height + 1, "#273e3b");
  box(ctx, 34, top + 1, 1, Math.max(1, height - 2), "#d9d1a8");
  if (phase > .48) {
    const unfurl = Math.max(1, Math.round(Math.min(1, (phase - .48) / .2) * 12));
    box(ctx, 21, top + 2, unfurl, 7, "#243b3c");
    box(ctx, 22, top + 3, Math.max(1, unfurl - 2), 5, palette[1]);
    box(ctx, 22, top + 3, Math.max(1, unfurl - 3), 2, palette[0]);
  }
  if (phase > .72 && phase < .94) {
    box(ctx, 17, top + 1, 3, 1, "#fff3bc");
    box(ctx, 18, top, 1, 3, "#fff3bc");
  }
}

// Draws only the sprite and its action effects; the renderer owns HP and status badges.
export function paintUnitMotion(ctx, type, palette, motion = {}) {
  const { action = "idle", phase = 0, facing = 1 } = motion;
  const moving = action === "move";
  const gait = moving ? Math.floor(phase * (type === "mech" ? 6 : 8)) : -1;
  let dx = 0, dy = 0;
  if (moving) {
    dx = gait % 4 === 1 ? 1 : 0;
    dy = gait % 3 === 1 ? -1 : 0;
  } else if (action === "idle") {
    dy = phase > .28 && phase < .58 ? -1 : 0;
  } else if (action === "attack") {
    if (phase > .3 && phase < .55) {
      dx = type === "heavy" ? -3 : -2;
      dy = type === "mech" ? 1 : 0;
    }
  } else if (action === "hit") {
    if (phase > .18 && phase < .65) dx = Math.floor(phase * 14) % 2 ? -2 : 2;
  } else if (action === "capture") {
    if (phase > .16 && phase < .72) dy = 2;
  }
  ctx.save();
  if (facing < 0 && action === "attack") {
    ctx.translate(40, 0);
    ctx.scale(-1, 1);
  }
  ctx.translate(dx, dy);
  if (action === "hit" && phase > .18 && phase < .46)
    ctx.filter = "brightness(1.9) saturate(.3)";
  ctx.drawImage(sprite(type, palette, gait), 0, 0);
  if (helicopters.has(type)) rotor(ctx,type,phase);
  if (ships.has(type) && moving) {
    box(ctx, 0, 30 + gait % 2, 5, 1, "#a6d8d4");
    box(ctx, 3, 33, 7, 1, "#85c5c6");
  }
  if (aircraft.has(type) && moving && gait % 2) box(ctx, 8, 36, 20, 1, "rgba(42,70,60,.25)");
  ctx.filter = "none";
  if (moving) {
    for (let i = 0; i < 2; i++)
      box(ctx, 5 - i * 5, 32 + i % 2, 3, 2, i ? "#c6c8ac" : "#e3d8ad");
  } else if (action === "attack") {
    attackEffect(ctx, type, phase);
  } else if (action === "supply" && ["apc", "repair_boat"].includes(type)) {
    supplyEffect(ctx, palette, phase);
  } else if (action === "capture" && infantry.has(type)) {
    paintCaptureEffect(ctx, palette, phase);
  } else if (action === "hit" && phase > .2 && phase < .75) {
    spark(ctx, 22, 13 - Math.round((phase - .2) * 5), 3);
  } else if (action === "idle") {
    if (type === "recon" && phase > .25 && phase < .62)
      box(ctx, 7, 8, 2, 2, "#e7edc6");
    else if (type === "apc" && phase > .25 && phase < .62)
      box(ctx, 15, 19, 2, 1, "#d8e7bb");
    else if (!infantry.has(type) && phase > .2 && phase < .8)
      smoke(ctx, 5, 17, (phase - .2) / .6);
  }
  ctx.restore();
}
