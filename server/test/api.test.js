// Integration tests against a real Postgres. Requires TEST_DATABASE_URL and
// TRUNCATES every table in it - use a dedicated database.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';

import dotenv from 'dotenv';

dotenv.config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is not set. Point it at a throwaway database (see server/.env.example).');
  process.exit(1);
}
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.CORS_ORIGINS = 'https://kdkapsikar.github.io';

const { default: bcrypt } = await import('bcryptjs');
const { createApp } = await import('../src/app.js');
const { pool, query } = await import('../src/db/pool.js');
const { migrate } = await import('../src/db/migrate.js');

// Smallest valid PNG (1x1) and some non-image bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);
const NOT_AN_IMAGE = Buffer.from('<?php echo "hi"; ?>');

let server;
let base;

/** Tiny API client that keeps the session token from login and sends it as a Bearer header. */
function client() {
  let token = '';
  return async (method, url, { json, form, headers: extra } = {}) => {
    const headers = { ...extra };
    if (token) headers.authorization = `Bearer ${token}`;
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(base + url, { method, headers, body });
    const text = await res.text();
    const parsed = text ? JSON.parse(text) : null;
    if (url === '/api/auth/login' && parsed?.token) token = parsed.token;
    if (url === '/api/auth/logout') token = '';
    return { status: res.status, body: parsed, headers: res.headers };
  };
}

function issueForm(overrides = {}, files = []) {
  const fields = {
    ward_id: String(ctx.ward1), category: 'roads',
    description: 'There is a large pothole near the school gate.', address: 'Near school',
    latitude: '18.520430', longitude: '73.856744',
    name: 'Test Citizen', phone: '98765 43210', consent: 'true', ...overrides,
  };
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) if (v !== undefined) form.append(k, v);
  for (const f of files) form.append('photos', new Blob([f.data], { type: f.type }), f.name);
  return form;
}

const ctx = {};

before(async () => {
  await migrate({ log: () => {} });
  server = createApp().listen(0);
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await pool.end();
});

beforeEach(async () => {
  await query('TRUNCATE photos, issue_updates, issues, sessions, corporators, admins, wards RESTART IDENTITY CASCADE');
  const hash = await bcrypt.hash('correct-horse-1', 4);
  const w1 = (await query("INSERT INTO wards (number, name) VALUES (1, 'Ward One') RETURNING id")).rows[0].id;
  const w2 = (await query("INSERT INTO wards (number, name) VALUES (2, 'Ward Two') RETURNING id")).rows[0].id;
  await query("INSERT INTO wards (number, name) VALUES (3, 'Ward Three (no corporator)')");
  ctx.ward1 = w1;
  ctx.ward2 = w2;
  ctx.ward3 = (await query('SELECT id FROM wards WHERE number = 3')).rows[0].id;
  await query('INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)', [w1, 'Corp One', 'corp1', hash]);
  await query('INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)', [w2, 'Corp Two', 'corp2', hash]);
  await query("INSERT INTO admins (name, username, password_hash) VALUES ('Mayor', 'admin', $1)", [hash]);
});

