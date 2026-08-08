import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

function crc32(buf) {
  let c = ~0;
  for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); }
  return ~c >>> 0;
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}
function png(size, rgba) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Logo: three lines of text shrinking away, the middle one lit as the focus word.
const GRID = 128;
const INDIGO = [99, 102, 241];
const WHITE = [255, 255, 255];
const AMBER = [251, 191, 36];
const TILE = { x: 4, y: 4, w: 120, h: 120, r: 30 };
const BARS = [
  { x: 26, y: 33, w: 76, h: 15, r: 7, fill: WHITE },
  { x: 26, y: 57, w: 56, h: 15, r: 7, fill: AMBER },
  { x: 26, y: 81, w: 36, h: 15, r: 7, fill: WHITE },
];

function inRoundRect(px, py, { x, y, w, h, r }) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const cx = Math.min(Math.max(px, x + r), x + w - r);
  const cy = Math.min(Math.max(py, y + r), y + h - r);
  const dx = px - cx, dy = py - cy;
  return dx === 0 || dy === 0 || dx * dx + dy * dy <= r * r;
}

function sample(px, py) {
  for (const bar of BARS) if (inRoundRect(px, py, bar)) return bar.fill;
  return inRoundRect(px, py, TILE) ? INDIGO : null;
}

/** 4x supersampled so the rounded tile still looks clean at 16px. */
function icon(size) {
  const SS = 4;
  const out = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const px = ((x + (sx + 0.5) / SS) / size) * GRID;
          const py = ((y + (sy + 0.5) / SS) / size) * GRID;
          const hit = sample(px, py);
          if (!hit) continue;
          r += hit[0]; g += hit[1]; b += hit[2]; a += 255;
        }
      }
      const covered = a / 255;
      const o = (y * size + x) * 4;
      if (covered === 0) continue;
      out[o] = Math.round(r / covered);
      out[o + 1] = Math.round(g / covered);
      out[o + 2] = Math.round(b / covered);
      out[o + 3] = Math.round(a / (SS * SS));
    }
  }
  return png(size, out);
}

function svg() {
  const bars = BARS.map((bar) =>
    `  <rect x="${bar.x}" y="${bar.y}" width="${bar.w}" height="${bar.h}" rx="${bar.r}" fill="rgb(${bar.fill.join(',')})"/>`,
  ).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" role="img" aria-label="Rapid Reader">
  <rect x="${TILE.x}" y="${TILE.y}" width="${TILE.w}" height="${TILE.h}" rx="${TILE.r}" fill="rgb(${INDIGO.join(',')})"/>
${bars}
</svg>
`;
}

mkdirSync('public/icons', { recursive: true });
for (const size of [16, 48, 128]) writeFileSync(`public/icons/icon${size}.png`, icon(size));
writeFileSync('public/icons/logo.svg', svg());
