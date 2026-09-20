import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { categoryLabel } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts?.[k] ?? 0), 0);

const TABS = [
  { key: 'open', label: 'Open', count: (c) => sum(c, ['submitted', 'acknowledged', 'in_progress']) },
  { key: 'resolved', label: 'Resolved', count: (c) => sum(c, ['resolved']) },
  { key: 'rejected', label: 'Rejected', count: (c) => sum(c, ['rejected']) },
  { key: 'all', label: 'All', count: (c) => sum(c, ['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected']) },
];

export default function CorporatorIssues() {
  const { auth } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get('status')) ? params.get('status') : 'open';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api.listAssigned({ status: tab === 'all' ? '' : tab, page })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [tab, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const go = (next) => setParams(next, { replace: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Assigned issues</h1>
        <p className="mt-1 text-sm text-slate-600">
          Ward {auth.user.ward.number} - {auth.user.ward.name}
        </p>
      </div>

      <div role="tablist" aria-label="Filter issues" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => go(t.key === 'open' ? {} : { status: t.key })}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {t.label}
            {data && <span className="ml-1.5 tabular-nums opacity-80">{t.count(data.counts)}</span>}
          </button>
        ))}
      </div>

      <Alert>{error}</Alert>
      {!data && !error && <Spinner />}

      {data && data.issues.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">No issues here.</div>
      )}

      {data && data.issues.length > 0 && (
        <ul className="card divide-y divide-slate-100">
          {data.issues.map((issue) => (
            <li key={issue.public_id}>
              <Link to={`/corporator/issues/${issue.public_id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 hover:bg-slate-50 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{issue.title}</p>
                  <p className="text-xs text-slate-500">
                    <span className="font-mono">{issue.public_id}</span> - {categoryLabel(issue.category)} - reported {formatDate(issue.created_at)}
                  </p>
                </div>
                <StatusBadge status={issue.status} />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => go({ ...(tab !== 'open' && { status: tab }), page: String(page - 1) })}>Previous</button>
          <span className="text-slate-600">Page {page} of {pages}</span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => go({ ...(tab !== 'open' && { status: tab }), page: String(page + 1) })}>Next</button>
        </nav>
      )}
    </div>
  );
}