describe('citizen flow', () => {
  test('lists wards', async () => {
    const res = await client()('GET', '/api/wards');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.wards.map((w) => w.number), [1, 2, 3]);
  });

  test('submits an issue with a photo and gets a unique ID', async () => {
    const api = client();
    const res = await api('POST', '/api/issues', { form: issueForm({}, [{ data: PNG, type: 'image/png', name: 'a.png' }]) });
    assert.equal(res.status, 201);
    assert.match(res.body.issue_id, /^WW-[A-Z2-9]{8}$/);

    const track = await api('GET', `/api/issues/${res.body.issue_id}`);
    assert.equal(track.status, 200);
    assert.equal(track.body.issue.status, 'submitted');
    assert.equal(track.body.issue.photos.length, 1);
    assert.match(track.body.issue.photos[0], /^\/uploads\/[0-9a-f-]+\.png$/);
    assert.equal(track.body.issue.updates.length, 1);
    assert.equal(track.body.issue.updates[0].status, 'submitted');
    // Public view must never leak citizen contact details.
    assert.equal(JSON.stringify(track.body).includes('9876543210'), false);
    assert.equal(JSON.stringify(track.body).includes('Test Citizen'), false);

    // ...and the stored photo is actually served.
    const img = await fetch(base + track.body.issue.photos[0]);
    assert.equal(img.status, 200);
  });

  test('assigns the ward corporator; leaves issues in unstaffed wards unassigned', async () => {
    const api = client();
    await api('POST', '/api/issues', { form: issueForm() });
    await api('POST', '/api/issues', { form: issueForm({ ward_id: String(ctx.ward3) }) });
    const { rows } = await query('SELECT corporator_id FROM issues ORDER BY id');
    assert.notEqual(rows[0].corporator_id, null);
    assert.equal(rows[1].corporator_id, null);
  });

  test('validates input with per-field errors', async () => {
    const res = await client()('POST', '/api/issues', { form: issueForm({ phone: '123', category: 'nope', ward_id: '' }) });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['category', 'phone', 'ward_id']);
  });

  test('every mandatory field is enforced with its own message', async () => {
    const res = await client()('POST', '/api/issues', {
      form: issueForm({
        name: '', phone: '', category: '', description: '', latitude: undefined, longitude: undefined, consent: undefined,
      }),
    });
    assert.equal(res.status, 400);
    const f = res.body.error.fields;
    assert.deepEqual(Object.keys(f).sort(), ['category', 'consent', 'description', 'latitude', 'longitude', 'name', 'phone']);
    assert.equal(f.name, 'Full name is required');
    assert.equal(f.description, 'Description is required');
    assert.match(f.phone, /10-digit Indian mobile/);
    assert.match(f.consent, /confirm/i);
    assert.equal((await query('SELECT count(*)::int AS n FROM issues')).rows[0].n, 0);
  });

  test('accepts only valid 10-digit Indian mobile numbers (6-9 start) and stores them normalised', async () => {
    const api = client();
    for (const bad of ['1234567890', '5987654321', '98765', '987654321', '98765432100', 'abcdefghij', '98765 4321x', '+1 9876543210']) {
      const res = await api('POST', '/api/issues', { form: issueForm({ phone: bad }) });
      assert.equal(res.status, 400, `expected "${bad}" to be rejected`);
      assert.match(res.body.error.fields.phone, /10-digit Indian mobile/);
    }
    for (const good of ['९८७६५४३२१०', '+९१ ९८७६५ ४३२१०', '9876543210', '98765 43210', '98765-43210', '+91 98765 43210', '919876543210', '09876543210', '6000000000', '9198765432']) {
      const res = await api('POST', '/api/issues', { form: issueForm({ phone: good }) });
      assert.equal(res.status, 201, `expected "${good}" to be accepted`);
    }
    const stored = (await query('SELECT citizen_phone FROM issues ORDER BY id')).rows.map((r) => r.citizen_phone);
    assert.deepEqual(stored, ['9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '6000000000', '9198765432']);
  });

  test('requires the consent declaration and records when it was given', async () => {
    const api = client();
    for (const bad of [undefined, '', 'false', 'on', '1']) {
      const res = await api('POST', '/api/issues', { form: issueForm({ consent: bad }) });
      assert.equal(res.status, 400, `consent=${bad} must be rejected`);
      assert.ok(res.body.error.fields.consent);
    }
    assert.equal((await query('SELECT count(*)::int AS n FROM issues')).rows[0].n, 0);
    assert.equal((await api('POST', '/api/issues', { form: issueForm() })).status, 201);
    const { rows } = await query("SELECT consent_at FROM issues WHERE consent_at > now() - interval '1 minute'");
    assert.equal(rows.length, 1);
  });

  test('no title is needed: the headline is derived from the description', async () => {
    const api = client();
    const title = async (description, extra = {}) => {
      const res = await api('POST', '/api/issues', { form: issueForm({ description, ...extra }) });
      assert.equal(res.status, 201, JSON.stringify(res.body));
      return (await api('GET', `/api/issues/${res.body.issue_id}`)).body.issue.title;
    };
    // short description is used as-is
    assert.equal(await title('There is a large pothole near the school gate.'), 'There is a large pothole near the school gate.');
    // whitespace and line breaks are collapsed
    assert.equal(await title('Water   leaks\n\nfrom the   main pipe'), 'Water leaks from the main pipe');
    // long descriptions are cut at a word boundary with an ellipsis, within the DB limit
    const long = 'The street light outside the community hall has not worked for three weeks and it is dark and unsafe at night for everyone walking home.';
    const cut = await title(long);
    assert.ok(cut.endsWith('…') && cut.length <= 81 && cut.length >= 5, cut);
    assert.ok(long.startsWith(cut.slice(0, -1)), 'cut text must be a prefix of the description');
    assert.ok(!/ …$/.test(cut));
    // a description that is mostly whitespace still yields a valid (>= 5 chars) title
    assert.ok((await title('a         b')).length >= 5);
    // a title sent by an old client is ignored, not trusted
    assert.equal(await title('Broken swing in the park', { title: 'IGNORED TITLE' }), 'Broken swing in the park');
  });

  test('requires a location and rejects impossible coordinates', async () => {
    const api = client();
    const missing = await api('POST', '/api/issues', { form: issueForm({ latitude: undefined, longitude: undefined }) });
    assert.equal(missing.status, 400);
    assert.match(missing.body.error.fields.latitude, /location/i);
    assert.match(missing.body.error.fields.longitude, /location/i);

    const blank = await api('POST', '/api/issues', { form: issueForm({ latitude: '', longitude: '' }) });
    assert.equal(blank.status, 400);
    const junk = await api('POST', '/api/issues', { form: issueForm({ latitude: 'abc', longitude: '73.8' }) });
    assert.equal(junk.status, 400);
    const range = await api('POST', '/api/issues', { form: issueForm({ latitude: '91', longitude: '181' }) });
    assert.equal(range.status, 400);
    assert.deepEqual(Object.keys(range.body.error.fields).sort(), ['latitude', 'longitude']);
    assert.equal((await query('SELECT count(*)::int AS n FROM issues')).rows[0].n, 0);
  });

  test('stores coordinates (rounded to 6 places); public view hides them, corporator sees them', async () => {
    const api = client();
    const { body } = await api('POST', '/api/issues', { form: issueForm({ latitude: '18.52043051', longitude: '-73.8567449' }) });
    const row = (await query('SELECT latitude, longitude FROM issues')).rows[0];
    assert.equal(row.latitude, 18.520431);
    assert.equal(row.longitude, -73.856745);

    const pub = await api('GET', `/api/issues/${body.issue_id}`);
    assert.equal('location' in pub.body.issue, false);
    assert.equal(JSON.stringify(pub.body).includes('18.52043'), false);

    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    const detail = await corp('GET', `/api/corporator/issues/${body.issue_id}`);
    assert.deepEqual(detail.body.issue.location, { latitude: 18.520431, longitude: -73.856745 });
  });

  test('rejects an unknown ward', async () => {
    const res = await client()('POST', '/api/issues', { form: issueForm({ ward_id: '9999' }) });
    assert.equal(res.status, 400);
    assert.ok(res.body.error.fields.ward_id);
  });

  test('rejects non-image uploads even when labelled image/jpeg, and stores nothing', async () => {
    const photosBefore = (await query('SELECT count(*)::int AS n FROM photos')).rows[0].n;
    const res = await client()('POST', '/api/issues', {
      form: issueForm({}, [{ data: NOT_AN_IMAGE, type: 'image/jpeg', name: 'evil.jpg' }]),
    });
    assert.equal(res.status, 400);
    assert.equal((await query('SELECT count(*)::int AS n FROM issues')).rows[0].n, 0);
    assert.equal((await query('SELECT count(*)::int AS n FROM photos')).rows[0].n, photosBefore);
  });

  test('rejects more than 5 photos', async () => {
    const files = Array.from({ length: 6 }, (_, i) => ({ data: PNG, type: 'image/png', name: `${i}.png` }));
    const res = await client()('POST', '/api/issues', { form: issueForm({}, files) });
    assert.equal(res.status, 400);
  });

  test('tracking tolerates lowercase / missing dash and 404s on unknown IDs', async () => {
    const api = client();
    const { body } = await api('POST', '/api/issues', { form: issueForm() });
    const sloppy = body.issue_id.toLowerCase().replace('-', '');
    assert.equal((await api('GET', `/api/issues/${sloppy}`)).status, 200);
    assert.equal((await api('GET', '/api/issues/WW-AAAAAAAA')).status, 404);
    assert.equal((await api('GET', '/api/issues/garbage')).status, 404);
  });
});

