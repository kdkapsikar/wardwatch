import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import PieChart from '../../components/PieChart.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import { CATEGORY_CHART, CORPORATOR_STATUSES, STATUS } from '../../lib/constants.js';
import { formatDateTime, formatHours, formatPercent, formatRupees } from '../../lib/format.js';

/**
 * Stacked bar of a constituency's issues by status, scaled against the busiest one. Only the four
 * statuses a corporator can set are broken out (not "Submitted", a system state nobody chooses) so
 * this matches the same four everywhere else on the dashboard; the bar's own width still reflects
 * the ward's true total, so a ward with many fresh, unactioned issues still reads as busy.
 */
function WardBar({ ward, max }) {
  const { t, statusLabel } = useT();
  if (ward.total === 0) return <span className="text-xs text-slate-400">{t('admin.dash.noIssuesShort')}</span>;
  const actioned = CORPORATOR_STATUSES.reduce((n, s) => n + ward[s], 0);
  const label = CORPORATOR_STATUSES.map((s) => `${ward[s]} ${statusLabel(s)}`).join(', ');
  return (
    <div className="flex h-3 overflow-hidden rounded-full bg-slate-100" style={{ width: `${(ward.total / max) * 100}%`, minWidth: '0.75rem' }} role="img" aria-label={label} title={label}>
      {actioned > 0 && CORPORATOR_STATUSES.map((s) => (
        ward[s] > 0 && <div key={s} className={STATUS[s].bar} style={{ width: `${(ward[s] / actioned) * 100}%` }} />
      ))}
    </div>
  );
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
const td = 'px-3 py-2.5 text-sm tabular-nums';

export default function AdminDashboard() {
  const { auth } = useAuth();
  const { t, statusLabel, categoryLabel, wardName, personName } = useT();
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
        <div>
          <p className="text-sm font-medium text-brand-700">{t('dash.welcome', { name: personName(auth.user.name) })}</p>
          <h1 className="text-2xl font-bold">{t('admin.dash.title')}</h1>
        </div>
        <p className="text-xs text-slate-500">{t('admin.dash.asOf', { when: formatDateTime(data.generated_at) })}</p>
      </div>

      {/* Total, then the exact four statuses a corporator can set - same set, same order, same
          labels as the by-constituency bars below and the corporator's own dashboard. */}
      <section aria-label={t('dash.summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label={t('admin.dash.total')} value={totals.total} to="/admin/issues?status=all" hint={totals.unassigned ? t('admin.dash.unassigned', { n: totals.unassigned }) : undefined} />
        <StatCard label={statusLabel('acknowledged')} value={totals.acknowledged} to="/admin/issues?status=acknowledged" tone="text-sky-700" />
        <StatCard label={statusLabel('in_progress')} value={totals.in_progress} to="/admin/issues?status=in_progress" tone="text-amber-600" />
        <StatCard label={t('dash.resolved')} value={totals.resolved} to="/admin/issues?status=resolved" tone="text-emerald-700" />
        <StatCard label={t('dash.rejected')} value={totals.rejected} to="/admin/issues?status=rejected" tone="text-rose-700" />
      </section>

      <section aria-label={t('dash.performance')} className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label={t('dash.overdue')}
          value={totals.overdue}
          to="/admin/issues?status=open&overdue=1"
          hint={t('dash.overdueHint', { days: data.overdue_days })}
          tone={totals.overdue ? 'text-amber-700' : undefined}
        />
        <StatCard label={t('dash.resolutionRate')} value={formatPercent(totals.resolution_rate)} hint={t('admin.dash.resolutionHint')} />
        <StatCard label={t('dash.avgTime')} value={formatHours(totals.avg_resolution_hours)} />
      </section>

      <section aria-labelledby="by-category" className="card p-5 sm:p-6">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="by-category" className="font-semibold">{t('admin.dash.byCategory')}</h2>
          <p className="text-xs text-slate-500">{t('admin.dash.byCategoryHelp')}</p>
        </div>
        {slices.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">{t('admin.dash.noIssues')}</p>
        ) : (
          <PieChart slices={slices} unit={t('pie.issues')} ariaLabel={t('admin.dash.pieAria')} />
        )}
      </section>

      <Link
        to="/admin/notes"
        className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-brand-600 hover:shadow sm:px-5"
      >
        <div>
          <p className="font-semibold">{t('admin.notes.card')}</p>
          <p className="text-sm text-slate-600">
            {notes.count === 0
              ? t('admin.notes.cardEmpty')
              : `${t('admin.notes.count', { n: notes.count, count: notes.count })}${notes.with_budget ? ` - ${t('admin.notes.budgetLabel')} ${formatRupees(notes.budget_total)}` : ''}`}
          </p>
        </div>
        <span className="text-sm font-medium text-brand-700">{notes.count === 0 ? t('admin.notes.addNote') : t('admin.notes.open')} &rarr;</span>
      </Link>

      <section aria-labelledby="wards" className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 id="wards" className="font-semibold">{t('admin.dash.byWard')}</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label={t('admin.dash.legend')}>
            {CORPORATOR_STATUSES.map((s) => (
              <li key={s} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${STATUS[s].bar}`} />{statusLabel(s)}</li>
            ))}
          </ul>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('admin.dash.col.ward')}</th>
                <th className={`${th} w-1/3`}>{t('admin.dash.col.breakdown')}</th>
                <th className={`${th} text-right`}>{t('dash.col.total')}</th>
                <th className={`${th} text-right`}>{t('dash.col.open')}</th>
                <th className={`${th} text-right`}>{t('dash.col.resolved')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {wards.map((w) => (
                <tr key={w.ward_id}>
                  <td className={`${td} font-medium`}>
                    <Link to={`/admin/issues?ward=${w.ward_number}&status=all`} className="hover:text-brand-700 hover:underline">{t('list.constituencyChip', { n: w.ward_number })}</Link>
                    <span className="mt-0.5 block max-w-md text-xs font-normal leading-snug text-slate-500">{wardName({ name: w.ward_name, name_mr: w.ward_name_mr })}</span>
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
          <h2 id="perf" className="font-semibold">{t('admin.dash.perf')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px]">
            <thead className="bg-slate-50">
              <tr>
                <th className={th}>{t('admin.dash.col.corporator')}</th>
                <th className={th}>{t('admin.dash.col.ward')}</th>
                <th className={`${th} text-right`}>{t('admin.dash.col.assigned')}</th>
                <th className={`${th} text-right`}>{t('dash.col.resolved')}</th>
                <th className={`${th} text-right`}>{t('dash.col.open')}</th>
                <th className={`${th} text-right`}>{t('dash.overdue')}</th>
                <th className={`${th} text-right`}>{t('dash.resolutionRate')}</th>
                <th className={`${th} text-right`}>{t('admin.dash.col.avgTime')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {corporators.map((c) => (
                <tr key={c.corporator_id}>
                  <td className={`${td} font-medium`}>
                    {personName(c.name)}
                    {!c.is_active && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">{t('admin.dash.inactive')}</span>}
                  </td>
                  <td className={td}>{t('list.constituencyChip', { n: c.ward_number })}</td>
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
