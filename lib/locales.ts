export const SupportedLocales = ['en','fr','de','nl'] as const;
export type Locale = typeof SupportedLocales[number];

export function normalizeDate(ym: string|undefined, locale: Locale) {
  if (!ym) return '';
  if (ym.toLowerCase() === 'present') return locale === 'en' ? 'present' : '—';
  const [y,m] = ym.split('-').map(Number);
  const d = new Date(Date.UTC(y, (m||1)-1, 1));
  return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(d);
}