describe('auth', () => {
  test('rejects bad credentials and accepts good ones', async () => {
    const api = client();
    assert.equal((await api('POST', '/api/auth/login', { json: { username: 'corp1', password: 'wrong' } })).status, 401);
    assert.equal((await api('POST', '/api/auth/login', { json: { username: 'nobody', password: 'x' } })).status, 401);
    const ok = await api('POST', '/api/auth/login', { json: { username: 'CORP1', password: 'correct-horse-1' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.auth.role, 'corporator');
    assert.equal(ok.body.auth.user.ward.number, 1);
    assert.equal((await api('GET', '/api/auth/me')).body.auth.user.username, 'corp1');
    await api('POST', '/api/auth/logout');
    assert.equal((await api('GET', '/api/auth/me')).body.auth, null);
  });

  test('one login endpoint resolves the role from the account', async () => {
    const as = async (username) => (await client()('POST', '/api/auth/login', { json: { username, password: 'correct-horse-1' } })).body.auth;
    assert.equal((await as('admin')).role, 'admin');
    assert.equal((await as('corp2')).role, 'corporator');
    assert.equal((await as('corp2')).user.ward.number, 2);
    // the old per-role endpoints are gone
    assert.equal((await client()('POST', '/api/auth/admin/login', { json: { username: 'admin', password: 'correct-horse-1' } })).status, 404);
  });

  test('same username in both tables: the password picks the account', async () => {
    const hash = await bcrypt.hash('other-password-9', 4);
    await query("INSERT INTO admins (name, username, password_hash) VALUES ('Clash', 'corp1', $1)", [hash]);
    const login = async (password) => (await client()('POST', '/api/auth/login', { json: { username: 'corp1', password } }));
    assert.equal((await login('correct-horse-1')).body.auth.role, 'corporator');
    assert.equal((await login('other-password-9')).body.auth.role, 'admin');
    assert.equal((await login('nope')).status, 401);
  });

  test('inactive accounts cannot sign in even with the right password', async () => {
    await query("UPDATE admins SET is_active = false WHERE username = 'admin'");
    assert.equal((await client()('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } })).status, 401);
  });

  test('stores only a hash of the session token', async () => {
    const api = client();
    await api('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    const { rows } = await query('SELECT token_hash FROM sessions');
    assert.equal(rows.length, 1);
    assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
  });

  test('protects corporator and admin routes, and roles do not cross over', async () => {
    const anon = client();
    assert.equal((await anon('GET', '/api/corporator/issues')).status, 401);
    assert.equal((await anon('GET', '/api/admin/dashboard')).status, 401);

    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.equal((await corp('GET', '/api/admin/dashboard')).status, 403);

    const admin = client();
    await admin('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    assert.equal((await admin('GET', '/api/corporator/issues')).status, 403);
  });

  test('deactivating a corporator invalidates their live session', async () => {
    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.equal((await corp('GET', '/api/corporator/issues')).status, 200);
    await query("UPDATE corporators SET is_active = false WHERE username = 'corp1'");
    assert.equal((await corp('GET', '/api/corporator/issues')).status, 401);
  });
});

describe('corporator flow', () => {
  async function fileIssue(wardId) {
    const { body } = await client()('POST', '/api/issues', { form: issueForm({ ward_id: String(wardId) }) });
    return body.issue_id;
  }
  async function login(username) {
    const api = client();
    await api('POST', '/api/auth/login', { json: { username, password: 'correct-horse-1' } });
    return api;
  }

  test('sees only own-ward issues, with citizen contact details', async () => {
    const mine = await fileIssue(ctx.ward1);
    const theirs = await fileIssue(ctx.ward2);
    const corp = await login('corp1');

    const list = await corp('GET', '/api/corporator/issues');
    assert.deepEqual(list.body.issues.map((i) => i.public_id), [mine]);
    assert.equal(list.body.counts.submitted, 1);

    const detail = await corp('GET', `/api/corporator/issues/${mine}`);
    assert.equal(detail.body.issue.citizen.phone, '9876543210');
    assert.equal((await corp('GET', `/api/corporator/issues/${theirs}`)).status, 404);
    assert.equal((await corp('POST', `/api/corporator/issues/${theirs}/updates`, { form: updateForm({ status: 'resolved', remark: 'x' }) })).status, 404);
  });

  function updateForm(fields, files = []) {
    const form = new FormData();
    for (const [k, v] of Object.entries(fields)) form.append(k, v);
    for (const f of files) form.append('photos', new Blob([f.data], { type: f.type }), f.name);
    return form;
  }

  test('updates status with remark and photo; history is visible to the citizen', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');

    const ack = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ status: 'in_progress', remark: 'Crew scheduled' }) });
    assert.equal(ack.status, 201);
    assert.equal(ack.body.issue.status, 'in_progress');

    const done = await corp('POST', `/api/corporator/issues/${id}/updates`, {
      form: updateForm({ status: 'resolved', remark: 'Filled and levelled' }, [{ data: PNG, type: 'image/png', name: 'after.png' }]),
    });
    assert.equal(done.status, 201);
    assert.ok(done.body.issue.resolved_at);

    const pub = await client()('GET', `/api/issues/${id}`);
    assert.deepEqual(pub.body.issue.updates.map((u) => u.status), ['submitted', 'in_progress', 'resolved']);
    assert.equal(pub.body.issue.updates[2].by, 'Corp One');
    assert.equal(pub.body.issue.updates[2].photos.length, 1);
    assert.equal(pub.body.issue.updates[0].by, null);
  });

  test('empty updates and the internal "submitted" status are rejected', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    const empty = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({}) });
    assert.equal(empty.status, 400);
    const invalid = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ status: 'submitted', remark: 'x' }) });
    assert.equal(invalid.status, 400);
  });

  test('remark-only update keeps status; reopening clears resolved_at', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ status: 'resolved', remark: 'Done' }) });
    const note = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ remark: 'Follow-up note' }) });
    assert.equal(note.body.issue.status, 'resolved');
    const reopened = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ status: 'in_progress', remark: 'Recurred' }) });
    assert.equal(reopened.body.issue.resolved_at, null);
  });

  test('filters by status', async () => {
    const a = await fileIssue(ctx.ward1);
    await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    await corp('POST', `/api/corporator/issues/${a}/updates`, { form: updateForm({ status: 'resolved', remark: 'ok' }) });
    assert.equal((await corp('GET', '/api/corporator/issues?status=open')).body.issues.length, 1);
    assert.equal((await corp('GET', '/api/corporator/issues?status=resolved')).body.issues.length, 1);
    assert.equal((await corp('GET', '/api/corporator/issues?status=bogus')).status, 400);
  });
});

