/**
 * 生成测试用电子印章 PNG（透明背景，红色圆环+五角星）
 * 仅用于本地功能验证，非真实公章。
 * 运行: node scripts/generate-test-seal.mjs
 */
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../assets/test-seal.png');
const SIZE = 512;
const CX = SIZE / 2;
const CY = SIZE / 2;

// ---------- PNG 编码 ----------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ---------- 绘制 ----------
const RED = [220, 40, 40];

function dist(x, y) {
  return Math.sqrt((x - CX) ** 2 + (y - CY) ** 2);
}

function inStar(x, y) {
  const dx = x - CX;
  const dy = y - CY;
  const r = Math.sqrt(dx * dx + dy * dy);
  const ang = Math.atan2(dy, dx);
  const sector = Math.round(ang / (Math.PI / 5)); // 10 个扇区
  const isTip = ((sector % 2) + 2) % 2 === 0;
  const maxR = isTip ? 78 : 34;
  return r <= maxR;
}

const px = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4;
    const d = dist(x, y);
    let fill = false;
    if (d >= 218 && d <= 242) fill = true; // 外圈
    else if (d >= 160 && d <= 176) fill = true; // 内圈
    else if (inStar(x, y)) fill = true; // 五角星
    if (fill) {
      px[i] = RED[0];
      px[i + 1] = RED[1];
      px[i + 2] = RED[2];
      px[i + 3] = 255;
    }
    // 其余透明
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, encodePng(SIZE, SIZE, px));
console.log(`测试印章已生成: ${OUT}`);
