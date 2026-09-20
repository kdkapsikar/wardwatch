# WardWatch

A simple civic grievance platform. Citizens report problems in their ward (no account, no OTP), get a
unique Issue ID, and track progress. Ward corporators update the status with remarks and photos. The
mayor / admin gets a city-wide dashboard.

**Stack:** React (Vite) · Tailwind CSS v4 · Node.js + Express 5 · PostgreSQL

| Who | What they can do |
| --- | --- |
| **Citizen** (no login) | Report an issue with photos, a pin on the map (GPS or tap), ward, name and phone → receive an Issue ID → look it up later and see the full update history |
| **Corporator** (username + password) | See issues assigned to their ward, change status, add remarks and photos |
| **Mayor / Admin** (username + password) | Ward-wise issue counts, resolution statistics, corporator performance summary |

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
npm run seed                              # dev only: wards, accounts, sample issues

# 4. Run API (:3001) and web app (:5173)
npm run dev
```

Open <http://localhost:5173>.

Demo logins created by `npm run seed` (development only - the seed refuses to run when `NODE_ENV=production`):

| Role | Username | Password |
| --- | --- | --- |
| Admin | `admin` | `admin12345` |
| Corporator (wards 1-8) | `corp1` … `corp8` | `corporator123` |

Everyone signs in at **`/login`** ("Staff sign in"); the server works out whether the account is a corporator
or an admin and sends you to the right area. (The old `/corporator/login` and `/admin/login` URLs redirect there.)
Failed logins show a generic message to the user; the reason (`unknown_username`, `wrong_password`,
`account_inactive`) is written to the server log - never the password.

The Vite dev server proxies `/api` and `/uploads` to the API, so everything is same-origin: no CORS
configuration and the session cookie behaves exactly as in production.

### Without Docker

```bash
createdb wardwatch && createdb wardwatch_test
# then set DATABASE_URL / TEST_DATABASE_URL in server/.env to match your Postgres user
```

## Report form rules

Required (marked `*`): ward, issue category, title, description, location, full name, mobile number, and the
consent checkbox. Street/landmark and photos are optional. Rules are checked in the browser for instant
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
│   ├── db/migrations/          ordered .sql files (001_init, 002_sessions, 003_issue_location, 004_issue_consent)
│   ├── scripts/                seed.js, create-user.js
│   ├── src/
│   │   ├── app.js                middleware + route wiring (createApp for tests)
│   │   ├── index.js              process entry: listen, housekeeping, graceful shutdown
│   │   ├── routes/               public, auth, corporator, admin
│   │   ├── services/             issues, sessions, stats (all SQL lives here)
│   │   ├── middleware/           auth, upload, rateLimit, error
│   │   └── lib/                  validation (zod), files (magic-byte checks), ids
│   ├── test/api.test.js        integration tests
│   └── uploads/                photo storage (gitignored)
├── docs/ARCHITECTURE.md        schema, API, pages, component hierarchy
├── docker-compose.yml          dev Postgres
└── .github/workflows/ci.yml    build + test on every push / PR
```

Full details - database schema, every API route, pages and the component tree - are in
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Managing accounts and wards

V1 has no admin UI for user management; use SQL and the CLI.

```bash
# Corporator (one per ward) and admin. Password comes from $WW_PASSWORD or a hidden prompt.
npm run user:create -w server -- corporator asha.patil "Asha Patil" --ward 12
npm run user:create -w server -- admin mayor "Office of the Mayor"
```

Load your real wards with SQL (the seed's sample wards are for development only):

```sql
INSERT INTO wards (number, name) VALUES (1, 'Central Market'), (2, 'Riverside') /* ... */;
```

Deactivate rather than delete a corporator so their history stays attributed - this also ends their
active sessions immediately:

```sql
UPDATE corporators SET is_active = false WHERE username = 'asha.patil';
```

## Deploying

The API serves the built React app, so production is **one Node process + Postgres**.

```bash
npm ci
npm run build
NODE_ENV=production npm run migrate       # on every deploy
NODE_ENV=production npm start
```

Checklist:

- Set `NODE_ENV=production`, a real `DATABASE_URL` (add `?sslmode=require` for managed Postgres), and
  `TRUST_PROXY=1` when behind nginx / a load balancer (so rate limits see the client IP).
- **Terminate TLS in front of the app.** In production the session cookie is `Secure`, so login only
  works over HTTPS. (`COOKIE_SECURE=false` exists purely for testing a production build over plain HTTP.)
- Mount a **persistent volume at `UPLOAD_DIR`** and include it in backups together with the database.
  Photos are referenced from the database by path.
- Set your proxy's `client_max_body_size` to at least ~30 MB (5 photos × 5 MB + form fields).
- Health check: `GET /api/health` (checks the DB connection).
- Create the first admin with `user:create`; do **not** run `seed` in production.

## Security notes

- **Sessions, not JWT.** Login sets an opaque random token in an `httpOnly`, `SameSite=Lax` cookie; only
  its SHA-256 hash is stored in `sessions`. Logout or deactivating a user takes effect immediately.
  `SameSite=Lax` is the CSRF defence (cross-site POSTs don't carry the cookie).
- Passwords are hashed with bcrypt (cost 12). Login errors are generic, and unknown usernames cost the
  same time as wrong passwords.
- Rate limits: 10 failed logins / 15 min / IP, 10 issue submissions / hour / IP, 60 lookups / min / IP.
- Uploads are validated by **magic bytes** (JPEG/PNG/WebP only), stored under random names, capped at
  5 files × 5 MB, and served with `nosniff`.
- Issue IDs are random (≈8.5 × 10¹¹ possibilities), not sequential, and the public tracking view never
  returns the citizen's name or phone. Anyone who has the ID can see the issue's status and photos,
  so tell citizens to treat it like a receipt.
- Helmet sets a strict CSP; all SQL is parameterised.

## Known limitations

These are conscious V1 trade-offs, roughly in the order I'd tackle them:

1. **No notifications.** Citizens must keep their Issue ID; corporators must check their inbox.
   (Email/SMS was excluded from V1.)
2. **No account-management UI**, password reset or password change - use `user:create` / SQL.
3. **No reassignment.** Issues go to the ward's corporator at submission; if a ward has none the issue
   is stored unassigned (visible in the admin totals) and no one can act on it until an admin
   assigns it in SQL.
4. **Photos live on local disk** - fine for a single server; move to object storage to scale out.
5. **Location is self-reported** - it's whatever the citizen's GPS or tap says; nothing checks that it falls inside the chosen ward (no GIS/boundaries in V1). **No spam protection beyond rate limiting** (no CAPTCHA/OTP by design).
6. Migrations are forward-only (no down scripts).
7. Tested on Node 26 + PostgreSQL 18 locally; CI targets Node 22 + PostgreSQL 16. The Docker Compose
   file has not been run in the environment this was built in (no Docker available there).
