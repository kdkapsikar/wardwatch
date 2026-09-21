import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatCard from '../../components/ui/StatCard.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { STATUS, STATUS_ORDER, categoryLabel } from '../../lib/constants.js';
import { formatHours, formatPercent } from '../../lib/format.js';

const issues = (params) => `/corporator/issues?${new URLSearchParams(params)}`;

/** Where the corporator's issues stand; every segment is a link into the filtered list. */
function StatusBar({ totals }) {
  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Issues by status">
        {STATUS_ORDER.filter((s) => totals[s] > 0).map((s) => (
          <Link
            key={s}
            to={issues({ status: s })}
            title={`${STATUS[s].label}: ${totals[s]}`}
            aria-label={`${STATUS[s].label}: ${totals[s]}. View these issues`}
            className={`${STATUS[s].bar} transition hover:opacity-75`}
            style={{ width: `${(totals[s] / totals.total) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <Link to={issues({ status: s })} className="flex items-center gap-1.5 text-slate-700 hover:text-brand-700 hover:underline">
              <span className={`h-2.5 w-2.5 rounded-sm ${STATUS[s].bar}`} />
              {STATUS[s].label} <span className="font-semibold tabular-nums">{totals[s]}</span>
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
        <h1 className="text-2xl font-bold">My dashboard</h1>
        <p className="mt-1 text-sm text-slate-600">Constituency {ward.number} - {ward.name}</p>
      </div>

      {totals.total === 0 ? (
        <div className="card p-10 text-center text-sm text-slate-500">
          No issues have been assigned to you yet. They will appear here as citizens report them.
        </div>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Assigned to me" value={totals.total} to={issues({ status: 'all' })} />
            <StatCard label="Open" value={totals.open} to={issues({ status: 'open' })} hint={`${totals.submitted} not yet acknowledged`} />
            <StatCard
              label="Overdue"
              value={totals.overdue}
              to={issues({ status: 'open', overdue: '1' })}
              hint={`open > ${data.overdue_days} days`}
              tone={totals.overdue ? 'text-amber-700' : undefined}
            />
            <StatCard label="Resolved" value={totals.resolved} to={issues({ status: 'resolved' })} tone="text-emerald-700" />
            <StatCard label="Rejected" value={totals.rejected} to={issues({ status: 'rejected' })} />
          </section>

          <section aria-label="Performance" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Resolution rate" value={formatPercent(totals.resolution_rate)} hint="Resolved / (assigned - rejected)" />
            <StatCard label="Avg. time to resolve" value={formatHours(totals.avg_resolution_hours)} />
            <StatCard label="Received, last 30 days" value={totals.received_30d} />
            <StatCard label="Resolved, last 30 days" value={totals.resolved_30d} />
          </section>

          <section aria-labelledby="standing" className="card p-5">
            <h2 id="standing" className="mb-3 font-semibold">Where things stand</h2>
            <StatusBar totals={totals} />
          </section>

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="attention" className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h2 id="attention" className="font-semibold">Needs attention</h2>
                {totals.overdue > 0 && (
                  <Link to={issues({ status: 'open', overdue: '1' })} className="text-xs font-medium text-brand-700 hover:underline">
                    All {totals.overdue} overdue &rarr;
                  </Link>
                )}
              </div>
              {attention.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">Nothing open. Well done!</p>
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
                              {i.age_days === 0 ? 'today' : `${i.age_days} day${i.age_days === 1 ? '' : 's'} old`}
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
                <h2 id="categories" className="font-semibold">By category</h2>
              </div>
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className={th}>Category</th>
                    <th className={`${th} text-right`}>Total</th>
                    <th className={`${th} text-right`}>Open</th>
                    <th className={`${th} text-right`}>Resolved</th>
                    <th className={`${th} text-right`}>Rejected</th>
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
