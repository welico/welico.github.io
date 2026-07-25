import type { LocaleCode } from './locales';

type Dict = Record<string, string>;

// English is the only complete dictionary right now (Owner decision 19: Claude translates
// directly, but that happens incrementally once page content stops changing — see
// Wireframes - Welico.md Open Items 6/7). Routing for all 9 locales is live today; other
// locales fall back to English via t() below until their entries are added here.
const en: Dict = {
  'nav.products': 'Products',
  'nav.business': 'Business',
  'nav.developers': 'Developers',
  'nav.docs': 'Docs',
  'nav.company': 'Company',

  'home.eyebrow': 'Welico',
  'home.title': 'We build products people actually keep using.',
  'home.lead':
    "A small team shipping focused tools — from note-taking to developer utilities. This is where you can see what we're working on.",
  'home.cta.products': 'See our products',
  'home.cta.business': 'Work with us',
  'home.featured.eyebrow': 'Featured',
  'home.featured.title': "What we're building",

  'products.eyebrow': 'Products',
  'products.title': "What we're building",
  'products.lead': 'Only Launched, MVP Ready, and Building products are shown here.',
  'products.view': 'Visit product',
  'products.comingSoon': 'Coming soon',

  'business.eyebrow': 'Business',
  'business.title': "What we're building, and who we build it with",
  'business.p1':
    'Welico is a small product studio. We partner with teams who want focused, well-made tools rather than sprawling platforms.',
  'business.p2': 'Interested in partnering, integrating, or investing? We read every message.',
  'business.cta': 'Get in touch — hello@welico.com',

  'company.about.title': 'About Welico',
  'company.about.body':
    "Welico builds small, focused products. We keep teams lean and ship things we'd want to use ourselves.",
  'company.team.title': 'Team',
  'company.contact.title': 'Contact',
  'company.contact.body': 'General inquiries (not partnerships — see Business):',

  'developers.eyebrow': 'Developers',
  'developers.title': 'API reference — coming soon',
  'developers.body':
    "We'll publish API docs here once our products are ready for external integration.",

  'blog.eyebrow': 'Blog',
  'blog.title': 'News and engineering notes',
  'blog.empty.title': 'Our first post is coming soon.',
  'blog.empty.body': 'Check back shortly, or follow product updates on the Products page.',

  'notfound.title': '404 — Page not found',
  'notfound.body': "The page you're looking for doesn't exist, or isn't available in this language yet.",
  'notfound.cta': 'Back to Home',

  'footer.products': 'Products',
  'footer.allProducts': 'All products',
  'footer.company': 'Company',
  'footer.resources': 'Resources',
  'footer.business': 'Business',
  'footer.partnerships': 'Partnerships',
  'footer.copyright': '© 2026 Welico',

  'theme.system': 'Auto',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
};

const dictionaries: Partial<Record<LocaleCode, Dict>> = { en };

export function t(lang: LocaleCode, key: string): string {
  return dictionaries[lang]?.[key] ?? en[key] ?? key;
}
