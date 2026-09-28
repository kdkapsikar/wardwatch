# WardWatch architecture

## 1. Database schema

> **Naming:** users see *constituencies*; the database and API keep the original identifiers - the `wards` table,
> `ward_id` columns and `ward` / `wards` JSON fields all mean "constituency". A constituency's areas are stored in
> `wards.name`. Renaming the identifiers would be a pure refactor with no user-visible effect.

Source of truth: [`server/db/migrations/`](../server/db/migrations). The five required tables plus
`sessions` (server-side login sessions, used instead of JWTs), `admin_notes`, `photos`, `citizens` and
`admin_wards` (which constituencies a Mandal Adhyaksh covers - see below).

```mermaid
erDiagram
    wards ||--o| corporators : "has one"
    wards ||--o{ issues : "receives"
    corporators ||--o{ issues : "assigned"
    issues ||--|{ issue_updates : "history"
    corporators ||--o{ issue_updates : "posts"
    citizens ..o{ issues : "citizen_phone (no FK)"
    wards ||--o| admin_wards : "at most one"
    admins ||--o{ admin_wards : "covers many"

    wards        { int id PK  int number UK  text name  text name_mr }
    corporators  { int id PK  int ward_id FK,UK  text first_name  text last_name  text name  text username UK  text password_hash  bool is_active }
    admins       { int id PK  text first_name  text last_name  text name  text username UK  text password_hash  bool is_active  text role }
    admin_wards  { int ward_id PK,FK  int admin_id FK }
    issues       { bigint id PK  text public_id UK  int ward_id FK  int corporator_id FK  text category  text title  text description  text address  float latitude  float longitude  text citizen_name  text citizen_phone  text_arr photos  text status  timestamptz consent_at  timestamptz created_at  timestamptz updated_at  timestamptz resolved_at }
    issue_updates{ bigint id PK  bigint issue_id FK  int corporator_id FK  text status  text remark  text rejection_reason  text_arr photos  text event  int from_ward_id FK  int to_ward_id FK  timestamptz created_at }
    sessions     { text token_hash PK  text role  int user_id  timestamptz expires_at }
    citizens     { bigint id PK  text phone UK  timestamptz created_at }
```

