// Development seed: the 29 constituencies, a corporator for each, an admin and some demo issues.
//   npm run seed
// Idempotent. REFUSES to run when NODE_ENV=production - it creates accounts
// with well-known passwords. In production load your real wards with SQL and
// create accounts with `npm run user:create` instead (see README).
import bcrypt from 'bcryptjs';
import { config } from '../src/config.js';
import { pool, query } from '../src/db/pool.js';
import { BCRYPT_ROUNDS } from '../src/lib/constants.js';
import { CONSTITUENCIES } from '../db/constituencies.js';
import { addUpdate, createIssue } from '../src/services/issues.js';

if (config.isProd) {
  console.error('Refusing to seed demo accounts in production.');
  process.exit(1);
}

const DEV_CORPORATOR_PASSWORD = 'corporator123';
const DEV_ADMIN_PASSWORD = 'admin12345';

const SAMPLE_ISSUES = [
  ['roads', 'Large pothole near bus stop', 'A deep pothole has formed on the main road right next to the bus stop and is dangerous for two-wheelers.'],
  ['water', 'No water supply since two days', 'Our lane has not received any tap water for two days. Tankers are not coming either.'],
  ['sanitation', 'Garbage not collected', 'Household waste has not been collected for a week and is piling up at the corner.'],
  ['streetlights', 'Street light not working', 'Three street lights on the lane behind the temple have been off for over a month.'],
  ['drainage', 'Overflowing drain', 'The storm drain outside the school overflows after even light rain and floods the footpath.'],
  ['parks', 'Broken swings in park', 'Swings and the see-saw in the children\'s park are broken and unsafe.'],
];

async function main() {
  const adminHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, BCRYPT_ROUNDS);
  const corporatorHash = await bcrypt.hash(DEV_CORPORATOR_PASSWORD, BCRYPT_ROUNDS);

  await query(
    `INSERT INTO admins (name, username, password_hash) VALUES ('Mayor Office', 'admin', $1)
     ON CONFLICT (lower(username)) DO NOTHING`,
    [adminHash],
  );

  for (const [number, areas] of CONSTITUENCIES) {
    const ward = await query(
      `INSERT INTO wards (number, name) VALUES ($1, $2)
       ON CONFLICT (number) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      [number, areas],
    );
    await query(
      `INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)
       ON CONFLICT (ward_id) DO NOTHING`,
      [ward.rows[0].id, `Constituency ${number} Corporator`, `corp${number}`, corporatorHash],
    );
  }

  const { rows } = await query('SELECT count(*)::int AS n FROM issues');
  if (rows[0].n === 0) {
    const wards = (await query('SELECT w.id, c.id AS corporator_id FROM wards w JOIN corporators c ON c.ward_id = w.id ORDER BY w.number')).rows;
    const statuses = [null, 'acknowledged', 'in_progress', 'resolved', 'resolved', 'rejected'];
    let n = 0;
    for (const ward of wards) {
      const howMany = 2 + (ward.id % 4);
      for (let k = 0; k < howMany; k += 1) {
        const [category, title, description] = SAMPLE_ISSUES[(n + k) % SAMPLE_ISSUES.length];
        const issue = await createIssue({
          ward_id: ward.id, category, title, description, address: 'Near the main junction',
          // Demo coordinates scattered around one area, one cluster per constituency.
          latitude: 18.5204 + n * 0.008 + k * 0.001, longitude: 73.8567 + n * 0.008 - k * 0.001,
          name: 'Demo Citizen', phone: '9876543210', photos: [],
        });
        const status = statuses[(n + k) % statuses.length];
        if (status) {
          const remark = status === 'rejected' ? 'Not under municipal jurisdiction.' : `Marked ${status.replace('_', ' ')}.`;
          await addUpdate(issue.public_id, ward.corporator_id, { status, remark, photos: [] });
        }
      }
      n += 1;
    }
    console.log('Created demo issues.');
  }

  console.log('\nSeed complete. Dev logins:');
  console.log(`  Admin       admin / ${DEV_ADMIN_PASSWORD}`);
  console.log(`  Corporators corp1 ... corp${CONSTITUENCIES.length} / ${DEV_CORPORATOR_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
