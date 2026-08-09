# ricardotieghi.com

Personal site for Ricardo Scheufen Tieghi — computational toxicology, machine
learning, and AI policy for biomedical research.

Built with [Astro](https://astro.build). Every page is static HTML; the only
JavaScript that ships is the nav menu, the hero rotator, and the filter pills.

---

## Running it locally

```bash
npm install
npm run dev        # http://localhost:4321
```

| Command | What it does |
|---|---|
| `npm run dev` | Local dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built site exactly as it will deploy |
| `npm run contrast` | Check every text colour against WCAG AA. CI runs this too. |
| `npm run images` | Re-process photos from `img/` into `src/assets/photos/` |

---

## Editing content

**You should not need to touch any component to update the site.** Everything
lives in `src/data/` as YAML:

| File | Contents |
|---|---|
| `site.yaml` | Name, role, bio, education, experience, links, contact form, disclaimer |
| `publications.yaml` | All publications |
| `talks.yaml` | Invited talks and conference posters |
| `awards.yaml` | Awards and honors |
| `news.yaml` | Press coverage |
| `stats.yaml` | Google Scholar metrics (entered by hand) |

Counts shown on the page — "8 peer-reviewed", "n=13", the filter pill numbers —
are all **counted from these files at build time**. Add a publication and every
number updates itself.

The build validates these files. A typo in a field name or a malformed URL fails
`npm run build` with a message naming the file and the field, rather than
shipping a broken page.

### Adding a publication

```yaml
- id: short-unique-slug
  title: The full title of the paper
  authors: 'A. Author, **R. S. Tieghi**, C. Author'   # ** ** bolds your name
  venue: Journal Name
  year: 2026
  status: published        # published | preprint | under-review | in-preparation
  url: https://doi.org/...
  citations: 0
  topics: [ml, tools]      # policy | ml | ai | tools | reviews
  featured: true           # optional — shows in the Featured Research grid
  image: figure.jpg        # optional — file in src/assets/papers/
```

Only `status: published` counts toward the "peer-reviewed" stat.

### Updating Scholar metrics

Google Scholar has no API, so `citations`, `hIndex`, and `i10Index` in
`stats.yaml` are typed in by hand. Check
[the profile](https://scholar.google.com/citations?user=iEROevEAAAAJ) every few
months and update `updated:` when you do — that date renders under the stats.

### Adding photos

Drop them in `img/`, add a line to the `MAP` in `scripts/prepare-images.mjs`,
then run `npm run images`. HEIC files are converted automatically (macOS only —
CI never runs this script, it uses the committed output in `src/assets/photos/`).

---

## The CV

Two representations, both driven from the same place:

- **HTML** — `/cv` renders the full CV from `src/data/*.yaml`, so it can never
  drift out of sync with the homepage. This is what search engines and AI
  crawlers read.
- **PDF** — `public/cv/Ricardo-Scheufen-Tieghi-CV.pdf` is committed and offered
  as a download, with an inline viewer on desktop.

**To update the PDF:** export a new one and overwrite that file, keeping the
filename. Nothing else needs changing. The page checks at build time that the
file exists — if it is ever missing, the download button and viewer are omitted
rather than shipping a link that 404s.

The Word original is **gitignored** (`*.doc`, `*.docx`, `~$*`). It is a working
file, and an editable CV should not be downloadable from a public repository.
Keep it wherever you like locally; git will ignore it.

> The published PDF has no phone number in it — worth re-checking whenever you
> export a new one, since this repo and the site are public.

---

## Still to do

Two things are stubbed and marked in the code:

1. **Contact form** — `contact.endpoint` is `null`, so the contact section shows
   a LinkedIn call to action instead of a form that would silently drop messages.
   Create a free form at [Formspree](https://formspree.io) or
   [Web3Forms](https://web3forms.com) and paste the endpoint URL. It is a public
   submission URL, not a secret, so it is fine in the repo.
2. **Paper figures** — every publication currently renders a designed
   placeholder. See `src/assets/papers/README.md` before adding real figures;
   figures from paywalled journals are copyrighted.

---

## Deploying

Pushing to `main` builds and deploys automatically via
`.github/workflows/deploy.yml`.

### One-time setup

**1. Make the repository public.** GitHub Pages only publishes from a private
repo on a paid plan.

**2. Turn on Pages.** Settings → Pages → Build and deployment → Source →
**GitHub Actions**.

**3. Point the domain at GitHub.** In Squarespace, open the DNS settings for
`ricardotieghi.com` and add:

| Type | Host | Value |
|---|---|---|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `ricardotieghi.github.io.` |

Remove any existing A or CNAME records on `@` and `www` that point at
Squarespace, or they will conflict.

**4. Set the custom domain.** Settings → Pages → Custom domain →
`ricardotieghi.com`. `public/CNAME` already contains this, so it survives every
deploy. Once the certificate is issued (up to ~24 hours), tick **Enforce HTTPS**.

DNS changes can take a few hours to propagate. `dig ricardotieghi.com +short`
should return the four GitHub IPs above.

---

## Structure

```
src/
  data/          YAML content + a validating loader (index.ts)
  styles/        tokens.css — the palette, type scale, and spacing
  components/    One file per section, each with its own scoped styles
  layouts/       Base.astro — <head>, SEO meta, JSON-LD
  pages/         index.astro (the whole homepage) and cv.astro
  scripts/       filters.ts — the filter pills
  assets/        photos/ (processed) and papers/ (figures, currently empty)
scripts/         Local tooling: image processing, contrast checking
public/          CNAME, favicon, the CV PDF
```

### Design

Palette is "Ocean & Sand" — cream `#FDF7EC`, navy ink `#003049`, blue accent
`#0A5C86`, tan `#E3D5CA`. Type is Fraunces (display), Inter (body), and IBM Plex
Mono (labels and data), all self-hosted.

`--tan`, `--blue-soft`, and `--grey` are **fill and border colours only** — none
of them reaches 4.5:1 on cream. `npm run contrast` enforces this and fails CI if
a text colour drops below AA.
