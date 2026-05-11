import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const WIDTH = 512;
const HEIGHT = 320;
const OUTPUT_DIR = path.resolve("apps/mobile/assets/images");

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function color(hex, alpha = 1) {
  const value = hex.replace("#", "");
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
    a: Math.max(0, Math.min(1, alpha)),
  };
}

function createCanvas(width, height) {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  };
}

function blendPixel(canvas, x, y, drawColor, coverage = 1) {
  if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const alpha = Math.max(0, Math.min(1, drawColor.a * coverage));
  if (alpha <= 0) return;

  const i = (Math.floor(y) * canvas.width + Math.floor(x)) * 4;
  const destR = canvas.data[i];
  const destG = canvas.data[i + 1];
  const destB = canvas.data[i + 2];
  const destA = canvas.data[i + 3] / 255;

  const outA = alpha + destA * (1 - alpha);
  if (outA <= 0) return;

  const outR = (drawColor.r * alpha + destR * destA * (1 - alpha)) / outA;
  const outG = (drawColor.g * alpha + destG * destA * (1 - alpha)) / outA;
  const outB = (drawColor.b * alpha + destB * destA * (1 - alpha)) / outA;

  canvas.data[i] = Math.round(outR);
  canvas.data[i + 1] = Math.round(outG);
  canvas.data[i + 2] = Math.round(outB);
  canvas.data[i + 3] = Math.round(outA * 255);
}

function fillRect(canvas, x, y, width, height, fillColor) {
  const xStart = Math.floor(Math.max(0, x));
  const yStart = Math.floor(Math.max(0, y));
  const xEnd = Math.ceil(Math.min(canvas.width, x + width));
  const yEnd = Math.ceil(Math.min(canvas.height, y + height));

  for (let py = yStart; py < yEnd; py += 1) {
    for (let px = xStart; px < xEnd; px += 1) {
      blendPixel(canvas, px, py, fillColor, 1);
    }
  }
}

function fillRoundedRect(canvas, x, y, width, height, radius, fillColor) {
  const xEnd = x + width;
  const yEnd = y + height;
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));

  const minX = Math.floor(Math.max(0, x));
  const minY = Math.floor(Math.max(0, y));
  const maxX = Math.ceil(Math.min(canvas.width, xEnd));
  const maxY = Math.ceil(Math.min(canvas.height, yEnd));

  for (let py = minY; py < maxY; py += 1) {
    for (let px = minX; px < maxX; px += 1) {
      const dx = px + 0.5 < x + r ? x + r - (px + 0.5) : px + 0.5 > xEnd - r ? px + 0.5 - (xEnd - r) : 0;
      const dy = py + 0.5 < y + r ? y + r - (py + 0.5) : py + 0.5 > yEnd - r ? py + 0.5 - (yEnd - r) : 0;
      if (dx * dx + dy * dy <= r * r) {
        blendPixel(canvas, px, py, fillColor, 1);
      }
    }
  }
}

function drawCircle(canvas, cx, cy, radius, fillColor, edgeSoftness = 1.35) {
  const minX = Math.floor(cx - radius - edgeSoftness - 1);
  const maxX = Math.ceil(cx + radius + edgeSoftness + 1);
  const minY = Math.floor(cy - radius - edgeSoftness - 1);
  const maxY = Math.ceil(cy + radius + edgeSoftness + 1);

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const edge = radius - distance;
      let coverage = 0;

      if (edge >= edgeSoftness) {
        coverage = 1;
      } else if (edge > -edgeSoftness) {
        coverage = (edge + edgeSoftness) / (2 * edgeSoftness);
      }

      if (coverage > 0) {
        blendPixel(canvas, px, py, fillColor, coverage);
      }
    }
  }
}

function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function drawSegment(canvas, x1, y1, x2, y2, width, strokeColor) {
  const radius = width / 2;
  const soft = 1.25;
  const minX = Math.floor(Math.min(x1, x2) - radius - soft - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + radius + soft + 1);
  const minY = Math.floor(Math.min(y1, y2) - radius - soft - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + radius + soft + 1);

  for (let py = minY; py <= maxY; py += 1) {
    for (let px = minX; px <= maxX; px += 1) {
      const distance = pointToSegmentDistance(px + 0.5, py + 0.5, x1, y1, x2, y2);
      const edge = radius - distance;
      let coverage = 0;

      if (edge >= soft) {
        coverage = 1;
      } else if (edge > -soft) {
        coverage = (edge + soft) / (2 * soft);
      }

      if (coverage > 0) {
        blendPixel(canvas, px, py, strokeColor, coverage);
      }
    }
  }

  drawCircle(canvas, x1, y1, radius, strokeColor, 1);
  drawCircle(canvas, x2, y2, radius, strokeColor, 1);
}

function drawPolyline(canvas, points, width, strokeColor) {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    drawSegment(canvas, x1, y1, x2, y2, width, strokeColor);
  }
}

function drawTriangle(canvas, p1, p2, p3, fillColor) {
  const minX = Math.floor(Math.min(p1[0], p2[0], p3[0]));
  const maxX = Math.ceil(Math.max(p1[0], p2[0], p3[0]));
  const minY = Math.floor(Math.min(p1[1], p2[1], p3[1]));
  const maxY = Math.ceil(Math.max(p1[1], p2[1], p3[1]));

  const area = (p2[1] - p3[1]) * (p1[0] - p3[0]) + (p3[0] - p2[0]) * (p1[1] - p3[1]);
  if (area === 0) return;

  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w1 = ((p2[1] - p3[1]) * (px - p3[0]) + (p3[0] - p2[0]) * (py - p3[1])) / area;
      const w2 = ((p3[1] - p1[1]) * (px - p3[0]) + (p1[0] - p3[0]) * (py - p3[1])) / area;
      const w3 = 1 - w1 - w2;
      if (w1 >= 0 && w2 >= 0 && w3 >= 0) {
        blendPixel(canvas, x, y, fillColor, 1);
      }
    }
  }
}

