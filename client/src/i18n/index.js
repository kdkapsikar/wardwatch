// Tiny i18n layer (English + Marathi). No library: two flat dictionaries, `t(key, params)`,
// and a translator for the server's English error messages.
//
//  - Dictionaries: en.js (source of truth) and mr.js. server/test/i18n.test.js fails if their keys or
//    {placeholders} ever differ, so nothing silently falls back to English.
//  - The current language lives in this module (set by LanguageProvider) so non-React code - the API
//    client, formatters - can use it. React components must call useT() so they re-render on change.
import en from './en.js';
import mr, { serverMessages as mrServerMessages } from './mr.js';

export const LANGS = [
  { code: 'en', label: 'English', intl: 'en-IN' },
  // -u-nu-latn keeps 0-9 digits (not Devanagari numerals) so numbers match issue IDs, phone numbers, etc.
  { code: 'mr', label: 'मराठी', intl: 'mr-IN-u-nu-latn' },
];
const DICTS = { en, mr };
const STORAGE_KEY = 'ww_lang';

let current = 'en';
export const getLang = () => current;
export const intlLocale = () => LANGS.find((l) => l.code === current).intl;

export function setLang(code) {
  if (DICTS[code]) current = code;
}

export function detectInitialLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && DICTS[saved]) return saved;
  } catch { /* storage blocked: fall through */ }
  const preferred = (navigator.languages?.[0] ?? navigator.language ?? '').toLowerCase();
  return preferred.startsWith('mr') ? 'mr' : 'en';
}

export function persistLang(code) {
  try { localStorage.setItem(STORAGE_KEY, code); } catch { /* ignore */ }
}

/**
 * t('key', { name }) fills {name}. If params.count is given, `key_one` (count === 1) or `key_other`
 * is preferred when it exists. Falls back to English, then to the key itself.
 */
export function translate(key, params = {}) {
  const plural = params.count === undefined ? null : params.count === 1 ? 'one' : 'other';
  const candidates = plural ? [`${key}_${plural}`, key] : [key];
  let template;
  for (const lang of [current, 'en']) {
    template = candidates.map((c) => DICTS[lang][c]).find((v) => v !== undefined);
    if (template !== undefined) break;
  }
  if (template === undefined) return key;
  return template.replace(/\{(\w+)\}/g, (whole, name) => (params[name] !== undefined ? String(params[name]) : whole));
}

// ---- server messages -------------------------------------------------------------------------
// The API returns English messages. Exact ones are looked up in mr.js; the parameterised ones that
// the validation helper builds ("<Field> is required", ...) are matched by pattern.
const FIELD_LABELS = {
  'Full name': 'srvfield.fullName',
  Description: 'srvfield.description',
  'Address / landmark': 'srvfield.address',
  Username: 'srvfield.username',
  Note: 'srvfield.note',
  Remark: 'srvfield.remark',
  'Rejection reason': 'srvfield.rejectionReason',
  Title: 'srvfield.title',
};
const label = (name) => (FIELD_LABELS[name] ? translate(FIELD_LABELS[name]) : name);

export function translateServerMessage(message) {
  if (current === 'en' || typeof message !== 'string') return message;
  if (mrServerMessages[message]) return mrServerMessages[message];
  let m = message.match(/^(.+) is required$/);
  if (m) return translate('srv.required', { field: label(m[1]) });
  m = message.match(/^(.+) must be at least (\d+) characters$/);
  if (m) return translate('srv.min', { field: label(m[1]), n: m[2] });
  m = message.match(/^(.+) must be at most (\d+) characters$/);
  if (m) return translate('srv.max', { field: label(m[1]), n: m[2] });
  return message; // unknown message: better English than nothing
}
