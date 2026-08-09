#!/usr/bin/env node
/**
 * Normalises the photos in `img/` into `src/assets/photos/`.
 *
 * Drop new photos into `img/`, add a line to the MAP below, then run
 * `npm run images`. The output folder is committed, so CI never runs this —
 * it only needs to work on a Mac.
 *
 * - .HEIC is converted with macOS `sips` (sharp cannot read HEIC).
 * - Everything is capped at 2000px on the long edge so the repo stays small.
 *   Astro's <Image> does the final per-breakpoint resizing at build time.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '../img');
const OUT = resolve(here, '../src/assets/photos');
const TMP = resolve(here, '../.image-tmp');
const MAX_EDGE = 2000;

/** original filename in img/  ->  normalised name in src/assets/photos/ */
const MAP = {
  'SOT_ScheufenTieghi_Large_Headshot.jpg': 'headshot.jpg',
  'Graduation.jpeg': 'graduation.jpg',
  'Chancellor Award_img1.jpg': 'chancellor-award.jpg',
  'ASCCT Award Image.JPG': 'ascct-award.jpg',
  'NSCO Award Image.jpg': 'nscp-award.jpg',
  'SOT 2025 Award.HEIC': 'sot-2025-award.jpg',
  'SOT 2025 Poster Award.HEIC': 'sot-2025-poster-award.jpg',
  'SOT 24.jpg': 'sot-2024.jpg',
  'WC13 Panel.webp': 'wc13-panel.webp',
  'Presentation NSCP Fall Connection.jpg': 'nscp-fall-connection.jpg',
  'Poster Presentaiotn 1 NCSOT.jpg': 'ncsot-poster-1.jpg',
  'Poster Presentation 2 NCSOT.jpg': 'ncsot-poster-2.jpg',
};

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

let written = 0;

for (const [from, to] of Object.entries(MAP)) {
  const input = resolve(SRC, from);
  if (!existsSync(input)) {
    console.warn(`  skip   ${from} — not found in img/`);
    continue;
  }

  let readable = input;

  if (extname(from).toLowerCase() === '.heic') {
    readable = resolve(TMP, `${to}.heic-decoded.jpg`);
    execFileSync('sips', ['-s', 'format', 'jpeg', input, '--out', readable], {
      stdio: 'pipe',
    });
  }

  const pipeline = sharp(readable)
    .rotate() // honour EXIF orientation before stripping metadata
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    });

  const output = resolve(OUT, to);
  if (to.endsWith('.webp')) {
    await pipeline.webp({ quality: 82 }).toFile(output);
  } else {
    await pipeline.jpeg({ quality: 82, mozjpeg: true }).toFile(output);
  }

  const { size } = await sharp(output).metadata().then(async () => ({
    size: (await import('node:fs')).statSync(output).size,
  }));
  console.log(`  ok     ${to.padEnd(28)} ${(size / 1024).toFixed(0)} KB`);
  written++;
}

rmSync(TMP, { recursive: true, force: true });

// Flag anything sitting in img/ that no data file will ever reference.
const unmapped = readdirSync(SRC).filter(
  (f) => !f.startsWith('.') && !(f in MAP)
);
if (unmapped.length) {
  console.log('\n  Not mapped (add to MAP in scripts/prepare-images.mjs to use):');
  for (const f of unmapped) console.log(`        ${f}`);
}

console.log(`\n  ${written} image(s) written to src/assets/photos/\n`);