function drawArcPoints(cx, cy, radius, start, end, steps) {
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = start + ((end - start) * i) / steps;
    points.push([cx + Math.cos(t) * radius, cy + Math.sin(t) * radius]);
  }
  return points;
}

function createClockWave() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const stroke = color("#1B1720", 0.76);
  const soft = color("#1B1720", 0.38);

  drawPolyline(
    canvas,
    [
      [36, 226],
      [86, 158],
      [142, 172],
      [194, 202],
      [252, 161],
      [302, 132],
      [350, 170],
      [406, 182],
      [474, 121],
    ],
    11,
    soft,
  );
  drawPolyline(
    canvas,
    [
      [36, 226],
      [86, 158],
      [142, 172],
      [194, 202],
      [252, 161],
      [302, 132],
      [350, 170],
      [406, 182],
      [474, 121],
    ],
    6,
    stroke,
  );

  drawPolyline(canvas, drawArcPoints(124, 112, 62, 0, Math.PI * 2, 140), 5, color("#201C25", 0.64));
  drawSegment(canvas, 124, 112, 124, 78, 5, color("#201C25", 0.68));
  drawSegment(canvas, 124, 112, 151, 131, 5, color("#201C25", 0.68));

  drawCircle(canvas, 346, 212, 11, color("#201C25", 0.55));
  drawCircle(canvas, 428, 96, 8, color("#201C25", 0.4));

  return canvas;
}

function createSessionPath() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const lineMain = color("#1A170D", 0.76);
  const lineSoft = color("#1A170D", 0.36);

  const points = [
    [54, 244],
    [122, 146],
    [206, 102],
    [296, 142],
    [378, 169],
    [456, 88],
  ];

  drawPolyline(canvas, points, 12, lineSoft);
  drawPolyline(canvas, points, 6.5, lineMain);

  drawCircle(canvas, 54, 244, 13, color("#1A170D", 0.72));
  drawCircle(canvas, 296, 142, 13, color("#1A170D", 0.72));
  drawCircle(canvas, 456, 88, 13, color("#1A170D", 0.72));

  drawTriangle(canvas, [206, 160], [256, 186], [206, 212], color("#1A170D", 0.7));
  fillRoundedRect(canvas, 344, 182, 96, 58, 30, color("#1A170D", 0.15));
  drawPolyline(
    canvas,
    [
      [344, 182],
      [440, 182],
      [440, 240],
      [344, 240],
      [344, 182],
    ],
    3,
    color("#1A170D", 0.34),
  );

  return canvas;
}

function createIncomeSpark() {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const barColor = color("#1C1620", 0.58);
  const strong = color("#1C1620", 0.78);

  fillRoundedRect(canvas, 52, 178, 45, 102, 13, barColor);
  fillRoundedRect(canvas, 120, 146, 45, 134, 13, barColor);
  fillRoundedRect(canvas, 188, 112, 45, 168, 13, barColor);
  fillRoundedRect(canvas, 256, 80, 45, 200, 13, barColor);

  drawPolyline(
    canvas,
    [
      [52, 222],
      [96, 186],
      [146, 194],
      [190, 152],
      [234, 116],
      [282, 98],
      [338, 88],
      [388, 66],
      [450, 86],
    ],
    11,
    color("#1C1620", 0.28),
  );
  drawPolyline(
    canvas,
    [
      [52, 222],
      [96, 186],
      [146, 194],
      [190, 152],
      [234, 116],
      [282, 98],
      [338, 88],
      [388, 66],
      [450, 86],
    ],
    5.5,
    strong,
  );

  drawPolyline(canvas, drawArcPoints(426, 118, 42, 0, Math.PI * 2, 120), 4, color("#1C1620", 0.46));
  drawSegment(canvas, 404, 118, 448, 118, 4, color("#1C1620", 0.62));
  drawSegment(canvas, 426, 96, 426, 140, 4, color("#1C1620", 0.62));

  return canvas;
}

function buildCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const CRC_TABLE = buildCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const lengthBuffer = Buffer.alloc(4);
  lengthBuffer.writeUInt32BE(data.length, 0);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function encodePng(canvas) {
  const scanlines = Buffer.alloc((canvas.width * 4 + 1) * canvas.height);
  for (let y = 0; y < canvas.height; y += 1) {
    const rowStart = y * (canvas.width * 4 + 1);
    scanlines[rowStart] = 0;
    const sourceStart = y * canvas.width * 4;
    for (let i = 0; i < canvas.width * 4; i += 1) {
      scanlines[rowStart + 1 + i] = canvas.data[sourceStart + i];
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(canvas.width, 0);
  ihdr.writeUInt32BE(canvas.height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(scanlines, { level: 9 });

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function writeImage(name, canvas) {
  const outputPath = path.join(OUTPUT_DIR, name);
  fs.writeFileSync(outputPath, encodePng(canvas));
  return outputPath;
}

function main() {
  ensureDir(OUTPUT_DIR);
  const files = [
    writeImage("clock-wave.png", createClockWave()),
    writeImage("session-path.png", createSessionPath()),
    writeImage("income-spark.png", createIncomeSpark()),
  ];
  process.stdout.write(`${files.join("\n")}\n`);
}

main();
