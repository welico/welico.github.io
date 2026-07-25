import { defineConfig } from 'astro/config';

// Owner decision 15/17 (Product - Welico.md): canonical hostname is www.welico.com.
// NOTE: GitHub Pages' actual custom-domain (cname) setting is still "welico.com" (apex)
// as of this writing — fix that at cutover time so `site` below matches the live config,
// or sitemap/canonical URLs will point at a host GitHub doesn't treat as primary.
const SUPPORTED_LOCALES = ['ko', 'es', 'zh', 'ja', 'de', 'fr', 'ar', 'hi'];

export default defineConfig({
  site: 'https://www.welico.com',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', ...SUPPORTED_LOCALES],
    routing: {
      prefixDefaultLocale: false,
    },
  },
});
