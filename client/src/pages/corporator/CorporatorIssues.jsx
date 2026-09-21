import { useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.jsx';
import Alert from '../../components/ui/Alert.jsx';
import Spinner from '../../components/ui/Spinner.jsx';
import StatusBadge from '../../components/ui/StatusBadge.jsx';
import { CATEGORIES, categoryLabel } from '../../lib/constants.js';
import { formatDate } from '../../lib/format.js';

const sum = (counts, keys) => keys.reduce((n, k) => n + (counts?.[k] ?? 0), 0);
const OPEN = ['submitted', 'acknowledged', 'in_progress'];

// Status filter chips. The "status" URL parameter drives everything, so dashboard drill-downs and
// the browser's back button just work.
const CHIPS = [
  { key: 'open', label: 'Open', count: (c) => sum(c, OPEN) },
  { key: 'submitted', label: 'Not acknowledged', count: (c) => sum(c, ['submitted']) },
  { key: 'acknowledged', label: 'Acknowledged', count: (c) => sum(c, ['acknowledged']) },
  { key: 'in_progress', label: 'In progress', count: (c) => sum(c, ['in_progress']) },
  { key: 'resolved', label: 'Resolved', count: (c) => sum(c, ['resolved']) },
  { key: 'rejected', label: 'Rejected', count: (c) => sum(c, ['rejected']) },
  { key: 'all', label: 'All', count: (c) => sum(c, [...OPEN, 'resolved', 'rejected']) },
];

export default function CorporatorIssues() {
  const { auth } = useAuth();
  const location = useLocation();
  const [params, setParams] = useSearchParams();

  const status = CHIPS.some((c) => c.key === params.get('status')) ? params.get('status') : 'open';
  const category = CATEGORIES.some((c) => c.value === params.get('category')) ? params.get('category') : '';
  const overdue = params.get('overdue') === '1';
  const page = Math.max(1, Number(params.get('page')) || 1);

  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setError('');
    api.listAssigned({ status, category, overdue, page })
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [status, category, overdue, page]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const go = (next = {}) => {
    const merged = { status, ...(category && { category }), ...(overdue && { overdue: '1' }), ...next };
    if (merged.status === 'open') delete merged.status; // 'open' is the default
    Object.keys(merged).forEach((k) => (merged[k] === undefined || merged[k] === '') && delete merged[k]);
    setParams(merged);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Issues</h1>
        <p className="mt-1 text-sm text-slate-600">
          Constituency {auth.user.ward.number} - {auth.user.ward.name}
        </p>
      </div>

      <Alert tone="success">{location.state?.flash}</Alert>

      <div role="group" aria-label="Filter by status" className="flex flex-wrap gap-2">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={status === c.key}
            onClick={() => go({ status: c.key, page: undefined })}
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
              status === c.key ? 'bg-brand-600 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
            }`}
          >
            {c.label}
            {data && <span className="ml-1.5 tabular-nums opacity-80">{c.count(data.counts)}</span>}
          </button>
        ))}
      </div>

      {(category || overdue) && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Filtered by:</span>
          {category && (
            <button type="button" onClick={() => go({ category: undefined, page: undefined })} className="rounded-full bg-brand-50 px-3 py-1 font-medium text-brand-800 hover:bg-brand-100" aria-label={`Remove category filter ${categoryLabel(category)}`}>
              {categoryLabel(category)} &times;
            </button>
          )}
          {overdue && (
            <button type="button" onClick={() => go({ overdue: undefined, page: undefined })} className="rounded-full bg-amber-50 px-3 py-1 font-medium text-amber-800 hover:bg-amber-100" aria-label="Remove overdue filter">
              Overdue &times;
            </button>
          )}
        </div>
      )}

      <Alert>{error}</Alert>
      {!data && !error && <Spinner />}

      {data && data.issues.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">No issues match these filters.</div>
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
          <button className="btn btn-secondary" disabled={page <= 1} onClick={() => go({ page: String(page - 1) })}>Previous</button>
          <span className="text-slate-600">Page {page} of {pages}</span>
          <button className="btn btn-secondary" disabled={page >= pages} onClick={() => go({ page: String(page + 1) })}>Next</button>
        </nav>
      )}
    </div>
  );
}
