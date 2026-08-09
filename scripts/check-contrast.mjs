#!/usr/bin/env node
/**
 * Verifies every text colour in tokens.css against the surface it is used on.
 * Run with `npm run contrast`. Exits non-zero if any pair drops below WCAG AA,
 * so a palette edit that breaks legibility fails loudly instead of shipping.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../src/styles/tokens.css'), 'utf8');

/** Pull a custom property value out of the :root block. */
function token(name) {
  const match = css.match(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{3,8})`));
  if (!match) throw new Error(`token --${name} not found in tokens.css`);
  return match[1];
}

function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

// [label, foreground token or literal, background token or literal, minimum]
const AA_TEXT = 4.5;
const AA_UI = 3; // non-text UI: borders, focus rings, large text

const checks = [
  ['body on canvas', token('body'), token('canvas'), AA_TEXT],
  ['ink on canvas', token('ink'), token('canvas'), AA_TEXT],
  ['muted on canvas', token('muted'), token('canvas'), AA_TEXT],
  ['accent on canvas', token('accent'), token('canvas'), AA_TEXT],
  ['accent-hover on canvas', token('accent-hover'), token('canvas'), AA_TEXT],

  ['body on canvas-deep', token('body'), token('canvas-deep'), AA_TEXT],
  ['ink on canvas-deep', token('ink'), token('canvas-deep'), AA_TEXT],
  ['muted on canvas-deep', token('muted'), token('canvas-deep'), AA_TEXT],
  ['accent on canvas-deep', token('accent'), token('canvas-deep'), AA_TEXT],

  ['body on surface', token('body'), token('surface'), AA_TEXT],
  ['ink on surface', token('ink'), token('surface'), AA_TEXT],
  ['muted on surface', token('muted'), token('surface'), AA_TEXT],
  ['accent on surface', token('accent'), token('surface'), AA_TEXT],

  ['white on ink (primary btn)', '#ffffff', token('ink'), AA_TEXT],
  ['white on accent', '#ffffff', token('accent'), AA_TEXT],
  ['accent on blue-wash (chip)', token('accent'), token('blue-wash'), AA_TEXT],
  ['chip--tan text', '#5b4a3d', token('tan'), AA_TEXT],
  ['chip--award text', '#7a5605', '#fbf0d8', AA_TEXT],

  ['focus ring on canvas', token('accent'), token('canvas'), AA_UI],
  ['tan border on canvas', token('tan-deep'), token('canvas'), 1.2],
];

let failed = 0;
console.log('\n  WCAG contrast — ricardotieghi.com\n');

for (const [label, fg, bg, min] of checks) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed++;
  const status = ok ? '  ok ' : 'FAIL';
  console.log(
    `  ${status}  ${label.padEnd(30)} ${fg} on ${bg}  ${r.toFixed(2)}:1  (min ${min})`
  );
}

// These three must never be used as text. Assert they would in fact fail, so
// nobody is tempted to promote them later without noticing.
console.log('\n  fill-only tokens (expected to fail as text — do not use for type):');
for (const name of ['tan', 'blue-soft', 'grey']) {
  const r = ratio(token(name), token('canvas'));
  console.log(`        ${name.padEnd(30)} ${token(name)}  ${r.toFixed(2)}:1`);
}

if (failed > 0) {
  console.error(`\n  ${failed} contrast check(s) failed.\n`);
  process.exit(1);
}
console.log('\n  All contrast checks passed.\n');