describe('corporator portal: rejection, transfer, dashboard', () => {
  const fileIssue = async (wardId, extra = {}) =>
    (await client()('POST', '/api/issues', { form: issueForm({ ward_id: String(wardId), ...extra }) })).body.issue_id;
  const login = async (username) => {
    const api = client();
    await api('POST', '/api/auth/login', { json: { username, password: 'correct-horse-1' } });
    return api;
  };
  const form = (fields, files = []) => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    for (const file of files) f.append('photos', new Blob([file.data], { type: file.type }), file.name);
    return f;
  };
  const post = (api, id, fields, files) => api('POST', `/api/corporator/issues/${id}/updates`, { form: form(fields, files) });
  const publicIssue = async (id) => (await client()('GET', `/api/issues/${id}`)).body.issue;

  test('the remark is optional: resolving needs nothing else', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    const res = await post(corp, id, { status: 'resolved' });
    assert.equal(res.status, 201);
    assert.equal(res.body.issue.status, 'resolved');
    assert.equal(res.body.issue.updates.at(-1).remark, null);
  });

  test('rejecting needs a reason; proof photos and remark are optional; the reason is public', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');

    const none = await post(corp, id, { status: 'rejected' });
    assert.equal(none.status, 400);
    assert.equal(none.body.error.fields.rejection_reason, 'Enter the reason for rejecting this issue');
    const withRemarkOnly = await post(corp, id, { status: 'rejected', remark: 'A remark is not a reason' });
    assert.equal(withRemarkOnly.status, 400);
    assert.ok(withRemarkOnly.body.error.fields.rejection_reason);
    const tooShort = await post(corp, id, { status: 'rejected', rejection_reason: 'no' });
    assert.equal(tooShort.status, 400);
    assert.match(tooShort.body.error.fields.rejection_reason, /at least 5/);
    assert.equal((await publicIssue(id)).status, 'submitted', 'failed rejections must not change the issue');

    const ok = await post(corp, id, { status: 'rejected', rejection_reason: 'Duplicate of an existing complaint' }, [
      { data: PNG, type: 'image/png', name: 'proof.png' },
    ]);
    assert.equal(ok.status, 201);
    const last = (await publicIssue(id)).updates.at(-1);
    assert.equal(last.status, 'rejected');
    assert.equal(last.rejection_reason, 'Duplicate of an existing complaint');
    assert.equal(last.remark, null);
    assert.equal(last.photos.length, 1);

    // adding a note to an already-rejected issue does not need a new reason
    assert.equal((await post(corp, id, { remark: 'Called the citizen to explain' })).status, 201);
  });

  test('a rejection reason sent with a non-rejection is not stored', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    assert.equal((await post(corp, id, { status: 'in_progress', rejection_reason: 'should be ignored' })).status, 201);
    const { rows } = await query('SELECT rejection_reason FROM issue_updates u JOIN issues i ON i.id = u.issue_id WHERE i.public_id = $1 ORDER BY u.id DESC LIMIT 1', [id]);
    assert.equal(rows[0].rejection_reason, null);
  });

  test('transfer: the issue moves to the other constituency\'s corporator and the history records it', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp1 = await login('corp1');
    await post(corp1, id, { status: 'in_progress', remark: 'Started' });

    const res = await corp1('POST', `/api/corporator/issues/${id}/transfer`, { json: { ward_id: ctx.ward2, note: 'This street is in your constituency' } });
    assert.equal(res.status, 200);
    assert.equal(res.body.transferred_to.number, 2);

    // sender lost access; receiver has it, restarted as "submitted"
    assert.equal((await corp1('GET', `/api/corporator/issues/${id}`)).status, 404);
    assert.equal((await post(corp1, id, { remark: 'still mine?' })).status, 404);
    const corp2 = await login('corp2');
    const seen = await corp2('GET', `/api/corporator/issues/${id}`);
    assert.equal(seen.status, 200);
    assert.equal(seen.body.issue.status, 'submitted');
    assert.equal(seen.body.issue.ward.number, 2);
    assert.deepEqual((await corp2('GET', '/api/corporator/issues')).body.issues.map((i) => i.public_id), [id]);
    assert.equal((await corp1('GET', '/api/corporator/issues')).body.issues.length, 0);

    // public history shows the transfer (who, from, to, note) and the new constituency
    const pub = await publicIssue(id);
    assert.equal(pub.ward.number, 2);
    const t = pub.updates.at(-1);
    assert.equal(t.event, 'transfer');
    assert.equal(t.by, 'Corp One');
    assert.equal(t.remark, 'This street is in your constituency');
    assert.deepEqual([t.transfer.from.number, t.transfer.to.number], [1, 2]);
    assert.equal(pub.updates.at(-2).event, 'update');

    // the receiving corporator can carry on, and can even send it back
    assert.equal((await post(corp2, id, { status: 'acknowledged' })).status, 201);
    assert.equal((await corp2('POST', `/api/corporator/issues/${id}/transfer`, { json: { ward_id: ctx.ward1 } })).status, 200);
  });

  test('transfer rules: same/unstaffed/unknown constituency, closed issues, foreign issues, roles', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp1 = await login('corp1');
    const tryTransfer = (api, issueId, body) => api('POST', `/api/corporator/issues/${issueId}/transfer`, { json: body });

    const same = await tryTransfer(corp1, id, { ward_id: ctx.ward1 });
    assert.equal(same.status, 400);
    assert.match(same.body.error.fields.ward_id, /different constituency/);
    const unstaffed = await tryTransfer(corp1, id, { ward_id: ctx.ward3 });
    assert.equal(unstaffed.status, 400);
    assert.match(unstaffed.body.error.fields.ward_id, /no active corporator/);
    assert.equal((await tryTransfer(corp1, id, { ward_id: 999999 })).status, 400);
    assert.equal((await tryTransfer(corp1, id, {})).status, 400);
    assert.equal((await publicIssue(id)).ward.number, 1, 'failed transfers must not move the issue');

    await post(corp1, id, { status: 'resolved' });
    const closed = await tryTransfer(corp1, id, { ward_id: ctx.ward2 });
    assert.equal(closed.status, 400);
    assert.equal(closed.body.error.code, 'not_transferable');

    const foreign = await fileIssue(ctx.ward2);
    assert.equal((await tryTransfer(corp1, foreign, { ward_id: ctx.ward1 })).status, 404);
    assert.equal((await tryTransfer(client(), id, { ward_id: ctx.ward2 })).status, 401);
    const admin = client();
    await admin('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    assert.equal((await tryTransfer(admin, id, { ward_id: ctx.ward2 })).status, 403);
  });

  test('transfer targets: other constituencies with an active corporator', async () => {
    const corp1 = await login('corp1');
    const targets = await corp1('GET', '/api/corporator/transfer-targets');
    assert.deepEqual(targets.body.wards.map((w) => w.number), [2]); // ward 3 has no corporator; own ward excluded
    await query("UPDATE corporators SET is_active = false WHERE username = 'corp2'");
    assert.deepEqual((await corp1('GET', '/api/corporator/transfer-targets')).body.wards, []);
    const noTarget = await fileIssue(ctx.ward1);
    assert.equal((await corp1('POST', `/api/corporator/issues/${noTarget}/transfer`, { json: { ward_id: ctx.ward2 } })).status, 400);
  });

  test('dashboard: only my numbers, with drill-down data', async () => {
    const [a, b, c, old] = [await fileIssue(ctx.ward1, { category: 'roads' }), await fileIssue(ctx.ward1, { category: 'water' }),
      await fileIssue(ctx.ward1, { category: 'roads' }), await fileIssue(ctx.ward1, { category: 'roads' })];
    await fileIssue(ctx.ward2, { category: 'roads' }); // someone else's
    const corp1 = await login('corp1');
    await post(corp1, a, { status: 'resolved' });
    await post(corp1, b, { status: 'rejected', rejection_reason: 'Not a civic issue' });
    await post(corp1, c, { status: 'in_progress' });
    await query("UPDATE issues SET created_at = now() - interval '10 days' WHERE public_id = $1", [old]);

    const { status, body } = await corp1('GET', '/api/corporator/dashboard');
    assert.equal(status, 200);
    const t = body.totals;
    assert.deepEqual([t.total, t.resolved, t.rejected, t.open, t.in_progress, t.submitted, t.overdue], [4, 1, 1, 2, 1, 1, 1]);
    assert.equal(t.resolution_rate, 33.3); // 1 / (4 - 1)
    assert.equal(t.received_30d, 4);
    assert.equal(t.resolved_30d, 1);
    assert.equal(typeof t.avg_resolution_hours, 'number');
    assert.deepEqual(body.by_category, [
      { category: 'roads', total: 3, open: 2, resolved: 1, rejected: 0 },
      { category: 'water', total: 1, open: 0, resolved: 0, rejected: 1 },
    ]);
    assert.equal(body.needs_attention[0].public_id, old); // oldest open first
    assert.ok(body.needs_attention[0].age_days >= 10);
    assert.equal(body.needs_attention.length, 2);
    assert.equal(body.overdue_days, 7);

    const other = (await (await login('corp2'))('GET', '/api/corporator/dashboard')).body;
    assert.equal(other.totals.total, 1);
    assert.equal((await client()('GET', '/api/corporator/dashboard')).status, 401);
    const admin = client();
    await admin('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    assert.equal((await admin('GET', '/api/corporator/dashboard')).status, 403);
  });

  test('issue list drill-down filters: status, category, overdue (counts follow the filters)', async () => {
    const [r1, w1, r2] = [await fileIssue(ctx.ward1, { category: 'roads' }), await fileIssue(ctx.ward1, { category: 'water' }), await fileIssue(ctx.ward1, { category: 'roads' })];
    const corp1 = await login('corp1');
    await post(corp1, r2, { status: 'resolved' });
    await query("UPDATE issues SET created_at = now() - interval '9 days' WHERE public_id = ANY($1)", [[r1, r2]]);
    const list = async (qs) => (await corp1('GET', `/api/corporator/issues${qs}`)).body;
    const ids = (body) => body.issues.map((i) => i.public_id).sort();

    assert.deepEqual(ids(await list('?status=all')), [r1, w1, r2].sort());
    assert.deepEqual(ids(await list('?category=roads&status=all')), [r1, r2].sort());
    assert.deepEqual(ids(await list('?category=roads&status=open')), [r1]);
    assert.deepEqual(ids(await list('?overdue=1&status=open')), [r1]);      // r2 is old but resolved; w1 is new
    assert.deepEqual(ids(await list('?overdue=1')), [r1]);
    const roads = await list('?category=roads&status=all');
    assert.deepEqual([roads.counts.submitted, roads.counts.resolved, roads.total], [1, 1, 2]);
    assert.equal(roads.counts.water, undefined);
    assert.equal((await corp1('GET', '/api/corporator/issues?category=bogus')).status, 400);
  });
});