| Table | Notes |
| --- | --- |
| `wards` | A **constituency**. `number` is its number, 1-29 (unique); `name` holds the areas it covers in English and `name_mr` in Marathi (see `server/db/constituencies.js`). |
| `corporators` | **At most one active corporator per ward** (`ward_id` has a *partial* unique index `WHERE is_active` - migration 011). `ward_id` is **nullable** (migration 013): a corporator account can exist unassigned, created on the Accounts page independently of any constituency, then assigned to one on Manage roles (`services/roster.js`'s `assignCorporator`) - assigning someone new there simply sets their `ward_id` and clears whoever held that ward before (freed, not deactivated). `first_name`/`last_name` (migration 012) are what the Accounts page edits; `name` is kept as a denormalised `first_name + last_name`, written by the application on every create/update, so every OTHER query in the app (issue "assigned to", update history "by", dashboards) keeps reading one plain name without knowing about first/last at all. Username unique case-insensitively (`lower(username)` index, shared with `admins` only at the application level - see `services/roster.js`'s cross-table check). `is_active=false` blocks login and kills sessions; rows are never deleted so history stays attributed. |
| `admins` | Mayor/admin **and Mandal Adhyaksh** accounts - same shape, distinguished by `role` (`'admin'` or `'mandal_adhyaksh'`, migration 010). `first_name`/`last_name`/`name` follow the same convention as `corporators` above. A Mandal Adhyaksh is session-role `admin` too (see `sessions.role` below); only `admins.role` plus the route-local `requireMayor` check in `routes/admin.js` tell the two apart. |
| `admin_wards` | Which constituencies a Mandal Adhyaksh covers. `ward_id` is the **primary key** (one constituency has at most one Mandal Adhyaksh); `admin_id` is not unique (one Mandal Adhyaksh can cover many constituencies). Managed only through `services/roster.js`, Mayor/Admin only. |
| `issues` | `title` is a one-line headline **generated from the description** (first ~80 characters, cut at a word boundary; `server/src/lib/title.js`) - the form doesn't collect one and any `title` a client sends is ignored. `public_id` is the citizen-facing ID (`WW-` + 8 random chars from an alphabet without look-alikes). `corporator_id` is copied from the ward's active corporator at submission (NULL if none). `status` ∈ `submitted · acknowledged · in_progress · resolved · rejected`. `category` ∈ `roads · water · sanitation · streetlights · drainage · parks · other`. `resolved_at` is set when status becomes `resolved`, cleared if reopened. `photos` are the citizen's uploads (URL paths). `latitude`/`longitude` (WGS84, 6 decimals) are set from the map picker; nullable only for issues filed before migration 003, both-or-neither and range-checked by `CHECK`s. `citizen_phone` is the normalised 10-digit Indian mobile - it is what the citizen portal (`citizens.phone`) matches against; there is no foreign key, since issues are filed before an account may ever exist. `consent_at` is when the citizen ticked the declaration (NULL only for issues filed before migration 004). |
| `issue_updates` | Append-only history. `event` is `update` (status/remark/photos) or `transfer` (with `from_ward_id` / `to_ward_id`). `rejection_reason` is set when a corporator rejects (required by the API; NULL on older rows, whose explanation is in `remark`); proof photos use `photos`. `status` is the issue status **after** the update, so the timeline can be rendered without diffing. Row #1 is written on submission (`corporator_id` NULL = citizen). Corporator rows can carry a remark and/or photos, with or without a status change. |
| `admin_notes` | **Private** mayor/admin notes: `admin_id` (owner), optional `issue_id`, `body`, optional `budget_amount` (₹, `NUMERIC(14,2)`). Every query filters on the caller's `admin_id` (see `services/notes.js`), so a note is invisible to every other user. Deleting an issue keeps its notes (`issue_id` becomes NULL). |
| `sessions` | Opaque bearer token → only its SHA-256 is stored. `role` is `corporator`, `admin` or `citizen`; `user_id` points at the matching table. Expired rows are purged hourly. |
| `photos` | Uploaded images (`name`, `content_type`, `data BYTEA`, ≤ 5 MB). `issues.photos` / `issue_updates.photos` hold `/uploads/<name>` URL paths that the API resolves against this table. Stored in the DB so they survive hosts with ephemeral disks. |
| `citizens` | A citizen account: just `phone` (unique) - there is no name, password or profile. Created the first time a phone number verifies an OTP (`routes/citizen.js`); an issue filed with that number **before** the account existed still shows up, since the two are joined by phone number, not a foreign key. |

Constraints worth knowing: status/category/length `CHECK`s live in the database, so bad data cannot get
in even from a script. Indexes cover the hot paths: `(corporator_id, status)` for the corporator inbox,
`(ward_id, status)` for ward stats, `issue_updates(issue_id, created_at)` for history.

**Dashboard definitions** (`server/src/services/stats.js`): *open* = submitted + acknowledged +
in progress · *resolution rate* = resolved ÷ (total − rejected) · *overdue* = open and older than
`OVERDUE_DAYS` (default 7) · *avg. resolution* = mean hours from filing to resolution over resolved issues.

## 2. API

All JSON under `/api`. Errors always look like
`{ "error": { "code": "validation_error", "message": "...", "fields": { "phone": "..." } } }`.
`multipart/form-data` is used wherever photos are uploaded (field name `photos`, max 5 × 5 MB, JPEG/PNG/WebP).

