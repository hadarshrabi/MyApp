import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const output = path.resolve("public/icons");
await mkdir(output, { recursive: true });

function iconSvg(size, maskable = false) {
  const inset = maskable ? Math.round(size * 0.18) : Math.round(size * 0.08);
  const markSize = size - inset * 2;
  const radius = Math.round(markSize * 0.28);
  const fontSize = Math.round(markSize * 0.54);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="#f7f6f2"/>
    <rect x="${inset}" y="${inset}" width="${markSize}" height="${markSize}" rx="${radius}" fill="#456b58"/>
    <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-family="Georgia, 'Times New Roman', serif" font-size="${fontSize}" font-weight="700">ל</text>
  </svg>`;
}

for (const size of [192, 512]) {
  await sharp(Buffer.from(iconSvg(size))).png().toFile(path.join(output, `icon-${size}.png`));
  await sharp(Buffer.from(iconSvg(size, true))).png().toFile(path.join(output, `icon-maskable-${size}.png`));
}
await sharp(Buffer.from(iconSvg(180))).png().toFile(path.join(output, "apple-touch-icon.png"));