describe('admin portal: category drill-down, records, private notes', () => {
  const asAdmin = async (username = 'admin') => {
    const api = client();
    const res = await api('POST', '/api/auth/login', { json: { username, password: 'correct-horse-1' } });
    assert.equal(res.status, 200, `login ${username}`);
    return api;
  };
  const fileIssue = async (wardId, extra = {}) =>
    (await client()('POST', '/api/issues', { form: issueForm({ ward_id: String(wardId), ...extra }) })).body.issue_id;
  const secondAdmin = async () => {
    await query('INSERT INTO admins (name, username, password_hash) VALUES ($1, $2, $3)', ['Deputy', 'admin2', await bcrypt.hash('correct-horse-1', 4)]);
  };
  const resolve = async (issueId) => {
    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    const form = new FormData(); form.append('status', 'resolved');
    return corp('POST', `/api/corporator/issues/${issueId}/updates`, { form });
  };

  test('dashboard: category split city-wide, ready for the pie chart', async () => {
    const [r1, r2] = [await fileIssue(ctx.ward1, { category: 'roads' }), await fileIssue(ctx.ward1, { category: 'roads' })];
    await fileIssue(ctx.ward2, { category: 'roads' });
    await fileIssue(ctx.ward1, { category: 'water' });
    await resolve(r1); void r2;
    const admin = await asAdmin();
    const { body } = await admin('GET', '/api/admin/dashboard');
    assert.deepEqual(body.by_category, [
      { category: 'roads', total: 3, open: 2, resolved: 1, rejected: 0 },
      { category: 'water', total: 1, open: 1, resolved: 0, rejected: 0 },
    ]);
    assert.equal(body.by_category.reduce((n, c) => n + c.total, 0), body.totals.total);
    assert.deepEqual(body.my_notes, { count: 0, with_budget: 0, budget_total: 0 });
  });

  test('issue list (the drill-down target): filters, counts, corporator name, roles', async () => {
    const roads1 = await fileIssue(ctx.ward1, { category: 'roads' });
    const roads2 = await fileIssue(ctx.ward2, { category: 'roads' });
    const water = await fileIssue(ctx.ward1, { category: 'water' });
    const orphan = await fileIssue(ctx.ward3, { category: 'roads' }); // ward 3 has no corporator
    await resolve(roads1);
    await query("UPDATE issues SET created_at = now() - interval '9 days' WHERE public_id = ANY($1)", [[roads2, water]]);
    const admin = await asAdmin();
    const list = async (qs) => (await admin('GET', `/api/admin/issues${qs}`)).body;
    const ids = (b) => b.issues.map((i) => i.public_id).sort();

    assert.deepEqual(ids(await list('?status=all')), [roads1, roads2, water, orphan].sort());
    assert.deepEqual(ids(await list('?category=roads&status=all')), [roads1, roads2, orphan].sort());
    assert.deepEqual(ids(await list('?category=roads&status=open')), [roads2, orphan].sort());
    assert.deepEqual(ids(await list('?ward=2&status=all')), [roads2]);
    assert.deepEqual(ids(await list('?overdue=1&status=open')), [roads2, water].sort());
    const roads = await list('?category=roads&status=all');
    assert.deepEqual([roads.total, roads.counts.resolved, roads.counts.submitted], [3, 1, 2]);
    assert.equal(roads.counts.water, undefined);
    const byId = Object.fromEntries(roads.issues.map((i) => [i.public_id, i]));
    assert.equal(byId[roads1].corporator_name, 'Corp One');
    assert.equal(byId[orphan].corporator_name, null);
    assert.equal(byId[roads2].ward.number, 2);
    assert.equal((await admin('GET', '/api/admin/issues?category=bogus')).status, 400);
    assert.equal((await admin('GET', '/api/admin/issues?ward=abc')).status, 400);

    assert.equal((await client()('GET', '/api/admin/issues')).status, 401);
    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.equal((await corp('GET', '/api/admin/issues')).status, 403);
  });

  test('the record: full read-only detail with contact, location and assigned corporator', async () => {
    const id = await fileIssue(ctx.ward1, { category: 'drainage' });
    await resolve(id);
    const admin = await asAdmin();
    const { status, body } = await admin('GET', `/api/admin/issues/${id.toLowerCase()}`); // sloppy IDs are fine
    assert.equal(status, 200);
    assert.equal(body.issue.public_id, id);
    assert.equal(body.issue.citizen.phone, '9876543210');
    assert.deepEqual(body.issue.location, { latitude: 18.52043, longitude: 73.856744 });
    assert.equal(body.issue.assigned_to, 'Corp One');
    assert.deepEqual(body.issue.updates.map((u) => u.status), ['submitted', 'resolved']);
    assert.equal((await admin('GET', '/api/admin/issues/WW-AAAAAAAA')).status, 404);
    assert.equal((await admin('GET', '/api/admin/issues/garbage')).status, 404);
    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.equal((await corp('GET', `/api/admin/issues/${id}`)).status, 403);
    assert.equal(JSON.stringify((await client()('GET', `/api/issues/${id}`)).body).includes('9876543210'), false);
  });

  test('notes: a note (with optional budget) is visible only to the admin who wrote it', async () => {
    await secondAdmin();
    const issue = await fileIssue(ctx.ward1);
    const mayor = await asAdmin('admin');
    const deputy = await asAdmin('admin2');

    const general = await mayor('POST', '/api/admin/notes', { json: { body: 'Ring-fence funds for monsoon repairs', budget_amount: '\u20B9 1,25,000.50' } });
    assert.equal(general.status, 201);
    assert.equal(general.body.note.budget_amount, 125000.5);
    assert.equal(general.body.note.issue, null);
    const linked = await mayor('POST', '/api/admin/notes', { json: { body: 'Needs a new culvert - est. cost below', budget_amount: 40000, issue } });
    assert.equal(linked.status, 201);
    assert.equal(linked.body.note.issue.public_id, issue);
    const noAmount = await mayor('POST', '/api/admin/notes', { json: { body: 'Just a reminder, no budget' } });
    assert.equal(noAmount.body.note.budget_amount, null);

    // the author sees all of them, with totals; the per-issue filter works
    const mine = (await mayor('GET', '/api/admin/notes')).body;
    assert.equal(mine.notes.length, 3);
    assert.deepEqual(mine.totals, { count: 3, budget_total: 165000.5 });
    assert.deepEqual((await mayor('GET', `/api/admin/notes?issue=${issue}`)).body.notes.map((n) => n.id), [linked.body.note.id]);
    assert.equal((await mayor('GET', '/api/admin/dashboard')).body.my_notes.budget_total, 165000.5);

    // another admin sees NOTHING of it - list, dashboard, update, delete
    assert.deepEqual((await deputy('GET', '/api/admin/notes')).body, { notes: [], totals: { count: 0, budget_total: 0 } });
    assert.deepEqual((await deputy('GET', `/api/admin/notes?issue=${issue}`)).body.notes, []);
    assert.equal((await deputy('GET', '/api/admin/dashboard')).body.my_notes.count, 0);
    const id = general.body.note.id;
    assert.equal((await deputy('PUT', `/api/admin/notes/${id}`, { json: { body: 'hijacked', budget_amount: 1 } })).status, 404);
    assert.equal((await deputy('DELETE', `/api/admin/notes/${id}`)).status, 404);
    const still = (await mayor('GET', '/api/admin/notes')).body.notes.find((n) => n.id === id);
    assert.equal(still.body, 'Ring-fence funds for monsoon repairs');
    assert.equal(still.budget_amount, 125000.5);

    // and nobody else can reach the endpoints at all
    assert.equal((await client()('GET', '/api/admin/notes')).status, 401);
    const corp = client();
    await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    for (const [m, u] of [['GET', '/api/admin/notes'], ['POST', '/api/admin/notes'], ['DELETE', `/api/admin/notes/${id}`]]) {
      assert.equal((await corp(m, u, m === 'POST' ? { json: { body: 'x' } } : {})).status, 403, `${m} ${u}`);
    }

    // note text never leaks into any issue payload (public, corporator or admin record)
    const payloads = [
      JSON.stringify((await client()('GET', `/api/issues/${issue}`)).body),
      JSON.stringify((await corp('GET', `/api/corporator/issues/${issue}`)).body),
      JSON.stringify((await mayor('GET', `/api/admin/issues/${issue}`)).body),
    ];
    for (const p of payloads) assert.equal(p.includes('culvert'), false);
  });

  test('notes: create / edit / clear budget / delete, with validation', async () => {
    const admin = await asAdmin();
    const post = (json) => admin('POST', '/api/admin/notes', { json });
    assert.equal((await post({ body: '' })).status, 400);
    assert.equal((await post({ body: '   ' })).status, 400);
    assert.equal((await post({ body: 'x'.repeat(2001) })).status, 400);
    assert.match((await post({ body: 'ok', budget_amount: -5 })).body.error.fields.budget_amount, /negative/);
    assert.equal((await post({ body: 'ok', budget_amount: 'abc' })).status, 400);
    assert.equal((await post({ body: 'ok', budget_amount: '1e15' })).status, 400);
    assert.equal((await post({ body: 'ok', issue: 'nonsense' })).status, 400);
    assert.match((await post({ body: 'ok', issue: 'WW-AAAAAAAA' })).body.error.fields.issue, /not found/);
    assert.equal((await admin('GET', '/api/admin/notes')).body.notes.length, 0, 'invalid notes must not be stored');

    const created = (await post({ body: 'First draft', budget_amount: 1000.999 })).body.note;
    assert.equal(created.budget_amount, 1001); // rounded to paise
    const edited = await admin('PUT', `/api/admin/notes/${created.id}`, { json: { body: 'Revised', budget_amount: '2,50,000' } });
    assert.equal(edited.status, 200);
    assert.deepEqual([edited.body.note.body, edited.body.note.budget_amount], ['Revised', 250000]);
    const cleared = await admin('PUT', `/api/admin/notes/${created.id}`, { json: { body: 'Revised', budget_amount: '' } });
    assert.equal(cleared.body.note.budget_amount, null);
    assert.equal((await admin('PUT', `/api/admin/notes/${created.id}`, { json: { body: '' } })).status, 400);

    assert.equal((await admin('DELETE', `/api/admin/notes/${created.id}`)).status, 204);
    assert.equal((await admin('DELETE', `/api/admin/notes/${created.id}`)).status, 404);
    assert.equal((await admin('PUT', '/api/admin/notes/999999999', { json: { body: 'x' } })).status, 404);
    assert.equal((await admin('DELETE', '/api/admin/notes/not-a-number')).status, 404); // not a 500
  });

  test('CORS preflight allows PUT and DELETE from the web app origin (notes are edited cross-origin)', async () => {
    for (const method of ['PUT', 'DELETE']) {
      const res = await fetch(`${base}/api/admin/notes/1`, {
        method: 'OPTIONS',
        headers: { origin: 'https://kdkapsikar.github.io', 'access-control-request-method': method, 'access-control-request-headers': 'authorization,content-type' },
      });
      assert.equal(res.status, 204);
      assert.match(res.headers.get('access-control-allow-methods'), new RegExp(method));
    }
  });
});

