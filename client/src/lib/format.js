import { intlLocale, translate } from '../i18n/index.js';

// Formatters follow the current language (English: en-IN, Marathi: mr-IN with Latin digits). They read
// the language from the i18n module, so any component that calls them must also call useT() to be
// re-rendered when the language is switched.
const cache = new Map();
function intl(kind, make) {
  const key = `${kind}|${intlLocale()}`;
  if (!cache.has(key)) cache.set(key, make(intlLocale()));
  return cache.get(key);
}
const dateTime = () => intl('dt', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'medium', timeStyle: 'short' }));
const dateOnly = () => intl('d', (l) => new Intl.DateTimeFormat(l, { dateStyle: 'medium' }));

export const formatDateTime = (iso) => (iso ? dateTime().format(new Date(iso)) : '-');
export const formatDate = (iso) => (iso ? dateOnly().format(new Date(iso)) : '-');

export function formatHours(hours) {
  if (hours === null || hours === undefined) return '-';
  if (hours < 1) return translate('fmt.min', { n: Math.round(hours * 60) });
  if (hours < 48) return translate('fmt.hours', { n: hours.toFixed(1) });
  return translate('fmt.days', { n: (hours / 24).toFixed(1) });
}

export const formatPercent = (value) => (value === null || value === undefined ? '-' : `${value.toFixed(1)}%`);

/** Indian rupees with lakh/crore grouping, e.g. 125000.5 -> "₹1,25,000.50". */
export function formatRupees(amount) {
  if (amount === null || amount === undefined) return '-';
  // Always en-IN: it gives lakh/crore grouping (1,25,000) with Latin digits; the Marathi locale would not.
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse what a person types into an amount field: "1,25,000", "₹ 40000.5", "" -> null (no amount).
 * Devanagari digits (१२३) are accepted too. `t` is the translate function, for the error messages.
 */
export function parseBudget(input, t) {
  const latin = String(input ?? '').replace(/[०-९]/g, (d) => String(d.charCodeAt(0) - 0x0966));
  const cleaned = latin.replace(/[\s,₹]/g, '');
  if (cleaned === '') return { ok: true, value: null };
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return { ok: false, message: t('val.amount.invalid') };
  if (n < 0) return { ok: false, message: t('val.amount.negative') };
  if (n > 999_999_999_999.99) return { ok: false, message: t('val.amount.tooLarge') };
  return { ok: true, value: Math.round(n * 100) / 100 };
}
