#!/usr/bin/env node
/**
 * Normalises publication figures in `src/assets/papers/`.
 *
 * Graphical abstracts arrive in whatever the journal supplied — 53 MB TIFFs,
 * files whose extension lies about their real format, 4000px-wide PNGs. This
 * converts them to something a static site can ship, and renames them to match
 * the publication `id` in publications.yaml so the wiring is obvious.
 *
 * Originals are moved to `img/papers-originals/` (gitignored), never deleted.
 * Re-running is safe: already-normalised files are skipped.
 */
import { mkdirSync, existsSync, renameSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, extname } from 'node:path';
import sharp from 'sharp';

const here = dirname(fileURLToPath(import.meta.url));
const DIR = resolve(here, '../src/assets/papers');
const ARCHIVE = resolve(here, '../img/papers-originals');
const MAX_EDGE = 1600;

/** original filename  ->  publication id in publications.yaml */
const MAP = {
  'NEJM AI Paper Figure.jpg': 'nejm-ai-nams',
  'HuSS Pred Paper.png': 'husspred-toxics',
  'ALD Paper.jpeg': 'pfas-liver',
  'Bacterial Paper.jpeg': 'breaking-the-phalanx',
  'Democratizing AI Comp Tox Tools paper.png': 'democratizing-ai-tox',
  'JTMF - Wiley Automated Info Extraction Paper.jpg': 'knime-llm-extraction',
  'DL Med Chem Book Chapter.tif': 'medchem-deep-learning',
  'medchem-deep-learning-1.png': 'medchem-deep-learning',
  'DeTox Webtool Implementation.png': 'detox-ehp',
  'STopTox Figure.png': 'stoptox-validation',
};

// Formats Astro's pipeline handles well. Anything else becomes JPEG.
const KEEP = new Set(['jpeg', 'png', 'webp']);

mkdirSync(ARCHIVE, { recursive: true });

let done = 0;

for (const [original, id] of Object.entries(MAP)) {
  const input = resolve(DIR, original);
  if (!existsSync(input)) continue;

  const image = sharp(input);
  const meta = await image.metadata();

  // Trust the file's actual contents, not its extension — one of these is a
  // WebP wearing a .png extension.
  const realFormat = KEEP.has(meta.format ?? '') ? meta.format : 'jpeg';
  const output = resolve(DIR, `${id}.${realFormat === 'jpeg' ? 'jpg' : realFormat}`);

  const pipeline = image.resize({
    width: MAX_EDGE,
    height: MAX_EDGE,
    fit: 'inside',
    withoutEnlargement: true,
  });

  if (realFormat === 'png') await pipeline.png({ compressionLevel: 9 }).toFile(output);
  else if (realFormat === 'webp') await pipeline.webp({ quality: 88 }).toFile(output);
  else await pipeline.jpeg({ quality: 88, mozjpeg: true }).toFile(output);

  renameSync(input, resolve(ARCHIVE, original));

  const before = statSync(resolve(ARCHIVE, original)).size;
  const after = statSync(output).size;
  const out = await sharp(output).metadata();
  console.log(
    `  ${id.padEnd(24)} ${String(meta.format).padEnd(5)} ${meta.width}×${meta.height}` +
      ` → ${out.width}×${out.height}  ` +
      `${(before / 1024).toFixed(0)} KB → ${(after / 1024).toFixed(0)} KB`
  );
  done++;
}

const leftovers = readdirSync(DIR).filter(
  (f) => !f.startsWith('.') && f !== 'README.md' && !/^[a-z0-9-]+\.(jpg|png|webp)$/.test(f)
);
if (leftovers.length) {
  console.log('\n  Not mapped — add them to MAP in scripts/prepare-papers.mjs:');
  for (const f of leftovers) console.log(`        ${f}`);
}

console.log(`\n  ${done} figure(s) normalised. Originals archived in img/papers-originals/\n`);
