// generate-png-icons.js - Generates solid branded PNG icons for PWA
import fs from 'fs';
import zlib from 'zlib';

function createPng(width, height, r, g, b) {
  // Simple uncompressed/deflated raw RGBA PNG generator
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData.writeUInt8(8, 8); // bit depth
  ihdrData.writeUInt8(6, 9); // color type RGBA
  ihdrData.writeUInt8(0, 10); // compression
  ihdrData.writeUInt8(0, 11); // filter
  ihdrData.writeUInt8(0, 12); // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = width * 4 + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  const cx = width / 2;
  const cy = height / 2;
  const outerR = width * 0.45;
  const ringR = width * 0.35;
  const ringWidth = width * 0.05;

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // Filter type None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Background rounded squircle / circle
      if (dist <= outerR) {
        // In dark container
        let pr = 15, pg = 23, pb = 42, pa = 255;
        // Ring
        if (Math.abs(dist - ringR) < ringWidth) {
          pr = 16; pg = 185; pb = 129; // emerald
        } else if (dist < ringR * 0.4) {
          pr = 244; pg = 63; pb = 94; // rose flame
        }
        rawData[pxOffset] = pr;
        rawData[pxOffset + 1] = pg;
        rawData[pxOffset + 2] = pb;
        rawData[pxOffset + 3] = pa;
      } else {
        // Transparent
        rawData[pxOffset] = 0;
        rawData[pxOffset + 1] = 0;
        rawData[pxOffset + 2] = 0;
        rawData[pxOffset + 3] = 0;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = data.length;
  const buf = Buffer.alloc(12 + length);
  buf.writeUInt32BE(length, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crc = crc32(buf.slice(4, 8 + length));
  buf.writeInt32BE(crc, 8 + length);
  return buf;
}

// CRC32 table
const crcTable = new Int32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

fs.writeFileSync('icons/icon-192.png', createPng(192, 192, 16, 185, 129));
fs.writeFileSync('icons/icon-512.png', createPng(512, 512, 16, 185, 129));
console.log('Icons generated successfully!');
