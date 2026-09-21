import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import PieChart from '../../components/PieChart.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { CATEGORY_CHART, STATUS, STATUS_ORDER, categoryLabel } from '../../lib/constants.js';
import { formatDateTime, formatHours, formatPercent, formatRupees } from '../../lib/format.js';

/** Stacked bar of a constituency's issues by status, scaled against the busiest one. */
function WardBar({ ward, max }) {
  if (ward.total === 0) return <span className="text-xs text-slate-400">No issues</span>;
  const label = STATUS_ORDER.map((s) => `${ward[s]} ${STATUS[s].label.toLowerCase()}`).join(', ');
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" style={{ width: `${(ward.total / max) * 100}%`, minWidth: '0.75rem' }} role="img" aria-label={label} title={label}>
      {STATUS_ORDER.map((s) => (
        ward[s] > 0 && <div key={s} className={STATUS[s].bar} style={{ width: `${(ward[s] / ward.total) * 100}%` }} />
      ))}
    </div>
  );
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
const td = 'px-3 py-2.5 text-sm tabular-nums';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { totals, wards, corporators, by_category: byCategory, my_notes: notes } = data;
  const maxWard = Math.max(1, ...wards.map((w) => w.total));
  // One slice per category with issues, in the fixed colour order; each slice drills into that category's issues.
  const counts = Object.fromEntries(byCategory.map((c) => [c.category, c.total]));
  const slices = CATEGORY_CHART.filter((c) => counts[c.key] > 0).map((c) => ({
    key: c.key,
    label: categoryLabel(c.key),
    value: counts[c.key],
    color: c.color,
    to: `/admin/issues?category=${c.key}&status=all`,
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">City dashboard</h1>
        <p className="text-xs text-slate-500">As of {formatDateTime(data.generated_at)}</p>
      </div>

      <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Total issues" value={totals.total} to="/admin/issues?status=all" hint={totals.unassigned ? `${totals.unassigned} unassigned` : undefined} />
        <StatCard label="Open" value={totals.open} to="/admin/issues?status=open" hint={`${totals.overdue} overdue (> ${data.overdue_days} days)`} tone={totals.overdue ? 'text-amber-700' : undefined} />
        <StatCard label="Resolved" value={totals.resolved} to="/admin/issues?status=resolved" tone="text-emerald-700" hint={`${totals.rejected} rejected`} />
        <StatCard label="Resolution rate" value={formatPercent(totals.resolution_rate)} hint="Resolved / (total - rejected)" />
        <StatCard label="Avg. time to resolve" value={formatHours(totals.avg_resolution_hours)} />
      </section>

      <section aria-labelledby="by-category" className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="by-category" className="font-semibold">Issues by category</h2>
          <p className="text-xs text-slate-500">Select a slice or a row to see those issues, then open any record.</p>
        </div>
        {slices.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">No issues yet.</p>
        ) : (
          <PieChart slices={slices} unit="issues" ariaLabel="Issues by category, all constituencies" />
        )}
      </section>

      <Link
        to="/admin/notes"
        className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-brand-600 hover:shadow sm:px-5"
      >
        <div>
          <p className="font-semibold">My private notes</p>
          <p className="text-sm text-slate-600">
            {notes.count === 0
              ? 'Keep budget notes and reminders here. Only you can see them.'
              : `${notes.count} note${notes.count === 1 ? '' : 's'}${notes.with_budget ? ` - budget noted: ${formatRupees(notes.budget_total)}` : ''}`}
          </p>
        </div>
        <span className="text-sm font-medium text-brand-700">{notes.count === 0 ? 'Add a note' : 'Open'} &rarr;</span>
      </Link>

      <section aria-labelledby="wards" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id="wards" className="font-semibold">Issues by constituency</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
            {STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${STATUS[s].bar}`} />{STATUS[s].label}</li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Constituency</th>
                <th className={`${th} w-1/3`}>Breakdown</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={`${th} text-right`}>Open</th>
                <th className={`${th} text-right`}>Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wards.map((w) => (
                <tr key={w.ward_id}>
                  <td className={`${td} font-medium`}>
                    <Link to={`/admin/issues?ward=${w.ward_number}&status=all`} className="hover:text-brand-700 hover:underline">Constituency {w.ward_number}</Link>
                    <span className="mt-0.5 block max-w-md text-xs font-normal leading-snug text-slate-500">{w.ward_name}</span>
                  </td>
                  <td className={td}><WardBar ward={w} max={maxWard} /></td>
                  <td className={`${td} text-right`}>{w.total}</td>
                  <td className={`${td} text-right`}>{w.open}</td>
                  <td className={`${td} text-right`}>{w.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="perf" className="card overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 id="perf" className="font-semibold">Corporator performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>Corporator</th>
                <th className={th}>Constituency</th>
                <th className={`${th} text-right`}>Assigned</th>
                <th className={`${th} text-right`}>Resolved</th>
                <th className={`${th} text-right`}>Open</th>
                <th className={`${th} text-right`}>Overdue</th>
                <th className={`${th} text-right`}>Resolution rate</th>
                <th className={`${th} text-right`}>Avg. time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corporators.map((c) => (
                <tr key={c.corporator_id}>
                  <td className={`${td} font-medium`}>
                    {c.name}
                    {!c.is_active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">inactive</span>}
                  </td>
                  <td className={td}>Constituency {c.ward_number}</td>
                  <td className={`${td} text-right`}>{c.total}</td>
                  <td className={`${td} text-right`}>{c.resolved}</td>
                  <td className={`${td} text-right`}>{c.open}</td>
                  <td className={`${td} text-right ${c.overdue ? 'font-semibold text-amber-700' : ''}`}>{c.overdue}</td>
                  <td className={`${td} text-right`}>{formatPercent(c.resolution_rate)}</td>
                  <td className={`${td} text-right`}>{formatHours(c.avg_resolution_hours)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
