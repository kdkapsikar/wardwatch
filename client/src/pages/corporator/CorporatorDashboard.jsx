import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import { useT } from '../../i18n/LanguageContext.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { CORPORATOR_STATUSES, STATUS } from '../../lib/constants.js';
import { formatHours, formatPercent } from '../../lib/format.js';

const issues = (params) => `/corporator/issues?${new URLSearchParams(params)}`;

/**
 * Where the corporator's issues stand; every segment is a link into the filtered list.
 * Deliberately shows only the four statuses a corporator can actually set (not "Submitted" -
 * that's a system state before anyone has acted, not one of their options), so the breakdown
 * matches the buttons on the update form instead of introducing a fifth category nobody chooses.
 */
function StatusBar({ totals }) {
  const { t, statusLabel } = useT();
  const actioned = CORPORATOR_STATUSES.reduce((n, s) => n + totals[s], 0);
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={t('dash.statusAria')}>
        {actioned > 0 && CORPORATOR_STATUSES.filter((s) => totals[s] > 0).map((s) => (
          <Link
            key={s}
            to={issues({ status: s })}
            title={`${statusLabel(s)}: ${totals[s]}`}
            aria-label={t('dash.viewThese', { label: statusLabel(s), n: totals[s] })}
            className={`${STATUS[s].bar} transition hover:opacity-75`}
            style={{ width: `${(totals[s] / actioned) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {CORPORATOR_STATUSES.map((s) => (
          <li key={s}>
            <Link to={issues({ status: s })} className="flex items-center gap-1.5 text-slate-700 hover:text-brand-700 hover:underline">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATUS[s].bar}`} />
              {statusLabel(s)} <span className="font-semibold tabular-nums">{totals[s]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const th = 'px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500';
const num = 'px-3 py-2.5 text-right text-sm tabular-nums';
const cellLink = 'font-medium text-brand-700 hover:underline';

export default function CorporatorDashboard() {
  const { auth } = useAuth();
  const { t, categoryLabel, wardName, personName } = useT();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getCorporatorDashboard().then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) return <Alert>{error}</Alert>;
  if (!data) return <Spinner />;

  const { totals, by_category: byCategory, needs_attention: attention } = data;
  const ward = auth.user.ward;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-medium text-brand-700">{t('dash.welcome', { name: personName(auth.user.name) })}</p>
        <h1 className="text-2xl font-bold">{t('dash.corp.title')}</h1>
        <p className="mt-1 text-sm text-slate-600">{t('detail.constituencyValue', { n: ward.number, name: wardName(ward) })}</p>
      </div>

      {totals.total === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          {t('dash.corp.empty')}
        </div>
      ) : (
        <>
          <section aria-label={t('dash.summary')} className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label={t('dash.assigned')} value={totals.total} to={issues({ status: 'all' })} />
            <StatCard label={t('dash.open')} value={totals.open} to={issues({ status: 'open' })} hint={t('dash.notAck', { n: totals.submitted })} />
            <StatCard
              label={t('dash.overdue')}
              value={totals.overdue}
              to={issues({ status: 'open', overdue: '1' })}
              hint={t('dash.overdueHint', { days: data.overdue_days })}
              tone={totals.overdue ? 'text-amber-700' : undefined}
            />
            <StatCard label={t('dash.resolved')} value={totals.resolved} to={issues({ status: 'resolved' })} tone="text-emerald-700" />
            <StatCard label={t('dash.rejected')} value={totals.rejected} to={issues({ status: 'rejected' })} />
          </section>

          <section aria-label={t('dash.performance')} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label={t('dash.resolutionRate')} value={formatPercent(totals.resolution_rate)} hint={t('dash.resolutionRateHint')} />
            <StatCard label={t('dash.avgTime')} value={formatHours(totals.avg_resolution_hours)} />
            <StatCard label={t('dash.received30')} value={totals.received_30d} />
            <StatCard label={t('dash.resolved30')} value={totals.resolved_30d} />
          </section>

          <section aria-labelledby="standing" className="card p-5">
            <h2 id="standing" className="mb-3 font-semibold">{t('dash.standing')}</h2>
            <StatusBar totals={totals} />
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="attention" className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 id="attention" className="font-semibold">{t('dash.attention')}</h2>
                {totals.overdue > 0 && (
                  <Link to={issues({ status: 'open', overdue: '1' })} className="text-xs font-medium text-brand-700 hover:underline">
                    {t('dash.allOverdue', { n: totals.overdue })}
                  </Link>
                )}
              </div>
              {attention.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">{t('dash.nothingOpen')}</p>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {attention.map((i) => (
                    <li key={i.public_id}>
                      <Link to={`/corporator/issues/${i.public_id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">{i.title}</p>
                          <p className="text-xs text-slate-500">
                            {categoryLabel(i.category)} -{' '}
                            <span className={i.age_days > data.overdue_days ? 'font-medium text-amber-700' : ''}>
                              {i.age_days === 0 ? t('dash.today') : t('dash.daysOld', { n: i.age_days, count: i.age_days })}
                            </span>
                          </p>
                        </div>
                        <StatusBadge status={i.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-labelledby="categories" className="card overflow-hidden">
              <div className="border-b border-slate-100 px-4 py-3">
                <h2 id="categories" className="font-semibold">{t('dash.byCategory')}</h2>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>{t('dash.col.category')}</th>
                    <th className={`${th} text-right`}>{t('dash.col.total')}</th>
                    <th className={`${th} text-right`}>{t('dash.col.open')}</th>
                    <th className={`${th} text-right`}>{t('dash.col.resolved')}</th>
                    <th className={`${th} text-right`}>{t('dash.col.rejected')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {byCategory.map((c) => (
                    <tr key={c.category}>
                      <td className="px-3 py-2.5 text-sm font-medium">{categoryLabel(c.category)}</td>
                      {[['total', 'all'], ['open', 'open'], ['resolved', 'resolved'], ['rejected', 'rejected']].map(([key, status]) => (
                        <td key={key} className={num}>
                          {c[key] > 0
                            ? <Link to={issues({ category: c.category, status })} className={cellLink}>{c[key]}</Link>
                            : <span className="text-slate-300">0</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
