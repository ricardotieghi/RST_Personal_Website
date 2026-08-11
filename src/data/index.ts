/**
 * Loads and validates every YAML file in this folder.
 *
 * Validation runs at build time, so a typo in a data file fails `npm run build`
 * with a message naming the file and field rather than rendering a broken page.
 */
import yaml from 'js-yaml';
import { z } from 'astro/zod';

// `?raw` inlines each file's text at build time. Reading from disk at runtime
// would break once Astro bundles this module into dist/chunks/.
import siteRaw from './site.yaml?raw';
import publicationsRaw from './publications.yaml?raw';
import talksRaw from './talks.yaml?raw';
import awardsRaw from './awards.yaml?raw';
import newsRaw from './news.yaml?raw';
import statsRaw from './stats.yaml?raw';

function load<T extends z.ZodTypeAny>(file: string, source: string, schema: T): z.infer<T> {
  const raw = yaml.load(source);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`\nInvalid data in src/data/${file}:\n${issues}\n`);
  }
  return parsed.data;
}

/* ---------------------------------------------------------------- schemas */

const linkSchema = z.string().url().nullable().optional();

const siteSchema = z.object({
  name: z.string(),
  shortName: z.string(),
  initials: z.string(),
  pronouns: z.string(),
  role: z.string(),
  roleDetail: z.string(),
  location: z.string(),
  tagline: z.string(),
  rotating: z.array(z.string()).min(1),
  about: z.array(z.string()).min(1),
  education: z.array(
    z.object({
      degree: z.string(),
      institution: z.string(),
      period: z.string(),
      detail: z.string().optional(),
    })
  ),
  experience: z.array(
    z.object({
      org: z.string(),
      orgDetail: z.string().optional(),
      title: z.string(),
      period: z.string(),
      supervisor: z.string().optional(),
      points: z.array(z.string()),
    })
  ),
  service: z.array(
    z.object({
      org: z.string(),
      title: z.string(),
      period: z.string(),
      detail: z.string().optional(),
    })
  ),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  ticker: z.array(z.string()).min(3),
  links: z.object({
    linkedin: linkSchema,
    scholar: linkSchema,
    instagram: linkSchema,
    orcid: linkSchema,
  }),
  cv: z.object({ file: z.string(), updated: z.string() }),
  contact: z.object({
    endpoint: z.string().url().nullable(),
    heading: z.string(),
    blurb: z.string(),
  }),
  analytics: z.object({
    // Reject anything that looks like a private key rather than a beacon token.
    cloudflareToken: z
      .string()
      .regex(/^[a-f0-9]{16,64}$/i, 'expected the hex beacon token from the Cloudflare snippet')
      .nullable(),
  }),
  kit: z.object({
    formAction: z.string().url().nullable(),
    heading: z.string(),
    blurb: z.string(),
    buttonLabel: z.string(),
    consentLabel: z.string(),
  }),
  disclaimer: z.string(),
});

const PUB_STATUS = ['published', 'under-review', 'in-preparation', 'preprint'] as const;
const PUB_TOPICS = ['policy', 'ml', 'ai', 'tools', 'reviews'] as const;

const publicationSchema = z.object({
  id: z.string(),
  title: z.string(),
  authors: z.string(),
  venue: z.string().optional(),
  year: z.number().int().optional(),
  status: z.enum(PUB_STATUS),
  url: z.string().url().optional(),
  citations: z.number().int().nonnegative().optional(),
  impactFactor: z.string().optional(),
  topics: z.array(z.enum(PUB_TOPICS)).min(1),
  featured: z.boolean().optional(),
  coFirst: z.boolean().optional(),
  image: z.string().nullable().optional(),
  badges: z.array(z.string()).optional(),
  note: z.string().optional(),
});

const TALK_KINDS = ['talk', 'workshop', 'webinar', 'poster'] as const;

