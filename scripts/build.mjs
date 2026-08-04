import { deflateSync } from "node:zlib";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = resolve(projectRoot, "dist");

if (outputDirectory !== join(projectRoot, "dist")) {
  throw new Error("Unexpected build output path.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const file of ["index.html"]) {
  await cp(join(projectRoot, file), join(outputDirectory, file));
}
for (const directory of ["src", "data"]) {
  await cp(join(projectRoot, directory), join(outputDirectory, directory), { recursive: true });
}
await cp(join(projectRoot, "public"), outputDirectory, { recursive: true });

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
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

function createAppIcon(size) {
  const rows = [];
  const center = size / 2;
  const radius = size * 0.36;
  const border = size * 0.045;
  for (let y = 0; y < size; y += 1) {
    const row = Buffer.alloc(1 + size * 4);
    row[0] = 0;
    for (let x = 0; x < size; x += 1) {
      const offset = 1 + x * 4;
      const distance = Math.hypot(x - center, y - center);
      let color = [244, 165, 58, 255];
      if (distance < radius + border) color = [47, 42, 37, 255];
      if (distance < radius) color = [255, 250, 241, 255];

      const eyeRadius = size * 0.035;
      const eyeY = center - size * 0.06;
      if (Math.hypot(x - (center - size * 0.13), y - eyeY) < eyeRadius) color = [47, 42, 37, 255];
      if (Math.hypot(x - (center + size * 0.13), y - eyeY) < eyeRadius) color = [47, 42, 37, 255];

      const smileRadius = size * 0.17;
      const smileDistance = Math.hypot(x - center, y - (center + size * 0.01));
      if (y > center && Math.abs(smileDistance - smileRadius) < size * 0.022) color = [47, 42, 37, 255];
      row.set(color, offset);
    }
    rows.push(row);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(rows))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconDirectory = join(outputDirectory, "icons");
await mkdir(iconDirectory, { recursive: true });
await Promise.all(
  [192, 512].map((size) => writeFile(join(iconDirectory, `icon-${size}.png`), createAppIcon(size))),
);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }
  return files;
}

const serviceWorkerPath = join(outputDirectory, "service-worker.js");
const contentHash = createHash("sha256");
const cacheFiles = (await listFiles(outputDirectory)).filter((path) => path !== serviceWorkerPath).sort();
for (const path of cacheFiles) {
  contentHash.update(path.slice(outputDirectory.length));
  contentHash.update(await readFile(path));
}
const cacheVersion = `trickcal-blueprint-${contentHash.digest("hex").slice(0, 12)}`;
const serviceWorkerSource = await readFile(serviceWorkerPath, "utf8");
await writeFile(
  serviceWorkerPath,
  serviceWorkerSource.replace('const CACHE_VERSION = "trickcal-blueprint-build";', `const CACHE_VERSION = "${cacheVersion}";`),
);

console.log(`Built static site in ${outputDirectory}`);
