// Integration tests against a real Postgres. Requires TEST_DATABASE_URL and
// TRUNCATES every table in it - use a dedicated database.
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

import dotenv from 'dotenv';

dotenv.config({ quiet: true });
if (!process.env.TEST_DATABASE_URL) {
  console.error('TEST_DATABASE_URL is not set. Point it at a throwaway database (see server/.env.example).');
  process.exit(1);
}
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'wardwatch-uploads-'));

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

/** Tiny cookie-aware client. */
function client() {
  let cookie = '';
  return async (method, url, { json, form } = {}) => {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let body;
    if (json) { headers['content-type'] = 'application/json'; body = JSON.stringify(json); }
    if (form) body = form;
    const res = await fetch(base + url, { method, headers, body });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0].startsWith('ww_session=;') ? '' : set.split(';')[0];
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
}

function issueForm(overrides = {}, files = []) {
  const fields = {
    ward_id: String(ctx.ward1), category: 'roads', title: 'Pothole on Main Road',
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
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

beforeEach(async () => {
  await query('TRUNCATE issue_updates, issues, sessions, corporators, admins, wards RESTART IDENTITY CASCADE');
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
    const res = await client()('POST', '/api/issues', { form: issueForm({ title: 'x', phone: '123', category: 'nope', ward_id: '' }) });
    assert.equal(res.status, 400);
    assert.deepEqual(Object.keys(res.body.error.fields).sort(), ['category', 'phone', 'title', 'ward_id']);
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
    for (const good of ['9876543210', '98765 43210', '98765-43210', '+91 98765 43210', '919876543210', '09876543210', '6000000000', '9198765432']) {
      const res = await api('POST', '/api/issues', { form: issueForm({ phone: good }) });
      assert.equal(res.status, 201, `expected "${good}" to be accepted`);
    }
    const stored = (await query('SELECT citizen_phone FROM issues ORDER BY id')).rows.map((r) => r.citizen_phone);
    assert.deepEqual(stored, ['9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '9876543210', '6000000000', '9198765432']);
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
    const filesBefore = fs.readdirSync(process.env.UPLOAD_DIR).length;
    const res = await client()('POST', '/api/issues', {
      form: issueForm({}, [{ data: NOT_AN_IMAGE, type: 'image/jpeg', name: 'evil.jpg' }]),
    });
    assert.equal(res.status, 400);
    assert.equal((await query('SELECT count(*)::int AS n FROM issues')).rows[0].n, 0);
    assert.equal(fs.readdirSync(process.env.UPLOAD_DIR).length, filesBefore);
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

  test('closing an issue requires a remark; empty updates are rejected', async () => {
    const id = await fileIssue(ctx.ward1);
    const corp = await login('corp1');
    const noRemark = await corp('POST', `/api/corporator/issues/${id}/updates`, { form: updateForm({ status: 'rejected' }) });
    assert.equal(noRemark.status, 400);
    assert.ok(noRemark.body.error.fields.remark);
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

describe('admin dashboard', () => {
  test('aggregates ward counts, resolution stats and corporator performance', async () => {
    const submit = async (wardId) =>
      (await client()('POST', '/api/issues', { form: issueForm({ ward_id: String(wardId) }) })).body.issue_id;
    const [a, b, c] = [await submit(ctx.ward1), await submit(ctx.ward1), await submit(ctx.ward2)];
    await submit(ctx.ward3); // unassigned

    const corp1 = client();
    await corp1('POST', '/api/auth/login', { json: { username: 'corp1', password: 'correct-horse-1' } });
    const up = (id, status, remark) => {
      const form = new FormData(); form.append('status', status); form.append('remark', remark);
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

test('health check', async () => {
  const res = await client()('GET', '/api/health');
  assert.equal(res.status, 200);
});