### Public (no login)

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/health` | - | `{ status: "ok" }` (touches the DB) |
| `GET /api/wards` | - | `{ wards: [{ id, number, name }] }` |
| `POST /api/issues` | multipart: `ward_id, category, description, address?, latitude, longitude, name, phone, consent, photos[]` - required: all except `address` and `photos`. `phone` = 10-digit Indian mobile (6-9 start; `+91`/`91`/`0` prefix and spaces tolerated). `consent` must be `true`. `latitude`/`longitude` in -90..90 / -180..180 | `201 { issue_id, created_at }` · rate-limited |
| `GET /api/issues/:publicId` | ID is normalised (case / missing dash tolerated) | `{ issue: { public_id, title, description, category, address, status, ward, photos, created_at, updated_at, resolved_at, updates: [{ status, remark, photos, by, created_at }] } }` - **no name/phone** · `404` if unknown |
| `POST /api/citizen/otp/request` | JSON `{ phone }` | `204`, always, for a well-formed number - never reveals whether it has reported anything. Rate-limited (5/hour/IP) |
| `POST /api/citizen/otp/verify` | JSON `{ phone, code }` (`code` = 4 digits) | `200 { token, auth: { role: "citizen", user: { id, phone } } }`. **`code` is checked against one fixed placeholder value** (`config.otpCode`, default `1111`) - see [Citizen portal](../README.md#citizen-portal) in the README. `401` on a wrong code. Rate-limited (10 failed/15 min/IP) |

### Auth (`Authorization: Bearer <token>`)

| Method & path | Body | Response |
| --- | --- | --- |
| `POST /api/auth/login` | `{ username, password }` | `{ token, auth: { role: "corporator"\|"admin", user: { id, name, username, ward?, role?, wards? } } }` · `401` generic error. One endpoint for both roles: the role is whichever table holds the account (if a username exists in both, the password decides). For `role: "admin"`, `user.role` is `"admin"` (Mayor - sees every constituency) or `"mandal_adhyaksh"` (`user.wards` lists their assigned constituencies, `{ id, number, name, name_mr }[]`, possibly empty). |
| `GET /api/auth/me` | - | `{ auth: {...} }` or `{ auth: null }` |
| `POST /api/auth/logout` | - (bearer token) | `204`; the session row is deleted, so the token stops working immediately |

### Corporator (`403` for other roles, `401` if signed out)

| Method & path | Body / query | Response |
| --- | --- | --- |
| `GET /api/corporator/issues` | `?status=open\|submitted\|acknowledged\|in_progress\|resolved\|rejected\|all&category=roads&overdue=1&page=1` | `{ issues[], total, page, page_size, counts: { <status>: n } }` - own issues only, open first |
| `GET /api/corporator/issues/:publicId` | - | `{ issue }` incl. `citizen: { name, phone }` and `location: { latitude, longitude } \| null`; `404` if not theirs |
| `GET /api/corporator/dashboard` | - | `{ totals, by_category[], needs_attention[], overdue_days }` - the corporator's own numbers (same definitions as the admin dashboard) plus `received_30d` / `resolved_30d` |
| `GET /api/corporator/transfer-targets` | - | `{ wards: [{ id, number, name }] }` - other constituencies with an active corporator |
| `POST /api/corporator/issues/:publicId/updates` | multipart: `status?, remark?, rejection_reason?, photos[]` | `201 { issue }` (updated). Needs a status change, remark or photo. **Remark is optional.** Changing the status to `rejected` **requires `rejection_reason`** (5-500 chars); photos then act as proof |
| `POST /api/corporator/issues/:publicId/transfer` | JSON `{ ward_id, note? }` | `200 { transferred_to: { number, name } }`. Only open issues; target must differ from the current constituency and have an active corporator. The issue restarts as `submitted` for the new corporator; `404` for the sender afterwards |

### Admin (`403` for other roles; a Mandal Adhyaksh is an admin too, see below)

City-wide for the Mayor/Admin; scoped to only the caller's assigned constituencies for a Mandal Adhyaksh
(`wardScope(req)` in `routes/admin.js` → `wardIds` in `services/stats.js` / `services/issues.js` - `null` for
the Mayor, an array, possibly empty, for a Mandal Adhyaksh). The three endpoints below are the same
endpoints for both roles; only the data returned differs.

| Method & path | Response |
| --- | --- |
| `GET /api/admin/dashboard` | `{ totals, wards[], corporators[], by_category[], my_notes, overdue_days, generated_at }` - each block has `total, submitted, acknowledged, in_progress, resolved, rejected, open, overdue, avg_resolution_hours, resolution_rate` (`by_category[]` = `{ category, total, open, resolved, rejected }`, feeding the pie chart) |
| `GET /api/admin/issues` | List, same filters as the corporator inbox plus `ward=<number>`: `?status=open\|...\|all&category=&ward=&overdue=1&page=` → `{ issues[] (with constituency + corporator_name), total, counts }`. The pie chart's drill-down target |
| `GET /api/admin/issues/:publicId` | The full record, read-only: everything corporators see plus `assigned_to`; `404` if unknown **or outside the caller's assigned constituencies** (a Mandal Adhyaksh cannot bypass scoping by ID) |
| `GET /api/admin/notes[?issue=<publicId>]` | The caller's **own** notes (newest first) + `{ count, budget_total }` |
| `POST /api/admin/notes` | JSON `{ body, budget_amount?, issue? }` → `201 { note }`. `budget_amount` accepts `125000`, `"1,25,000.50"`, `"₹ 40,000"`; empty/null = none |
| `PUT /api/admin/notes/:id` | JSON `{ body, budget_amount? }` (empty budget clears it) → `{ note }`; `404` if it is not yours |
| `DELETE /api/admin/notes/:id` | `204`; `404` if it is not yours |

#### Accounts (Mayor/Admin only - `403` for a Mandal Adhyaksh too, via the route-local `requireMayor` check)

Backs the **Accounts** screen (`services/roster.js`'s `listAccounts`/`createAccount`/`updateAccount`/
`deactivateAccount`). Every account, whatever table it actually lives in, looks the same on the wire:
`{ id, role, first_name, last_name, username, is_active, ward?, ward_count? }` - `role` is
`'corporator' | 'mandal_adhyaksh' | 'admin'`; `ward` (a corporator's current constituency, or `null`) and
`ward_count` (a Mandal Adhyaksh's constituency count) are mutually exclusive with each other and absent for
`admin`. **`id` is only unique within a role** - a corporator and an admin can share the same numeric id,
since they live in different tables with their own sequences - so a client must always key on `(role, id)`
together, e.g. `` `${role}-${id}` `` as a React list key. Usernames are checked for uniqueness across
**both** `corporators` and `admins` (a `UNION` pre-check - each table's own unique index only covers itself).

| Method & path | Body | Response |
| --- | --- | --- |
| `GET /api/admin/accounts` | - | `{ accounts: [...] }`, shape above, corporators then admins (admin role first within that group) |
| `POST /api/admin/accounts` | `{ role: 'corporator' \| 'mandal_adhyaksh', first_name, last_name, username }` | `201 { account }`, created **unassigned** to any constituency - assign it on Manage roles below. Password `corporator123` / `mandal12345`. `role: 'admin'` is rejected (`400`) - creating a Mayor/Admin account is CLI-only, see the README's Known limitations. `400` if the username is taken |
| `PUT /api/admin/accounts/:role/:id` | `{ first_name, last_name, username }` | `200 { account }` - edits the **same account in place** (no password change, sessions untouched, constituency assignment untouched); works for any role, including renaming the Mayor's own account. `400` if the new username is taken by someone else, `404` if the id/role pair doesn't exist |
| `PUT /api/admin/accounts/:role/:id/deactivate` | - | `200 { account }` for `corporator`/`mandal_adhyaksh`; `400` for `role: 'admin'` (blocked - no self-lockout risk from this screen) |

#### Roster (Mayor/Admin only - assignment only; accounts themselves are managed above)

Backs the **Manage roles** grid (`services/roster.js`'s `getRoster`/`assignCorporator`/`assignMandalAdhyaksh`).

| Method & path | Body | Response |
| --- | --- | --- |
| `GET /api/admin/roster` | - | `{ wards: [{ id, number, name, name_mr, corporator, mandal_adhyaksh }] }` - `corporator`/`mandal_adhyaksh` (each `{ id, name, username }`) are `null` when unassigned. Which accounts are *available* to assign comes from `GET /api/admin/accounts`, not from here |
| `PUT /api/admin/roster/wards/:wardId/corporator` | `{ corporator_id: number \| null }` | `200 { ward, corporator }`; `null` clears it. Assigning an id **moves** that corporator here, freeing whoever covered this constituency before them (a corporator covers exactly one constituency at a time - unlike a Mandal Adhyaksh, this is never additive) |
| `PUT /api/admin/roster/wards/:wardId/mandal-adhyaksh` | `{ admin_id: number \| null }` | `200 { ward, mandal_adhyaksh }`; `null` clears the constituency's assignment. Unlike `assignCorporator`, this is purely additive - one `admin_id` can be assigned to many constituencies by calling this once per constituency, and doing so never clears any of their other rows |

### Citizen (`Authorization: Bearer <token>`, `role: "citizen"`)

| Method & path | Response |
| --- | --- |
| `GET /api/citizen/issues` | `{ issues: [{ public_id, title, category, status, ward, created_at }] }` - every issue filed with the signed-in phone number, most recent first (no paging: "basic details", not an inbox) |
| `GET /api/citizen/issues/:publicId` | `{ issue }` - same shape as the public tracking view plus `assigned_to`; **no** `citizen`/`location` fields (those would just echo back what the citizen already knows). `404` if it was not filed with this phone number |

`GET /uploads/<uuid>.<ext>` serves a stored photo from the `photos` table (`Cache-Control: immutable`, `Cross-Origin-Resource-Policy: cross-origin` so a web app on another origin can display it). In production every other non-API `GET`
falls back to the React app's `index.html`.

## 3. Frontend

### Routes / pages

| Route | Page | Access |
| --- | --- | --- |
| `/` | `Home` | public |
| `/report` | `ReportIssue` | public |
| `/submitted/:id` | `IssueSubmitted` (shows/copies the Issue ID) | public |
| `/track`, `/track/:id` | `TrackIssue` | public |
| `/login` | `Login` (shared by corporators and admins; `/corporator/login`, `/admin/login` redirect here) | public |
| `/my/login` | `CitizenLogin` (phone number, then a 4-digit code; no password) | public |
| `/my` | `CitizenIssues` (every issue filed with the signed-in phone number; basic list, no dashboard) | citizen |
| `/my/issues/:id` | `CitizenIssueDetail` (status, category, description, photos, history, who it is assigned to) | citizen |
| `/corporator` | `CorporatorDashboard` (own numbers; every figure links to a filtered list) | corporator |
| `/corporator/issues` | `CorporatorIssues` (status chips + category/overdue filter chips, from URL params; paged) | corporator |
| `/corporator/issues/:id` | `CorporatorIssueDetail` (details, status buttons + rejection panel, transfer, history) | corporator |
| `/admin` | `AdminDashboard` (stat cards, category pie chart, notes summary, constituency + corporator tables) | admin, `adminRole="admin"` |
| `/admin/issues` | `AdminIssues` (city-wide list; status/category/constituency/overdue filters from URL params) | admin, `adminRole="admin"` |
| `/admin/issues/:id` | `AdminIssueDetail` (the exact record, read-only, with private notes on it) | admin, `adminRole="admin"` |
| `/admin/notes` | `AdminNotes` (all my private notes, general or per issue) | admin, `adminRole="admin"` |
| `/admin/accounts` | `AdminAccounts` (every account - corporator, Mandal Adhyaksh, admin - as one table: first/last name, username, role, constituency; create/edit/deactivate) | admin, `adminRole="admin"` |
| `/admin/roles` | `AdminRoles` (Manage roles: a grid, one row per constituency - a corporator dropdown and a Mandal Adhyaksh dropdown per row, each with its own Save; people themselves come from Accounts) | admin, `adminRole="admin"` |
| `/mandal`, `/mandal/issues`, `/mandal/issues/:id`, `/mandal/notes` | the **same** `AdminDashboard` / `AdminIssues` / `AdminIssueDetail` / `AdminNotes` components as `/admin/*`, mounted under a `PortalProvider` that points their internal links at `/mandal` instead - see [Component hierarchy](#component-hierarchy) | admin, `adminRole="mandal_adhyaksh"` |
| `*` | `NotFound` | - |

`ProtectedRoute` sends signed-out visitors to `/login` (`/my/login` for `role="citizen"`; and back
afterwards), and signed-in users of the other role to their own home. Its optional `adminRole` prop further
gates the shared `role="admin"` session by the account's sub-role (`auth.user.role`), redirecting a
mismatch (e.g. a Mandal Adhyaksh hitting `/admin/roles`, or the Mayor hitting `/mandal`) to their own home
via `homeFor(auth)` (`lib/routes.js`), which now inspects `auth.user.role` for an admin session, not just
`auth.role`.

### Component hierarchy

```
main.jsx
└─ BrowserRouter
   └─ AuthProvider                       (context: auth, login, loginWithOtp, logout)
      └─ App                             (route table)
         └─ Layout
            ├─ Header                    (nav, IssueIdSearch for staff, sign out)
            ├─ <Outlet />
            │   ├─ Home
            │   ├─ ReportIssue
            │   │   ├─ Alert
            │   │   ├─ FormField ×N        (required * marker)
            │   │   ├─ CheckboxField       (consent declaration)
            │   │   ├─ LocationPicker      (lazy-loaded; Leaflet + OSM tiles, GPS button)
            │   │   └─ PhotoUploader
            │   ├─ IssueSubmitted
            │   ├─ TrackIssue
            │   │   ├─ Spinner / Alert
            │   │   ├─ IssueDetails
            │   │   │   ├─ StatusBadge
            │   │   │   └─ PhotoGallery
            │   │   └─ IssueTimeline
            │   │       └─ PhotoGallery
            │   ├─ Login                 (Alert, FormField, show/hide password)
            │   ├─ CitizenLogin          (phone step, then 4-digit code step; Alert, FormField)
            │   ├─ ProtectedRoute role="citizen"
            │   │   ├─ CitizenIssues     (basic list: title, status, category, constituency, date)
            │   │   └─ CitizenIssueDetail
            │   │       ├─ IssueDetails  (+ "assigned to", no contact/location)
            │   │       └─ IssueTimeline
            │   ├─ ProtectedRoute role="corporator"
            │   │   ├─ CorporatorDashboard (StatCard links, StatusBar, needs-attention list, category table)
            │   │   ├─ CorporatorIssues  (status + filter chips, Alert, Spinner, StatusBadge)
            │   │   └─ CorporatorIssueDetail
            │   │       ├─ IssueDetails  (+ citizen contact)
            │   │       ├─ UpdateForm    (StatusButtons, rejection reason + PhotoUploader proof, FormField)
            │   │       ├─ TransferPanel (FormField, two-step confirm)
            │   │       └─ IssueTimeline (rejection reasons, transfer events)
            │   ├─ ProtectedRoute role="admin" adminRole="admin"   (Mayor/Admin only)
            │   │   ├─ AdminDashboard    (StatCard links, PieChart, notes summary card, WardBar per ward, performance table)
            │   │   ├─ AdminIssues       (IssueListView scope="admin")
            │   │   ├─ AdminIssueDetail  (IssueDetails, CitizenContact, NotesPanel, IssueTimeline)
            │   │   ├─ AdminNotes        (NotesPanel)
            │   │   ├─ AdminAccounts     (AccountRow per account, role filter + search, add-account form)
            │   │   └─ AdminRoles        (grid: CorporatorCell + MandalCell, one dropdown-and-Save pair each, per row)
            │   ├─ ProtectedRoute role="admin" adminRole="mandal_adhyaksh"
            │   │   └─ PortalProvider basePath="/mandal"   (context: usePortal() - see below)
            │   │       ├─ AdminDashboard    (same component; scope banner lists the caller's constituencies)
            │   │       ├─ AdminIssues
            │   │       ├─ AdminIssueDetail
            │   │       └─ AdminNotes
            │   └─ NotFound
            └─ Footer
```

`PortalContext` (`context/PortalContext.jsx`) supplies `{ basePath }` (default `/admin`) so the four shared
admin pages build their internal links (`${basePath}/issues`, `${basePath}/notes`, ...) without prop-drilling
or a duplicate component tree for the Mandal Adhyaksh portal - see `IssueListView.jsx`, `AdminDashboard.jsx`,
`AdminIssueDetail.jsx`, `Header.jsx`.

### Frontend conventions

- `lib/config.js` holds `API_URL` (`VITE_API_URL`, empty = same origin), the router basename (from Vite's `base`, `/wardwatch` on Pages) and `assetUrl()` for photo URLs; `api/client.js` is the only place that calls `fetch`, adds the bearer token, and it throws `ApiError { status, message, fields }`
  so forms can show per-field server validation messages next to the inputs.
- Statuses and categories are defined once per side (`client/src/lib/constants.js`,
  `server/src/lib/constants.js`); the database `CHECK` constraints are the third copy - change all three.
- Tailwind v4, utility classes plus a handful of shared component classes in `index.css`
  (`.card`, `.btn`, `.input`, `.label`). No UI library, no chart library (the ward breakdown is a CSS
  stacked bar with an `aria-label` per row).

### LocationPicker

`components/LocationPicker.jsx` is a controlled component (`latitude`, `longitude`, `onChange`, `error`,
`disabled`); the form owns the state. Leaflet is created once in an effect and driven through refs, with a
second effect syncing the marker to props. The Leaflet container is a **separate inner `<div>` with a
constant `className`**: Leaflet adds its own classes to that element, and React would strip them if it
re-rendered a changing `className` on it (the error border lives on the outer wrapper instead).
The component is `React.lazy`-loaded so Leaflet (~51 KB gzipped) is only downloaded on the report page.

### Internationalisation (English / Marathi)

`client/src/i18n/`: `en.js` and `mr.js` (flat `key -> string` dictionaries, `{name}` placeholders, `key_one` /
`key_other` plurals), `index.js` (the engine: `translate()`, `translateServerMessage()`, language kept in module state so
the API client and formatters can read it), `LanguageContext.jsx` (provider + `useT()` hook: `t`, `statusLabel`,
`categoryLabel`, `wardName`, `personName`) and `components/LanguageToggle.jsx` (in the header).

- **Components must call `useT()`** to re-render on a language change (the context value changes per language).
- **API messages** are English; `ApiError` translates them when created (exact map `serverMessages` in `mr.js`, plus
  patterns for "<field> is required / must be at least N characters").
- **Data:** `wards.name_mr` holds each constituency's Marathi areas (API returns `name` and `name_mr`; the client
  picks by language). The first history row's text "Issue received" is stored in English and translated on display.
- Dates use `en-IN` / `mr-IN` with Latin digits; rupees always use Indian grouping (`₹1,25,000`).
- `server/test/i18n.test.js` enforces key/placeholder parity, that every literal `t('...')` key exists, that no
  dictionary key is dead, and that every message literal in `server/src` has a Marathi translation.

## 4. Key flows

**Submitting an issue** - `POST /api/issues` → rate limit → multer buffers files in memory →
zod validates fields → files checked by magic bytes and written under random names → one transaction
looks up the ward's corporator, inserts the issue (retrying on the ~impossible ID collision), and inserts
the first `issue_updates` row → returns the ID. If the DB write fails the saved files are deleted.

**Corporator update** - one transaction: `SELECT … FOR UPDATE` on the issue (scoped to the corporator's
own id, so other wards' issues 404), insert the `issue_updates` row, update `issues.status / updated_at /
resolved_at`. Concurrent updates serialise on the row lock.

**Authentication** - `POST /api/auth/login` looks the username up in `admins` and `corporators`, verifies bcrypt, inserts a `sessions` row and returns the token. The web app stores it in
`localStorage` and sends it as `Authorization: Bearer`. `loadSession` middleware hashes the token and looks it up on
every `/api` request; `requireRole` guards routes. When `CORS_ORIGINS` is set, the `cors` middleware lets exactly those
origins call `/api` (no credentials/cookies involved).
