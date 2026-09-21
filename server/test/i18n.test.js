// Translation consistency: English and Marathi must stay in lockstep, every key used in the client
// exists, and every message the API can return has a Marathi version. Pure file/logic checks - no DB.
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientSrc = path.resolve(here, '../../client/src');
const serverSrc = path.resolve(here, '../src');

const { default: en } = await import(path.join(clientSrc, 'i18n/en.js'));
const { default: mr, serverMessages } = await import(path.join(clientSrc, 'i18n/mr.js'));
const i18n = await import(path.join(clientSrc, 'i18n/index.js'));
const { STATUSES, CATEGORIES } = await import('../src/lib/constants.js');

const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : /\.(jsx?|mjs)$/.test(e.name) ? [path.join(dir, e.name)] : [],
  );

describe('dictionaries', () => {
  test('English and Marathi have exactly the same keys', () => {
    const only = (a, b) => Object.keys(a).filter((k) => !(k in b));
    assert.deepEqual(only(en, mr), [], 'keys missing from mr.js');
    assert.deepEqual(only(mr, en), [], 'keys missing from en.js');
  });

  test('every string has the same {placeholders} in both languages, and none is empty', () => {
    for (const key of Object.keys(en)) {
      assert.ok(en[key] !== '' && mr[key] !== '', `${key} is empty`);
      assert.equal(placeholders(mr[key]), placeholders(en[key]), `placeholders differ for "${key}"`);
    }
  });

  test('no Marathi string was left as untranslated English', () => {
    const untranslated = Object.keys(en).filter((k) => mr[k] === en[k] && /[A-Za-z]{4,}/.test(en[k]));
    assert.deepEqual(untranslated, []);
  });

  test('Marathi strings contain Devanagari script (not transliterated Latin)', () => {
    const noDevanagari = Object.keys(mr).filter((k) => /[A-Za-z]{4,}/.test(en[k]) && !/[ऀ-ॿ]/.test(mr[k]));
    assert.deepEqual(noDevanagari, []);
  });

  test('every status, category, chip and rejection reason has a label', () => {
    for (const s of STATUSES) assert.ok(en[`status.${s}`], `status.${s}`);
    for (const c of CATEGORIES) assert.ok(en[`category.${c}`], `category.${c}`);
    for (const s of ['open', 'submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'all']) assert.ok(en[`chip.${s}`], `chip.${s}`);
    for (const r of ['duplicate', 'jurisdiction', 'details', 'resolved', 'notCivic']) assert.ok(en[`reject.suggestion.${r}`], r);
    for (const k of ['denied', 'unavailable', 'timeout', 'unsupported', 'insecure']) assert.ok(en[`map.geo.${k}`], k);
    for (const s of ['none', 'acknowledged', 'in_progress', 'resolved', 'rejected']) assert.ok(en[`upd.submit.${s}`], s);
    for (const n of [1, 2, 3]) assert.ok(en[`home.step${n}.title`] && en[`home.step${n}.text`], `home.step${n}`);
  });

  test('every literal t(\'key\') in the client source exists in the dictionary', () => {
    const used = new Set();
    for (const file of walk(clientSrc)) {
      if (file.includes(`${path.sep}i18n${path.sep}`)) continue;
      for (const m of fs.readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([\w.]+)'/g)) used.add(m[1]);
    }
    assert.ok(used.size > 150, `found only ${used.size} t() calls - is the scan broken?`);
    const missing = [...used].filter((k) => !(k in en) && !(`${k}_other` in en));
    assert.deepEqual(missing, []);
  });

  test('no dictionary key is unused (keeps the files from accumulating dead strings)', () => {
    let source = '';
    for (const file of walk(clientSrc)) {
      if (/i18n[\\/](en|mr)\.js$/.test(file)) continue; // the dictionaries themselves don't count as usage
      source += fs.readFileSync(file, 'utf8');
    }
    const dynamicPrefixes = ['status.', 'category.', 'chip.', 'reject.suggestion.', 'map.geo.', 'upd.submit.', 'home.step', 'srvfield.', 'srv.'];
    const unused = Object.keys(en).filter((k) => {
      const base = k.replace(/_(one|other)$/, '');
      return !source.includes(`'${base}'`) && !source.includes(`"${base}"`) && !dynamicPrefixes.some((p) => base.startsWith(p));
    });
    assert.deepEqual(unused, []);
  });
});

describe('translate()', () => {
  test('interpolation, plurals and English fallback', () => {
    i18n.setLang('mr');
    assert.equal(i18n.translate('nav.signOut', { name: 'Asha' }), 'बाहेर पडा (Asha)');
    assert.equal(i18n.translate('admin.notes.count', { n: 1, count: 1 }), '1 टीप');
    assert.equal(i18n.translate('admin.notes.count', { n: 5, count: 5 }), '5 टिपा');
    i18n.setLang('en');
    assert.equal(i18n.translate('admin.notes.count', { n: 1, count: 1 }), '1 note');
    assert.equal(i18n.translate('admin.notes.count', { n: 3, count: 3 }), '3 notes');
    assert.equal(i18n.translate('no.such.key'), 'no.such.key');
    assert.equal(i18n.translate('nav.signOut'), 'Sign out ({name})'); // missing param left visible, never "undefined"
  });
});

describe('server messages', () => {
  test('translateServerMessage: exact messages, parameterised patterns, unknowns, English passthrough', () => {
    i18n.setLang('mr');
    assert.equal(i18n.translateServerMessage('Invalid username or password'), 'वापरकर्तानाव किंवा पासवर्ड चुकीचा आहे');
    assert.equal(i18n.translateServerMessage('Description must be at least 10 characters'), 'वर्णन किमान 10 अक्षरांचे असावे');
    assert.equal(i18n.translateServerMessage('Full name is required'), 'पूर्ण नाव आवश्यक आहे');
    assert.equal(i18n.translateServerMessage('Remark must be at most 1000 characters'), 'शेरा जास्तीत जास्त 1000 अक्षरांचे असावे');
    assert.equal(i18n.translateServerMessage('Password is required'), 'पासवर्ड आवश्यक आहे'); // exact entry wins over the pattern
    assert.equal(i18n.translateServerMessage('A brand new message'), 'A brand new message');
    assert.equal(i18n.translateServerMessage(undefined), undefined);
    i18n.setLang('en');
    assert.equal(i18n.translateServerMessage('Invalid username or password'), 'Invalid username or password');
  });

  test('every message literal in the server source has a Marathi translation', () => {
    const PATTERNS = [/ is required$/, / must be at least \d+ characters$/, / must be at most \d+ characters$/];
    // Not user-facing API messages: validation labels (used inside the patterns / "X is out of range"),
    // text stored in the database that the client translates separately, and server-side log/misc strings.
    const IGNORE = new Set([
      'Full name', 'Description', 'Address / landmark', 'Username', 'Note', 'Remark', 'Rejection reason', 'Latitude', 'Longitude',
      'Citizen report', 'Issue received',
      // startup/config errors and internal errors: never shown to a user (unexpected errors reach the
      // client only as the generic "Something went wrong" message)
      'DATABASE_URL is not set. Copy server/.env.example to server/.env first.',
      'DATABASE_URL must be a Postgres connection string starting with postgres:// or postgresql:// ',
      'Database is up to date.', 'Could not allocate a unique issue ID',
    ]);
    const SQL = /\b(SELECT|INSERT|UPDATE|DELETE|FROM|WHERE|CREATE|ALTER|VALUES|RETURNING)\b/;
    const found = new Set();
    for (const file of walk(serverSrc)) {
      for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
        const line = raw.trim();
        if (/^(\/\/|\*|\/\*)/.test(line) || line.includes('console.') || line.startsWith('import ')) continue;
        for (const m of line.matchAll(/'([A-Z][^'\n]{6,})'/g)) {
          const text = m[1];
          if (SQL.test(text) || /^(AND|OR) /.test(text) || !text.includes(' ') || IGNORE.has(text) || /^(Cache|Content|Cross|Authorization|WW-)/.test(text)) continue;
          found.add(text);
        }
      }
    }
    // the two photo-limit messages are built from config numbers, so check their rendered form
    found.add('Each photo must be smaller than 5 MB');
    found.add('You can attach at most 5 photos');
    assert.ok(found.size > 20, `scan found only ${found.size} messages`);
    const untranslated = [...found].filter((m) => !(m in serverMessages) && !PATTERNS.some((p) => p.test(m)));
    assert.deepEqual(untranslated, [], 'add these to serverMessages in client/src/i18n/mr.js');
  });
});
