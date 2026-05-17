import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));

const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

const sizes = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const { name, size, maskable } of sizes) {
  let pipeline = sharp(svg).resize(size, size);
  if (maskable) {
    const pad = Math.round(size * 0.1);
    pipeline = sharp(svg)
      .resize(size - pad * 2, size - pad * 2)
      .extend({
        top: pad,
        bottom: pad,
        left: pad,
        right: pad,
        background: "#0f0e0c",
      });
  }
  await pipeline.png().toFile(join(outDir, name));
  console.log(`Wrote ${name}`);
}
