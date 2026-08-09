# Publication figures

Drop a graphical abstract or key figure here, then point at it from
`src/data/publications.yaml`:

```yaml
- id: husspred-toxics
  image: husspred.jpg # <- filename in this folder
```

Any publication with `image: null` renders a designed placeholder instead, so
the grid stays even while these are missing.

**Before adding a figure, check you are allowed to republish it.** Open-access
papers under a CC licence (MDPI Toxics, EHP, bioRxiv) are fine with attribution.
Figures from paywalled journals — NEJM AI, Elsevier, Wiley, ACS — are
copyrighted by the publisher and generally need permission.

Accepted formats: `.jpg`, `.jpeg`, `.png`, `.webp`. Astro resizes them at build
time, so full-resolution originals are fine.
