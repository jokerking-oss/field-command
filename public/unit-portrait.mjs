import { paintUnitArtwork } from "./unit-art.mjs";

const cache = new Map();

/** Native-size procedural portrait for units without a media thumbnail. */
export function unitPortraitDataUrl(type, palette) {
  const key = `${type}:${palette.join(":")}`;
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement("canvas");
  canvas.width = 40;
  canvas.height = 40;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#233936";
  ctx.fillRect(0, 0, 40, 40);
  paintUnitArtwork(ctx, type, palette);
  const url = canvas.toDataURL("image/png");
  cache.set(key, url);
  return url;
}
