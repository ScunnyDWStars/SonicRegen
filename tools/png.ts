import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { PixelImage } from '../src/art/pixels';

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

/** Encode a PixelImage as PNG, optionally scaled up by an integer factor. */
export function encodePng(img: PixelImage, scale = 1): Buffer {
  const w = img.w * scale,
    h = img.h * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const c = img.data[Math.floor(y / scale) * img.w + Math.floor(x / scale)]!;
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = c & 255;
      raw[o + 1] = (c >>> 8) & 255;
      raw[o + 2] = (c >>> 16) & 255;
      raw[o + 3] = (c >>> 24) & 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', new Uint8Array(0)),
  ]);
}

export function writePng(path: string, img: PixelImage, scale = 1): void {
  writeFileSync(path, encodePng(img, scale));
}

/** Lay out frames in a grid on a background colour. */
export function sheet(frames: PixelImage[], cols: number, bg: number): PixelImage {
  const fw = Math.max(...frames.map((f) => f.w)),
    fh = Math.max(...frames.map((f) => f.h));
  const rows = Math.ceil(frames.length / cols);
  const out = new PixelImage(cols * fw, rows * fh).fill(bg);
  frames.forEach((f, i) => out.blit(f, (i % cols) * fw, Math.floor(i / cols) * fh));
  return out;
}
