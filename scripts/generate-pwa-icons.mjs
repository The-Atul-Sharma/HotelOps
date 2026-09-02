import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = fileURLToPath(new URL('..', import.meta.url));
const svg = readFileSync(`${root}/public/pwa-icon.svg`);

const outputs = [
  { size: 180, path: 'public/apple-touch-icon.png' },
  { size: 192, path: 'public/pwa-192.png' },
  { size: 512, path: 'public/pwa-512.png' },
];

for (const { size, path } of outputs) {
  await sharp(svg).resize(size, size).png().toFile(`${root}/${path}`);
  console.log(`Wrote ${path}`);
}