const talkSchema = z.object({
  id: z.string(),
  title: z.string(),
  event: z.string(),
  location: z.string(),
  date: z.coerce.date(),
  dateLabel: z.string(),
  kind: z.enum(TALK_KINDS),
  upcoming: z.boolean().optional(),
  award: z.string().optional(),
  url: z.string().url().optional(),
  urlLabel: z.string().optional(),
  image: z.string().nullable().optional(),
});

const awardSchema = z.object({
  id: z.string(),
  title: z.string(),
  result: z.string(),
  value: z.string().nullable().optional(),
  group: z.enum(['research', 'presentation']),
  year: z.number().int().optional(),
  url: z.string().url().optional(),
  note: z.string().optional(),
});

const newsSchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  date: z.coerce.date(),
  dateLabel: z.string(),
  url: z.string().url(),
  featured: z.boolean().optional(),
  byline: z.boolean().optional(),
});

const statsSchema = z.object({
  citations: z.number().int(),
  hIndex: z.number().int(),
  i10Index: z.number().int(),
  updated: z.string(),
  scholarUrl: z.string().url(),
});

/* ------------------------------------------------------------------- data */

export const site = load('site.yaml', siteRaw, siteSchema);
export const publications = load('publications.yaml', publicationsRaw, z.array(publicationSchema));
export const talksAndPosters = load('talks.yaml', talksRaw, z.array(talkSchema));
export const awards = load('awards.yaml', awardsRaw, z.array(awardSchema));
export const news = load('news.yaml', newsRaw, z.array(newsSchema));
export const scholar = load('stats.yaml', statsRaw, statsSchema);

export type Publication = z.infer<typeof publicationSchema>;
export type Talk = z.infer<typeof talkSchema>;
export type Award = z.infer<typeof awardSchema>;
export type NewsItem = z.infer<typeof newsSchema>;

/* --------------------------------------------------------------- derived */

const byDateDesc = <T extends { date: Date }>(a: T, b: T) => b.date.getTime() - a.date.getTime();

/** Publications grouped by status, in the order they should render. */
export const publicationGroups = (
  [
    ['published', 'Published'],
    ['preprint', 'Preprint'],
    ['under-review', 'Under review'],
    ['in-preparation', 'In preparation'],
  ] as const
)
  .map(([status, label]) => ({
    status,
    label,
    items: publications.filter((p) => p.status === status),
  }))
  .filter((g) => g.items.length > 0);

export const featuredPublications = publications.filter((p) => p.featured);

export const talks = talksAndPosters.filter((t) => t.kind !== 'poster').sort(byDateDesc);
export const posters = talksAndPosters.filter((t) => t.kind === 'poster').sort(byDateDesc);

/** Upcoming first, then everything else newest-first. */
export const timeline = [
  ...talksAndPosters.filter((t) => t.upcoming).sort(byDateDesc),
  ...talksAndPosters.filter((t) => !t.upcoming).sort(byDateDesc),
];

export const awardGroups = (
  [
    ['research', 'Research awards'],
    ['presentation', 'Presentation & institutional'],
  ] as const
).map(([group, label]) => ({
  group,
  label,
  items: awards.filter((a) => a.group === group),
}));

export const newsSorted = [...news].sort(byDateDesc);

/**
 * The hero stat row. Counts come from the data files so they can never drift
 * from the lists below them; only the Scholar metrics are entered by hand.
 */
export const stats = {
  peerReviewed: publications.filter((p) => p.status === 'published').length,
  allPublications: publications.length,
  citations: scholar.citations,
  hIndex: scholar.hIndex,
  awards: awards.length,
  talks: talks.length,
  posters: posters.length,
  updated: scholar.updated,
  scholarUrl: scholar.scholarUrl,
};

/** Topic filter pills for the publications section — only topics in use. */
export const publicationTopics = (
  [
    ['policy', 'Policy'],
    ['ml', 'Machine learning'],
    ['ai', 'AI & LLMs'],
    ['tools', 'Tools'],
    ['reviews', 'Reviews'],
  ] as const
)
  .map(([id, label]) => ({
    id,
    label,
    count: publications.filter((p) => p.topics.includes(id)).length,
  }))
  .filter((t) => t.count > 0);
