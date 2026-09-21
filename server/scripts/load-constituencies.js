// Load / refresh the 29 constituencies in an existing database (safe to re-run).
//
//   npm run constituencies:load -w server
//   WW_PASSWORD='...' npm run constituencies:load -w server     # also create missing corporator accounts
//
// - Inserts or updates constituencies 1-29 (number + areas, in English and Marathi).
// - With WW_PASSWORD set, creates a corporator `corp<N>` ("Constituency N Corporator") for every
//   constituency that has none, all with that password. Without it, no accounts are created.
// - Renames old placeholder corporators called "Ward N Corporator". Real names are never touched.
import bcrypt from 'bcryptjs';
import { CONSTITUENCIES } from '../db/constituencies.js';
import { pool, withTransaction } from '../src/db/pool.js';
import { BCRYPT_ROUNDS } from '../src/lib/constants.js';

const password = process.env.WW_PASSWORD;
if (password !== undefined && password.length < 10) {
  console.error('WW_PASSWORD must be at least 10 characters.');
  process.exit(1);
}

async function main() {
  const hash = password ? await bcrypt.hash(password, BCRYPT_ROUNDS) : null;
  const summary = { wardsInserted: 0, wardsUpdated: 0, corporatorsCreated: 0, corporatorsRenamed: 0, skipped: [] };

  await withTransaction(async (db) => {
    for (const [number, areas, areasMr] of CONSTITUENCIES) {
      const { rows } = await db.query(
        `INSERT INTO wards (number, name, name_mr) VALUES ($1, $2, $3)
         ON CONFLICT (number) DO UPDATE SET name = EXCLUDED.name, name_mr = EXCLUDED.name_mr
         RETURNING id, (xmax = 0) AS inserted`,
        [number, areas, areasMr],
      );
      const wardId = rows[0].id;
      if (rows[0].inserted) summary.wardsInserted += 1;
      else summary.wardsUpdated += 1;

      const renamed = await db.query(
        `UPDATE corporators SET name = $2 WHERE ward_id = $1 AND name ~ '^Ward [0-9]+ Corporator$'`,
        [wardId, `Constituency ${number} Corporator`],
      );
      summary.corporatorsRenamed += renamed.rowCount;

      if (hash) {
        const existing = await db.query('SELECT 1 FROM corporators WHERE ward_id = $1', [wardId]);
        if (existing.rowCount === 0) {
          const created = await db.query(
            `INSERT INTO corporators (ward_id, name, username, password_hash) VALUES ($1, $2, $3, $4)
             ON CONFLICT DO NOTHING`,
            [wardId, `Constituency ${number} Corporator`, `corp${number}`, hash],
          );
          if (created.rowCount) summary.corporatorsCreated += 1;
          else summary.skipped.push(`corp${number} (username already taken)`);
        }
      }
    }
  });

  const counts = (await pool.query(
    `SELECT (SELECT count(*) FROM wards)::int AS constituencies,
            (SELECT count(*) FROM corporators)::int AS corporators,
            (SELECT count(*) FROM wards w WHERE NOT EXISTS (SELECT 1 FROM corporators c WHERE c.ward_id = w.id))::int AS without_corporator`,
  )).rows[0];
  console.log(summary);
  console.log(counts);
}

main()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
