// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://ricardotieghi.com',
  integrations: [sitemap()],
  build: {
    // Emit /cv/index.html rather than /cv.html so the URL has no extension.
    format: 'directory',
  },
  image: {
    // Every source image is a local file; no remote domains need allowing.
    responsiveStyles: true,
  },
});
