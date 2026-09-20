import { query } from '../db/pool.js';
import { config } from '../config.js';

// Definitions used everywhere on the dashboard:
//   open            = submitted + acknowledged + in_progress
//   resolution rate = resolved / (all issues - rejected), as a percentage
//   overdue         = still open and filed more than OVERDUE_DAYS ago
//   avg resolution  = mean hours from filing to resolution (resolved issues only)
const AGG = `
  count(i.id)::int                                            AS total,
  count(i.id) FILTER (WHERE i.status = 'submitted')::int      AS submitted,
  count(i.id) FILTER (WHERE i.status = 'acknowledged')::int   AS acknowledged,
  count(i.id) FILTER (WHERE i.status = 'in_progress')::int    AS in_progress,
  count(i.id) FILTER (WHERE i.status = 'resolved')::int       AS resolved,
  count(i.id) FILTER (WHERE i.status = 'rejected')::int       AS rejected,
  count(i.id) FILTER (WHERE i.status IN ('submitted','acknowledged','in_progress'))::int AS open,
  count(i.id) FILTER (WHERE i.status IN ('submitted','acknowledged','in_progress')
                        AND i.created_at < now() - make_interval(days => $1))::int      AS overdue,
  round((avg(extract(epoch FROM i.resolved_at - i.created_at) / 3600)
           FILTER (WHERE i.status = 'resolved'))::numeric, 1)::float8                   AS avg_resolution_hours`;

const withRate = (row) => {
  const denominator = row.total - row.rejected;
  return { ...row, resolution_rate: denominator > 0 ? Math.round((row.resolved / denominator) * 1000) / 10 : null };
};

export async function getDashboard() {
  const params = [config.overdueDays];
  const [totals, wards, corporators, unassigned] = await Promise.all([
    query(`SELECT ${AGG} FROM issues i`, params),
    query(
      `SELECT w.id AS ward_id, w.number AS ward_number, w.name AS ward_name,
              c.name AS corporator_name, ${AGG}
         FROM wards w
         LEFT JOIN corporators c ON c.ward_id = w.id
         LEFT JOIN issues i      ON i.ward_id = w.id
        GROUP BY w.id, c.name
        ORDER BY w.number`,
      params,
    ),
    query(
      `SELECT c.id AS corporator_id, c.name, c.is_active,
              w.number AS ward_number, w.name AS ward_name, ${AGG}
         FROM corporators c
         JOIN wards w        ON w.id = c.ward_id
         LEFT JOIN issues i  ON i.corporator_id = c.id
        GROUP BY c.id, w.id
        ORDER BY w.number`,
      params,
    ),
    query('SELECT count(*)::int AS n FROM issues WHERE corporator_id IS NULL'),
  ]);

  return {
    generated_at: new Date().toISOString(),
    overdue_days: config.overdueDays,
    totals: { ...withRate(totals.rows[0]), unassigned: unassigned.rows[0].n },
    wards: wards.rows.map(withRate),
    corporators: corporators.rows.map(withRate),
  };
}