describe('Marathi constituency names', () => {
  test('name_mr travels with every constituency the API returns (null when not set)', async () => {
    await query("UPDATE wards SET name_mr = 'मराठी क्षेत्रे' WHERE number = 1");
    const api = client();
    const wards = (await api('GET', '/api/wards')).body.wards;
    assert.equal(wards.find((w) => w.number === 1).name_mr, 'मराठी क्षेत्रे');
    assert.equal(wards.find((w) => w.number === 2).name_mr, null);

    const id = (await api('POST', '/api/issues', { form: issueForm({ ward_id: String(ctx.ward1) }) })).body.issue_id;
    assert.equal((await api('GET', `/api/issues/${id}`)).body.issue.ward.name_mr, 'मराठी क्षेत्रे');

    const corp = client();
    const login = await corp('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.equal(login.body.auth.user.ward.name_mr, 'मराठी क्षेत्रे');
    assert.equal((await corp('GET', `/api/corporator/issues/${id}`)).body.issue.ward.name_mr, 'मराठी क्षेत्रे');
    assert.equal((await corp('GET', '/api/corporator/issues?status=all')).body.issues[0].ward.name_mr, 'मराठी क्षेत्रे');
    assert.equal((await corp('GET', '/api/corporator/transfer-targets')).body.wards[0].name_mr, null); // ward 2

    const admin = client();
    await admin('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    const dash = (await admin('GET', '/api/admin/dashboard')).body;
    assert.equal(dash.wards.find((w) => w.ward_number === 1).ward_name_mr, 'मराठी क्षेत्रे');
    assert.equal(dash.corporators.find((c) => c.ward_number === 1).ward_name_mr, 'मराठी क्षेत्रे');
    assert.equal((await admin('GET', '/api/admin/issues?status=all')).body.issues[0].ward.name_mr, 'मराठी क्षेत्रे');
    assert.equal((await admin('GET', `/api/admin/issues/${id}`)).body.issue.ward.name_mr, 'मराठी क्षेत्रे');
  });
});

describe('admin dashboard', () => {
  test('aggregates ward counts, resolution stats and corporator performance', async () => {
    const submit = async (wardId) =>
      (await client()('POST', '/api/issues', { form: issueForm({ ward_id: String(wardId) }) })).body.issue_id;
    const [a, b, c] = [await submit(ctx.ward1), await submit(ctx.ward1), await submit(ctx.ward2)];
    await submit(ctx.ward3); // unassigned

    const corp1 = client();
    await corp1('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    const up = (id, status, remark) => {
      const form = new FormData(); form.append('status', status);
      if (status === 'rejected') form.append('rejection_reason', remark); else form.append('remark', remark);
      return corp1('POST', `/api/corporator/issues/${id}/updates`, { form });
    };
    await up(a, 'resolved', 'fixed');
    await up(b, 'rejected', 'duplicate');
    void c;

    const admin = client();
    await admin('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    const { status, body } = await admin('GET', '/api/admin/dashboard');
    assert.equal(status, 200);

    assert.equal(body.totals.total, 4);
    assert.equal(body.totals.resolved, 1);
    assert.equal(body.totals.rejected, 1);
    assert.equal(body.totals.open, 2);
    assert.equal(body.totals.unassigned, 1);
    // resolved / (total - rejected) = 1 / 3
    assert.equal(body.totals.resolution_rate, 33.3);

    const w1 = body.wards.find((w) => w.ward_number === 1);
    assert.equal(w1.total, 2);
    assert.equal(w1.corporator_name, 'Corp One');
    assert.equal(body.wards.length, 3);
    assert.equal(body.wards.find((w) => w.ward_number === 3).total, 1);

    const p1 = body.corporators.find((x) => x.name === 'Corp One');
    assert.equal(p1.resolved, 1);
    assert.equal(p1.resolution_rate, 100);
    assert.equal(typeof p1.avg_resolution_hours, 'number');
    const p2 = body.corporators.find((x) => x.name === 'Corp Two');
    assert.equal(p2.resolution_rate, 0);
    assert.equal(body.corporators.length, 2);
  });
});

describe('photos, tokens and CORS', () => {
  test('photos are stored in the database and served with the right type, caching and CORP headers', async () => {
    const api = client();
    const { body } = await api('POST', '/api/issues', { form: issueForm({}, [{ data: PNG, type: 'image/png', name: 'a.png' }]) });
    const url = (await api('GET', `/api/issues/${body.issue_id}`)).body.issue.photos[0];
    const stored = (await query('SELECT name, content_type, octet_length(data) AS bytes FROM photos')).rows;
    assert.equal(stored.length, 1);
    assert.equal(url, `/uploads/${stored[0].name}`);
    assert.equal(stored[0].content_type, 'image/png');

    const res = await fetch(base + url);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.match(res.headers.get('cache-control'), /immutable/);
    assert.equal(res.headers.get('cross-origin-resource-policy'), 'cross-origin');
    assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
    assert.deepEqual(Buffer.from(await res.arrayBuffer()), PNG);
  });

  test('unknown or malformed photo names 404', async () => {
    assert.equal((await fetch(`${base}/uploads/00000000-0000-0000-0000-000000000000.png`)).status, 404);
    assert.equal((await fetch(`${base}/uploads/..%2f..%2fetc%2fpasswd`)).status, 404);
    assert.equal((await fetch(`${base}/uploads/evil.php`)).status, 404);
  });

  test('a photo whose issue insert fails is not left behind', async () => {
    const before = (await query('SELECT count(*)::int AS n FROM photos')).rows[0].n;
    const res = await client()('POST', '/api/issues', {
      form: issueForm({ ward_id: '9999' }, [{ data: PNG, type: 'image/png', name: 'a.png' }]),
    });
    assert.equal(res.status, 400);
    assert.equal((await query('SELECT count(*)::int AS n FROM photos')).rows[0].n, before);
  });

  test('cookies are not accepted as credentials; only the Bearer token is', async () => {
    const login = await client()('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    assert.match(login.body.token, /^[A-Za-z0-9_-]{40,}$/);
    assert.equal(login.headers.get('set-cookie'), null);
    const viaCookie = await fetch(`${base}/api/corporator/issues`, { headers: { cookie: `ww_session=${login.body.token}` } });
    assert.equal(viaCookie.status, 401);
    const viaBearer = await fetch(`${base}/api/corporator/issues`, { headers: { authorization: `Bearer ${login.body.token}` } });
    assert.equal(viaBearer.status, 200);
    const garbage = await fetch(`${base}/api/corporator/issues`, { headers: { authorization: 'Bearer nope' } });
    assert.equal(garbage.status, 401);
  });

  test('logout invalidates the token server-side', async () => {
    const api = client();
    const { body } = await api('POST', '/api/auth/login', { json: { username: 'admin', password: 'correct-horse-1' } });
    await api('POST', '/api/auth/logout');
    const reused = await fetch(`${base}/api/admin/dashboard`, { headers: { authorization: `Bearer ${body.token}` } });
    assert.equal(reused.status, 401);
  });

  test('CORS: the configured origin may call the API (incl. preflight); others may not', async () => {
    const preflight = await fetch(`${base}/api/issues`, {
      method: 'OPTIONS',
      headers: { origin: 'https://kdkapsikar.github.io', 'access-control-request-method': 'POST', 'access-control-request-headers': 'authorization' },
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://kdkapsikar.github.io');
    assert.match(preflight.headers.get('access-control-allow-headers'), /authorization/i);

    const ok = await fetch(`${base}/api/wards`, { headers: { origin: 'https://kdkapsikar.github.io' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'https://kdkapsikar.github.io');
    assert.equal(ok.headers.get('access-control-allow-credentials'), null);

    const other = await fetch(`${base}/api/wards`, { headers: { origin: 'https://evil.example' } });
    assert.equal(other.headers.get('access-control-allow-origin'), null);
  });
});

test('health check', async () => {
  const res = await client()('GET', '/api/health');
  assert.equal(res.status, 200);
});
