// Locale list + RTL flag. Owner decision 7/8 (Product - Welico.md): en default (no prefix),
// 8 locales as subpaths, /ar/ requires RTL layout.
export const DEFAULT_LOCALE = 'en';

export const LOCALES = [
  { code: 'en', label: 'English', rtl: false },
  { code: 'ko', label: '한국어', rtl: false },
  { code: 'es', label: 'Español', rtl: false },
  { code: 'zh', label: '中文', rtl: false },
  { code: 'ja', label: '日本語', rtl: false },
  { code: 'de', label: 'Deutsch', rtl: false },
  { code: 'fr', label: 'Français', rtl: false },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'hi', label: 'हिन्दी', rtl: false },
] as const;

export type LocaleCode = (typeof LOCALES)[number]['code'];

export const NON_DEFAULT_LOCALES = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE);

export function isRtl(lang: string): boolean {
  return LOCALES.find((l) => l.code === lang)?.rtl ?? false;
}

/** Locale-aware href for a site-relative path (no leading slash), e.g. href('ko', 'company/about'). */
export function href(lang: LocaleCode, path = ''): string {
  const base = path ? `/${path}` : '/';
  if (lang === DEFAULT_LOCALE) return base;
  return `/${lang}${base === '/' ? '' : base}`;
}
