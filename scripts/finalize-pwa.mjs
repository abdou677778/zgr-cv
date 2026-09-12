import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";

const crcTable = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function insideRoundedRectangle(x, y, left, top, right, bottom, radius) {
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  const deltaX = x - nearestX;
  const deltaY = y - nearestY;
  return deltaX * deltaX + deltaY * deltaY <= radius * radius;
}

function createIcon(size) {
  const stride = size * 4 + 1;
  const pixels = Buffer.alloc(stride * size);
  const burgundy = [107, 0, 55, 255];
  const white = [255, 255, 255, 255];
  const paleBlue = [217, 226, 243, 255];
  for (let y = 0; y < size; y += 1) {
    const row = y * stride;
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      const scale = size / 512;
      const inPage = insideRoundedRectangle(x, y, 84 * scale, 104 * scale, 428 * scale, 408 * scale, 56 * scale);
      const inBadge = (x - 350 * scale) ** 2 + (y - 315 * scale) ** 2 <= (39 * scale) ** 2;
      const inLine =
        insideRoundedRectangle(x, y, 142 * scale, 162 * scale, 370 * scale, 192 * scale, 15 * scale) ||
        insideRoundedRectangle(x, y, 142 * scale, 231 * scale, 370 * scale, 261 * scale, 15 * scale) ||
        insideRoundedRectangle(x, y, 142 * scale, 300 * scale, 292 * scale, 330 * scale, 15 * scale);
      const color = inLine ? burgundy : inBadge ? paleBlue : inPage ? white : burgundy;
      const offset = row + 1 + x * 4;
      pixels.set(color, offset);
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(pixels)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const outputDirectory = resolve("dist-spa");
const indexHtml = await readFile(resolve(outputDirectory, "index.html"), "utf8");
const template = await readFile(resolve("scripts", "sw-template.js"), "utf8");
const buildId = (process.env.VITE_ZGR_BUILD_ID || "local").replace(/[^a-zA-Z0-9_-]/g, "-");
const assetUrls = [...indexHtml.matchAll(/(?:src|href)="(\.\/assets\/[^"]+)"/g)].map(
  (match) => match[1],
);
const precacheUrls = [
  "./index.html",
  "./manifest.webmanifest",
  "./icons/zgr-cv-192.png",
  "./icons/zgr-cv-512.png",
  "./icons/zgr-cv.svg",
  ...assetUrls,
];
const serviceWorker = template
  .replaceAll("__BUILD_ID__", buildId)
  .replace("__PRECACHE_URLS__", JSON.stringify([...new Set(precacheUrls)], null, 2));

await Promise.all([
  writeFile(resolve(outputDirectory, "sw.js"), serviceWorker, "utf8"),
  writeFile(resolve(outputDirectory, "icons", "zgr-cv-192.png"), createIcon(192)),
  writeFile(resolve(outputDirectory, "icons", "zgr-cv-512.png"), createIcon(512)),
]);
console.log(`PWA finalisée (${buildId}) : ${new Set(precacheUrls).size} ressources essentielles.`);
