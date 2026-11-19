// Saves /digest/<night> as one self-contained HTML file under var/preview/ (git-ignored, ADR 0003).
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';
import { lane } from '../src/lane.js';

const night = process.argv[2] ?? '2026-10-28';
const app = createApp(loadConfig());
const res = await app.request(`/digest/${night}`);
if (res.status !== 200) {
  console.error(`preview failed: /digest/${night} returned ${res.status}`);
  process.exit(1);
}
const html = await res.text();
const out = resolve('var/preview/index.html');
mkdirSync(resolve('var/preview'), { recursive: true });
writeFileSync(out, html);
const marker = lane().marker;
console.log(`wrote ${out}`);
console.log(marker ? `marker in file: ${marker}` : 'no marker set');
