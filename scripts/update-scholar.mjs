#!/usr/bin/env node
/**
 * Refreshes the Google Scholar numbers in src/data/.
 *
 *   npm run scholar                 update stats.yaml and per-paper citations
 *   npm run scholar -- --dry-run    show what would change, write nothing
 *   npm run scholar -- --list       print every paper on the profile with its
 *                                   Scholar id, to fill in `scholarId:` fields
 *
 * Scholar has no API, so this reads the public profile page. It edits the YAML
 * line by line rather than re-serialising it, so comments and formatting stay
 * exactly as written. If Scholar answers with anything other than the profile
 * (a CAPTCHA, a rate limit), it exits non-zero and changes nothing.
 *
 * Runs weekly in CI via .github/workflows/scholar.yml.
 */
import { readFile, writeFile } from 'node:fs/promises';
import yaml from 'js-yaml';

const args = new Set(process.argv.slice(2));
const LIST = args.has('--list');
const DRY_RUN = args.has('--dry-run');

const STATS = new URL('../src/data/stats.yaml', import.meta.url);
const PUBS = new URL('../src/data/publications.yaml', import.meta.url);

const statsText = await readFile(STATS, 'utf8');
const pubsText = await readFile(PUBS, 'utf8');
const stats = yaml.load(statsText);

const user = new URL(stats.scholarUrl).searchParams.get('user');
if (!user) fail(`No ?user= in scholarUrl (${stats.scholarUrl}).`);

/* ------------------------------------------------------------------ fetch */

const PAGE_SIZE = 100;
const profileUrl = `https://scholar.google.com/citations?user=${user}&hl=en&pagesize=${PAGE_SIZE}`;

let html;
try {
  const res = await fetch(profileUrl, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) fail(`Google Scholar answered HTTP ${res.status}.`);
  html = await res.text();
} catch (err) {
  fail(`Could not reach Google Scholar: ${err.message}`);
}

/* ------------------------------------------------------------------ parse */

// The metrics table: [citations all, since, h all, since, i10 all, since].
const totals = [...html.matchAll(/<td class="gsc_rsb_std">(\d+)<\/td>/g)].map((m) => Number(m[1]));
if (totals.length < 6) {
  fail('The page did not contain the metrics table — probably a CAPTCHA or block page.');
}
const scholar = { citations: totals[0], hIndex: totals[2], i10Index: totals[4] };

const papers = [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)].map(([, row]) => ({
  id: row.match(/citation_for_view=[^:"&]+:([^"&]+)/)?.[1],
  title: decode(row.match(/class="gsc_a_at">([\s\S]*?)<\/a>/)?.[1] ?? ''),
  citations: Number(row.match(/class="gsc_a_ac[^"]*">(\d*)<\/a>/)?.[1] || 0),
}));
if (papers.length >= PAGE_SIZE) {
  console.warn(`! The profile lists ${PAGE_SIZE}+ papers; only the first page is read.`);
}

// Scholar totals essentially never fall. A big drop means we parsed the wrong
// page, so refuse rather than publish a nonsense number.
if (scholar.citations < stats.citations * 0.8) {
  fail(`Citations would drop from ${stats.citations} to ${scholar.citations}; refusing.`);
}

const pubBlocks = splitEntries(pubsText);

if (LIST) {
  const mapped = new Map(pubBlocks.filter((b) => b.scholarId).map((b) => [b.scholarId, b.id]));
  for (const p of papers) {
    const where = mapped.get(p.id) ? `→ ${mapped.get(p.id)}` : '  (not mapped)';
    console.log(`${p.id.padEnd(14)} ${String(p.citations).padStart(3)}  ${where}\n               ${p.title}`);
  }
  process.exit(0);
}

/* ----------------------------------------------------------------- update */

const changes = [];

let newStats = statsText;
for (const key of ['citations', 'hIndex', 'i10Index']) {
  if (stats[key] !== scholar[key]) changes.push(`${key} ${stats[key]} → ${scholar[key]}`);
  newStats = replaceLine(newStats, key, scholar[key]);
}
const month = new Date().toLocaleString('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/New_York',
});
if (stats.updated !== month) changes.push(`updated ${stats.updated} → ${month}`);
newStats = replaceLine(newStats, 'updated', month);

const byId = new Map(papers.map((p) => [p.id, p]));
const newBlocks = pubBlocks.map((block) => {
  if (!block.scholarId) return block.text;
  const paper = byId.get(block.scholarId);
  if (!paper) {
    console.warn(`! ${block.id}: scholarId ${block.scholarId} is no longer on the profile.`);
    return block.text;
  }
  const current = block.text.match(/^ {2}citations: (\d+)$/m);
  if (current) {
    if (Number(current[1]) === paper.citations || paper.citations === 0) return block.text;
    changes.push(`${block.id} ${current[1]} → ${paper.citations}`);
    return block.text.replace(/^ {2}citations: \d+$/m, `  citations: ${paper.citations}`);
  }
  // Scholar shows nothing for uncited papers; keep the field absent too.
  if (paper.citations === 0) return block.text;
  changes.push(`${block.id} (none) → ${paper.citations}`);
  const anchor = block.text.match(/^ {2}url: .*$/m) ?? block.text.match(/^ {2}status: .*$/m);
  return block.text.replace(anchor[0], `${anchor[0]}\n  citations: ${paper.citations}`);
});
const newPubs = pubBlocks.length ? pubsText.slice(0, pubBlocks[0].start) + newBlocks.join('') : pubsText;

if (changes.length === 0) {
  console.log('Scholar metrics are already up to date.');
  process.exit(0);
}

console.log(changes.map((c) => `  ${c}`).join('\n'));
if (DRY_RUN) {
  console.log('Dry run — nothing written.');
} else {
  await writeFile(STATS, newStats);
  await writeFile(PUBS, newPubs);
  console.log('Updated src/data/stats.yaml and src/data/publications.yaml.');
}

/* ---------------------------------------------------------------- helpers */

function fail(message) {
  console.error(`✗ ${message}\n  Nothing was changed.`);
  process.exit(1);
}

/** Replace a top-level `key: value` line, keeping everything else verbatim. */
function replaceLine(text, key, value) {
  const re = new RegExp(`^${key}: .*$`, 'm');
  if (!re.test(text)) fail(`stats.yaml has no "${key}:" line.`);
  return text.replace(re, `${key}: ${value}`);
}

/** Split publications.yaml into its `- id:` entries, keeping exact text. */
function splitEntries(text) {
  const starts = [...text.matchAll(/^- id: (\S+)$/gm)];
  return starts.map((m, i) => {
    const start = m.index;
    const end = i + 1 < starts.length ? starts[i + 1].index : text.length;
    const body = text.slice(start, end);
    return {
      id: m[1],
      start,
      text: body,
      scholarId: body.match(/^ {2}scholarId: (\S+)$/m)?.[1],
    };
  });
}

function decode(s) {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .trim();
}
