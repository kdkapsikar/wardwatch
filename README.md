# WardWatch

A simple civic grievance platform. Citizens report problems in their constituency (no account, no OTP), get a
unique Issue ID, and track progress. Constituency corporators update the status with remarks and photos. The
mayor / admin gets a city-wide dashboard.

**Stack:** React (Vite) · Tailwind CSS v4 · Node.js + Express 5 · PostgreSQL

| Who | What they can do |
| --- | --- |
| **Citizen** (no login) | Report an issue with photos, a pin on the map (GPS or tap), constituency, name and phone → receive an Issue ID → look it up later and see the full update history |
| **Corporator** (username + password) | Own dashboard with drill-down, see their constituency's issues, change status with one-tap buttons, reject with a mandatory reason (+ optional proof photos), add optional remarks and photos, transfer an issue to another constituency |
| **Mayor / Admin** (username + password) | Constituency-wise issue counts, resolution statistics, corporator performance summary, a category pie chart that drills down to the exact record, and private budget notes |

Deliberately **not** in V1: OTP, JWT, SMS/email, GIS analysis. The one external service is the free
OpenStreetMap tile server used by the report form's map (see [Location picker](#location-picker)).
See [Known limitations](#known-limitations).

## Quick start

Requires **Node 20+** and **PostgreSQL 14+** (a Docker Compose file is included for the database).

```bash
git clone <your-repo-url> wardwatch && cd wardwatch
npm install

# 1. Database (skip if you already have Postgres - just create a database)
docker compose up -d

# 2. Configure
cp server/.env.example server/.env        # defaults match docker-compose.yml

# 3. Create tables, load demo data
npm run migrate
npm run seed                              # dev only: the 29 constituencies, accounts, sample issues

# 4. Run API (:3001) and web app (:5173)
npm run dev
```

Open <http://localhost:5173>.

Demo logins created by `npm run seed` (development only - the seed refuses to run when `NODE_ENV=production`):

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin12345` |
| Corporator (constituencies 1-29) | `corp1` … `corp29` | `corporator123` |

Everyone signs in at **`/login`** ("Staff sign in"); the server works out whether the account is a corporator
or an admin and sends you to the right area. (The old `/corporator/login` and `/admin/login` URLs redirect there.)
Failed logins show a generic message to the user; the reason (`unknown_username`, `wrong_password`,
`account_inactive`) is written to the server log - never the password.

The Vite dev server proxies `/api` and `/uploads` to the API, so everything is same-origin and no CORS
configuration is needed.

### Without Docker

```bash
createdb wardwatch && createdb wardwatch_test
# then set DATABASE_URL / TEST_DATABASE_URL in server/.env to match your Postgres user
```

## Corporator portal

- **Dashboard** (`/corporator`) - only the signed-in corporator's own numbers: assigned / open / overdue / resolved /
  rejected, resolution rate, average time to resolve, the last 30 days, a status breakdown, the oldest open issues
  ("needs attention") and a per-category table. **Every number is a link** into the issue list, pre-filtered
  (`/corporator/issues?status=open&overdue=1`, `?category=roads&status=all`, ...). The list shows removable filter chips.
- **Updating an issue** - status is a row of buttons (Acknowledged / In progress / Resolved / Rejected), not a dropdown.
  The **remark is always optional**. **Rejecting requires a reason** (quick-pick reasons are provided); proof photos can
  be attached and, like the reason, are shown to the citizen on the tracking page.
- **Transfer** - an open issue can be moved to another constituency that has an active corporator. It leaves the
  sender's list, goes to that corporator as a new "Submitted" issue, and the history records who moved it, from where,
  to where, and an optional note. The sender can no longer open it.

## Mayor / Admin portal

- **Dashboard** (`/admin`) - city-wide numbers, an **issues-by-category pie chart**, the constituency table and
  corporator performance. Click a pie slice (or a legend row) to see that category's issues
  (`/admin/issues?category=roads`), then click any row to open the **exact record**: full details, the citizen's
  contact and location, the assigned corporator and the whole update history (read-only). *Back* returns to the same
  filtered list. The stat cards and each constituency also link into the list (`?status=open`, `?ward=7`).
- **Private notes** (`/admin/notes`, and on every record) - notes with an optional **budget amount in ₹**, either
  general or attached to one issue; add, edit and delete them. They are **private to the account that wrote
  them**: every notes query is filtered by the signed-in admin's id on the server, so other admins, corporators and
  the public cannot see, edit or delete them, and note text never appears in any issue payload. (Tests cover this with
  a second admin account.) The dashboard shows your own note count and budget total.
- The pie chart uses one fixed colour per category from a colour-blind-checked palette, with a legend table showing
  every count and share (so nothing depends on colour or hover alone); with 7 categories it is at the upper limit of
  what a pie communicates well, which is why the table is always shown next to it.

## Report form rules

Required (marked `*`): constituency, issue category, description, location, full name, mobile number, and the
consent checkbox. Street/landmark and photos are optional. There is no title field: the one-line headline shown in the inbox and on the
tracking page is generated from the start of the description. Rules are checked in the browser for instant
feedback and again by the API, which is the authority.

- **Mobile number:** a 10-digit Indian mobile number starting with 6-9. Spaces/dashes are ignored and a
  leading `+91`, `91` or `0` is accepted, so `+91 98765-43210` is stored as `9876543210`.
- **Consent:** "I confirm that the information provided is accurate and may be used by the local
  administration for issue resolution." The box starts **unticked** (pre-ticked consent isn't meaningful
  consent). The API refuses submissions without it and stamps `issues.consent_at` with the time it was given.

## Location picker

The report form has a Leaflet map on OpenStreetMap tiles. Citizens tap **Use My Current Location**
(browser Geolocation API) or tap/click the map to drop a marker, and can drag it to fine-tune. The
coordinates are shown under the map, held in form state, and a location is **required** to submit
(checked in the browser and again by the API).

- **Needs HTTPS.** Browsers only allow geolocation on `https://` or `localhost`. Testing from a phone
  against `http://192.168.x.x:5173` will show a "needs a secure connection" message; tapping the map
  still works.
- **Start the map on your city.** Copy `client/.env.example` to `client/.env` and set
  `VITE_MAP_CENTER=lat,lng` (and optionally `VITE_MAP_ZOOM`). Without it the map opens on India.
- **Privacy.** Exact coordinates are stored on the issue and shown only to the assigned corporator
  (with an "Open in OpenStreetMap" link). The public tracking page does not return them.
  The visitor's browser requests tiles from `tile.openstreetmap.org`, so OSM sees their IP and the
  map area viewed; the CSP allows exactly that host.
- **Tile policy.** OSM's public tile server is for light use ([usage policy](https://operations.osmfoundation.org/policies/tiles/)).
  If WardWatch grows, switch `TILE_URL` in `client/src/components/LocationPicker.jsx` (and the CSP host in
  `server/src/app.js`) to a commercial or self-hosted tile provider.
- Issues filed before migration `003` have no location; the corporator view simply hides it for them.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | API (with `--watch`) + Vite dev server |
| `npm run build` | Production build of the React app → `client/dist` |
| `npm start` | Run the API; also serves `client/dist` if it exists |
| `npm run migrate` | Apply pending SQL migrations (idempotent, advisory-locked) |
| `npm run seed` | Dev-only demo data |
| `npm test` | API integration tests (need `TEST_DATABASE_URL`; **truncates that database**) |
| `npm run user:create -w server -- …` | Create an admin or corporator (see below) |

## Repository layout

```
wardwatch/
├── client/                     React app (Vite + Tailwind)
│   └── src/
│       ├── api/client.js         fetch wrapper + typed endpoint helpers
│       ├── context/AuthContext   who is signed in (GET /api/auth/me)
│       ├── components/           reusable UI (see docs/ARCHITECTURE.md)
│       ├── pages/                route-level screens (citizen, corporator/, admin/)
│       └── lib/                  constants (statuses, categories), formatters
├── server/                     Express API
│   ├── db/migrations/          ordered .sql files (001_init ... 005_photos)
│   ├── scripts/                seed.js, create-user.js
│   ├── src/
│   │   ├── app.js                middleware + route wiring (createApp for tests)
│   │   ├── index.js              process entry: listen, housekeeping, graceful shutdown
│   │   ├── routes/               public, auth, corporator, admin
│   │   ├── services/             issues, sessions, stats (all SQL lives here)
│   │   ├── middleware/           auth, upload, rateLimit, error
│   │   └── lib/                  validation (zod), files (magic-byte checks), ids
│   ├── test/api.test.js        integration tests
├── docs/ARCHITECTURE.md        schema, API, pages, component hierarchy
├── docker-compose.yml          dev Postgres
├── render.yaml                 Render blueprint for the API
└── .github/workflows/
    ├── ci.yml                    build + test on every push / PR
    └── pages.yml                 deploy the web app to GitHub Pages
```

Full details - database schema, every API route, pages and the component tree - are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Managing accounts and constituencies

V1 has no admin UI for user management; use SQL and the CLI.

```bash
# Corporator (one per constituency) and admin. Password comes from $WW_PASSWORD or a hidden prompt.
npm run user:create -w server -- corporator asha.patil "Asha Patil" --constituency 12
npm run user:create -w server -- admin mayor "Office of the Mayor"
```

The 29 constituencies (with their areas) live in `server/db/constituencies.js`. Load or refresh them in any
database - it also creates a `corp<N>` corporator for each constituency that has none when `WW_PASSWORD` is set:

```bash
WW_PASSWORD='choose-a-password' npm run constituencies:load -w server
```

To rename or add one by hand instead (the `wards` table stores a constituency's number and its areas in `name`):

```sql
INSERT INTO wards (number, name) VALUES (30, 'New area names here');
```

Deactivate rather than delete a corporator so their history stays attributed - this also ends their
active sessions immediately:

```sql
UPDATE corporators SET is_active = false WHERE username = 'asha.patil';
```

## Deploying

WardWatch is a web app **plus** an API and a database. GitHub Pages can only host the static web app, so
the API and Postgres need a home elsewhere. Two setups are supported.

### A. GitHub Pages (web app) + Render (API) + Neon (Postgres) - all free tiers

```
Browser ── https://kdkapsikar.github.io/wardwatch/   (GitHub Pages: the React app)
   └────── https://<your-api>.onrender.com/api/...   (Render: Express API, photos, sessions)
                     └── Neon Postgres
```

Do these once, in order:

**1. Database (Neon).** Create a project at <https://neon.tech>. From *Connection Details* copy the
**direct** connection string (host *without* `-pooler`; the migration runner uses a session-level lock
that pooled connections break). It looks like `postgres://user:pass@ep-xxx.aws.neon.tech/neondb?sslmode=require`.

**2. Create the schema and your first accounts** from your own machine, pointing at Neon:

```bash
export DATABASE_URL='postgres://...neon...?sslmode=require'    # the string from step 1
npm run migrate
```

Load the constituencies (from your machine, with `DATABASE_URL` still set). Set `WW_PASSWORD` to also create a
`corp1`…`corp29` corporator account for each one:

```bash
WW_PASSWORD='choose-a-password' npm run constituencies:load -w server
```

Create the mayor/admin (the password comes from `WW_PASSWORD` or a hidden prompt); create any extra corporator the same way:

```bash
npm run user:create -w server -- admin mayor "Office of the Mayor"
npm run user:create -w server -- corporator asha.patil "Asha Patil" --constituency 1
```

Do **not** run `npm run seed` against this database - it creates well-known demo passwords.

**3. API (Render).** At <https://render.com> choose *New → Blueprint*, select this repository, and when
prompted set:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | the Neon string from step 1 |
| `CORS_ORIGINS` | `https://kdkapsikar.github.io` (origin only: no `/wardwatch`, no trailing slash) |

Deploy. When it is live, open `https://<your-service>.onrender.com/api/health` - you should see
`{"status":"ok"}`. Note the service URL. (Free plan: the API sleeps after ~15 minutes idle, so the first
request after a quiet spell takes 30-60 s. Paid plans don't sleep.)

**4. Web app (GitHub Pages).** In the GitHub repo:

1. *Settings → Pages → Build and deployment → Source:* **GitHub Actions**.
2. *Settings → Secrets and variables → Actions → Variables → New repository variable:*
   `API_URL` = your Render URL, e.g. `https://wardwatch-api.onrender.com` (no trailing slash).
   Optional: `MAP_CENTER` = `18.5204,73.8567` (your city's lat,lng) and `MAP_ZOOM` = `13`.
3. *Actions → "Deploy web app to GitHub Pages" → Run workflow* (it also runs on every push to `main`
   that touches `client/`).

The site appears at **https://kdkapsikar.github.io/wardwatch/**. If you change `API_URL` later, re-run the workflow.

Things to know about this setup:

- Photos are stored **in Postgres** (not on disk), so they survive Render restarts. Neon's free tier has
  0.5 GB, which is roughly a few hundred issues with photos; watch usage as you grow.
- The Pages build injects a `Content-Security-Policy` `<meta>` tag limiting the page to your API and
  OpenStreetMap tiles (Pages cannot send HTTP headers).
- Deep links (`/wardwatch/track/WW-XXXXXXXX`) work through a `404.html` copy of `index.html`; browsers
  log a harmless 404 for the page load, exactly as on any GitHub Pages SPA.
- Every visitor's browser talks to Render and to `tile.openstreetmap.org` directly.

### B. One server (API + web app together)

The API also serves the built React app, so this is **one Node process + Postgres** on any host with TLS in
front (a VPS, Fly.io, Railway, ...), and no CORS or `API_URL` setup is needed:

```bash
npm ci
npm run build
NODE_ENV=production npm run migrate       # on every deploy
NODE_ENV=production npm start
```

### Checklist for either setup

- `NODE_ENV=production`, a real `DATABASE_URL` (`?sslmode=require` for managed Postgres), and
  `TRUST_PROXY=1` behind a reverse proxy / load balancer so rate limits see the real client IP.
- Serve everything over **HTTPS** (Render and Pages do this for you). `FORCE_HTTPS=false` exists only to try
  a production build over plain HTTP locally.
- Behind nginx, set `client_max_body_size` to at least ~30 MB (5 photos × 5 MB + form fields).
- Back up the database - it holds photos too.
- Health check: `GET /api/health` (checks the DB connection).

## Security notes

- **Server-side sessions, not JWT.** Login returns an opaque random token that the app sends as
  `Authorization: Bearer <token>`; only its SHA-256 hash is stored in `sessions`. Logout, expiry (12 h) or
  deactivating a user takes effect immediately on the server. No cookies are used, so there is no CSRF
  exposure and it works when the web app and API are on different sites (GitHub Pages + Render).
  The trade-off versus an `httpOnly` cookie: the token lives in the browser's `localStorage`, so an XSS
  bug could read it. The strict CSP (`script-src 'self'`, no third-party scripts) is the mitigation.
- CORS is off unless `CORS_ORIGINS` is set, and then only for exactly those origins.
- Passwords are hashed with bcrypt (cost 12). Login errors are generic, and unknown usernames cost the
  same time as wrong passwords.
- Rate limits: 10 failed logins / 15 min / IP, 10 issue submissions / hour / IP, 60 lookups / min / IP.
- Uploads are validated by **magic bytes** (JPEG/PNG/WebP only), stored in Postgres under random names,
  capped at 5 files × 5 MB, and served with `nosniff` and long-lived immutable caching.
- Issue IDs are random (≈8.5 × 10¹¹ possibilities), not sequential, and the public tracking view never
  returns the citizen's name or phone. Anyone who has the ID can see the issue's status and photos,
  so tell citizens to treat it like a receipt.
- Helmet sets a strict CSP; all SQL is parameterised.

## Known limitations

These are conscious V1 trade-offs, roughly in the order I'd tackle them:

1. **No notifications.** Citizens must keep their Issue ID; corporators must check their inbox.
   (Email/SMS was excluded from V1.)
2. **No account-management UI**, password reset or password change - use `user:create` / SQL.
3. **No reassignment.** Issues go to the constituency's corporator at submission; if a constituency has none the issue
   is stored unassigned (visible in the admin totals) and no one can act on it until an admin
   assigns it in SQL.
4. **Photos live in Postgres** - simple and portable, but it grows the database; move to object storage (S3/R2) at scale.
5. **Location is self-reported** - it's whatever the citizen's GPS or tap says; nothing checks that it falls inside the chosen constituency (no GIS/boundaries in V1). **No spam protection beyond rate limiting** (no CAPTCHA/OTP by design).
6. Migrations are forward-only (no down scripts).
7. Tested on Node 26 + PostgreSQL 18 locally; CI targets Node 22 + PostgreSQL 16. The Docker Compose
   file has not been run in the environment this was built in (no Docker available there).
