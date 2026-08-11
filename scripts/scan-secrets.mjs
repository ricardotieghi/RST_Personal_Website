#!/usr/bin/env node
/**
 * Fails the build if anything that looks like a private credential made it into
 * the published output.
 *
 * This site is served from a public repo with no server, so every byte of
 * `dist/` is world-readable. Three public write-only identifiers are expected
 * and allowed: the Cloudflare beacon token, the Formspree form endpoint, and
 * the Kit form action. Anything that could *read* data is not.
 *
 * Run with `npm run scan`. CI runs it after every build.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join, extname } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(here, '../dist');

const PATTERNS = [
  [/\bkit_[A-Za-z0-9_-]{12,}/g, 'Kit API key'],
  [/\bck_[A-Za-z0-9_-]{16,}/g, 'ConvertKit API key'],
  [/\bre_[A-Za-z0-9_-]{16,}/g, 'Resend API key'],
  [/\bsk_(live|test)_[A-Za-z0-9]{16,}/g, 'Stripe secret key'],
  [/\bAKIA[0-9A-Z]{16}\b/g, 'AWS access key id'],
  [/\bghp_[A-Za-z0-9]{30,}/g, 'GitHub personal access token'],
  [/\bAIza[0-9A-Za-z_-]{30,}/g, 'Google API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/g, 'private key block'],
  [/\bBearer\s+[A-Za-z0-9._-]{20,}/g, 'bearer token'],
  [/["'](api[_-]?key|secret|password|token)["']\s*:\s*["'][^"']{12,}["']/gi, 'inline credential'],
];

// Text formats only; images and fonts cannot leak a key in a way grep would find.
const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.xml', '.txt', '.svg']);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (TEXT.has(extname(full))) out.push(full);
  }
  return out;
}

let files;
try {
  files = walk(DIST);
} catch {
  console.error('\n  No dist/ to scan. Run `npm run build` first.\n');
  process.exit(1);
}

const findings = [];
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  for (const [pattern, label] of PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      findings.push({
        file: file.replace(`${DIST}/`, ''),
        label,
        sample: match[0].slice(0, 24),
      });
    }
  }
}

console.log(`\n  Scanned ${files.length} text file(s) in dist/`);

if (findings.length) {
  console.error(`\n  ${findings.length} possible secret(s) in the published output:\n`);
  for (const f of findings) console.error(`    ${f.label.padEnd(28)} ${f.file}  (${f.sample}…)`);
  console.error('\n  Remove it, rotate the credential, then rebuild.\n');
  process.exit(1);
}

console.log('  No credentials found in the published output.\n');
